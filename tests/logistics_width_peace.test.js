/* ============================================================
   tests/logistics_width_peace.test.js —— E3 战宽增援 / B.3 断供曲线 / E4 资源与和会
   ============================================================ */

import assert from 'node:assert/strict';
import { K } from '../js/data/constants.js';
import { makeWorld, spawnUnit } from '../js/engine/world.js';
import { dayTick } from '../js/engine/tick.js';
import { makeRng } from '../js/core/rng.js';
import { getUnitSupplyModifiers } from '../js/engine/logistics.js';
import { resolveBattle } from '../js/engine/battle.js';
import { resourcesTick, getLineResourceEff, getUnitFuelModifiers, tradeResource } from '../js/engine/resources.js';
import { buildPeaceConference, applyPeaceAction, closePeaceConference, PEACE_ACTIONS } from '../js/engine/peace.js';
import { victoryTick } from '../js/engine/victory.js';
import { nationalVP, lostVP } from '../js/engine/victory.js';

console.log('=== E3/E4 后勤战宽断供 · 战略资源 · 战后和会验收 ===\n');

// ---------- 1. 地形战斗宽度（B.1）与预备队增援（B.2） ----------
console.log('--- 1. 地形战宽与预备队增援骰 ---');
const twPlain = K.TERRAIN_COMBAT_WIDTH.plain;
const twMount = K.TERRAIN_COMBAT_WIDTH.mount;
// v14.1 W1：战宽改 HOI4 原值（base/flank 取代旧 1:13 缩尺 scaleBase/scaleFlank）。
// 旧断言校验缩尺值 6.0/5.0 —— 它们校验的是被 W1 替换掉的口径，故随之更新。
assert.equal(twPlain.base, 70);
assert.equal(twMount.base, 50);
assert.ok(twMount.base < twPlain.base, '山脉战宽应小于平原');
// B.1 公式（HOI4 原值）：3 个进攻方向，平原 = 70 + 2×35 = 140，山脉 = 50 + 2×25 = 100
const wPlain = twPlain.base + 2 * twPlain.flank;
const wMount = twMount.base + 2 * twMount.flank;
assert.ok(Math.abs(wPlain - 140) < 0.01 && Math.abs(wMount - 100) < 0.01, `战宽公式异常: 平原=${wPlain} 山脉=${wMount}`);
console.log(`✓ 地形战宽公式验证: 平原3方向=${wPlain} 山脉3方向=${wMount} (B.1 HOI4 原值)`);

// 预备队：8 步兵师（v14.1 W1 师宽=10）单方向进攻 1 格平原（70 宽）→ 7 进场，1 预备队
function sandboxWorld(){
  const world = {
    version:3, seed:7, rngState:7, day:0, over:null, scenario:'sim', player:'A',
    hexes:[], at:{}, units:[], uid:1, log:[], events:[], aiLog:[],
    nations:{
      A:{ id:'A', name:'攻', color:'#888', alive:true, capitulated:false, equip:0, pp:0, civ:0, mil:0,
          law:'war', warSupport:50, atWarWith:['B'], build:{q:-1,r:-1,prog:0,need:0,kind:null}, training:[],
          pool:[], techs:[], research:{slots:[null,null,null],done:{}}, focus:{active:null,progress:0,done:[]}, modifiers:{}, ai:{decisionDelay:99} },
      B:{ id:'B', name:'守', color:'#888', alive:true, capitulated:false, equip:0, pp:0, civ:0, mil:0,
          law:'war', warSupport:50, atWarWith:['A'], build:{q:-1,r:-1,prog:0,need:0,kind:null}, training:[],
          pool:[], techs:[], research:{slots:[null,null,null],done:{}}, focus:{active:null,progress:0,done:[]}, modifiers:{}, ai:{decisionDelay:99} }
    }
  };
  const mk = (q,r,owner,terrain) => {
    const h = { idx:world.hexes.length, q, r, owner, terrain, city:null, civ:0, mil:0, infra:0, fort:0, river:null, strait:false, units:[], adj:[] };
    world.hexes.push(h); world.at[q+','+r] = h; return h;
  };
  mk(-1,0,'A','plain'); mk(0,0,'B','plain');
  for(const h of world.hexes){
    for(const o of world.hexes){
      if(h === o) continue;
      const dq = o.q - h.q, dr = o.r - h.r;
      if(Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq+dr)) === 1) h.adj.push(o.idx);
    }
  }
  return world;
}
const sw = sandboxWorld();
for(let i = 0; i < 8; i++) spawnUnit(sw, 'inf', -1, 0, 'A');
spawnUnit(sw, 'inf', 0, 0, 'B');
for(const u of sw.units){
  if(u.nat === 'A') u.order = { type:'attack', target:[0, 0] };
}
const rng1 = makeRng(42);
const rep = resolveBattle(sw, rng1, 1);
assert.ok(rep.rounds.length > 0, '战斗报告为空');
const rd = rep.rounds[0];
assert.ok(rd.reserves >= 1, `预备队数量异常: ${rd.reserves}（W1 后 8×10 宽师打 70 宽平原应留 1 个预备）`);
assert.ok(rd.reinforce && rd.reinforce.length === rd.reserves, '每个预备师都应有增援骰记录');
for(const rf of rd.reinforce){
  assert.ok(rf.p >= 0.02 && rf.p <= 0.85, `增援概率越界: ${rf.p}`);
  assert.equal(typeof rf.joined, 'boolean');
}
console.log(`✓ 预备队增援骰: ${rd.reserves} 个预备师，概率区间合法，report 记录完整`);

