/* ============================================================
   tests/diplomacy.test.js —— v14.6 W5 外交·战争目标·和会守卫
   ------------------------------------------------------------
   W5-1/2 借口完成 tick（休眠链复活）+ 带目标宣战 + 和会校验目标达成
   W5-3   撕毁条款（非军事区 / 资源掠夺）
   W5-5   白和 + 停战白名单（declareWar 拒绝）
   W5-6   同盟条约 + 防御征召
   W5-7   志愿军实体化（3 个师、foreignHelper、每对一次）
   W5-8   world.relations：改善关系/衰减/贸易影响读点
   ============================================================ */

import assert from 'node:assert/strict';
import { loadScenario } from '../js/engine/world.js';
import { tensionTick, startJustifyWar, improveRelations, getRelations, adjustRelations } from '../js/engine/tension.js';
import { declareWarWithGoal, sendVolunteers } from '../js/engine/diplomacy.js';
import { declareWar, proposeWhitePeace, formAlliance, tearUpTerms } from '../js/engine/diplomacy.js';
import { closePeaceConference, buildPeaceConference } from '../js/engine/peace.js';
import { calcTradeInfluence } from '../js/engine/subjects.js';
import { K } from '../js/data/constants.js';

let passed = 0, failed = 0;
function t(name, fn){
  try{ fn(); passed++; console.log('✓', name); }
  catch(e){ failed++; console.log('✗', name, '→', e.message); }
}

/* —— W5-1：借口完成 tick —— */
t('W5-1a 制造借口 30 天后就绪（休眠链复活：此前 daysLeft 无人递减）', () => {
  const w = loadScenario('A', 42);
  const n = w.nations[w.player];
  n.pp = 500;
  w.tension = { value: 60, sources: [] };
  assert.equal(startJustifyWar(w, w.player, 'S'), true, '制造借口应成功');
  const j = n.justifying.find(x => x.target === 'S');
  assert.ok(j && j.daysLeft === 30 && !j.done);
  for(let d = 0; d < 30; d++) tensionTick(w);
  assert.equal(j.done, true, '30 天后借口应就绪');
  assert.ok(w.events.some(e => e.type === 'justify_ready'), '应有就绪事件');
});

/* —— W5-1/2：带目标宣战 —— */
t('W5-2a 借口未就绪时民主国宣战被拒；就绪后带目标宣战入账', () => {
  const w = loadScenario('A', 42);
  const n = w.nations[w.player];
  w.tension = { value: 60, sources: [] };
  n.ideology = 'democratic';
  const res1 = declareWarWithGoal(w, w.player, 'S', 'capture:莫斯科');
  assert.equal(res1.ok, false, '无借口不得宣战');
  n.justifying = [{ target:'S', daysLeft:0, done:true }];
  const res2 = declareWarWithGoal(w, w.player, 'S', 'capture:莫斯科');
  assert.equal(res2.ok, true);
  assert.ok((n.atWarWith || []).includes('S'), '战争关系建立');
  const g = (w.activeWargoals || []).find(x => x.from === w.player && x.to === 'S');
  assert.ok(g && g.goal.type === 'capture' && g.goal.arg === '莫斯科', '战争目标入账');
  assert.equal(n.justifying[0].used, true, '借口标记已使用');
  assert.ok(w.tension.value >= 60, '宣战推高紧张度');
});

t('W5-2b 法西斯意识形态无借口开战', () => {
  const w = loadScenario('A', 42);
  w.nations[w.player].ideology = 'fascist';
  w.tension = { value: 10, sources: [] };
  const res = declareWarWithGoal(w, w.player, 'S', 'conquer');
  assert.equal(res.ok, true, '法西斯无需借口');
});

/* —— W5-5：白和 + 停战白名单 —— */
t('W5-5a 白和：战意低迷方接受 → 战争结束 + 停战 365 天', () => {
  const w = loadScenario('A', 42);
  const a = w.player, b = 'S';
  declareWar(w, a, b, 'conquer');
  w.nations[b].warSupport = 20;   // 低迷 → 接受
  const res = proposeWhitePeace(w, a, b);
  assert.equal(res.ok, true);
  assert.ok(!(w.nations[a].atWarWith || []).includes(b), '战争关系清除');
  const tk = [a, b].sort().join('|');
  assert.equal(w.truces[tk], w.day + 365, '停战白名单 365 天');
});

t('W5-5b 停战期内 declareWar 被拒；战意高昂方拒绝白和', () => {
  const w = loadScenario('A', 42);
  const a = w.player, b = 'S';
  declareWar(w, a, b, 'conquer');
  w.nations[b].warSupport = 80;
  const refused = proposeWhitePeace(w, a, b);
  assert.equal(refused.ok, false, '战意高昂拒绝白和');
  // 强制终战并设停战
  w.nations[a].atWarWith = w.nations[a].atWarWith.filter(x => x !== b);
  w.nations[b].atWarWith = w.nations[b].atWarWith.filter(x => x !== a);
  w.truces[[a, b].sort().join('|')] = w.day + 365;
  assert.equal(declareWar(w, a, b, 'conquer'), false, '停战期内宣战被拒');
  assert.ok(w.events.some(e => e.type === 'truce_blocked'));
});

