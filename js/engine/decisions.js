/* ============================================================
   engine/decisions.js —— 决议系统引擎 (v14.0 P2 §3.1)
   条件判定 → PP 扣费 → 效果应用（限时/即时/每周）→ 到期自动撤销
   与 laws.js 的 modifiers 体系同构，零侵入既有系统。
   ============================================================ */

import { K } from '../data/constants.js';
import { DECISIONS, getDecision } from '../data/decisions.js';

/** 初始化决议账本（挂在 nation.decisions 上） */
export function initDecisions(world){
  if(!world || !world.nations) return;
  for(const id in world.nations){
    const n = world.nations[id];
    if(!n.decisions) n.decisions = { active: {}, used: {}, pendingHex: null };
  }
}

/** 某国是否有进行中的同 id 决议 */
function isActive(n, id){
  return !!(n.decisions && n.decisions.active[id]);
}

/** 已用次数 */
function usedCount(n, id){
  return (n.decisions && n.decisions.used[id]) || 0;
}

/**
 * 条件判定。返回 { ok, reason }
 *  reason 用于 UI 提示（"战争支持度不足"这类可读反馈）
 */
export function decisionRequirement(world, natId, def, hex){
  const n = world.nations[natId];
  if(!n || !n.alive || n.capitulated) return { ok:false, reason:'国家已不存在' };
  if(!n.decisions) initDecisions(world);

  // 限时决议不可重复开启
  if(def.duration && isActive(n, def.id)) return { ok:false, reason:'进行中（剩余 ' + Math.max(0, Math.ceil((n.decisions.active[def.id].until - world.day))) + ' 天）' };
  if(def.once && usedCount(n, def.id) > 0) return { ok:false, reason:'已执行过' };
  if(def.oncePer && usedCount(n, def.id) >= def.oncePer) return { ok:false, reason:'冷却中' };
  if(def.maxUses && usedCount(n, def.id) >= def.maxUses) return { ok:false, reason:'已达使用上限' };
  if(def.oncePerHex && hex && n.decisions.usedHex && n.decisions.usedHex[def.id + '@' + hex.q + ',' + hex.r]){
    return { ok:false, reason:'该省已执行过' };
  }

  // 战时限定
  if(def.atWar === true && !(n.atWarWith && n.atWarWith.length)) return { ok:false, reason:'仅战争中可用' };
  if(def.atWar === false && (n.atWarWith && n.atWarWith.length)) return { ok:false, reason:'仅和平时期可用' };

  // 法案限定
  if(def.reqLaw && n.law !== def.reqLaw) return { ok:false, reason:'需要特定经济法案' };

  // 科技限定
  if(def.reqTech){
    const done = (n.research && n.research.done) || [];
    const has = Array.isArray(done) ? done.includes(def.reqTech) : !!done[def.reqTech];
    if(!has) return { ok:false, reason:'需要前置科技' };
  }

  // 稳定度 / 战争支持度区间
  if(def.reqStabilityMax != null && (n.stability || 0) > def.reqStabilityMax) return { ok:false, reason:'稳定度过高（需 ≤' + def.reqStabilityMax + '%）' };
  if(def.reqStabilityMin != null && (n.stability || 0) < def.reqStabilityMin) return { ok:false, reason:'稳定度不足（需 ≥' + def.reqStabilityMin + '%）' };
  if(def.reqWarSupportMax != null && (n.warSupport || 0) > def.reqWarSupportMax) return { ok:false, reason:'战争支持度过高（需 ≤' + def.reqWarSupportMax + '%）' };
  if(def.reqWarSupportMin != null && (n.warSupport || 0) < def.reqWarSupportMin) return { ok:false, reason:'战争支持度不足（需 ≥' + def.reqWarSupportMin + '%）' };
  if(def.reqCiv != null && (n.civ || 0) < def.reqCiv) return { ok:false, reason:'民用工厂不足（需 ' + def.reqCiv + '）' };
  if(def.reqInfra != null){
    if(!hex) return { ok:false, reason:'需指定省份' };
    if((hex.infra || 0) < def.reqInfra) return { ok:false, reason:'该省基建不足（需 ' + def.reqInfra + '）' };
  }
  if(def.reqPuppet){
    const anyPuppet = Object.keys(world.nations).some(id2 => world.nations[id2].puppetOf === natId && world.nations[id2].alive);
    if(!anyPuppet) return { ok:false, reason:'没有傀儡国' };
  }

  // PP 不足
  if(n.pp < def.cost) return { ok:false, reason:'政治点数不足（需 ' + def.cost + '，现有 ' + Math.floor(n.pp) + '）' };
  return { ok:true, reason:'' };
}

