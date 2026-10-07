/* ============================================================
   data/scenarios/ww1/battalions.js —— 1914 堑壕战时代营级编制表 (v5.0 §2.1 / E1)
   ============================================================ */

export const WW1_BATTALIONS = {
  ww1_trench_inf: {
    id: 'ww1_trench_inf', name: '堑壕步兵营', icon: '🪖',
    width: 2, manpower: 1000,
    softAtk: 5, hardAtk: 1, defense: 26, breakthrough: 2, org: 55, armor: 0,
    equip: { gewehr_98: 100 }
  },
  ww1_mg_bat: {
    id: 'ww1_mg_bat', name: '密集机枪营', icon: '🔫',
    width: 1, manpower: 400,
    softAtk: 16, hardAtk: 1, defense: 32, breakthrough: 1, org: 20, armor: 0,
    equip: { maxim_mg: 36 }
  },
  ww1_art_bat: {
    id: 'ww1_art_bat', name: '野战炮兵营', icon: '💥',
    width: 3, manpower: 600,
    softAtk: 26, hardAtk: 2, defense: 10, breakthrough: 2, org: 0, armor: 0,
    equip: { french_75: 24 }
  },
  ww1_heavy_art: {
    id: 'ww1_heavy_art', name: '军级重炮营', icon: '🎯',
    width: 3, manpower: 800,
    softAtk: 42, hardAtk: 6, defense: 8, breakthrough: 4, org: 0, armor: 0,
    equip: { big_bertha: 12 }
  },
  ww1_cav_bat: {
    id: 'ww1_cav_bat', name: '帝国骑兵营', icon: '🐎',
    width: 2, manpower: 800,
    softAtk: 7, hardAtk: 1, defense: 14, breakthrough: 4, org: 45, armor: 0,
    equip: { gewehr_98: 80 }
  },
  ww1_storm_bat: {
    id: 'ww1_storm_bat', name: '风暴突击营', icon: '⚡',
    width: 2, manpower: 800,
    softAtk: 18, hardAtk: 4, defense: 14, breakthrough: 28, org: 60, armor: 0.10,
    equip: { gewehr_98: 80, stielhandgranate: 50, flammenwerfer: 12 }
  },
  ww1_tank_bat: {
    id: 'ww1_tank_bat', name: '早期重装甲营', icon: '🛡️',
    width: 2, manpower: 400,
    softAtk: 16, hardAtk: 12, defense: 12, breakthrough: 24, org: 15, armor: 0.45,
    equip: { mark_tank: 25 }
  },
  ww1_mortar_bat: {
    id: 'ww1_mortar_bat', name: '战壕迫击炮营', icon: '💣',
    width: 1, manpower: 300,
    softAtk: 14, hardAtk: 1, defense: 12, breakthrough: 2, org: 10, armor: 0,
    equip: { trench_mortar: 24 }
  }
};

export const WW1_SUPPORT_COMPANIES = {
  ww1_sup_eng: {
    id: 'ww1_sup_eng', name: '坑道工兵连', icon: '⛏️',
    width: 0, manpower: 300,
    softAtk: 0, hardAtk: 0, defense: 8, breakthrough: 1, org: 0, armor: 0,
    entrenchMax: 0.10,
    equip: { stielhandgranate: 20 }
  },
  ww1_sup_gas: {
    id: 'ww1_sup_gas', name: '化学毒气连', icon: '☠️',
    width: 0, manpower: 250,
    softAtk: 14, hardAtk: 0, defense: 2, breakthrough: 6, org: 0, armor: 0,
    equip: { poison_gas: 20 }
  },
  ww1_sup_recon: {
    id: 'ww1_sup_recon', name: '系留气球与侦察骑兵连', icon: '🎈',
    width: 0, manpower: 200,
    softAtk: 1, hardAtk: 0, defense: 2, breakthrough: 2, org: 0, armor: 0,
    recon: 2,
    equip: { fokker_dr1: 6 }
  },
  ww1_sup_med: {
    id: 'ww1_sup_med', name: '战地包扎所', icon: '💉',
    width: 0, manpower: 300,
    softAtk: 0, hardAtk: 0, defense: 2, breakthrough: 0, org: 0, armor: 0,
    trickleback: 0.15
  },
  ww1_sup_log: {
    id: 'ww1_sup_log', name: '野战窄轨铁路连', icon: '🚂',
    width: 0, manpower: 400,
    softAtk: 0, hardAtk: 0, defense: 1, breakthrough: 0, org: 0, armor: 0,
    supplyUse: -0.25
  }
};
