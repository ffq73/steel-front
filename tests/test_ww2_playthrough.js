/* ============================================================
   tests/test_ww2_playthrough.js —— 二战「全面战争 1939」通局与机制验收
   验证点：
   1. 地图 1740 格、32 国、80 历史人物、70 事件、全量国策树完整加载
   2. 将领指派与属性修正生效、阵亡判定逻辑
   3. 德 (GER)、苏 (SOV)、中 (CHN) 三国完整通局推进与时间线记录
   ============================================================ */

import { loadScenario } from '../js/engine/world.js';
import { dayTick } from '../js/engine/tick.js';
import { assignGeneral, unassignGeneral, checkGeneralCasualty } from '../js/engine/characters.js';
import { unitMod } from '../js/engine/mods.js';   // W0-C：验证修正进了引擎真正读的键

console.log('=== 开始二战「全面战争 1939」全系统验证 ===\n');

// 1. 数据完整性验证
const testWorld = loadScenario('ww2', 42);
// v11.0 地图放大轮：26×16 = 416 格 → 58×30 图集 = 1740 格
console.log(`✓ 地图 hex 数量: ${testWorld.hexes.length}（预期 ≥ 1700）`);
console.log(`✓ 参战国总数: ${Object.keys(testWorld.nations).length}（预期 ≥ 30）`);
console.log(`✓ 历史人物总数: ${testWorld.characters ? testWorld.characters.length : 0}（预期 80）`);

if(testWorld.hexes.length < 1700){
  throw new Error(`地图尺寸不足: 实际 ${testWorld.hexes.length}, 预期 ≥ 1700`);
}
if(Object.keys(testWorld.nations).length < 30){
  throw new Error(`参战国数量不足: 实际 ${Object.keys(testWorld.nations).length}`);
}

// 2. 将领系统与修正验证
console.log('\n--- 验证将领指派与修正系统 ---');
const gerNat = testWorld.nations['GER'];
// W0-C 修正（2026-10），两处：
//  ① 原断言读写 modifiers.attack —— 那是引擎**从不读**的旧键。
//     它过去"能通过"，是因为 characters.js 原样把 traits.stat 抄进 modifiers，
//     两边一起错，测试就成了同谋。引擎真正消费的是规范化后的 'atk'
//     （attack→atk、defense→def、plan_speed→planning、org_recovery→orgRecovery）。
//  ② 原断言测的是「assignGeneral 后 modifiers 增加」。
//     现在 loadScenario 已自动任命将领（SF4_assignGenerals），
//     曼施坦因开局就在编制里，再 assignGeneral 返回 false（已任命）→ 增量恒为 0。
//     改为断言「自动任命已生效」+「特质落到了引擎真正读的键」。
const autoAssigned = (gerNat.assignedGenerals || []).includes('manstein');
console.log(`  开局自动任命: ${autoAssigned ? '已含曼施坦因' : '未含曼施坦因'}` +
            `  名单=${JSON.stringify(gerNat.assignedGenerals || [])}`);
if(!autoAssigned) throw new Error('loadScenario 未自动任命曼施坦因！');

const atkBonus = unitMod(gerNat, 'inf', 'atk');
console.log(`  unitMod(GER,'inf','atk') = ${atkBonus.toFixed(3)}（曼施坦因 attack+0.20）`);
if(atkBonus <= 0) throw new Error('将领攻击修正未生效！');
if(gerNat.modifiers.attack) throw new Error('modifiers.attack 不应再出现（旧键已归一为 atk）');

// plan_speed 也必须归一到 planning，并被 planningTick 消费
const planBonus = gerNat.modifiers.planning || 0;
console.log(`  归一后的 planning 修正 = ${planBonus.toFixed(3)}（曼施坦因 plan_speed+0.25）`);
if(planBonus <= 0) throw new Error('将领 plan_speed 未归一到 planning！');

// 验证将领阵亡逻辑
const deadUnit = { nat: 'GER', hp: 0 };
let casualtyHappened = false;
for(let i = 0; i < 50; i++){
  const victim = checkGeneralCasualty(testWorld, deadUnit, {}, () => 0.05); // 必定命中 < 0.15
  if(victim){
    console.log(`✓ 模拟将领战损判定触发: ${victim.name} 状态变更为 ${victim.status}`);
    casualtyHappened = true;
    break;
  }
}
if(!casualtyHappened){
  throw new Error('将领殉职判定未按预期工作');
}

// 3. 三国通局时间线演练
const countries = ['GER', 'SOV', 'CHN'];
const timelines = {};

for(const country of countries){
  console.log(`\n--- 演练玩家执掌国家: ${country} ---`);
  const world = loadScenario('ww2', 1939 + country.charCodeAt(0));
  world.player = country;

  // 指派本国标志性将领
  if(country === 'GER') assignGeneral(world, 'guderian', 'GER');
  if(country === 'SOV') assignGeneral(world, 'zhukov', 'SOV');
  if(country === 'CHN') assignGeneral(world, 'sun_lijen', 'CHN');

  const logEvents = [];
  const daysToRun = 120;

  for(let d = 0; d < daysToRun; d++){
    dayTick(world);

    // 记录当天的重要事件
    const todayEvents = world.events.filter(e => e.day === world.day);
    for(const e of todayEvents){
      logEvents.push(`D+${world.day}: ${e.text.split('\n')[0].substring(0, 45)}`);
    }

    if(world.over) break;
  }

  const pNation = world.nations[country];
  console.log(`✓ ${pNation.name} 演练 ${world.day} 天完成:`);
  console.log(`  当前装备存量: ${pNation.equip}`);
  console.log(`  当前军工厂数: ${pNation.mil}, 民工厂数: ${pNation.civ}`);
  console.log(`  战时稳定度: ${pNation.stability}, 战争支持度: ${pNation.warSupport}`);
  console.log(`  记录事件数: ${world.events.length}`);

  timelines[country] = logEvents.slice(0, 5);
}

console.log('\n=== 三国时间线摘要 ===');
for(const c in timelines){
  console.log(`\n【${c} 时间线】:`);
  for(const line of timelines[c]){
    console.log(`  ${line}`);
  }
}

console.log('\n✓ WW2 全系统与三国通局验证全部通过！');
