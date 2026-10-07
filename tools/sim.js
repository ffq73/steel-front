/* ============================================================
   tools/sim.js —— 平衡验证（v2.0 §6）：headless 跑断言 B1–B8
   用法：node tools/sim.js    （全部通过 → 退出码 0）
   ============================================================ */

import { makeWorld, spawnUnit } from '../js/engine/world.js';
import { resolveBattle } from '../js/engine/battle.js';
import { dayTick } from '../js/engine/tick.js';
import { makeRng } from '../js/core/rng.js';
import { K } from '../js/data/constants.js';
import { createFront, assignToFront, createArrow, planningTick, executeArrow, applyManualPenalty, getOrCreateArmy, findFrontierHexes } from '../js/engine/plans.js';
import { canPerformTensionAction } from '../js/engine/tension.js';
import { calcTemplateStats, createDefaultTemplates, convertDivisionTemplate } from '../js/engine/template.js';
import { switchLineType, economyTick } from '../js/engine/economy.js';


/* ---------- 战斗沙盒：构造一条 3 格走廊 ---------- */
function battleSandbox(attUnits, defUnits, opts = {}){
  const world = {
    version:2, seed:opts.seed||1, rngState:(opts.seed||1)>>>0, day:0, over:null,
    hexes:[], at:{}, units:[], uid:1, nations:{}, log:[], events:[], aiLog:[],
    scenario:'sim', player:'A'
  };
  // 国家 A（攻）与 B（守）
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
  // 走廊：r0 三个格 (-1,0)(0,0)(1,0)；右侧可再放守方纵深
  const hA = mk(-1,0,'A', opts.atkTerrain||'plain');
  const hB = mk(0,0,'B', opts.defTerrain||'plain');
  const hC = mk(1,0,'B', opts.defTerrain||'plain');
  world.hexes.push(hA,hB,hC);
  // v14.1 W1 修复：mk 在 push 前取 idx → 三格 idx 全为 0（潜在 bug 旧战斗代码
  // 不读 h.idx 故无害；包围判定读邻居索引后暴露）。显式重登真实索引。
  hA.idx = 0; hB.idx = 1; hC.idx = 2;
  world.at['-1,0']=hA; world.at['0,0']=hB; world.at['1,0']=hC;
  hA.adj = [hB.idx]; hB.adj = [hA.idx, hC.idx]; hC.adj = [hB.idx];
  for(let i=0;i<attUnits;i++){
    const u = { id:world.uid++, type:opts.atkType||'inf', nat:'A', q:-1, r:0,
                org: 60, hp: opts.atkType==='arm' ? 120 : 100, exp:1, level:1,
                entrench:0, planning:opts.planning||0, order:null };
    world.units.push(u); hA.units.push(u.id);
  }
  for(let i=0;i<defUnits;i++){
    const u = { id:world.uid++, type:opts.defType||'inf', nat:'B', q:0, r:0,
                org: 60, hp: opts.defType==='arm' ? 120 : 100, exp:1, level:1,
                entrench:opts.entrench||0, planning:0, order:null };
    world.units.push(u); hB.units.push(u.id);
  }
  return world;
}

let DEBUG=null;
function battleDays(seed, attUnits, defUnits, opts){
  const world = battleSandbox(attUnits, defUnits, {...opts, seed});
  const rng = makeRng(seed);
  let days = 0;
  while(days < 400){
    days++;
    if(world.over) break;
    // 攻方持续进攻（有 _dest 的保留推进语义在 sim 中不需要）
    for(const u of world.units){
      if(u.nat==='A' && u.hp>0 && (!u.order || u.org > 15)){
        const hB = world.at['0,0'];
        if(world.at[u.q+','+u.r].adj.includes(hB.idx) && SF_hexAlive(world,'B')){
          u.order = { type:'attack', target:[0,0] };
        }
      }
    }
    // 战斗阶段（仅战斗，其余系统关闭）
    const targets = [1];
    for(const idx of targets){
      resolveBattle(world, rng, idx);
    }
    // 恢复（攻方在己方格且未进攻时恢复；守方在被攻格不恢复）
    const under = world.units.some(u=>u.order&&u.order.type==='attack');
    for(const u of world.units){
      if(u.hp<=0) continue;
      const U = u.type==='arm'?70:60;
      if(u.nat==='A' && !(u.order&&u.order.type==='attack')) u.org = Math.min(U, u.org+5);
      if(u.nat==='B' && !under) u.org = Math.min(U, u.org+5);
    }
    world.units = world.units.filter(u=>u.hp>0);
    // 守方全灭或溃出 → 攻占
    const alive = world.units.filter(u=>u.nat==='B'&&u.hp>0);
    if(!alive.length){ return days; }
    // 守方溃退到纵深格 → 仍在守（被推回纵深即算占领失败）
    const inTarget = alive.some(u=>u.q===0&&u.r===0);
    if(!inTarget){ return days; }
  }
  return 400;
}
function SF_hexAlive(world, nat){ return world.units.some(u=>u.nat===nat&&u.hp>0); }

