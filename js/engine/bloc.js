/* ============================================================
   engine/bloc.js —— 冷战地缘政治：阵营对抗与影响力渗透系统 (v5.0 §2.5 / E3)
   实现两大阵营（北约 / 华约 / 不结盟）地缘划界、
   秘密行动（政变/渗透/策反）与阵营归属动态变迁
   ============================================================ */

export const BLOCS = {
  nato: {
    id: 'nato',
    name: '北大西洋公约组织 (NATO)',
    leader: 'USA',
    bonus: { civOutput: 0.15, techSpeed: 0.10 }
  },
  warsaw: {
    id: 'warsaw',
    name: '华沙条约组织 (Warsaw Pact)',
    leader: 'SOV',
    bonus: { milOutput: 0.20, orgRecovery: 0.15 }
  },
  non_aligned: {
    id: 'non_aligned',
    name: '不结盟运动 (Non-Aligned Movement)',
    leader: null,
    bonus: { stability: 15 }
  }
};

/**
 * 初始化冷战阵营与地缘影响力
 */
export function initBloc(world){
  world.blocs = world.blocs || {
    nato: ['USA', 'GBR', 'FRA', 'CAN', 'ITA', 'BEL', 'NLD', 'NOR', 'DNK', 'PRT', 'TUR', 'GRC', 'FRG'],
    warsaw: ['SOV', 'POL', 'GDR', 'CSK', 'HUN', 'ROM', 'BGR', 'ALB'],
    non_aligned: ['YUG', 'IND', 'EGY', 'IDN']
  };

  // 为每个国家设定初始影响力和阵营
  for(const natId in world.nations){
    const nat = world.nations[natId];
    nat.influence = nat.influence || {
      USA: world.blocs.nato.includes(natId) ? 80 : (world.blocs.warsaw.includes(natId) ? 10 : 30),
      SOV: world.blocs.warsaw.includes(natId) ? 80 : (world.blocs.nato.includes(natId) ? 10 : 30)
    };
    if(!nat.alignment){
      if(world.blocs.nato.includes(natId)) nat.alignment = 'nato';
      else if(world.blocs.warsaw.includes(natId)) nat.alignment = 'warsaw';
      else nat.alignment = 'non_aligned';
    }
  }
}

/**
 * 超级大国对目标国投资地缘影响力
 */
export function investInfluence(world, superpower, targetNat, amount = 15){
  const sp = world.nations[superpower];
  const target = world.nations[targetNat];
  if(!sp || !target) return false;

  target.influence = target.influence || { USA: 30, SOV: 30 };
  const current = target.influence[superpower] || 0;
  target.influence[superpower] = Math.min(100, current + amount);

  world.events = world.events || [];
  world.events.push({
    type: 'influence_invest',
    day: world.day,
    important: false,
    text: `🌐 战略渗透：${sp.name} 向【${target.name}】投入政治与经济资本，影响力提升至 ${target.influence[superpower]}%！`
  });
  return true;
}

/**
 * 执行秘密情报行动 (Covert Ops: realign / coup / suppress)
 */
export function conductCovertOp(world, superpower, targetNat, opType, rng){
  const sp = world.nations[superpower];
  const target = world.nations[targetNat];
  if(!sp || !target) return { success: false, reason: 'invalid_targets' };

  target.influence = target.influence || { USA: 30, SOV: 30 };
  const rival = superpower === 'USA' ? 'SOV' : 'USA';
  const roll = rng ? rng() : Math.random();

  if(opType === 'realign'){
    // 和平策反：增加己方 20 影响，压制敌方 15 影响
    target.influence[superpower] = Math.min(100, (target.influence[superpower] || 0) + 20);
    target.influence[rival] = Math.max(0, (target.influence[rival] || 0) - 15);
    return { success: true, opType };
  }

  if(opType === 'coup'){
    // 策动政变：成功率与相对影响力强挂钩
    const diff = (target.influence[superpower] || 0) - (target.influence[rival] || 0);
    const chance = Math.max(0.15, Math.min(0.85, 0.45 + diff / 100));

    if(roll < chance){
      const newAlign = superpower === 'USA' ? 'nato' : 'warsaw';
      target.alignment = newAlign;
      target.influence[superpower] = 90;
      target.influence[rival] = 10;
      world.events = world.events || [];
      world.events.push({
        type: 'coup_success',
        day: world.day,
        important: true,
        text: `🚨 惊天政变：在【${sp.name}】情报机关暗中策动下，【${target.name}】政权被推翻，新政府正式倒向【${BLOCS[newAlign].name}】！`
      });
      return { success: true, opType, flipped: true };
    } else {
      // 政变流产并遭到反弹
      target.influence[superpower] = Math.max(0, (target.influence[superpower] || 0) - 25);
      world.events = world.events || [];
      world.events.push({
        type: 'coup_failed',
        day: world.day,
        important: true,
        text: `⚠️ 阴谋破产：【${sp.name}】在【${target.name}】策划的秘密军事政变遭到挫败，国际声誉受损！`
      });
      return { success: false, opType, leaked: true };
    }
  }

  if(opType === 'suppress'){
    // 清除敌特：削弱对手 25 点影响
    target.influence[rival] = Math.max(0, (target.influence[rival] || 0) - 25);
    return { success: true, opType };
  }

  return { success: false, reason: 'unknown_op' };
}

/**
 * 冷战阵营月度结算 tick
 */
export function blocTick(world, rng){
  if(world.era !== 'coldwar') return;
  initBloc(world);

  for(const natId in world.nations){
    const nat = world.nations[natId];
    if(natId === 'USA' || natId === 'SOV') continue;
    if(!nat.influence) continue;

    const usaInf = nat.influence.USA || 0;
    const sovInf = nat.influence.SOV || 0;
    const oldAlign = nat.alignment;

    if(usaInf - sovInf >= 35 && nat.alignment !== 'nato'){
      nat.alignment = 'nato';
      world.events = world.events || [];
      world.events.push({
        type: 'alignment_shift',
        day: world.day,
        important: true,
        text: `🤝 地缘倒向：【${nat.name}】正式加入西方阵营（NATO 观察与同盟体系）！`
      });
    } else if(sovInf - usaInf >= 35 && nat.alignment !== 'warsaw'){
      nat.alignment = 'warsaw';
      world.events = world.events || [];
      world.events.push({
        type: 'alignment_shift',
        day: world.day,
        important: true,
        text: `🚩 红色浪潮：【${nat.name}】正式加入东方阵营（华约防御网络）！`
      });
    } else if(Math.abs(usaInf - sovInf) < 20 && nat.alignment !== 'non_aligned' && !['GBR', 'POL'].includes(natId)){
      nat.alignment = 'non_aligned';
    }
  }
}
