/* ============================================================
   tests/content.test.js —— 内容工业化验收测试 (P4)
   验证百科 18 装备/6 工业/8 指标/8 法案、40 战役事件与德国 40+ 全量国策树
   ============================================================ */

import { strict as assert } from 'node:assert';
import { ENCYCLOPEDIA } from '../js/data/encyclopedia.js';
import { SCENARIO_A_EVENTS } from '../js/data/events40.js';
import { FOCUSES } from '../js/data/focuses.js';

console.log('=== 开始内容工业化与资料库验收测试 (P4) ===\n');

// 1. 装备百科条目 >= 18
assert(ENCYCLOPEDIA.equipments.length >= 18, `装备百科应至少 18 项，实际: ${ENCYCLOPEDIA.equipments.length}`);
for(const eq of ENCYCLOPEDIA.equipments){
  assert(eq.id && eq.name && eq.category && eq.stats && eq.history, `装备 [${eq.id}] 缺少必须字段`);
}
console.log(`✓ 装备百科验证通过: ${ENCYCLOPEDIA.equipments.length} 项`);

// 2. 工业机制条目 >= 6
assert(ENCYCLOPEDIA.industries.length >= 6, `工业机制百科应至少 6 项，实际: ${ENCYCLOPEDIA.industries.length}`);
for(const ind of ENCYCLOPEDIA.industries){
  assert(ind.id && ind.name && ind.rules, `工业条目 [${ind.id}] 缺少必须字段`);
}
console.log(`✓ 工业与后勤机制百科验证通过: ${ENCYCLOPEDIA.industries.length} 项`);

// 3. 核心指标条目 >= 8
assert(ENCYCLOPEDIA.metrics.length >= 8, `核心指标百科应至少 8 项，实际: ${ENCYCLOPEDIA.metrics.length}`);
for(const m of ENCYCLOPEDIA.metrics){
  assert(m.id && m.name && m.effects, `指标条目 [${m.id}] 缺少必须字段`);
}
console.log(`✓ 核心指标体系百科验证通过: ${ENCYCLOPEDIA.metrics.length} 项`);

// 4. 国家法案条目 >= 8
assert(ENCYCLOPEDIA.laws.length >= 8, `国家法案百科应至少 8 项，实际: ${ENCYCLOPEDIA.laws.length}`);
for(const law of ENCYCLOPEDIA.laws){
  assert(law.id && law.name && law.desc, `法案条目 [${law.id}] 缺少必须字段`);
}
console.log(`✓ 国家法案百科验证通过: ${ENCYCLOPEDIA.laws.length} 项`);

// 5. 白色方案 40 大动态历史事件
assert(SCENARIO_A_EVENTS.length >= 40, `白色方案历史事件应至少 40 项，实际: ${SCENARIO_A_EVENTS.length}`);
for(const ev of SCENARIO_A_EVENTS){
  assert(ev.id && ev.title && ev.desc && Array.isArray(ev.choices), `事件 [${ev.id}] 缺少必要字段或选项`);
  assert(typeof ev.day === 'number', `事件 [${ev.id}] 天数必须为数字`);
}
console.log(`✓ 白色方案 40 大动态事件全量验证通过: ${SCENARIO_A_EVENTS.length} 项`);

// 6. 德国 40+ 全量国策树五大分支
const gFocuses = FOCUSES.G;
assert(gFocuses.length >= 40, `德国国策树应至少 40 节点，实际: ${gFocuses.length}`);
const chains = new Set(gFocuses.map(f => f.chain));
assert(chains.has('industry'), '必须包含工业链');
assert(chains.has('army'), '必须包含陆军链');
assert(chains.has('air'), '必须包含空军链');
assert(chains.has('navy'), '必须包含海军链');
assert(chains.has('politics'), '必须包含政治外交链');

// 校验国策树前置依赖无死链
const allIds = new Set(gFocuses.map(f => f.id));
for(const f of gFocuses){
  for(const req of (f.requires || [])){
    assert(allIds.has(req), `国策 [${f.id}] 依赖不存在的前置国策 [${req}]`);
  }
}
console.log(`✓ 德国国策树全量验证通过: ${gFocuses.length} 节点，五大分支完整且无断链死锁`);

console.log('\n测试汇总: 全部通过 ✓');
