/* ============================================================
   tests/air.test.js —— v9.0 空军系统核心数值与机制验收断言 [H]
   ============================================================ */

import assert from 'node:assert/strict';
import { K } from '../js/data/constants.js';
import {
  calcAirbaseEfficiency,
  calcRangePenalty,
  calcWingSuperiority,
  calcCASBonus,
  applyStratBombingDamage,
  rollAceGeneration,
  AIR_REGIONS,
  getHexAirRegion
} from '../js/engine/air.js';

console.log('--- 开始空军系统单元测试 (Milestone N1) ---');

// 1. 机场超容惩罚与容量阶梯断言 [H]
{
  const base = { id: 'test_base', level: 2, capacity: 400 }; // 2级机场 400架容量
  
  // 正常未超容：效率 100%
  const effNormal = calcAirbaseEfficiency(base, 350);
  assert.equal(effNormal, 1.0, '容量内机场任务效率应为 100%');

  // 超容 10% (440架) → 惩罚 20%，效率 80% (超容每 1% 任务效率 -2%)
  const eff10 = calcAirbaseEfficiency(base, 440);
  assert.equal(eff10, 0.80, '超容 10% 任务效率应为 80% (-20%)');

  // 超容 25% (500架) → 惩罚 50%，效率 50%
  const eff25 = calcAirbaseEfficiency(base, 500);
  assert.equal(eff25, 0.50, '超容 25% 任务效率应为 50% (-50%)');

  // 超容 50% (600架) → 惩罚 100%，效率 0%
  const eff50 = calcAirbaseEfficiency(base, 600);
  assert.equal(eff50, 0.0, '机场超容 50% → 效率应直接归零 (-100%) [H]');

  console.log('✓ 机场容量与超容惩罚梯度断言通过 (超容 50% 效率归 0)');
}

// 2. 航程覆盖惩罚阶梯断言 [H]
{
  // 覆盖率 100% → 0% 惩罚
  assert.equal(calcRangePenalty(1.00), 0.00, '覆盖率 100% 航程惩罚为 0');

  // 覆盖率 84% → 16% 惩罚
  assert.equal(calcRangePenalty(0.84), 0.16, '覆盖率 84% 航程惩罚为 16% [H]');

  // 覆盖率 60% → 40% 惩罚
  assert.equal(calcRangePenalty(0.60), 0.40, '覆盖率 60% 航程惩罚为 40% [H]');

  // 覆盖率 30% → 70% 惩罚
  assert.equal(calcRangePenalty(0.30), 0.70, '覆盖率 30% 航程惩罚为 70% [H]');

  // 覆盖率 < 30% → 100% 惩罚 (不可作业)
  assert.equal(calcRangePenalty(0.20), 1.00, '覆盖率 < 30% 航程惩罚为 100%');

  console.log('✓ 航程覆盖惩罚梯队断言通过 (100%->0%, 84%->16%, 60%->40%, 30%->70%)');
}

// 3. 联队制空权计算与机种权重断言 [H]
{
  // 重型战斗机: 权重 1.25
  const heavyFighterWing = { id: 'w1', type: 'heavy_fighter', count: 100, aces: [] };
  const hfSup = calcWingSuperiority(heavyFighterWing, 1.0, 1.0);
  assert.equal(hfSup, 1.25, '100架重战标准制空权应为 1.25');

  // 战斗机: 权重 1.00
  const fighterWing = { id: 'w2', type: 'fighter', count: 100, aces: [] };
  const fSup = calcWingSuperiority(fighterWing, 1.0, 1.0);
  assert.equal(fSup, 1.00, '100架轻战标准制空权应为 1.00');

  // 战略轰炸机: 权重 0.01
  const stratWing = { id: 'w3', type: 'strat_bomber', count: 100, aces: [] };
  const sSup = calcWingSuperiority(stratWing, 1.0, 1.0);
  assert.equal(sSup, 0.01, '100架战略轰炸机标准制空权应为 0.01');

  // 效率等价性验证: 100 架 @100% ≈ 200 架 @50%
  const wing100 = { id: 'w4', type: 'fighter', count: 100, aces: [] };
  const wing200 = { id: 'w5', type: 'fighter', count: 200, aces: [] };
  const sup100 = calcWingSuperiority(wing100, 1.0, 1.0);
  const sup200 = calcWingSuperiority(wing200, 0.5, 1.0);
  assert.equal(sup100, sup200, '100 架 @100% 效率与 200 架 @50% 效率制空权完全等价 [H]');

  console.log('✓ 联队制空权与机种权重断言通过 (100架@100% ≈ 200架@50%)');
}

