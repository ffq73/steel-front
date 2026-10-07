/* ============================================================
   data/theaters.js —— 战区命名（v11.0）
   ------------------------------------------------------------
   玩家诉求：「把各个国家的大致轮廓描述出来，也方便进行战区的分划」。
   地图放大到 58×30 之后，一条国境线会长到十几个格，光靠「前线 A / 前线 B」
   玩家分不清哪条是西线、哪条是北非。这里按**前线所覆盖的地区**给它起名：

     · 取该段前线的几何中心
     · 找最近的命名城市（首都/大城市权重更高）
     · 组合成「西线（巴黎方向）」这样的战区名

   纯函数、无副作用；plans.js 建前线时调用一次，名字存进 front.name。
   ============================================================ */

import { hexDist } from '../core/geom.js';

/* 方位词：按中心格相对国都的方位选一个前缀 */
const COMPASS = [
  { key: 'north', name: '北线' },
  { key: 'south', name: '南线' },
  { key: 'east',  name: '东线' },
  { key: 'west',  name: '西线' }
];

function compassOf(capital, cq, cr){
  if(!capital) return null;
  const dq = cq - capital.q;
  const dr = cr - capital.r;
  // 纬度差优先（南北比东西更能决定「战线气质」）
  // 平手时优先东西：欧陆战线绝大多数是南北走向的「东线/西线」，
  // 拿南北当默认会把波德边境叫成「南线」
  if(Math.abs(dr) > Math.abs(dq)) return dr < 0 ? 'north' : 'south';
  return dq > 0 ? 'east' : 'west';
}

/** 给一组前线格起一个可读的战区名 */
export function theaterNameFor(world, hexIdxs){
  if(!world || !hexIdxs || !hexIdxs.length) return '未命名战区';
  const hexes = hexIdxs.map((i) => world.hexes[i]).filter(Boolean);
  if(!hexes.length) return '未命名战区';

  // 几何中心
  let sq = 0, sr = 0;
  for(const h of hexes){ sq += h.q; sr += h.r; }
  const nq = Math.round(sq / hexes.length), nr = Math.round(sr / hexes.length);

  const natId = hexes[0].owner;
  const capital = world.hexes.find((h) => h.city && h.city.cap === natId) || null;
  const dir = COMPASS.find((c) => c.key === compassOf(capital, nq, nr));

  // 锚点城市 = 战线正前方的**敌方**城市。己方后方的城市名对前线没有指示意义。
  // 注：柏林距 1939 年波德边境在本图上只有约 1 格，所以不能拿「离首都很近」
  // 当卫戍圈的判据 —— 那样整条东线都会被叫成「柏林卫戍圈」。
  const enemies = (world.nations[natId] && world.nations[natId].atWarWith) || [];
  let best = null, bestScore = Infinity;
  for(const h of world.hexes){
    if(!h.city || h.owner === natId) continue;
    if(!enemies.includes(h.owner)) continue;   // 只认交战国城市，中立国城市不作锚点
    const score = hexDist(nq, nr, h.q, h.r) - (h.city.w || 1) * 0.2;
    if(score < bestScore){ bestScore = score; best = h; }
  }
  if(best){
    const anchor = `${best.city.name}方向`;
    return dir ? `${dir.name}（${anchor}）` : `战区（${anchor}）`;
  }

  // 找不到敌方城市（已被打光 / 全向被围）：退回首都卫戍圈或纯坐标
  if(capital && hexDist(nq, nr, capital.q, capital.r) <= 2){
    return `${capital.city.name}卫戍圈`;
  }
  return dir ? `${dir.name}（坐标 ${nq},${nr}）` : `战区（坐标 ${nq},${nr}）`;
}

/** 把一组前线格按连通性切成若干段（同一段才会共享一个战区名） */
export function splitFrontSegments(world, hexIdxs){
  const set = new Set(hexIdxs);
  const seen = new Set();
  const segs = [];
  for(const start of hexIdxs){
    if(seen.has(start)) continue;
    const stack = [start];
    seen.add(start);
    const seg = [];
    while(stack.length){
      const idx = stack.pop();
      seg.push(idx);
      const h = world.hexes[idx];
      if(!h) continue;
      for(const ni of h.adj){
        if(set.has(ni) && !seen.has(ni)){ seen.add(ni); stack.push(ni); }
      }
    }
    segs.push(seg);
  }
  // 长的排前面，玩家先看到主战线
  segs.sort((a, b) => b.length - a.length);
  return segs;
}
