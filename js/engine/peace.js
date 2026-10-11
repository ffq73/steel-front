/* ============================================================
   engine/peace.js —— 战后和会与世界再分配 (v7.0 §2.3 / E4)
   1. 战争贡献度计分：杀伤35% + 占领VP 40% + 承受牺牲15% + 轰炸10%
   2. 谈判桌行动：割让省份 / 傀儡政权 / 非军事区 / 资源掠夺特权
   3. AI 阵营自动和会（非玩家战胜方时保持兼容旧行为）
   ============================================================ */

import { K } from '../data/constants.js';
import { getIdeology } from '../data/ideology.js';   // v14.0 P3 傀儡规则
import { nationalVP, lostVP, evaluateObjective } from './victory.js';

export const PEACE_ACTIONS = {
  takeState:       { id:'takeState',       name:'割让领土',       costVP: 5,  costBase: 20, desc:'将目标省份并入本国版图，变更国境线与工业归属。' },
  puppet:          { id:'puppet',          name:'建立傀儡政权',   costVP: 0,  costBase: 80, desc:'保留国家实体但成为仆从国：其民用工厂 50% 产出上缴宗主，军队解散。' },
  liberate:        { id:'liberate',        name:'解放国家',       costVP: 0,  costBase: 40, desc:'恢复原主权国家实体，归还其固有核心领土并解除占领。' },
  demandFactories: { id:'demandFactories',  name:'索取赔偿工厂',   costVP: 0,  costBase: 35, desc:'索取战败国军民工厂产能作为战争赔款。' },
  demilitarize:    { id:'demilitarize',    name:'设立非军事区',   costVP: 0,  costBase: 10, desc:'禁止在该省份驻扎武装师团（还原莱茵兰/凡尔赛条款）。' },
  resourceRights:  { id:'resourceRights',  name:'掠夺开采特权',   costVP: 0,  costBase: 30, desc:'不占领领土，强制掠夺该国 80% 石油与钢铁产出。' }
};

/* 构建和会：某国投降时调用 */
export function buildPeaceConference(world, loserId){
  const loser = world.nations[loserId];
  if(!loser) return null;
  const winners = (loser.atWarWith || []).filter(w => world.nations[w] && world.nations[w].alive);
  if(!winners.length) return null;

  const stats = world.warStats || {};
  const loserVP = Math.max(1, nationalVP(world, loserId));
  const occ = lostVP(world, loserId);

  const points = {};
  const breakdown = {};
  for(const w of winners){
    let occVP = 0;
    for(const h of world.hexes){
      if(h._orig === loserId && h.owner === w){
        occVP += K.VP_PROVINCE + (h.city ? h.city.w * K.VP_CITY_MULT : 0);
      }
    }
    const kills = (stats[w] && stats[w][loserId]) || 0;
    const losses = (stats[loserId] && stats[loserId][w]) || 0;
    const killScore  = Math.min(1, kills / 20) * 35;
    const occScore   = (occVP / loserVP) * 40;
    const lossScore  = Math.min(1, losses / 30) * 15;
    const bombScore  = 0;   // 战略轰炸破坏度预留（空军机制扩展）
    points[w] = Math.round(100 + killScore + occScore + lossScore + bombScore);
    breakdown[w] = { kills, occVP, losses, killScore:+killScore.toFixed(1), occScore:+occScore.toFixed(1), lossScore:+lossScore.toFixed(1) };
  }

  return {
    loser: loserId,
    winners,
    points,
    breakdown,
    day: world.day,
    actions: {},        // actorId → [{type, q, r}]
    resolved: false
  };
}

/* 检查某行动是否命中预设战争目标享受 50% 折扣 [H] */
function hasMatchingWargoal(world, actorId, loserId, type, payload){
  const goals = world.activeWargoals || [];
  return goals.some(g => {
    if(g.from !== actorId || g.to !== loserId) return false;
    if(type === 'puppet' && (g.goal.type === 'puppet' || g.goal.type === 'subjugate')) return true;
    if(type === 'takeState' && g.goal.type === 'capture'){
      const h = world.at[payload.q + ',' + payload.r];
      if(h && h.city && h.city.name === g.goal.arg) return true;
    }
    return false;
  });
}

