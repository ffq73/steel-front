/* ============================================================
   engine/air.js —— 空军系统核心引擎 (v9.0 §4-N1 / 附录 B.2) [H]
   包含：机场容量与超容结算、联队编成、空区聚合与制空权、
         七种空军任务（制空/CAS/战略轰炸/拦截/海击/侦察/空投）、
         王牌生成与阶梯、空优及 CAS 对地面作战修正
   ============================================================ */

import { K } from '../data/constants.js';
import { hexDist } from '../core/geom.js';

/* 飞机机种标准作战半径（六角格距离）[H] */
export const AIRCRAFT_RANGES = {
  fighter: 6,
  cas: 5,
  heavy_fighter: 10,
  naval_bomber: 8,
  tactical_bomber: 12,
  strat_bomber: 18,
  transport: 10
};

/* 飞机机种中文名称与图标 */
export const AIRCRAFT_INFO = {
  fighter: { name: '轻型战斗机', icon: '✈️' },
  heavy_fighter: { name: '重型战斗机', icon: '🛫' },
  cas: { name: '近距支援机 (CAS)', icon: '🛩️' },
  naval_bomber: { name: '鱼雷轰炸机', icon: '🛸' },
  tactical_bomber: { name: '战术轰炸机', icon: '🛬' },
  strat_bomber: { name: '战略轰炸机', icon: '🚀' },
  transport: { name: '运输机', icon: '📦' }
};

/* 预设空区定义（覆盖 20×14 地图）[H] */
export const AIR_REGIONS = [
  { id: 'r_west_germany', name: '西德与莱茵', center: [4, 10], qMin: 1, qMax: 6, rMin: 8, rMax: 13 },
  { id: 'r_east_germany', name: '东普鲁士与波德边境', center: [8, 8], qMin: 6, qMax: 10, rMin: 6, rMax: 10 },
  { id: 'r_poland', name: '波兰与加利西亚', center: [11, 9], qMin: 9, qMax: 13, rMin: 6, rMax: 12 },
  { id: 'r_france', name: '法兰西与低地', center: [2, 10], qMin: 0, qMax: 4, rMin: 8, rMax: 13 },
  { id: 'r_baltic', name: '波罗的海与北欧', center: [7, 4], qMin: 3, qMax: 10, rMin: 0, rMax: 6 },
  { id: 'r_west_russia', name: '东欧与西俄', center: [15, 8], qMin: 13, qMax: 17, rMin: 4, rMax: 12 },
  { id: 'r_moscow', name: '莫斯科与中央', center: [18, 8], qMin: 17, qMax: 20, rMin: 4, rMax: 12 },
  { id: 'r_danube', name: '巴尔干与多瑙河', center: [13, 12], qMin: 11, qMax: 16, rMin: 11, rMax: 14 }
];

/* 查找格点所属空区 */
export function getHexAirRegion(q, r){
  for(const reg of AIR_REGIONS){
    if(q >= reg.qMin && q <= reg.qMax && r >= reg.rMin && r <= reg.rMax){
      return reg.id;
    }
  }
  // 备用：按欧氏最近中心点
  let best = AIR_REGIONS[0].id, bd = 999;
  for(const reg of AIR_REGIONS){
    const d = hexDist(q, r, reg.center[0], reg.center[1]);
    if(d < bd){ bd = d; best = reg.id; }
  }
  return best;
}

