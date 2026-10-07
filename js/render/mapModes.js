/* ============================================================
   render/mapModes.js —— v8.0 §3 地图模式系统（F1–F10）
   每个模式 = 一个绘制函数，叠加在政治底图之上（重绘背景层缓存）
   数据来源：hex{civ,mil,infra,econValue,pop,energy,unrest,fort,vp,city}
             + weather.js / railways.js / UNITS 战力 / atWarWith 图
   ============================================================ */

import { TERRAIN } from '../data/terrain.js';
import { UNITS } from '../data/units.js';
import { getHexWeather, getWeatherEffects } from '../data/weather.js';
import { getMapSupplyHubs } from '../data/railways.js';
import { hexCorners } from '../core/geom.js';
import { getHexAirRegion, calcRegionAirSuperiority, AIR_REGIONS } from '../engine/air.js';
import { SEA_ZONES, calcSeaZoneSuperiority, getHexSeaZone } from '../engine/navy.js';
import { hexPath, drawPolygonPath } from './provinces.js';

/* ---------------- 模式注册表（图例条数据也在此） ---------------- */
export const MAP_MODES = [
  { key:'F1',  id:'default',    name:'默认视图',        sub:'政治 + 地形',
    legend:{ type:'none' } },
  { key:'F2',  id:'navy',       name:'海军海权',        sub:'海区争夺 + 舰队驻泊 + 破交航线',
    legend:{ type:'list', items:[['制海优势 (>60%)','#4caf50'],['海权拉锯 (40-60%)','#ffb300'],['制海劣势 (<40%)','#e53935'],['舰队主力/屏卫','#38bdf8']] } },
  { key:'F3',  id:'air',        name:'空军制空',        sub:'空区争夺 + 机场驻机 + 联队任务',
    legend:{ type:'list', items:[['制空优势 (>60%)','#4caf50'],['空中拉锯 (40-60%)','#ffb300'],['制空劣势 (<40%)','#e53935'],['机场驻机/容量','#38bdf8']] } },
  { key:'F4',  id:'supply',     name:'补给',            sub:'首都→枢纽→前线 输血管道',
    legend:{ type:'grad', label:'补给指数', stops:['#e06055','#d8b74f','#5fae5f'], min:'断绝', max:'充足' } },
  { key:'F5',  id:'terrain',    name:'地形',            sub:'攻防修正',
    legend:{ type:'list', items:Object.values(TERRAIN).map(t => [t.name, t.color]) } },
  { key:'F6',  id:'resistance', name:'抵抗',            sub:'占领区抵抗强度',
    legend:{ type:'grad', label:'抵抗指数', stops:['#2b3340','#d8b74f','#e06055'], min:'0', max:'100' } },
  { key:'F7',  id:'resource',   name:'资源与经济',      sub:'油气 / 经济值',
    legend:{ type:'grad', label:'经济值', stops:['#1a2438','#3b82c4','#d8b74f'], min:'0', max:'12' } },
  { key:'F8',  id:'industry',   name:'工业与基建',      sub:'工厂徽章 + 基建等级',
    legend:{ type:'grad', label:'基建等级', stops:['#e06055','#d8b74f','#5fae5f'], min:'1', max:'10' } },
  { key:'F9',  id:'faction',    name:'阵营',            sub:'我方 / 敌对 / 中立',
    legend:{ type:'list', items:[['我方与盟国','#3b82c4'],['敌对','#e06055'],['中立','#5b6472'],['双方交战线','#d8b74f']] } },
  { key:'F10', id:'weather',    name:'天气',            sub:'雨 / 雪 / 雾 / 晴',
    legend:{ type:'list', items:[['晴','#d8b74f'],['雨','#4a7a9e'],['雪','#cfd8e3'],['雾','#8a94a3']] } },
  // v14.1 E5：绘制函数此前已完整实现但无按键绑定，玩家访问不到 —— 绑 F11/F12
  { key:'F11', id:'theater',    name:'战区与兵力',      sub:'枢纽聚类着色 + 驻军徽章 + 主攻箭头',
    legend:{ type:'list', items:[['我方枢纽聚类','#d8b74f'],['盟国枢纽聚类','#38bdf8'],['主攻箭头','#e06055']] } },
  { key:'F12', id:'combat',     name:'战力优势',        sub:'前线格我/敌战力比热力',
    legend:{ type:'grad', label:'我/敌战力比', stops:['#e06055','#8a8a8a','#3b82c4'], min:'0.4×', max:'2.2×' } }
];

