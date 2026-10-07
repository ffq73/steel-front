/* ============================================================
   engine/aiStrategy.js —— AI 战略层 (v14.0 P5 §6.1 Layer 1)
   HOI4 的 AI 之所以"像人"，在于它有战略意图而不是逐格反应：
     · 威胁评估：谁会打我、我该不该先下手
     · 目标选择：扩张弱邻 / 守土 / 反击主要敌人
     · 兵力配置：把部队编成集团军并分配到各条线
   本模块每 7 天评估一次，把结论写进 nation.ai.strategy 供战役层消费。
   ============================================================ */

import { K } from '../data/constants.js';
import { UNITS } from '../data/units.js';
import { hexDist } from '../core/geom.js';
import { getIdeology } from '../data/ideology.js';
import { getOrCreateArmy, findFrontierHexes, defaultArmyOf } from './plans.js';

/* ---------- 实力评估 ---------- */

/** 国家总军力（软攻+防御加权的粗略战力） */
export function nationPower(world, natId){
  let p = 0;
  for(const u of world.units){
    if(u.nat !== natId || u.hp <= 0) continue;
    const U = UNITS[u.type] || {};
    p += (U.soft || 5) + (U.def || 8) * 0.5;
  }
  return p;
}

/** 一格上的守军战力 */
export function hexGarrisonPower(world, hexIdx){
  const h = world.hexes[hexIdx];
  if(!h) return 0;
  let p = 0;
  for(const id of (h.units || [])){
    const u = world.units.find(x => x.id === id);
    if(!u || u.hp <= 0) continue;
    const U = UNITS[u.type] || {};
    p += (U.soft || 5) + (U.def || 8) * 0.5;
  }
  return p * (h.fort ? Math.pow(0.85, h.fort) : 1);
}

/* ---------- 威胁评估 ---------- */

/** 对某国的威胁来源评分（越高越危险） */
export function assessThreat(world, natId){
  const me = world.nations[natId];
  if(!me) return { score: 0, top: [] };
  const capHex = world.hexes.find(h => h.city && h.city.cap === natId);
  const threats = [];
  for(const other of (me.atWarWith || [])){
    const o = world.nations[other];
    if(!o || !o.alive || o.capitulated) continue;
    const power = nationPower(world, other);
    // 距离：敌方单位离我方首都/领土越近越危险
    let minDist = 99;
    const cap = capHex || world.hexes.find(h => h.owner === natId);
    for(const u of world.units){
      if(u.nat !== other || u.hp <= 0) continue;
      const d = cap ? Math.abs(u.q - cap.q) + Math.abs(u.r - cap.r) : 5;
      if(d < minDist) minDist = d;
    }
    const distScore = Math.max(0, 30 - minDist) * 1.2;      // 距离越近分越高
    const powerScore = power / 8;                              // 军力
    const aggro = getIdeology(o.ideology).aiAggression;        // 意识形态侵略性 [H]
    threats.push({ nat: other, score: (distScore + powerScore) * aggro, power, minDist });
  }
  threats.sort((a, b) => b.score - a.score);
  return { score: threats.reduce((s, t) => s + t.score, 0), top: threats.slice(0, 3) };
}

/* ---------- 战略选择 ---------- */

export const STRATEGIES = {
  expand_weak: {
    id: 'expand_weak', name: '扩张（打弱邻国）',
    desc: '优先消灭兵力最弱的交战国，滚雪球发展',
    targetRule: 'weakest_enemy'
  },
  defend: {
    id: 'defend', name: '防御（守土）',
    desc: '威胁过高时转入守势，加固防线并积蓄力量',
    targetRule: 'strongest_front'
  },
  counter_major: {
    id: 'counter_major', name: '反击（打主要敌人）',
    desc: '集中兵力打击威胁最大的对手（弱国难以战胜强国）',
    targetRule: 'biggest_threat'
  }
};

/** 选出下一个打击目标（国家代号或 null） */
export function chooseTarget(world, natId, strategy, threat){
  const me = world.nations[natId];
  if(!me || !me.atWarWith || !me.atWarWith.length) return null;
  const enemies = me.atWarWith.filter(id => {
    const o = world.nations[id];
    return o && o.alive && !o.capitulated;
  });
  if(!enemies.length) return null;
  const pwr = {};
  for(const id of enemies) pwr[id] = nationPower(world, id);

  switch(strategy){
    case 'expand_weak': {
      // 目标格数少、兵力弱 → 优先（占地盘效率）
      let best = null, bestScore = -Infinity;
      for(const id of enemies){
        const o = world.nations[id];
        let hexCount = 0;
        for(const h of world.hexes) if(h.owner === id) hexCount++;
        const score = -pwr[id] * 1.0 - hexCount * 3;   // 军力越弱越好、地越多越优先
        if(score > bestScore){ bestScore = score; best = id; }
      }
      return best;
    }
    case 'counter_major': {
      const t = threat && threat.top && threat.top[0];
      return t ? t.nat : enemies[0];
    }
    case 'defend':
    default: {
      // 防御：不主动扩张，目标是威胁最大的那条线
      const t = threat && threat.top && threat.top[0];
      return t ? t.nat : enemies[0];
    }
  }
}

/* ---------- 战役轴心（目标省份序列）---------- */

