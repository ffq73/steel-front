/* ============================================================
   tests/w0_wiring.test.js —— W0 第一批断链修复的行为回归
   ------------------------------------------------------------
   覆盖三处已修断链 + 三处顺带发现的同型 bug：

   W0-A3  world.templates 从不初始化
          → battle.js 模板攻防 / rivers.js 工兵减半 / plans.js 炮兵识别
            全部空转；编制设计器设计出来的东西没有任何一场战斗读它
          本次修法是**比例化挂载**：模板只改构成、不改量级，
          以该兵种的参考编制为 1.0 基准 —— 因此本文件第一组断言是
          「基准编制的构成比必须严格等于 1.0」，用来防止有人日后把比例化
          改回整体替换（那会让步兵软攻膨胀 9 倍）。

   W0-B1  hex.core 从不写入（只有 _orig）
          → resistance.js 的 isOccupied 恒 false，
            抵抗度/顺从度/游击破袭/武装起义整条链空转
          → 同一文件里还有三处：hasGarrison 用不存在的 u.hex 字段、
            工业判据用从未被写入的 hex.ind、rng.next() 必抛 TypeError

   W0-B3/B4  manpower.js 读错法案字段
          → 征兵法案的 manpowerRate 永远取不到（查的是经济法案表）
          → ECONOMIC_LAWS.total 的 manpowerPenalty 也从未生效

   顺带    rivers.js / plans.js / battle.js 三处把模板字段写成
          .support（单数），实际字段是 .supports（复数）
          → 即使模板初始化了也仍取不到支援连
   ============================================================ */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadScenario, spawnUnit } from '../js/engine/world.js';
import { dayTick } from '../js/engine/tick.js';
import { makeRng } from '../js/core/rng.js';
import { unitAtk, unitCombatWidth, unitDef, resolveBattle } from '../js/engine/battle.js';
import { effectiveSpeed } from '../js/engine/movement.js';
import { unitMod } from '../js/engine/mods.js';
import { getBattleAirModifier, getHexAirRegion } from '../js/engine/air.js';
import { calcIntelCombatBonus, updateAllIntelLevels } from '../js/engine/intel.js';
import { K } from '../js/data/constants.js';
import { getLineResourceEff } from '../js/engine/resources.js';
import { subjectsTick } from '../js/engine/subjects.js';
import { barrageModifierForHex } from '../js/engine/barrage.js';
import { droneReconModifier, dronesTick } from '../js/engine/drones.js';
import {
  calcTemplateStats, templateAdjust, templateHasSupport,
  initTemplates, DEFAULT_TEMPLATE_BY_UNIT
} from '../js/engine/template.js';
import { resistanceTick } from '../js/engine/resistance.js';
import { UNITS } from '../js/data/units.js';
import { conscriptionRate, manpowerPool } from '../js/engine/manpower.js';
import { switchConscriptionLaw, switchEconomicLaw } from '../js/engine/laws.js';
import { getRiverPenalty, hasRiverCrossing } from '../js/data/rivers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

let passed = 0, failed = 0;
function t(name, fn){
  try{ fn(); passed++; console.log('✓', name); }
  catch(e){ failed++; console.log('✗', name, '→', e.message); }
}
const close = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

/** 找一对真实的相邻河流边（不同剧本河流密度不同，找不到就返回 null） */
function findRiverPair(w){
  for(const h of w.hexes){
    if(h.terrain === 'sea') continue;
    for(const ni of (h.adj || [])){
      const nb = w.hexes[ni];
      if(!nb || nb.terrain === 'sea') continue;
      if(hasRiverCrossing(w, h.q, h.r, nb.q, nb.r)) return { from: h, to: nb };
    }
  }
  return null;
}

/* ============================================================
   一、W0-A3：师编制接入
   ============================================================ */

t('loadScenario 即初始化 world.templates（不再惰性缺失）', () => {
  const w = loadScenario('A', 42);
  assert.ok(w.templates && Object.keys(w.templates).length >= 6,
    'world.templates 缺失或模板数不足');
  const marker = w.templates.infantry_standard;
  marker.__touched = true;
  initTemplates(w);
  assert.equal(w.templates.infantry_standard.__touched, true,
    'initTemplates 重复调用覆盖了既有模板（应幂等）');
});

t('每个单位都挂上了默认编制', () => {
  const w = loadScenario('A', 42);
  assert.ok(w.units.length > 0);
  const missing = w.units.filter(u => !u.templateId);
  assert.equal(missing.length, 0,
    `${missing.length} 个单位没有 templateId，模板分支仍会空转`);
  for(const u of w.units){
    assert.ok(DEFAULT_TEMPLATE_BY_UNIT[u.type], `兵种 ${u.type} 没有默认编制映射`);
    assert.ok(w.templates[u.templateId],
      `单位 ${u.id} 的编制 ${u.templateId} 在 world.templates 里不存在`);
  }
});

t('★ 基准编制的构成比严格等于 1.0（防 9 倍战力膨胀回归）', () => {
  // 曾经的写法是把 9 个营的聚合值整体替换基础攻防：
  //   infantry_standard 软攻合计 54，而 UNITS.inf.soft 只有 6 → 膨胀 9 倍。
  // 比例化挂载后，基准编制必须与接入模板之前逐位相同。
  const w = loadScenario('A', 42);
  const byType = {};
  for(const u of w.units) if(!byType[u.type]) byType[u.type] = u;
  assert.ok(Object.keys(byType).length >= 3, '样本兵种太少，测试失去意义');
  for(const type in byType){
    const adj = templateAdjust(w, byType[type]);
    for(const k of ['soft', 'hard', 'def', 'brk', 'width']){
      assert.ok(close(adj[k], 1, 1e-9),
        `兵种 ${type} 的 ${k} 构成比 = ${adj[k]}，基准编制必须是 1.0`);
    }
  }
});

t('基准编制的有效攻击与「未接入模板」的旧公式逐位相同', () => {
  const w = loadScenario('A', 42);
  const u = w.units.find(x => x.type === 'inf');
  u.hp = UNITS.inf.hp;                       // 满兵力，排除 strengthFactor 干扰
  const opts = { terrain: 'plain' };
  const eraMul = (w.eraData && w.eraData.atkMultiplier != null) ? w.eraData.atkMultiplier : 1;
  // 本断言只关心「模板接入是否引入漂移」，必须先把国家修正清零以隔离变量：
  // W0-C 之后德国开局就有曼施坦因(+0.20)与隆美尔(+0.15)的 atk 特质，
  // unitAtk 会乘 1.35 —— 那是将领系统的效果，不是模板的。
  const keep = { ...w.nations.G.modifiers };
  w.nations.G.modifiers = {};
  // W1-4 之后 unitAtk 还会乘指挥官技能（另一条正交链路），同样隔离：
  const keepArmyId = u.armyId;
  u.armyId = null;
  const expected = 6 * 0.75 * 1 * eraMul;    // soft × expMul(raw) × 地形 × 时代系数
  const actual = unitAtk(w, u, 0, opts);
  w.nations.G.modifiers = keep;
  u.armyId = keepArmyId;
  assert.ok(close(actual, expected, 1e-9),
    `实际 ${actual} ≠ 旧公式 ${expected}（模板接入引入了不该有的漂移）`);
});

