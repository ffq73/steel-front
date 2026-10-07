/* ============================================================
   tests/stats.test.js —— 战损统计、历史时序与大账本测试 (v9.0 §4-N6) [H]
   覆盖：
   1. 统计体系初始化与结构完整性
   2. 真实战斗战损结算（人员伤亡与各型装备损失）
   3. 歼灭部队战损额外重创计算
   4. 每日时序数据采样（工厂/师数/伤亡）与上限365天控制
   5. Ledger 全球各国大账本字段提取与对齐
   6. Ledger 阵营过滤与多字段升降序排序
   ============================================================ */

import assert from 'node:assert/strict';
import { makeWorld } from '../js/engine/world.js';
import { dayTick } from '../js/engine/tick.js';
import {
  initStats,
  recordBattleStats,
  statsTick,
  getLedgerData,
  sortAndFilterLedger
} from '../js/engine/stats.js';

let passed = 0, failed = 0;
function test(name, fn){
  try{
    fn();
    passed++;
    console.log(`✓ ${name}`);
  }catch(e){
    failed++;
    console.error(`✗ ${name} → ${e.message}`);
  }
}

console.log('=== [N6] 战损统计、历史时序与大账本测试套件 ===');

// 1. 初始化与数据结构
test('统计数据结构初始化完整性', () => {
  const world = makeWorld('A', 201);
  assert.ok(world.stats, '缺少 world.stats');
  assert.ok(world.stats.casualties, '缺少 casualties');
  assert.ok(world.stats.losses, '缺少 losses');
  assert.ok(Array.isArray(world.stats.history), 'history 应为数组');
  assert.ok(Array.isArray(world.stats.battleLog), 'battleLog 应为数组');
  assert.equal(world.stats.casualties.G, 0, '开局伤亡应为 0');
});

// 2. 战损与装备折损结算
test('战役报告战损与装备折损结算', () => {
  const world = makeWorld('A', 202);
  const rep = {
    hexIdx: 10,
    rounds: [
      { hpDmg: 5.0, orgDmg: 20.0, hits: 15 }
    ],
    destroyed: [],
    retreat: []
  };

  recordBattleStats(world, rep, 'G', 'P', world.hexes[10]);

  assert.ok(world.stats.casualties.P > 0, '守方伤亡应当大于0');
  assert.ok(world.stats.casualties.G > 0, '攻方反击伤亡应当大于0');
  assert.ok(world.stats.losses.P.inf_eq > 0, '守方步枪折损应当大于0');
  assert.ok(world.stats.losses.G.inf_eq > 0, '攻方步枪折损应当大于0');
  assert.equal(world.stats.battleLog.length, 1, '应记录1条战役日志');
  assert.equal(world.stats.battleLog[0].atkNat, 'G');
  assert.equal(world.stats.battleLog[0].defNat, 'P');
});

// 3. 部队全歼额外算入损失
test('部队全歼额外重创与装备清算', () => {
  const world = makeWorld('A', 203);
  const rep = {
    hexIdx: 12,
    rounds: [{ hpDmg: 2.0, orgDmg: 10.0, hits: 8 }],
    destroyed: [{ id: 999, type: 'inf', nat: 'P' }],
    retreat: []
  };

  const beforeCas = world.stats.casualties.P || 0;
  recordBattleStats(world, rep, 'G', 'P', world.hexes[12]);
  const afterCas = world.stats.casualties.P;

  assert.ok(afterCas - beforeCas >= 1200, '整师全歼应额外累加至少1200人伤亡');
  assert.ok(world.stats.losses.P.inf_eq >= 300, '整师覆灭应折损装备');
});

// 4. 时序历史采样与365天上限
test('时序历史采样与上限维护', () => {
  const world = makeWorld('A', 204);
  assert.equal(world.stats.history.length, 0);

  statsTick(world);
  assert.equal(world.stats.history.length, 1);
  assert.ok(world.stats.history[0].nations.G);
  assert.ok(world.stats.history[0].nations.G.factories > 0);

  // 模拟填充超限
  for(let i = 0; i < 400; i++){
    world.day++;
    statsTick(world);
  }
  assert.equal(world.stats.history.length, 365, '时序记录不得超过 365 天');
});

// 5. Ledger 大账本数据聚合
test('Ledger 大账本聚合数据精确对齐', () => {
  const world = makeWorld('A', 205);
  const ledger = getLedgerData(world);
  assert.ok(ledger.length >= 3, '大账本至少包含主要交战国');

  const ger = ledger.find(item => item.id === 'G' || item.id === 'GER');
  assert.ok(ger, '账本中应包含德国');
  assert.ok(ger.divs >= 20, '德国在编陆军师应大于20');
  assert.ok(ger.totalFactories >= 10, '总工厂数应大于10');
  assert.ok(ger.industrialScore > 0, '工业得分应大于0');
  assert.ok(ger.faction.includes('轴心'), '阵营归属应为轴心');
});

// 6. Ledger 排序与过滤
test('Ledger 阵营过滤与多字段排序', () => {
  const world = makeWorld('A', 206);
  const ledger = getLedgerData(world);

  // 按总工厂数降序排序
  const sorted = sortAndFilterLedger(ledger, 'all', 'totalFactories', false);
  for(let i = 0; i < sorted.length - 1; i++){
    assert.ok(sorted[i].totalFactories >= sorted[i+1].totalFactories, '总工厂数应单调不增');
  }

  // 阵营过滤：轴心
  const axisList = sortAndFilterLedger(ledger, 'axis', 'divs', false);
  assert.ok(axisList.every(item => item.faction.includes('轴心')), '全部应为轴心国');
});

if(failed > 0){
  console.error(`\nFAILED: ${failed} tests failed.`);
  process.exit(1);
} else {
  console.log(`\nPASSED: All ${passed} tests passed.`);
}