/** 当前可用决议列表（UI 用） */
export function availableDecisions(world, natId){
  const n = world.nations[natId];
  if(!n) return [];
  return DECISIONS.map(def => {
    const chk = decisionRequirement(world, natId, def, null);
    return { def, ok: chk.ok, reason: chk.reason, active: isActive(n, def.id) };
  });
}

/* ---------- 效果应用 ---------- */

function addMods(n, mods, sign){
  for(const k in mods){
    n.modifiers = n.modifiers || {};
    n.modifiers[k] = (n.modifiers[k] || 0) + mods[k] * sign;
    if(Math.abs(n.modifiers[k]) < 1e-9) delete n.modifiers[k];
  }
}

function applyInstant(world, n, instant, hex){
  if(!instant) return;
  for(const k in instant){
    const v = instant[k];
    switch(k){
      case 'buildSlot': {
        const h = hex || pickIndustrialHex(world, n);
        if(h){ h.buildSlots = (h.buildSlots || 0) + v; h.civ = Math.max(0, (h.civ || 0)); }
        break;
      }
      case 'civFactory': {
        // 全国平摊增加民用工厂
        const own = world.hexes.filter(h => h.owner === natIdOf(n));
        if(own.length){
          const each = v / own.length;
          for(const h of own) h.civ = (h.civ || 0) + each;
          n.civ = (n.civ || 0) + v;
        }
        break;
      }
      case 'civToMil': {
        // 民厂转军厂：找民用最多的省
        const own = world.hexes.filter(h => h.owner === natIdOf(n));
        own.sort((a,b2) => (b2.civ || 0) - (a.civ || 0));
        let left = v;
        for(const h of own){
          if(left <= 0) break;
          const move = Math.min(left, Math.floor(h.civ || 0));
          h.civ -= move; h.mil = (h.mil || 0) + move; left -= move;
        }
        n.civ = Math.max(0, (n.civ || 0) - v);
        n.mil = (n.mil || 0) + v;
        break;
      }
      case 'equipment': {
        n.equipment = n.equipment || {};
        for(const eq in v) n.equipment[eq] = (n.equipment[eq] || 0) + v[eq];
        break;
      }
      case 'manpowerBonus': {
        n.manpowerBonus = (n.manpowerBonus || 0) + v;
        break;
      }
      case 'resource': {
        if(hex){
          n.resourceStock = n.resourceStock || {};
          const key = hex._res || 'steel';
          n.resourceStock[key] = (n.resourceStock[key] || 0) + v;
        }
        break;
      }
      case 'relations': {
        for(const id2 in world.nations){
          const o = world.nations[id2];
          if(id2 !== natIdOf(n) && o.relations != null) o.relations[natIdOf(n)] = (o.relations[natIdOf(n)] || 0) + v;
        }
        if(n.relations) for(const id2 in n.relations) n.relations[id2] = (n.relations[id2] || 0) + v;
        break;
      }
    }
  }
}

/** 从 nation 对象取回自己的国家代号（world.nations 以代号为键） */
function natIdOf(n){
  return n.id;
}

function pickIndustrialHex(world, n){
  const id = n.id;
  const own = world.hexes.filter(h => h.owner === id);
  own.sort((a,b2) => ((b2.infra || 0) + (b2.mil || 0) * 2) - ((a.infra || 0) + (a.mil || 0) * 2));
  return own[0] || null;
}

/**
 * 启动一个决议
 * @param hex 可选的指定省份（决议需要指定目标时传入）
 */
