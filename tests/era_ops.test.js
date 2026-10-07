/* ============================================================
   tests/era_ops.test.js —— 两栖登陆 / 情报行动 / 海区派生 验收（v11.0）
   ------------------------------------------------------------
   这三条链在本轮之前都属于「有面板、有引擎函数、但连不起来」：
     · 登陆按钮只 alert 一句，world.navalInvasions 从未被创建 ——
       于是警报条里「登陆准备完毕」是一条永远不触发的死条件
     · 情报面板的「筹备行动」是内联 onclick="alert(...)"，
       19 项历史行动全是摆设，activeOperations 建好了没人写
     · SEA_ZONES 的格子表是旧 26×16 地图的坐标，换图后 getHexSeaZone()
       全图返回 null，登陆门槛永远卡在「未指定登陆路径经行海区」
   ============================================================ */

import assert from 'node:assert/strict';
import { loadScenario } from '../js/engine/world.js';
import { getHexSeaZone, seaZonesFor, SEA_ZONES } from '../js/engine/navy.js';
import {
  listLandingSites, isLandableCoast, planNavalInvasion, invasionTick,
  executeNavalInvasion, cancelNavalInvasion
} from '../js/engine/invasion.js';
import { planIntelOperation, cancelIntelOperation, intelTick } from '../js/engine/intel.js';
import { dayTick } from '../js/engine/tick.js';
import { makeRng } from '../js/core/rng.js';
import { collectAlerts } from '../js/ui/hudV8.js';

console.log('=== 两栖登陆 / 情报行动 / 海区派生 验收 ===\n');

/* ---------- 1. 海区按图集派生 ---------- */
console.log('--- 1. 海区派生 ---');
assert.ok(SEA_ZONES.length >= 5, `海区数量不足：${SEA_ZONES.length}`);
const zww2 = loadScenario('ww2', 42);
assert.ok(zww2.seaZones.length >= 5, `二战海区数量不足：${zww2.seaZones.length}`);
// 每个海区必须真的只含海面格，且在自己的图集坐标上自洽
for(const sz of SEA_ZONES){
  assert.ok(sz.hexes.length >= 2, `海区「${sz.name}」格数过少`);
  assert.equal(new Set(sz.hexes.map((h) => h.join(','))).size, sz.hexes.length,
    `海区「${sz.name}」有重复格`);
}
// 波罗的海必须是那个波罗的海，不是挪威内陆
const baltic = zww2.seaZones.find((z) => z.id === 'sz_baltic');
assert.ok(baltic, '缺少波罗的海海区');
assert.ok(baltic.center[0] > 18 && baltic.center[1] > 6,
  `波罗的海中心 (${baltic.center}) 不像波罗的海 —— 大概率又踩到旧地图坐标`);
console.log(`✓ ${SEA_ZONES.length} 个海区由图集派生，波罗的海中心 ${baltic.center.join(',')}（${baltic.hexes.length} 格）`);

// 非图集网格的剧本要兜底而不是错位命中
for(const sc of ['A', 'coldwar', 'modern']){
  const w = loadScenario(sc, 42);
  assert.ok(w.seaZones.length >= 1, `${sc} 没有解析出任何海区`);
  assert.ok(w.seaZones.every((z) => z.hexes.every(([q, r]) => {
    const h = w.at[q + ',' + r];
    return h && h.terrain === 'sea';
  })), `${sc} 的海区指向了不存在的海面格`);
  console.log(`  ${sc.padEnd(8)} → ${w.seaZones.map((z) => z.name + '(' + z.hexes.length + ')').join(' ')}`);
}

/* ---------- 2. 可登陆海岸识别 ---------- */
console.log('\n--- 2. 可登陆海岸识别 ---');
// hex.adj 刻意剔除了海洋，海岸判定必须走原始邻域 —— 这条断言守住这个坑
const w = loadScenario('ww2', 42);
const sites = listLandingSites(w, 'GER');
assert.ok(sites.length > 20, `可登陆海岸过少：${sites.length}（多半是拿 adj 判海岸了）`);
for(const h of sites){
  assert.notEqual(h.owner, 'GER', '登陆点不应是自己的领土');
  assert.ok(isLandableCoast(w, h, 'GER'));
}
console.log(`✓ 德国可登陆的敌方海岸 ${sites.length} 处（含 ${new Set(sites.map((h) => h.owner)).size} 个沿岸国）`);

/* ---------- 3. 登陆三步：立项 → 准备 → 抢滩 ---------- */
console.log('\n--- 3. 两栖登陆全流程 ---');
const target = sites.find((h) => h.owner === 'POL') || sites[0];
const plan = planNavalInvasion(w, 'GER', 'sz_baltic', 3, target.idx);
assert.ok(plan.ok, `立项失败：${plan.reason}`);
assert.ok(plan.prepDays >= 21, `10 师以内准备天数应 ≥ 21 天，实得 ${plan.prepDays}`);
assert.equal(w.navalInvasions.length, 1, 'world.navalInvasions 应被创建');

// 准备未完成时不能发起
const early = executeNavalInvasion(w, plan.id);
assert.equal(early.ok, false, '准备未完成时不应允许抢滩');

