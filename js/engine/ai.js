/* ============================================================
   engine/ai.js —— 四层大战略 AI（v2.0 §3.9 / v3.0 §3.10）
   难度旋钮：史实 / 中尉 / 上将 / 元帅
   包含反包围网机制与决策理由日志（world.aiLog）
   ============================================================ */

import { K } from '../data/constants.js';
import { UNITS } from '../data/units.js';
import { hexUnits } from './world.js';
import { availableFocuses, pickFocus } from './focus.js';
import { availableTechs, startResearch } from './research.js';
import { getIdeology } from '../data/ideology.js';   // v14.0 P3 AI 宣战倾向
import { strategyTick, aiLevelOf, nationPower } from './aiStrategy.js';   // v14.0 P5 战略层
import { log } from './world.js';

/** AI 科研分支优先级（按时代） */
const PRIORITY_TECH = {
  ww1:     ['industry','doctrine','equipment','air','navy','electronics'],
  ww2:     ['industry','equipment','doctrine','air','navy','electronics'],
  coldwar: ['electronics','air','industry','equipment','nuclear','navy','doctrine'],
  modern:  ['electronics','nuclear','air','industry','equipment','navy']
};

export function aiPhase(world, rng){
  const diffKey = world.difficulty || 'general';
  const diff = K.DIFFICULTIES[diffKey] || K.DIFFICULTIES.general;

  // 大战略层：评估玩家威胁度（反玩家包围网机制）
  const playerNat = world.nations[world.player];
  const playerHexes = world.hexes.filter(h => h.owner === world.player).length;
  const threat = playerHexes * 1.5 + (playerNat ? playerNat.atWarWith.length * 10 : 0);
  const coalitionActive = threat >= diff.threatThreshold;

  for(const id in world.nations){
    // v14.0 P5：正常游戏不替玩家决策；tools/ai_balance.js 会置 __aiControlsPlayer
    // 做「AI vs AI」对局验收，此时玩家国家也交给 AI。
    if(id === world.player && !world.__aiControlsPlayer) continue;
    const n = world.nations[id];
    if(!n.alive || n.capitulated) continue;

    // —— v14.0 P5 战略层：每 7 天重估威胁/战略/目标/进攻轴 ——
    n.ai.lastStrategyDay = n.ai.lastStrategyDay == null ? 0 : n.ai.lastStrategyDay;
    const stratInterval = aiLevelOf(world, id) >= 7 ? 5 : 7;      // 强 AI 评估更频繁
    if(world.day - n.ai.lastStrategyDay >= stratInterval){
      n.ai.lastStrategyDay = world.day;
      n.ai.strategy = strategyTick(world, rng, id) || n.ai.strategy;
    }

    const effectiveDelay = Math.max(1, Math.round((n.ai.decisionDelay || 2) * (diff.decisionDelay / 2)));
    if(world.day - n.ai.lastDecision < effectiveDelay) continue;
    n.ai.lastDecision = world.day;

    const mul = (n.ai.prodMul || 1.0) * diff.prodMul;

    // —— 生产 AI ——
    const myUnits = world.units.filter(u => u.nat===id).length;
    const targetMil = 14;
    if(!n.build.kind && n.mil < targetMil && n.civ >= 4){
      // v14.1 B5：厂址跳过厂槽已满的格（含决议 buildSlots 加成）
      const site = world.hexes.filter(h => h.owner===id && h.city &&
          ((h.civ||0) + (h.mil||0)) < K.FACTORY_SLOTS_PER_HEX + (h.buildSlots||0))
        .sort((a,b)=>b.city.w-a.city.w)[0];
      if(site){
        n.build = { q:site.q, r:site.r, prog:0, need:K.BUILD_COST.mil, kind:'mil' };
        world.aiLog.unshift(`D${world.day} [${id}] 生产AI(${diff.name})：开工军工厂 @${site.city?site.city.name:''}`);
      }
    }
    if(n.training.length < 2 && n.equip * mul > 450){
      const type = pickTrainType(id, myUnits);
      n.training.push({ type, costPaid:0, days:0 });
      world.aiLog.unshift(`D${world.day} [${id}] 生产AI：训练${UNITS[type].name}（现有${myUnits}师，产能倍率${mul.toFixed(1)}）`);
    }
    while(n.pool.length){
      const dest = world.hexes.filter(h => h.owner===id && h.city)
        .sort((a,b)=> frontDanger(world,id,b) - frontDanger(world,id,a))[0];
      if(!dest) break;
      const t = n.pool.shift();
      spawnNear(world, id, t, dest);
    }

    // —— 科研 AI (v14.0 P4)：此前 AI 完全不研究，科技树对 AI 沉睡 ——
    //   优先级按"当前最缺"决定：战时缺军备→陆军装备，有空海军→空军/海军，
    //   冷战/现代剧本优先电子与核。
    {
      const slots = n.research.slots || [];
      if(slots.some(s => s === null)){
        const av = availableTechs(world, id);
        if(av.length){
          const W = PRIORITY_TECH[world.era] || PRIORITY_TECH.ww2;
          let chosen = null;
          for(const br of W){
            chosen = av.find(t => t.branch === br);
            if(chosen) break;
          }
          if(!chosen) chosen = av[0];
          if(chosen && startResearch(world, id, chosen.id)){
            world.aiLog.unshift(`D${world.day} [${id}] 科研AI：开始研究「${chosen.name}」`);
          }
        }
      }
    }

    // —— 国策 AI（静态优先级 + 威胁反应）——
    if(!n.focus.active && n.pp >= 0){
      const av = availableFocuses(world, id);
      for(const fid of (n.focusPriority || [])){
        const f = av.find(x => x.id === fid);
        if(f){
          pickFocus(world, id, fid);
          world.aiLog.unshift(`D${world.day} [${id}] 国策AI：选择「${f.name}」`);
          break;
        }
      }
      // 容错兜底：若优先级国策无法执行，自动选任一可用国策
      if(!n.focus.active && av.length > 0){
        pickFocus(world, id, av[0].id);
        world.aiLog.unshift(`D${world.day} [${id}] 国策AI(自适应)：选择「${av[0].name}」`);
      }
    }

    // —— 军事 AI ——
    const effectiveAtkThreshold = (n.ai.attackThreshold || 2.0) * (diff.attackThreshold / 2.0) * (coalitionActive ? 0.9 : 1.0);
    militaryAI(world, id, rng, effectiveAtkThreshold, coalitionActive, diff);
  }
}