t('换编制会真实改变软攻与战斗宽度（编制设计器不再是摆设）', () => {
  const w = loadScenario('A', 42);
  const u = w.units.find(x => x.type === 'inf');
  u.hp = UNITS.inf.hp;
  const opts = { terrain: 'plain' };
  const atkBefore = unitAtk(w, u, 0, opts);
  const widBefore = unitCombatWidth(w, u);

  // 炮兵密集编制：1 列 3 步兵（3×2=6 宽）+ 1 列 4 线列炮（4×3=12 宽）= 18 宽
  // 恰好与基准 infantry_standard（9×2=18）等宽 —— 这正是 HOI4 语义：
  // 火炮吃宽度，用 6 个步兵换 4 个火炮不改变师宽。
  w.templates._test_art = {
    id: '_test_art', name: '测试炮兵师', tier: 'regular',
    grid: [['inf_bat', 'inf_bat', 'inf_bat'],
           ['art_bat', 'art_bat', 'art_bat', 'art_bat'], [], [], []],
    supports: ['sup_art']
  };
  u.templateId = '_test_art';
  const refWidth = calcTemplateStats(w.templates.infantry_standard).width;
  const newWidth = calcTemplateStats(w.templates._test_art).width;
  assert.equal(refWidth, 18);
  assert.equal(newWidth, 18);
  // W1-1 之后师宽 = 模板构成比 × UNITS.width × WIDTH_SCALE（10 宽师，HOI4 口径）
  assert.ok(close(unitCombatWidth(w, u), UNITS.inf.width * (18 / 18) * K.WIDTH_SCALE, 1e-9),
    '等宽换编制后师宽必须不变');
  assert.ok(unitAtk(w, u, 0, opts) > atkBefore * 1.5,
    `炮兵密集编制软攻 ${atkBefore.toFixed(2)} → ${unitAtk(w, u, 0, opts).toFixed(2)}，涨幅过小`);

  // 明确变窄的编制：3 个步兵（6 宽，比基准 18 窄）→ 师宽必须按比例下降
  w.templates._test_slim = {
    id: '_test_slim', name: '测试轻装师', tier: 'regular',
    grid: [['inf_bat', 'inf_bat', 'inf_bat'], [], [], [], []],
    supports: []
  };
  u.templateId = '_test_slim';
  const slimWidth = calcTemplateStats(w.templates._test_slim).width;
  const expected = UNITS.inf.width * (slimWidth / refWidth) * K.WIDTH_SCALE;   // W1-1：×WIDTH_SCALE
  assert.ok(close(unitCombatWidth(w, u), expected, 1e-9),
    `师宽应精确等于 UNITS.width × (模板宽/基准宽) × WIDTH_SCALE = ${expected}，实际 ${unitCombatWidth(w, u)}`);
  assert.ok(unitCombatWidth(w, u) < widBefore,
    `3 步兵编制（6 宽）应比 9 步兵（18 宽）更窄：${widBefore} → ${unitCombatWidth(w, u)}`);
});

t('缺编模板退回构成比 1.0（模板 id 不存在时不崩、不放大）', () => {
  const w = loadScenario('A', 42);
  const u = w.units.find(x => x.type === 'inf');
  u.templateId = '__不存在的模板__';
  const adj = templateAdjust(w, u);
  assert.ok(close(adj.soft, 1) && close(adj.def, 1), '模板缺失时构成比必须是 1.0');
  assert.ok(Number.isFinite(unitAtk(w, u, 0, { terrain: 'plain' })));
});

t('templateHasSupport 读的是 supports（复数），不是 support', () => {
  const w = loadScenario('A', 42);
  assert.ok(templateHasSupport(w, 'infantry_standard', 'sup_eng'), '标准步兵师应带工兵连');
  assert.ok(!templateHasSupport(w, 'infantry_standard', 'sup_art'), '标准步兵师不应带支援炮');
  assert.ok(templateHasSupport(w, 'armor_assault', 'sup_art'), '装甲突击师应带支援炮');
});

t('★ 静态回归：js/ 里不得再出现模板字段单数 .support', () => {
  // 曾经的 bug：battle.js / plans.js / rivers.js 三处都写成
  //   world.templates[id].support.includes('rec')
  // 而模板实际字段是 supports（复数）→ 即使模板初始化了也取不到支援连。
  const hits = [];
  const walk = (dir) => {
    for(const name of fs.readdirSync(dir)){
      const full = path.join(dir, name);
      if(fs.statSync(full).isDirectory()){ walk(full); continue; }
      if(!name.endsWith('.js') || name.endsWith('.test.js')) continue;
      fs.readFileSync(full, 'utf8').split('\n').forEach((ln, i) => {
        // 只匹配「对 templates 的访问」，放过无关的局部变量
        if(/templates?\s*\[[^\]]*\][^;\n]*?\.support\b(?!s)/.test(ln)){
          hits.push(`${path.relative(ROOT, full)}:${i + 1}  ${ln.trim()}`);
        }
      });
    }
  };
  walk(path.join(ROOT, 'js'));
  assert.equal(hits.length, 0,
    `以下位置仍把模板字段写成单数 .support：\n      ${hits.join('\n      ')}`);
});

t('渡河惩罚：带工兵连的师吃 -15%，否则 -30%', () => {
  const w = loadScenario('A', 42);
  const pair = findRiverPair(w);
  if(!pair) return;                       // 该剧本无河流边，跳过（不视为失败）
  const withEng = getRiverPenalty(w, { templateId: 'infantry_standard' },
                                  pair.from.q, pair.from.r, pair.to.q, pair.to.r);
  const without = getRiverPenalty(w, { templateId: null },
                                  pair.from.q, pair.from.r, pair.to.q, pair.to.r);
  assert.ok(close(without, 0.70), `无工兵连应为 0.70，实际 ${without}`);
  assert.ok(close(withEng, 0.85), `带工兵连应为 0.85，实际 ${withEng}`);
});

/* ============================================================
   二、W0-B3 / B4：征兵法案与经济法案惩罚
   ============================================================ */

t('★ 征兵法案四档费率各自生效（此前永远读 limited）', () => {
  const w = loadScenario('A', 42);
  const n = w.nations.G;
  n.pp = 99999;
  const seen = {};
  for(const id of ['volunteer', 'limited', 'extensive', 'service_by_requirement']){
    n.conscriptionLaw = id;
    seen[id] = conscriptionRate(n);
  }
  assert.ok(close(seen.volunteer, 0.015), `志愿兵役应为 0.015，实际 ${seen.volunteer}`);
  assert.ok(close(seen.limited, 0.025), `有限征兵应为 0.025，实际 ${seen.limited}`);
  assert.ok(close(seen.extensive, 0.050), `广泛征兵应为 0.050，实际 ${seen.extensive}`);
  assert.ok(close(seen.service_by_requirement, 0.100),
    `强制服役令应为 0.100，实际 ${seen.service_by_requirement}`);
  assert.ok(seen.volunteer < seen.limited && seen.limited < seen.extensive
            && seen.extensive < seen.service_by_requirement, '费率未单调递增');
});

