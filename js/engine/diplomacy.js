/* ============================================================
   engine/diplomacy.js —— 外交网络系统（制裁/军援/阵营博弈 §3.9）
   W5：同盟条约 / 白和停战 / 撕毁条款 / 双边关系
   ============================================================ */

import { K } from '../data/constants.js';
import { lostVP } from './victory.js';   // 白和接受判定（victory↔peace 环已存在，运行时安全）
import { spawnUnit } from './world.js';  // W5-7：志愿军实体化（world 不引 diplomacy，无环）
import { initTension, adjustRelations } from './tension.js';  // W5：tension 已剪断对 diplomacy/world 的边，无环

export function initDiplomacy(world){
  world.diplomacy = world.diplomacy || {
    sanctions: [], // [ { from, to, date, severity } ]
    milAidPipes: [] // [ { from, to, monthlyEquip } ]
  };
}

export function applySanction(world, fromNat, toNat, severity = 'heavy'){
  world.diplomacy = world.diplomacy || { sanctions: [], milAidPipes: [] };
  const existing = world.diplomacy.sanctions.find(s => s.from === fromNat && s.to === toNat);
  if(!existing){
    world.diplomacy.sanctions.push({ from: fromNat, to: toNat, severity, date: world.day });
    const target = world.nations[toNat];
    if(target){
      target.modifiers.milOutput = (target.modifiers.milOutput || 0) - (severity === 'heavy' ? 0.15 : 0.08);
      target.stability = Math.max(10, (target.stability || 60) - 5);
    }
    world.events.push({
      type: 'sanction_applied',
      day: world.day,
      important: true,
      text: `🚫【严厉经济制裁】${world.nations[fromNat]?.name || fromNat} 对 ${world.nations[toNat]?.name || toNat} 实施单边贸易封锁与高科技禁运！`
    });
    return true;
  }
  return false;
}

export function establishMilAidPipe(world, fromNat, toNat, monthlyEquip = 100){
  world.diplomacy = world.diplomacy || { sanctions: [], milAidPipes: [] };
  const existing = world.diplomacy.milAidPipes.find(p => p.from === fromNat && p.to === toNat);
  if(!existing){
    world.diplomacy.milAidPipes.push({ from: fromNat, to: toNat, monthlyEquip });
    world.events.push({
      type: 'mil_aid_pipe',
      day: world.day,
      important: true,
      text: `📦【军援生命线管道开启】${world.nations[fromNat]?.name || fromNat} 向 ${world.nations[toNat]?.name || toNat} 建立常态化重武器与防空弹药补给走廊！`
    });
    return true;
  }
  return false;
}

export function diplomacyTick(world){
  if(!world.diplomacy) return;

  // 军援管道按月/周输送
  for(const pipe of world.diplomacy.milAidPipes){
    const donor = world.nations[pipe.from];
    const receiver = world.nations[pipe.to];
    if(donor && receiver && donor.alive && receiver.alive){
      const actualTransfer = Math.min(pipe.monthlyEquip, donor.equip);
      donor.equip -= actualTransfer;
      receiver.equip += actualTransfer;
    }
  }

  // W5-8：双边关系每日向 0 衰减（无事件维持的关系自然冷却）
  if(world.relations){
    for(const key in world.relations){
      const v = world.relations[key];
      if(v > 0) world.relations[key] = Math.max(0, v - 0.02);
      else if(v < 0) world.relations[key] = Math.min(0, v + 0.02);
    }
  }
}

/* ============================================================
   W5-8：双边关系（canonical 真源在 world.relations，tension.js 提供
   get/adjust 辅助；此处引 helper 会成环，故直接操作键值）
   ============================================================ */
function relKey(a, b){ return [a, b].sort().join('|'); }

/**
 * W5-6：双边同盟条约（区别于阵营 faction）—— 缔约方遭受入侵时自动参战。
 * 代价 100 PP；交战/停战对象不可缔约；缔约提升关系 +40。
 */
export function formAlliance(world, natA, natB){
  const a = world.nations[natA], b = world.nations[natB];
  if(!a || !b || natA === natB) return { ok:false, reason:'国家不存在' };
  if((a.atWarWith || []).includes(natB)) return { ok:false, reason:'交战国不可缔约' };
  a.allies = a.allies || [];
  b.allies = b.allies || [];
  if(a.allies.includes(natB)) return { ok:false, reason:'同盟已存在' };
  const cost = 100;
  if(a.pp < cost) return { ok:false, reason:'政治点数不足（需 100）' };
  a.pp -= cost;
  a.allies.push(natB);
  b.allies.push(natA);
  world.relations = world.relations || {};
  const key = relKey(natA, natB);
  world.relations[key] = Math.min(100, (world.relations[key] || 0) + 40);
  world.events = world.events || [];
  world.events.push({
    type: 'alliance_formed', day: world.day, important: true,
    text: `🤝【同盟条约】${a.name} 与 ${b.name} 签署共同防御协定：任何一方遭入侵，另一方自动参战！`
  });
  return { ok:true };
}

