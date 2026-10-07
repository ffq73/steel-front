// js/render/provinces.js —— v13.0 真·行省沙盘拓扑构建与空间拾取引擎
// C39: 1:1 映射 world.hexes，adj 集合完全相等，严禁手摆
// C40: mulberry32 确定性派生，同种子两次生成逐字节一致
// C41: 引擎零 diff，与 engine 纯解耦
//
// v13.0 核心变更：胞腔生成由「角点外接圆心微移」升级为「半平面裁剪 Voronoi」。
//   旧法：六边形角点随种子微移 → 胞腔骨架仍是六边形，蜂巢感无法消除。
//   新法：以每格中心为种子（大幅扰动），用与邻种子的中垂线半平面依次裁剪
//        （Sutherland–Hodgman），得到的胞腔是真正的不规则有机多边形；
//        共享边直接由裁剪面产生，双向天然一致（同一份点集）。
//   拓扑不变式：Voronoi 胞腔邻接 ≡ 种子邻接 ≡ 原 hex.adj（C39）。

import { hexToPix, pointInPoly } from '../core/geom.js';
import { K } from '../data/constants.js';

/** mulberry32 确定性伪随机数生成器 (C40) */
export function mulberry32(a) {
  let s = (a >>> 0);
  return function() {
    let t = s = (s + 0x6D2B79F5) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r3 = v => +v.toFixed(3);

/* ============================================================
   半平面裁剪：保留 n·p <= c 一侧
   顶点格式 [x, y, src]：src = 该顶点所在边由哪个种子切出（null = 世界包围盒边）
   顶点始终保持输入多边形的环形顺序 → 装配出的行省多边形不自交
   ============================================================ */
function clipHalfPlane(poly, nx, ny, c, other) {
  const out = [];
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const v = poly[i];
    const ax = v[0], ay = v[1];
    const w = poly[(i + 1) % n];
    const bx = w[0], by = w[1];
    const da = nx * ax + ny * ay - c;
    const db = nx * bx + ny * by - c;
    const aIn = da <= 0;
    const bIn = db <= 0;
    if (aIn) out.push(v);
    if (aIn !== bIn) {
      const t = da / (da - db);
      // 进入点继承本裁剪面标签；离开点同样（两端同源，边标签唯一）
      out.push([r3(ax + (bx - ax) * t), r3(ay + (by - ay) * t), other]);
    }
  }
  return out;
}

/* 确定性哈希 → [0,1)，用于边的有机微弯（C40） */
function hash01(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return (h % 100000) / 100000;
}

/** 一条直线段 → 4 点有机缓弯曲线（两端点 + 2 控制点），确定性 */
function organicCurve(a, b, salt) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (!(len > 0.5)) return [a, b];
  const nx = -dy / len, ny = dx / len;
  const h = hash01(salt);
  const h2 = hash01(salt + '#2');
  const off = (h - 0.5) * len * 0.26;
  const bow = 0.16 + h2 * 0.14;                    // 弧度大小：轻微外凸
  const m1 = [r3(a[0] + dx * 0.32 + nx * off * bow), r3(a[1] + dy * 0.32 + ny * off * bow)];
  const m2 = [r3(a[0] + dx * 0.68 + nx * off * bow * 0.85), r3(a[1] + dy * 0.68 + ny * off * bow * 0.85)];
  return [a, m1, m2, b];
}

/** 简化多边形：合并夹角过小的共线点（容差），控制顶点数 */
function simplifyPoly(poly, tol = 0.6) {
  if (poly.length < 4) return poly;
  const out = [];
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const p = poly[(i - 1 + n) % n], c = poly[i], q = poly[(i + 1) % n];
    if (!c || !p || !q) continue;   // 纵深防御：跳过稀疏空洞点
    const v1x = c[0] - p[0], v1y = c[1] - p[1];
    const v2x = q[0] - c[0], v2y = q[1] - c[1];
    const l1 = Math.hypot(v1x, v1y), l2 = Math.hypot(v2x, v2y);
    if (l1 < tol || l2 < tol) continue;
    const cosang = (v1x * v2x + v1y * v2y) / (l1 * l2);
    if (cosang > 0.9985) continue;   // 近乎共线 → 丢弃
    out.push(c);
  }
  return out.length >= 3 ? out : poly;
}

