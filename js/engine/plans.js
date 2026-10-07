/* ============================================================
   engine/plans.js —— 前线与作战计划系统 (v4.0 §2 / P1)
   实现军与集团军建制、划线、填线、进攻箭头、退守线、计划加成与战术卡
   ============================================================ */

import { K } from '../data/constants.js';
import { hexDist } from '../core/geom.js';
import { UNITS } from '../data/units.js';
import { theaterNameFor } from '../data/theaters.js';
import { templateHasSupport } from './template.js';
import { getCharacterSkills } from './characters.js';
import { nationMod } from './mods.js';

let planIdCounter = 1;

/**
 * 获取或创建军 Army
 */
export function getOrCreateArmy(world, armyId, natId, name = '第1野战军'){
  world.armies = world.armies || [];
  let a = world.armies.find(x => x.id === armyId);
  if(!a){
    a = {
      id: armyId,
      name,
      nat: natId,
      generalId: null,
      divisions: [],
      frontId: null,
      arrowIds: [],
      fallbackHexes: [],
      planning: 0,
      executing: false,
      lastTickDay: -1
    };
    // W0-C：建军时顺位指派一位已任命将领。
    // 此前 generalId 恒为 null（唯一赋值点在死代码 panelArmy.js 里），
    // 于是 getGeneralSkills 永远返回 {3,3,3,3}：
    //   · 计划积累速率恒为 0.2%/天（不看将领 planning 技能）
    //   · 战术卡判定恒用 tactics=3
    //   · 指挥官技能对战斗 0 影响
    // 未被占用的已任命将领按顺序认领第一支空军。
    const n = world.nations[natId];
    const assigned = (n && n.assignedGenerals) || [];
    if(assigned.length){
      const taken = new Set(world.armies.map(x => x.generalId).filter(Boolean));
      a.generalId = assigned.find(gid => !taken.has(gid)) || assigned[0];
    }
    world.armies.push(a);
  }
  return a;
}

/**
 * 求解己方格子中与敌国相邻的前线格（边界求解）
 */
export function findFrontierHexes(world, natId, candidateHexIdxs = null){
  const hexes = candidateHexIdxs 
    ? candidateHexIdxs.map(i => world.hexes[i]).filter(Boolean)
    : world.hexes.filter(h => h.owner === natId);

  const frontier = [];
  const atWarWith = (world.nations[natId] && world.nations[natId].atWarWith) || [];

  for(const h of hexes){
    if(h.owner !== natId) continue;
    const isFront = (h.adj || []).some(adjIdx => {
      const neighbor = world.hexes[adjIdx];
      return neighbor && atWarWith.includes(neighbor.owner);
    });
    if(isFront) frontier.push(h.idx);
  }
  return frontier;
}

/**
 * 解析某国的默认野战军（UI 侧「划前线 / 进攻矛头 / 启动执行」不传 armyId 时用）
 * v11.0：此前这些按钮全部传 null，导致 front.armyId 恒为 null、
 * assignToFront 挂不上任何师、planningTick 遍历空列表 —— 整套作战计划空转。
 */
export function defaultArmyOf(world, natId){
  world.armies = world.armies || [];
  let army = world.armies.find((a) => a.nat === natId);
  if(!army){
    army = getOrCreateArmy(world, `army_${natId}_1`, natId, `${(world.nations[natId] || {}).name || natId}第1野战军`);
  }
  return army;
}

/**
 * 1. 划线（Front Line）：在己方边界生成一条防守线
 */
export function createFront(world, natId, hexIdxs = [], armyId = null){
  world.fronts = world.fronts || [];
  const id = 'front_' + (planIdCounter++);

  // armyId 缺省时落到本国默认军，保证「划线 → 填线」这条链不会断在半路
  if(!armyId && world.nations && world.nations[natId]) armyId = defaultArmyOf(world, natId).id;

  // 若未显式传入 hexIdxs，则自动求解边界
  const actualHexes = hexIdxs.length ? hexIdxs : findFrontierHexes(world, natId);

  const front = {
    id,
    nat: natId,
    armyId,
    // v11.0：按覆盖地区命名（西线（巴黎方向）/ 莫斯科卫戍圈）——
    // 地图放大后一条国境线长达十几格，只叫「前线」玩家分不清是哪条
    name: theaterNameFor(world, actualHexes),
    hexes: actualHexes,
    assigned: {} // hexIdx -> [unitId, ...]
  };

  world.fronts.push(front);

  if(armyId){
    const army = getOrCreateArmy(world, armyId, natId);
    army.frontId = id;
  }

  return front;
}

