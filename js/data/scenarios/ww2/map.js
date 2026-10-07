/* ============================================================
   data/scenarios/ww2/map.js —— 二战欧洲—北非—中东—东亚全景地图
   ------------------------------------------------------------
   v11.0 地图放大轮：
   旧版是 26×16 = 416 格，国界靠 `if(q>=6 && q<=9 && r>=3 && r<=6) return 'GER'`
   这类矩形区间推出，于是德国/法国/意大利都是方块，玩家反馈「看不出国家
   轮廓、没法划分战区」。

   新版改用 data/atlas.js 的 58×30 手工图集：海岸线与国界一格一字符，
   陆地 1149 格（旧版 330 格），德国有莱茵兰—东普鲁士的纵向形状、法国有
   六边形轮廓、意大利有靴形、挪威有南北狭长的脊梁、黑海与地中海各就各位。
   单位格由 80km 级降到 ~50km 级，正好容得下西线/东线/北非/远东四个战区。
   ============================================================ */

import {
  buildFromAtlas, OWN_WW2, ATLAS_W, ATLAS_H, atlasStats
} from '../../../data/atlas.js';

/* 图集代码 → 剧本国家代码 */
const WW2_REMAP = {
  '1': 'GER', '2': 'ITA', '3': 'GBR', '4': 'FRA', '5': 'SOV', '6': 'POL',
  '7': 'HUN', '8': 'ROM', '9': 'YUG', 'a': 'BUL', 'b': 'GRE', 'c': 'TUR',
  'd': 'NOR', 'e': 'SWE', 'f': 'DEN', 'g': 'FIN', 'h': 'NLD', 'i': 'BEL',
  'j': 'SWZ', 'k': 'SPN', 'l': 'POR', 'm': 'EGY', 'n': 'IRQ', 'o': 'IRN',
  'p': 'SAU', 'q': 'CHN', 'r': 'JPN', 's': 'CCP', 't': 'USA', 'u': 'CAN'
};