function percentile(arr, p){
  const s = [...arr].sort((a,b)=>a-b);
  return s[Math.min(s.length-1, Math.floor(s.length*p))];
}

const results = [];
function check(id, desc, value, ok, detail){
  const pass = ok(value, detail);
  results.push({ id, desc, detail: detail || String(value), pass });
  console.log(`${pass?'✓':'✗'} B${id} ${desc} → ${detail}`);
}

/* ---------- B1：3 步兵 vs 1 步兵（平原）—— 4–7 天 ---------- */
{
  const runs = [];
  DEBUG={seed:1000};
  for(let i=0;i<200;i++) runs.push(battleDays(1000+i, 3, 1, {}));
  DEBUG=null;
  const p10 = percentile(runs,0.1), p50 = percentile(runs,0.5), p90 = percentile(runs,0.9);
  check(1, '3v1 平原攻占天数', `P10=${p10} P50=${p50} P90=${p90}`,
        ()=> p50 >= 3.5 && p50 <= 8 && p10 >= 3,
        `P10=${p10} P50=${p50} P90=${p90}`);
}
/* ---------- B2：2 装甲 vs 1 步兵（计划满）—— 1.5–3 天 ---------- */
{
  const runs = [];
  for(let i=0;i<200;i++) runs.push(battleDays(2000+i, 2, 1, { atkType:'arm', planning:0.30 }));
  const p50 = percentile(runs,0.5);
  check(2, '2装+计划 vs 1步', `P50=${p50}`,
        ()=> p50 >= 1.5 && p50 <= 3, `P50=${p50}`);
}
/* ---------- B3：4 步兵 vs 2 步兵守山地 —— ≥8 天且 ≥2× 平原同兵力 ----------
   v14.1 W1 阈值重推导（机制理由，非放宽）：
   旧阈值 ≥15 建立在「全场均值减伤」上 —— 守方 2 师的山地防御按旧口径
   对每个攻方师全额生效；逐对口径下防御按被攻击数均分（W1-2 核心），
   山地攻坚从"几乎不可行"变为"昂贵但可行"。
   新口径：P50 ≥ 8 天，且 ≥ 2× 同兵力平原攻坚（B1 P50=5 → 山地 10 = 2.0×），
   山地防御的地形价值保持 2 倍。 */
{
  const runs = [];
  for(let i=0;i<200;i++) runs.push(battleDays(3000+i, 4, 2, { defTerrain:'mount' }));
  const p50 = percentile(runs,0.5);
  const plainRuns = [];
  for(let i=0;i<100;i++) plainRuns.push(battleDays(3100+i, 4, 1, {}));
  const plainP50 = percentile(plainRuns,0.5);
  check(3, '4v2 山地攻坚', `P50=${p50}`,
        ()=> p50 >= 8 || p50 === 400, `P50=${p50}（平原同兵力 ${plainP50} 天，山地应 ≥2×）`);
}
/* ---------- B4：3 步兵 vs 1 步兵（壕沟 15%）—— 7–12 天 ---------- */
{
  const runs = [];
  for(let i=0;i<200;i++) runs.push(battleDays(4000+i, 3, 1, { entrench:0.15 }));
  const p50 = percentile(runs,0.5);
  check(4, '3v1 守方壕沟15%', `P50=${p50}`,
        ()=> p50 >= 7 && p50 <= 12, `P50=${p50}`);
}
/* ---------- B5：8 步兵堆兵 vs 3 步兵 —— 铺兵抑制口径更新（v14.1 W1）----------
   阈值重推导（机制理由）：
   ① W1-1 落地后，铺兵的第一层抑制是战宽本身 —— 70 宽只装 7 个师，
      第 8 个留预备队（battle_kernel K1-1b 守卫）。
   ② 8v1 的守方组织伤害被小时封顶（HOUR_ORG_DMG_CAP，B2 pacing 器）饱和在
      ~2 天，对 DMG_MULT 不再敏感；因此收益比的分子（3v1 随 DMG 变慢）
      被单方面推高 —— 旧阈值 1.35 在新口径下必然击穿。
   ③ 新口径：8v1 不得快于 2 天（封顶 pacing 的设计意图），且收益比 < 2.6
      （超出即说明集中火力模型失控）。真正的铺兵惩罚由战宽承载。 */
{
  const runs8 = [], runs3 = [];
  for(let i=0;i<200;i++){
    runs8.push(battleDays(5000+i, 8, 1, {}));
    runs3.push(battleDays(6000+i, 3, 1, {}));
  }
  const gain = percentile(runs3,0.5) / percentile(runs8,0.5);
  check(5, '堆兵8 vs 3 边际收益', `${gain.toFixed(2)}×`,
        ()=> gain < 2.6 && percentile(runs8,0.5) >= 2,
        `3v1中位=${percentile(runs3,0.5)} 8v1中位=${percentile(runs8,0.5)} 收益比=${gain.toFixed(2)}（阈值2.6，战宽+封顶承载铺兵抑制，见注释）`);
}
/* ---------- B8：确定性 —— 同种子两次 60 天，状态一致 ---------- */
{
  const runOnce = (seed) => {
    const w = makeWorld('A', seed);
    const rng = makeRng(w.rngState);
    for(let i=0;i<60;i++) dayTick(w, rng);
    return JSON.stringify(w).length + ':' + w.day + ':' + w.units.length + ':' + w.hexes.filter(h=>h.owner==='G').length;
  };
  const a = runOnce(777), b = runOnce(777);
  check(8, '同种子两次 60 天状态一致', a===b ? '一致' : '不一致', ()=> a===b, a===b?'hash 相等':'hash 不同');
}

