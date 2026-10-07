/* ============================================================
   engine/template.js —— 师设计器与编制系统 (v4.0 §3.3 / P3)
   5×5 战斗营方阵 + 5 支援连槽位，支持战宽/四维攻防/组织度/装备缺编计算
   ============================================================ */

import { K } from '../data/constants.js';

export const BATTALIONS = {
  inf_bat: {
    id: 'inf_bat', name: '步兵营', icon: '🪖',
    width: 2, manpower: 1000,
    softAtk: 6, hardAtk: 1, defense: 22, breakthrough: 2, org: 50, armor: 0,
    equip: { inf_eq: 100 }
  },
  art_bat: {
    id: 'art_bat', name: '炮兵营', icon: '💥',
    width: 3, manpower: 500,
    softAtk: 25, hardAtk: 2, defense: 10, breakthrough: 3, org: 0, armor: 0,
    equip: { art_eq: 36 }
  },
  tank_bat: {
    id: 'tank_bat', name: '装甲营', icon: '🛡️',
    width: 2, manpower: 500,
    softAtk: 14, hardAtk: 18, defense: 8, breakthrough: 36, org: 10, armor: 0.80,
    equip: { tank_eq: 50 }
  },
  mot_bat: {
    id: 'mot_bat', name: '摩托化营', icon: '🚛',
    width: 2, manpower: 1200,
    softAtk: 6, hardAtk: 2, defense: 24, breakthrough: 4, org: 50, armor: 0.10,
    equip: { inf_eq: 100, truck_eq: 50 }
  },
  cav_bat: {
    id: 'cav_bat', name: '骑兵营', icon: '🐎',
    width: 2, manpower: 1000,
    softAtk: 6, hardAtk: 1, defense: 20, breakthrough: 2, org: 40, armor: 0,
    equip: { inf_eq: 120 }
  },
  // —— v14.0 P1 新增营种（HOI4 步兵师的关键配套，Wiki: Unit types）——
  aa_bat: {
    id: 'aa_bat', name: '防空营', icon: '🎯',
    width: 1, manpower: 250,          // [H] HOI4 防空/反坦克营宽度为 1
    softAtk: 2, hardAtk: 0, defense: 8, breakthrough: 1, org: 10, armor: 0,
    airDefense: 12,                    // 对空火力（参与制空权判定）
    equip: { sup_eq: 40 }
  },
  at_bat: {
    id: 'at_bat', name: '反坦克营', icon: '🔫',
    width: 1, manpower: 250,          // [H] 同为宽度 1
    softAtk: 2, hardAtk: 8, defense: 4, breakthrough: 1, org: 5, armor: 0,
    pierceBonus: 6,                    // 额外穿甲（克制装甲集群）
    equip: { sup_eq: 40 }
  },
  mtn_bat: {
    id: 'mtn_bat', name: '山地营', icon: '⛰️',
    width: 2, manpower: 900,
    softAtk: 8, hardAtk: 1, defense: 28, breakthrough: 3, org: 45, armor: 0,
    terrainBonus: { mount: 0.50, hills: 0.25 },   // 山地/丘陵地形加成
    equip: { inf_eq: 100 }
  },
  marine_bat: {
    id: 'marine_bat', name: '海军陆战营', icon: '🌊',
    width: 2, manpower: 1000,
    softAtk: 8, hardAtk: 1, defense: 24, breakthrough: 3, org: 50, armor: 0,
    amphibious: true,                  // 登陆加成（配合 invasion.js）
    equip: { inf_eq: 100 }
  },
  spart_bat: {
    id: 'spart_bat', name: '自行火炮营', icon: '🚂',
    width: 3, manpower: 600,           // [H] 自行火炮与线列炮兵同宽 3
    softAtk: 30, hardAtk: 4, defense: 12, breakthrough: 6, org: 5, armor: 0.30,
    selfPropelled: true,
    equip: { art_eq: 40, tank_eq: 10 }
  }
};

/** 营列类型分组：HOI4 规则「一个营列(regiment)只能放同类型营」 [H] */
export const REGIMENT_CLASS = {
  inf_bat: 'line', cav_bat: 'line', mtn_bat: 'line', marine_bat: 'line',
  art_bat: 'artillery', spart_bat: 'artillery',
  tank_bat: 'armor', mot_bat: 'armor',
  aa_bat: 'support', at_bat: 'support'
};