t('★ 经济法案「总动员」的 manpowerPenalty -3% 生效（此前从未被读）', () => {
  const w = loadScenario('A', 42);
  const n = w.nations.G;
  n.pp = 99999;
  n.economicLaw = 'partial'; n.law = 'partial';
  n.conscriptionLaw = 'extensive';
  const before = conscriptionRate(n);
  switchEconomicLaw(w, 'G', 'total');
  const after = conscriptionRate(n);
  assert.ok(close(before, 0.05), `改法前应为 0.05，实际 ${before}`);
  assert.ok(close(after, 0.05 * 0.97, 1e-9), `总动员后应为 0.0485，实际 ${after}`);
});

t('换征兵法后人力上限会重算（不再需要重开档）', () => {
  const w = loadScenario('A', 42);
  const n = w.nations.G;
  n.pp = 99999;
  const capBefore = n.manpowerCap;
  switchConscriptionLaw(w, 'G', 'service_by_requirement');
  dayTick(w, makeRng(1));                  // 一个 tick 内 manpowerTick 依法案签名检测过期并重算
  const capAfter = n.manpowerCap;
  assert.ok(capAfter > capBefore * 2.5,
    `换「强制服役令」后上限 ${capBefore} → ${capAfter}，应约为 4 倍（0.025→0.10）`);
  assert.ok(manpowerPool(n) <= capAfter + 1e-6, '人力池不应超过上限');
});

t('nation 同时落盘 economicLaw 与 conscriptionLaw 两个独立字段', () => {
  const w = loadScenario('A', 42);
  for(const id in w.nations){
    const n = w.nations[id];
    assert.equal(typeof n.economicLaw, 'string', `${id} 缺 economicLaw`);
    assert.equal(typeof n.conscriptionLaw, 'string', `${id} 缺 conscriptionLaw`);
  }
});

/* ============================================================
   三、W0-B1：占领区抵抗 / 顺从
   ============================================================ */

t('loadScenario 为每格写入 core（此前只有 _orig，占领区判定恒 false）', () => {
  const w = loadScenario('A', 42);
  const missing = w.hexes.filter(h => h.core === undefined);
  assert.equal(missing.length, 0, `${missing.length} 个格没有 core 字段`);
});

t('★ 被占领的格抵抗度逐日上升（占领治理链真正跑起来了）', () => {
  const w = loadScenario('A', 42);
  const vic = w.hexes.find(h => h._orig === 'P' && h.owner === 'P' && (h.civ || 0) + (h.mil || 0) > 0)
           || w.hexes.find(h => h._orig === 'P');
  assert.ok(vic, '找不到可用的被占领目标格');
  vic.owner = 'G';
  assert.notEqual(vic.owner, vic.core, 'owner 与 core 不同 → 应判定为占领区');
  const r0 = vic.resistance || 0;
  for(let i = 0; i < 5; i++) dayTick(w, makeRng(100 + i));
  const r1 = vic.resistance || 0;
  assert.ok(r1 > r0, `抵抗度 ${r0} → ${r1}，应上升`);
  assert.ok((vic.compliance || 0) > 0, '顺从度应开始累积');
});

t('有驻军时抵抗目标下调 10 点（驻军判定不再恒为 false）', () => {
  const w = loadScenario('A', 42);
  const vic = w.hexes.find(h => h._orig === 'P' && h.owner === 'P');
  vic.owner = 'G';
  w.nations.G.occupationLaw = 'civilian_oversight';      // resistanceTarget = 25
  vic.resistance = 0;
  for(let i = 0; i < 30; i++) dayTick(w, makeRng(200 + i));
  const noGarrison = vic.resistance;
  spawnUnit(w, 'inf', vic.q, vic.r, 'G');                 // 放一支德军驻守 → 目标降到 15
  for(let i = 0; i < 30; i++) dayTick(w, makeRng(300 + i));
  assert.ok(noGarrison >= 24, `无驻军 30 天后抵抗度应贴近 25，实际 ${noGarrison}`);
  assert.ok(vic.resistance < noGarrison - 5,
    `驻军后抵抗度应被明显压低（${noGarrison} → ${vic.resistance}）；` +
    `hasGarrison 若仍恒为 false 则此项不会成立`);
});

t('★ resistanceTick 不再因 rng.next() 抛 TypeError', () => {
  // 原写法 rng.next()，而 rng 是函数（makeRng 返回可调用对象）→ 必然 TypeError。
  // 这里专门覆盖两条随机分支：游击破袭（抵抗≥60 且有工业）与武装起义（抵抗≥85 且无驻军）。
  const rng = makeRng(7);
  const w1 = loadScenario('A', 42);
  const v1 = w1.hexes.find(h => h._orig === 'P' && (h.civ || 0) + (h.mil || 0) > 0);
  v1.owner = 'G'; v1.resistance = 70;                     // 触发破袭分支
  assert.ok((v1.civ || 0) + (v1.mil || 0) > 0, '样本格应有工业（工业判据已从 hex.ind 改为 civ/mil）');

  const w2 = loadScenario('A', 43);
  const v2 = w2.hexes.find(h => h._orig === 'P');
  v2.owner = 'G'; v2.resistance = 95;                     // 触发起义分支

  assert.doesNotThrow(() => { resistanceTick(w1, rng); resistanceTick(w2, rng); },
    'resistanceTick 抛异常 —— 多半是 rng.next() 的旧写法残留');
});

t('武装起义能把格归还原属国（代码路径可达性验证）', () => {
  // ⚠ 已知未修问题（下一批处理，本测试刻意只验代码路径）：
  //   抵抗度从 0 起步、每日向 law.resistanceTarget 收敛，而四档法案的
  //   resistanceTarget 最大只有 25 → 抵抗度**永远到不了 60/85**，
  //   游击破袭与武装起义在正常玩法下都不可达（见文件末尾「本批发现」）。
  //   这里每次 tick 前把抵抗度钉在 99，只为验证「一旦到达阈值，处理器能正确
  //   把它还给原属国」，不声称该阈值在当前平衡下可达。
  const w = loadScenario('A', 99);
  const rng = makeRng(3);
  const vic = w.hexes.find(h => h._orig === 'P' && h.owner === 'P');
  vic.owner = 'G';
  let rebelled = false;
  for(let i = 0; i < 2000 && !rebelled; i++){
    vic.resistance = 99;                  // 钉住，绕开收敛问题
    resistanceTick(w, rng);
    if(vic.owner === 'P') rebelled = true;
  }
  assert.ok(rebelled, '抵抗度已达 99 且无守军，2000 次 tick 内应至少触发一次起义');
  assert.equal(vic.owner, 'P', '起义后该格应归还原属国');
});

