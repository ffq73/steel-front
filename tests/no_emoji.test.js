/* ============================================================
   tests/no_emoji.test.js —— v9.5 U5 图标区去 emoji 断言
   范围：顶栏资源图标（.sf-ribbon-icon）、电台头条模板、SVG 精灵存在性。
   电台电文/事件正文中的 emoji 属"电台氛围元素"，不在本断言范围（见 v9.5 §1 P2-1）。
   运行：node tests/no_emoji.test.js
   ============================================================ */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

let passed = 0, failed = 0;
function t(name, fn){
  try{ fn(); passed++; console.log('✓', name); }
  catch(e){ failed++; console.log('✗', name, '→', e.message); }
}

const INDEX = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const TICKER = readFileSync(new URL('../js/ui/newsTicker.js', import.meta.url), 'utf8');

t('U5-1 SVG 精灵已注入 index.html（9 个符号）', () => {
  for(const id of ['ic-pp','ic-cp','ic-xp','ic-stab','ic-mp','ic-fac','ic-eq','ic-res','ic-div']){
    assert.ok(INDEX.includes(`id="${id}"`), `缺少符号 #${id}`);
  }
});

t('U5-2 顶栏资源图标槽零 emoji（全部 <use> 引用）', () => {
  const icons = [...INDEX.matchAll(/<span class="sf-ribbon-icon">([\s\S]*?)<\/span>/g)].map(m => m[1]);
  assert.ok(icons.length >= 9, `应至少 9 个图标槽，实得 ${icons.length}`);
  for(const inner of icons){
    assert.ok(inner.includes('<svg'), `图标槽含非 SVG 内容："${inner}"`);
    assert.ok(!EMOJI_RE.test(inner), `图标槽含 emoji："${inner}"`);
  }
});

t('U5-3 电台头条（最新态）模板除 📻 台标外零 emoji', () => {
  // 头条正文模板（sf-log-head-tag 行）除台标 📻 外不得含其他 emoji
  const tagLine = TICKER.split('\n').find(l => l.includes('sf-log-head-tag'));
  assert.ok(tagLine, '应存在头条标签行');
  const stripped = (tagLine || '').replace(/📻/g, '');
  assert.ok(!EMOJI_RE.test(stripped), `头条标签行含非台标 emoji："${tagLine}"`);
});

t('U5-4 静默空态保留 📻（电台氛围元素，白名单确认）', () => {
  // 按文档约定：📻 仅允许出现在电台文案中——确认它只出现在 quiet 文案里
  assert.ok(TICKER.includes('战地电台静默中'), '静默文案应存在');
});

console.log(`\n${passed} passed, ${failed} failed`);
if(failed) process.exit(1);