// 4. CAS 战宽加成缩放算例复现 HOI4 Wiki 森林例断言 [H]
{
  // 森林战役中敌方战线宽度为 18 时：
  // 参战飞机上限 = 战宽 × 3 = 18 × 3 = 54 架
  const enemyWidth = 18;

  // 算例 A：27 架在场 → 参战上限 54 架，加成基数 25% → 27/54 * 25% = 12.5%
  const cas27 = calcCASBonus(enemyWidth, 27);
  assert.equal(cas27.maxPlanes, 54, '上限应为 54 架');
  assert.equal(cas27.activePlanes, 27, '在场参战机应为 27 架');
  assert.equal(cas27.attackBonus, 0.125, '27 架参战时攻击加成应严格为 +12.5% [H]');

  // 算例 B：48 架在场 → 48/54 * 25% = 0.8888... * 25% = 0.2222... (+22.2%)
  const cas48 = calcCASBonus(enemyWidth, 48);
  assert.equal(cas48.maxPlanes, 54, '上限应为 54 架');
  assert.equal(cas48.activePlanes, 48, '在场参战机应为 48 架');
  assert.equal(+cas48.attackBonus.toFixed(3), 0.222, '48 架参战时攻击加成应严格为 +22.2% [H]');

  // CAS 伤害系数验证: org 0.04 / str 0.04
  assert.equal(cas27.orgDmg, +(27 * 0.04).toFixed(4), 'CAS org 伤害系数为 0.04');
  assert.equal(cas27.strDmg, +(27 * 0.04).toFixed(4), 'CAS str 伤害系数为 0.04');

  console.log('✓ CAS 战宽上限与攻击加成缩放算例（HOI4 Wiki 森林 54/27/48 架）100% 精确复现');
}

// 5. 战略轰炸建筑系数与单级建筑破坏断言 [H]
{
  // 基建 100% 系数受 1.2 伤害
  const infraDmg = applyStratBombingDamage('infra', 1.2, 0);
  assert.equal(infraDmg.effectiveDamage, 1.2, '基建伤害系数应为 100%');
  assert.equal(infraDmg.disabled, true, '单级建筑受 1 点伤害即失效首级效果 [H]');

  // 机场 50% 系数
  const baseDmg = applyStratBombingDamage('air_base', 1.0, 0);
  assert.equal(baseDmg.effectiveDamage, 0.5, '机场伤害系数应为 50%');
  assert.equal(baseDmg.disabled, false, '未达到 1 点伤害不失效首级');

  // 水坝 0% 系数
  const damDmg = applyStratBombingDamage('dam', 2.0, 0);
  assert.equal(damDmg.effectiveDamage, 0.0, '水坝伤害系数应为 0%');

  // 州防空脆弱度减伤: 每级 -12%
  const aaMitigated = applyStratBombingDamage('infra', 1.0, 2); // 2级防空 -24%
  assert.equal(aaMitigated.effectiveDamage, 0.76, '2级州防空应减免 24% 轰炸伤害');

  console.log('✓ 战略轰炸建筑系数与防空削弱断言通过');
}

// 6. 空区聚合与坐标映射断言 [H]
{
  assert(AIR_REGIONS.length >= 8, '应至少聚合 8 个大空区');
  // 柏林 (6,8) 属于东普鲁士/波德边境或西德
  const berAir = getHexAirRegion(6, 8);
  assert(berAir, '任意陆地六角格均应对应有效空区');
  console.log('✓ 空区聚合与六角格空间映射断言通过');
}

console.log('🎉 空军系统 (Milestone N1) 全部核心断言通过！');
