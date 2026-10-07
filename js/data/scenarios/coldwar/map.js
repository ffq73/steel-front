/* ============================================================
   data/scenarios/coldwar/map.js —— 冷战全球战略区宏观地图
   规格：26×12 = 312 格（陆地战略区 ~240 格）
   1 格 = 1 战略大区/主权国家，覆盖美苏两极、欧洲前线、亚太与第三世界
   ============================================================ */

import { oddrNeighbors } from '../../../core/geom.js';

const COLDWAR_MAP_W = 26, COLDWAR_MAP_H = 12;


// 全球大洋掩码（太平洋、大西洋、印度洋深海）
const COLDWAR_SEA_SET = new Set([
  // 大西洋中深海
  '3,1','3,2','3,3','4,1','4,2','4,3',
  // 太平洋中深海
  '0,0','0,1','0,2','0,9','0,10','0,11',
  '24,0','24,1','24,10','24,11','25,0','25,1','25,10','25,11',
  // 印度洋深海
  '12,10','12,11','13,10','13,11','14,10','14,11','15,10','15,11',
  // 北冰洋极地
  '7,0','8,0','9,0','10,0','11,0','12,0','13,0','14,0','15,0','16,0','17,0','18,0'
]);

export const COLDWAR_CITIES = [
  // 超级大国与核心盟邦
  { name:'华盛顿',     q:2,  r:4,  owner:'USA', w:5, cap:'USA' },
  { name:'纽约',       q:2,  r:3,  owner:'USA', w:4 },
  { name:'莫斯科',     q:11, r:3,  owner:'SOV', w:5, cap:'SOV' },
  { name:'列宁格勒',   q:11, r:2,  owner:'SOV', w:4 },
  { name:'伦敦',       q:5,  r:2,  owner:'GBR', w:4, cap:'GBR' },
  { name:'巴黎',       q:5,  r:4,  owner:'FRA', w:4, cap:'FRA' },
  { name:'波恩',       q:6,  r:3,  owner:'GER_W', w:4, cap:'GER_W' },
  { name:'东柏林',     q:7,  r:3,  owner:'GER_E', w:4, cap:'GER_E' },
  { name:'北京',       q:18, r:4,  owner:'CHN', w:5, cap:'CHN' },
  { name:'东京',       q:22, r:4,  owner:'JPN', w:4, cap:'JPN' },

  { name:'罗马',       q:6,  r:5,  owner:'ITA', w:3, cap:'ITA' },
  { name:'渥太华',     q:2,  r:2,  owner:'CAN', w:3, cap:'CAN' },
  { name:'利雅得',     q:10, r:7,  owner:'SAU', w:3, cap:'SAU' },
  { name:'比勒陀利亚', q:9,  r:8,  owner:'ZAF', w:3, cap:'ZAF' },

  // 危机与热点前线
  { name:'哈瓦那',     q:2,  r:6,  owner:'CUB', w:4, cap:'CUB' },
  { name:'首尔',       q:20, r:4,  owner:'KOR', w:3, cap:'KOR' },
  { name:'平壤',       q:20, r:3,  owner:'PRK', w:3, cap:'PRK' },
  { name:'西贡',       q:19, r:7,  owner:'VNM', w:3 },
  { name:'河内',       q:19, r:6,  owner:'VNM', w:3, cap:'VNM' },
  { name:'开罗',       q:8,  r:6,  owner:'EGY', w:3, cap:'EGY' },
  { name:'耶路撒冷',   q:9,  r:6,  owner:'ISR', w:3, cap:'ISR' },
  { name:'德黑兰',     q:11, r:6,  owner:'IRN', w:3, cap:'IRN' },
  { name:'喀布尔',     q:14, r:5,  owner:'AFG', w:3, cap:'AFG' },
  { name:'布拉格',     q:7,  r:4,  owner:'CZE', w:3, cap:'CZE' },
  { name:'布达佩斯',   q:8,  r:4,  owner:'HUN', w:3, cap:'HUN' },
  { name:'华沙',       q:8,  r:3,  owner:'POL', w:3, cap:'POL' },
  { name:'贝尔格莱德', q:8,  r:5,  owner:'YUG', w:3, cap:'YUG' },
  { name:'德里',       q:16, r:6,  owner:'IND', w:4, cap:'IND' },
  { name:'巴西利亚',   q:3,  r:9,  owner:'BRA', w:3, cap:'BRA' }
];

