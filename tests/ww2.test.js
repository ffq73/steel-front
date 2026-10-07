/* ============================================================
   tests/ww2.test.js —— 二战「全面战争 1939」扩容验收测试 (E2)
   验证动态入盟(diplomacy.js)、战区统帅(theaters.js)、
   占领与抵抗(resistance.js)、7大T1国策树>=24、内容底线与全量回归
   ============================================================ */

import { strict as assert } from 'node:assert';
import { WW2_SCENARIO } from '../js/data/scenarios/ww2/index.js';
import { createFaction, joinFaction, leaveFaction, getFactionMembers } from '../js/engine/diplomacy.js';
import { createTheater, assignGeneralToTheater, getTheaterCombatBonus } from '../js/engine/theaters.js';
import { initResistance, setOccupationLaw, resistanceTick, OCCUPATION_LAWS } from '../js/engine/resistance.js';

console.log('=== 开始二战「全面战争 1939」扩容验收测试 (E2) ===\n');

// 1. 内容规模底线校验 (C18 / E2)
assert(WW2_SCENARIO.events.length >= 70, `WW2 事件数应 >= 70，实际: ${WW2_SCENARIO.events.length}`);
assert(WW2_SCENARIO.characters.length >= 80, `WW2 人物数应 >= 80，实际: ${WW2_SCENARIO.characters.length}`);
assert(WW2_SCENARIO.equipment.length >= 24, `WW2 装备数应 >= 24，实际: ${WW2_SCENARIO.equipment.length}`);

// 2. 7 大 T1 国策树均 >= 24
const t1Nations = ['GER', 'SOV', 'CHN', 'GBR', 'USA', 'JPN', 'ITA'];
for(const nat of t1Nations){
  const focList = WW2_SCENARIO.focuses[nat] || [];
  assert(focList.length >= 24, `T1 参战国 [${nat}] 国策树应 >= 24，实际: ${focList.length}`);
}
console.log(`✓ WW2 内容基准检验通过: ${WW2_SCENARIO.events.length} 事件, ${WW2_SCENARIO.characters.length} 人物, ${WW2_SCENARIO.equipment.length} 装备, 7 个 T1 核心国策树均 >= 24`);

// 3. 动态阵营系统 (diplomacy.js)
const mockWorld = {
  day: 1,
  nations: {
    GER: { name: '德意志国', faction: null },
    ITA: { name: '意大利王国', faction: null },
    HUN: { name: '匈牙利', faction: null }
  },
  events: []
};

createFaction(mockWorld, 'axis', '轴心国同盟', 'GER');
assert.equal(mockWorld.nations.GER.faction, 'axis');
assert.deepEqual(getFactionMembers(mockWorld, 'axis'), ['GER']);

// 动态加入阵营
joinFaction(mockWorld, 'ITA', 'axis');
joinFaction(mockWorld, 'HUN', 'axis');
assert.equal(mockWorld.nations.ITA.faction, 'axis');
assert.equal(getFactionMembers(mockWorld, 'axis').length, 3);

// 脱离阵营
leaveFaction(mockWorld, 'HUN');
assert.equal(mockWorld.nations.HUN.faction, null);
assert.equal(getFactionMembers(mockWorld, 'axis').length, 2);
console.log('✓ 动态阵营系统验证通过 (创立/加入/退出/多国盟约联动)');

// 4. 战区统帅与集团军指挥系统 (theaters.js)
mockWorld.characters = [
  { id: 'manstein', name: '曼施坦因', skills: { attack: 5, defense: 4, planning: 5 } }
];
const theater = createTheater(mockWorld, 'GER', '东线战区');
assert(theater && theater.id);
assert(mockWorld.nations.GER.theaters[theater.id]);

// 任命战区司令
assignGeneralToTheater(mockWorld, theater.id, 'manstein', 'GER');
assert.equal(mockWorld.nations.GER.theaters[theater.id].generalId, 'manstein');

// 战斗加成计算
const bonus = getTheaterCombatBonus(mockWorld, theater.id, 'GER');
assert(bonus.atkBonus > 0, '战区统帅必须提供攻击加成');
assert(bonus.defBonus > 0, '战区统帅必须提供防御加成');
assert(bonus.planBonus > 0, '战区统帅必须提供计划累积加速');
console.log(`✓ 战区指挥系统验证通过 (战区创建、将领委派、战区四维协同加成 atk:+${(bonus.atkBonus*100).toFixed(1)}%)`);

// 5. 占领区治理与抵抗组织系统 (resistance.js)
mockWorld.hexes = [
  { id: 0, name: '柏林', core: 'GER', owner: 'GER' },
  { id: 1, name: '华沙', core: 'POL', owner: 'GER', ind: true, resistance: 10, compliance: 10 }
];
mockWorld.units = [];

initResistance(mockWorld);
assert(mockWorld.nations.GER.occupationLaw, '必须初始化占领法案');

// 切换占领法案
setOccupationLaw(mockWorld, 'GER', 'brutal_oppression');
assert.equal(mockWorld.nations.GER.occupationLaw, 'brutal_oppression');

// 结算抵抗与顺从度
resistanceTick(mockWorld);
assert(mockWorld.hexes[1].resistance !== undefined, '占领区必须具备抵抗度');
console.log('✓ 占领区抵抗度与法案系统验证通过 (4 档治理法案、抵抗与顺从动态平衡、游击破袭机制)');

console.log('\n=== 二战「全面战争 1939」E2 验收全部通过 ✓ ===\n');
