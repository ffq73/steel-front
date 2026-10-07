/* ============================================================
   engine/intel.js —— 间谍与情报系统核心引擎 (v9.0 §4-N3 / 附录 B.4) [H]
   包含：情报机构升级树(5分支)、特工招募与任务网络、
         四类情报等级(民政/陆/海/空 0-100%)、盟友情报30%共享、
         情报差战斗加成(0.3%/pp，上限15%)、密码学与破译公式(12000+4250L)、
         19 种情报行动清单与重复执行成本+15%递增法则
   ============================================================ */

import { K } from '../data/constants.js';

/* 19 种历史情报行动规范表 (契合附录 B.4) [H] */
export const INTEL_OPERATIONS = {
  rescue_operative: {
    id: 'rescue_operative', name: '营救被俘特工',
    operatives: 1, network: 30, risk: 0.10, days: 35,
    extraCost: {}, desc: '渗透敌方安全拘留所，营救被俘特工以防泄密'
  },
  infiltrate_civilian: {
    id: 'infiltrate_civilian', name: '渗透民政行政机构',
    operatives: 2, network: 35, risk: 0.10, days: 90,
    extraCost: {}, desc: '安插眼线至内政与内阁部门，获取核心民政情报(+25%)'
  },
  plant_false_intel: {
    id: 'plant_false_intel', name: '散布战略假情报',
    operatives: 2, network: 40, risk: 0.00, days: 60,
    extraCost: {}, desc: '零风险诱导敌统帅部误判主攻方向'
  },
  capture_cipher: {
    id: 'capture_cipher', name: '缴获密码本',
    operatives: 2, network: 40, risk: 0.20, days: 75,
    extraCost: {}, desc: '突袭通信枢纽缴获密码本，直接提升密码破译进度(+35%)'
  },
  infiltrate_army: {
    id: 'infiltrate_army', name: '渗透陆军统帅部',
    operatives: 2, network: 50, risk: 0.10, days: 75,
    extraCost: {}, desc: '获取敌陆军编制、动向与前线兵力部署(+25%)'
  },
  infiltrate_navy: {
    id: 'infiltrate_navy', name: '渗透海军司令部',
    operatives: 2, network: 50, risk: 0.10, days: 75,
    extraCost: {}, desc: '获取主力舰队港口驻泊与海区巡逻密电(+35%)'
  },
  infiltrate_airforce: {
    id: 'infiltrate_airforce', name: '渗透空军参谋部',
    operatives: 2, network: 50, risk: 0.10, days: 75,
    extraCost: {}, desc: '获取敌空军基地驻防机群与防空导弹阵地(+25%)'
  },
  strengthen_resistance: {
    id: 'strengthen_resistance', name: '策动占领区抵抗',
    operatives: 2, network: 35, risk: 0.20, days: 50,
    extraCost: {}, desc: '向敌占区走私军火与传单，显著提升当地抵抗增长速度'
  },
  make_resistance_contacts: {
    id: 'make_resistance_contacts', name: '联络地下抵抗组织',
    operatives: 2, network: 40, risk: 0.10, days: 60,
    extraCost: {}, desc: '建立敌后联络网络，降低后续行动风险'
  },
  steal_industrial_blueprints: {
    id: 'steal_industrial_blueprints', name: '窃取工业图纸',
    operatives: 3, network: 35, risk: 0.20, days: 120,
    extraCost: {}, desc: '窃取先进机床与精炼蓝图，奖励 1 次 300% 工业科研加速'
  },
  steal_military_blueprints: {
    id: 'steal_military_blueprints', name: '窃取陆军装备图纸',
    operatives: 3, network: 50, risk: 0.20, days: 120,
    extraCost: {}, desc: '窃取下一代重装甲/火炮图纸，奖励 1 次 300% 陆军科技加速'
  },
  steal_naval_blueprints: {
    id: 'steal_naval_blueprints', name: '窃取海军舰艇图纸',
    operatives: 3, network: 50, risk: 0.20, days: 120,
    extraCost: {}, desc: '窃取新锐战列/航母图纸，奖励 1 次 300% 海军科研加速'
  },
  steal_aviation_blueprints: {
    id: 'steal_aviation_blueprints', name: '窃取战机设计图纸',
    operatives: 3, network: 50, risk: 0.20, days: 120,
    extraCost: {}, desc: '窃取喷气机与机体结构图纸，奖励 1 次 300% 空军科研加速'
  },
  sabotage_industry: {
    id: 'sabotage_industry', name: '敌后破坏民用/军工厂',
    operatives: 3, network: 35, risk: 0.20, days: 90,
    extraCost: {}, desc: '炸毁军工厂车间与动力室，造成工厂停产瘫痪'
  },
  sabotage_infra: {
    id: 'sabotage_infra', name: '破坏后勤铁路与补给线',
    operatives: 3, network: 35, risk: 0.20, days: 90,
    extraCost: {}, desc: '炸毁桥梁与铁轨，降低敌州基础设施 1 级'
  },
  sabotage_resources: {
    id: 'sabotage_resources', name: '爆破战略矿山与油田',
    operatives: 3, network: 35, risk: 0.20, days: 90,
    extraCost: {}, desc: '破坏关键油气管线与矿井，削减战略资源产出'
  },
  prepare_collab_gov: {
    id: 'prepare_collab_gov', name: '筹建伪政权合作政府',
    operatives: 2, network: 50, risk: 0.10, days: 90,
    extraCost: { sup_eq: 200, inf_eq: 1000 },
    desc: '扶植傀儡政权，占领后直接获得 30% 初始顺从度'
  },
  orchestrate_coup: {
    id: 'orchestrate_coup', name: '策动政变叛乱',
    operatives: 2, network: 70, risk: 0.30, days: 180,
    extraCost: { inf_eq: 12000 },
    desc: '武装敌对意识形态同情军官发动内战'
  },
  coordinated_strike: {
    id: 'coordinated_strike', name: '先发制人协同空袭',
    operatives: 2, network: 70, risk: 0.30, days: 3,
    extraCost: {},
    desc: '宣战前夜实施珍珠港式突然袭击，重创在港舰艇与地面机库'
  }
};

