/* ============================================================
   render/eraLayers.js —— v8.0 M6 四副本专属地图图层
   一战：堑壕网格 / 无人区泥泞 / 毒气云
   二战：闪击箭头动画 / 合围口袋 / 战略轰炸燃烧
   冷战：影响力双色渐变 / 代理人火苗 / DEFCON 表盘 / 太空竞赛条
   现代：制裁网络图 / 军援流动光点 / FPV 准星 / 能源依赖环

   所有图层均为「活状态」绘制（影响力/DEFCON/军援流量逐帧变化），
   因此在世界缓存模式下直接跳过（cam.fullRender === true）。
   ============================================================ */

import { hexDist } from '../core/geom.js';
import { SPACE_MILESTONES } from '../engine/space.js';
import { SANCTION_PACKAGES } from '../engine/sanctions.js';
import { AID_PACKAGES } from '../engine/milaid.js';
import { hexPath, drawPolygonPath, drawCellPath } from './provinces.js';

const SPACE_MILESTONE_COUNT = SPACE_MILESTONES.length;

/* 敌我判定 */
function hostile(world, a, b){
  if(!a || !b || a === b) return false;
  const n = world.nations[a];
  return !!(n && (n.atWarWith || []).includes(b));
}

/* 国家是否与我方敌对 */
function isEnemyOfPlayer(world, owner){
  return hostile(world, world.player, owner);
}

/* ============================================================
   派发入口
   ============================================================ */
export function drawEraOverlay(ctx, world, cam, ui, z){
  if(cam.fullRender) return;              // 世界缓存：不叠加活状态图层
  if(!world || world.over) return;

  switch(world.scenario){
    case 'ww1':     drawWW1(ctx, world, cam, ui, z); break;
    case 'ww2':     drawWW2(ctx, world, cam, ui, z); break;
    case 'coldwar': drawColdWar(ctx, world, cam, ui, z); break;
    case 'modern':  drawModern(ctx, world, cam, ui, z); break;
  }
}

/* ============================================================
   一战：堑壕网格 + 无人区泥泞 + 毒气云
   ============================================================ */