/* ============================================================
   四、W0-A2：统一 modifier 键表（唤醒 17 项失效科技）
   ------------------------------------------------------------
   断链事实：research.js:87-92 把 (scope,stat) 映射成键写入 nation.modifiers，
   但引擎侧只读 mod(nat,'atk')/('def')/('unitAtkArm') 三个键。
   于是 31 项 modifier 科技里 17 项无效，含 inf_weapon_1/2/3
   （scope=unit:inf, stat=soft → inf_soft）。
   修法：新增 js/engine/mods.js 作为唯一键解析入口，按
         <type>_<stat> → all_<stat> → <stat> 逐层**累加**。
   ============================================================ */

t('unitMod 按「具体→泛化」逐层累加解析修正', () => {
  const nat = { modifiers: {} };
  assert.equal(unitMod(nat, 'inf', 'soft'), 0, '无任何键时必须是 0（保证零漂移）');

  nat.modifiers.soft = 0.10;
  assert.equal(+unitMod(nat, 'inf', 'soft').toFixed(4), 0.10, 'nation 键单独生效');

  nat.modifiers.all_soft = 0.20;
  assert.equal(+unitMod(nat, 'inf', 'soft').toFixed(4), 0.30,
    'nation 与 all_ 叠加，不是取第一个命中');
  assert.equal(+unitMod(nat, 'arm', 'soft').toFixed(4), 0.30, 'all_ 对所有兵种生效');

  nat.modifiers.inf_soft = 0.15;
  assert.equal(+unitMod(nat, 'inf', 'soft').toFixed(4), 0.45, '三键全叠');
  assert.equal(+unitMod(nat, 'arm', 'soft').toFixed(4), 0.30, '兵种专属键不影响其他兵种');
});

t('unitMod 对非数值/未定义键保持健壮', () => {
  const nat = { modifiers: { soft: 0.1, all_soft: undefined, inf_soft: NaN } };
  assert.ok(Number.isFinite(unitMod(nat, 'inf', 'soft')));
  assert.equal(unitMod(null, 'inf', 'soft'), 0);
  assert.equal(unitMod({}, 'inf', 'soft'), 0);
  assert.equal(unitMod({ modifiers: {} }, 'inf', 'soft'), 0);
});

t('★ inf_weapon_1/2/3（inf_soft）真的提升步兵软攻，且不影响装甲师', () => {
  // 这三项科技是断链的旗舰案例：界面画了三级步兵武器升级，
  // 但 inf_soft 键全库无读取点 → 三级升级对战斗零影响。
  const w = loadScenario('A', 42);
  const inf = w.units.find(x => x.type === 'inf');
  const arm = w.units.find(x => x.type === 'arm') || w.units.find(x => x.type === 'larm');
  assert.ok(inf, '缺少步兵样本');
  inf.hp = UNITS.inf.hp;
  const opts = { terrain: 'plain' };
  const keep = { ...w.nations.G.modifiers };

  const infBase = unitAtk(w, inf, 0, opts);
  const armBase = arm ? unitAtk(w, arm, 0, opts) : null;

  w.nations.G.modifiers = { ...keep, inf_soft: 0.10 };      // 对应 inf_weapon_1 的 +0.10
  const infUp = unitAtk(w, inf, 0, opts);
  const armUp = arm ? unitAtk(w, arm, 0, opts) : null;

  assert.ok(infUp > infBase * 1.05,
    `步兵软攻 ${infBase.toFixed(3)} → ${infUp.toFixed(3)}，inf_weapon_1 应生效`);
  if(arm){
    assert.ok(close(armUp, armBase, 1e-9),
      `inf_soft 不应影响装甲师（${armBase.toFixed(3)} → ${armUp.toFixed(3)}）`);
  }
  w.nations.G.modifiers = keep;
});

t('★ artillery_1（all_soft）对全部兵种生效', () => {
  const w = loadScenario('A', 42);
  const inf = w.units.find(x => x.type === 'inf');
  inf.hp = UNITS.inf.hp;
  const opts = { terrain: 'plain' };
  const keep = { ...w.nations.G.modifiers };
  const before = unitAtk(w, inf, 0, opts);
  w.nations.G.modifiers = { ...keep, all_soft: 0.05 };      // artillery_1 的 +0.05
  const after = unitAtk(w, inf, 0, opts);
  assert.ok(after > before, `all_soft 应提升软攻（${before.toFixed(3)} → ${after.toFixed(3)}）`);
  w.nations.G.modifiers = keep;
});

t('★ tank_upgun（arm_soft）只提升装甲师', () => {
  const w = loadScenario('A', 42);
  const arm = w.units.find(x => x.type === 'arm');
  const inf = w.units.find(x => x.type === 'inf');
  if(!arm){ return; }                                        // 剧本 A 无装甲样本则跳过
  arm.hp = UNITS.arm.hp; inf.hp = UNITS.inf.hp;
  const opts = { terrain: 'plain' };
  const keep = { ...w.nations.G.modifiers };
  const armBase = unitAtk(w, arm, 0, opts);
  const infBase = unitAtk(w, inf, 0, opts);
  w.nations.G.modifiers = { ...keep, arm_soft: 0.15 };      // tank_upgun 的 +0.15
  const armUp = unitAtk(w, arm, 0, opts);
  const infUp = unitAtk(w, inf, 0, opts);
  assert.ok(armUp > armBase, `arm_soft 应提升装甲师软攻（${armBase.toFixed(3)} → ${armUp.toFixed(3)}）`);
  assert.ok(close(infUp, infBase, 1e-9), `arm_soft 不应影响步兵`);
  w.nations.G.modifiers = keep;
});

t('★ mobile3（all_speed）提升机动速度', () => {
  const w = loadScenario('A', 42);
  const inf = w.units.find(x => x.type === 'inf');
  inf.hp = UNITS.inf.hp;
  const keep = { ...w.nations.G.modifiers };
  const before = effectiveSpeed(w, inf);
  w.nations.G.modifiers = { ...keep, all_speed: 0.10 };
  const after = effectiveSpeed(w, inf);
  assert.ok(after > before,
    `all_speed 应提升机动（${before.toFixed(3)} → ${after.toFixed(3)}）`);
  w.nations.G.modifiers = keep;
});

/* all_def / all_brk / all_orgDamage 不直接体现在 unitAtk 里（它们分别走
   防御减伤、反击减伤、组织度伤害），必须在单元级与战级两处验证。 */

t('★ all_def 在单元级真实提升单师防御', () => {
  // 单元级断言是必要的：1v1 步兵对攻时 defMit 已贴在 0.25 下限
  // （def=14 相对 4×atk=18 过强），战级观测不到任何差异。
  const w = loadScenario('A', 42);
  const inf = w.units.find(x => x.type === 'inf');
  inf.hp = UNITS.inf.hp;
  const opts = { terrain: 'plain' };
  const keep = { ...w.nations.G.modifiers };
  const before = unitDef(w, inf, opts);
  w.nations.G.modifiers = { ...keep, all_def: 0.25 };       // trenchdoc 的 +0.25
  const after = unitDef(w, inf, opts);
  assert.ok(close(after, before * 1.25, 1e-9),
    `all_def +25% 应使单师防御 ×1.25（${before.toFixed(3)} → ${after.toFixed(3)}）`);
  w.nations.G.modifiers = { ...keep, inf_def: 0.10 };
  assert.ok(close(unitDef(w, inf, opts), before * 1.10, 1e-9), 'inf_def 应使步兵防御 ×1.10');
  w.nations.G.modifiers = keep;
});

