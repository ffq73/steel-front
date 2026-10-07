/* ============================================================
   engine/battle.js —— 每日战斗结算（v2.0 §3.7，公式可复算）
   resolveBattle(world, rng, hexIdx) → BattleReport

   v14.1 W1 战斗内核 HOI4 化（本轮重构要点）：
   W1-1  战宽用 HOI4 原值（TERRAIN_COMBAT_WIDTH.base/flank），师宽经
         WIDTH_SCALE 换算（1 师 = 10 宽）；超宽惩罚系数回 1.0 并封顶 -33%
   W1-2  ⭐逐师配对取代全场均值：buildTargetLists 按交战宽度（2×师宽）
         建立目标列表；守方防御按「被多少个师攻击」均分（defShare），
         每对独立结算命中率与减伤 —— 堆兵收益重新与集中度挂钩
   W1-3  包围（全邻陆格敌控）守方 ×0.70；要塞每级攻方 -15%、每多一个
         进攻方向抵消一级（末级不可抵消）；夜间 22:00–05:59 双方 ×0.5
   W1-4  指挥官技能每点攻/防 ±2.5%（经 army.generalId → getGeneralSkills）
   W1-6  整师才能参战：装不下战宽的师留预备队（增援骰成功也须装得下，
         容差内缺口可挤入 ≤ WIDTH_OVERFLOW_TOL×师宽）
   W1-7  经验：参战/演习得 XP，经 doctrine.DIVISION_EXP_TIERS 映射档位
         （0.75/1.00/1.25/1.50/1.75），u.level 由档位派生（1~5）
   W1-8  防御/突破分离：守方受击用 Defense，攻方挨反击用 Breakthrough
         （逐师结算，不再取均值）；甲弹四档阶梯逐对结算
         （反坦克营 pierceBonus 经 templateAdjust 生效）
   ============================================================ */

import { K, defenseMitigation } from '../data/constants.js';
import { TERRAIN } from '../data/terrain.js';
import { UNITS } from '../data/units.js';
import { hexUnits } from './world.js';
import { hexDist } from '../core/geom.js';
import { determineBattleTactics, getGeneralSkills } from './plans.js';
import { templateAdjust, templateHasSupport } from './template.js';
import { unitMod, combatMods } from './mods.js';
import { getRiverPenalty, hasRiverCrossing } from '../data/rivers.js';
import { getUnitSupplyModifiers } from './logistics.js';
import { getBattleAirModifier } from './air.js';
import { getShoreBombardmentModifier } from './navy.js';
import { calcIntelCombatBonus } from './intel.js';
import { barrageModifierForHex } from './barrage.js';   // W0-D1 一战炮火准备
import { droneReconModifier } from './drones.js';       // W0-D2 现代无人机/电子战
import { getDivisionExpTier, addUnitXp } from './doctrine.js';     // W1-7 师经验阶梯（档位唯一权威）
import { getTheaterCombatBonus, getArmyOverCapacityPenalty } from './theaters.js'; // W2-3 战区统帅与集团军容量

/* 国家修正值（科技/国策/法案结算到 nation.modifiers: stat → Σvalue） */
function mod(nation, stat){
  return 1 + (nation.modifiers[stat] || 0);
}

/* W1-7：经验乘数改由 doctrine.DIVISION_EXP_TIERS 权威驱动。
   expRatio = xp / 100；阶梯：乌合 0.75 / 训练 1.00 / 常规 1.25 /
   百战 1.50 / 老练 1.75。u.level 由档位派生（1~5），供 UI 显示。 */
export function expMul(u){
  return getDivisionExpTier((u.xp || 0) / K.XP_RATIO_SCALE).mul;
}
export function strengthFactor(u){ return K.STRENGTH_FLOOR + (1 - K.STRENGTH_FLOOR) * (u.hp / UNITS[u.type].hp); }

/* W1-4：指挥官技能乘数（攻/防双向，每点 ±2.5%）。
   经 u.armyId → army.generalId → getGeneralSkills（traits 推断的唯一实现）。 */
export function commanderSkillMul(world, u, kind){
  if(!world.armies || !u.armyId) return 1;
  const army = world.armies.find(a => a.id === u.armyId);
  if(!army || !army.generalId) return 1;
  const s = getGeneralSkills(world, army.generalId);
  return 1 + K.COMMANDER_SKILL_COMBAT * ((s && s[kind]) || 0);
}

/* W1-3：要塞攻方乘数。每级 -15%；每多一个进攻方向抵消一级，末级不可抵消。
   fort=3、dirs=1 → ×0.55；fort=3、dirs=2 → ×0.70（验收闸门口径）。 */
export function fortAttackMul(fortLevel, dirs){
  const f = fortLevel || 0;
  if(f <= 0) return 1;
  const effective = Math.max(1, f - (Math.max(1, dirs) - 1));
  return 1 - K.FORT_ATK_PENALTY * effective;
}

/* W1-3：包围判定 —— 所有相邻陆格都被敌国控制（海格不算通路）时守方被围。 */
export function isHexEncircled(world, h, nat){
  if(!h.adj || !h.adj.length) return false;
  let sawLand = false;
  for(const ni of h.adj){
    const nh = world.hexes[ni];
    if(!nh || nh.terrain === 'sea') continue;
    sawLand = true;
    const nn = world.nations[nat];
    if(!(nn && nn.atWarWith.includes(nh.owner))) return false;
  }
  return sawLand;
}
export function encirclementFactor(world, h, nat){
  return isHexEncircled(world, h, nat) ? K.ENCIRCLED_DEF_MUL : 1.0;
}

/* W1-1：超宽惩罚（纯函数，结算与验收闸门共用）。
   HOI4：-100% × (总宽 − 战宽)/战宽，系数 1.0，封顶 -33%。
   W2-1: 矛头师/忽略宽度惩罚标志下，超宽惩罚为 0。 */
