/* ============================================================
   data/resources.js —— 六大战略资源静态数据 (v7.0 §2.4 / E4)
   石油/钢铁/铝/钨/橡胶/铬：产出、产线需求、燃料与穿深联动
   ============================================================ */

export const RESOURCE_TYPES = ['oil', 'steel', 'aluminum', 'tungsten', 'rubber', 'chromium'];

export const RESOURCES = {
  oil:      { id:'oil',      name:'石油', icon:'🛢️', color:'#d97706', desc:'炼化为燃料储备池，驱动坦克/卡车/飞机行动；断油则装甲机动与突破暴跌。' },
  steel:    { id:'steel',    name:'钢铁', icon:'⚙️', color:'#94a3b8', desc:'步兵武器、火炮、坦克车体与卡车的基础原料；缺铁则流水线效率上限锁定 30%。' },
  aluminum: { id:'aluminum', name:'铝矿', icon:'🪨', color:'#a8a29e', desc:'飞机机身、雷达与轻型支援装备核心原料。' },
  tungsten: { id:'tungsten', name:'钨矿', icon:'🔩', color:'#57534e', desc:'穿甲弹头与重炮身管原料，直接决定反坦克穿深(Piercing)。' },
  rubber:   { id:'rubber',   name:'橡胶', icon:'🛞', color:'#4d7c0f', desc:'卡车轮胎与机械化底盘原料；可由合成精炼厂自产补充。' },
  chromium: { id:'chromium', name:'铬矿', icon:'⛏️', color:'#7c2d12', desc:'重型特种装甲、现代主战坦克与重巡洋舰甲板特种钢原料。' }
};

/* 生产线每厂每日战略资源需求（产线效率按满足率结算，B.4 公式） */
export const LINE_RESOURCE_NEED = {
  inf_eq:   { steel: 0.80 },
  art_eq:   { steel: 1.20, tungsten: 0.15 },
  tank_eq:  { steel: 2.00, tungsten: 0.40, chromium: 0.25 },
  truck_eq: { steel: 0.60, rubber: 0.40 },
  sup_eq:   { steel: 0.40, aluminum: 0.20 }
};

/* 师团每日燃料消耗（单位/天，从燃料池扣除；不足则机动瘫痪 §2.4） */
export const UNIT_FUEL_NEED = {
  cav:  0.10,
  mot:  0.50,
  larm: 1.00,
  arm:  1.25
};

/* 资源→产线映射（工具提示用） */
export const RESOURCE_USED_BY = {
  oil:      ['坦克生产线', '摩托/卡车机动'],
  steel:    ['步兵装备', '火炮', '坦克', '卡车', '支援装备'],
  aluminum: ['支援装备(雷达电台)'],
  tungsten: ['火炮(穿甲弹)', '坦克(穿甲炮)'],
  rubber:   ['卡车(轮胎)'],
  chromium: ['坦克(特种装甲)']
};

/* 国家基础资源产出（点/天，1939 剧本量级标定 [B]） */
export const NATION_RESOURCE_BASE = {
  G:  { oil: 4,  steel: 12, aluminum: 6, tungsten: 4,  rubber: 2, chromium: 3 },
  P:  { oil: 1,  steel: 4,  aluminum: 1, tungsten: 2,  rubber: 0, chromium: 0 },
  F:  { oil: 2,  steel: 8,  aluminum: 4, tungsten: 2,  rubber: 3, chromium: 1 },
  S:  { oil: 10, steel: 14, aluminum: 5, tungsten: 6,  rubber: 1, chromium: 4 },
  B:  { oil: 0,  steel: 1,  aluminum: 0, tungsten: 0,  rubber: 0, chromium: 0 },
  H:  { oil: 0,  steel: 2,  aluminum: 0, tungsten: 1,  rubber: 0, chromium: 0 },
  N:  { oil: 0,  steel: 0,  aluminum: 0, tungsten: 0,  rubber: 0, chromium: 0 },
  /* 一战/冷战/现代剧本国号 */
  GER:{ oil: 3,  steel: 11, aluminum: 4, tungsten: 3,  rubber: 1, chromium: 2 },
  AUS:{ oil: 1,  steel: 5,  aluminum: 2, tungsten: 2,  rubber: 0, chromium: 1 },
  OTT:{ oil: 2,  steel: 2,  aluminum: 0, tungsten: 0,  rubber: 0, chromium: 0 },
  BUL:{ oil: 0,  steel: 1,  aluminum: 0, tungsten: 1,  rubber: 0, chromium: 0 },
  FRA:{ oil: 2,  steel: 8,  aluminum: 4, tungsten: 2,  rubber: 3, chromium: 1 },
  ENG:{ oil: 5,  steel: 10, aluminum: 6, tungsten: 1,  rubber: 4, chromium: 0 },
  RUS:{ oil: 9,  steel: 12, aluminum: 4, tungsten: 5,  rubber: 0, chromium: 3 },
  ITA:{ oil: 1,  steel: 4,  aluminum: 2, tungsten: 1,  rubber: 1, chromium: 1 },
  USA:{ oil: 16, steel: 18, aluminum: 10, tungsten: 4, rubber: 5, chromium: 3 },
  JAP:{ oil: 1,  steel: 6,  aluminum: 3, tungsten: 2,  rubber: 4, chromium: 0 },
  CCP:{ oil: 1,  steel: 4,  aluminum: 1, tungsten: 2,  rubber: 1, chromium: 0 },
  KOR:{ oil: 0,  steel: 2,  aluminum: 1, tungsten: 1,  rubber: 0, chromium: 0 },
  SOV:{ oil: 10, steel: 14, aluminum: 5, tungsten: 6,  rubber: 1, chromium: 4 }
};

