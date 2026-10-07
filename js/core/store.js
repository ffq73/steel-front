/* ============================================================
   core/store.js —— 世界状态容器 + intent 分发（UI → 引擎唯一通道，C4）
   ============================================================ */

import { K } from '../data/constants.js';
import { UNITS } from '../data/units.js';
import { spawnUnit } from '../engine/world.js';
import { pickFocus } from '../engine/focus.js';
import { setLineFactories } from '../engine/economy.js';
import { applyManualPenalty } from '../engine/plans.js';
import { promoteToMarshal } from '../engine/characters.js';

export function createStore(world){
  const listeners = new Set();
  const store = {
    world,
    subscribe(fn){ listeners.add(fn); return () => listeners.delete(fn); },
    emit(){ for(const fn of listeners) fn(world); },
    dispatch(intent){
      const w = store.world;
      switch(intent.type){
        case 'ATTACK': {
          const u = w.units.find(x => x.id === intent.unitId);
          if(u && u.nat === w.player && u.hp > 0){
            u.order = { type:'attack', target:[intent.q, intent.r],
                        ...(u.order && u.order._dest ? { _dest:u.order._dest } : {}) };
          }
          break;
        }
        case 'ADVANCE': {
          const u = w.units.find(x => x.id === intent.unitId);
          if(u && u.nat === w.player && u.hp > 0){
            u.order = { type:'advance', dest:[intent.q, intent.r] };
          }
          break;
        }
        case 'DEPLOY': {
          const n = w.nations[w.player];
          const h = w.at[intent.q+','+intent.r];
          if(n.pool.length && h && h.owner===w.player){
            const stack = h.units.map(id=>w.units.find(x=>x.id===id)).filter(Boolean).length;
            if(stack < K.STACK_LIMIT) spawnUnit(w, n.pool.shift(), h.q, h.r, w.player);
          }
          break;
        }
        case 'TRAIN': {
          const n = w.nations[w.player];
          const U = UNITS[intent.unitType];
          if(U){
            const unlock = U.unlock;
            const ok = !unlock || !unlock.tech || n.techs.includes(unlock.tech);
            if(ok) n.training.push({ type:intent.unitType, costPaid:0, days:0 });
          }
          break;
        }
        case 'BUILD': {
          // v14.1 B5：建造队列 —— 当前槽空闲则直接开工，否则入队（BUILD_QUEUE_MAX 上限）；
          // 军民工厂受厂槽约束（FACTORY_SLOTS_PER_HEX + 决议 buildSlots 加成），
          // 基建/空海军基地不占厂槽；同时解除「军工只能建在首都」的 h.city 限制。
          const n = w.nations[w.player];
          const h = w.at[intent.q+','+intent.r];
          const kind = intent.kind || 'mil';
          if(h && h.owner===w.player && K.BUILD_COST[kind] != null){
            const slots = K.FACTORY_SLOTS_PER_HEX + (h.buildSlots || 0);
            const fillsSlot = kind === 'mil' || kind === 'civ';
            if(!fillsSlot || ((h.civ || 0) + (h.mil || 0)) < slots){
              const item = { q:h.q, r:h.r, prog:0, need:K.BUILD_COST[kind], kind };
              if(!n.build.kind){
                n.build = item;
              } else {
                n.buildQueue = n.buildQueue || [];
                if(n.buildQueue.length < K.BUILD_QUEUE_MAX) n.buildQueue.push(item);
              }
            }
          }
          break;
        }
        case 'PICK_FOCUS': {
          pickFocus(w, w.player, intent.focusId);
          break;
        }
        case 'RUSH_FOCUS': {
          const n = w.nations[w.player];
          if(n && n.focus.active && n.pp >= K.FOCUS_RUSH_PP){
            n.pp -= K.FOCUS_RUSH_PP;
            n.focus.progress += K.FOCUS_RUSH_DAYS;
          }
          break;
        }
        case 'SET_LINE_FACTORIES': {
          const n = w.nations[w.player];
          if(n) setLineFactories(n, intent.lineId, intent.factories);
          break;
        }
        case 'SET_DIFFICULTY': {
          if(K.DIFFICULTIES[intent.payload]){
            w.difficulty = intent.payload;
          }
          break;
        }
        case 'WAYPOINT': {
          const u = world.units.find(x => x.id === intent.unitId);
          if(u && u.nat === world.player && u.hp > 0){
            u.waypoints = u.waypoints || [];
            u.waypoints.push({ q: intent.q, r: intent.r });
          }
          break;
        }
        case 'SUPPORT': {
          const u = world.units.find(x => x.id === intent.unitId);
          if(u && u.nat === world.player && u.hp > 0){
            u.order = { type:'support', target:[intent.q, intent.r] };
          }
          break;
        }
        case 'STRATEGIC': {
          const u = world.units.find(x => x.id === intent.unitId);
          if(u) u.strategic = !u.strategic;
          break;
        }
        case 'DETACH': {
          const u = world.units.find(x => x.id === intent.unitId);
          if(u){ u.armyId = null; u.inPlan = false; u.order = null; u.waypoints = []; }
          break;
        }
        case 'CANCEL_ORDER': {
          const u = world.units.find(x => x.id === intent.unitId);
          if(u){ u.order = null; u.waypoints = []; }
          break;
        }
        case 'SET_SPEED': {
          if(intent.payload==='toggle') w.speed = w.speed>0 ? 0 : 1;
          else w.speed = intent.payload;
          break;
        }
        case 'MANUAL_PENALTY': {
          applyManualPenalty(w, intent.armyId, intent.unitId);
          break;
        }
        case 'PROMOTE_MARSHAL': {
          promoteToMarshal(w, intent.charId, w.player);
          break;
        }
        default: break;
      }
      store.emit();
      return store;
    }
  };
  return store;
}
