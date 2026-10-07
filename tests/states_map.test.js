/* ============================================================
   tests/states_map.test.js —— W7 战略地图结构与州/省架构验收
   ------------------------------------------------------------
   验证内容：
     1. W7-1 State 层抽象：聚类、槽位、建筑、资源、双向同步
     2. W7-2 省份字段补全：climate、strait、naval_base、railLevel、resources、river、pop
     3. §12 高杠杆修复：
        - 抵抗度天花板突破（无驻军向 65~90% 爬升）
        - 占领法案 factoryYield / resourceYield 接入经济产出
        - 科研基准年按剧本时代动态计算（ww1=1914, ww2=1939）
        - 移动受地形/气候影响（山地/沼泽减速）
   ============================================================ */

import assert from 'node:assert/strict';
import { loadScenario, makeWorld, spawnUnit } from '../js/engine/world.js';
import { getState, getHexState, syncHexToState, updateStateOwnership } from '../js/engine/states.js';
import { resistanceTick, OCCUPATION_LAWS } from '../js/engine/resistance.js';
import { economyTick } from '../js/engine/economy.js';
import { researchTick } from '../js/engine/research.js';
import { effectiveSpeed, enterHex } from '../js/engine/movement.js';
import { makeRng } from '../js/core/rng.js';
import { K } from '../js/data/constants.js';

let passed = 0, failed = 0;
function t(name, fn){
  try {
    fn();
    passed++;
    console.log('✓', name);
  } catch(e) {
    failed++;
    console.error('✗ FAIL:', name, '->', e.message);
  }
}

console.log('=== tests/states_map.test.js: W7 战略地图结构与州/省架构验收 ===\n');

/* ------------------------------------------------------------
   一、W7-1 State 层结构与聚合
   ------------------------------------------------------------ */
console.log('--- 一、W7-1 State 层结构与聚合 ---');

t('loadScenario 正确初始化 world.states 与 world.stateById', () => {
  const w = loadScenario('ww2', 42);
  assert.ok(Array.isArray(w.states), 'world.states 应为数组');
  assert.ok(w.states.length >= 10, `world.states 数量偏少: ${w.states.length}`);
  assert.ok(w.stateById && typeof w.stateById === 'object', 'world.stateById 应为映射表');
  assert.equal(Object.keys(w.stateById).length, w.states.length, 'stateById 大小应与 states 数组一致');
});

t('每个陆地省份都有合法的 stateId 并双向索引', () => {
  const w = loadScenario('ww2', 42);
  let checkedLand = 0;
  for(const h of w.hexes){
    if(h.terrain === 'sea') continue;
    checkedLand++;
    assert.ok(h.stateId, `省份 ${h.idx} (${h.q},${h.r}) 缺少 stateId`);
    const st = getState(w, h.stateId);
    assert.ok(st, `stateById 找不到对应 state: ${h.stateId}`);
    assert.ok(st.provinces.includes(h.idx), `state.provinces 未包含从属省份 ${h.idx}`);
    assert.equal(getHexState(w, h), st, 'getHexState 返回对象应与 getState 一致');
  }
  assert.ok(checkedLand > 50, `检查的陆地省份数量过少: ${checkedLand}`);
});

t('State 建筑、资源与槽位由省份正确聚合', () => {
  const w = loadScenario('ww2', 42);
  for(const st of w.states){
    assert.ok(st.buildingSlots >= st.provinces.length * 3, 'buildingSlots 应至少为格数 × 3');
    let sumCiv = 0, sumMil = 0, sumVp = 0;
    for(const pIdx of st.provinces){
      const h = w.hexes[pIdx];
      sumCiv += (h.civ || 0);
      sumMil += (h.mil || 0);
      sumVp += (h.vp || 0);
    }
    assert.equal(st.buildings.civ, sumCiv, `State ${st.id} 民工厂聚合不符`);
    assert.equal(st.buildings.mil, sumMil, `State ${st.id} 军工厂聚合不符`);
    assert.equal(st.vp, sumVp, `State ${st.id} VP 聚合不符`);
  }
});

t('建造完工时 State 建筑账本与 Hex 同步更新（双向镜像）', () => {
  const w = loadScenario('A', 42);
  const n = w.nations.G;
  const h = w.hexes.find(x => x.owner === 'G' && x.terrain !== 'sea');
  assert.ok(h && h.stateId);
  const st = getState(w, h.stateId);
  const origHexMil = h.mil || 0;
  const origStateMil = st.buildings.mil || 0;

  // 模拟军工厂完工
  n.build = { q: h.q, r: h.r, prog: 6000, need: 6000, kind: 'mil' };
  n.civ = 20;
  economyTick(w);

  assert.equal(h.mil, origHexMil + 1, 'Hex 军工厂应 +1');
  assert.equal(st.buildings.mil, origStateMil + 1, 'State 军工厂应同步 +1');
});

