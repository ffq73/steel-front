/* ============================================================
   ui/portraitMap.js —— v7.0 领袖肖像与终局画卷映射
   资产路径：assets/portraits/leaders/<id>.png（缺失自动回退程序化徽章）
   AAR 背景复用 assets/events/ 下的历史事件插画
   ============================================================ */

export const PORTRAIT_MAP = {
  // —— 一战 ——
  'GER_WW1': 'wilhelm2', 'FRA_WW1': 'poincare', 'GBR_WW1': 'george_v',
  'RUS_WW1': 'nicholas_ii', 'AUS_WW1': 'franz_joseph', 'OTT_WW1': 'enver_pasha',
  'ITA_WW1': 'emmanuel_iii',
  // —— 二战 ——
  'GER_WW2': 'hitler', 'SOV_WW2': 'stalin', 'GBR_WW2': 'churchill',
  'FRA_WW2': 'petain', 'USA_WW2': 'roosevelt', 'JPN_WW2': 'tojo',
  'ITA_WW2': 'mussolini', 'POL_WW2': 'sikorski', 'CHN_WW2': 'chiang',
  // —— 冷战 ——
  'USA_CW': 'truman', 'SOV_CW': 'stalin', 'GBR_CW': 'attlee',
  'FRA_CW': 'degaulle', 'CHN_CW': 'mao',
  // —— 现代 ——
  'RUS_MOD': 'putin', 'UKR_MOD': 'zelensky', 'USA_MOD': 'biden', 'GBR_MOD': 'sunak',
  'FRA_MOD': 'macron', 'GER_MOD': 'scholz', 'POL_MOD': 'duda', 'JPN_MOD': 'kishida',
  'IRN_MOD': 'khamenei', 'ISR_MOD': 'netanyahu',
  // —— 虚构人物 [F]（缺图自动回退为姓名徽章）——
  'RUS_MOD_F': 'ge_xiufu', 'JPN_MOD_F': 'ji_aixi', 'USA_MOD_F': 'xiao_lu', 'GBR_MOD_F': 'wang_ruoyi'
};

/* 终局画卷：按剧本氛围选取历史事件插画 */
export const AAR_ART = {
  ww1:     { win: 'marne.jpg',       lose: 'final_reckoning.jpg', nuke: 'final_reckoning.jpg' },
  ww2:     { win: 'dday.jpg',        lose: 'final_reckoning.jpg', nuke: 'final_reckoning.jpg' },
  A:       { win: 'dday.jpg',        lose: 'final_reckoning.jpg', nuke: 'final_reckoning.jpg' },
  coldwar: { win: 'apollo.jpg',      lose: 'final_reckoning.jpg', nuke: 'cuban_crisis.jpg' },
  modern:  { win: 'kerch_bridge.jpg', lose: 'final_reckoning.jpg', nuke: 'final_reckoning.jpg' }
};

export function aarBackground(scenarioId, win){
  const set = AAR_ART[scenarioId] || AAR_ART.ww2;
  return 'assets/events/' + (win ? set.win : set.lose);
}
