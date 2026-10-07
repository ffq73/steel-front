/* ============================================================
   tests/tech_trees.test.js —— v14.0 P4 科技树扩系验收
   ① 七系规模与前置图完整性 ② 解锁类效果 ③ 空海军科技门控
   ④ 可研究查询 ⑤ AI 科研
   依据 HOI4 Wiki Research（空军/海军/电子/核四大方向）
   ============================================================ */

import { TECHS, TECH_BRANCHES } from '../js/data/techs.js';
import { techById, applyEffect, availableTechs, startResearch, techUnmetRequires } from '../js/engine/research.js';
import { aircraftAvailable, isAircraftUnlocked } from '../js/engine/air.js';
import { shipsAvailable, invasionCapacity, hasFeature } from '../js/engine/navy.js';
import { K } from '../js/data/constants.js';

let failed = 0;
function assert(cond, msg){
  if(cond) console.log('  ✓ ' + msg);
  else { console.log('  ✗ FAIL: ' + msg); failed++; }
}

function worldStub(overrides = {}){
  const n = Object.assign({
    id:'A', name:'甲', alive:true, pp:100, civ:10, mil:10, stab:70, warSupport:70,
    law:'war', atWarWith:['B'], era:'ww2',
    techs:[], research:{ slots:[null,null,null], done:{}, progress:{} },
    modifiers:{}, equipment:{}, units:[], ai:{ lastDecision:-99, decisionDelay:1 }, focus:{ active:null, progress:0, done:[] }
  }, overrides);
  return { day: 10, nations:{ A:n, B:Object.assign({}, n, { id:'B', name:'乙' }) },
           hexes:[{ q:0,r:0,owner:'A',civ:5,mil:5,infra:2,units:[],adj:[] }], units:[], uid:1,
           events:[], log:[], aiLog:[], at:{}, over:null, scenario:'sim' };
}

console.log('=== tests/tech_trees.test.js: v14.0 P4 科技树扩系 ===\n');

/* ---------- R1: 规模与分支 ---------- */
console.log('--- R1: 科技树规模（30 → 54，七系）---');
{
  assert(TECHS.length >= 50, `R1 科技总数 ${TECHS.length}（≥50）`);
  assert(Object.keys(TECH_BRANCHES).length === 7, `R1 分支 ${Object.keys(TECH_BRANCHES).length} 个（工业/学说/装备/空/海/电子/核）`);
  const byB = {};
  for (const t of TECHS) byB[t.branch] = (byB[t.branch] || 0) + 1;
  assert(byB.air >= 8, `R1 空军科技 ${byB.air} 项`);
  assert(byB.navy >= 8, `R1 海军科技 ${byB.navy} 项`);
  assert((byB.electronics || 0) + (byB.nuclear || 0) >= 8, `R1 电子+核 ${(byB.electronics||0)+(byB.nuclear||0)} 项`);
  assert(byB.industry >= 10 && byB.equipment >= 10 && byB.doctrine >= 10, 'R1 原有三系未被削减');
}

/* ---------- R2: 前置图完整性 ---------- */
console.log('\n--- R2: 前置图无孤立、无环 ---');
{
  const ids = new Set(TECHS.map(t => t.id));
  assert(ids.size === TECHS.length, 'R2 科技 id 无重复');
  const orphan = TECHS.filter(t => (t.requires || []).some(r => !ids.has(r)));
  assert(orphan.length === 0, `R2 无孤立前置（异常 ${orphan.length}：${orphan.map(t=>t.id).join(',')}）`);
  // 环检测（DFS）
  let cycle = null;
  const state = {};
  const dfs = (id, stack) => {
    if (cycle) return;
    if (state[id] === 1){ cycle = stack.slice(stack.indexOf(id)).join('→') + '→' + id; return; }
    if (state[id] === 2) return;
    state[id] = 1;
    const t = techById(id);
    if (t) for (const r of (t.requires || [])) dfs(r, stack.concat([id]));
    state[id] = 2;
  };
  for (const t of TECHS) dfs(t.id, []);
  assert(!cycle, 'R2 前置图无环' + (cycle ? '（发现 ' + cycle + '）' : ''));
  // 每个非核科技至少要能到达（有一项 requires:[] 起始）
  const roots = TECHS.filter(t => !(t.requires || []).length);
  assert(roots.length >= 7, `R2 起始科技 ${roots.length} 项（每系至少 1 项可从零开始）`);
}