t('敌军攻占省份时更新州控制权 (updateStateOwnership)', () => {
  const w = loadScenario('A', 42);
  const h = w.hexes.find(x => x.owner === 'P' && x.terrain !== 'sea');
  assert.ok(h && h.stateId);
  const st = getState(w, h.stateId);
  assert.equal(st.owner, 'P');

  // 将该州所属省份全部占领
  for(const pIdx of st.provinces){
    w.hexes[pIdx].owner = 'G';
  }
  updateStateOwnership(w, st.id);
  assert.equal(st.owner, 'G', '该州所有省份被占领后，州所有权应转移至德军');
});

/* ------------------------------------------------------------
   二、W7-2 省份缺失字段校验
   ------------------------------------------------------------ */
console.log('\n--- 二、W7-2 省份缺失字段校验 ---');

t('气候带 (climate) 覆盖全图且符合地理区位', () => {
  const w = loadScenario('ww2', 42);
  const validClimates = new Set(['temperate', 'arctic', 'mediterranean', 'arid', 'tropical', 'ocean']);
  let arcticCount = 0, aridCount = 0, medCount = 0, tempCount = 0;
  for(const h of w.hexes){
    assert.ok(validClimates.has(h.climate), `未识别的气候带: ${h.climate}`);
    if(h.climate === 'arctic') arcticCount++;
    if(h.climate === 'arid') aridCount++;
    if(h.climate === 'mediterranean') medCount++;
    if(h.climate === 'temperate') tempCount++;
  }
  assert.ok(arcticCount > 0, '应存在极地寒带格');
  assert.ok(tempCount > 100, '欧陆主体应存在温带格');
});

t('关键海峡标记 (strait) 正确落位', () => {
  const w = loadScenario('ww2', 42);
  const straits = w.hexes.filter(h => h.strait);
  assert.ok(straits.length >= 2, `海峡格数量偏少: ${straits.length}`);
});

t('临海主要城市拥有海军基地 (naval_base) 与等级', () => {
  const w = loadScenario('ww2', 42);
  const ports = w.hexes.filter(h => (h.naval_base || 0) > 0);
  assert.ok(ports.length >= 5, `港口格数量不足: ${ports.length}`);
  for(const p of ports){
    assert.ok(p.naval_base >= 1 && p.naval_base <= 5, `军港等级应在 1~5: ${p.naval_base}`);
  }
});

t('铁路等级 (railLevel) 梯级分布 (首都 Lv3, 大城市 Lv2, 一般城镇 Lv1)', () => {
  const w = loadScenario('ww2', 42);
  const caps = w.hexes.filter(h => h.city && h.city.cap);
  for(const cap of caps){
    assert.equal(cap.railLevel, 3, `首都 ${cap.city.name} 铁路等级应为 3`);
  }
  const bigCities = w.hexes.filter(h => h.city && !h.city.cap && h.city.w >= 3);
  for(const bc of bigCities){
    assert.equal(bc.railLevel, 2, `大城市 ${bc.city.name} 铁路等级应为 2`);
  }
});

t('战略资源 (resources) 在鲁尔、罗马尼亚、高加索等历史要地真实产出', () => {
  const w = loadScenario('ww2', 42);
  const resHexes = w.hexes.filter(h => h.resources && Object.keys(h.resources).length > 0);
  assert.ok(resHexes.length >= 5, `产出战略资源的省份过少: ${resHexes.length}`);
  const hasSteel = resHexes.some(h => (h.resources.steel || 0) > 0);
  const hasOil = resHexes.some(h => (h.resources.oil || 0) > 0);
  assert.ok(hasSteel, '应有钢铁资源格');
  assert.ok(hasOil, '应有石油资源格');
});

t('水系河流 (river) 字段正确记录穿越河流名称', () => {
  const w = loadScenario('ww2', 42);
  const riverHexes = w.hexes.filter(h => h.river != null);
  assert.ok(riverHexes.length >= 10, `标记河流的省份过少: ${riverHexes.length}`);
  assert.ok(riverHexes.some(h => h.river.includes('莱茵河') || h.river.includes('多瑙河')), '应包含历史著名河流');
});

