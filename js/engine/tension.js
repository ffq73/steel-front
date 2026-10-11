/* ============================================================
   engine/tension.js —— 世界紧张度系统 (v4.0 §3.1 / P2)
   全局共享 0–100%，记录历史来源明细，门槛控制内政外交行为
   ============================================================ */

import { K } from '../data/constants.js';
import { warJustifyLegality } from './ideology.js';   // v14.0 P3 宣战合法性
// （本文件不得引入 diplomacy/world 边：events.js→tension 是剧本子图的一部分，
//   diplomacy→world→scenarios 会构成 ESM 链接环 → scenarios TDZ）

export function initTension(world){
  world.tension = world.tension || {
    value: 0,
    sources: [] // { day, text, value, sourceNat, targetNat }
  };
}

/**
 * 增加世界紧张度
 */
export function addTension(world, amount, text, sourceNat = null, targetNat = null){
  initTension(world);
  const clampedAmt = Math.max(0, Math.min(100 - world.tension.value, amount));
  world.tension.value = Math.min(100, +(world.tension.value + clampedAmt).toFixed(1));
  world.tension.sources.unshift({
    day: world.day || 0,
    text,
    value: +clampedAmt.toFixed(1),
    sourceNat,
    targetNat
  });
  if(world.tension.sources.length > 50) world.tension.sources.pop();
  return world.tension.value;
}

/**
 * 每日衰减：无全局大战状态时每日 -0.1%
 */
export function tensionTick(world){
  initTension(world);
  // W5-1：制造借口进度 tick —— 此前 justifying 创建后全库无人消费（休眠链）
  for(const natId in (world.nations || {})){
    const n = world.nations[natId];
    if(!n || !n.alive || !n.justifying) continue;
    for(const j of n.justifying){
      if(j.done) continue;
      j.daysLeft -= 1;
      if(j.daysLeft <= 0){
        j.done = true;
        j.readyDay = world.day;
        world.events = world.events || [];
        world.events.push({
          type: 'justify_ready', day: world.day, important: false,
          text: `📜【借口就绪】${n.name} 对 ${world.nations[j.target]?.name || j.target} 的战争借口已准备完毕，可择机宣战。`
        });
      }
    }
  }
  // 检查是否全图和平
  let anyWar = false;
  for(const natId in (world.nations || {})){
    const n = world.nations[natId];
    if(n.atWarWith && n.atWarWith.length > 0){
      anyWar = true;
      break;
    }
  }

  if(!anyWar && world.tension.value > 0){
    world.tension.value = Math.max(0, +(world.tension.value - 0.1).toFixed(1));
  }
}

/**
 * W5-1/2 带目标宣战 与 W5-7 志愿军实体化 都实现在 diplomacy.js
 * （它们需要 world.js 的 spawnUnit；从本文件引 world 会把 scenarios.js
 *   拉进剧本事件子图的 ESM 链接环 events→tension→world→scenarios → TDZ）。
 * 调用方请直接从 './diplomacy.js' 导入 declareWarWithGoal / sendVolunteers。
 */

/**
 * W5-8：双边关系（world.relations，键为排序后的 'A|B'，值 −100~100）。
 * decisions.js 的 instant.relations 与改善关系行动都落到这里。
 */
export function getRelations(world, a, b){
  if(!world.relations || a === b) return 0;
  return world.relations[[a, b].sort().join('|')] || 0;
}

export function adjustRelations(world, a, b, delta){
  if(a === b) return;
  world.relations = world.relations || {};
  const key = [a, b].sort().join('|');
  world.relations[key] = Math.max(-100, Math.min(100, (world.relations[key] || 0) + delta));
}

/** W5-8：改善关系行动（25 PP → +25 关系，被制裁/交战状态下无效） */
export function improveRelations(world, fromNat, toNat){
  const n = world.nations[fromNat];
  const to = world.nations[toNat];
  if(!n || !to || fromNat === toNat) return { ok:false, reason:'国家不存在' };
  if(n.pp < 25) return { ok:false, reason:'政治点数不足（需 25）' };
  if((n.atWarWith || []).includes(toNat)) return { ok:false, reason:'交战国之间无法改善关系' };
  if(getRelations(world, fromNat, toNat) >= 100) return { ok:false, reason:'关系已至上限' };
  n.pp -= 25;
  adjustRelations(world, fromNat, toNat, +25);
  world.events = world.events || [];
  world.events.push({
    type: 'improve_relations', day: world.day, important: false,
    text: `🕊️ 外交 gestures：${n.name} 向 ${to.name} 派遣特使团，双边关系 +25。`
  });
  return { ok:true };
}

/**
 * 查询阵营/意识形态对特定行动的紧张度门槛
 */
