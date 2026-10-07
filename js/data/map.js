/* ============================================================
   data/map.js —— 剧本 A「白色方案 1939」中欧战区地图
   ------------------------------------------------------------
   v11.0 地图放大轮：
   旧版是 20×14 = 280 格，国界同样靠矩形区间 + Voronoi 种子推出，
   德国是方块、波兰是方块。新版改为从 data/atlas.js 的欧洲图集里
   **裁出中欧战区**（列 4~36，行 8~21），保留真实海岸线与国界轮廓：
   北海—波罗的海—丹麦海峡在北，阿尔卑斯与北意大利在南，法德边境与
   维斯瓦河走廊的形状一眼可辨。

   剧本 A 只有德/波/法/苏/英/匈六国，因此图集里其余国家（荷比丹瑞挪等）
   一律映射为中立 'N' —— 它们仍然在地图上，但开局不参战。
   ============================================================ */

import { buildFromAtlas, OWN_WW2, ATLAS_W, ATLAS_H } from './atlas.js';
import { WW2_CITIES } from './scenarios/ww2/map.js';

/* 剧本 A 的六国：德 G / 波 P / 法 F / 苏 S / 英 B / 匈 H，其余中立。
   图集层用单字符代码，城市表用三字母代码，两套都要映射，否则城市会把
   三字母归属直接写进 hex.owner —— 那些代码不在剧本 A 的 nations 里，
   存档校验与首都定位（capHex）都会失手。 */
const A_CODE = { '1':'G', '3':'B', '4':'F', '5':'S', '6':'P', '7':'H' };
const A_TAG = {
  GER:'G', GBR:'B', FRA:'F', SOV:'S', POL:'P', HUN:'H',
  ITA:'N', CHN:'N', CCP:'N', JPN:'N', ROM:'N', YUG:'N', BUL:'N', GRE:'N',
  TUR:'N', NOR:'N', SWE:'N', DEN:'N', FIN:'N', NLD:'N', BEL:'N', SWZ:'N',
  SPN:'N', POR:'N', EGY:'N', IRQ:'N', IRN:'N', SAU:'N'
};
const A_REMAP = { ...A_TAG };
for(const ch of '123456789abcdefghijklmnopqrstu'){
  A_REMAP[ch] = A_CODE[ch] || 'N';
}

/* 中欧战区裁剪框：西起布列塔尼，东至莫斯科方向，北含斯堪的纳维亚南岸 */
const CROP = { q0: 12, q1: 44, r0: 8, r1: 21 };

export function buildMap(){
  return buildFromAtlas({
    own: OWN_WW2,
    cities: WW2_CITIES,
    crop: CROP,
    remap: A_REMAP
  });
}

export { ATLAS_W, ATLAS_H };
