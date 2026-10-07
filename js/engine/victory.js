/* ============================================================
   engine/victory.js —— 胜利点 / 投降度 / 剧本判定（v2.0 §3.10）
   v7.0：投降触发战后和会（玩家为战胜方时弹出谈判桌，否则 AI 自动瓜分）
   v14.1 E6：剧本目标统一解释 —— scenario.objectives 是唯一胜负数据源
   （js/data/wargoals.js 登记目标类型），A/ww1/ww2 的硬编码分支全部删除；
   coldwar/modern 首次拥有胜利代码路径；timeLimit 首次接入超时结算。
   ============================================================ */

import { K } from '../data/constants.js';
import { buildPeaceConference, aiAutoPeace } from './peace.js';
import { parseObjective } from '../data/wargoals.js';

/* 国家总 VP = 格数 ×1 + Σ(城市 VP ×10)（按 _orig 原始归属计） */
export function nationalVP(world, natId){
  let vp = 0;
  for(const h of world.hexes){
    if(h._orig !== natId) continue;
    vp += K.VP_PROVINCE;
    if(h.city) vp += h.city.w * K.VP_CITY_MULT;
  }
  return vp;
}
export function lostVP(world, natId){
  let lost = 0, total = 0, capLost = false;
  for(const h of world.hexes){
    if(h._orig !== natId) continue;
    let v = K.VP_PROVINCE;
    if(h.city) v += h.city.w * K.VP_CITY_MULT;
    total += v;
    if(h.owner !== natId){ lost += v; if(h.city && h.city.cap) capLost = true; }
  }
  return { lost, total, ratio: total>0 ? lost/total : 0, capLost };
}
export function surrenderLimit(nation){
  return K.SURRENDER_BASE + K.SURRENDER_WS * (nation.warSupport / 100);
}

/* v12.1 修复：首都陷落 ≠ 战争终局。
   此前"柏林≠GER 即协约国大胜"这类判定，会被敌军趁首都卫戍空虚一路
   "无人占领"直捣空城（RUS 试玩 12 天即终局）草率结束整场大战。
   现在首都目标达成还须目标国已投降或 VP 损失过半，才承认终局。 */
function capitalDown(world, tag){
  const n = world.nations[tag];
  if(!n || !n.alive) return true;          // 国已灭亡/不在场 → 视为达成
  if(n.capitulated) return true;
  const st = lostVP(world, tag);
  return st.ratio >= 0.5;
}

/* ============================================================
   v14.1 E6：剧本目标统一解释器
   ------------------------------------------------------------
   evaluateObjective 判定单条目标；wargoals.js 登记类型语义。
   胜负裁决（evaluateScenarioObjectives）：
     1. 任一目标国达成其全部目标 → 终局（玩家在该国则胜，否则败）
     2. 玩家国家在目标清单内且已投降 → 战败
     3. 超时（world.timeLimit 首次接入）：玩家目标达成率 ≥ 50% 判胜；
        无目标的小国生存到时限即胜
   与旧硬编码分支的口径差异（均为有意变更，详见交付报告）：
     - 旧 A「占华沙即胜 / 波兰坚守 120 天」→ 数据口径：G 需华沙 + 原主屈服，
       P survive:60；超时 120 天按达成率结算
     - 旧 ww1 德国「巴黎或圣彼得堡任一」→ 改为全部目标达成（AND）
     - 旧超时「win=!isCentral / win=!isGer」→ 改为按目标达成率结算
   ============================================================ */
export function evaluateObjective(world, natId, objStr){
  const g = parseObjective(objStr);
  const n = world.nations[natId];
  if(!g.known || !n) return { achieved:false, g };
  switch(g.type){
    case 'capture': {
      const h = world.hexes.find(x => x.city && x.city.name === g.arg);
      if(!h) return { achieved:false, g };
      if(h.owner !== natId) return { achieved:false, g };
      // 目标城须被「真正打下来」：原主已投降或 VP 损失过半（capitalDown 口径）
      return { achieved: capitalDown(world, h._orig), g };
    }
    case 'survive':
      return { achieved: world.day >= g.arg && n.alive && !n.capitulated, g };
    case 'prestige':
      return { achieved: (n.prestige || 0) >= g.arg, g };
    case 'influence_lead': {
      const es = world.econSocial && world.econSocial.nations;
      if(!es || !es[natId]) return { achieved:false, g };
      const tags = Object.keys(es);
      if(!tags.length) return { achieved:false, g };
      const myBloc = es[natId].bloc || 'neutral';
      const aligned = tags.filter(t => (es[t].bloc || 'neutral') === myBloc).length;
      return { achieved: aligned / tags.length >= g.arg / 100, g };
    }
    case 'ceasefire':
      return { achieved: !!(world.milAid && world.milAid.ceasefireReady), g };
    case 'redline':
      // escalationGauge 只增不减，当前 <100 ⇔ 全程未爆
      return { achieved: !!(world.milAid && (world.milAid.escalationGauge ?? 0) < 100), g };
    default:
      return { achieved:false, g };
  }
}

