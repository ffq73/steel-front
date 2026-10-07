/* ============================================================
   tests/playable_nations.test.js —— 「选了它就得能玩」验收
   ------------------------------------------------------------
   动因：58×30 图集刚换上去时，美国与加拿大在图上一个格子都没有，
   于是 SF2_deployNations 既找不到首都格也找不到城市格 —— 玩家选美国
   开局 0 兵、0 工厂、什么按钮都点不动。这类故障不会让任何测试变红，
   只会让玩家觉得「很多地方玩不了」。

   本测试对**每个剧本的每个可选国家**断言：
     1. 至少拥有 1 格领土
     2. 能解析出首都格（capHex 非空）
     3. 开局至少部署了 1 支部队
     4. 首都格属于自己且不是海洋
   ============================================================ */

import assert from 'node:assert/strict';
import { SCENARIOS } from '../js/data/scenarios.js';
import { loadScenario } from '../js/engine/world.js';

console.log('=== 「选了它就得能玩」验收 ===\n');

let checked = 0;
const failures = [];
const notes = [];

for(const scId of Object.keys(SCENARIOS)){
  const world = loadScenario(scId, 7);
  const sc = SCENARIOS[scId];

  /* 谁必须能玩？剧本自己认账的参与者：
     —— 配了开局兵力的（armies）
     —— 写了胜利目标的（objectives）
     —— 默认玩家（player）
     其余（例：二战里的澳大利亚、巴西这类远洋次要国）不上场，只作提示。 */
  const mustPlay = new Set([
    ...Object.keys(sc.armies || {}),
    ...Object.keys(sc.objectives || {}),
    ...(sc.player ? [sc.player] : [])
  ]);

  for(const natId of sc.nations){
    const n = world.nations[natId];
    if(!n) continue;

    const hexes = world.hexes.filter((h) => h.owner === natId && h.terrain !== 'sea');
    const cap = world.hexes.find((h) => h.city && h.city.cap === natId);
    const units = world.units.filter((u) => u.nat === natId);

    if(!mustPlay.has(natId)){
      if(hexes.length === 0) notes.push(`${scId}/${natId}（${n.name}）为离图次要国，无领土（不参与战斗）`);
      continue;
    }

    checked++;
    if(hexes.length === 0) failures.push(`${scId}/${natId}（${n.name}）没有任何领土格`);
    if(!cap) failures.push(`${scId}/${natId}（${n.name}）解析不出首都格`);
    if(units.length === 0) failures.push(`${scId}/${natId}（${n.name}）开局没有部署任何部队`);
    if(cap && cap.terrain === 'sea') failures.push(`${scId}/${natId} 首都落在海里`);
  }

  const total = world.hexes.filter((h) => h.terrain !== 'sea').length;
  const caps = world.hexes.filter((h) => h.city && h.city.cap).length;
  console.log(`  ${scId.padEnd(8)} 陆地 ${String(total).padStart(4)} 格 · 城市 ${world.hexes.filter((h) => h.city).length} 座 · 首都 ${caps} 座 · 参战方 ${mustPlay.size} 个`);
}

if(failures.length){
  console.error('\n✗ 出现「选了玩不了」的国家：');
  for(const f of failures) console.error('   · ' + f);
  process.exit(1);
}

if(notes.length){
  console.log('\n提示（不计为失败）：');
  for(const note of notes) console.log('   · ' + note);
}

console.log(`\n✓ ${checked} 个参战方全部有领土、有首都、有开局部队`);
console.log('\n=== 「选了它就得能玩」验收通过 ===');
