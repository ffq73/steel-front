/* ============================================================
   data/scenarios/ww2/index.js —— 二战「全面战争 1939」完整剧本数据包
   ============================================================ */

import { buildWW2Map } from './map.js';
import { WW2_NATIONS } from './nations.js';
import { WW2_CHARACTERS } from './characters.js';
import { WW2_FOCUSES } from './focuses.js';
import { WW2_EVENTS, checkWW2Events } from './events.js';
import { WW2_EQUIPMENT } from './equipment.js';

export const WW2_SCENARIO = {
  id: 'ww2',
  name: '全面战争 1939',
  era: 'ww2',
  start: '1939-09-01',
  timeLimit: 500,
  player: 'GER', // 默认推荐执掌德意志国防军，亦可任选苏、中、英、美、日
  buildMap: buildWW2Map,
  customNations: WW2_NATIONS,
  characters: WW2_CHARACTERS,
  focuses: WW2_FOCUSES,
  events: WW2_EVENTS,
  equipment: WW2_EQUIPMENT,
  checkEvents: checkWW2Events,

  nations: [
    'GER', 'ITA', 'JPN', 'HUN', 'ROM', 'BUL', 'FIN',
    'GBR', 'FRA', 'USA', 'POL', 'CAN', 'AST', 'BEL', 'NLD', 'NOR', 'GRE', 'YUG',
    'SOV', 'CHN', 'CCP',
    'DEN', 'SWE', 'SWZ', 'SPN', 'POR', 'TUR', 'EGY', 'IRN', 'IRQ', 'SAU', 'BRA'
  ],

  atWar: [
    ['GER', 'POL'],
    ['GER', 'FRA'],
    ['GER', 'GBR'],
    ['JPN', 'CHN'],
    ['JPN', 'CCP']
  ],

  presetTech: {
    GER: ['inf_weapon_1', 'motorization'],
    SOV: ['inf_weapon_1'],
    GBR: ['inf_weapon_1'],
    FRA: ['inf_weapon_1'],
    USA: ['inf_weapon_1', 'motorization'],
    JPN: ['inf_weapon_1'],
    CHN: [],
    CCP: []
  },

  presetFocus: {
    GER: ['ger_4year_plan'],
    SOV: ['sov_5year_heavy'],
    GBR: ['gbr_radar_chain'],
    FRA: ['fra_maginot_reinforce'],
    USA: ['usa_neutrality_act_lift'],
    JPN: ['jpn_continental_policy'],
    CHN: ['chn_army_reform'],
    CCP: ['ccp_luochuan_conf']
  },

  armies: {
    GER: { inf: 28, arm: 5, mot: 3 },
    SOV: { inf: 35, arm: 4, mot: 2 },
    GBR: { inf: 12, arm: 2 },
    FRA: { inf: 22, arm: 2 },
    USA: { inf: 15, arm: 3, mot: 2 },
    JPN: { inf: 22, arm: 2, cav: 2 },
    CHN: { inf: 20, cav: 2 },
    CCP: { inf: 8,  cav: 1 },
    POL: { inf: 14, cav: 3 },
    ITA: { inf: 15, arm: 1 },
    HUN: { inf: 5 },
    ROM: { inf: 6 },
    BUL: { inf: 4 },
    FIN: { inf: 6 },
    CAN: { inf: 4 },
    BEL: { inf: 5 },
    NLD: { inf: 4 },
    NOR: { inf: 3 },
    GRE: { inf: 5 },
    YUG: { inf: 6 },
    DEN: { inf: 2 },
    SWE: { inf: 4 },
    SWZ: { inf: 3 },
    SPN: { inf: 5 },
    POR: { inf: 3 },
    TUR: { inf: 5 },
    EGY: { inf: 3 },
    IRN: { inf: 4 },
    IRQ: { inf: 3 },
    SAU: { inf: 2 }
  },

  objectives: {
    GER: ['capture:华沙', 'capture:巴黎', 'capture:莫斯科'],
    SOV: ['capture:柏林', 'survive:300'],
    CHN: ['capture:北京', 'capture:南京', 'survive:300'],
    GBR: ['capture:柏林', 'survive:300'],
    USA: ['capture:柏林', 'capture:东京']
  }
};