/* ---------------- 公共工具 ---------------- */
function fillHexOrProvince(ctx, h, cam, scale = 0.94){
  if(h && (h.polygon || h.cell?.polygon) && (typeof window === 'undefined' || window.SF?.features?.provinceMap !== false)){
    drawPolygonPath(ctx, h.polygon || h.cell.polygon, cam);
  } else if(h && h.q !== undefined){
    const { x, y } = cam.toPix(h.q, h.r);
    hexPath(ctx, x, y, cam.size * cam.z * scale);
  }
}

/* 热力色：t ∈ [0,1] → 在 stops 之间插值 */
function heatColor(stops, t){
  t = Math.max(0, Math.min(1, t));
  const seg = (stops.length - 1) * t;
  const i = Math.min(stops.length - 2, Math.floor(seg));
  const f = seg - i;
  const c1 = hex2rgb(stops[i]), c2 = hex2rgb(stops[i + 1]);
  return `rgb(${Math.round(c1[0] + (c2[0] - c1[0]) * f)},${Math.round(c1[1] + (c2[1] - c1[1]) * f)},${Math.round(c2[2] + (c2[2] - c1[2]) * f)})`;
}
function hex2rgb(h){
  h = h.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/* 阵营判定：self(玩家与盟国) / enemy(与玩家交战) / neutral */
function factionOf(world, nat){
  const p = world.player;
  if(nat === p) return 'self';
  const n = world.nations[nat];
  if(!n) return 'neutral';
  const pn = world.nations[p];
  if(!pn) return 'neutral';
  if(pn.atWarWith.includes(nat)) return 'enemy';
  // 与玩家的敌人交战 → 视作同盟
  if(n.atWarWith.some(e => pn.atWarWith.includes(e))) return 'ally';
  return 'neutral';
}

/* 多源 BFS（按领土通行，返回 {dist, parent}） */
function multiSourceBFS(world, sources, passable){
  const dist = new Map(), parent = new Map(), queue = [];
  for(const h of sources){ dist.set(h.idx, 0); queue.push(h); }
  let head = 0;
  while(head < queue.length){
    const cur = queue[head++];
    const d = dist.get(cur.idx);
    for(const ni of cur.adj){
      const nh = world.hexes[ni];
      if(!nh || dist.has(nh.idx)) continue;
      if(passable && !passable(nh)) continue;
      dist.set(nh.idx, d + 1);
      parent.set(nh.idx, cur.idx);
      queue.push(nh);
    }
  }
  return { dist, parent };
}

/* 格上战力（攻防加权） */
function hexStrength(world, h, natFilter){
  let s = 0;
  for(const uid of h.units){
    const u = world.units.find(x => x.id === uid);
    if(!u || u.hp <= 0) continue;
    if(natFilter && !natFilter(u.nat)) continue;
    const U = UNITS[u.type] || UNITS.inf;
    s += (U.soft * 0.6 + U.def * 0.4) * (u.org / U.org) * (u.hp / U.hp);
  }
  return s;
}

/* ============================================================
   各模式绘制
   ============================================================ */

/* F2 战区与兵力：枢纽聚类着色 + 驻军师数徽章 + 主攻箭头 */
function drawTheater(ctx, world, cam, L){
  const hubs = getMapSupplyHubs(world)
    .map(d => world.at[d.q + ',' + d.r])
    .filter(h => h && (h.owner === world.player || factionOf(world, h.owner) === 'ally'));
  const sources = hubs.length ? hubs : world.hexes.filter(h => h.owner === world.player && h.city);
  const { dist } = multiSourceBFS(world, sources, h => h.terrain !== 'sea');

  const z = cam.z;
  for(const h of world.hexes){
    if(h.terrain === 'sea' || !cam.visible(h)) continue;
    const d = dist.get(h.idx);
    if(d === undefined) continue;
    const hue = (d * 26) % 360;
    const { x, y } = cam.toPix(h.q, h.r);
    const s = cam.size * z;
    fillHexOrProvince(ctx, h, cam, 0.94);
    ctx.globalAlpha = 0.30;
    ctx.fillStyle = `hsl(${hue}, 46%, 42%)`;
    ctx.fill();
    ctx.globalAlpha = 1;

    // 驻军师数徽章
    const n = h.units.length;
    if(n > 0 && z > 0.45){
      ctx.save();
      ctx.fillStyle = 'rgba(10,14,20,.86)';
      ctx.strokeStyle = hubStyle(h, world);
      const bw = 26 * Math.min(1.2, z), bh = 16 * Math.min(1.2, z);
      ctx.beginPath();
      ctx.rect(x - bw / 2, y + s * 0.20 - bh / 2, bw, bh);
      ctx.fill(); ctx.stroke();
      ctx.font = `bold ${Math.round(11 * Math.min(1.3, z))}px var(--font-mono,monospace), monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = n >= 6 ? '#ffd977' : '#e8e2d4';
      ctx.fillText(String(n), x, y + s * 0.20);
      ctx.restore();
    }
  }

  // 主攻箭头（有进攻/推进命令的师）
  ctx.save();
  ctx.lineWidth = Math.max(2, 2.6 * z);
  ctx.strokeStyle = 'rgba(224, 96, 85, .85)';
  for(const u of world.units){
    if(u.hp <= 0 || u.nat !== world.player || !u.order) continue;
    let to = null;
    if(u.order.type === 'attack') to = [u.order.target[0], u.order.target[1]];
    else if(u.order.type === 'advance') to = u.order.dest;
    if(!to) continue;
    const from = cam.toPix(u.q, u.r), dst = cam.toPix(to[0], to[1]);
    ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(dst.x, dst.y); ctx.stroke();
    const ang = Math.atan2(dst.y - from.y, dst.x - from.x);
    ctx.beginPath();
    ctx.moveTo(dst.x, dst.y);
    ctx.lineTo(dst.x - 10 * z * Math.cos(ang - 0.4), dst.y - 10 * z * Math.sin(ang - 0.4));
    ctx.lineTo(dst.x - 10 * z * Math.cos(ang + 0.4), dst.y - 10 * z * Math.sin(ang + 0.4));
    ctx.closePath(); ctx.fillStyle = 'rgba(224,96,85,.85)'; ctx.fill();
  }
  ctx.restore();
}
function hubStyle(h, world){
  return h.city && h.city.w >= 4 ? 'rgba(255,217,119,.8)' : 'rgba(120,150,190,.7)';
}

/* F2 海军海权：海区染色（红/黄/绿） + 舰队驻泊徽章 + 破交航线标记 [H] */
function drawNavy(ctx, world, cam){
  const z = cam.z;
  const p = world.player;

  const zoneColors = {
    green: 'rgba(76, 175, 80, 0.35)',
    yellow: 'rgba(255, 179, 0, 0.30)',
    red: 'rgba(229, 57, 53, 0.35)'
  };

  const zoneCache = {};
  for(const sz of SEA_ZONES){
    zoneCache[sz.id] = (world.seaSuperiorityCache && world.seaSuperiorityCache[sz.id])
      ? world.seaSuperiorityCache[sz.id]
      : calcSeaZoneSuperiority(world, sz.id);

    const data = zoneCache[sz.id];
    const stat = data?.status?.[p] || 'yellow';
    const color = zoneColors[stat] || zoneColors.yellow;

    // 海区染色
    for(const [sq, sr] of sz.hexes){
      const sh = world.at ? world.at[sq + ',' + sr] : null;
      fillHexOrProvince(ctx, sh || { q: sq, r: sr }, cam, 0.94);
      ctx.fillStyle = color;
      ctx.fill();
    }

    // 海区中心地名与海权百分比
    const centerPix = cam.toPix(sz.center[0], sz.center[1]);
    const ratio = data?.ratios?.[p] ?? 0.5;
    ctx.save();
    ctx.font = `bold ${Math.round(13 * Math.min(1.3, z))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(10, 14, 20, 0.9)';
    ctx.strokeText(`${sz.name} (${Math.round(ratio * 100)}%)`, centerPix.x, centerPix.y - 12 * z);
    ctx.fillStyle = stat === 'green' ? '#86efac' : (stat === 'yellow' ? '#fde047' : '#fca5a5');
    ctx.fillText(`${sz.name} (${Math.round(ratio * 100)}%)`, centerPix.x, centerPix.y - 12 * z);
    ctx.restore();
  }

  // 舰队徽章与破交图标
  const fleets = world.fleets || [];
  for(const fl of fleets){
    const sz = SEA_ZONES.find(z => z.id === fl.seaZoneId);
    if(!sz) continue;
    const centerPix = cam.toPix(sz.center[0], sz.center[1]);
    const isPlayer = fl.nat === p;
    const x = isPlayer ? centerPix.x - 30 * z : centerPix.x + 30 * z;
    const y = centerPix.y + 14 * z;

    ctx.save();
    const bw = Math.max(38, 56 * Math.min(1.2, z));
    const bh = Math.max(16, 20 * Math.min(1.2, z));
    ctx.fillStyle = isPlayer ? 'rgba(15, 23, 42, 0.88)' : 'rgba(88, 28, 28, 0.88)';
    ctx.strokeStyle = isPlayer ? '#38bdf8' : '#f87171';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.rect(x - bw / 2, y - bh / 2, bw, bh);
    ctx.fill();
    ctx.stroke();

    ctx.font = `bold ${Math.round(9.5 * Math.min(1.2, z))}px var(--font-mono,monospace), monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f8fafc';
    const taskTag = fl.task === 'convoy_raiding' ? '🎯破交' : (fl.task === 'patrol' ? '⚓巡逻' : (fl.task === 'strike' ? '⚔️主力' : '🛡️护航'));
    ctx.fillText(`${taskTag} ${fl.ships.length}舰`, x, y);
    ctx.restore();
  }
}

/* F3 战力优势：前线格双方战力比热力 */
function drawCombat(ctx, world, cam){
  const z = cam.z;
  const isAtWar = (a, b) => {
    const na = world.nations[a];
    return na ? na.atWarWith.includes(b) : false;
  };
  for(const h of world.hexes){
    if(h.terrain === 'sea' || !cam.visible(h)) continue;
    const onFront = h.adj.some(ni => isAtWar(h.owner, world.hexes[ni].owner));
    if(!onFront) continue;

    // 该格及相邻己方格 → 我方战力；相邻敌方格 → 敌方战力
    let mine = hexStrength(world, h, u => u.nat === h.owner);
    let theirs = 0;
    for(const ni of h.adj){
      const nh = world.hexes[ni];
      if(!nh) continue;
      if(isAtWar(h.owner, nh.owner)) theirs += hexStrength(world, nh, u => u.nat === nh.owner);
      else if(nh.owner === h.owner) mine += hexStrength(world, nh, u => u.nat === h.owner) * 0.5;
    }
    if(mine + theirs < 0.01) continue;
    const ratio = theirs > 0.01 ? mine / theirs : 2.2;
    const t = Math.max(0, Math.min(1, (ratio - 0.4) / 1.8));
    const { x, y } = cam.toPix(h.q, h.r);
    const s = cam.size * z;
    fillHexOrProvince(ctx, h, cam, 0.94);
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = heatColor(['#e06055', '#8a8a8a', '#3b82c4'], t);
    ctx.fill();
    ctx.globalAlpha = 1;
    if(z > 0.7){
      ctx.font = `${Math.round(10 * Math.min(1.3, z))}px var(--font-mono,monospace), monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(8,10,14,.85)';
      const txt = ratio.toFixed(1) + '×';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(8,10,14,.8)';
      ctx.strokeText(txt, x, y + s * 0.3);
      ctx.fillStyle = '#eef2f7';
      ctx.fillText(txt, x, y + s * 0.3);
    }
  }
}

/* F3 空军制空：空区染色（红/黄/绿） + 机场驻机徽章 + 联队任务标识 [H] */
function drawAir(ctx, world, cam){
  const z = cam.z;
  const p = world.player;

  // 1. 空区染色
  const regColors = {
    green: 'rgba(76, 175, 80, 0.28)',
    yellow: 'rgba(255, 179, 0, 0.25)',
    red: 'rgba(229, 57, 53, 0.28)'
  };

  const regCache = {};
  for(const r of AIR_REGIONS){
    regCache[r.id] = (world.airSuperiorityCache && world.airSuperiorityCache[r.id])
      ? world.airSuperiorityCache[r.id]
      : calcRegionAirSuperiority(world, r.id);
  }

  for(const h of world.hexes){
    if(h.terrain === 'sea' || !cam.visible(h)) continue;
    const regId = getHexAirRegion(h.q, h.r);
    const data = regCache[regId];
    if(!data) continue;
    const stat = data.status?.[p] || 'yellow';
    const { x, y } = cam.toPix(h.q, h.r);
    const s = cam.size * z;
    fillHexOrProvince(ctx, h, cam, 0.94);
    ctx.fillStyle = regColors[stat] || regColors.yellow;
    ctx.fill();
  }

  // 2. 机场徽章 (驻机数 / 容量)
  const bases = world.airBases || [];
  for(const b of bases){
    const h = world.at[b.q + ',' + b.r];
    if(!h || !cam.visible(h)) continue;
    const { x, y } = cam.toPix(b.q, b.r);
    const s = cam.size * z;
    const cap = b.capacity || (b.level * 200);
    const count = b.count || 0;
    const isOvercrowd = count > cap;

    ctx.save();
    const bw = Math.max(34, 46 * Math.min(1.2, z));
    const bh = Math.max(16, 20 * Math.min(1.2, z));
    ctx.fillStyle = isOvercrowd ? 'rgba(153, 27, 27, 0.92)' : 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = isOvercrowd ? '#f87171' : (b.nat === p ? '#38bdf8' : '#e2e8f0');
    ctx.lineWidth = isOvercrowd ? 2 : 1;
    ctx.beginPath();
    ctx.rect(x - bw / 2, y - bh / 2, bw, bh);
    ctx.fill();
    ctx.stroke();

    ctx.font = `bold ${Math.round(10 * Math.min(1.2, z))}px var(--font-mono,monospace), monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isOvercrowd ? '#fecaca' : '#f8fafc';
    ctx.fillText(`🛫${count}/${cap}`, x, y);
    ctx.restore();
  }

  // 3. 空军联队任务标识
  const wings = (world.airWings || []).filter(w => w.nat === p && w.count > 0);
  const taskIcons = {
    air_superiority: '✈️',
    cas: '🛩️',
    strat_bombing: '🚀',
    interception: '🛡️',
    naval_strike: '🛸',
    recon: '👁️',
    air_supply: '📦'
  };

  if(z > 0.6){
    for(const w of wings){
      if(!w.baseHex) continue;
      const { x, y } = cam.toPix(w.baseHex[0], w.baseHex[1]);
      const icon = taskIcons[w.task] || '✈️';
      ctx.font = `${Math.round(12 * Math.min(1.3, z))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(icon, x + 16 * z, y - 10 * z);
    }
  }
}

/* F4 补给：BFS 输血管道 + 热力 + 首都→前线流向线 */
function drawSupply(ctx, world, cam){
  const z = cam.z;
  const p = world.player;
  const cap = world.hexes.find(h => h.city && h.city.cap === p);
  const hubs = getMapSupplyHubs(world).map(d => world.at[d.q + ',' + d.r])
    .filter(h => h && h.owner === p);
  const sources = [];
  if(cap) sources.push(cap);
  for(const h of hubs) if(!sources.includes(h)) sources.push(h);
  // 无首都（已沦陷）时退回全部己方城市
  if(!sources.length){ for(const h of world.hexes) if(h.owner === p && h.city) sources.push(h); }
  if(!sources.length) return;

  const { dist, parent } = multiSourceBFS(world, sources, h => h.owner === p);

  for(const h of world.hexes){
    if(h.terrain === 'sea' || h.owner !== p || !cam.visible(h)) continue;
    const d = dist.get(h.idx);
    if(d === undefined) continue;
    const supply = Math.max(5, 100 - d * 7);
    const t = supply / 100;
    const { x, y } = cam.toPix(h.q, h.r);
    const s = cam.size * z;
    fillHexOrProvince(ctx, h, cam, 0.94);
    ctx.globalAlpha = 0.40;
    ctx.fillStyle = heatColor(['#e06055', '#d8b74f', '#5fae5f'], t);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // 流向线：最远的前线格 → 沿 parent 链回溯至源
  let far = null, fd = -1;
  for(const h of world.hexes){
    if(h.owner !== p) continue;
    const d = dist.get(h.idx);
    if(d === undefined) continue;
    const onFront = h.adj.some(ni => {
      const nh = world.hexes[ni];
      return nh && world.nations[p] && world.nations[p].atWarWith.includes(nh.owner);
    });
    if(onFront && d > fd){ fd = d; far = h; }
  }
  if(far && fd > 1){
    const path = [];
    let cur = far.idx;
    while(cur !== undefined){ path.push(cur); cur = parent.get(cur); }
    path.reverse();
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 217, 119, .75)';
    ctx.lineWidth = Math.max(1.8, 2.6 * z);
    ctx.setLineDash([9, 7]);
    ctx.beginPath();
    path.forEach((idx, i) => {
      const h = world.hexes[idx];
      const pt = cam.toPix(h.q, h.r);
      if(i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
    // 起点首都徽章
    const c = cam.toPix(sources[0].q, sources[0].r);
    ctx.fillStyle = '#ffd977';
    ctx.beginPath(); ctx.arc(c.x, c.y, Math.max(4, 5 * z), 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

/* F5 地形：纯地形色 + 名称 + 攻防修正 */
function drawTerrainMode(ctx, world, cam){
  const z = cam.z;
  for(const h of world.hexes){
    if(!cam.visible(h)) continue;
    const t = TERRAIN[h.terrain] || TERRAIN.plain;
    const { x, y } = cam.toPix(h.q, h.r);
    const s = cam.size * z;
    fillHexOrProvince(ctx, h, cam, 0.94);
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = t.color;
    ctx.fill();
    ctx.globalAlpha = 1;
    if(z > 0.5){
      ctx.font = `bold ${Math.round(11 * Math.min(1.3, z))}px "Noto Serif SC", serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const label = t.name;
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(8,10,14,.8)';
      ctx.strokeText(label, x, y);
      ctx.fillStyle = '#f4efe2';
      ctx.fillText(label, x, y);
      if(z > 0.95){
        ctx.font = `${Math.round(9.5 * z)}px var(--font-mono,monospace), monospace`;
        ctx.fillStyle = 'rgba(238,242,247,.85)';
        ctx.fillText(`攻×${t.atk.toFixed(2)} 防×${t.def.toFixed(2)}`, x, y + s * 0.30);
      }
    }
  }
}

/* F6 抵抗：占领区抵抗热力（unrest 优先，缺失时按距原首都推导） */
function drawResistance(ctx, world, cam){
  const z = cam.z;
  const capCache = new Map();
  function origCapital(nat){
    if(capCache.has(nat)) return capCache.get(nat);
    const c = world.hexes.find(h => h.city && h.city.cap === nat);
    capCache.set(nat, c);
    return c;
  }
  for(const h of world.hexes){
    if(h.terrain === 'sea' || !cam.visible(h)) continue;
    const occupied = h._orig && h._orig !== h.owner;
    const base = (h.unrest || 0);
    if(!occupied && base <= 0) continue;
    let val = base;
    if(val <= 0 && occupied){
      const c = origCapital(h._orig);
      const d = c ? Math.max(Math.abs(h.q - c.q), Math.abs(h.r - c.r)) : 6;
      val = Math.max(12, 62 - d * 4);
    }
    const t = Math.min(1, val / 100);
    const { x, y } = cam.toPix(h.q, h.r);
    const s = cam.size * z;
    fillHexOrProvince(ctx, h, cam, 0.94);
    ctx.globalAlpha = 0.46;
    ctx.fillStyle = heatColor(['#2b3340', '#d8b74f', '#e06055'], t);
    ctx.fill();
    ctx.globalAlpha = 1;
    if(occupied){
      ctx.save();
      ctx.strokeStyle = 'rgba(224, 96, 85, .7)';
      ctx.lineWidth = Math.max(1.4, 2 * z);
      fillHexOrProvince(ctx, h, cam, 0.94);
      ctx.setLineDash([5, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
    if(z > 0.8){
      ctx.font = `${Math.round(10 * z)}px var(--font-mono,monospace), monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffe4d6';
      ctx.fillText(String(Math.round(val)), x, y + s * 0.28);
    }
  }
}

/* F7 资源与经济：经济值热力 + 油气徽章 */
function drawResource(ctx, world, cam){
  const z = cam.z;
  for(const h of world.hexes){
    if(h.terrain === 'sea' || !cam.visible(h)) continue;
    const ev = h.econValue || 0;
    const t = Math.min(1, ev / 12);
    const { x, y } = cam.toPix(h.q, h.r);
    const s = cam.size * z;
    fillHexOrProvince(ctx, h, cam, 0.94);
    ctx.globalAlpha = 0.52;
    ctx.fillStyle = heatColor(['#1a2438', '#3b82c4', '#d8b74f'], t);
    ctx.fill();
    ctx.globalAlpha = 1;
    if(h.energy > 0 && z > 0.5){
      ctx.font = `bold ${Math.round(11 * Math.min(1.3, z))}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(8,10,14,.8)';
      ctx.strokeText('⛽', x, y - s * 0.18);
      ctx.fillStyle = '#ffd977';
      ctx.fillText('⛽', x, y - s * 0.18);
    }
    if(ev >= 4 && z > 0.7){
      ctx.font = `${Math.round(10 * z)}px var(--font-mono,monospace), monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(238,242,247,.9)';
      ctx.fillText(String(ev), x, y + s * 0.28);
    }
  }
}

/* F8 工业与基建：基建热力 + 工厂徽章 */
function drawIndustry(ctx, world, cam){
  const z = cam.z;
  for(const h of world.hexes){
    if(h.terrain === 'sea' || !cam.visible(h)) continue;
    const infra = h.infra || 1;
    const t = Math.min(1, (infra - 1) / 9);
    const { x, y } = cam.toPix(h.q, h.r);
    const s = cam.size * z;
    fillHexOrProvince(ctx, h, cam, 0.94);
    ctx.globalAlpha = 0.44;
    ctx.fillStyle = heatColor(['#e06055', '#d8b74f', '#5fae5f'], t);
    ctx.fill();
    ctx.globalAlpha = 1;

    const total = (h.civ || 0) + (h.mil || 0);
    if(total > 0 && z > 0.5){
      // 工厂徽章：金=民 红=军
      const bx = x, by = y + s * 0.30;
      const cw = Math.max(5, 6 * Math.min(1.3, z));
      for(let i = 0; i < Math.min(6, h.civ || 0); i++){
        ctx.fillStyle = '#d8b74f';
        ctx.fillRect(bx - (Math.min(6, h.civ) * (cw + 2)) / 2 + i * (cw + 2), by - cw / 2, cw, cw);
      }
      for(let i = 0; i < Math.min(6, h.mil || 0); i++){
        ctx.fillStyle = '#e06055';
        ctx.fillRect(bx - (Math.min(6, h.mil) * (cw + 2)) / 2 + i * (cw + 2), by + cw + 1, cw, cw);
      }
    }
  }
}

/* F9 阵营：三色大块 + 交战线 */
function drawFaction(ctx, world, cam){
  const z = cam.z;
  const COL = { self:'#3b82c4', ally:'#4a90c4', enemy:'#e06055', neutral:'#5b6472' };
  for(const h of world.hexes){
    if(h.terrain === 'sea' || !cam.visible(h)) continue;
    const f = factionOf(world, h.owner);
    const { x, y } = cam.toPix(h.q, h.r);
    const s = cam.size * z;
    fillHexOrProvince(ctx, h, cam, 0.96);
    ctx.globalAlpha = f === 'neutral' ? 0.42 : 0.58;
    ctx.fillStyle = COL[f] || COL.neutral;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  // 交战线（与玩家交战状态的国界）
  ctx.save();
  ctx.strokeStyle = 'rgba(216, 183, 79, .9)';
  ctx.lineWidth = Math.max(2, 3 * z);
  for(const h of world.hexes){
    if(!cam.visible(h)) continue;
    for(const ni of h.adj){
      const nh = world.hexes[ni];
      if(!nh || nh.idx < h.idx) continue;
      const atWar = (world.nations[h.owner] && world.nations[h.owner].atWarWith.includes(nh.owner));
      if(!atWar) continue;
      const { x, y } = cam.toPix(h.q, h.r);
      const { x: nx, y: ny } = cam.toPix(nh.q, nh.r);
      ctx.beginPath();
      ctx.moveTo((x + nx) / 2, (y + ny) / 2);
      const ang = Math.atan2(ny - y, nx - x);
      const s = cam.size * z;
      ctx.lineTo((x + nx) / 2 + s * 0.5 * Math.cos(ang + Math.PI / 3), (y + ny) / 2 + s * 0.5 * Math.sin(ang + Math.PI / 3));
      ctx.moveTo((x + nx) / 2, (y + ny) / 2);
      ctx.lineTo((x + nx) / 2 + s * 0.5 * Math.cos(ang - Math.PI / 3), (y + ny) / 2 + s * 0.5 * Math.sin(ang - Math.PI / 3));
      ctx.stroke();
    }
  }
  ctx.restore();
}

/* F10 天气：图标 + 修正 */
const WEATHER_GLYPH = { clear:'☀', rain:'🌧', snow:'❄', fog:'🌫', storm:'⛈' };
function drawWeather(ctx, world, cam){
  const z = cam.z;
  for(const h of world.hexes){
    if(h.terrain === 'sea' || !cam.visible(h)) continue;
    const w = getHexWeather(world, h);
    if(!w) continue;
    const { x, y } = cam.toPix(h.q, h.r);
    const s = cam.size * z;
    if(z > 0.45 && w.id !== 'clear'){
      fillHexOrProvince(ctx, h, cam, 0.94);
      ctx.globalAlpha = w.id === 'snow' ? 0.28 : 0.20;
      ctx.fillStyle = w.id === 'snow' ? '#cfd8e3' : (w.id === 'rain' ? '#3d6b8e' : '#8a94a3');
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if(z > 0.55){
      const glyph = WEATHER_GLYPH[w.id] || '☀';
      ctx.font = `${Math.round(13 * Math.min(1.3, z))}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(8,10,14,.75)';
      ctx.fillText(glyph, x + 1, y + s * 0.32 + 1);
      ctx.fillStyle = '#eef2f7';
      ctx.fillText(glyph, x, y + s * 0.32);
      if(z > 1.0){
        const eff = getWeatherEffects(w);
        if(eff){
          ctx.font = `${Math.round(9.5 * z)}px var(--font-mono,monospace), monospace`;
          ctx.fillStyle = 'rgba(238,242,247,.85)';
          ctx.fillText(eff.label || eff.name || '', x, y - s * 0.30);
        }
      }
    }
  }
}

/* ---------------- 分发入口 ---------------- */
export function drawModeLayer(ctx, world, cam, layers, modeId){
  switch(modeId){
    case 'navy':       drawNavy(ctx, world, cam); break;
    case 'theater':    drawTheater(ctx, world, cam, layers); break;
    case 'air':        drawAir(ctx, world, cam); break;
    case 'combat':     drawCombat(ctx, world, cam); break;
    case 'supply':     drawSupply(ctx, world, cam); break;
    case 'terrain':    drawTerrainMode(ctx, world, cam); break;
    case 'resistance': drawResistance(ctx, world, cam); break;
    case 'resource':   drawResource(ctx, world, cam); break;
    case 'industry':   drawIndustry(ctx, world, cam); break;
    case 'faction':    drawFaction(ctx, world, cam); break;
    case 'weather':    drawWeather(ctx, world, cam); break;
    default: break;    // F1 默认：政治+地形（基础绘制已覆盖）
  }
}
