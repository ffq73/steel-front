/* ============================================================
   render/layers.js —— 统帅部沙盘大厅与三维战术棋子渲染引擎 (v6.0)
   1. 沙盘胡桃木外框、深蓝水体海图经纬网、等深线与纸质底纹
   2. 地貌等高线浮雕、森林微集落、山脊阴影与国家边界发光线
   3. 精工立体北约战术棋子、经典双垂直状态条 (左绿HP/右黄ORG)、多师堆叠角标
   4. 动态战斗气泡与优势百分比仪表盘
   ============================================================ */

import { TERRAIN } from '../data/terrain.js';
import { NEUTRAL_COLOR } from '../core/palette.js';
import { UNITS } from '../data/units.js';
import { hexCorners, hexDist, pointInPoly } from '../core/geom.js';
import { drawModeLayer } from './mapModes.js';
import { drawEraOverlay } from './eraLayers.js';
import { getAllRiverEdges, hasRiverCrossing } from '../data/rivers.js';
import { getMapRailways, getMapSupplyHubs } from '../data/railways.js';
import { getHexWeather } from '../data/weather.js';
import { effectiveSpeed } from '../engine/movement.js';

import {
  hexPath,
  drawPolygonPath,
  appendPolygonPath,
  drawCellPath,
  fillPolySeamless,
  isProvinceMapEnabled,
  ensureWorldProvinces,
  pickProvince
} from './provinces.js';
import { assignHistoricalProvinceNames } from '../data/provinceNames.js';

// 四大时代专属 1920x1080 博物馆级高精地形浮雕底图缓存 (v11.0 M1)
const ERA_BG_IMAGES = {};
if(typeof Image !== 'undefined'){
  for(const era of ['ww1', 'ww2', 'coldwar', 'modern']){
    const img = new Image();
    img.src = `assets/map/bg_${era}.jpg`;
    img.onload = () => { ERA_BG_IMAGES[era] = img; };
  }
}

// v10.0 P1: 参谋部四层无缝高精平铺材质 (羊皮纸、深海波纹、参谋桌深木纹、军用帆布)
const MAP_TEXTURES = {};
const TEXTURE_PATTERNS = {};

if (typeof Image !== 'undefined') {
  const texFiles = {
    parchment: 'assets/textures/parchment.jpg',
    sea: 'assets/textures/sea_ripple.jpg',
    wood_desk: 'assets/textures/wood_desk.jpg',
    canvas: 'assets/textures/canvas.jpg'
  };
  for (const [key, url] of Object.entries(texFiles)) {
    const img = new Image();
    img.src = url;
    img.onload = () => {
      MAP_TEXTURES[key] = img;
      try {
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        TEXTURE_PATTERNS[key] = ctx.createPattern(c, 'repeat');
      } catch (e) {}
    };
  }
}

export class LayerRenderer {
  constructor(canvas, camera){
    this.canvas = canvas;
    this.cam = camera;
    this.dpr = window.devicePixelRatio || 1;
    this.bg = document.createElement('canvas');
    this.bg.width = canvas.width;
    this.bg.height = canvas.height;
    this.terrainDirty = true;
    this.mapDirty = true;
    this.mapModeId = 'default';   // v8.0 M2 地图模式
    this.lastDay = -1;
    this.floats = []; // 伤害浮字 {x, y, text, t, color}
    this.smokeParticles = []; // 动态硝烟升腾粒子 (v7.0 §3.4)
    this.activeBubbles = []; // 活跃战斗气泡屏幕坐标与参数
  }

  /* 逻辑（CSS）尺寸：所有绘制坐标都以它为准 */
  logicalW(){ return this.bg ? this.bg.width : this.canvas.clientWidth; }
  logicalH(){ return this.bg ? this.bg.height : this.canvas.clientHeight; }

  /* 离屏背景上下文：与主画布保持同一 DPR 语义（关键修复） */
  bgCtx(){
    const ctx = this.bg.getContext('2d');
    // v8.0 世界坐标缓存：固定 1:1 变换（合成时的缩放由 drawImage 承担）
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return ctx;
  }

  resize(){
    this.dpr = window.devicePixelRatio || 1;
    this.terrainDirty = true;
    this.mapDirty = true;
    // bg 尺寸在 drawBg 里按世界包围盒 × 档位重设（见 resizeBgToWorld）
  }

  /* 按世界包围盒与当前档位调整离屏画布尺寸（DPR 固定 1 以控制内存） */
  resizeBgToWorld(world){
    const wb = this.worldBounds(world);
    const tier = this._bgTier || 1;
    const bw = Math.ceil(wb.w * tier) + 4;
    const bh = Math.ceil(wb.h * tier) + 4;
    if(this.bg.width !== bw || this.bg.height !== bh){
      this.bg.width = bw;
      this.bg.height = bh;
    }
  }

  /* v8.0 M2：切换地图模式（只标脏背景层，不触碰动态层） */
  setMapMode(modeId){
    if(this.mapModeId === modeId) return;
    this.mapModeId = modeId;
    this.mapDirty = true;
  }

  invalidateTerrain(){ this.terrainDirty = true; }
  invalidateMap(){ this.mapDirty = true; }

  /* 3.1 沙盘水体、经纬网与地形底图 (v10.0 L1 羊皮纸地形浮雕地毯) */
  drawTerrain(world){
    if(!this.terrainDirty) return;
    const ctx = this.bgCtx();
    const w = this.logicalW(), h = this.logicalH();
    ctx.clearRect(0, 0, w, h);

    const useProv = isProvinceMapEnabled();
    if(useProv){
      ensureWorldProvinces(world);
      assignHistoricalProvinceNames(world);
    }

    // 1. 时代专属 1920x1080 博物馆级高精地形浮雕地毯 (v11.0 M1)
    const eraKey = world.era || (world.scenario === 'ww1' ? 'ww1' : world.scenario === 'coldwar' ? 'coldwar' : world.scenario === 'modern' ? 'modern' : 'ww2');
    const bgImg = ERA_BG_IMAGES[eraKey] || ERA_BG_IMAGES.ww2;
    if(bgImg && bgImg.complete && bgImg.naturalWidth > 0){
      ctx.drawImage(bgImg, 0, 0, w, h);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.12)';
      ctx.fillRect(0, 0, w, h);
    } else {
      const oceanGrad = ctx.createLinearGradient(0, 0, w, h);
      oceanGrad.addColorStop(0, '#0d1722');
      oceanGrad.addColorStop(0.5, '#132233');
      oceanGrad.addColorStop(1, '#182b3f');
      ctx.fillStyle = oceanGrad;
      ctx.fillRect(0, 0, w, h);
      if(TEXTURE_PATTERNS.sea){
        ctx.save();
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = TEXTURE_PATTERNS.sea;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }
    }
    // v12.0 M1：水体分层在两个分支下都必须执行 —— 时代地毯已有海图底色，
    // 深度晕与近岸浅水带负责「远海更深、近岸更浅」的立体感（旧代码只在
    // 无地毯分支绘制，海格又被下面循环套上陆地浮雕 → 大洋呈灰绿浑色）
    this.drawSeaDepth(ctx, world);