/** 装备配给等级 [H]：HOI4 师模板可标 elite / regular / reserve，elite 优先换装与补员 */
export const TEMPLATE_TIERS = {
  elite:   { id: 'elite',   name: '精锐师', color: '#ffd977', desc: '优先获得新装备与补员（消耗装备库存优先扣）' },
  regular: { id: 'regular', name: '常规师', color: '#c8d0dc', desc: '按标准顺序配给' },
  reserve: { id: 'reserve', name: '预备师', color: '#8a94a6', desc: '最后配给，装备陈旧、恢复慢' }
};

export const SUPPORT_COMPANIES = {
  sup_eng: {
    id: 'sup_eng', name: '工兵连', icon: '⛏️',
    width: 0, manpower: 300,
    softAtk: 0, hardAtk: 0, defense: 5, breakthrough: 0, org: 0, armor: 0,
    entrenchMax: 0.05,
    equip: { sup_eq: 30 }
  },
  sup_art: {
    id: 'sup_art', name: '支援火炮', icon: '🎯',
    width: 0, manpower: 300,
    softAtk: 15, hardAtk: 1, defense: 2, breakthrough: 1, org: 0, armor: 0,
    equip: { art_eq: 24, sup_eq: 10 }
  },
  sup_rec: {
    id: 'sup_rec', name: '侦察连', icon: '🔭',
    width: 0, manpower: 300,
    softAtk: 2, hardAtk: 1, defense: 3, breakthrough: 4, org: 0, armor: 0,
    recon: 1,
    equip: { truck_eq: 20, sup_eq: 10 }
  },
  sup_hos: {
    id: 'sup_hos', name: '野战医院', icon: '💉',
    width: 0, manpower: 400,
    softAtk: 0, hardAtk: 0, defense: 2, breakthrough: 0, org: 0, armor: 0,
    trickleback: 0.20,
    equip: { truck_eq: 10, sup_eq: 30 }
  },
  sup_log: {
    id: 'sup_log', name: '后勤连', icon: '📦',
    width: 0, manpower: 500,
    softAtk: 0, hardAtk: 0, defense: 1, breakthrough: 0, org: 0, armor: 0,
    supplyUse: -0.20,
    equip: { truck_eq: 20, sup_eq: 20 }
  }
};

/**
 * 计算编制综合属性
 */
export function calcTemplateStats(template){
  const stats = {
    width: 0,
    manpower: 0,
    softAtk: 0,
    hardAtk: 0,
    defense: 0,
    breakthrough: 0,
    org: 0,
    armor: 0,
    entrenchMax: 0.15,
    supplyUse: 0,        // [B] 净补给消耗（支援连可降低）
    recon: 0,            // [H] 侦察值（反制战术骰）
    airDefense: 0,       // [H] 对空火力
    pierceBonus: 0,      // [H] 额外穿甲
    tier: template.tier || 'regular',
    equipNeeded: { inf_eq: 0, art_eq: 0, tank_eq: 0, truck_eq: 0, sup_eq: 0 }
  };

  let totalOrg = 0;
  let totalArmor = 0;
  let combatCount = 0;

  // 1) 5x5 战斗营计算
  const grid = template.grid || [];
  for(let c = 0; c < 5; c++){
    for(let r = 0; r < 5; r++){
      const batId = grid[c] ? grid[c][r] : null;
      if(batId && BATTALIONS[batId]){
        const b = BATTALIONS[batId];
        stats.width += b.width;
        stats.manpower += b.manpower;
        stats.softAtk += b.softAtk;
        stats.hardAtk += b.hardAtk;
        stats.defense += b.defense;
        stats.breakthrough += b.breakthrough;
        totalOrg += b.org;
        totalArmor += b.armor;
        combatCount++;
        if(b.recon) stats.recon += b.recon;
        if(b.airDefense) stats.airDefense += b.airDefense;
        if(b.pierceBonus) stats.pierceBonus += b.pierceBonus;

        for(const eq in b.equip){
          stats.equipNeeded[eq] = (stats.equipNeeded[eq] || 0) + b.equip[eq];
        }
      }
    }
  }

  // 组织度与装甲率为战斗营加权均值
  if(combatCount > 0){
    stats.org = Math.round(totalOrg / combatCount);
    stats.armor = +(totalArmor / combatCount).toFixed(2);
  }

  // 2) 5 支援连槽位计算 (宽度为 0)
  const supports = template.supports || [];
  for(const supId of supports){
    if(supId && SUPPORT_COMPANIES[supId]){
      const s = SUPPORT_COMPANIES[supId];
      stats.manpower += s.manpower;
      stats.softAtk += s.softAtk;
      stats.hardAtk += s.hardAtk;
      stats.defense += s.defense;
      stats.breakthrough += s.breakthrough;
      if(s.entrenchMax){
        stats.entrenchMax += s.entrenchMax;
      }
      if(s.supplyUse) stats.supplyUse += s.supplyUse;
      if(s.recon) stats.recon += s.recon;
      if(s.airDefense) stats.airDefense += s.airDefense;
      if(s.pierceBonus) stats.pierceBonus += s.pierceBonus;
      for(const eq in s.equip){
        stats.equipNeeded[eq] = (stats.equipNeeded[eq] || 0) + s.equip[eq];
      }
    }
  }

  return stats;
}

