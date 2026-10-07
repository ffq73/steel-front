/* ============================================================
   engine/drones.js —— 现代无人机侦察、FPV精确打击与电子对抗层 (v5.0 §2.6 / E4)
   实现近距无人侦察（破除堑壕防护）、FPV自杀巡飞弹消耗、
   热成像夜战打击与车载/单兵电子战(EW)干扰软杀伤
   ============================================================ */

export function initDrones(world){
  world.drones = world.drones || {
    reconCoverage: {}, // { natId: number (0-1.0) }
    ewIntensity: {},   // { natId: number (0-1.0) }
    fpvSorties: 0
  };
}

/**
 * 战区展开无人机高频侦察
 * 侦察削弱目标格 50% 堑壕掩体效益
 */
export function applyDroneRecon(world, attackerNat, targetHexIndex){
  initDrones(world);
  const nat = world.nations[attackerNat];
  if(!nat) return 1.0;

  // 检查是否具备无人机装备
  const droneCount = nat.equipment ? (nat.equipment.fpv_kamikaze_drone || nat.equipment.lancet_loitering || 0) : 10;
  if(droneCount <= 0) return 1.0;

  // 电子战压制率
  const hex = world.hexes[targetHexIndex];
  const defenderNat = hex ? hex.owner : null;
  const ewRate = defenderNat && world.drones.ewIntensity[defenderNat] ? world.drones.ewIntensity[defenderNat] : 0;

  // 实际侦察净收益：基准 50% 堑壕削减，被电子战抵扣
  const netReduction = Math.max(0.15, 0.50 * (1 - ewRate));
  return 1 - netReduction; // 返回堑壕系数 (0.50 - 0.85)
}

/**
 * 组织 FPV 巡飞弹精确打击任务
 */
export function launchFpvStrike(world, attackerNat, targetHexIndex, sorties = 20){
  initDrones(world);
  const nat = world.nations[attackerNat];
  if(!nat || !world.hexes[targetHexIndex]) return { success: false, reason: 'invalid_target' };

  // 扣除无人机库存
  if(nat.equipment && nat.equipment.fpv_kamikaze_drone != null){
    const used = Math.min(sorties, nat.equipment.fpv_kamikaze_drone);
    nat.equipment.fpv_kamikaze_drone -= used;
  }

  world.drones.fpvSorties += sorties;

  // 检查目标守军与电子战
  const hex = world.hexes[targetHexIndex];
  const ewVal = hex.owner && world.drones.ewIntensity[hex.owner] ? world.drones.ewIntensity[hex.owner] : 0.2;
  const hitRate = Math.max(0.3, 0.85 - ewVal); // 命中率受电子战压制

  const damageSoft = Math.round(sorties * hitRate * 1.5);
  const damageArmor = +(sorties * hitRate * 0.1).toFixed(1);

  // v8.0 M6：记录打击事件供地图绘制 FPV 准星动画（0.8s）
  world.fpvStrikes = world.fpvStrikes || [];
  world.fpvStrikes.push({ hexIdx: targetHexIndex, t: Date.now(), sorties });
  if(world.fpvStrikes.length > 12) world.fpvStrikes.shift();

  return {
    success: true,
    sorties,
    hitRate,
    damageSoft,
    damageArmor
  };
}

/**
 * 部署战术电子战 (EW) 保护屏障
 */
export function deployElectronicWarfare(world, natId, level = 0.6){
  initDrones(world);
  world.drones.ewIntensity[natId] = Math.min(0.9, Math.max(0, level));
  return world.drones.ewIntensity[natId];
}

/**
 * 每日无人机与电子对抗 tick
 */
export function dronesTick(world){
  if(world.era !== 'modern') return;
  initDrones(world);

  for(const natId in world.nations){
    const nat = world.nations[natId];
    if(!nat.alive) continue;
    // 自动根据电子战装备储备维持压制场
    const ewStock = nat.equipment ? (nat.equipment.electronic_warfare_ew || 0) : 0;
    world.drones.ewIntensity[natId] = ewStock > 10 ? 0.65 : (ewStock > 0 ? 0.35 : 0.10);
  }
}

/**
 * W0-D2：无人机战场辅助（现代）—— battle.js 调用入口
 * ------------------------------------------------------------
 * applyDroneRecon / deployElectronicWarfare 此前全库 0 引用，
 * 现代剧本的无人机与电子战对战斗零影响（无侦察机时返回 1.0）。
 * 电子战强度本身是活的（dronesTick 每日按 electronic_warfare_ew 库存刷新），
 * 只要把它接到壕沟上，现代战场就有了 EW / 无人机这条对抗线。
 * 返回值是「守方壕沟保留系数」（0.50 – 0.85）。
 */
export function droneReconModifier(world, attackerNat, hexIdx){
  if(!world || world.era !== 'modern') return 1.0;
  return applyDroneRecon(world, attackerNat, hexIdx);
}
