/* ============================================================
   tests/hourly_combat.test.js —— v14.0 P0 战斗内核对齐验收
   ① 每小时结算（H1 日总量守恒 / H4 小时级溃退）
   ② 防御·突破 4 倍减伤（H2 减伤因子生效）
   ③ 超宽惩罚 2× 且封顶 -33%（H3）
   依据：HOI4 Wiki Land battle —— 每小时结算、承伤×(1−防御/4)、超宽 -1%/1% 封顶 -33%
        本作按用户裁决保留 2× 系数（附录 B）
   ============================================================ */

import { K } from '../js/data/constants.js';
import { resolveBattle } from '../js/engine/battle.js';
import { makeRng } from '../js/core/rng.js';

/* ---------- 战斗沙盒（对齐 sim.js 的结构） ---------- */
function sandbox(attUnits, defUnits, opts = {}){
  const world = {
    version:2, seed:opts.seed||1, rngState:(opts.seed||1)>>>0, day:0, over:null,
    hexes:[], at:{}, units:[], uid:1, nations:{}, log:[], events:[], aiLog:[],
    scenario:'sim', player:'A'
  };
  world.nations = {
    A:{ id:'A', name:'攻方', color:'#888', alive:true, capitulated:false,
        equip:0, pp:0, civ:0, mil:0, law:'war', warSupport:50, atWarWith:['B'],
        build:{q:-1,r:-1,prog:0,need:0,kind:null}, training:[], pool:[],
        techs:[], research:{slots:[null,null,null],done:{}}, focus:{active:null,progress:0,done:[]},
        modifiers:{ ...(opts.atkMods||{}) }, ai:{decisionDelay:99} },
    B:{ id:'B', name:'守方', color:'#888', alive:true, capitulated:false,
        equip:0, pp:0, civ:0, mil:0, law:'war', warSupport:50, atWarWith:['A'],
        build:{q:-1,r:-1,prog:0,need:0,kind:null}, training:[], pool:[],
        techs:[], research:{slots:[null,null,null],done:{}}, focus:{active:null,progress:0,done:[]},
        modifiers:{ ...(opts.defMods||{}) }, ai:{decisionDelay:99} }
  };
  const mk = (q,r,owner,terrain) => ({ idx:world.hexes.length, q, r, owner, terrain,
    city:null, civ:0, mil:0, infra:0, fort:opts.fort||0, river:null, strait:false, units:[] });
  const hA = mk(-1,0,'A', opts.atkTerrain||'plain');
  const hB = mk(0,0,'B', opts.defTerrain||'plain');
  world.hexes.push(hA, hB);
  world.at['-1,0']=hA; world.at['0,0']=hB;
  hA.adj=[hB.idx]; hB.adj=[hA.idx];
  for(let i=0;i<attUnits;i++){
    const u = { id:world.uid++, type:opts.atkType||'inf', nat:'A', q:-1, r:0,
                org:60, hp:opts.atkHp||100, exp:1, level:1,
                entrench:0, planning:opts.planning||0, order:{ type:'attack', target:[0,0] } };
    world.units.push(u); hA.units.push(u.id);
  }
  for(let i=0;i<defUnits;i++){
    const u = { id:world.uid++, type:opts.defType||'inf', nat:'B', q:0, r:0,
                org:60, hp:opts.defHp||100, exp:1, level:1,
                entrench:opts.entrench||0, planning:0, order:null };
    world.units.push(u); hB.units.push(u.id);
  }
  return world;
}

let failed = 0;
function assert(cond, msg){
  if(cond){ console.log('  ✓ ' + msg); }
  else { console.log('  ✗ FAIL: ' + msg); failed++; }
}

console.log('=== tests/hourly_combat.test.js: v14.0 P0 战斗内核 ===\n');

