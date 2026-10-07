/* ============================================================
   tests/atlas_map.test.js —— v11.0 图集地图验收
   检查点：
     1. 三个图层行宽都等于 ATLAS_W（DSL 已强制，双保险）
     2. 每座城市都落在陆地上（不能掉进海里）
     3. 每个首都所属国家的格数 ≥ 4（不能只剩一格）
     4. 主要交战国的领土是连通的（六边形连通分量检查）
     5. 图集构建的地图 邻接对称 且 不含海洋邻居
     6. 同种子两次构建逐格一致（确定性）
   ============================================================ */

import assert from 'node:assert/strict';
import {
  LAND, OWN_WW1, OWN_WW2, ATLAS_W, ATLAS_H, atlasStats, buildFromAtlas
} from '../js/data/atlas.js';
import { WW2_CITIES, buildWW2Map } from '../js/data/scenarios/ww2/map.js';
import { WW1_CITIES, buildWW1Map } from '../js/data/scenarios/ww1/map.js';
import { oddrNeighbors } from '../js/core/geom.js';

console.log('=== v11.0 图集地图验收 ===\n');

// 1. 行宽
console.log('--- 1. 图层行宽 ---');
for(const [name, layer] of [['LAND', LAND], ['OWN_WW2', OWN_WW2], ['OWN_WW1', OWN_WW1]]){
  assert.equal(layer.length, ATLAS_H, `${name} 行数应为 ${ATLAS_H}`);
  for(let r = 0; r < layer.length; r++){
    assert.equal(layer[r].length, ATLAS_W, `${name} 第 ${r} 行宽度错`);
  }
}
console.log(`✓ 三层均为 ${ATLAS_W}×${ATLAS_H}`);

// 2. 城市必须落在陆地
console.log('\n--- 2. 城市落位 ---');
// 城市表用图集坐标书写，地图本体可能被裁剪 —— 用返回的 crop 偏移换算
const ww2 = buildWW2Map();
const localOf = (m, q, r) => (q - m.crop.q0) + ',' + (r - m.crop.r0);
for(const c of WW2_CITIES){
  const h = ww2.at[localOf(ww2, c.q, c.r)];
  assert.ok(h, `二战城市「${c.name}」坐标 (${c.q},${c.r}) 超出地图`);
  assert.notEqual(h.terrain, 'sea', `二战城市「${c.name}」掉进海里 (${c.q},${c.r})`);
}
assert.equal(ww2.hexes.filter((h) => h.city).length, WW2_CITIES.length, '有城市未落位');
console.log(`✓ 二战 ${WW2_CITIES.length} 座城市全部落在陆地`);

const ww1 = buildWW1Map();
for(const c of WW1_CITIES){
  const h = ww1.at[localOf(ww1, c.q, c.r)];
  assert.ok(h, `一战城市「${c.name}」坐标 (${c.q},${c.r}) 超出地图`);
  assert.notEqual(h.terrain, 'sea', `一战城市「${c.name}」掉进海里 (${c.q},${c.r})`);
}
console.log(`✓ 一战 ${WW1_CITIES.length} 座城市全部落在陆地`);

// 3. 领土规模下限
console.log('\n--- 3. 主要国家领土规模 ---');
const st = atlasStats(OWN_WW2);
const NAMES = { 5:'苏联', 4:'法国', 1:'德国', 2:'意大利', 3:'英国', 6:'波兰', q:'中国', r:'日本' };
for(const [code, label] of Object.entries(NAMES)){
  const n = st.byNat[code] || 0;
  assert.ok(n >= 8, `${label} 领土只有 ${n} 格，形状可能画崩了`);
  console.log(`  ${label}：${n} 格`);
}

