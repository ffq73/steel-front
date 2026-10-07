/* ============================================================
   engine/research.js —— 科研槽与超前惩罚（v2.0 §3.5）
   ============================================================ */

import { K } from '../data/constants.js';
import { TECHS } from '../data/techs.js';
import { log } from './world.js';

export function techById(id){ return TECHS.find(t => t.id === id); }

export function startResearch(world, natId, techId){
  const n = world.nations[natId];
  const t = techById(techId);
  if(!t || n.research.done[techId]) return false;
  if(n.research.slots.includes(techId)) return false;
  const free = n.research.slots.findIndex(s => s === null);
  if(free < 0) return false;
  n.research.slots[free] = techId;
  return true;
}

/** 当前可研究的科技（前置已完成、未在研）—— 科技面板 UI 用 (v14.0 P4) */
export function availableTechs(world, natId){
  const n = world.nations[natId];
  if(!n) return [];
  return TECHS.filter(t => {
    if(n.research.done[t.id]) return false;
    if(n.research.slots.includes(t.id)) return false;
    return (t.requires || []).every(r => n.research.done[r]);
  });
}

/** 某科技的前置是否满足（UI 灰显提示用） */
export function techUnmetRequires(world, natId, techId){
  const n = world.nations[natId];
  const t = techById(techId);
  if(!n || !t) return [];
  return (t.requires || []).filter(r => !n.research.done[r]);
}

export function researchTick(world){
  for(const id in world.nations){
    const n = world.nations[id];
    if(!n.alive) continue;
    const speed = 1 + (n.modifiers.research || 0);
    for(let i=0;i<n.research.slots.length;i++){
      const tid = n.research.slots[i];
      if(!tid) continue;
      const t = techById(tid);
      if(!t){ n.research.slots[i] = null; continue; }
      // 超前惩罚：按剧本时代基准年动态推算当前年份（W7/§12 修复硬编码 1939）
      const baseYear = world.eraData?.startYear || (world.era === 'ww1' ? 1914 : world.era === 'coldwar' ? 1949 : world.era === 'modern' ? 2022 : 1939);
      const curYear = baseYear + Math.floor(world.day / 365);
      const ahead = Math.max(0, t.year - curYear);
      const factor = 1 + ahead * K.AHEAD_PENALTY_PER_YEAR * (365 / t.days);
      n.research.progress = n.research.progress || {};
      const key = id + ':' + tid;
      n.research.progress[key] = (n.research.progress[key] || 0) + speed / factor;
      if(n.research.progress[key] >= t.days){
        n.research.progress[key] = 0;
        n.research.slots[i] = null;
        n.techs.push(tid);
        n.research.done[tid] = true;
        world.events.push({ type:'tech', day:world.day, text:`${n.name}完成研究：${t.name}` });
        applyEffect(world, id, t.effect);
      }
    }
  }
}

/* 效果解释器（科技/国策共用）——修改 nation.modifiers */
/** 处理 effect.extra：{ modifier:{stat,value}, invasionCap:{value} } */
function applyExtraEffects(world, natId, extra){
  const n = world.nations[natId];
  if(extra.modifier){
    n.modifiers[extra.modifier.stat] = (n.modifiers[extra.modifier.stat] || 0) + extra.modifier.value;
  }
  if(extra.invasionCap){
    // 存"总上限"而非加成：初始 10 = 无运输科技时的基准（HOI4 默认登陆 10 部队）
    n.invasionCap = (n.invasionCap || 10) + extra.invasionCap.value;
  }
}