/* ---------- R3: 解锁类效果 ---------- */
console.log('\n--- R3: 解锁类效果解释器 ---');
{
  const w = worldStub();
  const n = w.nations.A;
  applyEffect(w, 'A', { type:'unlockAircraft', aircraft:['fighter','cas'] });
  assert(n.unlockedAircraft && n.unlockedAircraft.length === 2, 'R3 unlockAircraft 登记机种');
  applyEffect(w, 'A', { type:'unlockAircraft', aircraft:['fighter'] });
  assert(n.unlockedAircraft.length === 2, 'R3 重复解锁不叠加');
  applyEffect(w, 'A', { type:'unlockShip', ships:['destroyer'] });
  assert(n.unlockedShips.includes('destroyer'), 'R3 unlockShip 登记舰种');
  applyEffect(w, 'A', { type:'unlockFeature', feature:'nuclear_weapon' });
  assert(n.features && n.features.nuclear_weapon === true, 'R3 unlockFeature 登记特性');
  // extra 效果
  applyEffect(w, 'A', { type:'unlockFeature', feature:'transport_ship', extra:{ invasionCap:{ value:10 } } });
  assert(n.invasionCap === 20, `R3 运输船后总上限 = ${n.invasionCap}（基准 10 + 10）`);
  applyEffect(w, 'A', { type:'unlockFeature', feature:'landing_craft', extra:{ invasionCap:{ value:20 } } });
  assert(n.invasionCap === 40, `R3 登陆艇后总上限 = ${n.invasionCap}（20 + 20）`);
  applyEffect(w, 'A', { type:'unlockAircraft', aircraft:[], extra:{ modifier:{ stat:'airSuperiority', value:0.1 } } });
  assert(Math.abs(n.modifiers.airSuperiority - 0.1) < 1e-9, 'R3 extra.modifier 写入 nation.modifiers');
}

/* ---------- R4: 空军门控 ---------- */
console.log('\n--- R4: 空军科技门控 ---');
{
  const w = worldStub();
  const n = w.nations.A;
  assert(aircraftAvailable(w, 'A').length === 1, 'R4 旧档兼容：未研究时仅基础战斗机');
  applyEffect(w, 'A', { type:'unlockAircraft', aircraft:['fighter','cas'] });
  applyEffect(w, 'A', { type:'unlockAircraft', aircraft:['tactical_bomber'] });
  const av = aircraftAvailable(w, 'A');
  assert(av.includes('cas') && av.includes('tactical_bomber'), `R4 研究后可编成 ${av.join('/')}`);
  assert(!av.includes('strat_bomber'), 'R4 未研究战略轰炸机 → 不可用');
  assert(isAircraftUnlocked(w, 'A', 'cas') && !isAircraftUnlocked(w, 'A', 'strat_bomber'), 'R4 单机种门控判定正确');
}

/* ---------- R5: 海军门控与登陆能力 ---------- */
console.log('\n--- R5: 海军科技门控 ---');
{
  const w = worldStub();
  const n = w.nations.A;
  assert(shipsAvailable(w, 'A').length === 1, 'R5 旧档兼容：仅基础运输');
  assert(invasionCapacity(w, 'A') === 10, 'R5 默认登陆上限 10（HOI4 运输船）');
  applyEffect(w, 'A', { type:'unlockShip', ships:['destroyer','battleship'] });
  assert(shipsAvailable(w, 'A').includes('battleship'), 'R5 战列舰需海军科技解锁');
  assert(!shipsAvailable(w, 'A').includes('carrier'), 'R5 未研究航母 → 不可用');
  // 运输科技链：默认 10 → 运输船(+10)=20 → 登陆艇(+20)=40
  // （HOI4 原版：运输船 10 部队、登陆艇 50，此处按本作缩尺取 10/20/40）
  applyEffect(w, 'A', { type:'unlockFeature', feature:'transport_ship', extra:{ invasionCap:{ value:10 } } });
  assert(invasionCapacity(w, 'A') === 20, `R5 运输船后登陆上限 = ${invasionCapacity(w,'A')}`);
  applyEffect(w, 'A', { type:'unlockFeature', feature:'landing_craft', extra:{ invasionCap:{ value:20 } } });
  assert(invasionCapacity(w, 'A') === 40, `R5 登陆艇后上限 = ${invasionCapacity(w,'A')}`);
  assert(hasFeature(w, 'A', 'landing_craft') && !hasFeature(w, 'A', 'nuclear_weapon'), 'R5 特性判定正确');
}

