/* ============================================================
   tests/trade_subject.test.js —— 贸易与附庸国体系测试 (v9.0 §4-N5 / 附录 B.6) [H]
   覆盖：
   1. 1 民工 ⇄ 8 资源采购准则与运输船占用
   2. 贸易影响力模型 (基础150 + 宗主400 + 距离衰减，交战为0)
   3. 贸易法案4档与 150 PP 切换
   4. 附庸国自治度五级梯队 (0-1000)
   5. 整合傀儡工厂抽成：25% 民工 + 75% 军工上缴宗主 [H]
   6. 附庸压制指令 (0.5 PP/天，自治度 -0.5/天)
   7. 兼并吞并傀儡 (300 PP，领土部队全接收)
   ============================================================ */

import assert from 'node:assert/strict';
import { makeWorld } from '../js/engine/world.js';
import { TRADE_LAWS, AUTONOMY_TIERS } from '../js/data/resources.js';
import {
  initSubjects,
  calcTradeInfluence,
  getExportableResources,
  createTradeRoute,
  cancelTradeRoute,
  changeTradeLaw,
  getAutonomyTier,
  changeAutonomyLevel,
  annexSubject,
  subjectsTick
} from '../js/engine/subjects.js';

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

console.log('=== [N5] 国际贸易与附庸自治体系测试套件 ===');

// 1. 贸易法案与 150 PP 切换
test('贸易法案4档与 150 PP 切换校验', () => {
  const world = makeWorld('A', 301);
  const player = world.player;
  const n = world.nations[player];

  assert.ok(TRADE_LAWS.free_trade);
  assert.ok(TRADE_LAWS.export_focus);
  assert.ok(TRADE_LAWS.limited_exports);
  assert.ok(TRADE_LAWS.closed_economy);

  n.pp = 100; // 不足 150
  const failRes = changeTradeLaw(world, player, 'free_trade');
  assert.equal(failRes.ok, false);
  assert.ok(failRes.reason.includes('不足'));

  n.pp = 200; // 足够
  const okRes = changeTradeLaw(world, player, 'free_trade');
  assert.equal(okRes.ok, true);
  assert.equal(n.tradeLaw, 'free_trade');
  assert.equal(n.pp, 50, 'PP 应扣减 150');
  assert.equal(n.modifiers.prodSpeed, 0.15, '应享有工厂产出 +15%');
});

// 2. 贸易影响力模型与交战封锁
test('贸易影响力计算与战时封锁', () => {
  const world = makeWorld('A', 302);
  const player = world.player;

  // 与交战国（波兰）贸易影响力应当为 0
  const warInf = calcTradeInfluence(world, player, 'P');
  assert.equal(warInf, 0, '交战国之间影响力必须归零封锁');

  // 与非交战国（苏联）影响力 > 0
  const peaceInf = calcTradeInfluence(world, player, 'S');
  assert.ok(peaceInf > 100, `和平国之间应有贸易影响力: ${peaceInf}`);
});

// 3. 1 民工 ⇄ 8 资源贸易开辟与撤销
test('1 民工 ⇄ 8 资源贸易路线开辟与撤销', () => {
  const world = makeWorld('A', 303);
  const player = world.player;
  const n = world.nations[player];
  const seller = world.nations['S']; // 苏联拥有丰富石油

  n.civ = 10;
  n.rentedCivOut = 0;
  n.convoys = 50;
  n.convoysUsed = 0;
  seller.tradeLaw = 'free_trade'; // 80% 市场配额: 10 * 0.8 = 8 单位 [H]

  // 租借 1 民工采购 8 单位石油
  const res = createTradeRoute(world, player, 'S', 'oil', 1);
  assert.equal(res.ok, true, `开辟失败: ${res.reason}`);
  assert.equal(res.route.amount, 8, '1 民工应换取 8 单位资源');
  assert.equal(n.rentedCivOut, 1, '买方租出民工应为 1');
  assert.equal(seller.rentedCivIn, 1, '卖方租入民工应为 1');

  // 撤销该航线
  const cancelRes = cancelTradeRoute(world, res.route.id);
  assert.equal(cancelRes.ok, true);
  assert.equal(n.rentedCivOut, 0, '撤销后租出民工应归还');
  assert.equal(seller.rentedCivIn, 0, '撤销后卖方租入民工应扣除');
});

