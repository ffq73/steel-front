/* ============================================================
   tests/manpower_supply.test.js —— v14.0 P2 人力池与补给上限验收
   人力：HOI4 式总量 + 征兵法影响 + 训练/补员扣除 + 枯竭惩罚
   补给：HOI4 式承载上限（枢纽 + 基建 0.3/级）+ 过载削弱
   ============================================================ */

import { K } from '../js/data/constants.js';
import { initManpower, manpowerPool, recruitManpower, canAffordRecruit, payRecruitManpower,
         payReinforceManpower, manpowerTick, manpowerSnapshot, conscriptionRate, territoryPopulation } from '../js/engine/manpower.js';
import { calcSupplyNetwork } from '../js/engine/logistics.js';

let failed = 0;
function assert(cond, msg){
  if(cond) console.log('  ✓ ' + msg);
  else { console.log('  ✗ FAIL: ' + msg); failed++; }
}

function world(hexes, nations){
  return { hexes, at:{}, units:[], nations, supplyState:null };
}

console.log('=== tests/manpower_supply.test.js: v14.0 P2 人力池 + 补给上限 ===\n');

/* ---------- M1: 人力上限与征兵法 ---------- */
console.log('--- M1: 人力上限与征兵法 ---');
{
  const hexes = [];
  for(let q=0;q<10;q++) for(let r=0;r<3;r++) hexes.push({ q, r, owner:'A', terrain:'plain', infra:2, units:[] });
  const nations = {
    A:{ id:'A', name:'甲', law:'limited', alive:true, modifiers:{} }
  };
  const w = world(hexes, nations);
  const cap = initManpower(w, 'A');
  const pop = territoryPopulation(w, 'A');
  assert(pop === 30 * K.POP_PER_HEX, `M1 领土人口 = 30 格 × ${K.POP_PER_HEX} = ${pop.toLocaleString()}`);
  assert(Math.abs(conscriptionRate(nations.A) - 0.025) < 1e-9, `M1 有限征兵制人力费率 ${(conscriptionRate(nations.A)*100).toFixed(1)}%`);
  assert(Math.abs(cap - pop * 0.025) < 1, `M1 人力上限 = 人口 × 费率 = ${Math.floor(cap).toLocaleString()}`);

  // 换征兵法 → 上限变化
  // W0-B3 修正（2026-10）：原断言写的是 nations.A.law = 'extensive'。
  // 那是**经济**法案字段 —— 它之所以能让上限上涨，恰恰是因为当时的
  // manpower.js 读错了字段（CONSCRIPTION_LAWS[n.law]），fixture 把 bug 一起固化了。
  // 现在 manpower.js 改读正确的 conscriptionLaw，此处同步更正。
  nations.A.conscriptionLaw = 'extensive';
  const cap2 = initManpower(w, 'A');
  assert(cap2 > cap * 1.9, `M1 改广泛征兵(5%)后上限提升：${Math.floor(cap).toLocaleString()} → ${Math.floor(cap2).toLocaleString()}`);
  // 决议「女性参加工作」+3%
  nations.A.manpowerBonus = 0.03;
  const cap3 = initManpower(w, 'A');
  assert(Math.abs(cap3 / cap2 - 1.03) < 0.01, `M1 女性参加工作决议 +3% 生效：${Math.floor(cap2).toLocaleString()} → ${Math.floor(cap3).toLocaleString()}`);
}

/* ---------- M2: 训练扣人力 ---------- */
console.log('\n--- M2: 训练新师扣除人力 ---');
{
  const n = { id:'A', law:'limited', alive:true, modifiers:{}, manpowerCap: 100000, manpowerPool: 100000 };
  assert(recruitManpower('inf') === 1000, 'M2 步兵编制人力 1000 千');
  assert(recruitManpower('arm') === 1600, 'M2 装甲编制人力 1600 千');
  assert(canAffordRecruit(n, 'inf'), 'M2 池充足时可训练');
  const ok = payRecruitManpower(n, 'inf');
  assert(ok && Math.abs(n.manpowerPool - 99000) < 1e-6, `M2 训练扣除 1000：100000 → ${n.manpowerPool}`);

  // 池不足
  n.manpowerPool = 500;
  assert(!canAffordRecruit(n, 'arm'), 'M2 池不足时不可训练装甲师');
  assert(payRecruitManpower(n, 'arm') === false, 'M2 扣除失败返回 false');
  assert(n.manpowerPool === 500, 'M2 扣除失败不扣人力');
}

/* ---------- M3: 补员扣人力 ---------- */
console.log('\n--- M3: 战场补员扣除人力 ---');
{
  const n = { id:'A', alive:true, manpowerCap: 100000, manpowerPool: 5000 };
  // 缺失 50% 兵力，尝试补 1%（missingRatio 参数口径为"本次恢复的比例 × 缺失度"）
  const ok = payReinforceManpower(n, 'inf', 0.5 * 0.02);
  assert(ok, 'M3 补员扣除成功');
  const spent = 5000 - n.manpowerPool;
  assert(spent > 0, `M3 补员实际扣除 ${spent.toFixed(1)} 千（= 1000 × 1% × 0.6）`);
  n.manpowerPool = 3;                 // 低于本次补员成本 6 千
  assert(!payReinforceManpower(n, 'inf', 0.5 * 0.02), 'M3 池枯竭时补员失败');
  assert(n.manpowerPool === 3, 'M3 补员失败不扣人力');
}