/* 城市与胜利点（图集坐标：列 ≈ -12 + q×1.47° 经度，行 ≈ 71 - r×1.43° 纬度） */
export const WW2_CITIES = [
  // —— 轴心国核心 ——
  { name:'柏林',       q:23, r:13, owner:'GER', w:5, cap:'GER' },
  { name:'汉堡',       q:20, r:12, owner:'GER', w:3 },
  { name:'慕尼黑',     q:22, r:16, owner:'GER', w:3 },
  { name:'科隆',       q:19, r:14, owner:'GER', w:3 },
  { name:'斯图加特',   q:20, r:15, owner:'GER', w:2 },
  { name:'德累斯顿',   q:24, r:14, owner:'GER', w:2 },
  { name:'柯尼斯堡',   q:28, r:12, owner:'GER', w:3 },
  { name:'布拉格',     q:24, r:15, owner:'GER', w:3 },   // 1939 已被吞并
  { name:'维也纳',     q:25, r:16, owner:'GER', w:3 },
  { name:'罗马',       q:23, r:20, owner:'ITA', w:4, cap:'ITA' },
  { name:'米兰',       q:20, r:18, owner:'ITA', w:3 },
  { name:'威尼斯',     q:21, r:18, owner:'ITA', w:2 },
  { name:'那不勒斯',   q:24, r:21, owner:'ITA', w:3 },
  { name:'巴勒莫',     q:22, r:23, owner:'ITA', w:2 },
  { name:'的黎波里',   q:23, r:27, owner:'ITA', w:3 },   // 意属利比亚
  { name:'东京',       q:63, r:17, owner:'JPN', w:5, cap:'JPN' },
  { name:'大阪',       q:62, r:18, owner:'JPN', w:3 },
  { name:'京城',       q:60, r:16, owner:'JPN', w:3 },   // 朝鲜总督府
  { name:'新京',       q:60, r:12, owner:'JPN', w:3 },   // 伪满洲国
  { name:'沈阳',       q:59, r:13, owner:'JPN', w:3 },
  { name:'北京',       q:58, r:14, owner:'JPN', w:4 },   // 华北派遣军占领
  { name:'台北',       q:59, r:24, owner:'JPN', w:2 },

  // —— 同盟国核心 ——
  { name:'伦敦',       q:14,  r:14, owner:'GBR', w:5, cap:'GBR' },
  { name:'曼彻斯特',   q:13,  r:12, owner:'GBR', w:3 },
  { name:'伯明翰',     q:13,  r:13, owner:'GBR', w:2 },
  { name:'亚历山德里亚', q:37, r:28, owner:'GBR', w:3 },
  { name:'阿拉曼',     q:32, r:28, owner:'GBR', w:2 },
  { name:'直布罗陀',   q:11,  r:24, owner:'GBR', w:2 },
  { name:'巴黎',       q:16, r:15, owner:'FRA', w:5, cap:'FRA' },
  { name:'马赛',       q:18, r:19, owner:'FRA', w:3 },
  { name:'里昂',       q:17, r:18, owner:'FRA', w:2 },
  { name:'波尔多',     q:15,  r:17, owner:'FRA', w:2 },
  { name:'斯特拉斯堡', q:19, r:15, owner:'FRA', w:2 },
  { name:'阿尔及尔',   q:16, r:24, owner:'FRA', w:3 },
  { name:'突尼斯',     q:21, r:24, owner:'FRA', w:2 },
  { name:'卡萨布兰卡', q:9,  r:26, owner:'FRA', w:2 },
  { name:'贝鲁特',     q:39, r:26, owner:'FRA', w:2 },   // 法属叙利亚委任地
  { name:'莫斯科',     q:40, r:11, owner:'SOV', w:5, cap:'SOV' },
  { name:'列宁格勒',   q:36, r:8,  owner:'SOV', w:4 },
  { name:'斯大林格勒', q:44, r:16, owner:'SOV', w:4 },
  { name:'基辅',       q:35, r:14, owner:'SOV', w:3 },
  { name:'明斯克',     q:33, r:12, owner:'SOV', w:3 },
  { name:'斯摩棱斯克', q:36, r:11, owner:'SOV', w:2 },
  { name:'敖德萨',     q:35, r:17, owner:'SOV', w:2 },
  { name:'哈尔科夫',   q:39, r:15, owner:'SOV', w:2 },
  { name:'罗斯托夫',   q:41, r:17, owner:'SOV', w:2 },
  { name:'沃罗涅日',   q:41, r:14, owner:'SOV', w:2 },
  { name:'高尔基',     q:44, r:10, owner:'SOV', w:2 },
  { name:'摩尔曼斯克', q:37, r:1,  owner:'SOV', w:2 },
  { name:'阿尔汉格尔斯克', q:42, r:5, owner:'SOV', w:2 },
  { name:'巴库',       q:48, r:21, owner:'SOV', w:3 },

  // —— 中国战区 ——
  { name:'重庆',       q:55, r:21, owner:'CHN', w:5, cap:'CHN' },
  { name:'南京',       q:58, r:20, owner:'CHN', w:4 },
  { name:'上海',       q:57, r:20, owner:'CHN', w:4 },
  { name:'武汉',       q:57, r:21, owner:'CHN', w:3 },
  { name:'长沙',       q:57, r:22, owner:'CHN', w:3 },
  { name:'广州',       q:57, r:26, owner:'CHN', w:3 },
  { name:'昆明',       q:55, r:24, owner:'CHN', w:2 },
  { name:'太原',       q:57, r:16, owner:'CHN', w:3 },
  { name:'西安',       q:56, r:18, owner:'CHN', w:2 },
  { name:'延安',       q:56, r:16, owner:'CCP', w:4, cap:'CCP' },

  // —— 东欧、北欧与巴尔干 ——
  { name:'华沙',       q:28, r:13, owner:'POL', w:4, cap:'POL' },
  { name:'克拉科夫',   q:28, r:15, owner:'POL', w:3 },
  { name:'罗兹',       q:27, r:13, owner:'POL', w:2 },
  { name:'波兹南',     q:26, r:13, owner:'POL', w:2 },
  { name:'利沃夫',     q:29, r:15, owner:'POL', w:2 },
  { name:'但泽',       q:27, r:12, owner:'POL', w:3 },
  { name:'布达佩斯',   q:27, r:16, owner:'HUN', w:3, cap:'HUN' },
  { name:'布加勒斯特', q:28, r:18, owner:'ROM', w:3, cap:'ROM' },
  { name:'索非亚',     q:30, r:20, owner:'BUL', w:2, cap:'BUL' },
  { name:'贝尔格莱德', q:27, r:18, owner:'YUG', w:3, cap:'YUG' },
  { name:'萨格勒布',   q:25, r:17, owner:'YUG', w:2 },
  { name:'萨拉热窝',   q:27, r:19, owner:'YUG', w:2 },
  { name:'雅典',       q:30, r:23, owner:'GRE', w:3, cap:'GRE' },
  { name:'赫尔辛基',   q:31, r:7,  owner:'FIN', w:3, cap:'FIN' },
  { name:'奥斯陆',     q:21, r:8,  owner:'NOR', w:2, cap:'NOR' },
  { name:'斯德哥尔摩', q:26, r:8,  owner:'SWE', w:3, cap:'SWE' },
  { name:'哥本哈根',   q:21, r:11, owner:'DEN', w:2, cap:'DEN' },
  { name:'布鲁塞尔',   q:17, r:13, owner:'BEL', w:3, cap:'BEL' },
  { name:'阿姆斯特丹', q:17, r:12, owner:'NLD', w:3, cap:'NLD' },
  { name:'伯尔尼',     q:19, r:17, owner:'SWZ', w:2, cap:'SWZ' },
  { name:'马德里',     q:12,  r:20, owner:'SPN', w:3, cap:'SPN' },
  { name:'里斯本',     q:8,  r:21, owner:'POR', w:2, cap:'POR' },

  // —— 北美（大西洋彼岸本土，图集西侧插图）——
  { name:'华盛顿',     q:2,  r:14, owner:'USA', w:5, cap:'USA' },
  { name:'纽约',       q:3,  r:13, owner:'USA', w:4 },
  { name:'波士顿',     q:3,  r:12, owner:'USA', w:3 },
  { name:'芝加哥',     q:1,  r:13, owner:'USA', w:4 },
  { name:'底特律',     q:1,  r:12, owner:'USA', w:3 },
  { name:'亚特兰大',   q:2,  r:16, owner:'USA', w:3 },
  { name:'迈阿密',     q:1,  r:17, owner:'USA', w:2 },
  { name:'渥太华',     q:2,  r:9,  owner:'CAN', w:3, cap:'CAN' },
  { name:'蒙特利尔',   q:3,  r:10, owner:'CAN', w:3 },
  { name:'多伦多',     q:3,  r:11, owner:'CAN', w:2 },

  // —— 中东与北非 ——
  { name:'开罗',       q:35, r:29, owner:'EGY', w:4, cap:'EGY' },
  { name:'耶路撒冷',   q:41, r:27, owner:'GBR', w:3 },   // 英属巴勒斯坦委任地
  { name:'安卡拉',     q:37, r:22, owner:'TUR', w:3, cap:'TUR' },
  { name:'伊斯坦布尔', q:34, r:21, owner:'TUR', w:3 },
  { name:'巴格达',     q:44, r:26, owner:'IRQ', w:3, cap:'IRQ' },
  { name:'摩苏尔',     q:44, r:24, owner:'IRQ', w:2 },
  { name:'巴士拉',     q:40, r:28, owner:'IRQ', w:2 },
  { name:'德黑兰',     q:49, r:25, owner:'IRN', w:3, cap:'IRN' },
  { name:'大不里士',   q:46, r:23, owner:'IRN', w:2 },
  { name:'利雅得',     q:42, r:28, owner:'SAU', w:3, cap:'SAU' }
];

/* 要塞与油田（图集坐标） */
const FORTS = {
  '19,15': 3, '19,14': 2,   // 马奇诺防线
  '20,14': 2, '20,13': 2,   // 齐格菲防线
  '17,13': 2,               // 埃本-埃马尔 / 列日要塞
  '28,12': 2,               // 柯尼斯堡要塞
  '32,28': 1,               // 阿拉曼防线
  '27,16': 2                // 布达佩斯要塞群
};
const WW2_ENERGY = {
  '48,21': 5,   // 巴库油田
  '29,18': 4,   // 普洛耶什蒂油田
  '46,28': 3    // 波斯湾油田
};

export function buildWW2Map(){
  const built = buildFromAtlas({
    own: OWN_WW2,
    cities: WW2_CITIES,
    remap: WW2_REMAP
  });

  // 要塞与能源是「额外属性」，图集构建器不负责，这里补写
  for(const k in FORTS){
    const h = built.at[k];
    if(h) h.fort = FORTS[k];
  }
  for(const k in WW2_ENERGY){
    const h = built.at[k];
    if(h) h.energy = WW2_ENERGY[k];
  }

  return built;
}

export { ATLAS_W, ATLAS_H, atlasStats };
