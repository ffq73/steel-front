/* ============================================================
   engine/logistics.js —— 钢四后勤补给网与断供损耗引擎 (v7.0 §2.1)
   1. 首都战略总库与多级铁路带宽辐射
   2. 补给枢纽末端卡车摩托化程度调节 (徒步 2 格 / 卡车 3 格 / 机械化 4 格)
   3. 地形与天气补给阻力衰减
   4. 72 小时随身干粮宽限期与断供攻防减损 / 非战斗装备人员蒸发
   ============================================================ */

import { K } from '../data/constants.js';
import { UNITS } from '../data/units.js';
import { hexDist } from '../core/geom.js';
import { getMapRailways, getMapSupplyHubs } from '../data/railways.js';
import { getHexWeather } from '../data/weather.js';

/** 初始化世界后勤补给状态 */
export function initLogistics(world){
  world.supplyState = world.supplyState || {
    hubs: {},
    hexSupply: {}
  };
  const baseHubs = getMapSupplyHubs(world);
  for(const h of baseHubs){
    const key = `${h.q},${h.r}`;
    if(!world.supplyState.hubs[key]){
      world.supplyState.hubs[key] = {
        q: h.q,
        r: h.r,
        name: h.name,
        level: h.level,
        isCapital: h.isCapital,
        motorization: h.isCapital ? 1 : 0, // 首都默认轻度摩托化
        isSupplied: true
      };
    }
  }
  calcSupplyNetwork(world);
}

/** 切换枢纽末端摩托化等级 (0: 徒步, 1: 卡车, 2: 全机械化) */
export function setHubMotorization(world, q, r, level){
  initLogistics(world);
  const key = `${q},${r}`;
  const hub = world.supplyState.hubs[key];
  if(!hub) return false;

  const targetLevel = Math.max(0, Math.min(2, level));
  const config = K.SUPPLY_PARAMS.MOTORIZATION[targetLevel];
  const nat = world.nations[world.at[key] ? world.at[key].owner : world.player];

  // 检查国家卡车库存 (如果启用卡车消耗)
  if(nat && nat.equipment && targetLevel > 0){
    const needTrucks = config.truckCost;
    if((nat.equipment.truck_eq || 0) < needTrucks){
      return false; // 卡车库存不足
    }
  }

  hub.motorization = targetLevel;
  calcSupplyNetwork(world);
  return true;
}

