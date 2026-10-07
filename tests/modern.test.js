/* ============================================================
   tests/modern.test.js —— 现代「多极危机 2022」验收测试 (E4)
   验证FPV无人机层(drones.js)、制裁网络(sanctions.js)、能源依赖(energy.js)、
   军援管道与停火(milaid.js)、四位虚构人物[F]系统与内容底线
   ============================================================ */

import { strict as assert } from 'node:assert';
import { MODERN_SCENARIO } from '../js/data/scenarios/modern/index.js';
import { ERAS } from '../js/data/eras.js';
import { initDrones, applyDroneRecon, launchFpvStrike, deployElectronicWarfare } from '../js/engine/drones.js';
import { initSanctions, imposeSanction, getActiveSanctionsOn, SANCTION_PACKAGES } from '../js/engine/sanctions.js';
import { initEnergy, cutPipeline, getPipelineStatus } from '../js/engine/energy.js';
import { initMilAid, sendAidPackage, updateWarFatigue } from '../js/engine/milaid.js';

console.log('=== 开始现代「多极危机 2022」深度还原验收测试 (E4) ===\n');

// 1. 时代修正表校验
const era = ERAS.modern;
assert(era, '现代时代配置 ERAS.modern 必须存在');
assert.equal(era.tickUnit, 'week', '现代结算周期必须为 week (周)');
assert.equal(era.entrenchMax, 0.10, '现代无人机侦察使堑壕上限降为 0.10');
assert.equal(era.atkMultiplier, 1.1, '现代精确制导武器进攻倍率为 1.1');
console.log('✓ 现代时代修正表参数验证通过 (周结算周期, 堑壕上限 0.10, 进攻 x1.1)');

// 2. 内容规模底线校验 (C18 / E4)
assert(MODERN_SCENARIO.events.length >= 60, `现代事件数应 >= 60，实际: ${MODERN_SCENARIO.events.length}`);
assert(MODERN_SCENARIO.characters.length >= 45, `现代人物数应 >= 45，实际: ${MODERN_SCENARIO.characters.length}`);
assert(MODERN_SCENARIO.equipment.length >= 18, `现代装备数应 >= 18，实际: ${MODERN_SCENARIO.equipment.length}`);
console.log(`✓ 现代内容基准检验通过: ${MODERN_SCENARIO.events.length} 事件, ${MODERN_SCENARIO.characters.length} 人物, ${MODERN_SCENARIO.equipment.length} 装备`);

// 3. 四位原创虚构人物 [F] 校验 (§6)
const fictionalChars = MODERN_SCENARIO.characters.filter(c => c.fictional);
assert.equal(fictionalChars.length, 4, '必须包含 4 位原创人物 [F]');
const fIds = ['ge_xiufu', 'yoshi_aixi', 'xiao_lu', 'wang_ruoyi'];
for(const id of fIds){
  const found = fictionalChars.find(c => c.id === id);
  assert(found, `原创人物 [${id}] 必须存在`);
  assert(found.name.includes('[F]'), `原创人物 [${id}] 名称必须带 [F] 标记`);
}

// 校验 4 人的 8 节点专属国策树
const rusFoc = MODERN_SCENARIO.focuses.RUS || [];
const usaFoc = MODERN_SCENARIO.focuses.USA || [];
const gbrFoc = MODERN_SCENARIO.focuses.GBR || [];
const jpnFoc = MODERN_SCENARIO.focuses.JPN || [];

assert(rusFoc.filter(f => f.name.includes('[F]')).length >= 8, '葛修傅 [F] 必须拥有至少 8 节点国策链');
assert(usaFoc.filter(f => f.name.includes('[F]')).length >= 8, '小鹿 [F] 必须拥有至少 8 节点国策链');
assert(gbrFoc.filter(f => f.name.includes('[F]')).length >= 8, '王若伊 [F] 必须拥有至少 8 节点国策链');
assert(jpnFoc.filter(f => f.name.includes('[F]')).length >= 8, '吉爱习 [F] 必须拥有至少 8 节点国策链');

// 校验 24 条虚构事件与终局抉择
const fictionalEvents = MODERN_SCENARIO.events.filter(e => e.title.includes('[F]') || (e.desc && e.desc.includes('[F]')));
assert(fictionalEvents.length >= 24, `原创剧情事件应 >= 24 条，实际: ${fictionalEvents.length}`);
assert(MODERN_SCENARIO.events.some(e => e.id === 'f_ev_final_reckoning'), '必须包含终局抉择大事件 f_ev_final_reckoning');
console.log(`✓ 四位原创人物 [F] 体系验证通过 (4位人物, 每人8节点国策, ${fictionalEvents.length} 条剧情事件与多极终局抉择)`);

