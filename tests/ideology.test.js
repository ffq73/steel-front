/* ============================================================
   tests/ideology.test.js —— v14.0 P3 意识形态与执政党验收
   ① 四意识形态与亚形态 ② 支持度日漂移 ③ 公投/内战改换
   ④ 外交合法性（民主主义禁战）⑤ 傀儡规则 ⑥ 和会接入
   依据 HOI4（萌娘百科「政治派别」）：意识形态影响 AI 行为、外交合法性与和会结果
   ============================================================ */

import { IDEOLOGIES, IDEOLOGY_FACTIONS, ERA_IDEOLOGY, PUPPET_TIERS, getIdeology } from '../js/data/ideology.js';
import { initIdeology, ideologyTick, factionSupport, canHoldReferendum, holdReferendum,
         canStartCivilWar, startCivilWar, civilWarTick, applyIdeology,
         warJustifyLegality, REFERENDUM_COST } from '../js/engine/ideology.js';
import { makeWorld, spawnUnit } from '../js/engine/world.js';
import { dayTick } from '../js/engine/tick.js';
import { makeRng } from '../js/core/rng.js';

let failed = 0;
function assert(cond, msg){
  if(cond) console.log('  ✓ ' + msg);
  else { console.log('  ✗ FAIL: ' + msg); failed++; }
}

console.log('=== tests/ideology.test.js: v14.0 P3 意识形态 ===\n');

/* ---------- D1: 四意识形态与亚形态 ---------- */
console.log('--- D1: 四意识形态与亚形态（HOI4 政治派别）---');
{
  assert(Object.keys(IDEOLOGIES).length === 4, 'D1 四种意识形态');
  assert(IDEOLOGIES.democratic.canPuppet === false, 'D1 民主主义不得傀儡他国 [H]');
  assert(IDEOLOGIES.fascism.justifySpeed === 1.8, 'D1 法西斯主义战争理由快 80% [H]');
  assert(IDEOLOGIES.fascism.aiAggression > IDEOLOGIES.democratic.aiAggression, 'D1 法西斯 AI 侵略性 > 民主');
  assert(IDEOLOGIES.fascism.puppetTier === 'pupil', 'D1 法西斯傀儡默认专员辖区（更低）[H]');
  assert(IDEOLOGIES.neutrality.ideologyChangeResist === 0.30, 'D1 中立主义抵制意识形态变化 30% [H]');
  for(const k in IDEOLOGIES){
    const facs = IDEOLOGY_FACTIONS[k] || [];
    assert(facs.length >= 3, `D1 ${IDEOLOGIES[k].name} 有 ${facs.length} 个亚形态（HOI4 每派 3-5 个）`);
  }
  assert(Object.keys(ERA_IDEOLOGY).length === 4, 'D1 四个时代都有初始意识形态表');
}

/* ---------- D2: 初始化与史实对应 ---------- */
console.log('\n--- D2: 建世界初始化（史实对应）---');
{
  const w = makeWorld('A', 42);
  const g = w.nations.G, p = w.nations.P, s = w.nations.S, b = w.nations.B;
  assert(g.ideology === 'fascism', 'D2 1939 德国 = 法西斯主义');
  assert(p.ideology === 'democratic' && b.ideology === 'democratic', 'D2 波兰/英国 = 民主主义');
  assert(s.ideology === 'communism', 'D2 苏联 = 共产主义');
  assert(!!g.ideologyFaction && !!g.rulingSupport, 'D2 亚形态与执政党支持度已初始化');
  assert(p.rulingSupport > g.rulingSupport, `D2 民主国家执政党支持更高（波 ${Math.round(p.rulingSupport)}% > 德 ${Math.round(g.rulingSupport)}%）`);
}

