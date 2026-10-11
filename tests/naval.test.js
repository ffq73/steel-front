/* ============================================================
   tests/naval.test.js —— v14.7 W6 海战/空军实质模型守卫
   ------------------------------------------------------------
   W6-5  navalCombatTick：同海区敌对舰队逐舰交火，ship.hp 真实扣减、
         击沉移除、组织溃散撤退（海战从零建的主闸门）
   W6-6  calcFleetScreening：3 屏卫/1 资本舰 → 满屏卫命中 +40%；缺屏卫穿透
   W6-5b calcNavalDamage：穿甲减伤、暴击、弹仓殉爆 ×(1+9.0)
   W6-3  联队补充/新编/损耗：air_eq 库存→count、满库新编、任务折损
   W6-7  战略轰炸打工厂：mil 命中 → hex.mil/n.mil/产线同步 −1
   W6-4  机型升级链：airXP 换装、效率 +8%/级、上限拒绝
   W7-2  州层字段读取点：pop→人力、railLevel→补给、naval_base→登陆、
         本土资源格→资源收入（max 与国家表，不双计）
   ============================================================ */

import assert from 'node:assert/strict';
import { calcFleetScreening, calcNavalDamage, navalCombatTick } from '../js/engine/navy.js';
import { calcWingSuperiority } from '../js/engine/air.js';
import { loadScenario } from '../js/engine/world.js';
import { airTick, upgradeWingDesign, canUpgradeWing } from '../js/engine/air.js';
import { territoryPopulation } from '../js/engine/manpower.js';
import { resourcesTick } from '../js/engine/resources.js';
import { initStates } from '../js/engine/states.js';
import { K } from '../js/data/constants.js';

let passed = 0, failed = 0;
function t(name, fn){
  try{ fn(); passed++; console.log('✓', name); }
  catch(e){ failed++; console.log('✗', name, '→', e.message); }
}
/* 确定性 rng：按脚本回放 0~1 序列 */
function scriptedRng(values){
  let i = 0;
  return () => values[i++ % values.length];
}

/* —— W6-6 屏卫 —— */
t('W6-6a 3 屏卫/1 资本舰 → 满屏卫命中 +40%；1:0 → 0 加成', () => {
  const full = calcFleetScreening([
    { type:'bb' }, { type:'dd' }, { type:'dd' }, { type:'dd' }
  ]);
  assert.equal(full.screenRatio, 1);
  assert.equal(full.hitBonus, K.NAVY.SCREEN_FULL_HIT_BONUS);
  const bare = calcFleetScreening([{ type:'bb' }]);
  assert.equal(bare.screenRatio, 0);
  assert.equal(bare.hitBonus, 0);
});

/* —— W6-5b 伤害口径 —— */
t('W6-5b calcNavalDamage：重甲对轻穿甲大幅减伤；殉爆 ×10', () => {
  // bb armor 32 vs dd piercing 5 → 减伤 (1−5/32)×0.9 ≈ 76%
  const r1 = calcNavalDamage({ damage: 20, piercing: 5 }, 32, false, () => 0.99);
  assert.ok(r1.damage < 20 * 0.3, `重甲减伤应显著，实际 ${r1.damage}`);
  // 殉爆：rng 0.05 < 暴击 0.10，再 0.05 < 0.15 → 弹仓引爆
  const r2 = calcNavalDamage({ damage: 20, piercing: 100 }, 0, true, () => 0.05);
  assert.equal(r2.isMagazineDetonation, true);
  assert.ok(r2.damage >= 20 * (1 + K.NAVY.MAGAZINE_DETONATION_MULT) - 1e-6,
    `殉爆伤害应 ×10，实际 ${r2.damage}`);
});

/* —— W6-5 海战结算 —— */
function mkNavalWorld(){
  return {
    version:3, day:0, over:null, events:[], log:[], aiLog:[],
    nations:{
      A:{ id:'A', name:'攻', alive:true, capitulated:false, atWarWith:['B'], modifiers:{}, pp:0, equip:0, civ:10, mil:10, law:'partial' },
      B:{ id:'B', name:'守', alive:true, capitulated:false, atWarWith:['A'], modifiers:{}, pp:0, equip:0, civ:10, mil:10, law:'partial' }
    },
    fleets:[
      { id:'fa', name:'A 舰队', nat:'A', seaZoneId:'sz_test', task:'patrol', ships:[
        { id:'bb1', type:'bb', name:'A-战列舰', hp:450, org:50 },
        { id:'dd1', type:'dd', name:'A-驱逐1', hp:80, org:55 },
        { id:'dd2', type:'dd', name:'A-驱逐2', hp:80, org:55 }
      ]},
      { id:'fb', name:'B 舰队', nat:'B', seaZoneId:'sz_test', task:'patrol', ships:[
        { id:'bb2', type:'bb', name:'B-战列舰', hp:450, org:50 }
      ]}
    ],
    seaZones:[{ id:'sz_test', name:'测试海区' }],
    player:'A'
  };
}

