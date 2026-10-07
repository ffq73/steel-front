/* ============================================================
   tests/terrain_rivers.test.js —— 战术沙盘地貌、水系与天气测试 (Phase E2)
   v11.0：河流与铁路改为在图集坐标（二战剧本 58×30）上验证 ——
   剧本 A 现在是从图集裁剪出来的中欧战区，局部坐标带偏移，
   用二战世界做水系断言才不会被裁剪偏移绕晕。
   ============================================================ */

import assert from 'node:assert/strict';
import { TERRAIN } from '../js/data/terrain.js';
import { RIVERS_DATA, hasRiverCrossing, getRiverPenalty, getAllRiverEdges } from '../js/data/rivers.js';
import { getMapRailways, getMapSupplyHubs } from '../js/data/railways.js';
import { getHexWeather, getWeatherEffects } from '../js/data/weather.js';
import { makeWorld } from '../js/engine/world.js';
import { unitAtk } from '../js/engine/battle.js';

console.log('=== 开始战术沙盘地貌、水系与天气验收测试 (Phase E2) ===\n');

// 1. 五大地貌与扩展地形配置检验
console.log('--- 1. 地貌配置与色板检验 ---');
const requiredTerrains = ['plain', 'forest', 'mount', 'marsh', 'city', 'hills', 'desert'];
for(const key of requiredTerrains){
  assert.ok(TERRAIN[key], `缺少地形定义: ${key}`);
  assert.ok(TERRAIN[key].color, `地形缺少颜色: ${key}`);
  assert.ok(TERRAIN[key].atk > 0 && TERRAIN[key].def > 0, `地形攻防系数异常: ${key}`);
}
console.log('✓ 五大基础地貌及丘陵、沙漠配置与色板验证通过: 7 项');

// 2. 战术水系与河流边界检测（图集坐标）
console.log('\n--- 2. 战术水系与河流边界检测 ---');
assert.ok(RIVERS_DATA.length >= 6, `河流数据数量不足: ${RIVERS_DATA.length}`);
const world = makeWorld('ww2', 42);

// 莱茵河跨河检测：巴塞尔 (13,16) → 斯特拉斯堡方向 (13,15)
assert.equal(hasRiverCrossing(world, 19, 16, 19, 15), true, '莱茵河 (13,16)-(13,15) 边界检测失败');
// 维斯瓦河跨河检测：克拉科夫 (22,15) → 华沙方向 (21,14)
assert.equal(hasRiverCrossing(world, 28, 15, 27, 14), true, '维斯瓦河 (22,15)-(21,14) 边界检测失败');
// 多瑙河跨河检测：维也纳 (19,16) → 布达佩斯方向 (20,16)
assert.equal(hasRiverCrossing(world, 25, 16, 26, 16), true, '多瑙河 (19,16)-(20,16) 边界检测失败');
// 无河流格检测：柏林 (17,13) → 慕尼黑方向 (17,14)
assert.equal(hasRiverCrossing(world, 23, 13, 23, 14), false, '非河流边界误报');

// 全量河流边获取（越界/不存在的河段应被静默跳过）
const edges = getAllRiverEdges(world);
assert.ok(edges.length >= 10, `当前地图河流段数量偏少: ${edges.length}`);
console.log(`✓ 核心历史水系 (莱茵河、维斯瓦河、多瑙河等) 检测通过，当前地图识别 ${edges.length} 条河流段`);

// 3. 渡河进攻惩罚计算验证 (-30% 基础，工兵连减半 -15%)
console.log('\n--- 3. 渡河战斗修正惩罚验证 ---');
const dummyInf = { id: 901, type: 'inf', nat: 'GER', q: 19, r: 16, hp: 100, level: 1 };
const targetHex = { q: 19, r: 15, terrain: 'plain' };

