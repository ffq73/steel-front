/* ============================================================
   tests/politics.test.js —— W4 政治-稳定度-战争支持度三角验收测试
   ============================================================ */

import assert from 'node:assert/strict';
import { K } from '../js/data/constants.js';
import { economyTick } from '../js/engine/economy.js';
import { manpowerTick } from '../js/engine/manpower.js';
import { TRADE_LAWS, switchTradeLaw, hireAdvisor, ADVISORS } from '../js/engine/laws.js';

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
  assert.equal(+cpGainLow.toFixed(2), 0.20);
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
  hireAdvisor(w, 'G', 'army', 'army_chief_defense');
  // 此时 army 改成防御 +10%
  // 攻击: 海军协同 +5% + 空军对地 +10% = 0.15
  assert.equal(+w.nations.G.modifiers.atk.toFixed(2), 0.15);
  // 防御: 陆军防御 +10% + 海军协同 +5% = 0.15
  assert.equal(+w.nations.G.modifiers.def.toFixed(2), 0.15);
});

console.log(`\n===== politics.test.js 结果: ${passed} 通过, ${failed} 失败 =====`);
process.exit(failed === 0 ? 0 : 1);
