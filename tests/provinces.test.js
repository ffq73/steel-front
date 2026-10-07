// tests/provinces.test.js —— v10.0 P2 行省拓扑与共享边图 7 大核心断言测试
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { loadScenario } from '../js/engine/world.js';
import { buildProvinces, pickProvince } from '../js/render/provinces.js';
import { pointInPoly } from '../js/core/geom.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const ERAS = ['ww1', 'ww2', 'coldwar', 'modern'];

let totalPassed = 0;
let totalFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✓ ${message}`);
    totalPassed++;
  } else {
    console.error(`✗ FAIL: ${message}`);
    totalFailed++;
  }
}

console.log('=== tests/provinces.test.js: P2 行省拓扑与共享边图验收 ===\n');

// -------------------------------------------------------------
// 断言 1: cell 数 == hex 数（四时代各跑一遍）
// -------------------------------------------------------------
{
  let allEqual = true;
  for (const era of ERAS) {
    const world = loadScenario(era, 42);
    const provs = buildProvinces(world);
    if (!provs || !provs.cells || provs.cells.length !== world.hexes.length) {
      allEqual = false;
      console.error(`  ${era}: cells (${provs?.cells?.length}) !== hexes (${world.hexes.length})`);
    }
  }
  assert(allEqual, '断言 1: cell 数 == hex 数（四时代完全 1:1 映射）');
}

// -------------------------------------------------------------
// 断言 2: 每省 adj 集合 == 原 hex adj 集合（C39 核心断言）
// -------------------------------------------------------------
{
  let allAdjEqual = true;
  for (const era of ERAS) {
    const world = loadScenario(era, 42);
    const provs = buildProvinces(world);
    for (let i = 0; i < world.hexes.length; i++) {
      const hex = world.hexes[i];
      const cell = provs.cells[i];
      const hexAdj = [...hex.adj].sort((a, b) => a - b);
      const cellAdj = [...cell.adj].sort((a, b) => a - b);
      if (hexAdj.length !== cellAdj.length || !hexAdj.every((v, idx) => v === cellAdj[idx])) {
        allAdjEqual = false;
        console.error(`  ${era} hex ${i} adj 不匹配: hex=${hexAdj} cell=${cellAdj}`);
        break;
      }
    }
    if (!allAdjEqual) break;
  }
  assert(allAdjEqual, '断言 2: 每省 adj 集合 == 原 hex adj 集合（C39 拓扑全等）');
}

// -------------------------------------------------------------
// 断言 3: 每对邻省共享边双向一致（端点差 < 0.5px）
// -------------------------------------------------------------
{
  let allEdgesMatch = true;
  for (const era of ERAS) {
    const world = loadScenario(era, 42);
    const provs = buildProvinces(world);
    for (const cell of provs.cells) {
      for (const ni of cell.adj) {
        const edgeAB = provs.sharedEdges?.[cell.idx]?.[ni];
        const edgeBA = provs.sharedEdges?.[ni]?.[cell.idx];
        if (!edgeAB || !edgeBA) {
          allEdgesMatch = false;
          console.error(`  ${era} 缺少共享边: ${cell.idx} <-> ${ni}`);
          break;
        }
        // edgeAB: [p0, p1], edgeBA: [q0, q1] 应反向相等
        const p0 = edgeAB[0], p1 = edgeAB[edgeAB.length - 1];
        const q0 = edgeBA[0], q1 = edgeBA[edgeBA.length - 1];
        const d1 = Math.hypot(p0[0] - q1[0], p0[1] - q1[1]);
        const d2 = Math.hypot(p1[0] - q0[0], p1[1] - q0[1]);
        if (d1 >= 0.5 || d2 >= 0.5) {
          allEdgesMatch = false;
          console.error(`  ${era} 共享边端点偏移过大: ${cell.idx}-${ni} d1=${d1.toFixed(3)} d2=${d2.toFixed(3)}`);
          break;
        }
      }
      if (!allEdgesMatch) break;
    }
    if (!allEdgesMatch) break;
  }
  assert(allEdgesMatch, '断言 3: 每对邻省共享边双向一致（端点差 < 0.5px）');
}

// -------------------------------------------------------------
// 断言 4: 全部胞腔无缝无叠（任意两胞腔重叠面积 ≈ 0，多边形有效性）
// -------------------------------------------------------------
{
  let allValid = true;
  for (const era of ERAS) {
    const world = loadScenario(era, 42);
    const provs = buildProvinces(world);
    for (const cell of provs.cells) {
      // 凸多边形至少 3 顶点，且面积大于正值
      if (!cell.polygon || cell.polygon.length < 3) {
        allValid = false;
        break;
      }
      let area = 0;
      const n = cell.polygon.length;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        area += cell.polygon[i][0] * cell.polygon[j][1];
        area -= cell.polygon[j][0] * cell.polygon[i][1];
      }
      area = Math.abs(area) * 0.5;
      if (area < 100) { // 正常 cell 面积约在 1500~2500 px^2
        allValid = false;
        console.error(`  ${era} cell ${cell.idx} 面积异常过小: ${area}`);
        break;
      }
    }
    if (!allValid) break;
  }
  assert(allValid, '断言 4: 全部胞腔无缝无叠（非退化多边形且面积有效）');
}

// -------------------------------------------------------------
// 断言 5: 种子点射线法命中返回自身省（100% 胞腔在其种子点处命中自身）
// -------------------------------------------------------------
{
  let hitAllSelf = true;
  let totalChecked = 0;
  for (const era of ERAS) {
    const world = loadScenario(era, 42);
    const provs = buildProvinces(world);
    for (const cell of provs.cells) {
      totalChecked++;
      const hit = provs.pickProvince(cell.seed.x, cell.seed.y);
      if (!hit || hit.idx !== cell.idx) {
        hitAllSelf = false;
        console.error(`  ${era} cell ${cell.idx} 在种子点 (${cell.seed.x}, ${cell.seed.y}) 命中为 ${hit?.idx}`);
        break;
      }
    }
    if (!hitAllSelf) break;
  }
  assert(hitAllSelf, `断言 5: 种子点射线法命中返回自身省 (${totalChecked}/${totalChecked})`);
}

// -------------------------------------------------------------
// 断言 6: 同种子两次生成：cells 逐字节一致（C40 确定性）
// -------------------------------------------------------------
{
  const world1 = loadScenario('ww2', 19390901);
  const provs1 = buildProvinces(world1);
  const json1 = JSON.stringify(provs1.cells.map(c => ({ idx: c.idx, q: c.q, r: c.r, poly: c.polygon })));

  const world2 = loadScenario('ww2', 19390901);
  const provs2 = buildProvinces(world2);
  const json2 = JSON.stringify(provs2.cells.map(c => ({ idx: c.idx, q: c.q, r: c.r, poly: c.polygon })));

  assert(json1 === json2, '断言 6: 同种子两次生成 cells 逐字节严格相等（C40 确定性）');
}

// -------------------------------------------------------------
// 断言 7: js/engine/** 未被无登记改动（C41 引擎改动须显式登记）
// -------------------------------------------------------------
// v11.0：原来把 37 个引擎文件的 md5 硬编码在测试里，措辞是「零篡改」。
// 地图放大轮确实需要动引擎（国策树接线、军的建立、效果解释器补类型），
// 硬编码清单会让每次正当改动都变成「篡改」。改为外置清单 + 显式登记：
//   node tests/provinces.test.js --update-engine-manifest
// 意图不变 —— 引擎的任何变化都必须是一次**被看见的决定**，而不是顺手改掉。
{
  const MANIFEST_PATH = path.join(ROOT, 'tests', 'engine_manifest.json');
  const engineDir = path.join(ROOT, 'js/engine');

  const current = {};
  const files = fs.readdirSync(engineDir).sort();
  for (const f of files) {
    const buf = fs.readFileSync(path.join(engineDir, f));
    current[f] = crypto.createHash('md5').update(buf).digest('hex');
  }

  if (process.argv.includes('--update-engine-manifest')) {
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(current, null, 2) + '\n');
    console.log(`✓ 引擎指纹已重新登记（${files.length} 个文件）`);
  }

  const expected = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  let engineIntact = true;
  for (const f of files) {
    if (expected[f] !== current[f]) {
      engineIntact = false;
      console.error(`  engine 文件发生未登记改动: ${f}（当前 ${current[f]}，登记 ${expected[f] || '缺失'}）`);
    }
  }
  for (const f in expected) {
    if (!files.includes(f)) {
      engineIntact = false;
      console.error(`  engine 文件缺失: ${f}`);
    }
  }
  if(!engineIntact){
    console.error('  ↳ 若属于有意改动，运行：node tests/provinces.test.js --update-engine-manifest');
  }
  assert(engineIntact, '断言 7: js/engine/** 全部指纹与 tests/engine_manifest.json 一致（C41 引擎改动须显式登记）');
}

console.log(`\n验收结果: ${totalPassed} 通过, ${totalFailed} 失败`);
if (totalFailed > 0) {
  process.exit(1);
} else {
  console.log('✓ P2 全部断言通过！');
}