/**
 * 计算调整编制所需的陆军经验 (5 XP/槽)
 */
export function calcTemplateDiff(oldTemplate, newTemplate){
  if(!oldTemplate){
    let count = 0;
    const grid = newTemplate.grid || [];
    for(let c = 0; c < 5; c++){
      for(let r = 0; r < 5; r++){
        if(grid[c] && grid[c][r]) count++;
      }
    }
    count += (newTemplate.supports || []).filter(Boolean).length;
    return count * 5;
  }

  let diffCount = 0;
  const gOld = oldTemplate.grid || [];
  const gNew = newTemplate.grid || [];

  for(let c = 0; c < 5; c++){
    for(let r = 0; r < 5; r++){
      const bOld = gOld[c] ? gOld[c][r] : null;
      const bNew = gNew[c] ? gNew[c][r] : null;
      if(bOld !== bNew) diffCount++;
    }
  }

  const sOld = oldTemplate.supports || [];
  const sNew = newTemplate.supports || [];
  for(let i = 0; i < 5; i++){
    if(sOld[i] !== sNew[i]) diffCount++;
  }

  return diffCount * 5;
}

/**
 * 4 大预设编制构建
 */
export function createDefaultTemplates(){
  // 1) 标准步兵师 9步1工 (18宽)
  const gStd = [[], [], [], [], []];
  gStd[0] = ['inf_bat', 'inf_bat', 'inf_bat'];
  gStd[1] = ['inf_bat', 'inf_bat', 'inf_bat'];
  gStd[2] = ['inf_bat', 'inf_bat', 'inf_bat'];

  // 2) 七步二炮 7步2炮+工+炮 (20宽)
  const g72 = [[], [], [], [], []];
  g72[0] = ['inf_bat', 'inf_bat', 'inf_bat'];
  g72[1] = ['inf_bat', 'inf_bat', 'inf_bat'];
  g72[2] = ['inf_bat'];
  g72[3] = ['art_bat', 'art_bat'];      // v14.0 P1：炮兵独占一列（营列不可混装类型）

  // 3) 经典装甲师 4坦4摩+工+炮 (16宽)
  const gArm = [[], [], [], [], []];
  gArm[0] = ['tank_bat', 'tank_bat'];
  gArm[1] = ['tank_bat', 'tank_bat'];
  gArm[2] = ['mot_bat', 'mot_bat'];
  gArm[3] = ['mot_bat', 'mot_bat'];

  // 4) 快速骑兵旅 4骑+侦 (8宽)
  const gCav = [[], [], [], [], []];
  gCav[0] = ['cav_bat', 'cav_bat'];
  gCav[1] = ['cav_bat', 'cav_bat'];

  // 5. 现代防御师（v14.0 P1 新营种示例：炮兵 + 防空 + 反坦克）
  const gMod = [[], [], [], [], []];
  gMod[0] = ['inf_bat', 'inf_bat', 'inf_bat'];
  gMod[1] = ['inf_bat', 'inf_bat', 'inf_bat'];
  gMod[2] = ['art_bat'];
  gMod[3] = ['aa_bat'];
  gMod[4] = ['at_bat'];

  // 6. 装甲突击师（坦克列 + 摩托化列 + 防空，elite 配给）
  const gArm2 = [[], [], [], [], []];
  gArm2[0] = ['tank_bat', 'tank_bat', 'tank_bat'];
  gArm2[1] = ['tank_bat', 'tank_bat'];
  gArm2[2] = ['mot_bat', 'mot_bat'];
  gArm2[3] = ['mot_bat', 'mot_bat'];
  gArm2[4] = ['aa_bat'];

  return {
    modern_infantry: {
      id: 'modern_infantry',
      name: '现代防御师 (6步炮空反)',
      grid: gMod,
      supports: ['sup_eng', 'sup_rec', 'sup_log'],
      tier: 'regular',
      icon: '🛡️'
    },
    armor_assault: {
      id: 'armor_assault',
      name: '装甲突击师 (5坦4摩空)',
      grid: gArm2,
      supports: ['sup_eng', 'sup_art'],
      tier: 'elite',
      icon: '🛡️'
    },
    infantry_standard: {
      id: 'infantry_standard',
      name: '标准步兵师 (9步)',
      grid: gStd,
      supports: ['sup_eng'],
      icon: '🪖'
    },
    infantry_artillery_7_2: {
      id: 'infantry_artillery_7_2',
      name: '主力突穿师 (7步2炮)',
      grid: g72,
      supports: ['sup_eng', 'sup_art'],
      icon: '💥'
    },
    panzer_division: {
      id: 'panzer_division',
      name: '装甲突击师 (4坦4摩)',
      grid: gArm,
      supports: ['sup_eng', 'sup_art'],
      icon: '🛡️'
    },
    cavalry_brigade: {
      id: 'cavalry_brigade',
      name: '快速骑兵旅 (4骑)',
      grid: gCav,
      supports: ['sup_rec'],
      icon: '🐎'
    }
  };
}