/* ============================================================
   W5-5：白和与停战 —— 两败俱伤时的退出口。
   proposeWhitePeace：提案方发起，AI 接受规则（战意 <40 或 VP 损失过半）；
   成功 → 战争结束 + 停战白名单（K.TRUCE_DAYS 内不得再战）。
   ============================================================ */
export function proposeWhitePeace(world, proposerNat, targetNat){
  const p = world.nations[proposerNat], t = world.nations[targetNat];
  if(!p || !t) return { ok:false, reason:'国家不存在' };
  if(!(p.atWarWith || []).includes(targetNat)) return { ok:false, reason:'双方并未交战' };
  // AI 接受判定：接受方战意低迷，或其 VP 损失过半（打得越惨越愿意停）
  const st = lostVP(world, targetNat);
  const accept = (t.warSupport || 50) < 40 || st.ratio >= 0.5;
  if(!accept) return { ok:false, reason:`${t.name} 拒绝了白和提议（战意 ${(t.warSupport||50).toFixed(0)}%）` };

  endWarMutually(world, proposerNat, targetNat);
  world.truces = world.truces || {};
  world.truces[relKey(proposerNat, targetNat)] = world.day + 365;
  world.events.push({
    type: 'white_peace', day: world.day, important: true,
    text: `🕊️【白和】${p.name} 与 ${t.name} 签署无条件停战协定，一切恢复战前状态（停战期 365 天）。`
  });
  return { ok:true };
}

/** 相互停战：清战争关系、清进攻命令、弃置未达成战争目标 */
export function endWarMutually(world, a, b){
  const na = world.nations[a], nb = world.nations[b];
  for(const n of [na, nb]){
    if(!n) continue;
    n.atWarWith = (n.atWarWith || []).filter(x => x !== (n === na ? b : a));
  }
  world.activeWargoals = (world.activeWargoals || []).filter(g => !(
    (g.from === a && g.to === b) || (g.from === b && g.to === a)));
  for(const u of world.units){
    if((u.nat === a && u.order && (u.order.type === 'attack' || u.order.type === 'spearhead' || u.order.type === 'breakthrough' || u.order.type === 'pin')) ||
       (u.nat === b && u.order && (u.order.type === 'attack' || u.order.type === 'spearhead' || u.order.type === 'breakthrough' || u.order.type === 'pin'))){
      u.order = null;
    }
  }
}


/**
 * W5-1/2：带战争目标的宣战 —— 宣战流程的唯一正门。
 * 要求：对目标国的战争借口已就绪（法西斯/共产意识形态可无借口开战）；
 * 目标格式见 data/wargoals.js（'conquer' | 'capture:城市名' | 'puppet' | 'contain'）。
 */
export function declareWarWithGoal(world, fromNat, toNat, wargoal = 'conquer'){
  initTension(world);
  const n = world.nations[fromNat];
  const to = world.nations[toNat];
  if(!n || !to || fromNat === toNat) return { ok:false, reason:'国家不存在' };
  if(n.atWarWith && n.atWarWith.includes(toNat)) return { ok:false, reason:'已处于战争状态' };
  // 停战白名单（W5-5）：停战期内不得再战
  const truceKey = [fromNat, toNat].sort().join('|');
  world.truces = world.truces || {};
  if((world.truces[truceKey] || 0) > world.day){
    return { ok:false, reason:`停战协定生效中（第 ${world.truces[truceKey]} 天前不可开战）` };
  }

  const ideo = (n.ideology || '').toLowerCase();
  const needJustify = !(ideo === 'fascist' || ideo === 'communism' || ideo === 'communist');
  const j = (n.justifying || []).find(x => x.target === toNat && x.done && !x.used);
  if(needJustify && !j){
    return { ok:false, reason:'战争借口未就绪（或已被使用）' };
  }
  if(j){ j.used = true; }

  const res = declareWar(world, fromNat, toNat, wargoal);
  if(!res) return { ok:false, reason:'宣战失败' };

  world.tension.value = Math.min(100, world.tension.value + 8);
  world.tension.sources = world.tension.sources || [];
  world.tension.sources.push({ day: world.day, value: 8, text: `${n.name} 对 ${to.name} 宣战（战争目标：${wargoal}）` });
  return { ok:true, wargoal };
}