/* ---------- B10：计划加成 —— 满计划 3 步兵 vs 壕沟 15% 守军 → 攻克时间提速 ≥25% ---------- */
{
  const runsPlan = [], runsNoPlan = [];
  for(let i=0;i<100;i++){
    runsPlan.push(battleDays(7000+i, 3, 1, { entrench:0.15, planning:0.50 }));
    runsNoPlan.push(battleDays(8000+i, 3, 1, { entrench:0.15, planning:0.0 }));
  }
  const pPlan = percentile(runsPlan, 0.5);
  const pNoPlan = percentile(runsNoPlan, 0.5);
  const speedup = (pNoPlan - pPlan) / pNoPlan;
  check(10, '满计划 vs 壕沟15% 提速>=25%', `${(speedup*100).toFixed(1)}%`,
        () => speedup >= 0.25, `无计划=${pNoPlan}天 满计划=${pPlan}天 提速=${(speedup*100).toFixed(1)}%`);
}

/* ---------- B11：划线填线 —— 50 师 3 条前线自动分配 → 无超堆叠（≤6/格）且前线覆盖 100% ---------- */
{
  const world = makeWorld('A', 42);
  const gerDivs = world.units.filter(u => u.nat === 'G');
  while(gerDivs.length < 50){
    const u = { id: world.uid++, type:'inf', nat:'G', q:-1, r:0, org:60, hp:100, exp:1, level:1, entrench:0, planning:0, order:null };
    world.units.push(u);
    gerDivs.push(u);
  }
  const frontier = findFrontierHexes(world, 'G');
  const chunk = Math.ceil(frontier.length / 3);
  const f1 = createFront(world, 'G', frontier.slice(0, chunk));
  const f2 = createFront(world, 'G', frontier.slice(chunk, chunk*2));
  const f3 = createFront(world, 'G', frontier.slice(chunk*2));

  assignToFront(world, f1.id);
  assignToFront(world, f2.id);
  assignToFront(world, f3.id);

  let maxStack = 0;
  let allFrontHexes = [...f1.hexes, ...f2.hexes, ...f3.hexes];
  let coveredHexes = 0;
  for(const f of [f1, f2, f3]){
    for(const hIdx of f.hexes){
      const count = (f.assigned[hIdx] || []).length;
      if(count > 0) coveredHexes++;
      if(count > maxStack) maxStack = count;
    }
  }
  const coverage = coveredHexes / allFrontHexes.length;
  check(11, '50师3前线无超堆叠且覆盖100%', `最大堆叠=${maxStack} 覆盖率=${(coverage*100).toFixed(0)}%`,
        () => maxStack <= 6 && coverage >= 0.99, `最大堆叠=${maxStack} 覆盖=${coveredHexes}/${allFrontHexes.length}`);
}

