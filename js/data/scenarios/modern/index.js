/* ============================================================
   data/scenarios/modern/index.js —— 现代「多极危机 2022」完整剧本数据包
   ============================================================ */

import { buildModernMap } from './map.js';
import { MODERN_NATIONS } from './nations.js';
import { MODERN_CHARACTERS } from './characters.js';
import { MODERN_FOCUSES } from './focuses.js';
import { MODERN_EVENTS, checkModernEvents } from './events.js';
import { MODERN_EQUIPMENT } from './equipment.js';

export const MODERN_SCENARIO = {
  id: 'modern',
  name: '多极危机 2022',
  era: 'modern',
  start: '2022-02-24',
  timeLimit: 120, // 120 周（约 2.5 年，以周为 tick）
  player: 'UKR', // 默认推荐捍卫主权的乌克兰，亦可执掌俄、美、英、日、伊朗
  buildMap: buildModernMap,
  customNations: MODERN_NATIONS,
  characters: MODERN_CHARACTERS,
  focuses: MODERN_FOCUSES,
  events: MODERN_EVENTS,
  equipment: MODERN_EQUIPMENT,
  checkEvents: checkModernEvents,

  nations: [
    'RUS', 'UKR', 'USA', 'GBR', 'GER', 'FRA', 'POL', 'JPN',
    'IRN', 'ISR', 'CHN', 'BLR', 'SAU', 'PRK', 'KOR'
  ],

  atWar: [
    ['RUS', 'UKR']
  ],

  presetTech: {
    RUS: ['inf_weapon_1', 'motorization', 'light_tank'],
    UKR: ['inf_weapon_1', 'motorization'],
    USA: ['inf_weapon_1', 'motorization', 'light_tank'],
    GBR: ['inf_weapon_1', 'motorization'],
    CHN: ['inf_weapon_1', 'motorization']
  },

  presetFocus: {
    RUS: ['rus_smo_launch'],
    UKR: ['ukr_total_mobilization'],
    USA: ['f_xl_congress_budget'],
    GBR: ['f_wr_shadow_moves'],
    JPN: ['f_ya_article_9_amend']
  },

  armies: {
    RUS: { inf: 22, arm: 5, mot: 5 },
    UKR: { inf: 18, arm: 3, mot: 4 },
    USA: { inf: 15, arm: 4, mot: 4 },
    GBR: { inf: 6, arm: 2 },
    GER: { inf: 6 },
    FRA: { inf: 8, arm: 2 },
    POL: { inf: 10, arm: 2 },
    JPN: { inf: 8, arm: 2 },
    IRN: { inf: 12, mot: 3 },
    ISR: { inf: 8, arm: 2 },
    CHN: { inf: 25, arm: 6, mot: 6 },
    BLR: { inf: 6 },
    SAU: { inf: 6 },
    PRK: { inf: 8 },
    KOR: { inf: 8, arm: 2 }
  },

  // v14.1 E6：现代目标加入「停火窗口 / 红线未爆」（文档 W0-E6）。
  // - UKR 改为坚守 + 促成停火窗口（战争疲劳双双 ≥70 触发，milaid.js）
  // - 局外大国（美英日伊）要求危机升级指数全程未触红线（redline）
  // - 声望目标全部高于开局值（USA 85 / GBR 75 / JPN 80 / IRN 55），
  //   需靠科技与太空竞赛增长，防「开局白送」
  objectives: {
    RUS: ['capture:基辅', 'capture:敖德萨', 'survive:60'],
    UKR: ['survive:120', 'ceasefire'],
    USA: ['survive:120', 'prestige:100', 'redline'],
    GBR: ['survive:120', 'prestige:90', 'redline'],
    JPN: ['survive:120', 'prestige:95', 'redline'],
    IRN: ['survive:120', 'prestige:70', 'redline']
  }
};