// 基础进攻
const normalAtk = unitAtk(world, dummyInf, 0, { terrain: 'plain' });
// 跨河进攻
const riverAtk = unitAtk(world, dummyInf, 0, { terrain: 'plain', targetHex });
const penaltyRatio = riverAtk / normalAtk;
assert.ok(Math.abs(penaltyRatio - 0.70) < 0.001, `无工兵渡河惩罚未达到 -30%: 实测 ${penaltyRatio}`);

// 配备工兵连的师编制
// W0-A3 修正（2026-10）：原 fixture 写的是
//   { battalions:[...], support:['eng'] }
// 这正是 rivers.js 读错的那套字段名/ID（真实字段是 grid + supports，ID 是 'sup_eng'），
// 于是该断言过去"通过"只是因为被测代码也在找错的字段 —— 它从未真正验证工兵连。
// 现改为真实模板形状，工兵减半这条路径才第一次被真正覆盖。
world.templates = {
  tmpl_eng: { id: 'tmpl_eng', tier: 'regular', grid: [['inf_bat'], [], [], [], []], supports: ['sup_eng'] }
};
const dummyEng = { id: 902, type: 'inf', templateId: 'tmpl_eng', nat: 'GER', q: 13, r: 16, hp: 100, level: 1 };
const engRiverPenalty = getRiverPenalty(world, dummyEng, 19, 16, 19, 15);
assert.equal(engRiverPenalty, 0.85, '工兵连渡河惩罚未减半为 -15%');
console.log(`✓ 渡河战斗修正惩罚验证通过: 普通师惩罚 -30% (x${penaltyRatio.toFixed(2)})，工兵连减半为 -15% (x${engRiverPenalty.toFixed(2)})`);

// 4. 后勤铁路线路网与补给枢纽验证（v11.0：由城市自动派生，不再有硬编码坐标表）
console.log('\n--- 4. 后勤铁路线路网与补给枢纽验证 ---');
const railways = getMapRailways(world);
assert.ok(railways.length >= 8, `铁路线段数量不足: ${railways.length}`);
const hubs = getMapSupplyHubs(world);
assert.ok(hubs.length >= 5, `补给枢纽数量不足: ${hubs.length}`);
const berlinHub = hubs.find(h => h.name.includes('柏林'));
assert.ok(berlinHub && berlinHub.isCapital, '柏林首都总物流库未正确识别');
// 每条铁路两端都必须真的是地图上的格子 —— 派生式路网不允许出现幽灵线段
for(const line of railways){
  assert.ok(world.at[line.from.q + ',' + line.from.r], `铁路起点 ${line.from.q},${line.from.r} 不在图上`);
  assert.ok(world.at[line.to.q + ',' + line.to.r], `铁路终点 ${line.to.q},${line.to.r} 不在图上`);
}
console.log(`✓ 后勤铁路与补给枢纽验证通过: 识别 ${railways.length} 条干线铁路段，${hubs.length} 个主要战略物资枢纽`);

// 5. 战区动态天气系统验证
console.log('\n--- 5. 战区动态天气系统验证 ---');
// 秋季测试 (day 35)
world.day = 35;
const marshHex = { q: 13, r: 5, terrain: 'marsh' };
assert.equal(getHexWeather(world, marshHex), 'mud', '秋季沼泽应为泥泞天气');

// 冬季测试 (day 75)
world.day = 75;
const northHex = { q: 15, r: 3, terrain: 'plain' };
assert.equal(getHexWeather(world, northHex), 'snow', '冬季北方应为暴雪天气');

// 晴朗天气效果
const clearEffects = getWeatherEffects('clear');
assert.equal(clearEffects.moveMul, 1.0);
const snowEffects = getWeatherEffects('snow');
assert.equal(snowEffects.moveMul, 0.70);
const mudEffects = getWeatherEffects('mud');
assert.equal(mudEffects.moveMul, 0.50);

console.log('✓ 动态天气系统 (泥泞/暴雪/晴朗) 与机动影响验证通过');

console.log('\n=== Phase E2 全部数据与机制测试通过 ✓ ===');