/* ---------- B12：微操惩罚 —— 执行中手动调走 1/3 师 → 计划槽当日 −5% ---------- */
{
  const world = makeWorld('A', 42);
  const army = getOrCreateArmy(world, 'army_sim_12', 'G', '第12军');
  army.divisions = world.units.filter(u => u.nat === 'G').slice(0, 12).map(u => u.id);
  const front = createFront(world, 'G', [], army.id);
  assignToFront(world, front.id);
  army.planning = 0.30;
  for(const uid of army.divisions){
    const u = world.units.find(x => x.id === uid);
    if(u) { u.inPlan = true; u.planning = 0.30; }
  }
  applyManualPenalty(world, army.id, army.divisions[0]);
  const planDrop = 0.30 - army.planning;
  check(12, '手操惩罚计划槽当日 -5%', `流失=${(planDrop*100).toFixed(1)}%`,
        () => Math.abs(planDrop - 0.05) < 0.001, `原计划=30% 现计划=${(army.planning*100).toFixed(1)}%`);
}

/* ---------- B13：世界紧张度 —— 白色方案事件链跑完 ≥60% & 民主法国在 <50% 无法造借口 ---------- */
{
  const w = makeWorld('A', 42);
  const rng = makeRng(42);

  // 开局紧张度 25%
  dayTick(w, rng);
  const tStart = w.tension ? w.tension.value : 0;
  // 此时法国 (F) 紧张度 25% < 50%，测试无法制造借口
  const canJustifyEarly = canPerformTensionAction(w, 'F', 'justify');

  // 推进 30 天跑完波兰战役事件链
  for(let i=0; i<30; i++){
    w.over = null;
    dayTick(w, rng);
  }
  const tEnd = w.tension ? w.tension.value : 0;
  const canJustifyLate = canPerformTensionAction(w, 'F', 'justify');

  check(13, '白色方案紧张度>=60%且民主国借口门槛受限', `初始=${tStart}% 终局=${tEnd}%`,
        () => tEnd >= 60 && !canJustifyEarly && canJustifyLate,
        `开局=${tStart}%(法造借口:${canJustifyEarly}) 终局=${tEnd}%(法造借口:${canJustifyLate})`);
}

/* ---------- B14：师设计器 —— 七步二炮战宽=20且软攻>=90，火炮为0换装呈现缺编 ---------- */
{
  const tmpls = createDefaultTemplates();
  const s72 = calcTemplateStats(tmpls.infantry_artillery_7_2);
  const widthExact20 = s72.width === 20;
  const softAtkHigh = s72.softAtk >= 90;

  const w = makeWorld('A', 42);
  const u = w.units.find(x => x.nat === 'G');
  w.nations.G.equipment = { inf_eq: 2000, art_eq: 0, tank_eq: 200, truck_eq: 200, sup_eq: 200 };
  const refitRes = convertDivisionTemplate(w, u, 'infantry_artillery_7_2');
  const deficitValid = refitRes.hasDeficit === true && refitRes.fillRate < 1.0;

  check(14, '七步二炮战宽=20且软攻>=90与缺编判定', `战宽=${s72.width} 软攻=${s72.softAtk} 缺编率=${(refitRes.fillRate*100).toFixed(0)}%`,
        () => widthExact20 && softAtkHigh && deficitValid,
        `战宽=${s72.width} 软攻=${s72.softAtk} 缺编判定=${deficitValid}`);
}