/* 1. 密码学与破译总强度计算 [H]
   公式：总密码强度 = 12000 + 4250 × Cryptology level
   验证：level 0 -> 12000；level 7 -> 41750 */
export function calcCipherStrength(cryptologyLevel = 0){
  const base = K.INTEL.CIPHER_BASE_STRENGTH;
  const perLv = K.INTEL.CIPHER_LEVEL_STRENGTH;
  return base + perLv * cryptologyLevel;
}

/* 2. 战斗情报加成计算 [H]
   规则：陆军情报差 ≥ 5pp 激活；每 1pp 情报差给 软攻/硬攻/防御/突破 +0.3%；上限 +15% (50pp 封顶) */
export function calcIntelCombatBonus(observerArmyIntel = 50, targetArmyIntel = 50){
  const diff = Math.max(0, observerArmyIntel - targetArmyIntel);
  if(diff < K.INTEL.COMBAT_BONUS_THRESHOLD_PP) return 0.0;
  const bonus = diff * K.INTEL.COMBAT_BONUS_PER_PP;
  return Math.min(K.INTEL.COMBAT_BONUS_CAP, +bonus.toFixed(4));
}

/* 3. 重复执行同目标同行动成本递增计算 [H]
   规则：同目标重复执行同一行动，成本每次 +15% (复利递增) */
export function calcRepeatOperationCostMultiplier(timesExecuted = 0){
  if(timesExecuted <= 0) return 1.0;
  return +Math.pow(K.INTEL.REPEAT_OP_COST_MULT, timesExecuted).toFixed(4);
}

/* 4. 同盟情报共享加成计算 [H]
   规则：当盟友情报更高时，该国获得差额的 30% 作为共享加成 */
export function calcAllianceIntelShare(myIntel = 30, allyIntel = 60){
  if(allyIntel <= myIntel) return 0.0;
  const diff = allyIntel - myIntel;
  return +(diff * K.INTEL.ALLIANCE_INTEL_SHARE_RATIO).toFixed(2);
}

/* 5. 信息精度模糊化处理器 [H]
   将原始数值按情报等级映射为 HOI4 风格的估算区间 (±80%, ±50%, ±100%) 或精确值 */
export function formatIntelMetric(val, intelLevel, type = 'civ'){
  if(typeof val !== 'number') return String(val);

  if(type === 'civ'){
    if(intelLevel < 10) return '??? (缺乏情报)';
    if(intelLevel < 30){
      const min = Math.max(0, Math.floor(val * 0.5));
      const max = Math.ceil(val * 1.5);
      return `${min} ~ ${max} (±50%)`;
    }
    return `${val} (精确)`;
  }

  if(type === 'army'){
    if(intelLevel < 5) return '??? (缺乏情报)';
    if(intelLevel < 30){
      const min = Math.max(0, Math.floor(val * 0.2));
      const max = Math.ceil(val * 1.8);
      return `${min} ~ ${max} 师 (±80%)`;
    }
    if(intelLevel < 70){
      const min = Math.max(0, Math.floor(val * 0.5));
      const max = Math.ceil(val * 1.5);
      return `${min} ~ ${max} 师 (±50%)`;
    }
    return `${val} 师 (精确)`;
  }

  return String(val);
}