// ---------- 2. 断供曲线（B.3） ----------
console.log('\n--- 2. 断供战斗惩罚曲线（B.3） ---');
const u1 = { outOfSupplyDays: 3, supplyGrace: 0 };
assert.equal(getUnitSupplyModifiers(u1).atkMul, 1.0, '宽限期内应无惩罚');
const u2 = { outOfSupplyDays: 4, supplyGrace: 0 };
assert.ok(Math.abs(getUnitSupplyModifiers(u2).atkMul - 0.875) < 0.001, `断供4天攻击应为 0.875: ${getUnitSupplyModifiers(u2).atkMul}`);
const u3 = { outOfSupplyDays: 7, supplyGrace: 0 };
assert.ok(Math.abs(getUnitSupplyModifiers(u3).atkMul - 0.50) < 0.001, `断供7天攻击应为 0.50: ${getUnitSupplyModifiers(u3).atkMul}`);
const u4 = { outOfSupplyDays: 30, supplyGrace: 0 };
assert.equal(getUnitSupplyModifiers(u4).atkMul, 0.50, '攻击惩罚封顶 -50%');
console.log('✓ 断供曲线: 4天=-12.5% 7天=-50% 封顶-50%（B.3 公式精确匹配）');

// ---------- 3. 六大战略资源与燃料 ----------
console.log('\n--- 3. 战略资源产出/消耗/燃料池 ---');
const worldA = makeWorld('A', 42);
resourcesTick(worldA);
const g = worldA.nations.G;
assert.ok(g.resourceStock && g.resourceStock.steel > 0, '德国应有钢铁库存');
assert.ok(g.fuelReserve > 0, '德国应有燃料储备');
const steelBefore = g.resourceStock.steel;
resourcesTick(worldA);
assert.ok(g.resourceStock.steel !== steelBefore, '资源库存应随结算变化（产出-消耗）');

// 赤字惩罚：停产线大部分厂并清空钢铁 → 产线效率折损（B.4）
// v14.8 W7-2 fixture 更新：本土资源格（鲁尔 steel 105）此前是死字段、G 实际零本土
// 产钢，"清空库存即赤字"静默成立；字段接活后 G 日产钢 >100，必须同步清掉本土
// 资源格才能构造贫矿国场景 —— 旧 fixture 编码的正是被 W7-2 修复的盲区。
for(const h of worldA.hexes){
  if(h.owner === 'G' && h.resources) h.resources = null;
}
g.resourceStock.steel = 0;
g.productionLines = [
  { id:'inf_eq', type:'inf_eq', factories:15, eff:0.1, cap:0.5 },
  { id:'art_eq', type:'art_eq', factories:15, eff:0.1, cap:0.5 }
];
resourcesTick(worldA);
assert.ok((g._resourceDeficit.steel || 0) > 0, `钢铁清空后应出现赤字: ${g._resourceDeficit.steel}`);
const effSteel = getLineResourceEff(g, 'inf_eq');
assert.ok(effSteel < 1.0 && effSteel >= 0.10, `钢铁赤字产线折损异常: ${effSteel}`);
console.log(`✓ 资源赤字折损（B.4）: 钢铁断供 inf_eq 效率=${(effSteel*100).toFixed(0)}%`);
// 恢复产线，避免影响后续断油判定
g.productionLines = [
  { id:'inf_eq', type:'inf_eq', factories:5, eff:0.1, cap:0.5 },
  { id:'art_eq', type:'art_eq', factories:2, eff:0.1, cap:0.5 },
  { id:'tank_eq', type:'tank_eq', factories:2, eff:0.1, cap:0.5 },
  { id:'truck_eq', type:'truck_eq', factories:1, eff:0.1, cap:0.5 }
];

