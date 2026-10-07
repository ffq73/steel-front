/* ============================================================
   data/scenarios/ww1/index.js —— 一战「火药桶 1914」完整剧本数据包
   ============================================================ */

import { buildWW1Map } from './map.js';
import { WW1_NATIONS } from './nations.js';
import { WW1_CHARACTERS } from './characters.js';
import { WW1_FOCUSES } from './focuses.js';
import { WW1_EVENTS, checkWW1Events } from './events.js';
import { WW1_EQUIPMENT } from './equipment.js';
import { WW1_BATTALIONS, WW1_SUPPORT_COMPANIES } from './battalions.js';

export const WW1_SCENARIO = {
  id: 'ww1',
  name: '火药桶 1914',
  era: 'ww1',
  start: '1914-07-28',
  timeLimit: 200,
  player: 'GER', // 默认推荐执掌德皇陆军，亦可任选法、英、俄、奥
  buildMap: buildWW1Map,
  customNations: WW1_NATIONS,
  characters: WW1_CHARACTERS,
  focuses: WW1_FOCUSES,
  events: WW1_EVENTS,
  equipment: WW1_EQUIPMENT,
  battalions: WW1_BATTALIONS,
  supportCompanies: WW1_SUPPORT_COMPANIES,
  checkEvents: checkWW1Events,

  nations: [
    'GER','AUS','OTT','BUL',
    'FRA','RUS','GBR','SRB','BEL','ITA','ROM','GRE','MNE','POR','USA',
    'NLD','SWZ','SWE','DNK','ESP'
  ],

  atWar: [
    ['GER','FRA'], ['GER','RUS'], ['GER','GBR'], ['GER','BEL'],
    ['AUS','RUS'], ['AUS','SRB'], ['AUS','MNE'],
    ['OTT','RUS'], ['OTT','GBR']
  ],

  presetTech: {
    GER: ['inf_weapon_1'],
    FRA: ['inf_weapon_1'],
    GBR: ['inf_weapon_1'],
    RUS: [],
    AUS: [],
    OTT: []
  },

  presetFocus: {
    GER: ['krupp_works'],
    FRA: ['creusot_artillery'],
    GBR: ['vickers_maxim'],
    RUS: ['petrograd_munition'],
    AUS: ['skoda_heavy_guns'],
    OTT: ['tophane_arsenal']
  },

  armies: {
    GER: { inf: 28, cav: 4 },
    FRA: { inf: 24, cav: 3 },
    RUS: { inf: 32, cav: 6 },
    GBR: { inf: 8,  cav: 1 },
    AUS: { inf: 18, cav: 3 },
    OTT: { inf: 10, cav: 2 },
    SRB: { inf: 5,  cav: 1 },
    BEL: { inf: 4 },
    BUL: { inf: 5,  cav: 1 },
    ROM: { inf: 4 },
    ITA: { inf: 10, cav: 1 },
    MNE: { inf: 2 },
    POR: { inf: 2 },
    USA: { inf: 4 },
    NLD: { inf: 2 },
    SWZ: { inf: 2 },
    SWE: { inf: 2 },
    DNK: { inf: 1 },
    ESP: { inf: 2 }
  },

  objectives: {
    GER: ['capture:巴黎', 'capture:圣彼得堡'],
    FRA: ['capture:柏林', 'survive:120'],
    GBR: ['capture:柏林', 'survive:150'],
    RUS: ['capture:柏林', 'capture:维也纳'],
    AUS: ['capture:贝尔格莱德', 'survive:120']
  }
};
