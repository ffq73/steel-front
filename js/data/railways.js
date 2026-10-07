/* ============================================================
   data/railways.js —— 战术铁路网与补给枢纽系统 (v7.0 §3.3 / v11.0 重写)
   1. 铁路网：由**地图上的城市自动生成**（每城连最近的两座城）
   2. 补给枢纽：由城市等级自动派生（首都 = 3 级总枢纽，大城市 = 补给站）
   3. 断供状态判定

   v11.0 变更动因：原稿把铁路段与枢纽写成硬编码坐标（[6,8]→[4,9] 等），
   这些坐标是旧 20×14 / 26×16 地图的产物。地图换成 58×30 图集后它们全部
   指错格甚至指到海里，而 getMapRailways 的「格子不存在就跳过」让这件事
   **静默发生** —— 玩家看到的是「铁路网凭空消失」。改为从城市派生后，任何
   地图尺寸、任何剧本都自动得到正确路网，不再需要维护一张坐标表。
   ============================================================ */

import { hexDist } from '../core/geom.js';

/* 铁路连接规则：每座城市连上最近的若干座城（超出此跨度视为无干线） */
const RAIL_NEIGHBORS_PER_CITY = 2;
const RAIL_MAX_SPAN = 9;

/* 小城镇不设枢纽（避免枢纽徽标糊满地图） */
const HUB_MIN_CITY_W = 3;

/** 获取当前地图的铁路线段（相邻城市连线） */
export function getMapRailways(world){
  const lines = [];
  if(!world || !world.hexes) return lines;
  const cities = world.hexes.filter((h) => h && h.city);
  if(cities.length < 2) return lines;

  const seen = new Set();
  for(const a of cities){
    const near = cities
      .filter((b) => b !== a)
      .map((b) => ({ b, d: hexDist(a.q, a.r, b.q, b.r) }))
      .filter((x) => x.d <= RAIL_MAX_SPAN)
      .sort((x, y) => x.d - y.d)
      .slice(0, RAIL_NEIGHBORS_PER_CITY);

    for(const { b } of near){
      const key = a.idx < b.idx ? a.idx + '-' + b.idx : b.idx + '-' + a.idx;
      if(seen.has(key)) continue;
      seen.add(key);
      lines.push({ from: { q: a.q, r: a.r }, to: { q: b.q, r: b.r } });
    }
  }
  return lines;
}

/** 获取当前地图的补给枢纽表，并计算其供养状态 */
export function getMapSupplyHubs(world){
  const hubs = [];
  if(!world || !world.hexes) return hubs;
  for(const h of world.hexes){
    if(!h || !h.city) continue;
    const isCapital = !!h.city.cap;
    if(!isCapital && h.city.w < HUB_MIN_CITY_W) continue;
    const level = isCapital ? 3 : Math.min(3, Math.max(1, Math.round(h.city.w / 2)));
    // 判定是否与首都处于连通或断供状态（敌方非首都枢纽视为被切断）
    const isCutoff = (h.owner !== world.player && !isCapital);
    hubs.push({
      q: h.q,
      r: h.r,
      name: h.city.name + (isCapital ? '总枢纽' : '补给站'),
      level,
      isCapital,
      owner: h.owner,
      isSupplied: !isCutoff
    });
  }
  return hubs;
}