/** ============================================================
   * W0-A3：把 world.templates 接入 loadScenario
   *
   * 断链事实：world.templates 全库唯一的创建点是 convertDivisionTemplate
   * 内部的惰性初始化，loadScenario 从不调用。于是：
   *   battle.js 的模板攻防分支 / rivers.js 的工兵减半 / plans.js 的炮兵识别
   *   全部因为 u.templateId === undefined 而空转，
   *   panelDesigner 设计的编制没有任何一场战斗读它。
   * ============================================================ */

/** 每个兵种的默认编制 —— 既是开局挂载值，也是「量级基准」 */
export const DEFAULT_TEMPLATE_BY_UNIT = {
  inf:  'infantry_standard',
  cav:  'cavalry_brigade',
  mtn:  'infantry_standard',
  mot:  'infantry_standard',
  larm: 'panzer_division',
  arm:  'armor_assault'
};

/** 惰性创建 world.templates（幂等） */
export function initTemplates(world){
  if(!world) return null;
  if(!world.templates) world.templates = createDefaultTemplates();
  return world.templates;
}

/* ============================================================
   比例化挂载：模板改变「构成」，不改变「量级」
   ------------------------------------------------------------
   为什么不能直接用模板聚合值替换基础攻防？
     UNITS.inf.soft = 6 与 BATTALIONS.inf_bat.softAtk = 6 是同一量级 ——
     也就是说 data/units.js 的「一个师」实际只相当于「一个营」。
     而 infantry_standard 是 9 个营，软攻合计 54。
     若照 battle.js 原来的写法整体替换，步兵师软攻会**膨胀 9 倍**，
     sim.js 的 B1/B3/B4 断言当场炸掉，且等于把全局平衡推倒重来。

   本次（W0）只做接线，不重标定平衡。因此采用比例语义：
     某模板的聚合值 ÷ 该兵种参考模板的聚合值 = 构成比
     基准编制 → 比值 1.0 → 与今天完全一致（零平衡漂移）
     玩家在设计器里换编制 → 比值偏离 1.0 → 战斗属性随之变化

   「真正的 HOI4 师级量级」（10 营 = 1 师、70 宽战场）留给 W1，
   届时连同 DMG_MULT / 战宽表一起重新标定。
   ============================================================ */

let REF_STATS_CACHE = null;
function refStatsFor(type){
  if(!REF_STATS_CACHE){
    REF_STATS_CACHE = {};
    const tpls = createDefaultTemplates();
    for(const t in DEFAULT_TEMPLATE_BY_UNIT){
      const tpl = tpls[DEFAULT_TEMPLATE_BY_UNIT[t]];
      if(tpl) REF_STATS_CACHE[t] = calcTemplateStats(tpl);
    }
  }
  return REF_STATS_CACHE[type] || null;
}

const IDENTITY_ADJ = { soft:1, hard:1, def:1, brk:1, width:1, pierceBonus:0 };

/**
 * 取某单位因编制而产生的「构成比」。
 * 无模板 / 模板缺失 / 基准缺失时返回全 1.0（与未接入模板时完全一致）。
 */
export function templateAdjust(world, u){
  if(!u || !u.templateId || !world || !world.templates) return IDENTITY_ADJ;
  const tpl = world.templates[u.templateId];
  if(!tpl) return IDENTITY_ADJ;
  const ref = refStatsFor(u.type);
  if(!ref) return IDENTITY_ADJ;
  const s = calcTemplateStats(tpl);
  const ratio = (a, b) => (b > 0 ? a / b : 1);
  return {
    soft:   ratio(s.softAtk,      ref.softAtk),
    hard:   ratio(s.hardAtk,      ref.hardAtk),
    def:    ratio(s.defense,      ref.defense),
    brk:    ratio(s.breakthrough, ref.breakthrough),
    width:  ratio(s.width,        ref.width),
    pierceBonus: (s.pierceBonus || 0) - (ref.pierceBonus || 0)
  };
}

