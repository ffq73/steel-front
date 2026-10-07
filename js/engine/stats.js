/* ============================================================
   engine/stats.js —— 战损统计、历史时序与战报日志核心引擎 (v9.0 §4-N6) [H]
   包含：
   1. Ledger 全球各国对比总表 (对齐 HOI4 1024×703 规格)
   2. 每日时序数据采样（工厂/师数/伤亡/装备历史曲线，上限365天）
   3. 真实战损追踪：人员伤亡 (Casualties) 与各型装备战损 (Equipment Losses)
   4. 战役日志 (Battle Log & AAR) 记录与结构化归档 (上限200条)
   ============================================================ */

import { UNITS } from '../data/units.js';

/* 1. 初始化统计与战损体系 [H] */
export function initStats(world){
  world.stats = world.stats || {};
  world.stats.casualties = world.stats.casualties || {};
  world.stats.losses = world.stats.losses || {};
  world.stats.history = world.stats.history || [];
  world.stats.battleLog = world.stats.battleLog || [];

  for(const natId in world.nations){
    if(world.stats.casualties[natId] == null){
      world.stats.casualties[natId] = 0;
    }
    if(!world.stats.losses[natId]){
      world.stats.losses[natId] = { inf_eq: 0, art_eq: 0, tank_eq: 0, truck_eq: 0, sup_eq: 0 };
    }
  }
}

/* 2. 战役事件与战损结算归档 [H]
   - 根据战斗报告 rep 计算攻守双方人命伤亡与装备战损
   - 写入 world.stats.battleLog 与累加国家损失总账 */
export function recordBattleStats(world, rep, atkNat, defNat, hex){
  if(!world.stats) initStats(world);
  if(!rep || !rep.rounds || !rep.rounds.length) return;

  const day = world.day;
  const q = hex ? hex.q : 0;
  const r = hex ? hex.r : 0;
  const hexName = (hex && hex.city) ? hex.city.name : `坐标[${q},${r}]`;

  let totalHpDmg = 0;
  let totalOrgDmg = 0;
  let totalHits = 0;
  for(const rd of rep.rounds){
    totalHpDmg += (rd.hpDmg || 0);
    totalOrgDmg += (rd.orgDmg || 0);
    totalHits += (rd.hits || 0);
  }

  // 守方受创计算：基准 1 点 HP 损失 ≈ 120 官兵伤亡
  const defCasualties = Math.round(totalHpDmg * 120);
  // 攻方反击受创计算：攻方受反击伤害约占守方受创的 40%-80%
  const atkCasualties = Math.round(totalHpDmg * 75);

  world.stats.casualties[defNat] = (world.stats.casualties[defNat] || 0) + defCasualties;
  world.stats.casualties[atkNat] = (world.stats.casualties[atkNat] || 0) + atkCasualties;

  // 装备折损追踪（步枪/火炮/装甲）
  const defEqLoss = Math.round(defCasualties * 0.45);
  const atkEqLoss = Math.round(atkCasualties * 0.45);
  world.stats.losses[defNat] = world.stats.losses[defNat] || { inf_eq: 0, art_eq: 0, tank_eq: 0, truck_eq: 0, sup_eq: 0 };
  world.stats.losses[atkNat] = world.stats.losses[atkNat] || { inf_eq: 0, art_eq: 0, tank_eq: 0, truck_eq: 0, sup_eq: 0 };

  world.stats.losses[defNat].inf_eq += Math.round(defEqLoss * 0.7);
  world.stats.losses[defNat].art_eq += Math.round(defEqLoss * 0.15);
  world.stats.losses[defNat].tank_eq += Math.round(defEqLoss * 0.15);

  world.stats.losses[atkNat].inf_eq += Math.round(atkEqLoss * 0.7);
  world.stats.losses[atkNat].art_eq += Math.round(atkEqLoss * 0.15);
  world.stats.losses[atkNat].tank_eq += Math.round(atkEqLoss * 0.15);

  // 被全歼部队额外清算
  const destroyedCount = rep.destroyed ? rep.destroyed.length : 0;
  if(destroyedCount > 0){
    for(const d of rep.destroyed){
      const dNat = d.nat || defNat;
      const dCas = 1200; // 整师覆灭按 1200 伤亡计
      world.stats.casualties[dNat] = (world.stats.casualties[dNat] || 0) + dCas;
      if(world.stats.losses[dNat]){
        world.stats.losses[dNat].inf_eq += 300;
        world.stats.losses[dNat].art_eq += 60;
        world.stats.losses[dNat].tank_eq += 30;
      }
    }
  }

  // 归档战役日志条目 (AAR 战史数据源)
  const victor = rep.capturedBy ? atkNat : (rep.retreat && rep.retreat.length ? atkNat : defNat);
  const battleEntry = {
    id: (world.stats.battleLog.length + 1),
    day,
    q,
    r,
    hexName,
    atkNat,
    defNat,
    atkCasualties,
    defCasualties,
    orgDmg: Math.round(totalOrgDmg),
    hpDmg: Math.round(totalHpDmg),
    victor,
    captured: !!rep.capturedBy,
    destroyedCount
  };

  world.stats.battleLog.unshift(battleEntry);
  if(world.stats.battleLog.length > 200){
    world.stats.battleLog.pop();
  }
}

