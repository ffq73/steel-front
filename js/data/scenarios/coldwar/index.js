/* ============================================================
   data/scenarios/coldwar/index.js —— 冷战「铁幕 1949」完整剧本数据包
   ============================================================ */

import { buildColdWarMap } from './map.js';
import { COLDWAR_NATIONS } from './nations.js';
import { COLDWAR_CHARACTERS } from './characters.js';
import { COLDWAR_FOCUSES } from './focuses.js';
import { COLDWAR_EVENTS, checkColdWarEvents } from './events.js';
import { COLDWAR_EQUIPMENT } from './equipment.js';

export const COLDWAR_SCENARIO = {
  id: 'coldwar',
  name: '铁幕 1949',
  era: 'coldwar',
  start: '1949-05-12',
  timeLimit: 300, // 300 个月（约 25 年大跨度）
  player: 'USA', // 默认推荐美利坚合众国，亦可任选苏联或新中国
  buildMap: buildColdWarMap,
  customNations: COLDWAR_NATIONS,
  characters: COLDWAR_CHARACTERS,
  focuses: COLDWAR_FOCUSES,
  events: COLDWAR_EVENTS,
  equipment: COLDWAR_EQUIPMENT,
  checkEvents: checkColdWarEvents,

  nations: [
    'USA', 'SOV', 'CHN', 'GBR', 'FRA', 'GER_W', 'GER_E', 'ITA', 'CAN', 'JPN',
    'KOR', 'PRK', 'VNM', 'CUB', 'POL', 'CZE', 'HUN', 'IND', 'YUG', 'EGY',
    'ISR', 'IRN', 'SAU', 'BRA', 'AFG', 'ZAF'
  ],

  atWar: [], // 冷战开局两大超级大国不直接宣战，依托代理人与制度竞争

  presetTech: {
    USA: ['inf_weapon_1', 'motorization'],
    SOV: ['inf_weapon_1', 'motorization'],
    CHN: ['inf_weapon_1'],
    GBR: ['inf_weapon_1'],
    FRA: ['inf_weapon_1']
  },

  presetFocus: {
    USA: ['usa_truman_doctrine'],
    SOV: ['sov_postwar_5year'],
    CHN: ['chn_consolidate_power']
  },

  armies: {
    USA: { inf: 25, arm: 6, mot: 5 },
    SOV: { inf: 35, arm: 8, mot: 6 },
    CHN: { inf: 25, cav: 2 },
    GBR: { inf: 10, arm: 2 },
    FRA: { inf: 10, arm: 2 },
    GER_W: { inf: 6 },
    GER_E: { inf: 6 },
    KOR: { inf: 5 },
    PRK: { inf: 6 },
    VNM: { inf: 6 },
    CUB: { inf: 4 },
    POL: { inf: 6 },
    CZE: { inf: 5 },
    HUN: { inf: 4 },
    IND: { inf: 8 },
    YUG: { inf: 6 },
    EGY: { inf: 5 },
    ISR: { inf: 4 },
    IRN: { inf: 4 },
    SAU: { inf: 2 },
    BRA: { inf: 4 },
    CAN: { inf: 4 },
    ITA: { inf: 5 },
    JPN: { inf: 4 },
    AFG: { inf: 3 },
    ZAF: { inf: 4 }
  },

  // v14.1 E6：冷战目标改为「影响力主导 / 声望达标」（此前 survive 目标在
  // 旧硬编码分支里根本没有 coldwar 代码路径，等于死数据）。
  // influence_lead:N = econSocial 追踪国内倾向本国阵营占比 ≥ N%。
  // 声望目标高于开局值（USA 90 / SOV 88 / CHN 75），需靠科技与太空竞赛增长。
  objectives: {
    USA: ['influence_lead:50', 'prestige:110'],
    SOV: ['influence_lead:50', 'prestige:110'],
    CHN: ['influence_lead:35', 'prestige:95']
  }
};
