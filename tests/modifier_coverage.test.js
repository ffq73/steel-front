/* ============================================================
   tests/modifier_coverage.test.js —— 元测试：修正键消费覆盖率审计
   ------------------------------------------------------------
   为什么需要这个测试
   --------------------
   本项目反复出现同一类事故（v14.0 复盘统计到 50+ 处）：
   「数据层声明了效果，引擎层从来没有读取点」，即所谓的**断链**。
   已确认的实例：
     · constants.js:245/314/375 三个 ENABLE_COMBAT_MODIFIER 全为 false
       → 空军/海军/情报对战斗的影响恒为 0
     · battle.js 只读 mod(nat,'atk')/('unitAtkArm')/('def') 三个键
       → research.js:87-92 把 unit:* 映射成 all_soft / inf_soft / all_brk …
         这些键全库无读取点 → 31 个 modifier 科技里 17 个失效，
         含 inf_weapon_1/2/3 三级步兵武器升级
     · decisions.js 的 mods.supplyHubBuild / puppetSupport /
       resourceOutput / civOutput 四个键无读取点
     · template.js 的 BATTALIONS/SUPPORT_COMPANIES 因 world.templates
       从不初始化而整体空转

   这类问题的隐蔽之处在于：数据写对了、UI 也画出来了、测试也全绿，
   唯独结算时那个数字没人读。人工 review 抓不住，靠"再加一个功能"更抓不住。

   本测试把「声明了但没人读」变成一条可回归的红灯。

   判定规则（保守、只抓最确定的一类）
   --------------------------------
   对每一条 modifier 声明，按 research.js:87-92 的映射规则算出它写入
   nation.modifiers 的键 K，然后要求 K 在 js/engine 或 js/ui 源码中
   至少出现一次「读取形态」：
     · 'K' / "K"            —— 字符串字面量（mod(nat,'atk') 这类）
     · .modifiers.K         —— 属性访问
   nation 作用域查键本身；unit:* 作用域查**完整映射键**
   （如 unit:inf+atk → inf_atk，而不是 atk）——
   因为 battle.js 读 nation 作用域的 'atk' 并不意味着它读 unit 作用域的
   'inf_atk'，这正是 W0-A2 要修的那条断链，必须能被抓出来。

   棘轮（ratchet）机制
   ------------------
   本仓已有同类纪律先例：tests/engine_manifest.json 对 42 个引擎文件做
   md5 比对，改引擎不显式登记就变红。本测试沿用同一思路：
     · 基线存 tests/modifier_coverage.baseline.json
     · 新增「未覆盖键」→ 变红（防回归，这是本测试的主要价值）
     · 减少「未覆盖键」→ 打印改进信息并要求更新基线（棘轮只允许单向收紧）
   登记入口：node tests/modifier_coverage.test.js --update-baseline

   已知局限（写清楚，避免误以为它能抓全部）
   --------------------------------------
   本测试是**静态字符串匹配**，只能抓「键名完全没出现」这一类。
   以下情形会漏报（假阴性），需要在 W0-A2 用统一键表重构后再收紧：
     · 动态拼接出来的键（如 research.js 的 'all_' + stat）
     · 键名恰好与某个无关标识符同名
   反向的假阳性（把已覆盖的报成未覆盖）已通过 EXEMPT 白名单处理，
   每条都带原因，新增条目必须写原因。
   ============================================================ */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TECHS } from '../js/data/techs.js';
import { FOCUSES } from '../js/data/focuses.js';
import { DECISIONS } from '../js/data/decisions.js';
import { DOCTRINES_DATA } from '../js/data/doctrines.js';
import { SCENARIOS } from '../js/data/scenarios.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BASELINE_PATH = path.join(__dirname, 'modifier_coverage.baseline.json');
const UPDATE = process.argv.includes('--update-baseline');

let passed = 0, failed = 0;
function t(name, fn){
  try{ fn(); passed++; console.log('✓', name); }
  catch(e){ failed++; console.log('✗', name, '→', e.message); }
}

/* ---------- 1. 收集所有 modifier 命名空间的声明 ---------- */

