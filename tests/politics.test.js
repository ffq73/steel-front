/* ============================================================
   tests/politics.test.js —— W4 政治-稳定度-战争支持度三角验收测试
   ============================================================ */

import assert from 'node:assert/strict';
import { K } from '../js/data/constants.js';
import { economyTick } from '../js/engine/economy.js';
import { manpowerTick } from '../js/engine/manpower.js';
import { TRADE_LAWS, switchTradeLaw, hireAdvisor, ADVISORS, ECONOMIC_LAWS, switchEconomicLaw } from '../js/engine/laws.js';
import { surrenderLimit } from '../js/engine/victory.js';
import { ideologyTick } from '../js/engine/ideology.js';

let passed = 0, failed = 0;
function t(name, fn){
  try{ fn(); passed++; console.log('✓', name); }
  catch(e){ failed++; console.log('✗', name, '→', e.message); }
}

t('W4-1 稳定度 50% 基准下每日 PP 恒定 +2.0', () => {
  const wMock = {
    player: 'G', difficulty: 'general', day: 1, events: [],
    nations: {
      G: {
        alive: true, pp: 0, stability: 50, warSupport: 50, modifiers: {},
        mil: 0, civ: 0, equip: 0, commandPower: 100, law: 'partial',
        training: [], productionLines: [], build: { kind: null }, buildQueue: []
      }
    }
  };
  economyTick(wMock);
  assert.equal(+wMock.nations.G.pp.toFixed(2), 2.0);
});

t('W4-2 稳定度 100% 触发 +20% PP 加成 (2.4/天)', () => {
  const wMock = {
    player: 'G', difficulty: 'general', day: 1, events: [],
    nations: {
      G: {
        alive: true, pp: 0, stability: 100, warSupport: 50, modifiers: {},
        mil: 0, civ: 0, equip: 0, commandPower: 100, law: 'partial',
        training: [], productionLines: [], build: { kind: null }, buildQueue: []
      }
    }
  };
  economyTick(wMock);
  assert.equal(+wMock.nations.G.pp.toFixed(2), 2.4);
});

t('W4-3 稳定度 0% 触发 -50% PP 惩罚 (1.0/天)', () => {
  const wMock = {
    player: 'G', difficulty: 'general', day: 1, events: [],
    nations: {
      G: {
        alive: true, pp: 0, stability: 0, warSupport: 50, modifiers: {},
        mil: 0, civ: 0, equip: 0, commandPower: 100, law: 'partial',
        training: [], productionLines: [], build: { kind: null }, buildQueue: []
      }
    }
  };
  economyTick(wMock);
  assert.equal(+wMock.nations.G.pp.toFixed(2), 1.0);
});

t('W4-4 战意低迷惩罚每日指挥点 (CP) 增长', () => {
  const wHigh = {
    player: 'G', difficulty: 'general', day: 1, events: [],
    nations: {
      G: {
        alive: true, pp: 0, stability: 50, warSupport: 100, modifiers: {},
        mil: 0, civ: 0, equip: 0, commandPower: 100, law: 'partial',
        training: [], productionLines: [], build: { kind: null }, buildQueue: []
      }
    }
  };
  const wLow = {
    player: 'G', difficulty: 'general', day: 1, events: [],
    nations: {
      G: {
        alive: true, pp: 0, stability: 50, warSupport: 0, modifiers: {},
        mil: 0, civ: 0, equip: 0, commandPower: 100, law: 'partial',
        training: [], productionLines: [], build: { kind: null }, buildQueue: []
      }
    }
  };
  economyTick(wHigh);
  economyTick(wLow);
  const cpGainHigh = wHigh.nations.G.commandPower - 100;
  const cpGainLow = wLow.nations.G.commandPower - 100;
  assert.equal(+cpGainHigh.toFixed(2), 0.50);
  // v14.5 W4-3 裁决：低战意 CP 收紧到 −95%（旧断言 0.20 是 ×0.4 的半吊子曲线）
  assert.equal(+cpGainLow.toFixed(4), 0.025);
});

