/* ============================================================
   engine/ideology.js —— 意识形态与执政党系统 (v14.0 P3 §4.2/§4.3)
   HOI4（萌娘百科「政治派别」）：
     · 每日政党支持度漂移：同派系 +0.02%，其他 +0.01%，敌对 -0.01%
     · 公投：执政党支持 > 50% + 100PP → 和平改换意识形态
     · 内战：稳定度 < 50% → 打赢内战即可改换（支持 > 10% 即可）
   意识形态同时是"机制层"而非标签：决定外交合法性、傀儡等级、AI 宣战倾向。
   ============================================================ */

import { K } from '../data/constants.js';
import { IDEOLOGIES, IDEOLOGY_FACTIONS, ERA_IDEOLOGY, PUPPET_TIERS, getIdeology } from '../data/ideology.js';

const REFERENDUM_COST = 100;      // [H] 萌娘百科：公投消耗 100 PP
const CIVIL_WAR_STABILITY = 50;   // [H] 稳定度低于 50% 才可打内战
const CIVIL_WAR_SUPPORT_MIN = 10; // [H] 执政党支持 > 10% 即可发动内战

/** 建世界时初始化意识形态与执政党 */
export function initIdeology(world){
  if(!world || !world.nations) return;
  const table = ERA_IDEOLOGY[world.era] || ERA_IDEOLOGY[world.scenario] || ERA_IDEOLOGY.ww2 || {};
  for(const id in world.nations){
    const n = world.nations[id];
    if(n.ideology) continue;
    const ideo = table[id] || 'neutrality';
    n.ideology = ideo;
    n.ideologyFaction = (IDEOLOGY_FACTIONS[ideo] || IDEOLOGY_FACTIONS.neutrality)[0].id;
    // 执政党支持度：民主国家较高、独裁国家较低（HOI4 表现）
    n.rulingSupport = ideo === 'democratic' ? 62 : ideo === 'communism' ? 58 : 45;
    n.partySupport = n.rulingSupport;   // 各派系支持度（rulingSupport 为执政党）
  }
}

/** 某国某派系的支持度百分比 */
export function factionSupport(n, factionId){
  if(!n) return 0;
  if(factionId === n.ideologyFaction) return n.rulingSupport != null ? n.rulingSupport : 50;
  // 其他派系：按"执政党之外的剩余票"平分
  const others = (IDEOLOGY_FACTIONS[n.ideology] || []).filter(f => f.id !== n.ideologyFaction);
  const rest = Math.max(0, 100 - (n.rulingSupport != null ? n.rulingSupport : 50));
  const idx = Math.max(0, others.findIndex(f => f.id === factionId));
  return others.length ? rest / others.length : 0;
}

/** 每日政党支持度漂移 [H] */
export function ideologyTick(world){
  if(!world || !world.nations) return;
  for(const id in world.nations){
    const n = world.nations[id];
    if(!n.alive || n.capitulated) continue;
    if(n.ideology == null) initIdeology(world);
    const ideo = getIdeology(n.ideology);
    const d = ideo.drift;

    // 执政党支持度：每日按 drift.same 增长，但被"经济表现/战争支持度"牵制
    let delta = d.same / 100;                                  // 0.02%/日
    if((n.warSupport || 0) < 40) delta -= 0.0008;               // 战争不力人民不满
    if((n.stability || 0) < 40) delta -= 0.0006;
    if(n.rulingSupport == null) n.rulingSupport = 50;
    n.rulingSupport = Math.max(0, Math.min(100, n.rulingSupport + delta));

    // W4-7：民主国家选举周期 —— 每 4 年（1440 天）一次大选，确定性结算。
    // 结果由执政党支持度驱动：过半 → 稳定/战意小幅上行；不过半 → 下行且 PP 减损。
    // 伪随机用 (day, natId) 字符串散列，不接触 rng（剧本回放保持确定性）。
    if(ideo.id === 'democratic'){
      n.nextElectionDay = n.nextElectionDay == null ? 1440 : n.nextElectionDay;
      if(world.day >= n.nextElectionDay){
        n.nextElectionDay = world.day + 1440;
        const hash = [...(id + ':' + world.day)].reduce((s, ch) => (s * 31 + ch.charCodeAt(0)) >>> 0, 7);
        const swing = (hash % 9) - 4;                          // −4 ~ +4 的选情摆动
        const margin = (n.rulingSupport || 50) - 50;
        const stabDelta = Math.round((margin >= 0 ? 2 : -3) + swing * 0.5);
        n.stability = Math.max(10, Math.min(100, (n.stability || 60) + stabDelta));
        n.warSupport = Math.max(0, Math.min(100, (n.warSupport || 50) + (margin >= 0 ? 2 : -3)));
        if(margin < 0) n.pp = Math.max(0, (n.pp || 0) - 50);   // 执政联盟受挫：政治资本损耗
        n.rulingSupport = Math.max(20, Math.min(80, (n.rulingSupport || 50) + (margin >= 0 ? 3 : -3)));
        world.events = world.events || [];
        world.events.push({
          type: 'election', day: world.day, important: true,
          text: `🗳️【大选日】${n.name}举行四年一度大选：执政联盟${margin >= 0 ? '成功连任' : '受挫'}，` +
                `稳定度 ${stabDelta >= 0 ? '+' : ''}${stabDelta}%。`
        });
      }
    }

    // 中立主义：意识形态变化抵制 -30% [H]（表现为其他派系更难坐大）
    if(ideo.ideologyChangeResist){
      n.partySupport = n.rulingSupport;
    }
    n.partySupport = n.rulingSupport;
  }
}