export function computeOverflowPenalty(totalWidth, battleWidth, opts = {}){
  if(opts && (opts.isSpearhead || opts.ignoreWidthPenalty)) return 0;
  if(!(battleWidth > 0)) return 0;
  const over = Math.max(0, (totalWidth - battleWidth) / battleWidth);
  return Math.min(K.WIDTH_OVERFLOW_CAP, K.WIDTH_OVERFLOW_COEF * over);
}

/* W1-1/W1-6：战宽整装填（纯函数，结算与验收闸门共用）。
   items = [{ unit, width }]（已按优先级排序）；整师装得下才进场，
   否则留预备队 —— 因此正常流程总宽 ≤ 战宽，超宽惩罚恒为 0；
   "强制 84/100 宽"等超宽场景只能由外部构造，交给 computeOverflowPenalty。 */
export function computeWidthFill(items, width, opts = {}){
  const inField = []; const reserves = [];
  let w = 0;
  for(const it of items){
    if(w + it.width <= width){ inField.push(it.unit); w += it.width; }
    else reserves.push(it.unit);
  }
  return { inField, reserves, totalWidth: w, overPenalty: computeOverflowPenalty(w, width, opts) };
}

/**
 * W2-1: 检查某格是否处于敌方牵制 (pin) 状态
 */
export function isHexPinned(world, hex){
  if(!hex) return false;
  return (world.units || []).some(u => {
    if(u.hp <= 0 || !u.order || u.order.type !== 'pin') return false;
    const [tq, tr] = u.order.target || [];
    if(tq === hex.q && tr === hex.r){
      return world.nations[u.nat] && world.nations[u.nat].atWarWith.includes(hex.owner);
    }
    return false;
  });
}

/**
 * W2-1: 支援攻击 (Support Attack) 侧翼/后方判定
 * 支援部队必须与目标格相邻，且不能与主攻方向完全共用同一正面格
 */
export function canSupportAttack(world, unit, targetHex){
  if(!unit || !targetHex) return { ok: false, reason: '参数无效' };
  if(hexDist(unit.q, unit.r, targetHex.q, targetHex.r) !== 1){
    return { ok: false, reason: '支援部队必须与目标格相邻' };
  }
  const nat = world.nations[unit.nat];
  if(!nat || !nat.atWarWith.includes(targetHex.owner)){
    return { ok: false, reason: '目标非敌对领土' };
  }
  const directAttackers = (world.units || []).filter(u => {
    if(u.hp <= 0 || !u.order || u.id === unit.id) return false;
    const isAtk = u.order.type === 'attack' || u.order.type === 'spearhead' || u.order.type === 'breakthrough';
    if(!isAtk) return false;
    const [tq, tr] = u.order.target || u.order.dest || [];
    return tq === targetHex.q && tr === targetHex.r;
  });
  if(directAttackers.length > 0 && directAttackers.every(u => u.q === unit.q && u.r === unit.r)){
    return { ok: false, reason: '正面格不可发起支援攻击，仅侧翼或后方生效' };
  }
  return { ok: true };
}

/* W0-A3：师在战场上的实际战斗宽度（编制构成比 × WIDTH_SCALE → HOI4 口径）。
   checkCombatWidth（UI 预判）与 resolveBattle（实际结算）必须共用本函数。 */
export function unitCombatWidth(world, u){
  return UNITS[u.type].width * templateAdjust(world, u).width * K.WIDTH_SCALE;
}

/* v8.0 M4：进攻前预览目标格战宽占用（与 resolveBattle 同一套战宽口径） */
export function checkCombatWidth(world, tq, tr){
  const h = world.at[tq + ',' + tr];
  if(!h) return { full:false, width:0, used:0, waiting:0 };
  const attackers = world.units.filter(u => {
    if(u.hp <= 0 || !u.order) return false;
    if(u.order.type !== 'attack' && u.order.type !== 'support') return false;
    return u.order.target[0] === tq && u.order.target[1] === tr;
  });
  const TW = K.TERRAIN_COMBAT_WIDTH[h.terrain] || { base: K.BASE_WIDTH, flank: K.WIDTH_PER_FLANK };
  const dirs = new Set(attackers.map(u => u.q + ',' + u.r));
  const width = Math.min(TW.base + (Math.max(1, dirs.size) - 1) * TW.flank, K.WIDTH_MAX);
  let used = 0, waiting = 0;
  for(const u of attackers){
    const uw = unitCombatWidth(world, u);
    if(used + uw <= width) used += uw;
    else waiting++;
  }
  return { full: waiting > 0, width: +width.toFixed(1), used: +used.toFixed(1),
           waiting, attackers: attackers.length };
}