export function buildColdWarMap(){
  const hexes = [];
  const at = {};

  const getOwner = (q, r) => {
    // 北美 (USA / CAN)
    if(q <= 2 && r <= 2) return 'CAN';
    if(q <= 2 && r >= 3 && r <= 5) return 'USA';
    // 拉美 (CUB / BRA / MEX)
    if(q <= 2 && r === 6) return 'CUB';
    if(q <= 3 && r >= 7) return 'BRA';

    // 西欧北约核心
    if(q === 5 && r <= 3) return 'GBR';
    if(q === 5 && r >= 4 && r <= 5) return 'FRA';
    if(q === 6 && r <= 4) return 'GER_W';
    if(q === 6 && r === 5) return 'ITA';

    // 东欧华约前沿
    if(q === 7 && r === 3) return 'GER_E';
    if(q === 7 && r === 4) return 'CZE';
    if(q === 8 && r === 3) return 'POL';
    if(q === 8 && r === 4) return 'HUN';
    if(q === 8 && r === 5) return 'YUG';

    // 中东与北非
    if((q === 7 || q === 8) && r >= 6 && r <= 7) return 'EGY';
    if(q === 9 && r === 6) return 'ISR';
    if(q === 10 && r >= 6 && r <= 7) return 'SAU';
    if(q === 11 && r === 6) return 'IRN';
    if(q >= 7 && q <= 9 && r >= 8) return 'ZAF';

    // 苏联超级大国腹地
    if(q >= 9 && q <= 15 && r <= 4) return 'SOV';
    if(q === 14 && r === 5) return 'AFG';

    // 亚太与南亚
    if(q >= 15 && q <= 16 && r >= 6 && r <= 7) return 'IND';
    if(q >= 16 && q <= 18 && r >= 3 && r <= 5) return 'CHN';
    if(q === 19 && (r === 6 || r === 7)) return 'VNM';
    if(q === 20 && r === 3) return 'PRK';
    if(q === 20 && r === 4) return 'KOR';
    if(q >= 21 && q <= 23 && r <= 5) return 'JPN';

    return 'SOV'; // 默认腹地
  };

  let idx = 0;
  for(let r = 0; r < COLDWAR_MAP_H; r++){
    for(let q = 0; q < COLDWAR_MAP_W; q++){

      const key = q + ',' + r;
      const isSea = COLDWAR_SEA_SET.has(key);
      const owner = isSea ? 'N' : getOwner(q, r);
      const terrain = isSea ? 'sea' : 'plain';

      const hex = {
        i: idx,
        idx: idx,
        q,
        r,
        owner,
        terrain,
        city: null,
        civ: 1,
        mil: 1,
        infra: 2,
        fort: 0,
        river: null,
        strait: false,
        units: [],
        vp: 0,
        econValue: terrain === 'sea' ? 0 : 5,
        pop: terrain === 'sea' ? 0 : 20,
        energy: 2,
        unrest: 0
      };

      hexes.push(hex);
      at[key] = hex;
      idx++;
    }
  }

  // 部署战略城市
  for(const c of COLDWAR_CITIES){
    const h = at[c.q + ',' + c.r];
    if(h && h.terrain !== 'sea'){
      h.city = { name: c.name, w: c.w, cap: c.cap || null };
      h.vp = c.w;
      h.owner = c.owner;
      h.econValue = c.w * 3;
    }
  }

  // 邻接计算
  for(const h of hexes){
    h.adj = oddrNeighbors(h.q, h.r)
      .map(([nq, nr]) => at[nq + ',' + nr])
      .filter(nh => nh && nh.terrain !== 'sea')
      .map(nh => nh.i);
  }

  return { hexes, at };
}
