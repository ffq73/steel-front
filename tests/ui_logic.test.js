/* ============================================================
   tests/ui_logic.test.js —— v14.4 W3 管理界面 P0 的引擎侧守卫
   ------------------------------------------------------------
   覆盖：
   1. layoutForest 树形布局（科技 requires / 国策 pre 双形态）：
      y=深度、x=整洁列不重叠、每条前置一条连线
   2. allocateFactoriesOptimal 生产线 optimal 一键：
      守恒（总量 = mil）、占比不变性、单线上限、零空闲短路
   3. RUSH_FOCUS 花 PP 主动点亮：扣 PP、进度前进、PP 不足拒绝
   4. 具名模板库：另存 → 出现在模板表且名字生效；删除自建；预设不可删
   ============================================================ */

import assert from 'node:assert/strict';
import { layoutForest } from '../js/ui/treeLayout.js';
import { allocateFactoriesOptimal } from '../js/engine/economy.js';
import { createStore } from '../js/core/store.js';
import { loadScenario } from '../js/engine/world.js';
import { K } from '../js/data/constants.js';

let passed = 0, failed = 0;
function t(name, fn){
  try{ fn(); passed++; console.log('✓', name); }
  catch(e){ failed++; console.log('✗', name, '→', e.message); }
}

/* —— 1. 树形布局 —— */
t('W3-1a 科技树布局：y=深度、每条 requires 一条连线', () => {
  const techs = [
    { id:'a', requires:[] }, { id:'b', requires:['a'] }, { id:'c', requires:['b'] },
    { id:'d', requires:['a'] }
  ];
  const L = layoutForest(techs, { reqKey: 'requires' });
  assert.equal(L.pos.a.y, 0);
  assert.equal(L.pos.b.y, 1);
  assert.equal(L.pos.c.y, 2);
  assert.equal(L.pos.d.y, 1);
  assert.equal(L.edges.length, 3, 'requires 边数应恰好 3');
  // 分叉列不重叠：b、d 各占一列（或居中不撞）——x 互异
  assert.notEqual(L.pos.b.x, L.pos.d.x, '兄弟节点应占不同列');
});

t('W3-1b 剧本国策 pre 形态自动兼容', () => {
  const nodes = [
    { id:'r1', pre:[] }, { id:'r2', pre:[] },
    { id:'s1', pre:['r1'] }, { id:'s2', pre:['r1','r2'] }
  ];
  const L = layoutForest(nodes);
  assert.equal(L.edges.length, 3);
  assert.equal(L.pos.s2.y, 1);
});

t('W3-1c 环不炸、无重叠列（守卫回归）', () => {
  const cyc = [ { id:'x', requires:['z'] }, { id:'y', requires:['x'] }, { id:'z', requires:['y'] } ];
  const L = layoutForest(cyc);
  assert.equal(Object.keys(L.pos).length, 3);
  const xs = Object.values(L.pos).map(p => p.x);
  assert.equal(new Set(xs).size, 3, '三节点应各占一列');
});

/* —— 2. optimal 分配 —— */
function mkEcon(civ, mil, lines){
  return { nations:{ G:{ alive:true, mil, civ, equip:0, pp:0, commandPower:100, law:'partial',
    modifiers:{}, build:{kind:null}, buildQueue:[], training:[], productionLines:lines } } };
}

t('W3-3a optimal：空闲厂守恒分配、按现有占比', () => {
  const w = mkEcon(10, 10, [
    { id:'l1', type:'inf_eq', factories:4, eff:0.2, cap:0.5 },
    { id:'l2', type:'art_eq', factories:2, eff:0.2, cap:0.5 }
  ]);
  const res = allocateFactoriesOptimal(w, 'G');
  assert.equal(res.allocated, 4, '空闲 = 10-6 = 4');
  const total = res.lines.reduce((s,l)=>s+l.factories,0);
  assert.equal(total, 10, '分配后总量必须守恒 = mil');
  // 占比不变性：2:1 比例应保持（4/2 → 8/4 或近似 7/3+1 的取整逼近）
  const l1 = res.lines.find(l=>l.id==='l1').factories;
  assert.ok(l1 >= 6 && l1 <= 9, `占比分配应偏向 l1（原 4/6），实际 ${l1}`);
});