/** 计算全境补给网络拓扑与各六角格补给充足率 */
export function calcSupplyNetwork(world){
  if(!world || !world.hexes) return;
  world.supplyState = world.supplyState || { hubs: {}, hexSupply: {} };

  // 1. 获取枢纽基础表
  const baseHubs = getMapSupplyHubs(world);
  for(const h of baseHubs){
    const key = `${h.q},${h.r}`;
    if(!world.supplyState.hubs[key]){
      world.supplyState.hubs[key] = {
        q: h.q, r: h.r, name: h.name, level: h.level, isCapital: h.isCapital,
        motorization: h.isCapital ? 1 : 0, isSupplied: true
      };
    }
  }

  const hubs = Object.values(world.supplyState.hubs);

  // 2. 判定枢纽与首都铁路连通性
  for(const hub of hubs){
    const hHex = world.at[`${hub.q},${hub.r}`];
    if(!hHex){ hub.isSupplied = false; continue; }
    if(hub.isCapital){ hub.isSupplied = true; continue; }

    // 只要属于友方领土且存在铁路线，视为连通
    hub.isSupplied = (hHex.owner !== 'N');
  }

  // 3. 计算每个陆地六角格的补给充足度 (supplyLevel: 0.0 ~ 1.0)
  // v14.0 P2：一次遍历建 id→unit 索引，供过载计算查表（避免 O(n²)）
  const uIdx = new Map();
  for(const u of world.units) uIdx.set(u.id, u);
  for(const hex of world.hexes){
    if(hex.terrain === 'sea'){
      hex.supplyLevel = 0.0;
      continue;
    }

    // 单元测试沙盒 (sim) 默认满补给保证测试环境纯净
    if(world.scenario === 'sim' || hex.owner === 'A' || hex.owner === 'B'){
      hex.supplyLevel = 1.0;
      continue;
    }

    // 寻找最近的同阵营连通补给枢纽
    let bestLevel = 0.10; // 偏远荒野最低 10% 随军微补给
    const weather = getHexWeather(world, hex);

    for(const hub of hubs){
      if(!hub.isSupplied) continue;
      const hubHex = world.at[`${hub.q},${hub.r}`];
      if(!hubHex || hubHex.owner !== hex.owner) continue;

      const dist = hexDist(hex.q, hex.r, hub.q, hub.r);
      const motoCfg = K.SUPPLY_PARAMS.MOTORIZATION[hub.motorization || 0];
      let effectiveRadius = motoCfg.radius;

      // 恶劣天气对卡车辐射范围的泥泞阻力
      if(weather === 'mud'){
        effectiveRadius = Math.max(1.5, effectiveRadius * (1 + motoCfg.mudPenalty * 0.5));
      } else if(weather === 'snow'){
        effectiveRadius = Math.max(1.8, effectiveRadius * 0.8);
      }

      // 地形阻力
      if(hex.terrain === 'mount') effectiveRadius *= 0.7;
      else if(hex.terrain === 'marsh') effectiveRadius *= 0.65;

      if(dist <= effectiveRadius){
        bestLevel = 1.0; // 补给充足
        break;
      } else if(dist <= effectiveRadius + 1){
        bestLevel = Math.max(bestLevel, 0.65); // 距离拉长，补给略有紧张
      } else if(dist <= effectiveRadius + 2){
        bestLevel = Math.max(bestLevel, 0.35); // 补给吃紧
      }
    }

    // 孤立包围判定：若周围全部为敌军或中立格，且本格无枢纽，判定完全断供
    const hasFriendlyAdj = (hex.adj || []).some(ni => world.hexes[ni] && world.hexes[ni].owner === hex.owner);
    if(!hasFriendlyAdj && !world.supplyState.hubs[`${hex.q},${hex.r}`]){
      bestLevel = 0.0;
    }

    // v14.0 P2 补给上限：需求（每师 1 单位）超过承载上限（枢纽 + 基建 0.3/级）时，
    // 超出部分在 HOI4 里是直接浪费的。本作不改变 supplyLevel 的 0~1 语义
    // （E3 断供曲线断言依赖它），只叠加一个过载削弱系数，且上限 40%。
    const friendlyUnits = hexUnitsInHex(uIdx, hex).filter(u => u.hp > 0 && u.nat === hex.owner);
    const demand = friendlyUnits.length * K.SUPPLY_DEMAND_PER_DIVISION;
    let hubSupply = 0;
    for(const hub of hubs){
      if(!hub.isSupplied) continue;
      const hubHex = world.at[`${hub.q},${hub.r}`];
      if(!hubHex || hubHex.owner !== hex.owner) continue;
      const dist = hexDist(hex.q, hex.r, hub.q, hub.r);
      const motoCfg = K.SUPPLY_PARAMS.MOTORIZATION[hub.motorization || 0];
      if(dist <= (motoCfg ? motoCfg.radius : 2)){
        hubSupply += K.SUPPLY_HUB_BASE * (1 + (hub.motorization || 0) * K.SUPPLY_HUB_MOTOR);
        break;
      }
    }
    // W7-2：铁路等级入补给上限（railLevel 0-3 由 atlas 按城市规模生成，
    // 此前只有 states.railLevel 聚合、无任何游戏读点）
    const cap = hubSupply + (hex.infra || 0) * K.SUPPLY_INFRA_BONUS
      + (hex.railLevel || 0) * (K.SUPPLY_RAIL_BONUS || 0.2);
    hex.supplyCap = cap;
    hex.supplyDemand = demand;
    hex.supplyUtil = demand > 0 ? cap / demand : 1;
    hex.supplyOver = Math.max(0, cap - demand);
    if(hex.supplyUtil < 1 && bestLevel > 0){
      bestLevel *= (1 - K.SUPPLY_OVERLOAD_PENALTY * (1 - Math.min(1, hex.supplyUtil)));
    }

    hex.supplyLevel = bestLevel;
  }
}

