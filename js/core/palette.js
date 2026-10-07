/* ============================================================
   core/palette.js —— 国家配色可读性处理（v11.0）
   ------------------------------------------------------------
   动因：政治地图把国家色以 globalAlpha 0.36 叠在深色地形纹理上，
   于是原本为浅色底设计的几个颜色在图上等于消失：
     · 德国 #333333 —— 近乎纯黑，柏林一带看不出国界
     · 法国 #1e3f66 —— 与海面同色系，西线糊成一片
   另有一组国家挤在同一个红色里（英国 #b22222 / 苏联 #8b0000 /
   日本 #c4302b / 中共 #c8102e / 土耳其 #ba2b2b），东亚三家尤其分不开。

   做法：
   1) `readableNationColor` 把任意颜色夹到「深色底上看得见」的明度/饱和度
      区间 —— 规则化处理，任何新增国家自动受益；
   2) `NATION_COLOR_OVERRIDES` 手工拆开冲突的红色族与蓝色族，保证
      相邻国家色相互相可分。
   ============================================================ */

/* 明度下限：低于此值的颜色在深色底上等于隐形 */
const MIN_L = 0.42;
/* 明度上限：过高会与雪地/沙漠地形覆层混淆 */
const MAX_L = 0.68;
/* 饱和度下限：保证不是一片灰 */
const MIN_S = 0.28;

function hexToRgb(hex){
  let h = String(hex || '').trim().replace('#', '');
  if(h.length === 3) h = h.split('').map((c) => c + c).join('');
  if(h.length !== 6) return null;
  const n = parseInt(h, 16);
  if(Number.isNaN(n)) return null;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex(r, g, b){
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}
function rgbToHsl(r, g, b){
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if(max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if(max === r) h = ((g - b) / d + (g < b ? 6 : 0));
  else if(max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h / 6, s, l];
}
function hueToRgb(p, q, t){
  if(t < 0) t += 1;
  if(t > 1) t -= 1;
  if(t < 1 / 6) return p + (q - p) * 6 * t;
  if(t < 1 / 2) return q;
  if(t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}
function hslToRgb(h, s, l){
  if(s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hueToRgb(p, q, h + 1 / 3) * 255, hueToRgb(p, q, h) * 255, hueToRgb(p, q, h - 1 / 3) * 255];
}

/** 把颜色夹进「深色底上可读」的明度/饱和度区间；非法输入原样返回 */
export function readableNationColor(hex){
  const rgb = hexToRgb(hex);
  if(!rgb) return hex || '#888888';
  let [h, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2]);
  // 近灰色（如德国的 #333）保留灰调，但抬到浅钢灰，避免变成彩色
  const nearGrey = s < 0.15;
  s = nearGrey ? Math.min(s, 0.16) : Math.max(s, MIN_S);
  l = Math.max(MIN_L, Math.min(MAX_L, l));
  const out = hslToRgb(h, s, l);
  return rgbToHex(out[0], out[1], out[2]);
}

/* 手工拆色：同一色族的相邻国家必须能分开 */
export const NATION_COLOR_OVERRIDES = {
  // —— 红色族（原稿 6 国共用一个红）——
  SOV: '#c0392b',   // 苏联：正红（面积最大，保留正统红）
  GBR: '#a0522d',   // 英国：赭石棕红，与苏联拉开明度
  JPN: '#e0677a',   // 日本：珊瑚粉红
  CCP: '#e8722e',   // 中共：赤橙
  TUR: '#b8544a',   // 土耳其：暗鲑红
  DEN: '#c46aa8',   // 丹麦：兰紫
  SWZ: '#b09a7a',   // 瑞士：灰褐

  // —— 蓝色族 ——
  GER: '#7d8b9c',   // 德国：浅钢灰（既保留原野灰观感，又能看见）
  FRA: '#4b84d6',   // 法国：宝蓝
  CHN: '#3f8f8f',   // 中国：青蓝
  USA: '#5b9bd5',   // 美国：天蓝
  CAN: '#a06a8f',   // 加拿大：藕紫
  SWE: '#79a8d9',   // 瑞典：浅蓝
  NOR: '#6f89b5',   // 挪威：灰蓝
  FIN: '#86c4a8',   // 芬兰：薄荷

  // —— 其他补色 ——
  ITA: '#5aa469',
  POL: '#d98a9e',
  HUN: '#9a8f4a',
  ROM: '#c98f4a',
  YUG: '#8577c9',
  BUL: '#8f7f5a',
  GRE: '#52b3a4',
  NLD: '#e8944a',
  BEL: '#d9b84a',
  SPN: '#d9a83d',
  POR: '#8f9a5a',
  EGY: '#c9b06a',
  IRQ: '#a88f5a',
  IRN: '#7f9a8f',
  SAU: '#b8a06a',
  // 一战代码
  AUS: '#c9a24a',
  OTT: '#9a6d4a',
  RUS: '#c0392b',
  SRB: '#8f9a55',
  MNE: '#b07aa1',
  // 现代/冷战三字码
  GER_W: '#7d8b9c',
  GER_E: '#c0392b',
  CZE: '#d9b84a',
  PRK: '#e8722e',
  KOR: '#5b9bd5',
  VNM: '#c0392b',
  CUB: '#a0522d',
  ISR: '#5b9bd5',
  IND: '#e8944a',
  AFG: '#9a8f4a',
  ZAF: '#c98f4a',
  BRA: '#5aa469',
  UKR: '#d9c04a',
  RUS_MOD: '#c0392b'
};

/** 取某国最终可读配色：先查手工表，再走规则化夹取 */
export function nationColor(natId, fallbackHex){
  if(natId && NATION_COLOR_OVERRIDES[natId]) return NATION_COLOR_OVERRIDES[natId];
  return readableNationColor(fallbackHex);
}

/* 中立国 / 无主地：深色底上应当是柔和灰，而不是近黑 */
export const NEUTRAL_COLOR = '#7b8290';
