/* ============================================================
   engine/states.js —— 州 (State) 与省 (Province/Hex) 架构引擎 (W7-1)
   ------------------------------------------------------------
   HOI4 核心抽象：
     - Hex = Province (地块/战术格，师移动与交战的最小单元)
     - State = 州/大区 (战略与经济的基本单元，承载工厂槽位、人口、
       战略资源总量、铁路干线、港口、防空与基建)
   
   双层映射与兼容不变式：
     1. hex.stateId 严格指向所在 state.id
     2. state.provinces 数组保存所有从属 hex.idx
     3. 建筑/工厂双向镜像：hex.civ/mil 与 state.buildings.civ/mil
        实时同步，sim.js 的 B16 断言与现有渲染管线零破坏
     4. 占领与控制权结算：当敌军占领州内多数/核心省份时，
        州控制权 (state.owner) 同步转移
   ============================================================ */

import { K } from '../data/constants.js';

export function initStates(world){
  if(!world || !world.hexes) return [];
  const states = [];
  const stateById = {};
  const visited = new Set();
  let stateIdCounter = 1;

  // 1. 聚类属于同一国家 (owner) 且同一核心 (core) 的相邻陆地格
  for(const h of world.hexes){
    if(h.terrain === 'sea' || visited.has(h.idx)) continue;

    const cluster = [];
    const queue = [h];
    visited.add(h.idx);

    const matchOwner = h.owner;
    const matchCore = h.core || h.owner;

    while(queue.length > 0 && cluster.length < 5){
      const curr = queue.shift();
      cluster.push(curr);

      if(cluster.length >= 5) break;

      // 寻找相邻属于同一国家且未访问的陆地格
      for(const ni of (curr.adj || [])){
        const nh = world.hexes[ni];
        if(!nh || nh.terrain === 'sea' || visited.has(nh.idx)) continue;
        if(nh.owner === matchOwner && (nh.core || nh.owner) === matchCore){
          if(cluster.length + queue.length < 5){
            visited.add(nh.idx);
            queue.push(nh);
          }
        }
      }
    }

    // 释放 queue 中因数量上限未被加入当前聚类的节点
    while(queue.length > 0){
      const unassigned = queue.shift();
      visited.delete(unassigned.idx);
    }

    // 命名规则：如果包含城市，取最大城市名 + "大区/州"；否则取国名 + 序号
    const cityHex = cluster.find(x => x.city && x.city.cap) ||
                    cluster.filter(x => x.city).sort((a,b) => (b.city.w||0) - (a.city.w||0))[0];
    const nat = world.nations ? world.nations[matchOwner] : null;
    const natName = nat ? (nat.name || matchOwner) : matchOwner;
    const stateName = cityHex ? `${cityHex.city.name}大区` : `${natName}第${stateIdCounter}行省区`;

    const stateId = `state_${stateIdCounter++}`;

    // 汇总建筑与槽位
    let totalCiv = 0, totalMil = 0, maxInfra = 1, totalFort = 0, totalAirBase = 0, totalNavalBase = 0;
    let totalVp = 0, totalPop = 0;
    const resources = { oil: 0, rubber: 0, aluminum: 0, steel: 0, tungsten: 0, chromium: 0 };
    const ports = [];
    const supplyHubs = [];
    let maxRail = 0;

    for(const ch of cluster){
      ch.stateId = stateId;
      totalCiv += (ch.civ || 0);
      totalMil += (ch.mil || 0);
      maxInfra = Math.max(maxInfra, ch.infra || 1);
      totalFort += (ch.fort || 0);
      if(ch.buildings){
        totalAirBase += (ch.buildings.air_base || 0);
        totalNavalBase += (ch.buildings.naval_base || 0);
      } else if(ch.naval_base){
        totalNavalBase += ch.naval_base;
      }
      totalVp += (ch.vp || 0);
      totalPop += (ch.pop || K.POP_PER_HEX || 200000);
      maxRail = Math.max(maxRail, ch.railLevel || 0);

      if(ch.resources){
        for(const rk in ch.resources){
          if(resources[rk] != null) resources[rk] += ch.resources[rk];
        }
      }
      if((ch.naval_base || 0) > 0 || (ch.buildings && ch.buildings.naval_base > 0)){
        ports.push(ch.idx);
      }
      if(ch.city && (ch.city.cap || ch.city.w >= 3)){
        supplyHubs.push(ch.idx);
      }
    }

    // 建造槽位：基础每格 3 槽 + 城市规模加成
    const cityBonus = cityHex ? (cityHex.city.cap ? 6 : cityHex.city.w * 2) : 0;
    const buildingSlots = Math.min(25, cluster.length * 3 + cityBonus);

    const state = {
      id: stateId,
      name: stateName,
      owner: matchOwner,
      core: matchCore,
      provinces: cluster.map(x => x.idx),
      hexCount: cluster.length,
      buildingSlots,
      buildings: {
        civ: totalCiv,
        mil: totalMil,
        infra: maxInfra,
        fort: totalFort,
        air_base: totalAirBase,
        naval_base: totalNavalBase
      },
      resources,
      pop: totalPop,
      vp: totalVp,
      railLevel: maxRail,
      ports,
      supplyHubs,
      controller: matchOwner
    };

    states.push(state);
    stateById[stateId] = state;
  }

  world.states = states;
  world.stateById = stateById;
  return states;
}

export function getState(world, stateId){
  return (world && world.stateById) ? (world.stateById[stateId] || null) : null;
}

export function getHexState(world, hex){
  if(!world || !hex || !hex.stateId || !world.stateById) return null;
  return world.stateById[hex.stateId] || null;
}

export function syncHexToState(world, hex){
  const state = getHexState(world, hex);
  if(!state || !world.hexes) return;
  let totalCiv = 0, totalMil = 0, maxInfra = 1, totalFort = 0, totalAir = 0, totalNaval = 0;
  for(const pIdx of state.provinces){
    const h = world.hexes[pIdx];
    if(!h) continue;
    totalCiv += (h.civ || 0);
    totalMil += (h.mil || 0);
    maxInfra = Math.max(maxInfra, h.infra || 1);
    totalFort += (h.fort || 0);
    if(h.buildings){
      totalAir += (h.buildings.air_base || 0);
      totalNaval += (h.buildings.naval_base || 0);
    }
  }
  state.buildings.civ = totalCiv;
  state.buildings.mil = totalMil;
  state.buildings.infra = maxInfra;
  state.buildings.fort = totalFort;
  state.buildings.air_base = totalAir;
  state.buildings.naval_base = totalNaval;
}

export function updateStateOwnership(world, stateId){
  const state = getState(world, stateId);
  if(!state || !world.hexes) return;
  const ownerCounts = {};
  for(const pIdx of state.provinces){
    const h = world.hexes[pIdx];
    if(h && h.owner){
      ownerCounts[h.owner] = (ownerCounts[h.owner] || 0) + 1;
    }
  }
  let maxOwner = state.owner, maxCount = 0;
  for(const own in ownerCounts){
    if(ownerCounts[own] > maxCount){
      maxCount = ownerCounts[own];
      maxOwner = own;
    }
  }
  state.owner = maxOwner;
  state.controller = maxOwner;
}