    // 2. 复古航海经纬度网格线
    ctx.save();
    ctx.strokeStyle = 'rgba(78, 115, 158, 0.10)';
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 8]);
    const step = 90;
    for(let x = 0; x < w; x += step){
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for(let y = 0; y < h; y += step){
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();

    // 3. 不规则历史行省多边形陆地底面与地貌浮雕 (v10.0 L1)
    // v12.0 M1 (C43)：terrain === 'sea' 的格子禁止进入陆地形填充路径，
    // 海洋观感由海洋地毯 + drawSeaDepth 深度晕 + 海岸高光共同负责。
    const cam = this.cam;
    // 3. 不规则历史行省多边形陆地底面与地貌浮雕 (v10.0 L1 → v13.1 分组批量填充)
    // v13.1 关键改动：按 terrain 分组，把同组所有行省胞腔累进**同一个 path**
    // 后一次 fill() —— Canvas 填充 path 内部区域，公共边不产生抗锯齿缝。
    // （此前逐格 fill + 同色 stroke 补缝，在半透明场景会在共享边叠加 alpha，
    //   反而加深出一张"六边形网格线"；这才是蜂巢观感的真正来源。）
    // v13.1：海格一并纳入分组（此前海格走独立路径，填充结果与陆地不一致）。
    // 海洋与陆地共用同一条"分组 → 批量 path → 一次 fill"的管线，观感才统一。
    const landByTerrain = new Map();
    for(const hex of world.hexes){
      if(!cam.visible(hex)) continue;
      const tk = hex.terrain;
      if(!landByTerrain.has(tk)) landByTerrain.set(tk, []);
      landByTerrain.get(tk).push(hex);
    }
    for(const [tk, list] of landByTerrain){
      // 该组共享一个定向浮雕渐变（按组内格心均值定位，保留立体光向）
      let ax = 0, ay = 0;
      for(const h of list){ const p2 = cam.toPix(h.q, h.r); ax += p2.x; ay += p2.y; }
      ax /= list.length; ay /= list.length;
      const t = TERRAIN[tk] || { color: '#5d6b40', name: '平原' };
      const R = cam.size * cam.z * 0.7;
      const reliefGrad = ctx.createLinearGradient(ax - R, ay - R, ax + R, ay + R);
      if(tk === 'mount'){
        reliefGrad.addColorStop(0, '#98a4b8');
        reliefGrad.addColorStop(0.35, t.color);
        reliefGrad.addColorStop(1, '#171e2a');
      } else if(tk === 'hills'){
        reliefGrad.addColorStop(0, '#b08d52');
        reliefGrad.addColorStop(0.4, t.color);
        reliefGrad.addColorStop(1, '#2b2313');
      } else if(tk === 'forest'){
        reliefGrad.addColorStop(0, '#3a6b44');
        reliefGrad.addColorStop(0.5, t.color);
        reliefGrad.addColorStop(1, '#0b1a10');
      } else if(tk === 'marsh'){
        reliefGrad.addColorStop(0, '#547a5e');
        reliefGrad.addColorStop(0.5, t.color);
        reliefGrad.addColorStop(1, '#16241c');
      } else if(tk === 'desert'){
        reliefGrad.addColorStop(0, '#e2c078');
        reliefGrad.addColorStop(0.5, t.color);
        reliefGrad.addColorStop(1, '#5c4a24');
      } else if(tk === 'city'){
        reliefGrad.addColorStop(0, '#6e7f99');
        reliefGrad.addColorStop(0.5, t.color);
        reliefGrad.addColorStop(1, '#1a2030');
      } else if(tk === 'sea'){
        // 海洋：内海浅青 → 外海深钢蓝（不透明，隔绝油画背景紫褐调）
        reliefGrad.addColorStop(0, '#4a7d8c');
        reliefGrad.addColorStop(0.5, '#2c5468');
        reliefGrad.addColorStop(1, '#1b3a4c');
      } else {
        reliefGrad.addColorStop(0, '#7f9159');
        reliefGrad.addColorStop(0.5, t.color);
        reliefGrad.addColorStop(1, '#27331f');
      }

      // 批量路径：同组一次 fill，天然无缝
      ctx.beginPath();
      for(const hex of list){
        if(useProv && hex.polygon) appendPolygonPath(ctx, hex.polygon, cam);
        else {
          const { x, y } = cam.toPix(hex.q, hex.r);
          const s2 = cam.size * cam.z * 0.98;
          ctx.moveTo(x + s2, y);
          for(let k = 1; k < 6; k++){
            const a = Math.PI / 180 * (60 * k - 30);
            ctx.lineTo(x + s2 * Math.cos(a), y + s2 * Math.sin(a));
          }
          ctx.closePath();
        }
      }
      ctx.fillStyle = reliefGrad;
      ctx.globalAlpha = (tk === 'sea') ? 1 : 0.94;
      ctx.fill();
      ctx.globalAlpha = 1;

      // 地貌微细节（裁剪进行省 + 确定性随机图案；海格不画）
      for(const hex of list){
        if(tk === 'sea') continue;
        const { x, y } = cam.toPix(hex.q, hex.r);
        this.drawTerrainDetails(ctx, tk, x, y, cam.size * cam.z, hex);
      }
    }
    // 胞腔内柔和暗角（逐格径向渐变，弱化以免相邻暗环相连成网格）
    if(useProv){
      for(const hex of world.hexes){
        if(hex.terrain === 'sea') continue;
        if(!cam.visible(hex) || !hex.polygon) continue;
        const { x, y } = cam.toPix(hex.q, hex.r);
        const s = cam.size * cam.z;
        const vg = ctx.createRadialGradient(x - s * 0.22, y - s * 0.22, s * 0.2, x, y, s * 1.35);
        vg.addColorStop(0, 'rgba(255, 255, 255, 0.05)');
        vg.addColorStop(0.65, 'rgba(0, 0, 0, 0)');
        vg.addColorStop(1, 'rgba(0, 0, 0, 0.09)');
        ctx.save();
        drawPolygonPath(ctx, hex.polygon, cam);
        ctx.fillStyle = vg;
        ctx.fill();
        ctx.restore();
      }
    }


    // 4. 自然海岸线海浪高光与浅海边缘 (v10.0 L1)
    if(useProv && world.provinces && world.provinces.coasts && world.provinces.coasts.length){
      ctx.save();
      // 浅海水晕
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
      ctx.lineWidth = Math.max(3.0, 4.5 * cam.z);
      ctx.lineCap = 'round';
      ctx.beginPath();
      for(const c of world.provinces.coasts){
        const pts = c.pts;
        if(!pts || pts.length < 2) continue;
        ctx.moveTo(pts[0][0] * cam.z + cam.x, pts[0][1] * cam.z + cam.y);
        for(let k = 1; k < pts.length; k++){
          ctx.lineTo(pts[k][0] * cam.z + cam.x, pts[k][1] * cam.z + cam.y);
        }
      }
      ctx.stroke();

      // 海浪白色波峰高光
      ctx.strokeStyle = 'rgba(186, 230, 253, 0.42)';
      ctx.lineWidth = Math.max(1.2, 1.8 * cam.z);
      ctx.beginPath();
      for(const c of world.provinces.coasts){
        const pts = c.pts;
        if(!pts || pts.length < 2) continue;
        ctx.moveTo(pts[0][0] * cam.z + cam.x, pts[0][1] * cam.z + cam.y);
        for(let k = 1; k < pts.length; k++){
          ctx.lineTo(pts[k][0] * cam.z + cam.x, pts[k][1] * cam.z + cam.y);
        }
      }
      ctx.stroke();
      ctx.restore();
    }

    // 5. 羊皮纸纸质纹理正片叠底 (v10.0 L1: multiply, globalAlpha = 0.10)
    const pPattern = TEXTURE_PATTERNS.parchment;
    if(pPattern){
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = 0.10;
      ctx.fillStyle = pPattern;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    // 6. 四周胡桃木实木画框质感边缘
    this.drawWarRoomDeskFrame(ctx, w, h);

    this.terrainDirty = false;
    this.mapDirty = true;   // 地形清屏后归属/模式层必须跟随重绘
  }

  /* ============================================================
     3.1.1 地貌微细节 v13.1 —— 裁剪进行省胞腔 + 确定性随机地貌图案
     · clip 到行省多边形：细节不再越界到邻省，避免"六边形里画方形"的割裂
     · 图案位置由 hex.idx 哈希派生：同种子可回放 (C40)，相邻格图案互不相同
     · 半径取胞腔包围盒：形状不一时细节密度自动跟随
     ============================================================ */
  drawTerrainDetails(ctx, terrain, cx, cy, s, hex){
    if(this._lowDetail) return;                 // 移动中跳过细节
    const z = this.cam.z;
    const cam = this.cam;
    const poly = (hex && hex.polygon && isProvinceMapEnabled()) ? hex.polygon : null;

    ctx.save();
    if(poly){
      drawPolygonPath(ctx, poly, cam);
      ctx.clip();                                // 关键：细节锁进行省内部
    }

    // 图案半径：胞腔包围盒折半（世界单位 → 屏幕）
    let r = s * 0.6;
    if(hex && hex.bbox){
      const bw = hex.bbox[2] - hex.bbox[0];
      const bh = hex.bbox[3] - hex.bbox[1];
      r = Math.max(bw, bh) * 0.48 * z;
    }
    // v13.1 尺度自适应细节层级：z<0.62 只铺大色块（远看是"质地"而不是噪点）
    const detail = z >= 1.15 ? 2 : (z >= 0.62 ? 1 : 0);
    const key = hex ? hex.idx : ((cx * 7 + cy * 13) | 0);
    const rnd = (i) => {
      let h = (Math.imul(key + 1, 2654435761) ^ Math.imul(i + 7, 40503)) >>> 0;
      h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13;
      return (h % 10000) / 10000;
    };
    const X = u => cx + u * r;
    const Y = v => cy + v * r;

    if(terrain === 'mount'){
      // 山脉：2~3 座险峰（向光面 / 背阴面 / 雪线），位置逐格不同
      const peaks = detail >= 2 ? (2 + Math.floor(rnd(1) * 2)) : (detail === 1 ? 2 : 1);
      for(let p = 0; p < peaks; p++){
        const ux = (rnd(p * 5 + 2) * 1.5 - 0.75);
        const uy = (rnd(p * 5 + 3) * 1.3 - 0.65);
        const sc = (0.42 + rnd(p * 5 + 4) * 0.34) * (detail === 0 ? 1.5 : 1);
        const bx = X(ux), by = Y(uy), m = r * sc;
        // 背阴面（东南）
        ctx.fillStyle = 'rgba(14, 19, 27, 0.50)';
        ctx.beginPath();
        ctx.moveTo(bx, by - m * 0.62);
        ctx.lineTo(bx + m * 0.66, by + m * 0.5);
        ctx.lineTo(bx, by + m * 0.3);
        ctx.closePath();
        ctx.fill();
        // 向光面（西北）
        ctx.fillStyle = 'rgba(158, 172, 192, 0.30)';
        ctx.beginPath();
        ctx.moveTo(bx, by - m * 0.62);
        ctx.lineTo(bx - m * 0.66, by + m * 0.5);
        ctx.lineTo(bx, by + m * 0.3);
        ctx.closePath();
        ctx.fill();
        // 山脊线
        ctx.strokeStyle = 'rgba(226, 232, 240, 0.34)';
        ctx.lineWidth = Math.max(0.8, 1.1 * z);
        ctx.beginPath();
        ctx.moveTo(bx, by - m * 0.62);
        ctx.lineTo(bx, by + m * 0.3);
        ctx.stroke();
        // 雪线
        ctx.fillStyle = 'rgba(248, 250, 252, 0.88)';
        ctx.beginPath();
        ctx.moveTo(bx, by - m * 0.62);
        ctx.lineTo(bx - m * 0.17, by - m * 0.33);
        ctx.lineTo(bx + m * 0.17, by - m * 0.33);
        ctx.closePath();
        ctx.fill();
      }
    } else if(terrain === 'hills'){
      // 丘陵：3 道起伏等高弧线
      for(let i = 0; i < 3; i++){
        const ux = (rnd(i * 3 + 1) * 1.2 - 0.6), uy = (rnd(i * 3 + 2) * 1.2 - 0.6);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.20)';
        ctx.lineWidth = Math.max(0.9, 1.2 * z);
        ctx.beginPath();
        ctx.arc(X(ux), Y(uy), r * (0.22 + i * 0.16), Math.PI * (0.85 + rnd(i) * 0.2), Math.PI * (1.85 + rnd(i + 9) * 0.2));
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.10)';
        ctx.beginPath();
        ctx.arc(X(ux), Y(uy) - 1.2 * z, r * (0.22 + i * 0.16), Math.PI * (1.9), Math.PI * (0.1));
        ctx.stroke();
      }
    } else if(terrain === 'forest'){
      // 森林：8~11 棵针叶树（双层树冠 + 落影）
      const n = detail >= 2 ? (8 + Math.floor(rnd(1) * 4)) : (detail === 1 ? 5 : 3);
      for(let i = 0; i < n; i++){
        const ux = rnd(i * 3 + 1) * 1.7 - 0.85;
        const uy = rnd(i * 3 + 2) * 1.7 - 0.85;
        const tw = r * (0.11 + rnd(i * 3 + 3) * 0.08) * (detail === 0 ? 1.9 : (detail === 1 ? 1.25 : 1));
        const tx = X(ux), ty = Y(uy);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.30)';
        ctx.beginPath();
        ctx.ellipse(tx + tw * 0.22, ty + tw * 0.52, tw * 0.62, tw * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#14381e';
        ctx.beginPath();
        ctx.moveTo(tx, ty - tw * 0.62);
        ctx.lineTo(tx - tw * 0.55, ty + tw * 0.5);
        ctx.lineTo(tx + tw * 0.55, ty + tw * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#276b39';
        ctx.beginPath();
        ctx.moveTo(tx, ty - tw * 0.72);
        ctx.lineTo(tx - tw * 0.38, ty + tw * 0.08);
        ctx.lineTo(tx + tw * 0.38, ty + tw * 0.08);
        ctx.closePath();
        ctx.fill();
      }
    } else if(terrain === 'marsh'){
      // 沼泽：暗水洼 + 芦苇丛
      for(let i = 0; i < 3; i++){
        const ux = rnd(i * 4 + 1) * 1.4 - 0.7, uy = rnd(i * 4 + 2) * 1.4 - 0.7;
        ctx.fillStyle = 'rgba(16, 38, 30, 0.55)';
        ctx.beginPath();
        ctx.ellipse(X(ux), Y(uy), r * (0.16 + rnd(i + 5) * 0.12), r * (0.07 + rnd(i + 6) * 0.05), rnd(i + 7) * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(120, 150, 130, 0.55)';
      ctx.lineWidth = Math.max(0.7, 0.9 * z);
      for(let i = 0; i < 7; i++){
        const ux = rnd(i * 2 + 21) * 1.6 - 0.8, uy = rnd(i * 2 + 22) * 1.6 - 0.8;
        const rx = X(ux), ry = Y(uy);
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 1.4 * z, ry - r * 0.16);
        ctx.stroke();
      }
    } else if(terrain === 'city'){
      // 城市：街区网格（逐格朝向不同）+ 建筑块
      const rot = rnd(1) * Math.PI;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.strokeStyle = 'rgba(12, 18, 30, 0.55)';
      ctx.lineWidth = Math.max(0.8, 1.1 * z);
      ctx.beginPath();
      for(let i = (detail >= 1 ? -1 : 0); i <= 1; i++){
        ctx.moveTo(-r * 0.8, i * r * 0.38);
        ctx.lineTo(r * 0.8, i * r * 0.38);
        ctx.moveTo(i * r * 0.42, -r * 0.62);
        ctx.lineTo(i * r * 0.42, r * 0.62);
      }
      ctx.stroke();
      ctx.fillStyle = 'rgba(70, 82, 104, 0.75)';
      for(let i = 0; i < 4; i++){
        const bx = (rnd(i * 3 + 1) * 1.3 - 0.65) * r;
        const by = (rnd(i * 3 + 2) * 1.1 - 0.55) * r;
        ctx.fillRect(bx, by, r * 0.16, r * 0.13);
      }
      ctx.restore();
    } else if(terrain === 'desert'){
      // 沙漠：风蚀沙丘弧线
      for(let i = 0; i < 3; i++){
        const uy = (i - 1) * r * 0.42 + (rnd(i + 1) - 0.5) * r * 0.2;
        ctx.strokeStyle = 'rgba(245, 190, 110, 0.16)';
        ctx.lineWidth = Math.max(0.9, 1.2 * z);
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.85, cy + uy);
        ctx.quadraticCurveTo(cx, cy + uy - r * 0.16, cx + r * 0.85, cy + uy);
        ctx.stroke();
      }
    } else {
      // 平原：田块拼布（不同明度的耕地块，低缩放下也能读出"农业区"质地）
      //      + 高缩放叠加麦垄沟纹 + 1~2 座红顶农庄
      const blocks = detail >= 2 ? 5 : (detail === 1 ? 4 : 3);
      for(let i = 0; i < blocks; i++){
        const bx = X(rnd(i * 4 + 31) * 1.6 - 0.8), by = Y(rnd(i * 4 + 32) * 1.6 - 0.8);
        const bw = r * (0.34 + rnd(i * 4 + 33) * 0.40);
        const bh = r * (0.26 + rnd(i * 4 + 34) * 0.34);
        const tone = rnd(i * 4 + 35);
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate((tone - 0.5) * 0.5);
        // 耕地块：暖麦/橄榄/褐三色交替，透明度低以免脏
        ctx.fillStyle = tone < 0.34 ? 'rgba(198, 176, 96, 0.13)'
                      : tone < 0.67 ? 'rgba(122, 142, 78, 0.15)'
                                    : 'rgba(150, 118, 74, 0.12)';
        ctx.fillRect(-bw * 0.5, -bh * 0.5, bw, bh);
        ctx.strokeStyle = 'rgba(20, 26, 18, 0.18)';
        ctx.lineWidth = Math.max(0.6, 0.9 * z);
        ctx.strokeRect(-bw * 0.5, -bh * 0.5, bw, bh);
        ctx.restore();
      }
      if(detail >= 1){
        const ang = rnd(1) * Math.PI;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(ang);
        ctx.strokeStyle = 'rgba(232, 208, 130, 0.13)';
        ctx.lineWidth = Math.max(0.9, 1.3 * z);
        ctx.beginPath();
        for(let i = -3; i <= 3; i++){
          ctx.moveTo(-r * 0.92, i * r * 0.2);
          ctx.lineTo(r * 0.92, i * r * 0.2 + r * 0.1);
        }
        ctx.stroke();
        ctx.restore();
      }
      const farms = 1 + Math.floor(rnd(2) * 2);
      for(let i = 0; i < farms; i++){
        const fx = X(rnd(i * 5 + 11) * 1.5 - 0.75), fy = Y(rnd(i * 5 + 12) * 1.5 - 0.75);
        const fw = Math.max(2.2, r * 0.09);
        ctx.fillStyle = '#7c4a12';
        ctx.fillRect(fx, fy, fw, fw * 0.78);
        ctx.fillStyle = '#9b2c22';
        ctx.beginPath();
        ctx.moveTo(fx - fw * 0.12, fy);
        ctx.lineTo(fx + fw * 0.5, fy - fw * 0.5);
        ctx.lineTo(fx + fw * 1.12, fy);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /* 统帅部实木画框与四角黄铜铆钉 */
  drawWarRoomDeskFrame(ctx, w, h){
    ctx.save();
    // 边框暗角
    const grad = ctx.createRadialGradient(w/2, h/2, Math.min(w,h)*0.45, w/2, h/2, Math.hypot(w,h)/2);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(8,12,18,0.7)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // 外框实木边缘
    ctx.strokeStyle = 'rgba(38, 28, 18, 0.85)';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, w - 6, h - 6);

    // 黄铜细金线
    ctx.strokeStyle = 'rgba(181, 146, 71, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.restore();
  }

  /* 3.1.2 宏观战略国家大名水印 (Grand Strategy Country Watermarks) */
  drawGrandCountryLabels(ctx, world){
    const cam = this.cam;
    const nationHexes = new Map();
    for(const h of world.hexes){
      if(h.owner && h.owner !== 'N'){
        if(!nationHexes.has(h.owner)) nationHexes.set(h.owner, []);
        nationHexes.get(h.owner).push(h);
      }
    }
    ctx.save();
    for(const [natTag, hexes] of nationHexes.entries()){
      const nat = world.nations[natTag];
      if(!nat || hexes.length < 2) continue;
      let sumX = 0, sumY = 0, count = 0;
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for(const h of hexes){
        const p = cam.toPix(h.q, h.r);
        sumX += p.x; sumY += p.y; count++;
        if(p.x < minX) minX = p.x;
        if(p.x > maxX) maxX = p.x;
        if(p.y < minY) minY = p.y;
        if(p.y > maxY) maxY = p.y;
      }
      if(count === 0) continue;
      const cx = sumX / count;
      const cy = sumY / count;
      const span = Math.hypot(maxX - minX, maxY - minY);
      if(span < 65) continue;

      const name = nat.name || natTag;
      const shortName = name.replace(/第三帝国|共和国|王国|联盟/, '').trim() || name;
      const spacedName = shortName.split('').join('   ');
      const fontSize = Math.max(13, Math.min(34, Math.round(span * 0.12)));
      ctx.font = `bold ${fontSize}px "Noto Serif SC", "Georgia", "Times New Roman", serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.fillStyle = 'rgba(255, 245, 220, 0.22)';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
      ctx.shadowBlur = 8;
      ctx.fillText(spacedName, cx, cy);
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  /* v10.0 P5: 低倍率地名水印层 (cam.z < 0.50 时 30% 透明度显示行省真实历史地名) */
  drawProvinceWatermarks(ctx, world){
    const cam = this.cam;
    if(cam.z >= 0.52) return; // 仅在宏观战略视角显示行省地名水印
    ctx.save();
    ctx.globalAlpha = 0.30;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 10px "Noto Serif SC", "Georgia", serif';
    ctx.fillStyle = '#f8fafc';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 4;

    for(const h of world.hexes){
      if(!h.name || h.terrain === 'sea' || !cam.visible(h)) continue;
      // 稀疏采样：每 3 格呈现一个地名水印，避免拥挤重叠
      if((h.idx % 3 !== 0) && !h.city) continue;
      const { x, y } = cam.toPix(h.q, h.r);
      ctx.fillText(h.name, x, y);
    }
    ctx.restore();
  }

  /* 3.2 归属层、动态天气覆层、河流、铁路与城市地标 (v10.0 L2 政治沙盘与边界着色) */
  drawMapMode(world, day){
    if(!this.mapDirty) return;
    const ctx = this.bgCtx();
    const cam = this.cam;

    const useProv = isProvinceMapEnabled();
    if(useProv){
      ensureWorldProvinces(world);
      assignHistoricalProvinceNames(world);
    }

    // 1. 各不规则历史行省国家领土底色与天气遮罩 (v11.0 §2 M3)
    for(const hex of world.hexes){
      if(!cam.visible(hex)) continue;
      // v11.0：海洋不参与政治填色 —— 旧代码把 #333 以 0.36 叠在海面上，
      // 整片大洋被压成暗褐，既脏又看不出海陆交界
      if(hex.terrain === 'sea') continue;
      const { x, y } = cam.toPix(hex.q, hex.r);
      const s = cam.size * cam.z;
      const nat = world.nations[hex.owner];

      // 国家领土着色 (v13.1)：改用 multiply 混合 —— 底图的地貌明暗与肌理
      // 全部透出，政治色只做"染色"不再"覆盖"。这是消除紫灰脏感的关键：
      // 旧的普通 alpha 叠色会把暖褐地形压成冷紫，且抹平立体感。
      if(useProv && hex.polygon){
        drawPolygonPath(ctx, hex.polygon, cam);
      } else {
        hexPath(ctx, x, y, s * 0.98);
      }
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = 0.52;
      ctx.fillStyle = nat ? nat.color : NEUTRAL_COLOR;
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = nat ? nat.color : NEUTRAL_COLOR;
      ctx.stroke();                       // 封缝：否则接缝透出底图形成网格线
      ctx.restore();

      // 动态天气视觉覆层 (暴雪白霜 / 深秋泥泞)
      this.drawWeatherOverlay(ctx, hex, x, y, s, world);

      // v8.0 §2.1 占领区斜条纹：控制方色为底 + 原主色 45° 条纹（HOI4 视觉语言）
      const origOwner = hex._orig;
      if(origOwner && origOwner !== hex.owner && world.nations[origOwner]){
        ctx.save();
        if(useProv && hex.polygon){
          drawPolygonPath(ctx, hex.polygon, cam);
        } else {
          hexPath(ctx, x, y, s * 0.98);
        }
        ctx.clip();
        ctx.globalAlpha = 0.30;
        ctx.strokeStyle = world.nations[origOwner].color;
        ctx.lineWidth = Math.max(1.6, 2.6 * cam.z);
        const stripeStep = Math.max(5, 10 * cam.z);
        ctx.beginPath();
        for(let d = -s * 2.2; d < s * 2.2; d += stripeStep){
          ctx.moveTo(x + d, y - s * 1.4);
          ctx.lineTo(x + d + s * 1.6, y + s * 1.4);
        }
        ctx.stroke();
        ctx.restore();
      }
    }

    // 1.2 城市光晕 (v12.0 M4 / D6)：首都 = 暖金 radial glow（≈1.2 格），
    // 大城市（w>=3）= 冷白弱光晕（≈0.7 格），小城不加 —— 首都一眼可辨。
    // 画在政治覆色之后、省名水印之前；进地图缓存路径，不占每帧。
    ctx.save();
    for(const hex of world.hexes){
      if(!hex.city || !cam.visible(hex)) continue;
      const { x, y } = cam.toPix(hex.q, hex.r);
      const s = cam.size * cam.z;
      const isCap = !!hex.city.cap;
      const wgt = hex.city.w || 1;
      if(isCap){
        const r = s * 1.2;
        const glow = ctx.createRadialGradient(x, y, s * 0.1, x, y, r);
        glow.addColorStop(0, 'rgba(255, 214, 130, 0.36)');
        glow.addColorStop(0.55, 'rgba(255, 190, 100, 0.15)');
        glow.addColorStop(1, 'rgba(255, 190, 100, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      } else if(wgt >= 3){
        const r = s * 0.7;
        const glow = ctx.createRadialGradient(x, y, s * 0.08, x, y, r);
        glow.addColorStop(0, 'rgba(214, 226, 240, 0.20)');
        glow.addColorStop(1, 'rgba(214, 226, 240, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // 1.5 宏观国家战略大名水印与低倍行省地名水印
    this.drawGrandCountryLabels(ctx, world);
    this.drawProvinceWatermarks(ctx, world);

    // 2. 战术水系与贝塞尔自然弯曲河流 (v7.0 §3.2)
    this.drawRivers(ctx, world);

    // 3. 后勤铁路网与补给枢纽微标 (按 F4 或深入微观视角时呈现，大幅减少主战场杂乱度)
    if(this.mapModeId === 'logistics' || cam.z >= 1.05){
      this.drawRailways(ctx, world);
      this.drawSupplyHubs(ctx, world);
    }

    // 4. 边界三级权重体系 (v12.0 M3 / C45)：国界（最重：深色剪影+所属国低强度
    //    霓虹）> 省界（≈0.8px 细虚线，仅 z>=1.0 淡入的 LOD）> 海岸（独立高光，
    //    不属于任何一级边）。v12.0 性能：按类别批量收集路径一次描边，
    //    替换旧的逐边 save/stroke；帧耗时预算 ≤ v11 基线 +1.5ms。
    const provEdges = [];            // 省界（同国陆格相邻边）
    const natDark = [];              // 国界深色剪影
    const natNeon = new Map();       // 国界所属国色霓虹：color -> edges[]
    const hostileEdges = [];         // 交战前线红线
    const hostileTeeth = [];         // 前线刻度齿
    const drawnBorders = new Set();
    for(const hex of world.hexes){
      if(!cam.visible(hex)) continue;
      const nat = world.nations[hex.owner];
      for(const ni of hex.adj){
        const nh = world.hexes[ni];
        if(!nh) continue;

        const borderKey = Math.min(hex.idx, ni) + '_' + Math.max(hex.idx, ni);
        if(drawnBorders.has(borderKey)) continue;
        drawnBorders.add(borderKey);

        // C45：海陆交界是海岸，不进国界/省界描边（海岸高光独立负责）
        if(hex.terrain === 'sea' || nh.terrain === 'sea') continue;

        const isSameOwner = (nh.owner === hex.owner);
        const edge = useProv ? ((hex.neighborEdges && hex.neighborEdges[ni]) || (world.provinces?.sharedEdges?.[hex.idx]?.[ni])) : null;

        if(isSameOwner){
          // 省界：细(≈0.8px)低对比，仅 z>=1.0 才淡入 (LOD)
          if(cam.z >= 1.0){
            if(edge && edge.length >= 2){
              provEdges.push(edge);
            } else {
              const { x, y } = cam.toPix(hex.q, hex.r);
              const { x: qx, y: qy } = cam.toPix(nh.q, nh.r);
              const ang = Math.atan2(qy - y, qx - x);
              const a1 = ang + Math.PI / 3, a2 = ang - Math.PI / 3;
              const s = cam.size * cam.z;
              provEdges.push([[x + s * 0.98 * Math.cos(a1), y + s * 0.98 * Math.sin(a1)],
                              [x + s * 0.98 * Math.cos(a2), y + s * 0.98 * Math.sin(a2)]]);
            }
          }
          continue;
        }

        // 国界（不同归属方的陆格边）
        let pts = edge;
        if(!pts || pts.length < 2){
          const { x, y } = cam.toPix(hex.q, hex.r);
          const { x: qx, y: qy } = cam.toPix(nh.q, nh.r);
          const ang = Math.atan2(qy - y, qx - x);
          const a1 = ang + Math.PI / 3, a2 = ang - Math.PI / 3;
          const s = cam.size * cam.z;
          pts = [[x + s * 0.98 * Math.cos(a1), y + s * 0.98 * Math.sin(a1)],
                 [x + s * 0.98 * Math.cos(a2), y + s * 0.98 * Math.sin(a2)]];
        }
        natDark.push(pts);
        const neonColor = nat ? nat.color : 'rgba(255, 255, 255, 0.4)';
        if(!natNeon.has(neonColor)) natNeon.set(neonColor, []);
        natNeon.get(neonColor).push(pts);

        // 交战前线铁丝网黑红警戒线
        const isHostile = (nat && (nat.atWarWith || []).includes(nh.owner));
        if(isHostile){
          hostileEdges.push(pts);
          if(cam.z >= 0.60){
            const midIdx = Math.floor(pts.length / 2);
            const pA = pts[midIdx - 1], pB = pts[midIdx];
            const sxA = pA[0] * cam.z + cam.x, syA = pA[1] * cam.z + cam.y;
            const sxB = pB[0] * cam.z + cam.x, syB = pB[1] * cam.z + cam.y;
            const mx = (sxA + sxB) / 2, my = (syA + syB) / 2;
            const edx = sxB - sxA, edy = syB - syA;
            const elen = Math.hypot(edx, edy) || 1;
            hostileTeeth.push({ mx, my, nx: -edy / elen, ny: edx / elen });
          }
        }
      }
    }

    const strokeEdgeBatch = (edges, style, width, dash, alpha) => {
      if(!edges.length) return;
      ctx.save();
      ctx.strokeStyle = style;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if(alpha != null) ctx.globalAlpha = alpha;
      if(dash) ctx.setLineDash(dash);
      ctx.beginPath();
      for(const pts of edges){
        ctx.moveTo(pts[0][0] * cam.z + cam.x, pts[0][1] * cam.z + cam.y);
        for(let k = 1; k < pts.length; k++){
          ctx.lineTo(pts[k][0] * cam.z + cam.x, pts[k][1] * cam.z + cam.y);
        }
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    };

    // 4.1 省界：细虚线低对比（z>=1.0 淡入，z 越大越清晰）
    strokeEdgeBatch(provEdges,
      `rgba(255, 255, 255, ${(Math.min(0.14, 0.05 + 0.09 * (cam.z - 1.0))).toFixed(3)})`,
      Math.max(0.8, 0.9 * cam.z), [3 * cam.z, 4 * cam.z]);

    // 4.2 国界深黑立体剪影（全图最重的线）
    strokeEdgeBatch(natDark, 'rgba(4, 7, 12, 0.92)', Math.max(2.2, 2.8 * cam.z));

    // 4.3 国界所属国色低强度霓虹：先一层宽晕，再一层芯线
    for(const [color, edges] of natNeon){
      strokeEdgeBatch(edges, color, Math.max(4.0, 5.0 * cam.z), null, 0.30);
    }
    for(const [color, edges] of natNeon){
      strokeEdgeBatch(edges, color, Math.max(1.3, 1.6 * cam.z), null, 0.92);
    }

    // 4.4 交战前线铁丝网警戒线 + 黑红刻度齿
    strokeEdgeBatch(hostileEdges, '#ef4444', Math.max(2.2, 2.8 * cam.z), [6 * cam.z, 3.5 * cam.z]);
    if(hostileTeeth.length){
      ctx.save();
      ctx.strokeStyle = '#991b1b';
      ctx.lineWidth = Math.max(1.6, 2.2 * cam.z);
      ctx.beginPath();
      for(const th of hostileTeeth){
        ctx.moveTo(th.mx - th.nx * 3.5 * cam.z, th.my - th.ny * 3.5 * cam.z);
        ctx.lineTo(th.mx + th.nx * 3.5 * cam.z, th.my + th.ny * 3.5 * cam.z);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 5. 城市与胜利点 (VP)
    for(const hex of world.hexes){
      if(!cam.visible(hex)) continue;
      if(hex.city){
        const { x, y } = cam.toPix(hex.q, hex.r);
        const s = cam.size * cam.z;
        this.drawCityLandmark(ctx, hex.city, x, y, s, cam.z);
      }
    }
    // v8.0 M2：叠加当前地图模式图层（仅背景层重绘时执行）
    if(this.mapModeId && this.mapModeId !== 'default'){
      drawModeLayer(ctx, world, cam, this, this.mapModeId);
    }

    this.mapDirty = false;
  }

  /* 3.2.1 动态天气覆层：极寒冬雪白霜与深秋翻浆泥泞 (v7.0 §3.4) */
  drawWeatherOverlay(ctx, hex, x, y, s, world){
    if(this._lowDetail) return;   // v8.0 motion LOD：移动中跳过天气覆层
    const weather = getHexWeather(world, hex);
    if(weather === 'clear') return;

    ctx.save();
    if(weather === 'snow'){
      // 极寒霜雪覆层：冰晶白霜遮罩
      drawCellPath(ctx, hex, this.cam, isProvinceMapEnabled());
      ctx.fillStyle = 'rgba(241, 245, 249, 0.28)';
      ctx.fill();

      // 冰雪微粒结晶
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      const snowDots = [[-0.2, -0.15], [0.15, -0.2], [-0.1, 0.2], [0.2, 0.15]];
      for(const [ox, oy] of snowDots){
        ctx.beginPath();
        ctx.arc(x + ox * s, y + oy * s, Math.max(1, 1.4 * this.cam.z), 0, Math.PI * 2);
        ctx.fill();
      }
    } else if(weather === 'mud'){
      // 深秋泥泞翻浆覆层：湿地泥水
      drawCellPath(ctx, hex, this.cam, isProvinceMapEnabled());
      ctx.fillStyle = 'rgba(68, 45, 25, 0.28)';
      ctx.fill();

      // 泥泞深色水洼反光
      ctx.fillStyle = 'rgba(30, 20, 10, 0.35)';
      ctx.beginPath();
      ctx.ellipse(x - s * 0.1, y + s * 0.15, s * 0.22, s * 0.1, Math.PI * 0.1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /* 3.2.2 计算两相邻六角格的共有边界端点与贝塞尔控制点 */
  getSharedHexEdge(cam, h1, h2){
    const p1 = cam.toPix(h1.q, h1.r);
    const p2 = cam.toPix(h2.q, h2.r);
    const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.hypot(dx, dy);
    if(dist === 0) return null;

    const ux = dx / dist, uy = dy / dist;
    const px = -uy, py = ux;
    const s = cam.size * cam.z;
    const halfEdge = s * 0.52;

    const pA = { x: mid.x + px * halfEdge, y: mid.y + py * halfEdge };
    const pB = { x: mid.x - px * halfEdge, y: mid.y - py * halfEdge };

    // 贝塞尔自然曲折控制点 (基于六角格坐标确定性微弯)
    const meander = (Math.sin(h1.q * 11 + h1.r * 17) * 0.20) * s;
    const cp = { x: mid.x + ux * meander, y: mid.y + uy * meander };

    return { pA, pB, cp, mid };
  }

  /* 3.2.3 自然水系层：贴合格边的多级有机水系与动态微波浪 (v10.0 M2) */
  drawRivers(ctx, world){
    if(this._lowDetail) return;
    const cam = this.cam;
    const riverEdges = getAllRiverEdges(world);
    if(!riverEdges || !riverEdges.length) return;

    ctx.save();
    // 0. 深层地质河床下切凹陷软阴影 (深色泥床与大地割裂感)
    ctx.strokeStyle = 'rgba(2, 28, 48, 0.45)';
    ctx.lineWidth = Math.max(5, 7.5 * cam.z);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for(const edge of riverEdges){
      const h1 = world.at[edge.q1 + ',' + edge.r1];
      const h2 = world.at[edge.q2 + ',' + edge.r2];
      if(!h1 || !h2 || (!cam.visible(h1) && !cam.visible(h2))) continue;

      const geom = this.getSharedHexEdge(cam, h1, h2);
      if(!geom) continue;

      ctx.beginPath();
      ctx.moveTo(geom.pA.x, geom.pA.y);
      ctx.quadraticCurveTo(geom.cp.x, geom.cp.y, geom.pB.x, geom.pB.y);
      ctx.stroke();
    }

    // 1. 底层深海蓝河床与深色水缘 (#0284c7)
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = Math.max(3.2, 4.6 * cam.z);

    for(const edge of riverEdges){
      const h1 = world.at[edge.q1 + ',' + edge.r1];
      const h2 = world.at[edge.q2 + ',' + edge.r2];
      if(!h1 || !h2 || (!cam.visible(h1) && !cam.visible(h2))) continue;

      const geom = this.getSharedHexEdge(cam, h1, h2);
      if(!geom) continue;

      ctx.beginPath();
      ctx.moveTo(geom.pA.x, geom.pA.y);
      ctx.quadraticCurveTo(geom.cp.x, geom.cp.y, geom.pB.x, geom.pB.y);
      ctx.stroke();
    }

    // 2. 顶层清澈奔涌中轴水流与动态微波浪 (#38bdf8 / #7dd3fc)
    ctx.strokeStyle = '#7dd3fc';
    ctx.lineWidth = Math.max(1.6, 2.4 * cam.z);
    const dZ = Math.max(1, cam.z);
    ctx.setLineDash([7 * dZ, 5 * dZ]);
    ctx.lineDashOffset = -(Date.now() * 0.006) % (12 * dZ || 12);

    for(const edge of riverEdges){
      const h1 = world.at[edge.q1 + ',' + edge.r1];
      const h2 = world.at[edge.q2 + ',' + edge.r2];
      if(!h1 || !h2 || (!cam.visible(h1) && !cam.visible(h2))) continue;

      const geom = this.getSharedHexEdge(cam, h1, h2);
      if(!geom) continue;

      ctx.beginPath();
      ctx.moveTo(geom.pA.x, geom.pA.y);
      ctx.quadraticCurveTo(geom.cp.x, geom.cp.y, geom.pB.x, geom.pB.y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // 3. 历史河流大名水系标注 (当放大观察 z>=0.72 时，沿名川中段柔和绘制名川标)
    if(cam.z >= 0.72){
      ctx.font = `italic bold ${Math.max(9, Math.round(11 * cam.z))}px sans-serif`;
      ctx.fillStyle = 'rgba(14, 116, 144, 0.82)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const labelledRivers = new Set();
      for(let i = 0; i < riverEdges.length; i++){
        const edge = riverEdges[i];
        if(!edge.name || labelledRivers.has(edge.name)) continue;
        const h1 = world.at[edge.q1 + ',' + edge.r1];
        const h2 = world.at[edge.q2 + ',' + edge.r2];
        if(!h1 || !h2 || (!cam.visible(h1) && !cam.visible(h2))) continue;
        const geom = this.getSharedHexEdge(cam, h1, h2);
        if(!geom) continue;
        const shortName = edge.name.split(' ')[0];
        ctx.save();
        ctx.translate(geom.mid.x, geom.mid.y);
        const ang = Math.atan2(geom.pB.y - geom.pA.y, geom.pB.x - geom.pA.x);
        ctx.rotate(ang > Math.PI/2 ? ang - Math.PI : (ang < -Math.PI/2 ? ang + Math.PI : ang));
        ctx.fillText(shortName, 0, -5 * cam.z);
        ctx.restore();
        labelledRivers.add(edge.name);
      }
    }

    ctx.restore();
  }

  /* 3.2.4 后勤双轨铁路线：黑色枕木与双轨银钢细线 (v7.0 §3.3) */
  drawRailways(ctx, world){
    if(this._lowDetail) return;   // v8.0 motion LOD：移动中跳过铁路
    const cam = this.cam;
    const lines = getMapRailways(world);
    if(!lines || !lines.length) return;

    ctx.save();
    const z = cam.z;

    for(const line of lines){
      const h1 = world.at[line.from.q + ',' + line.from.r];
      const h2 = world.at[line.to.q + ',' + line.to.r];
      if(!h1 || !h2 || (!cam.visible(h1) && !cam.visible(h2))) continue;

      const p1 = cam.toPix(h1.q, h1.r);
      const p2 = cam.toPix(h2.q, h2.r);
      const dx = p2.x - p1.x, dy = p2.y - p1.y;
      const dist = Math.hypot(dx, dy);
      if(dist < 5) continue;

      const ux = dx / dist, uy = dy / dist;
      const px = -uy, py = ux;

      // 1. 碎石路基底色 (深褐色压痕)
      ctx.strokeStyle = 'rgba(28, 25, 23, 0.75)';
      ctx.lineWidth = Math.max(3.5, 4.5 * z);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      // 2. 黑色深色木质枕木 (垂直于轨道横向排列)
      const tieSpacing = Math.max(6, 7 * z);
      const numTies = Math.floor(dist / tieSpacing);
      const tieHalfW = Math.max(3, 4 * z);

      ctx.strokeStyle = '#1c1917';
      ctx.lineWidth = Math.max(1.2, 1.5 * z);
      ctx.beginPath();
      for(let i = 1; i < numTies; i++){
        const tx = p1.x + ux * (i * tieSpacing);
        const ty = p1.y + uy * (i * tieSpacing);
        ctx.moveTo(tx + px * tieHalfW, ty + py * tieHalfW);
        ctx.lineTo(tx - px * tieHalfW, ty - py * tieHalfW);
      }
      ctx.stroke();

      // 3. 双轨金属银钢钢轨 (两根平行细线)
      const railOffset = Math.max(1.3, 1.8 * z);
      ctx.strokeStyle = 'rgba(203, 213, 225, 0.85)';
      ctx.lineWidth = Math.max(0.9, 1.1 * z);

      ctx.beginPath();
      ctx.moveTo(p1.x + px * railOffset, p1.y + py * railOffset);
      ctx.lineTo(p2.x + px * railOffset, p2.y + py * railOffset);
      ctx.moveTo(p1.x - px * railOffset, p1.y - py * railOffset);
      ctx.lineTo(p2.x - px * railOffset, p2.y - py * railOffset);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* 3.2.5 补给枢纽微标：金铜双圈徽章与断供红色惊叹号 (v7.0 §3.3) */
  drawSupplyHubs(ctx, world){
    if(this._lowDetail) return;   // v8.0 motion LOD：移动中跳过补给枢纽
    const cam = this.cam;
    const hubs = getMapSupplyHubs(world);
    if(!hubs || !hubs.length) return;

    const z = cam.z;
    const r = Math.max(6, 7.5 * z);

    for(const hub of hubs){
      const h = world.at[hub.q + ',' + hub.r];
      if(!h || !cam.visible(h)) continue;

      const p = cam.toPix(h.q, h.r);
      const s = cam.size * z;
      const hx = p.x + s * 0.38;
      const hy = p.y - s * 0.38;

      ctx.save();
      // 徽章外层光晕
      ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
      ctx.beginPath();
      ctx.arc(hx, hy, r + 2, 0, Math.PI * 2);
      ctx.fill();

      // 黄铜/青铜金属双圆框
      const hubGrad = ctx.createLinearGradient(hx - r, hy - r, hx + r, hy + r);
      hubGrad.addColorStop(0, '#f59e0b');
      hubGrad.addColorStop(1, '#78350f');
      ctx.fillStyle = hubGrad;
      ctx.beginPath();
      ctx.arc(hx, hy, r, 0, Math.PI * 2);
      ctx.fill();

      // 内盘深色
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(hx, hy, r * 0.75, 0, Math.PI * 2);
      ctx.fill();

      // 粮秣/物资箱体微标
      ctx.fillStyle = '#fef08a';
      const boxW = r * 0.8, boxH = r * 0.55;
      ctx.fillRect(hx - boxW/2, hy - boxH/2, boxW, boxH);
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 1;
      ctx.strokeRect(hx - boxW/2, hy - boxH/2, boxW, boxH);

      // 供养状态：连通为绿点，断供为红感叹号
      if(hub.isSupplied){
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.arc(hx + r * 0.7, hy - r * 0.7, 2.5 * z, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(hx + r * 0.7, hy - r * 0.7, 3 * z, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.round(6 * z)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('!', hx + r * 0.7, hy - r * 0.7);
      }
      ctx.restore();
    }
  }

  /* 绘制城市地标：首都金色徽章与胜利点标牌（与六角格中心棋子错开布局） */
  /* v8.0 §2.3 海洋近岸深度分层 + 海岸亮边（BFS 距岸缓存，按地形判定海格）
     v12.0 M1：BFS 只依赖地形布局 → 缓存键去掉 day/owner（旧键每天整图重算）；
     结果只挂在渲染器实例上，不写入 world/hex，因此不涉及 SAVE_REPLACER 剥离名单。 */
  seaDepthMap(world){
    const key = world.hexes.length + ':' + (world.scenario || '');
    if(this._seaDepth && this._seaDepthKey === key) return this._seaDepth;
    const depth = new Map();
    const queue = [];
    for(const h of world.hexes){
      if(h.terrain !== 'sea'){ depth.set(h.idx, 0); queue.push(h); }
    }
    let head = 0;
    while(head < queue.length){
      const cur = queue[head++];
      const d = depth.get(cur.idx);
      if(d >= 3) continue;
      for(const ni of cur.adj){
        const nh = world.hexes[ni];
        if(!nh || depth.has(nh.idx)) continue;
        depth.set(nh.idx, d + 1);
        queue.push(nh);
      }
    }
    this._seaDepth = depth;
    this._seaDepthKey = key;
    return depth;
  }

  drawSeaDepth(ctx, world){
    const cam = this.cam;
    const depth = this.seaDepthMap(world);
    // v13.1 海洋基底：先铺一层中性钢青把油画背景的紫褐调隔绝掉。
    // 此前海洋直接透出时代地毯底色 + 深度晕叠色 → 大洋呈浑浊紫灰，
    // 与陆地暖褐形成脏对比。海陆分界也因此读不清。
    const seaList = [];
    for(const h of world.hexes){
      if(h.terrain !== 'sea') continue;
      if(!cam.visible(h)) continue;
      seaList.push(h);
    }
    const seaPath = () => {
      ctx.beginPath();
      for(const h of seaList){
        if(h.polygon && isProvinceMapEnabled()) appendPolygonPath(ctx, h.polygon, cam);
        else drawCellPath(ctx, h, cam, isProvinceMapEnabled());
      }
    };
    // 基底由 drawTerrain 的分组批量填充统一绘制（同一 path 批量 fill 才会无缝）；
    // 此处只做深度分层叠加，避免两条路径重复绘制同一批格子。

    // 三档水体（按深度分档批量填充，档内一次 fill → 无缝）：
    // d1 近岸浅水带 → d2 中深海域 → d3+ 深海
    const SHADES = ['', 'rgba(126, 205, 214, 0.13)', 'rgba(46, 116, 138, 0.18)', 'rgba(16, 48, 68, 0.26)'];
    for(let band = 1; band <= 3; band++){
      // 注意：此处必须自己 beginPath —— 若先调用 seaPath()（它会无条件追加
      // 全部海格），符合条件的格子会被追加两次，fill 时 alpha 双重叠加，
      // 在每个海格边界显出一条深色网格线。
      let any = false;
      ctx.beginPath();
      for(const h of seaList){
        if((depth.get(h.idx) || 0) < band) continue;
        any = true;
        if(h.polygon && isProvinceMapEnabled()) appendPolygonPath(ctx, h.polygon, cam);
        else drawCellPath(ctx, h, cam, isProvinceMapEnabled());
      }
      if(any){
        ctx.fillStyle = SHADES[band];
        ctx.fill();
      }
    }

    // 海岸亮边：海陆交界的行省共享边（v13.1：改用有机曲线，
    // 此前用 getSharedHexEdge 的六角几何，会在海陆界画出一圈规则六边形齿）
    if(typeof world !== 'undefined' && world.provinces && world.provinces.coasts && world.provinces.coasts.length){
      ctx.save();
      ctx.strokeStyle = 'rgba(150, 205, 225, 0.50)';
      ctx.lineWidth = Math.max(1.2, 1.9 * cam.z);
      ctx.lineCap = 'round';
      ctx.beginPath();
      for(const c of world.provinces.coasts){
        const pts = c.pts;
        if(!pts || pts.length < 2) continue;
        ctx.moveTo(pts[0][0] * cam.z + cam.x, pts[0][1] * cam.z + cam.y);
        for(let k = 1; k < pts.length; k++){
          ctx.lineTo(pts[k][0] * cam.z + cam.x, pts[k][1] * cam.z + cam.y);
        }
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  /* 城市地标分级渲染（v8.0）：首都/大城=金框全标 · 中城=描边名 · 小城=缩略点 */
  drawCityLandmark(ctx, city, x, y, s, z){
    if(this._lowDetail) return;   // v8.0 motion LOD：移动中跳过城市标签
    ctx.save();
    const isCap = city.cap;
    const vp = city.w || 1;
    const major = isCap || vp >= 4;
    const mid = !major && vp >= 2;
    const starY = y - s * 0.46;

    // —— 小城：低倍率仅画点，高倍率才补名字 ——
    if(!major && !mid){
      if(z >= 0.9){
        ctx.fillStyle = 'rgba(226, 232, 240, 0.85)';
        ctx.beginPath();
        ctx.arc(x, starY, Math.max(2, 2.2 * z), 0, Math.PI * 2);
        ctx.fill();
        if(z >= 1.35){
          const fs2 = Math.max(8, Math.round(9 * z));
          ctx.font = fs2 + 'px "Noto Serif SC", serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'top';
          ctx.lineWidth = 2.4; ctx.strokeStyle = 'rgba(8,10,14,.85)';
          ctx.strokeText(city.name, x, y + s * 0.5);
          ctx.fillStyle = 'rgba(226,232,240,.92)';
          ctx.fillText(city.name, x, y + s * 0.5);
        }
      }
      ctx.restore();
      return;
    }

    const starR = major ? (isCap ? 6 * z : 5 * z) : 3.6 * z;

    // 城市光晕底托
    ctx.fillStyle = major ? 'rgba(212, 175, 55, 0.35)' : 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.arc(x, starY, starR * 1.4, 0, Math.PI * 2);
    ctx.fill();

    // 首都五角星 / 城市图标
    ctx.fillStyle = isCap ? '#ffd977' : (major ? '#e2e8f0' : '#cbd5e1');
    ctx.strokeStyle = '#1e2430';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for(let i = 0; i < 5; i++){
      const a = -Math.PI / 2 + i * 2 * Math.PI / 5;
      const a2 = a + Math.PI / 5;
      ctx.lineTo(x + starR * Math.cos(a), starY + starR * Math.sin(a));
      ctx.lineTo(x + starR * 0.45 * Math.cos(a2), starY + starR * 0.45 * Math.sin(a2));
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 低倍率下中等城市省略文字，避免标签密集
    if(!major && z < 0.72){ ctx.restore(); return; }

    const fontSize = Math.max(9, Math.round((major ? 10.5 : 9.5) * z));
    ctx.font = (major ? 'bold ' : '') + fontSize + 'px "Noto Serif SC", "Georgia", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const text = city.name + (major && city.w ? ' [' + city.w + ']' : '');
    const tw = ctx.measureText(text).width;
    const ty = y + s * 0.50;

    if(major){
      ctx.fillStyle = 'rgba(15, 20, 28, 0.92)';
      ctx.fillRect(x - tw/2 - 3, ty - 1, tw + 6, fontSize + 3);
      ctx.strokeStyle = isCap ? 'rgba(212, 175, 55, 0.85)' : 'rgba(70, 85, 105, 0.65)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x - tw/2 - 3, ty - 1, tw + 6, fontSize + 3);
      ctx.fillStyle = isCap ? '#ffd977' : '#f1f5f9';
    }else{
      ctx.lineWidth = 2.6;
      ctx.strokeStyle = 'rgba(8, 10, 14, 0.88)';
      ctx.strokeText(text, x, ty);
      ctx.fillStyle = '#dbe3ee';
    }
    ctx.fillText(text, x, ty);
    ctx.restore();
  }

  /* 每帧主入口：背景 + 动态战术图层 */
  /* v8.0 §9.2：缩放档位（背景按档位缓存，档位内缩放只做合成） */
  pickZoomTier(z){
    const TIERS = [0.34, 0.5, 0.72, 1.05, 1.5, 2.1, 2.8];
    const hard = TIERS.find((t) => z <= t) || TIERS[TIERS.length - 1];
    // v11.0：世界缓存是「整张地图一张离屏画布」，面积随档位平方增长。
    // 地图从 416 格放大到 1920 格之后，2.8 档会得到 10000×4300 量级的画布
    // （≈170MB），触到浏览器画布上限的风险很高。这里按像素预算反推档位
    // 上限：超出预算就退回较低档，更高倍率靠放大插值过渡，画面依然连续。
    const wb = this._wb || this.worldBounds(this.cam.world || { hexes: [] });
    if(!wb || !wb.w || !wb.h) return hard;
    const budget = 16e6;   // 单张离屏画布像素预算（16M ≈ 64MB）
    let tier = hard;
    while(tier > TIERS[0] && wb.w * tier * wb.h * tier > budget){
      tier = TIERS[TIERS.indexOf(tier) - 1];
    }
    return tier;
  }

  /* 世界像素尺寸（z=1 基准的地图包围盒） */
  worldBounds(world){
    if(this._wb && this._wbKey === world.hexes.length + ':' + world.scenario) return this._wb;
    // v13.1：改为真正的 min/max 包围盒。旧实现从 0 起算 maxX/maxY，而行省胞腔
    // 经 bbox 外扩（provinces.js 的 pad = 2.4 格 ≈ 81.6px）后会产生负坐标，
    // 于是整块西北区域落在离屏画布之外 —— 表现为"背景图透出 + 规则六边形底纹"。
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for(const h of world.hexes){
      const px = this.cam.size * Math.sqrt(3) * (h.q + (h.r & 1 ? 0.5 : 0));
      const py = this.cam.size * 1.5 * h.r;
      if(px < minX) minX = px;
      if(px > maxX) maxX = px;
      if(py < minY) minY = py;
      if(py > maxY) maxY = py;
    }
    const pad = this.cam.size * 2.8;      // 与 provinces.js 的 pad 对齐并留余量
    minX -= pad; minY -= pad; maxX += pad; maxY += pad;
    this._wb = {
      minX, minY, maxX, maxY,
      w: Math.ceil(maxX - minX),
      h: Math.ceil(maxY - minY)
    };
    this._wbKey = world.hexes.length + ':' + world.scenario;
    return this._wb;
  }

  render(world, ui, ts){
    const cam = this.cam;
    const tier = this.pickZoomTier(cam.z);

    // 档位变化：首次立即重绘；后续延迟重绘（缩放中先用旧缓存拉伸过渡，停下后变清晰）
    if(this._bgTier !== tier){
      if(this._bgTier === undefined){
        this._bgTier = tier;
        this.terrainDirty = true;
        this.mapDirty = true;
        this.resize();
      }else{
        this._pendingTier = tier;
        this._tierSettle = 12;                 // ≈200ms 停止后重绘
      }
    }
    if(this._pendingTier !== undefined && this._pendingTier !== null && --this._tierSettle <= 0){
      this._bgTier = this._pendingTier;
      this._pendingTier = null;
      this.terrainDirty = true;
      this.mapDirty = true;
      this.resize();
    }
    // 归属/模式变更由外部 invalidateMap/invalidateTerrain 标记（拖动不再标脏）
    this._lowDetail = false;

    this.drawBg(world);
    this.drawUnitsLayer(world, ui, ts);
  }

  drawBg(world){
    if(!this.terrainDirty && !this.mapDirty) return;      // 缓存命中：零重绘
    this.resizeBgToWorld(world);

    const cam = this.cam;
    const saved = { x: cam.x, y: cam.y, z: cam.z };
    // 世界坐标模式：按包围盒左上角平移，保证负坐标区域也落在画布内
    const wb = this.worldBounds(world);
    const bgTier = this._bgTier || 1;
    cam.x = -wb.minX * bgTier; cam.y = -wb.minY * bgTier; cam.z = bgTier;
    cam.fullRender = true;                                 // 世界缓存：绘制全图，不裁剪
    this.drawTerrain(world);
    this.drawMapMode(world, world.day);
    cam.fullRender = false;
    cam.x = saved.x; cam.y = saved.y; cam.z = saved.z;
  }

  /* §4 动态战术层：3D 北约军标、双垂直血条/蓝条、计划箭头、战斗气泡 */
  drawUnitsLayer(world, ui, ts){
    const cv = this.canvas;
    const ctx = this.cam.ctx();
    ctx.clearRect(0, 0, cv.clientWidth, cv.clientHeight);
    // v10.1 审查修复：帧首建一次单位索引（建表 ≈0.03ms），替换循环内 238 次/帧的
    // world.units.find 线性扫描（实测该模式耗 5.9ms/帧）
    this._uIdx = new Map(world.units.map(u => [u.id, u]));
    if(this.bg.width && this.bg.height){
      // v8.0 §9.3：世界坐标缓存 → 按相机变换合成（拖动零重绘）
      const tier = this._bgTier || 1;
      const worldW = this.bg.width / tier;
      const worldH = this.bg.height / tier;
      ctx.drawImage(this.bg, 0, 0, this.bg.width, this.bg.height,
        this.cam.x, this.cam.y, worldW * this.cam.z, worldH * this.cam.z);
    }

    // 选中行省金色高光与战术光晕 (v10.0 M3)
    if(ui.selHex){
      const selH = world.at[ui.selHex.q + ',' + ui.selHex.r];
      if(selH){
        ctx.save();
        if(isProvinceMapEnabled() && selH.polygon){
          drawPolygonPath(ctx, selH.polygon, this.cam);
        } else {
          const { x, y } = this.cam.toPix(selH.q, selH.r);
          hexPath(ctx, x, y, this.cam.size * this.cam.z * 0.98);
        }
        ctx.strokeStyle = '#ffd977';
        ctx.lineWidth = Math.max(2.5, 3.2 * this.cam.z);
        ctx.shadowColor = 'rgba(255, 217, 119, 0.85)';
        ctx.shadowBlur = 12;
        ctx.stroke();
        ctx.fillStyle = 'rgba(255, 217, 119, 0.12)';
        ctx.fill();
        ctx.restore();
      }
    }

    // v8.0 M4 §5.3：非法操作（如战宽已满）→ 该格红色抖动框 + 说明标签
    if(ui.shakeHex && Date.now() < ui.shakeHex.until){
      const t = Date.now();
      const amp = 5 * this.cam.z;
      const dx = Math.sin(t * 0.055) * amp;
      const { x, y } = this.cam.toPix(ui.shakeHex.q, ui.shakeHex.r);
      const s = this.cam.size * this.cam.z * 0.98;
      const sh = world.at[ui.shakeHex.q + ',' + ui.shakeHex.r];
      if(isProvinceMapEnabled() && sh && sh.polygon){
        drawPolygonPath(ctx, sh.polygon, this.cam);
      } else {
        hexPath(ctx, x + dx, y, s);
      }
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 4;
      ctx.shadowColor = 'rgba(239, 68, 68, 0.9)';
      ctx.shadowBlur = 14;
      ctx.stroke();
      ctx.shadowBlur = 0;
      // 说明标签
      const label = '战斗宽度已满';
      ctx.font = 'bold 12px sans-serif';
      const tw = ctx.measureText(label).width + 14;
      ctx.fillStyle = 'rgba(127, 29, 29, 0.94)';
      ctx.fillRect(x + dx - tw / 2, y - s - 24, tw, 20);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + dx - tw / 2, y - s - 24, tw, 20);
      ctx.fillStyle = '#fecaca';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x + dx, y - s - 14);
    }

    // 悬停行省金色边缘微光与内圈光晕 (v10.0 M3)
    if(ui.hover && (!ui.selHex || ui.hover.q !== ui.selHex.q || ui.hover.r !== ui.selHex.r)){
      const h = world.at[ui.hover.q + ',' + ui.hover.r];
      if(h){
        ctx.save();
        if(isProvinceMapEnabled() && h.polygon){
          drawPolygonPath(ctx, h.polygon, this.cam);
        } else {
          const { x, y } = this.cam.toPix(h.q, h.r);
          hexPath(ctx, x, y, this.cam.size * this.cam.z * 0.98);
        }
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = Math.max(1.8, 2.4 * this.cam.z);
        ctx.shadowColor = 'rgba(250, 204, 21, 0.7)';
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.fillStyle = 'rgba(254, 240, 138, 0.10)';
        ctx.fill();
        ctx.restore();
      }
    }

    // 战术框选金色标定框 (Tactical Box Select)
    if(ui.boxSelect && ui.boxSelect.active){
      const bx = Math.min(ui.boxSelect.x0, ui.boxSelect.x1);
      const by = Math.min(ui.boxSelect.y0, ui.boxSelect.y1);
      const bw = Math.abs(ui.boxSelect.x1 - ui.boxSelect.x0);
      const bh = Math.abs(ui.boxSelect.y1 - ui.boxSelect.y0);

      ctx.save();
      ctx.fillStyle = 'rgba(234, 179, 8, 0.12)';
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = 'rgba(234, 179, 8, 0.85)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(bx, by, bw, bh);
      ctx.setLineDash([]);

      // 四角战术刻度标角
      const cl = Math.min(10, bw / 2, bh / 2);
      if(cl > 2){
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bx, by + cl); ctx.lineTo(bx, by); ctx.lineTo(bx + cl, by);
        ctx.moveTo(bx + bw - cl, by); ctx.lineTo(bx + bw, by); ctx.lineTo(bx + bw, by + cl);
        ctx.moveTo(bx + bw, by + bh - cl); ctx.lineTo(bx + bw, by + bh); ctx.lineTo(bx + bw - cl, by + bh);
        ctx.moveTo(bx + cl, by + bh); ctx.lineTo(bx, by + bh); ctx.lineTo(bx, by + bh - cl);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 作战计划矢量图层（前线、进攻矛头、退守线）
    this.drawPlanOverlays(ctx, world, this.cam.z);

    // 全局部队行军与进攻路线箭头
    this.drawOrderArrows(ctx, world, ui);
    // v8.0 M6：四副本专属地图图层（堑壕/闪击/影响力/DEFCON/制裁网络/军援光点/FPV 准星）
    drawEraOverlay(ctx, world, this.cam, ui, this.cam.z);

    // §4.1 精工 3D 北约战术棋子
    this.draw3DNATOCounters(ctx, world, ui);

    // 动态交战光影：升腾黑烟粒子与炮火闪光 (v7.0 §3.4)
    this.drawCombatEffects(ctx, world, ui, ts);

    // §4.2 战斗气泡与攻防优势百分比指示器
    this.drawCombatBubbles(ctx, world, ui, ts);

    // v8.0 M3：战斗伤害浮字（来自 world.battleFeed）
    this.consumeBattleFeed(world);

    // 战伤浮字动效
    this.drawFloats(ctx);
  }

  /* 绘制部队指令与行军路线箭头 */
  drawOrderArrows(ctx, world, ui){
    const z = this.cam.z;

    // 1. 全军未选中部队的行进轻量指示虚线
    for(const u of world.units){
      if(u.hp <= 0 || !u.order || ui.selUnits.includes(u.id)) continue;
      let to = null;
      if(u.order.type === 'attack') to = this.cam.toPix(u.order.target[0], u.order.target[1]);
      else if(u.order.type === 'advance') to = this.cam.toPix(u.order.dest[0], u.order.dest[1]);
      else if(u.order.path && u.order.path.length) to = this.cam.toPix(u.order.path[0].q, u.order.path[0].r);
      if(!to) continue;

      const from = this.cam.toPix(u.q, u.r);
      ctx.save();
      ctx.strokeStyle = u.order.type === 'attack' ? 'rgba(239, 68, 68, 0.65)' : 'rgba(56, 189, 248, 0.55)';
      ctx.lineWidth = Math.max(1.4, 1.8 * z);
      ctx.setLineDash([4 * z, 3 * z]);
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      ctx.restore();
    }

    // 2. 当前选中部队的高亮发光战术行军路径
    for(const uid of ui.selUnits){
      const u = world.units.find(x => x.id === uid);
      if(!u || !u.order) continue;

      let to = null;
      if(u.order.type === 'attack') to = this.cam.toPix(u.order.target[0], u.order.target[1]);
      else if(u.order.type === 'advance') to = this.cam.toPix(u.order.dest[0], u.order.dest[1]);
      else if(u.order.path && u.order.path.length) to = this.cam.toPix(u.order.path[0].q, u.order.path[0].r);
      if(!to) continue;

      const from = this.cam.toPix(u.q, u.r);
      const isAtk = u.order.type === 'attack';

      ctx.save();
      ctx.strokeStyle = isAtk ? '#ef4444' : '#38bdf8';
      ctx.lineWidth = Math.max(3, 4 * z);
      ctx.shadowColor = isAtk ? 'rgba(239, 68, 68, 0.8)' : 'rgba(56, 189, 248, 0.8)';
      ctx.shadowBlur = 8 * z;

      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // 箭头尖端
      const ang = Math.atan2(to.y - from.y, to.x - from.x);
      const headSize = Math.max(10, 13 * z);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath();
      ctx.moveTo(to.x, to.y);
      ctx.lineTo(to.x - headSize * Math.cos(ang - 0.45), to.y - headSize * Math.sin(ang - 0.45));
      ctx.lineTo(to.x - headSize * Math.cos(ang + 0.45), to.y - headSize * Math.sin(ang + 0.45));
      ctx.closePath();
      ctx.fill();

      // 目标终点高亮光环 ◎
      ctx.strokeStyle = '#ffd977';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(to.x, to.y, 6 * z, 0, Math.PI * 2);
      ctx.stroke();

      // 战术参数标牌：ETA 到达时间、进军距离、跨河战术惩罚 (v10.0 M3)
      const targetCoords = u.order.type === 'attack' ? u.order.target : (u.order.type === 'advance' ? u.order.dest : (u.order.path && u.order.path[0] ? [u.order.path[0].q, u.order.path[0].r] : null));
      if(targetCoords){
        const dHex = hexDist(u.q, u.r, targetCoords[0], targetCoords[1]);
        const spd = effectiveSpeed ? effectiveSpeed(world, u) : 1;
        const etaDays = (dHex / Math.max(0.2, spd)).toFixed(1);
        const isRiverCrossing = hasRiverCrossing(world, u.q, u.r, targetCoords[0], targetCoords[1]);

        const badgeText = `${isAtk ? '⚔️' : '➡️'} ${dHex}格 · ETA ${etaDays}天${isRiverCrossing ? ' · 🌊渡河 -30%' : ''}`;

        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2 - 12 * z;

        ctx.save();
        ctx.font = `bold ${Math.max(9, Math.round(10.5 * z))}px sans-serif`;
        const tw = ctx.measureText(badgeText).width;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
        ctx.fillRect(midX - tw/2 - 6, midY - 8 * z, tw + 12, 17 * z);
        ctx.strokeStyle = isAtk ? '#ef4444' : '#38bdf8';
        ctx.lineWidth = 1;
        ctx.strokeRect(midX - tw/2 - 6, midY - 8 * z, tw + 12, 17 * z);

        ctx.fillStyle = isRiverCrossing ? '#fca5a5' : '#ffd977';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(badgeText, midX, midY);
        ctx.restore();
      }

      ctx.restore();
    }

    this.drawWaypointFlags(ctx, world, ui, z);
  }

  /* v8.0 M4 §5.1：路径点编号旗标 —— Shift+右键 追加的航路点按顺序显示 1/2/3…
     选中部队的旗标常显；未选中部队仅在 z≥0.62（非简化视图）时低调显示，避免糊屏。 */
  drawWaypointFlags(ctx, world, ui, z){
    const sel = new Set(ui.selUnits || []);
    const showAll = z >= 0.62;
    for(const u of world.units){
      if(u.hp <= 0) continue;
      const wps = u.waypoints || [];
      if(!wps.length) continue;
      const isSel = sel.has(u.id);
      if(!isSel && !showAll) continue;

      // 航线折线：从当前格 → wp1 → wp2 …
      const pts = [{ ...this.cam.toPix(u.q, u.r) },
                   ...wps.map(wp => this.cam.toPix(wp.q, wp.r))];
      ctx.save();
      ctx.strokeStyle = isSel ? 'rgba(167, 139, 250, 0.95)' : 'rgba(167, 139, 250, 0.42)';
      ctx.lineWidth = Math.max(1.6, (isSel ? 3 : 2) * z);
      ctx.setLineDash([6 * z, 4 * z]);
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for(let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // 编号旗标
      const fr = Math.max(7, 9 * z);
      wps.forEach((wp, i) => {
        const p = pts[i + 1];
        ctx.save();
        ctx.globalAlpha = isSel ? 1 : 0.6;
        // 旗面
        ctx.fillStyle = '#7c3aed';
        ctx.strokeStyle = '#e9d5ff';
        ctx.lineWidth = Math.max(1, 1.5 * z);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - fr * 0.2);
        ctx.lineTo(p.x, p.y - fr * 1.9);
        ctx.lineTo(p.x + fr * 1.5, p.y - fr * 1.45);
        ctx.lineTo(p.x, p.y - fr * 1.0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // 编号
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.max(8, 10 * z)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), p.x + fr * 0.62, p.y - fr * 1.42);
        // 落点锚
        ctx.strokeStyle = '#c4b5fd';
        ctx.beginPath();
        ctx.arc(p.x, p.y, fr * 0.34, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      });
    }
  }

  /* §4.1 精工 3D 北约战术棋子（严格规范尺寸为六角格半径的 45%-55%，单格多师层叠+数字角标） */
  /* v8.0 M3：极远视图（z<0.38）每格一个聚合小方块 + 师数 */
  drawLodTinyCounters(ctx, world, ui){
    const z = this.cam.z;
    const r = Math.max(4, 5 * z * 2);
    for(const hex of world.hexes){
      if(!this.cam.visible(hex)) continue;
      const uIdx = this._uIdx || new Map(world.units.map(u => [u.id, u]));
      const us = hex.units.map(id => uIdx.get(id)).filter(u => u && u.hp > 0);
      if(!us.length) continue;
      const { x, y } = this.cam.toPix(hex.q, hex.r);
      const isPlayer = us.some(u => u.nat === world.player);
      ctx.fillStyle = isPlayer ? 'rgba(56, 130, 200, .88)' : 'rgba(200, 70, 60, .88)';
      ctx.fillRect(x - r / 2, y - r / 2, r, r);
      ctx.strokeStyle = 'rgba(10,14,20,.85)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x - r / 2, y - r / 2, r, r);
      if(us.length > 1 && z > 0.3){
        ctx.fillStyle = '#ffe9b8';
        ctx.font = 'bold 8px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(us.length), x, y - r / 2 - 5);
      }
    }
  }

  draw3DNATOCounters(ctx, world, ui){
    const z = this.cam.z;

    // v8.0 M3 LOD 三级：z<0.38 极简聚合 → z<0.62 简化兵牌 → 全要素
    // v13.1 兵牌 LOD 降噪：把"完整兵牌"的门槛从 0.62 提到 0.85 ——
    // 默认作战视图（z≈0.71）此前刚好越过旧阈值，满屏矩形兵牌互相压盖、
    // 战线被噪音淹没。0.85 以下走简化兵牌，0.5 以下只留计数点。
    if(z < 0.50){ this.drawLodTinyCounters(ctx, world, ui); return; }
    const lodSimple = z < 0.85;

    // 考据自 HOI4 原版规范 mapicons.gui [H]
    // HOI4 兵牌规制：底牌 76×24 [H]；左缘两条 90° 竖条（str/hp, org） [H]；兵力数字居中于 (36,6) 宽 20 [H]；四角状态微标 [H]
    const HOI4_COUNTER_W = 76; // 兵牌基础宽 76px [H]
    const HOI4_COUNTER_H = 24; // 兵牌基础高 24px [H]
    const hexR = this.cam.size * z;
    const cardH = Math.max(14, Math.round(hexR * 0.48));
    const cardW = Math.max(26, Math.round(cardH * 2.2));

    // 兵种代表优先级：装甲 > 摩托化 > 机械化 > 骑兵 > 火炮 > 山地 > 步兵
    const UNIT_PRIORITY = {
      arm: 100, larm: 95, harm: 90, tank: 100,
      mot: 80, mech: 75,
      cav: 70,
      art: 60, spart: 65, aa: 55, at: 55,
      mtn: 50, marine: 45, para: 45,
      inf: 10
    };

    for(const hex of world.hexes){
      if(!this.cam.visible(hex)) continue;
      const uIdx = this._uIdx || new Map(world.units.map(u => [u.id, u]));
      const us = hex.units.map(id => uIdx.get(id)).filter(u => u && u.hp > 0);
      if(!us.length) continue;

      const { x, y } = this.cam.toPix(hex.q, hex.r);
      // v12.0 M5 (C46)：堆叠展示按 hp+org 战力降序取前 4 —— 封面师永远是
      // 堆里最能打的一个；数据层 hex.units 顺序不动，只动显示排序。
      const sortedUnits = [...us].sort((a, b) =>
        ((b.hp + b.org) - (a.hp + a.org)) || ((UNIT_PRIORITY[b.type] || 0) - (UNIT_PRIORITY[a.type] || 0)));
      const topUnit = sortedUnits[0];
      const U = UNITS[topUnit.type] || { org: 60, hp: 100 };
      const isPlayer = (topUnit.nat === world.player);
      const isSel = isPlayer && ui.selUnits.includes(topUnit.id);

      ctx.save();

      // 多师堆叠底层层叠阴影卡片 (钢四双层/三层收纳质感)
      if(us.length > 1){
        ctx.fillStyle = 'rgba(12, 16, 24, 0.75)';
        ctx.fillRect(x - cardW/2 + 2, y - cardH/2 + 2, cardW, cardH);
        if(us.length > 2){
          ctx.fillStyle = 'rgba(8, 11, 16, 0.55)';
          ctx.fillRect(x - cardW/2 + 4, y - cardH/2 + 4, cardW, cardH);
        }
      }

      // 卡牌外围深邃投影（LOD 简化时省略）
      if(!lodSimple){
        ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetY = 2;
      }

      // 棋子装甲金属背景渐变（支持逗号键阵营红蓝对抗色 vs 国家传统色切换 [H]）
      const colorScheme = ui.counterColorScheme || 'nation';
      const bgGrad = ctx.createLinearGradient(x, y - cardH/2, x, y + cardH/2);
      if(colorScheme === 'faction'){
        if(isPlayer){
          bgGrad.addColorStop(0, '#1e3a5f'); bgGrad.addColorStop(1, '#0f172a');
        } else {
          bgGrad.addColorStop(0, '#5f1e1e'); bgGrad.addColorStop(1, '#2a0f0f');
        }
      } else {
        if(isPlayer){
          bgGrad.addColorStop(0, '#2d3748'); bgGrad.addColorStop(1, '#1a202c');
        } else {
          bgGrad.addColorStop(0, '#3f2222'); bgGrad.addColorStop(1, '#221212');
        }
      }
      ctx.fillStyle = bgGrad;
      ctx.fillRect(x - cardW/2, y - cardH/2, cardW, cardH);
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      // 金属外包边
      ctx.strokeStyle = isSel ? '#ffd977' : (isPlayer ? '#d4af37' : '#ef4444');
      ctx.lineWidth = isSel ? 2.0 : 1.2;
      ctx.strokeRect(x - cardW/2, y - cardH/2, cardW, cardH);

      // 选中状态：钢四经典四角金色战术卡扣 [ ]（LOD 简化时省略）
      if(isSel && !lodSimple){
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 1.6;
        const bLen = Math.max(3, Math.round(3.5 * z));
        const pad = 2;
        // ┌
        ctx.beginPath();
        ctx.moveTo(x - cardW/2 - pad, y - cardH/2 - pad + bLen);
        ctx.lineTo(x - cardW/2 - pad, y - cardH/2 - pad);
        ctx.lineTo(x - cardW/2 - pad + bLen, y - cardH/2 - pad);
        ctx.stroke();
        // ┐
        ctx.beginPath();
        ctx.moveTo(x + cardW/2 + pad - bLen, y - cardH/2 - pad);
        ctx.lineTo(x + cardW/2 + pad, y - cardH/2 - pad);
        ctx.lineTo(x + cardW/2 + pad, y - cardH/2 - pad + bLen);
        ctx.stroke();
        // └
        ctx.beginPath();
        ctx.moveTo(x - cardW/2 - pad, y + cardH/2 + pad - bLen);
        ctx.lineTo(x - cardW/2 - pad, y + cardH/2 + pad);
        ctx.lineTo(x - cardW/2 - pad + bLen, y + cardH/2 + pad);
        ctx.stroke();
        // ┘
        ctx.beginPath();
        ctx.moveTo(x + cardW/2 + pad - bLen, y + cardH/2 + pad);
        ctx.lineTo(x + cardW/2 + pad, y + cardH/2 + pad);
        ctx.lineTo(x + cardW/2 + pad, y + cardH/2 + pad - bLen);
        ctx.stroke();
      }

      // 顶部高光倒角内线
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - cardW/2 + 1, y - cardH/2 + 1);
      ctx.lineTo(x + cardW/2 - 1, y - cardH/2 + 1);
      ctx.stroke();

      // 考据自 HOI4 原版规制 [H]：左缘两条 90° 竖条（左条兵力 HP/STR，右条组织度 ORG）
      const barW = Math.max(2, Math.round(2.0 * z));
      const barH = cardH - 4;
      const barX_hp = x - cardW/2 + 2;
      const barX_org = x - cardW/2 + 2 + barW + 1; // 紧随左侧双竖条布局 [H]

      ctx.fillStyle = '#0a0d12';
      ctx.fillRect(barX_hp, y - cardH/2 + 2, barW, barH);
      ctx.fillRect(barX_org, y - cardH/2 + 2, barW, barH);

      // 左条绿色兵力 (HP / STR) [H]
      const hpPct = Math.min(1, Math.max(0, topUnit.hp / U.hp));
      const hpFillH = barH * hpPct;
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(barX_hp, y - cardH/2 + 2 + (barH - hpFillH), barW, hpFillH);

      // 右条黄色组织度 (ORG) [H]
      const orgPct = Math.min(1, Math.max(0, topUnit.org / U.org));
      const orgFillH = barH * orgPct;
      ctx.fillStyle = '#eab308';
      ctx.fillRect(barX_org, y - cardH/2 + 2 + (barH - orgFillH), barW, orgFillH);

      // 兵种符号（v8.0 M3：NATO 标准符号 ↔ 程序化兵种图标，U 键切换）
      const glyphX = x + (barW + 1);
      if(ui.unitStyle === 'icon'){
        this.drawUnitIconGlyph(ctx, topUnit.type, glyphX, y, cardW - 14, cardH - 4, z);
      }else{
        this.drawNATOGlyph(ctx, topUnit.type, glyphX, y, cardW - 14, cardH - 4, z);
      }

      // 兵力数字居中于 (36,6) 宽 20 规制 [H]（放大视图下浮现微缩数字）
      if(!lodSimple && z >= 0.75){
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.font = `bold ${Math.max(8, Math.round(9 * z))}px var(--font-mono, monospace)`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(Math.round(topUnit.hp) + '', x + barW + 2, y + cardH/2 - 5 * z);
      }

      // 四角状态微标 [H]：
      // ① 右上角：行军状态微标 ▶ [H]
      if(topUnit.order){
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        const ax = x + cardW/2 - 5 * z, ay = y - cardH/2 + 3 * z;
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax + 3.2 * z, ay + 2.0 * z);
        ctx.lineTo(ax, ay + 4.0 * z);
        ctx.closePath();
        ctx.fill();
      }

      // ② 左下角：堑壕筑垒微标 ⛏️ [H]
      if(topUnit.entrench > 0.05){
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(x - cardW/2 + (barW * 2 + 3), y + cardH/2 - 3.2 * z, 3 * z, 1.5 * z);
      }

      // v8.0 M3 状态扩展：经验条 / 被包围 / 姿态
      // ① 经验条（蓝，贴卡片底缘）
      {
        const lvl = topUnit.level || 1;
        const ew = (cardW - 6) * Math.min(1, lvl / 4);
        ctx.fillStyle = 'rgba(56, 130, 200, .9)';
        ctx.fillRect(x - cardW/2 + 3, y + cardH/2 - 2.2 * z, ew, 1.5 * z);
      }
      // ② 被包围：相邻全为敌/海 → 红虚线外框脉冲
      {
        const here = world.at[hex.q + ',' + hex.r];
        if(here && here.adj.length){
          const surrounded = here.adj.every(ni => {
            const nh = world.hexes[ni];
            if(!nh) return true;
            if(nh.terrain === 'sea') return true;
            return (world.nations[topUnit.nat]?.atWarWith || []).includes(nh.owner);
          });
          if(surrounded){
            ctx.save();
            ctx.strokeStyle = 'rgba(239, 68, 68, .85)';
            ctx.lineWidth = 1.4;
            ctx.setLineDash([4, 3]);
            ctx.strokeRect(x - cardW/2 - 2, y - cardH/2 - 2, cardW + 4, cardH + 4);
            ctx.setLineDash([]);
            ctx.restore();
          }
        }
      }
      // ③ 姿态图标（右下角：进攻/防守/推进）
      {
        const isAtk = topUnit.order && topUnit.order.type === 'attack';
        const isAdv = topUnit.order && (topUnit.order.type === 'advance' || topUnit.order.type === 'move');
        const gx = x + cardW/2 - 4 * z, gy = y + cardH/2 - 4.5 * z;
        if(isAtk){
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.moveTo(gx, gy - 3 * z); ctx.lineTo(gx + 2.6 * z, gy + 2 * z); ctx.lineTo(gx - 2.6 * z, gy + 2 * z);
          ctx.closePath(); ctx.fill();
        }else if(isAdv){
          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.moveTo(gx - 3 * z, gy - 2 * z); ctx.lineTo(gx + 3 * z, gy); ctx.lineTo(gx - 3 * z, gy + 2 * z);
          ctx.closePath(); ctx.fill();
        }else{
          ctx.fillStyle = '#93a4b8';
          ctx.beginPath();
          ctx.moveTo(gx - 2.6 * z, gy - 3 * z); ctx.lineTo(gx + 2.6 * z, gy - 3 * z);
          ctx.lineTo(gx + 2.6 * z, gy + 2 * z); ctx.lineTo(gx - 2.6 * z, gy + 2 * z);
          ctx.closePath(); ctx.fill();
        }
      }

      // 断供警告微标 ⛽
      if(topUnit.outOfSupplyDays > 0){
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(x - cardW/2 + 6 * z, y - cardH/2 + 4 * z, 2 * z, 0, Math.PI * 2);
        ctx.fill();
      }

      // 多师堆叠精致数字角标 (右下角精工收纳)
      if(us.length > 1){
        const badgeW = Math.max(12, Math.round(13 * z)), badgeH = Math.max(8, Math.round(9 * z));
        const bx = x + cardW/2 + 1, by = y + cardH/2 - 1;
        ctx.fillStyle = '#991b1b';
        ctx.fillRect(bx - badgeW/2, by - badgeH/2, badgeW, badgeH);
        ctx.strokeStyle = '#ffd977';
        ctx.lineWidth = 1;
        ctx.strokeRect(bx - badgeW/2, by - badgeH/2, badgeW, badgeH);

        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.max(7, Math.round(7.5 * z))}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`×${us.length}`, bx, by);
      }

      ctx.restore();
    }
  }

  /* v8.0 M3：程序化兵种图标（图标模式；无外部图片） */
  drawUnitIconGlyph(ctx, type, cx, cy, w, h, z){
    const s = Math.min(w, h * 1.6);
    ctx.save();
    ctx.strokeStyle = '#e8e2d4';
    ctx.fillStyle = '#e8e2d4';
    ctx.lineWidth = Math.max(1, 1.3 * z);
    ctx.lineCap = 'round';
    const t = (type || 'inf').toLowerCase();
    if(t === 'inf' || t === 'mtn' || t === 'para' || t === 'marine'){
      // 步枪剪影：枪身斜线 + 枪托 + 刺刀（山地/伞兵加山峰基座）
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.34, cy + s * 0.14);
      ctx.lineTo(cx + s * 0.30, cy - s * 0.16);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.34, cy + s * 0.14);
      ctx.lineTo(cx - s * 0.20, cy + s * 0.30);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + s * 0.30, cy - s * 0.16);
      ctx.lineTo(cx + s * 0.40, cy - s * 0.26);
      ctx.stroke();
      if(t !== 'inf'){
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.40, cy + s * 0.32);
        ctx.lineTo(cx - s * 0.16, cy + s * 0.06);
        ctx.lineTo(cx + s * 0.06, cy + s * 0.32);
        ctx.closePath();
        ctx.fill();
      }
    }else if(t === 'arm' || t === 'larm' || t === 'harm' || t === 'tank'){
      // 坦克剪影：车体 + 炮塔 + 炮管 + 履带点
      ctx.fillRect(cx - s * 0.36, cy + s * 0.02, s * 0.72, s * 0.20);
      ctx.fillRect(cx - s * 0.16, cy - s * 0.16, s * 0.36, s * 0.18);
      ctx.beginPath();
      ctx.moveTo(cx + s * 0.20, cy - s * 0.10);
      ctx.lineTo(cx + s * 0.44, cy - s * 0.10);
      ctx.stroke();
      ctx.beginPath();
      for(let i = 0; i < 4; i++){
        ctx.arc(cx - s * 0.24 + i * s * 0.16, cy + s * 0.28, s * 0.05, 0, Math.PI * 2);
      }
      ctx.fill();
    }else if(t === 'mot' || t === 'mech' || t === 'cav'){
      // 车辆剪影：轮 + 车斗
      ctx.fillRect(cx - s * 0.34, cy - s * 0.16, s * 0.44, s * 0.24);
      ctx.beginPath();
      ctx.moveTo(cx + s * 0.10, cy - s * 0.16);
      ctx.lineTo(cx + s * 0.36, cy - s * 0.02);
      ctx.lineTo(cx + s * 0.36, cy + s * 0.08);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx - s * 0.22, cy + s * 0.18, s * 0.09, 0, Math.PI * 2);
      ctx.arc(cx + s * 0.18, cy + s * 0.18, s * 0.09, 0, Math.PI * 2);
      ctx.fill();
    }else{
      // 火炮/支援：炮管 + 驻锄
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.30, cy + s * 0.10);
      ctx.lineTo(cx + s * 0.36, cy - s * 0.20);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.30, cy + s * 0.10);
      ctx.lineTo(cx - s * 0.08, cy + s * 0.28);
      ctx.moveTo(cx - s * 0.30, cy + s * 0.10);
      ctx.lineTo(cx - s * 0.40, cy + s * 0.30);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx - s * 0.30, cy + s * 0.10, s * 0.08, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /* 绘制北约兵种标准符号 (复刻 HOI4 经典矢量标识) */
  drawNATOGlyph(ctx, type, cx, cy, w, h, z){
    ctx.save();
    ctx.strokeStyle = '#f8fafc';
    ctx.fillStyle = '#f8fafc';
    ctx.lineWidth = Math.max(1.0, 1.2 * z);

    const halfW = w * 0.36;
    const halfH = h * 0.34;

    if(type === 'arm' || type === 'larm' || type === 'harm' || type === 'tank'){
      // 装甲兵：经典椭圆履带 ⬭
      ctx.beginPath();
      ctx.ellipse(cx, cy, halfW, halfH * 0.78, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if(type === 'mot' || type === 'mech'){
      // 摩托化：交叉线 + 双轮
      ctx.beginPath();
      ctx.moveTo(cx - halfW, cy - halfH); ctx.lineTo(cx + halfW, cy + halfH);
      ctx.moveTo(cx + halfW, cy - halfH); ctx.lineTo(cx - halfW, cy + halfH);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx - halfW * 0.5, cy + halfH * 0.75, 1.4 * z, 0, Math.PI * 2);
      ctx.arc(cx + halfW * 0.5, cy + halfH * 0.75, 1.4 * z, 0, Math.PI * 2);
      ctx.fill();
    } else if(type === 'cav'){
      // 骑兵：单左斜线 ╱
      ctx.beginPath();
      ctx.moveTo(cx - halfW, cy + halfH); ctx.lineTo(cx + halfW, cy - halfH);
      ctx.stroke();
    } else if(type === 'mtn'){
      // 山地：山峰折线 ⋏
      ctx.beginPath();
      ctx.moveTo(cx - halfW, cy + halfH); ctx.lineTo(cx, cy - halfH); ctx.lineTo(cx + halfW, cy + halfH);
      ctx.stroke();
    } else if(type === 'art' || type === 'spart'){
      // 火炮：实心圆球 ●
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(2.2, 2.8 * z), 0, Math.PI * 2);
      ctx.fill();
    } else if(type === 'aa'){
      // 防空：向上开口穹顶 ⋒
      ctx.beginPath();
      ctx.arc(cx, cy + halfH * 0.4, halfW * 0.7, Math.PI, 0);
      ctx.stroke();
    } else if(type === 'at'){
      // 反坦克：倒 V 箭标 ⋎
      ctx.beginPath();
      ctx.moveTo(cx - halfW, cy - halfH); ctx.lineTo(cx, cy + halfH); ctx.lineTo(cx + halfW, cy - halfH);
      ctx.stroke();
    } else {
      // 步兵：交叉双对角线 ╳
      ctx.beginPath();
      ctx.moveTo(cx - halfW, cy - halfH); ctx.lineTo(cx + halfW, cy + halfH);
      ctx.moveTo(cx + halfW, cy - halfH); ctx.lineTo(cx - halfW, cy + halfH);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* §4.2 战斗气泡与攻防优势百分比指示器 */
  drawCombatBubbles(ctx, world, ui, ts){
    const z = this.cam.z;
    const pulse = 0.9 + 0.1 * Math.sin(ts / 150);
    this.activeBubbles = [];

    // 从实际交战部队中动态收集所有活跃战役
    const battleHexMap = new Map();
    for(const u of world.units){
      if(u.hp > 0 && u.order && u.order.type === 'attack' && u.order.target){
        const th = world.at[u.order.target[0] + ',' + u.order.target[1]];
        if(th){
          if(!battleHexMap.has(th.idx)) battleHexMap.set(th.idx, []);
          battleHexMap.get(th.idx).push(u);
        }
      }
    }

    for(const [hexIdx, attackers] of battleHexMap.entries()){
      const hex = world.hexes[hexIdx];
      if(!hex || !this.cam.visible(hex)) continue;

      const sampleAtk = attackers[0];
      const defenders = (hex.units || []).map(id => (this._uIdx || new Map(world.units.map(u => [u.id, u]))).get(id))
        .filter(u => u && u.hp > 0 && (!sampleAtk || (world.nations[sampleAtk.nat]?.atWarWith || []).includes(u.nat)));

      if(!defenders.length) continue;

      // 实时计算战术胜率
      let atkPower = 0, defPower = 0;
      for(const a of attackers){
        const U = UNITS[a.type] || { soft: 10, hard: 2 };
        atkPower += (U.soft + U.hard * 1.5) * (a.org / 60) * (a.hp / 100);
      }
      for(const d of defenders){
        const U = UNITS[d.type] || { def: 15, armor: 0 };
        const ent = 1 + (d.entrench || 0);
        defPower += (U.def + U.armor * 2) * (d.org / 60) * (d.hp / 100) * ent;
      }
      const rawAdvantage = Math.round((atkPower / (atkPower + defPower + 0.001)) * 100);
      const advantage = Math.min(99, Math.max(1, rawAdvantage));

      // 若玩家为防守方，以玩家视角显示
      const isPlayerDef = defenders.some(d => d.nat === world.player);
      const isPlayerAtk = attackers.some(a => a.nat === world.player);
      const playerAdvantage = isPlayerAtk ? advantage : isPlayerDef ? (100 - advantage) : advantage;

      const { x, y } = this.cam.toPix(hex.q, hex.r);
      const by = y - this.cam.size * z * 0.72;
      const r = Math.max(9, Math.round(11 * z)) * pulse;

      // 保存至 activeBubbles 以供鼠标点击打开战斗视窗
      this.activeBubbles.push({ x, y: by, r, hexIdx, advantage: playerAdvantage, attackers, defenders });

      ctx.save();
      // 外层交火脉冲微光晕
      const haloColor = playerAdvantage >= 55 ? 'rgba(34, 197, 94, 0.25)' : playerAdvantage >= 40 ? 'rgba(234, 179, 8, 0.25)' : 'rgba(239, 68, 68, 0.25)';
      ctx.fillStyle = haloColor;
      ctx.beginPath();
      ctx.arc(x, by, r * 1.25, 0, Math.PI * 2);
      ctx.fill();

      // HOI4 经典战斗气泡圆盘
      const bubbleGrad = ctx.createRadialGradient(x, by, 2, x, by, r);
      if(playerAdvantage >= 55){
        bubbleGrad.addColorStop(0, '#22c55e'); // 胜利绿
        bubbleGrad.addColorStop(0.8, '#15803d');
        bubbleGrad.addColorStop(1, '#052e16');
      } else if(playerAdvantage >= 40){
        bubbleGrad.addColorStop(0, '#facc15'); // 僵局黄
        bubbleGrad.addColorStop(0.8, '#a16207');
        bubbleGrad.addColorStop(1, '#451a03');
      } else {
        bubbleGrad.addColorStop(0, '#ef4444'); // 败退红
        bubbleGrad.addColorStop(0.8, '#991b1b');
        bubbleGrad.addColorStop(1, '#450a0a');
      }
      ctx.fillStyle = bubbleGrad;
      ctx.beginPath();
      ctx.arc(x, by, r, 0, Math.PI * 2);
      ctx.fill();

      // 精细边框
      ctx.strokeStyle = '#ffd977';
      ctx.lineWidth = Math.max(1.0, 1.4 * z);
      ctx.stroke();

      // 气泡内胜率数值居中
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.max(9, Math.round(10 * z))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(playerAdvantage), x, by);

      ctx.restore();
    }
  }

  /* §4.3 动态交战光影：升腾黑烟粒子与炮火闪光 (v7.0 §3.4) */
  drawCombatEffects(ctx, world, ui, ts){
    const cam = this.cam;
    const z = cam.z;
    const battles = ui.battles || [];

    // 1. 炮火闪光 (Muzzle Flash)
    for(const bIdx of battles){
      const hex = world.hexes[bIdx];
      if(!hex || !cam.visible(hex)) continue;
      const p = cam.toPix(hex.q, hex.r);

      const flashSeed = (ts + bIdx * 431) % 360;
      if(flashSeed < 140){
        const fx = p.x + Math.sin(ts / 45 + bIdx) * 14 * z;
        const fy = p.y + Math.cos(ts / 60 + bIdx) * 10 * z;
        const fr = (12 + Math.sin(ts / 30) * 4) * z;

        const flashGrad = ctx.createRadialGradient(fx, fy, 1, fx, fy, fr);
        flashGrad.addColorStop(0, 'rgba(254, 240, 138, 0.95)');
        flashGrad.addColorStop(0.35, 'rgba(249, 115, 22, 0.8)');
        flashGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');

        ctx.fillStyle = flashGrad;
        ctx.beginPath();
        ctx.arc(fx, fy, fr, 0, Math.PI * 2);
        ctx.fill();
      }

      // 实时生成黑烟粒子
      if(this.smokeParticles.length < 50 && Math.random() < 0.35){
        this.smokeParticles.push({
          x: p.x + (Math.random() - 0.5) * 18 * z,
          y: p.y + (Math.random() - 0.5) * 12 * z,
          vx: (Math.random() - 0.5) * 0.35 * z,
          vy: -(0.55 + Math.random() * 0.75) * z,
          radius: 3.5 * z,
          maxRadius: (10 + Math.random() * 8) * z,
          alpha: 0.65,
          life: 0,
          maxLife: 40 + Math.random() * 30
        });
      }
    }

    // 2. 升腾黑烟粒子更新与渲染
    for(let i = this.smokeParticles.length - 1; i >= 0; i--){
      const sp = this.smokeParticles[i];
      sp.life++;
      if(sp.life >= sp.maxLife){
        this.smokeParticles.splice(i, 1);
        continue;
      }
      sp.x += sp.vx;
      sp.y += sp.vy;
      sp.radius += (sp.maxRadius - sp.radius) * 0.04;
      const progress = sp.life / sp.maxLife;
      const curAlpha = sp.alpha * (1 - progress);

      const smokeGrad = ctx.createRadialGradient(sp.x, sp.y, sp.radius * 0.15, sp.x, sp.y, sp.radius);
      smokeGrad.addColorStop(0, `rgba(28, 25, 23, ${curAlpha})`);
      smokeGrad.addColorStop(0.6, `rgba(68, 64, 60, ${curAlpha * 0.65})`);
      smokeGrad.addColorStop(1, 'rgba(120, 113, 108, 0)');

      ctx.fillStyle = smokeGrad;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* 浮动伤害字 */
  drawFloats(ctx){
    ctx.textAlign = 'center';
    for(let i = this.floats.length - 1; i >= 0; i--){
      const f = this.floats[i];
      f.t -= 16;
      if(f.t <= 0){ this.floats.splice(i, 1); continue; }
      const p = this.cam.toPix(f.q, f.r);
      const alpha = Math.min(1, f.t / 600);
      ctx.font = `bold ${Math.round(12 * this.cam.z)}px sans-serif`;
      ctx.fillStyle = `rgba(${f.color}, ${alpha})`;
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 4;
      ctx.fillText(f.text, p.x, p.y - this.cam.size * this.cam.z * (1.1 - f.t / 800));
      ctx.shadowBlur = 0;
    }
  }

  /* v8.0 M3：消费当日战斗报告 → 伤害浮字 */
  consumeBattleFeed(world){
    if(!world.battleFeed || !world.battleFeed.length) return;
    const day = world.day;
    if(this._feedDay !== day){ this._feedDay = day; this._feedShown = 0; }
    for(let i = this._feedShown; i < world.battleFeed.length; i++){
      const f = world.battleFeed[i];
      if(f.day !== day) continue;
      if(f.orgDmg >= 1){
        // v14.0 P0：浮字带出小时速率，让"逐小时结算"在地图上直接可读
        const rate = f.perHour ? ' (-' + f.perHour.toFixed(1) + '/时)' : '';
        const mit = f.defMit != null && f.defMit < 0.999 ? ' ·减伤' + Math.round(f.defMit * 100) + '%' : '';
        this.addFloat(f.q, f.r, '-' + Math.round(f.orgDmg) + ' 组织' + rate + mit, '255,150,130');
      }
    }
    this._feedShown = world.battleFeed.length;
  }

  addFloat(q, r, text, color){
    this.floats.push({ q, r, text, color: color || '239,68,68', t: 850 });
    if(this.floats.length > 30) this.floats.shift();
  }

  /* 作战计划图层：连续发光防线、橙色退守线、宽带动态进攻矛头 */
  drawPlanOverlays(ctx, world, z){
    const cam = this.cam;

    // 1. 蓝色防守前线与战壕防卫齿
    if(world.fronts){
      for(const front of world.fronts){
        if(front.nat !== world.player || !front.hexes || !front.hexes.length) continue;
        ctx.save();
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = Math.max(3.8, 4.8 * z);
        ctx.shadowColor = '#00b4d8';
        ctx.shadowBlur = 10 * z;

        let edgeMidPoints = [];

        for(const hIdx of front.hexes){
          const h = world.hexes[hIdx];
          if(!h || !cam.visible(h)) continue;
          for(const adjIdx of (h.adj || [])){
            const nh = world.hexes[adjIdx];
            if(nh && nh.owner !== world.player){
              const geom = this.getSharedHexEdge(cam, h, nh);
              if(geom){
                edgeMidPoints.push(geom.mid);
                // 绘制平滑连续防线带
                ctx.beginPath();
                ctx.moveTo(geom.pA.x, geom.pA.y);
                ctx.lineTo(geom.pB.x, geom.pB.y);
                ctx.stroke();

                // 绘制朝向敌方的防御齿 (Barbed wire / Rampart ticks)
                const dx = geom.pB.x - geom.pA.x;
                const dy = geom.pB.y - geom.pA.y;
                const len = Math.hypot(dx, dy);
                if(len > 0){
                  const p2 = cam.toPix(nh.q, nh.r);
                  const p1 = cam.toPix(h.q, h.r);
                  let fx = p2.x - p1.x, fy = p2.y - p1.y;
                  const flen = Math.hypot(fx, fy);
                  if(flen > 0){ fx /= flen; fy /= flen; }

                  ctx.save();
                  ctx.strokeStyle = '#00f0ff';
                  ctx.lineWidth = Math.max(1.4, 1.8 * z);
                  ctx.shadowBlur = 0;
                  const tickLen = 6 * z;
                  for(let k = 0.25; k <= 0.75; k += 0.25){
                    const px = geom.pA.x + dx * k;
                    const py = geom.pA.y + dy * k;
                    ctx.beginPath();
                    ctx.moveTo(px, py);
                    ctx.lineTo(px + fx * tickLen, py + fy * tickLen);
                    ctx.stroke();
                  }
                  ctx.restore();
                }
              }
            }
          }
        }

        // 在前线中点绘制集团军番号徽章
        if(edgeMidPoints.length > 0){
          const midP = edgeMidPoints[Math.floor(edgeMidPoints.length / 2)];
          const divisionsCount = front.assigned ? Object.values(front.assigned).flat().length : (world.units.filter(u => u.nat === world.player).length);
          const badgeText = `🛡️ 前线防御带 · ${divisionsCount} 师`;

          ctx.save();
          ctx.font = `bold ${Math.max(9, Math.round(10.5 * z))}px sans-serif`;
          const tw = ctx.measureText(badgeText).width;
          ctx.fillStyle = 'rgba(12, 18, 28, 0.92)';
          ctx.fillRect(midP.x - tw/2 - 6, midP.y - 10 * z, tw + 12, 20 * z);
          ctx.strokeStyle = '#00f0ff';
          ctx.lineWidth = 1.2;
          ctx.strokeRect(midP.x - tw/2 - 6, midP.y - 10 * z, tw + 12, 20 * z);

          ctx.fillStyle = '#e0f2fe';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(badgeText, midP.x, midP.y);
          ctx.restore();
        }
        ctx.restore();
      }
    }

    // 2. 橙色退守线
    if(world.fallbackLines){
      for(const fb of world.fallbackLines){
        if(fb.nat !== world.player || !fb.hexes) continue;
        ctx.save();
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = Math.max(3, 4 * z);
        ctx.setLineDash([8 * z, 5 * z]);
        for(let i = 0; i < fb.hexes.length - 1; i++){
          const h1 = world.hexes[fb.hexes[i]];
          const h2 = world.hexes[fb.hexes[i+1]];
          if(h1 && h2){
            const p1 = cam.toPix(h1.q, h1.r);
            const p2 = cam.toPix(h2.q, h2.r);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
        ctx.restore();
      }
    }

    // 3. 经典钢四宽带进攻矛头（带动态流光斑马纹、多段弯曲轴线与大型战术箭头）
    if(world.arrows){
      for(const arrow of world.arrows){
        if(arrow.nat !== world.player || !arrow.targets || !arrow.targets.length) continue;
        const front = (world.fronts || []).find(f => f.id === arrow.frontId);
        const startHex = (front && front.hexes.length) ? world.hexes[front.hexes[Math.floor(front.hexes.length / 2)]] : null;
        if(!startHex) continue;

        // 构建从前线中点到全部途经点与终点的完整路径
        const pathHexes = [startHex];
        const allTargets = (arrow.waypoints && arrow.waypoints.length) ? arrow.waypoints : arrow.targets;
        for(const tIdx of allTargets){
          const th = world.hexes[tIdx];
          if(th && !pathHexes.includes(th)) pathHexes.push(th);
        }
        if(pathHexes.length < 2) continue;

        const pts = pathHexes.map(h => cam.toPix(h.q, h.r));
        const pFinal = pts[pts.length - 1];
        const pPrev = pts[pts.length - 2];

        const dxFinal = pFinal.x - pPrev.x, dyFinal = pFinal.y - pPrev.y;
        const distFinal = Math.hypot(dxFinal, dyFinal);
        if(distFinal < 10) continue;

        const uxFinal = dxFinal / distFinal, uyFinal = dyFinal / distFinal;
        const nxFinal = -uyFinal, nyFinal = uxFinal;

        const shaftW = Math.max(14, 18 * z);
        const headLen = Math.max(22, 28 * z);
        const headW = shaftW * 2.2;
        const pShaftEnd = { x: pFinal.x - uxFinal * headLen, y: pFinal.y - uyFinal * headLen };

        ctx.save();
        // 宽带箭身半透明红色底托
        ctx.fillStyle = arrow.kind === 'spearhead' ? 'rgba(220, 38, 38, 0.42)' : 'rgba(239, 68, 68, 0.32)';
        ctx.strokeStyle = arrow.kind === 'spearhead' ? '#dc2626' : '#ef4444';
        ctx.lineWidth = Math.max(2, 2.5 * z);

        // 绘制箭身主轴多段连通带
        ctx.beginPath();
        for(let i = 0; i < pts.length - 1; i++){
          const pA = pts[i];
          const pB = (i === pts.length - 2) ? pShaftEnd : pts[i + 1];
          const sDx = pB.x - pA.x, sDy = pB.y - pA.y;
          const sDist = Math.hypot(sDx, sDy) || 1;
          const sNx = -sDy / sDist, sNy = sDx / sDist;

          ctx.moveTo(pA.x + sNx * shaftW/2, pA.y + sNy * shaftW/2);
          ctx.lineTo(pB.x + sNx * shaftW/2, pB.y + sNy * shaftW/2);
          ctx.lineTo(pB.x - sNx * shaftW/2, pB.y - sNy * shaftW/2);
          ctx.lineTo(pA.x - sNx * shaftW/2, pA.y - sNy * shaftW/2);
          ctx.closePath();
        }
        ctx.fill();
        ctx.stroke();

        // 箭身内部战术斜纹 (/// Chevrons)
        ctx.save();
        ctx.strokeStyle = 'rgba(254, 202, 202, 0.45)';
        ctx.lineWidth = Math.max(1.5, 2 * z);
        const army = (world.armies || []).find(a => a.nat === world.player);
        const isExec = army && army.executing;
        const stripeStep = 16 * z;
        const stripeOffset = isExec ? ((Date.now() / 35) % stripeStep) : 0;

        for(let i = 0; i < pts.length - 1; i++){
          const pA = pts[i];
          const pB = (i === pts.length - 2) ? pShaftEnd : pts[i + 1];
          const sDx = pB.x - pA.x, sDy = pB.y - pA.y;
          const sDist = Math.hypot(sDx, sDy) || 1;
          const sUx = sDx / sDist, sUy = sDy / sDist;
          const sNx = -sUy, sNy = sUx;
          const numStripes = Math.floor(sDist / stripeStep);

          for(let s = 1; s < numStripes; s++){
            const dPos = s * stripeStep + stripeOffset;
            if(dPos > sDist - (i === pts.length - 2 ? 6 : 0)) continue;
            const sx = pA.x + sUx * dPos, sy = pA.y + sUy * dPos;
            ctx.beginPath();
            ctx.moveTo(sx + sNx * (shaftW * 0.45) - sUx * 6 * z, sy + sNy * (shaftW * 0.45) - sUy * 6 * z);
            ctx.lineTo(sx, sy);
            ctx.lineTo(sx - sNx * (shaftW * 0.45) - sUx * 6 * z, sy - sNy * (shaftW * 0.45) - sUy * 6 * z);
            ctx.stroke();
          }
        }
        ctx.restore();

        // 战术大箭头 (Arrow Head)
        ctx.fillStyle = arrow.kind === 'spearhead' ? '#dc2626' : '#ef4444';
        ctx.beginPath();
        ctx.moveTo(pFinal.x, pFinal.y);
        ctx.lineTo(pShaftEnd.x + nxFinal * headW/2, pShaftEnd.y + nyFinal * headW/2);
        ctx.lineTo(pShaftEnd.x + nxFinal * shaftW/2, pShaftEnd.y + nyFinal * shaftW/2);
        ctx.lineTo(pShaftEnd.x - nxFinal * shaftW/2, pShaftEnd.y - nyFinal * shaftW/2);
        ctx.lineTo(pShaftEnd.x - nxFinal * headW/2, pShaftEnd.y - nyFinal * headW/2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 目标格同心圆光标 🎯
        ctx.strokeStyle = '#ffd977';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pFinal.x, pFinal.y, 8 * z, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(pFinal.x, pFinal.y, 3 * z, 0, Math.PI * 2);
        ctx.fillStyle = '#ffd977';
        ctx.fill();

        // 中间弯曲拐点交互指示环 ◎
        if(pts.length > 2){
          for(let i = 1; i < pts.length - 1; i++){
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(pts[i].x, pts[i].y, 5 * z, 0, Math.PI * 2);
            ctx.stroke();
          }
        }

        // 箭身战术参数标牌
        const midP = pts[Math.floor(pts.length / 2)];
        const planText = army ? `🎯 ${arrow.kind === 'spearhead' ? '强突矛头' : '主攻方向'} · 筹划 +${(army.planning * 100).toFixed(0)}%` : '🎯 突破攻势';

        ctx.font = `bold ${Math.max(9, Math.round(10.5 * z))}px sans-serif`;
        const tw = ctx.measureText(planText).width;
        ctx.fillStyle = 'rgba(15, 20, 28, 0.94)';
        ctx.fillRect(midP.x - tw/2 - 6, midP.y - 9 * z, tw + 12, 18 * z);
        ctx.strokeStyle = isExec ? '#22c55e' : '#ef4444';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(midP.x - tw/2 - 6, midP.y - 9 * z, tw + 12, 18 * z);

        ctx.fillStyle = isExec ? '#86efac' : '#ffd977';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(isExec ? `⚡ 执行中 · ${planText}` : planText, midP.x, midP.y);
        ctx.restore();
      }
    }
  }
}