/* 单位有效攻击（对给定目标硬度） */
export function unitAtk(world, u, targetHardness, opts){
  const U = UNITS[u.type];
  const nat = world.nations[u.nat];
  const ter = TERRAIN[opts.terrain];
  let baseSoft = U.soft;
  let baseHard = U.hard;
  // W0-A3：编制只调整构成比（基准编制 = 1.0），不把 9 个营的聚合值当 1 个师用
  const adj = templateAdjust(world, u);
  baseSoft *= adj.soft;
  baseHard *= adj.hard;
  // W0-A2：按 unit:<type> → unit:all → nation 逐层累加解析修正。
  const cm = combatMods(nat, u.type);
  baseSoft *= cm.soft;
  baseHard *= cm.hard;
  let v = (baseSoft * (1 - targetHardness) + baseHard * targetHardness);
  v *= strengthFactor(u) * expMul(u);
  v *= ter.atk;
  if(opts.entrenchDefender) v /= (1 + opts.entrenchDefender);   // 壕沟：防守方减伤
  v *= cm.atk;                        // W0-A2：含 nation 的 'atk'（'inf_atk'/'all_atk' 亦生效）
  if(world.eraData && world.eraData.atkMultiplier != null) v *= world.eraData.atkMultiplier;
  if(U === UNITS.arm || u.type === 'arm') v *= mod(nat, 'unitAtkArm');  // 保留旧键（独立语义）
  v *= commanderSkillMul(world, u, 'attack');   // W1-4：指挥官攻击技能

  // W2-3: 战区统帅 / 元帅攻击加成
  if(u.armyId && world.armies){
    const army = world.armies.find(a => a.id === u.armyId);
    if(army && army.theaterId){
      const tBonus = getTheaterCombatBonus(world, army.theaterId, u.nat);
      if(tBonus && tBonus.atkBonus) v *= (1 + tBonus.atkBonus);
    }
  }

  // W2-1: 牵制 (pin)：若进攻出发格正被敌方牵制，进攻效率 ×0.67
  const originHex = (world.at && u.q != null && u.r != null) ? world.at[u.q + ',' + u.r] : null;
  if(isHexPinned(world, originHex)){
    v *= 0.67;
  }

  // W2-1: 突破命令 (breakthrough)：+20% 冲击力
  if(u.order && u.order.type === 'breakthrough'){
    v *= 1.20;
  }

  // W2-1: 支援攻击 (support)：侧翼/后方火力加成 +15%
  if(u.order && u.order.type === 'support'){
    v *= 1.15;
  }

  // 作战计划加成 (§2.4)
  if(u.planning) v *= (1 + u.planning);

  // 军长超编惩罚 (C14 / W2-3: 兼容区域防御 72 师 / Skilled Staffer 30 师)
  if(u.armyId && world.armies){
    const army = world.armies.find(a => a.id === u.armyId);
    if(army && army.divisions){
      const overPenalty = getArmyOverCapacityPenalty(world, army);
      if(overPenalty > 0) v *= (1 - overPenalty);
    }
  }

  // 渡河攻击惩罚 (§3.2): 基础 -30% 攻击，工兵连减半为 -15%
  if(opts && opts.targetHex){
    const riverPenalty = getRiverPenalty(world, u, u.q, u.r, opts.targetHex.q, opts.targetHex.r);
    v *= riverPenalty;
  }

  // 断供战斗惩罚 (B.3)：超宽限期后攻击减损
  if(opts && opts.supplyAtkMul != null) v *= opts.supplyAtkMul;

  return v;
}

/* 单位有效防御（守方受击属性；W1-8 与突破彻底分离） */
export function unitDef(world, u, opts){
  const U = UNITS[u.type];
  const nat = world.nations[u.nat];
  const ter = TERRAIN[opts.terrain];
  let baseDef = U.def;
  baseDef *= templateAdjust(world, u).def;   // W0-A3：比例化挂载，同unitAtk
  const cmD = combatMods(nat, u.type);
  baseDef *= cmD.def;                        // W0-A2：def / all_def / <type>_def 逐层累加
  let v = baseDef * strengthFactor(u) * expMul(u) * ter.def;
  v *= (1 + (u.entrench || 0));
  v *= commanderSkillMul(world, u, 'defense');   // W1-4：指挥官防御技能
  if(opts && opts.encircled) v *= K.ENCIRCLED_DEF_MUL;   // W1-3：被围守方 -30%

  // W2-1: 区域防御 (area_defense)：+50% 防御
  if(u.order && u.order.type === 'area_defense'){
    v *= 1.50;
  } else if(u.armyId && world.armies){
    const army = world.armies.find(a => a.id === u.armyId);
    if(army && (army.orderType === 'area_defense' || army.areaDefense)){
      v *= 1.50;
    }
  }

  // W2-3: 战区统帅 / 元帅防御加成
  if(u.armyId && world.armies){
    const army = world.armies.find(a => a.id === u.armyId);
    if(army && army.theaterId){
      const tBonus = getTheaterCombatBonus(world, army.theaterId, u.nat);
      if(tBonus && tBonus.defBonus) v *= (1 + tBonus.defBonus);
    }
  }

  // 军长超编惩罚 (C14 / W2-3)
  if(u.armyId && world.armies){
    const army = world.armies.find(a => a.id === u.armyId);
    if(army && army.divisions){
      const overPenalty = getArmyOverCapacityPenalty(world, army);
      if(overPenalty > 0) v *= (1 - overPenalty);
    }
  }

  // 断供战斗惩罚 (B.3)
  if(opts && opts.supplyDefMul != null) v *= opts.supplyDefMul;

  return v;
}

/* W1-8：单位突破值（进攻方挨反击时的"防御"属性，逐师结算） */
export function unitBreakthrough(world, u){
  const U = UNITS[u.type];
  return (U.brk || 0) * templateAdjust(world, u).brk
       * unitMod(world.nations[u.nat], u.type, 'brk')
       * strengthFactor(u) * expMul(u)
       * commanderSkillMul(world, u, 'attack');
}

/* W1-8：单位穿甲值（反坦克营 pierceBonus 经 templateAdjust 计入） */
export function unitPiercing(world, u){
  const U = UNITS[u.type];
  return (U.piercing || 0) + (templateAdjust(world, u).pierceBonus || 0);
}

/* W1-8：甲弹四档阶梯（穿甲/装甲比 ≥1 / ≥0.75 / ≥0.5 / 更低） */
export function pierceMultiplier(atkPierce, defArmor){
  if(!(defArmor > 0)) return 1.0;
  const ratio = atkPierce / defArmor;
  return ratio >= 1.0 ? 1.0 : ratio >= 0.75 ? 0.80 : ratio >= 0.50 ? 0.65 : 0.50;
}

/* W1-2：逐师目标列表（核心）。
   每个进攻师的交战宽度 = 2 × 自身战斗宽度；敌师按随机顺序加入列表，
   装不下的被拒绝（至少保留 1 个目标）。每个守师记录被几个师攻击 ——
   这个计数决定它的防御如何在进攻方之间均分。 */
export function buildTargetLists(attackers, defenders, rng){
  const order = [...attackers];
  for(let i = order.length - 1; i > 0; i--){
    const j = Math.floor(rng() * (i + 1));
    const t = order[i]; order[i] = order[j]; order[j] = t;
  }
  const nAtk = new Map(defenders.map(d => [d.u.id, 0]));
  for(const a of order){
    const engagement = 2 * a.width;
    a.targets = [];
    let used = 0;
    const start = defenders.length ? Math.floor(rng() * defenders.length) : 0;
    for(let k = 0; k < defenders.length; k++){
      const d = defenders[(start + k) % defenders.length];
      if(a.targets.length === 0 || used + d.width <= engagement){
        a.targets.push(d);
        used += d.width;
      }
    }
    for(const d of a.targets) nAtk.set(d.u.id, (nAtk.get(d.u.id) || 0) + 1);
  }
  for(const d of defenders) d.attackersCount = Math.max(1, nAtk.get(d.u.id) || 0);
  return { attackers: order, defenders };
}

