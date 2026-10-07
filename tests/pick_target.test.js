/* ============================================================
   tests/pick_target.test.js —— v12.0 S1 自动选靶验收（C44）
   ------------------------------------------------------------
   修复前：X 键按「到地图最右下角一格的距离」找最近敌城 →
   德国 1939 年按 X 矛头指向耶路撒冷（input.js:551-557 旧副本）；
   「进攻矛头」按钮按格子枚举顺序取第一个敌国首都（panels.js:148 旧副本）。
   修复后：两处调用点共用 engine/plans.pickOffensiveTarget，
   基准点只允许是玩家前线质心 / 首都，主敌 = 共享边界格最多者。
   运行：node tests/pick_target.test.js
   ============================================================ */

import assert from 'node:assert/strict';
import { loadScenario } from '../js/engine/world.js';
import { pickOffensiveTarget } from '../js/engine/plans.js';

console.log('=== v12 S1 自动选靶验收（C44 玩家视角基准） ===\n');

let passed = 0, failed = 0;
function t(name, fn){
  try{ fn(); passed++; console.log('✓', name); }
  catch(e){ failed++; console.log('✗', name, '→', e.message); }
}

/* 主敌判定与测试内独立实现的「共享边界格计数 argmax」互核 */
function argmaxBorderEnemy(w){
  const atWar = w.nations[w.player].atWarWith || [];
  const count = new Map();
  for(const h of w.hexes){
    if(h.owner !== w.player) continue;
    for(const ni of h.adj){
      const nh = w.hexes[ni];
      if(nh && atWar.includes(nh.owner)) count.set(nh.owner, (count.get(nh.owner) || 0) + 1);
    }
  }
  let best = null, bestN = -1;
  for(const [tag, n] of count){ if(n > bestN){ bestN = n; best = tag; } }
  return { best, bestN };
}

/* ---------- 1. 无交战国 → null ---------- */
t('S1-1 无交战国时返回 null（toast 提示由调用方给出）', () => {
  const w = loadScenario('ww2', 42);
  w.nations[w.player].atWarWith = [];
  assert.equal(pickOffensiveTarget(w, 'spearhead'), null);
  assert.equal(pickOffensiveTarget(w, 'offensive'), null);
});

/* ---------- 2. 矛头直指主敌首都 ---------- */
t('S1-2 德国 ww2 开局 Shift+X：矛头 = 主敌首都（华沙），不是耶路撒冷', () => {
  const w = loadScenario('ww2', 42);
  const picked = pickOffensiveTarget(w, 'spearhead');
  assert.ok(picked, '开局应有交战国可选靶');
  assert.ok(picked.target.city && picked.target.city.cap === picked.mainEnemy,
    `矛头必须是主敌首都，实得 ${picked.target.city ? picked.target.city.name : '非城市'}`);
  assert.equal(picked.target.city.name, '华沙',
    `德国 1939 主敌是波兰，矛头应指华沙，实得 ${picked.target.city.name}`);
  const name = picked.target.city.name;
  assert.ok(!/耶路撒冷/.test(name), '不得再指向耶路撒冷');
});

/* ---------- 3. 攻势线指向主敌边境方向敌城（华沙/波兹南方向） ---------- */
t('S1-3 德国 ww2 开局按 X：攻势线 = 距玩家前线质心最近的主敌城市', () => {
  const w = loadScenario('ww2', 42);
  const picked = pickOffensiveTarget(w, 'offensive');
  assert.ok(picked && picked.target.city, '攻势线必须落在敌国城市上');
  const { target, base, mainEnemy } = picked;
  assert.equal(target.owner, mainEnemy,
    `攻势线目标必须属于主敌（波兹南方向），实得 ${target.owner} 的 ${target.city.name}`);
  assert.ok(!/耶路撒冷/.test(target.city.name), '不得再指向耶路撒冷');
  // 主敌城市中必须取最近
  const d0 = Math.hypot(target.q - base.q, target.r - base.r);
  for(const h of w.hexes){
    if(!h.city || h.owner !== mainEnemy) continue;
    const d = Math.hypot(h.q - base.q, h.r - base.r);
    assert.ok(d >= d0 - 1e-9, `主敌存在更近城市 (${h.city.name}) 未被选中`);
  }
});

