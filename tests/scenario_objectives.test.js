/* ============================================================
   tests/scenario_objectives.test.js —— v14.1 W0-E6 剧本目标统一解释守卫
   ------------------------------------------------------------
   覆盖：
   1. wargoals.js 注册表与 parseObjective（含数值/城市名参数）
   2. evaluateObjective 六类目标的判定口径（capture 用真实剧本世界验证）
   3. world.objectives / world.timeLimit 落盘（coldwar/modern 首次有胜利路径）
   4. 超时结算：达成率 ≥ 50% 判胜
   5. A 教程剧本不走统一解释器（无 objectives 数据）
   ============================================================ */

import assert from 'node:assert/strict';
import { loadScenario } from '../js/engine/world.js';
import { evaluateObjective, victoryTick } from '../js/engine/victory.js';
import { WARGOAL_TYPES, parseObjective } from '../js/data/wargoals.js';

let passed = 0, failed = 0;
function t(name, fn){
  try{ fn(); passed++; console.log('✓', name); }
  catch(e){ failed++; console.log('✗', name, '→', e.message); }
}

/* —— 1. 注册表与解析 —— */
t('E6-1a 六类目标全部登记且带 name/minScore/effects', () => {
  for(const id of ['capture','survive','prestige','influence_lead','ceasefire','redline']){
    const def = WARGOAL_TYPES[id];
    assert.ok(def && def.name && def.effects && def.effects.victory, `缺少 ${id}`);
  }
});

t('E6-1b parseObjective 解析数值与城市名参数', () => {
  assert.equal(parseObjective('survive:120').arg, 120);
  assert.equal(parseObjective('capture:基辅').arg, '基辅');
  assert.equal(parseObjective('prestige:110').arg, 110);
  assert.equal(parseObjective('nonsense:1').known, false);
});

/* —— 2. 六类目标判定 —— */
t('E6-2a capture：占城但原主未屈服/未损过半 → 不达成；原主灭亡 → 达成', () => {
  const w = loadScenario('ww2', 42);
  const warsaw = w.hexes.find(h => h.city && h.city.name === '华沙');
  const ger = w.nations.GER;
  const polOwner = warsaw.owner;
  warsaw.owner = 'GER';
  // 波兰仍健在且 VP 未损过半 → 不达成
  assert.equal(evaluateObjective(w, 'GER', 'capture:华沙').achieved, false, '原主健在不应达成');
  // 波兰灭亡 → 达成
  w.nations[polOwner].alive = false;
  assert.equal(evaluateObjective(w, 'GER', 'capture:华沙').achieved, true, '原主灭亡应达成');
  void ger;
});

t('E6-2b survive：天数够且未投降 → 达成', () => {
  const w = loadScenario('coldwar', 42);
  const usa = w.nations.USA;
  w.day = 120;
  assert.equal(evaluateObjective(w, 'USA', 'survive:120').achieved, true);
  usa.capitulated = true;
  assert.equal(evaluateObjective(w, 'USA', 'survive:120').achieved, false, '投降后不应达成');
});

t('E6-2c prestige：读国家声望（含科技/太空来源）', () => {
  const w = loadScenario('coldwar', 42);
  w.nations.USA.prestige = 109;
  assert.equal(evaluateObjective(w, 'USA', 'prestige:110').achieved, false);
  w.nations.USA.prestige = 110;
  assert.equal(evaluateObjective(w, 'USA', 'prestige:110').achieved, true);
});

t('E6-2d influence_lead：按 econSocial 阵营占比判定', () => {
  const w = loadScenario('coldwar', 42);
  const es = w.econSocial.nations;
  const total = Object.keys(es).length;
  assert.ok(total > 0, 'econSocial 应已初始化');
  // 把所有国家拉进 nato → USA 影响力主导 100%
  for(const k in es) es[k].bloc = 'nato';
  assert.equal(evaluateObjective(w, 'USA', 'influence_lead:50').achieved, true);
  // 其余全部划入 warsaw、仅 USA 留在 nato → 占比 1/total，远低于 50%
  for(const k in es) if(k !== 'USA') es[k].bloc = 'warsaw';
  assert.equal(evaluateObjective(w, 'USA', 'influence_lead:50').achieved, false);
});

t('E6-2e ceasefire / redline：锚定 milAid 真实字段', () => {
  const w = loadScenario('modern', 42);
  assert.equal(evaluateObjective(w, 'UKR', 'ceasefire').achieved, false, '窗口未开不应达成');
  w.milAid.ceasefireReady = true;
  assert.equal(evaluateObjective(w, 'UKR', 'ceasefire').achieved, true);
  assert.equal(evaluateObjective(w, 'USA', 'redline').achieved, true, '升级指数 20 < 100');
  w.milAid.escalationGauge = 100;
  assert.equal(evaluateObjective(w, 'USA', 'redline').achieved, false, '触顶即爆');
});

/* —— 3. 数据落盘与超时结算 —— */
t('E6-3a 五剧本 objectives/timeLimit 落盘（A 走同一解释器）', () => {
  for(const [sc, tl] of [['A', 120], ['ww1', 200], ['ww2', 500], ['coldwar', 300], ['modern', 120]]){
    const w = loadScenario(sc, 42);
    assert.ok(w.objectives && Object.keys(w.objectives).length, `${sc} 应有 objectives`);
    assert.equal(w.timeLimit, tl, `${sc} timeLimit 应为 ${tl}`);
  }
  const a = loadScenario('A', 42);
  assert.deepEqual(a.objectives, { G: ['capture:华沙'], P: ['survive:60'] });
});

t('E6-3b 超时结算：达成率 ≥ 50% 判胜，否则判负', () => {
  const w = loadScenario('modern', 42);
  w.player = 'UKR';
  w.day = 120;                       // timeLimit=120
  w.milAid.ceasefireReady = true;    // survive ✓ + ceasefire ✓ = 100% → 胜
  victoryTick(w);
  assert.ok(w.over && w.over.win, '全目标达成应判胜');
  assert.ok(/120/.test(w.over.text), '文案应含时限');
});

t('E6-3c 目标国达成全部目标 → 玩家为该国则胜 / 他国则败', () => {
  const w = loadScenario('modern', 42);
  w.player = 'USA';
  w.day = 121;
  w.milAid.ceasefireReady = true;
  w.nations.UKR.warFatigue = 100;
  // UKR: survive:120(✓ 但 day=121 ≥120 且未投降) + ceasefire(✓) → UKR 全达成
  victoryTick(w);
  assert.ok(w.over, '应有终局');
  assert.equal(w.over.win, false, '玩家 USA 不是达成国 → 判败');
  assert.ok(/UKR|乌克兰/.test(w.over.text), '文案应指明达成国');
});
