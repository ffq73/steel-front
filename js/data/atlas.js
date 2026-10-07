/* ============================================================
   data/atlas.js —— 战略地图图集（v11.0 地图放大轮）
   ------------------------------------------------------------
   设计动因：
   旧地图的国界是靠 `if(q>=6 && q<=9 && r>=3 && r<=6) return 'GER'`
   这类矩形区间推出来的，于是德国是方块、法国是方块、意大利是方块 ——
   玩家反馈「看不出国家轮廓、没法划分战区」。本文件把**海岸线与国界
   改为手工排布的图层**，一格一字符，所见即所得。

   为避免手数字符出错，图层用「记号:计数」DSL 书写：
     '~:24 d:4 ~:30'  → 24 格海、4 格挪威、30 格海
   解析后强制断言行宽 = ATLAS_W，写错立刻抛错，而不是悄悄错位。

   三层结构（地形与国界分离，海岸线只有一份真相）：
     1. LAND   —— 陆海掩膜。'~' 海洋，'L' 陆地
     2. OWN_*  —— 各剧本国界层，只描述归属；标 '~' 处若为陆地则是无主中立
     3. PATCHES —— 山脉/森林/沙漠/沼泽，按「行区间 × 列区间」声明

   坐标系（欧洲主图）：
     列 q：经度 ≈ -12 + q × 1.47   （q=43 → 51°E）
     行 r：纬度 ≈  71 - r × 1.43   （r=29 → 29.5°N）
   东亚为独立插图（自成一格比例尺），以两列海洋与欧洲隔断，与原版一致。
   ============================================================ */

import { oddrNeighbors } from '../core/geom.js';
import { RIVERS_DATA } from './rivers.js';

export const ATLAS_W = 64, ATLAS_H = 30;

// 战略资源格预设（图集全局坐标，开局写入 hex.resources）
const STRATEGIC_RESOURCES = {
  '18,14': { steel: 40, oil: 5 },       // 鲁尔/埃森
  '19,14': { steel: 35 },               // 多特蒙德
  '18,15': { steel: 30 },               // 萨尔/洛林
  '30,17': { oil: 50 },                 // 普洛耶什蒂 (罗马尼亚)
  '42,19': { oil: 60 },                 // 巴库 (高加索)
  '43,18': { oil: 40 },                 // 格罗兹尼
  '20,2':  { steel: 50, tungsten: 15 }, // 基律纳 (瑞典)
  '21,2':  { steel: 40 },
  '42,11': { steel: 40, chromium: 25, aluminum: 15 }, // 马格尼托哥尔斯克/乌拉尔
  '43,11': { steel: 30, chromium: 20 },
  '34,16': { steel: 35, aluminum: 10 }, // 顿巴斯/克里沃罗格
  '25,14': { steel: 25 },               // 西里西亚 (波兰)
  '14,13': { steel: 30 },               // 伯明翰/英格兰中部
  '12,21': { tungsten: 30 },            // 葡萄牙/西班牙
  '33,22': { chromium: 35 },            // 安纳托利亚 (土耳其)
  '56,22': { tungsten: 25, rubber: 35 } // 华南/东南亚
};

// 海峡地块（图集全局坐标：直布罗陀、博斯普鲁斯、厄勒海峡、多佛尔、苏伊士）
const STRAIT_COORDS = new Set([
  '11,24', '12,24', // 直布罗陀
  '34,21', '33,21', // 博斯普鲁斯/达达尼尔
  '21,11', '22,10', // 丹麦厄勒海峡
  '15,14', '16,14', // 多佛尔海峡
  '35,28', '36,27'  // 苏伊士
]);