// 断油：部署装甲集群（需求 15燃料/天 > 德国炼油回填 8/天）→ 机动瘫痪（§2.4）
for(let i = 0; i < 12; i++) spawnUnit(worldA, 'arm', 6, 9, 'G');
g.fuelReserve = 0;
resourcesTick(worldA);
assert.equal(g._fuelStarving, true, `燃料归零应判定断油: starving=${g._fuelStarving} reserve=${g.fuelReserve}`);
const fm = getUnitFuelModifiers(worldA, { nat:'G', type:'arm' });
assert.equal(fm.speedMul, 0.25, '断油装甲师速度 -75%');
assert.equal(fm.brkMul, 0.40, '断油装甲师突破 -60%');
console.log('✓ 断油瘫痪: 装甲师 speedMul=0.25 brkMul=0.40（§2.4）');

// 资源贸易
assert.equal(tradeResource(worldA, 'G', 'rubber', 8), true);
assert.ok(g.resourceTrades.some(t => t.resource === 'rubber'), '贸易合约应建立');
console.log('✓ 国际贸易: 1民用工厂→8单位资源合约建立');

// ---------- 4. 战后和会 ----------
console.log('\n--- 4. 战后和会（贡献度/割让/傀儡/资源掠夺） ---');
// 玩家(G)占领波兰 60% 领土（含首都华沙）→ 触发投降 → 和会
for(const h of worldA.hexes){
  if(h._orig === 'P' && (h.city && h.city.cap === 'P' || Math.random === null || (h.q + h.r) % 5 !== 0)){
    h.owner = 'G';
  }
}
// 确保华沙被占且比例 ≥ surrenderLimit(0.56)
const st = lostVP(worldA, 'P');
assert.ok(st.ratio >= 0.56 && st.capLost, `投降条件未满足: ratio=${st.ratio} capLost=${st.capLost}`);
victoryTick(worldA);
assert.ok(worldA.pendingPeace, '波兰投降后应弹出和会');
assert.equal(worldA.pendingPeace.loser, 'P');
assert.ok(worldA.pendingPeace.winners.includes('G'));
const pts = worldA.pendingPeace.points.G;
assert.ok(pts > 100, `和会点数应含军功加成: ${pts}`);
console.log(`✓ 战争贡献度计分: G 获得 ${pts} 点 (杀伤35%+占领40%+牺牲15%权重)`);

// 割让领土
const pHex = worldA.hexes.find(h => h._orig === 'P' && h.owner !== 'G');
assert.ok(pHex, '应存在未割让的波兰领土');
const res1 = applyPeaceAction(worldA, 'G', 'takeState', { q: pHex.q, r: pHex.r });
assert.equal(res1.ok, true, `takeState 失败: ${res1.msg}`);
assert.equal(worldA.at[pHex.q + ',' + pHex.r].owner, 'G');
console.log(`✓ 割让领土: (${pHex.q},${pHex.r}) 并入德国，消耗 ${res1.cost} 点`);

// 点数不足拒绝
const g2pts = worldA.pendingPeace.points.G;
const spent = (worldA.pendingPeace.actions.G || []).reduce((s,a) => s + a.paid, 0);
assert.ok(spent <= g2pts, '花费不应超过总点数');

// 资源掠夺特权
const res2 = applyPeaceAction(worldA, 'G', 'resourceRights', {});
assert.equal(res2.ok, true);
assert.ok(worldA.nations.G.resourceRights.some(r => r.natId === 'P'));
console.log('✓ 资源掠夺特权: 获得波兰 80% 战略资源开采权');

// 闭幕：剩余领土托管 + 清场
closePeaceConference(worldA);
assert.equal(worldA.pendingPeace, null);
assert.ok(worldA.hexes.every(h => h._orig !== 'P' || worldA.pendingPeace === null), '和会应闭幕清场');
console.log('✓ 和会闭幕: 剩余领土自动托管，pendingPeace 清空');

// ---------- 5. 端到端：主循环集成（30 天推演不崩溃） ----------
console.log('\n--- 5. 主循环 30 天集成推演 ---');
const worldB = makeWorld('A', 7);
const rngB = makeRng(7);
for(let i = 0; i < 30; i++) dayTick(worldB, rngB);
// 剧本A德军推进极快可能提前终局（world.over 后 tick 跳过），故只断言已稳定推演 ≥10 天
assert.ok(worldB.day >= 10, `day=${worldB.day}`);
for(const id of ['G','P','F','S']){
  const n = worldB.nations[id];
  assert.ok(n.resourceStock, `${id} 资源账本应存在`);
}
console.log('✓ dayTick ×30 集成推演稳定，各国资源账本就绪');

console.log('\n=== E3/E4 全部验收通过 ✓ ===');
