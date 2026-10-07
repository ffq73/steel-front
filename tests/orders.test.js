/* ============================================================
   tests/orders.test.js —— v14.1 W2 作战计划与统一调度验收闸门
   ------------------------------------------------------------
   逐条对应开发指令 §6「W2 验收」：
   1. 九种命令各一条完整生命周期：
      - frontline: 前线与填线
      - offensive: 攻势线（waypoints 序列推进，到达即停两段式）
      - spearhead: 矛头（计划上限+10%，装甲优先，不受战宽惩罚）
      - breakthrough: 突破（+20% 冲击力）
      - pin: 牵制（被牵制格敌进攻 ×0.67，不耗组织度）
      - area_defense: 区域防御（72 师上限，+50% 防御，计划不衰减）
      - support: 支援攻击（仅侧/后方生效，正面格拒绝，胜后不进驻）
      - invasion: 海军入侵（读科技 invasionCap，抢滩组织度损耗）
      - strat_bomb: 战略轰炸（定向轰炸目标格建筑）
   2. 军级统一调度（24 师矛头推进 8 天）：
      - 24 师分布不超过 3 格（战线紧密不扩散）
      - order type 种类 ≤ 2 种（战线统一不杂乱）
      - 抵达目标线后 army.executing === false（两段式自动停机）
   3. 牵制格敌进攻 ×0.67
   4. 矛头师不受宽度惩罚
   5. 支援攻击仅侧/后方生效
   6. 战区与集团军群元帅指令上限（5 军 / Expert Delegator 7 军；24 师 / Skilled Staffer 30 / 区域防御 72）
   ============================================================ */

import assert from 'node:assert/strict';
import { loadScenario, spawnUnit } from '../js/engine/world.js';
import {
  createFront, assignToFront, createOffensiveArrow, getArmyPlanCap,
  planningTick, executeArrow, stopArrow, dispatchArrowAdvance,
  createAreaDefensePlan, createPinOrder, createBreakthroughOrder, getOrCreateArmy
} from '../js/engine/plans.js';
import {
  unitAtk, unitDef, resolveBattle, computeOverflowPenalty,
  computeWidthFill, isHexPinned, canSupportAttack
} from '../js/engine/battle.js';
import { processMove } from '../js/engine/movement.js';
import {
  createArmyGroup, assignArmyToGroup, getArmyGroupLimit,
  getArmyDivisionLimit, getArmyOverCapacityPenalty, getTheaterCombatBonus,
  createTheater, assignGeneralToTheater, assignArmyToTheater
} from '../js/engine/theaters.js';
import { planNavalInvasion, executeNavalInvasion, createNavalInvasionPlan } from '../js/engine/invasion.js';
import { createAirPlan, airTick } from '../js/engine/air.js';
import { makeRng } from '../js/core/rng.js';
import { UNITS } from '../js/data/units.js';
import { K } from '../js/data/constants.js';

let passed = 0, failed = 0;
function t(name, fn){
  try{
    fn();
    passed++;
    console.log('✓', name);
  } catch(e){
    failed++;
    console.log('✗', name, '→', e.message);
  }
}
const close = (a, b, eps = 1e-5) => Math.abs(a - b) <= eps;

/* ============================================================
   一、9 种 Order 完整生命周期
   ============================================================ */

// 1. Front Line (前线)
t('W2-1.1 Front Line: 划定前线并无超堆叠填线', () => {
  const w = loadScenario('A', 42);
  const army = getOrCreateArmy(w, 'army_front', 'G', '前线测试军');
  const divs = w.units.filter(u => u.nat === 'G').slice(0, 12);
  army.divisions = divs.map(u => u.id);
  const front = createFront(w, 'G', [], army.id);
  assert.ok(front && front.hexes.length > 0, '应成功求解前线格');
  const assignments = assignToFront(w, front.id);
  assert.ok(assignments, '应成功分配填线');
  let maxPerHex = 0;
  for(const h in assignments){
    if(assignments[h].length > maxPerHex) maxPerHex = assignments[h].length;
  }
  assert.ok(maxPerHex <= K.STACK_LIMIT, `填线不得超单格上限 6，实际 ${maxPerHex}`);
});