/* 初始化世界空军数据 */
export function initAir(world){
  world.airBases = world.airBases || [];
  world.airWings = world.airWings || [];
  world.airLosses = world.airLosses || {};
  world.airCombatEnabled = (K.AIR && K.AIR.ENABLE_COMBAT_MODIFIER) || false;

  // 1. 初始化机场：为各重要城市与战略要地建立机场 [H]
  if(!world.airBases.length){
    for(const h of world.hexes){
      const isCity = !!h.city;
      if(isCity || (h.infra && h.infra >= 5)){
        const lv = isCity ? Math.min(K.AIR.MAX_AIRBASE_LEVEL, Math.max(2, (h.city.w || 1) * 2)) : 1;
        const ab = {
          id: `ab_${h.q}_${h.r}`,
          name: h.city ? `${h.city.name}空军基地` : `前线机场 (${h.q},${h.r})`,
          nat: h.owner,
          q: h.q,
          r: h.r,
          level: lv,
          capacity: lv * K.AIR.BASE_CAPACITY_PER_LEVEL,
          count: 0
        };
        h.buildings = h.buildings || {};
        h.buildings.air_base = lv;
        world.airBases.push(ab);
      }
    }
  }

  // 2. 初始化初始空军联队 (按国家部署)
  if(!world.airWings.length){
    const gerTag = world.nations['GER'] ? 'GER' : (world.nations['G'] ? 'G' : null);
    const polTag = world.nations['POL'] ? 'POL' : (world.nations['P'] ? 'P' : null);
    const fraTag = world.nations['FRA'] ? 'FRA' : (world.nations['F'] ? 'F' : null);
    const sovTag = world.nations['SOV'] ? 'SOV' : (world.nations['S'] ? 'S' : null);

    const deployWing = (nat, type, count, q, r, task = 'air_superiority') => {
      if(!nat) return;   // v12.1：剧本里不存在的国家不再兜底生成（修复 ww1 冒出波兰/苏联联队）
      let base = world.airBases.find(b => b.q === q && b.r === r);
      if(!base){
        base = world.airBases.find(b => b.nat === nat) || world.airBases[0];
      }
      const bq = base ? base.q : q;
      const br = base ? base.r : r;
      const regId = getHexAirRegion(bq, br);
      const wing = {
        id: `wing_${nat}_${world.airWings.length + 1}`,
        nat,
        type,
        count: Math.min(K.AIR.MAX_WING_SIZE, count),
        baseId: base ? base.id : null,
        baseHex: [bq, br],
        task,
        regionId: regId,
        exp: 1.0,
        aces: []
      };
      world.airWings.push(wing);
    };

    if(world.scenario === 'A'){
      // 硬编码坐标仅适配 A 剧本（波兰战役）地图
      // 德国初始机群
      deployWing(gerTag, 'fighter', 100, 6, 8, 'air_superiority'); // 柏林
      deployWing(gerTag, 'cas', 100, 6, 8, 'cas');
      deployWing(gerTag, 'tactical_bomber', 100, 3, 9, 'strat_bombing'); // 鲁尔
      deployWing(gerTag, 'heavy_fighter', 100, 8, 6, 'air_superiority'); // 柯尼斯堡

      // 波兰初始机群
      deployWing(polTag, 'fighter', 100, 11, 8, 'air_superiority'); // 华沙
      deployWing(polTag, 'cas', 50, 11, 8, 'cas');

      // 法国初始机群
      deployWing(fraTag, 'fighter', 100, 1, 9, 'air_superiority'); // 巴黎
      deployWing(fraTag, 'cas', 100, 1, 9, 'cas');

      // 苏联初始机群
      deployWing(sovTag, 'fighter', 100, 19, 8, 'air_superiority'); // 莫斯科
      deployWing(sovTag, 'fighter', 100, 16, 11, 'air_superiority'); // 基辅
      deployWing(sovTag, 'cas', 100, 13, 5, 'cas'); // 列宁格勒
      deployWing(sovTag, 'strat_bomber', 50, 19, 8, 'strat_bombing');
    } else {
      // v12.1：其余剧本通用部署 —— 每个参战国在其首都机场获得战斗机+CAS 联队
      for(const id in world.nations){
        const n = world.nations[id];
        if(!n || !n.alive) continue;
        const cap = world.hexes.find(h => h.city && h.city.cap === id);
        if(!cap) continue;
        deployWing(id, 'fighter', 100, cap.q, cap.r, 'air_superiority');
        deployWing(id, 'cas', 80, cap.q, cap.r, 'cas');
      }
    }
  }

  // 刷新机场驻留战机数量
  updateAirbaseCounts(world);
}

/* 刷新所有机场的驻军总数 */
export function updateAirbaseCounts(world){
  for(const b of world.airBases){ b.count = 0; }
  for(const w of world.airWings){
    if(w.count <= 0) continue;
    let b = world.airBases.find(ab => ab.id === w.baseId);
    if(!b && w.baseHex){
      b = world.airBases.find(ab => ab.q === w.baseHex[0] && ab.r === w.baseHex[1]);
    }
    if(b){ b.count += w.count; }
  }
}

