/* ============================================================
   data/scenarios/ww2/nations.js —— 二战 32 国全量刻画与六维 AI 人格
   数据规范契合 §3.4、§3.10 与 附录 C
   ============================================================ */

export const WW2_NATIONS = {
  // —— 轴心国集团 (Axis) ——
  GER: {
    name: '德意志第三帝国', color: '#333333', capital: '柏林',
    civ: 18, mil: 22, equip: 2200, law: 'war', warSupport: 85, stability: 80,
    faction: 'axis',
    ai: { aggression: 0.95, expansion: 0.95, loyalty: 0.6, risk: 0.85, econ: 0.7, opportunism: 0.8, prodMul: 1.25, decisionDelay: 1, attackThreshold: 1.5 }
  },
  ITA: {
    name: '意大利王国', color: '#3b7a57', capital: '罗马',
    civ: 8, mil: 7, equip: 650, law: 'early_mob', warSupport: 60, stability: 55,
    faction: 'axis',
    ai: { aggression: 0.65, expansion: 0.7, loyalty: 0.5, risk: 0.45, econ: 0.5, opportunism: 0.85, prodMul: 0.95, decisionDelay: 2, attackThreshold: 2.0 }
  },
  JPN: {
    name: '大日本帝国', color: '#c4302b', capital: '东京',
    civ: 12, mil: 15, equip: 1400, law: 'war', warSupport: 90, stability: 85,
    faction: 'axis',
    ai: { aggression: 0.9, expansion: 0.9, loyalty: 0.4, risk: 0.8, econ: 0.6, opportunism: 0.75, prodMul: 1.1, decisionDelay: 1, attackThreshold: 1.6 }
  },
  HUN: {
    name: '匈牙利王国', color: '#5b8c5a', capital: '布达佩斯',
    civ: 4, mil: 4, equip: 320, law: 'partial', warSupport: 60, stability: 65,
    faction: 'axis',
    ai: { aggression: 0.5, expansion: 0.5, loyalty: 0.8, risk: 0.5, econ: 0.6, opportunism: 0.6, prodMul: 1.0, decisionDelay: 2, attackThreshold: 2.0 }
  },
  ROM: {
    name: '罗马尼亚王国', color: '#cd853f', capital: '布加勒斯特',
    civ: 5, mil: 5, equip: 380, law: 'partial', warSupport: 65, stability: 60,
    faction: 'axis',
    ai: { aggression: 0.6, expansion: 0.5, loyalty: 0.7, risk: 0.6, econ: 0.65, opportunism: 0.75, prodMul: 1.0, decisionDelay: 2, attackThreshold: 2.0 }
  },
  BUL: {
    name: '保加利亚王国', color: '#6b8e23', capital: '索非亚',
    civ: 3, mil: 3, equip: 240, law: 'partial', warSupport: 55, stability: 65,
    faction: 'axis',
    ai: { aggression: 0.4, expansion: 0.5, loyalty: 0.7, risk: 0.4, econ: 0.5, opportunism: 0.6, prodMul: 1.0, decisionDelay: 2, attackThreshold: 2.2 }
  },
  FIN: {
    name: '芬兰共和国', color: '#68829e', capital: '赫尔辛基',
    civ: 4, mil: 4, equip: 350, law: 'war', warSupport: 90, stability: 85,
    faction: 'axis',
    ai: { aggression: 0.4, expansion: 0.2, loyalty: 0.6, risk: 0.6, econ: 0.6, opportunism: 0.5, prodMul: 1.1, decisionDelay: 2, attackThreshold: 2.2 }
  },

  // —— 同盟国集团 (Allies) ——
  GBR: {
    name: '大英帝国', color: '#b22222', capital: '伦敦',
    civ: 16, mil: 14, equip: 1500, law: 'war', warSupport: 80, stability: 85,
    faction: 'allies',
    ai: { aggression: 0.6, expansion: 0.4, loyalty: 0.9, risk: 0.5, econ: 0.85, opportunism: 0.6, prodMul: 1.15, decisionDelay: 2, attackThreshold: 1.9 }
  },
  FRA: {
    name: '法兰西第三共和国', color: '#1e3f66', capital: '巴黎',
    civ: 14, mil: 12, equip: 1200, law: 'partial', warSupport: 65, stability: 55,
    faction: 'allies',
    ai: { aggression: 0.45, expansion: 0.3, loyalty: 0.85, risk: 0.4, econ: 0.7, opportunism: 0.4, prodMul: 1.0, decisionDelay: 2, attackThreshold: 2.2 }
  },
  USA: {
    name: '美利坚合众国', color: '#2e5b88', capital: '华盛顿',
    civ: 25, mil: 12, equip: 1800, law: 'partial', warSupport: 60, stability: 85,
    faction: 'allies',
    ai: { aggression: 0.75, expansion: 0.3, loyalty: 0.9, risk: 0.5, econ: 0.98, opportunism: 0.5, prodMul: 1.4, decisionDelay: 2, attackThreshold: 1.8 }
  },
  POL: {
    name: '波兰第二共和国', color: '#b83b5e', capital: '华沙',
    civ: 7, mil: 8, equip: 700, law: 'war', warSupport: 85, stability: 70,
    faction: 'allies',
    ai: { aggression: 0.65, expansion: 0.4, loyalty: 0.8, risk: 0.7, econ: 0.5, opportunism: 0.4, prodMul: 1.0, decisionDelay: 2, attackThreshold: 2.0 }
  },
  CAN: {
    name: '加拿大自治领', color: '#9b2928', capital: '渥太华',
    civ: 5, mil: 4, equip: 350, law: 'partial', warSupport: 75, stability: 80,
    faction: 'allies',
    ai: { aggression: 0.5, expansion: 0.1, loyalty: 0.95, risk: 0.4, econ: 0.7, opportunism: 0.2, prodMul: 1.05, decisionDelay: 2, attackThreshold: 2.0 }
  },
  AST: {
    name: '澳大利亚联邦', color: '#3d6350', capital: '堪培拉',
    civ: 4, mil: 3, equip: 280, law: 'partial', warSupport: 70, stability: 80,
    faction: 'allies',
    ai: { aggression: 0.5, expansion: 0.1, loyalty: 0.95, risk: 0.4, econ: 0.65, opportunism: 0.2, prodMul: 1.0, decisionDelay: 2, attackThreshold: 2.0 }
  },
  BEL: {
    name: '比利时王国', color: '#cf9b22', capital: '布鲁塞尔',
    civ: 4, mil: 3, equip: 250, law: 'partial', warSupport: 65, stability: 70,
    faction: 'allies',
    ai: { aggression: 0.3, expansion: 0.1, loyalty: 0.8, risk: 0.4, econ: 0.6, opportunism: 0.3, prodMul: 0.9, decisionDelay: 2, attackThreshold: 2.5 }
  },
  NLD: {
    name: '荷兰王国', color: '#e67300', capital: '阿姆斯特丹',
    civ: 4, mil: 3, equip: 250, law: 'partial', warSupport: 60, stability: 75,
    faction: 'allies',
    ai: { aggression: 0.25, expansion: 0.1, loyalty: 0.8, risk: 0.35, econ: 0.75, opportunism: 0.3, prodMul: 0.9, decisionDelay: 2, attackThreshold: 2.5 }
  },
  NOR: {
    name: '挪威王国', color: '#2b5876', capital: '奥斯陆',
    civ: 3, mil: 2, equip: 180, law: 'partial', warSupport: 60, stability: 75,
    faction: 'allies',
    ai: { aggression: 0.2, expansion: 0.1, loyalty: 0.8, risk: 0.3, econ: 0.6, opportunism: 0.3, prodMul: 0.9, decisionDelay: 2, attackThreshold: 2.5 }
  },
  GRE: {
    name: '希腊王国', color: '#4682b4', capital: '雅典',
    civ: 3, mil: 3, equip: 220, law: 'war', warSupport: 80, stability: 65,
    faction: 'allies',
    ai: { aggression: 0.5, expansion: 0.2, loyalty: 0.85, risk: 0.5, econ: 0.5, opportunism: 0.4, prodMul: 1.0, decisionDelay: 2, attackThreshold: 2.2 }
  },
  YUG: {
    name: '南斯拉夫王国', color: '#483d8b', capital: '贝尔格莱德',
    civ: 5, mil: 4, equip: 360, law: 'partial', warSupport: 65, stability: 50,
    faction: 'allies',
    ai: { aggression: 0.4, expansion: 0.2, loyalty: 0.6, risk: 0.5, econ: 0.5, opportunism: 0.6, prodMul: 0.95, decisionDelay: 2, attackThreshold: 2.2 }
  },

  // —— 共产国际 (Comintern) ——
  SOV: {
    name: '苏维埃社会主义共和国联盟', color: '#8b0000', capital: '莫斯科',
    civ: 20, mil: 24, equip: 2500, law: 'war', warSupport: 90, stability: 80,
    faction: 'comintern',
    ai: { aggression: 0.85, expansion: 0.85, loyalty: 0.7, risk: 0.75, econ: 0.8, opportunism: 0.7, prodMul: 1.3, decisionDelay: 1, attackThreshold: 1.6 }
  },

  // —— 中国战场与统一战线 (United Front) ——
  CHN: {
    name: '中华民国', color: '#2a52be', capital: '重庆',
    civ: 10, mil: 9, equip: 900, law: 'war', warSupport: 95, stability: 60,
    faction: 'united_front',
    ai: { aggression: 0.65, expansion: 0.1, loyalty: 0.7, risk: 0.6, econ: 0.5, opportunism: 0.4, prodMul: 1.05, decisionDelay: 1, attackThreshold: 1.8 }
  },
  CCP: {
    name: '中国共产党（延安）', color: '#c8102e', capital: '延安',
    civ: 4, mil: 4, equip: 380, law: 'war', warSupport: 95, stability: 90,
    faction: 'united_front',
    ai: { aggression: 0.7, expansion: 0.3, loyalty: 0.65, risk: 0.65, econ: 0.55, opportunism: 0.5, prodMul: 1.1, decisionDelay: 1, attackThreshold: 1.7 }
  },

  // —— 中立与中东、伊比利亚 ——
  DEN: {
    name: '丹麦王国', color: '#b03060', capital: '哥本哈根',
    civ: 3, mil: 1, equip: 120, law: 'civilian', warSupport: 40, stability: 80,
    faction: 'neutral',
    ai: { aggression: 0.1, expansion: 0.05, loyalty: 0.7, risk: 0.2, econ: 0.6, opportunism: 0.2, prodMul: 0.8, decisionDelay: 3, attackThreshold: 3.0 }
  },
  SWE: {
    name: '瑞典王国', color: '#4169e1', capital: '斯德哥尔摩',
    civ: 6, mil: 4, equip: 350, law: 'partial', warSupport: 50, stability: 85,
    faction: 'neutral',
    ai: { aggression: 0.1, expansion: 0.05, loyalty: 0.6, risk: 0.2, econ: 0.8, opportunism: 0.4, prodMul: 1.0, decisionDelay: 3, attackThreshold: 2.8 }
  },
  SWZ: {
    name: '瑞士联邦', color: '#d2143a', capital: '伯尔尼',
    civ: 4, mil: 3, equip: 260, law: 'partial', warSupport: 70, stability: 90,
    faction: 'neutral',
    ai: { aggression: 0.05, expansion: 0.0, loyalty: 0.5, risk: 0.1, econ: 0.85, opportunism: 0.1, prodMul: 1.0, decisionDelay: 3, attackThreshold: 3.0 }
  },
  SPN: {
    name: '西班牙国', color: '#c9a038', capital: '马德里',
    civ: 6, mil: 4, equip: 340, law: 'partial', warSupport: 50, stability: 50,
    faction: 'neutral',
    ai: { aggression: 0.35, expansion: 0.2, loyalty: 0.5, risk: 0.35, econ: 0.5, opportunism: 0.7, prodMul: 0.9, decisionDelay: 3, attackThreshold: 2.5 }
  },
  POR: {
    name: '葡萄牙共和国', color: '#006600', capital: '里斯本',
    civ: 3, mil: 2, equip: 180, law: 'partial', warSupport: 45, stability: 70,
    faction: 'neutral',
    ai: { aggression: 0.15, expansion: 0.1, loyalty: 0.7, risk: 0.2, econ: 0.6, opportunism: 0.3, prodMul: 0.9, decisionDelay: 3, attackThreshold: 2.8 }
  },
  TUR: {
    name: '土耳其共和国', color: '#ba2b2b', capital: '安卡拉',
    civ: 5, mil: 4, equip: 340, law: 'partial', warSupport: 60, stability: 70,
    faction: 'neutral',
    ai: { aggression: 0.3, expansion: 0.2, loyalty: 0.5, risk: 0.3, econ: 0.6, opportunism: 0.6, prodMul: 0.95, decisionDelay: 3, attackThreshold: 2.5 }
  },
  EGY: {
    name: '埃及王国', color: '#c49a45', capital: '开罗',
    civ: 4, mil: 2, equip: 200, law: 'partial', warSupport: 50, stability: 55,
    faction: 'neutral',
    ai: { aggression: 0.2, expansion: 0.1, loyalty: 0.7, risk: 0.3, econ: 0.5, opportunism: 0.4, prodMul: 0.9, decisionDelay: 3, attackThreshold: 2.5 }
  },
  IRN: {
    name: '伊朗王国', color: '#2e8b57', capital: '德黑兰',
    civ: 4, mil: 3, equip: 250, law: 'partial', warSupport: 55, stability: 60,
    faction: 'neutral',
    ai: { aggression: 0.25, expansion: 0.15, loyalty: 0.5, risk: 0.35, econ: 0.6, opportunism: 0.5, prodMul: 0.9, decisionDelay: 3, attackThreshold: 2.5 }
  },
  IRQ: {
    name: '伊拉克王国', color: '#556b2f', capital: '巴格达',
    civ: 3, mil: 2, equip: 180, law: 'partial', warSupport: 50, stability: 50,
    faction: 'neutral',
    ai: { aggression: 0.3, expansion: 0.2, loyalty: 0.4, risk: 0.4, econ: 0.5, opportunism: 0.6, prodMul: 0.9, decisionDelay: 3, attackThreshold: 2.5 }
  },
  SAU: {
    name: '沙特阿拉伯王国', color: '#1b4d3e', capital: '利雅得',
    civ: 3, mil: 1, equip: 140, law: 'civilian', warSupport: 45, stability: 65,
    faction: 'neutral',
    ai: { aggression: 0.2, expansion: 0.1, loyalty: 0.6, risk: 0.25, econ: 0.55, opportunism: 0.4, prodMul: 0.85, decisionDelay: 3, attackThreshold: 2.8 }
  },
  BRA: {
    name: '巴西合众国', color: '#228b22', capital: '里约热内卢',
    civ: 5, mil: 3, equip: 280, law: 'partial', warSupport: 55, stability: 65,
    faction: 'neutral',
    ai: { aggression: 0.2, expansion: 0.1, loyalty: 0.7, risk: 0.2, econ: 0.6, opportunism: 0.4, prodMul: 0.95, decisionDelay: 3, attackThreshold: 2.5 }
  }
};