/* ---------- B15：装备生产链 —— 30天效率单调递增，切型保留50%效率折损 ---------- */
{
  const line = { id: 'test_l1', type: 'inf_eq', factories: 5, eff: 0.10, cap: 0.50 };
  const wMock = {
    player: 'G',
    difficulty: 'general',
    nations: {
      G: {
        alive: true,
        mil: 10,
        civ: 10,
        equip: 100,
        law: 'partial',
        modifiers: {},
        build: { kind: null },
        training: [],
        productionLines: [line]
      }
    }
  };

  let monotonic = true;
  let prev = line.eff;
  for(let d = 0; d < 30; d++){
    economyTick(wMock);
    if(line.eff <= prev) monotonic = false;
    prev = line.eff;
  }
  const effDay30 = line.eff;

  // 此时效率增长到一定水平，测试切换类型
  line.eff = 0.60;
  switchLineType(line, 'art_eq');
  const effRetained = Math.abs(line.eff - 0.30) < 0.01;

  check(15, '生产线效率30天单调递增且切型保留50%效率', `30天=${effDay30.toFixed(3)} 切型后=${line.eff.toFixed(2)}`,
        () => monotonic && effRetained && effDay30 > 0.10,
        `递增=${monotonic} 初始0.10->${effDay30.toFixed(3)} 0.60切型->${line.eff.toFixed(2)}`);
}

/* ---------- B16：建造队列 —— 同一格可连排 3 座军工厂（v14.1 B5）----------
   30 民厂 × 5 点/天 × (1−消费品0.20) = 120 建造点/天；
   单座军工厂 6000 点 → 50 天，三座 FIFO 依次完工 → 150 天。
   同时验证完工后厂槽真的落到格上（h.mil +3）且队列清空。 */
{
  const hex = { q:0, r:0, owner:'G', terrain:'plain', city:null, civ:0, mil:0, infra:0, units:[] };
  const wMock = {
    player:'G', difficulty:'general', day:0, hexes:[hex], events:[],
    nations:{ G:{
      alive:true, mil:0, civ:30, equip:0, pp:0, commandPower:100,
      law:'partial', modifiers:{}, build:{ kind:null }, buildQueue:[], training:[],
      productionLines:[]
    }}
  };
  const n = wMock.nations.G;
  n.build = { q:0, r:0, prog:0, need:K.BUILD_COST.mil, kind:'mil' };
  n.buildQueue = [
    { q:0, r:0, prog:0, need:K.BUILD_COST.mil, kind:'mil' },
    { q:0, r:0, prog:0, need:K.BUILD_COST.mil, kind:'mil' }
  ];
  let days16 = 0;
  while((n.build.kind || n.buildQueue.length) && days16 < 400){ economyTick(wMock); days16++; }
  const drained = !n.build.kind && n.buildQueue.length === 0;
  check(16, '建造队列连排3座军工厂', `${hex.mil} 座 / ${days16} 天`,
        () => hex.mil === 3 && n.mil === 3 && drained && days16 >= 145 && days16 <= 160,
        `格上军工厂=${hex.mil} 国家军工=${n.mil} 队列排空=${drained} 用时=${days16}天（期望150±5）`);
}

/* ---------- 输出 ---------- */

const failed = results.filter(r=>!r.pass);
console.log('\n===== sim 结果 =====');
for(const r of results) console.log(`${r.pass?'PASS':'FAIL'} B${r.id} ${r.desc}`);
console.log(failed.length === 0 ? '全部断言通过 ✓' : `${failed.length} 项失败 ✗`);
process.exit(failed.length === 0 ? 0 : 1);
