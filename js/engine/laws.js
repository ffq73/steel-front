/* ============================================================
   engine/laws.js —— 法案与内阁顾问系统 (v4.0 §3.2 / P2)
   实现经济法案 4 档、征兵法案 4 档、顾问三类各 3 选 1，消耗 150PP
   ============================================================ */

import { K } from '../data/constants.js';

export const ECONOMIC_LAWS = {
  civilian: { id: 'civilian', name: '民用经济', consumerGoods: 0.35, milPenalty: -0.15, cost: 150, desc: '和平时期经济，35% 民厂生产消费品，军工生产受抑' },
  // W4-5：第五档 —— 出口重点（HOI4 Export Focus）：消费品高于部分动员，
  // 换取外贸弹性（贸易法收益在 TRADE_LAWS 侧独立结算）
  export_focus: { id: 'export_focus', name: '出口重点', consumerGoods: 0.30, milPenalty: -0.05, cost: 150, desc: '鼓励出口创汇：30% 消费品，外贸市场准入放宽，军工小幅受抑' },
  partial:  { id: 'partial',  name: '部分动员', consumerGoods: 0.20, milPenalty: 0, cost: 150, desc: '应对边境威胁，20% 民厂生产消费品，生产平衡' },
  war:      { id: 'war',      name: '战时经济', consumerGoods: 0.10, milBonus: 0.15, cost: 150, desc: '国家进入战时体制，仅 10% 消费品，军厂产出 +15%' },
  total:    { id: 'total',    name: '总动员',   consumerGoods: 0.05, milBonus: 0.20, manpowerPenalty: -0.03, cost: 150, desc: '一切为了前线，仅 5% 消费品，军厂产出 +20%，但抽调劳工使征兵人口 -3%' }
};

export const CONSCRIPTION_LAWS = {
  volunteer: { id: 'volunteer', name: '志愿兵役制', manpowerRate: 0.015, cost: 150, desc: '常备职业军，适役人口 1.5%，组织度与训练优良' },
  limited:   { id: 'limited',   name: '有限征兵制', manpowerRate: 0.025, cost: 150, desc: '抽签适度征集，适役人口 2.5%' },
  extensive: { id: 'extensive', name: '广泛征兵制', manpowerRate: 0.050, cost: 150, desc: '适龄青年全员受训，适役人口 5.0%' },
  service_by_requirement: { id: 'service_by_requirement', name: '强制服役令', manpowerRate: 0.100, factoryPenalty: -0.10, cost: 150, desc: '战时极限征召，适役人口 10.0%，但工厂人手紧缺使产出 -10%' }
};

import { TRADE_LAWS } from '../data/resources.js';
export { TRADE_LAWS };

export const ADVISORS = {
  political: [
    { id: 'silent_workhorse', name: '内阁老黄牛', cost: 150, desc: '每日政治点数增长 +15%', modifiers: { ppRate: 0.15 } },
    { id: 'captain_of_industry', name: '工业巨擘', cost: 150, desc: '民用工厂建造速度 +15%', modifiers: { civBuildSpeed: 0.15 } },
    { id: 'ideological_crusader', name: '意识形态导师', cost: 150, desc: '国家稳定度 +10%，战争支持度 +10%', modifiers: { stability: 10, warSupport: 10 } }
  ],
  military: [
    { id: 'army_chief_offense', name: '陆军进攻学派长官', cost: 150, desc: '陆军师攻击 +10%', modifiers: { atk: 0.10 } },
    { id: 'army_chief_defense', name: '陆军防御阵地长官', cost: 150, desc: '陆军师防御 +10%', modifiers: { def: 0.10 } },
    { id: 'army_chief_drill', name: '陆军训练与教导长官', cost: 150, desc: '组织度恢复速度 +15%，陆军作战经验 +25%', modifiers: { orgRecovery: 0.15, xpGain: 0.25 } }
  ],
  army: [
    { id: 'army_chief_offense', name: '陆军进攻学派长官', cost: 150, desc: '陆军师攻击 +10%', modifiers: { atk: 0.10 } },
    { id: 'army_chief_defense', name: '陆军防御阵地长官', cost: 150, desc: '陆军师防御 +10%', modifiers: { def: 0.10 } },
    { id: 'army_chief_drill', name: '陆军训练与教导长官', cost: 150, desc: '组织度恢复速度 +15%，陆军作战经验 +25%', modifiers: { orgRecovery: 0.15, xpGain: 0.25 } }
  ],
  navy: [
    { id: 'navy_chief_fleet', name: '远洋舰队决战长官', cost: 150, desc: '全军攻防协同 +5%', modifiers: { atk: 0.05, def: 0.05 } },
    { id: 'navy_chief_raider', name: '破交与潜艇战长官', cost: 150, desc: '部队组织度恢复速度 +10%', modifiers: { orgRecovery: 0.10 } },
    { id: 'navy_chief_screen', name: '护航防空长官', cost: 150, desc: '全军阵地防御 +10%', modifiers: { def: 0.10 } }
  ],
  air: [
    { id: 'air_chief_superiority', name: '制空权学派长官', cost: 150, desc: '全军综合攻防 +5%', modifiers: { atk: 0.05, def: 0.05 } },
    { id: 'air_chief_ground_support', name: '对地密接支援长官', cost: 150, desc: '陆军师攻击 +10%', modifiers: { atk: 0.10 } },
    { id: 'air_chief_safety', name: '要地防空长官', cost: 150, desc: '陆军师防御 +10%', modifiers: { def: 0.10 } }
  ],
  economic: [
    { id: 'war_industrialist', name: '军备生产专家', cost: 150, desc: '军用工厂生产效率 +15%', modifiers: { milOutput: 0.15 } },
    { id: 'quartermaster_general', name: '后勤军需总监', cost: 150, desc: '兵力补员速度 +20%，装备损耗 -15%', modifiers: { regenSpeed: 0.20, attrLoss: -0.15 } },
    { id: 'tech_magnate', name: '军工科研总监', cost: 150, desc: '科技研发时间 -15%', modifiers: { researchSpeed: 0.15 } }
  ]
};