t('W4-5 战意调制人力池每日动员回补速度', () => {
  const hex = { q:0, r:0, owner:'G' };
  const wHigh = {
    day: 1, hexes: [hex],
    nations: {
      G: {
        alive: true, capitulated: false, stability: 50, warSupport: 100,
        manpowerCap: 10000, manpowerPool: 0, modifiers: {},
        _manpowerLawStamp: 'partial|limited',
        economicLaw: 'partial', conscriptionLaw: 'limited'
      }
    }
  };
  const wLow = {
    day: 1, hexes: [hex],
    nations: {
      G: {
        alive: true, capitulated: false, stability: 50, warSupport: 0,
        manpowerCap: 10000, manpowerPool: 0, modifiers: {},
        _manpowerLawStamp: 'partial|limited',
        economicLaw: 'partial', conscriptionLaw: 'limited'
      }
    }
  };
  manpowerTick(wHigh);
  manpowerTick(wLow);
  // stabilityFactor = 0.6 + 0.4*0.5 = 0.8
  // High: wsFactor = 0.5 + 0.5*1.0 = 1.0 -> 10000 * 0.002 * 0.8 * 1.0 = 16
  // Low:  wsFactor = 0.5 + 0.5*0 = 0.5   -> 10000 * 0.002 * 0.8 * 0.5 = 8
  assert.equal(Math.round(wHigh.nations.G.manpowerPool), 16);
  assert.equal(Math.round(wLow.nations.G.manpowerPool), 8);
});

t('W4-6 贸易法案切换消耗 150PP 且加成准确', () => {
  const w = {
    day: 1, events: [],
    nations: {
      G: {
        name: '德国', pp: 200, modifiers: {},
        economicLaw: 'partial', conscriptionLaw: 'limited', tradeLaw: 'export_focus'
      }
    }
  };
  const ok = switchTradeLaw(w, 'G', 'free_trade');
  assert.equal(ok, true);
  assert.equal(w.nations.G.pp, 50);
  assert.equal(w.nations.G.tradeLaw, 'free_trade');
  assert.equal(+w.nations.G.modifiers.milOutput.toFixed(2), 0.15);
  assert.equal(+w.nations.G.modifiers.buildSpeed.toFixed(2), 0.15);
  assert.equal(+w.nations.G.modifiers.researchSpeed.toFixed(2), 0.10);
});

t('W4-7 四槽位顾问任命与幂等重算', () => {
  const w = {
    day: 1, events: [],
    nations: {
      G: {
        name: '德国', pp: 800, modifiers: {},
        economicLaw: 'partial', conscriptionLaw: 'limited', tradeLaw: 'export_focus',
        advisors: {}
      }
    }
  };
  hireAdvisor(w, 'G', 'political', 'silent_workhorse');
  hireAdvisor(w, 'G', 'army', 'army_chief_offense');
  hireAdvisor(w, 'G', 'navy', 'navy_chief_fleet');
  hireAdvisor(w, 'G', 'air', 'air_chief_ground_support');

  assert.equal(w.nations.G.advisors.political, 'silent_workhorse');
  assert.equal(w.nations.G.advisors.army, 'army_chief_offense');
  assert.equal(w.nations.G.advisors.navy, 'navy_chief_fleet');
  assert.equal(w.nations.G.advisors.air, 'air_chief_ground_support');
  assert.equal(w.nations.G.pp, 800 - 150 * 4);

  // 攻击加成: 陆军进攻 +10% + 海军协同 +5% + 空军对地 +10% = 0.25
  assert.equal(+w.nations.G.modifiers.atk.toFixed(2), 0.25);
  // 防御加成: 海军协同 +5%
  assert.equal(+w.nations.G.modifiers.def.toFixed(2), 0.05);

  // 幂等性：再换一个顾问，旧加成正确被清除
  // v14.5 W4-4：同一槽位 7 天冷却 —— 旧测试的"同日连换"正是本轮要替换的行为，
  // 故先推进 7 天再换（异槽互不影响，冷却只按槽位计）。
  w.day += 7;
  hireAdvisor(w, 'G', 'army', 'army_chief_defense');
  // 此时 army 改成防御 +10%
  // 攻击: 海军协同 +5% + 空军对地 +10% = 0.15
  assert.equal(+w.nations.G.modifiers.atk.toFixed(2), 0.15);
  // 防御: 陆军防御 +10% + 海军协同 +5% = 0.15
  assert.equal(+w.nations.G.modifiers.def.toFixed(2), 0.15);
});

/* ============================================================
   v14.5 W4 新增守卫：稳定度漂移 / export_focus / 选举周期
   ============================================================ */

function mkEcon(stability, warSupport, law = 'partial'){
  return {
    player: 'G', difficulty: 'general', day: 0, events: [],
    nations: {
      G: {
        alive: true, mil: 5, civ: 10, equip: 0, pp: 0, commandPower: 100,
        stability, warSupport, atWarWith: [], law, economicLaw: law,
        modifiers: {}, build: { kind:'mil', q:0, r:0, prog:0, need:99999 }, buildQueue: [], training: [], productionLines: []
      }
    }
  };
}

