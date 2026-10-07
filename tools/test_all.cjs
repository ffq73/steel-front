/* ============================================================
   tools/test_all.cjs —— 聚合测试入口（W0-E21）
   ------------------------------------------------------------
   此前 39 个测试文件没有聚合 runner，跑全量得靠 shell for 循环，
   很容易漏掉某一个 —— 而且 `npm test` 只跑 tests/run.js 的 7 条基础断言，
   看上去"全绿"其实覆盖面极小，容易造成虚假安全感。

   本脚本做三件事：
     1. 逐个跑 tests/ 下全部 *.test.js 与 test_*.js
     2. 顺带跑 tools/sim.js（平衡沙盒断言）
     3. 汇总失败清单，非零退出码
   用法：
     node tools/test_all.cjs            跑全部
     node tools/test_all.cjs --quiet    只输出失败与汇总
   ============================================================ */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const TESTS_DIR = path.join(ROOT, 'tests');
const QUIET = process.argv.includes('--quiet');

/** 与 npm script 无关的一律排除（工具脚本不是测试） */
function collectTests(){
  return fs.readdirSync(TESTS_DIR)
    .filter(f => f.endsWith('.js') && f !== 'run.js' && f !== 'test_all.cjs')
    .filter(f => /\.test\.js$/.test(f) || /^test_.*playthrough\.js$/.test(f))
    .sort();
}

function run(cmd, args, label){
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', timeout: 300000 });
  const ok = r.status === 0;
  if(!ok && !QUIET){
    console.log(`\n--- ${label} 失败，输出 ---`);
    console.log((r.stdout || '') + (r.stderr || ''));
  }
  return { ok, ms: Date.now() - (r._start || Date.now()) };
}

const tests = collectTests();
const results = [];
let failed = 0;
const t0 = Date.now();

for(const f of tests){
  const start = Date.now();
  const r = spawnSync(process.execPath, [path.join('tests', f)],
                      { cwd: ROOT, encoding: 'utf8', timeout: 300000 });
  const ok = r.status === 0;
  const ms = Date.now() - start;
  results.push({ f, ok, ms });
  if(!ok) failed++;
  if(!QUIET) console.log(`${ok ? '✓' : '✗'} ${f.padEnd(34)} ${ms} ms`);
  else if(!ok) console.log(`✗ ${f}`);
}

// 平衡沙盒
const simStart = Date.now();
const sim = spawnSync(process.execPath, [path.join('tools', 'sim.js')],
                      { cwd: ROOT, encoding: 'utf8', timeout: 600000 });
const simOk = sim.status === 0;
if(!simOk) failed++;
if(!QUIET){
  console.log(`${simOk ? '✓' : '✗'} ${'tools/sim.js (平衡沙盒)'.padEnd(34)} ${Date.now() - simStart} ms`);
} else if(!simOk) console.log('✗ tools/sim.js');
if(!simOk && !QUIET){
  console.log('\n--- sim 失败，输出 ---');
  console.log((sim.stdout || '') + (sim.stderr || ''));
}

const total = results.length + 1;
const totalMs = Date.now() - t0;
const slowest = results.slice().sort((a, b) => b.ms - a.ms).slice(0, 3);

console.log(`\n=== 聚合回归：${total - failed}/${total} 通过，用时 ${(totalMs / 1000).toFixed(1)}s ===`);
if(slowest.length){
  console.log(`最慢：${slowest.map(s => `${s.f} ${s.ms}ms`).join('  |  ')}`);
}
if(failed){
  console.log('\n失败清单：');
  results.filter(r => !r.ok).forEach(r => console.log(`  ✗ ${r.f}`));
  if(!simOk) console.log('  ✗ tools/sim.js');
  console.log('\n提示：改动 js/engine/** 后必须显式重登指纹，否则 provinces.test.js 会红：');
  console.log('  node tests/provinces.test.js --update-engine-manifest');
  console.log('若修正键覆盖率有改善：node tests/modifier_coverage.test.js --update-baseline');
}
process.exit(failed ? 1 : 0);