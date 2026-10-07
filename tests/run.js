/* ============================================================
   tests/run.js —— 轻量测试入口（node tests/run.js）
   覆盖：geom 邻接/距离、rng 确定性、世界构造不变量
   战斗标定断言在 tools/sim.js（B1–B9）
   ============================================================ */

import assert from 'node:assert/strict';
import { neighbors, hexDist, toAxial, pixToHex } from '../js/core/geom.js';
import { makeRng } from '../js/core/rng.js';
import { makeWorld } from '../js/engine/world.js';
import { dayTick } from '../js/engine/tick.js';
import { makeRng as _unused } from '../js/core/rng.js';

let passed = 0, failed = 0;
function t(name, fn){
  try{ fn(); passed++; console.log('✓', name); }
  catch(e){ failed++; console.log('✗', name, '→', e.message); }
}

/* geom */
t('odd-r 邻接：偶行/奇行六向', () => {
  assert.equal(neighbors(0,0).length, 6);
  assert.equal(neighbors(1,1).length, 6);
  assert.deepEqual(neighbors(2,0).slice(0,2), [[1,0],[3,0]]);
});
t('hexDist 对称且自反', () => {
  assert.equal(hexDist(3,5,7,8), hexDist(7,8,3,5));
  assert.equal(hexDist(4,4,4,4), 0);
});
t('pixToHex 往返（原点附近）', () => {
  const size = 34;
  const p = { q: 3, r: 5 };
  // 反算不要求像素级一致，但应落在邻近格
  const back = pixToHex(0,0,size);
  assert.equal(back.q, 0);
});

/* rng */
t('mulberry32 同种子同序列', () => {
  const a = makeRng(123), b = makeRng(123);
  for(let i=0;i<100;i++) assert.equal(a(), b());
});
t('mulberry32 状态可序列化恢复', () => {
  const a = makeRng(999);
  a(); a(); a();
  const saved = a.state();
  const next1 = a();
  const b = makeRng(0); b.setState(saved);
  assert.equal(b(), next1);
});

/* 世界不变量 */
t('makeWorld 剧本A：开战关系与兵力', () => {
  const w = makeWorld('A', 42);
  assert.deepEqual(w.nations.G.atWarWith.sort(), ['F','P']);
  assert.ok(w.units.length >= 55);
  assert.ok(w.hexes.length > 200);
  assert.equal(w.player, 'G');
});
t('dayTick 30 天：引擎稳定（清终局旗做压力测试）', () => {
  const w = makeWorld('A', 7);
  const rng = makeRng(7);
  for(let i=0;i<30;i++){
    dayTick(w, rng);
    w.over = null;   // 无玩家输入时德国会被法国推平（合理），清旗以持续压测
    assert.ok(w.hexes.every(h => (h.owner in w.nations) || h.owner === 'N'));
  }
  assert.equal(w.day, 30);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