export function applyEffect(world, natId, effect){
  if(!effect) return;
  const n = world.nations[natId];
  switch(effect.type){
    case 'modifier': {
      const key = effect.scope === 'nation' ? effect.stat
        : effect.scope === 'unit:all' ? 'all_' + effect.stat
        : effect.scope.replace('unit:', '') + '_' + effect.stat;
      n.modifiers[key] = (n.modifiers[key] || 0) + effect.value;
      break;
    }
    case 'unlockUnit':
      n.unlockedUnits = n.unlockedUnits || [];
      if(!n.unlockedUnits.includes(effect.unit)) n.unlockedUnits.push(effect.unit);
      break;
    // —— v14.0 P4：空/海军/核系统的科技解锁 ——
    case 'unlockAircraft': {
      n.unlockedAircraft = n.unlockedAircraft || [];
      for(const a of (effect.aircraft || [])){
        if(!n.unlockedAircraft.includes(a)) n.unlockedAircraft.push(a);
      }
      if(effect.extra) applyExtraEffects(world, natId, effect.extra);
      break;
    }
    case 'unlockShip': {
      n.unlockedShips = n.unlockedShips || [];
      for(const sh of (effect.ships || [])){
        if(!n.unlockedShips.includes(sh)) n.unlockedShips.push(sh);
      }
      if(effect.extra) applyExtraEffects(world, natId, effect.extra);
      break;
    }
    case 'unlockFeature': {
      n.features = n.features || {};
      n.features[effect.feature] = true;
      if(effect.extra) applyExtraEffects(world, natId, effect.extra);
      break;
    }
    case 'unlockTech': {
      const t = techById(effect.tech);
      if(t && !n.research.done[effect.tech]){
        n.techs.push(effect.tech); n.research.done[effect.tech] = true;
        applyEffect(world, natId, t.effect);
      }
      break;
    }
    case 'addResearchSlot':
      for(let i=0;i<effect.count;i++) n.research.slots.push(null);
      break;
    case 'addPP': n.pp = Math.min(K.PP_MAX, n.pp + (effect.value || 0)); break;
    case 'addFactory': {
      // 加到首都/最大城市
      const h = world.hexes.filter(x => x.owner===natId && x.city)
        .sort((a,b)=>b.city.w - a.city.w)[0];
      if(h){
        if(effect.kind==='mil'){ h.mil += effect.count; n.mil += effect.count; }
        else { h.civ += effect.count; n.civ += effect.count; }
      }
      break;
    }
    case 'addBuilding':
      if(effect.building==='fort'){
        const hs = world.hexes.filter(x => x.owner===natId &&
          x.adj.some(ni => world.nations[world.hexes[ni].owner] && atWarWith(world, natId, world.hexes[ni].owner)));
        for(const h of hs) h.fort = Math.min(5, h.fort + effect.level);
      }
      break;
    case 'setLaw': n.law = effect.law; break;
    case 'declareWar': {
      const t = world.nations[effect.target];
      if(t && t.alive && !n.atWarWith.includes(effect.target)){
        n.atWarWith.push(effect.target);
        t.atWarWith.push(natId);
        world.events.push({ type:'war', day:world.day, text:`★ ${n.name}对${t.name}宣战！`, important:true });
      }
      break;
    }
    case 'addBuilding2': break;
    case 'event': break;   // 事件由 tick 层触发

    /* —— v11.0：剧本国策树（ww1~modern）使用的效果类型 ——
       剧本国策此前从未进过解释器（引擎只读 data/focuses.js 的通用树），
       接线后必须补齐语义，否则点完 24 个国策什么收益都没有。 */
    case 'addMil': {
      const h = capitalCityHex(world, natId);
      if(h){ h.mil += (effect.value || 0); n.mil += (effect.value || 0); }
      break;
    }
    case 'addCiv': {
      const h = capitalCityHex(world, natId);
      if(h){ h.civ += (effect.value || 0); n.civ += (effect.value || 0); }
      break;
    }
    case 'addEquip':
      n.equip += (effect.value || 0);
      break;
    case 'addStability':
      n.stability = Math.max(0, Math.min(100, (n.stability || 0) + (effect.value || 0)));
      break;
    case 'addWarSupport':
      n.warSupport = Math.max(0, Math.min(100, (n.warSupport || 0) + (effect.value || 0)));
      break;
    case 'addPrestige':
      n.prestige = (n.prestige || 0) + (effect.value || 0);
      break;
    case 'addArmyXp':
      // 通用国策树（剧本 A）用这个发陆军经验；遗漏会让「陆军学说创新」
      // 这类节点点完毫无收益
      n.armyXp = (n.armyXp === undefined ? 50 : n.armyXp) + (effect.value || 0);
      break;
    case 'addModifier':
      // 剧本树写的是扁平 {stat,value}，语义等价于通用树的 scope:'nation'
      n.modifiers[effect.stat] = (n.modifiers[effect.stat] || 0) + (effect.value || 0);
      break;
  }
}

/* 首都优先、否则最大城市 —— addMil / addCiv 的落点，与 addFactory 同一口径 */
function capitalCityHex(world, natId){
  return world.hexes.filter((x) => x.owner === natId && x.city)
    .sort((a, b) => ((b.city.cap ? 1 : 0) - (a.city.cap ? 1 : 0)) || (b.city.w - a.city.w))[0] || null;
}
function atWarWith(world, a, b){
  return world.nations[a] && world.nations[a].atWarWith.includes(b);
}