/* 燃料储备池参数 */
export const FUEL_PARAMS = {
  BASE_CAPACITY: 500,          // 每点石油炼化储备基础容量
  CAPACITY_PER_REFINERY: 200,  // 合成精炼厂(支援装备线加成)扩容
  OIL_TO_FUEL: 2.0,            // 1 石油 → 2 燃料
  STARVATION_SPEED_MUL: 0.25,  // 断油：机动速度 -75%
  STARVATION_BRK_MUL: 0.40,     // 断油：突破 -60%
  PIERCING_TUNGSTEN_BONUS: 0.30 // 钨充裕：穿深 +30%（坦克产线不缺钨时）
};

/* 四大贸易法案数据规范 (v9.0 §4-N5) [H] */
export const TRADE_LAWS = {
  free_trade: {
    id: 'free_trade',
    name: '自由贸易 (Free Trade)',
    marketRatio: 0.80,
    costPP: 150,
    effects: { prodSpeed: 0.15, researchSpeed: 0.10, intelDefense: 0.40 },
    desc: '80% 资源投入国际市场；工厂产出 +15%，科研速度 +10%，间谍防御 +40% [H]'
  },
  export_focus: {
    id: 'export_focus',
    name: '出口优先 (Export Focus)',
    marketRatio: 0.50,
    costPP: 150,
    effects: { prodSpeed: 0.10, researchSpeed: 0.05, intelDefense: 0.20 },
    desc: '50% 资源投入国际市场；工厂产出 +10%，科研速度 +5%，间谍防御 +20% [H]'
  },
  limited_exports: {
    id: 'limited_exports',
    name: '限制出口 (Limited Exports)',
    marketRatio: 0.25,
    costPP: 150,
    effects: { prodSpeed: 0.05, researchSpeed: 0.01, intelDefense: 0.10 },
    desc: '25% 资源投入国际市场；工厂产出 +5%，科研速度 +1%，间谍防御 +10% [H]'
  },
  closed_economy: {
    id: 'closed_economy',
    name: '封闭经济 (Closed Economy)',
    marketRatio: 0.00,
    costPP: 150,
    effects: {},
    desc: '0% 资源投入市场，全额保留自用；无科研与工业加成 [H]'
  }
};

/* 附庸与傀儡自治度五级梯队 (v9.0 §4-N5 / 附录 B.6) [H] */
export const AUTONOMY_TIERS = {
  independent: {
    id: 'independent',
    name: '主权独立国',
    minAutonomy: 1000,
    civSurrender: 0.00,
    milSurrender: 0.00,
    desc: '完全自主，不受任何宗主约束'
  },
  dominion: {
    id: 'dominion',
    name: '自治领 (Dominion)',
    minAutonomy: 800,
    civSurrender: 0.00,
    milSurrender: 0.00,
    desc: '享有高度自治权，外交步调与宗主一致'
  },
  colony: {
    id: 'colony',
    name: '殖民地领地 (Colony)',
    minAutonomy: 500,
    civSurrender: 0.00,
    milSurrender: 0.00,
    desc: '宗主享有贸易优先权与 70% 殖民地兵役征召权'
  },
  puppet: {
    id: 'puppet',
    name: '附属傀儡国 (Puppet)',
    minAutonomy: 200,
    civSurrender: 0.00,
    milSurrender: 0.25,
    desc: '上缴 25% 军工厂产能给宗主国 [H]'
  },
  integrated_puppet: {
    id: 'integrated_puppet',
    name: '整合附庸傀儡 (Integrated Puppet)',
    minAutonomy: 0,
    civSurrender: 0.25,
    milSurrender: 0.75,
    desc: '深度整合：上缴 25% 民用工厂 + 75% 军工厂给宗主国！[H]'
  }
};