for(let i = 0; i < plan.prepDays + 2; i++) invasionTick(w);
assert.equal(w.navalInvasions[0].ready, true, `准备 ${plan.prepDays} 天后应就绪`);

// 警报条必须能收到「登陆准备完毕」—— 这条收集器此前永远不会触发
const alerts = collectAlerts(w);
assert.ok(alerts.some((a) => a.key === 'naval_invasion_ready'),
  '警报条未收到「两栖登陆准备完毕」');
console.log(`✓ 立项 ${plan.prepDays} 天 → 警报条命中「登陆准备完毕」`);

const landed = executeNavalInvasion(w, plan.id);
assert.ok(landed.ok && landed.landed === 3, `抢滩失败：${JSON.stringify(landed)}`);
const beachheads = w.units.filter((u) => u.nat === 'GER' && u.q === target.q && u.r === target.r);
assert.equal(beachheads.length, 3, '3 个师应全部上岸');
for(const u of beachheads){
  assert.ok(u.org <= 30, `滩头组织度应大幅折损，实得 ${u.org}`);
}
assert.equal(w.navalInvasions.length, 0, '登陆完成后计划应出列');
console.log(`✓ 3 个师抢滩 (${target.q},${target.r})，滩头组织度降至 ${beachheads[0].org}（保留 40%）`);

// 撤销
const plan2 = planNavalInvasion(w, 'GER', 'sz_baltic', 2, target.idx);
if(plan2.ok){
  assert.ok(cancelNavalInvasion(w, plan2.id), '撤销应返回 true');
  assert.equal(w.navalInvasions.length, 0, '撤销后计划应出列');
  console.log('✓ 登陆计划可撤销');
}

/* ---------- 4. 情报行动：立项 → 推进 → 结算 ---------- */
console.log('\n--- 4. 情报行动全流程 ---');
const wi = loadScenario('ww2', 42);
wi.nations.GER.pp = 800;
const net0 = wi.agencies.GER.operatives[0].networkStrength;
const op = planIntelOperation(wi, 'GER', 'rescue_operative', 'FRA');
assert.ok(op.ok, `情报行动立项失败：${op.reason}`);
assert.ok(wi.activeOperations.length === 1, 'activeOperations 应被写入');
assert.ok(wi.nations.GER.pp < 800, '立项应扣政治点');

// 特工被占用（不能重复派同一名特工）
const op2 = planIntelOperation(wi, 'GER', 'rescue_operative', 'FRA');
assert.equal(op2.ok, false, '特工已被占用时不应再次立项');

for(let i = 0; i < op.days + 2; i++) intelTick(wi, () => 0.99);   // 强制不暴露
assert.equal(wi.activeOperations.length, 0, '行动到日应结算出列');
const hist = (wi.operationHistory.GER || []);
assert.equal(hist.length, 1, '行动史应记录一次');
assert.equal(hist[0].ok, true, '未被发现时应记为成功');
assert.ok(wi.agencies.GER.operatives[0].networkStrength > net0,
  `行动成功后特工网络应增长：${net0} → ${wi.agencies.GER.operatives[0].networkStrength}`);
assert.equal(wi.agencies.GER.operatives[0].mission, 'network', '参与特工应回归网络任务');

// 暴露分支：把风险拉满，特工应被俘
const wi2 = loadScenario('ww2', 42);
wi2.nations.GER.pp = 800;
const op3 = planIntelOperation(wi2, 'GER', 'rescue_operative', 'FRA');
assert.ok(op3.ok);
for(let i = 0; i < op3.days + 2; i++) intelTick(wi2, () => 0);
assert.ok(wi2.agencies.GER.operatives.some((o) => o.captured), '必暴露时应有一名特工被俘');
assert.equal((wi2.operationHistory.GER || [])[0].ok, false, '暴露应记为失败');
console.log(`✓ 立项(30PP) → ${op.days} 天 → 成功:网络 ${net0}→${wi.agencies.GER.operatives[0].networkStrength}；暴露分支:特工被俘`);

/* ---------- 5. 接入主循环 ---------- */
console.log('\n--- 5. 接入主循环 ---');
const wl = loadScenario('ww2', 7);
const rng = makeRng(wl.rngState);
// 只能登陆交战国海岸：listLandingSites 会连中立国的海岸一起列出来
const enemySite = listLandingSites(wl, 'GER').find((h) => wl.nations.GER.atWarWith.includes(h.owner));
assert.ok(enemySite, '德国应至少有一处交战国海岸可用于验证');
const p2 = planNavalInvasion(wl, 'GER', 'sz_baltic', 2, enemySite.idx);
assert.ok(p2.ok, `主循环用例立项失败：${p2.reason}`);
const before = wl.navalInvasions[0].progress;
for(let i = 0; i < 5; i++) dayTick(wl, rng);
assert.ok(wl.navalInvasions.length === 0 || wl.navalInvasions[0].progress > before,
  'dayTick 应推进登陆准备进度');
console.log('✓ dayTick 每日推进登陆筹备');

console.log('\n=== 两栖登陆 / 情报行动 / 海区派生 验收通过 ===');
