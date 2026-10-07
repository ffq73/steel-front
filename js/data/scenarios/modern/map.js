/* ============================================================
   data/scenarios/modern/map.js —— 现代「多极危机 2022」宏观战略战区地图
   规格：24×12 = 288 格（陆地 ~200 格）
   精细刻画乌俄主前线（基辅、哈尔科夫、顿巴斯、扎波罗热、赫尔松、克里米亚）、
   中东（伊朗、以色列、波斯湾、红海）与西太平洋（台海、日本、西太平洋基地）
   ============================================================ */

import { oddrNeighbors } from '../../../core/geom.js';

const MODERN_MAP_W = 24, MODERN_MAP_H = 12;


// 大洋掩码（大西洋中段、太平洋中深海、印度洋深海）
const MODERN_SEA_SET = new Set([
  '0,0','0,1','0,2','0,9','0,10','0,11',
  '1,0','1,1','1,2','1,10','1,11',
  '2,0','2,1','2,11',
  '6,0','7,0','8,0','9,0',
  '10,11','11,11','12,11','13,11',
  '22,0','22,1','22,10','22,11','23,0','23,1','23,10','23,11'
]);

export const MODERN_CITIES = [
  // 乌俄核心火线城市（精细划分）
  { name:'基辅',       q:7,  r:3,  owner:'UKR', w:5, cap:'UKR' },
  { name:'哈尔科夫',   q:8,  r:3,  owner:'UKR', w:4 },
  { name:'顿涅茨克',   q:9,  r:4,  owner:'RUS', w:4 },
  { name:'马里乌波尔', q:8,  r:5,  owner:'RUS', w:3 },
  { name:'赫尔松',     q:7,  r:5,  owner:'UKR', w:3 },
  { name:'扎波罗热',   q:8,  r:4,  owner:'UKR', w:3 },
  { name:'敖德萨',     q:6,  r:5,  owner:'UKR', w:4 },
  { name:'利沃夫',     q:6,  r:3,  owner:'UKR', w:3 },
  { name:'塞瓦斯托波尔',q:7, r:6,  owner:'RUS', w:4 }, // 克里米亚
  { name:'莫斯科',     q:10, r:2,  owner:'RUS', w:5, cap:'RUS' },
  { name:'圣彼得堡',   q:9,  r:1,  owner:'RUS', w:4 },
  { name:'别尔哥罗德', q:9,  r:3,  owner:'RUS', w:3 },
  { name:'顿河畔罗斯托夫',q:10,r:4,owner:'RUS', w:4 },

  // 西欧与北约核心
  { name:'华沙',       q:5,  r:3,  owner:'POL', w:4, cap:'POL' },
  { name:'柏林',       q:4,  r:2,  owner:'GER', w:4, cap:'GER' },
  { name:'巴黎',       q:3,  r:3,  owner:'FRA', w:4, cap:'FRA' },
  { name:'伦敦',       q:3,  r:2,  owner:'GBR', w:5, cap:'GBR' },
  { name:'明斯克',     q:7,  r:2,  owner:'BLR', w:3, cap:'BLR' },

  // 北美核心
  { name:'华盛顿',     q:1,  r:4,  owner:'USA', w:5, cap:'USA' },

  // 中东战区
  { name:'特拉维夫',   q:9,  r:7,  owner:'ISR', w:4, cap:'ISR' },
  { name:'德黑兰',     q:12, r:6,  owner:'IRN', w:5, cap:'IRN' },
  { name:'伊斯法罕',   q:12, r:7,  owner:'IRN', w:3 },
  { name:'利雅得',     q:11, r:8,  owner:'SAU', w:4, cap:'SAU' },

  // 亚太战区
  { name:'北京',       q:18, r:3,  owner:'CHN', w:5, cap:'CHN' },
  { name:'上海',       q:19, r:5,  owner:'CHN', w:5 },
  { name:'东京',       q:21, r:4,  owner:'JPN', w:5, cap:'JPN' },
  { name:'首尔',       q:19, r:4,  owner:'KOR', w:4, cap:'KOR' },
  { name:'平壤',       q:19, r:3,  owner:'PRK', w:3, cap:'PRK' }
];

export function buildModernMap(){
  const hexes = [];
  const at = {};

  const getOwner = (q, r) => {
    // 美国本土与大西洋基地
    if(q <= 2 && r >= 3 && r <= 6) return 'USA';

    // 欧洲大西洋与西欧
    if(q === 3 && r <= 2) return 'GBR';
    if(q === 3 && (r === 3 || r === 4)) return 'FRA';
    if(q === 4 && (r === 2 || r === 3)) return 'GER';
    if(q === 5 && (r >= 2 && r <= 4)) return 'POL';
    if(q === 7 && r === 2) return 'BLR';

    // 乌克兰前沿防区
    if(q === 6 && (r >= 3 && r <= 5)) return 'UKR';
    if(q === 7 && (r === 3 || r === 4 || r === 5)) return 'UKR';
    if(q === 8 && (r === 3 || r === 4)) return 'UKR';

    // 俄罗斯防区与本土
    if(q === 7 && r === 6) return 'RUS'; // 克里米亚
    if(q === 8 && r === 5) return 'RUS'; // 顿巴斯沿海
    if(q === 9 && (r >= 1 && r <= 5)) return 'RUS';
    if(q >= 10 && q <= 11 && r <= 5) return 'RUS';

    // 中东战区
    if(q === 9 && r >= 6 && r <= 7) return 'ISR';
    if((q === 10 || q === 11) && r >= 7 && r <= 9) return 'SAU';
    if(q >= 12 && q <= 14 && r >= 6 && r <= 8) return 'IRN';

    // 亚太战区
    if(q >= 15 && q <= 18 && r >= 2 && r <= 6) return 'CHN';
    if(q === 19 && r === 3) return 'PRK';
    if(q === 19 && r === 4) return 'KOR';
    if(q >= 20 && q <= 21 && r >= 3 && r <= 6) return 'JPN';

    return 'RUS'; // 默认腹地
  };

  let idx = 0;
  for(let r = 0; r < MODERN_MAP_H; r++){
    for(let q = 0; q < MODERN_MAP_W; q++){

      const key = q + ',' + r;
      const isSea = MODERN_SEA_SET.has(key);
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
        civ: 2,
        mil: 2,
        infra: 3,
        fort: 0,
        river: null,
        strait: false,
        units: [],
        vp: 0,
        econValue: terrain === 'sea' ? 0 : 6,
        pop: terrain === 'sea' ? 0 : 25,
        energy: 2,
        unrest: 0
      };

      // 现代前线工事
      if(q === 8 && r === 4) hex.fort = 2; // 顿巴斯接触线长期筑垒区
      if(q === 12 && r === 7) hex.energy = 8; // 伊朗油气重地

      hexes.push(hex);
      at[key] = hex;
      idx++;
    }
  }

  // 部署现代战区城市
  for(const c of MODERN_CITIES){
    const h = at[c.q + ',' + c.r];
    if(h && h.terrain !== 'sea'){
      h.city = { name: c.name, w: c.w, cap: c.cap || null };
      h.vp = c.w;
      h.owner = c.owner;
      h.econValue = c.w * 4;
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
