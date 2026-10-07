/* ============================================================
   tests/focus_trees.test.js —— 国策树接线与完整性验收（v11.0）
   ------------------------------------------------------------
   动因：四个副本各手写了完整国策树（合计 468 节点），但引擎只读
   data/focuses.js 的通用树，剧本树从未被解释器看到 —— 88KB 内容零生效，
   且通用树只覆盖 6 国：选中国/日本/美国/意大利时国策树是**空的**。

   本测试锁死这条链：
     1. 剧本树已注册且能被 focusesFor 取到
     2. 每个可玩国家都有成规模的国策树（不少于 8 节点）
     3. 前置引用无死链、无不可达节点
     4. 剧本树用到的效果类型全部被 applyEffect 认领（点完不能白点）
     5. 端到端：选中 → 逐日推进 → 到日完成 → 效果落到国家账本
   ============================================================ */

import assert from 'node:assert/strict';
import { SCENARIOS } from '../js/data/scenarios.js';
import { loadScenario } from '../js/engine/world.js';
import { focusesFor, availableFocuses, pickFocus, focusTick } from '../js/engine/focus.js';
import { ERA_PLAYABLE } from '../js/ui/screenManager.js';

console.log('=== 国策树接线与完整性验收 ===\n');

/* applyEffect 认领的效果类型（见 engine/research.js） */
const SUPPORTED = new Set([
  'modifier', 'unlockUnit', 'unlockTech', 'addResearchSlot', 'addPP', 'addFactory',
  'addBuilding', 'setLaw', 'declareWar', 'addBuilding2', 'event',
  'addMil', 'addCiv', 'addEquip', 'addStability', 'addWarSupport', 'addPrestige', 'addModifier', 'addArmyXp'
]);

let totalNodes = 0;
let totalNations = 0;

for(const scId of Object.keys(SCENARIOS)){
  const world = loadScenario(scId, 7);
  const era = SCENARIOS[scId].era || 'ww2';
  const roster = SCENARIOS[scId].nations;
  // 时代可玩表用的是三字母代码；剧本 A 的六国是单字母，
  // 交集为空时退回用剧本自己的国家表当作「可玩集」
  const eraPlayable = (ERA_PLAYABLE[era] || []).filter((p) => roster.includes(p));
  const playable = eraPlayable.length ? eraPlayable : roster.filter((p) => world.nations[p]);
  const withTree = [];

  for(const natId of roster){
    const tree = focusesFor(world, natId);
    if(!tree.length) continue;
    totalNations++;
    totalNodes += tree.length;

    const ids = new Set(tree.map((f) => f.id));
    assert.equal(ids.size, tree.length, `${scId}/${natId} 出现重复国策 id`);

    // 3. 死链与不可达
    for(const f of tree){
      for(const r of f.requires){
        assert.ok(ids.has(r), `${scId}/${natId} 国策「${f.name}」的前置 ${r} 不存在`);
      }
      // 4. 效果类型必须被解释器认领
      for(const e of f.effects){
        assert.ok(SUPPORTED.has(e.type),
          `${scId}/${natId} 国策「${f.name}」的效果类型 ${e.type} 无人解释（点了等于白点）`);
      }
      assert.ok(f.days > 0, `${scId}/${natId} 国策「${f.name}」天数非法`);
    }
    // 可达性：从无前置节点出发能覆盖全部节点
    const done = new Set();
    let grew = true;
    while(grew){
      grew = false;
      for(const f of tree){
        if(done.has(f.id)) continue;
        if(f.requires.every((r) => done.has(r))){ done.add(f.id); grew = true; }
      }
    }
    assert.equal(done.size, tree.length,
      `${scId}/${natId} 有 ${tree.length - done.size} 个国策永远解锁不了（前置成环或缺失）`);

    // 5. 至少有一个开局可点
    assert.ok(availableFocuses(world, natId).length > 0, `${scId}/${natId} 开局没有任何可选国策`);

    // 6. 自动排版：chain / x / y 齐备（UI 按链分列渲染）
    for(const f of tree){
      assert.ok(f.chain, `${scId}/${natId} 国策「${f.name}」没有分链`);
      assert.ok(Number.isFinite(f.y), `${scId}/${natId} 国策「${f.name}」没有层级 y`);
    }

    withTree.push(`${natId}:${tree.length}${playable.includes(natId) ? '' : '·'}`);
  }

  // 2. 可玩国家必须都有成规模的国策树（标 · 的为国策树较短的次要国）
  for(const natId of playable){
    if(!world.nations[natId]) continue;
    const tree = focusesFor(world, natId);
    assert.ok(tree.length >= 8,
      `${scId} 的可玩国家 ${natId} 只有 ${tree.length} 个国策 —— 玩家会觉得「国策树过于单调」`);
  }

  console.log(`  ${scId.padEnd(8)} 可玩 ${playable.length} 国 · 有树国家 ${withTree.length} 个`);
  console.log(`           ${withTree.join(' ')}`);
}

console.log(`\n✓ 共 ${totalNations} 国 / ${totalNodes} 个国策节点，无死链、无不可达、效果类型全部被解释`);

/* ---------- 5. 端到端：点满一个国策并核对收益 ---------- */
console.log('\n--- 端到端：德国首个可点国策全程推演 ---');
{
  const w = loadScenario('ww2', 11);
  const ger = w.nations.GER;
  const first = availableFocuses(w, 'GER')[0];
  assert.ok(first, '德国开局应有可选国策');

  /* 国策收益形式多样（民工/军工/装备/稳定度/战争支持度/修正器），
     这里取一份完整账本快照，只要有一项变化就说明效果真的落地了 */
  const ledger = () => JSON.stringify({
    civ: ger.civ, mil: ger.mil, equip: ger.equip,
    stab: ger.stability, ws: ger.warSupport, prestige: ger.prestige || 0,
    mods: ger.modifiers
  });
  const before = ledger();

  assert.ok(pickFocus(w, 'GER', first.id), '选取国策失败');
  // 逐日推进直到完成
  let guard = 0;
  while(ger.focus.active && guard++ < 400) focusTick(w);
  assert.equal(ger.focus.active, null, '国策应在限定天数内完成');
  assert.ok(ger.focus.done.includes(first.id), '完成的国策应进入 done 列表');
  assert.notEqual(ledger(), before,
    `国策「${first.name}」完成后国家账本毫无变化 —— 效果解释器漏了这个类型`);
  console.log(`✓ 「${first.name}」${first.days} 天完成，国家账本发生变动`);
  console.log(`   效果：${first.effects.map((e) => e.type + (e.value !== undefined ? '(' + e.value + ')' : '')).join(' ')}`);
}

/* ---------- 6. 确定性：同种子两次载入的国策树逐字节一致 ---------- */
{
  const a = loadScenario('ww2', 99), b = loadScenario('ww2', 99);
  const ja = JSON.stringify(focusesFor(a, 'SOV'));
  const jb = JSON.stringify(focusesFor(b, 'SOV'));
  assert.equal(ja, jb, '自动排版的国策树必须确定性');
  console.log('✓ 同种子两次载入的国策树逐字节一致');
}

console.log('\n=== 国策树接线与完整性验收通过 ===');