/**
 * W5-7：志愿军实体化 —— 派遣方支付 30PP，目标国获得至多 3 个装备齐全的
 * 步兵师（u.foreignHelper 记录来源国，用于战报与损耗归属）。
 * 挂目标国国籍以接入现有战斗/补给/人力管线（旧版只写数组不生成单位）。
 */
export function sendVolunteers(world, sourceNat, targetNat){
  initTension(world);
  const n = world.nations[sourceNat];
  const target = world.nations[targetNat];
  if(!n || !target) return false;
  if(world.tension.value < 30) return false;
  if(n.pp < 30) return false;
  n.volunteersSent = n.volunteersSent || [];
  if(n.volunteersSent.includes(targetNat)) return false;   // 每对 (来源,目标) 只组建一次
  if(!target.alive || target.capitulated) return false;

  n.pp -= 30;
  n.volunteersSent.push(targetNat);
  target.volunteersReceived = target.volunteersReceived || [];
  if(!target.volunteersReceived.includes(sourceNat)) target.volunteersReceived.push(sourceNat);
  adjustRelations(world, sourceNat, targetNat, +20);

  const cap = world.hexes.find(h => h.city && h.city.cap === targetNat)
    || world.hexes.find(h => h.owner === targetNat && h.terrain !== 'sea');
  let spawned = 0;
  if(cap){
    for(let i = 0; i < 3; i++){
      const u = spawnUnit(world, 'inf', cap.q, cap.r, targetNat);
      if(u){ u.foreignHelper = sourceNat; u.xp = 30; spawned++; }   // 志愿军按老兵档入场
    }
  }

  world.events = world.events || [];
  world.events.push({
    type: 'volunteers',
    day: world.day,
    important: true,
    text: `🪖 志愿军开拔：${n.name} 向【${target.name}】派出 ${spawned} 个志愿步兵师（战力挂目标国指挥体系）！`
  });
  return true;
}

/**
 * W5-3：撕毁和约条款 —— 战败国（或任何受约束方）推翻和会强加的持久条款。
 * kind: 'demilitarized'（hex）| 'resourceRights'（对某战胜国）
 * 代价：PP 150 + 稳定 −10 + 战意 −5，并产生世界紧张度。
 */
export function tearUpTerms(world, natId, kind, payload = {}){
  const n = world.nations[natId];
  if(!n) return { ok:false, reason:'国家不存在' };
  const cost = 150;
  if((n.pp || 0) < cost) return { ok:false, reason:`政治点数不足（需 ${cost}）` };

  if(kind === 'demilitarized'){
    const h = world.at[(payload.q != null ? payload.q : '') + ',' + (payload.r != null ? payload.r : '')];
    if(!h || !h.demilitarized) return { ok:false, reason:'该省并非非军事区' };
    if(h.owner !== natId) return { ok:false, reason:'只能撕毁本国领土上的条款' };
    n.pp -= cost;
    h.demilitarized = false;
  } else if(kind === 'resourceRights'){
    n.pp = n.pp;   // 受益方无可撕；此路径由"被掠夺方"调用
    const other = payload.against;
    const victim = world.nations[natId];
    const idx = (victim.resourceRights || []).findIndex(r => r.natId === other);
    if(idx < 0) return { ok:false, reason:'本国没有该条约的掠夺条款' };
    // 反向：被掠夺方撕毁 → 移除对方手里的开采特权
    const benefactor = world.nations[other];
    if(benefactor && benefactor.resourceRights){
      benefactor.resourceRights = benefactor.resourceRights.filter(r => r.natId !== natId);
    }
    n.pp -= cost;
  } else {
    return { ok:false, reason:'未知条款类型' };
  }

  n.stability = Math.max(10, (n.stability || 60) - 10);
  n.warSupport = Math.max(0, (n.warSupport || 50) - 5);
  if(world.tension){
    world.tension.value = Math.min(100, world.tension.value + 5);
    world.tension.sources = world.tension.sources || [];
    world.tension.sources.push({ day: world.day, value: 5, text: `${n.name} 撕毁和约条款（${kind}）` });
  }
  world.events = world.events || [];
  world.events.push({
    type: 'treaty_torn', day: world.day, important: true,
    text: `📜【撕毁条约】${n.name} 单方面撕毁和约条款（${kind === 'demilitarized' ? '非军事区' : '资源掠夺'}）！世界哗然。`
  });
  return { ok:true };
}

/**
 * 阵营管理系统 (v5.0 §2.4 / E2)
 */
