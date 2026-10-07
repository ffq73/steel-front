/* ============================================================
   tools/playtest.mjs —— 四副本×全可玩国家 headless 玩家试玩台
   按玩家真实路径操作（store.dispatch 下单/部署 + pickFocus + startResearch），
   每天校验世界不变量，捕捉任何异常。用于发版前捉虫。
   运行：node tools/playtest.mjs [天数]   （默认 150）
   ============================================================ */
import { loadScenario } from '../js/engine/world.js';
import { dayTick } from '../js/engine/tick.js';
import { makeRng } from '../js/core/rng.js';
import { createStore } from '../js/core/store.js';
import { availableFocuses, pickFocus } from '../js/engine/focus.js';
import { startResearch } from '../js/engine/research.js';
import { TECHS } from '../js/data/techs.js';
import { pickOffensiveTarget } from '../js/engine/plans.js';

const DAYS = parseInt(process.argv[2] || '150', 10);

const PLAYABLE = {
  ww1: ['GER', 'FRA', 'GBR', 'RUS', 'AUS', 'OTT', 'ITA'],
  ww2: ['GER', 'SOV', 'GBR', 'FRA', 'USA', 'JPN', 'ITA', 'POL', 'CHN'],
  coldwar: ['USA', 'SOV', 'GBR', 'FRA', 'CHN'],
  modern: ['RUS', 'UKR', 'USA', 'GBR', 'FRA', 'GER', 'POL', 'JPN', 'IRN', 'ISR']
};

/* ---------- 不变量检查（收违规清单，不中断） ---------- */
function checkInvariants(w, bad, day){
  const at = w.at || {};
  for(const u of w.units){
    if(!at[u.q + ',' + u.r]){
      bad.push(`d${day} 单位${u.id}(${u.nat}) 站在不存在的格 (${u.q},${u.r})`);
      continue;
    }
    const h = at[u.q + ',' + u.r];
    if(!h.units.includes(u.id)) bad.push(`d${day} 格(${u.q},${u.r}).units 缺单位${u.id}`);
  }
  for(const h of w.hexes){
    for(const uid of h.units){
      const u = w.units.find(x => x.id === uid);
      if(!u){ bad.push(`d${day} 格(${h.q},${h.r}) 悬空单位id ${uid}`); continue; }
      if(u.q !== h.q || u.r !== h.r) bad.push(`d${day} 单位${u.id} 坐标(${u.q},${u.r})≠驻留格(${h.q},${h.r})`);
    }
    if(h.city && (!Number.isFinite(h.mil) || !Number.isFinite(h.civ)))
      bad.push(`d${day} 城市${h.city.name} 工厂数值非有限数`);
  }
  for(const id in w.nations){
    const n = w.nations[id];
    for(const k of ['pp', 'equip', 'stability', 'warSupport', 'mil', 'civ']){
      if(n[k] !== undefined && !Number.isFinite(n[k])) bad.push(`d${day} ${id}.${k} 非有限数: ${n[k]}`);
    }
    const wars = new Set(n.atWarWith || []);
    if(wars.has(id)) bad.push(`d${day} ${id} 与自己开战`);
    if(wars.size !== (n.atWarWith || []).length) bad.push(`d${day} ${id}.atWarWith 有重复`);
    for(const e of wars){
      const en = w.nations[e];
      if(!en){ bad.push(`d${day} ${id} 与不存在的国家 ${e} 开战`); continue; }
      if(!en.atWarWith.includes(id)) bad.push(`d${day} ${id}↔${e} 战争关系不对称`);
    }
  }
}

