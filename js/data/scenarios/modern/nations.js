/* ============================================================
   data/scenarios/modern/nations.js —— 现代「多极危机 2022」参战国刻画
   数据规范契合 §3.4、§3.10 与 C9（保持视角客观中性）
   ============================================================ */

export const MODERN_NATIONS = {
  RUS: {
    name: '俄罗斯联邦', color: '#8b263e', capital: '莫斯科',
    civ: 22, mil: 25, equip: 3200, law: 'wartime', warSupport: 80, stability: 70,
    faction: 'east_bloc', prestige: 60,
    ai: { aggression: 0.75, expansion: 0.65, loyalty: 0.6, risk: 0.65, econ: 0.75, opportunism: 0.6, prodMul: 1.25, decisionDelay: 1, attackThreshold: 1.8 }
  },
  UKR: {
    name: '乌克兰', color: '#d8b74f', capital: '基辅',
    civ: 10, mil: 12, equip: 1400, law: 'wartime', warSupport: 95, stability: 70,
    faction: 'west_aligned', prestige: 85,
    ai: { aggression: 0.45, expansion: 0.1, loyalty: 0.9, risk: 0.55, econ: 0.4, opportunism: 0.3, prodMul: 1.05, decisionDelay: 1, attackThreshold: 2.0 }
  },
  USA: {
    name: '美利坚合众国', color: '#2e5b88', capital: '华盛顿',
    civ: 35, mil: 25, equip: 4000, law: 'civilian', warSupport: 60, stability: 75,
    faction: 'nato', prestige: 85,
    ai: { aggression: 0.4, expansion: 0.15, loyalty: 0.9, risk: 0.35, econ: 0.98, opportunism: 0.5, prodMul: 1.35, decisionDelay: 1, attackThreshold: 2.2 }
  },
  GBR: {
    name: '大不列颠及北爱尔兰联合王国', color: '#b22222', capital: '伦敦',
    civ: 16, mil: 12, equip: 1500, law: 'civilian', warSupport: 65, stability: 70,
    faction: 'nato', prestige: 75,
    ai: { aggression: 0.45, expansion: 0.15, loyalty: 0.85, risk: 0.4, econ: 0.8, opportunism: 0.7, prodMul: 1.05, decisionDelay: 1, attackThreshold: 2.2 }
  },
  GER: {
    name: '德意志联邦共和国', color: '#333333', capital: '柏林',
    civ: 22, mil: 10, equip: 1200, law: 'civilian', warSupport: 50, stability: 75,
    faction: 'nato', prestige: 80,
    ai: { aggression: 0.2, expansion: 0.05, loyalty: 0.85, risk: 0.25, econ: 0.92, opportunism: 0.3, prodMul: 1.1, decisionDelay: 2, attackThreshold: 2.8 }
  },
  FRA: {
    name: '法兰西共和国', color: '#1e3f66', capital: '巴黎',
    civ: 18, mil: 12, equip: 1400, law: 'civilian', warSupport: 55, stability: 65,
    faction: 'nato', prestige: 80,
    ai: { aggression: 0.3, expansion: 0.1, loyalty: 0.8, risk: 0.35, econ: 0.85, opportunism: 0.5, prodMul: 1.05, decisionDelay: 2, attackThreshold: 2.5 }
  },
  POL: {
    name: '波兰共和国', color: '#b83b5e', capital: '华沙',
    civ: 12, mil: 12, equip: 1200, law: 'partial', warSupport: 85, stability: 80,
    faction: 'nato', prestige: 75,
    ai: { aggression: 0.5, expansion: 0.15, loyalty: 0.95, risk: 0.5, econ: 0.75, opportunism: 0.4, prodMul: 1.1, decisionDelay: 1, attackThreshold: 2.0 }
  },
  JPN: {
    name: '日本国', color: '#c4302b', capital: '东京',
    civ: 25, mil: 12, equip: 1600, law: 'civilian', warSupport: 45, stability: 85,
    faction: 'west_aligned', prestige: 80,
    ai: { aggression: 0.2, expansion: 0.05, loyalty: 0.9, risk: 0.2, econ: 0.95, opportunism: 0.3, prodMul: 1.15, decisionDelay: 2, attackThreshold: 2.8 }
  },
  IRN: {
    name: '伊朗伊斯兰共和国', color: '#2e8b57', capital: '德黑兰',
    civ: 12, mil: 14, equip: 1500, law: 'wartime', warSupport: 80, stability: 60,
    faction: 'resistance_axis', prestige: 55,
    ai: { aggression: 0.65, expansion: 0.4, loyalty: 0.6, risk: 0.65, econ: 0.65, opportunism: 0.7, prodMul: 1.05, decisionDelay: 1, attackThreshold: 1.9 }
  },
  ISR: {
    name: '以色列国', color: '#4682b4', capital: '特拉维夫',
    civ: 10, mil: 12, equip: 1300, law: 'wartime', warSupport: 90, stability: 70,
    faction: 'west_aligned', prestige: 70,
    ai: { aggression: 0.7, expansion: 0.35, loyalty: 0.85, risk: 0.6, econ: 0.85, opportunism: 0.5, prodMul: 1.15, decisionDelay: 1, attackThreshold: 1.8 }
  },
  CHN: {
    name: '中华人民共和国', color: '#c41230', capital: '北京',
    civ: 38, mil: 28, equip: 3800, law: 'civilian', warSupport: 85, stability: 90,
    faction: 'multipolar', prestige: 85,
    ai: { aggression: 0.35, expansion: 0.15, loyalty: 0.6, risk: 0.35, econ: 0.98, opportunism: 0.5, prodMul: 1.4, decisionDelay: 1, attackThreshold: 2.2 }
  },
  BLR: {
    name: '白俄罗斯共和国', color: '#4a704a', capital: '明斯克',
    civ: 6, mil: 6, equip: 600, law: 'partial', warSupport: 70, stability: 70,
    faction: 'east_bloc', prestige: 45,
    ai: { aggression: 0.3, expansion: 0.05, loyalty: 0.95, risk: 0.3, econ: 0.6, opportunism: 0.2, prodMul: 0.95, decisionDelay: 2, attackThreshold: 2.5 }
  },
  SAU: {
    name: '沙特阿拉伯王国', color: '#1b4d3e', capital: '利雅得',
    civ: 14, mil: 8, equip: 900, law: 'civilian', warSupport: 50, stability: 75,
    faction: 'multipolar', prestige: 70,
    ai: { aggression: 0.25, expansion: 0.1, loyalty: 0.6, risk: 0.3, econ: 0.88, opportunism: 0.6, prodMul: 1.0, decisionDelay: 2, attackThreshold: 2.6 }
  },
  PRK: {
    name: '朝鲜民主主义人民共和国', color: '#900c3f', capital: '平壤',
    civ: 6, mil: 10, equip: 900, law: 'wartime', warSupport: 95, stability: 85,
    faction: 'east_bloc', prestige: 40,
    ai: { aggression: 0.65, expansion: 0.2, loyalty: 0.75, risk: 0.7, econ: 0.45, opportunism: 0.6, prodMul: 1.0, decisionDelay: 1, attackThreshold: 1.8 }
  },
  KOR: {
    name: '大韩民国', color: '#2b5876', capital: '首尔',
    civ: 18, mil: 12, equip: 1400, law: 'civilian', warSupport: 65, stability: 80,
    faction: 'west_aligned', prestige: 75,
    ai: { aggression: 0.3, expansion: 0.05, loyalty: 0.9, risk: 0.3, econ: 0.92, opportunism: 0.3, prodMul: 1.15, decisionDelay: 2, attackThreshold: 2.5 }
  }
};
