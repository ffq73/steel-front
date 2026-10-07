/* ============================================================
   render/camera.js —— 缩放 / 平移 / 视口换算 / DPR 适配（§4.3）
   ============================================================ */

import { hexToPix, pixToHex } from '../core/geom.js';
import { K } from '../data/constants.js';

export class Camera {
  constructor(canvas){
    this.canvas = canvas;
    this.x = 0; this.y = 0; this.z = 1;
    this.size = K.HEX_SIZE;
  }
  resize(){
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.dpr = dpr;
  }
  ctx(){
    const ctx = this.canvas.getContext('2d');
    const dpr = this.dpr || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }
  toPix(q, r){
    const p = hexToPix(q, r, this.size * this.z);
    return { x: p.x + this.x, y: p.y + this.y };
  }
  toHex(px, py){
    const w = this.world || (typeof window !== 'undefined' && (window.SF?.game?.world || window.SF?.store?.world));
    if(w && w.provinces && typeof w.provinces.pickProvince === 'function'){
      const wx = (px - this.x) / this.z;
      const wy = (py - this.y) / this.z;
      const hit = w.provinces.pickProvince(wx, wy);
      if(hit) return { q: hit.q, r: hit.r };
    }
    return pixToHex(px - this.x, py - this.y, this.size * this.z);
  }
  pickProvince(px, py, world = null){
    const w = world || this.world || (typeof window !== 'undefined' && (window.SF?.game?.world || window.SF?.store?.world));
    if(w && w.provinces && typeof w.provinces.pickProvince === 'function'){
      const wx = (px - this.x) / this.z;
      const wy = (py - this.y) / this.z;
      return w.provinces.pickProvince(wx, wy);
    }
    const h = this.toHex(px, py);
    return w?.at ? w.at[h.q + ',' + h.r] : h;
  }
  zoomAt(px, py, factor){
    const oldZ = this.z;
    this.z = Math.min(2.6, Math.max(0.30, this.z * factor));   // v8.0：下限放宽至 0.30，使全局 LOD 聚合可见
    const k = this.z / oldZ;
    this.x = px - (px - this.x) * k;
    this.y = py - (py - this.y) * k;
  }
  viewRect(){
    return { w: this.canvas.clientWidth, h: this.canvas.clientHeight };
  }
  visible(hex){   // 视口裁剪（fullRender=true 时用于世界缓存绘制，不做裁剪）
    if(this.fullRender) return true;
    const p = this.toPix(hex.q, hex.r);
    const s = this.size * this.z * 2;
    const v = this.viewRect();
    return p.x > -s && p.x < v.w + s && p.y > -s && p.y < v.h + s;
  }

  /* 视野适配：把一组格子（通常为玩家领土）居中并缩放到刚好铺满视口 */
  fitToHexes(hexes, pad = 70){
    if(!hexes || !hexes.length) return;
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for(const h of hexes){
      const p = hexToPix(h.q, h.r, this.size);   // z=1 基准坐标
      if(p.x < minX) minX = p.x;
      if(p.x > maxX) maxX = p.x;
      if(p.y < minY) minY = p.y;
      if(p.y > maxY) maxY = p.y;
    }
    const v = this.viewRect();
    const w = Math.max(200, maxX - minX);
    const hgt = Math.max(200, maxY - minY);
    const z = Math.min((v.w - pad * 2) / w, (v.h - pad * 2) / hgt);
    this.z = Math.max(0.34, Math.min(2.4, z));
    this.x = v.w / 2 - ((minX + maxX) / 2) * this.z;
    this.y = v.h / 2 - ((minY + maxY) / 2) * this.z;
  }
}