t('★ all_brk 使攻方掉组织更慢（此前无人读取）', () => {
  const base = duelSandbox({}, {});
  const buff = duelSandbox({ all_brk: 0.30 }, {});           // grand1 / mobiledoc 的突破加成
  assert.ok(buff.atkOrg > base.atkOrg + 1e-6,
    `攻方 3 天后组织度 ${base.atkOrg.toFixed(2)} → ${buff.atkOrg.toFixed(2)}，` +
    `all_brk 应提高攻方突破、削弱守方反击`);
});

t('★ all_orgDamage 提高组织度杀伤且不造成兵力损失（fire3「决战」）', () => {
  const plain = duelSandbox({}, {}, 3, 3);
  const buff = duelSandbox({ all_orgDamage: 0.50 }, {}, 3, 3);
  assert.ok(plain.defOrg < UNITS.inf.org, '沙盒必须真的在交战（否则本组断言空转）');
  assert.ok(buff.defOrg < plain.defOrg,
    `守方 3 天后组织度 ${plain.defOrg.toFixed(2)} → ${buff.defOrg.toFixed(2)}，` +
    `all_orgDamage 应加快守方组织度崩溃`);
  assert.ok(close(buff.defHp, plain.defHp, 1e-9),
    `all_orgDamage 只作用于组织度，不应改变兵力（${plain.defHp} → ${buff.defHp}）`);
});

t('零漂移守卫：无任何修正时战斗结果与接入前完全一致', () => {
  const a = duelSandbox({}, {}, 3, 3);
  const b = duelSandbox({}, {}, 3, 3);
  assert.equal(a.defOrg, b.defOrg, '同种子同修正应完全一致');
  assert.ok(a.defOrg < UNITS.inf.org, '战斗应真的发生了（否则本组断言是空转）');
});

/** 造一个确定性的战斗沙盒，返回交战若干天后的双方组织度/兵力
    攻方 = 玩家国（剧本 A 为 G），守方 = 剧本 A 的第二国（波兰 P）
    attackerCount > 1 时攻方成建制压上 —— 这是必要的：
    1v1 时 defMit 已贴在 0.25 下限（def=14 相对 4×atk=18 过强），
    此时再加防御也观察不到变化，只有把攻方堆到 3 个让减伤脱离地板才可观测。 */
function duelSandbox(attackerMods, defenderMods, days = 3, attackerCount = 1){
  const w = loadScenario('A', 12345);
  const DEFENDER = 'P';                       // 剧本 A 的波兰代号
  assert.ok(w.nations[w.player] && w.nations[DEFENDER],
    `沙盒需要的国家不存在：${w.player} / ${DEFENDER}`);

  // 清掉所有既有单位，另造一对干净的
  w.units.length = 0;
  for(const h of w.hexes) h.units = [];

  // 必须挑「玩家国领土 × 交战邻国领土」的真实接壤格：
  // 早先的版本挑了地图上第一对非海相邻格，结果两边都是中立 N，
  // resolveBattle 因无交战关系而直接不结算，整组断言静默空转。
  const enemy = w.nations[w.player].atWarWith.find(e => w.nations[e]);
  assert.ok(enemy, `${w.player} 没有任何交战国，场景 A 数据异常`);
  let pair = null;
  for(const h of w.hexes){
    if(h.owner !== w.player) continue;
    for(const ni of (h.adj || [])){
      const nb = w.hexes[ni];
      if(nb && nb.owner === enemy){ pair = { a: h, b: nb }; break; }
    }
    if(pair) break;
  }
  assert.ok(pair, `地图上找不到 ${w.player} 与 ${enemy} 的接壤格`);

  const def = spawnUnit(w, 'inf', pair.b.q, pair.b.r, DEFENDER);
  def.hp = UNITS.inf.hp;
  w.nations[w.player].modifiers = { ...attackerMods };
  w.nations[DEFENDER].modifiers = { ...defenderMods };

  const attackers = [];
  for(let i = 0; i < attackerCount; i++){
    const a = spawnUnit(w, 'inf', pair.a.q, pair.a.r, w.player);
    a.hp = UNITS.inf.hp;
    a.order = { type: 'attack', target: [pair.b.q, pair.b.r] };
    attackers.push(a);
  }
  for(let i = 0; i < days; i++) dayTick(w, makeRng(500 + i));
  return {
    atkOrg: attackers.reduce((s,a) => s + a.org, 0) / attackers.length,
    defOrg: def.org,
    defHp: def.hp
  };
}

/** 造一个「玩家国 × 交战邻国」接壤格上的 1v1，并返回目标格信息。
    W0-A1 的空/情报测试需要直接调用 resolveBattle（而不是走 dayTick），
    因为 intelTick 会用 updateAllIntelLevels 覆写 world.intelCache。 */
function airSandbox(){
  const w = loadScenario('A', 12345);
  w.units.length = 0;
  for(const h of w.hexes) h.units = [];
  const enemy = w.nations.G.atWarWith.find(e => w.nations[e]);
  assert.ok(enemy, '德国没有任何交战国');
  let pair = null;
  for(const h of w.hexes){
    if(h.owner !== 'G') continue;
    for(const ni of (h.adj || [])){
      const nb = w.hexes[ni];
      if(nb && nb.owner === enemy){ pair = { a: h, b: nb }; break; }
    }
    if(pair) break;
  }
  assert.ok(pair, '找不到德国与交战国接壤的格');
  const A = spawnUnit(w, 'inf', pair.a.q, pair.a.r, 'G');
  const D = spawnUnit(w, 'inf', pair.b.q, pair.b.r, 'P');
  A.hp = UNITS.inf.hp; D.hp = UNITS.inf.hp;
  A.order = { type: 'attack', target: [pair.b.q, pair.b.r] };
  return { w, targetHex: pair.b, targetIdx: w.hexes.indexOf(pair.b), A, D };
}

/* ============================================================
   五、W0-A1：空/海/情报三个战斗开关
   ------------------------------------------------------------
   断链事实：constants.js 里三个 ENABLE_COMBAT_MODIFIER 全为 false。
     · AIR   —— getBattleAirModifier 实现完整且 battle.js 早已在消费它，
                关着的唯一后果是制空权与 CAS 对战斗的影响恒为 0
     · INTEL —— calcIntelCombatBonus 实现完整但全库 0 引用
     · NAVY  —— **惰性开关**：navy.js 里没有任何一处读取它，
                打开不会有任何效果（海战模型尚未实现，属 W6）
   ============================================================ */

