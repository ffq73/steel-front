/* ============================================================
   tests/navy.test.js —— v9.0 海军系统核心机制与数值验收断言 [H]
   ============================================================ */

import assert from 'node:assert/strict';
import { K } from '../js/data/constants.js';
import {
  calcSingleShipSuperiority,
  calcFleetScreening,
  calcSeaZoneSuperiority,
  calcNavalInvasionPrep,
  validateNavalInvasion,
  calcNavalDamage,
  SEA_ZONES
} from '../js/engine/navy.js';

console.log('--- 开始海军系统单元测试 (Milestone N2) ---');

// 1. 单舰海军优势基准量级断言 [H]
{
  // 战列舰 (IC 12000, 舰员 5000): 0.005*12000 + 0.05*5000 = 60 + 250 = 310点
  const bbSup = calcSingleShipSuperiority('bb');
  assert.equal(bbSup, 310, '战列舰海军优势点数应为 310点 (≈300量级)');

  // 驱逐舰 (IC 1400, 舰员 350): 0.005*1400 + 0.05*350 = 7 + 17.5 = 24.5点
  const ddSup = calcSingleShipSuperiority('dd');
  assert.equal(ddSup, 24.5, '驱逐舰海军优势点数应为 24.5点');

  // 潜艇 (IC 900, 舰员 80): 0.005*900 + 0.05*80 = 4.5 + 4 = 8.5点 (几乎不贡献海权)
  const ssSup = calcSingleShipSuperiority('ss');
  assert.equal(ssSup, 8.5, '潜艇海军优势点数极低 (8.5点)，几乎不贡献海权 [H]');

  console.log('✓ 单舰海军优势点数基准量级断言通过 (BB 310 / DD 24.5 / SS 8.5)');
}

// 2. 40% 海军情报硬门槛断言 [H]
{
  const mockWorld = {
    fleets: [
      {
        id: 'test_fleet',
        nat: 'GER',
        seaZoneId: 'sz_baltic',
        task: 'patrol',
        ships: [{ type: 'bb' }, { type: 'bb' }, { type: 'dd' }]
      }
    ],
    intelEfficiency: {}
  };

  // 情报 39% (< 40% 硬门槛) → 该海区海权强制为 0
  mockWorld.intelEfficiency['GER'] = 0.39;
  const res39 = calcSeaZoneSuperiority(mockWorld, 'sz_baltic');
  assert.equal(res39.scores['GER'], 0, '情报效率低于 40% 时海权必须强制归零 (0) [H]');

  // 情报 40% (临界线达标) → 获得有效海权
  mockWorld.intelEfficiency['GER'] = 0.40;
  const res40 = calcSeaZoneSuperiority(mockWorld, 'sz_baltic');
  assert(res40.scores['GER'] > 0, '情报效率达到 40% 门槛时应计算正常海权 [H]');

  // 情报 60% → 海权相应提升
  mockWorld.intelEfficiency['GER'] = 0.60;
  const res60 = calcSeaZoneSuperiority(mockWorld, 'sz_baltic');
  assert(res60.scores['GER'] > res40.scores['GER'], '情报效率提升海权应单调递增');

  console.log('✓ 40% 海军情报硬门槛断言通过 (39%→0点，40%→有值)');
}

// 3. 屏卫比 (3:1) 与命中率/撤退加成断言 [H]
{
  // 1 艘战列舰 + 3 艘驱逐舰 → 满屏卫 100% (3:1)
  const fullScreenFleet = [{ type: 'bb' }, { type: 'dd' }, { type: 'dd' }, { type: 'dd' }];
  const fullScreen = calcFleetScreening(fullScreenFleet);
  assert.equal(fullScreen.screenRatio, 1.0, '3屏卫/1资本舰应达到 100% 满屏卫比');
  assert.equal(fullScreen.hitBonus, 0.40, '满屏卫命中加成应为 +40% [H]');
  assert.equal(fullScreen.retreatBonus, 0.20, '满屏卫撤退加成应为 +20% [H]');

  // 1 艘战列舰 + 1 艘驱逐舰 → 屏卫比 33.3% (1/3)
  const partialScreenFleet = [{ type: 'bb' }, { type: 'dd' }];
  const partialScreen = calcFleetScreening(partialScreenFleet);
  assert.equal(partialScreen.screenRatio, 0.333, '1屏卫/1资本舰屏卫比应为 33.3%');
  assert(partialScreen.hitBonus < 0.40, '屏卫不足时命中加成未满');
  assert.equal(+partialScreen.hitBonus.toFixed(3), +(0.40 * 1/3).toFixed(3), '命中加成按屏卫率线性缩放');

  // 0 艘驱逐舰 → 屏卫比 0%
  const noScreenFleet = [{ type: 'bb' }];
  const noScreen = calcFleetScreening(noScreenFleet);
  assert.equal(noScreen.screenRatio, 0.0, '无屏卫舰屏卫比为 0');
  assert.equal(noScreen.hitBonus, 0.0, '无屏卫时无命中加成');

  console.log('✓ 屏卫比 3:1 与命中(+40%)/撤退(+20%)加成断言通过');
}