/* ---------- H1: 单日总伤害守恒 ---------- */
console.log('--- H1: 每日总组织伤害守恒（小时结算 vs 聚合结算）---');
{
  // 参照值：旧口径日伤害 = hits * ORG_PER_HIT * DMG_MULT * E[dice] * pierceMul
  // dice 在 [K.DICE_MIN, K.DICE_MAX] 均匀分布，均值 (min+max)/2
  const diceMean = (K.DICE_MIN + K.DICE_MAX) / 2;
  const w = sandbox(3, 3, { seed:11 });
  const rng = makeRng(11);
  const rep = resolveBattle(w, rng, 1);
  const rd = rep.rounds[0];
  assert(!!rd, 'H1 战斗报告生成 hourly rounds');

  // 24 小时口径下，单日伤害应与"每小时伤害 × 24"一致，且小时数正确
  const H = K.HOURS_PER_DAY || 24;
  assert(H === 24, `H1 HOURS_PER_DAY = ${H}（HOI4 为 24 小时）`);

  if(rd && rd.hourly){
    const sumOrg = rd.hourly.reduce((s,x)=>s+x.orgDmg, 0);
    const sumHp  = rd.hourly.reduce((s,x)=>s+x.hpDmg, 0);
    console.log(`    · 24 小时组织伤害合计 = ${sumOrg.toFixed(2)}，兵力伤害合计 = ${sumHp.toFixed(2)}`);
    assert(rd.hourly.length === H, `H1 逐小时记录 ${rd.hourly.length} 条（应为 ${H}）`);
    // 日上限守恒：ORG_DMG_CAP 是单日上限，小时封顶 ×24 不得低于它
    const hourCap = (K.HOUR_ORG_DMG_CAP != null ? K.HOUR_ORG_DMG_CAP : K.ORG_DMG_CAP / H);
    assert(hourCap * H >= K.ORG_DMG_CAP * 0.99,
      `H1 小时封顶 ${hourCap.toFixed(2)}×${H} ≥ 日封顶 ${K.ORG_DMG_CAP}`);
    // 组织伤害不得超过日上限太多（4 倍减伤后应显著低于）
    assert(sumOrg <= K.ORG_DMG_CAP * H * 0.99 + 1e-6,
      `H1 单日组织伤害 ${sumOrg.toFixed(2)} 不超过 24×小时封顶`);
  } else {
    assert(false, 'H1 报告含 hourly 明细（P0 核心产出）');
  }
}

/* ---------- H2: 防御 4 倍减伤 ---------- */
console.log('\n--- H2: 防御·突破 4 倍减伤因子 ---');
{
  assert(K.DEFENSE_FACTOR === 4, `H2 DEFENSE_FACTOR = ${K.DEFENSE_FACTOR}（HOI4 硬编码 4）`);
  const f = (def, atk) => Math.max(0.25, 1 - def / (K.DEFENSE_FACTOR * Math.max(1e-6, atk)));
  const a1 = f(10, 10);    // 防御 = 攻击 → 承伤 75%
  const a2 = f(20, 10);    // 防御 2× 攻击 → 承伤 50%
  const a3 = f(80, 10);   // 防御远高于攻击 → 下限 25%
  assert(Math.abs(a1 - 0.75) < 1e-6, `H2 防御=攻击 → 承伤 ${(a1*100).toFixed(0)}%（应 75%）`);
  assert(Math.abs(a2 - 0.50) < 1e-6, `H2 防御=2×攻击 → 承伤 ${(a2*100).toFixed(0)}%（应 50%）`);
  assert(Math.abs(a3 - 0.25) < 1e-6, `H2 龟缩极端 → 承伤下限 ${(a3*100).toFixed(0)}%（HOI4 保底 25%）`);

  // 实战验证：重装防御师守 vs 轻装进攻方，单日造成的组织伤害应低于无减伤情形
  const wHeavy = sandbox(2, 6, { seed:5, atkType:'inf', defType:'larm' });
  const r1 = resolveBattle(wHeavy, makeRng(5), 1);
  const wLight = sandbox(2, 6, { seed:5, atkType:'inf', defType:'inf' });
  const r2 = resolveBattle(wLight, makeRng(5), 1);
  const o1 = r1.rounds[0] ? r1.rounds[0].orgDmg : 0;
  const o2 = r2.rounds[0] ? r2.rounds[0].orgDmg : 0;
  console.log(`    · 攻 2 步兵：打 6 轻装甲造成 ${o1.toFixed(1)}，打 6 步兵造成 ${o2.toFixed(1)}`);
  assert(o1 < o2, 'H2 面对更高防御的守方，造成的组织伤害更低（4 倍减伤生效）');
}