/* ---------- 改换意识形态：公投 / 内战 ---------- */

export function canHoldReferendum(world, natId, newIdeo){
  const n = world.nations[natId];
  if(!n) return { ok:false, reason:'国家不存在' };
  if(n.ideology === newIdeo) return { ok:false, reason:'已经是该意识形态' };
  if((n.rulingSupport || 0) <= 50) return { ok:false, reason:`执政党支持需 > 50%（当前 ${Math.round(n.rulingSupport || 0)}%）` };
  if(n.pp < REFERENDUM_COST) return { ok:false, reason:`政治点数不足（需 ${REFERENDUM_COST}）` };
  return { ok:true, reason:'' };
}

/** 举行公投改换意识形态（和平路径，HOI4 规则） */
export function holdReferendum(world, natId, newIdeo){
  const chk = canHoldReferendum(world, natId, newIdeo);
  if(!chk.ok) return { ok:false, msg:chk.reason };
  const n = world.nations[natId];
  n.pp -= REFERENDUM_COST;
  applyIdeology(world, natId, newIdeo, 'referendum');
  return { ok:true, msg:'公投通过，意识形态已改换' };
}

export function canStartCivilWar(world, natId, newIdeo){
  const n = world.nations[natId];
  if(!n) return { ok:false, reason:'国家不存在' };
  if(n.ideology === newIdeo) return { ok:false, reason:'已经是该意识形态' };
  if((n.stability || 0) >= CIVIL_WAR_STABILITY) return { ok:false, reason:`稳定度需 < 50%（当前 ${Math.round(n.stability || 0)}%）` };
  if((n.rulingSupport || 0) <= CIVIL_WAR_SUPPORT_MIN) return { ok:false, reason:'执政党支持度过低，无力发动内战' };
  if(n.civilWar) return { ok:false, reason:'内战已在进行中' };
  return { ok:true, reason:'' };
}

/** 发动内战：叛军 spawn（由现役兵力分出一半，装备折半） */
export function startCivilWar(world, natId, newIdeo){
  const chk = canStartCivilWar(world, natId, newIdeo);
  if(!chk.ok) return { ok:false, msg:chk.reason };
  const n = world.nations[natId];
  const rebels = 'reb_' + natId;
  world.nations[rebels] = {
    id: rebels, name: (n.name || natId) + ' 叛军', alive: true, capitulated: false,
    color: '#8b1a1a', isCivilWarRebel: true, rebelOf: natId, targetIdeology: newIdeo,
    civ: 0, mil: Math.floor((n.mil || 0) * 0.5), pp: 0,
    stability: 100, warSupport: 100, law: 'total', atWarWith: [natId],
    techs: [], research: { slots: [null], done: {} }, focus: { active: null, progress: 0, done: [] },
    modifiers: {}, equipment: {}, units: [], manpowerCap: 0, manpowerPool: 0,
    relations: {}, build: { q:-1, r:-1, prog:0, need:0, kind:null }, training: [], pool: [],
    ai: { lastDecision: 1e9, decisionDelay: 1e9 }   // 叛军不自动决策
  };
  n.civilWar = { rebel: rebels, targetIdeology: newIdeo, startDay: world.day };
  n.atWarWith = (n.atWarWith || []).concat([rebels]);
  world.nations[rebels].atWarWith = [natId];

  // 叛军从现役部队中分裂（半编）
  const mine = world.units.filter(u => u.nat === natId && u.hp > 0);
  const half = Math.floor(mine.length / 2);
  for(let i = 0; i < half; i++){
    const u = mine[i];
    const h = world.at[u.q + ',' + u.r];
    if(h) { const idx = h.units.indexOf(u.id); if(idx >= 0) h.units.splice(idx, 1); }
    u.nat = rebels;
    u.order = null;
    u.hp = Math.max(10, Math.floor(u.hp * 0.5));   // 装备折半
    const th = world.at[u.q + ',' + u.r];
    if(th) th.units.push(u.id);
  }
  world.events.push({ type:'civil_war', day: world.day, important:true,
    text:`${n.name} 爆发内战！叛军要求改换意识形态` });
  return { ok:true, msg:`内战爆发，${half} 支部队倒戈（击败叛军即可改换意识形态）` };
}