/* —— W5-6：同盟条约 + 防御征召 —— */
t('W5-6 结盟后一方遭入侵，另一方自动参战', () => {
  const w = loadScenario('A', 42);
  const a = w.player;
  const free = Object.values(w.nations).filter(o => o.alive && o.id !== a && !(o.atWarWith||[]).includes(a) && !(w.nations[a].atWarWith||[]).includes(o.id));
  const b = free[0].id, invader = free[1].id;
  w.nations[a].pp = 500;
  const res = formAlliance(w, a, b);
  assert.equal(res.ok, true);
  assert.ok((w.nations[a].allies || []).includes(b), '缔约入册');
  assert.equal(getRelations(w, a, b) >= 40, true, '缔约提升关系');
  declareWar(w, invader, a, 'conquer');   // 盟友遭入侵
  assert.ok((w.nations[invader].atWarWith || []).includes(b), '防御征召：盟国自动参战');
  assert.ok((w.nations[b].atWarWith || []).includes(invader), '盟国战争关系建立');
  assert.ok(w.events.some(e => e.type === 'ally_called'), '征召事件入账');
  assert.equal(getRelations(w, invader, a), -100, '开战即交恶');
});

/* —— W5-7：志愿军实体化 —— */
t('W5-7 志愿军实体化：3 个师落地、foreignHelper 记录、每对一次', () => {
  const w = loadScenario('A', 42);
  w.tension = { value: 60, sources: [] };
  const src = w.player;
  w.nations[src].pp = 100;   // 派遣需 30 PP
  const dst = Object.values(w.nations).find(o => o.alive && o.id !== src && !(o.atWarWith||[]).includes(src)).id;  // 任选非交战国
  w.nations[dst].warSupport = 60;
  const before = w.units.length;
  assert.equal(sendVolunteers(w, src, dst), true, '首次派遣成功');
  const spawned = w.units.filter(u => u.foreignHelper === src);
  assert.equal(spawned.length, 3, '应落地 3 个志愿步兵师');
  assert.ok(spawned.every(u => u.nat === dst), '志愿师挂目标国国籍（接入战斗/补给管线）');
  assert.equal(w.units.length, before + 3);
  assert.equal(sendVolunteers(w, src, dst), false, '每对 (来源,目标) 只组建一次');
  assert.equal(getRelations(w, src, dst) >= 20, true, '派遣提升关系 +20');
});

/* —— W5-8：relations 真源 —— */
t('W5-8a 改善关系 +25 / 100 封顶 / 交战拒绝', () => {
  const w = loadScenario('A', 42);
  const a = w.player, b = 'S';
  w.nations[a].pp = 200;
  assert.equal(improveRelations(w, a, b).ok, true);
  assert.equal(getRelations(w, a, b), 25);
  assert.equal(w.nations[a].pp, 175);
  adjustRelations(w, a, b, 200);
  assert.equal(getRelations(w, a, b), 100, '封顶 100');
  declareWar(w, a, b, 'conquer');
  assert.equal(improveRelations(w, b, a).ok, false, '交战国无法改善关系');
});

t('W5-8b 贸易影响读点：关系 ±100 → 影响力 ±25', () => {
  const w = loadScenario('A', 42);
  adjustRelations(w, 'G', 'S', 100);
  const hi = calcTradeInfluence(w, 'G', 'S');
  adjustRelations(w, 'G', 'S', -200);   // → -100
  const lo = calcTradeInfluence(w, 'G', 'S');
  assert.ok(hi - lo === 50, `关系两端影响力差应为 50（±25），实际 ${hi - lo}`);
});

/* —— W5-2 和会校验 —— */
t('W5-2c 和会闭幕校验战争目标：达成 +4 战意/声望，未达成 −6 战意', () => {
  const w = loadScenario('A', 42);
  const a = w.player, b = 'S';
  declareWar(w, a, b, 'puppet');
  // 构造和会：b 投降
  w.nations[b].alive = false;
  w.nations[b].capitulated = true;
  const conf = buildPeaceConference(w, b);
  w.pendingPeace = conf;
  w.nations[a].warSupport = 50;
  w.nations[a].prestige = 0;
  closePeaceConference(w);
  // puppet 目标未执行（无 puppetOf）→ 判未达成
  assert.equal(w.nations[a].warSupport, 44, '未达成应 −6 战意');
  assert.equal(w.nations[a].prestige, 0, '未达成不给声望');
  assert.ok(w.events.some(e => e.type === 'wargoal_failed'), '应有失败事件');
  assert.equal((w.activeWargoals || []).filter(g => g.to === b && g.from === a).length, 0, '和约后目标清除');
});

/* —— W5-3：撕毁条款 —— */
t('W5-3 撕毁非军事区条款：PP−150、稳定−10、标记清除；紧张度+5', () => {
  const w = loadScenario('A', 42);
  const a = w.player;
  const stabBefore = w.nations[a].stability || 60;
  const h = w.hexes.find(x => x.owner === a && x.terrain !== 'sea');
  h.demilitarized = true;
  w.nations[a].pp = 200;
  w.tension = { value: 20, sources: [] };
  const res = tearUpTerms(w, a, 'demilitarized', { q: h.q, r: h.r });
  assert.equal(res.ok, true);
  assert.equal(h.demilitarized, false, '非军事区标记清除');
  assert.equal(w.nations[a].pp, 50, '扣 150 PP');
  assert.equal(w.nations[a].stability, Math.max(10, stabBefore - 10), '稳定 −10');
  assert.ok(w.tension.value >= 25, '紧张度 +5');
  assert.ok(w.events.some(e => e.type === 'treaty_torn'), '撕约事件入账');
});

/* —— 汇总 —— */
console.log(`\n${passed} 通过, ${failed} 失败`);
process.exit(failed ? 1 : 0);