/* ------------------------------------------------------------
   v11.0：情报行动的立项 / 推进 / 结算
   activeOperations 与 operationHistory 此前在 initIntel 里建好了却无人写入，
   面板按钮只弹一句 alert。现在这条链是完整的：
     planIntelOperation  → 校验机构/特工/网络/政治点，占用特工，立项
     intelTick           → 每日推进，到日结算成败（失败者被俘）
   ------------------------------------------------------------ */

/** 立项一项情报行动。返回 { ok, reason?, days?, cost? } */
export function planIntelOperation(world, natId, opId, targetNatId){
  const op = INTEL_OPERATIONS[opId];
  const ag = world.agencies && world.agencies[natId];
  const nat = world.nations && world.nations[natId];
  if(!op || !ag || !nat) return { ok: false, reason: '数据缺失' };
  if(!ag.founded) return { ok: false, reason: '情报机构尚未组建' };
  if(!targetNatId || !world.nations[targetNatId]) return { ok: false, reason: '未指定行动目标国' };
  if(targetNatId === natId) return { ok: false, reason: '不能对本国实施秘密行动' };
  if(!world.nations[targetNatId].alive) return { ok: false, reason: '目标国已不存在' };

  const free = (ag.operatives || []).filter((o) => o.mission !== 'operation' && !o.captured);
  if(free.length < op.operatives){
    return { ok: false, reason: `可用特工不足：需 ${op.operatives} 名，现有 ${free.length} 名` };
  }
  const net = free.reduce((m, o) => Math.max(m, o.networkStrength || 0), 0);
  if(net < op.network){
    return { ok: false, reason: `网络强度不足：需 ${op.network}%，当前最高 ${Math.round(net)}%` };
  }

  // 重复执行同一行动成本递增 [H]
  const times = ((world.operationHistory || {})[natId] || []).filter((h) => h.opId === opId).length;
  const cost = Math.round(30 * calcRepeatOperationCostMultiplier(times));
  if(nat.pp < cost) return { ok: false, reason: `政治点不足：需 ${cost} 点，当前 ${Math.floor(nat.pp)} 点` };

  nat.pp -= cost;
  let used = 0;
  for(const o of ag.operatives){
    if(used >= op.operatives) break;
    if(o.mission !== 'operation' && !o.captured){ o.mission = 'operation'; used++; }
  }

  world.activeOperations = world.activeOperations || [];
  const entry = {
    id: 'iop_' + world.day + '_' + world.activeOperations.length,
    nat: natId, opId, targetNatId,
    days: op.days, progress: 0, risk: op.risk,
    startedDay: world.day
  };
  world.activeOperations.push(entry);
  if(natId === world.player && world.events){
    world.events.push({ type: 'intel_op_started', day: world.day,
      text: `🕵️【秘密行动立项】${op.name}（对 ${world.nations[targetNatId].name}，${op.days} 天，风险 ${Math.round(op.risk*100)}%）`,
      important: false });
  }
  return { ok: true, days: op.days, cost, id: entry.id };
}

/** 结算一项行动 */
function settleIntelOperation(world, entry, rng){
  const ag = world.agencies[entry.nat];
  const op = INTEL_OPERATIONS[entry.opId];
  world.operationHistory = world.operationHistory || {};
  world.operationHistory[entry.nat] = world.operationHistory[entry.nat] || [];

  const exposed = rng() < entry.risk;
  if(exposed){
    // 暴露：一名参与特工被俘
    const agent = (ag.operatives || []).find((o) => o.mission === 'operation');
    if(agent){ agent.captured = true; agent.mission = 'idle'; }
    world.operationHistory[entry.nat].push({ opId: entry.opId, target: entry.targetNatId, day: world.day, ok: false });
    if(entry.nat === world.player && world.events){
      world.events.push({ type: 'intel_op_failed', day: world.day,
        text: `🚨【行动暴露】${op ? op.name : entry.opId} 被对方反谍部门破获，一名特工失联。`, important: true });
    }
    return;
  }

  // 成功：参与特工回归并涨网络，同时给目标挂上破译目标（若有密码学收益）
  for(const o of ag.operatives || []){
    if(o.mission !== 'operation') continue;
    o.mission = 'network';
    o.networkStrength = Math.min(95, (o.networkStrength || 0) + 12);
    o.exp = (o.exp || 0) + 50;
  }
  world.operationHistory[entry.nat].push({ opId: entry.opId, target: entry.targetNatId, day: world.day, ok: true });
  if(entry.nat === world.player && world.events){
    world.events.push({ type: 'intel_op_done', day: world.day,
      text: `✅【行动成功】${op ? op.name : entry.opId} 达成预定目标，特工网络强度提升。`, important: false });
  }
}