/* DSL 解析：记号 = 单字符 + 可选 ':计数'；行宽必须等于 ATLAS_W */
function parseRow(spec, allow = null){
  const out = [];
  for(const tok of spec.trim().split(/\s+/)){
    const parts = tok.split(':');
    const ch = parts[0];
    if(ch.length !== 1) throw new Error(`图集记号必须是单字符：'${tok}'`);
    const n = (parts[1] === undefined || parts[1] === '') ? 1 : parseInt(parts[1], 10);
    if(!Number.isFinite(n) || n <= 0) throw new Error(`图集计数必须为正整数：'${tok}'`);
    if(allow && !allow.includes(ch)) throw new Error(`图集出现未声明记号 '${ch}'（来自 '${tok}'）`);
    for(let i = 0; i < n; i++) out.push(ch);
  }
  const row = out.join('');
  if(row.length !== ATLAS_W){
    throw new Error(`图集行宽 ${row.length} ≠ ${ATLAS_W}：'${spec.trim()}'`);
  }
  return row;
}
const lrow = (spec) => parseRow(spec, ['~', 'L']);

/* ------------------------------------------------------------
   第 1 层：陆海掩膜（手工描绘的欧洲—北非—中东海岸线 + 东亚插图）
   ------------------------------------------------------------ */
export const LAND = [
  /* r= 0  71.0N 北冰洋 / 挪威北角 */ lrow('~:6 ~:24 L:4 ~:30'),
  /* r= 1  69.6N 芬马克 / 科拉半岛 */ lrow('~:6 ~:19 L:10 ~:1 L:5 ~:23'),
  /* r= 2  68.2N 挪威北 / 瑞典芬兰北 */ lrow('~:6 ~:14 L:20 ~:24'),
  /* r= 3  66.8N 斯堪的纳维亚 / 白海 */ lrow('~:6 ~:13 L:31 ~:4 L:10'),
  /* r= 4  65.4N 波的尼亚湾以北 */ lrow('~:6 ~:11 L:33 ~:4 L:10'),
  /* r= 5  63.9N */ lrow('~:6 ~:10 L:34 ~:4 L:10'),
  /* r= 6  62.6N */ lrow('~:6 ~:8 L:36 ~:4 L:10'),
  /* r= 7  61.2N */ lrow('L:4 ~:2 ~:6 L:38 ~:4 L:10'),
  /* r= 8  59.8N 挪威南 / 瑞典 / 芬兰南 */ lrow('L:5 ~:1 ~:12 L:4 ~:1 L:4 ~:2 L:7 L:14 ~:4 L:8 ~:2'),
  /* r= 9  58.4N 苏格兰北 / 波罗的海 */ lrow('L:5 ~:1 ~:5 L:2 ~:5 L:4 ~:3 L:4 L:4 L:17 ~:4 L:8 ~:2'),
  /* r=10  56.9N 苏格兰 / 丹麦 / 瑞典南 */ lrow('L:5 ~:1 ~:4 L:3 ~:5 L:4 ~:1 L:3 ~:2 L:3 L:19 ~:4 L:8 ~:2'),
  /* r=11  55.5N 苏格兰 / 丹麦 / 波罗的海 */ lrow('L:4 ~:2 ~:4 L:4 ~:5 L:6 ~:3 L:22 ~:4 L:8 ~:2'),
  /* r=12  54.1N 英格兰北 / 荷兰 / 波兰海岸 */ lrow('L:4 ~:2 ~:4 L:5 ~:2 L:4 ~:2 L:8 L:19 ~:4 L:8 ~:2'),
  /* r=13  52.7N 爱尔兰 / 不列颠 / 低地 / 波兰 */ lrow('L:4 ~:2 ~:1 L:3 ~:1 L:4 ~:1 L:14 L:20 ~:4 L:7 ~:2 L:1'),
  /* r=14  51.3N 爱尔兰 / 不列颠南 / 比利时 */ lrow('L:4 ~:2 ~:1 L:3 ~:1 L:4 ~:1 L:14 L:20 ~:4 L:6 ~:2 L:2'),
  /* r=15  49.9N 英吉利海峡 / 北法 */ lrow('L:3 ~:3 ~:1 L:3 ~:1 L:3 ~:1 L:15 L:20 ~:4 L:6 ~:1 L:3'),
  /* r=16  48.4N 布列塔尼 / 巴伐利亚 / 奥地利 */ lrow('L:3 ~:3 ~:5 L:9 L:10 L:20 ~:4 L:7 ~:2 L:1'),
  /* r=17  47.0N 阿尔卑斯 / 喀尔巴阡 */ lrow('L:2 ~:4 ~:5 L:8 L:14 L:17 ~:4 L:6 ~:2 L:2'),
  /* r=18  45.6N 西班牙北 / 黑海 / 高加索 */ lrow('L:1 ~:5 ~:3 L:7 L:6 L:11 ~:10 L:7 ~:4 L:6 ~:2 L:2'),
  /* r=19  44.2N 亚得里亚 / 黑海 */ lrow('~:6 ~:2 L:8 L:5 ~:2 L:7 ~:13 L:7 ~:4 L:5 ~:3 L:1 ~:1'),
  /* r=20  42.9N 伊比利亚 / 意大利 / 巴尔干 */ lrow('~:6 ~:1 L:9 ~:4 L:5 ~:1 L:6 ~:11 L:7 ~:4 L:5 ~:5'),
  /* r=21  41.5N 罗马 / 安纳托利亚 */ lrow('~:6 ~:1 L:8 ~:5 L:6 ~:7 L:10 L:7 ~:4 L:5 ~:5'),
  /* r=22  40.0N 撒丁 / 西西里 / 希腊 */ lrow('~:6 ~:1 L:7 ~:6 L:1 ~:4 L:4 ~:4 L:2 ~:2 L:13 ~:4 L:5 ~:5'),
  /* r=23  38.5N 伊比利亚南 / 黎凡特 */ lrow('~:6 ~:1 L:6 ~:8 L:3 ~:4 L:3 ~:2 L:17 ~:4 L:4 ~:1 L:1 ~:4'),
  /* r=24  37.0N 北非海岸 / 塞浦路斯 */ lrow('~:6 ~:1 L:16 ~:8 L:19 ~:4 L:4 ~:1 L:1 ~:4'),
  /* r=25  35.5N 北非沿岸 / 叙利亚 */ lrow('~:6 ~:1 L:15 ~:16 L:12 ~:4 L:4 ~:6'),
  /* r=26  34.0N 撒哈拉 / 两河 */ lrow('~:6 ~:1 L:43 ~:4 L:4 ~:6'),
  /* r=27  32.6N 撒哈拉 / 波斯湾以北 */ lrow('~:6 ~:1 L:43 ~:4 L:3 ~:7'),
  /* r=28  31.2N 撒哈拉 / 波斯湾 */ lrow('~:6 ~:1 L:40 ~:7 L:3 ~:7'),
  /* r=29  29.7N 撒哈拉南缘 / 华南 */ lrow('~:6 ~:1 L:40 ~:7 L:3 ~:7')
];

