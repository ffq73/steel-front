/* ============================================================
   tools/map_preview.cjs —— 地图几何预览渲染器
   把图集构建出的六角格按归属国填色、海陆描边，输出 PNG。
   用途：在没有浏览器的情况下用肉眼核对「国家轮廓是否认得出」。
   用法：node tools/map_preview.cjs [ww2|ww1|A] [输出路径]
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const mod = (p) => import(pathToFileURL(path.join(root, p)).href);

(async () => {
  const scenario = (process.argv[2] || 'ww2').toLowerCase();
  const out = process.argv[3] || path.join(root, 'docs', 'shots', `v11_${scenario}_preview.png`);

  const { loadScenario } = await mod('js/engine/world.js');
  const world = loadScenario(scenario === 'a' ? 'A' : scenario, 42);

  const S = 13;                    // 单格外接半径（像素）
  const W = Math.sqrt(3) * S;
  const H = 1.5 * S;
  let maxQ = 0, maxR = 0;
  for (const h of world.hexes) { if (h.q > maxQ) maxQ = h.q; if (h.r > maxR) maxR = h.r; }
  const pad = 24;
  const iw = Math.ceil(W * (maxQ + 1) + W / 2) + pad * 2;
  const ih = Math.ceil(H * (maxR + 1) + S) + pad * 2;

  const px = (q, r) => [pad + S * Math.sqrt(3) * (q + ((r & 1) ? 0.5 : 0)) + S * Math.sqrt(3) / 2,
                         pad + S * 1.5 * r + S];
  const corners = (cx, cy) => {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 180 * (60 * i - 30);
      pts.push([cx + S * Math.cos(a), cy + S * Math.sin(a)]);
    }
    return pts.map(([x, y]) => x.toFixed(1) + ',' + y.toFixed(1)).join(' ');
  };

  // 调色板：优先用剧本国家色，缺失时回落到按代码散列
  const natColor = {};
  for (const id of world.nations ? Object.keys(world.nations) : []) {
    natColor[id] = world.nations[id].color || null;
  }
  const hashColor = (code) => {
    let h = 0;
    for (const ch of String(code)) h = (h * 131 + ch.charCodeAt(0)) >>> 0;
    const r = 90 + (h % 130), g = 90 + ((h >> 8) % 130), b = 90 + ((h >> 16) % 130);
    return `rgb(${r},${g},${b})`;
  };
  const fillOf = (owner) => {
    if (owner === 'N') return '#6b7280';
    if (natColor[owner]) return natColor[owner];
    return hashColor(owner);
  };

  let polys = '';
  for (const h of world.hexes) {
    const [cx, cy] = px(h.q, h.r);
    const fill = h.terrain === 'sea' ? '#16324a' : fillOf(h.owner);
    polys += `<polygon points="${corners(cx, cy)}" fill="${fill}" stroke="#0b1622" stroke-width="0.6"/>`;
  }
  // 城市点与国名标注
  let marks = '';
  for (const h of world.hexes) {
    if (!h.city) continue;
    const [cx, cy] = px(h.q, h.r);
    const cap = !!h.city.cap;
    marks += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${cap ? 3.2 : 1.8}" fill="#ffd977" stroke="#3b2a08" stroke-width="0.7"/>`;
    if (cap) {
      marks += `<text x="${cx.toFixed(1)}" y="${(cy - 5).toFixed(1)}" font-size="8.5" fill="#fff8e1" text-anchor="middle" font-family="sans-serif">${h.city.name}</text>`;
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${iw}" height="${ih}">
  <rect width="100%" height="100%" fill="#0d1a26"/>
  ${polys}${marks}
  <text x="10" y="${ih - 8}" font-size="11" fill="#93a4b5" font-family="sans-serif">${scenario.toUpperCase()} · ${world.hexes.length} 格 · 陆地 ${world.hexes.filter(h => h.terrain !== 'sea').length} · 城市 ${world.hexes.filter(h => h.city).length}</text>
</svg>`;

  fs.mkdirSync(path.dirname(out), { recursive: true });
  await sharp(Buffer.from(svg)).png().toFile(out);
  console.log('已输出 ' + out + `  (${iw}×${ih}, ${world.hexes.length} 格)`);
})();