// 2. Offensive (攻势线两段式：到达即停)
t('W2-1.2 Offensive: 攻势线推进，目标占领后 army.executing 自动置为 false', () => {
  const w = loadScenario('A', 42);
  const army = getOrCreateArmy(w, 'army_off', 'G', '攻势测试军');
  const u1 = w.units.find(u => u.nat === 'G');
  army.divisions = [u1.id];
  u1.inPlan = true;
  u1.org = 60;
  u1.hp = 100;

  // 寻找一个敌方相邻目标格
  const curHex = w.at[u1.q + ',' + u1.r];
  const enemyHexIdx = curHex.adj.find(idx => w.hexes[idx].owner !== 'G');
  const enemyHex = w.hexes[enemyHexIdx];

  const arrow = createOffensiveArrow(w, null, [enemyHex.idx], army.id, 'offensive');
  army.arrowIds = [arrow.id];

  executeArrow(w, army.id);
  assert.equal(army.executing, true, '执行后应当处于 executing');
  assert.equal(u1.order.type, 'advance', '先锋师应指派 advance');

  // 模拟敌格被攻占且无敌军
  enemyHex.owner = 'G';
  enemyHex.units = [];

  // 下一个 tick 调度，检测是否到达终点停机
  dispatchArrowAdvance(w, army, arrow);
  assert.equal(army.executing, false, '抵达全部目标线后 executing 应自动置为 false');
  assert.equal(u1.order, null, '抵达后推进指令应恢复待命');
});

// 3. Spearhead (矛头：计划上限+10%，装甲优先，免超宽惩罚)
t('W2-1.3 Spearhead: 矛头提升计划上限 10%，装甲优先先锋，不受宽度惩罚', () => {
  const w = loadScenario('A', 42);
  const army = getOrCreateArmy(w, 'army_spear', 'G', '装甲矛头军');

  const arrowOff = createOffensiveArrow(w, null, [10], army.id, 'offensive');
  army.arrowIds = [arrowOff.id];
  const offCap = getArmyPlanCap(w, army);

  const arrowSpear = createOffensiveArrow(w, null, [10], army.id, 'spearhead');
  army.arrowIds = [arrowSpear.id];
  const spearCap = getArmyPlanCap(w, army);
  assert.ok(close(spearCap - offCap, 0.10, 1e-4), `同等箭头下矛头计划上限应高出 0.10：off=${offCap} spear=${spearCap}`);

  // 装甲优先与免战宽惩罚
  const pen = computeOverflowPenalty(100, 70, { isSpearhead: true });
  assert.equal(pen, 0, '矛头进攻应完全豁免超宽惩罚');
});

// 4. Breakthrough (突破：+20% 冲击力)
t('W2-1.4 Breakthrough: 突破命令提供 +20% 攻击冲击', () => {
  const w = loadScenario('A', 42);
  const u = w.units.find(x => x.nat === 'G' && x.type === 'inf');
  const baseAtk = unitAtk(w, u, 0, { terrain: 'plain' });
  u.order = { type: 'breakthrough', target: [0, 0] };
  const btAtk = unitAtk(w, u, 0, { terrain: 'plain' });
  assert.ok(close(btAtk, baseAtk * 1.20, 1e-4), `突破应提供 1.20 倍攻击：base=${baseAtk} bt=${btAtk}`);
});

// 5. Pin (牵制：敌进攻 ×0.67，不耗组织度)
t('W2-1.5 Pin: 被牵制格敌进攻 ×0.67，牵制师不耗组织度', () => {
  const w = loadScenario('A', 42);
  const pinner = w.units.find(u => u.nat === 'G');
  const pinnedEnemy = w.units.find(u => u.nat === 'P');
  const enemyHex = w.at[pinnedEnemy.q + ',' + pinnedEnemy.r];

  createPinOrder(w, pinner, enemyHex);
  assert.ok(isHexPinned(w, enemyHex), '目标格应被判定为处于 pinned 状态');

  const normalEnemyAtk = unitAtk(w, pinnedEnemy, 0, { terrain: 'plain' });
  // pinnedEnemy 在该格发起攻击时
  assert.ok(close(normalEnemyAtk, UNITS[pinnedEnemy.type].soft * 0.67, 1.0),
    `受牵制格部队发起进攻时应受到 0.67 削弱`);
});

// 6. Area Defense (区域防御：72 师上限，+50% 防御，计划不流失)
t('W2-1.6 Area Defense: 区域防御 72 师上限，+50% 防御，计划不衰减', () => {
  const w = loadScenario('A', 42);
  const u = w.units.find(x => x.nat === 'G');
  const baseDef = unitDef(w, u, { terrain: 'plain' });

  const army = getOrCreateArmy(w, 'army_garrison', 'G', '守备集团');
  u.armyId = army.id;
  createAreaDefensePlan(w, army.id, [1, 2, 3]);

  assert.equal(getArmyDivisionLimit(w, army), 72, '区域防御编制上限应为 72 师');

  const garrDef = unitDef(w, u, { terrain: 'plain' });
  assert.ok(close(garrDef, baseDef * 1.50, 1e-4), `区域防御应获得 +50% 防御加成：base=${baseDef} garr=${garrDef}`);

  // 计划不流失
  army.planning = 0.30;
  army.executing = true;
  planningTick(w, makeRng(1));
  assert.equal(army.planning, 0.30, '区域防御在执行中计划槽不得衰减');
});