export function fireDecision(world, natId, id, hex){
  const def = getDecision(id);
  if(!def) return { ok:false, msg:'未知决议' };
  const n = world.nations[natId];
  if(!n) return { ok:false, msg:'国家不存在' };
  if(!n.decisions) initDecisions(world);

  const chk = decisionRequirement(world, natId, def, hex);
  if(!chk.ok) return { ok:false, msg: chk.reason };

  n.pp -= def.cost;
  n.decisions.used[id] = usedCount(n, id) + 1;
  if(def.oncePerHex && hex){
    n.decisions.usedHex = n.decisions.usedHex || {};
    n.decisions.usedHex[id + '@' + hex.q + ',' + hex.r] = true;
  }

  // 登记进行中的决议。
  // 关键：只要有 duration 就必须登记 —— 早期版本只在"带 mods"时登记，
  // 导致「战争宣传」这类纯 weekly 效果的决议根本没进 active，
  // 每周累积永远不触发（表现为决议启动成功但毫无效果）。
  if(def.duration){
    if(def.effect && def.effect.mods) addMods(n, def.effect.mods, 1);
    n.decisions.active[id] = { until: world.day + def.duration, startDay: world.day, defId: id };
  }
  // 即时效果
  if(def.effect && def.effect.instant) applyInstant(world, n, def.effect.instant, hex);
  // 即时惩罚
  if(def.effect && def.effect.penalty){
    n.stability = Math.max(0, Math.min(100, (n.stability || 0) + (def.effect.penalty.stability || 0)));
    n.warSupport = Math.max(0, Math.min(100, (n.warSupport || 0) + (def.effect.penalty.warSupport || 0)));
  }

  world.events.push({ type:'decision', day: world.day,
    text:`${n.name || natId} 启动决议「${def.name}」`, important:false });
  return { ok:true, msg: def.name + ' 已启动' };
}

/** 撤销一个进行中的决议（提前结束，如停战撤令） */
export function cancelDecision(world, natId, id){
  const n = world.nations[natId];
  if(!n || !n.decisions || !n.decisions.active[id]) return { ok:false, msg:'该决议未在进行' };
  const def = getDecision(id);
  if(def && def.effect && def.effect.mods) addMods(n, def.effect.mods, -1);
  delete n.decisions.active[id];
  return { ok:true, msg: def ? def.name + ' 已撤销' : '已撤销' };
}

/** 每日结算：到期撤销 + 每周效果 + 每日 PP 消耗 */
export function decisionsTick(world){
  if(!world || !world.nations) return;
  for(const id in world.nations){
    const n = world.nations[id];
    if(!n.alive || n.capitulated) continue;
    if(!n.decisions) initDecisions(world);   // 懒初始化，与 resources/logistics 同构

    // 1) 到期撤销（先收集再删除，避免遍历中改集合）
    const activeIds = Object.keys(n.decisions.active);
    for(const did of activeIds){
      const act = n.decisions.active[did];
      if(act && world.day >= act.until){
        const def = getDecision(did);
        if(def && def.effect && def.effect.mods) addMods(n, def.effect.mods, -1);
        delete n.decisions.active[did];
        world.events.push({ type:'decision_end', day: world.day,
          text:`${n.name || id} 的决议「${def ? def.name : did}」结束`, important:false });
      }
    }

    // 2) 每日 PP 消耗（如推广思想）
    for(const did of Object.keys(n.decisions.active)){
      const def = getDecision(did);
      if(def && def.dailyPP){
        n.pp = Math.max(0, n.pp - def.dailyPP);
      }
    }

    // 3) 每周效果
    //    注意：不能用 day % 7 === 0 —— 世界起始日不一定是 7 的倍数
    //    （剧本 A 从 day 0 起、存档恢复从任意日起），那样每周效果会永不触发。
    //    改用"距上次结算 ≥7 天"判定，对任意起始日都成立。
    if(n._lastWeeklyDay == null || world.day - n._lastWeeklyDay >= 7){
      n._lastWeeklyDay = world.day;
      for(const did of Object.keys(n.decisions.active)){
        const def = getDecision(did);
        if(!def || !def.effect || !def.effect.weekly) continue;
        const wk = def.effect.weekly;
        if(wk.stability) n.stability = Math.max(0, Math.min(100, (n.stability || 0) + wk.stability));
        if(wk.warSupport) n.warSupport = Math.max(0, Math.min(100, (n.warSupport || 0) + wk.warSupport));
        if(wk.warSupportLossReduce) n._warSupportLossReduce = (n._warSupportLossReduce || 0) + wk.warSupportLossReduce;
        if(wk.relations) applyInstant(world, n, { relations: wk.relations }, null);
        if(wk.puppetSupport) {
          for(const pid in world.nations){
            if(world.nations[pid].puppetOf === id){
              world.nations[pid].rulingSupport = (world.nations[pid].rulingSupport || 0) + wk.puppetSupport;
            }
          }
        }
      }
    }
  }
}