/**
 * 2. 填线（Assign to Front）：自动将所属军全部师均匀且按威胁度分配至前线格
 */
export function assignToFront(world, frontId){
  world.fronts = world.fronts || [];
  const front = world.fronts.find(f => f.id === frontId);
  if(!front) return {};

  const army = world.armies ? world.armies.find(a => a.id === front.armyId) : null;
  const unitIds = army ? [...army.divisions] : world.units.filter(u => u.nat === front.nat).map(u => u.id);
  // 没有军的国家兜底：就地建一个默认军，把参战师登记进去，
  // 否则 u.armyId 不会被写回，后续计划积累与执行也没有归属
  const fallbackArmy = army || defaultArmyOf(world, front.nat);
  if(!army && fallbackArmy){
    fallbackArmy.divisions = unitIds;
    front.armyId = fallbackArmy.id;
  }

  front.assigned = {};
  for(const hIdx of front.hexes){
    front.assigned[hIdx] = [];
  }

  if(!front.hexes.length || !unitIds.length) return front.assigned;

  // 计算各前线格的威胁度（相邻敌师数量与战斗力）
  const threatScores = front.hexes.map(hIdx => {
    const h = world.hexes[hIdx];
    let threat = 0;
    if(h && h.adj){
      for(const adjIdx of h.adj){
        const neighbor = world.hexes[adjIdx];
        if(neighbor && neighbor.units){
          for(const uid of neighbor.units){
            const enemy = world.units.find(u => u.id === uid);
            if(enemy && enemy.hp > 0 && enemy.nat !== front.nat){
              threat += (UNITS[enemy.type] ? UNITS[enemy.type].soft : 10) * (enemy.hp / 100);
            }
          }
        }
      }
    }
    return { hIdx, threat };
  });

  // 按威胁度降序排序
  threatScores.sort((a,b) => b.threat - a.threat);

  // 循环轮询将师填入，单格堆叠硬上限 K.STACK_LIMIT (6)
  let unitIdx = 0;
  let loopGuard = 0;
  while(unitIdx < unitIds.length && loopGuard < unitIds.length * 2){
    for(const item of threatScores){
      if(unitIdx >= unitIds.length) break;
      const list = front.assigned[item.hIdx];
      if(list.length < K.STACK_LIMIT){
        const uid = unitIds[unitIdx++];
        list.push(uid);
        const u = world.units.find(x => x.id === uid);
        if(u){
          u.inPlan = true;
          u.frontId = front.id;
          if(fallbackArmy) u.armyId = fallbackArmy.id;
          // 若师不在该格，下达就位机动指令
          // v12.0 S2 回归修复：旧值 {type:'move', target} 缺 path 字段，
          // 违反 movement.js 的 order 契约（move {path}），下一 tick 即
          // TypeError 崩帧。改走 advance 分支 —— 自带敌接火转换、
          // 堆叠上限绕行与抵达清令，正是填线就位想要的语义。
          const targetHex = world.hexes[item.hIdx];
          if(targetHex && (u.q !== targetHex.q || u.r !== targetHex.r)){
            u.order = { type: 'advance', dest: [targetHex.q, targetHex.r] };
          }
        }
      }
    }
    loopGuard++;
  }

  return front.assigned;
}

/* ============================================================
   v12.0 S1 (C44)：玩家视角自动选靶 —— X/Shift+X 与「进攻矛头」按钮共用的唯一真源。
   旧逻辑按「地图包围盒最右下角」或「格子枚举顺序」选靶，德国 1939 按 X
   矛头指向耶路撒冷。本函数的基准点只允许是玩家前线质心或首都（C44）。
   纯函数、确定性：不读 rng、不写 world。
   返回 { target, theater, mainEnemy }；无交战国时返回 null。
   ============================================================ */
