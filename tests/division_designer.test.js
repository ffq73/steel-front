/* ============================================================
   tests/division_designer.test.js —— v14.0 P1 师编制深度验收
   ① 营列约束（一列不可混装类型）② 新营种与营宽 ③ 配给等级
   ④ 装备可靠性 → 组织恢复
   依据 HOI4 Wiki Land units：5 营 + 5 支援、营宽 2/3/1、elite/regular/reserve
   ============================================================ */

import { K } from '../js/data/constants.js';
import { BATTALIONS, SUPPORT_COMPANIES, REGIMENT_CLASS, TEMPLATE_TIERS,
         calcTemplateStats, validateTemplate, createDefaultTemplates,
         tierPriority, reliabilityRecoverFactor, unitTier, armyReliability } from '../js/engine/template.js';

let failed = 0;
function assert(cond, msg){
  if(cond) console.log('  ✓ ' + msg);
  else { console.log('  ✗ FAIL: ' + msg); failed++; }
}

console.log('=== tests/division_designer.test.js: v14.0 P1 师编制深度 ===\n');

/* ---------- T1: 营种与营宽 ---------- */
console.log('--- T1: 营种完备性与营宽（HOI4: 步2 炮3 防空/反坦克1）---');
{
  assert(Object.keys(BATTALIONS).length >= 10, `T1 战斗营种 ${Object.keys(BATTALIONS).length} 种（≥10）`);
  assert(BATTALIONS.inf_bat.width === 2, 'T1 步兵营宽度 2');
  assert(BATTALIONS.art_bat.width === 3, 'T1 炮兵营宽度 3');
  assert(BATTALIONS.aa_bat.width === 1, 'T1 防空营宽度 1（HOI4 原版）');
  assert(BATTALIONS.at_bat.width === 1, 'T1 反坦克营宽度 1（HOI4 原版）');
  assert(BATTALIONS.spart_bat.width === 3, 'T1 自行火炮营宽度 3（与线列炮兵同宽）');
  for(const id in SUPPORT_COMPANIES){
    assert(SUPPORT_COMPANIES[id].width === 0, `T1 支援连「${SUPPORT_COMPANIES[id].name}」不占战斗宽度`);
  }
  // 新营种的独有价值
  assert(BATTALIONS.aa_bat.airDefense > 0, 'T1 防空营提供对空火力');
  assert(BATTALIONS.at_bat.pierceBonus > 0, 'T1 反坦克营提供额外穿甲');
  assert(BATTALIONS.mtn_bat.terrainBonus && BATTALIONS.mtn_bat.terrainBonus.mount > 0, 'T1 山地营有地形加成');
  assert(BATTALIONS.marine_bat.amphibious === true, 'T1 海军陆战营有登陆标记');
}

/* ---------- T2: 营列约束 ---------- */
console.log('\n--- T2: 营列不可混装类型（HOI4 规则）---');
{
  const mixOk = { grid: [['inf_bat','inf_bat','inf_bat'], [], [], [], []], supports:['sup_eng'] };
  const v1 = validateTemplate(mixOk);
  assert(v1.ok, 'T2 同类营同列 → 合法');

  const mixed = { grid: [['inf_bat','art_bat'], [], [], [], []], supports:[] };
  const v2 = validateTemplate(mixed);
  assert(!v2.ok && v2.errors.some(e => e.msg.includes('混装')), 'T2 步兵+炮兵同列 → 判违规');

  const armor = { grid: [['tank_bat','tank_bat'], ['mot_bat','mot_bat'], [], [], []], supports:[] };
  assert(validateTemplate(armor).ok, 'T2 坦克列 + 摩托化列（同类不同营）→ 合法');

  const dupSup = { grid: [['inf_bat'],[],[],[],[]], supports:['sup_eng','sup_eng'] };
  const v3 = validateTemplate(dupSup);
  assert(!v3.ok && v3.errors.some(e => e.msg.includes('不可重复')), 'T2 支援连重复 → 判违规');

  const overSup = { grid: [], supports:['sup_eng','sup_art','sup_rec','sup_hos','sup_log','sup_eng'] };
  assert(!validateTemplate(overSup).ok, 'T2 支援连超过 5 个 → 判违规');
}