/* 主入口：对单个交战格结算一轮每日战斗 */
export function resolveBattle(world, rng, hexIdx){
  const h = world.hexes[hexIdx];
  // 收集进攻方（order.attack 指向本格、位于相邻格）
  // v8.0 M4：进攻（相邻）+ 支援（原地，相邻亦可参与）
  // W2-1：支持 spearhead 矛头与 breakthrough 突破命令
  const allAtk = world.units.filter(u => {
    if(u.hp <= 0 || !u.order || u.strategic) return false;      // 战略调动中不参战
    const isAtkType = u.order.type === 'attack' || u.order.type === 'support' ||
                      u.order.type === 'spearhead' || u.order.type === 'breakthrough';
    if(!isAtkType) return false;
    const [tq, tr] = u.order.target || u.order.dest || [];
    if(tq !== h.q || tr !== h.r) return false;
    if(u.order.type === 'support'){
      return hexDist(u.q, u.r, h.q, h.r) === 1;                 // 支援需相邻
    }
    return true;
  });
  const report = { hexIdx, hexName: h.city ? h.city.name : null, rounds:[], retreat:[], destroyed:[], capturedBy:null };
  report._destroyedSet = new Set();   // v14.0 P0：逐小时结算会出现跨小时重复计数

  if(!allAtk.length){ return report; }

  // 目标已非敌国 → 走位进入（movement 阶段已处理，此处兜底清命令）
  const sample = allAtk[0];
  if(!atWar(world, sample.nat, h.owner)){
    for(const u of allAtk){
      const defs2 = hexUnits(world, h).filter(x => atWar(world, u.nat, x.nat));
      if(!defs2.length && SF_dist(u, h) === 1) moveIn(world, u, h);
      if(u.order) u.order = u.order._dest ? { type:'advance', dest:u.order._dest } : null;
    }
    if(!hexUnits(world, h).some(x => x.nat !== h.owner)) report.capturedBy = h.owner;
    return report;
  }

  let attackers = allAtk.filter(u => u.org > UNITS[u.type].org * K.RETREAT_ORG);
  // v12.1 修复：全部进攻方被打到撤退阈值以下时 attackers 为空，
  // 原空守卫在守军过滤之后 → attackers[0].nat 抛 TypeError 冻结主循环
  if(!attackers.length){ return report; }
  let defenders = hexUnits(world, h).filter(x => x.hp > 0 && atWar(world, attackers[0].nat, x.nat));
  if(!defenders.length){
    for(const u of attackers){ if(SF_dist(u,h)===1) moveIn(world, u, h); }
    report.capturedBy = h.owner;
    return report;
  }

  // —— W1-1：地形战宽（HOI4 原值）+ 多方向附加，封顶 WIDTH_MAX ——
  const TW = K.TERRAIN_COMBAT_WIDTH[h.terrain] || { base: K.BASE_WIDTH, flank: K.WIDTH_PER_FLANK };
  const dirs = new Set(attackers.map(u => u.q + ',' + u.r));
  const width = Math.min(TW.base + (Math.max(1, dirs.size) - 1) * TW.flank, K.WIDTH_MAX);

  // W1-6：整师才能参战 —— 按攻击值降序整装填，装不下留预备队
  // W2-1: 矛头师不受超宽惩罚 (ignoreWidthPenalty)
  const isSpearhead = attackers.some(u => {
    if(u.order && u.order.type === 'spearhead') return true;
    if(u.armyId && world.armies){
      const a = world.armies.find(x => x.id === u.armyId);
      if(a && (a.arrowIds || []).some(aid => {
        const arrow = (world.arrows || []).find(ar => ar.id === aid);
        return arrow && arrow.active && arrow.kind === 'spearhead';
      })) return true;
    }
    return false;
  });
  attackers.sort((a,b) => effAtk(world,b,h) - effAtk(world,a,h));
  const fill = computeWidthFill(attackers.map(u => ({ unit:u, width:unitCombatWidth(world, u) })), width, { isSpearhead });
  const inField = fill.inField;
  const reserves = fill.reserves;
  const w = fill.totalWidth;
  // 正常整装填流程下恒为 0；保留给战报与"强制超宽"类验收场景
  const overPenalty = fill.overPenalty;

  // 预备队小时增援骰（B.2）：每日 4 轮交火等效 4 次小时判定。
  // W1-1/W1-6：增援成功也必须装得下；容差内缺口（≤师宽 25%）允许挤入。
  const reinforceRolls = [];
  if(reserves.length && inField.length){
    for(const u of reserves){
      const nat = world.nations[u.nat];
      let pHour = 0.02;                                            // 基础 2%/小时
      if(templateHasSupport(world, u.templateId, 'sup_rec')) pHour += 0.05;  // 侦察连（字段名是 supports）
      if(nat.techs && nat.techs.some(t => /radio/i.test(t))) pHour += 0.05;    // 电台科技
      const skillLv = (u.generalSkill || 3);
      pHour += 0.01 * Math.max(0, skillLv - 3);                    // 将领倡议技能
      const pDay = Math.min(0.85, pHour * 4);                      // 每日聚合概率（4 轮）
      const roll = rng();
      reinforceRolls.push({ id: u.id, p: +pDay.toFixed(3), roll: +roll.toFixed(4), joined: roll < pDay });
      if(roll < pDay){
        const uw = unitCombatWidth(world, u);
        const gap = width - w;
        const squeeze = gap > 0 && (uw - gap) <= uw * K.WIDTH_OVERFLOW_TOL;
        if(uw <= gap || squeeze){
          inField.push(u);
          reserves.splice(reserves.indexOf(u), 1);
        }
      }
    }
  }

  const hardnessTarget = defenders.reduce((s,u)=>s+UNITS[u.type].hardness,0) / defenders.length;
  const entrenchBase = defenders.reduce((s,u)=>s+(u.entrench||0),0) / defenders.length;

  // 断供修正（B.3）：攻防双方均受补给状态影响
  const supAtkMul = inField.length ? getUnitSupplyModifiers(inField[0]).atkMul : 1.0;
  const supDefMul = defenders.length ? getUnitSupplyModifiers(defenders[0]).defMul : 1.0;

  // W1-3：要塞（方向抵消）与包围（守方）
  const fortMul = fortAttackMul(h.fort, dirs.size);
  const encircled = isHexEncircled(world, h, defenders[0].nat);

  // 战术卡判定与修正 (§2.6 + v7.0 相克矩阵)
  let tactics = null;
  let entrench = entrenchBase;
  let trapHpMul = 1.0;
  let retainOrgOnRetreat = null;
  let atkTacticMul = 1.0;
  let shockPending = false;
  if(typeof determineBattleTactics === 'function' && attackers.length && defenders.length){
    tactics = determineBattleTactics(world, hexIdx, attackers[0].nat, defenders[0].nat, rng);
    const atkT = K.TACTICS[tactics.attacker];
    const defT = K.TACTICS[tactics.defender];

    // 克制生效：被克制方战术效果失效，反制方收益生效
    const atkCountered = tactics.countered && tactics.counterWinner === 'defender';
    const defCountered = tactics.countered && tactics.counterWinner === 'attacker';

    if(atkT && !atkCountered){
      if(tactics.attacker === 'creeping_barrage'){
        entrench = entrenchBase * (1 - (atkT.artBonus || 0));      // 徐进弹幕无视守军 25% 堑壕
      }
      if(atkT.atkMul && atkT.atkMul !== 1 && tactics.attacker !== 'shock'){
        if(tactics.attacker === 'flank'){
          const armorRatio = inField.filter(x => x.type === 'arm' || x.type === 'larm').length / Math.max(1, inField.length);
          if(armorRatio >= K.TACTICS.flank.needArmorPct) atkTacticMul *= atkT.atkMul;
        } else {
          atkTacticMul *= atkT.atkMul;
        }
      }
      if(tactics.attacker === 'shock' && !world.tacticsState[hexIdx]._shockUsed) shockPending = true;
    }
    if(defT && !defCountered){
      if(tactics.defender === 'illuminated_ambush') trapHpMul = defT.trapDmgMul || 2.0;   // 照明伏击：渗透部队双倍伤亡
      if(tactics.defender === 'evacuation') retainOrgOnRetreat = defT.retainOrg || 0.70;  // 撤退组织度保留
    }
  }

  /* W0-D：一战炮火准备 + 现代无人机/电子战的壕沟削减（W0 已接入，口径不变） */
  let barrageMod = null;
  if(world.era === 'ww1'){
    barrageMod = barrageModifierForHex(world, hexIdx);
    if(barrageMod && barrageMod.entrenchFactor < 1){
      entrench *= barrageMod.entrenchFactor;
    }
  }
  if(world.era === 'modern' && inField.length){
    const droneMul = droneReconModifier(world, inField[0].nat, hexIdx);
    if(droneMul < 1) entrench *= droneMul;
  }

  // —— W1-2：逐师战斗快照 ——
  // 每师一份 atk/def/brk/pierce/armor/width；侧级乘区（战术/空军/情报/超宽/
  // 要塞）统一乘在侧级系数上，不改变师间相对配比。
  const atkSideMul = atkTacticMul * (1 - overPenalty);
  const inFieldStats = inField.map(u => ({
    u,
    width: unitCombatWidth(world, u),
    atk: unitAtk(world, u, hardnessTarget, { terrain:h.terrain, entrenchDefender:entrench, targetHex:h, supplyAtkMul:supAtkMul }),
    brk: Math.max(0.01, unitBreakthrough(world, u)),
    pierce: unitPiercing(world, u)
  }));
  const defenderStats = defenders.map(u => ({
    u,
    width: UNITS[u.type].width,
    armor: UNITS[u.type].armor,
    def: unitDef(world, u, { terrain:h.terrain, supplyDefMul:supDefMul, encircled })
  }));

  // W1-2：目标列表 + 守方被攻击数
  buildTargetLists(inFieldStats, defenderStats, rng);

  // 侧级乘区（空军/情报/要塞/超宽/战术）
  const airMod = getBattleAirModifier(world, h, attackers[0].nat, defenders[0].nat);
  let intelAtkBonus = 0, intelDefBonus = 0;
  if(world.intelCombatEnabled || (K.INTEL && K.INTEL.ENABLE_COMBAT_MODIFIER)){
    const aNat = attackers[0].nat, dNat = defenders[0].nat;
    const aIntel = world.intelCache?.[aNat]?.[dNat]?.army ?? 0;
    const dIntel = world.intelCache?.[dNat]?.[aNat]?.army ?? 0;
    intelAtkBonus = calcIntelCombatBonus(aIntel, dIntel);
    intelDefBonus = calcIntelCombatBonus(dIntel, aIntel);
  }
  const shockMul = shockPending ? (K.TACTICS.shock.firstDayAtkMul || 1.0) : 1.0;
  if(shockPending) world.tacticsState[hexIdx]._shockUsed = true;
  const shoreMod = getShoreBombardmentModifier(world, h, attackers[0].nat, defenders[0].nat);
  const atkSweepMul = atkSideMul * shockMul * airMod.atkMul * shoreMod.atkMul * (1 + intelAtkBonus) * fortMul;

  let defSweepMul = airMod.defMul * shoreMod.defMul * (1 + intelDefBonus);
  if(tactics && tactics.defender){
    const defT = K.TACTICS[tactics.defender];
    const defCountered = tactics.countered && tactics.counterWinner === 'attacker';
    if(defT && !defCountered && (defT.defMul || 1) !== 1) defSweepMul *= defT.defMul;
  }

  // —— W1-2 核心：逐对（a→d）命中率 × 减伤，汇总到每个守师的日伤害率 ——
  // 攻方全火力打目标列表的每个目标；守方防御按被攻击师数均分（defShare）。
  for(const a of inFieldStats) a.atkEff = a.atk * atkSweepMul;
  for(const d of defenderStats) d.defEff = d.def * defSweepMul;

  let mitWeighted = 0;   // Σ(对守师伤害率 × 该师各对的平均减伤) —— 供战报等效 defMit
  for(const a of inFieldStats) a.outRate = 0;   // 攻方单计输出率（反击基数；溅射不重复计）
  for(const d of defenderStats){
    const defShare = d.defEff / d.attackersCount;    // W1-2：防御按被攻击数均分
    let rate = 0, mitSum = 0, mitN = 0;
    for(const a of inFieldStats){
      if(!a.targets || !a.targets.includes(d)) continue;
      const covered = Math.min(a.atkEff, defShare);
      const uncovered = Math.max(0, a.atkEff - defShare);
      const pairHitRate = a.atkEff > 0
        ? (covered * K.HIT_COVERED + uncovered * K.HIT_UNCOVERED) / a.atkEff : 0;
      const pairMit = defenseMitigation(defShare, a.atkEff);
      const pairPierce = pierceMultiplier(a.pierce, d.armor);   // W1-8：逐对甲弹
      rate += a.atkEff * pairHitRate * pairMit * pairPierce;
      a.outRate += a.atkEff * pairHitRate * pairPierce;   // 单计：同一攻方火力不因目标数翻倍
      mitSum += pairMit; mitN++;
    }
    d.roundRate = rate;
    if(rate > 0 && mitN > 0){ mitWeighted += rate * (mitSum / mitN); }
  }
  const totalRoundRate = defenderStats.reduce((s,d)=>s+d.roundRate,0);

  // 战报聚合量（保持旧字段口径，供 battleFeed/UI/测试消费）
  const atkEff = inFieldStats.reduce((s,a)=>s+a.atkEff,0);
  const defPool = defenderStats.reduce((s,d)=>s+d.defEff,0);
  const hitRate = atkEff > 0 ? totalRoundRate / atkEff : 0;   // 等效命中率
  const hits = totalRoundRate * K.ROUNDS_PER_DAY;             // 日总命中当量
  const defMitAgg = mitWeighted > 0 && totalRoundRate > 0 ? mitWeighted / totalRoundRate : 0;

  // 组织度伤害加成（W0-A2 口径保留：每师均值，不连乘——连乘会指数衰减）
  const avgOrgDmg = (list) => list.length
    ? list.reduce((s,x) => s + unitMod(world.nations[x.u.nat], x.u.type, 'orgDamage'), 0) / list.length
    : 0;
  const atkOrgDmgMul = 1 + avgOrgDmg(inFieldStats);
  const defOrgDmgMul = 1 + avgOrgDmg(defenderStats);
  const barrageOrgDmgMul = 1 + (barrageMod ? (barrageMod.orgDmgBonus || 0) : 0);

  // W1-8：守方反击的逐师突破减伤（每师用自身 brk，不再取均值）
  const avgDef = defPool / Math.max(1, defenderStats.length);
  const defHourlyOut = avgDef * 0.6;
  const widthTotal = inFieldStats.reduce((s,a)=>s+a.width,0) || 1;
  for(const a of inFieldStats){
    a.counterMit = defenseMitigation(a.brk, defHourlyOut);
    a.widthShare = a.width / widthTotal;
  }
  const counterMitAgg = inFieldStats.reduce((s,a)=>s+a.counterMit*a.widthShare,0);

  const atkT2 = tactics ? K.TACTICS[tactics.attacker] : null;
  const defT2 = tactics ? K.TACTICS[tactics.defender] : null;
  const atkCountered2 = tactics && tactics.countered && tactics.counterWinner === 'defender';
  const defCountered2 = tactics && tactics.countered && tactics.counterWinner === 'attacker';
  let orgMul = 1, hpMul = 1;
  if(tactics && tactics.attacker === 'assault'){
    orgMul *= K.TACTICS.assault.dmgDealMul;
    hpMul *= K.TACTICS.assault.dmgDealMul;
  }
  if(tactics && tactics.defender === 'delay'){
    orgMul *= K.TACTICS.delay.enemyOrgDmgMul;
  }
  hpMul *= trapHpMul;   // 照明伏击：渗透部队承受双倍人员伤亡

  const diceA = () => K.DICE_MIN + rng() * (K.DICE_MAX - K.DICE_MIN);

  // ============================================================
  // 逐小时结算（v14.0 P0 起每小时一轮；W1 起伤害按守师逐个落账）
  // W1-3：22:00–05:59 夜战窗口双方输出 ×0.5
  // ============================================================
  const HOURS = K.HOURS_PER_DAY;
  const perHour = K.ROUNDS_PER_DAY / HOURS;
  const casOrgPerHour = airMod ? (airMod.casOrgDmg || 0) / HOURS : 0;
  const casStrPerHour = airMod ? (airMod.casStrDmg || 0) / HOURS : 0;
  const isNightHour = (hour) => hour >= K.NIGHT_START_HOUR || hour < K.NIGHT_END_HOUR;
  // W1-3：夜战双方输出 ×0.5；攻方夜战修正（学说 gb_night_assault 的 nightAtk
  // —— 此前声明了无人读取）按比例抵消己方夜战惩罚，抵消上限 100%
  const atkNatMods = world.nations[attackers[0].nat] && world.nations[attackers[0].nat].modifiers;
  const atkNightAtk = atkNatMods ? Math.min(1, atkNatMods.nightAtk || 0) : 0;
  const atkNightMul = 1 - K.NIGHT_COMBAT_MUL * (1 - atkNightAtk);   // 0.5 → 最高 1.0
  const defNightMul = K.NIGHT_COMBAT_MUL;
  const hourly = [];
  let orgDmg = 0, hpDmg = 0, dmgAtk = 0;
  for(let hour = 1; hour <= HOURS; hour++){
    const night = isNightHour(hour);
    const atkNight = night ? atkNightMul : 1.0;
    const defNight = night ? defNightMul : 1.0;
    const hourDice = diceA();
    // 每守师伤害落账表（W1-2：不再按宽度摊大饼）
    const dmgMap = new Map();
    let oTotal = 0, pTotal = 0;
    for(const d of defenderStats){
      if(d.u.hp <= 0) continue;
      let o = d.roundRate * perHour * K.ORG_PER_HIT * K.DMG_MULT * hourDice * orgMul * atkOrgDmgMul * barrageOrgDmgMul * atkNight;
      let p = d.roundRate * perHour * K.HP_PER_HIT * K.DMG_MULT * hourDice * 0.5 * hpMul * atkNight;
      o = Math.min(o, K.HOUR_ORG_DMG_CAP);
      dmgMap.set(d.u.id, { org:o, hp:p });
      oTotal += o; pTotal += p;
    }
    oTotal += casOrgPerHour; pTotal += casStrPerHour;   // CAS 按宽度分摊（SF2_apply）
    orgDmg += oTotal; hpDmg += pTotal;
    // 反击：守方输出打进攻方，逐师用自身突破减伤 + 小时封顶
    // （W1 修复：按小时增量落账 —— 旧草稿累计 _counter 每小时整体重扣，
    //   24 小时被放大 ~300 倍，实测攻方单日组织 60→13）
    const counterMap = new Map();
    let hourCounter = 0;
    for(const a of inFieldStats){
      // 反击基数 = 守方实收伤害 × COUNTER_RATIO（沿用 v14.0 对称口径；
      // 逐对模型下攻方溅射会使实收翻倍，属真实集中火力代价）
      let da = oTotal * K.COUNTER_RATIO * a.widthShare * a.counterMit * defOrgDmgMul * defNight;
      da = Math.min(da, K.HOUR_ORG_DMG_CAP);
      if(atkT2 && tactics.attacker === 'assault' && !atkCountered2){
        da *= K.TACTICS.assault.dmgTakeMul;
      }
      if(defT2 && !defCountered2 && (tactics.defender === 'depth_def' || tactics.defender === 'elastic_defense' || tactics.defender === 'elastic_def')){
        da *= defT2.reflectMul || 1.0;
      }
      counterMap.set(a.u.id, da);
      hourCounter += da;
    }
    dmgAtk += hourCounter;
    hourly.push({ hour, orgDmg:+oTotal.toFixed(3), hpDmg:+pTotal.toFixed(3), counter:+hourCounter.toFixed(3), night: atkNight < 1 });
    SF2_apply(world, defenderStats.map(s=>s.u), dmgMap, casOrgPerHour, casStrPerHour, report, inField.length ? inField[0].nat : null);
    SF2_applyCounter(world, inFieldStats, counterMap, report, defenders.length ? defenders[0].nat : null);
  }

  report.rounds.push({ atkEff:+atkEff.toFixed(2), defPool:+defPool.toFixed(2),
                       hitRate:+hitRate.toFixed(3), hits:+hits.toFixed(1),
                       covered:+Math.min(atkEff, defPool).toFixed(2), uncovered:+Math.max(0, atkEff - defPool).toFixed(2),
                       orgDmg:+orgDmg.toFixed(1), hpDmg:+hpDmg.toFixed(1),
                       defMit:+defMitAgg.toFixed(3), counterMit:+counterMitAgg.toFixed(3), hours: HOURS, hourly,
                       airMod: airMod ? { atkMul: airMod.atkMul, defMul: airMod.defMul, casBonus: airMod.casBonus, casOrgDmg: airMod.casOrgDmg } : null,
                       intel: { atkBonus: +intelAtkBonus.toFixed(4), defBonus: +intelDefBonus.toFixed(4) },
                       tacticAtk: tactics ? tactics.attacker : null,
                       tacticDef: tactics ? tactics.defender : null,
                       tacticCountered: tactics ? !!tactics.countered : false,
                       counterDesc: tactics && tactics.counterDesc ? tactics.counterDesc : null,
                       reserves: reserves.length, width:+width.toFixed(1), dirs:dirs.size, overPenalty:+overPenalty.toFixed(2),
                       encircled, fortMul:+fortMul.toFixed(3),
                       reinforce: reinforceRolls });

  // W1-7：参战经验 —— 每战斗日 +1 XP，档位/等级随之成长
  for(const a of inFieldStats) addUnitXp(a.u, K.COMBAT_XP_PER_DAY);
  for(const d of defenderStats) if(d.u.hp > 0) addUnitXp(d.u, K.COMBAT_XP_PER_DAY);

  // 防守崩溃 → 撤退
  const live = hexUnits(world, h).filter(x => x.hp > 0);
  if(live.length){
    const avgOrg = live.reduce((s,u)=>s+u.org,0)/live.length;
    const avgMax = live.reduce((s,u)=>s+UNITS[u.type].org,0)/live.length;
    if(avgOrg < avgMax * K.RETREAT_ORG){
      for(const u of live){ SF_retreat(world, h, u, report, retainOrgOnRetreat); }
    }
  }
  // 进攻中止
  for(const u of inField){
    if(u.org < UNITS[u.type].org * K.RETREAT_ORG) u.order = null;
  }
  // 占领：格内已无敌对单位 → 首个攻方进入（带推进目标者继续推进）
  const noHostile = !hexUnits(world, h).some(x => x.hp>0 && atWar(world, inField[0].nat, x.nat));
  if(noHostile && inField.length && h.owner !== inField[0].nat){
    for(const u of inField){
      if(u.order && u.order.type === 'support') continue; // 支援攻击者不进占
      if(hexDist(u.q,u.r,h.q,h.r)===1 && !hexUnits(world,h).includes(u)){
        moveIn(world, u, h);
        report.capturedBy = u.nat;
        if(u.order) u.order = u.order._dest ? { type: (u.order.type === 'spearhead' || u.order.type === 'breakthrough' ? u.order.type : 'advance'), dest:u.order._dest, target: u.order._dest, _dest: u.order._dest, directFocus: u.order.directFocus } : null;
        break;
      }
    }
  }
  return report;
}

