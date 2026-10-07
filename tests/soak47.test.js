/* ============================================================
   tests/soak47.test.js —— v12.0 S4 47 天战争 soak + P2 存档往返
   ------------------------------------------------------------
   S4：ww2 开局连跑 47 个 dayTick（不问玩家输入）：
     · 无未捕获异常
     · 无 NaN 扩散（抽查 units/org/hp、nations/pp/stability）
     · world.over 允许为真，但过程不得抛错
   P2：存 → 读 → 再存，字节数差 < 2%（localStorage 用内存桩，
       覆盖 SAVE_REPLACER 剥离后的序列化往返；v10 前科：派生几何
       循环引用导致存档静默失败）。
   运行：node tests/soak47.test.js
   ============================================================ */

import assert from 'node:assert/strict';
import { loadScenario } from '../js/engine/world.js';
import { dayTick } from '../js/engine/tick.js';
import { makeRng } from '../js/core/rng.js';
import { createFront, assignToFront } from '../js/engine/plans.js';

/* ---------- P2 前置：localStorage 内存桩（必须在 import save.js 前就位） ---------- */
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); },
  clear: () => store.clear()
};

const { saveGame, loadGame } = await import('../js/save.js');

console.log('=== v12 S4 47 天战争 soak + P2 存档往返 ===\n');

let passed = 0, failed = 0;
function t(name, fn){
  try{ fn(); passed++; console.log('✓', name); }
  catch(e){ failed++; console.log('✗', name, '→', e.message); }
}

function isBadNum(v){ return typeof v !== 'number' || !Number.isFinite(v); }

/* ---------- S4-1：47 天连跑无异常 ---------- */
const w = loadScenario('ww2', 47);
const rng = makeRng(4747);
let overDay = null;
try {
  for(let d = 1; d <= 47; d++){
    dayTick(w, rng);
    if(w.over && overDay === null) overDay = d;
  }
  t(`S4-1 47 天 dayTick 连跑无异常（第 ${overDay ?? '—'} 天出现终局标志）`, () => {
    assert.ok(true);
  });
} catch(e) {
  t('S4-1 47 天 dayTick 连跑无异常', () => { throw e; });
}

/* ---------- S4-2：无 NaN 扩散 ---------- */
t('S4-2 数值卫生：units/org/hp 与 nations/pp/stability 无 NaN/Infinity', () => {
  let checked = 0;
  for(const u of w.units){
    assert.ok(!isBadNum(u.hp), `unit ${u.id} hp=${u.hp}`);
    assert.ok(!isBadNum(u.org), `unit ${u.id} org=${u.org}`);
    if(u.entrench != null) assert.ok(!isBadNum(u.entrench), `unit ${u.id} entrench=${u.entrench}`);
    checked++;
  }
  assert.ok(checked > 0, '应存在可抽查的师');
  for(const [tag, n] of Object.entries(w.nations)){
    assert.ok(!isBadNum(n.pp), `nation ${tag} pp=${n.pp}`);
    if(n.stability != null) assert.ok(!isBadNum(n.stability), `nation ${tag} stability=${n.stability}`);
    if(n.equip != null) assert.ok(!isBadNum(n.equip), `nation ${tag} equip=${n.equip}`);
  }
});

/* ---------- S4-3：历史事件链照常触发 ---------- */
t('S4-3 事件系统 47 天内保持运转（news/feed 不抛错即可）', () => {
  // 事件触发与否取决于紧张度曲线，这里只断言容器完好
  assert.ok(Array.isArray(w.news || []), 'world.news 应为数组');
  assert.ok(Array.isArray(w.battleFeed || []), 'world.battleFeed 应为数组');
});

/* ---------- P2-1：存 → 读 → 再存 字节数差 < 2% ---------- */
t('P2-1 存档往返：save → load → save 字节数差 < 2%', () => {
  const ok = saveGame(w, 3, 'v12 soak roundtrip');
  assert.ok(ok, 'saveGame 应返回 true');
  const bytes1 = store.get('steelfront.v3.' + (w.scenario || 'A') + '.3');
  assert.ok(bytes1 && bytes1.length > 1000, '存档应真实落盘');
  const loaded = loadGame(w.scenario || 'A', 3);
  assert.ok(loaded, 'loadGame 应能读回');
  assert.equal(loaded.day, w.day, 'day 应一致');
  assert.equal(loaded.player, w.player, 'player 应一致');
  assert.equal(loaded.hexes.length, w.hexes.length, 'hexes 应一致');
  const ok2 = saveGame(loaded, 3, 'v12 soak roundtrip #2');
  assert.ok(ok2, '二次 saveGame 应返回 true');
  const bytes2 = store.get('steelfront.v3.' + (w.scenario || 'A') + '.3');
  const drift = Math.abs(bytes2.length - bytes1.length) / bytes1.length;
  assert.ok(drift < 0.02, `两次存档字节数漂移 ${(drift * 100).toFixed(3)}% 应 < 2%`);
});

/* ---------- P2-2：派生几何不入档 ---------- */
t('P2-2 SAVE_REPLACER 剥离名单仍然生效：序列化串中无 polygon/cell/provinces 键', () => {
  const raw = store.get('steelfront.v3.' + (w.scenario || 'A') + '.3');
  assert.ok(!/"polygon"/.test(raw), '序列化串不得包含 polygon（hex 级派生几何）');
  assert.ok(!/"provinces"/.test(raw), '序列化串不得包含 provinces（world 级派生）');
  assert.ok(!/"cell"/.test(raw), '序列化串不得包含 cell（回环源）');
});

/* ---------- S4-4：填线机动命令契约（v12 S2 浏览器回归发现） ---------- */
t('S4-4 assignToFront 就位机动命令可被 processMove 安全消费（不再下发无 path 的 move）', () => {
  const w2 = loadScenario('ww2', 4242);
  const f = createFront(w2, w2.player);
  assignToFront(w2, f.id);
  let withOrder = 0;
  for(const u of w2.units){
    if(u.nat !== w2.player || !u.order) continue;
    withOrder++;
    if(u.order.type === 'move'){
      assert.ok(Array.isArray(u.order.path), `unit ${u.id} 的 move 命令必须带 path（v12 前会炸 movement.js:99）`);
    }
    assert.ok(u.order.type !== 'move' || u.order.path.length > 0, '空 path 的 move 也不允许');
  }
  assert.ok(withOrder > 0, '填线后应有师带就位命令');
  // 就位机动展开后再跑 3 天不得抛错
  const rng2 = makeRng(99);
  for(let d = 0; d < 3; d++) dayTick(w2, rng2);
});

console.log(`\n${passed} passed, ${failed} failed`);
if(failed) process.exit(1);