function drawWW1(ctx, world, cam, ui, z){
  if(z < 0.45) return;                    // 缩得太小无意义
  const s = cam.size * z;

  /* ① 无人区（No Man's Land）：敌我前线之间的空缺格 → 泥泞焦土色 + 弹坑圆斑 */
  const frontHexes = [], emptyBetween = [];
  for(const h of world.hexes){
    if(h.terrain === 'sea') continue;
    const myFront = h.owner === world.player;
    const enemyAdj = h.adj.map(i => world.hexes[i]).some(n => isEnemyOfPlayer(world, n.owner));
    if(myFront && enemyAdj) frontHexes.push(h);
  }
  const frontSet = new Set(frontHexes.map(h => h.idx));
  for(const h of world.hexes){
    if(h.terrain === 'sea' || h.owner !== world.player) continue;
    // 无人区候选：己方格，与最近前线格相邻，但自身不是前线
    if(frontSet.has(h.idx)) continue;
    const nearFront = h.adj.some(i => frontSet.has(i));
    const garrisoned = (h.units || []).some(id => {
      const u = world.units.find(x => x.id === id);
      return u && u.hp > 0;
    });
    if(nearFront && !garrisoned) emptyBetween.push(h);
  }

  for(const h of emptyBetween){
    const { x, y } = cam.toPix(h.q, h.r);
    ctx.save();
    ctx.beginPath(); hexPath(ctx, x, y, s * 0.97); ctx.clip();
    ctx.fillStyle = 'rgba(74, 63, 51, 0.62)';     // #4a3f33 泥泞焦土
    ctx.fill();
    // 弹坑圆斑（按格索引确定性分布，避免闪烁）
    const seed = (h.idx * 2654435761) >>> 0;
    ctx.fillStyle = 'rgba(28, 22, 16, 0.55)';
    for(let k = 0; k < 5; k++){
      const r1 = ((seed >> (k * 3)) & 255) / 255;
      const r2 = ((seed >> (k * 4 + 2)) & 127) / 127;
      ctx.beginPath();
      ctx.arc(x + (r1 - 0.5) * s * 0.95, y + (r2 - 0.5) * s * 0.95, s * (0.06 + r1 * 0.07), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ② 堑壕网格：前线格之间锯齿战壕线 + 沙袋点；壕沟≥10% 显示深化纹理 */
  ctx.save();
  ctx.lineCap = 'round';
  for(const h of frontHexes){
    const { x, y } = cam.toPix(h.q, h.r);
    // 与相邻前线格连线，构成壕沟网格
    for(const ni of h.adj){
      const n = world.hexes[ni];
      if(n.owner !== h.owner) continue;
      if(!frontSet.has(n.idx)) continue;
      if(n.idx < h.idx) continue;                       // 每条边只画一次
      const p = cam.toPix(n.q, n.r);
      const mx = (x + p.x) / 2, my = (y + p.y) / 2;
      const dx = p.x - x, dy = p.y - y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      // 锯齿战壕线
      ctx.strokeStyle = 'rgba(62, 48, 36, 0.95)';
      ctx.lineWidth = Math.max(2, 4.5 * z);
      ctx.beginPath();
      const teeth = 5, amp = s * 0.13;
      ctx.moveTo(x, y);
      for(let k = 1; k <= teeth; k++){
        const t = k / teeth;
        const px = x + dx * t, py = y + dy * t;
        const off = (k % 2 ? amp : -amp);
        ctx.lineTo(px + nx * off, py + ny * off);
      }
      ctx.stroke();
      // 沙袋点
      ctx.fillStyle = 'rgba(150, 126, 88, 0.9)';
      for(let k = 1; k < teeth; k++){
        const t = k / teeth;
        const off = (k % 2 ? amp : -amp);
        ctx.beginPath();
        ctx.arc(x + dx * t + nx * off, y + dy * t + ny * off, Math.max(1.2, s * 0.035), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  // 壕沟深化纹理：驻军壕沟度 ≥10% 的格加内圈虚线
  for(const h of frontHexes){
    const units = (h.units || []).map(id => world.units.find(u => u.id === id))
      .filter(u => u && u.hp > 0 && u.nat === world.player);
    if(!units.length) continue;
    const maxEnt = Math.max(...units.map(u => u.entrench || 0));
    if(maxEnt < 0.10) continue;
    const { x, y } = cam.toPix(h.q, h.r);
    ctx.beginPath(); hexPath(ctx, x, y, s * 0.72);
    ctx.strokeStyle = `rgba(180, 140, 82, ${Math.min(0.85, 0.35 + maxEnt)})`;
    ctx.lineWidth = Math.max(1.2, 2.6 * z);
    ctx.setLineDash([Math.max(2, 4 * z), Math.max(2, 3 * z)]);
    ctx.stroke();
    ctx.setLineDash([]);
    // 深化等级角标
    ctx.fillStyle = 'rgba(255, 217, 119, 0.9)';
    ctx.font = `bold ${Math.max(8, 10 * z)}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`壕 ${(maxEnt * 100).toFixed(0)}%`, x, y + s * 0.5);
  }
  ctx.restore();

  /* ③ 毒气云：毒气事件期间的受影响格覆盖黄绿云团（alpha 呼吸动画） */
  const gas = world.gasClouds;
  if(gas && gas.length){
    const t = Date.now() * 0.0016;
    ctx.save();
    for(const g of gas){
      const h = world.hexes[g.hexIdx ?? g];
      if(!h) continue;
      const { x, y } = cam.toPix(h.q, h.r);
      const pulse = 0.30 + 0.14 * Math.sin(t + h.idx);
      ctx.fillStyle = `rgba(163, 190, 74, ${pulse.toFixed(3)})`;
      ctx.beginPath(); hexPath(ctx, x, y, s * 0.96); ctx.fill();
      ctx.strokeStyle = 'rgba(120, 150, 40, 0.8)';
      ctx.lineWidth = 1.5; ctx.stroke();
    }
    ctx.restore();
  }
}

/* ============================================================
   二战：闪击箭头动画 + 合围口袋 + 战略轰炸燃烧
   ============================================================ */
function drawWW2(ctx, world, cam, ui, z){
  /* ① 合围口袋：被包围格组红虚线圈出 + 内部被围师数 */
  const pockets = findPockets(world);
  if(pockets.length && z >= 0.35){
    ctx.save();
    for(const { hexes, encircled } of pockets){
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.9)';
      ctx.lineWidth = Math.max(2, 3.2 * z);
      ctx.setLineDash([Math.max(4, 8 * z), Math.max(3, 5 * z)]);
      let cx = 0, cy = 0;
      for(const h of hexes){
        const { x, y } = cam.toPix(h.q, h.r);
        hexPath(ctx, x, y, cam.size * z * 0.98);
        ctx.stroke();
        cx += x; cy += y;
      }
      ctx.setLineDash([]);
      cx /= hexes.length; cy /= hexes.length;
      // 口袋战术药丸徽章 (HOI4 战役战术合围标)
      const pillText = `🔒 合围 ${encircled}师`;
      ctx.font = `bold ${Math.max(9, Math.round(10.5 * z))}px sans-serif`;
      const tw = ctx.measureText(pillText).width;
      const pw = tw + 12 * z, ph = Math.max(15, 18 * z);
      ctx.fillStyle = 'rgba(127, 29, 29, 0.92)';
      ctx.beginPath();
      if(ctx.roundRect) ctx.roundRect(cx - pw / 2, cy - ph / 2, pw, ph, 4);
      else ctx.rect(cx - pw / 2, cy - ph / 2, pw, ph);
      ctx.fill();
      ctx.strokeStyle = '#fca5a5';
      ctx.lineWidth = Math.max(1.2, 1.5 * z);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pillText, cx, cy);
    }
    ctx.restore();
  }

  /* ② 闪击箭头动画：装甲师突破方向生成金色箭头 + 拖尾（3 秒） */
  const feed = world.blitzFeed;
  if(feed && feed.length){
    const now = Date.now();
    ctx.save();
    for(const b of feed){
      const age = (now - b.t) / 3000;
      if(age > 1) continue;
      const alpha = 1 - age;
      const from = cam.toPix(b.fq, b.fr), to = cam.toPix(b.tq, b.tr);
      // 拖尾：随时间从起点生长到终点
      const grow = Math.min(1, age * 2.2);
      const ex = from.x + (to.x - from.x) * grow;
      const ey = from.y + (to.y - from.y) * grow;
      const ang = Math.atan2(ey - from.y, ex - from.x);
      const w = Math.max(4, 9 * z) * (1 - age * 0.4);
      // 金色渐变主体
      const grad = ctx.createLinearGradient(from.x, from.y, ex, ey);
      grad.addColorStop(0, `rgba(255, 217, 119, 0)`);
      grad.addColorStop(0.55, `rgba(255, 200, 60, ${0.55 * alpha})`);
      grad.addColorStop(1, `rgba(255, 240, 150, ${0.95 * alpha})`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = w; ctx.lineCap = 'round';
      ctx.shadowColor = `rgba(255, 200, 60, ${0.8 * alpha})`;
      ctx.shadowBlur = 16 * z;
      ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.shadowBlur = 0;
      // 箭头锋头
      const head = Math.max(9, 15 * z) * (1 - age * 0.3);
      ctx.fillStyle = `rgba(255, 246, 190, ${alpha})`;
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - head * Math.cos(ang - 0.42), ey - head * Math.sin(ang - 0.42));
      ctx.lineTo(ex - head * Math.cos(ang + 0.42), ey - head * Math.sin(ang + 0.42));
      ctx.closePath(); ctx.fill();
      // 标签
      if(b.label){
        ctx.fillStyle = `rgba(255, 240, 150, ${alpha})`;
        ctx.font = `bold ${Math.max(9, 11 * z)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(b.label, (from.x + ex) / 2, (from.y + ey) / 2 - 12 * z);
      }
    }
    ctx.restore();
  }

  /* ③ 战略轰炸燃烧：被炸工业格燃烧图标 + 产能受损失效条 */
  const bombed = world.bombedHexes;
  if(bombed && z >= 0.4){
    const t = Date.now() * 0.004;
    ctx.save();
    for(const idx of Object.keys(bombed)){
      const h = world.hexes[idx];
      if(!h) continue;
      const { x, y } = cam.toPix(h.q, h.r);
      const loss = bombed[idx].loss || 0.3;
      // 火焰
      const fl = 0.7 + 0.3 * Math.sin(t + h.idx);
      ctx.font = `${Math.max(11, 16 * z * fl)}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillText('🔥', x, y - cam.size * z * 0.45);
      // 产能损失条
      const bw = cam.size * z * 1.2, bh = Math.max(3, 5 * z);
      ctx.fillStyle = 'rgba(0,0,0,.6)';
      ctx.fillRect(x - bw / 2, y - cam.size * z * 0.34, bw, bh);
      ctx.fillStyle = '#f97316';
      ctx.fillRect(x - bw / 2, y - cam.size * z * 0.34, bw * (1 - loss), bh);
    }
    ctx.restore();
  }
}

/* 合围口袋检测：敌方控制的连通格组，四周（含对角外缘）无同阵营接应且被包围 */
function findPockets(world){
  const out = [];
  const visited = new Set();
  for(const start of world.hexes){
    if(start.terrain === 'sea') continue;
    if(!isEnemyOfPlayer(world, start.owner)) continue;   // 只圈敌人的口袋
    if(visited.has(start.idx)) continue;
    // BFS 同归属连通块
    const comp = [];
    const stack = [start];
    visited.add(start.idx);
    while(stack.length){
      const h = stack.pop();
      comp.push(h);
      for(const ni of h.adj){
        const n = world.hexes[ni];
        if(!n || visited.has(n.idx)) continue;
        if(n.terrain === 'sea' || n.owner !== start.owner) continue;
        visited.add(n.idx); stack.push(n);
      }
    }
    if(comp.length > 6) continue;                        // 大块领土不是口袋
    // 判定被围：连通块所有格外邻格中，存在我方控制格、且没有该敌国的**非本块**领土作纵深
    const borderOut = new Set();
    let touchesOwnLand = false;
    for(const h of comp){
      for(const ni of h.adj){
        const n = world.hexes[ni];
        if(!n) continue;
        if(comp.some(c => c.idx === n.idx)) continue;
        borderOut.add(n.owner);
        if(n.owner === h.owner) touchesOwnLand = true;
      }
    }
    if(touchesOwnLand) continue;                          // 与本国主体相连 → 非口袋
    if(!borderOut.has(world.player)) continue;            // 必须被我方闭合
    const encircled = world.units.filter(u =>
      u.hp > 0 && u.nat === start.owner &&
      comp.some(c => c.q === u.q && c.r === u.r)).length;
    if(!encircled) continue;
    out.push({ hexes: comp, encircled });
  }
  return out;
}

/* ============================================================
   冷战：影响力双色渐变 + 代理人火苗 + DEFCON 表盘 + 太空竞赛条
   ============================================================ */
const BLOC_BLUE = [59, 130, 246];    // USA 蓝
const BLOC_GREY = [120, 128, 140];   // 中立灰
const BLOC_RED  = [220, 60, 60];     // SOV 红

function mix(a, b, t){
  return [Math.round(a[0] + (b[0] - a[0]) * t),
          Math.round(a[1] + (b[1] - a[1]) * t),
          Math.round(a[2] + (b[2] - a[2]) * t)];
}
function rgb(c, a = 1){ return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }

function drawColdWar(ctx, world, cam, ui, z){
  /* ① 影响力双色渐变：国家格按美苏影响力比例 蓝→灰→红 上色 (排除美苏本土，降低第三方不透明度保护地形) */
  if(z >= 0.3){
    ctx.save();
    for(const h of world.hexes){
      if(h.terrain === 'sea') continue;
      if(h.owner === 'USA' || h.owner === 'SOV') continue; // 美苏本土由基础归属层上色，不叠加避免重红失真
      const nat = world.nations[h.owner];
      if(!nat) continue;
      const inf = nat.influence;
      let col;
      if(inf){
        const u = inf.USA ?? 30, v = inf.SOV ?? 30;
        const tot = u + v || 1;
        const t = u / tot;                       // 1 → 全蓝, 0 → 全红
        col = t >= 0.5 ? mix(BLOC_GREY, BLOC_BLUE, (t - 0.5) * 2)
                       : mix(BLOC_RED, BLOC_GREY, t * 2);
      } else {
        col = BLOC_GREY;
      }
      const { x, y } = cam.toPix(h.q, h.r);
      ctx.beginPath(); hexPath(ctx, x, y, cam.size * z * 0.94);
      ctx.fillStyle = rgb(col, 0.16);
      ctx.fill();
    }
    // 阵营倾角：影响力差 >30 的边境格加粗描边（色取强势方）
    for(const h of world.hexes){
      if(h.terrain === 'sea') continue;
      if(h.owner === 'USA' || h.owner === 'SOV') continue;
      const nat = world.nations[h.owner];
      if(!nat || !nat.influence) continue;
      const u = nat.influence.USA ?? 30, v = nat.influence.SOV ?? 30;
      if(Math.abs(u - v) < 30) continue;
      if(!h.adj.some(i => {
        const n = world.nations[world.hexes[i].owner];
        return n && n.influence && Math.abs((n.influence.USA ?? 30) - (n.influence.SOV ?? 30)) < 30;
      })) continue;
      const { x, y } = cam.toPix(h.q, h.r);
      ctx.beginPath(); hexPath(ctx, x, y, cam.size * z * 0.94);
      ctx.strokeStyle = rgb(u > v ? BLOC_BLUE : BLOC_RED, 0.45);
      ctx.lineWidth = Math.max(1.2, 1.8 * z);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ② 代理人热点：仅战术缩放 (z>=0.65) 显示全球前三危机焦点，军工标牌呈现而非表情包刷屏 */
  if(z >= 0.65){
    const heatList = [];
    for(const id of Object.keys(world.nations)){
      if(id === 'USA' || id === 'SOV') continue;
      const inf = world.nations[id].influence;
      if(!inf) continue;
      const u = inf.USA ?? 0, v = inf.SOV ?? 0;
      const contested = Math.min(u, v);
      if(contested >= 25){
        heatList.push({ id, heat: contested, nat: world.nations[id] });
      }
    }
    heatList.sort((a, b) => b.heat - a.heat);
    const topHotspots = heatList.slice(0, 3);

    ctx.save();
    for(const item of topHotspots){
      const natId = item.id;
      const nat = item.nat;
      const cap = world.hexes.filter(h => h.owner === natId && h.terrain !== 'sea');
      if(!cap.length) continue;
      let cx = 0, cy = 0;
      for(const h of cap){ const p = cam.toPix(h.q, h.r); cx += p.x; cy += p.y; }
      cx /= cap.length; cy /= cap.length;

      const badgeY = cy - cam.size * z * 0.65;
      const labelText = `⚡ 危机焦点: ${nat ? nat.name : natId} (争夺度 ${item.heat})`;
      ctx.font = `bold ${Math.max(9, Math.round(11 * z))}px sans-serif`;
      const txtMetrics = ctx.measureText(labelText);
      const bw = txtMetrics.width + 16;
      const bh = Math.max(16, 20 * z);

      ctx.fillStyle = 'rgba(15, 20, 28, 0.88)';
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      if(ctx.roundRect){
        ctx.roundRect(cx - bw / 2, badgeY - bh / 2, bw, bh, 3);
      } else {
        ctx.rect(cx - bw / 2, badgeY - bh / 2, bw, bh);
      }
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#fde68a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, cx, badgeY);
    }
    ctx.restore();
  }

  /* ③ DEFCON 与末日时钟已全面升格入轨至顶栏双轨次级态势带 (#sf-defcon-pill)，避免画布浮动穿模 */

  /* ④ 太空竞赛进度条：顶部细条 + 双方 7 里程碑镀金点 */
  const sp = world.spaceRace;
  if(sp && sp.progress && typeof SPACE_MILESTONE_COUNT === 'number'){
    const W = cam.canvas.clientWidth;
    const y = 4, h = 8;
    const sides = Object.keys(sp.progress);
    if(sides.length){
      ctx.save();
      const segW = (W - 24) / sides.length;
      sides.forEach((natId, si) => {
        const x0 = 12 + si * segW;
        const done = sp.progress[natId] ? (sp.progress[natId].completedCount || 0) : 0;
        ctx.fillStyle = 'rgba(0,0,0,.55)';
        ctx.fillRect(x0, y, segW - 6, h);
        for(let i = 0; i < SPACE_MILESTONE_COUNT; i++){
          const mx = x0 + (i / Math.max(1, SPACE_MILESTONE_COUNT - 1)) * (segW - 14) + 4;
          const got = i < done;
          ctx.beginPath(); ctx.arc(mx, y + h / 2, got ? 3.6 : 2.2, 0, Math.PI * 2);
          ctx.fillStyle = got ? '#ffd977' : 'rgba(148,163,184,.45)';
          ctx.fill();
        }
        const pw = (done / SPACE_MILESTONE_COUNT) * (segW - 14);
        ctx.fillStyle = natId === world.player ? 'rgba(255,217,119,.85)' : 'rgba(248,113,113,.75)';
        ctx.fillRect(x0 + 4, y + h - 2, pw, 2);
        ctx.fillStyle = 'rgba(203,213,224,.9)';
        ctx.font = '8px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(`${natId} 太空竞赛 ${done}/${SPACE_MILESTONE_COUNT}`, x0 + 4, y + h + 2);
      });
      ctx.restore();
    }
  }
}

/* ============================================================
   现代：制裁网络图 + 军援流动光点 + FPV 准星 + 能源依赖环
   ============================================================ */
function drawModern(ctx, world, cam, ui, z){
  // 国家重心缓存（连线端点）
  const centroid = natId => {
    const cap = world.hexes.filter(h => h.owner === natId && h.terrain !== 'sea');
    if(!cap.length) return null;
    let cx = 0, cy = 0;
    for(const h of cap){ const p = cam.toPix(h.q, h.r); cx += p.x; cy += p.y; }
    return { x: cx / cap.length, y: cy / cap.length };
  };
  const cache = {};
  const C = id => (id in cache) ? cache[id] : (cache[id] = centroid(id));

  // 制裁数据源：sanctions.js 的主动制裁网络 ∪ diplomacy.js 的简易制裁
  const sevOf = pkgId => {
    const p = SANCTION_PACKAGES[pkgId];
    if(!p) return 2;
    if(p.tradePenalty >= 0.25 || p.reserveLoss >= 0.4) return 3;
    if(p.milPenalty >= 0.1 || p.techSpeedPenalty >= 0.2) return 2;
    return 1;
  };
  const sanctions = [
    ...(((world.sanctionsNetwork || {}).activeSanctions) || []).map(s => ({ from: s.from, to: s.to, sev: sevOf(s.packageId) })),
    ...(((world.diplomacy || {}).sanctions) || []).map(s => ({
      from: s.from, to: s.to,
      sev: s.severity === 'heavy' || s.severity === 3 ? 3 : s.severity === 'medium' || s.severity === 2 ? 2 : 1 }))
  ];

  /* ① 制裁网络图：双国连线（线粗=强度 1–3，线色=发起方） */
  if(sanctions.length){
    ctx.save();
    for(const sc of sanctions){
      const a = C(sc.from), b = C(sc.to);
      if(!a || !b) continue;
      const nat = world.nations[sc.from];
      ctx.strokeStyle = nat ? nat.color : '#f87171';
      ctx.globalAlpha = 0.72;
      ctx.lineWidth = sc.sev * 1.8 + 0.6;
      ctx.setLineDash([Math.max(4, 7 * z), Math.max(3, 5 * z)]);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      // 制裁强度角标
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      ctx.fillStyle = 'rgba(127,29,29,.9)';
      ctx.beginPath(); ctx.arc(mx, my, Math.max(7, 9 * z), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.max(7, 9 * z)}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('S' + sc.sev, mx, my + 0.5);
    }
    ctx.restore();
  }

  /* ② 军援管道流动光点：从援助国流向受援国，速度=流量；红线武器用红色光点 */
  const pipes = [
    ...(((world.milAid || {}).packagesDelivered) || []).map(p => {
      const pkg = AID_PACKAGES[p.packageId] || {};
      return { from: p.donor, to: p.recipient, monthlyEquip: pkg.equipBonus || 200,
               redline: (pkg.escalationAdd || 0) >= 25 };
    }),
    ...(((world.diplomacy || {}).milAidPipes) || []).map(p => ({
      from: p.from, to: p.to, monthlyEquip: p.monthlyEquip || 100,
      redline: !!p.redline }))
  ];
  if(pipes.length){
    const t = (Date.now() % 2200) / 2200;      // 每 2.2s 一个循环
    ctx.save();
    for(const p of pipes){
      const a = C(p.from), b = C(p.to);
      if(!a || !b) continue;
      const redline = !!p.redline || (p.packageId || '').includes('redline');
      // 管道底纹
      ctx.strokeStyle = redline ? 'rgba(239,68,68,.38)' : 'rgba(96,165,250,.34)';
      ctx.lineWidth = Math.max(1.4, 2.4 * z);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      // 流动光点（3 个相位错开）
      for(let k = 0; k < 3; k++){
        const ph = (t + k / 3) % 1;
        const px = a.x + (b.x - a.x) * ph, py = a.y + (b.y - a.y) * ph;
        const fade = Math.sin(ph * Math.PI);          // 两端淡入淡出
        const rad = Math.max(2.2, 4 * z) * (0.6 + 0.7 * fade);
        const g = ctx.createRadialGradient(px, py, 0, px, py, rad * 2.6);
        const col = redline ? '255,90,90' : '140,200,255';
        g.addColorStop(0, `rgba(${col},${0.95 * fade})`);
        g.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(px, py, rad * 2.6, 0, Math.PI * 2); ctx.fill();
      }
      // 流量标签
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      ctx.fillStyle = redline ? 'rgba(254,202,202,.95)' : 'rgba(191,219,254,.95)';
      ctx.font = `bold ${Math.max(8, 10 * z)}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`${p.monthlyEquip ?? 0}/月`, mx, my - 10);
    }
    ctx.restore();
  }

  /* ③ FPV 打击准星：打击时在前线格显示瞄准十字准星动画（0.8s）+ 命中爆炸 */
  const strikes = world.fpvStrikes;
  if(strikes && strikes.length){
    const now = Date.now();
    ctx.save();
    for(const st of strikes){
      const age = (now - st.t) / 800;
      if(age > 1) continue;
      const h = world.hexes[st.hexIdx];
      if(!h) continue;
      const { x, y } = cam.toPix(h.q, h.r);
      const r = cam.size * z * (0.85 - 0.35 * age);
      const a = 1 - age * 0.5;
      ctx.strokeStyle = `rgba(255, 70, 70, ${a})`;
      ctx.lineWidth = Math.max(1.6, 2.6 * z);
      // 四段准星
      for(let k = 0; k < 4; k++){
        const ang = k * Math.PI / 2 + Math.PI / 4;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(ang) * r * 0.45, y + Math.sin(ang) * r * 0.45);
        ctx.lineTo(x + Math.cos(ang) * r, y + Math.sin(ang) * r);
        ctx.stroke();
      }
      // 外环 + 中心点
      ctx.beginPath(); ctx.arc(x, y, r * 0.62, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, Math.max(1.5, 2.5 * z), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,70,70,${a})`; ctx.fill();
      // 命中爆炸
      if(age > 0.45){
        const ea = (age - 0.45) / 0.55;
        ctx.strokeStyle = `rgba(255, 200, 80, ${1 - ea})`;
        ctx.lineWidth = Math.max(2, 4 * z) * (1 - ea);
        ctx.beginPath(); ctx.arc(x, y, r * (0.5 + ea * 1.1), 0, Math.PI * 2); ctx.stroke();
        ctx.font = `${Math.max(12, 18 * z)}px sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('💥', x, y - r * (0.6 + ea));
      }
    }
    ctx.restore();
  }

  /* ④ 能源依赖环：按 world.energy.pipelines 计算各国受管道断供冲击的依赖度 */
  const en = world.energy;
  if(en && en.pipelines && z >= 0.5){
    // 统计每国被多少条（正常 + 已断）管道覆盖
    const covered = {}, severed = {};
    for(const pid of Object.keys(en.pipelines)){
      const p = en.pipelines[pid];
      for(const natId of (p.transitTo || [])){
        covered[natId] = (covered[natId] || 0) + 1;
        if(p.status === 'severed') severed[natId] = (severed[natId] || 0) + 1;
      }
    }
    ctx.save();
    for(const natId of Object.keys(covered)){
      const c = C(natId);
      if(!c) continue;
      const total = covered[natId];
      const cut = severed[natId] || 0;
      const v = Math.round((cut / Math.max(1, total)) * 100);   // 断供比例 = 依赖暴露度
      const r = Math.max(7, 9 * z);
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, -Math.PI / 2, -Math.PI / 2 + (v / 100) * Math.PI * 2);
      ctx.strokeStyle = v >= 60 ? '#f97316' : v > 0 ? '#eab308' : '#4ade80';
      ctx.lineWidth = Math.max(2, 3.4 * z);
      ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,.6)';
      ctx.beginPath(); ctx.arc(c.x, c.y, r - 2.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = v > 0 ? '#fca5a5' : '#e2e8f0';
      ctx.font = `bold ${Math.max(7, 9 * z)}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(cut + '/' + total, c.x, c.y + 0.5);
    }
    ctx.restore();
  }
}