export function createFaction(world, factionId, name, leaderNatId){
  world.factions = world.factions || {};
  world.factions[factionId] = {
    id: factionId,
    name,
    leader: leaderNatId,
    members: [leaderNatId]
  };
  const nat = world.nations[leaderNatId];
  if(nat) nat.faction = factionId;
  return world.factions[factionId];
}

export function joinFaction(world, natId, factionId){
  world.factions = world.factions || {};
  const faction = world.factions[factionId];
  const nat = world.nations[natId];
  if(!faction || !nat) return false;

  if(!faction.members.includes(natId)){
    faction.members.push(natId);
    nat.faction = factionId;

    world.events = world.events || [];
    world.events.push({
      type: 'faction_join',
      day: world.day,
      important: true,
      text: `🤝 阵营扩张：【${nat.name}】正式加入【${faction.name}】！`
    });
    return true;
  }
  return false;
}

export function leaveFaction(world, natId){
  world.factions = world.factions || {};
  const nat = world.nations[natId];
  if(!nat || !nat.faction) return false;

  const faction = world.factions[nat.faction];
  if(faction){
    faction.members = faction.members.filter(m => m !== natId);
    nat.faction = null;
    world.events = world.events || [];
    world.events.push({
      type: 'faction_leave',
      day: world.day,
      important: true,
      text: `🚪 阵营分裂：【${nat.name}】宣布脱离【${faction.name}】！`
    });
    return true;
  }
  return false;
}

export function getFactionMembers(world, factionId){
  if(!world.factions || !world.factions[factionId]) return [];
  return world.factions[factionId].members;
}

/**
 * 宣战与战争目标绑定 [H] (W5)
 */
export function declareWar(world, fromNat, toNat, wargoal = null){
  const from = world.nations[fromNat];
  const to = world.nations[toNat];
  if(!from || !to || fromNat === toNat) return false;

  // W5-5：停战白名单 —— 停战期内不得开战（事件/脚本开战同样受约束）
  world.truces = world.truces || {};
  const tk = relKey(fromNat, toNat);
  if((world.truces[tk] || 0) > world.day){
    world.events = world.events || [];
    world.events.push({ type:'truce_blocked', day: world.day, important: false,
      text: `⚖️ 停战协定仍生效：${from.name} 对 ${to.name} 的宣战被阻止（第 ${world.truces[tk]} 天前不可开战）。` });
    return false;
  }

  from.atWarWith = from.atWarWith || [];
  to.atWarWith = to.atWarWith || [];

  if(!from.atWarWith.includes(toNat)) from.atWarWith.push(toNat);
  if(!to.atWarWith.includes(fromNat)) to.atWarWith.push(fromNat);

  world.activeWargoals = world.activeWargoals || [];
  const goalObj = typeof wargoal === 'string'
    ? { type: wargoal.split(':')[0], arg: wargoal.split(':')[1] || null }
    : (wargoal || { type: 'conquer', arg: null });

  world.activeWargoals.push({
    from: fromNat,
    to: toNat,
    goal: goalObj,
    day: world.day
  });

  world.events = world.events || [];
  world.events.push({
    type: 'war_declared',
    day: world.day,
    important: true,
    text: `⚔️【宣战】${from.name} 正式向 ${to.name} 宣战！战争目标：${goalObj.name || goalObj.type}。`
  });

  // W5-6：同盟防御征召 —— 被入侵方的双边盟国自动对侵略方参战（不递归走 declareWar）
  for(const allyId of (to.allies || [])){
    const ally = world.nations[allyId];
    if(!ally || !ally.alive || allyId === fromNat) continue;
    if((ally.atWarWith || []).includes(fromNat)) continue;
    ally.atWarWith.push(fromNat);
    from.atWarWith.push(allyId);
    world.events.push({ type:'ally_called', day: world.day, important: true,
      text: `🛡️【防御征召】同盟条约生效：${ally.name} 自动对 ${from.name} 参战！` });
  }
  for(const allyId of (from.allies || [])){
    const ally = world.nations[allyId];
    if(!ally || !ally.alive || allyId === toNat) continue;
    if((ally.atWarWith || []).includes(toNat)) continue;
    ally.atWarWith.push(toNat);
    to.atWarWith.push(allyId);
    world.events.push({ type:'ally_called', day: world.day, important: true,
      text: `🛡️【协同参战】同盟义务：${ally.name} 随 ${from.name} 对 ${to.name} 参战！` });
  }

  // W5-8：开战即交恶
  world.relations = world.relations || {};
  world.relations[relKey(fromNat, toNat)] = -100;
  return true;
}

