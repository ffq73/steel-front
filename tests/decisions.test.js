/* ============================================================
   tests/decisions.test.js —— v14.0 P2 决议系统验收
   依据 HOI4 通用决议表（萌娘百科）：决议消耗 PP 换取限时/即时效果
   ============================================================ */

import { DECISIONS, getDecision, DECISION_CATEGORIES } from '../js/data/decisions.js';
import { initDecisions, decisionRequirement, availableDecisions, fireDecision, cancelDecision, decisionsTick } from '../js/engine/decisions.js';
import { K } from '../js/data/constants.js';

let failed = 0;
function assert(cond, msg){
  if(cond) console.log('  ✓ ' + msg);
  else { console.log('  ✗ FAIL: ' + msg); failed++; }
}

function sandbox(overrides = {}){
  const n = {
    id:'A', name:'测试国', alive:true, capitulated:false,
    pp: 500, civ: 20, mil: 20, stability: 60, warSupport: 60, law:'war',
    atWarWith: ['B'], techs: [], research:{ slots:[null,null,null], done:{} },
    modifiers:{}, equipment:{}, resourceStock:{}, relations:{}
  };
  const world = {
    day: 10, nations:{ A:n, B:{ id:'B', name:'敌方', alive:true, relations:{}, atWarWith:['A'] } },
    hexes: [
      { q:0, r:0, owner:'A', terrain:'plain', infra:6, civ:5, mil:5, units:[], adj:[] },
      { q:1, r:0, owner:'A', terrain:'plain', infra:3, civ:4, mil:3, units:[], adj:[0] }
    ],
    events: []
  };
  world.hexes[0].adj = [1]; world.hexes[1].adj = [0];
  Object.assign(n, overrides);
  initDecisions(world);
  return { world, n };
}

console.log('=== tests/decisions.test.js: v14.0 P2 决议系统 ===\n');

/* ---------- D1: 数据完整性 ---------- */
console.log('--- D1: 决议数据表 ---');
{
  assert(DECISIONS.length >= 15, `D1 决议总数 ${DECISIONS.length} ≥ 15（HOI4 通用决议表量级）`);
  assert(DECISION_CATEGORIES.length === 4, 'D1 四个分类（和平/战时/经济/外交）');
  const ids = new Set(DECISIONS.map(d => d.id));
  assert(ids.size === DECISIONS.length, 'D1 决议 id 无重复');
  const badCat = DECISIONS.filter(d => !DECISION_CATEGORIES.some(c => c.id === d.cat));
  assert(badCat.length === 0, `D1 所有决议分类合法（异常 ${badCat.length} 个）`);
  const noDesc = DECISIONS.filter(d => !d.desc || d.desc.length < 8);
  assert(noDesc.length === 0, 'D1 每条决议都有可读描述');
  const needPP = DECISIONS.filter(d => d.cost > 0);
  assert(needPP.length >= 10, `D1 消耗 PP 的决议 ${needPP.length} 条（决议必须是 PP 阀门）`);
}

/* ---------- D2: 条件判定 ---------- */
console.log('\n--- D2: 前置条件判定 ---');
{
  const { world, n } = sandbox();
  // 战时限定
  n.atWarWith = [];
  let r = decisionRequirement(world, 'A', getDecision('emergency_industry'), world.hexes[0]);
  assert(!r.ok && r.reason.includes('战争'), `D2 战时限定生效：${r.reason}`);
  n.atWarWith = ['B'];
  r = decisionRequirement(world, 'A', getDecision('emergency_industry'), world.hexes[0]);
  assert(r.ok, 'D2 战争中解锁');

  // 法案限定
  n.law = 'peace';
  r = decisionRequirement(world, 'A', getDecision('women_work'), null);
  assert(!r.ok && r.reason.includes('法案'), `D2 法案限定生效：${r.reason}`);
  n.law = 'total';
  n.warSupport = 60;
  r = decisionRequirement(world, 'A', getDecision('women_work'), null);
  assert(r.ok, 'D2 总动员法 + 战争支持度 60 → 女性参加工作解锁');

  // 稳定度上限
  n.stability = 75;
  r = decisionRequirement(world, 'A', getDecision('improve_work_env'), null);
  assert(!r.ok && r.reason.includes('稳定度'), `D2 稳定度上限生效：${r.reason}`);

  // 基建要求
  const lowInfra = world.hexes[1];   // infra 3 < 5
  r = decisionRequirement(world, 'A', getDecision('regional_industry'), lowInfra);
  assert(!r.ok && r.reason.includes('基建'), `D2 基建要求生效：${r.reason}`);
  r = decisionRequirement(world, 'A', getDecision('regional_industry'), world.hexes[0]);  // infra 6
  assert(r.ok, 'D2 基建满级省份可执行地区工业整合');

  // PP 不足
  n.pp = 10;
  r = decisionRequirement(world, 'A', getDecision('cultural_exchange'), null);
  assert(!r.ok && r.reason.includes('政治点数'), `D2 PP 不足判定生效：${r.reason}`);
}