/* ---------- T3: 默认模板全部合法 ---------- */
console.log('\n--- T3: 默认模板合规 ---');
{
  const tpls = createDefaultTemplates();
  const ids = Object.keys(tpls);
  assert(ids.length >= 6, `T3 默认模板 ${ids.length} 个（≥6）`);
  let allOk = true;
  for(const id of ids){
    const v = validateTemplate(tpls[id]);
    if(!v.ok){ allOk = false; console.log('      ✗ ' + tpls[id].name + ': ' + v.errors.map(e=>e.msg).join(' / ')); }
  }
  assert(allOk, 'T3 全部默认模板通过营列校验');
  // sim B14 依赖：七步二炮战宽必须仍是 20
  const t72 = tpls.infantry_artillery_7_2;
  assert(t72 && calcTemplateStats(t72).width === 20, 'T3 七步二炮战宽仍为 20（sim B14 依赖）');
}

/* ---------- T4: 属性统计 ---------- */
console.log('\n--- T4: 属性统计（含新字段）---');
{
  const t = { grid: [['inf_bat','inf_bat','inf_bat'], ['art_bat','art_bat'], ['aa_bat'], ['at_bat'], []],
              supports:['sup_eng','sup_rec','sup_log'] };
  const st = calcTemplateStats(t);
  assert(st.width === 3*2 + 2*3 + 1 + 1, `T4 战斗宽度 = ${st.width}（9+6+1+1）`);
  assert(st.airDefense === 12, `T4 对空火力累加 = ${st.airDefense}`);
  assert(st.pierceBonus === 6, `T4 穿甲加成累加 = ${st.pierceBonus}`);
  assert(st.recon >= 1, `T4 侦察值来自侦察连 = ${st.recon}`);
  assert(st.supplyUse === -0.20, `T4 后勤连降低补给消耗 = ${st.supplyUse}`);
  assert(st.entrenchMax > 0.15, `T4 工兵连提高堑壕上限 = ${st.entrenchMax}`);
  assert(st.manpower > 0 && st.equipNeeded.inf_eq > 0, 'T4 人力与装备需求已统计');
}

/* ---------- T5: 配给等级 ---------- */
console.log('\n--- T5: 配给等级 elite/regular/reserve ---');
{
  assert(Object.keys(TEMPLATE_TIERS).length === 3, 'T5 三档配给等级');
  assert(tierPriority('elite') < tierPriority('regular'), 'T5 精锐师优先于常规师');
  assert(tierPriority('regular') < tierPriority('reserve'), 'T5 常规师优先于预备师');
  const world = { templates: { a: { tier:'elite' }, b: { tier:'reserve' }, c: {} }, units:[] };
  assert(unitTier(world, { templateId:'a' }) === 'elite', 'T5 从模板读取配给等级');
  assert(unitTier(world, { templateId:'b' }) === 'reserve', 'T5 预备师识别');
  assert(unitTier(world, { templateId:'c' }) === 'regular', 'T5 缺省为常规师');
  assert(unitTier(world, {}) === 'regular', 'T5 无模板时为常规师');
  assert(K.TIER_RECOVER_MUL.elite > K.TIER_RECOVER_MUL.regular &&
         K.TIER_RECOVER_MUL.regular > K.TIER_RECOVER_MUL.reserve,
         `T5 恢复率加成递减：精锐 ${K.TIER_RECOVER_MUL.elite} > 常规 ${K.TIER_RECOVER_MUL.regular} > 预备 ${K.TIER_RECOVER_MUL.reserve}`);
}

/* ---------- T6: 装备可靠性 ---------- */
console.log('\n--- T6: 装备可靠性 → 组织恢复 ---');
{
  assert(K.RELIABILITY_START === 1.0, 'T6 新装备可靠性 100%');
  assert(K.RELIABILITY_MIN === 0.5, 'T6 可靠性下限 50%（HOI4 磨损报废线）');
  const full = reliabilityRecoverFactor(1.0);
  const worn = reliabilityRecoverFactor(0.5);
  assert(Math.abs(full - 1.0) < 1e-6, `T6 满可靠性恢复系数 ${full.toFixed(2)}`);
  assert(Math.abs(worn - 0.8) < 1e-6, `T6 半新装备恢复系数 ${worn.toFixed(2)}（衰减 20%）`);
  assert(reliabilityRecoverFactor(0.2) === reliabilityRecoverFactor(0.5), 'T6 低于下限按 0.5 计算');
  // 全军平均
  const world = { units: [
    { nat:'A', hp:100, reliability:1.0 }, { nat:'A', hp:100, reliability:0.6 }, { nat:'A', hp:0, reliability:0.5 }
  ]};
  const avg = armyReliability(world, 'A');
  assert(Math.abs(avg - 0.8) < 1e-6, `T6 全军平均可靠性 ${avg.toFixed(2)}（阵亡单位不计）`);
}

console.log(`\n=== P1 师编制验收结果: ${failed === 0 ? '全部通过 ✓' : failed + ' 项失败 ✗'} ===`);
process.exit(failed ? 1 : 0);