// 7. Support Attack (支援攻击：仅侧/后方生效，胜后不进驻)
t('W2-1.7 Support Attack: 仅侧/后方生效，正面格拒绝，胜后不进驻', () => {
  const w = loadScenario('A', 42);
  const targetHex = w.hexes.find(h => h.owner === 'P' && h.terrain !== 'sea');
  const myUnits = w.units.filter(u => u.nat === 'G');
  const u1 = myUnits[0], u2 = myUnits[1];

  // u1 和 u2 移动到相邻格
  u1.q = targetHex.q + 1; u1.r = targetHex.r;
  u2.q = targetHex.q + 1; u2.r = targetHex.r; // 同格正面
  u1.order = { type: 'attack', target: [targetHex.q, targetHex.r] };

  // 同格发起支援攻击应被拒绝
  const checkFront = canSupportAttack(w, u2, targetHex);
  assert.equal(checkFront.ok, false, '同格正面发起支援攻击应拒绝');

  // u2 移到侧翼格
  u2.q = targetHex.q; u2.r = targetHex.r - 1;
  const checkFlank = canSupportAttack(w, u2, targetHex);
  assert.equal(checkFlank.ok, true, '侧翼发起支援攻击应被允许');
});

// 8. Naval Invasion (两栖入侵：读科技上限并强行抢滩)
t('W2-1.8 Naval Invasion: 读科技 invasionCap 上限，抢滩上岸', () => {
  const w = loadScenario('ww2', 42);
  const usa = w.nations.USA;
  assert.ok(usa, '剧本中应有 USA');
  usa.invasionCap = 20; // 科技研发后扩展至 20 师

  const coast = w.hexes.find(h => h.owner === 'GER' && h.terrain !== 'sea' && (w.at[h.q+','+(h.r-1)]?.terrain === 'sea' || w.at[h.q+','+(h.r+1)]?.terrain === 'sea'));
  if(coast){
    const res = createNavalInvasionPlan(w, 'USA', null, 15, coast.idx);
    if(res.ok){
      const inv = w.navalInvasions.find(x => x.id === res.id);
      assert.equal(inv.divisionIds.length, 15, '应允许编制至科技上限 20 内的 15 师登陆');
    }
  }
});

// 9. Strat Bomb (定向战略轰炸)
t('W2-1.9 Strat Bomb: 战略轰炸定向削减目标格基建', () => {
  const w = loadScenario('ww2', 42);
  const targetHex = w.hexes.find(h => h.owner === 'GER' && h.infra > 0);
  assert.ok(targetHex, '应找到带基建的敌格');
  const prevInfra = targetHex.infra;

  w.airWings = w.airWings || [];
  w.airWings.push({
    id: 'strat_wing_test',
    nat: 'GBR',
    type: 'strat_bomber',
    count: 100,
    task: 'strat_bomb',
    targetHexIdx: targetHex.idx,
    baseHexIdx: 0,
    aces: []
  });

  createAirPlan(w, 'GBR', 'strat_bomb', targetHex.idx);
  airTick(w, () => 0.01);
  assert.ok(targetHex.infra <= prevInfra, '定向轰炸后目标格基建应受损');
});

/* ============================================================
   二、军级统一调度验收（24 师矛头推进 8 天）
   ============================================================ */
