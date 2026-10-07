/* ============================================================
   engine/tick.js —— 每日 11 步结算管线（v2.0 §2.3，顺序即规则）
   ============================================================ */

import { economyTick } from './economy.js';
import { researchTick } from './research.js';
import { focusTick } from './focus.js';
import { processMove } from './movement.js';
import { resolveBattle } from './battle.js';
import { victoryTick } from './victory.js';
import { aiPhase } from './ai.js';
import { UNITS } from '../data/units.js';
import { K } from '../data/constants.js';
import { log } from './world.js';
import { SCENARIOS } from '../data/scenarios.js';
import { makeRng } from '../core/rng.js';
import { econSocialMonthlyTick } from './econSocial.js';
import { nuclearTick } from './nuclear.js';
import { diplomacyTick } from './diplomacy.js';
import { blocTick } from './bloc.js';
import { dronesTick } from './drones.js';
import { planningTick } from './plans.js';
import { tensionTick, addTension, initTension } from './tension.js';
import { checkDailyEvents } from './news.js';
import { barrageTick } from './barrage.js';
import { attritionTick } from './attrition.js';
import { logisticsTick } from './logistics.js';          // v7.0 E3 后勤补给网
import { resistanceTick } from './resistance.js';        // v7.0 E4 占领区抵抗与顺从
import { resourcesTick } from './resources.js';          // v7.0 E4 六大战略资源
import { peaceTick } from './peace.js';
import { decisionsTick, initDecisions } from './decisions.js';   // v14.0 P2 决议系统
import { manpowerTick, initManpower, payReinforceManpower, manpowerPool } from './manpower.js';   // v14.0 P2 人力池
import { reliabilityRecoverFactor, unitTier, tierPriority } from './template.js';   // v14.0 P1 可靠性/配给等级
import { ideologyTick, civilWarTick } from './ideology.js';   // v14.0 P3 意识形态与内战                  // v7.0 E4 战后和会巡检
import { airTick } from './air.js';                      // v9.0 N1 空军系统
import { navyTick } from './navy.js';                    // v9.0 N2 海军系统
import { intelTick } from './intel.js';                  // v9.0 N3 间谍与情报系统
import { doctrineTick, addUnitXp } from './doctrine.js';  // v9.0 N4 作战学说系统 / W1-7 演习经验
import { recordBattleStats, statsTick } from './stats.js'; // v9.0 N6 统计与战史日志系统
import { subjectsTick } from './subjects.js';            // v9.0 N5 国际贸易与附庸自治系统
import { invasionTick } from './invasion.js';            // v11.0 两栖登陆筹备推进
import { unitMod } from './mods.js';                    // W0-A2 修正键统一解析
import { checkGeneralCasualty } from './characters.js'; // W0-C 将领殉职



