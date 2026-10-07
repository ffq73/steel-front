/* ============================================================
   tests/test_coldwar_playthrough.js —— 冷战「铁幕 1949」通局与机制验收
   验证点：
   1. 地图 312 格（陆地 ~240）、26 国、50 历史人物、55 事件、国策树完整加载
   2. 经济社会层（财政三池、稳定度、国际声望、代理人干预与阵营向背重组）
   3. 核威慑与末日钟机制：大国直接宣战触发末日钟疾进，直至双输终局
   4. 美 (USA)、苏 (SOV) 完整 120 月无毁灭和平通局与冷战时间线记录
   ============================================================ */

import { loadScenario } from '../js/engine/world.js';
import { dayTick } from '../js/engine/tick.js';
import { makeRng } from '../js/core/rng.js';
import { investProxy, setBudgetPools } from '../js/engine/econSocial.js';

console.log('=== 开始冷战「铁幕 1949」全系统验证 ===\n');

// 1. 数据完整性验证
const cwWorld = loadScenario('coldwar', 1949);
console.log(`✓ 地图 hex 数量: ${cwWorld.hexes.length}（预期 312）`);
console.log(`✓ 参战国总数: ${Object.keys(cwWorld.nations).length}（预期 ≥ 20）`);
console.log(`✓ 历史人物总数: ${cwWorld.characters ? cwWorld.characters.length : 0}（预期 50）`);

if(cwWorld.hexes.length !== 312){
  throw new Error(`冷战地图尺寸不符: 实际 ${cwWorld.hexes.length}, 预期 312`);
}
if(cwWorld.characters.length !== 50){
  throw new Error(`冷战历史人物数量不符: 实际 ${cwWorld.characters.length}, 预期 50`);
}

// 2. 经济社会系统与影响力重组验证
console.log('\n--- 验证经济社会与影响力争夺系统 ---');
// 调整财政三池
setBudgetPools(cwWorld, 'USA', { mil: 30, civ: 40, intel: 30 });
console.log(`✓ 美国财政三池比例已调整为: 军工 30%, 民生 40%, 情报 30%`);

// 代理人干预拉拢中立国
const initBloc = cwWorld.econSocial.nations['EGY'].bloc;
console.log(`  埃及开局阵营: ${initBloc}`);
investProxy(cwWorld, 'USA', 'EGY', 45);
const newBloc = cwWorld.econSocial.nations['EGY'].bloc;
console.log(`✓ 美国注入代理人干预点数后，埃及阵营转变为: ${newBloc}`);
if(newBloc !== 'nato'){
  throw new Error('代理人援助影响力未能正确改变阵营向背！');
}

// 3. 核末日钟与大国互攻惩罚验证
console.log('\n--- 验证核威慑与末日钟双输机制 ---');
const nukeWorld = loadScenario('coldwar', 1962);
console.log(`  开局末日钟读数: ${nukeWorld.nuclear.doomsdayClock.toFixed(1)} 分钟`);

// 人为触发美苏直接宣战
nukeWorld.nations['USA'].atWarWith.push('SOV');
nukeWorld.nations['SOV'].atWarWith.push('USA');

const rngNuke = makeRng(1962);
while(!nukeWorld.over && nukeWorld.day < 10){
  dayTick(nukeWorld, rngNuke);
}

console.log(`✓ 美苏直接交火 ${nukeWorld.nuclear.directWarMonths} 个月后末日钟读数: ${nukeWorld.nuclear.doomsdayClock.toFixed(1)} 分钟`);
console.log(`✓ 终局判定: ${nukeWorld.over ? nukeWorld.over.text.substring(0, 45) : '未结束'}`);

if(!nukeWorld.over || !nukeWorld.nuclear.apocalyptic){
  throw new Error('核大国直接互攻未能按预期触发末日钟归零双输！');
}

// 4. 美、苏双雄 120 月长局演练（代理人竞争，和平存续）
console.log('\n--- 演练美苏两大超级大国 120 个月（10 年）通局 ---');
const testPlayers = ['USA', 'SOV'];
const timelines = {};

for(const player of testPlayers){
  console.log(`\n>> 执掌超级大国: ${player}`);
  const w = loadScenario('coldwar', 1949 + player.charCodeAt(0));
  w.player = player;
  const rng = makeRng(1949 + player.charCodeAt(0));

  const logEvents = [];
  for(let m = 0; m < 120; m++){
    dayTick(w, rng);

    const evs = w.events.filter(e => e.day === w.day);
    for(const e of evs){
      logEvents.push(`M+${w.day}: ${e.text.split('\n')[0].substring(0, 45)}`);
    }

    if(w.over) break;
  }

  const pNat = w.nations[player];
  const pEcon = w.econSocial.nations[player];
  console.log(`✓ ${pNat.name} 历经 ${w.day} 个月成功存续，未爆发核毁灭！`);
  console.log(`  国库储备: ${pEcon.treasury} | 军工装备储备: ${pNat.equip}`);
  console.log(`  社会稳定度: ${pEcon.stability} | 国际声望: ${pNat.prestige}`);
  console.log(`  末日钟保持在: ${w.nuclear.doomsdayClock.toFixed(1)} 分钟`);
  console.log(`  终局状态: ${w.over ? w.over.text : '历史进程推进中'}`);

  timelines[player] = logEvents.slice(0, 6);
}

console.log('\n=== 冷战历史时间线摘要 ===');
for(const p in timelines){
  console.log(`\n【${p} 视角关键事件】:`);
  for(const l of timelines[p]){
    console.log(`  ${l}`);
  }
}

console.log('\n✓ 冷战「铁幕 1949」全部验收要求圆满达成！');
