/* ============================================================
   engine/nuclear.js —— 核威慑、DEFCON战备与末日钟系统 (v5.0 §2.5 / E3)
   核武库互相确保毁灭、五级DEFCON警报阶梯、大国互攻惩罚与双输终局
   ============================================================ */

export const DEFCON_LEVELS = {
  5: { level: 5, name: 'DEFCON 5', title: '常规常态戒备 (Normal Peacetime Readiness)', desc: '和平时期全军正常训练与战备状态。' },
  4: { level: 4, name: 'DEFCON 4', title: '情报强化监视 (Increased Intelligence Watch)', desc: '侦察卫星与防空雷达全面升格，严密监视弹道导弹发射井动向。' },
  3: { level: 3, name: 'DEFCON 3', title: '空军战备升格 (Air Force Ready in 15 Minutes)', desc: '战略轰炸机挂弹升空巡逻，全军调动可在 15 分钟内执行。' },
  2: { level: 2, name: 'DEFCON 2', title: '战略红线紧迫 (Armed Forces Ready in 6 Hours)', desc: '核潜艇进入预设发射阵位，民防掩体全部开启，全面核战争迫在眉睫。' },
  1: { level: 1, name: 'DEFCON 1', title: '核战争最高决断 (Maximum Readiness / Nuclear War)', desc: '国家指挥中枢授权战略核反击，洲际导弹全线发射，终结人类文明。' }
};

export function initNuclear(world){
  world.nuclear = world.nuclear || {
    enabled: true,
    defcon: 5,
    // 末日钟（距离午夜核毁灭的分数，默认 7 分钟）
    doomsdayClock: 7.0,
    arsenals: {
      USA: 1200,
      SOV: 1100,
      GBR: 80,
      FRA: 60,
      CHN: 40
    },
    directWarMonths: 0,
    apocalyptic: false
  };
}

export function getDefcon(world){
  initNuclear(world);
  return world.nuclear.defcon;
}

export function setDefcon(world, level, reason = '战略危机升级'){
  initNuclear(world);
  const targetLevel = Math.max(1, Math.min(5, level));
  world.nuclear.defcon = targetLevel;

  const info = DEFCON_LEVELS[targetLevel];
  world.events = world.events || [];
  world.events.push({
    type: 'defcon_shift',
    day: world.day,
    important: true,
    text: `🚨【战略战备阶梯转级】全军进入【${info.name} - ${info.title}】！原因：${reason}。`
  });

  // DEFCON 1 即触发核毁灭双输终局
  if(targetLevel === 1 && !world.nuclear.apocalyptic){
    world.nuclear.apocalyptic = true;
    world.nuclear.doomsdayClock = 0;
    world.over = {
      win: false,
      text: '💥【DEFCON 1：全球核浩劫降临】战略核打击全面展开，互相确保毁灭成为现实。全球生态崩溃，全盘双输！'
    };
  }
}

export function isMutualDeterrenceActive(world, natA, natB){
  if(!world.nuclear) return false;
  const a = world.nuclear.arsenals[natA] || 0;
  const b = world.nuclear.arsenals[natB] || 0;
  if(a < 50 || b < 50) return false;
  const ratio = Math.min(a, b) / Math.max(a, b);
  return ratio >= 0.4;
}

export function escalateDoomsdayClock(world, delta, reason){
  initNuclear(world);
  world.nuclear.doomsdayClock = Math.max(0, world.nuclear.doomsdayClock - delta);

  // 映射末日钟至 DEFCON
  if(world.nuclear.doomsdayClock <= 0){
    setDefcon(world, 1, reason);
    return;
  } else if(world.nuclear.doomsdayClock <= 2.0){
    if(world.nuclear.defcon > 2) setDefcon(world, 2, reason);
  } else if(world.nuclear.doomsdayClock <= 4.0){
    if(world.nuclear.defcon > 3) setDefcon(world, 3, reason);
  } else if(world.nuclear.doomsdayClock <= 6.0){
    if(world.nuclear.defcon > 4) setDefcon(world, 4, reason);
  }

  world.events.push({
    type: 'nuclear_escalation',
    day: world.day,
    important: true,
    text: `☢️【末日钟指针拨近】${reason}！当前距离核毁灭终点仅剩【${world.nuclear.doomsdayClock.toFixed(1)} 分钟】！`
  });
}

export function nuclearTick(world){
  if(!world.nuclear || world.nuclear.apocalyptic) return;

  // 检测美苏两大核大国是否处于直接宣战交火状态
  const usa = world.nations['USA'];
  const sov = world.nations['SOV'];

  if(usa && sov && usa.atWarWith && usa.atWarWith.includes('SOV')){
    world.nuclear.directWarMonths++;
    // 大国直接互攻：末日钟每月疾速逼近 2.0 分钟！
    escalateDoomsdayClock(world, 2.0, `美苏两大核超级大国爆发正面直接交火（第 ${world.nuclear.directWarMonths} 月）`);
  } else {
    // 处于和平与缓和期时，末日钟缓慢回弹（每年远离 0.5 分钟，上限 10 分钟）
    if(world.nuclear.directWarMonths > 0) world.nuclear.directWarMonths = 0;
    if(world.nuclear.doomsdayClock < 10){
      world.nuclear.doomsdayClock = Math.min(10, world.nuclear.doomsdayClock + 0.05);
    }
  }
}
