/* ============================================================
   engine/focus.js —— 国策：70 天、仅 1 个、-1PP/天、效果解释器（v2.0 §3.6）
   ------------------------------------------------------------
   v11.0 接线：剧本国策树此前是**死代码**。
   四个副本各自手写了完整国策树（ww2 9 国 200 节点 / ww1 13 国 184 节点 /
   coldwar 3 国 36 节点 / modern 5 国 48 节点），但它们只挂在剧本对象的
   `focuses` 字段上，而本模块只读 data/focuses.js 的通用树 —— 于是
   · 剧本国策一个字都读不到（88KB 内容零生效）
   · 通用树只覆盖 G/P/F/S/B/H 六国，选中国/日本/美国/意大利时**一个国策都没有**
     （玩家感受就是「国策树过于单调简单」＋「很多地方玩不了」）

   现在改为注册制：
     registerScenarioFocuses(scenarioId, tree)  ← world.js 载入剧本时调用
     treeFor(world, natId)                      ← 剧本树优先，通用树兜底
   并做一次模式适配，让两套写法（requires/pre 与 x/y/chain）统一到同一形状。
   ============================================================ */

import { K } from '../data/constants.js';
import { FOCUSES } from '../data/focuses.js';
import { applyEffect } from './research.js';

/* scenarioId → { NAT: [已归一化的节点] } */
const SCENARIO_FOCUSES = {};

/* 备用分链名（UI 的国策树按链分列渲染） */
const CHAIN_ORDER = ['industry', 'army', 'air', 'navy', 'politics'];

/**
 * 归一化一棵剧本国策树
 * - pre → requires
 * - days 缺省用 K.FOCUS_DAYS
 * - 缺 chain/x/y 时按依赖深度自动排版（DAG 分层 + 分链）
 */
function normalizeTree(nodes){
  const byId = {};
  const list = nodes.map((raw) => {
    const f = {
      id: raw.id,
      name: raw.name || raw.id,
      days: raw.days || K.FOCUS_DAYS,
      requires: raw.requires || raw.pre || [],
      desc: raw.desc || '',
      effects: raw.effects || [],
      chain: raw.chain || null,
      x: raw.x,
      y: raw.y
    };
    byId[f.id] = f;
    return f;
  });

  // 依赖深度（防御：前置缺失或成环时不至于卡死）
  const depth = {};
  const walk = (f, seen) => {
    if(depth[f.id] !== undefined) return depth[f.id];
    if(seen.has(f.id)) return 0;
    seen.add(f.id);
    let d = 0;
    for(const r of f.requires){
      if(byId[r]) d = Math.max(d, walk(byId[r], seen) + 1);
    }
    depth[f.id] = d;
    return d;
  };
  for(const f of list) walk(f, new Set());

  const needLayout = list.some((f) => f.chain === null || f.y === undefined);
  if(needLayout){
    // 分链：根节点轮流占据各链，子节点默认继承父链；
    // 若该链在该深度已被占用，则顺延到下一个空链，避免同列堆叠。
    const roots = list.filter((f) => f.requires.filter((r) => byId[r]).length === 0);
    const chainCount = Math.max(1, Math.min(CHAIN_ORDER.length, roots.length || 1));
    const chainOf = {};
    roots.forEach((f, i) => { chainOf[f.id] = i % chainCount; });

    const ordered = [...list].sort((a, b) => depth[a.id] - depth[b.id]);
    const used = new Set();
    for(const f of ordered){
      let c = chainOf[f.id];
      if(c === undefined){
        const parent = f.requires.map((r) => byId[r]).find(Boolean);
        c = parent && chainOf[parent.id] !== undefined ? chainOf[parent.id] : 0;
      }
      // 同链同层冲突 → 顺延
      let guard = 0;
      while(used.has(c + '@' + depth[f.id]) && guard < CHAIN_ORDER.length){
        c = (c + 1) % chainCount;
        guard++;
      }
      used.add(c + '@' + depth[f.id]);
      chainOf[f.id] = c;
      f.chain = f.chain || CHAIN_ORDER[c] || 'industry';
      f.x = f.x !== undefined ? f.x : c;
      f.y = f.y !== undefined ? f.y : depth[f.id];
    }
  }
  return list;
}

/** 注册某剧本的国策树（world.js 载入剧本时调用） */
export function registerScenarioFocuses(scenarioId, tree){
  if(!scenarioId || !tree) return;
  const out = {};
  for(const natId in tree){
    if(!Array.isArray(tree[natId]) || !tree[natId].length) continue;
    out[natId] = normalizeTree(tree[natId]);
  }
  SCENARIO_FOCUSES[scenarioId] = out;
}

/** 取某国可用的国策表：剧本树优先，通用树兜底 */
export function focusesFor(world, natId){
  const sc = SCENARIO_FOCUSES[world && world.scenario];
  if(sc && sc[natId] && sc[natId].length) return sc[natId];
  return FOCUSES[natId] || [];
}

export function focusById(world, natId, id){
  return focusesFor(world, natId).find((f) => f.id === id) || null;
}

export function availableFocuses(world, natId){
  const n = world.nations[natId];
  if(!n) return [];
  return focusesFor(world, natId).filter((f) =>
    !n.focus.done.includes(f.id) &&
    f.requires.every((r) => n.focus.done.includes(r)));
}

export function pickFocus(world, natId, focusId){
  const n = world.nations[natId];
  if(!n || n.focus.active) return false;
  const f = focusById(world, natId, focusId);
  if(!f || !availableFocuses(world, natId).some((x) => x.id === focusId)) return false;
  n.focus.active = focusId;
  n.focus.progress = 0;
  return true;
}

export function focusTick(world){
  for(const id in world.nations){
    const n = world.nations[id];
    if(!n.alive || !n.focus.active) continue;
    const f = focusById(world, id, n.focus.active);
    if(!f){ n.focus.active = null; continue; }
    n.focus.progress++;
    n.pp = Math.max(0, n.pp - K.PP_FOCUS_COST);
    if(n.focus.progress >= f.days){
      world.events.push({ type:'focus', day:world.day, text:`${n.name}完成国策：${f.name}` });
      n.focus.done.push(f.id);
      n.focus.active = null;
      for(const eff of f.effects) applyEffect(world, id, eff);
    }
  }
}