/* 国界层可用的记号（海面/无主 + 国家代码） */
const CODES_WW2 = '123456789abcdefghijklmnopqrstu~';
const CODES_WW1 = '123456789abcdefghijklt~';
const ownW = (spec) => parseRow(spec, CODES_WW2.split(''));
const own1 = (spec) => parseRow(spec, CODES_WW1.split(''));

/* ------------------------------------------------------------
   第 2 层：国界层 —— 二战 1939
   1德 2意 3英 4法 5苏 6波 7匈 8罗 9南 a保 b希 c土 d挪 e瑞
   f丹 g芬 h荷 i比 j瑞士 k西 l葡 m埃 n伊拉克 o伊朗 p沙特
   q中 r日 s中共 t美 u加   '~' = 海面或无主地
   ------------------------------------------------------------ */
export const OWN_WW2 = [
  /* r= 0 */ ownW('~:6 ~:24 d:4 ~:30'),
  /* r= 1 */ ownW('~:6 ~:19 d:10 ~:1 5:5 ~:23'),
  /* r= 2 */ ownW('~:6 ~:14 d:6 e:3 g:6 5:5 ~:24'),
  /* r= 3 */ ownW('~:6 ~:13 d:6 e:6 g:5 5:14 ~:4 5:10'),
  /* r= 4 */ ownW('~:6 ~:11 d:6 e:5 g:5 5:17 ~:4 5:10'),
  /* r= 5 */ ownW('~:6 ~:10 d:6 e:5 g:6 5:17 ~:4 5:10'),
  /* r= 6 */ ownW('~:6 ~:8 d:7 e:6 g:6 5:17 ~:4 5:10'),
  /* r= 7 */ ownW('u:4 ~:2 ~:6 d:8 e:6 g:7 5:17 ~:4 5:10'),
  /* r= 8 */ ownW('u:5 ~:1 ~:12 d:4 ~:1 e:4 ~:2 g:7 5:14 ~:4 5:8 ~:2'),
  /* r= 9 */ ownW('u:5 ~:1 ~:5 3:2 ~:5 d:4 ~:3 e:4 ~:4 5:17 ~:4 5:8 ~:2'),
  /* r=10 */ ownW('u:5 ~:1 ~:4 3:3 ~:5 f:4 ~:1 e:3 ~:2 ~:3 5:19 ~:4 5:8 ~:2'),
  /* r=11 */ ownW('t:4 ~:2 ~:4 3:4 ~:5 f:4 e:2 ~:3 ~:5 5:17 ~:4 5:6 r:2 ~:2'),
  /* r=12 */ ownW('t:4 ~:2 ~:4 3:5 ~:2 h:2 1:2 ~:2 6:5 1:1 ~:4 5:17 ~:4 5:6 r:2 ~:2'),
  /* r=13 */ ownW('t:4 ~:2 ~:1 ~:3 ~:1 3:4 ~:1 h:2 1:6 6:6 5:20 ~:4 q:5 r:2 ~:2 r:1'),
  /* r=14 */ ownW('t:4 ~:2 ~:1 ~:3 ~:1 3:4 ~:1 i:2 1:7 6:5 5:20 ~:4 q:5 r:1 ~:2 r:2'),
  /* r=15 */ ownW('t:3 ~:3 ~:1 ~:3 ~:1 3:3 ~:1 4:5 1:6 6:4 5:20 ~:4 q:5 r:1 ~:1 r:3'),
  /* r=16 */ ownW('t:3 ~:3 ~:5 4:9 1:7 7:2 6:1 5:20 ~:4 q:6 r:1 ~:2 r:1'),
  /* r=17 */ ownW('t:2 ~:4 ~:5 4:8 j:1 1:3 7:4 8:5 5:18 ~:4 q:6 ~:2 r:2'),
  /* r=18 */ ownW('t:1 ~:5 ~:3 k:7 4:4 2:2 9:6 8:2 5:3 ~:10 5:7 ~:4 q:6 ~:2 r:2'),
  /* r=19 */ ownW('~:6 ~:2 k:8 4:3 2:2 ~:2 9:5 8:1 a:1 ~:13 5:7 ~:4 q:5 ~:3 r:1 ~:1'),
  /* r=20 */ ownW('~:6 ~:1 k:9 ~:4 2:5 ~:1 9:3 a:3 ~:11 5:7 ~:4 q:5 ~:5'),
  /* r=21 */ ownW('~:6 ~:1 k:8 ~:5 2:6 ~:7 c:10 5:7 ~:4 q:5 ~:5'),
  /* r=22 */ ownW('~:6 ~:1 k:7 ~:6 2:1 ~:4 2:4 ~:4 b:2 ~:2 c:10 5:3 ~:4 q:5 ~:5'),
  /* r=23 */ ownW('~:6 ~:1 k:6 ~:8 2:3 ~:4 b:3 ~:2 c:5 4:3 n:5 o:4 ~:4 q:4 ~:1 r:1 ~:4'),
  /* r=24 */ ownW('~:6 ~:1 4:16 ~:8 c:7 4:2 3:1 n:4 o:5 ~:4 q:4 ~:1 r:1 ~:4'),
  /* r=25 */ ownW('~:6 ~:1 4:15 ~:16 c:3 4:3 n:4 o:2 ~:4 q:4 ~:6'),
  /* r=26 */ ownW('~:6 ~:1 4:15 2:10 m:6 4:4 3:2 n:3 o:3 ~:4 q:4 ~:6'),
  /* r=27 */ ownW('~:6 ~:1 4:14 2:11 m:9 3:1 n:3 p:2 o:3 ~:4 q:3 ~:7'),
  /* r=28 */ ownW('~:6 ~:1 4:8 2:8 m:14 3:1 n:3 p:3 o:3 ~:7 q:3 ~:7'),
  /* r=29 */ ownW('~:6 ~:1 4:6 2:7 m:16 3:1 p:4 o:2 n:2 p:2 ~:7 q:3 ~:7')
];