export function pickOffensiveTarget(world, kind = 'offensive'){
  const nat = world.nations[world.player];
  const atWarWith = (nat && nat.atWarWith) || [];
  if(!atWarWith.length) return null;

  // 主敌 = 与玩家共享边界格数最多的交战国
  const borderCount = new Map();
  for(const h of world.hexes){
    if(h.owner !== world.player) continue;
    for(const ni of (h.adj || [])){
      const nh = world.hexes[ni];
      if(nh && atWarWith.includes(nh.owner)){
        borderCount.set(nh.owner, (borderCount.get(nh.owner) || 0) + 1);
      }
    }
  }
  let mainEnemy = null, bestCount = -1;
  for(const [tag, n] of borderCount){
    if(n > bestCount){ bestCount = n; mainEnemy = tag; }
  }
  if(!mainEnemy) mainEnemy = atWarWith[0];

  // 基准点：玩家前线格（与任一交战国相邻的己方格）质心；无前线则玩家首都
  const frontierIdxs = findFrontierHexes(world, world.player);
  const frontier = frontierIdxs.map(i => world.hexes[i]).filter(Boolean);
  let base = null;
  if(frontier.length){
    let sq = 0, sr = 0;
    for(const h of frontier){ sq += h.q; sr += h.r; }
    base = { q: Math.round(sq / frontier.length), r: Math.round(sr / frontier.length) };
  } else {
    const cap = world.hexes.find(h => h.city && h.city.cap === world.player);
    if(cap) base = { q: cap.q, r: cap.r };
  }
  if(!base) return null;
  const dist = (h) => hexDist(h.q, h.r, base.q, base.r);

  const enemyHexes = world.hexes.filter(h => atWarWith.includes(h.owner));
  const enemyCities = enemyHexes.filter(h => h.city).sort((a, b) => dist(a) - dist(b));
  const enemyCaps = enemyCities.filter(h => h.city.cap);
  const mainCities = enemyCities.filter(h => h.owner === mainEnemy);

  let target = null;
  if(kind === 'spearhead'){
    // 矛头：主敌首都 → 最近敌国首都 → 最近敌国城市 → 交战格
    target = enemyCaps.find(h => h.city.cap === mainEnemy)
          || enemyCaps[0]
          || enemyCities[0];
  } else {
    // 攻势线：距基准点最近的主敌城市（华沙/波兹南方向），主敌无城时回退
    // 全体交战国城市。锚点仅限交战国，中立国不作候选。
    target = mainCities[0] || enemyCities[0];
  }
  if(!target){
    const contact = enemyHexes.filter(h => h.terrain !== 'sea').sort((a, b) => dist(a) - dist(b));
    target = contact[0] || enemyHexes[0] || null;
  }
  if(!target) return null;

  // 战区名（D7）：沿用前线命名语言；无前线时按前线质心所在区域现算
  const front = (world.fronts || []).find(x => x.nat === world.player);
  const theater = front ? front.name : theaterNameFor(world, frontierIdxs);

  return { target, theater, mainEnemy, base };
}

/**
 * 3. 进攻箭头（Offensive Arrow）
 */
export function createOffensiveArrow(world, frontId, waypoints = [], armyId = null, kind = 'offensive'){
  const a = createArrow(world, frontId, waypoints, armyId);
  a.kind = kind;
  return a;
}

/* ============================================================
   v8.0 M4：箭头形态编辑（Alt+左键弯曲 / Alt+右键拖重塑）
   ============================================================ */

/** 找到当前玩家最近编辑过的箭头（多个时取最后一个） */
function currentArrow(world){
  const list = (world.arrows || []).filter(a => a.nat === world.player);
  return list.length ? list[list.length - 1] : null;
}

/** Alt+左键：把某格插入箭头路径 → 箭头向该方向弯曲 */
export function bendArrow(world, hexIdx){
  const arrow = currentArrow(world);
  if(!arrow) return { ok:false, msg:'⚠️ 尚未标定进攻箭头，请先按 [X] 划设攻势线' };
  if(arrow.waypoints.includes(hexIdx)) return { ok:false, msg:'⚠️ 该格已在箭头路径上' };
  arrow.waypoints.push(hexIdx);
  arrow.targets.push(hexIdx);
  arrow.bends = (arrow.bends || 0) + 1;
  return { ok:true, msg:`↩️ 箭头已弯曲至 (${world.hexes[hexIdx].q},${world.hexes[hexIdx].r})，全师将取此迂回轴线` };
}