/* ---------- 单局试玩 ---------- */
function playOne(sc, tag, seed){
  const w = loadScenario(sc, seed);
  if(!w.nations[tag]){ return { ok: false, errors: [`国家 ${tag} 不存在于剧本`], bad: [], days: 0 }; }
  w.player = tag;
  const store = createStore(w);
  const rng = makeRng(seed ^ 0x9e3779b9);
  const errors = [];
  const bad = [];
  let day = 0;

  for(day = 0; day < DAYS && !w.over; day++){
    try {
      const n = w.nations[tag];
      if(!n.alive) break;

      // 1. 国策：空闲就点第一个可用的
      if(!n.focus.active){
        const av = availableFocuses(w, tag);
        if(av.length) pickFocus(w, tag, av[0].id);
      }
      // 2. 科研：填满空槽
      if(n.research && n.research.slots){
        for(let i = 0; i < n.research.slots.length; i++){
          if(n.research.slots[i] === null){
            for(const t of TECHS){ if(startResearch(w, tag, t.id)) break; }
          }
        }
      }
      // 3. 部署：有兵员就往最空的己方城市放
      if(n.pool && n.pool.length){
        const cities = w.hexes.filter(h => h.owner === tag && h.city)
          .sort((a, b) => a.units.length - b.units.length);
        if(cities.length) store.dispatch({ type: 'DEPLOY', q: cities[0].q, r: cities[0].r });
      }
      // 4. 下单：邻格有敌 → 进攻；否则向最近敌城推进（每拍最多 6 个无令师）
      let ordered = 0;
      for(const u of w.units){
        if(ordered >= 6) break;
        if(u.nat !== tag || u.hp <= 0 || u.order || u.inPlan) continue;
        const here = at(w, u.q, u.r);
        const enemyAdj = here.adj.map(i => w.hexes[i])
          .find(x => x.terrain !== 'sea' && x.owner !== tag && x.owner !== 'N' &&
                     w.nations[tag].atWarWith.includes(x.owner));
        if(enemyAdj){ store.dispatch({ type: 'ATTACK', unitId: u.id, q: enemyAdj.q, r: enemyAdj.r }); ordered++; continue; }
        if(w.nations[tag].atWarWith.length){
          const tgt = pickOffensiveTarget(w, 'offensive');
          if(tgt && tgt.target){ store.dispatch({ type: 'ADVANCE', unitId: u.id, q: tgt.target.q, r: tgt.target.r }); ordered++; }
        }
      }
      // 5. 每 30 天也过一遍 X 键同款自动选靶（仅验证不抛异常）
      if(day % 30 === 0) pickOffensiveTarget(w, 'spearhead');
    } catch(e){
      errors.push(`d${day} [行动] ${e.message} @ ${(e.stack || '').split('\n')[1] || '?'}`);
      break;
    }
    try {
      dayTick(w, rng);
    } catch(e){
      errors.push(`d${day} [dayTick] ${e.message} @ ${(e.stack || '').split('\n')[1] || '?'}`);
      break;
    }
    checkInvariants(w, bad, day);
  }

  // 违规去重计数
  const uniq = [...new Set(bad)];
  return {
    ok: errors.length === 0 && uniq.length === 0,
    days: day, over: !!w.over,
    overText: w.over ? JSON.stringify(w.over).slice(0, 80) : '',
    errors, bad: uniq
  };
}

function at(w, q, r){ return w.at[q + ',' + r]; }

/* ---------- 主流程 ---------- */
let totalBad = 0;
for(const sc in PLAYABLE){
  for(const tag of PLAYABLE[sc]){
    const seed = 424242 + tag.split('').reduce((a, c) => a * 131 + c.charCodeAt(0), 7) % 100000;
    const r = playOne(sc, tag, seed);
    const head = `${sc}/${tag}`.padEnd(14);
    if(r.ok){
      console.log(`✓ ${head} ${r.days}天 ${r.over ? '终局:' + r.overText : '存活'}`);
    } else {
      totalBad++;
      console.log(`✗ ${head} ${r.days}天`);
      for(const e of r.errors.slice(0, 3)) console.log('    异常:', e);
      for(const b of r.bad.slice(0, 5)) console.log('    违规:', b);
      if(r.bad.length > 5) console.log(`    …另有 ${r.bad.length - 5} 条同类违规`);
    }
  }
}
console.log(totalBad === 0 ? '\n全部通过' : `\n${totalBad} 局有问题`);
process.exit(totalBad ? 1 : 0);