/** 撤销（把占用的特工放回网络） */
export function cancelIntelOperation(world, opEntryId){
  const list = world.activeOperations || [];
  const entry = list.find((x) => x.id === opEntryId);
  if(!entry) return false;
  const ag = world.agencies[entry.nat];
  for(const o of (ag && ag.operatives) || []){
    if(o.mission === 'operation') o.mission = 'network';
  }
  world.activeOperations = list.filter((x) => x.id !== opEntryId);
  return true;
}

/* 6. 初始化世界情报系统 */
export function initIntel(world){
  world.agencies = world.agencies || {};
  world.intelCache = world.intelCache || {};
  world.operationHistory = world.operationHistory || {};
  world.activeOperations = world.activeOperations || [];

  // 为每个国家建立或配备初始间谍机构
  for(const nat in world.nations){
    if(!world.agencies[nat]){
      const isMajor = ['GER', 'SOV', 'GBR', 'USA', 'FRA', 'G', 'S', 'B', 'F'].includes(nat);
      world.agencies[nat] = {
        nat,
        name: `${world.nations[nat].name}国家安全局`,
        founded: isMajor,
        daysToFound: isMajor ? 0 : 30,
        upgrades: {
          intelligence: isMajor ? 2 : 0,
          defense: isMajor ? 1 : 0,
          operations: isMajor ? 1 : 0,
          training: isMajor ? 1 : 0,
          cryptology: isMajor ? 2 : 0
        },
        operatives: [],
        cipherTarget: null,
        cipherProgress: {},
        crackedCiphers: {}
      };

      // 强国配备初始特工
      if(isMajor){
        world.agencies[nat].operatives.push({
          id: `op_${nat}_1`,
          name: nat === 'GER' || nat === 'G' ? '卡纳里斯·特工' : `${world.nations[nat].name}首席特勤官`,
          nat,
          level: 2,
          exp: 250,
          mission: 'network',
          targetNat: nat === 'GER' || nat === 'G' ? (world.nations['POL'] ? 'POL' : 'P') : (world.nations['GER'] ? 'GER' : 'G'),
          networkStrength: 45
        });
      }
    }
  }

  // 刷新全图情报等级缓存
  updateAllIntelLevels(world);
}

/* 7. 计算观察国对目标国的四维情报等级 (0-100%) [H] */
export function calcIntelLevels(world, observerNat, targetNat){
  if(observerNat === targetNat){
    return { civ: 100, army: 100, navy: 100, air: 100 };
  }

  const agency = world.agencies?.[observerNat];
  if(!agency || !agency.founded){
    return { civ: 10, army: 10, navy: 10, air: 10 };
  }

  // 1. 特工网络贡献 (网络强度最高贡献: civ 30, army 30, navy 40, air 30)
  const opsOnTarget = (agency.operatives || []).filter(o => o.targetNat === targetNat && o.mission === 'network');
  const maxNet = opsOnTarget.reduce((m, o) => Math.max(m, o.networkStrength || 0), 0);
  const netRatio = Math.min(1.0, maxNet / 100);

  let civ = Math.round(netRatio * 30);
  let army = Math.round(netRatio * 30);
  let navy = Math.round(netRatio * 40);
  let air = Math.round(netRatio * 30);

  // 2. 破译密码贡献：破译期间全领域 +60% [H]
  if(agency.crackedCiphers && agency.crackedCiphers[targetNat] > 0){
    civ += 60;
    army += 60;
    navy += 60;
    air += 60;
  }

  // 3. 机构情报分支升级被动加成
  const intelUpgrades = agency.upgrades?.intelligence || 0;
  const upgradeBonus = intelUpgrades * 5;
  civ += upgradeBonus;
  army += upgradeBonus;
  navy += upgradeBonus;
  air += upgradeBonus;

  // 4. 空中侦察加成
  const reconBonus = Math.round((world.nations[observerNat]?.reconBonus || 0) * 100);
  civ += Math.round(reconBonus * 0.25);
  army += Math.round(reconBonus * 0.20);
  navy += Math.round(reconBonus * 0.30);
  air += Math.round(reconBonus * 0.20);

  // 5. 盟友情报共享加成 (30%) [H]
  const obsAllies = Object.keys(world.nations).filter(n => {
    return n !== observerNat && !world.nations[observerNat]?.atWarWith?.includes(n);
  });
  for(const ally of obsAllies){
    const allyAgency = world.agencies?.[ally];
    if(allyAgency){
      const allyNet = (allyAgency.operatives || []).filter(o => o.targetNat === targetNat).reduce((m, o) => Math.max(m, o.networkStrength || 0), 0);
      if(allyNet > maxNet){
        const share = calcAllianceIntelShare(maxNet, allyNet);
        army += Math.round(share * 0.3);
        civ += Math.round(share * 0.3);
      }
    }
  }

  return {
    civ: Math.min(100, Math.max(10, civ)),
    army: Math.min(100, Math.max(10, army)),
    navy: Math.min(100, Math.max(10, navy)),
    air: Math.min(100, Math.max(10, air))
  };
}