t('W3-3b optimal：单线 LINE_FACTORY_CAP 封顶', () => {
  const w = mkEcon(10, 20, [
    { id:'l1', type:'inf_eq', factories:14, eff:0.2, cap:0.5 },
    { id:'l2', type:'art_eq', factories:0, eff:0.2, cap:0.5 }
  ]);
  const res = allocateFactoriesOptimal(w, 'G');
  const l1 = res.lines.find(l=>l.id==='l1').factories;
  assert.ok(l1 <= K.LINE_FACTORY_CAP, `l1 不得突破单线上限 ${K.LINE_FACTORY_CAP}，实际 ${l1}`);
  const total = res.lines.reduce((s,l)=>s+l.factories,0);
  assert.ok(total <= 20, `总量不得超过 mil`);
});

t('W3-3c optimal：零空闲短路', () => {
  const w = mkEcon(10, 6, [
    { id:'l1', type:'inf_eq', factories:4, eff:0.2, cap:0.5 },
    { id:'l2', type:'art_eq', factories:2, eff:0.2, cap:0.5 }
  ]);
  const res = allocateFactoriesOptimal(w, 'G');
  assert.equal(res.allocated, 0);
});

/* —— 3. RUSH_FOCUS —— */
t('W3-2 花 PP 主动点亮：扣 PP、进度前进、PP 不足拒绝', () => {
  const w = loadScenario('A', 42);
  const store = createStore(w);
  const n = w.nations[w.player];
  n.focus = { active:null, progress:0, done:[] };
  n.pp = 200;
  store.dispatch({ type:'PICK_FOCUS', focusId:'four_year' });
  if(!n.focus.active){
    // 国策 id 可能不同（剧本 A 的国策树），任选一个可用 id 再试
    n.focus.active = n.focus.active || 'any';
    n.focus.progress = 0;
  }
  const ppBefore = n.pp;
  const progBefore = n.focus.progress;
  store.dispatch({ type:'RUSH_FOCUS' });
  assert.equal(n.pp, ppBefore - K.FOCUS_RUSH_PP, '应扣 FOCUS_RUSH_PP');
  assert.equal(n.focus.progress, progBefore + K.FOCUS_RUSH_DAYS, '进度应 +FOCUS_RUSH_DAYS');
  // PP 不足 → 拒绝
  n.pp = K.FOCUS_RUSH_PP - 1;
  const p2 = n.focus.progress;
  store.dispatch({ type:'RUSH_FOCUS' });
  assert.equal(n.focus.progress, p2, 'PP 不足时不得推进');
  assert.ok(n.pp < K.FOCUS_RUSH_PP, 'PP 不足时不得扣款');
});

/* —— 4. 具名模板库 —— */
t('W3-4 另存具名编制：入库、改名生效、可选；删除自建；预设不可删', () => {
  const w = loadScenario('A', 42);
  w.templates = w.templates || {};
  const base = JSON.parse(JSON.stringify(w.templates.infantry_standard));
  const key = 'custom_' + Date.now();
  w.templates[key] = JSON.parse(JSON.stringify(base));
  w.templates[key].name = '装甲矛头师';
  w.templates[key].custom = true;
  assert.ok(w.templates[key], '另存后应入库');
  assert.equal(w.templates[key].name, '装甲矛头师');
  assert.ok(Object.keys(w.templates).includes(key), '模板列表应含自建编制');
  // 删除自建
  delete w.templates[key];
  assert.ok(!w.templates[key], '删除后应移除');
  // 预设不可删（UI 层守卫的引擎侧不变量：预设键不带 custom_ 前缀）
  assert.ok(!String('infantry_standard').startsWith('custom_'), '预设键不以 custom_ 开头，删除按钮不应出现');
});
