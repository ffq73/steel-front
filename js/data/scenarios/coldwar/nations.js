/* ============================================================
   data/scenarios/coldwar/nations.js —— 冷战主要国家与阵营定义
   ============================================================ */

export const COLDWAR_NATIONS = {
  // —— 北约阵营 (NATO) ——
  USA: {
    name: '美利坚合众国', color: '#2e5b88', capital: '华盛顿',
    civ: 30, mil: 20, equip: 3000, law: 'civilian', warSupport: 65, stability: 85,
    faction: 'nato', prestige: 90,
    ai: { aggression: 0.45, expansion: 0.3, loyalty: 0.9, risk: 0.4, econ: 0.95, opportunism: 0.5, prodMul: 1.3, decisionDelay: 1, attackThreshold: 2.2 }
  },
  GBR: {
    name: '大不列颠及北爱尔兰联合王国', color: '#b22222', capital: '伦敦',
    civ: 14, mil: 10, equip: 1200, law: 'civilian', warSupport: 60, stability: 80,
    faction: 'nato', prestige: 75,
    ai: { aggression: 0.35, expansion: 0.2, loyalty: 0.9, risk: 0.35, econ: 0.8, opportunism: 0.5, prodMul: 1.0, decisionDelay: 2, attackThreshold: 2.5 }
  },
  FRA: {
    name: '法兰西共和国', color: '#1e3f66', capital: '巴黎',
    civ: 14, mil: 10, equip: 1100, law: 'civilian', warSupport: 55, stability: 70,
    faction: 'nato', prestige: 75,
    ai: { aggression: 0.4, expansion: 0.25, loyalty: 0.7, risk: 0.45, econ: 0.75, opportunism: 0.6, prodMul: 1.0, decisionDelay: 2, attackThreshold: 2.4 }
  },
  GER_W: {
    name: '德意志联邦共和国（西德）', color: '#333333', capital: '波恩',
    civ: 16, mil: 8, equip: 900, law: 'civilian', warSupport: 50, stability: 80,
    faction: 'nato', prestige: 70,
    ai: { aggression: 0.2, expansion: 0.1, loyalty: 0.85, risk: 0.3, econ: 0.9, opportunism: 0.3, prodMul: 1.1, decisionDelay: 2, attackThreshold: 2.8 }
  },
  ITA: {
    name: '意大利共和国', color: '#3b7a57', capital: '罗马',
    civ: 10, mil: 6, equip: 600, law: 'civilian', warSupport: 45, stability: 65,
    faction: 'nato', prestige: 60,
    ai: { aggression: 0.2, expansion: 0.1, loyalty: 0.8, risk: 0.3, econ: 0.75, opportunism: 0.4, prodMul: 0.95, decisionDelay: 2, attackThreshold: 2.8 }
  },
  CAN: {
    name: '加拿大', color: '#9b2928', capital: '渥太华',
    civ: 8, mil: 4, equip: 450, law: 'civilian', warSupport: 55, stability: 85,
    faction: 'nato', prestige: 65,
    ai: { aggression: 0.2, expansion: 0.05, loyalty: 0.95, risk: 0.2, econ: 0.8, opportunism: 0.2, prodMul: 1.0, decisionDelay: 2, attackThreshold: 2.8 }
  },
  JPN: {
    name: '日本国', color: '#c4302b', capital: '东京',
    civ: 18, mil: 6, equip: 600, law: 'civilian', warSupport: 40, stability: 85,
    faction: 'nato', prestige: 70,
    ai: { aggression: 0.1, expansion: 0.05, loyalty: 0.9, risk: 0.2, econ: 0.95, opportunism: 0.2, prodMul: 1.2, decisionDelay: 2, attackThreshold: 3.0 }
  },
  KOR: {
    name: '大韩民国', color: '#2b5876', capital: '首尔',
    civ: 6, mil: 6, equip: 500, law: 'war', warSupport: 80, stability: 65,
    faction: 'nato', prestige: 55,
    ai: { aggression: 0.5, expansion: 0.2, loyalty: 0.9, risk: 0.6, econ: 0.6, opportunism: 0.3, prodMul: 1.0, decisionDelay: 1, attackThreshold: 2.0 }
  },
  ISR: {
    name: '以色列国', color: '#4682b4', capital: '耶路撒冷',
    civ: 6, mil: 6, equip: 550, law: 'war', warSupport: 90, stability: 75,
    faction: 'nato', prestige: 65,
    ai: { aggression: 0.6, expansion: 0.3, loyalty: 0.85, risk: 0.6, econ: 0.7, opportunism: 0.4, prodMul: 1.1, decisionDelay: 1, attackThreshold: 1.8 }
  },

  // —— 华约阵营 (Warsaw Pact) ——
  SOV: {
    name: '苏维埃社会主义共和国联盟', color: '#8b0000', capital: '莫斯科',
    civ: 24, mil: 28, equip: 3500, law: 'war', warSupport: 80, stability: 80,
    faction: 'warsaw', prestige: 88,
    ai: { aggression: 0.55, expansion: 0.5, loyalty: 0.85, risk: 0.5, econ: 0.8, opportunism: 0.6, prodMul: 1.3, decisionDelay: 1, attackThreshold: 2.0 }
  },
  GER_E: {
    name: '德意志民主共和国（东德）', color: '#551a1a', capital: '东柏林',
    civ: 8, mil: 8, equip: 700, law: 'war', warSupport: 65, stability: 70,
    faction: 'warsaw', prestige: 55,
    ai: { aggression: 0.3, expansion: 0.1, loyalty: 0.95, risk: 0.3, econ: 0.7, opportunism: 0.2, prodMul: 1.0, decisionDelay: 2, attackThreshold: 2.5 }
  },
  POL: {
    name: '波兰人民共和国', color: '#b83b5e', capital: '华沙',
    civ: 8, mil: 7, equip: 650, law: 'partial', warSupport: 55, stability: 65,
    faction: 'warsaw', prestige: 55,
    ai: { aggression: 0.3, expansion: 0.1, loyalty: 0.85, risk: 0.3, econ: 0.65, opportunism: 0.3, prodMul: 1.0, decisionDelay: 2, attackThreshold: 2.5 }
  },
  CZE: {
    name: '捷克斯洛伐克社会主义共和国', color: '#8b5a2b', capital: '布拉格',
    civ: 7, mil: 6, equip: 550, law: 'partial', warSupport: 50, stability: 65,
    faction: 'warsaw', prestige: 55,
    ai: { aggression: 0.25, expansion: 0.1, loyalty: 0.75, risk: 0.3, econ: 0.7, opportunism: 0.4, prodMul: 1.0, decisionDelay: 2, attackThreshold: 2.6 }
  },
  HUN: {
    name: '匈牙利人民共和国', color: '#5b8c5a', capital: '布达佩斯',
    civ: 6, mil: 5, equip: 450, law: 'partial', warSupport: 50, stability: 60,
    faction: 'warsaw', prestige: 50,
    ai: { aggression: 0.25, expansion: 0.1, loyalty: 0.75, risk: 0.3, econ: 0.6, opportunism: 0.4, prodMul: 0.95, decisionDelay: 2, attackThreshold: 2.6 }
  },
  PRK: {
    name: '朝鲜民主主义人民共和国', color: '#900c3f', capital: '平壤',
    civ: 5, mil: 7, equip: 600, law: 'war', warSupport: 90, stability: 85,
    faction: 'warsaw', prestige: 50,
    ai: { aggression: 0.7, expansion: 0.4, loyalty: 0.8, risk: 0.7, econ: 0.5, opportunism: 0.5, prodMul: 1.05, decisionDelay: 1, attackThreshold: 1.7 }
  },
  CUB: {
    name: '古巴共和国', color: '#006699', capital: '哈瓦那',
    civ: 4, mil: 5, equip: 400, law: 'war', warSupport: 85, stability: 80,
    faction: 'warsaw', prestige: 60,
    ai: { aggression: 0.5, expansion: 0.3, loyalty: 0.9, risk: 0.6, econ: 0.5, opportunism: 0.5, prodMul: 1.0, decisionDelay: 1, attackThreshold: 2.0 }
  },
  VNM: {
    name: '越南民主共和国', color: '#c8102e', capital: '河内',
    civ: 5, mil: 7, equip: 500, law: 'war', warSupport: 95, stability: 85,
    faction: 'warsaw', prestige: 65,
    ai: { aggression: 0.65, expansion: 0.4, loyalty: 0.8, risk: 0.65, econ: 0.5, opportunism: 0.4, prodMul: 1.05, decisionDelay: 1, attackThreshold: 1.8 }
  },

  // —— 不结盟与第三世界 (Non-Aligned) ——
  CHN: {
    name: '中华人民共和国', color: '#c41230', capital: '北京',
    civ: 14, mil: 16, equip: 1600, law: 'war', warSupport: 90, stability: 85,
    faction: 'non_aligned', prestige: 75,
    ai: { aggression: 0.5, expansion: 0.2, loyalty: 0.6, risk: 0.5, econ: 0.75, opportunism: 0.5, prodMul: 1.15, decisionDelay: 1, attackThreshold: 2.0 }
  },
  IND: {
    name: '印度共和国', color: '#ff9933', capital: '德里',
    civ: 10, mil: 8, equip: 800, law: 'civilian', warSupport: 60, stability: 70,
    faction: 'non_aligned', prestige: 70,
    ai: { aggression: 0.3, expansion: 0.1, loyalty: 0.6, risk: 0.3, econ: 0.65, opportunism: 0.4, prodMul: 1.0, decisionDelay: 2, attackThreshold: 2.5 }
  },
  YUG: {
    name: '南斯拉夫社会主义联邦共和国', color: '#483d8b', capital: '贝尔格莱德',
    civ: 7, mil: 6, equip: 550, law: 'partial', warSupport: 70, stability: 75,
    faction: 'non_aligned', prestige: 70,
    ai: { aggression: 0.3, expansion: 0.1, loyalty: 0.5, risk: 0.4, econ: 0.65, opportunism: 0.6, prodMul: 1.0, decisionDelay: 2, attackThreshold: 2.5 }
  },
  EGY: {
    name: '阿拉伯埃及共和国', color: '#c49a45', capital: '开罗',
    civ: 6, mil: 6, equip: 500, law: 'partial', warSupport: 75, stability: 65,
    faction: 'non_aligned', prestige: 65,
    ai: { aggression: 0.5, expansion: 0.2, loyalty: 0.5, risk: 0.55, econ: 0.55, opportunism: 0.6, prodMul: 0.95, decisionDelay: 2, attackThreshold: 2.2 }
  },
  IRN: {
    name: '伊朗', color: '#2e8b57', capital: '德黑兰',
    civ: 7, mil: 6, equip: 500, law: 'partial', warSupport: 60, stability: 65,
    faction: 'non_aligned', prestige: 60,
    ai: { aggression: 0.35, expansion: 0.15, loyalty: 0.5, risk: 0.4, econ: 0.7, opportunism: 0.5, prodMul: 1.0, decisionDelay: 2, attackThreshold: 2.4 }
  },
  SAU: {
    name: '沙特阿拉伯王国', color: '#1b4d3e', capital: '利雅得',
    civ: 8, mil: 4, equip: 400, law: 'civilian', warSupport: 50, stability: 75,
    faction: 'non_aligned', prestige: 65,
    ai: { aggression: 0.2, expansion: 0.05, loyalty: 0.75, risk: 0.25, econ: 0.85, opportunism: 0.4, prodMul: 1.0, decisionDelay: 3, attackThreshold: 2.8 }
  },
  BRA: {
    name: '巴西联邦共和国', color: '#228b22', capital: '巴西利亚',
    civ: 8, mil: 5, equip: 450, law: 'civilian', warSupport: 50, stability: 65,
    faction: 'non_aligned', prestige: 60,
    ai: { aggression: 0.2, expansion: 0.05, loyalty: 0.6, risk: 0.25, econ: 0.7, opportunism: 0.4, prodMul: 0.95, decisionDelay: 3, attackThreshold: 2.8 }
  },
  AFG: {
    name: '阿富汗', color: '#4a5d4e', capital: '喀布尔',
    civ: 3, mil: 3, equip: 200, law: 'war', warSupport: 85, stability: 45,
    faction: 'non_aligned', prestige: 40,
    ai: { aggression: 0.4, expansion: 0.05, loyalty: 0.4, risk: 0.5, econ: 0.3, opportunism: 0.4, prodMul: 0.8, decisionDelay: 2, attackThreshold: 2.2 }
  },
  ZAF: {
    name: '南非共和国', color: '#556b2f', capital: '比勒陀利亚',
    civ: 7, mil: 5, equip: 450, law: 'partial', warSupport: 55, stability: 55,
    faction: 'neutral', prestige: 50,
    ai: { aggression: 0.3, expansion: 0.05, loyalty: 0.5, risk: 0.35, econ: 0.7, opportunism: 0.3, prodMul: 0.95, decisionDelay: 3, attackThreshold: 2.8 }
  }
};