/* 1. 机场超容惩罚计算 [H]
   每超 1% → 任务效率 −2%，超 50% 效率归 0 (-100%) */
export function calcAirbaseEfficiency(airbase, totalPlanes){
  if(!airbase) return 1.0;
  const cap = airbase.capacity || (airbase.level * K.AIR.BASE_CAPACITY_PER_LEVEL);
  if(cap <= 0) return 0.0;
  if(totalPlanes <= cap) return 1.0;

  const overRatio = (totalPlanes - cap) / cap;
  const penalty = Math.min(K.AIR.OVERCROWD_MAX_PENALTY, overRatio * K.AIR.OVERCROWD_EFF_PENALTY);
  return Math.max(0, +(1.0 - penalty).toFixed(4));
}

/* 2. 航程覆盖与惩罚计算 [H]
   覆盖 100%→0%、84%→−16%、60%→−40%、30%→−70%、<30%→−100% (不可作战) */
export function calcRangePenalty(coverage){
  if(coverage >= 1.0) return 0.0;
  if(coverage < 0.30) return 1.0;
  // 线性衰减：1.0 - coverage
  return Math.min(1.0, +(1.0 - coverage).toFixed(4));
}

export function calcRangeEfficiency(baseHex, targetHex, aircraftType){
  const maxRange = AIRCRAFT_RANGES[aircraftType] || 6;
  const dist = hexDist(baseHex[0], baseHex[1], targetHex[0], targetHex[1]);
  if(dist <= maxRange) return 1.0;
  const coverage = maxRange / Math.max(1, dist);
  const penalty = calcRangePenalty(coverage);
  return Math.max(0, +(1.0 - penalty).toFixed(4));
}

/* 3. 单个联队制空权贡献计算 [H]
   联队制空权 = (count / STANDARD_WING_SIZE) × 机种权重 × 任务效率
   效率 = 机场超容效率 × 航程效率 × (1 + 王牌增益) */
export function calcWingSuperiority(wing, baseEff = 1.0, rangeEff = 1.0){
  if(!wing || wing.count <= 0) return 0;
  const weight = (K.AIR.WEIGHTS && K.AIR.WEIGHTS[wing.type] != null) ? K.AIR.WEIGHTS[wing.type] : 1.0;
  const aceBonus = (wing.aces || []).reduce((s, a) => s + (a.effBonus || 0), 0);
  const missionEff = Math.max(0, baseEff * rangeEff * (1 + aceBonus));
  const scale = wing.count / K.AIR.STANDARD_WING_SIZE;
  return +(scale * weight * missionEff).toFixed(4);
}

/* 4. 空区制空权与制空比计算 [H]
   汇总区域内所有联队制空权，输出各阵营分数、占有比及颜色阈值状态 (红<40%, 黄40-60%, 绿>60%) */
export function calcRegionAirSuperiority(world, regionId){
  const reg = AIR_REGIONS.find(r => r.id === regionId);
  const wings = (world.airWings || []).filter(w => w.regionId === regionId && w.count > 0);
  const scores = {};
  const effectiveWings = [];

  for(const w of wings){
    scores[w.nat] = scores[w.nat] || 0;
    const base = world.airBases?.find(b => b.id === w.baseId) ||
                 world.airBases?.find(b => b.q === w.baseHex?.[0] && b.r === w.baseHex?.[1]);
    const baseEff = base ? calcAirbaseEfficiency(base, base.count) : 1.0;
    const center = reg ? reg.center : (w.baseHex || [0, 0]);
    const rangeEff = w.baseHex ? calcRangeEfficiency(w.baseHex, center, w.type) : 1.0;

    const sup = calcWingSuperiority(w, baseEff, rangeEff);
    scores[w.nat] += sup;
    effectiveWings.push({ wing: w, baseEff, rangeEff, sup });
  }

  // 州防空削减敌方空优：每级州防空 -5% 敌方空优 [H]
  if(world.hexes && reg){
    for(const nat in scores){
      // 统计属于 nat 领土内该空区的防空总等级
      let natAA = 0;
      for(const h of world.hexes){
        if(h.owner === nat && getHexAirRegion(h.q, h.r) === regionId){
          natAA += (h.buildings?.anti_air || 0);
        }
      }
      if(natAA > 0){
        const aaReduction = Math.min(0.50, natAA * 0.05);
        for(const enemy in scores){
          if(enemy !== nat){
            scores[enemy] = Math.max(0, scores[enemy] * (1 - aaReduction));
          }
        }
      }
    }
  }

  // 计算双方制空比与状态
  const ratios = {};
  const status = {};
  const total = Object.values(scores).reduce((s, v) => s + v, 0);

  for(const nat in scores){
    const s = scores[nat];
    const enemySum = total - s;
    const ratio = total > 0 ? (s / (s + enemySum)) : 0.50;
    ratios[nat] = +ratio.toFixed(4);
    if(ratio >= K.AIR.COLORS.yellow){
      status[nat] = 'green';   // > 60%
    } else if(ratio >= K.AIR.COLORS.red){
      status[nat] = 'yellow';  // 40% - 60%
    } else {
      status[nat] = 'red';     // < 40%
    }
  }

  return { regionId, scores, total: +total.toFixed(4), ratios, status, wings: effectiveWings };
}