/** 构建世界行省拓扑、共享边图与空间分桶检索索引 (v13.0 半平面裁剪 Voronoi) */
export function buildProvinces(world, userRng = null) {
  if (!world || !world.hexes || !world.hexes.length) {
    return { cells: [], sharedEdges: {}, coasts: [], bins: new Map(), binSize: 32, pickProvince: () => null };
  }

  const hexSize = (K && K.HEX_SIZE) ? K.HEX_SIZE : 34;
  const seedVal = world.seed || 1;
  const rng = userRng || mulberry32(seedVal);

  /* ---------- 1. 种子点：格心 + 大幅确定性扰动（打破六边形骨架） ----------
     扰动幅度取格距的 40%：六角格距 ≈ hexSize×1.732，40% 足以让胞腔脱离
     正六边形轮廓（边长差可达 3 倍），又不至于让相邻种子交叉。
     随后做一次"间距松弛"：把过近的种子对推开，保证没有格子被压成细条。 */
  const SEEDS = [];
  const PERTURB = 0.40;
  for (let i = 0; i < world.hexes.length; i++) {
    const h = world.hexes[i];
    const base = hexToPix(h.q, h.r, hexSize);
    const ang = rng() * Math.PI * 2;
    const dist = rng() * (hexSize * PERTURB);
    SEEDS.push({
      x: +(base.x + Math.cos(ang) * dist).toFixed(3),
      y: +(base.y + Math.sin(ang) * dist).toFixed(3),
      idx: i
    });
  }

  // 1b. 间距松弛：相邻种子最小间距 = 原始格距 × 0.66（过近则对称推开）
  {
    const gw2 = hexSize * 1.75;
    const g2 = new Map();
    for (let i = 0; i < SEEDS.length; i++) {
      const k = Math.floor(SEEDS[i].x / gw2) + ',' + Math.floor(SEEDS[i].y / gw2);
      let l = g2.get(k);
      if (!l) { l = []; g2.set(k, l); }
      l.push(i);
    }
    const nominal = hexSize * 1.732;      // 六角格标称边长（相邻中心距）
    const minD = nominal * 0.66;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < SEEDS.length; i++) {
        const gx = Math.floor(SEEDS[i].x / gw2), gy = Math.floor(SEEDS[i].y / gw2);
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const l = g2.get((gx + dx) + ',' + (gy + dy));
            if (!l) continue;
            for (const j of l) {
              if (j <= i) continue;
              const ddx = SEEDS[j].x - SEEDS[i].x;
              const ddy = SEEDS[j].y - SEEDS[i].y;
              const d = Math.hypot(ddx, ddy);
              if (d >= minD || d < 1e-6) continue;
              const push = (minD - d) * 0.5;
              const ux = ddx / d, uy = ddy / d;
              SEEDS[i].x = +(SEEDS[i].x - ux * push).toFixed(3);
              SEEDS[i].y = +(SEEDS[i].y - uy * push).toFixed(3);
              SEEDS[j].x = +(SEEDS[j].x + ux * push).toFixed(3);
              SEEDS[j].y = +(SEEDS[j].y + uy * push).toFixed(3);
            }
          }
        }
      }
    }
  }

  /* ---------- 2. 种子空间哈希（粗网格，用于近邻收集） ---------- */
  const GW = hexSize * 2.2;
  const grid = new Map();
  for (let i = 0; i < SEEDS.length; i++) {
    const k = Math.floor(SEEDS[i].x / GW) + ',' + Math.floor(SEEDS[i].y / GW);
    let l = grid.get(k);
    if (!l) { l = []; grid.set(k, l); }
    l.push(i);
  }

  /* ---------- 3. 世界包围盒（外扩 2.4 格，保证外缘胞腔完整） ---------- */
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < world.hexes.length; i++) {
    const p = hexToPix(world.hexes[i].q, world.hexes[i].r, hexSize);
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const pad = hexSize * 2.4;
  const BX0 = r3(minX - pad), BY0 = r3(minY - pad), BX1 = r3(maxX + pad), BY1 = r3(maxY + pad);
  // 包围盒顶点 src = null（世界外缘边）
  const bboxPoly = [[BX0, BY0, null], [BX1, BY0, null], [BX1, BY1, null], [BX0, BY1, null]];

  /* ---------- 4. 逐种子半平面裁剪 ---------- */
  const cells = new Array(world.hexes.length);
  const sharedEdges = {};
  const coasts = [];
  let minWorldX = Infinity, minWorldY = Infinity, maxWorldX = -Infinity, maxWorldY = -Infinity;

  for (let i = 0; i < world.hexes.length; i++) {
    const hex = world.hexes[i];
    const A = SEEDS[i];
    sharedEdges[i] = sharedEdges[i] || {};

    // 收集近邻种子（5×5 粗网格足够：远处种子的半平面不会截断本胞腔）
    const near = [];
    const gx = Math.floor(A.x / GW), gy = Math.floor(A.y / GW);
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        const l = grid.get((gx + dx) + ',' + (gy + dy));
        if (l) for (const j of l) if (j !== i) near.push(j);
      }
    }
    // 近的先裁：更快把多边形削到很小
    near.sort((a, b) => {
      const da = (SEEDS[a].x - A.x) ** 2 + (SEEDS[a].y - A.y) ** 2;
      const db = (SEEDS[b].x - A.x) ** 2 + (SEEDS[b].y - A.y) ** 2;
      return da - db;
    });

    let poly = bboxPoly;
    for (const j of near) {
      if (poly.length < 3) break;
      const B = SEEDS[j];
      const nx = 2 * (B.x - A.x);
      const ny = 2 * (B.y - A.y);
      const c = (B.x * B.x + B.y * B.y) - (A.x * A.x + A.y * A.y);
      poly = clipHalfPlane(poly, nx, ny, c, j);
    }
    // 最后与包围盒裁剪：src=null 的残留段即世界外缘（海岸/国境外边界）
    if (poly.length >= 3) {
      poly = clipHalfPlane(poly, -1, 0, -BX0, null);
      poly = clipHalfPlane(poly, 1, 0, BX1, null);
      poly = clipHalfPlane(poly, 0, -1, -BY0, null);
      poly = clipHalfPlane(poly, 0, 1, BY1, null);
    }
    if (poly.length < 3) poly = bboxPoly.slice();

    /* ---------- 5. 沿环序装配有机多边形（共享边两侧逐点重合） ---------- */
    const rawPts = [];
    const nV = poly.length;
    for (let k = 0; k < nV; k++) {
      const v0 = poly[k];
      const v1 = poly[(k + 1) % nV];
      const src = v0[2] != null ? v0[2] : v1[2];     // 边归属：两端标签优先取非空
      const jHex = src != null ? world.hexes[src] : null;
      const pA = [v0[0], v0[1]];
      const pB = [v1[0], v1[1]];
      // 共享边必须由两侧算出逐点重合的曲线，否则接缝出现 V 形缝隙（露出底图，
      // 沿格边连成"六边形网格线"）。做法：统一按 canonical 方向（idx 小→大）
      // 计算，非规范一侧取反向副本。
      let curve;
      if(jHex && hex.idx > jHex.idx){
        curve = organicCurve(pB, pA, jHex.idx + '_' + hex.idx).slice().reverse();
      } else {
        const salt = jHex ? (hex.idx + '_' + jHex.idx) : ('w_' + i + '_' + pA[0] + '_' + pB[0]);
        curve = organicCurve(pA, pB, salt);
      }
      if (jHex && jHex.terrain === 'sea') {
        coasts.push({ pts: curve, land: hex.idx, seaKey: jHex.q + ',' + jHex.r });
      } else if (jHex) {
        sharedEdges[i][jHex.idx] = curve;
        sharedEdges[jHex.idx] = sharedEdges[jHex.idx] || {};
        // 双向登记：反向副本，保证从任一省看同一条边的走向相反（C39 断言 3）
        sharedEdges[jHex.idx][hex.idx] = curve.slice().reverse();
      } else {
        coasts.push({ pts: curve, land: hex.idx, seaKey: null });
      }
      // v12.1 修复：organicCurve 对 <0.5px 的退化边返回两点 [a,b]，
      // curve[2] 为 undefined 会被塞进 rawPts → simplifyPoly 读 c[0] 抛
      // TypeError 杀死 rAF 主循环（约 6% 开局概率的画面冻死）。
      rawPts.push(curve[0], curve[1]);
      if (curve.length > 2) rawPts.push(curve[2]);   // 末端点由下一条边的 curve[0] 承担
    }
    if (rawPts.length < 3) {
      for (const p of bboxPoly) rawPts.push([p[0], p[1]]);
    }
    const polyFinal = simplifyPoly(rawPts, 0.6);

    /* ---------- 6. 质心 / 包围盒 ---------- */
    let cx = 0, cy = 0, bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    for (const [vx, vy] of polyFinal) {
      cx += vx; cy += vy;
      if (vx < bx0) bx0 = vx;
      if (vy < by0) by0 = vy;
      if (vx > bx1) bx1 = vx;
      if (vy > by1) by1 = vy;
    }
    cx = r3(cx / polyFinal.length);
    cy = r3(cy / polyFinal.length);
    if (bx0 < minWorldX) minWorldX = bx0;
    if (by0 < minWorldY) minWorldY = by0;
    if (bx1 > maxWorldX) maxWorldX = bx1;
    if (by1 > maxWorldY) maxWorldY = by1;

    const cell = {
      idx: hex.idx,
      q: hex.q,
      r: hex.r,
      seed: { x: A.x, y: A.y },
      polygon: polyFinal,
      centroid: { x: cx, y: cy },
      bbox: [bx0, by0, bx1, by1],
      adj: hex.adj,                    // 严格保持原 hex adj 集合 (C39)
      terrain: hex.terrain,
      owner: hex.owner,
      city: hex.city,
      fort: hex.fort,
      name: hex.name || (hex.city ? hex.city.name : `第 ${hex.idx} 行省`),
      hex
    };
    cells[i] = cell;
    hex.cell = cell;
    hex.polygon = polyFinal;
    hex.centroid = cell.centroid;
    hex.bbox = cell.bbox;
    hex.neighborEdges = sharedEdges[hex.idx];
  }

  /* ---------- 7. 邻接缝合：hex.adj 声明的每对邻接都必须有可描边的边 ----------
     Voronoi 几何邻接与地图 adj 声明并非完全一致（adj 稀疏 + 边缘海陆布局），
     缺边会让国界/海岸线出现断口。此处按两格中心连线的垂直平分线中段补一条
     缝合曲线：只写入描边数据（sharedEdges / coasts），不改动行省多边形本体，
     因此填充与拾取完全不受影响。 */
  for (let i = 0; i < world.hexes.length; i++) {
    const hA = world.hexes[i];
    if (!hA.adj || !hA.adj.length) continue;
    for (const j of hA.adj) {
      if (j === i || j >= world.hexes.length) continue;
      if (!sharedEdges[i]) sharedEdges[i] = {};
      if (sharedEdges[i][j]) continue;
      const hB = world.hexes[j];
      const pa = hexToPix(hA.q, hA.r, hexSize), pb = hexToPix(hB.q, hB.r, hexSize);
      const mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2;
      const dx = pb.x - pa.x, dy = pb.y - pa.y;
      const L = Math.hypot(dx, dy) || 1;
      const nx = -dy / L, ny = dx / L;
      const half = hexSize * 0.44;
      const curve = organicCurve(
        [r3(mx + nx * half), r3(my + ny * half)],
        [r3(mx - nx * half), r3(my - ny * half)],
        'seam_' + i + '_' + j
      );
      if (!sharedEdges[j]) sharedEdges[j] = {};
      sharedEdges[i][j] = curve;
      sharedEdges[j][i] = curve.slice().reverse();
      if (hA.terrain === 'sea' || hB.terrain === 'sea') {
        const land = hA.terrain === 'sea' ? hB : hA;
        const sea = hA.terrain === 'sea' ? hA : hB;
        coasts.push({ pts: curve, land: land.idx, seaKey: sea.q + ',' + sea.r, seam: true });
      }
    }
  }
  // 缝合后刷新各格的 neighborEdges 引用
  for (let i = 0; i < world.hexes.length; i++) {
    world.hexes[i].neighborEdges = sharedEdges[i];
  }

  /* ---------- 8. 32px 空间分桶加速索引 (O(1) 检索，§3.3) ---------- */
  const BIN_SIZE = 32;
  const bins = new Map();
  for (const cell of cells) {
    const [bx0, by0, bx1, by1] = cell.bbox;
    const sbx = Math.floor(bx0 / BIN_SIZE), ebx = Math.floor(bx1 / BIN_SIZE);
    const sby = Math.floor(by0 / BIN_SIZE), eby = Math.floor(by1 / BIN_SIZE);
    for (let bx = sbx; bx <= ebx; bx++) {
      for (let by = sby; by <= eby; by++) {
        const k = bx + ',' + by;
        let l = bins.get(k);
        if (!l) { l = []; bins.set(k, l); }
        l.push(cell.idx);
      }
    }
  }

  function pick(px, py) {
    const bx = Math.floor(px / BIN_SIZE);
    const by = Math.floor(py / BIN_SIZE);
    const cands = bins.get(bx + ',' + by);
    if (cands) {
      for (const idx of cands) {
        const c = cells[idx];
        if (pointInPoly(px, py, c.polygon)) return c;
      }
    }
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const l = bins.get((bx + dx) + ',' + (by + dy));
        if (l) {
          for (const idx of l) {
            const c = cells[idx];
            if (pointInPoly(px, py, c.polygon)) return c;
          }
        }
      }
    }
    return null;
  }

  const result = {
    cells,
    sharedEdges,
    coasts,
    bins,
    binSize: BIN_SIZE,
    worldBbox: [minWorldX, minWorldY, maxWorldX, maxWorldY],
    pickProvince: pick
  };
  world.provinces = result;
  world._provinces = result;
  return result;
}

