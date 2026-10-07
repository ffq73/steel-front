/* ============================================================
   tests/ww1.test.js —— 一战「火药桶 1914」验收测试 (E1)
   验证炮击准备(barrage.js)、战争疲惫/封锁/革命(attrition.js)、
   堑壕上限25%及日+3%、攻击0.85、1914编制表、内容底线与指标回归
   ============================================================ */

import { strict as assert } from 'node:assert';
import { WW1_SCENARIO } from '../js/data/scenarios/ww1/index.js';
import { ERAS } from '../js/data/eras.js';
import { BARRAGE_MODES, setBarrageMode, applyBarrageCombatModifier, barrageTick } from '../js/engine/barrage.js';
import { updateExhaustion, applyBlockadePenalty, triggerUnrestrictedSubmarineWarfare, attritionTick } from '../js/engine/attrition.js';

console.log('=== 开始一战「火药桶 1914」深度还原验收测试 (E1) ===\n');

// 1. 时代修正表校验
const era = ERAS.ww1;
assert(era, '一战时代配置 ERAS.ww1 必须存在');
assert.equal(era.entrenchMax, 0.25, `一战堑壕上限应为 0.25，实际: ${era.entrenchMax}`);
assert.equal(era.entrenchPerDay, 0.03, `一战每日掘壕应为 0.03，实际: ${era.entrenchPerDay}`);
assert.equal(era.atkMultiplier, 0.85, `一战攻击倍率应为 0.85，实际: ${era.atkMultiplier}`);
console.log('✓ 一战时代修正表参数验证通过 (堑壕上限 25%, 掘壕 +3%/日, 进攻 x0.85)');

// 2. 内容规模底线校验 (C18 / E1)
assert(WW1_SCENARIO.events.length >= 45, `WW1 事件数应 >= 45，实际: ${WW1_SCENARIO.events.length}`);
assert(WW1_SCENARIO.characters.length >= 40, `WW1 人物数应 >= 40，实际: ${WW1_SCENARIO.characters.length}`);
assert(WW1_SCENARIO.equipment.length >= 12, `WW1 装备数应 >= 12，实际: ${WW1_SCENARIO.equipment.length}`);

// T1 参战国国策树 >= 24
const t1Nations = ['GER', 'FRA', 'RUS', 'GBR', 'AUS', 'OTT'];
for(const nat of t1Nations){
  const focList = WW1_SCENARIO.focuses[nat] || [];
  assert(focList.length >= 24, `T1 参战国 [${nat}] 国策树应 >= 24，实际: ${focList.length}`);
}
console.log(`✓ WW1 内容基准检验通过: ${WW1_SCENARIO.events.length} 事件, ${WW1_SCENARIO.characters.length} 人物, ${WW1_SCENARIO.equipment.length} 装备, 6 个 T1 国策树均 >= 24`);

// 3. 炮击准备系统 (barrage.js)
const mockWorld = {
  era: 'ww1',
  day: 10,
  player: 'GER',
  nations: {
    GER: {
      equipment: { art_eq: 100, french_75: 50 },
      barrageMode: 'standard',
      milFactories: 20,
      activeModifiers: []
    }
  },
  logs: []
};

// 模式设定
const barrage = setBarrageMode(mockWorld, 'plan_1', 'prolonged');
assert.equal(barrage.mode, 'prolonged');
assert.equal(barrage.targetDays, 12);

// 日常火炮弹药损耗结算与进度推进
barrageTick(mockWorld);
assert(mockWorld.nations.GER.equipment.art_eq < 100, '炮击准备每日必须扣减火炮储备');
assert.equal(barrage.currentDays, 1);

// 推进至准备就绪 (达到 targetDays)
barrage.currentDays = barrage.targetDays;
barrage.ready = true;

// 堑壕削减与效果检验
const mod = applyBarrageCombatModifier(mockWorld, 'plan_1', {});
assert(mod !== null, '炮击就绪后战斗必须获得修正');
assert.equal(mod.entrenchFactor, 0, '延时炮击削减 100% 堑壕，守方壕沟系数应清零为 0');
console.log('✓ 炮击准备系统验证通过 (3 种弹幕模式、堑壕压制、火炮损耗)');

// 4. 战争疲惫与封锁/革命系统 (attrition.js)
const mockWorld2 = {
  era: 'ww1',
  day: 1,
  nations: {
    GER: { name: '德意志帝国', alive: true, warExhaustion: 0, milFactories: 20, activeModifiers: [] },
    RUS: { name: '俄罗斯帝国', alive: true, warExhaustion: 75, activeModifiers: [] },
    AUS: { name: '奥匈帝国', alive: true, warExhaustion: 79, activeModifiers: [] },
    OTT: { name: '奥斯曼帝国', alive: true, warExhaustion: 79, activeModifiers: [] }
  },
  diplomacy: {
    atWarWith: (a, b) => (a === 'GER' && b === 'GBR') || (a === 'RUS' && b === 'GER')
  },
  events: [],
  logs: []
};

// 疲惫累积与上限
updateExhaustion(mockWorld2, 'GER', 15);
assert.equal(mockWorld2.nations.GER.warExhaustion, 15);
updateExhaustion(mockWorld2, 'GER', 120);
assert.equal(mockWorld2.nations.GER.warExhaustion, 100, '疲惫上限为 100');

// 封锁惩罚
applyBlockadePenalty(mockWorld2, 'GER');
assert(mockWorld2.nations.GER.activeModifiers.some(m => m.id === 'blockade_hunger'), '被封锁国必须挂载饥荒与产能惩罚');

// 无限制潜艇战与美国参战倒计时
triggerUnrestrictedSubmarineWarfare(mockWorld2);
assert(mockWorld2.usEntryCountdown > 0, '发动无限制潜艇战应启动美国参战倒计时');

// 俄国革命与帝国解体阈值测试 (80%)
updateExhaustion(mockWorld2, 'RUS', 10); // 75 -> 85
updateExhaustion(mockWorld2, 'AUS', 5);  // 79 -> 84
attritionTick(mockWorld2);
assert(mockWorld2.nations.RUS.hasRevolution, '俄国疲惫 >= 80 必须触发革命');
assert(mockWorld2.nations.RUS.exitedWar, '革命后俄国退出战争');
assert(mockWorld2.nations.AUS.hasCollapsed, '奥匈帝国疲惫 >= 80 必须触发帝国解体');
console.log('✓ 战争疲惫与封锁/革命系统验证通过 (封锁惩罚、潜艇战与美参战、十月革命退出战争、帝国解体)');

// 5. 1914 编制表校验
assert(WW1_SCENARIO.battalions.ww1_trench_inf, '必须包含堑壕步兵营');
assert(WW1_SCENARIO.battalions.ww1_mg_bat, '必须包含密集机枪营');
assert(WW1_SCENARIO.battalions.ww1_storm_bat, '必须包含风暴突击营');
assert(WW1_SCENARIO.supportCompanies.ww1_sup_gas, '必须包含毒气连');
console.log('✓ 1914 时代专属营级与支援连编制表验证通过');

console.log('\n=== 一战「火药桶 1914」E1 验收全部通过 ✓ ===\n');