// 4. 登陆作战准备天数与制海条件检验断言 [H]
{
  // 准备时间：每师 7 天 (10 师 = 70 天)
  const prep10 = calcNavalInvasionPrep(10, false);
  assert.equal(prep10, 70, '10 师基础登陆准备天数必须严格为 70 天 [H]');

  // 1940 登陆艇科技减半
  const prep10Tech = calcNavalInvasionPrep(10, true);
  assert.equal(prep10Tech, 35, '1940 科技下 10 师登陆准备天数应减半为 35 天 [H]');

  // 登陆海权与情报验证
  const mockWorldInv = {
    fleets: [
      { id: 'f1', nat: 'GER', seaZoneId: 'sz_baltic', task: 'patrol', ships: [{ type: 'bb' }, { type: 'dd' }, { type: 'dd' }, { type: 'dd' }] }
    ],
    intelEfficiency: { GER: 0.70 }
  };

  // 情报达标且独占海权 (>50%) → 允许登陆
  const checkPass = validateNavalInvasion(mockWorldInv, 'GER', ['sz_baltic']);
  assert.equal(checkPass.ok, true, '海权充足且情报达标时允许发起登陆');

  // 情报不足 (<40%) → 拒绝发起并给出明确原因
  mockWorldInv.intelEfficiency['GER'] = 0.35;
  const checkFailIntel = validateNavalInvasion(mockWorldInv, 'GER', ['sz_baltic']);
  assert.equal(checkFailIntel.ok, false, '情报不足时必须拒绝登陆发起');
  assert(checkFailIntel.reason.includes('40%'), '错误原因中必须提示 40% 情报硬门槛');

  console.log('✓ 登陆准备 10师=70天 与发起制海权/情报门槛断言通过');
}

// 5. 穿甲减伤与暴击机制断言 [H]
{
  // 武器穿甲 10 vs 敌甲 20: 穿甲减伤 = -90% * (1 - 10/20) = -45%
  const dmgResult = calcNavalDamage({ damage: 100, piercing: 10 }, 20, false, () => 0.5); // 不暴击
  assert.equal(dmgResult.pierceMitigation, 0.45, '未击穿装甲时应获得 45% 穿甲减伤');
  assert.equal(dmgResult.damage, 55, '基础100伤害经45%减伤后应为 55 点');

  console.log('✓ 海战穿甲减伤公式与伤害计算断言通过');
}

// 6. W6 实质海战交火、弹药库殉爆与击沉断言 [H]
{
  const shipA = { id: 's_bb', type: 'bb', name: '大和号战列舰', hp: 450, org: 50 };
  const shipB = { id: 's_dd', type: 'dd', name: '雪风号驱逐舰', hp: 80, org: 55 };
  const fleetA = {
    id: 'fl_a', name: '联合舰队', nat: 'JPN', seaZoneId: 'sz_pacific', task: 'strike',
    ships: [shipA]
  };
  const fleetB = {
    id: 'fl_b', name: '美军驱逐分遣队', nat: 'USA', seaZoneId: 'sz_pacific', task: 'patrol',
    ships: [shipB]
  };
  const mockWorld = {
    day: 1, events: [],
    seaZones: [{ id: 'sz_pacific', name: '太平洋', hexes: [] }],
    fleets: [fleetA, fleetB],
    nations: {
      JPN: { alive: true, atWarWith: ['USA'] },
      USA: { alive: true, atWarWith: ['JPN'] }
    }
  };

  // 模拟交火（固定 rng 触发接触、命中与暴击弹药库引爆）
  // 驱逐舰 80 HP 将被直接击沉
  const deterministicRng = () => 0.05; // 必触发接触(<0.4)、命中(<0.1)、暴击与弹药库引爆(<0.15)
  const { navalCombatTick } = await import('../js/engine/navy.js');
  navalCombatTick(mockWorld, deterministicRng);

  // 验证战报与击沉
  const sunkEvent = mockWorld.events.find(e => e.type === 'naval_ship_sunk');
  assert.ok(sunkEvent, '应产生战舰击沉事件');
  assert.ok(sunkEvent.text.includes('殉爆') || sunkEvent.text.includes('击沉'), '应包含击沉或殉爆说明');
  assert.equal(fleetB.ships.length, 0, '被击沉舰艇必须从原舰队中移除');
  console.log('✓ W6 实质海战交火模型、弹药库引爆与击沉移除断言通过');
}

// 7. W6 沿海重炮岸轰支援断言 [H]
{
  const { getShoreBombardmentModifier } = await import('../js/engine/navy.js');
  const hLand = {
    idx: 1, q: 0, r: 0, terrain: 'plain', adj: [2]
  };
  const hSea = {
    idx: 2, q: 1, r: 0, terrain: 'sea', adj: [1]
  };
  const mockWorld = {
    hexes: [null, hLand, hSea],
    seaZones: [{ id: 'sz_coast', name: '近海', hexes: [[1, 0]] }],
    fleets: [
      {
        id: 'fl_support', nat: 'USA', seaZoneId: 'sz_coast', task: 'patrol',
        ships: [
          { type: 'bb' }, { type: 'bb' }, { type: 'ca' } // 4*2 + 2 = 10 重炮
        ]
      }
    ]
  };
  const bombMod = getShoreBombardmentModifier(mockWorld, hLand, 'USA', 'JPN');
  assert.ok(bombMod.atkMul > 1.0, '友军应获得火力协同加成');
  assert.ok(bombMod.defMul < 1.0, '敌军防御应遭受重炮岸轰削弱');
  assert.equal(bombMod.defMul, 0.8, '10门重炮应压制敌军 20% 防御 (-20%)');
  console.log('✓ W6 沿海陆战重炮岸轰支援与防御削弱断言通过');
}

console.log('🎉 海军系统 (Milestone W6) 全部核心断言通过！');