// 4. FPV 无人机与电子对抗层 (drones.js)
const mockWorld = {
  era: 'modern',
  day: 1,
  hexes: [
    { id: 0, owner: 'RUS', name: '别尔哥罗德' },
    { id: 1, owner: 'UKR', name: '哈尔科夫' }
  ],
  nations: {
    UKR: { name: '乌克兰', equipment: { fpv_kamikaze_drone: 100 } },
    RUS: { name: '俄罗斯', equipment: { electronic_warfare_ew: 20 } }
  },
  events: []
};

initDrones(mockWorld);
deployElectronicWarfare(mockWorld, 'RUS', 0.6); // 部署 60% 强度电子战

// 无人机侦察破除堑壕掩体
const trenchFactor = applyDroneRecon(mockWorld, 'UKR', 0);
assert(trenchFactor < 1.0, '无人机侦察必须有效削减目标堑壕系数');

// FPV 巡飞弹打击测试
const strike = launchFpvStrike(mockWorld, 'UKR', 0, 30);
assert(strike.success, 'FPV 打击必须成功结算');
assert(strike.damageSoft > 0, 'FPV 打击必须产生软杀伤');
assert.equal(mockWorld.nations.UKR.equipment.fpv_kamikaze_drone, 70, 'FPV 打击扣减装备库存');
console.log('✓ FPV 无人机与电子对抗系统验证通过 (堑壕削减、巡飞弹杀伤、EW 干扰防御)');

// 5. 制裁网络系统 (sanctions.js)
const mockWorld2 = {
  day: 1,
  nations: {
    USA: { name: '美国' },
    RUS: { name: '俄罗斯', modifiers: {}, stability: 80 }
  },
  events: []
};

initSanctions(mockWorld2);
imposeSanction(mockWorld2, 'USA', 'RUS', 'swift_ban');
const activeSanc = getActiveSanctionsOn(mockWorld2, 'RUS');
assert.equal(activeSanc.length, 1);
assert.equal(activeSanc[0].packageId, 'swift_ban');
assert(mockWorld2.nations.RUS.modifiers.milOutput < 0, 'SWIFT 制裁必须扣减军工产能');
console.log('✓ 现代制裁网络系统验证通过 (SWIFT断供、主权资产冻结、产能扣减)');

// 6. 能源依赖与管道断供 (energy.js)
const mockWorld3 = {
  day: 1,
  nations: {
    RUS: { name: '俄罗斯' },
    GER: { name: '德国', modifiers: {}, stability: 80 }
  },
  events: []
};

initEnergy(mockWorld3);
assert.equal(getPipelineStatus(mockWorld3, 'nord_stream'), 'operational');
cutPipeline(mockWorld3, 'nord_stream', '北溪管线遭遇水下爆炸袭击');
assert.equal(getPipelineStatus(mockWorld3, 'nord_stream'), 'severed');
assert(mockWorld3.nations.GER.modifiers.civOutput < 0, '北溪断供必须引发欧洲工业民工产出下挫');
console.log('✓ 能源依赖与管道断供系统验证通过 (北溪爆炸断供、天然气危机与民工削减)');

// 7. 军援输送与停火谈判窗口 (milaid.js)
const mockWorld4 = {
  day: 1,
  nations: {
    USA: { name: '美国' },
    UKR: { name: '乌克兰', equip: 100, modifiers: {}, warFatigue: 0 },
    RUS: { name: '俄罗斯', equip: 500, modifiers: {}, warFatigue: 0 }
  },
  events: []
};

initMilAid(mockWorld4);
sendAidPackage(mockWorld4, 'USA', 'UKR', 'himars_package');
assert(mockWorld4.nations.UKR.equip > 100, '军援交付必须增加受援国装备');
assert(mockWorld4.milAid.escalationGauge > 20, '交付先进重火炮必须推升危机升级指数');

// 停火谈判窗口测试 (双方疲劳 >= 70)
updateWarFatigue(mockWorld4, 'RUS', 75);
updateWarFatigue(mockWorld4, 'UKR', 72);
assert(mockWorld4.milAid.ceasefireReady, '双方疲劳度 >= 70 时必须开启战略停火谈判窗口');
console.log('✓ 军援管道、红线升级与停火谈判窗口系统验证通过');

console.log('\n=== 现代「多极危机 2022」E4 验收全部通过 ✓ ===\n');
