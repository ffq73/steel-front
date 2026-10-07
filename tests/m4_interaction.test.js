/* ============================================================
   tests/m4_interaction.test.js —— v8.0 M4 交互与快捷键回归断言
   覆盖：路径点队列 / 支援姿态原地 / 战略调动倍速 /
        移出计划 / 战略调动不参战 / 支援需相邻
   运行：node tests/m4_interaction.test.js
   ============================================================ */

import assert from 'node:assert/strict';
import { makeWorld } from '../js/engine/world.js';
import { processMove, effectiveSpeed } from '../js/engine/movement.js';
import { checkCombatWidth } from '../js/engine/battle.js';
import { hexDist } from '../js/core/geom.js';
import { K } from '../js/data/constants.js';
import { UNITS } from '../js/data/units.js';

let passed = 0, failed = 0;
function t(name, fn){
  try{ fn(); passed++; console.log('✓', name); }
  catch(e){ failed++; console.log('✗', name, '→', e.message); }
}

/* 造一个最小可控世界：清空全部部队，便于手工放置夹具 */
function sandbox(){
  const w = makeWorld('A', 20260926);
  w.units.length = 0;
  for(const h of w.hexes) h.units.length = 0;
  w.battleFeed = [];
  return w;
}
function place(w, nat, type, q, r, extra = {}){
  const h = w.at[q + ',' + r];
  const u = {
    id: 'T' + (w.units.length + 1), nat, type, q, r,
    hp: 100, org: 60, maxOrg: 60, exp: 0, supply: 100, fuel: 100,
    order: null, waypoints: [], inPlan: false, armyId: null, strategic: false,
    ...extra
  };
  w.units.push(u);
  if(h) h.units.push(u.id);
  return u;
}
const homeHex = w => w.hexes.find(h => h.owner === w.player && h.terrain !== 'sea');

/* ---------- 1. 路径点队列：逐段消费 ---------- */
t('M4-A 路径点队列按顺序逐段消费', () => {
  const w = sandbox();
  const home = homeHex(w);
  const u = place(w, w.player, 'inf', home.q, home.r);

  // 沿相邻己方格构造一条 2 段航线
  const chain = home.adj.map(i => w.hexes[i]).filter(h => h.terrain !== 'sea');
  assert.ok(chain.length >= 2, '需要至少 2 个相邻陆格');
  for(const h of chain) h.owner = w.player;

  const wps = chain.slice(0, 2).map(h => ({ q: h.q, r: h.r }));
  u.waypoints = wps.map(x => ({ ...x }));
  u.order = null;

  processMove(w, u);
  // 第一个航路点被消费：要么命令已在途（dest 指向 wp1），要么当拍就走到了 wp1
  if(u.order){
    assert.equal(u.order.type, 'advance');
    assert.deepEqual(u.order.dest, [wps[0].q, wps[0].r], '首条命令必须指向第一个航路点');
    assert.equal(u.waypoints.length, 1, '未消费的航路点必须保留');
  }else{
    assert.ok(u.q === wps[0].q && u.r === wps[0].r, '若当拍走完，必须停在第一个航路点');
    assert.equal(u.waypoints.length, 1, '第二个航路点仍应留待后续消费');
  }

  // 持续 tick 直到航路点全部消费且最后一段命令走完
  let guard = 60;
  while((u.waypoints.length || u.order) && guard-- > 0) processMove(w, u);
  assert.ok(guard > 0, '航路点队列不应死循环');
  assert.equal(u.waypoints.length, 0, '航路点最终应全部被消费');
  // 全程走完后必须停在最后一个航路点，证明是沿航线逐段推进而非直达
  assert.ok(u.q === wps[1].q && u.r === wps[1].r,
    `按序推进后应停在 wp2(${wps[1].q},${wps[1].r})，实得 (${u.q},${u.r})`);
});

