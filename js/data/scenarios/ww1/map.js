/* ============================================================
   data/scenarios/ww1/map.js —— 一战欧陆、中东与高加索地图
   ------------------------------------------------------------
   v11.0 地图放大轮：旧版 24×16 = 384 格，国界同样靠矩形区间推出。
   新版复用 data/atlas.js 的欧洲图集（列 0~43），裁掉东亚插图，
   得到 44×30 = 1320 格 —— 西线（佛兰德—凡尔登—索姆）、东线
   （坦能堡—华沙—加利西亚）、巴尔干、高加索、中东四个战区各有纵深。
   ============================================================ */

import { buildFromAtlas, OWN_WW1, atlasStats } from '../../../data/atlas.js';

/* 图集代码 → 剧本国家代码 */
const REMAP = {
  '1': 'GER', '2': 'AUS', '3': 'GBR', '4': 'FRA', '5': 'RUS', '6': 'ITA',
  '7': 'SRB', '8': 'ROM', '9': 'BUL', 'a': 'GRE', 'b': 'OTT', 'c': 'NLD',
  'd': 'BEL', 'e': 'SWZ', 'f': 'ESP', 'g': 'POR', 'h': 'DNK', 'i': 'NOR',
  'j': 'SWE', 'k': 'MNE', 'l': 'ALB', 't': 'USA'
};

/* 一战只取欧陆—中东段：列 0~43（东亚插图为 48~57，一战舞台上没有它） */
// 从最西侧起裁：北美插图（列 0~5）也要保留，否则美国远征军没有本土与首都；
// 东端止于列 51，切掉东亚插图（列 54~63）—— 一战舞台上没有它
const WW1_CROP = { q0: 0, q1: 51, r0: 0, r1: 29 };