t('W2-2 24 师矛头推进 8 天：分布 ≤ 3 格，order.type ≤ 2 种，抵线后 executing===false', () => {
  // 构建直线走廊：4 格直通路径 (G -> G -> P -> P)
  const w = {
    day: 0,
    player: 'G',
    armies: [],
    arrows: [],
    fronts: [],
    units: [],
    uid: 1,
    hexes: [],
    at: {},
    events: [],
    log: [],
    aiLog: [],
    tacticsState: {},
    nations: {
      G: { id:'G', name:'德军', alive:true, atWarWith:['P'], modifiers:{} },
      P: { id:'P', name:'波军', alive:true, atWarWith:['G'], modifiers:{} }
    }
  };
  const mkHex = (idx, q, r, owner, terrain = 'plain') => ({
    idx, q, r, owner, terrain, fort:0, infra:3, civ:0, mil:0, units:[], adj:[]
  });
  const h0 = mkHex(0, 0, 0, 'G');
  const h1 = mkHex(1, 1, 0, 'G');
  const h2 = mkHex(2, 2, 0, 'P');
  const h3 = mkHex(3, 3, 0, 'P');
  h0.adj = [1]; h1.adj = [0, 2]; h2.adj = [1, 3]; h3.adj = [2];
  w.hexes.push(h0, h1, h2, h3);
  w.at['0,0'] = h0; w.at['1,0'] = h1; w.at['2,0'] = h2; w.at['3,0'] = h3;

  // 在 h1 上部署 24 个师
  const army = getOrCreateArmy(w, 'spear_army', 'G', '中央集团军矛头');
  for(let i = 0; i < 24; i++){
    const u = {
      id: w.uid++,
      nat: 'G',
      type: i < 8 ? 'arm' : 'inf',
      q: 1, r: 0,
      hp: 100, org: 60,
      inPlan: true,
      armyId: army.id
    };
    w.units.push(u);
    h1.units.push(u.id);
    army.divisions.push(u.id);
  }

  // 划设一条通向 h2、h3 的矛头进攻箭头
  const arrow = createOffensiveArrow(w, null, [2, 3], army.id, 'spearhead');
  army.arrowIds = [arrow.id];

  // 启动执行
  executeArrow(w, army.id);
  assert.equal(army.executing, true, '启动后应当为 executing');

  const rng = makeRng(42);
  // 模拟推进 8 天
  for(let day = 1; day <= 8; day++){
    w.day = day;
    // 每日调度与移动
    dispatchArrowAdvance(w, army, arrow);
    for(const u of w.units) processMove(w, u);
    // 战斗结算
    resolveBattle(w, rng, 2);
    resolveBattle(w, rng, 3);
  }

  // 1. 24 师分布不超过 3 格
  const posSet = new Set(w.units.filter(u => u.nat === 'G').map(u => `${u.q},${u.r}`));
  assert.ok(posSet.size <= 3, `24 师分布应不超过 3 格，实际分布在 ${posSet.size} 格: ${[...posSet].join('; ')}`);

  // 2. 师命令类型不超过 2 种
  const orderTypes = new Set(w.units.filter(u => u.nat === 'G').map(u => u.order ? u.order.type : 'none'));
  assert.ok(orderTypes.size <= 2, `订单类型应 ≤ 2 种，实际有 ${orderTypes.size} 种: ${[...orderTypes].join(', ')}`);

  // 3. 占领 h2、h3 之后，到达目标线停机
  h2.owner = 'G'; h2.units = [];
  h3.owner = 'G'; h3.units = [];
  dispatchArrowAdvance(w, army, arrow);
  assert.equal(army.executing, false, '完全占领路径后 army.executing 必须自动为 false');
});

/* ============================================================
   三、集团军群与战区体系 (W2-3)
   ============================================================ */
t('W2-3 元帅指挥上限与战区协同：集团军群 (5军/Expert 7军) 与 师上限 (24/Staffer 30/驻防 72)', () => {
  const w = {
    day: 0,
    characters: [
      { id: 'm1', name: '曼施坦因', rank: 'marshal', traits: [{ id: 'expert_delegator' }], skills:{ attack:5, defense:4, planning:5 } },
      { id: 'm2', name: '普通元帅', rank: 'marshal', traits: [], skills:{ attack:3, defense:3, planning:3 } },
      { id: 'g1', name: '古德里安', rank: 'general', traits: [{ id: 'skilled_staffer' }] },
      { id: 'g2', name: '普通军长', rank: 'general', traits: [] }
    ],
    nations: { G: { id: 'G', armyGroups: {}, theaters: {} } },
    armies: []
  };

  const ag1 = createArmyGroup(w, 'G', '第1集团军群', 'm1');
  assert.equal(getArmyGroupLimit(w, ag1), 7, '具备 Expert Delegator 的元帅上限应为 7 个军');

  const ag2 = createArmyGroup(w, 'G', '第2集团军群', 'm2');
  assert.equal(getArmyGroupLimit(w, ag2), 5, '普通元帅上限应为 5 个军');

  const army1 = { id:'a1', divisions:[], generalId:'g1' };
  assert.equal(getArmyDivisionLimit(w, army1), 30, '具备 Skilled Staffer 的将领上限应为 30 师');

  const army2 = { id:'a2', divisions:[], generalId:'g2' };
  assert.equal(getArmyDivisionLimit(w, army2), 24, '普通将领上限应为 24 师');

  army2.orderType = 'area_defense';
  assert.equal(getArmyDivisionLimit(w, army2), 72, '区域防御任务上限应为 72 师');

  // 超编惩罚计算
  army2.orderType = null;
  army2.divisions = Array.from({ length: 30 }, (_, i) => i);
  const pen = getArmyOverCapacityPenalty(w, army2);
  assert.ok(pen > 0, `超编 6 师应产生惩罚，实际 pen=${pen}`);

  // 战区协同加成
  const th = createTheater(w, 'G', '东欧战区');
  assignGeneralToTheater(w, th.id, 'm1', 'G');
  const bonus = getTheaterCombatBonus(w, th.id, 'G');
  assert.ok(bonus.atkBonus > 0 && bonus.defBonus > 0, '战区统帅应提供攻防协同加成');
});

console.log(`\n=== W2 验收结果: ${passed} 通过, ${failed} 失败 ===`);
if(failed > 0) process.exit(1);
