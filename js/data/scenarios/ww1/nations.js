/* ============================================================
   data/scenarios/ww1/nations.js —— 一战 20 国定义（v3.0 附录 C）
   ============================================================ */

export const WW1_NATIONS = {
  // —— 同盟国阵营 ——
  GER: {
    id:'GER', name:'德意志帝国', color:'#45546b', civ:12, mil:15, equip:1300,
    law:'war', warSupport:85, stability:80,
    ai:{ aggression:0.85, expansion:0.8, loyalty:0.8, risk:0.7, econ:0.8, opportunism:0.5, prodMul:1.0, decisionDelay:2, attackThreshold:1.9 },
    focusPriority:['schlieffen_plan','krupp_works','trench_doctrine','hindenburg_program']
  },
  AUS: {
    id:'AUS', name:'奥匈帝国', color:'#a6904f', civ:8, mil:8, equip:700,
    law:'partial', warSupport:65, stability:52,
    ai:{ aggression:0.65, expansion:0.6, loyalty:0.9, risk:0.6, econ:0.6, opportunism:0.4, prodMul:0.9, decisionDelay:2, attackThreshold:2.2 },
    focusPriority:['punish_serbia','skoda_heavy_guns','carpathian_defense']
  },
  OTT: {
    id:'OTT', name:'奥斯曼帝国', color:'#9c473a', civ:4, mil:5, equip:450,
    law:'partial', warSupport:60, stability:50,
    ai:{ aggression:0.6, expansion:0.5, loyalty:0.7, risk:0.65, econ:0.4, opportunism:0.6, prodMul:0.85, decisionDelay:3, attackThreshold:2.3 },
    focusPriority:['jihad_declaration','straits_forts','anatolia_mobilize']
  },
  BUL: {
    id:'BUL', name:'保加利亚王国', color:'#4b8058', civ:3, mil:4, equip:350,
    law:'war', warSupport:75, stability:70,
    ai:{ aggression:0.75, expansion:0.75, loyalty:0.6, risk:0.6, econ:0.5, opportunism:0.8, prodMul:0.9, decisionDelay:3, attackThreshold:2.0 },
    focusPriority:['macedonia_claims','balkan_revenge']
  },

  // —— 协约国阵营 ——
  FRA: {
    id:'FRA', name:'法兰西第三共和国', color:'#3c6a8f', civ:10, mil:12, equip:1100,
    law:'war', warSupport:82, stability:76,
    ai:{ aggression:0.7, expansion:0.4, loyalty:0.9, risk:0.5, econ:0.75, opportunism:0.3, prodMul:1.0, decisionDelay:2, attackThreshold:2.1 },
    focusPriority:['sacred_union','plan_xvii','creusot_artillery','taxi_mobilize']
  },
  RUS: {
    id:'RUS', name:'俄罗斯帝国', color:'#8c3535', civ:11, mil:10, equip:1200,
    law:'partial', warSupport:70, stability:48,
    ai:{ aggression:0.8, expansion:0.7, loyalty:0.8, risk:0.7, econ:0.6, opportunism:0.4, prodMul:1.0, decisionDelay:2, attackThreshold:2.1 },
    focusPriority:['slavic_protector','galicia_offensive','petrograd_munition']
  },
  GBR: {
    id:'GBR', name:'大英帝国', color:'#784343', civ:14, mil:11, equip:1000,
    law:'partial', warSupport:75, stability:85,
    ai:{ aggression:0.6, expansion:0.5, loyalty:0.95, risk:0.4, econ:0.9, opportunism:0.4, prodMul:1.0, decisionDelay:2, attackThreshold:2.2 },
    focusPriority:['blockade_germany','kitchener_army','vickers_maxim']
  },
  SRB: {
    id:'SRB', name:'塞尔维亚王国', color:'#6d4396', civ:2, mil:3, equip:300,
    law:'total', warSupport:92, stability:82,
    ai:{ aggression:0.7, expansion:0.6, loyalty:0.9, risk:0.5, econ:0.4, opportunism:0.2, prodMul:1.0, decisionDelay:2, attackThreshold:2.3 },
    focusPriority:['cer_mountain_stand','national_salvation']
  },
  BEL: {
    id:'BEL', name:'比利时王国', color:'#857c4c', civ:4, mil:3, equip:350,
    law:'total', warSupport:88, stability:80,
    ai:{ aggression:0.3, expansion:0.1, loyalty:0.95, risk:0.3, econ:0.6, opportunism:0.1, prodMul:0.9, decisionDelay:3, attackThreshold:3.0 },
    focusPriority:['liege_forts','king_albert_resistance']
  },
  ROM: {
    id:'ROM', name:'罗马尼亚王国', color:'#9c723c', civ:3, mil:3, equip:280,
    law:'partial', warSupport:60, stability:62,
    ai:{ aggression:0.5, expansion:0.7, loyalty:0.5, risk:0.6, econ:0.5, opportunism:0.85, prodMul:0.85, decisionDelay:3, attackThreshold:2.4 },
    focusPriority:['transylvania_pledge','ploiesti_oil_security']
  },
  GRE: {
    id:'GRE', name:'希腊王国', color:'#457796', civ:3, mil:2, equip:220,
    law:'partial', warSupport:52, stability:58,
    ai:{ aggression:0.4, expansion:0.6, loyalty:0.6, risk:0.5, econ:0.4, opportunism:0.7, prodMul:0.8, decisionDelay:3, attackThreshold:2.5 },
    focusPriority:['salonica_front','national_schism_resolution']
  },
  ITA: {
    id:'ITA', name:'意大利王国', color:'#417348', civ:7, mil:6, equip:550,
    law:'partial', warSupport:55, stability:60,
    ai:{ aggression:0.6, expansion:0.7, loyalty:0.3, risk:0.6, econ:0.6, opportunism:0.9, prodMul:0.9, decisionDelay:2, attackThreshold:2.2 },
    focusPriority:['london_pact','isonzo_offensives','alpine_warfare']
  },
  MNE: {
    id:'MNE', name:'黑山王国', color:'#664235', civ:1, mil:1, equip:120,
    law:'total', warSupport:86, stability:80,
    ai:{ aggression:0.5, expansion:0.3, loyalty:0.9, risk:0.5, econ:0.3, opportunism:0.2, prodMul:0.8, decisionDelay:4, attackThreshold:2.8 },
    focusPriority:['brotherly_aid']
  },
  POR: {
    id:'POR', name:'葡萄牙共和国', color:'#456b4f', civ:2, mil:1, equip:150,
    law:'civilian', warSupport:40, stability:55,
    ai:{ aggression:0.2, expansion:0.1, loyalty:0.9, risk:0.3, econ:0.4, opportunism:0.3, prodMul:0.8, decisionDelay:4, attackThreshold:3.0 },
    focusPriority:['angola_defense']
  },
  USA: {
    id:'USA', name:'美利坚合众国', color:'#42597d', civ:18, mil:8, equip:900,
    law:'civilian', warSupport:32, stability:92,
    ai:{ aggression:0.3, expansion:0.1, loyalty:0.8, risk:0.3, econ:0.95, opportunism:0.3, prodMul:1.0, decisionDelay:3, attackThreshold:2.4 },
    focusPriority:['strict_neutrality','liberty_loans','doughboys_arrival']
  },

  // —— 中立国 ——
  NLD: {
    id:'NLD', name:'荷兰王国', color:'#9c633a', civ:5, mil:2, equip:220,
    law:'civilian', warSupport:30, stability:85,
    ai:{ aggression:0.1, expansion:0.0, loyalty:0.5, risk:0.1, econ:0.8, opportunism:0.2, prodMul:0.8, decisionDelay:99, attackThreshold:99 },
    focusPriority:['armed_neutrality']
  },
  SWZ: {
    id:'SWZ', name:'瑞士联邦', color:'#823434', civ:4, mil:2, equip:200,
    law:'civilian', warSupport:30, stability:95,
    ai:{ aggression:0.1, expansion:0.0, loyalty:0.5, risk:0.1, econ:0.8, opportunism:0.1, prodMul:0.8, decisionDelay:99, attackThreshold:99 },
    focusPriority:['alpine_redoubt']
  },
  SWE: {
    id:'SWE', name:'瑞典王国', color:'#3e5778', civ:5, mil:2, equip:200,
    law:'civilian', warSupport:30, stability:90,
    ai:{ aggression:0.1, expansion:0.0, loyalty:0.5, risk:0.1, econ:0.8, opportunism:0.3, prodMul:0.8, decisionDelay:99, attackThreshold:99 },
    focusPriority:['iron_ore_trade']
  },
  DNK: {
    id:'DNK', name:'丹麦王国', color:'#803838', civ:3, mil:1, equip:150,
    law:'civilian', warSupport:30, stability:90,
    ai:{ aggression:0.1, expansion:0.0, loyalty:0.5, risk:0.1, econ:0.7, opportunism:0.2, prodMul:0.8, decisionDelay:99, attackThreshold:99 },
    focusPriority:['baltic_neutrality']
  },
  ESP: {
    id:'ESP', name:'西班牙王国', color:'#9c793a', civ:4, mil:2, equip:200,
    law:'civilian', warSupport:30, stability:70,
    ai:{ aggression:0.1, expansion:0.0, loyalty:0.5, risk:0.1, econ:0.6, opportunism:0.4, prodMul:0.8, decisionDelay:99, attackThreshold:99 },
    focusPriority:['internal_stability']
  }
};