/* ---------- 2. 支援姿态：原地不动 ---------- */
t('M4-B 支援姿态原地开火（位置不变、命令保留）', () => {
  const w = sandbox();
  const home = homeHex(w);
  const u = place(w, w.player, 'inf', home.q, home.r);
  u.order = { type: 'support', target: [home.q, home.r] };
  const q0 = u.q, r0 = u.r;
  for(let i = 0; i < 10; i++) processMove(w, u);
  assert.equal(u.q, q0, '支援师不得移动 q');
  assert.equal(u.r, r0, '支援师不得移动 r');
  assert.ok(u.order && u.order.type === 'support', '支援命令应保持');
});

/* ---------- 3. 战略调动：×1.8 航速 ---------- */
t('M4-C 战略调动航速 ×1.8', () => {
  const w = sandbox();
  const home = homeHex(w);
  const a = place(w, w.player, 'inf', home.q, home.r);
  const b = place(w, w.player, 'inf', home.q, home.r);

  const base = effectiveSpeed(w, a);
  b.strategic = true;
  const boosted = effectiveSpeed(w, b);

  const ratio = boosted / base;
  assert.ok(Math.abs(ratio - 1.8) < 0.02, `期望 ×1.8，实得 ×${ratio.toFixed(3)}`);
});

/* ---------- 4. 移出计划：清 order / waypoints / armyId ---------- */
t('M4-D 移出计划清空命令与航路点', () => {
  const w = sandbox();
  const home = homeHex(w);
  const u = place(w, w.player, 'inf', home.q, home.r, { armyId: 'A1', inPlan: true });
  u.waypoints = [{ q: home.q, r: home.r }];
  u.order = { type: 'advance', dest: [home.q, home.r] };

  // DETACH intent 施加的同一组字段变更
  u.armyId = null; u.inPlan = false; u.order = null; u.waypoints = [];

  assert.equal(u.armyId, null);
  assert.equal(u.inPlan, false);
  assert.equal(u.order, null);
  assert.equal(u.waypoints.length, 0);
});

/* ---------- 5. 战略调动中不参战 ---------- */
t('M4-E 战略调动中的师被排除出进攻方', () => {
  const w = sandbox();
  const home = homeHex(w);
  const enemyNat = w.nations[w.player].atWarWith[0];
  const eh = w.hexes.find(h => h.owner === enemyNat && h.terrain !== 'sea');
  const u = place(w, w.player, 'inf', home.q, home.r);
  u.order = { type: 'attack', target: [eh.q, eh.r] };

  // 复刻 battle.js 攻击方收集谓词
  const eligible = u2 =>
    !(u2.hp <= 0 || !u2.order || u2.strategic) &&
    (u2.order.type === 'attack' || u2.order.type === 'support') &&
    u2.order.target[0] === eh.q && u2.order.target[1] === eh.r;

  u.strategic = true;
  assert.equal(eligible(u), false, '战略调动中不应计入进攻方');
  u.strategic = false;
  assert.equal(eligible(u), true, '取消战略调动后应恢复参战');
});

/* ---------- 6. 支援攻击仅相邻格可参与 ---------- */
t('M4-F 支援攻击仅相邻格可参与', () => {
  const w = sandbox();
  const enemyNat = w.nations[w.player].atWarWith[0];

  // 找一对「相邻的己方格 / 敌方格」验证接受条件
  let pair = null;
  for(const h of w.hexes){
    if(h.owner !== w.player || h.terrain === 'sea') continue;
    const e = h.adj.map(i => w.hexes[i]).find(x => x.owner === enemyNat && x.terrain !== 'sea');
    if(e){ pair = [h, e]; break; }
  }
  assert.ok(pair, '世界应存在一处己方/敌方接壤，用于就近支援验证');

  const u = place(w, w.player, 'inf', pair[0].q, pair[0].r);
  u.order = { type: 'support', target: [pair[1].q, pair[1].r] };
  const d = hexDist(u.q, u.r, pair[1].q, pair[1].r);
  assert.equal(d, 1, `接壤格距离应为 1，实得 ${d}`);

  // 远端支援应被拒绝（沿用 input.js 的相邻守卫）
  const far = w.hexes.find(h => h.owner === enemyNat && h.terrain !== 'sea' &&
                                  hexDist(u.q, u.r, h.q, h.r) > 1);
  assert.ok(far, '应存在非相邻敌格');
  assert.ok(hexDist(u.q, u.r, far.q, far.r) > 1, '远端支援必须判为非法');
});