/* 5. 近距空中支援 (CAS) 战斗加成与伤害计算 [H]
   - 参战飞机上限 = 敌方战线宽度 × 3
   - 攻击加成基数 +25%，按在场有效飞机/上限线性缩放
   - org/str 伤害系数各 0.04
   - 防空最高减伤 75%，防空击落率 7% */
export function calcCASBonus(enemyCombatWidth, availablePlanes){
  const maxPlanes = enemyCombatWidth * K.AIR.CAS_WIDTH_MULT;
  if(maxPlanes <= 0 || availablePlanes <= 0){
    return { maxPlanes: 0, activePlanes: 0, attackBonus: 0, orgDmg: 0, strDmg: 0 };
  }
  const activePlanes = Math.min(maxPlanes, availablePlanes);
  const ratio = activePlanes / maxPlanes;
  const attackBonus = +(ratio * K.AIR.CAS_ATTACK_BONUS_BASE).toFixed(4);
  const orgDmg = +(activePlanes * K.AIR.CAS_ORG_DAMAGE).toFixed(4);
  const strDmg = +(activePlanes * K.AIR.CAS_STR_DAMAGE).toFixed(4);

  return { maxPlanes, activePlanes, attackBonus, orgDmg, strDmg };
}

/* 6. 王牌飞行员生成判定 [H]
   生成概率 = (0.5% × 联队规模)² */
export function rollAceGeneration(wing, rng = Math.random){
  if(!wing || wing.count <= 0) return null;
  const p = Math.pow(0.005 * wing.count, 2);
  const roll = rng();
  if(roll >= p) return null;

  // 生成三档王牌之一：Good (65%), Unique (25%), Genius (10%)
  const tierRoll = rng();
  let tierKey = 'good';
  if(tierRoll < 0.10) tierKey = 'genius';
  else if(tierRoll < 0.35) tierKey = 'unique';

  const cfg = K.AIR.ACE_TIERS[tierKey];
  const surnames = ['哈特曼', '巴克霍恩', '拉尔', '波克雷什金', '阔日杜布', '加兰德', '克罗斯特曼', '约翰逊'];
  const name = surnames[Math.floor(rng() * surnames.length)] + `·${cfg.name}`;

  const ace = {
    id: `ace_${Date.now()}_${Math.floor(rng() * 1000)}`,
    name,
    tier: cfg.id,
    tierName: cfg.name,
    effBonus: cfg.effBonus,
    wingExpBonus: cfg.wingExpBonus
  };

  wing.aces = wing.aces || [];
  wing.aces.push(ace);
  return ace;
}

/* 7. 战略轰炸结算 [H]
   建筑脆弱度受州防空削减（-12%/级），单级建筑受 1 点伤害即失效首级 */