/* ---------- D3: PP 扣费与即时效果 ---------- */
console.log('\n--- D3: 扣费与即时效果 ---');
{
  const { world, n } = sandbox();
  n.pp = 300;
  const before = n.pp;
  const civBefore = world.hexes[0].civ;
  const res = fireDecision(world, 'A', 'emergency_industry', world.hexes[0]);
  assert(res.ok, `D3 启动成功：${res.msg}`);
  assert(n.pp === before - 100, `D3 PP 正确扣费 ${before} → ${n.pp}（-100）`);
  assert(n.stability === 57.5, `D3 稳定度惩罚生效 → ${n.stability}`);
  assert(n.warSupport === 57.5, `D3 战争支持度惩罚生效 → ${n.warSupport}`);

  // 民厂转军厂
  const { world: w2, n: n2 } = sandbox({ civ: 10 });
  n2.pp = 300;
  const civT = w2.hexes[0].civ, milT = w2.hexes[0].mil;
  const r2 = fireDecision(w2, 'A', 'convert_industry', null);
  assert(r2.ok, 'D3 紧急工业转变启动');
  const civAfter = w2.hexes[0].civ, milAfter = w2.hexes[0].mil;
  assert(civAfter < civT && milAfter > milT, `D3 民厂转军厂生效：civ ${civT}→${civAfter}, mil ${milT}→${milAfter}`);
}

/* ---------- D4: 限时效果与到期撤销 ---------- */
console.log('\n--- D4: 限时效果与自动撤销 ---');
{
  const { world, n } = sandbox();
  n.pp = 200;
  // 战时生产法：180 天 milOutput +10%
  const r = fireDecision(world, 'A', 'war_production', null);
  assert(r.ok, 'D4 战时生产法启动');
  assert(Math.abs((n.modifiers.milOutput || 0) - 0.10) < 1e-9, `D4 限时修正已生效 milOutput=${n.modifiers.milOutput}`);
  // 时间推进 179 天：仍在生效
  world.day += 179;
  decisionsTick(world);
  assert(n.modifiers.milOutput != null, 'D4 第 179 天仍在生效');
  // 第 181 天：撤销
  world.day += 2;
  decisionsTick(world);
  assert(n.modifiers.milOutput == null, `D4 到期自动撤销（milOutput=${n.modifiers.milOutput}）`);
  const evs = world.events.filter(e => e.type === 'decision_end');
  assert(evs.length === 1, 'D4 撤销事件已入战报');

  // 主动撤销（需补足 PP：前一次启动已扣 150）
  n.pp = 500;
  const r2 = fireDecision(world, 'A', 'war_production', null);
  assert(r2.ok, 'D4 重新启动');
  const c = cancelDecision(world, 'A', 'war_production');
  assert(c.ok, `D4 主动撤销：${c.msg}`);
  assert(n.modifiers.milOutput == null, 'D4 主动撤销后修正被移除');
}

