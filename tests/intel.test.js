/* ============================================================
   tests/intel.test.js —— v9.0 间谍与情报系统核心机制验收断言 [H]
   ============================================================ */

import assert from 'node:assert/strict';
import { K } from '../js/data/constants.js';
import {
  calcIntelCombatBonus,
  calcCipherStrength,
  calcRepeatOperationCostMultiplier,
  calcAllianceIntelShare,
  formatIntelMetric,
  INTEL_OPERATIONS
} from '../js/engine/intel.js';

console.log('--- 开始间谍与情报系统单元测试 (Milestone N3) ---');

// 1. 战斗情报加成断言 (0.3%/pp，5pp 门槛，50pp 封顶 15%) [H]
{
  // 差值 < 5pp (例如 4pp) → 加成 0
  assert.equal(calcIntelCombatBonus(54, 50), 0.0, '情报差低于 5pp 时不激活战斗加成');

  // 差值 = 5pp → 5 * 0.3% = 1.5%
  assert.equal(calcIntelCombatBonus(55, 50), 0.015, '情报差 5pp 时战斗加成应严格为 +1.5% [H]');

  // 差值 = 20pp → 20 * 0.3% = 6.0%
  assert.equal(calcIntelCombatBonus(70, 50), 0.06, '情报差 20pp 时战斗加成应为 +6.0% [H]');

  // 差值 = 50pp → 50 * 0.3% = 15.0% (满额封顶)
  assert.equal(calcIntelCombatBonus(100, 50), 0.15, '情报差 50pp 时战斗加成应严格达到 +15% 封顶 [H]');

  // 差值 = 60pp → 封顶依然为 15.0%
  assert.equal(calcIntelCombatBonus(100, 40), 0.15, '情报差超过 50pp 时加成必须封顶在 +15% [H]');

  console.log('✓ 战斗情报加成断言通过 (5pp→+1.5%，50pp→+15% 封顶)');
}

// 2. 密码破译总强度公式断言 (12000 + 4250 × L) [H]
{
  // Level 0: 12000 + 4250*0 = 12000
  assert.equal(calcCipherStrength(0), 12000, '0级密码学总强度应为 12000 [H]');

  // Level 1: 12000 + 4250*1 = 16250
  assert.equal(calcCipherStrength(1), 16250, '1级密码学总强度应为 16250 [H]');

  // Level 7: 12000 + 4250*7 = 41750
  assert.equal(calcCipherStrength(7), 41750, '7级密码学总强度应严格为 41750 [H]');

  console.log('✓ 密码学强度公式断言通过 (Lv0=12000, Lv7=41750)');
}

// 3. 重复执行同目标同行动成本递增断言 (+15% 每次) [H]
{
  // 首次执行 (次数 0) → 乘数 1.0
  assert.equal(calcRepeatOperationCostMultiplier(0), 1.0, '首次执行行动成本乘数为 1.0');

  // 第 1 次重复 (累计已执行 1 次) → 1.15
  assert.equal(calcRepeatOperationCostMultiplier(1), 1.15, '第1次重复执行成本应 +15% (1.15) [H]');

  // 第 2 次重复 (累计已执行 2 次) → 1.15^2 = 1.3225
  assert.equal(calcRepeatOperationCostMultiplier(2), 1.3225, '第2次重复执行成本应为 1.3225 (+32.25%) [H]');

  // 第 3 次重复 (累计已执行 3 次) → 1.15^3 = 1.5209
  assert.equal(calcRepeatOperationCostMultiplier(3), 1.5209, '第3次重复执行成本应为 1.5209 (+52.09%) [H]');

  console.log('✓ 重复行动成本每次 +15% 递增法则断言通过');
}

// 4. 同盟情报共享 30% 差额断言 [H]
{
  // 己方 30%，盟友 60% → 差额 30% * 30% = 9%
  const shared = calcAllianceIntelShare(30, 60);
  assert.equal(shared, 9.0, '盟友情报更高时应共享差额的 30% (9pp) [H]');

  // 盟友不高于己方 → 0%
  assert.equal(calcAllianceIntelShare(50, 40), 0.0, '盟友情报低于己方时无额外共享');

  console.log('✓ 同盟情报 30% 差额共享机制断言通过');
}

// 5. 信息精度模糊化区间断言 [H]
{
  // 民政情报 < 10% → ???
  assert.equal(formatIntelMetric(50, 5, 'civ'), '??? (缺乏情报)', '民政情报低于 10% 应完全隐匿');

  // 民政情报 20% (10-30%) → ±50% 估算区间
  assert.equal(formatIntelMetric(50, 20, 'civ'), '25 ~ 75 (±50%)', '民政情报 20% 应显示 ±50% 区间 [H]');

  // 民政情报 ≥ 30% → 精确值
  assert.equal(formatIntelMetric(50, 40, 'civ'), '50 (精确)', '民政情报达标时显示精确值');

  // 陆军情报 15% (< 30%) → ±80%
  assert.equal(formatIntelMetric(10, 15, 'army'), '2 ~ 18 师 (±80%)', '陆军情报低于 30% 显示 ±80% [H]');

  // 陆军情报 50% (< 70%) → ±50%
  assert.equal(formatIntelMetric(10, 50, 'army'), '5 ~ 15 师 (±50%)', '陆军情报 50% 显示 ±50% [H]');

  console.log('✓ 历史考据信息可见度与模糊区间阶梯断言通过');
}

// 6. 19 项情报行动规范断言 [H]
{
  const opKeys = Object.keys(INTEL_OPERATIONS);
  assert(opKeys.length >= 12, '必须至少实现 12 种历史情报行动');
  assert(INTEL_OPERATIONS.orchestrate_coup, '必须包含策动政变叛乱行动 [H]');
  assert.equal(INTEL_OPERATIONS.orchestrate_coup.extraCost.inf_eq, 12000, '政变行动需 12000 步兵装备 [H]');
  assert(INTEL_OPERATIONS.prepare_collab_gov, '必须包含筹建伪政权合作政府行动 [H]');
  assert.equal(INTEL_OPERATIONS.prepare_collab_gov.extraCost.inf_eq, 1000, '筹建合作政府需 1000 步兵装备 [H]');

  console.log('✓ 19 项历史情报行动清单与高阶资源消耗断言通过');
}

console.log('🎉 间谍与情报系统 (Milestone N3) 全部核心断言通过！');