/** research.js:87-92 的键映射规则（唯一事实来源，此处复刻以免规则漂移） */
function mapKey(scope, stat){
  if(!scope || scope === 'nation') return stat;
  if(scope === 'unit:all') return 'all_' + stat;
  return scope.replace('unit:', '') + '_' + stat;
}

/** key → Set(来源描述) */
const declared = new Map();
function declare(scope, stat, origin){
  if(!stat) return;
  const key = mapKey(scope, stat);
  if(!declared.has(key)) declared.set(key, new Set());
  declared.get(key).add(origin);
}

// 1a. 科技
for(const tech of TECHS){
  const e = tech.effect;
  if(e && e.type === 'modifier') declare(e.scope, e.stat, `tech:${tech.id}`);
}

// 1b. 国策（通用树 + 四个剧本树）。三种历史格式并存：
//     节点数组 / {natId: [节点]} / 节点自带 effects 或 effects 数组
function scanFocusTree(tree, label){
  if(!tree) return;
  const visitNode = (node) => {
    if(!node || typeof node !== 'object') return;
    const list = Array.isArray(node.effects) ? node.effects
              : (node.effects ? [node.effects] : []);
    for(const e of list){
      if(e && e.type === 'modifier') declare(e.scope, e.stat, `${label}:${node.id}`);
    }
  };
  const visitGroup = (group) => {
    if(Array.isArray(group)) { for(const n of group) visitNode(n); return; }
    if(group && typeof group === 'object'){
      for(const k in group){ if(Array.isArray(group[k])) for(const n of group[k]) visitNode(n); }
    }
  };
  visitGroup(tree);
}
scanFocusTree(FOCUSES, 'focus:base');
for(const sid in SCENARIOS){
  scanFocusTree(SCENARIOS[sid].focuses, `focus:${sid}`);
}

// 1c. 决议的 mods（限时修正，同样进 nation.modifiers）
for(const d of DECISIONS){
  const mods = d.effect && d.effect.mods;
  if(mods) for(const k in mods) declare('nation', k, `decision:${d.id}`);
}

// 1d. 学说节点效果（doctrine.js 把它们写进 nation.modifiers）
for(const branch in DOCTRINES_DATA){
  const trees = DOCTRINES_DATA[branch];
  for(const tid in trees){
    const nodes = trees[tid].nodes || [];
    for(const node of nodes){
      const eff = node.effects || {};
      for(const k in eff) declare('nation', k, `doctrine:${node.id || tid}`);
    }
  }
}

/* ---------- 2. 扫描 engine + ui 源码，找读取点 ---------- */

function collectSource(dir, acc){
  for(const name of fs.readdirSync(dir)){
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if(st.isDirectory()){ collectSource(full, acc); continue; }
    if(!name.endsWith('.js')) continue;
    if(name.endsWith('.test.js')) continue;          // 测试不算消费点
    acc.push(fs.readFileSync(full, 'utf8'));
  }
  return acc;
}
const consumerDirs = [path.join(ROOT, 'js', 'engine'), path.join(ROOT, 'js', 'ui'), path.join(ROOT, 'js', 'core')];
const CONSUMER_SRC = consumerDirs.flatMap(d => collectSource(d, [])).join('\n');

/** 键是否在消费侧源码里有读取形态 */
function hasReader(key){
  const esc = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const literal = new RegExp("['\"]" + esc + "['\"]");
  if(literal.test(CONSUMER_SRC)) return true;
  const prop = new RegExp("\\.modifiers\\s*(?:\\.|\\[)\\s*['\"]?" + esc + "\\b");
  return prop.test(CONSUMER_SRC);
}

/* ---------- 3. 白名单（每条必须写原因） ---------- */
const EXEMPT = {
  // data/scenarios/ww1/battalions.js 挂在剧本上的营级表：
  // 引擎实际读的是 engine/template.js 的 BATTALIONS，ww1 那份是历史遗留副本，
  // 不参与 nation.modifiers 命名空间，故豁免。
  // （真正要修的是"删掉这份死数据"，属 W0 的内容清理项）
};

/* ---------- 4. 判定 + 棘轮 ---------- */

const uncovered = [];
for(const key of [...declared.keys()].sort()){
  if(EXEMPT[key]) continue;
  if(!hasReader(key)) uncovered.push({ key, origins: [...declared.get(key)].sort() });
}
const uncoveredKeys = uncovered.map(u => u.key).sort();

