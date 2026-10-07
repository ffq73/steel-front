/* ============================================================
   tests/template.test.js —— 师设计器与装备生产链单元测试 (P3)
   ============================================================ */

import { strict as assert } from 'node:assert';
import { BATTALIONS, SUPPORT_COMPANIES, calcTemplateStats, calcTemplateDiff, createDefaultTemplates, convertDivisionTemplate } from '../js/engine/template.js';
import { switchLineType, economyTick } from '../js/engine/economy.js';
import { makeWorld } from '../js/engine/world.js';
import { K } from '../js/data/constants.js';

console.log('=== 开始师设计器与装备生产链单元测试 ===\n');

// 1. 预设模板构建
const tmpls = createDefaultTemplates();
assert(tmpls.infantry_standard, '标准步兵师模板存在');
assert(tmpls.infantry_artillery_7_2, '七步二炮师模板存在');
assert(tmpls.panzer_division, '装甲突击师模板存在');
assert(tmpls.cavalry_brigade, '快速骑兵旅模板存在');
console.log('✓ 4套预设编制构建完整');

// 2. 标准步兵师属性
const sStd = calcTemplateStats(tmpls.infantry_standard);
assert.equal(sStd.width, 18, '标准步兵师战宽应为 18 (9营x2)');
assert.equal(sStd.softAtk, 54, '标准步兵师软攻应为 54 (9x6)');
assert.equal(sStd.org, 50, '标准步兵师组织度应为 50');
console.log('✓ 标准步兵师属性正确 (18宽/54软攻/50组织度)');

// 3. 七步二炮编制属性 (HOI4 经典 20 战宽)
const s72 = calcTemplateStats(tmpls.infantry_artillery_7_2);
assert.equal(s72.width, 20, '七步二炮战宽应严格等于 20 (7x2 + 2x3)');
assert.equal(s72.softAtk, 107, '七步二炮软攻应为 107 (7x6 + 2x25 + 15)');
assert.equal(s72.hardAtk, 12, '七步二炮硬攻应为 12');
assert(s72.softAtk >= 90, '七步二炮软攻需 >= 90');
console.log('✓ 七步二炮师属性精度完全吻合 (20战宽/107软攻)');

// 4. 装甲师与骑兵旅属性
const sArm = calcTemplateStats(tmpls.panzer_division);
assert.equal(sArm.width, 16, '装甲师战宽为 16');
assert.equal(sArm.armor, 0.45, '装甲师装甲率为 45%');
assert.equal(sArm.hardAtk, 81, '装甲师硬攻为 81');

const sCav = calcTemplateStats(tmpls.cavalry_brigade);
assert.equal(sCav.width, 8, '骑兵旅战宽为 8');
assert.equal(sCav.softAtk, 26, '骑兵旅软攻为 26');
console.log('✓ 装甲突击师与快速骑兵旅计算正确');

// 5. 编制调整 XP 消耗 (5 XP/槽)
const modified72 = JSON.parse(JSON.stringify(tmpls.infantry_artillery_7_2));
modified72.grid[0][0] = 'art_bat'; // 替换 1 个步兵营为炮兵营
const xpCost = calcTemplateDiff(tmpls.infantry_artillery_7_2, modified72);
assert.equal(xpCost, 5, '修改单个槽位消耗 5 陆军经验');
console.log('✓ 编制修改经验消耗正确 (5 XP/槽)');

// 6. 充足装备换装
const w = makeWorld(1939);
const unit = w.units.find(u => u.nat === 'G');
w.nations.G.equipment = { inf_eq: 2000, art_eq: 500, tank_eq: 500, truck_eq: 500, sup_eq: 500 };
const resFull = convertDivisionTemplate(w, unit, 'infantry_artillery_7_2');
assert.equal(resFull.hasDeficit, false, '库存充足时不应缺编');
assert.equal(resFull.fillRate, 1.0, '库存充足时满编率 100%');
console.log('✓ 库存充足换装满编率 100%');

// 7. 火炮缺失导致的缺编减员
w.nations.G.equipment = { inf_eq: 2000, art_eq: 0, tank_eq: 500, truck_eq: 500, sup_eq: 500 };
const resDeficit = convertDivisionTemplate(w, unit, 'infantry_artillery_7_2');
assert.equal(resDeficit.hasDeficit, true, '火炮为0换装七步二炮应判定缺编');
assert(resDeficit.fillRate < 1.0, '缺编时填装率应小于 1.0');
console.log(`✓ 火炮为0缺编判定成功 (填装率 ${(resDeficit.fillRate*100).toFixed(1)}%)`);

// 8. 生产线切换装备类型保留 50% 效率折损
const testLine = { id: 'l1', type: 'inf_eq', factories: 5, eff: 0.60, cap: 0.80 };
switchLineType(testLine, 'art_eq');
assert.equal(testLine.type, 'art_eq', '生产线类型已切换为 art_eq');
assert.equal(testLine.eff, 0.30, '生产线效率应折损为 50% (0.60 -> 0.30)');
console.log('✓ 生产线切换装备类型保留 50% 效率折损');

// 9. 生产线效率每日单调递增
const lineGrowth = { id: 'l2', type: 'inf_eq', factories: 5, eff: 0.10, cap: 0.50 };
const wMock = {
  player: 'G',
  difficulty: 'general',
  nations: {
    G: {
      alive: true,
      mil: 10,
      civ: 10,
      equip: 100,
      law: 'partial',
      modifiers: {},
      build: { kind: null },
      training: [],
      productionLines: [lineGrowth]
    }
  }
};
let prevEff = lineGrowth.eff;
for(let d = 0; d < 30; d++){
  economyTick(wMock);
  assert(lineGrowth.eff > prevEff, `第 ${d+1} 天效率应高于前一天`);
  prevEff = lineGrowth.eff;
}
assert(lineGrowth.eff > 0.10, '30 天后生产线效率显著提升');
console.log(`✓ 30天生产线效率单调递增 (0.10 -> ${lineGrowth.eff.toFixed(3)})`);

console.log('\n测试汇总: 全部通过 ✓');