/* 城市与胜利点（图集坐标） */
export const WW1_CITIES = [
  // —— 协约国核心 ——
  { name:'伦敦',       q:14,  r:14, owner:'GBR', w:5, cap:'GBR' },
  { name:'巴黎',       q:16, r:15, owner:'FRA', w:5, cap:'FRA' },
  { name:'圣彼得堡',   q:36, r:8,  owner:'RUS', w:5, cap:'RUS' },
  { name:'莫斯科',     q:40, r:11, owner:'RUS', w:4 },
  { name:'贝尔格莱德', q:27, r:18, owner:'SRB', w:3, cap:'SRB' },
  { name:'布鲁塞尔',   q:17, r:13, owner:'BEL', w:3, cap:'BEL' },
  { name:'罗马',       q:23, r:20, owner:'ITA', w:4, cap:'ITA' },
  { name:'米兰',       q:20, r:18, owner:'ITA', w:3 },
  { name:'威尼斯',     q:21, r:18, owner:'ITA', w:2 },

  // —— 同盟国核心 ——
  { name:'柏林',       q:23, r:13, owner:'GER', w:5, cap:'GER' },
  { name:'汉堡',       q:20, r:12, owner:'GER', w:3 },
  { name:'科隆',       q:19, r:14, owner:'GER', w:3 },
  { name:'慕尼黑',     q:22, r:16, owner:'GER', w:3 },
  { name:'法兰克福',   q:20, r:15, owner:'GER', w:2 },
  { name:'柯尼斯堡',   q:27, r:12, owner:'GER', w:3 },
  { name:'坦能堡',     q:26, r:13, owner:'GER', w:2 },
  { name:'维也纳',     q:25, r:16, owner:'AUS', w:5, cap:'AUS' },
  { name:'布达佩斯',   q:27, r:16, owner:'AUS', w:4 },
  { name:'布拉格',     q:24, r:15, owner:'AUS', w:3 },
  { name:'萨拉热窝',   q:27, r:19, owner:'AUS', w:3 },
  { name:'普热梅希尔', q:28, r:15, owner:'AUS', w:2, fort:2 },
  { name:'克拉科夫',   q:27, r:15, owner:'AUS', w:3 },
  { name:'君士坦丁堡', q:34, r:21, owner:'OTT', w:4, cap:'OTT' },
  { name:'加里波利',   q:33, r:21, owner:'OTT', w:3 },
  { name:'大马士革',   q:39, r:26, owner:'OTT', w:2 },
  { name:'巴格达',     q:44, r:26, owner:'OTT', w:3 },
  { name:'耶路撒冷',   q:41, r:27, owner:'OTT', w:2 },
  { name:'摩苏尔',     q:44, r:24, owner:'OTT', w:2 },
  { name:'索非亚',     q:30, r:20, owner:'BUL', w:3, cap:'BUL' },

  // —— 其他首都与中立国 ——
  { name:'布加勒斯特', q:28, r:18, owner:'ROM', w:3, cap:'ROM' },
  { name:'雅典',       q:30, r:23, owner:'GRE', w:3, cap:'GRE' },
  { name:'伯尔尼',     q:19, r:17, owner:'SWZ', w:2, cap:'SWZ' },
  { name:'阿姆斯特丹', q:17, r:12, owner:'NLD', w:3, cap:'NLD' },
  { name:'马德里',     q:12,  r:20, owner:'ESP', w:3, cap:'ESP' },
  { name:'里斯本',     q:8,  r:21, owner:'POR', w:2, cap:'POR' },
  { name:'斯德哥尔摩', q:26, r:8,  owner:'SWE', w:3, cap:'SWE' },
  { name:'哥本哈根',   q:21, r:11, owner:'DNK', w:2, cap:'DNK' },
  { name:'奥斯陆',     q:21, r:8,  owner:'NOR', w:2, cap:'NOR' },
  { name:'赫尔辛基',   q:31, r:7,  owner:'FIN', w:2, cap:'FIN' },
  { name:'采蒂涅',     q:27, r:20, owner:'MNE', w:2, cap:'MNE' },

  // —— 西线要地 ——
  { name:'凡尔登',     q:18, r:15, owner:'FRA', w:3, fort:3 },
  { name:'马恩',       q:17, r:15, owner:'FRA', w:2 },
  { name:'索姆',       q:17, r:16, owner:'FRA', w:2 },
  { name:'列日',       q:17, r:14, owner:'BEL', w:2, fort:2 },
  { name:'里昂',       q:17, r:18, owner:'FRA', w:2 },
  { name:'马赛',       q:18, r:19, owner:'FRA', w:2 },

  // —— 东线与高加索 ——
  { name:'华沙',       q:27, r:14, owner:'RUS', w:4 },
  { name:'里加',       q:31, r:10, owner:'RUS', w:2 },
  { name:'维尔诺',     q:33, r:11, owner:'RUS', w:2 },
  { name:'明斯克',     q:33, r:12, owner:'RUS', w:2 },
  { name:'基辅',       q:35, r:14, owner:'RUS', w:3 },
  { name:'敖德萨',     q:35, r:17, owner:'RUS', w:3 },
  { name:'第比利斯',   q:46, r:21, owner:'RUS', w:2 },
  { name:'巴库',       q:48, r:21, owner:'RUS', w:3 },
  { name:'阿尔汉格尔斯克', q:42, r:5, owner:'RUS', w:2 },

  // —— 北美远征军本土（图集西侧插图）——
  { name:'华盛顿',     q:2,  r:14, owner:'USA', w:5, cap:'USA' },
  { name:'纽约',       q:3,  r:13, owner:'USA', w:4 },
  { name:'波士顿',     q:3,  r:12, owner:'USA', w:3 },
  { name:'芝加哥',     q:1,  r:13, owner:'USA', w:3 },
  { name:'亚特兰大',   q:2,  r:16, owner:'USA', w:2 },

  // —— 北非与中东 ——
  { name:'的黎波里',   q:23, r:27, owner:'ITA', w:3 },
  { name:'开罗',       q:35, r:29, owner:'GBR', w:4 },
  { name:'亚历山德里亚', q:37, r:28, owner:'GBR', w:3 }
];

/* 关键油田 */
const ENERGY = {
  '48,21': 5,   // 巴库
  '28,18': 4    // 普洛耶什蒂
};

export function buildWW1Map(){
  const built = buildFromAtlas({
    own: OWN_WW1,
    cities: WW1_CITIES,
    crop: WW1_CROP,
    remap: REMAP
  });

  for(const k in ENERGY){
    const h = built.at[k];
    if(h) h.energy = ENERGY[k];
  }

  return built;
}

export { atlasStats };