/* 和会行动执行 */
export function applyPeaceAction(world, actorId, type, payload = {}){
  const conf = world.pendingPeace;
  if(!conf || conf.resolved) return { ok:false, msg:'和会已闭幕' };
  if(!conf.winners.includes(actorId)) return { ok:false, msg:'非战胜国' };
  const n = world.nations[actorId];
  const loser = world.nations[conf.loser];
  if(!loser) return { ok:false, msg:'和约对象不存在' };
  const act = PEACE_ACTIONS[type];
  if(!act) return { ok:false, msg:'未知行动' };

  let cost = act.costBase;
  if(type === 'takeState'){
    const h = world.at[(payload.q != null ? payload.q : '') + ',' + (payload.r != null ? payload.r : '')];
    if(!h || h._orig !== conf.loser) return { ok:false, msg:'只能索取战败国领土' };
    if(h.owner === actorId) return { ok:false, msg:'已占领该省' };
    cost += (h.city ? h.city.w : 0) * act.costVP;
  }
  if(type === 'puppet' && conf._puppetDone) return { ok:false, msg:'已建立傀儡政权' };
  // v14.0 P3 [H]：民主主义不得傀儡其他国家
  if(type === 'puppet'){
    const wn = world.nations[actorId];
    if(wn && getIdeology(wn.ideology).canPuppet === false){
      return { ok:false, msg:'民主主义政体不得建立傀儡政权（Paradox 规则）' };
    }
  }

  // 战争目标符合者享受点数 50% 折扣 [H]
  if(hasMatchingWargoal(world, actorId, conf.loser, type, payload)){
    cost = Math.floor(cost * 0.5);
  }

  const spent = (conf.actions[actorId] || []).reduce((s, a) => s + (a.paid || 0), 0);
  if(spent + cost > (conf.points[actorId] || 0)) return { ok:false, msg:'和会点数不足' };

  // 执行
  if(type === 'takeState'){
    const h = world.at[payload.q + ',' + payload.r];
    h.owner = actorId;
    h.demilitarized = false;
    world.events.push({ type:'peace', day:world.day, important:true,
      text:`⚖️ 和约签署：${n.name} 割占 ${h.city ? h.city.name : `(${h.q},${h.r})`}` });
  } else if(type === 'puppet'){
    loser.alive = true;
    loser.capitulated = false;
    loser.puppetOf = actorId;
    const wn = world.nations[actorId];
    const tier = wn && getIdeology(wn.ideology).puppetTier === 'pupil' ? 'pupil' : 'satellite';
    loser.puppetTier = tier;
    conf._puppetDone = true;
    for(const u of [...world.units]){
      if(u.nat === conf.loser){
        const hh = world.at[u.q + ',' + u.r];
        const i = hh.units.indexOf(u.id);
        if(i >= 0) hh.units.splice(i, 1);
        world.units.splice(world.units.indexOf(u), 1);
      }
    }
    world.events.push({ type:'peace', day:world.day, important:true,
      text:`🏴 和约签署：${loser.name} 沦为 ${n.name} 的傀儡政权！` });
  } else if(type === 'liberate'){
    const targetNatId = payload.targetNat || conf.loser;
    const targetNat = world.nations[targetNatId];
    if(targetNat){
      targetNat.alive = true;
      targetNat.capitulated = false;
      targetNat.puppetOf = null;
      // 归还原属领土
      for(const h of world.hexes){
        if(h._orig === targetNatId && h.owner === conf.loser){
          h.owner = targetNatId;
        }
      }
      world.events.push({ type:'peace', day:world.day, important:true,
        text:`🕊️ 和约签署：主权国家【${targetNat.name}】获得彻底解放与复国！` });
    }
  } else if(type === 'demandFactories'){
    const civTransfer = Math.min(loser.civ || 0, payload.civ || 1);
    const milTransfer = Math.min(loser.mil || 0, payload.mil || 2);
    loser.civ = Math.max(0, (loser.civ || 0) - civTransfer);
    loser.mil = Math.max(0, (loser.mil || 0) - milTransfer);
    n.civ = (n.civ || 0) + civTransfer;
    n.mil = (n.mil || 0) + milTransfer;
    world.events.push({ type:'peace', day:world.day, important:true,
      text:`🏭 战争赔偿：${n.name} 获得 ${loser.name} 赔偿的 ${milTransfer} 座军工与 ${civTransfer} 座民用工厂！` });
  } else if(type === 'demilitarize'){
    const h = world.at[payload.q + ',' + payload.r];
    if(!h) return { ok:false, msg:'目标省份不存在' };
    h.demilitarized = true;
    for(const u of [...world.units]){
      if(u.nat === actorId && u.q === h.q && u.r === h.r){
        const hh = world.at[u.q + ',' + u.r];
        const i = hh.units.indexOf(u.id);
        if(i >= 0) hh.units.splice(i, 1);
        world.units.splice(world.units.indexOf(u), 1);
      }
    }
    world.events.push({ type:'peace', day:world.day, important:true,
      text:`🕊️ 和约条款：${h.city ? h.city.name : `(${h.q},${h.r})`} 划设为非军事区` });
  } else if(type === 'resourceRights'){
    n.resourceRights = n.resourceRights || [];
    n.resourceRights.push({ natId: conf.loser, ratio: 1 });
    world.events.push({ type:'peace', day:world.day, important:true,
      text:`⛏️ 和约条款：${n.name} 获得 ${loser.name} 80% 战略资源开采特权` });
  }

  conf.actions[actorId] = conf.actions[actorId] || [];
  conf.actions[actorId].push({ type, ...payload, paid: cost });
  return { ok:true, cost };
}

