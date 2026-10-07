/* ============================================================
   engine/barrage.js —— 一战专属：炮兵准备系统 (v5.0 §2.2 / E1)
   实现三档炮击准备（短促急袭/标准准备/长时炮击），火炮弹药消耗与壕沟压制
   ============================================================ */

import { K } from '../data/constants.js';

export const BARRAGE_MODES = {
  short: {
    id: 'short',
    name: '短促急袭 (胡蒂尔式)',
    prepDays: 2,
    desc: '拂晓前的突然密集炮击，撕开防线缺口。守军壕沟减半，攻方首日获得「突袭」×1.5 伤害，但计划槽上限 -20%。',
    requiresTech: 'infiltration_tactics',
    artCostPerDay: 5,
    entrenchReduce: 0.50, // 守方壕沟减半
    firstDayAtkMul: 1.50,
    planCapPenalty: 0.20
  },
  standard: {
    id: 'standard',
    name: '标准炮火准备',
    prepDays: 6,
    desc: '步炮协同规范炮击。彻底摧毁铁丝网与前沿工事，守军壕沟完全清零，组织伤害 +20%。',
    requiresTech: null,
    artCostPerDay: 12,
    entrenchReduce: 1.00, // 守方壕沟清零
    orgDmgBonus: 0.20
  },
  prolonged: {
    id: 'prolonged',
    name: '长时毁灭炮击 (凡尔登式)',
    prepDays: 12,
    desc: '持续昼夜的地毯式巨炮轰击。守军壕沟清零且组织上限 -10%，但敌方有 70% 概率预判增援，且攻方战争疲惫急剧上升。',
    requiresTech: null,
    artCostPerDay: 25,
    entrenchReduce: 1.00,
    enemyOrgCapPenalty: 0.10,
    enemyAlertChance: 0.70,
    exhaustionAdd: 3.0
  }
};

/**
 * 为指定前线/箭头设置炮击准备模式
 */
export function setBarrageMode(world, planId, modeKey){
  world.barrages = world.barrages || {};
  const mode = BARRAGE_MODES[modeKey] || BARRAGE_MODES.standard;
  world.barrages[planId] = {
    planId,
    mode: mode.id,
    currentDays: 0,
    targetDays: mode.prepDays,
    ready: false
  };
  return world.barrages[planId];
}

/**
 * 每日结算炮击准备进度与火炮弹药扣减
 */
export function barrageTick(world, rng){
  if(world.era !== 'ww1') return;
  world.barrages = world.barrages || {};

  for(const planId in world.barrages){
    const b = world.barrages[planId];
    if(b.ready) continue;

    const mode = BARRAGE_MODES[b.mode] || BARRAGE_MODES.standard;
    const arrow = (world.arrows || []).find(a => a.id === planId);
    const natId = arrow ? arrow.nat : world.player;
    const nat = world.nations[natId];

    // 检查火炮库存
    const artStock = nat && nat.equipment ? (nat.equipment.art_eq || 0) : (nat ? nat.equip : 100);
    if(artStock < mode.artCostPerDay){
      // 弹药短缺，炮击中断
      world.events = world.events || [];
      world.events.push({
        type: 'barrage_starve',
        day: world.day,
        important: false,
        text: `⚠️ 炮火短缺：${nat ? nat.name : natId} 的炮兵阵地因炮弹耗尽暂停准备！`
      });
      continue;
    }

    // 扣减火炮装备弹药
    if(nat && nat.equipment && nat.equipment.art_eq != null){
      nat.equipment.art_eq = Math.max(0, nat.equipment.art_eq - mode.artCostPerDay);
    } else if(nat){
      nat.equip = Math.max(0, nat.equip - mode.artCostPerDay);
    }

    b.currentDays++;
    if(b.currentDays >= b.targetDays){
      b.ready = true;
      world.events = world.events || [];
      world.events.push({
        type: 'barrage_ready',
        day: world.day,
        important: true,
        text: `💥 弹幕准备就绪：【${mode.name}】已将目标堑壕与铁丝网彻底炸平！`
      });

      // 长时炮击的疲惫代价与敌方预警判定
      if(mode.id === 'prolonged'){
        if(nat) nat.warExhaustion = (nat.warExhaustion || 0) + mode.exhaustionAdd;
        if(rng && rng() < mode.enemyAlertChance){
          // 敌方预警增援
          if(arrow && arrow.targetHexes && arrow.targetHexes.length){
            const targetHex = world.hexes[arrow.targetHexes[0]];
            if(targetHex && world.nations[targetHex.owner]){
              world.events.push({
                type: 'barrage_alert',
                day: world.day,
                important: false,
                text: `🚨 守军预警：敌方指挥部根据长期炮声预判了主攻方向并调集了预备队！`
              });
            }
          }
        }
      }
    }
  }
}

