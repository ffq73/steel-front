/* ============================================================
   data/scenarios/modern/characters.js —— 现代「多极危机 2022」45 位领袖与将领
   严格遵循 C9（真实领导人职务+决策客观中性）与 C10（四位原创人物带 [F] 标记）
   ============================================================ */

export const MODERN_CHARACTERS = [
  // ================= 四位原创人物 [F] (§6) =================
  {
    id: 'ge_xiufu',
    name: '葛修傅 [F]',
    nat: 'RUS',
    type: 'leader',
    era: 'modern',
    fictional: true,
    bio: '[F] 62岁，伏尔加河畔坦克厂总工程师出身的民选议员，“炉火阵线”运动创始人。',
    traits: [
      { stat: 'milOutput', value: 0.25 },
      { stat: 'stability', value: -5 },
      { stat: 'attack', value: 0.15 }
    ],
    portrait: 'assets/portraits/characters/ge_xiufu.png',
    ai: { aggression: 0.8, risk: 0.7, econ: 0.9, loyalty: 0.3 }
  },
  {
    id: 'yoshi_aixi',
    name: '吉爱习 [F]',
    nat: 'JPN',
    type: 'leader',
    era: 'modern',
    fictional: true,
    bio: '[F] 58岁，前海上自卫官，民族主义政党“旭日会”党魁，主张“正常国家化与强大自卫力量”。',
    traits: [
      { stat: 'milOutput', value: 0.15 },
      { stat: 'attack', value: 0.10 },
      { stat: 'prestige', value: -25 }
    ],
    portrait: 'assets/portraits/characters/yoshi_aixi.png',
    ai: { aggression: 0.75, expansion: 0.8, loyalty: 0.2 }
  },
  {
    id: 'xiao_lu',
    name: '小鹿 [F]',
    nat: 'USA',
    type: 'leader',
    era: 'modern',
    fictional: true,
    bio: '[F] 54岁，无党派技术官僚，前美联储理事、两任州长。信奉“务实交易高于意识形态”。',
    traits: [
      { stat: 'civOutput', value: 0.10 },
      { stat: 'stability', value: 15 },
      { stat: 'plan_speed', value: 0.20 }
    ],
    portrait: 'assets/portraits/characters/xiao_lu.png',
    ai: { interventionism: 0.5, dealmaking: 0.9 }
  },
  {
    id: 'wang_ruoyi',
    name: '王若伊 [F]',
    nat: 'GBR',
    type: 'leader',
    era: 'modern',
    fictional: true,
    bio: '[F] 60岁，外交世家影子外交大臣，人称“白厅的灰色主教”，长于双面平衡下注。',
    traits: [
      { stat: 'prestige', value: 15 },
      { stat: 'plan_speed', value: 0.25 }
    ],
    portrait: 'assets/portraits/characters/wang_ruoyi.png',
    ai: { deception: 0.95, loyalty: 0.1, opportunism: 0.9 }
  },

  // ================= 41 位真实历史与在任人物 (中性刻画) =================
  // --- 俄罗斯联邦 (6) ---
  { id: 'putin', name: '弗拉基米尔·普京', nat: 'RUS', type: 'leader', era: 'modern', fictional: false,
    traits: [ { stat: 'stability', value: 15 }, { stat: 'warSupport', value: 20 } ], portrait: 'assets/portraits/leaders/putin.png' },
  { id: 'shoigu', name: '谢尔盖·绍伊古', nat: 'RUS', type: 'advisor', era: 'modern', fictional: false,
    traits: [ { stat: 'milOutput', value: 0.15 } ], portrait: 'assets/portraits/generals/shoigu.png' },
  { id: 'gerasimov', name: '瓦列里·格拉西莫夫', nat: 'RUS', type: 'general', era: 'modern', fictional: false,
    traits: [ { stat: 'plan_speed', value: 0.2 }, { stat: 'defense', value: 0.15 } ], portrait: 'assets/portraits/generals/gerasimov.png' },
  { id: 'surovikin', name: '谢尔盖·苏罗维金', nat: 'RUS', type: 'general', era: 'modern', fictional: false,
    traits: [ { stat: 'defense', value: 0.35 }, { stat: 'org_recovery', value: 0.15 } ], portrait: 'assets/portraits/generals/surovikin.png' },
  { id: 'teplinsky', name: '米哈伊尔·捷普林斯基', nat: 'RUS', type: 'general', era: 'modern', fictional: false,
    traits: [ { stat: 'attack', value: 0.2 }, { stat: 'speed', value: 0.2 } ], portrait: 'assets/portraits/generals/teplinsky.png' },
  { id: 'lavrov', name: '谢尔盖·拉夫罗夫', nat: 'RUS', type: 'advisor', era: 'modern', fictional: false,
    traits: [ { stat: 'prestige', value: 15 } ], portrait: 'assets/portraits/advisors/lavrov.png' },

  // --- 乌克兰 (5) ---
  { id: 'zelensky', name: '弗拉基米尔·泽连斯基', nat: 'UKR', type: 'leader', era: 'modern', fictional: false,
    traits: [ { stat: 'stability', value: 25 }, { stat: 'warSupport', value: 30 } ], portrait: 'assets/portraits/leaders/zelensky.png' },
  { id: 'zaluzhnyi', name: '瓦列里·扎卢日内', nat: 'UKR', type: 'general', era: 'modern', fictional: false,
    traits: [ { stat: 'defense', value: 0.3 }, { stat: 'plan_speed', value: 0.2 } ], portrait: 'assets/portraits/generals/zaluzhnyi.png' },
  { id: 'syrskyi', name: '亚历山大·瑟尔斯基', nat: 'UKR', type: 'general', era: 'modern', fictional: false,
    traits: [ { stat: 'attack', value: 0.25 }, { stat: 'speed', value: 0.25 } ], portrait: 'assets/portraits/generals/syrskyi.png' },
  { id: 'budanov', name: '基里洛·布达诺夫', nat: 'UKR', type: 'advisor', era: 'modern', fictional: false,
    traits: [ { stat: 'plan_speed', value: 0.3 } ], portrait: 'assets/portraits/generals/budanov.png' },
  { id: 'kuleba', name: '德米特罗·库列巴', nat: 'UKR', type: 'advisor', era: 'modern', fictional: false,
    traits: [ { stat: 'prestige', value: 20 } ], portrait: 'assets/portraits/advisors/kuleba.png' },

  // --- 美国 (5) ---
  { id: 'biden', name: '乔·拜登', nat: 'USA', type: 'leader', era: 'modern', fictional: false,
    traits: [ { stat: 'stability', value: 10 }, { stat: 'prestige', value: 15 } ], portrait: 'assets/portraits/leaders/biden.png' },
  { id: 'austin', name: '劳埃德·奥斯汀', nat: 'USA', type: 'advisor', era: 'modern', fictional: false,
    traits: [ { stat: 'milOutput', value: 0.2 } ], portrait: 'assets/portraits/generals/austin.png' },
  { id: 'milley', name: '马克·米利', nat: 'USA', type: 'general', era: 'modern', fictional: false,
    traits: [ { stat: 'defense', value: 0.2 }, { stat: 'plan_speed', value: 0.2 } ], portrait: 'assets/portraits/generals/milley.png' },
  { id: 'blinken', name: '安东尼·布林肯', nat: 'USA', type: 'advisor', era: 'modern', fictional: false,
    traits: [ { stat: 'prestige', value: 20 } ], portrait: 'assets/portraits/advisors/blinken.png' },
  { id: 'cavoli', name: '克里斯托弗·卡沃利', nat: 'USA', type: 'general', era: 'modern', fictional: false,
    traits: [ { stat: 'plan_speed', value: 0.25 } ], portrait: 'assets/portraits/generals/cavoli.png' },

  // --- 英国、法国、德国、波兰 (8) ---
  { id: 'sunak', name: '里希·苏纳克', nat: 'GBR', type: 'leader', era: 'modern', fictional: false,
    traits: [ { stat: 'civOutput', value: 0.1 } ], portrait: 'assets/portraits/leaders/sunak.png' },
  { id: 'radakin', name: '托尼·拉达金', nat: 'GBR', type: 'general', era: 'modern', fictional: false,
    traits: [ { stat: 'plan_speed', value: 0.2 } ], portrait: 'assets/portraits/generals/radakin.png' },
  { id: 'macron', name: '埃马纽埃尔·马克龙', nat: 'FRA', type: 'leader', era: 'modern', fictional: false,
    traits: [ { stat: 'prestige', value: 15 } ], portrait: 'assets/portraits/leaders/macron.png' },
  { id: 'burkhard', name: '蒂埃里·布克哈德', nat: 'FRA', type: 'general', era: 'modern', fictional: false,
    traits: [ { stat: 'attack', value: 0.15 } ], portrait: 'assets/portraits/generals/burkhard.png' },
  { id: 'scholz', name: '奥拉夫·朔尔茨', nat: 'GER', type: 'leader', era: 'modern', fictional: false,
    traits: [ { stat: 'stability', value: 15 } ], portrait: 'assets/portraits/leaders/scholz.png' },
  { id: 'pistorius', name: '鲍里斯·皮斯托利斯', nat: 'GER', type: 'advisor', era: 'modern', fictional: false,
    traits: [ { stat: 'milOutput', value: 0.2 } ], portrait: 'assets/portraits/advisors/pistorius.png' },
  { id: 'duda', name: '安杰伊·杜达', nat: 'POL', type: 'leader', era: 'modern', fictional: false,
    traits: [ { stat: 'warSupport', value: 20 } ], portrait: 'assets/portraits/leaders/duda.png' },
  { id: 'kukulka', name: '维斯瓦夫·库库瓦', nat: 'POL', type: 'general', era: 'modern', fictional: false,
    traits: [ { stat: 'defense', value: 0.25 } ], portrait: 'assets/portraits/generals/kukulka.png' },

  // --- 中东核心 (伊朗、以色列、沙特 - 8) ---
  { id: 'khamenei', name: '阿里·哈梅内伊', nat: 'IRN', type: 'leader', era: 'modern', fictional: false,
    traits: [ { stat: 'warSupport', value: 25 }, { stat: 'stability', value: 20 } ], portrait: 'assets/portraits/leaders/khamenei.png' },
  { id: 'salami', name: '侯赛因·萨拉米', nat: 'IRN', type: 'general', era: 'modern', fictional: false,
    traits: [ { stat: 'attack', value: 0.2 }, { stat: 'speed', value: 0.2 } ], portrait: 'assets/portraits/generals/salami.png' },
  { id: 'qaani', name: '伊斯梅尔·卡阿尼', nat: 'IRN', type: 'general', era: 'modern', fictional: false,
    traits: [ { stat: 'plan_speed', value: 0.25 } ], portrait: 'assets/portraits/generals/qaani.png' },
  { id: 'netanyahu', name: '本雅明·内塔尼亚胡', nat: 'ISR', type: 'leader', era: 'modern', fictional: false,
    traits: [ { stat: 'warSupport', value: 25 }, { stat: 'attack', value: 0.15 } ], portrait: 'assets/portraits/leaders/netanyahu.png' },
  { id: 'halevi', name: '赫齐·哈莱维', nat: 'ISR', type: 'general', era: 'modern', fictional: false,
    traits: [ { stat: 'attack', value: 0.25 }, { stat: 'plan_speed', value: 0.2 } ], portrait: 'assets/portraits/generals/halevi.png' },
  { id: 'barnea', name: '戴维·巴尼亚', nat: 'ISR', type: 'advisor', era: 'modern', fictional: false,
    traits: [ { stat: 'plan_speed', value: 0.3 } ], portrait: 'assets/portraits/advisors/barnea.png' },
  { id: 'mbs', name: '穆罕默德·本·萨勒曼', nat: 'SAU', type: 'leader', era: 'modern', fictional: false,
    traits: [ { stat: 'civOutput', value: 0.25 }, { stat: 'prestige', value: 20 } ], portrait: 'assets/portraits/leaders/mbs.png' },
  { id: 'ruwaili', name: '法耶兹·鲁瓦伊利', nat: 'SAU', type: 'general', era: 'modern', fictional: false,
    traits: [ { stat: 'defense', value: 0.15 } ], portrait: 'assets/portraits/generals/ruwaili.png' },

  // --- 亚太与周边 (中国、白俄、朝鲜、韩国、日本史实 - 9) ---
  { id: 'kishida', name: '岸田文雄', nat: 'JPN', type: 'leader', era: 'modern', fictional: false,
    traits: [ { stat: 'stability', value: 15 } ], portrait: 'assets/portraits/leaders/kishida.png' },
  { id: 'yoshida', name: '吉田圭秀', nat: 'JPN', type: 'general', era: 'modern', fictional: false,
    traits: [ { stat: 'defense', value: 0.2 } ], portrait: 'assets/portraits/generals/yoshida.png' },
  { id: 'lukashenko', name: '亚历山大·卢卡申科', nat: 'BLR', type: 'leader', era: 'modern', fictional: false,
    traits: [ { stat: 'stability', value: 20 } ], portrait: 'assets/portraits/leaders/lukashenko.png' },
  { id: 'kim_jong_un', name: '金正恩', nat: 'PRK', type: 'leader', era: 'modern', fictional: false,
    traits: [ { stat: 'warSupport', value: 30 }, { stat: 'defense', value: 0.2 } ], portrait: 'assets/portraits/leaders/kim_jong_un.png' },
  { id: 'yoon', name: '尹锡悦', nat: 'KOR', type: 'leader', era: 'modern', fictional: false,
    traits: [ { stat: 'warSupport', value: 15 } ], portrait: 'assets/portraits/leaders/yoon.png' },
  { id: 'chn_leader_m', name: '国家战略统筹委员会', nat: 'CHN', type: 'leader', era: 'modern', fictional: false,
    traits: [ { stat: 'stability', value: 30 }, { stat: 'civOutput', value: 0.2 } ], portrait: 'assets/portraits/leaders/chn_leader.png' },
  { id: 'chn_general_m1', name: '东部战区联合指挥部', nat: 'CHN', type: 'general', era: 'modern', fictional: false,
    traits: [ { stat: 'attack', value: 0.25 }, { stat: 'defense', value: 0.25 } ], portrait: 'assets/portraits/generals/chn_joint.png' },
  { id: 'chn_general_m2', name: '南部战区联合指挥部', nat: 'CHN', type: 'general', era: 'modern', fictional: false,
    traits: [ { stat: 'speed', value: 0.25 }, { stat: 'plan_speed', value: 0.2 } ], portrait: 'assets/portraits/generals/chn_joint2.png' },
  { id: 'chn_advisor_m', name: '国家发展与改革委员会', nat: 'CHN', type: 'advisor', era: 'modern', fictional: false,
    traits: [ { stat: 'civOutput', value: 0.25 }, { stat: 'prestige', value: 20 } ], portrait: 'assets/portraits/advisors/ndrc.png' }
];