/** 模板是否带某支援连（注意字段名是 supports，不是 support） */
export function templateHasSupport(world, templateId, supId){
  if(!templateId || !world || !world.templates) return false;
  const tpl = world.templates[templateId];
  return !!(tpl && (tpl.supports || []).includes(supId));
}

/**
 * 师改编换装逻辑与缺编检测
 */
export function convertDivisionTemplate(world, unit, newTemplateId){
  const nat = world.nations[unit.nat];
  initTemplates(world);
  const tmpl = world.templates[newTemplateId];
  if(!nat || !tmpl) return false;

  const stats = calcTemplateStats(tmpl);
  nat.equipment = nat.equipment || {};

  // 检测库存匹配度与缺编比例
  let minFillRate = 1.0;
  let hasDeficit = false;
  const needed = stats.equipNeeded;

  for(const eq in needed){
    const req = needed[eq];
    if(req > 0){
      const stock = nat.equipment[eq] || 0;
      if(stock < req){
        hasDeficit = true;
        const rate = stock / req;
        if(rate < minFillRate) minFillRate = rate;
      }
    }
  }

  // 扣减已有的装备，不足的计入缺编
  for(const eq in needed){
    const req = needed[eq];
    if(req > 0){
      const avail = Math.min(nat.equipment[eq] || 0, req);
      nat.equipment[eq] = (nat.equipment[eq] || 0) - avail;
    }
  }

  unit.templateId = newTemplateId;
  unit.equipmentFill = Math.max(0.1, minFillRate);
  unit.hp = Math.round(unit.equipmentFill * 100);
  unit.equipmentDeficit = hasDeficit;

  return { success: true, hasDeficit, fillRate: unit.equipmentFill };
}

/* ============================================================
   v14.0 P1 —— 营列约束与配给等级
   ============================================================ */

/** 校验营列合法性 [H]：HOI4 规则「一个营列只能放同类型营」
    返回 { ok, errors:[{col, msg}] } */
export function validateTemplate(template){
  const errors = [];
  const grid = (template && template.grid) || [];
  for(let c = 0; c < 5; c++){
    const col = grid[c] || [];
    let cls = null;
    for(const batId of col){
      if(!batId) continue;
      const k = REGIMENT_CLASS[batId];
      if(!k){ errors.push({ col:c, msg:'未知营种 ' + batId }); continue; }
      if(cls == null) cls = k;
      else if(cls !== k){
        errors.push({ col:c, msg:'同一营列不能混装不同类型（当前 ' + cls + ' + ' + k + '）' });
        break;
      }
    }
  }
  const sups = (template && template.supports) || [];
  if(sups.length > 5) errors.push({ col:-1, msg:'支援连最多 5 个' });
  const dup = new Set();
  for(const s of sups){
    if(s && SUPPORT_COMPANIES[s]){
      if(dup.has(s)) errors.push({ col:-1, msg:'支援连「' + SUPPORT_COMPANIES[s].name + '」不可重复' });
      dup.add(s);
    } else if(s){
      errors.push({ col:-1, msg:'未知支援连 ' + s });
    }
  }
  return { ok: errors.length === 0, errors };
}

/** 配给等级排序权重：数值越小越优先获得装备与补员 [H] */
export function tierPriority(tier){
  return tier === 'elite' ? 0 : tier === 'reserve' ? 2 : 1;
}

/** 某师的配给等级（从模板读，缺省 regular） */
export function unitTier(world, u){
  if(u && u.tier) return u.tier;
  const tpl = (u && u.templateId && world.templates) ? world.templates[u.templateId] : null;
  return (tpl && tpl.tier) || 'regular';
}

/** 装备可靠性 → 组织恢复率系数 [H]
    HOI4：组织恢复率受平均可靠性影响；本作此前固定 ORG_RECOVER_PER_DAY。
    reliability ∈ [0.5, 1.0] → 系数 0.6~1.0 */
export function reliabilityRecoverFactor(rel){
  const r = Math.max(0.5, Math.min(1, rel == null ? 1 : rel));
  return 0.6 + 0.4 * r;
}

/** 全军平均装备可靠性（按在役师加权） */
export function armyReliability(world, natId){
  let sum = 0, n = 0;
  for(const u of world.units){
    if(u.nat !== natId || u.hp <= 0) continue;
    const r = u.reliability != null ? u.reliability : 1;
    sum += r; n++;
  }
  return n > 0 ? sum / n : 1;
}