// 4. 自治度五级梯队对应
test('自治度分值 0-1000 梯队对应', () => {
  assert.equal(getAutonomyTier(1000).id, 'independent');
  assert.equal(getAutonomyTier(850).id, 'dominion');
  assert.equal(getAutonomyTier(600).id, 'colony');
  assert.equal(getAutonomyTier(350).id, 'puppet');
  assert.equal(getAutonomyTier(50).id, 'integrated_puppet');
});

// 5. 整合傀儡工厂抽成：25% 民工 + 75% 军工
test('整合傀儡工厂抽成 (25% 民工 + 75% 军工)', () => {
  const world = makeWorld('A', 304);
  const player = world.player;
  const overlord = world.nations[player];

  // 制造一个整合傀儡国
  const sub = {
    id: 'SLO',
    name: '斯洛伐克',
    alive: true,
    overlord: player,
    civ: 8,
    mil: 12,
    autonomy: 50 // < 200，属于 integrated_puppet
  };
  world.nations['SLO'] = sub;
  overlord.subjects = ['SLO'];

  // W0-B2（2026-10）：原断言读的是 overlord.tributeCiv / tributeMil —— 那个累加器
  // 从来没有任何代码把它并进 overlord.civ / overlord.mil，只有 panelTrade.js 会去显示它。
  // 也就是说「整合傀儡上缴 25% 民厂 + 75% 军厂」这条收益只存在于面板上。
  // 现在抽成即时入账，故断言改为检查**真实经济效果**（比原断言更强）。
  const civBefore = overlord.civ || 0;
  const milBefore = overlord.mil || 0;
  subjectsTick(world);

  // 25% of 8 = 2 civ; 75% of 12 = 9 mil
  assert.equal(overlord.civ - civBefore, 2, '上缴 25% 民工 = 2，且必须真的进宗主工厂数');
  assert.equal(overlord.mil - milBefore, 9, '上缴 75% 军工厂 = 9，且必须真的进宗主工厂数');
  assert.equal(overlord.tributeCiv, 0, '抽成应即时入账并清零累加器，不得滞留');
  assert.equal(overlord.tributeMil, 0, '抽成应即时入账并清零累加器，不得滞留');
});

// 6. 压制附庸指令 (0.5 PP/天，自治度 -0.5/天)
test('压制附庸指令被动削减自治度', () => {
  const world = makeWorld('A', 305);
  const player = world.player;
  const overlord = world.nations[player];

  const sub = {
    id: 'TEST_SUB',
    alive: true,
    overlord: player,
    autonomy: 300,
    subjectDirective: 'suppress'
  };
  world.nations['TEST_SUB'] = sub;
  overlord.pp = 10;

  subjectsTick(world);

  assert.equal(overlord.pp, 9.5, '宗主应消耗 0.5 PP');
  assert.equal(sub.autonomy, 299.5, '自治度应降低 0.5 点');
});

// 7. 300 PP 和平吞并整合傀儡
test('和平兼并吞并整合傀儡 (消耗 300 PP 并接收领土部队)', () => {
  const world = makeWorld('A', 306);
  const player = world.player;
  const overlord = world.nations[player];

  const sub = {
    id: 'SUB_ANNEX',
    alive: true,
    overlord: player,
    autonomy: 40 // 低于 100
  };
  world.nations['SUB_ANNEX'] = sub;
  overlord.subjects = ['SUB_ANNEX'];
  overlord.pp = 400;

  // 在地图上放置一个附庸地块和一个部队
  world.hexes[50].owner = 'SUB_ANNEX';
  const unit = { id: 888, nat: 'SUB_ANNEX', hp: 100 };
  world.units.push(unit);

  const res = annexSubject(world, player, 'SUB_ANNEX');
  assert.equal(res.ok, true, `吞并失败: ${res.reason}`);
  assert.equal(overlord.pp, 100, '应扣除 300 PP');
  assert.equal(world.hexes[50].owner, player, '领土所有权应转移至宗主');
  assert.equal(unit.nat, player, '部队阵营应收编为宗主');
  assert.equal(sub.alive, false, '附庸政权应当闭幕');
});

if(failed > 0){
  console.error(`\nFAILED: ${failed} tests failed.`);
  process.exit(1);
} else {
  console.log(`\nPASSED: All ${passed} tests passed.`);
}