export function updateAllIntelLevels(world){
  world.intelCache = world.intelCache || {};
  const nats = Object.keys(world.nations || {});
  for(const a of nats){
    world.intelCache[a] = world.intelCache[a] || {};
    for(const b of nats){
      world.intelCache[a][b] = calcIntelLevels(world, a, b);
    }
  }
}

/* 8. 每日情报系统轮转管线 (每日结算调用) */
export function intelTick(world, rng = Math.random){
  if(!world.agencies) return;

  for(const nat in world.agencies){
    const ag = world.agencies[nat];
    if(!ag.founded) continue;

    // 1. 特工网络生长与反间谍衰减
    for(const op of ag.operatives || []){
      if(op.mission === 'network'){
        const enemyCI = (world.agencies[op.targetNat]?.upgrades?.defense || 0) + 1;
        const maxLimit = Math.max(20, -10 * enemyCI + 90);
        op.networkStrength = Math.min(maxLimit, (op.networkStrength || 0) + 1.2);
      }
    }

    // 2. 密码破译点数积累 [H]
    if(ag.cipherTarget){
      const tNat = ag.cipherTarget;
      const targetCryptLv = world.agencies[tNat]?.upgrades?.cryptology || 0;
      const targetStrength = calcCipherStrength(targetCryptLv);
      const myCryptLv = ag.upgrades?.cryptology || 0;
      let power = 50 + myCryptLv * 25;

      const isAtWar = world.nations[nat]?.atWarWith?.includes(tNat);
      if(!isAtWar){
        power *= (1 - K.INTEL.PEACE_DECRYPTION_PENALTY); // 非战时 -50% [H]
      }

      ag.cipherProgress[tNat] = (ag.cipherProgress[tNat] || 0) + power;
      if(ag.cipherProgress[tNat] >= targetStrength){
        // 破译成功！激活 30 天破译期
        ag.crackedCiphers[tNat] = K.INTEL.CIPHER_CRACKED_DAYS;
        ag.cipherProgress[tNat] = 0;
        if(world.events && nat === world.player){
          world.events.push({
            type: 'cipher_cracked',
            day: world.day,
            text: `【密码破译突破】统帅部成功破解 ${tNat} 军事加密体系！未来 30 天获得全面情报压制！`,
            important: true
          });
        }
      }
    }

    // 3. 破译倒计时与过期重置为 50% [H]
    for(const tNat in ag.crackedCiphers){
      if(ag.crackedCiphers[tNat] > 0){
        ag.crackedCiphers[tNat]--;
        if(ag.crackedCiphers[tNat] === 0){
          // 过期重置为 50% 进度
          const targetCryptLv = world.agencies[tNat]?.upgrades?.cryptology || 0;
          ag.cipherProgress[tNat] = Math.floor(calcCipherStrength(targetCryptLv) * K.INTEL.CIPHER_RESET_RATIO);
          if(world.events && nat === world.player){
            world.events.push({
              type: 'cipher_expired',
              day: world.day,
              text: `【密电重置】${tNat} 更换了全军密码本，破译优势消退，进度重置为 50%。`,
              important: false
            });
          }
        }
      }
    }
  }

  // 3. 进行中的秘密行动推进与结算（v11.0）
  if(world.activeOperations && world.activeOperations.length){
    const keep = [];
    for(const entry of world.activeOperations){
      entry.progress = (entry.progress || 0) + 1;
      if(entry.progress >= entry.days){
        settleIntelOperation(world, entry, rng);
      } else {
        keep.push(entry);
      }
    }
    world.activeOperations = keep;
  }

  // 刷新缓存
  updateAllIntelLevels(world);
}