/* ------------------------------------------------------------
   第 2 层（之二）：国界层 —— 一战 1914
   1德 2奥匈 3英 4法 5俄 6意 7塞尔维亚 8罗 9保 a希 b奥斯曼
   c荷 d比 e瑞士 f西 g葡 h丹 i挪 j瑞典 k黑山 l阿尔巴尼亚
   ------------------------------------------------------------ */
export const OWN_WW1 = [
  /* r= 0 */ own1('~:6 ~:24 i:4 ~:30'),
  /* r= 1 */ own1('~:6 ~:19 i:10 ~:1 5:5 ~:23'),
  /* r= 2 */ own1('~:6 ~:14 i:6 j:3 i:6 5:5 ~:24'),
  /* r= 3 */ own1('~:6 ~:13 i:6 j:6 i:5 5:14 ~:4 5:10'),
  /* r= 4 */ own1('~:6 ~:11 i:6 j:5 i:5 5:17 ~:4 5:10'),
  /* r= 5 */ own1('~:6 ~:10 i:6 j:5 i:6 5:17 ~:4 5:10'),
  /* r= 6 */ own1('~:6 ~:8 i:7 j:6 i:6 5:17 ~:4 5:10'),
  /* r= 7 */ own1('t:4 ~:2 ~:6 i:8 j:6 i:7 5:17 ~:4 5:10'),
  /* r= 8 */ own1('t:5 ~:1 ~:12 i:4 ~:1 j:4 ~:2 i:7 5:14 ~:4 5:8 ~:2'),
  /* r= 9 */ own1('t:5 ~:1 ~:5 3:2 ~:5 i:4 ~:3 j:4 ~:4 5:17 ~:4 5:8 ~:2'),
  /* r=10 */ own1('t:5 ~:1 ~:4 3:3 ~:5 h:4 ~:1 j:3 ~:5 5:19 ~:4 5:8 ~:2'),
  /* r=11 */ own1('t:4 ~:2 ~:4 3:4 ~:5 h:4 j:2 ~:8 5:17 ~:4 5:8 ~:2'),
  /* r=12 */ own1('t:4 ~:2 ~:4 3:5 ~:2 c:2 1:2 ~:2 1:6 5:21 ~:4 5:8 ~:2'),
  /* r=13 */ own1('t:4 ~:2 ~:5 3:4 ~:1 c:2 1:9 5:23 ~:13 ~:1'),
  /* r=14 */ own1('t:4 ~:2 ~:5 3:4 ~:1 d:2 1:7 5:25 ~:12 ~:2'),
  /* r=15 */ own1('t:3 ~:3 ~:5 3:3 ~:1 4:5 1:3 2:7 5:20 ~:11 ~:3'),
  /* r=16 */ own1('t:3 ~:3 ~:5 4:9 1:4 2:6 5:20 ~:13 ~:1'),
  /* r=17 */ own1('t:2 ~:4 ~:5 4:8 e:1 1:3 2:4 8:5 5:18 ~:12 ~:2'),
  /* r=18 */ own1('t:1 ~:5 ~:3 f:7 4:4 6:2 2:4 8:4 5:3 ~:10 5:7 ~:12 ~:2'),
  /* r=19 */ own1('~:6 ~:2 f:8 4:3 6:2 ~:2 2:3 7:2 8:1 9:1 ~:13 5:7 ~:13 ~:1'),
  /* r=20 */ own1('~:6 ~:1 f:9 ~:4 6:5 ~:1 7:2 9:4 ~:11 5:7 ~:9 ~:5'),
  /* r=21 */ own1('~:6 ~:1 f:8 ~:5 6:6 ~:7 b:10 5:7 ~:9 ~:5'),
  /* r=22 */ own1('~:6 ~:1 f:7 ~:6 6:1 ~:4 6:4 ~:4 a:2 ~:2 b:10 5:3 ~:9 ~:5'),
  /* r=23 */ own1('~:6 ~:1 f:6 ~:8 6:3 ~:4 a:3 ~:2 b:17 ~:10 ~:4'),
  /* r=24 */ own1('~:6 ~:1 4:16 ~:8 b:19 ~:14'),
  /* r=25 */ own1('~:6 ~:1 4:12 6:3 ~:16 b:12 ~:8 ~:6'),
  /* r=26 */ own1('~:6 ~:1 4:12 6:13 b:15 3:3 ~:8 ~:6'),
  /* r=27 */ own1('~:6 ~:1 4:11 6:14 b:15 3:3 ~:7 ~:7'),
  /* r=28 */ own1('~:6 ~:1 4:8 6:11 b:18 3:3 ~:10 ~:7'),
  /* r=29 */ own1('~:6 ~:1 4:6 6:10 b:21 3:3 ~:10 ~:7')
];