/* W1-7：参战经验统一走 doctrine.addUnitXp（阶梯所有者），档位刷新 u.level */

/* 守方承伤：dmgMap 直落到师；CAS 等全局池按宽度分摊 */
function SF2_apply(world, units, dmgMap, poolOrg, poolHp, report, killerNat){
  // v14.0 P0：逐小时结算时，单位可能在早前小时已阵亡并移出世界，必须跳过
  const alive = units.filter(u => u.hp > 0);
  const totalW = alive.reduce((s,u)=>s+UNITS[u.type].width,0) || 1;
  for(const u of alive){
    const own = dmgMap.get(u.id) || { org:0, hp:0 };
    const org = own.org + poolOrg * UNITS[u.type].width / totalW;
    const hp = own.hp + poolHp * UNITS[u.type].width / totalW;
    u.org = Math.max(0, u.org - org);
    u.hp = Math.max(0, u.hp - hp);
    if(u.hp <= 0 && !(report._destroyedSet && report._destroyedSet.has(u.id))){
      report.destroyed.push(u.id);
      if(report._destroyedSet) report._destroyedSet.add(u.id);
      removeUnit(world, u, killerNat);
    }
  }
}

/* 攻方承伤（反击）：逐师按 widthShare 落账（W1-8 突破逐师减伤已在结算处完成） */
function SF2_applyCounter(world, inFieldStats, counterMap, report, killerNat){
  for(const a of inFieldStats){
    const u = a.u;
    if(u.hp <= 0) continue;
    const da = counterMap.get(u.id) || 0;
    // W2-1: 牵制 (pin) 不耗组织度
    const isPin = u.order && u.order.type === 'pin';
    if(!isPin){
      u.org = Math.max(0, u.org - da);
    }
    u.hp = Math.max(0, u.hp - da * 0.5 * 0.5);
    if(u.hp <= 0 && !(report._destroyedSet && report._destroyedSet.has(u.id))){
      report.destroyed.push(u.id);
      if(report._destroyedSet) report._destroyedSet.add(u.id);
      removeUnit(world, u, killerNat);
    }
  }
}
function removeUnit(world, u, killerNat){
  const h = world.at[u.q+','+u.r];
  const i = h.units.indexOf(u.id);
  if(i>=0) h.units.splice(i,1);
  const j = world.units.indexOf(u);
  if(j>=0) world.units.splice(j,1);
  // v7.0 战争贡献度统计（和会杀伤计分 35% 权重）
  if(killerNat && killerNat !== u.nat){
    world.warStats = world.warStats || {};
    world.warStats[killerNat] = world.warStats[killerNat] || {};
    world.warStats[killerNat][u.nat] = (world.warStats[killerNat][u.nat] || 0) + 1;
  }
}
function moveIn(world, u, h){
  // W2-1: 支援攻击 (support) 部队原地支援，胜后不进驻占领格
  if(u.order && u.order.type === 'support') return;
  const oh = world.at[u.q+','+u.r];
  const i = oh.units.indexOf(u.id);
  if(i>=0) oh.units.splice(i,1);
  u.q = h.q; u.r = h.r;
  h.units.push(u.id);
  // v12.1 修复：与 enterHex 同型——占领只发生在与进入者交战的敌国格上，
  // 防止盟军部队接管盟友领土
  if(h.owner !== u.nat && world.nations[u.nat].atWarWith.includes(h.owner)){
    h.owner = u.nat;
    world.events.push({ type:'capture', day:world.day,
      text:`${world.nations[h.owner].name}占领${h.city ? h.city.name : `(${h.q},${h.r})`}${h.city&&h.city.cap?'（首都）':''}`, hex:h.idx });
  }
}
function SF_retreat(world, h, u, report, retainOrg){
  let dest = null;
  let crowded = false;
  for(const ni of h.adj){
    const nh = world.hexes[ni];
    if(nh.owner === u.nat && !hexUnits(world, nh).some(x => x.hp>0)){
      dest = nh; break;
    }
  }
  // v14.0 P0：无空格时允许挤进相邻己方格（HOI4 允许撤退时短时超堆叠）。
  // 原实现在此直接判"无路可退 → 消灭"，导致进攻方一旦自己人堆在一起
  // （26 师挤 4 格、堆叠上限 6），撤退阶段会被自己的密度全灭。
  if(!dest){
    for(const ni of h.adj){
      const nh = world.hexes[ni];
      if(nh.owner === u.nat && !nh.strait){ dest = nh; crowded = true; break; }
    }
  }
  if(dest){
    const oh = world.at[u.q+','+u.r];
    const i = oh.units.indexOf(u.id);
    if(i>=0) oh.units.splice(i,1);
    u.q = dest.q; u.r = dest.r;
    dest.units.push(u.id);
    // 战略撤退保全：撤退组织度保留 70%（默认拉回至撤退阈值）
    u.org = Math.max(u.org, UNITS[u.type].org * (retainOrg != null ? retainOrg : K.RETREAT_ORG));
    u.order = null;
    u.entrench = 0;
    if(crowded) u.stackOver = true;   // 供渲染层提示"该格超堆叠"
    report.retreat.push(u.id);
  }else{
    // 彻底无路可退（被围歼）：按 HOI4 的 shatter 处理 —— 损失 50% 组织度后覆灭
    u.org = Math.max(0, u.org * 0.5);
    if(!report._destroyedSet) report._destroyedSet = new Set();
    if(!report._destroyedSet.has(u.id)){
      report.destroyed.push(u.id);
      report._destroyedSet.add(u.id);
    }
    removeUnit(world, u);
  }
}
function SF_dist(u, h){ return hexDist(u.q, u.r, h.q, h.r); }
function atWar(world, a, b){
  if(a===b) return false;
  return world.nations[a] && world.nations[a].atWarWith.includes(b);
}
function effAtk(world, u, h){
  const U = UNITS[u.type];
  const ter = TERRAIN[h.terrain];
  return U.soft * strengthFactor(u) * ter.atk;
}
