/* ============================================================
   tests/coldwar.test.js —— 冷战「铁幕 1949」验收测试 (E3)
   验证阵营渗透(bloc.js)、DEFCON与末日钟(nuclear.js)、
   太空竞赛7大里程碑(space.js)、月度结算与双输终局
   ============================================================ */

import { strict as assert } from 'node:assert';
import { COLDWAR_SCENARIO } from '../js/data/scenarios/coldwar/index.js';
import { ERAS } from '../js/data/eras.js';
import { initBloc, investInfluence, conductCovertOp, blocTick, BLOCS } from '../js/engine/bloc.js';
import { initNuclear, setDefcon, getDefcon, escalateDoomsdayClock } from '../js/engine/nuclear.js';
import { initSpaceRace, launchSpaceMission, getSpaceProgress, SPACE_MILESTONES } from '../js/engine/space.js';

console.log('=== 开始冷战「铁幕 1949」深度还原验收测试 (E3) ===\n');

// 1. 时代修正表校验
const era = ERAS.coldwar;
assert(era, '冷战时代配置 ERAS.coldwar 必须存在');
assert.equal(era.tickUnit, 'month', '冷战结算周期必须为 month (月)');
assert.equal(era.nuclearAllowed, true, '冷战必须启用核威慑系统');
assert.equal(era.stackLimit, 4, '冷战堆叠上限应为 4');
console.log('✓ 冷战时代修正表参数验证通过 (月度周期, 核威慑启用, 堆叠上限 4)');

// 2. 内容规模底线校验 (C18 / E3)
assert(COLDWAR_SCENARIO.events.length >= 55, `冷战事件数应 >= 55，实际: ${COLDWAR_SCENARIO.events.length}`);
assert(COLDWAR_SCENARIO.characters.length >= 50, `冷战人物数应 >= 50，实际: ${COLDWAR_SCENARIO.characters.length}`);
assert(COLDWAR_SCENARIO.equipment.length >= 15, `冷战装备数应 >= 15，实际: ${COLDWAR_SCENARIO.equipment.length}`);
console.log(`✓ 冷战内容基准检验通过: ${COLDWAR_SCENARIO.events.length} 事件, ${COLDWAR_SCENARIO.characters.length} 人物, ${COLDWAR_SCENARIO.equipment.length} 装备`);

// 3. 阵营与地缘影响力系统 (bloc.js)
const mockWorld = {
  era: 'coldwar',
  day: 1,
  nations: {
    USA: { name: '美利坚合众国' },
    SOV: { name: '苏维埃社会主义共和国联盟' },
    EGY: { name: '埃及王国', influence: { USA: 30, SOV: 30 }, alignment: 'non_aligned' }
  },
  events: []
};

initBloc(mockWorld);
assert(mockWorld.blocs.nato.includes('USA'));
assert(mockWorld.blocs.warsaw.includes('SOV'));

// 投资影响力
investInfluence(mockWorld, 'USA', 'EGY', 20);
assert.equal(mockWorld.nations.EGY.influence.USA, 50);

// 执行秘密行动 (realign)
conductCovertOp(mockWorld, 'SOV', 'EGY', 'realign');
assert(mockWorld.nations.EGY.influence.SOV >= 45, '策反渗透必须提升苏联影响力');

// 阵营归属变迁
mockWorld.nations.EGY.influence.SOV = 80;
mockWorld.nations.EGY.influence.USA = 20;
blocTick(mockWorld);
assert.equal(mockWorld.nations.EGY.alignment, 'warsaw', '当苏联优势 >= 35 时目标国应倒向华约');
console.log('✓ 地缘影响力与秘密行动系统验证通过 (北约/华约/不结盟, 投资渗透, 阵营动态变迁)');

// 4. DEFCON 与末日钟系统 (nuclear.js)
const mockWorld2 = {
  day: 1,
  nations: { USA: { name: 'USA' }, SOV: { name: 'SOV' } },
  events: []
};

initNuclear(mockWorld2);
assert.equal(getDefcon(mockWorld2), 5, '初始戒备等级应为 DEFCON 5');

// 升格战备至 DEFCON 3
setDefcon(mockWorld2, 3, '古巴导弹危机爆发');
assert.equal(getDefcon(mockWorld2), 3);

// 末日钟拨近与映射
escalateDoomsdayClock(mockWorld2, 5.5, '战略预警误报');
assert(mockWorld2.nuclear.doomsdayClock <= 2.0);
assert(getDefcon(mockWorld2) <= 2, '末日钟逼近必须自动升格 DEFCON');

// 终极核浩劫 (DEFCON 1 -> 双输)
setDefcon(mockWorld2, 1, '洲际弹道导弹大规模齐射');
assert.equal(mockWorld2.nuclear.defcon, 1);
assert(mockWorld2.over !== null, 'DEFCON 1 必须触发终局');
assert.equal(mockWorld2.over.win, false, 'DEFCON 1 终局必须为双输');
console.log('✓ DEFCON 战备与末日钟系统验证通过 (5级战备阶梯, 危机升格, DEFCON 1 终极双输判定)');

// 5. 太空竞赛系统 (space.js)
const mockWorld3 = {
  day: 1,
  nations: {
    USA: { name: '美国', stability: 70, modifiers: {} },
    SOV: { name: '苏联', stability: 70, modifiers: {} }
  },
  events: []
};

initSpaceRace(mockWorld3);
assert.equal(SPACE_MILESTONES.length, 7, '太空竞赛必须包含 7 大历史里程碑');

// 依次发射人造卫星
const ok1 = launchSpaceMission(mockWorld3, 'SOV', 'sputnik_1');
assert(ok1, '苏联应成功发射斯普特尼克1号');
const progSov = getSpaceProgress(mockWorld3, 'SOV');
assert.equal(progSov.completedCount, 1);
assert.equal(progSov.prestige, 50);

// 美国随后发射
const ok2 = launchSpaceMission(mockWorld3, 'USA', 'sputnik_1');
assert(ok2, '美国亦可跟进发射第一颗卫星');

// 登月终极飞跃
launchSpaceMission(mockWorld3, 'USA', 'laika_orbit');
launchSpaceMission(mockWorld3, 'USA', 'gagarin_flight');
launchSpaceMission(mockWorld3, 'USA', 'first_spacewalk');
launchSpaceMission(mockWorld3, 'USA', 'lunar_orbiter');
const okMoon = launchSpaceMission(mockWorld3, 'USA', 'apollo_moon_landing');
assert(okMoon, '美国阿波罗登月必须成功');
assert(mockWorld3.nations.USA.modifiers.techSpeed > 0.1, '登月成功必须发放巨额科研加成');
console.log('✓ 太空竞赛系统验证通过 (7大历史里程碑、声望积累与科技溢出增益)');

console.log('\n=== 冷战「铁幕 1949」E3 验收全部通过 ✓ ===\n');