/** 内战结算：叛军全灭 → 胜利改换；玩家国投降 → 强制改换 */
export function civilWarTick(world){
  if(!world || !world.nations) return;
  for(const id in world.nations){
    const n = world.nations[id];
    if(!n.civilWar) continue;
    const rebel = world.nations[n.civilWar.rebel];
    const rebelAlive = rebel && rebel.alive && !rebel.capitulated;
    const rebelsLeft = world.units.filter(u => u.nat === n.civilWar.rebel && u.hp > 0).length;
    if(!rebelAlive || rebelsLeft === 0){
      // 叛军败亡 → 改换意识形态
      applyIdeology(world, id, n.civilWar.targetIdeology, 'civil_war_win');
      world.events.push({ type:'civil_war_end', day: world.day, important:true,
        text:`${n.name} 内战胜利，叛军被平定` });
      cleanupRebel(world, n.civilWar.rebel);
      n.civilWar = null;
    } else if(n.atWarWith && !n.atWarWith.includes(n.civilWar.rebel)){
      // 玩家被打败（不再与叛军交战 = 叛军攻占首都）
      applyIdeology(world, id, n.civilWar.targetIdeology, 'civil_war_loss');
      world.events.push({ type:'civil_war_end', day: world.day, important:true,
        text:`${n.name} 内战失利，执政党倒台` });
      cleanupRebel(world, n.civilWar.rebel);
      n.civilWar = null;
    }
  }
}

function cleanupRebel(world, rebelId){
  for(const u of world.units.filter(x => x.nat === rebelId)){
    const h = world.at[u.q + ',' + u.r];
    if(h){ const i = h.units.indexOf(u.id); if(i >= 0) h.units.splice(i, 1); }
  }
  delete world.nations[rebelId];
}

/** 实际改换（内部） */
export function applyIdeology(world, natId, newIdeo, method){
  const n = world.nations[natId];
  if(!n) return;
  const old = n.ideology;
  n.ideology = newIdeo;
  n.ideologyFaction = (IDEOLOGY_FACTIONS[newIdeo] || IDEOLOGY_FACTIONS.neutrality)[0].id;
  n.rulingSupport = method === 'civil_war_win' ? 48 : 45;   // 新政权支持度不高
  world.events.push({ type:'ideology', day: world.day, important:true,
    text:`${n.name} 意识形态由「${getIdeology(old).name}」改为「${getIdeology(newIdeo).name}」` });
}

/* ---------- 意识形态对外交与 AI 的影响 ---------- */

/** 宣战合法性：民主主义不得无理由对同意识形态国家开战 [H] */
export function warJustifyLegality(world, sourceNat, targetNat){
  const a = world.nations[sourceNat], b = world.nations[targetNat];
  if(!a || !b) return { allowed:true, reason:'' };
  const ia = getIdeology(a.ideology), ib = getIdeology(b.ideology);
  // 民主主义对民主主义国家无正当理由（保障独立优先）
  if(a.ideology === 'democratic' && b.ideology === 'democratic' && !(a.justifying||[]).some(j => j.target === targetNat && !j.done)){
    return { allowed:false, reason:'民主主义不得对同为民主主义的国家无理由开战（需正当化战争目标）' };
  }
  return { allowed:true, reason:'', speed: ia.justifySpeed };
}

/** 傀儡等级：法西斯主义的傀儡默认更低 [H] */
export function puppetTierFor(winnerId, loserId){
  const w = winnerId && winnerId.isCivilWarRebel ? null : winnerId;
  const n = typeof winnerId === 'string' ? null : winnerId;
  if(n && getIdeology(n.ideology).puppetTier === 'pupil') return 'pupil';
  return 'satellite';
}

export { REFERENDUM_COST, CIVIL_WAR_STABILITY, PUPPET_TIERS };