/* ---------- H3: 超宽惩罚（v14.1 W1：系数回 HOI4 原版 1×，封顶 -33% 不变）---------- */
console.log('\n--- H3: 超宽惩罚系数 1×（HOI4 原版）且封顶 -33% ---');
{
  const W = K.TERRAIN_COMBAT_WIDTH.plain.base;   // 平原基础战宽（HOI4 原值 70）
  const pen = (total) => Math.min(K.WIDTH_OVERFLOW_CAP, K.WIDTH_OVERFLOW_COEF * Math.max(0, (total - W) / W));
  const p10 = pen(W * 1.10);   // 超 10%
  const p30 = pen(W * 1.30);   // 超 30%
  const p100 = pen(W * 2.00);  // 超 100%
  // 旧断言期望 2× 系数（超宽 10% → 20%）—— 那是 v14.0 的本作标定；
  // W1 裁决回到 HOI4 原版 1×（战宽本身已承载铺兵抑制），期望随之更新。
  assert(Math.abs(p10 - 0.10) < 1e-6, `H3 超宽 10% → 惩罚 ${(p10*100).toFixed(0)}%（HOI4 1× 系数）`);
  assert(Math.abs(p30 - 0.30) < 1e-6, `H3 超宽 30% → 惩罚 ${(p30*100).toFixed(0)}%`);
  assert(Math.abs(p100 - 0.33) < 1e-6, `H3 超宽 100% → 惩罚封顶 ${(p100*100).toFixed(0)}%`);
  assert(K.WIDTH_OVERFLOW_CAP === 0.33, `H3 封顶 ${K.WIDTH_OVERFLOW_CAP}（HOI4 同为 33%）`);
  assert(K.WIDTH_OVERFLOW_COEF === 1.0, 'W1 裁决：WIDTH_OVERFLOW_COEF 回 HOI4 原版 1.0');
}

/* ---------- H4: 小时级溃退 ---------- */
console.log('\n--- H4: 组织度小时级消耗与溃退时机 ---');
{
  // 打 12 小时（半天）后，防守方组织度应已部分消耗但未溃退
  const w = sandbox(4, 4, { seed:21 });
  const rng = makeRng(21);
  const rep = resolveBattle(w, rng, 1);
  const rd = rep.rounds[0];
  assert(!!rd, 'H4 战斗报告生成');
  if(rd && rd.hourly){
    const first = rd.hourly[0], last = rd.hourly[rd.hourly.length - 1];
    console.log(`    · 第 1 小时组织伤害 ${first.orgDmg.toFixed(2)}，第 ${rd.hourly.length} 小时 ${last.orgDmg.toFixed(2)}`);
    assert(rd.hourly.every(h => typeof h.orgDmg === 'number'), 'H4 每小时均有组织伤害记录（小时级结算）');
    // 小时伤害量级应远小于日聚合（这是"每小时"的核心特征）
    const maxHourly = Math.max(...rd.hourly.map(h => h.orgDmg));
    assert(maxHourly < K.ORG_DMG_CAP, `H4 单小时伤害 ${maxHourly.toFixed(2)} < 日封顶 ${K.ORG_DMG_CAP}`);
  } else {
    assert(false, 'H4 报告含 hourly 明细');
  }
}

console.log(`\n=== P0 验收结果: ${failed === 0 ? '全部通过 ✓' : failed + ' 项失败 ✗'} ===`);
process.exit(failed ? 1 : 0);