export function applyStratBombingDamage(buildingType, rawDamage, provinceAALevel = 0){
  const coeff = (K.AIR.STRAT_BOMB_TARGETS && K.AIR.STRAT_BOMB_TARGETS[buildingType] != null)
    ? K.AIR.STRAT_BOMB_TARGETS[buildingType]
    : 1.0;
  if(coeff <= 0) return { effectiveDamage: 0, disabled: false };

  const aaMitigation = Math.min(0.85, Math.max(0, provinceAALevel * Math.abs(K.AIR.PROVINCE_AA_VULNERABILITY)));
  const effectiveDamage = +(rawDamage * coeff * (1 - aaMitigation)).toFixed(2);
  // 单级建筑受 1 点伤害即失效首级效果
  const disabled = effectiveDamage >= 1.0;

  return { effectiveDamage, disabled };
}

/* 8. 每日空军总轮转调度 (每日 step 9 调用) */
export function airTick(world, rng = Math.random){
  if(!world.airWings || !world.airWings.length) return;

  // 1. 刷新机场驻军与容量统计
  updateAirbaseCounts(world);

  // 2. 统计各空区制空权
  world.airSuperiorityCache = {};
  for(const reg of AIR_REGIONS){
    world.airSuperiorityCache[reg.id] = calcRegionAirSuperiority(world, reg.id);
  }

  // 3. 执行日常任务：空运补给、战略轰炸、王牌生成
  for(const w of world.airWings){
    if(w.count <= 0) continue;

    // 王牌生成抽检
    if(!w.aces || w.aces.length < 3){
      const ace = rollAceGeneration(w, rng);
      if(ace && world.events){
        world.events.push({
          type: 'air_ace',
          day: world.day,
          text: `【空中王牌】${w.nat} 空军第 ${w.id} 联队诞生了 ${ace.name}（任务效率 +${Math.round(ace.effBonus * 100)}%）！`,
          important: w.nat === world.player
        });
      }
    }

    // 空运补给
    if(w.task === 'air_supply'){
      const nat = world.nations[w.nat];
      if(nat){
        const supplyGiven = +(w.count * K.AIR.AIR_SUPPLY_PER_PLANE).toFixed(1);
        nat.airSupplyTotal = (nat.airSupplyTotal || 0) + supplyGiven;
      }
    }

    // 空中侦察：提升情报上限
    if(w.task === 'recon'){
      const nat = world.nations[w.nat];
      if(nat){
        nat.reconBonus = (nat.reconBonus || 0) + 0.05;
      }
    }

    // 战略轰炸
    if(w.task === 'strat_bombing'){
      const regId = w.regionId;
      // 轰炸该区域内的敌方六角格基建与工厂
      const enemiesHexes = (world.hexes || []).filter(h => {
        if(getHexAirRegion(h.q, h.r) !== regId) return false;
        const n = world.nations[w.nat];
        return n && n.atWarWith && n.atWarWith.includes(h.owner);
      });

      let targetHex = (w.targetHexIdx != null && world.hexes[w.targetHexIdx])
        ? world.hexes[w.targetHexIdx]
        : null;
      if(!targetHex && enemiesHexes.length > 0){
        targetHex = enemiesHexes[Math.floor(rng() * enemiesHexes.length)];
      }

      if(targetHex){
        const aaLv = targetHex.buildings?.anti_air || 0;
        const res = applyStratBombingDamage('infra', 1.2, aaLv);
        if(res.disabled && targetHex.infra > 0){
          targetHex.infra = Math.max(0, targetHex.infra - 1);
          if(world.events && (w.nat === world.player || targetHex.owner === world.player)){
            world.events.push({
              type: 'air_strat_bomb',
              day: world.day,
              text: `【战略轰炸】${targetHex.q},${targetHex.r} 基础设施遭受轰炸受损，降至 ${targetHex.infra} 级！`,
              important: false
            });
          }
        }
      }
    }
  }
}

/**
 * W2-1: 建立空袭 / 战略轰炸作战计划
 */
export function createAirPlan(world, natId, task = 'strat_bomb', targetHexIdx = null, wingIds = []){
  const wings = (world.airWings || []).filter(w => w.nat === natId && (!wingIds.length || wingIds.includes(w.id)));
  for(const w of wings){
    w.task = task;
    w.targetHexIdx = targetHexIdx;
  }
  return wings;
}

