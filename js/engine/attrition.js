/* ============================================================
   engine/attrition.js —— 一战专属：消耗战、封锁与革命系统 (v5.0 §2.3 / E1)
   管理国家战争疲惫(0–100)、大西洋海上封锁、无限制潜艇战与帝国解体/革命退场
   ============================================================ */

export function initAttrition(world){
  if(world.era !== 'ww1') return;
  for(const natId in world.nations){
    const n = world.nations[natId];
    n.warExhaustion = n.warExhaustion || 0;
    n.casualties = n.casualties || 0;
    n.strikesOccurred = n.strikesOccurred || false;
    n.revolutionDone = n.revolutionDone || false;
  }
}

/**
 * 每日消耗与疲惫累加 tick
 */
export function attritionTick(world, rng){
  if(world.era !== 'ww1') return;
  initAttrition(world);

  // 1. 海上封锁判定：协约国(英法)海军总实力 vs 同盟国
  const gbr = world.nations.GBR;
  const ger = world.nations.GER;
  const isBlockaded = gbr && gbr.alive && (!ger || !ger.subUnrestricted);

  if(isBlockaded && ger && ger.alive){
    ger.warExhaustion = Math.min(100, +(ger.warExhaustion + 0.5).toFixed(2));
    ger.modifiers = ger.modifiers || {};
    ger.modifiers.milOutput = -0.15; // 封锁致使产能惩罚
  }

  // 2. 无限制潜艇战倒计时与美军参战
  if(world.unrestrictedSubActive){
    world.usEntryCountdown = (world.usEntryCountdown != null ? world.usEntryCountdown : 360) - 1;
    if(gbr) gbr.warExhaustion = Math.min(100, +(gbr.warExhaustion + 0.8).toFixed(2));

    if(world.usEntryCountdown <= 0 && !world.usEntered){
      world.usEntered = true;
      const usa = world.nations.USA;
      if(usa){
        usa.atWarWith = usa.atWarWith || [];
        if(!usa.atWarWith.includes('GER')) usa.atWarWith.push('GER');
        if(!usa.atWarWith.includes('AUS')) usa.atWarWith.push('AUS');
      }
      world.events = world.events || [];
      world.events.push({
        type: 'us_entry',
        day: world.day,
        important: true,
        text: `🇺🇸 巨人之怒：美国正式对同盟国宣战！首批美国远征军已抵达法国港口！`
      });
    }
  }

  // 3. 各国疲惫、社会罢工与革命/解体判定
  for(const natId in world.nations){
    const n = world.nations[natId];
    if(!n.alive) continue;

    // 伤亡换算疲惫
    if(n.newCasualties){
      n.warExhaustion = Math.min(100, +(n.warExhaustion + n.newCasualties / 300).toFixed(2));
      n.newCasualties = 0;
    }

    // 疲惫 >= 60: 触发大规模工农罢工与反战游行
    if(n.warExhaustion >= 60 && !n.strikesOccurred){
      n.strikesOccurred = true;
      n.stability = Math.max(10, (n.stability || 70) - 20);
      world.events = world.events || [];
      world.events.push({
        type: 'strike',
        day: world.day,
        important: true,
        text: `⚠️ 国内反战风暴：${n.name} 爆发全国性工人罢工与面包暴动，社会稳定度重挫！`
      });
    }

    // 疲惫 >= 80: 历史崩溃判定
    if(n.warExhaustion >= 80 && !n.revolutionDone){
      n.revolutionDone = true;

      // 俄国 1917 革命退出东线
      if(natId === 'RUS'){
        n.hasRevolution = true;
        n.exitedWar = true;
        n.atWarWith = [];
        world.events = world.events || [];
        world.events.push({
          type: 'revolution_rus',
          day: world.day,
          important: true,
          text: `🚩 十月风暴：俄罗斯爆发苏维埃革命，宣布退出帝国主义大战！东线全面停火！`
        });
        // 俄军部队脱离前线
        for(const u of (world.units || [])){
          if(u.nat === 'RUS') u.order = null;
        }
      }

      // 奥匈帝国与奥斯曼帝国多民族瓦解
      else if(natId === 'AUS' || natId === 'OTT'){
        n.hasCollapsed = true;
        n.alive = false;
        n.capitulated = true;
        world.events = world.events || [];
        world.events.push({
          type: 'empire_collapse',
          day: world.day,
          important: true,
          text: `💥 帝国解体：在旷日持久的消耗泥潭中，【${n.name}】境内各民族相继宣布独立，帝国土崩瓦解！`
        });
      }

      // 德国水兵起义
      else if(natId === 'GER'){
        n.stability = 10;
        world.events = world.events || [];
        world.events.push({
          type: 'mutiny_ger',
          day: world.day,
          important: true,
          text: `⚓ 基尔水兵起义：帝国海军水兵拒绝出海决战，柏林宣布成立共和国并请求停战谈判！`
        });
      }
    }
  }
}

/**
 * 德国决策启动“无限制潜艇战”
 */
export function activateUnrestrictedSubWarfare(world){
  world.unrestrictedSubActive = true;
  world.usEntryCountdown = 360; // 12 个月倒计时
  const ger = world.nations.GER;
  if(ger) ger.subUnrestricted = true;

  world.events = world.events || [];
  world.events.push({
    type: 'unrestricted_sub_decision',
    day: world.day,
    important: true,
    text: `🌊 战略豪赌：德意志帝国批准【无限制潜艇战】！潜艇部队受令击沉一切开往英国的船只！`
  });
}

export const triggerUnrestrictedSubmarineWarfare = activateUnrestrictedSubWarfare;

/**
 * 累加/修改国家战争疲惫
 */
export function updateExhaustion(world, natId, delta){
  const nat = world.nations[natId];
  if(!nat) return 0;
  nat.warExhaustion = Math.min(100, Math.max(0, +((nat.warExhaustion || 0) + delta).toFixed(2)));
  return nat.warExhaustion;
}

/**
 * 手动施加封锁惩罚
 */
export function applyBlockadePenalty(world, natId){
  const nat = world.nations[natId];
  if(!nat) return;
  nat.activeModifiers = nat.activeModifiers || [];
  if(!nat.activeModifiers.some(m => m.id === 'blockade_hunger')){
    nat.activeModifiers.push({
      id: 'blockade_hunger',
      name: '北海海上严密封锁',
      milOutput: -0.15,
      exhaustionPerDay: 0.5
    });
  }
}

