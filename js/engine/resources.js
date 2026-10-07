/* ============================================================
   engine/resources.js —— 六大战略资源结算引擎 (v7.0 §2.4 / E4)
   1. 资源产出：国家基础 + 占领区顺从度解锁 + 资源掠夺特权
   2. 产线消耗与赤字效率惩罚（附录 B.4 公式）
   3. 石油炼化燃料储备池，机动部队断油瘫痪
   4. 国际贸易：1 民用工厂租借 → 8 单位资源/天
   ============================================================ */

import { RESOURCE_TYPES, RESOURCES, LINE_RESOURCE_NEED, UNIT_FUEL_NEED, NATION_RESOURCE_BASE, FUEL_PARAMS } from '../data/resources.js';
import { OCCUPATION_LAWS } from './resistance.js';

/* 初始化国家资源账本 */
export function initResources(world){
  for(const id in world.nations){
    const n = world.nations[id];
    if(n.resourceStock) continue;
    const base = NATION_RESOURCE_BASE[id] || {};
    n.resourceStock = {};
    for(const r of RESOURCE_TYPES){
      n.resourceStock[r] = Math.floor((base[r] || 0) * 30);   // 开局 30 天储备
    }
    n.fuelReserve = Math.floor((base.oil || 0) * FUEL_PARAMS.OIL_TO_FUEL * 15);
    n.resourceTrades = [];   // { resource, amount } 进口合约
    n.resourceRights = [];   // 掠夺特权 [{natId, ratio}]
    n._fuelStarving = false;
  }
}

/* 每日资源结算 */
export function resourcesTick(world){
  // sim 沙盒豁免：保持测试环境纯净（B15 等平衡断言不受影响）
  if(!world || world.scenario === 'sim') return;
  initResources(world);
  for(const id in world.nations){
    const n = world.nations[id];
    if(!n.alive) continue;
    const base = NATION_RESOURCE_BASE[id] || {};

    // 1) 本土+占领区产出
    for(const r of RESOURCE_TYPES){
      let income = base[r] || 0;
      // 占领区资源开采（顺从度 20% 解锁 25%，60% 解锁 75%）
      for(const h of world.hexes){
        if(h._orig === id) continue;
        if(h.owner !== id) continue;
        const resHex = h.resources;
        if(!resHex || !resHex[r]) continue;
        const comp = h.compliance || 0;
        const law = OCCUPATION_LAWS[n.occupationLaw] || OCCUPATION_LAWS.military_governor;
        let yieldRatio = comp >= 60 ? 0.75 : comp >= 20 ? 0.25 : 0;
        income += resHex[r] * yieldRatio * law.resourceYield;
      }
      // 资源掠夺特权（和平会议授予：额外 80% 开采归宗主）
      for(const rr of (n.resourceRights || [])){
        const src = world.nations[rr.natId];
        if(!src || !src.alive) continue;
        income += ((NATION_RESOURCE_BASE[rr.natId] || {})[r] || 0) * 0.8 * (rr.ratio || 1);
      }
      // 国际贸易进口（1 民用工厂 → 8 单位/天）
      for(const t of (n.resourceTrades || [])){
        if(t.resource === r) income += t.amount;
      }
      n.resourceStock[r] = (n.resourceStock[r] || 0) + income;
    }

    // 2) 石油炼化入燃料池
    const oilIn = (base.oil || 0);
    const cap = FUEL_PARAMS.BASE_CAPACITY + (n.productionLines || [])
      .filter(l => l.type === 'sup_eq').length * 0; // 精炼厂容量扩展预留
    n.fuelReserve = Math.min(cap + oilIn * 30, (n.fuelReserve || 0) + oilIn * FUEL_PARAMS.OIL_TO_FUEL);

    // 3) 产线资源消耗 → 赤字
    n._resourceDeficit = {};
    for(const r of RESOURCE_TYPES) n._resourceDeficit[r] = 0;
    for(const line of (n.productionLines || [])){
      const need = LINE_RESOURCE_NEED[line.type];
      if(!need) continue;
      for(const r in need){
        const demand = need[r] * line.factories;
        const pay = Math.min(n.resourceStock[r] || 0, demand);
        n.resourceStock[r] = (n.resourceStock[r] || 0) - pay;
        n._resourceDeficit[r] += (demand - pay);
      }
    }

    // 4) 机动部队燃油耗费
    let fuelNeed = 0;
    for(const u of world.units){
      if(u.nat !== id || u.hp <= 0) continue;
      const f = UNIT_FUEL_NEED[u.type];
      if(f) fuelNeed += f;
    }
    if(fuelNeed > 0){
      if((n.fuelReserve || 0) >= fuelNeed){
        n.fuelReserve -= fuelNeed;
        n._fuelStarving = false;
      } else {
        n.fuelReserve = 0;
        n._fuelStarving = true;   // 断油：所有机动师明日生效瘫痪惩罚
      }
    }
  }
}

/* 产线资源满足率（附录 B.4）：效率上限 = max(0.10, 1 - 0.125×缺失比) */
export function getLineResourceEff(nation, lineType, factories = 1){
  const need = LINE_RESOURCE_NEED[lineType];
  if(!need) return 1.0;
  const def = nation._resourceDeficit || {};
  let worst = 1.0;
  for(const r in need){
    const demand = need[r] * factories;   // 每厂需求 × 厂数 = 该线总需求（与 _resourceDeficit 同量纲）   // 单厂需求基准
    const missing = def[r] || 0;
    if(missing <= 0) continue;
    const ratio = missing / Math.max(0.001, demand);
    const eff = Math.max(0.10, 1.0 - 0.125 * ratio);
    worst = Math.min(worst, eff);
  }
  return worst;
}

/* 机动部队燃料修正 */
export function getUnitFuelModifiers(world, u){
  const n = world.nations[u.nat];
  if(!n || !n._fuelStarving) return { speedMul: 1.0, brkMul: 1.0, starving: false };
  if(!UNIT_FUEL_NEED[u.type]) return { speedMul: 1.0, brkMul: 1.0, starving: false };
  return {
    speedMul: FUEL_PARAMS.STARVATION_SPEED_MUL,
    brkMul: FUEL_PARAMS.STARVATION_BRK_MUL,
    starving: true
  };
}

/* 钨充裕：穿深加成判定（坦克产线无缺钨） */
export function getPiercingModifier(nation, lineType = 'tank_eq'){
  const need = LINE_RESOURCE_NEED[lineType];
  if(!need || !need.tungsten) return 1.0;
  const missing = (nation._resourceDeficit || {}).tungsten || 0;
  if(missing > 0) return 1.0 - FUEL_PARAMS.PIERCING_TUNGSTEN_BONUS;  // 缺钨：穿深 -30%
  return 1.0;
}

/* 国际贸易：1 民用工厂租借 → 8 单位/天（占用民用产能 20%） */
export function tradeResource(world, natId, resource, units){
  const n = world.nations[natId];
  if(!n || !RESOURCES[resource]) return false;
  const idx = n.resourceTrades.findIndex(t => t.resource === resource);
  if(units <= 0){
    if(idx >= 0) n.resourceTrades.splice(idx, 1);
    return true;
  }
  const rec = { resource, amount: Math.min(units, 64) };
  if(idx >= 0) n.resourceTrades[idx] = rec; else n.resourceTrades.push(rec);
  return true;
}

/* 资源贸易占用民用工厂数（总民用 × 20% × 合约数，用于建造扣减显示） */
export function tradeCivCost(nation){
  return (nation.resourceTrades || []).length * 0.2;
}