/* 3. 每日时序数据采样 [H]
   - 记录每日全球与主要参战国指标，用于绘制折线图
   - 最多保留 365 天历史记录 */
export function statsTick(world){
  if(!world.stats) initStats(world);

  const snapshot = {
    day: world.day,
    nations: {}
  };

  for(const natId in world.nations){
    const n = world.nations[natId];
    if(!n) continue;
    const divs = world.units.filter(u => u.nat === natId && u.hp > 0).length;
    snapshot.nations[natId] = {
      alive: !!n.alive,
      civ: n.civ || 0,
      mil: n.mil || 0,
      factories: (n.civ || 0) + (n.mil || 0),
      equip: n.equip || 0,
      divs,
      casualties: world.stats.casualties[natId] || 0,
      warSupport: n.warSupport || 50,
      stability: n.stability || 60
    };
  }

  world.stats.history.push(snapshot);
  if(world.stats.history.length > 365){
    world.stats.history.shift();
  }
}

/* 4. 获取 Ledger 全球各国大账本数据 [H] */
export function getLedgerData(world){
  if(!world.stats) initStats(world);

  const result = [];
  const factionMap = {
    GER: '轴心同盟 (Axis)', G: '轴心同盟 (Axis)',
    ITA: '轴心同盟 (Axis)', I: '轴心同盟 (Axis)',
    JAP: '轴心同盟 (Axis)', J: '轴心同盟 (Axis)',
    SOV: '共产国际 (Comintern)', S: '共产国际 (Comintern)',
    GBR: '同盟国 (Allies)', B: '同盟国 (Allies)',
    FRA: '同盟国 (Allies)', F: '同盟国 (Allies)',
    USA: '同盟国 (Allies)', U: '同盟国 (Allies)',
    POL: '同盟国 (Allies)', P: '同盟国 (Allies)'
  };

  for(const natId in world.nations){
    const n = world.nations[natId];
    if(!n) continue;

    const divs = world.units.filter(u => u.nat === natId && u.hp > 0).length;
    const controlledHexes = world.hexes.filter(h => h.owner === natId).length;
    const coreHexes = world.hexes.filter(h => (h._orig || h.owner) === natId).length;
    const casualties = world.stats.casualties[natId] || 0;
    const losses = world.stats.losses[natId] || { inf_eq: 0, art_eq: 0, tank_eq: 0 };
    const totalLossEq = (losses.inf_eq || 0) + (losses.art_eq || 0) + (losses.tank_eq || 0);

    const civ = n.civ || 0;
    const mil = n.mil || 0;
    const totalFactories = civ + mil;
    const industrialScore = civ * 3 + mil * 5;

    result.push({
      id: natId,
      name: n.name || natId,
      alive: !!n.alive,
      color: n.color || '#888',
      faction: factionMap[natId] || '中立未结盟 (Neutral)',
      controlledHexes,
      coreHexes,
      divs,
      civ,
      mil,
      totalFactories,
      industrialScore,
      equipStock: n.equip || 0,
      totalLossEq,
      casualties,
      armyXp: Math.floor(n.armyXp || 0),
      airXP: Math.floor(n.airXP || 0),
      navyXP: Math.floor(n.navyXP || 0),
      atWarCount: (n.atWarWith || []).length
    });
  }

  return result;
}

/* 5. Ledger 过滤与排序辅助函数 [H] */
export function sortAndFilterLedger(ledgerList, filter = 'all', sortKey = 'totalFactories', asc = false){
  let list = ledgerList.slice();

  if(filter === 'axis'){
    list = list.filter(item => item.faction.includes('轴心'));
  } else if(filter === 'allies'){
    list = list.filter(item => item.faction.includes('同盟'));
  } else if(filter === 'comintern'){
    list = list.filter(item => item.faction.includes('共产'));
  } else if(filter === 'at_war'){
    list = list.filter(item => item.atWarCount > 0);
  }

  list.sort((a, b) => {
    let vA = a[sortKey] != null ? a[sortKey] : 0;
    let vB = b[sortKey] != null ? b[sortKey] : 0;
    if(typeof vA === 'string'){
      return asc ? vA.localeCompare(vB) : vB.localeCompare(vA);
    }
    return asc ? (vA - vB) : (vB - vA);
  });

  return list;
}
