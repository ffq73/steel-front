/* ============================================================
   tests/doctrine.test.js —— 军种学说系统与经验树单元测试 (v9.0 §4-N4 / 附录 B.5) [H]
   覆盖：
   1. 陆海空独立学说树结构与同军种互斥锁定
   2. 100 XP 购买制与经验不足拒绝校验
   3. 前置节点依赖链校验
   4. 经验上限 500 点与战时被动积累
   5. 师经验四档加成阶梯 (0% / +25% / +50% / +75%)
   6. 学说效果挂载至国家 modifiers 体系
   ============================================================ */

import assert from 'node:assert/strict';
import { makeWorld } from '../js/engine/world.js';
import { DOCTRINES_DATA } from '../js/data/doctrines.js';
import {
  initDoctrines,
  unlockDoctrine,
  addNationXP,
  getDivisionExpTier,
  doctrineTick
} from '../js/engine/doctrine.js';

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

console.log('=== [N4] 军种学说与经验树测试套件 ===');

// 1. 初始化与学说树数据完整性
test('学说树数据结构完整性 (陆4/空3/海3)', () => {
  assert.ok(DOCTRINES_DATA.land, '缺少陆军学说');
  assert.ok(DOCTRINES_DATA.air, '缺少空军学说');
  assert.ok(DOCTRINES_DATA.navy, '缺少海军学说');

  // 陆军 4 树
  assert.ok(DOCTRINES_DATA.land.mobile_warfare);
  assert.ok(DOCTRINES_DATA.land.superior_firepower);
  assert.ok(DOCTRINES_DATA.land.grand_battleplan);
  assert.ok(DOCTRINES_DATA.land.mass_assault);

  // 空军 3 树
  assert.ok(DOCTRINES_DATA.air.strategic_destruction);
  assert.ok(DOCTRINES_DATA.air.battlefield_support);
  assert.ok(DOCTRINES_DATA.air.operational_integrity);

  // 海军 3 树
  assert.ok(DOCTRINES_DATA.navy.fleet_in_being);
  assert.ok(DOCTRINES_DATA.navy.trade_interdiction);
  assert.ok(DOCTRINES_DATA.navy.base_strike);
});

// 2. 100 XP 购买制与 XP 扣减
test('学说节点 100 XP 购买制与扣减', () => {
  const world = makeWorld('A', 101);
  const player = world.player;
  const n = world.nations[player];

  // 保证玩家处于机动战初始状态或重设
  n.activeTrees.land = 'mobile_warfare';
  n.doctrines = ['mw_blitzkrieg'];
  n.armyXp = 150;

  // 购买 mw_delay (需 100 XP)
  const res = unlockDoctrine(world, player, 'land', 'mobile_warfare', 'mw_delay');
  assert.equal(res.ok, true, `解锁失败: ${res.reason}`);
  assert.equal(n.armyXp, 50, 'armyXp 应扣减 100 变为 50');
  assert.ok(n.doctrines.includes('mw_delay'), '应已包含 mw_delay');
});

// 3. XP 不足时拒绝
test('经验 XP 不足时严格拒绝', () => {
  const world = makeWorld('A', 102);
  const player = world.player;
  const n = world.nations[player];

  n.activeTrees.land = 'mobile_warfare';
  n.doctrines = ['mw_blitzkrieg', 'mw_delay'];
  n.armyXp = 40; // 不足 100

  const res = unlockDoctrine(world, player, 'land', 'mobile_warfare', 'mw_elastic_def');
  assert.equal(res.ok, false);
  assert.ok(res.reason.includes('不足'), `原因应包含不足提示: ${res.reason}`);
  assert.equal(n.armyXp, 40, 'XP 不应被扣减');
});

// 4. 同军种学说树互斥锁定 [H]
test('同军种学说互斥锁定：已选机动战不可跨选优势火力', () => {
  const world = makeWorld('A', 103);
  const player = world.player;
  const n = world.nations[player];

  n.activeTrees.land = 'mobile_warfare';
  n.armyXp = 300;

  // 尝试解锁优势火力学说首个节点
  const res = unlockDoctrine(world, player, 'land', 'superior_firepower', 'sf_superior_firepower');
  assert.equal(res.ok, false);
  assert.ok(res.reason.includes('互斥'), `错误提示应包含互斥提示: ${res.reason}`);
});

// 5. 前置学说依赖校验
test('前置节点依赖链校验：未修前置不得跨级解锁', () => {
  const world = makeWorld('A', 104);
  const player = world.player;
  const n = world.nations[player];

  n.activeTrees.land = 'mobile_warfare';
  n.doctrines = ['mw_blitzkrieg']; // 尚未研习 mw_delay
  n.armyXp = 300;

  const res = unlockDoctrine(world, player, 'land', 'mobile_warfare', 'mw_elastic_def');
  assert.equal(res.ok, false);
  assert.ok(res.reason.includes('前置学说未就绪'), `原因应包含前置未就绪: ${res.reason}`);
});

// 6. 师经验四档加成阶梯 [H]
test('师经验四档加成阶梯 (0% / +25% / +50% / +75%) [H]', () => {
  // raw < 0.10: 惩罚 -25% (mul 0.75)
  const rawTier = getDivisionExpTier(0.05);
  assert.equal(rawTier.id, 'raw');
  assert.equal(rawTier.mul, 0.75);

  // trained 0.10 ~ 0.29: 0% 加成 (mul 1.00)
  const trainedTier = getDivisionExpTier(0.15);
  assert.equal(trainedTier.id, 'trained');
  assert.equal(trainedTier.mul, 1.00);

  // regular 0.30 ~ 0.74: +25% 加成 (mul 1.25)
  const regularTier = getDivisionExpTier(0.40);
  assert.equal(regularTier.id, 'regular');
  assert.equal(regularTier.mul, 1.25);

  // seasoned 0.75 ~ 0.89: +50% 加成 (mul 1.50)
  const seasonedTier = getDivisionExpTier(0.80);
  assert.equal(seasonedTier.id, 'seasoned');
  assert.equal(seasonedTier.mul, 1.50);

  // veteran >= 0.90: +75% 加成 (mul 1.75)
  const veteranTier = getDivisionExpTier(0.95);
  assert.equal(veteranTier.id, 'veteran');
  assert.equal(veteranTier.mul, 1.75);
});

// 7. 500 XP 上限与战时被动积攒
test('500 XP 储备上限与实战被动积累', () => {
  const world = makeWorld('A', 105);
  const player = world.player;
  const n = world.nations[player];

  n.armyXp = 490;
  addNationXP(world, player, 'army', 30);
  assert.equal(n.armyXp, 500, 'XP 应当封顶在 500 点');

  // 战时被动积累
  n.armyXp = 100;
  n.atWarWith = ['F'];
  doctrineTick(world);
  assert.ok(n.armyXp > 100, '战时应当被动增加作战经验');
});

// 8. 学说效果挂载至国家 modifiers
test('学说效果正确挂载至国家 modifiers', () => {
  const world = makeWorld('A', 106);
  const player = world.player;
  const n = world.nations[player];

  n.activeTrees.land = 'mobile_warfare';
  n.doctrines = ['mw_blitzkrieg'];
  n.armyXp = 200;

  unlockDoctrine(world, player, 'land', 'mobile_warfare', 'mw_delay');
  assert.equal(n.modifiers.infOrg, 15, '步兵组织度应当增加 15');
});

if(failed > 0){
  console.error(`\nFAILED: ${failed} tests failed.`);
  process.exit(1);
} else {
  console.log(`\nPASSED: All ${passed} tests passed.`);
}
