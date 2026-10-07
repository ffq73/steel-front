/* ============================================================
   tests/peace_conference.test.js —— W5 外交 · 战争目标 · 和会竞价验收测试
   ============================================================ */

import assert from 'node:assert/strict';
import { declareWar } from '../js/engine/diplomacy.js';
import {
  buildPeaceConference, applyPeaceAction, closePeaceConference,
  aiBiddingConference, aiAutoPeace, PEACE_ACTIONS
} from '../js/engine/peace.js';

let passed = 0, failed = 0;
function t(name, fn){
  try{ fn(); passed++; console.log('✓', name); }
  catch(e){ failed++; console.log('✗', name, '→', e.message); }
}

t('W5-1 宣战绑定战争目标并在 world.activeWargoals 登记', () => {
  const w = {
    day: 10, events: [],
    nations: {
      G: { name: '德国', atWarWith: [] },
      P: { name: '波兰', atWarWith: [] }
    }
  };
  const ok = declareWar(w, 'G', 'P', 'capture:华沙');
  assert.equal(ok, true);
  assert.ok(w.nations.G.atWarWith.includes('P'));
  assert.ok(w.nations.P.atWarWith.includes('G'));
  assert.equal(w.activeWargoals.length, 1);
  assert.equal(w.activeWargoals[0].from, 'G');
  assert.equal(w.activeWargoals[0].to, 'P');
  assert.equal(w.activeWargoals[0].goal.type, 'capture');
  assert.equal(w.activeWargoals[0].goal.arg, '华沙');
});

t('W5-2 战争目标达成享受和会点数 50% 折扣', () => {
  const hexTarget = { q:1, r:1, _orig:'P', owner:'P', city:{ name:'华沙', w:2 } };
  const w = {
    day: 50, events: [],
    at: { '1,1': hexTarget },
    hexes: [hexTarget],
    activeWargoals: [
      { from: 'G', to: 'P', goal: { type: 'capture', arg: '华沙' } }
    ],
    nations: {
      G: { name: '德国', alive: true, atWarWith: ['P'] },
      P: { name: '波兰', alive: false, atWarWith: ['G'] }
    }
  };
  const conf = {
    loser: 'P', winners: ['G'],
    points: { G: 100 },
    actions: {}, resolved: false
  };
  w.pendingPeace = conf;

  // 常规 costBase: 20 + city.w(2)*costVP(5) = 30; 目标命中打 5 折 = 15
  const res = applyPeaceAction(w, 'G', 'takeState', { q: 1, r: 1 });
  assert.equal(res.ok, true);
  assert.equal(res.cost, 15);
  assert.equal(hexTarget.owner, 'G');
});

t('W5-3 解放国家 (liberate) 条款使被吞并国复国并恢复固有领土', () => {
  const h1 = { q:0, r:0, _orig:'P', owner:'G' };
  const h2 = { q:0, r:1, _orig:'P', owner:'G' };
  const w = {
    day: 100, events: [],
    hexes: [h1, h2],
    at: { '0,0': h1, '0,1': h2 },
    nations: {
      B: { name: '英国', alive: true, atWarWith: ['G'], ideology: 'democracy' },
      G: { name: '德国', alive: false, atWarWith: ['B'] },
      P: { name: '波兰', alive: false, capitulated: true, puppetOf: 'G' }
    }
  };
  const conf = {
    loser: 'G', winners: ['B'],
    points: { B: 100 },
    actions: {}, resolved: false
  };
  w.pendingPeace = conf;

  const res = applyPeaceAction(w, 'B', 'liberate', { targetNat: 'P' });
  assert.equal(res.ok, true);
  assert.equal(w.nations.P.alive, true);
  assert.equal(w.nations.P.capitulated, false);
  assert.equal(w.nations.P.puppetOf, null);
  assert.equal(h1.owner, 'P');
  assert.equal(h2.owner, 'P');
});

t('W5-4 索取工厂 (demandFactories) 条款转让民工与军工厂', () => {
  const w = {
    day: 100, events: [],
    hexes: [], at: {},
    nations: {
      B: { name: '英国', alive: true, atWarWith: ['G'], civ: 10, mil: 10 },
      G: { name: '德国', alive: false, atWarWith: ['B'], civ: 5, mil: 8 }
    }
  };
  const conf = {
    loser: 'G', winners: ['B'],
    points: { B: 100 },
    actions: {}, resolved: false
  };
  w.pendingPeace = conf;

  const res = applyPeaceAction(w, 'B', 'demandFactories', { civ: 1, mil: 2 });
  assert.equal(res.ok, true);
  assert.equal(w.nations.G.civ, 4);
  assert.equal(w.nations.G.mil, 6);
  assert.equal(w.nations.B.civ, 11);
  assert.equal(w.nations.B.mil, 12);
});

t('W5-5 多战胜国轮流竞价划分领土，非单一独吞', () => {
  const h1 = { q:1, r:0, _orig:'G', owner:'G' };
  const h2 = { q:2, r:0, _orig:'G', owner:'G' };
  const h3 = { q:3, r:0, _orig:'G', owner:'G' };
  const w = {
    day: 120, events: [],
    hexes: [h1, h2, h3],
    at: { '1,0': h1, '2,0': h2, '3,0': h3 },
    units: [],
    warStats: {
      USA: { G: 10 },
      SOV: { G: 15 }
    },
    nations: {
      USA: { name: '美国', alive: true, atWarWith: ['G'], civ: 20, mil: 20 },
      SOV: { name: '苏联', alive: true, atWarWith: ['G'], civ: 15, mil: 15 },
      G:   { name: '德国', alive: false, capitulated: true, atWarWith: ['USA', 'SOV'], civ: 6, mil: 6 }
    }
  };

  const conf = buildPeaceConference(w, 'G');
  assert.ok(conf.winners.includes('USA'));
  assert.ok(conf.winners.includes('SOV'));

  aiBiddingConference(w, conf);

  // 双方均有行动且领土不会全归其中一家
  const usaActions = conf.actions.USA || [];
  const sovActions = conf.actions.SOV || [];
  assert.ok(usaActions.length > 0, 'USA 应获得条款');
  assert.ok(sovActions.length > 0, 'SOV 应获得条款');
  assert.equal(conf.resolved, true);
});

console.log(`\n===== peace_conference.test.js 结果: ${passed} 通过, ${failed} 失败 =====`);
process.exit(failed === 0 ? 0 : 1);