/* ---------- D3: 支持度日漂移 ---------- */
console.log('\n--- D3: 政党支持度日漂移 [H] ---');
{
  const w = makeWorld('A', 42);
  const n = w.nations.G;
  n.rulingSupport = 50; n.warSupport = 70; n.stability = 70;
  ideologyTick(w);
  const up = n.rulingSupport > 50;
  assert(up, `D3 和平稳定时执政党支持度上升 50 → ${n.rulingSupport.toFixed(3)}`);
  // 战争不力会拖慢
  const n2 = w.nations.P;
  n2.rulingSupport = 50; n2.warSupport = 20; n2.stability = 30;
  ideologyTick(w);
  assert(n2.rulingSupport < 50.02, `D3 战争支持度低时涨幅被压制 → ${n2.rulingSupport.toFixed(3)}`);
  // 上限封顶
  n.rulingSupport = 99.99;
  for (let i = 0; i < 50; i++) ideologyTick(w);
  assert(n.rulingSupport <= 100, `D3 支持度不超过 100（${n.rulingSupport.toFixed(2)}）`);
  // 派系支持度分配
  const fac = IDEOLOGY_FACTIONS.democratic[1];
  const fs = factionSupport(w.nations.P, fac.id);
  assert(fs >= 0 && fs < 100, `D3 非执政派系支持度 ${fs.toFixed(1)}%`);
}

/* ---------- D4: 公投改换 ---------- */
console.log('\n--- D4: 公投改换意识形态 [H] ---');
{
  const w = makeWorld('A', 42);
  const n = w.nations.P;
  n.pp = 200; n.rulingSupport = 62; n.stability = 70;
  const chk = canHoldReferendum(w, 'P', 'communism');
  assert(chk.ok, 'D4 支持度 62% > 50% → 可公投');
  const r = holdReferendum(w, 'P', 'communism');
  assert(r.ok, `D4 公投成功：${r.msg}`);
  assert(n.ideology === 'communism', 'D4 意识形态已改换为共产主义');
  assert(n.pp === 100, `D4 扣除 100 PP（200 → ${n.pp}）`);
  // 条件不足
  n.rulingSupport = 45;
  const chk2 = canHoldReferendum(w, 'P', 'fascism');
  assert(!chk2.ok && chk2.reason.includes('50'), `D4 支持度不足被拒：${chk2.reason}`);
  n.rulingSupport = 62; n.pp = 50;
  assert(!canHoldReferendum(w, 'P', 'fascism').ok, 'D4 PP 不足被拒');
}

/* ---------- D5: 内战改换 ---------- */
console.log('\n--- D5: 内战改换意识形态 [H] ---');
{
  const w = makeWorld('A', 42);
  const rng = makeRng(9);
  const n = w.nations.P;
  n.stability = 40; n.rulingSupport = 30; n.pp = 100;
  const own = w.hexes.filter(h => h.owner === 'P').slice(0, 2);
  for (let i = 0; i < 6; i++) spawnUnit(w, 'inf', own[i % own.length].q, own[i % own.length].r, 'P');
  const before = w.units.filter(u => u.nat === 'P').length;
  const chk = canStartCivilWar(w, 'P', 'communism');
  assert(chk.ok, 'D4 稳定度 40% < 50% → 可发动内战');
  const r = startCivilWar(w, 'P', 'communism');
  assert(r.ok, `D5 内战爆发：${r.msg}`);
  const rebelId = w.nations.P.civilWar.rebel;
  assert(!!w.nations[rebelId], 'D5 叛军国家已建立');
  const rebels = w.units.filter(u => u.nat === rebelId);
  assert(rebels.length === Math.floor(before / 2), `D5 一半部队倒戈（${before} → 叛军 ${rebels.length}）`);
  assert(rebels.every(u => u.hp <= 100), 'D5 叛军装备折半');
  assert(n.atWarWith.includes(rebelId), 'D5 双方进入交战状态');
  // 平叛胜利
  for (const u of rebels) u.hp = 0;
  w.units = w.units.filter(u => u.hp > 0);
  civilWarTick(w);
  assert(n.ideology === 'communism', 'D5 平叛胜利后改换意识形态');
  assert(!w.nations[rebelId], 'D5 叛军国家已清理');
  assert(!n.civilWar, 'D5 内战状态已结束');
  // 条件不足
  n.stability = 70;
  assert(!canStartCivilWar(w, 'P', 'fascism').ok, 'D5 稳定度 ≥50% 不可内战');
}