/* ---------- D5: 使用限制 ---------- */
console.log('\n--- D5: once / oncePer / maxUses / oncePerHex ---');
{
  const { world, n } = sandbox();
  n.pp = 1000;
  // once：重组铁路系统
  assert(fireDecision(world, 'A', 'reorg_railway', null).ok, 'D5 重组铁路系统首次启动');
  const r2 = fireDecision(world, 'A', 'reorg_railway', null);
  assert(!r2.ok && (r2.msg.includes('进行中') || r2.msg.includes('已执行')), `D5 once+限时双重限制：${r2.msg}`);

  // oncePerHex：地区工业整合
  assert(fireDecision(world, 'A', 'regional_industry', world.hexes[0]).ok, 'D5 省 A 首次执行');
  const r3 = fireDecision(world, 'A', 'regional_industry', world.hexes[0]);
  assert(!r3.ok && r3.msg.includes('该省'), `D5 oncePerHex 生效：${r3.msg}`);
  world.hexes[1].infra = 6;      // 该省也满足基建要求
  const r4 = fireDecision(world, 'A', 'regional_industry', world.hexes[1]);
  assert(r4.ok, 'D5 另一省份仍可执行（oncePerHex 按省独立计数）');

  // maxUses：矿产开发（需前置科技 excavation1）
  n.research.done.excavation1 = true;
  for(let i = 0; i < 8; i++) fireDecision(world, 'A', 'develop_mineral', null);
  const r5 = fireDecision(world, 'A', 'develop_mineral', null);
  assert(!r5.ok && r5.msg.includes('上限'), `D5 maxUses 生效：${r5.msg}`);
}

/* ---------- D6: 每周效果 ---------- */
console.log('\n--- D6: 每周累积效果 ---');
{
  const { world, n } = sandbox();
  n.pp = 300;
  n.warSupport = 40;                 // 战争宣传要求 ≤50
  const r = fireDecision(world, 'A', 'war_propaganda', null);
  assert(r.ok, 'D6 战争宣传启动');
  const ws0 = n.warSupport;
  for(let i = 0; i < 4; i++){ world.day += 7; decisionsTick(world); }   // 4 周
  assert(Math.abs(n.warSupport - (ws0 + 2)) < 0.01, `D6 4 周后战争支持度 ${ws0} → ${n.warSupport.toFixed(1)}（每周 +0.5）`);
}

/* ---------- D7: UI 可用性列表 ---------- */
console.log('\n--- D7: 可用性列表 ---');
{
  const { world, n } = sandbox({ pp: 50 });   // PP 很少
  const list = availableDecisions(world, 'A');
  assert(list.length === DECISIONS.length, `D7 列表覆盖全部 ${DECISIONS.length} 条决议`);
  const avail = list.filter(x => x.ok);
  const blocked = list.filter(x => !x.ok);
  assert(avail.length > 0, `D7 PP=50 时仍有 ${avail.length} 条可执行（含 0 PP 决议）`);
  assert(blocked.every(x => x.reason && x.reason.length > 0), 'D7 所有被阻塞的决议都有可读原因');
  assert(avail.some(x => x.def.id === 'reorg_railway'), 'D7 0 PP 的重组铁路系统始终可执行');
}

/* ---------- D8: 与既有系统的兼容性（零破坏） ---------- */
console.log('\n--- D8: 零破坏兼容 ---');
{
  const { world, n } = sandbox({ law: 'total' });   // 全备动员要求总动员法
  n.pp = 300;
  const beforeCiv = n.civ, beforeMil = n.mil;
  const rD8 = fireDecision(world, 'A', 'full_utilization', null);
  assert(rD8.ok, 'D8 全备动员启动：' + rD8.msg);
  // 决议只改 modifiers 与政策数值，不动工厂总量（除显式 instant）
  assert(n.civ === beforeCiv && n.mil === beforeMil, 'D8 限时决议不改动工厂存量');
  assert(n.stability === 50, `D8 全备动员的稳定度代价生效 → ${n.stability}`);
  assert(Math.abs((n.modifiers.milOutput || 0) - 0.20) < 1e-9, 'D8 全备动员军工厂 +20%');
}

console.log(`\n=== P2 决议验收结果: ${failed === 0 ? '全部通过 ✓' : failed + ' 项失败 ✗'} ===`);
process.exit(failed ? 1 : 0);