/** 沿 BFS 求从 fromHex 到目标区域的最近路径（返回省份 idx 序列） */
export function pathToTarget(world, natId, fromIdx, targetNat, maxLen = 8){
  const start = world.hexes[fromIdx];
  if(!start) return [];
  const prev = new Map();
  const q = [fromIdx];
  const seen = new Set([fromIdx]);
  let found = -1;
  while(q.length){
    const cur = q.shift();
    const h = world.hexes[cur];
    if(h.owner === targetNat){ found = cur; break; }
    if(prev.size > 600) break;            // 搜索上限，避免大地图卡顿
    for(const ni of (h.adj || [])){
      if(seen.has(ni)) continue;
      seen.add(ni);
      prev.set(ni, cur);
      q.push(ni);
    }
  }
  if(found < 0) return [];
  const path = [];
  let cur = found;
  while(cur !== fromIdx && path.length < maxLen){
    path.push(cur);
    cur = prev.get(cur);
    if(cur === undefined) break;
  }
  return path.reverse();
}

/* ---------- 兵种构成与克制 ---------- */

/** 敌军的兵种构成（用于 AI 针对性生产/研究） */
export function enemyComposition(world, natId){
  const me = world.nations[natId];
  const comp = { armor: 0, infantry: 0, total: 0 };
  const enemies = new Set(me && me.atWarWith ? me.atWarWith : []);
  for(const u of world.units){
    if(!enemies.has(u.nat) || u.hp <= 0) continue;
    comp.total++;
    if(u.type === 'arm' || u.type === 'larm') comp.armor++;
    else comp.infantry++;
  }
  return { ...comp, armorPct: comp.total ? comp.armor / comp.total : 0 };
}

/** AI 应该优先研发/生产的方向（兵种克制） */
export function counterPriority(world, natId){
  const comp = enemyComposition(world, natId);
  if(comp.armorPct > 0.30) return { focus: 'anti_tank', reason: '敌军装甲占比 ' + Math.round(comp.armorPct * 100) + '% → 反坦克' };
  if(comp.infantry > comp.armor * 3) return { focus: 'artillery', reason: '敌军以步兵为主 → 火力压制' };
  return { focus: 'balanced', reason: '敌我构成均衡' };
}

/* ---------- 战略评估主入口（每 7 天）---------- */

export function strategyTick(world, rng, natId){
  const n = world.nations[natId];
  if(!n || !n.alive || n.capitulated) return null;
  n.ai = n.ai || {};
  n.ai.strategy = n.ai.strategy || {};
  const S = n.ai.strategy;

  // 1) 威胁评估
  const threat = assessThreat(world, natId);
  S.threat = { score: +threat.score.toFixed(1), top: threat.top.map(t => t.nat) };

  // 2) 战略选择：威胁过高 → 防御；敌我对比 → 扩张或反击
  const myPower = nationPower(world, natId);
  const threatPower = threat.top.reduce((s, t) => s + t.power, 0);
  const level = aiLevelOf(world, natId);
  // 弱 AI（低等级）更容易见风使舵；强 AI 更倾向坚持既定战略
  const caution = (threatPower > myPower * 1.4) ? (1 - (level - 1) / 12) : 0;
  const strat = (threatPower > myPower * 1.6 && caution > 0.5) ? 'defend'
    : (myPower > threatPower * 1.5 ? 'expand_weak' : 'counter_major');
  // 战略切换冷却：没有冷却时，威胁分数的日常波动会让 AI 每 5~7 天就换一次战略
  // （实测一局切换 60+ 次），表现为"朝令夕改"。最短持续 21 天。
  const MIN_HOLD = 21;
  const held = world.day - (S.sinceDay == null ? world.day : S.sinceDay);
  if(S.type !== strat && held >= MIN_HOLD){
    S.type = strat;
    S.sinceDay = world.day;
  } else if(S.type == null){
    S.type = strat;
    S.sinceDay = world.day;
  }
  S.name = STRATEGIES[strat].name;

  // 3) 目标选择
  const target = chooseTarget(world, natId, strat, threat);
  S.target = target;
  S.targetName = target ? (world.nations[target] ? world.nations[target].name : target) : null;

  // 4) 兵种克制建议
  S.counter = counterPriority(world, natId);

  // 5) 战役轴心：为每支集团军算出通往目标的省份序列
  S.axes = buildAxes(world, natId, target);

  return S;
}

/** AI 强度等级（1-10），默认 5 */
export function aiLevelOf(world, natId){
  const n = world.nations[natId];
  if(n && n.ai && n.ai.level) return n.ai.level;
  const d = K.DIFFICULTIES[world.difficulty] || K.DIFFICULTIES.general;
  return d.aiLevel || 5;
}

/** 为该国所有集团军构建进攻轴（目标省份序列） */
function buildAxes(world, natId, targetNat){
  const axes = [];
  if(!targetNat) return axes;
  const armies = (world.armies || []).filter(a => a.nat === natId);
  const list = armies.length ? armies : [{ id: natId + '_default', nat: natId }];
  for(const army of list){
    const units = world.units.filter(u => u.nat === natId && u.hp > 0 &&
      (!army.id || !u.armyId || u.armyId === army.id));
    if(!units.length) continue;
    const anchor = units[0];
    const fromIdx = world.hexes.findIndex(h => h.q === anchor.q && h.r === anchor.r);
    if(fromIdx < 0) continue;
    const path = pathToTarget(world, natId, fromIdx, targetNat);
    if(path.length) axes.push({ armyId: army.id, path, target: targetNat });
  }
  return axes;
}