/* ---------- D6: 外交合法性 ---------- */
console.log('\n--- D6: 意识形态与宣战合法性 [H] ---');
{
  const w = makeWorld('A', 42);
  const dem = warJustifyLegality(w, 'F', 'B');       // 法国(民主) → 英国(民主)
  assert(!dem.allowed, 'D6 民主主义对民主国家禁战');
  assert(dem.reason.includes('民主主义'), 'D6 给出可读原因');
  const fas = warJustifyLegality(w, 'G', 'F');       // 德国(法西斯) → 法国(民主)
  assert(fas.allowed, 'D6 法西斯对民主国家可开战');
  assert(Math.abs(fas.speed - 1.8) < 1e-6, `D6 法西斯正当化速度 ×${fas.speed} [H]`);
  const com = warJustifyLegality(w, 'S', 'G');
  assert(com.allowed, 'D6 共产主义对法西斯可开战');
}

/* ---------- D7: 傀儡规则 ---------- */
console.log('\n--- D7: 和会傀儡规则 [H] ---');
{
  const w = makeWorld('A', 42);
  const { buildPeaceConference, applyPeaceAction } = await import('../js/engine/peace.js');
  // buildPeaceConference(world, loserId)：胜者取自败国的 atWarWith
  // 民主主义不得傀儡
  w.nations.P.atWarWith = ['F'];
  w.nations.P.capitulated = true;
  w.hexes.forEach(h => { if (h.owner === 'P') h.owner = 'F'; });   // 法国吞波兰
  w.pendingPeace = buildPeaceConference(w, 'P');   // 该函数只返回结果，由 victoryTick 挂到 world
  assert(!!w.pendingPeace, 'D7 和会已建立（败者 P，胜者 F）');
  const r1 = applyPeaceAction(w, 'F', 'puppet', {});
  assert(!r1.ok && r1.msg.includes('民主主义'), `D7 民主主义傀儡被拒：${r1.msg}`);
  // 法西斯可傀儡，且为专员辖区
  w.pendingPeace = null;
  w.nations.P.atWarWith = ['G'];
  w.nations.P.capitulated = true;
  w.hexes.forEach(h => { if (h.owner === 'F') h.owner = 'G'; });
  w.pendingPeace = buildPeaceConference(w, 'P');
  assert(!!w.pendingPeace, 'D7 第二次和会已建立（胜者 G）');
  const r2 = applyPeaceAction(w, 'G', 'puppet', {});
  assert(r2.ok, `D7 法西斯傀儡成立：${r2.msg || 'OK'}`);
  assert(w.nations.P.puppetTier === 'pupil', `D7 傀儡等级 = ${w.nations.P.puppetTier}（专员辖区）`);
  assert(Object.keys(PUPPET_TIERS).length === 2, 'D7 两种傀儡等级');
}

/* ---------- D8: 真实推演不崩溃 ---------- */
console.log('\n--- D8: 60 天推演集成 ---');
{
  const w = makeWorld('A', 42);
  const rng = makeRng(w.rngState);
  for (let i = 0; i < 60; i++) dayTick(w, rng);
  assert(!!w.nations.G.ideology, 'D8 推演后意识形态保持有效');
  assert(w.nations.G.rulingSupport >= 0 && w.nations.G.rulingSupport <= 100,
    `D8 支持度在合法区间（${w.nations.G.rulingSupport.toFixed(1)}）`);
  const cw = Object.keys(w.nations).filter(id => w.nations[id].isCivilWarRebel);
  assert(cw.length === 0, 'D8 无缘由内战产生叛军国家');
}

console.log(`\n=== P3 意识形态验收结果: ${failed === 0 ? '全部通过 ✓' : failed + ' 项失败 ✗'} ===`);
process.exit(failed ? 1 : 0);