/* 纯引擎入口：就地修改 world，返回本轮事件 */
export function dayTick(world, rng){
  if(world.over) return { events: [] };
  if(!rng) rng = makeRng(world.rngState || world.seed || 1);
  world.day++;
  world.events = [];

  // 1-3 资源 / 建设 / 生产
  resourcesTick(world);          // v7.0 E4：战略资源产出 → 产线消耗 → 燃料池（先于经济结算赤字）
  economyTick(world);
  // 3.5 后勤补给网：补给辐射计算 + 断供天数累计（B.3 宽限期）
  logisticsTick(world);
  // 4 科研
  researchTick(world);
  // 5 国策
  focusTick(world);
  // 5.5 作战计划每日槽位积累 / 消耗 / 自动推进 (§2.4-2.5)
  planningTick(world, rng);
  // 6 移动
  for(const u of world.units){ processMove(world, u); }
  // 6.5 世界紧张度每日衰减检查
  tensionTick(world);
  // 7 战斗：每个被指向的格结算
  const targets = new Set();
  for(const u of world.units){
    if(u.hp>0 && u.order && u.order.type==='attack'){
      targets.add(world.at[u.order.target[0]+','+u.order.target[1]].idx);
    }
  }
  world.battleFeed = world.battleFeed || [];
  for(const idx of targets){
    const rep = resolveBattle(world, rng, idx);
    const hx = world.hexes[idx];
    // v8.0 M3：战斗伤害入 feed（渲染层消费为伤害浮字）
    if(rep.rounds && rep.rounds.length && hx){
      // v14.0 P0：附带逐小时明细与小时速率（UI 浮字展示"每小时掉多少组织"）
      const rd0 = rep.rounds[0];
      const hrs = (rd0.hourly && rd0.hourly.length) || K.HOURS_PER_DAY;
      world.battleFeed.push({ day: world.day, q: hx.q, r: hx.r,
        orgDmg: rd0.orgDmg || 0, hpDmg: rd0.hpDmg || 0,
        hours: hrs, perHour: (rd0.orgDmg || 0) / hrs,
        defMit: rd0.defMit, casualties: rep.destroyed ? rep.destroyed.length : 0 });
      if(world.battleFeed.length > 80) world.battleFeed.shift();

      // v9.0 N6：战损统计与战史日志归档
      const atker = world.units.find(u => u.order && (u.order.type==='attack'||u.order.type==='support') && u.order.target && u.order.target[0]===hx.q && u.order.target[1]===hx.r);
      const atkNat = atker ? atker.nat : 'GER';
      const defNat = hx.owner;
      recordBattleStats(world, rep, atkNat, defNat, hx);
    }
    if(rep.destroyed.length){
      world.events.push({ type:'destroyed', day:world.day, text:`${rep.destroyed.length} 支部队被歼灭`, important:false });

      // W0-C：将领殉职判定。此前 checkGeneralCasualty 全库 0 引用 ——
      // 「师团全歼 → 15% 概率将领阵亡」这条 HOI4 式后果从未发生，
      // 将领是永生的。此处必须在「清阵亡」之前调用（还要读 u.hp <= 0 的单位）。
      const victim = checkGeneralCasualty(world, rep.destroyed[0], rep, rng);
      if(victim){
        // 将领离任后，其所在军的 generalId 需要重新指派，否则该军退回 3/3/3/3
        for(const army of (world.armies || [])){
          if(army.generalId === victim.id){
            const n = world.nations[army.nat];
            const taken = new Set((world.armies || []).map(x => x.generalId).filter(Boolean));
            army.generalId = ((n && n.assignedGenerals) || []).find(gid => !taken.has(gid)) || null;
            break;
          }
        }
      }
    }
  }
  // 清阵亡
  world.units = world.units.filter(u => u.hp > 0);
  for(const h of world.hexes){ h.units = h.units.filter(id => world.units.some(u=>u.id===id)); }
  // 8 整补
  recoveryPhase(world);
  // 8.5 占领区抵抗/顺从度结算（E4）
  resistanceTick(world, rng);
  // 9 海空与情报（v9.0 N1 空军 + N2 海军 + N3 间谍情报系统）
  airTick(world, rng);
  navyTick(world, rng);
  intelTick(world, rng);
  doctrineTick(world);
  subjectsTick(world);
  invasionTick(world);          // v11.0：登陆准备进度与「准备完毕」告警
  // 10 AI
  aiPhase(world, rng);
  // 11 胜负
  victoryTick(world);
  // 11.5 战后和会悬挂巡检（玩家未响应超3天自动闭幕）
  peaceTick(world);
  // 11.6 决议结算（限时效果到期撤销 + 每周累积）[v14.0 P2]
  decisionsTick(world);
  // 11.7 人力池回补与枯竭惩罚 [v14.0 P2]
  manpowerTick(world);
  // 11.8 政党支持度日漂移 + 内战判定 [v14.0 P3]
  ideologyTick(world);
  civilWarTick(world);
  // 11.9 装备可靠性衰减 [v14.0 P1]：新装备 100%，随战场消耗与时间下降
  if(world.day % K.RELIABILITY_DECAY_DAYS === 0){
    for(const u of world.units){
      if(u.hp <= 0) continue;
      if(u.reliability == null) u.reliability = K.RELIABILITY_START;
      u.reliability = Math.max(K.RELIABILITY_MIN, u.reliability - K.RELIABILITY_DECAY_STEP);
    }
  }
  // 计划事件（剧本）
  scenarioEvents(world);
  // 40 大动态历史事件与战地快讯
  checkDailyEvents(world);

  // 一战炮火准备与消耗战/革命系统
  if(world.era === 'ww1'){
    barrageTick(world, rng);
    attritionTick(world, rng);
  }



  // 冷战与现代经济社会/核威慑/外交结算
  if(world.era === 'coldwar' || world.era === 'modern'){
    econSocialMonthlyTick(world);
    nuclearTick(world);
    diplomacyTick(world);
    // v8.0 M6：阵营影响力渗透与代理人热度 / 无人机打击结算
    blocTick(world, rng);
    dronesTick(world);
  }

  // 阵亡引用再清理（AI/事件可能再次移除）
  world.units = world.units.filter(u => u.hp > 0);
  for(const h of world.hexes){ h.units = h.units.filter(id => world.units.some(u=>u.id===id)); }

  // v9.0 N6：每日全球指标快照时序采样
  statsTick(world);

  // 确定性 RNG 状态回写
  world.rngState = rng.state();
  return { events: world.events };
}