/** Alt+右键拖：用拖拽经过的格序列整体重塑箭头轴线（保留原最终目标） */
export function reshapeArrow(world, hexIdxs){
  if(!hexIdxs || !hexIdxs.length) return { ok:false, msg:'⚠️ 未记录到拖拽路径' };
  const arrow = currentArrow(world);
  if(!arrow) return { ok:false, msg:'⚠️ 尚未标定进攻箭头，请先按 [X] 划设攻势线' };
  const uniq = [...new Set(hexIdxs)];
  const goal = (arrow.targets || [])[arrow.targets.length - 1];
  arrow.waypoints = [...uniq];
  // 保留最终目标作为最后一层，重塑只改变轴线不改变终点
  arrow.targets = (goal != null && !uniq.includes(goal)) ? [...uniq, goal] : [...uniq];
  arrow.bends = 0;
  arrow.reshaped = true;
  return { ok:true, msg:`✏️ 箭头线形已重塑：沿 ${uniq.length} 格新轴线推进，终点不变` };
}
export function createArrow(world, frontId, waypoints = [], armyId = null){
  world.arrows = world.arrows || [];
  const id = 'arrow_' + (planIdCounter++);

  const front = (world.fronts || []).find(f => f.id === frontId);
  // armyId 缺省时沿用前线所属军 —— UI 的「进攻矛头」按钮只传前线 id，
  // 不补这一步箭头就永远不会登记到军的 arrowIds 上，计划加成也就没有来源
  if(!armyId && front && front.armyId) armyId = front.armyId;
  const nat = front ? front.nat : (armyId && world.armies ? world.armies.find(a => a.id === armyId).nat : world.player);

  // 根据 waypoint 沿途求解受击目标层级 (按距离排序)
  const targets = [];
  for(const wp of waypoints){
    if(!targets.includes(wp)) targets.push(wp);
  }

  const arrow = {
    id,
    frontId,
    armyId,
    nat,
    waypoints: [...waypoints],
    targets,
    progress: 0,
    active: false
  };

  world.arrows.push(arrow);

  if(armyId){
    const army = getOrCreateArmy(world, armyId, nat);
    army.arrowIds = army.arrowIds || [];
    if(!army.arrowIds.includes(id)) army.arrowIds.push(id);
  }

  return arrow;
}

/**
 * 4. 退守线（Fallback Line）
 */
export function createFallbackLine(world, natId, hexIdxs = [], armyId = null){
  world.fallbackLines = world.fallbackLines || [];
  const id = 'fallback_' + (planIdCounter++);
  const fb = { id, nat: natId, armyId, hexes: [...hexIdxs] };
  world.fallbackLines.push(fb);

  if(armyId){
    const army = getOrCreateArmy(world, armyId, natId);
    army.fallbackHexes = [...hexIdxs];
  }
  return fb;
}

/**
 * 计算将领有效技能与计划上限
 */
export function getArmyPlanCap(world, army){
  if(!army) return K.PLAN_BASE_CAP;
  const arrowCount = (army.arrowIds || []).length;
  const arrowBonus = arrowCount * K.PLAN_ARROW_BONUS;
  // W2-1: 矛头任务给额外 +10% 计划上限
  const hasSpearhead = (army.arrowIds || []).some(aid => {
    const a = (world.arrows || []).find(x => x.id === aid);
    return a && a.kind === 'spearhead';
  });
  const spearheadBonus = hasSpearhead ? 0.10 : 0;
  // W1-5：学说提供计划上限加成 —— maxPlanning 键（gb_grand_battleplan /
  // gb_central_planning 各 +10%）此前声明了无人读取，现接入上限结算
  const nat = world.nations[army.nat];
  const doctrineCap = nationMod(nat, 'maxPlanning');
  return Math.min(K.PLAN_MAX_CAP + spearheadBonus, K.PLAN_BASE_CAP + arrowBonus + doctrineCap + spearheadBonus);
}

/* W0-C：委托给 characters.js 的唯一实现。
   原先这里是 getCharacterSkills 的一份残缺副本 —— 只读 c.skills，
   而 385 条人物数据里没有任何一条带 skills 字段，于是永远返回 3/3/3/3；
   characters.js 那份会从 traits 推断（attack→5、plan_speed→5），被丢掉了。 */
export function getGeneralSkills(world, generalId){
  const c = (world.characters || []).find(x => x.id === generalId);
  return getCharacterSkills(c);
}

/**
 * 5. 每日计划槽积累 / 消耗 / 自动推进 tick
 */