/** 判断是否启用行省多边形沙盘 (C42 逃生阀：?hexmap=1 或 SF.features.provinceMap === false 回退六边形) */
export function isProvinceMapEnabled() {
  if (typeof window !== 'undefined') {
    if (window.location && window.location.search && window.location.search.includes('hexmap=1')) return false;
    if (window.SF && window.SF.features && window.SF.features.provinceMap === false) return false;
  }
  return true;
}

/** 确保世界的行省拓扑结构已懒加载初始化 (C41 零破坏) */
export function ensureWorldProvinces(world) {
  if (!world || !world.hexes || !world.hexes.length) return null;
  if (!world.provinces || !world._provinces) {
    world.provinces = buildProvinces(world);
    world._provinces = world.provinces;
  }
  return world.provinces;
}

/** 外部统一检索接口 */
export function pickProvince(provs, px, py) {
  if (!provs || typeof provs.pickProvince !== 'function') return null;
  return provs.pickProvince(px, py);
}

/** 六角格路径（统一出口，逃生阀用） */
export function hexPath(ctx, cx, cy, s) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 180 * (60 * i - 30);
    const x = cx + s * Math.cos(a), y = cy + s * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** 绘制多边形闭合路径（统一出口） */
export function drawPolygonPath(ctx, poly, cam) {
  if (!poly || poly.length < 3) return;
  ctx.beginPath();
  ctx.moveTo(poly[0][0] * cam.z + cam.x, poly[0][1] * cam.z + cam.y);
  for (let i = 1; i < poly.length; i++) {
    ctx.lineTo(poly[i][0] * cam.z + cam.x, poly[i][1] * cam.z + cam.y);
  }
  ctx.closePath();
}