function pickTrainType(natId, totalUnits){
  // 大国在有一定基数后混编装甲与摩托化
  if(totalUnits >= 8 && (natId === 'G' || natId === 'S')) return 'arm';
  if(totalUnits >= 5 && (natId === 'G' || natId === 'F' || natId === 'B')) return 'mot';
  return 'inf';
}

function frontDanger(world, id, h){
  let d = 0;
  for(const u of world.units){
    if(u.nat !== id && world.nations[id].atWarWith.includes(u.nat)){
      d += 1 / (1 + Math.abs(u.q - h.q) + Math.abs(u.r - h.r));
    }
  }
  return d;
}

function spawnNear(world, id, type, hex){
  let target = hex;
  if(hexUnits(world, target).length >= K.STACK_LIMIT){
    for(const ni of target.adj){
      const nh = world.hexes[ni];
      if(nh.owner===id && hexUnits(world, nh).length < K.STACK_LIMIT){ target = nh; break; }
    }
  }
  if(hexUnits(world, target).length >= K.STACK_LIMIT) return;
  const u = {
    id: world.uid++, type, nat:id, q:target.q, r:target.r,
    org: UNITS[type].org, hp: UNITS[type].hp, exp:1, level:1,
    entrench:0, planning:0, order:null
  };
  world.units.push(u);
  target.units.push(u.id);
}