t('W4-2 战时 0 战意：稳定度向下漂移，200 天封底 70（−30）', () => {
  const w = mkEcon(85, 0, 'war');
  w.nations.G.atWarWith = ['X'];
  for(let d = 0; d < 200; d++) economyTick(w);
  assert.equal(w.nations.G.stability, 70, '0 战意稳定目标 = 100 − 30 = 70');
});

t('W4-2b 满战意无惩罚；和平期低战意也不砸稳定', () => {
  const w = mkEcon(85, 100, 'war');
  w.nations.G.atWarWith = ['X'];
  economyTick(w);
  assert.equal(w.nations.G.stability, 85, '满战意无稳定惩罚');
  const w2 = mkEcon(85, 0, 'war');
  economyTick(w2);
  assert.equal(w2.nations.G.stability, 85, '和平期不受战意惩罚');
});

t('W4-3b 投降线随战意线性（WS 系数 0.30）', () => {
  assert.ok(Math.abs(surrenderLimit({ warSupport: 0 }) - 0.50) < 1e-9);
  assert.ok(Math.abs(surrenderLimit({ warSupport: 100 }) - 0.80) < 1e-9);
});

t('W4-5 export_focus：消费品 30%、可切换、buildPts 口径随之变化', () => {
  assert.equal(ECONOMIC_LAWS.export_focus.consumerGoods, 0.30);
  assert.equal(K.CONSUMER_GOODS.export_focus, 0.30);
  const w = mkEcon(50, 50, 'civilian');
  w.nations.G.pp = 1000;
  assert.equal(switchEconomicLaw(w, 'G', 'export_focus'), true);
  assert.equal(w.nations.G.law, 'export_focus');
  economyTick(w);
  // 10 民厂 × 5 × (1−消费品0.30) × (1+默认贸易法 export_focus 的 buildSpeed+10%) = 38.5
  // （switchEconomicLaw 触发 recalculateNationModifiers，贸易法加成同乘区，构成如实断言）
  assert.ok(Math.abs(w.nations.G.build.prog - 38.5) < 1e-6,
    `export_focus 消费品 30% 应使 buildPts=38.5，实际 ${w.nations.G.build.prog}`);
  const w2 = mkEcon(50, 50, 'partial'); economyTick(w2);
  assert.ok(Math.abs(w2.nations.G.build.prog - 40) < 1e-6, 'partial 20%（未 switch 不带贸易法加成）应使 buildPts=40');
});

t('W4-5b 剧本异形 law 值不再静默漂移（§12-5）', () => {
  // 'early_mob' 不在任何法案表 → 落 0.20 兜底（与旧行为一致）；
  // 已登记的 export_focus 必须走 ECONOMIC_LAWS 真源而非兜底
  const w = mkEcon(50, 50, 'early_mob'); economyTick(w);
  assert.ok(Math.abs(w.nations.G.build.prog - 40) < 1e-6);
});

t('W4-7选 民主国家每 1440 天大选：确定性事件（W4-7 选举周期）', () => {
  const mk = () => ({ day: 1440, events: [], nations: {
    USA: { alive: true, capitulated: false, ideology: 'democratic', rulingSupport: 60,
           stability: 60, warSupport: 50, pp: 200 } } });
  const w = mk();
  ideologyTick(w);
  const n = w.nations.USA;
  assert.equal(n.nextElectionDay, 2880, '大选后顺延 1440 天');
  assert.ok(w.events.some(e => e.type === 'election'), '选举事件入账');
  assert.ok(n.stability >= 10 && n.stability <= 100, '稳定度在界内');
  // 确定性：同输入重放逐位一致
  const w2 = mk();
  ideologyTick(w2);
  assert.equal(w2.nations.USA.stability, n.stability, '重放逐位一致');
  assert.equal(w2.nations.USA.warSupport, n.warSupport);
  // 未到期不触发
  const w3 = mk(); w3.day = 1000; ideologyTick(w3);
  assert.equal(w3.nations.USA.nextElectionDay, 1440, '未到期不顺延');
  assert.ok(!w3.events.some(e => e.type === 'election'), '未到期无事件');
});

t('W4-7选b 非民主国家无选举', () => {
  const w = { day: 10, events: [], nations: {
    GER: { alive: true, capitulated: false, ideology: 'fascism', rulingSupport: 60, stability: 60 } } };
  ideologyTick(w);
  assert.ok(w.nations.GER.nextElectionDay == null, '非民主不得设置选举日');
  assert.ok(!w.events.some(e => e.type === 'election'));
});

console.log(`\n===== politics.test.js 结果: ${passed} 通过, ${failed} 失败 =====`);
process.exit(failed === 0 ? 0 : 1);