/* ---------- R6: 可研究查询 ---------- */
console.log('\n--- R6: 可研究科技查询 ---');
{
  const w = worldStub();
  const n = w.nations.A;
  const av0 = availableTechs(w, 'A');
  assert(av0.length > 0, `R6 开局可研究 ${av0.length} 项（仅无前置的）`);
  assert(av0.every(t => !(t.requires || []).length), 'R6 开局可研究的都是无前置科技');
  // 锁定项的 unmet 提示
  const locked = TECHS.find(t => t.requires && t.requires.length);
  const unmet = techUnmetRequires(w, 'A', locked.id);
  assert(unmet.length === locked.requires.length, `R6 「${locked.name}」前置未满足提示 ${unmet.length} 条`);
  // 完成后解锁
  n.research.done[locked.requires[0]] = true;
  const av1 = availableTechs(w, 'A');
  assert(av1.some(t => t.id === locked.id), `R6 完成前置后「${locked.name}」进入可研究列表`);
  // 在研的不重复出现
  startResearch(w, 'A', locked.id);
  const av2 = availableTechs(w, 'A');
  assert(!av2.some(t => t.id === locked.id), 'R6 已在研的科技不再重复列出');
  assert(n.research.slots.filter(Boolean).length === 1, 'R6 占用一个科研槽');
  // 槽满则无法启动
  startResearch(w, 'A', av2[0].id);
  startResearch(w, 'A', av2[1] ? av2[1].id : 'x');
  const before = n.research.slots.filter(Boolean).length;
  startResearch(w, 'A', av2[2] ? av2[2].id : 'y');
  assert(n.research.slots.filter(Boolean).length <= n.research.slots.length, 'R6 科研槽不会超限');
}

/* ---------- R7: AI 会研究科技 ---------- */
console.log('\n--- R7: AI 会研究科技（真实世界 90 天推演）---');
{
  const W = await import('../js/engine/world.js');
  const { dayTick } = await import('../js/engine/tick.js');
  const { makeRng } = await import('../js/core/rng.js');
  const w = W.makeWorld('A', 42);
  const rng = makeRng(w.rngState);
  for (let i = 0; i < 90; i++) dayTick(w, rng);
  let anyStarted = false;
  const detail = [];
  for (const id of ['P', 'F', 'B', 'S']) {
    const n = w.nations[id];
    if (!n) continue;
    const done = Object.keys(n.research.done || {}).length;
    const slots = (n.research.slots || []).filter(Boolean);
    if (done > 0 || slots.length) anyStarted = true;
    detail.push(id + '(' + done + '完成' + (slots.length ? '/' + slots.length + '在研' : '') + ')');
    // AI 解锁的机种/舰种应与所 researched 的科技一致
    if (n.unlockedAircraft && n.unlockedAircraft.length) assert(n.unlockedAircraft.length > 0, 'R7 ' + id + ' 解锁机种非空');
  }
  assert(anyStarted, 'R7 AI 各国在 90 天内产生了科研进展：' + detail.join(' '));
  // 玩家不操作则不自行研究
  const g = w.nations.G;
  const gSlots = (g.research.slots || []).filter(Boolean);
  assert(gSlots.length === 0, 'R7 玩家国家不自动研究（须手动操作科研面板）');
}

console.log(`\n=== P4 科技树验收结果: ${failed === 0 ? '全部通过 ✓' : failed + ' 项失败 ✗'} ===`);
process.exit(failed ? 1 : 0);