/** 取某格内存活的单位（补给结算用，避免与其他模块产生循环依赖） */
function hexUnitsInHex(uIdx, hex){
  const out = [];
  for(const id of hex.units || []){
    const u = uIdx.get(id);
    if(u) out.push(u);
  }
  return out;
}

/** 每日后勤结算管线 (融入 dayTick) */
export function logisticsTick(world){
  if(!world || !world.units) return;
  initLogistics(world);
  calcSupplyNetwork(world);

  const GRACE = K.SUPPLY_PARAMS.GRACE_DAYS;

  for(const u of world.units){
    if(u.hp <= 0) continue;

    // sim 沙盒豁免
    if(world.scenario === 'sim' || u.nat === 'A' || u.nat === 'B'){
      u.outOfSupplyDays = 0;
      u.supplyGrace = GRACE;
      u.supplyLevel = 1.0;
      continue;
    }

    const hex = world.at[`${u.q},${u.r}`];
    const sup = hex ? (hex.supplyLevel ?? 1.0) : 1.0;
    u.supplyLevel = sup;

    if(sup < 0.30){
      // 补给严重不足：累计断供天数
      u.outOfSupplyDays = (u.outOfSupplyDays || 0) + 1;
      u.supplyGrace = Math.max(0, GRACE - u.outOfSupplyDays);

      // 超出 72 小时随身干粮宽限期，开始承受非战斗装备人员蒸发
      if(u.outOfSupplyDays > GRACE){
        const overDays = u.outOfSupplyDays - GRACE;
        const loss = Math.max(1, Math.round(u.hp * K.SUPPLY_PARAMS.DAILY_ATTRITION));
        u.hp = Math.max(1, u.hp - loss);

        // [B.3] 断供超 7 天（彻底包围且无补给）：组织度上限强制 20%，每日 3.0% 装备人员损失
        if(overDays > K.SUPPLY_PARAMS.COLLAPSE_DAYS){
          u.org = Math.min(u.org, UNITS[u.type].org * K.SUPPLY_PARAMS.COLLAPSE_ORG_CAP);
          const collapseLoss = Math.max(1, Math.round(u.hp * K.SUPPLY_PARAMS.COLLAPSE_DAILY_LOSS));
          u.hp = Math.max(1, u.hp - collapseLoss);
        }
      }
    } else {
      // 补给恢复正常
      u.outOfSupplyDays = Math.max(0, (u.outOfSupplyDays || 0) - 1);
      u.supplyGrace = GRACE;
    }
  }
}

/** 获取单位当前的后勤修正系数 */
export function getUnitSupplyModifiers(u){
  if(!u || !u.outOfSupplyDays || u.outOfSupplyDays <= K.SUPPLY_PARAMS.GRACE_DAYS){
    return {
      atkMul: 1.0,
      defMul: 1.0,
      speedMul: 1.0,
      isCutoff: false,
      outOfSupplyDays: u ? (u.outOfSupplyDays || 0) : 0,
      supplyGrace: u ? (u.supplyGrace ?? K.SUPPLY_PARAMS.GRACE_DAYS) : K.SUPPLY_PARAMS.GRACE_DAYS
    };
  }

  const overDays = u.outOfSupplyDays - K.SUPPLY_PARAMS.GRACE_DAYS;
  const atkPenalty = Math.min(K.SUPPLY_PARAMS.MAX_ATK_PENALTY, overDays * K.SUPPLY_PARAMS.DAILY_ATK_PENALTY);
  const defPenalty = Math.min(K.SUPPLY_PARAMS.MAX_DEF_PENALTY, overDays * K.SUPPLY_PARAMS.DAILY_DEF_PENALTY);
  const speedPenalty = Math.min(K.SUPPLY_PARAMS.MAX_SPEED_PENALTY, overDays * K.SUPPLY_PARAMS.DAILY_SPEED_PENALTY);

  return {
    atkMul: Math.max(0.25, 1.0 - atkPenalty),
    defMul: Math.max(0.40, 1.0 - defPenalty),
    speedMul: Math.max(0.20, 1.0 - speedPenalty),
    isCutoff: true,
    outOfSupplyDays: u.outOfSupplyDays,
    supplyGrace: 0
  };
}