/* 闭幕和会：未花完的点数作废，剩余领土按现状固化 */
export function closePeaceConference(world){
  const conf = world.pendingPeace;
  if(!conf || conf.resolved) return;
  const loser = world.nations[conf.loser];
  // 未割让的剩余领土交由主要战胜国托管（保持地图无真空）
  if(loser && !loser.alive){
    for(const h of world.hexes){
      if(h._orig !== conf.loser) continue;
      if(conf.winners.includes(h.owner)) continue;
      h.owner = conf.winners[0];
    }
  }
  // W5-2：和会校验战争目标是否达成 —— 达成者收获声望与战意，
  // 未达成者承受"战争无果"的国内反噬（HOI4 同款张力）。
  for(const g of (world.activeWargoals || [])){
    if(!conf.winners.includes(g.from) || g.to !== conf.loser) continue;
    const n = world.nations[g.from];
    if(!n) continue;
    const type = g.goal.type;
    let achieved;
    if(type === 'conquer' || type === 'contain'){
      achieved = true;   // 全面战争/有限目标：战胜即达成
    } else if(type === 'puppet' || type === 'subjugate'){
      achieved = loser.puppetOf === g.from;
    } else {
      // capture:城市 等 —— 交由统一目标解释器判定（capitalDown 口径）
      achieved = evaluateObjective(world, g.from, type + (g.goal.arg ? ':' + g.goal.arg : '')).achieved;
    }
    if(achieved){
      n.warSupport = Math.min(100, (n.warSupport || 50) + 4);
      n.prestige = (n.prestige || 0) + 5;
      world.events.push({ type:'wargoal_fulfilled', day:world.day, important:true,
        text:`🎖️ 战争目标达成：${n.name} 实现了对${loser.name}的${g.goal.type}${g.goal.arg ? '（' + g.goal.arg + '）' : ''}，声望 +5！` });
    } else {
      n.warSupport = Math.max(0, (n.warSupport || 50) - 6);
      n.stability = Math.max(10, (n.stability || 60) - 3);
      world.events.push({ type:'wargoal_failed', day:world.day, important:true,
        text:`💢 战争无果：${n.name} 未能达成对${loser.name}的${g.goal.type}${g.goal.arg ? '（' + g.goal.arg + '）' : ''}战争目标，国内舆论哗然。` });
    }
  }
  world.activeWargoals = (world.activeWargoals || []).filter(g => !(
    conf.winners.includes(g.from) && g.to === conf.loser));
  conf.resolved = true;
  world.events.push({ type:'peace', day:world.day, important:true, text:'📜 和会闭幕，战后秩序确立。' });
  world.pendingPeace = null;
  world.speed = 1;
}