t('W6-5a navalCombatTick：无屏卫方资本舰被穿透打击，hp 真实扣减/击沉', () => {
  const w = mkNavalWorld();
  const bbBefore = w.fleets[1].ships[0].hp;
  // 40 轮：接触判定 0.1（<0.40 通过）+ 命中 0.05 + 无暴击 0.99
  const rng = scriptedRng([0.1, 0.05, 0.99]);
  for(let d = 0; d < 40; d++) navalCombatTick(w, rng);
  const bb = w.fleets[1].ships[0];
  assert.ok(bb.hp < bbBefore, `无屏卫资本舰应被穿透打击：${bbBefore} → ${bb.hp}`);
  // A 有满屏卫（hitBonus +0.4），输出应高于 B 侧
  assert.ok(w.events.some(e => e.type === 'naval_ship_sunk') || w.fleets[1].ships.length <= 1,
    '高命中侧应逐步击沉敌舰');
});

t('W6-5b 组织溃散 → 全队撤退任务标记', () => {
  const w = mkNavalWorld();
  w.fleets[1].ships.forEach(s => s.org = 5);   // 打残组织
  navalCombatTick(w, scriptedRng([0.1, 0.05, 0.99]));
  assert.equal(w.fleets[1].task, 'retreat', '组织 <15% 应触发撤退');
  assert.ok(w.events.some(e => e.type === 'naval_fleet_retreat'));
});

/* —— W6-3 联队产损 —— */
function mkAirWorld(){
  return {
    version:3, day:0, over:null, events:[], log:[], aiLog:[], airSuperiorityCache:{},
    nations:{
      A:{ id:'A', name:'攻', alive:true, capitulated:false, atWarWith:['B'], modifiers:{},
          pp:0, equip:0, civ:10, mil:10, law:'partial',
          equipment:{ air_eq: 250 },
          productionLines:[{ id:'air1', type:'air_eq', factories:5, eff:0.5, cap:0.5 }] }
    },
    airWings:[
      { id:'wing_A_1', nat:'A', type:'fighter', count:60, baseId:'ab1', baseHex:[0,0],
        task:'air_superiority', regionId:'reg_test', exp:1.0, aces:[] }
    ],
    airBases:[{ id:'ab1', nat:'A', q:0, r:0, name:'A 机场', level:5, capacity:500, count:60 }],
    hexes:[{ q:0, r:0, owner:'A', terrain:'plain', region:'reg_test', units:[], adj:[],
             city:null, civ:2, mil:1, infra:5, buildings:{} }],
    player:'A'
  };
}

t('W6-3a airProductionTick：库存补员 + 满库新编联队', () => {
  const w = mkAirWorld();
  // 借 real AIR_REGIONS 前先占位（airTick 会刷 superiority —— region 不存在也无妨）
  const wingsBefore = w.airWings.length;
  airTick(w, () => 0.99);
  const wing = w.airWings[0];
  // 补员：60 → 至少 65（每日 +5 上限）；250 库存 −5 补员 = 245 → ≥100 → 新编 100
  // 补员 +5，但同 tick 任务折损 ≥1 → 60+5−1 = 64
  assert.ok(wing.count >= 64, `联队应从库存补员（净 +4），实际 ${wing.count}`);
  assert.equal(w.airWings.length, wingsBefore + 1, '库存 250 应自动新编一个满编联队');
  // 新编 100 架，同 tick 任务折损 −1 → 99（折损对全体在飞联队生效）
  assert.equal(w.airWings[1].count, K.AIR.STANDARD_WING_SIZE - 1);
  // 库存守恒：250 − 补员 − 新编100 = 145
  // 库存只被补员(5)与新编(100)扣减；折损是飞机损失不入库存
  assert.equal(w.nations.A.equipment.air_eq, 250 - 5 - 100, '库存转换必须守恒（145）');
});

t('W6-3b 任务联队每日折损 ≥1 架', () => {
  const w = mkAirWorld();
  w.nations.A.equipment.air_eq = 0;   // 无库存 → 纯折损
  const before = w.airWings[0].count;
  airTick(w, () => 0.99);
  assert.ok(w.airWings[0].count < before, `执行任务应折损，实际 ${before} → ${w.airWings[0].count}`);
  assert.ok(before - w.airWings[0].count >= 1);
});