/* 9. 地面战斗修正接口（供 battle.js 挂载调用） */
export function getBattleAirModifier(world, targetHex, attackerNat, defenderNat){
  // 若未启用空战加成，返回基准 1.0 与 0 修正（保证 B1-B15 兼容性）
  const enabled = world.airCombatEnabled || (K.AIR && K.AIR.ENABLE_COMBAT_MODIFIER);
  if(!enabled){
    return {
      atkMul: 1.0,
      defMul: 1.0,
      casOrgDmg: 0,
      casStrDmg: 0,
      casBonus: 0,
      airSuperiorityRatio: 0.5
    };
  }

  const regId = getHexAirRegion(targetHex.q, targetHex.r);
  const cache = (world.airSuperiorityCache && world.airSuperiorityCache[regId])
    ? world.airSuperiorityCache[regId]
    : calcRegionAirSuperiority(world, regId);

  const atkRatio = cache.ratios?.[attackerNat] ?? 0.5;
  const defRatio = cache.ratios?.[defenderNat] ?? 0.5;

  let atkMul = 1.0;
  let defMul = 1.0;

  // 制空权优势方地面部队最高 +20% 攻/防；劣势方防御最高 -50% [H]
  // W0-A1：劣势方的**攻击**惩罚改用 SUPERIORITY_ATK_PENALTY_MAX（HOI4 -35%），
  // 原先误用 SUPERIORITY_MOVE_PENALTY_MAX（机动 -50%）。
  if(atkRatio > 0.50){
    const adv = (atkRatio - 0.50) / 0.50;
    atkMul *= (1 + adv * K.AIR.SUPERIORITY_GROUND_BUFF_MAX);
    defMul *= (1 - adv * Math.abs(K.AIR.SUPERIORITY_DEF_PENALTY_MAX));
  } else if(defRatio > 0.50){
    const adv = (defRatio - 0.50) / 0.50;
    defMul *= (1 + adv * K.AIR.SUPERIORITY_GROUND_BUFF_MAX);
    atkMul *= (1 - adv * Math.abs(K.AIR.SUPERIORITY_ATK_PENALTY_MAX));
  }

  // 寻找进攻方与防守方的 CAS 支持
  const atkCASPlanes = (world.airWings || [])
    .filter(w => w.nat === attackerNat && w.regionId === regId && w.task === 'cas')
    .reduce((s, w) => s + w.count, 0);

  const defCombatWidth = 18; // 参考战线宽度
  const casResult = calcCASBonus(defCombatWidth, atkCASPlanes);
  atkMul *= (1 + casResult.attackBonus);

  // 防空减伤与损耗
  const provinceAA = targetHex.buildings?.anti_air || 0;
  const aaMitigation = Math.min(K.AIR.CAS_AA_MAX_REDUCTION, provinceAA * 0.15);
  const finalCasOrgDmg = +(casResult.orgDmg * (1 - aaMitigation)).toFixed(2);
  const finalCasStrDmg = +(casResult.strDmg * (1 - aaMitigation)).toFixed(2);

  return {
    atkMul: +atkMul.toFixed(4),
    defMul: +defMul.toFixed(4),
    casOrgDmg: finalCasOrgDmg,
    casStrDmg: finalCasStrDmg,
    casBonus: casResult.attackBonus,
    airSuperiorityRatio: atkRatio
  };
}

/* ============================================================
   v14.0 P4 —— 空军科技门控
   此前 7 种机种开局全解锁，科技树对空军毫无意义。现在按 nation.unlockedAircraft
   门控：未研究的机种不能编成联队（aircraftAvailable 供 UI 与编成校验使用）。
   ============================================================ */

/** 某国当前可用的机种列表 */
export function aircraftAvailable(world, natId){
  const n = world.nations[natId];
  if(!n) return [];
  const unlocked = n.unlockedAircraft;
  // 未建立任何航空研究记录时按"开局仅有基础航空"处理（向后兼容旧档）
  if(!unlocked || !unlocked.length) return ['fighter'];
  return unlocked;
}

/** 某机种是否已解锁 */
export function isAircraftUnlocked(world, natId, type){
  return aircraftAvailable(world, natId).includes(type);
}

/** 制空权权重修正：战斗机科技 +10%/+8%/雷达网 +6%（读 nation.modifiers.airSuperiority） */
export function airSuperiorityMod(world, natId){
  const n = world.nations[natId];
  return n ? (n.modifiers.airSuperiority || 0) : 0;
}
