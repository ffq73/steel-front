/* ============================================================
   tests/ui_wiring.test.js —— v12.0 S3 静态零死区审计（C47）
   ------------------------------------------------------------
   三道扫描（node 端，纯源码文本，不进浏览器）：
   W1  index.html 所有带 id 的 <button>：其 id 必须在 js/ 内被引用
       （addEventListener/onclick/querySelector 皆可），或在白名单
       （sf-load-btn 类历史隐藏件）。
   W2  js/ui 目录生成的 data-* 交互属性：必须在 js/ 内有读取点
       （querySelector(All)/closest/matches 选择器、dataset.xxx、
       getAttribute('data-x') 三种形态任一），或在白名单。
   W3  全项目 alert( 调用必须为 0（C47：禁止 alert 占位）。
   自证：SELF_TEST=1 时在内存里解绑一个已接线按钮，扫描器必须报红。
   运行：node tests/ui_wiring.test.js
   ============================================================ */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

let passed = 0, failed = 0;
function t(name, fn){
  try{ fn(); passed++; console.log('✓', name); }
  catch(e){ failed++; console.log('✗', name, '→', e.message.split('\n')[0]); }
}

function listFiles(dir, exts, out = []){
  for(const e of fs.readdirSync(dir, { withFileTypes: true })){
    const p = path.join(dir, e.name);
    if(e.isDirectory()) listFiles(p, exts, out);
    else if(exts.some(x => e.name.endsWith(x))) out.push(p);
  }
  return out;
}

const jsFiles = listFiles(path.join(root, 'js'), ['.js']);
const jsText = jsFiles.map(p => [path.relative(root, p).replace(/\\/g, '/'), fs.readFileSync(p, 'utf8')]);
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const stripComments = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

/* id 是否在 js 源码中被引用（引号/模板串/选择器三形态任一） */
function idReferencedInJs(id){
  return jsText.some(([, src]) =>
    src.includes("'" + id + "'") ||
    src.includes('"' + id + '"') ||
    src.includes('#' + id));
}

/* ---------- W1 index.html 按钮 id 接线审计 ---------- */
t('W1 index.html 带 id 的 <button> 全部在 js 内接线（或在白名单）', () => {
  const WHITELIST = new Set([
    'sf-load-btn'   // v3 存读档时代的历史隐藏件，行为已由存档面板接管
  ]);
  const ids = [];
  const re = /<button\b[^>]*\sid=["']([^"']+)["'][^>]*>/g;
  let m;
  while((m = re.exec(indexHtml))) ids.push(m[1]);
  assert.ok(ids.length > 0, 'index.html 应存在带 id 的按钮（扫描器有效性前提）');
  const dead = ids.filter(id => !WHITELIST.has(id) && !idReferencedInJs(id));
  assert.deepEqual(dead, [], '以下按钮 id 未被任何 js 引用（死按钮嫌疑）: ' + dead.join(', '));
});

/* ---------- W2 js/ui 生成的 data-* 交互属性审计 ---------- */
t('W2 js/ui 生成的 data-* 交互属性全部有读取点（或在白名单）', () => {
  // 纯展示/标记用途、由兄弟模块以 dataset 形态消费之外的遗留标记
  const WHITELIST = new Set([
    'data-slot-save', 'data-slot-load', 'data-slot-export', 'data-slot-del', // 存档槽（dataset.slotSave 形态消费）
    'data-set-tactic'                                                        // 战术预案（dataset.setTactic）
  ]);
  const uiFiles = jsText.filter(([p]) => p.startsWith('js/ui/'));
  const tokens = new Set();
  for(const [, src] of uiFiles){
    for(const m of stripComments(src).matchAll(/data-[\w-]+/g)) tokens.add(m[0]);
  }
  assert.ok(tokens.size >= 10, 'js/ui 应扫到足够多的 data-* 属性（实得 ' + tokens.size + '，扫描器有效性前提）');

  const allJs = jsText.map(([, src]) => stripComments(src)).join('\n');
  const camel = (bare) => bare.replace(/^data-/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());

  const isWired = (tok) => {
    if(WHITELIST.has(tok)) return true;
    const bare = tok.slice(5);
    // 形态一：选择器字符串中出现（querySelector(All)/closest/matches）
    const selRe = new RegExp('(?:querySelector(?:All)?|closest|matches)\\s*\\(\\s*[`\'"][^`\'"]*' + tok);
    if(selRe.test(allJs)) return true;
    // 形态二：dataset.camel 读取
    if(new RegExp('dataset\\.' + camel(bare) + '\\b').test(allJs)) return true;
    // 形态三：getAttribute('data-x')
    if(new RegExp('getAttribute\\s*\\(\\s*[`\'"]' + tok).test(allJs)) return true;
    return false;
  };

  const dead = [...tokens].filter(tk => !isWired(tk));
  assert.deepEqual(dead, [], '以下 data-* 属性无任何读取点（死控件嫌疑）: ' + dead.join(', '));
});

/* ---------- W3 alert( 全项目清零（C47） ---------- */
t('W3 全项目 js 内 alert( 调用为 0（C47）', () => {
  const offenders = [];
  for(const [p, src] of jsText){
    const stripped = stripComments(src)
      .replace(/`[\s\S]*?`/g, '`S`')      // 模板串整体吞掉，防字符串内 alert 字样误报
      .replace(/'[\s\S]*?'/g, "''")
      .replace(/"[\s\S]*?"/g, '""');
    if(/\balert\s*\(/.test(stripped)) offenders.push(p);
  }
  assert.deepEqual(offenders, [], '以下文件仍有 alert( 调用: ' + offenders.join(', '));
});

/* ---------- 自证：解绑一个按钮后扫描器必须报红 ---------- */
t('W4 自证：内存中解绑按钮后 W1 扫描器必须变红（防测试恒真）', () => {
  // 把第一个 <button> 的 id 改名成从未被引用的 id，W1 同款扫描必须能抓到
  const probe = 'sf-probe-dead-button';
  const fakeHtml = indexHtml.replace(/<button\b[^>]*?\bid=["'][^"']+["']/,
    (m0) => m0.replace(/id=["'][^"']+["']/, 'id="' + probe + '"'));
  assert.notEqual(fakeHtml, indexHtml, 'index.html 应存在可改造的 <button id=...>（自证前提）');
  const ids = [];
  const re = /<button\b[^>]*\sid=["']([^"']+)["'][^>]*>/g;
  let m;
  while((m = re.exec(fakeHtml))) ids.push(m[1]);
  const dead = ids.filter(id => !idReferencedInJs(id));
  assert.ok(dead.includes(probe), '解绑后必须能扫出死按钮（自证失败=测试恒真）');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if(failed) process.exit(1);
