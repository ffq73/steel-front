/* ============================================================
   engine/manpower.js —— 人力池系统 (v14.0 P2 §3.2)
   HOI4 机制（萌娘百科/Supply Guide）：全国 manpower 总量 + 征兵法影响增速，
   训练新师与补员都从池中扣除；池枯竭则无法补充 → 战力增长停滞。
   本作用缩尺：每师人力以千为单位，池量级十万~百万。
   ============================================================ */

import { K } from '../data/constants.js';
import { UNITS } from '../data/units.js';
import { CONSCRIPTION_LAWS, ECONOMIC_LAWS } from './laws.js';

/** 某国当前征兵法的人力费率
 *  W0-B3/B4 修正两处断链：
 *   ① 原代码查 CONSCRIPTION_LAWS[n.law]，但 n.law 是**经济**法案代号
 *      （laws.js 写的是 n.conscriptionLaw），所以永远命中不到 → 征兵法案全失效。
 *   ② 原代码从 CONSCRIPTION_LAWS 里读 manpowerPenalty，但该字段其实挂在
 *      ECONOMIC_LAWS.total 上（「总动员抽调劳工 -3%」）→ 也从未生效。
 *  现在两套法案各读各的，费率与惩罚都真正生效。 */
export function conscriptionRate(n){
  const cLaw = CONSCRIPTION_LAWS[n.conscriptionLaw] || CONSCRIPTION_LAWS.limited;
  const eLaw = ECONOMIC_LAWS[n.economicLaw || n.law] || null;
  let rate = cLaw.manpowerRate || 0.025;
  rate *= (1 + (n.modifiers && n.modifiers.manpower ? n.modifiers.manpower : 0));
  if(eLaw && eLaw.manpowerPenalty) rate *= (1 + eLaw.manpowerPenalty);
  rate *= (1 + (n.manpowerBonus || 0));   // 决议「女性参加工作」等
  return Math.max(0.001, rate);
}

/** 当前人力费率所依赖的「法案签名」——用于检测换法后 cap 是否过期 */
function lawStamp(n){
  return (n.economicLaw || n.law || 'partial') + '|' + (n.conscriptionLaw || 'limited');
}

/** 领土人口估算（每格常数万人） */
export function territoryPopulation(world, natId){
  let hexes = 0;
  for(const h of world.hexes) if(h.owner === natId) hexes++;
  return hexes * K.POP_PER_HEX;
}

/** 初始化/重算人力池上限（领土或法案变化后调用） */
export function initManpower(world, natId){
  const n = world.nations[natId];
  if(!n) return 0;
  const cap = territoryPopulation(world, natId) * conscriptionRate(n);
  n.manpowerCap = cap;
  if(n.manpowerPool == null) n.manpowerPool = cap;
  // 换法后新上限可能低于现有池（例如从「强制服役令」退档）
  n.manpowerPool = Math.min(n.manpowerPool, cap);
  n._manpowerLawStamp = lawStamp(n);   // 记录法案签名，供 manpowerTick 检测过期
  return cap;
}

export function manpowerPool(n){
  if(!n) return 0;
  if(n.manpowerPool == null) n.manpowerPool = n.manpowerCap || 0;
  return n.manpowerPool;
}

/** 训练一个师的人力成本（千人） */
export function recruitManpower(type){
  return K.MANPOWER_PER_DIVISION[type] || K.MANPOWER_PER_DIVISION.inf;
}

/** 能否支付训练人力 */
export function canAffordRecruit(n, type){
  return manpowerPool(n) >= recruitManpower(type);
}

/** 扣除训练人力（不足则拒绝，返回 false） */
export function payRecruitManpower(n, type){
  const cost = recruitManpower(type);
  if(manpowerPool(n) < cost) return false;
  n.manpowerPool -= cost;
  return true;
}

/** 补员：把 hp 恢复到满，消耗人力（HOI4：补员消耗装备+人力） */
export function payReinforceManpower(n, type, missingRatio){
  // 补 1% 兵力约需 该师全员的 0.6% 人力（HOI4 的 replenish 要点）
  const cost = recruitManpower(type) * (missingRatio || 0) * K.REINFORCE_MANPOWER_RATIO;
  if(manpowerPool(n) < cost) return false;
  n.manpowerPool -= cost;
  return true;
}

/** 每日结算：人力回补 + 枯竭惩罚 */
export function manpowerTick(world){
  if(!world || !world.nations) return;
  for(const id in world.nations){
    const n = world.nations[id];
    if(!n.alive || n.capitulated) continue;
    // 上限重算：领土变化（占领/失去）后 cap 需要跟着变，
    // 换征兵法后费率也需要跟着变 —— 后者此前只能靠重开档生效。
    if(n.manpowerCap == null || n._manpowerLawStamp !== lawStamp(n)) initManpower(world, id);

    // 每日回补（HOI4 人力每周约回 1%，此处按日折算并受稳定度与战意双重调制）
    const stabilityFactor = 0.6 + 0.4 * ((n.stability || 50) / 100);
    const wsFactor = 0.5 + 0.5 * ((n.warSupport ?? 50) / 100);
    n.manpowerPool = Math.min(n.manpowerCap,
      n.manpowerPool + n.manpowerCap * K.MANPOWER_DAILY_REGEN * stabilityFactor * wsFactor);

    // 枯竭惩罚：人力见底时每周掉稳定度（HOI4 表现之一）
    // 用"距上次 ≥7 天"判定而非 day % 7 —— 世界起始日不一定是 7 的倍数
    if(n.manpowerPool < n.manpowerCap * 0.02){
      if(n._lastExhaustDay == null || world.day - n._lastExhaustDay >= 7){
        n._lastExhaustDay = world.day;
        n.stability = Math.max(0, (n.stability || 50) - 0.5);
      }
    } else {
      n._lastExhaustDay = null;
    }
  }
}

/** 供 UI 展示的快照 */
export function manpowerSnapshot(world, natId){
  const n = world.nations[natId];
  if(!n) return null;
  const pool = manpowerPool(n);
  const cap = n.manpowerCap || 0;
  return {
    pool: Math.floor(pool),
    cap: Math.floor(cap),
    ratio: cap > 0 ? pool / cap : 0,
    exhausted: cap > 0 && pool / cap < 0.05
  };
}