/* 每日巡检：和会悬挂超 3 天自动闭幕（防软锁） */
export function peaceTick(world){
  if(!world.pendingPeace) return;
  world.pendingPeace._hangDays = (world.pendingPeace._hangDays || 0) + 1;
  if(world.pendingPeace._hangDays > 3 && !isPlayerWinner(world)){
    closePeaceConference(world);
  }
}

export function isPlayerWinner(world){
  const conf = world.pendingPeace;
  return !!(conf && world.player && conf.winners.includes(world.player));
}

/* 多方和会竞价轮次逻辑（AI 轮流竞标或自动和会） */
export function aiBiddingConference(world, conf){
  if(!conf || !conf.winners || !conf.winners.length) return;
  world.pendingPeace = conf;

  // 按贡献度由大到小排序战胜国
  const sortedWinners = [...conf.winners].sort((a, b) => (conf.points[b] || 0) - (conf.points[a] || 0));
  let anyActionInRound = true;
  let rounds = 0;

  while(anyActionInRound && rounds < 10){
    anyActionInRound = false;
    rounds++;

    for(const actorId of sortedWinners){
      const currentSpent = (conf.actions[actorId] || []).reduce((s, a) => s + (a.paid || 0), 0);
      const remainingPoints = (conf.points[actorId] || 0) - currentSpent;
      if(remainingPoints < 20) continue; // 不够最便宜的条款

      // 1) 优先割让接壤或已占领的目标省份
      const targetHexes = world.hexes.filter(h => h._orig === conf.loser && h.owner !== actorId);
      const occupiedHex = targetHexes.find(h => h.owner === actorId || h.units?.some(uid => world.units.find(u => u.id === uid)?.nat === actorId));
      const candidateHex = occupiedHex || targetHexes[0];

      if(candidateHex){
        const res = applyPeaceAction(world, actorId, 'takeState', { q: candidateHex.q, r: candidateHex.r });
        if(res.ok){
          anyActionInRound = true;
          continue;
        }
      }

      // 2) 若点数充足且未傀儡，尝试傀儡
      if(!conf._puppetDone && remainingPoints >= 80){
        const res = applyPeaceAction(world, actorId, 'puppet');
        if(res.ok){
          anyActionInRound = true;
          continue;
        }
      }

      // 3) 尝试索赔工厂
      if(remainingPoints >= 35){
        const res = applyPeaceAction(world, actorId, 'demandFactories', { civ: 1, mil: 2 });
        if(res.ok){
          anyActionInRound = true;
          continue;
        }
      }

      // 4) 尝试掠夺资源
      if(remainingPoints >= 30){
        const res = applyPeaceAction(world, actorId, 'resourceRights');
        if(res.ok){
          anyActionInRound = true;
          continue;
        }
      }
    }
  }

  closePeaceConference(world);
}

/* AI 战胜方自动和会：升级为多方竞价模型（多胜者时轮流划分领土） */
export function aiAutoPeace(world, loserId){
  const conf = buildPeaceConference(world, loserId);
  if(!conf || !conf.winners || !conf.winners.length){
    // 容错降级
    const loser = world.nations[loserId];
    if(loser) loser.alive = false;
    return;
  }
  aiBiddingConference(world, conf);
}