export function planningTick(world, rng){
  world.armies = world.armies || [];
  const events = [];

  for(const army of world.armies){
    const skills = getGeneralSkills(world, army.generalId);
    const cap = getArmyPlanCap(world, army);

    if(!army.executing){
      // 未执行：每日积累计划值 +2%/天 × (planningSkill / 10)
      // W0-C：再乘「计划类修正」——对应 HOI4 的 planning speed
      // （学说 Grand Battle Plan 的 "Well-Planned Attack" 属同一族效果）。
      // 数据层的 plan_speed / planning 两个键此前都无人读取，
      // 曼施坦因的 plan_speed+0.25 对计划积累完全无效。
      const dailyGain = K.PLAN_ACCUM_RATE * (skills.planning / 10)
        * (1 + nationMod(world.nations[army.nat], 'planning'));
      army.planning = Math.min(cap, (army.planning || 0) + dailyGain);
    } else {
      // 执行中：每日消耗计划加成 -5%
      // W2-1: 区域防御 (area_defense) 不消耗计划
      if(army.orderType === 'area_defense' || army.areaDefense){
        // 区域防御：计划不消耗
      } else {
        const decayMul = Math.max(0, 1 + nationMod(world.nations[army.nat], 'planDecay'));
        army.planning = Math.max(0, (army.planning || 0) - K.PLAN_DECAY_RATE * decayMul);
      }

      // AI 辅助推进：组织度 > 20% 且在计划内的师沿进攻箭头逐格挺进
      if(army.arrowIds && army.arrowIds.length){
        for(const arrowId of army.arrowIds){
          const arrow = (world.arrows || []).find(a => a.id === arrowId);
          if(arrow && (arrow.active || army.executing)){
            dispatchArrowAdvance(world, army, arrow);
          }
        }
      }
    }

    // 将计划值同步到部队
    for(const uid of (army.divisions || [])){
      const u = world.units.find(x => x.id === uid);
      if(u && u.inPlan){
        u.planning = army.planning;
      }
    }
  }

  return events;
}

/**
 * 沿进攻箭头分层指派推进（W2-2 军级统一调度）
 */
export function dispatchArrowAdvance(world, army, arrow){
  const divs = (army.divisions || [])
    .map(uid => world.units.find(x => x.id === uid))
    .filter(u => u && u.hp > 0 && u.inPlan && u.org >= UNITS[u.type].org * 0.20);

  if(!divs.length) return;

  // 1. 获取目标路网序列 (基于 waypoints 或 targets)
  let targetHexIdxs = [];
  if(arrow.waypoints && arrow.waypoints.length){
    targetHexIdxs = [...arrow.waypoints];
  } else if(arrow.targets && arrow.targets.length){
    targetHexIdxs = [...arrow.targets];
  }

  // 寻找路径上第一个尚未完全攻占的目标格
  let activeTarget = null;
  for(const targetIdx of targetHexIdxs){
    const targetHex = world.hexes[targetIdx];
    if(!targetHex) continue;

    const hasEnemy = (targetHex.units || []).some(uid => {
      const x = world.units.find(u => u.id === uid);
      return x && x.hp > 0 && x.nat !== army.nat;
    });
    if(targetHex.owner !== army.nat || hasEnemy){
      activeTarget = targetHex;
      break;
    }
  }

  // 若全部目标路径已完全被己方占领且无敌军，说明已抵达目标线！到达即停 (HOI4 两段式)
  if(!activeTarget){
    army.executing = false;
    arrow.active = false;
    for(const u of divs){
      if(u.order && (u.order.type === 'advance' || u.order.type === 'spearhead' || u.order.type === 'breakthrough')){
        u.order = null;
      }
    }
    return;
  }

  // 2. 确定作战命令类型
  const orderType = arrow.kind === 'spearhead' ? 'spearhead'
    : (arrow.kind === 'breakthrough' ? 'breakthrough' : 'advance');

  // 3. 师编队排序（spearhead 矛头装甲优先 armorPriority）
  if(arrow.kind === 'spearhead'){
    divs.sort((a,b) => {
      const aArmor = (a.type === 'arm' || a.type === 'mot') ? 1 : 0;
      const bArmor = (b.type === 'arm' || b.type === 'mot') ? 1 : 0;
      if(aArmor !== bArmor) return bArmor - aArmor;
      return (b.org || 0) - (a.org || 0);
    });
  } else {
    divs.sort((a,b) => (b.org || 0) - (a.org || 0));
  }

  // 4. 为全师分配统一推进槽位（战线指向统一目标，直扑指定轴心，不分散走位）
  for(let i = 0; i < divs.length; i++){
    const u = divs[i];
    u.order = {
      type: orderType,
      dest: [activeTarget.q, activeTarget.r],
      target: [activeTarget.q, activeTarget.r],
      _dest: [activeTarget.q, activeTarget.r],
      directFocus: true
    };
  }
}