/* ---------- 4. 多敌国 → 边境最长者为主敌 ---------- */
t('S1-4 多敌国时主敌 = 与玩家共享边界格数最多者', () => {
  const w = loadScenario('ww2', 42);
  const { best, bestN } = argmaxBorderEnemy(w);
  assert.ok(best && bestN > 0, '开局应存在与玩家接壤的交战国');
  const picked = pickOffensiveTarget(w, 'spearhead');
  assert.equal(picked.mainEnemy, best, `主敌应为 ${best}（${bestN} 格共享边界）`);
  // 人为追加一个与玩家不接壤的交战国，主敌不应被搅局者抢走
  const outsider = Object.keys(w.nations).find(tag =>
    tag !== w.player && !w.nations[w.player].atWarWith.includes(tag) &&
    !w.hexes.some(h => h.owner === tag && h.adj.some(ni => w.hexes[ni].owner === w.player)));
  if(outsider){
    w.nations[w.player].atWarWith.push(outsider);
    const again = pickOffensiveTarget(w, 'spearhead');
    assert.equal(again.mainEnemy, best, '不接壤的交战国不得成为主敌');
  }
});

/* ---------- 5. 无首都国回退 ---------- */
t('S1-5 主敌无首都时矛头回退：最近敌国首都 → 最近敌国城市 → 交战格', () => {
  const w = loadScenario('ww2', 42);
  // 摘掉主敌的全部首都标记，只留它一家交战国
  const main = pickOffensiveTarget(w, 'spearhead').mainEnemy;
  w.nations[w.player].atWarWith = [main];
  let capName = null;
  for(const h of w.hexes){
    if(h.city && h.city.cap === main){ capName = h.city.name; h.city.cap = null; }
  }
  assert.ok(capName, `应能摘掉 ${main} 的首都标记`);
  const picked = pickOffensiveTarget(w, 'spearhead');
  assert.ok(picked, '无首都国也必须给出回退目标');
  assert.ok(picked.target.owner === main, `回退目标必须仍是交战国 ${main}，实得 ${picked.target.owner}`);
  assert.ok(!(picked.target.city && picked.target.city.cap === main), '被摘首都后不得再指回其首都');
  assert.ok(picked.target.city || picked.target.terrain !== 'sea', '回退目标必须是城市或陆地交战格');
});

/* ---------- 6. 战区名串联（D7） ---------- */
t('S1-6 返回战区名且沿用前线命名语言（非「未命名战区」）', () => {
  const w = loadScenario('ww2', 42);
  const picked = pickOffensiveTarget(w, 'offensive');
  assert.ok(typeof picked.theater === 'string' && picked.theater.length >= 2, '必须带战区名');
  assert.notEqual(picked.theater, '未命名战区', '有前线时不得返回占位名');
});

/* ---------- 7. 基准点 = 玩家视角（C44 根因条款） ---------- */
t('S1-7 基准点必须落在玩家前线/首都附近，禁止地图包围盒角落', () => {
  const w = loadScenario('ww2', 42);
  const picked = pickOffensiveTarget(w, 'offensive');
  const { base } = picked;
  const frontier = w.hexes.filter(h => h.owner === w.player &&
    h.adj.some(ni => w.nations[w.player].atWarWith.includes(w.hexes[ni].owner)));
  assert.ok(frontier.length > 0, '应有前线格');
  // 基准点到前线格集的最小距离必须 ≤ 3（质心在战线附近）
  const minD = Math.min(...frontier.map(h => Math.hypot(h.q - base.q, h.r - base.r)));
  assert.ok(minD <= 3, `基准点离前线过远 (min ${minD.toFixed(1)} 格)，疑似又用了地图角落`);
  // 反证：与地图末格（旧 bug 基准）保持明显不同
  const last = w.hexes[w.hexes.length - 1];
  const dLast = Math.hypot(last.q - base.q, last.r - base.r);
  assert.ok(dLast > minD, '基准点不得偏向地图右下角（旧 D2 根因）');
});

/* ---------- 8. 双调用点语义一致（spearhead 主敌首都 ⊆ offensive 候选） ---------- */
t('S1-8 两处调用点共用后语义一致：offensive 目标属于交战国城市集', () => {
  const w = loadScenario('ww2', 42);
  const off = pickOffensiveTarget(w, 'offensive');
  const sp = pickOffensiveTarget(w, 'spearhead');
  const cities = w.hexes.filter(h => h.city && w.nations[w.player].atWarWith.includes(h.owner));
  assert.ok(cities.includes(off.target), 'offensive 必须选交战国城市');
  assert.ok(sp.target.city, 'spearhead 必须落在城市上');
});

console.log(`\n${passed} passed, ${failed} failed`);
if(failed) process.exit(1);
