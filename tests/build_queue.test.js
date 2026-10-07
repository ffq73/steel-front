/* ============================================================
   tests/build_queue.test.js —— v14.1 W0-B5 建造队列的行为守卫
   ------------------------------------------------------------
   覆盖四件事：
   1. 解除「军工只能建在首都」：无 h.city 的己方格可开工（旧 BUILD intent 要求 h.city）
   2. 队列 FIFO：当前槽占用时新项目入队，完工后由 economyTick 取出
   3. 厂槽约束：FACTORY_SLOTS_PER_HEX=3（v14.1 由 4 收紧），军民工厂占槽，
      基建/空海军基地不占槽；决议 buildSlots 真实扩容（regional_industry /
      emergency_industry 的 instant.buildSlot 此前写入 h.buildSlots 但 0 读取点）
   4. 队列上限 BUILD_QUEUE_MAX

   注：economyTick 的完工结算（五类建筑分支）由 tools/sim.js B16 覆盖。
   ============================================================ */

import assert from 'node:assert/strict';
import { loadScenario } from '../js/engine/world.js';
import { createStore } from '../js/core/store.js';
import { economyTick } from '../js/engine/economy.js';
import { K } from '../js/data/constants.js';

let passed = 0, failed = 0;
function t(name, fn){
  try{ fn(); passed++; console.log('✓', name); }
  catch(e){ failed++; console.log('✗', name, '→', e.message); }
}

function freshPlayerState(w){
  const n = w.nations[w.player];
  n.build = { q:-1, r:-1, prog:0, need:0, kind:null };
  n.buildQueue = [];
  return n;
}

function ownedHex(w, pred){
  return w.hexes.find(h => h.owner === w.player && h.terrain !== 'sea' && pred(h));
}

/* —— 沙盒：剧本 A + 真实 store —— */
function makeSandbox(){
  const w = loadScenario('A', 42);
  const n = freshPlayerState(w);
  const store = createStore(w);
  return { w, n, store };
}

const BUILD = (q, r, kind) => ({ type:'BUILD', q, r, kind });

/* 1. 解除首都限制 */
t('B5-1 无城市的己方格可开工军工厂（旧实现要求 h.city）', () => {
  const { w, store } = makeSandbox();
  const h = ownedHex(w, x => !x.city);
  assert.ok(h, '剧本 A 应存在非城市的己方格');
  store.dispatch(BUILD(h.q, h.r, 'mil'));
  assert.equal(w.nations[w.player].build.kind, 'mil');
  assert.equal(w.nations[w.player].build.q, h.q);
});

/* 2. 队列 FIFO：槽被占则入队 */
t('B5-2 当前槽占用时新项目进入 buildQueue', () => {
  const { w, store } = makeSandbox();
  const h1 = ownedHex(w, x => !x.city);
  store.dispatch(BUILD(h1.q, h1.r, 'mil'));
  const h2 = ownedHex(w, x => !x.city && !(x.q === h1.q && x.r === h1.r));
  assert.ok(h2, '应存在第二个非城市己方格');
  store.dispatch(BUILD(h2.q, h2.r, 'civ'));
  const n = w.nations[w.player];
  assert.equal(n.build.kind, 'mil');
  assert.equal(n.buildQueue.length, 1);
  assert.equal(n.buildQueue[0].kind, 'civ');
  assert.equal(n.buildQueue[0].q, h2.q);
});

/* 3. 厂槽：3 槽上限 + buildSlots 扩容 + 基建不占槽 */
t('B5-3a 军民工厂受 3 槽约束（civ+mil 满 3 后拒绝）', () => {
  const { w, store, n } = makeSandbox();
  const h = ownedHex(w, () => true);
  h.civ = 3; h.mil = 0;
  store.dispatch(BUILD(h.q, h.r, 'mil'));
  assert.equal(n.build.kind, null, '槽满时应拒绝开工');
  assert.equal((n.buildQueue || []).length, 0, '槽满时也不得入队');
});

t('B5-3b 决议 buildSlots 真实扩容（+1 槽后第 4 座可建）', () => {
  const { w, store, n } = makeSandbox();
  const h = ownedHex(w, () => true);
  h.civ = 3; h.mil = 0;
  h.buildSlots = 1;   // regional_industry / emergency_industry 的 instant.buildSlot 效果
  store.dispatch(BUILD(h.q, h.r, 'mil'));
  assert.equal(n.build.kind, 'mil');
});

t('B5-3c 基建不占厂槽（civ+mil 满 3 仍可修 infra）', () => {
  const { w, store, n } = makeSandbox();
  const h = ownedHex(w, () => true);
  h.civ = 3; h.mil = 0; h.infra = 0;
  store.dispatch(BUILD(h.q, h.r, 'infra'));
  assert.equal(n.build.kind, 'infra');
});

t('B5-3d FACTORY_SLOTS_PER_HEX 常量为 3（v14.1 由 4 收紧）', () => {
  assert.equal(K.FACTORY_SLOTS_PER_HEX, 3);
});

/* 4. 队列上限 */
t('B5-4 队列长度受 BUILD_QUEUE_MAX 约束', () => {
  const { w, store, n } = makeSandbox();
  const h1 = ownedHex(w, () => true);
  store.dispatch(BUILD(h1.q, h1.r, 'mil'));
  for(let i = 0; i < K.BUILD_QUEUE_MAX + 3; i++){
    store.dispatch(BUILD(h1.q, h1.r, 'infra'));
  }
  assert.equal(n.buildQueue.length, K.BUILD_QUEUE_MAX);
});

/* 5. 完工后 economyTick 从队列取下一项（取出发生在下一 tick 开头） */
t('B5-5 当前项目完工后队列头自动接续', () => {
  const { w, n } = makeSandbox();
  const h = w.hexes.find(x => x.owner === w.player && x.terrain !== 'sea');
  n.build = { q:h.q, r:h.r, prog:K.BUILD_COST.mil - 1, need:K.BUILD_COST.mil, kind:'mil' };
  n.buildQueue = [{ q:h.q, r:h.r, prog:0, need:K.BUILD_COST.infra, kind:'infra' }];
  economyTick(w);   // tick1：军工厂完工，n.build 清空
  assert.equal(h.mil, 1, '军工厂应完工');
  assert.equal(n.build.kind, null, '完工当刻槽位先清空');
  economyTick(w);   // tick2：队列头取出接续
  assert.equal(n.build.kind, 'infra', '队列头应接续为当前施工项');
  assert.equal(n.buildQueue.length, 0);
});

/* —— 汇总 —— */
console.log(`\n${passed} 通过, ${failed} 失败`);
process.exit(failed ? 1 : 0);