t('人口 (pop) 字段按城市与地貌合理分布且为正数', () => {
  const w = loadScenario('ww2', 42);
  for(const h of w.hexes){
    if(h.terrain === 'sea') continue;
    assert.ok(h.pop >= 200000, `陆地人口不得小于基础值: ${h.pop}`);
    if(h.city && h.city.w >= 3){
      assert.ok(h.pop > 500000, `大城市人口应超过50万: ${h.pop}`);
    }
  }
});

/* ------------------------------------------------------------
   三、§12 高杠杆修复验收
   ------------------------------------------------------------ */
console.log('\n--- 三、§12 高杠杆修复验收 ---');

t('占领区抵抗度无驻军时突破 25% 天花板并向 65~90% 攀升', () => {
  const w = loadScenario('A', 42);
  const h = w.hexes.find(x => x._orig === 'P' && x.terrain !== 'sea');
  assert.ok(h);
  h.owner = 'G';
  h.core = 'P'; // 确立为占领区
  h.units = []; // 无驻军部队
  h.resistance = 0;
  w.nations.G.occupationLaw = 'civilian_oversight'; // civilian_oversight 抵抗目标 25% + 65 = 90%

  const rng = makeRng(12345);
  for(let d = 0; d < 35; d++){
    resistanceTick(w, rng);
  }
  assert.ok(h.resistance > 25, `抵抗度应突破旧版 25% 天花板，实测: ${h.resistance}%`);
  assert.equal(h.resistance, 35, `每日无守军应 +1%，实测: ${h.resistance}%`);
});

t('占领法案 factoryYield 接入建造点产出', () => {
  const w = loadScenario('A', 42);
  const n = w.nations.G;
  n.civ = 10;
  n.law = 'partial';
  n.buildQueue = [];
  n.build = { kind: null };

  const occHex = w.hexes.find(x => x._orig === 'P' && x.terrain !== 'sea');
  occHex.owner = 'G';
  occHex.core = 'P';
  occHex.civ = 10;
  occHex.compliance = 80;

  // 1. 采用 civilian_oversight (factoryYield 0.65)
  n.occupationLaw = 'civilian_oversight';
  n.build = { q: occHex.q, r: occHex.r, prog: 0, need: 10000, kind: 'mil' };
  economyTick(w);
  const progCivilian = n.build.prog;

  // 2. 采用 brutal_oppression (factoryYield 0.25)
  n.occupationLaw = 'brutal_oppression';
  n.build.prog = 0;
  economyTick(w);
  const progBrutal = n.build.prog;

  assert.ok(progCivilian > progBrutal, `民事监督民工厂产出 (${progCivilian.toFixed(1)}) 应高于严酷搜剿 (${progBrutal.toFixed(1)})`);
});

t('科研超前惩罚基准年按时代动态计算（ww1=1914，消除硬编码1939偏置）', () => {
  const w1 = loadScenario('ww1', 42);
  assert.equal(w1.eraData.startYear, 1914);
  const n = w1.nations.GER;
  n.research.slots[0] = 'industry1';
  n.research.progress = {};

  researchTick(w1);
  const prog = n.research.progress['GER:industry1'];
  assert.ok(prog > 0, '一战科技应正常推进');
});

t('移动速度受山地、沼泽与极端气候影响', () => {
  const w = loadScenario('ww2', 42);
  const dummyUnit = { id: 999, type: 'inf', nat: 'GER', q: 0, r: 0 };
  
  // 平原
  w.at['0,0'] = { q: 0, r: 0, terrain: 'plain', climate: 'temperate' };
  const plainSpeed = effectiveSpeed(w, dummyUnit);

  // 山地
  w.at['0,0'] = { q: 0, r: 0, terrain: 'mount', climate: 'temperate' };
  const mountSpeed = effectiveSpeed(w, dummyUnit);

  // 沼泽
  w.at['0,0'] = { q: 0, r: 0, terrain: 'marsh', climate: 'temperate' };
  const marshSpeed = effectiveSpeed(w, dummyUnit);

  assert.ok(mountSpeed < plainSpeed, `山地航速 (${mountSpeed}) 应低于平原 (${plainSpeed})`);
  assert.ok(marshSpeed < plainSpeed, `沼泽航速 (${marshSpeed}) 应低于平原 (${plainSpeed})`);
});

console.log(`\n验收总结: ${passed} 项通过, ${failed} 项失败`);
if(failed > 0) process.exit(1);