/**
 * 6. 执行进攻箭头
 */
export function executeArrow(world, armyId, arrowId = null){
  const army = world.armies ? world.armies.find(a => a.id === armyId) : null;
  if(!army) return [];
  army.executing = true;

  if(arrowId){
    const arrow = (world.arrows || []).find(a => a.id === arrowId);
    if(arrow) arrow.active = true;
  } else if(army.arrowIds && army.arrowIds.length){
    for(const aid of army.arrowIds){
      const a = (world.arrows || []).find(x => x.id === aid);
      if(a) a.active = true;
    }
  }

  if(army.arrowIds && army.arrowIds.length){
    for(const aid of army.arrowIds){
      const a = (world.arrows || []).find(x => x.id === aid);
      if(a) dispatchArrowAdvance(world, army, a);
    }
  }

  return army.divisions;
}

/**
 * 暂停 / 终止进攻箭头
 */
export function stopArrow(world, armyId){
  const army = world.armies ? world.armies.find(a => a.id === armyId) : null;
  if(!army) return false;
  army.executing = false;
  for(const aid of (army.arrowIds || [])){
    const a = (world.arrows || []).find(x => x.id === aid);
    if(a) a.active = false;
  }
  for(const uid of (army.divisions || [])){
    const u = world.units.find(x => x.id === uid);
    if(u && u.order && (u.order.type === 'advance' || u.order.type === 'spearhead' || u.order.type === 'breakthrough')){
      u.order = null;
    }
  }
  return true;
}

/**
 * W2-1: 区域防御计划 (Area Defense)
 * 上限 72 师，防御 +50%，计划槽不消耗
 */
export function createAreaDefensePlan(world, armyId, hexIdxs = []){
  const army = world.armies ? world.armies.find(a => a.id === armyId) : null;
  if(!army) return null;
  army.orderType = 'area_defense';
  army.areaDefenseHexes = [...hexIdxs];
  for(const uid of (army.divisions || [])){
    const u = world.units.find(x => x.id === uid);
    if(u){
      u.order = { type: 'area_defense', hexes: [...hexIdxs] };
    }
  }
  return army;
}

/**
 * W2-1: 牵制命令 (Pin)
 */
export function createPinOrder(world, unit, targetHex){
  if(!unit || !targetHex) return false;
  unit.order = { type: 'pin', target: [targetHex.q, targetHex.r] };
  return true;
}

/**
 * W2-1: 突破命令 (Breakthrough)
 */
export function createBreakthroughOrder(world, unit, targetHex){
  if(!unit || !targetHex) return false;
  unit.order = {
    type: 'breakthrough',
    target: [targetHex.q, targetHex.r],
    dest: [targetHex.q, targetHex.r],
    _dest: [targetHex.q, targetHex.r],
    directFocus: true
  };
  return true;
}

/**
 * 7. 手动微操脱离与全军惩罚 (C15)
 */
export function applyManualPenalty(world, armyId, unitId){
  const army = world.armies ? world.armies.find(a => a.id === armyId) : null;
  const u = world.units.find(x => x.id === unitId);
  if(u) u.inPlan = false;

  if(army && army.planning > 0){
    // 全军计划槽当日额外 -5%
    army.planning = Math.max(0, army.planning - K.PLAN_MANUAL_PENALTY);
    for(const uid of (army.divisions || [])){
      const member = world.units.find(x => x.id === uid);
      if(member && member.inPlan) member.planning = army.planning;
    }
  }
}

/**
 * 8. 战术选择与判定 (§2.6)
 */
export function selectTactic(world, hexIdx, natId, tacticId){
  world.tacticsState = world.tacticsState || {};
  world.tacticsState[hexIdx] = world.tacticsState[hexIdx] || {};
  world.tacticsState[hexIdx][natId] = tacticId;
}