export function canPerformTensionAction(world, natId, action){
  initTension(world);
  const n = world.nations[natId];
  if(!n) return false;

  const isDemo = ['FRA','GBR','USA','CAN','AST','F','B','U'].includes(natId);
  const isFascist = ['GER','ITA','JPN','G','I','J'].includes(natId);
  const isComm = ['SOV','CCP','PRK','S','C'].includes(natId);
  const ideology = n.ideology || (isFascist ? 'fascist' : isComm ? 'communist' : isDemo ? 'democratic' : 'neutral');
  const t = world.tension.value;

  switch(action){
    case 'justify': // 制造战争借口
      if(ideology === 'fascist' || ideology === 'communist') return true;
      if(ideology === 'democratic') return t >= 50; // [H] 民主国需 50%
      return t >= 25; // 中立国 25%

    case 'guarantee': // 保证独立
      if(ideology === 'democratic') return true; // [H] 民主国随时可保证独立
      if(ideology === 'neutral') return t >= 25;
      return t >= 40; // 法西斯 40%

    case 'join_faction': // 加入阵营
      if(ideology === 'fascist' || ideology === 'communist') return t >= 20;
      if(ideology === 'democratic') return t >= 40;
      return t >= 30;

    case 'total_mobilization': // 总动员法案
      if(ideology === 'fascist' || ideology === 'communist') return t >= 25;
      if(ideology === 'democratic') return t >= 70;
      return t >= 50;

    default:
      return true;
  }
}

/**
 * 制造战争借口
 */
export function startJustifyWar(world, sourceNat, targetNat){
  if(!canPerformTensionAction(world, sourceNat, 'justify')) return false;
  const n = world.nations[sourceNat];
  if(!n || n.pp < 50) return false;
  // v14.0 P3：民主主义不得对同为民主主义的国家无理由开战 [H]
  {
    const leg = warJustifyLegality(world, sourceNat, targetNat);
    if(!leg.allowed) return false;
  }

  n.pp -= 50;
  n.justifying = n.justifying || [];
  n.justifying.push({
    target: targetNat,
    daysLeft: 30,
    done: false
  });

  // 产生紧张度 1.5% ~ 3.0%
  const tAmt = ['FRA','GBR','SOV','USA','GER'].includes(targetNat) ? 3.0 : 1.5;
  addTension(world, tAmt, `${n.name} 对 ${world.nations[targetNat] ? world.nations[targetNat].name : targetNat} 制造战争借口`, sourceNat, targetNat);

  world.events = world.events || [];
  world.events.push({
    type: 'tension_justify',
    day: world.day,
    important: false,
    text: `⚠️ 外交警报：${n.name} 开始对【${world.nations[targetNat] ? world.nations[targetNat].name : targetNat}】制造战争借口！`
  });

  return true;
}

/**
 * 保证独立
 */
export function guaranteeIndependence(world, sourceNat, targetNat){
  if(!canPerformTensionAction(world, sourceNat, 'guarantee')) return false;
  const n = world.nations[sourceNat];
  const target = world.nations[targetNat];
  if(!n || !target || n.pp < 25) return false;

  n.pp -= 25;
  target.guaranteedBy = target.guaranteedBy || [];
  if(!target.guaranteedBy.includes(sourceNat)){
    target.guaranteedBy.push(sourceNat);
  }

  world.events = world.events || [];
  world.events.push({
    type: 'guarantee',
    day: world.day,
    important: true,
    text: `🛡️ 外交条约：${n.name} 正式向【${target.name}】提供独立安全保障！`
  });

  return true;
}

/**
 * 签署租借法案 (需紧张度 >= 50% 或 同盟国关系)
 */
export function sendLendLease(world, sourceNat, targetNat){
  initTension(world);
  const n = world.nations[sourceNat];
  const target = world.nations[targetNat];
  if(!n || !target) return false;
  const isAlly = (n.allies || []).includes(targetNat);
  if(world.tension.value < 50 && !isAlly) return false;
  if(n.pp < 20) return false;

  n.pp -= 20;
  n.lendLeaseTo = n.lendLeaseTo || [];
  if(!n.lendLeaseTo.includes(targetNat)) n.lendLeaseTo.push(targetNat);

  // 装备每月/每日持续支援
  target.equip = (target.equip || 0) + 150;
  n.equip = Math.max(0, (n.equip || 0) - 150);

  world.events = world.events || [];
  world.events.push({
    type: 'lend_lease',
    day: world.day,
    important: true,
    text: `🚢 租借军援：${n.name} 批准对【${target.name}】执行战时军备租借法案（首批交付 150 装备）！`
  });

  return true;
}

