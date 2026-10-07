/* ============================================================
   tests/ui_copy.test.js —— v9.5 U3 文案与显示层断言
   覆盖：六角格标题三级（城市 > 地形区名 > 战区）、
        坐标小字副标题、区名词库确定性、战役历时显示 +1
   纯字符串/纯函数断言，无 DOM。
   运行：node tests/ui_copy.test.js
   ============================================================ */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hexTitleInfo, HEX_REGION_NAMES } from '../js/ui/detailSystem.js';

const SRC_PANELS = readFileSync(new URL('../js/ui/panels.js', import.meta.url), 'utf8');
const SRC_HUDV8 = readFileSync(new URL('../js/ui/hudV8.js', import.meta.url), 'utf8');

let passed = 0, failed = 0;
function t(name, fn){
  try{ fn(); passed++; console.log('✓', name); }
  catch(e){ failed++; console.log('✗', name, '→', e.message); }
}

/* ---------- 1. 标题三级 ---------- */
t('U3-1 城市格标题用城市名', () => {
  const r = hexTitleInfo({ city: { name: '柏林', w: 5 }, q: 5, r: 6, idx: 9, terrain: 'city' });
  assert.equal(r.title, '柏林');
  assert.equal(r.isCity, true);
});

t('U3-2 荒野格标题用地形区名（非坐标）', () => {
  const r = hexTitleInfo({ terrain: 'plain', q: 12, r: 2, idx: 12 });
  assert.ok(!/坐标/.test(r.title), `标题不应是坐标，实得 "${r.title}"`);
  assert.ok(HEX_REGION_NAMES.plain.includes(r.title), `标题应出自区名词库，实得 "${r.title}"`);
});

t('U3-3 坐标以小字副标题形式存在', () => {
  const r = hexTitleInfo({ terrain: 'plain', q: 12, r: 2, idx: 12 });
  assert.match(r.subtitle, /坐标 \(12, 2\)/);
  // 城市格同样有副标题
  const c = hexTitleInfo({ city: { name: '柏林' }, q: 5, r: 6, idx: 9 });
  assert.match(c.subtitle, /坐标 \(5, 6\)/);
});

t('U3-4 区名选取确定性：同格恒同区名，相邻格可轮换', () => {
  const a = hexTitleInfo({ terrain: 'plain', q: 1, r: 1, idx: 100 });
  const b = hexTitleInfo({ terrain: 'plain', q: 2, r: 1, idx: 100 });
  assert.equal(a.title, b.title, '同 idx 必须同名（确定性）');
  // idx 12 → 12%2=0 → 平原旷野；idx 13 → 1 → 开阔地
  assert.equal(hexTitleInfo({ terrain: 'plain', q: 12, r: 2, idx: 12 }).title, '平原旷野');
  assert.equal(hexTitleInfo({ terrain: 'plain', q: 3, r: 1, idx: 13 }).title, '开阔地');
});

t('U3-5 未知地形回落到坐标标题（保底不崩）', () => {
  const r = hexTitleInfo({ terrain: '未知地貌', q: 7, r: 8, idx: 3 });
  assert.match(r.title, /战区坐标 \(7, 8\)/);
  assert.equal(r.subtitle, '');
});

/* ---------- 2. 战役历时显示 +1（显示层约定，防回归） ---------- */
t('U3-6 战役历时显示为 day+1（第 1 天起算）', () => {
  // panels.js 中的模板字面量约定：第 ${w.day + 1} 天
  const src = SRC_PANELS;
  assert.ok(src.includes('第 ${w.day + 1} 天'), 'panels.js 应使用 day+1 显示');
  assert.ok(!src.includes('第 ${w.day} 天`'), '不允许残留 day 原值显示');
});

/* ---------- 3. 警报 lead 严重度（P1-4） ---------- */
t('U3-7 警报 lead 类别随最高严重度（渲染模板含三类）', () => {
  const src = SRC_HUDV8;
  assert.ok(src.includes("leadCls = maxSev >= 3 ? 'bad' : maxSev === 2 ? 'warn' : 'info'"),
    'lead 类别应按 maxSev 分档');
  assert.ok(src.includes('统帅部备忘'), '全 info 时应显示「统帅部备忘」');
});

console.log(`\n${passed} passed, ${failed} failed`);
if(failed) process.exit(1);