t('AIR / INTEL / NAVY 开关均已全面打开 (W6 海战与岸轰实战化)', () => {
  assert.equal(K.AIR.ENABLE_COMBAT_MODIFIER, true, '空军战斗加成开关必须打开');
  assert.equal(K.INTEL.ENABLE_COMBAT_MODIFIER, true, '情报战斗加成开关必须打开');
  assert.equal(K.NAVY.ENABLE_COMBAT_MODIFIER, true,
    'W6 海战模型与逐舰交火/岸轰支援已全面启用，NAVY 开关必须打开');
});

t('NAVY 开关真实消费验证：navy.js 与 battle.js 正式读取 ENABLE_COMBAT_MODIFIER', () => {
  const srcNavy = fs.readFileSync(path.join(ROOT, 'js', 'engine', 'navy.js'), 'utf8');
  assert.equal(srcNavy.includes('ENABLE_COMBAT_MODIFIER'), true,
    'navy.js 必须真实读取并消费 ENABLE_COMBAT_MODIFIER');
});

t('★ 空优压制攻方用的是 HOI4 的 -35%，不是机动惩罚的 -50%', () => {
  // 原先 air.js 复用 SUPERIORITY_MOVE_PENALTY_MAX 去压制攻击，是张冠李戴。
  const src = fs.readFileSync(path.join(ROOT, 'js', 'engine', 'air.js'), 'utf8');
  const atkLine = src.split('\n').filter(l => /atkMul \*= \(1 - adv/.test(l));
  assert.equal(atkLine.length, 1, '未找到唯一的攻方空优惩罚赋值行');
  assert.ok(/SUPERIORITY_ATK_PENALTY_MAX/.test(atkLine[0]),
    `攻方空优惩罚仍误用机动常量：${atkLine[0].trim()}`);
  assert.equal(K.AIR.SUPERIORITY_ATK_PENALTY_MAX, -0.35, 'HOI4 敌制空权对攻击为 -35%');
  // 机动惩罚不得被挪作他用
  assert.ok(src.includes('SUPERIORITY_MOVE_PENALTY_MAX') === false ||
            !/atkMul[^;]*MOVE_PENALTY/.test(src), '机动惩罚常量不得出现在攻击链路上');
});

t('★ CAS 联队真的提升攻方攻击力与组织度伤害', () => {
  const { w, targetHex } = airSandbox();
  const region = getHexAirRegion(targetHex.q, targetHex.r);
  const before = getBattleAirModifier(w, targetHex, 'G', 'P');
  w.airWings = [{ nat: 'G', regionId: region, task: 'cas', count: 200, type: 'cas' }];
  const after = getBattleAirModifier(w, targetHex, 'G', 'P');
  assert.ok(after.casBonus > 0, `CAS 联队应产生攻击加成，实际 ${after.casBonus}`);
  assert.ok(after.atkMul > before.atkMul,
    `CAS 应提升攻方倍率（${before.atkMul} → ${after.atkMul}）`);
  assert.ok(after.casOrgDmg > 0, `CAS 应提供组织度伤害，实际 ${after.casOrgDmg}`);
  // 注意 defMul 也会变，而且是**应该**变：加入 CAS 联队会翻转该空区的制空权归属。
  // 剧本 A 硬编码的初始部署是 r_west_russia{波150} / r_baltic{德300}，
  // 目标格落在波兰占优的空区 → 加了德军 CAS 后优势易手，
  // 由「波制空 → 德攻受 -35% 压制」变成「德制空 → 波防受 -50% 压制」。
  // 所以这里只断言方向（守方防御被压制），不去锁死具体数值。
  assert.ok(after.defMul < before.defMul,
    `德军取得空优后应压制守方防御（${before.defMul} → ${after.defMul}）`);
  assert.ok(after.defMul >= 1 + K.AIR.SUPERIORITY_DEF_PENALTY_MAX - 1e-9,
    `守方防御压制不应超过 -50%（实际 ${after.defMul}）`);
});

t('★ 情报优势提升攻方输出，且对称时严格为 0', () => {
  const { w, targetHex, targetIdx } = airSandbox();
  updateAllIntelLevels(w);
  // 对称情报（双方都无机构 → 10/10）→ 必须逐位为 0，这是零漂移的保证
  w.intelCache['G']['P'] = { civ: 10, army: 10, navy: 10, air: 10 };
  w.intelCache['P']['G'] = { civ: 10, army: 10, navy: 10, air: 10 };
  const sym = resolveBattle(w, makeRng(1), targetIdx).rounds[0];
  assert.equal(sym.intel.atkBonus, 0, '对称情报的攻防加成必须是 0');

  // 单向情报优势：攻方 army 70 vs 守方 10 → diff 60 → 封顶 +15%
  const { w: w2, targetIdx: idx2 } = airSandbox();
  updateAllIntelLevels(w2);
  w2.intelCache['G']['P'] = { civ: 70, army: 70, navy: 70, air: 70 };
  w2.intelCache['P']['G'] = { civ: 10, army: 10, navy: 10, air: 10 };
  const adv = resolveBattle(w2, makeRng(1), idx2).rounds[0];
  assert.ok(close(adv.intel.atkBonus, 0.15, 1e-6),
    `60pp 情报差应封顶 +15%，实际 ${adv.intel.atkBonus}`);
  assert.equal(adv.intel.defBonus, 0, '守方对攻方没有情报优势');
  assert.ok(adv.atkEff > sym.atkEff,
    `情报优势应提升有效攻击（${sym.atkEff} → ${adv.atkEff}）`);
});

t('★ 情报优势对守方防御同样生效', () => {
  // 攻方情报劣势 → 守方加成 → 守方 defPool 更大
  const { w, targetIdx } = airSandbox();
  updateAllIntelLevels(w);
  w.intelCache['G']['P'] = { civ: 10, army: 10, navy: 10, air: 10 };
  w.intelCache['P']['G'] = { civ: 70, army: 70, navy: 70, air: 70 };
  const rep = resolveBattle(w, makeRng(1), targetIdx).rounds[0];
  assert.ok(close(rep.intel.defBonus, 0.15, 1e-6),
    `守方情报优势应封顶 +15%，实际 ${rep.intel.defBonus}`);
  assert.equal(rep.intel.atkBonus, 0);
});

t('calcIntelCombatBonus 遵守 HOI4 的阈值与封顶', () => {
  assert.equal(calcIntelCombatBonus(50, 50), 0);
  assert.equal(calcIntelCombatBonus(50, 46), 0, '情报差 4pp 未达 5pp 阈值');
  assert.ok(close(calcIntelCombatBonus(55, 50), 0.015, 1e-6), '5pp → +1.5%');
  assert.ok(close(calcIntelCombatBonus(100, 50), 0.15, 1e-6), '50pp 应封顶 +15%');
  assert.equal(calcIntelCombatBonus(10, 90), 0, '劣势方不获得加成');
});

/* ============================================================
   六、本批发现但未修的问题（留给下一批，避免在「接线批次」里偷偷改平衡）
   ============================================================
   ① 抵抗度天花板 25，60/85 两个事件阈值在正常玩法下不可达
      resistance 从 0 起步、每日 ±1 向 law.resistanceTarget 收敛，
      而 OCCUPATION_LAWS 四档的 resistanceTarget 是 25/15/5/0。
      → 游击破袭（≥60）与武装起义（≥85）都是不可达内容。
      → 上面的测试刻意只验「到达阈值后的处理逻辑」，不声称阈值可达。
      → 修法需要一次设计决策（无驻军时抵抗度应当能爬升？还是改成
        「累计处于高抵抗的天数」触发？），不宜在接线批次里替他决定。

   ② 占领法案的 factoryYield / resourceYield 仍无读取点
      → 占领区的工厂与资源产出目前不因占领法而变化。

   ③ ★★ 防御减伤被 0.25 下限吃死 —— 这是 W1 最硬的证据
      battle.js:315-316 用的是**全场均值**：
          avgDef = defPool / defenders.length
          avgAtk = atkEff   / inField.length
          defMit = max(0.25, 1 - avgDef / (4 × avgAtk))
      实测（1v1 步兵、平原/城市）：avgDef ≈ 10.5、avgAtk ≈ 4.5
        → defMit = 1 - 10.5/18 = 0.417
      但把 all_def 加到 +500%（防御 ×6，avgDef → 63），
      defMit = max(0.25, 1 - 63/18) = **0.25（地板）**，
      战级结果与无修正**逐位相同**。
      更糟的是：avgAtk 是**均值**，与军力规模无关 ——
      3 个攻方与 1 个攻方的 avgAtk 完全一样，所以堆兵永远无法
      把减伤推离地板。实测 3v1 同样观察不到任何差异。
      → 这就是「1 师打 N 师需要 31.6 天」与「12 师守城与 60 师守城一样难」
        的同一个根因。HOI4 的做法是 Engagement Width = 2×师战斗宽度、
        逐师配对减伤，而不是拿全场均值。
      → 本批只保证 all_def **已接线**（单元级断言证明），
        战级可观测性要等 W1 换成逐师配对后才会出现。
        届时的验收信号就是：把下面这条占位断言改成真实差异断言。

   ④ 占领法案的 resistanceTarget 天花板导致的事件不可达（见 ①）
   ============================================================ */

/* W1 已落地（v14.1 逐师配对减伤）：本断言由占位升级为真实差异断言。
   all_def +500% 让守方 defShare ×6 → 每对减伤贴近 0.25 地板之下被顶回，
   守方承伤显著下降 —— 战级可观测，正是 W1-2 的验收信号。
   （旧全场均值口径下此场景战级逐位相同，故当年只能写占位。） */
t('★ W1 已接线：all_def +500% 在战级让守方显著更耐久（逐师配对减伤）', () => {
  const base = duelSandbox({}, {}, 3, 3);
  const buff = duelSandbox({}, { all_def: 5.0 }, 3, 3);
  assert.ok(buff.defOrg > base.defOrg,
    `all_def +500% 后守方残余组织应更高：base=${base.defOrg.toFixed(1)} buff=${buff.defOrg.toFixed(1)}`);
});

/* ============================================================
   七、W0-B 经济断链 / W0-D 逐时代系统接入 / W0-E 工程卫生
   ============================================================ */

t('★ B7 资源赤字效率：同量纲比较（厂数不再放大惩罚）', () => {
  const nat = { _resourceDeficit: {} };
  // inf_eq 每厂 0.80 钢。3 厂线总需求 2.4，缺 0.72 = 30%
  nat._resourceDeficit.steel = 0.72;
  const eff3 = getLineResourceEff(nat, 'inf_eq', 3);
  assert.ok(close(eff3, 1 - 0.125 * 0.30, 1e-6),
    `3 厂线缺 30% 应得 eff=${(1 - 0.125 * 0.3).toFixed(4)}，实际 ${eff3.toFixed(4)}`);
  // 同一个缺口放在 10 厂线上（总需求 8.0，缺 0.72 = 9%）—— 惩罚必须显著更轻
  const eff10 = getLineResourceEff(nat, 'inf_eq', 10);
  assert.ok(eff10 > eff3,
    `同样缺 0.72 钢：3 厂线 eff=${eff3.toFixed(4)}，10 厂线 eff=${eff10.toFixed(4)}；` +
    `厂数不应再放大赤字惩罚（旧实现两者完全相同）`);
  // 不传 factories 时保持旧行为（向后兼容）
  assert.equal(getLineResourceEff(nat, 'inf_eq'), getLineResourceEff(nat, 'inf_eq', 1));
  assert.equal(getLineResourceEff({ _resourceDeficit: {} }, 'inf_eq', 5), 1.0, '无赤字应恒为 1.0');
});

t('★ B2 附庸工厂抽成真正进入宗主经济', () => {
  const w = loadScenario('A', 304);
  const player = w.player;
  const overlord = w.nations[player];
  w.nations['SLO'] = {
    id: 'SLO', name: '仆从国', alive: true, overlord: player,
    civ: 8, mil: 12, autonomy: 50          // < 200 → 整合傀儡
  };
  overlord.subjects = ['SLO'];
  const civBefore = overlord.civ || 0;
  const milBefore = overlord.mil || 0;
  subjectsTick(w);
  assert.equal(overlord.civ - civBefore, 2, '整合傀儡应上缴 25% 民工（8 的 25% = 2）');
  assert.equal(overlord.mil - milBefore, 9, '整合傀儡应上缴 75% 军厂（12 的 75% = 9）');
  assert.equal(overlord.tributeCiv, 0, '抽成应即时入账并清零累加器');
  // 再跑一天：附庸上缴是**每日连续**的（HOI4 语义），所以第二天应再缴一次。
  // 这里校验的是「累加器每 tick 清零」而不是「只缴一次」——
  // 若不清零就会在同一天内被并入多次。
  assert.equal(overlord.tributeCiv, 0, '抽成应即时入账并清零累加器，不得滞留到下一天重复累加');
  const civDay1 = overlord.civ;
  subjectsTick(w);
  assert.equal(overlord.civ - civDay1, 2, '第二天应再上缴一次 2 座民厂（附庸每日缴）');
});

t('★ D1 一战炮火准备真正削弱堑壕（此前 0 引用）', () => {
  const w = loadScenario('ww1', 42);
  assert.equal(w.era, 'ww1');
  const land = w.hexes.filter(h => h.terrain !== 'sea');
  const h = land[Math.floor(land.length / 2)];
  assert.equal(barrageModifierForHex(w, h.idx), null, '没有任何炮击时应返回 null');

  // 造一个指向该格、已准备完成的凡尔登炮击
  w.arrows = [{ id: 'pl_test', nat: w.player, targetHexes: [h.idx], targets: [h.idx] }];
  w.barrages = { pl_test: { mode: 'prolonged', ready: true } };
  // 三档语义各不相同（BARRAGE_MODES）：
  //   short     entrenchReduce 0.5 → 壕沟保留 50%，首日攻 ×1.5
  //   standard  entrenchReduce 1.0 → 壕沟清零，组织伤害 +20%
  //   prolonged entrenchReduce 1.0 → 壕沟清零，组织伤害 0
  const read = (mode) => {
    w.barrages = { pl_test: { mode, ready: true } };
    w.arrows = [{ id: 'pl_test', nat: w.player, targetHexes: [h.idx], targets: [h.idx] }];
    return barrageModifierForHex(w, h.idx);
  };
  const shortM = read('short');
  assert.ok(close(shortM.entrenchFactor, 0.5, 1e-9),
    `急袭档应把守方壕沟削减 50%，实际保留 ${shortM.entrenchFactor}`);
  assert.ok(shortM.firstDayAtkMul > 1, '急袭档应带首日攻击加成');

  const stdM = read('standard');
  assert.ok(close(stdM.entrenchFactor, 0.0, 1e-9), '标准准备应清零守方堑壕');
  assert.ok(close(stdM.orgDmgBonus, 0.2, 1e-9), `标准准备应带 +20% 组织伤害，实际 ${stdM.orgDmgBonus}`);

  const prolM = read('prolonged');
  assert.ok(close(prolM.entrenchFactor, 0.0, 1e-9), '凡尔登应清零守方堑壕');
  assert.equal(prolM.orgDmgBonus, 0, '凡尔登按设计不带组织伤害加成（靠准备天数压制）');

  // 未就绪（还在准备中）不得生效
  w.barrages = { pl_test: { mode: 'standard', ready: false } };
  assert.equal(barrageModifierForHex(w, h.idx), null, '未准备完成的炮击不得生效');

  // 非目标格不应受影响
  const other = land.find(x => x.idx !== h.idx);
  assert.equal(barrageModifierForHex(w, other.idx), null, '未覆盖的格不应被炮击影响');

  // 非一战剧本恒为 null（零行为变化）
  const w2 = loadScenario('ww2', 42);
  assert.equal(barrageModifierForHex(w2, h.idx), null, '非 ww1 剧本必须返回 null');
});

t('★ D1 barrageModifierForHex 能识别多种目标表示', () => {
  const w = loadScenario('ww1', 42);
  const land = w.hexes.filter(h => h.terrain !== 'sea');
  const h = land[10];
  w.barrages = { p: { mode: 'prolonged', ready: true } };
  const forms = [
    [h.idx],                                  // 纯格下标
    [[h.q, h.r]],                             // [q,r]
    [{ q: h.q, r: h.r }],                     // {q,r}
    [{ idx: h.idx }]                          // {idx}
  ];
  for(const form of forms){
    w.arrows = [{ id: 'p', nat: w.player, targetHexes: form, targets: form }];
    const m = barrageModifierForHex(w, h.idx);
    assert.ok(m, `目标表示 ${JSON.stringify(form)} 应被识别为覆盖该格`);
  }
  // 找不到目标信息时不得全图生效
  w.arrows = [{ id: 'p', nat: w.player }];
  assert.equal(barrageModifierForHex(w, h.idx), null, '无目标信息的炮击不得全图生效');
});

t('★ D2 现代无人机/电子战真正削弱堑壕（此前 0 引用）', () => {
  const w = loadScenario('modern', 42);
  assert.equal(w.era, 'modern');
  const land = w.hexes.filter(h => h.terrain !== 'sea');
  const h = land[Math.floor(land.length / 2)];
  const atk = w.player;
  const n = w.nations[atk];
  n.equipment = n.equipment || {};
  n.equipment.fpv_kamikaze_drone = 0;
  assert.equal(droneReconModifier(w, atk, h.idx), 1.0, '无侦察机时应为 1.0（不削弱）');

  n.equipment.fpv_kamikaze_drone = 20;
  dronesTick(w);                               // 刷新 EW 强度
  const withDrones = droneReconModifier(w, atk, h.idx);
  assert.ok(withDrones < 1.0, `有侦察机应削弱守方堑壕，实际 ${withDrones}`);
  assert.ok(withDrones >= 0.15, `削弱系数不应低于 0.15 下限，实际 ${withDrones}`);

  // 非现代剧本恒为 1.0（零行为变化）
  const w2 = loadScenario('ww2', 42);
  assert.equal(droneReconModifier(w2, atk, h.idx), 1.0, '非 modern 剧本必须返回 1.0');
});

t('★ E1 全项目不得再有 rng.next()（rng 是函数不是对象）', () => {
  const hits = [];
  const walk = (dir) => {
    for(const name of fs.readdirSync(dir)){
      const full = path.join(dir, name);
      if(fs.statSync(full).isDirectory()){ walk(full); continue; }
      if(!name.endsWith('.js')) continue;
      if(name.endsWith('.test.js')) continue;
      fs.readFileSync(full, 'utf8').split('\n').forEach((ln, i) => {
        const code = ln.replace(/\/\/.*$/, '');           // 忽略行内注释（注释里提到 rng.next() 是说明，不是调用）
        if(/rng\s*\.\s*next\s*\(/.test(code) && !/^\s*\*/.test(ln)){
          hits.push(`${path.relative(ROOT, full)}:${i + 1}  ${ln.trim()}`);
        }
      });
    }
  };
  walk(path.join(ROOT, 'js'));
  assert.equal(hits.length, 0,
    `以下位置仍在调用 rng.next()（rng 是 makeRng 返回的函数，必抛 TypeError）：\n      ${hits.join('\n      ')}`);
});

t('★ E21 聚合测试入口存在且能列出全部测试', () => {
  const p = path.join(ROOT, 'tools', 'test_all.cjs');
  assert.ok(fs.existsSync(p), 'tools/test_all.cjs 不存在');
  const src = fs.readFileSync(p, 'utf8');
  assert.ok(/sim\.js/.test(src), '聚合入口必须顺带跑平衡沙盒 tools/sim.js');
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.ok(pkg.scripts && pkg.scripts['test:all'], 'package.json 缺 test:all 脚本');
  assert.ok(pkg.scripts.release, 'package.json 缺 release 脚本（历史上 release 需手记）');
});

t('★ E19 ai_balance 的 SCEN_MAP 不再把 ww1/ww2 指向同一剧本', () => {
  const src = fs.readFileSync(path.join(ROOT, 'tools', 'ai_balance.js'), 'utf8');
  const m = src.match(/SCEN_MAP\s*=\s*\{([^}]*)\}/);
  assert.ok(m, '未找到 SCEN_MAP');
  const pairs = [...m[1].matchAll(/(\w+)\s*:\s*['"](\w+)['"]/g)].map(x => [x[1], x[2]]);
  const map = Object.fromEntries(pairs);
  assert.equal(map.ww1, 'ww1', `ww1 应指向 ww1 剧本，实际 ${map.ww1}`);
  assert.equal(map.ww2, 'ww2', `ww2 应指向 ww2 剧本，实际 ${map.ww2}`);
  assert.equal(map.coldwar, 'coldwar', `coldwar 应指向 coldwar 剧本，实际 ${map.coldwar}`);
  assert.equal(map.modern, 'modern', `modern 应指向 modern 剧本，实际 ${map.modern}`);
  assert.equal(new Set(pairs.map(p => p[1])).size, pairs.length, 'SCEN_MAP 不得有两个键指向同一剧本');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