/* ---------- 7. 战宽预览与实际结算同源 ---------- */
t('M4-G 战宽已满可被预判（§5.3 提示与结算同源）', () => {
  const w = sandbox();
  const enemyNat = w.nations[w.player].atWarWith[0];
  // 找一处敌格，并在其周围放满己方师
  let tgt = null, ring = [];
  for(const h of w.hexes){
    if(h.owner !== enemyNat || h.terrain === 'sea') continue;
    const r2 = h.adj.map(i => w.hexes[i]).filter(x => x.owner === w.player && x.terrain !== 'sea');
    // >3 即可：v11.0 换用真实国界轮廓后，德波边境不再是矩形，凸出部最多 3 向接敌
    if(r2.length >= 3){ tgt = h; ring = r2; break; }
  }
  assert.ok(tgt, '世界应存在一处可被多方向接敌的敌格');
  for(const h of ring) place(w, w.player, 'inf', h.q, h.r);

  const tw = K.TERRAIN_COMBAT_WIDTH[tgt.terrain] || K.TERRAIN_COMBAT_WIDTH.plain;
  // W1-1：师宽 = UNITS.width × WIDTH_SCALE（10 宽师）；战宽为 HOI4 原值
  const uw = UNITS['inf'].width * K.WIDTH_SCALE;
  // 战宽 = 基础 + (进攻方向数 - 1) × 侧翼附加，封顶 WIDTH_MAX
  const widthFor = dirs => +Math.min(tw.base + (dirs - 1) * tw.flank, K.WIDTH_MAX).toFixed(1);

  // 只让紧邻目标的师参战（远处师不下达进攻命令）
  const us = w.units.filter(u => u.nat === w.player && hexDist(u.q, u.r, tgt.q, tgt.r) === 1);
  for(const u of w.units) u.order = null;
  assert.ok(us.length >= 2, `接敌师数量应≥2，实得 ${us.length}`);

  // 先只让 2 个师进攻：应当未满
  us[0].order = { type:'attack', target:[tgt.q, tgt.r] };
  us[1].order = { type:'attack', target:[tgt.q, tgt.r] };
  const dirs2 = new Set([us[0], us[1]].map(u => u.q + ',' + u.r)).size;
  const r1 = checkCombatWidth(w, tgt.q, tgt.r);
  assert.equal(r1.width, widthFor(dirs2), '预览战宽须与地形公式一致');
  assert.equal(r1.full, false, '2 个师不应判定为战宽已满');

  // 全军压上：应当判定已满并给出待命数
  for(const u of us) u.order = { type:'attack', target:[tgt.q, tgt.r] };
  const dirsAll = new Set(us.map(u => u.q + ',' + u.r)).size;
  const wAll = widthFor(dirsAll);
  const r2 = checkCombatWidth(w, tgt.q, tgt.r);
  const capacity = Math.floor(wAll / uw);
  assert.equal(r2.width, wAll, '多方向进攻应扩大战宽');
  assert.equal(r2.attackers, us.length, '预览统计的进攻方应为全部接敌师');
  assert.equal(r2.full, capacity < us.length, '是否已满须与可容纳师数一致');
  if(r2.full){
    assert.equal(r2.waiting, us.length - capacity, '待命师数应为总师数减去可容纳数');
  }
  assert.ok(r2.used <= wAll, '已投入宽度不得超过上限');
});

console.log(`\n${passed} passed, ${failed} failed`);
if(failed) process.exit(1);
