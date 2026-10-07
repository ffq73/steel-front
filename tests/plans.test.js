/* ============================================================
   tests/plans.test.js —— 作战计划与前线系统测试 (v4.0 P1 / B10-B12)
   验证划线、填线、箭头、计划积累/消耗、微操惩罚 C15、指挥上限 C14
   ============================================================ */

import { makeWorld } from '../js/engine/world.js';
import { createFront, assignToFront, createArrow, planningTick, executeArrow, applyManualPenalty, getOrCreateArmy } from '../js/engine/plans.js';
import { makeRng } from '../js/core/rng.js';
import { K } from '../js/data/constants.js';

let passed = 0, failed = 0;
function assert(name, ok, msg=''){
  if(ok){
    passed++;
    console.log(`✓ ${name}`);
  } else {
    failed++;
    console.error(`✗ ${name}: ${msg}`);
  }
}

console.log('=== 开始作战计划系统测试 ===\n');

// 1. 测试划线与填线 (B11)
{
  const world = makeWorld('A', 42);
  const army = getOrCreateArmy(world, 'army_east', 'G', '东线第1野战军');
  
  // 收集所有德军步兵师加入军
  const gerDivs = world.units.filter(u => u.nat === 'G');
  army.divisions = gerDivs.map(u => u.id);

  // 划前线
  const front = createFront(world, 'G', [], army.id);
  assert('自动求解前线格', front.hexes.length > 0, `求解得到 ${front.hexes.length} 个前线格`);

  // 填线
  const assignments = assignToFront(world, front.id);
  let totalAssigned = 0;
  let maxStack = 0;

  for(const hIdx in assignments){
    const list = assignments[hIdx];
    totalAssigned += list.length;
    if(list.length > maxStack) maxStack = list.length;
  }

  assert('填线无超堆叠 (<=6/格)', maxStack <= K.STACK_LIMIT, `最大堆叠: ${maxStack}`);
  assert('填线全覆盖分配', totalAssigned > 0 && totalAssigned === army.divisions.length, `分配了 ${totalAssigned}/${army.divisions.length} 师`);
}

// 2. 测试计划槽积累与进攻箭头
{
  const world = makeWorld('A', 42);
  const army = getOrCreateArmy(world, 'army_east', 'G', '东线第1野战军');
  army.divisions = world.units.filter(u => u.nat === 'G').slice(0, 10).map(u => u.id);

  const front = createFront(world, 'G', [], army.id);
  assignToFront(world, front.id);

  // 画 2 条进攻箭头
  const arrow1 = createArrow(world, front.id, [10, 11], army.id);
  const arrow2 = createArrow(world, front.id, [12, 13], army.id);

  assert('创建进攻箭头', army.arrowIds.length === 2);

  // 初始计划为 0
  assert('初始计划槽为 0', army.planning === 0);

  // 模拟 10 天积累
  const rng = makeRng(100);
  for(let i = 0; i < 10; i++){
    planningTick(world, rng);
  }

  assert('计划槽随时间稳定积累', army.planning > 0, `当前计划槽: ${(army.planning*100).toFixed(1)}%`);
  const planBeforeExec = army.planning;

  // 执行箭头
  executeArrow(world, army.id);
  assert('执行进攻计划', army.executing === true);

  // 执行中消耗计划
  planningTick(world, rng);
  assert('执行日计划槽每日消耗', army.planning < planBeforeExec, `从 ${(planBeforeExec*100).toFixed(1)}% 降至 ${(army.planning*100).toFixed(1)}%`);
}

// 3. 测试手动微操惩罚 C15 (B12)
{
  const world = makeWorld('A', 42);
  const army = getOrCreateArmy(world, 'army_east', 'G', '东线第1野战军');
  const divs = world.units.filter(u => u.nat === 'G').slice(0, 12);
  army.divisions = divs.map(u => u.id);

  const front = createFront(world, 'G', [], army.id);
  assignToFront(world, front.id);
  createArrow(world, front.id, [10, 11], army.id);

  // 充满计划槽
  army.planning = 0.30;
  for(const uid of army.divisions){
    const u = world.units.find(x => x.id === uid);
    if(u) { u.inPlan = true; u.planning = 0.30; }
  }

  // 手动调走 1/3 的师 (4 个师)
  const targetUnit = divs[0];
  applyManualPenalty(world, army.id, targetUnit.id);

  assert('被手操师脱离计划', targetUnit.inPlan === false);
  assert('全军计划槽受到微操惩罚扣减 5%', Math.abs(army.planning - 0.25) < 0.001, `当前计划槽: ${(army.planning*100).toFixed(1)}%`);
}

console.log(`\n测试汇总: ${passed} 通过, ${failed} 失败`);
if(failed > 0) process.exit(1);