/* 恢复：未交战 + 己方格 → 组织度+5、壕沟+2%/天、装备补员 */
function recoveryPhase(world){
  const underAttack = new Set();
  for(const u of world.units){
    if(u.order && u.order.type==='attack'){
      underAttack.add(u.order.target[0]+','+u.order.target[1]);
    }
  }
  for(const u of world.units){
    if(u.hp <= 0) continue;
    const h = world.at[u.q+','+u.r];
    const maxOrg = UNITS[u.type].org;
    const fighting = u.order && u.order.type==='attack';
    const beingAttacked = underAttack.has(u.q+','+u.r);
    if(!fighting && !beingAttacked && h.owner === u.nat){
      // v14.0 P1：组织恢复率受「装备可靠性 × 配给等级」影响 [H]
      const relFactor = reliabilityRecoverFactor(u.reliability);
      const tierMul = K.TIER_RECOVER_MUL[unitTier(world, u)] || 1;
      // W0-C：再乘「组织恢复类修正」。数据层的 org_recovery 键（42 条特质）
      // 与 planning 一样此前无人读取 —— 朱可夫的 org_recovery+0.2 是空转的。
      const orgRecMul = 1 + unitMod(world.nations[u.nat], u.type, 'orgRecovery');
      u.org = Math.min(maxOrg, u.org + K.ORG_RECOVER_PER_DAY * relFactor * tierMul * orgRecMul);
      // v14.0 P2 补员：HP 恢复按缺失比例消耗人力池，池枯竭则无法补员
      const maxHp = UNITS[u.type].hp;
      if(u.hp < maxHp * 0.995){
        const nat = world.nations[u.nat];
        if(nat && nat.manpowerCap == null) initManpower(world, u.nat);
        const missing = (maxHp - u.hp) / maxHp;
        if(nat && payReinforceManpower(nat, u.type, missing * 0.02)){
          u.hp = Math.min(maxHp, u.hp + Math.max(0.2, maxHp * 0.004 * (1 + (nat.modifiers.regenSpeed || 0))));
        }
      }
      const baseEntrenchMax = (world.eraData && world.eraData.entrenchMax != null) ? world.eraData.entrenchMax : 0.15;
      const dailyEntrench = (world.eraData && world.eraData.entrenchPerDay != null) ? world.eraData.entrenchPerDay : K.ENTRENCH_PER_DAY;
      u.entrench = Math.min(baseEntrenchMax + (world.nations[u.nat].modifiers.entrenchMax || 0)/100,
                            (u.entrench || 0) + dailyEntrench);

      // W1-7：演习练兵（[K] 演习 / [Shift+K] 长期演训）—— HOI4 战前练兵核心。
      // 此前 input.js 给 u.training 赋值后全库无人消费。不战不守时每日 +1 XP；
      // 单轮演习练出「训练完成」即停，长期演训练到「百战」停。
      if(u.training){
        const tier = addUnitXp(u, K.EXERCISE_XP_PER_DAY);
        if(u.trainMax ? tier.id === 'seasoned' : tier.id !== 'raw'){
          u.training = false; u.trainMax = false;
        }
      }

    }
    if(!fighting && h.owner === u.nat && u.hp < UNITS[u.type].hp && world.nations[u.nat].equip >= K.EQUIP_PER_HP){
      const heal = Math.min(K.HP_REGEN_PER_DAY, UNITS[u.type].hp - u.hp);
      u.hp = Math.min(UNITS[u.type].hp, u.hp + heal);
      world.nations[u.nat].equip -= K.EQUIP_PER_HP * heal;
    }
  }
}

function scenarioEvents(world){
  const scKey = world.scenario;
  const sc = SCENARIOS[scKey];
  if(sc && sc.checkEvents){
    const evs = sc.checkEvents(world) || [];
    for(const ev of evs){
      world.events.push(ev);
      if(ev.text) log(world, ev.text, ev.kind || 'war');
    }
  }

  if(scKey === 'A'){
    if(!world._weissDone && world.day >= 0){
      world._weissDone = true;
      addTension(world, 25, '白色方案：德军越过波兰边境', 'G', 'P');
    }
    if(!world._ultimatumDone && world.day >= 2){
      world._ultimatumDone = true;
      addTension(world, 10, '英法对德宣战：同盟国参战', 'B', 'G');
    }
    if(!world._sovietDone && world.day >= 18){
      world._sovietDone = true;
      const gains = [];
      for(const h of world.hexes){
        if(h.owner !== 'P') continue;
        if(h.adj.some(ni => world.hexes[ni].owner === 'S')) gains.push(h);
      }
      for(const h of gains){
        for(const uid of [...h.units]){
          const u = world.units.find(x => x.id === uid);
          if(u && u.nat === 'P'){
            const hi = world.hexes.find(x => x.q===u.q && x.r===u.r);
            const i = hi.units.indexOf(u.id);
            if(i>=0) hi.units.splice(i,1);
            world.units.splice(world.units.indexOf(u),1);
          }
        }
        h.owner = 'S';
      }
      world.events.push({ type:'event', day:world.day, important:true,
        text:`—— 苏联进军波兰东部，接管 ${gains.length} 个地区，波兰腹背受敌！` });
      addTension(world, 15, '苏军进驻东波兰：势力范围划分', 'S', 'P');
    }
    if(!world._polandTension && world.day >= 26){
      world._polandTension = true;
      addTension(world, 10, '华沙陷落：波兰战役终局', 'G', 'P');
    }
  }
}