export function determineBattleTactics(world, hexIdx, atkNat, defNat, rng){
  world.tacticsState = world.tacticsState || {};
  world.tacticsState[hexIdx] = world.tacticsState[hexIdx] || {};

  const state = world.tacticsState[hexIdx];
  const h = world.hexes[hexIdx];

  // 找攻防将领
  const atkArmies = (world.armies || []).filter(a => a.nat === atkNat);
  const defArmies = (world.armies || []).filter(a => a.nat === defNat);

  const atkSkill = atkArmies.length && atkArmies[0].generalId ? getGeneralSkills(world, atkArmies[0].generalId).tactics : 3;
  const defSkill = defArmies.length && defArmies[0].generalId ? getGeneralSkills(world, defArmies[0].generalId).tactics : 3;

  // 谋略高者 60% 概率优先选择
  const roll = rng ? rng() : Math.random();
  const atkHasInitiative = atkSkill > defSkill ? (roll < 0.60) : (roll < 0.40);

  // 若未手动指定，根据部队构成、将领特性与战场地貌智能推演
  if(!state[atkNat]){
    const unitsInAtk = world.units.filter(u => u.nat === atkNat && u.order && u.order.type === 'attack');
    const armorPct = unitsInAtk.length ? unitsInAtk.filter(u => u.type === 'arm' || u.type === 'larm' || u.type === 'mot').length / unitsInAtk.length : 0;
    // W0-A3 修正：字段名是 supports（复数），支援炮 id 是 sup_art
    const hasArt = unitsInAtk.some(u => u.type === 'art' || templateHasSupport(world, u.templateId, 'sup_art'));

    if(armorPct >= 0.35) state[atkNat] = 'blitz'; // 装甲闪击 (Blitz)
    else if(armorPct >= 0.20) state[atkNat] = 'pincer'; // 钳形合围 (Pincer)
    else if(hasArt) state[atkNat] = 'creeping_barrage'; // 步炮弹幕徐进 (Creeping Barrage)
    else if(atkHasInitiative && (roll < 0.5)) state[atkNat] = 'infiltration'; // 夜间渗透奇袭 (Infiltration)
    else if(atkHasInitiative) state[atkNat] = 'shock'; // 突袭
    else state[atkNat] = 'assault'; // 正面强攻
  }

  if(!state[defNat]){
    if(h && h.terrain === 'mount') state[defNat] = 'anti_tank_depth'; // 山地纵深反坦克
    else if(defSkill >= 4) state[defNat] = 'elastic_defense'; // 名将弹性波次防守
    else if(h && h.city) state[defNat] = 'illuminated_ambush'; // 城市巷战全线照明伏击
    else if(defSkill >= 3) state[defNat] = 'evacuation'; // 战略撤退保全
    else state[defNat] = 'delay';
  }

  // 4 组经典战术相克判定 (Tactic Counter Matrix v7.0 §2.2)
  let countered = false;
  let counterWinner = null;
  let counterDesc = null;

  const atkT = state[atkNat];
  const defT = state[defNat];

  // 1. 装甲闪击 vs 纵深反坦克壕阵
  if((atkT === 'blitz' || atkT === 'shock') && (defT === 'anti_tank_depth' || defT === 'depth_def')){
    countered = true;
    counterWinner = 'defender';
    counterDesc = '纵深反坦克壕阵 克制了 装甲闪击：防守方防御 +25%，进攻方失去突破加成';
  }
  // 2. 钳形合围 vs 战略撤退保全
  else if((atkT === 'pincer' || atkT === 'flank') && (defT === 'evacuation')){
    countered = true;
    counterWinner = 'defender';
    counterDesc = '战略撤退保全 克制了 钳形合围：防守方避免被割裂，撤退组织度保留 70%';
  }
  // 3. 步炮弹幕徐进 vs 弹性波次防守
  else if((atkT === 'creeping_barrage' || atkT === 'assault') && (defT === 'elastic_defense' || defT === 'elastic_def')){
    countered = true;
    counterWinner = 'defender';
    counterDesc = '弹性波次防守 克制了 徐进弹幕：炮火伤害无效化 40%，守方反击伤害 +20%';
  }
  // 4. 夜间渗透奇袭 vs 全线照明与集火
  else if((atkT === 'infiltration') && (defT === 'illuminated_ambush')){
    countered = true;
    counterWinner = 'defender';
    counterDesc = '全线照明与集火 克制了 夜间渗透：渗透部队陷入交叉火力，进攻方承受双倍人员伤亡';
  }

  return {
    attacker: atkT,
    defender: defT,
    atkHasInitiative,
    countered,
    counterWinner,
    counterDesc
  };
}