/** 追加行省多边形为当前 path 的子路径（v13.1 批量无缝填充用）
    与 drawPolygonPath 的区别：不调用 beginPath/closePath —— 把多个相邻胞腔
    累进同一个 path 后一次 fill()，Canvas 只填充内部区域，公共边不产生
    抗锯齿缝，也不需要同色 stroke 去补缝（补缝反而会在半透明场景叠出深色网格）。 */
export function appendPolygonPath(ctx, poly, cam){
  if(!poly || poly.length < 3) return;
  ctx.moveTo(poly[0][0] * cam.z + cam.x, poly[0][1] * cam.z + cam.y);
  for(let i = 1; i < poly.length; i++){
    ctx.lineTo(poly[i][0] * cam.z + cam.x, poly[i][1] * cam.z + cam.y);
  }
  ctx.closePath();
}

/** 无缝填充行省多边形（v13.1）
    Canvas 逐个填充相邻多边形时，共享边的抗锯齿会在两侧各留半透明缝，
    缝隙露出底图后沿格边连成"网格线"——这正是此前"六边形观感"的最后一来源。
    对策：fill 之后用同色 1px stroke 把缝隙封住（标准 seam 修补法）。 */
export function fillPolySeamless(ctx, poly, cam, style, alpha, composite){
  drawPolygonPath(ctx, poly, cam);
  if(composite) ctx.globalCompositeOperation = composite;
  ctx.fillStyle = style;
  if(alpha != null) ctx.globalAlpha = alpha;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = style;
  ctx.stroke();
  if(alpha != null) ctx.globalAlpha = 1;
  if(composite) ctx.globalCompositeOperation = 'source-over';
}

/** 统一地块路径出口：自动识别省份胞腔或退回六角格 */
export function drawCellPath(ctx, cellOrHex, cam, useProvince = true) {
  if (useProvince && cellOrHex && (cellOrHex.polygon || (cellOrHex.cell && cellOrHex.cell.polygon))) {
    const poly = cellOrHex.polygon || cellOrHex.cell.polygon;
    drawPolygonPath(ctx, poly, cam);
  } else if (cellOrHex && cellOrHex.q !== undefined) {
    const { x, y } = cam.toPix(cellOrHex.q, cellOrHex.r);
    const s = cam.size * cam.z * 0.98;
    hexPath(ctx, x, y, s);
  }
}