/* ---------- M4: 每日回补与枯竭惩罚 ---------- */
console.log('\n--- M4: 人力回补与枯竭 ---');
{
  const hexes = [{ q:0, r:0, owner:'A', terrain:'plain', infra:2, units:[] }];
  const n = { id:'A', law:'limited', alive:true, modifiers:{}, stability:80 };
  const w = world(hexes, { A:n });
  initManpower(w, 'A');
  n.manpowerPool = n.manpowerCap * 0.5;
  const before = n.manpowerPool;
  w.day = 1; manpowerTick(w);
  assert(n.manpowerPool > before, `M4 每日回补：${Math.floor(before)} → ${Math.floor(n.manpowerPool)}`);

  // 回补不超过上限
  n.manpowerPool = n.manpowerCap;
  manpowerTick(w);
  assert(Math.abs(n.manpowerPool - n.manpowerCap) < 1e-6, 'M4 回补不超上限');

  // 枯竭惩罚
  n.manpowerPool = n.manpowerCap * 0.001;   // 枯竭（<2% 上限，且无回补空间）
  n.stability = 60;
  w.day = 2; manpowerTick(w);
  w.day = 9; manpowerTick(w);            // 距上次 ≥7 天 → 触发惩罚
  assert(n.stability < 60, `M4 池枯竭每周扣稳定度 → ${n.stability.toFixed(1)}`);
  const snap = manpowerSnapshot(w, 'A');
  assert(snap.exhausted === true, 'M4 快照标记为枯竭');
}

/* ---------- S1: 补给上限计算 ---------- */
console.log('\n--- S1: 补给承载上限 ---');
{
  assert(K.SUPPLY_INFRA_BONUS === 0.3, 'S1 基建底供 0.3/级（HOI4 原版值）');
  // 注意：calcSupplyNetwork 对 owner 'A'/'B' 走满补给短路（单元测试沙盒约定），
  // 这里必须用第三方国家代号，否则测不到过载逻辑。
  const NAT = 'C';
  const hexes = [];
  for(let q=0;q<6;q++) hexes.push({ q, r:0, owner:NAT, terrain:'plain', infra: 3, units:[], adj:[] });
  hexes.forEach((h,i) => { h.adj = i>0 ? [i-1] : (i<hexes.length-1 ? [i+1] : []); });
  const nations = { C:{ id:NAT, name:'丙', alive:true } };
  const w = world(hexes, nations);
  w.units = [];
  // 无枢纽：cap = infra 3 × 0.3 = 0.9
  calcSupplyNetwork(w);
  const h0 = w.hexes[0];
  assert(h0.supplyCap != null, 'S1 补给上限已计算');
  assert(Math.abs(h0.supplyCap - 0.9) < 1e-6, `S1 无枢纽时上限 = 基建 3 × 0.3 = ${h0.supplyCap.toFixed(2)}`);

  // 放 3 个师 → 需求 3，利用率 0.3 → 过载
  for(let i=0;i<3;i++) w.units.push({ id: 100+i, nat:NAT, type:'inf', hp:100, q:i, r:0 });
  w.hexes[0].units = [100,101,102];
  calcSupplyNetwork(w);
  assert(w.hexes[0].supplyDemand === 3, `S1 需求 = 3 师 × ${K.SUPPLY_DEMAND_PER_DIVISION} = ${w.hexes[0].supplyDemand}`);
  assert(Math.abs(w.hexes[0].supplyUtil - 0.3) < 1e-6, `S1 利用率 = 0.9/3 = ${w.hexes[0].supplyUtil.toFixed(2)}（过载）`);
  assert(w.hexes[0].supplyOver === 0, 'S1 供给不足时浪费量为 0（是缺口不是浪费）');
  const plainLevel = w.hexes[0].supplyLevel;
  assert(plainLevel < 0.65, `S1 过载使补给率被削弱至 ${(plainLevel*100).toFixed(0)}%（原 35% 吃紧档 × 削弱）`);

  // 需求为 0（空格）→ 利用率 1
  w.hexes[0].units = [];
  calcSupplyNetwork(w);
  assert(w.hexes[0].supplyUtil === 1, 'S1 无部队时利用率 1（不过载）');
}

/* ---------- S2: 兼容性（E3 断供曲线不受影响） ---------- */
console.log('\n--- S2: 与 E3 断供机制兼容 ---');
{
  // sim 沙盒：满补给短路，过载逻辑不得介入
  const hexes = [{ q:0, r:0, owner:'C', terrain:'plain', infra:1, units:[100,101,102,103], adj:[] }];
  const w = world(hexes, { C:{ id:'C', name:'丙', alive:true } });
  w.scenario = 'sim';
  w.units = hexes[0].units.map((id,i) => ({ id, nat:'C', type:'inf', hp:100, q:0, r:0 }));
  calcSupplyNetwork(w);
  assert(w.hexes[0].supplyLevel === 1.0, 'S2 单元测试沙盒仍为满补给（E3 断供曲线不受影响）');
  assert(w.hexes[0].supplyUtil == null, 'S2 沙盒短路不进入过载计算');
}

console.log(`\n=== P2 人力/补给验收结果: ${failed === 0 ? '全部通过 ✓' : failed + ' 项失败 ✗'} ===`);
process.exit(failed ? 1 : 0);