/* ------------------------------------------------------------
   手工地形补丁：[地形, 行起, 行止, 列起, 列止]，后声明者覆盖先声明者
   ------------------------------------------------------------ */
const PATCHES = [
  // —— 山脉 ——
  ['mount', 2, 9, 12, 17],           // 斯堪的纳维亚山脉
  ['mount', 16, 18, 13, 18],         // 阿尔卑斯
  ['mount', 18, 18, 10, 11],         // 比利牛斯
  ['mount', 20, 21, 15, 17],         // 亚平宁
  ['mount', 16, 18, 21, 25],         // 喀尔巴阡
  ['mount', 19, 21, 18, 21],         // 迪纳拉山地
  ['mount', 18, 21, 37, 42],         // 高加索
  ['mount', 1, 8, 42, 43],           // 乌拉尔
  ['mount', 21, 23, 33, 37],         // 托罗斯山
  ['mount', 22, 25, 41, 43],         // 扎格罗斯
  ['mount', 20, 24, 48, 50],         // 横断山
  ['mount', 14, 20, 56, 57],         // 日本列岛
  // —— 丘陵 ——
  ['hills', 8, 10, 10, 18],          // 斯堪的纳维亚东部
  ['hills', 19, 22, 1, 8],           // 伊比利亚高原
  ['hills', 19, 20, 11, 12],         // 法国中央高原
  ['hills', 19, 22, 14, 22],         // 意大利半岛
  ['hills', 19, 19, 21, 25],         // 特兰西瓦尼亚
  ['hills', 22, 24, 20, 25],         // 希腊山地
  ['hills', 20, 24, 27, 38],         // 安纳托利亚高原
  ['hills', 21, 27, 39, 43],         // 伊朗高原
  ['hills', 14, 19, 48, 51],         // 中国西南
  ['hills', 12, 18, 53, 54],         // 朝鲜半岛
  // —— 森林 ——
  ['forest', 3, 7, 27, 43],          // 北俄泰加林
  ['forest', 8, 11, 30, 43],         // 中俄混交林
  ['forest', 12, 15, 27, 35],        // 白俄罗斯—北乌克兰
  ['forest', 9, 12, 15, 26],         // 波罗的海与波兰
  ['forest', 13, 15, 11, 17],        // 德国中部
  ['forest', 17, 20, 5, 9],          // 法国阿基坦
  ['forest', 3, 7, 48, 53],          // 西伯利亚针叶林（东亚插图）
  // —— 沼泽 ——
  ['marsh', 12, 13, 24, 27],         // 普里皮亚季沼泽
  ['marsh', 26, 26, 30, 33],         // 尼罗河三角洲
  // —— 沙漠 ——
  ['desert', 22, 29, 1, 25],         // 撒哈拉
  ['desert', 23, 29, 26, 40],        // 利比亚—埃及—阿拉伯
  ['desert', 11, 13, 48, 51],        // 戈壁
  ['desert', 14, 16, 48, 50],
  // —— 北非沿海农业带（覆盖沙漠）——
  ['plain', 25, 25, 1, 15]
];