/**
 * 战斗交火时应用炮击成果修正
 */
export function applyBarrageCombatModifier(world, planId, defenderHex){
  if(world.era !== 'ww1') return null;
  world.barrages = world.barrages || {};
  const b = world.barrages[planId];
  if(!b || !b.ready) return null;

  const mode = BARRAGE_MODES[b.mode] || BARRAGE_MODES.standard;
  return {
    entrenchFactor: 1 - mode.entrenchReduce, // 守方壕沟剩余比例 (0=清零, 0.5=减半)
    firstDayAtkMul: mode.firstDayAtkMul || 1.0,
    orgDmgBonus: mode.orgDmgBonus || 0.0,
    enemyOrgCapPenalty: mode.enemyOrgCapPenalty || 0.0
  };
}

/**
 * W0-D1：按目标格反查生效中的炮火准备（battle.js 调用）
 * ------------------------------------------------------------
 * applyBarrageCombatModifier 需要 planId，而 battle.js 是按格结算的，
 * 所以这里做一层「格 → 生效炮击」的聚合：扫出所有 ready 且箭头覆盖该格的炮击，
 * 壕沟削减取乘积（多个炮击叠加削弱），组织伤害与首日攻击取最大值。
 * 原函数保持不变（UI 与测试仍可单独按 planId 查询）。
 *
 * 断链事实：此前 applyBarrageCombatModifier 全库 0 引用 ——
 * 一战三档炮击准备（急袭/标准/凡尔登）的全部战斗效果从未生效。
 */
export function barrageModifierForHex(world, hexIdx){
  if(!world || world.era !== 'ww1') return null;
  const barrages = world.barrages;
  if(!barrages) return null;
  const arrows = world.arrows || [];

  /** 目标既可能是格下标，也可能是 [q,r]，还可能是带 idx 的对象 */
  const resolvesTo = (t) => {
    if(t == null) return false;
    if(typeof t === 'number') return t === hexIdx;
    if(Array.isArray(t)) return world.at[t[0] + ',' + t[1]] === world.hexes[hexIdx];
    if(typeof t === 'object'){
      if(t.idx != null) return t.idx === hexIdx;
      if(t.i != null) return t.i === hexIdx;
      if(t.q != null && t.r != null) return world.at[t.q + ',' + t.r] === world.hexes[hexIdx];
    }
    return false;
  };

  let entrenchFactor = 1;
  let orgDmgBonus = 0;
  let firstDayAtkMul = 1;
  let hit = false;

  for(const planId in barrages){
    const b = barrages[planId];
    if(!b || !b.ready) continue;
    const arrow = arrows.find(a => a.id === planId);
    const targets = arrow ? (arrow.targetHexes || arrow.targets) : null;
    if(!targets || !targets.length) continue;          // 找不到目标 → 不施加，避免全图生效
    if(!targets.some(resolvesTo)) continue;
    const mod = applyBarrageCombatModifier(world, planId, hexIdx);
    if(!mod) continue;
    hit = true;
    entrenchFactor *= (mod.entrenchFactor != null ? mod.entrenchFactor : 1);
    orgDmgBonus = Math.max(orgDmgBonus, mod.orgDmgBonus || 0);
    firstDayAtkMul = Math.max(firstDayAtkMul, mod.firstDayAtkMul || 1);
  }

  return hit ? { entrenchFactor, orgDmgBonus, firstDayAtkMul } : null;
}