function militaryAI(world, id, rng, attackThreshold, coalitionActive, diff){
  const n = world.nations[id];
  const myUnits = world.units.filter(u => u.nat===id && u.hp>0);
  const S = n.ai.strategy || {};

  // ============================================================
  // v14.0 P5 Layer 2 战役层：节奏控制 + 集结判定 + 沿轴推进
  // ============================================================
  const restOrgRatio   = (diff && diff.restOrgRatio)   != null ? diff.restOrgRatio   : 0.40;
  const rallyRatio     = (diff && diff.rallyRatio)     != null ? diff.rallyRatio     : 0.60;
  const maxOffDays     = (diff && diff.maxOffensiveDays) != null ? diff.maxOffensiveDays : 4;
  const focusFire      = (diff && diff.focusFire) !== false;

  // (1) 节奏控制：连续进攻超过上限 → 全军休整
  n.ai.offensiveDays = n.ai.offensiveDays || 0;
  n.ai.restingUntil = n.ai.restingUntil || 0;
  if(world.day < n.ai.restingUntil){
    // 休整期：不进攻，原地恢复组织度
    for(const u of myUnits) if(!(u.order && u.order.type === 'attack')) u.order = null;
    if(n.ai.offensiveDays > 0 && world.day % 3 === 0) n.ai.offensiveDays--;
    return;
  }
  // 达到上限且组织度不高 → 进入休整
  if(n.ai.offensiveDays >= maxOffDays){
    const avgOrg = myUnits.length ? myUnits.reduce((s,u)=>s+(u.org/UNITS[u.type].org),0)/myUnits.length : 1;
    if(avgOrg < 0.75){
      n.ai.restingUntil = world.day + 2 + (aiLevelOf(world, id) >= 7 ? 1 : 0);
      n.ai.offensiveDays = 0;
      world.aiLog.unshift(`D${world.day} [${id}] 战役AI：连续进攻已 ${maxOffDays} 天，组织度 ${(avgOrg*100).toFixed(0)}% → 全军休整 ${n.ai.restingUntil - world.day} 天`);
      return;
    }
    n.ai.offensiveDays = 0;
  }
  // 组织度过低 → 强制休整
  const globalOrg = myUnits.length ? myUnits.reduce((s,u)=>s+(u.org/UNITS[u.type].org),0)/myUnits.length : 1;
  if(globalOrg < restOrgRatio * 0.75){
    n.ai.restingUntil = world.day + 2;
    n.ai.offensiveDays = 0;
    world.aiLog.unshift(`D${world.day} [${id}] 战役AI：全军组织度 ${(globalOrg*100).toFixed(0)}% 过低 → 休整`);
    return;
  }

  // (2) 集结判定：目标格方向上的友军数量不足 → 不发起进攻（继续集结）
  //     focusFire=true（高 AI）时要求更严：只有主攻轴才允许进攻
  const axisTargets = S.axes || [];
  const primaryAxis = focusFire && axisTargets.length ? axisTargets[0] : null;
  // 集结判定：目标格 3 格半径内的我军数量达到投入比例才允许发起进攻。
  // 比例刻意不高（focusFire 0.14 / 多线 0.07）—— 门槛过高会让 AI 永远在"集结中"，
  // 实测 26 师时 0.22 的要求会让整条战线僵持（49 天只推进 3 格）。
  const rallyOk = (hexIdx) => {
    if(rallyRatio <= 0) return true;
    const h = world.hexes[hexIdx];
    if(!h) return true;
    const nearby = myUnits.filter(u => {
      const uh = world.at[u.q+','+u.r];
      return uh && Math.abs(uh.q - h.q) + Math.abs(uh.r - h.r) <= 3;
    }).length;
    const need = Math.max(1, Math.ceil(myUnits.length * (focusFire ? 0.14 : 0.07)));
    if(nearby < need) return false;

    // 战宽轮换（v14.0 P5 关键）：HOI4 玩家会按战宽分批投入，AI 此前不会 ——
    // 26 师同时打一个 6 宽的格 = 10 个师进预备队，效率暴跌且被反击全歼
    //（实测第 33 天全军覆没）。这里限制"同时进攻该格的师数"不超过战宽容量。
    const tw = K.TERRAIN_COMBAT_WIDTH[h.terrain] || K.TERRAIN_COMBAT_WIDTH.plain;
    const dirs = new Set(myUnits.filter(u => {
      const uh = world.at[u.q+','+u.r];
      return uh && Math.abs(uh.q - h.q) + Math.abs(uh.r - h.r) <= 1;
    }).map(u => { const uh = world.at[u.q+','+u.r]; return uh.q + ',' + uh.r; }));
    const capacity = tw.scaleBase + Math.max(0, dirs.size - 1) * tw.scaleFlank;
    const concurrent = myUnits.filter(u => u.order && u.order.type === 'attack' &&
      u.order.target[0] === h.q && u.order.target[1] === h.r).length;
    const widthPer = (UNITS.inf && UNITS.inf.width) || 2;
    const maxConcurrent = Math.max(1, Math.floor(capacity / widthPer));
    return concurrent < maxConcurrent;
  };

  // v12.1：首都受威胁判定 —— 敌军距首都 ≤4 格时，附近二线部队回防首都，
  // 不再一味涌向前线（否则敌军突破后首都方向毫无兵力，被直捣空城）
  const capHex = world.hexes.find(h => h.city && h.city.cap === id);
  const capThreat = !!(capHex && world.units.some(u =>
    u.hp > 0 && world.nations[id].atWarWith.includes(u.nat) &&
    Math.abs(u.q - capHex.q) + Math.abs(u.r - capHex.r) <= 4));

  for(const u of myUnits){
    if(u.order && u.order.type==='attack') continue;   // 保持现有进攻
    const here = world.at[u.q+','+u.r];
    const maxOrg = UNITS[u.type].org;

    // 止损：组织度过低后撤休整
    if(u.org < maxOrg * 0.40){
      u.order = null;
      continue;
    }

    // 进攻判定：相邻敌格中选战力比最高者
    let bestTarget = null, bestRatio = 0;
    for(const ni of here.adj){
      const nh = world.hexes[ni];
      if(!world.nations[id].atWarWith.includes(nh.owner)) continue;
      const defs = hexUnits(world, nh).filter(x => x.hp>0);
      const defStr = defs.reduce((s,x)=>s+UNITS[x.type].def, 0) * (nh.fort ? Math.pow(0.85, nh.fort) : 1);
      const atkStr = UNITS[u.type].soft * (u.org / maxOrg);
      const ratio = defStr > 0 ? atkStr / Math.max(1, defStr) : 9.0;
      if(ratio > bestRatio){
        bestRatio = ratio;
        bestTarget = nh;
      }
    }

    // v14.0 P5：进攻前过"集结度"门槛（高 AI 更严，focusFire 时要求集中主攻轴）
    const rallyPass = !bestTarget ? true : rallyOk(world.hexes.indexOf(bestTarget));
    if(bestTarget && bestRatio >= attackThreshold && u.org >= maxOrg * 0.65 && rallyPass){
      n._offInc = true;   // 标记本tick 有进攻，末尾统一 +1
      u.order = { type:'attack', target:[bestTarget.q, bestTarget.r] };
      world.aiLog.unshift(`D${world.day} [${id}] 军事AI：${UNITS[u.type].name}@(${u.q},${u.r}) 进攻 (${bestTarget.q},${bestTarget.r}) 战力比${bestRatio.toFixed(2)}${coalitionActive?' (包围网协同)':''}`);
      continue;
    }

    // 前线驻守：已在前线则原地固守挖壕
    const onFront = here.adj.some(ni => world.nations[id].atWarWith.includes(world.hexes[ni].owner));
    if(onFront){
      u.order = null;
      continue;
    }

    // v12.1 修复：驻守己方城市的部队不外调。此前二线机动会把首都与各城市
    // 驻军全部抽往前线，内地变成空城 → 敌军突破后一路"无人占领"直捣柏林，
    // 试玩中柏林 12 天即陷落触发剧本终局。城市是天然要塞，留兵驻守。
    if(here.city){
      u.order = null;
      continue;
    }

    // 二线部队向最近前线机动；首都受威胁时改为回防首都
    let goal = null, bestDist = 1e9;
    if(capThreat && capHex){
      goal = capHex;
      bestDist = Math.abs(capHex.q - u.q) + Math.abs(capHex.r - u.r);
    } else {
      for(const h of world.hexes){
        if(h.owner !== id) continue;
        const onF = h.adj.some(ni => world.nations[id].atWarWith.includes(world.hexes[ni].owner));
        if(!onF) continue;
        const dd = Math.abs(h.q - u.q) + Math.abs(h.r - u.r);
        if(dd < bestDist){
          bestDist = dd;
          goal = h;
        }
      }
    }

    if(goal && bestDist > 0){
      let stepHex = null, stepDist = bestDist;
      for(const ni of here.adj){
        const nh = world.hexes[ni];
        if(nh.owner !== id) continue;
        if(hexUnits(world, nh).length >= K.STACK_LIMIT) continue;
        const dd = Math.abs(nh.q - goal.q) + Math.abs(nh.r - goal.r);
        if(dd < stepDist){
          stepDist = dd;
          stepHex = nh;
        }
      }
      if(stepHex){
        const idx = here.units.indexOf(u.id);
        if(idx >= 0) here.units.splice(idx, 1);
        u.q = stepHex.q; u.r = stepHex.r;
        stepHex.units.push(u.id);
      }
    }
  }
  // 每日进攻日计数：只有真正发起过进攻的这一天才 +1（原来每个师的每次判定都加，
  // 一天能涨几十次，导致 maxOffensiveDays 的休整机制形同虚设）
  if(n._offInc){
    n.ai.offensiveDays = (n.ai.offensiveDays || 0) + 1;
    n._offInc = false;
  }

}