// 4. 关键国家的领土连通性（跨海飞地除外：英国本土、意属北非、法属北非）
console.log('\n--- 4. 领土连通性 ---');
function comps(code, layer){
  const seen = new Set(), out = [];
  for(let r = 0; r < ATLAS_H; r++){
    for(let q = 0; q < ATLAS_W; q++){
      if(LAND[r][q] === '~' || layoutAt(layer, r, q) !== code || seen.has(q + ',' + r)) continue;
      const stk = [[q, r]]; seen.add(q + ',' + r);
      let size = 0;
      while(stk.length){
        const [cq, cr] = stk.pop(); size++;
        for(const [nq, nr] of oddrNeighbors(cq, cr)){
          if(nq < 0 || nr < 0 || nq >= ATLAS_W || nr >= ATLAS_H) continue;
          if(LAND[nr][nq] === '~' || seen.has(nq + ',' + nr) || layoutAt(layer, nr, nq) !== code) continue;
          seen.add(nq + ',' + nr); stk.push([nq, nr]);
        }
      }
      out.push(size);
    }
  }
  return out.sort((a, b) => b - a);
}
function layoutAt(layer, r, q){ return layer[r][q]; }

// 德国本土必须是单一整块（旧矩形版德国与东普鲁士被波兰隔开是史实，此处允许 2 块）
const gerParts = comps('1', OWN_WW2);
assert.ok(gerParts.length <= 2, `德国被切成 ${gerParts.length} 块`);
assert.ok(gerParts[0] >= 20, `德国主块只有 ${gerParts[0]} 格`);
console.log(`  ✓ 德国：主块 ${gerParts[0]} 格，共 ${gerParts.length} 块（含东普鲁士飞地）`);

const itaParts = comps('2', OWN_WW2);
assert.ok(itaParts[0] >= 20, `意大利主块只有 ${itaParts[0]} 格`);
console.log(`  ✓ 意大利：主块 ${itaParts[0]} 格，共 ${itaParts.length} 块（含西西里/利比亚）`);

const polParts = comps('6', OWN_WW2);
assert.ok(polParts[0] >= 15, `波兰主块只有 ${polParts[0]} 格`);
console.log(`  ✓ 波兰：主块 ${polParts[0]} 格`);

// 5. 邻接对称 + 不含海洋
console.log('\n--- 5. 邻接拓扑 ---');
const map = ww2;
for(const h of map.hexes){
  if(h.terrain === 'sea') continue;
  for(const ni of h.adj){
    const nb = map.hexes[ni];
    assert.notEqual(nb.terrain, 'sea', `(${h.q},${h.r}) 的邻居是海洋`);
    assert.ok(nb.adj.includes(h.i), `邻接不对称：(${h.q},${h.r}) ↔ (${nb.q},${nb.r})`);
  }
}
console.log('✓ 邻接关系对称且不跨越海洋');

// 6. 确定性
console.log('\n--- 6. 确定性 ---');
const a = buildWW2Map(), b = buildWW2Map();
assert.equal(a.hexes.length, b.hexes.length);
for(let i = 0; i < a.hexes.length; i++){
  assert.equal(a.hexes[i].terrain, b.hexes[i].terrain, `第 ${i} 格地形不确定`);
  assert.equal(a.hexes[i].owner, b.hexes[i].owner, `第 ${i} 格归属不确定`);
}
console.log('✓ 两次构建逐格一致');


/* -------------------------------------------------------------
   7. 战区命名（v11.0）：前线按覆盖地区命名，而不是「前线 A / 前线 B」
   ------------------------------------------------------------- */
console.log('\n--- 7. 战区命名 ---');
{
  const { SCENARIOS } = await import('../js/data/scenarios.js');
  const { loadScenario } = await import('../js/engine/world.js');
  const { findFrontierHexes } = await import('../js/engine/plans.js');
  const { theaterNameFor, splitFrontSegments } = await import('../js/data/theaters.js');

  let named = 0;
  for(const scId of Object.keys(SCENARIOS)){
    const w = loadScenario(scId, 42);
    for(const natId in w.nations){
      const hexes = findFrontierHexes(w, natId);
      if(!hexes.length) continue;
      for(const seg of splitFrontSegments(w, hexes)){
        const name = theaterNameFor(w, seg);
        assert.ok(name && name.length >= 3, `${scId}/${natId} 战区名过短：「${name}」`);
        assert.ok(/方向|卫戍圈|坐标/.test(name), `${scId}/${natId} 战区名缺少定位信息：「${name}」`);
        assert.equal(name, theaterNameFor(w, seg), '战区命名必须确定性');
        named++;
      }
    }
  }
  assert.ok(named >= 20, `可命名的前线段过少：${named}`);
  console.log(`✓ ${named} 段前线均得到确定性可读战区名`);
}

console.log('\n=== 图集地图验收全部通过 ===');