function evaluateScenarioObjectives(world, objectives){
  const pTag = world.player;
  const pn = world.nations[pTag];

  // 1) 目标国全部达成 → 终局
  for(const natId of Object.keys(objectives)){
    const n = world.nations[natId];
    if(!n || !n.alive || n.capitulated) continue;
    const results = (objectives[natId] || []).map(o => evaluateObjective(world, natId, o));
    if(results.length && results.every(r => r.achieved)){
      const names = results.map(r => r.g.name).join('、');
      world.over = {
        win: natId === pTag,
        text: natId === pTag
          ? `剧本目标全部达成（${names}）！第 ${world.day} 天，胜利属于你。`
          : `${n.name}已达成其全部剧本目标（${names}），战局就此终结。`
      };
      return;
    }
  }

  // 2) 玩家国家在目标清单内且已投降 → 战败
  if(pn && pn.capitulated && objectives[pTag]){
    world.over = { win:false, text:`${pn.name}已投降，剧本目标全部落空。` };
    return;
  }

  // 3) 超时结算（timeLimit 接入：coldwar 300 / modern 120 / ww1 200 / ww2 500）
  if(world.timeLimit && world.day >= world.timeLimit){
    const myGoals = objectives[pTag];
    if(myGoals && myGoals.length){
      const results = myGoals.map(o => evaluateObjective(world, pTag, o));
      const done = results.filter(r => r.achieved).length;
      const ratio = done / results.length;
      world.over = {
        win: ratio >= 0.5,
        text: `时限已到（${world.timeLimit} 天）。剧本目标达成 ${done}/${results.length}，判定${ratio >= 0.5 ? '胜利' : '失败'}。`
      };
    } else if(pn && !pn.capitulated){
      world.over = { win:true, text:`时限已到（${world.timeLimit} 天）。${pn.name}存续至终局，判定胜利。` };
    } else {
      world.over = { win:false, text:`时限已到（${world.timeLimit} 天）。` };
    }
  }
}

export function victoryTick(world){
  if(world.over) return;
  for(const id in world.nations){
    const n = world.nations[id];
    if(!n.alive || n.capitulated) continue;
    const st = lostVP(world, id);
    if(st.total === 0) continue;
    if((st.capLost && st.ratio >= surrenderLimit(n) - 0.001) || st.ratio >= 0.9){
      capitulate(world, id);
    }
  }

  // v14.1 E6：剧本目标统一判定（A/ww1/ww2/coldwar/modern 全部走这里；
  // A 教程剧本的 objectives 同样来自数据：G capture:华沙 / P survive:60）
  if(world.objectives && Object.keys(world.objectives).length){
    evaluateScenarioObjectives(world, world.objectives);
  }
}

function capitulate(world, id){
  const n = world.nations[id];
  n.capitulated = true; n.alive = false;
  const loot = Math.floor(n.equip * K.CAPTURE_LOOT);
  W_removeAll(world, id);

  // v7.0 战后和会：玩家为战胜方 → 弹出谈判桌暂停推演；否则 AI 阵营自动瓜分（兼容旧行为）
  const conf = buildPeaceConference(world, id);
  const playerWins = conf && world.player && conf.winners.includes(world.player);
  if(playerWins){
    const occupier = conf.winners[0];
    if(world.nations[occupier]) world.nations[occupier].equip += loot;
    world.pendingPeace = conf;
    world.speed = 0;
    world.events.push({ type:'peace_open', day:world.day,
      text:`🏛️ ${n.name}无条件投降！战后和会召开，战胜国分列谈判桌。`, important:true });
    return;
  }
  aiAutoPeace(world, id);
  const occupier = (n.atWarWith || [])[0];
  if(world.nations[occupier]) world.nations[occupier].equip += loot;
}
function W_removeAll(world, id){
  for(const u of [...world.units]){
    if(u.nat === id){
      const h = world.at[u.q+','+u.r];
      const i = h.units.indexOf(u.id);
      if(i>=0) h.units.splice(i,1);
      world.units.splice(world.units.indexOf(u),1);
    }
  }
}