console.log(`\n[modifier_coverage] 声明的 modifier 键 ${declared.size} 个；` +
            `无读取点 ${uncoveredKeys.length} 个`);

/** 读基线（可能尚未建立） */
function loadBaseline(){
  try{ return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')); }
  catch(e){ return null; }
}
const base = loadBaseline();

/* 4a. 覆盖率不得倒退 —— 本测试的主要价值：防新增的「声明了没人读」 */
t('modifier 键覆盖率不得低于基线（棘轮）', () => {
  if(UPDATE) return;                     // 更新模式下跳过断言
  assert.ok(base, `读不到基线 ${path.basename(BASELINE_PATH)}；首次建立请跑 --update-baseline`);
  const prev = base.uncovered || [];
  const regressions = uncoveredKeys.filter(k => !prev.includes(k));
  assert.equal(regressions.length, 0,
    `新增 ${regressions.length} 个「声明了但引擎从不读取」的修正键（覆盖率倒退）：\n` +
    regressions.map(k => `      ${k}  ← ${uncovered.find(x => x.key === k).origins.join(', ')}`).join('\n') +
    `\n      修法二选一：① 在引擎侧真正读取该键；` +
    `② 若该效果本就不该存在，删掉数据层的声明。` +
    `确认要接受当前覆盖率请跑 --update-baseline 显式登记。`);
});

/* 4b. 覆盖率只许收紧 —— 发现改善时要求更新基线 */
t('未覆盖清单与基线一致（发现改善需显式登记）', () => {
  if(UPDATE || !base) return;
  const prev = base.uncovered || [];
  const fixed = prev.filter(k => !uncoveredKeys.includes(k));
  assert.equal(fixed.length, 0,
    `以下 ${fixed.length} 个键现在有读取点了（覆盖率改善），请跑 --update-baseline 收紧棘轮：\n` +
    `      ${fixed.join('\n      ')}`);
});

/* 4c. 映射规则本身不能被悄悄改坏 */
t('scope→key 映射规则与 research.js 一致（防规则漂移）', () => {
  assert.equal(mapKey('nation', 'milOutput'), 'milOutput');
  assert.equal(mapKey('unit:all', 'soft'), 'all_soft');
  assert.equal(mapKey('unit:inf', 'atk'), 'inf_atk');
  assert.equal(mapKey(undefined, 'def'), 'def');
  assert.ok(/'all_'\s*\+/.test(fs.readFileSync(path.join(ROOT, 'js', 'engine', 'research.js'), 'utf8')),
    'research.js 已不再用 "all_" + stat 前缀，本测试的映射规则需要同步更新');
});

/* 4d. 元测试自身不许空转 */
t('元测试有效：确实扫到了东西（防空转守卫）', () => {
  assert.ok(declared.size >= 50, `只扫到 ${declared.size} 个声明键，扫描规则可能已失效`);
  assert.ok(uncovered.length > 0 || Object.keys(EXEMPT).length > 0,
    '扫不到任何未覆盖键且无白名单 —— 大概率是 hasReader 规则过宽导致全量假阴性');
  // 每个未覆盖键都必须能说清来源，否则清单本身不可信
  for(const u of uncovered){
    assert.ok(u.origins.length > 0, `未覆盖键 ${u.key} 没有记录来源`);
  }
});

/* ---------- 5. 写基线 ---------- */

if(UPDATE){
  const detail = {};
  for(const u of uncovered) detail[u.key] = u.origins;
  const payload = {
    _comment: 'modifier 键覆盖率棘轮基线。uncovered = 声明了但引擎无读取点的键名数组。'
            + '只许收紧不许放宽：新增未覆盖键会让测试变红。',
    generatedAt: new Date().toISOString(),
    declaredCount: declared.size,
    uncoveredCount: uncoveredKeys.length,
    uncovered: uncoveredKeys,
    detail
  };
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`\n已写入基线：${path.basename(BASELINE_PATH)}` +
              `（${uncoveredKeys.length} 个未覆盖键）`);
  for(const u of uncovered){
    console.log(`    ${u.key.padEnd(22)} ← ${u.origins.join(', ')}`);
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);