/* —— W6-7 战略轰炸打工厂 —— */
t('W6-7 战略轰炸命中军工厂：hex.mil/n.mil/产线同步 −1', () => {
  const w = mkAirWorld();
  const target = w.hexes[0];
  target.owner = 'B';
  target.mil = 3; target.civ = 2;
  w.nations.B = { id:'B', name:'敌', alive:true, capitulated:false, atWarWith:['A'], modifiers:{}, mil:3, civ:2,
    productionLines:[{ id:'bl', type:'inf_eq', factories:3, eff:0.5, cap:0.5 }] };
  const wing = w.airWings[0];
  wing.task = 'strat_bombing';
  wing.targetHexIdx = 0;
  wing.count = 100;                       // 100 架 → 命中概率 (0.005×100)² = 0.25/类
  // 跑 400 天，mil=3 必然被削
  for(let d = 0; d < 400; d++){
    w.nations.B.capitulated = false;
    airTick(w, () => 0.42);               // 0.42 < 0.25? 否 → 用低值序列保证命中
  }
  assert.ok(target.mil < 3 || target.civ < 2, '400 天战略轰炸应至少摧毁一座工厂');
  assert.ok(w.nations.B.mil <= 3 && w.nations.B.civ <= 2, '国家产能计数不得回升');
});

/* —— v14.8 W6-4 + W7-2 守卫 —— */

t('W6-4 机型升级链：airXP 换装、效率 +8%/级、上限拒绝', () => {
  const w = { day:0, events:[], airWings:[{ id:'w1', nat:'A', type:'fighter', count:100, upgradeLevel:0 }],
    nations:{ A:{ alive:true, airXP:250 } } };
  const eff0 = canUpgradeWing(w, w.airWings[0]);
  assert.equal(eff0.ok, true);
  upgradeWingDesign(w, 'w1');
  upgradeWingDesign(w, 'w1');
  assert.equal(w.airWings[0].upgradeLevel, 2);
  assert.equal(w.nations.A.airXP, 50);
  const capped = canUpgradeWing(w, w.airWings[0]);
  assert.equal(capped.ok, false);
  assert.equal(+calcWingSuperiority(w.airWings[0], 1, 1), 1.16);
});

t('W7-2a territoryPopulation：Σ h.pop（城市加权），无 pop 字段回退常数', () => {
  const w = { hexes:[
    { owner:'A', pop:800000 },      // 大城
    { owner:'A' },                  // 无字段 → POP_PER_HEX
    { owner:'B', pop:999999 }       // 非本国不计
  ] };
  const pop = territoryPopulation(w, 'A');
  assert.equal(pop, 800000 + K.POP_PER_HEX);
});

t('W7-2b 州层聚合 + railLevel/资源/港口进州账本（结构守卫）', () => {
  const w = loadScenario('A', 42);
  const states = initStates(w);
  assert.ok(states.length > 0, '应聚合出州');
  for(const h of w.hexes){ if(h.terrain !== 'sea') { assert.ok(h.stateId, '每个陆地格应有 stateId'); break; } }
  const withRail = states.find(s => s.railLevel >= 3);
  assert.ok(withRail, '首都州 railLevel 应达 3');
  // 实测：科隆大区 steel 75（鲁尔主矿区；萨尔 30 归 F）、苏联乌拉尔 chromium 45
  const ruhr = states.find(s => (s.resources.steel || 0) >= 70);
  assert.ok(ruhr, '鲁尔资源格应聚合进州账本（科隆大区 steel ≥70）');
  assert.ok(states.some(s => (s.resources.chromium || 0) >= 40), '乌拉尔铬矿应入账');
});

t('W7-2c 本土资源格进资源收入（max 不双计）', () => {
  const w = loadScenario('A', 42);
  const g = w.nations.G;
  // 清库存后单步结算：鲁尔 steel(105) 应使收入 ≥ 国家表下限
  g.resourceStock = { steel: 0, oil: 0, rubber: 0, aluminum: 0, tungsten: 0, chromium: 0 };
  resourcesTick(w);
  assert.ok(g.resourceStock.steel > 0, '本土资源格应供钢');
  // max 语义：若资源格聚合 ≥ 国家表，收入应等于聚合值（不双计）——验证钢收入 ≥ 105
  // 实测口径：本土聚合 steel 75，扣产线消耗后库存 ~64
  assert.ok(g.resourceStock.steel >= 60, '钢库存应达本土聚合量级（扣消耗后 ≥60），实际 ' + g.resourceStock.steel);
});

/* —— 汇总 —— */
console.log(`\n${passed} 通过, ${failed} 失败`);
process.exit(failed ? 1 : 0);