export function switchEconomicLaw(world, natId, lawId){
  const n = world.nations[natId];
  const law = ECONOMIC_LAWS[lawId];
  if(!n || !law || n.pp < law.cost) return false;

  n.pp -= law.cost;
  n.economicLaw = lawId;
  n.law = lawId; // 兼容 v2.0
  recalculateNationModifiers(world, natId);

  world.events = world.events || [];
  world.events.push({
    type: 'law_change',
    day: world.day,
    important: false,
    text: `📜 经济改组：${n.name} 正式颁布【${law.name}】！`
  });
  return true;
}

export function switchConscriptionLaw(world, natId, lawId){
  const n = world.nations[natId];
  const law = CONSCRIPTION_LAWS[lawId];
  if(!n || !law || n.pp < law.cost) return false;

  n.pp -= law.cost;
  n.conscriptionLaw = lawId;
  recalculateNationModifiers(world, natId);

  world.events = world.events || [];
  world.events.push({
    type: 'conscription_change',
    day: world.day,
    important: false,
    text: `🎖️ 动员令：${n.name} 批准施行【${law.name}】！`
  });
  return true;
}

export function switchTradeLaw(world, natId, lawId){
  const n = world.nations[natId];
  const law = TRADE_LAWS[lawId];
  const cost = law ? (law.cost ?? law.costPP ?? 150) : 150;
  if(!n || !law || n.pp < cost) return false;

  n.pp -= cost;
  n.tradeLaw = lawId;
  recalculateNationModifiers(world, natId);

  world.events = world.events || [];
  world.events.push({
    type: 'trade_law_change',
    day: world.day,
    important: false,
    text: `🌐 贸易法案：${n.name} 调整为【${law.name}】！`
  });
  return true;
}

export function hireAdvisor(world, natId, category, advisorId){
  const n = world.nations[natId];
  const pool = ADVISORS[category] || [];
  const adv = pool.find(a => a.id === advisorId);
  if(!n || !adv || n.pp < adv.cost) return false;

  // W4-4：每周重选冷却 —— 同一槽位 7 天内不得再度易人（HOI4 换顾问一周生效）。
  // 冷却命中返回 { ok:false, reason:'cooldown', readyDay }，调用方可给具体提示；
  // 其余失败返回 false，成功返回 true —— 真值契约保持。
  n.advisorCd = n.advisorCd || {};
  const readyDay = (n.advisorCd[category] || -999) + K.ADVISOR_SWAP_COOLDOWN;
  if(readyDay > world.day){
    return { ok: false, reason: 'cooldown', readyDay };
  }

  n.advisors = n.advisors || {};
  n.pp -= adv.cost;
  n.advisors[category] = advisorId;
  n.advisorCd[category] = world.day;
  recalculateNationModifiers(world, natId);

  world.events = world.events || [];
  world.events.push({
    type: 'hire_advisor',
    day: world.day,
    important: false,
    text: `🤝 内阁任命：${n.name} 任命【${adv.name}】入阁主持事务！`
  });
  return true;
}

export function recalculateNationModifiers(world, natId){
  const n = world.nations[natId];
  if(!n) return;
  n.modifiers = n.modifiers || {};

  // 幂等化处理：先扣减上一轮法案与顾问应用过的增量
  if(n._appliedLawMods){
    for(const k in n._appliedLawMods){
      n.modifiers[k] = (n.modifiers[k] || 0) - n._appliedLawMods[k];
    }
  }
  const applied = {};
  function addMod(k, val){
    if(!val) return;
    applied[k] = (applied[k] || 0) + val;
    n.modifiers[k] = (n.modifiers[k] || 0) + val;
  }

  // 1) 经济与征兵法案
  const eLaw = ECONOMIC_LAWS[n.economicLaw || n.law || 'partial'];
  const cLaw = CONSCRIPTION_LAWS[n.conscriptionLaw || 'limited'];
  const tLaw = TRADE_LAWS[n.tradeLaw || 'export_focus'];

  if(eLaw && eLaw.milBonus) addMod('milOutput', eLaw.milBonus);
  if(cLaw && cLaw.factoryPenalty) addMod('milOutput', cLaw.factoryPenalty);
  if(tLaw){
    const eff = tLaw.effects || {};
    const prod = eff.prodSpeed || tLaw.milOutput || 0;
    const bld = eff.prodSpeed || tLaw.civBuildSpeed || 0;
    const res = eff.researchSpeed || tLaw.researchSpeed || 0;
    if(prod) addMod('milOutput', prod);
    if(bld) addMod('buildSpeed', bld);
    if(res) addMod('researchSpeed', res);
  }

  // 2) 各槽位顾问
  n.advisors = n.advisors || {};
  for(const cat in n.advisors){
    const advId = n.advisors[cat];
    const adv = (ADVISORS[cat] || []).find(a => a.id === advId);
    if(adv && adv.modifiers){
      for(const k in adv.modifiers){
        addMod(k, adv.modifiers[k]);
      }
    }
  }

  n._appliedLawMods = applied;
}