/* 地形查询：后声明覆盖先声明 */
export function atlasTerrainOf(q, r){
  let t = null;
  for(const [kind, r0, r1, q0, q1] of PATCHES){
    if(r >= r0 && r <= r1 && q >= q0 && q <= q1) t = kind;
  }
  return t;
}

/* 确定性散列：同一 (q,r) 永远得到同一值，禁用 Math.random */
function hash2(q, r){
  let h = (q * 374761393 + r * 668265263) >>> 0;
  h = ((h ^ (h >>> 13)) * 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function atlasIsSea(q, r){
  if(r < 0 || r >= ATLAS_H || q < 0 || q >= ATLAS_W) return true;
  return LAND[r][q] === '~';
}

/* ------------------------------------------------------------
   由图集构建地图：{ own, cities, terrainOverrides, crop, remap }
   - own : 国界层字符串数组（长度 ATLAS_H）
   - cities : [{ name,q,r,owner,w,cap,fort,energy }]
   - terrainOverrides : { 'q,r': 'mount' } 城池/要塞等强制地形
   - crop : { q0, q1, r0, r1 } 只取图集的一块（一战只需欧陆段，不含东亚插图）
   - remap : { '1':'G' } 把图集代码换成剧本自家国家代码
   ------------------------------------------------------------ */
export function buildFromAtlas(opts){
  const {
    own: ownLayer, cities = [], terrainOverrides = {},
    crop = null, remap = null
  } = opts || {};
  const q0 = crop ? crop.q0 : 0, q1 = crop ? crop.q1 : ATLAS_W - 1;
  const r0 = crop ? crop.r0 : 0, r1 = crop ? crop.r1 : ATLAS_H - 1;
  const hexes = [], at = {};
  let idx = 0;

  for(let r = r0; r <= r1; r++){
    for(let q = q0; q <= q1; q++){
      const key = q + ',' + r;
      const isSea = LAND[r][q] === '~';
      const rawOwn = (ownLayer && ownLayer[r]) ? ownLayer[r][q] : '~';
      let owner = (isSea || rawOwn === '~') ? 'N' : rawOwn;
      if(remap && remap[owner]) owner = remap[owner];

      let terrain = 'plain';
      if(isSea){
        terrain = 'sea';
      }else{
        const patched = atlasTerrainOf(q, r);
        if(patched) terrain = patched;
        else {
          const h = hash2(q, r);
          if(h < 0.16) terrain = 'forest';
          else if(h < 0.24) terrain = 'hills';
        }
        if(terrainOverrides[key]) terrain = terrainOverrides[key];
      }

      let climate = 'temperate';
      if(isSea){
        climate = 'ocean';
      } else if(r <= 6){
        climate = 'arctic';
      } else if(terrain === 'desert' || (r >= 25 && q <= 48)){
        climate = 'arid';
      } else if(r >= 20 && r <= 24 && q >= 10 && q <= 40){
        climate = 'mediterranean';
      } else if(r >= 26 && q >= 52){
        climate = 'tropical';
      }

      const isStrait = STRAIT_COORDS.has(key);
      const res = STRATEGIC_RESOURCES[key] ? { ...STRATEGIC_RESOURCES[key] } : null;

      const h = {
        // 坐标重定位到裁剪后的局部网格：相机/行省/命中测试都无需知道图集
        idx: idx++, i: idx - 1, q: q - q0, r: r - r0,
        owner, terrain, climate,
        city: null, civ: 0, mil: 0, infra: 1, fort: 0,
        river: null, strait: isStrait, units: [],
        railLevel: 0,
        resources: res,
        naval_base: 0,
        vp: 0,
        econValue: terrain === 'sea' ? 0 : 3,
        pop: terrain === 'sea' ? 0 : 200000,
        energy: 0, unrest: 0
      };
      hexes.push(h);
      at[h.q + ',' + h.r] = h;
    }
  }

  // 邻接（跳过海洋 —— 海洋不是可通行节点）
  for(const h of hexes){
    h.adj = oddrNeighbors(h.q, h.r)
      .map(([nq, nr]) => at[nq + ',' + nr])
      .filter((nh) => nh && nh.terrain !== 'sea')
      .map((nh) => nh.i);
  }

  // 城市落位（改城市地形 + 给工厂）
  for(const c of cities){
    if(c.q < q0 || c.q > q1 || c.r < r0 || c.r > r1) continue;
    const h = at[(c.q - q0) + ',' + (c.r - r0)];
    if(!h || h.terrain === 'sea') continue;
    // cap 也要走同一套 remap：剧本 A 用 G/P/F/S/B/H 单字母，城市表写的是
    // GER/FRA 这类三字母，漏映射会让 capHex() 永远找不到首都 → 该国 0 兵
    let capCode = c.cap || null;
    if(capCode && remap && remap[capCode]) capCode = remap[capCode];
    h.city = { name: c.name, w: c.w, cap: capCode };
    h.terrain = 'city';
    h.vp = c.w;
    let o = c.owner;
    if(remap && remap[o]) o = remap[o];
    if(o) h.owner = o;
    h.econValue = Math.max(h.econValue, c.w * 2);
    if(c.fort) h.fort = c.fort;
    // v12.1：首都默认要塞化（fort 2）—— 首都不该是裸城，2 个守军师靠工事
    // 才能撑住敌军主力轮攻，否则敌军破防后几天就兵临城下
    if(capCode) h.fort = Math.max(h.fort || 0, 2);
    if(c.energy) h.energy = c.energy;

    // 人口与铁路等级
    h.pop = 200000 + (c.w || 1) * 300000;
    if(capCode){
      h.railLevel = 3;
    } else if(c.w >= 3){
      h.railLevel = 2;
    } else {
      h.railLevel = 1;
    }
  }
  for(const h of hexes){
    if(!h.city) continue;
    if(h.city.cap){ h.civ += 4; h.mil += 3; }
    else if(h.city.w >= 3){ h.civ += 2; h.mil += 1; }
  }

  // 沿海港口与海军基地判定
  for(const h of hexes){
    if(!h.city || h.terrain === 'sea') continue;
    const isCoastal = oddrNeighbors(h.q, h.r)
      .some(([nq, nr]) => {
        const nh = at[nq + ',' + nr];
        return !nh || nh.terrain === 'sea';
      });
    if(isCoastal){
      const portLv = Math.min(5, Math.max(1, Math.round(h.city.w || 2)));
      h.naval_base = portLv;
      h.buildings = h.buildings || {};
      h.buildings.naval_base = portLv;
    }
  }

  // 战术水系河流标记
  for(const r of RIVERS_DATA){
    for(const edge of r.edges){
      for(const pt of [[edge[0], edge[1]], [edge[2], edge[3]]]){
        const k = (pt[0] - q0) + ',' + (pt[1] - r0);
        const h = at[k];
        if(h && h.terrain !== 'sea'){
          h.river = r.name;
        }
      }
    }
  }

  // crop 偏移一并返回：城市表写的是图集坐标，消费方需要它换算成地图局部坐标
  return { hexes, at, crop: { q0, r0 } };
}

/* 统计辅助：陆地格数 / 各国格数（测试与调试用） */
export function atlasStats(ownLayer){
  const byNat = {};
  let land = 0;
  for(let r = 0; r < ATLAS_H; r++){
    for(let q = 0; q < ATLAS_W; q++){
      if(LAND[r][q] === '~') continue;
      land++;
      const c = (ownLayer && ownLayer[r]) ? ownLayer[r][q] : '~';
      byNat[c] = (byNat[c] || 0) + 1;
    }
  }
  return { land, byNat };
}
