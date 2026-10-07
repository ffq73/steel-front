/* ============================================================
   engine/diplomacy.js —— 外交网络系统（制裁/军援/阵营博弈 §3.9）
   ============================================================ */

export function initDiplomacy(world){
  world.diplomacy = world.diplomacy || {
    sanctions: [], // [ { from, to, date, severity } ]
    milAidPipes: [] // [ { from, to, monthlyEquip } ]
  };
}

export function applySanction(world, fromNat, toNat, severity = 'heavy'){
  world.diplomacy = world.diplomacy || { sanctions: [], milAidPipes: [] };
  const existing = world.diplomacy.sanctions.find(s => s.from === fromNat && s.to === toNat);
  if(!existing){
    world.diplomacy.sanctions.push({ from: fromNat, to: toNat, severity, date: world.day });
    const target = world.nations[toNat];
    if(target){
      target.modifiers.milOutput = (target.modifiers.milOutput || 0) - (severity === 'heavy' ? 0.15 : 0.08);
      target.stability = Math.max(10, (target.stability || 60) - 5);
    }
    world.events.push({
      type: 'sanction_applied',
      day: world.day,
      important: true,
      text: `🚫【严厉经济制裁】${world.nations[fromNat]?.name || fromNat} 对 ${world.nations[toNat]?.name || toNat} 实施单边贸易封锁与高科技禁运！`
    });
    return true;
  }
  return false;
}

export function establishMilAidPipe(world, fromNat, toNat, monthlyEquip = 100){
  world.diplomacy = world.diplomacy || { sanctions: [], milAidPipes: [] };
  const existing = world.diplomacy.milAidPipes.find(p => p.from === fromNat && p.to === toNat);
  if(!existing){
    world.diplomacy.milAidPipes.push({ from: fromNat, to: toNat, monthlyEquip });
    world.events.push({
      type: 'mil_aid_pipe',
      day: world.day,
      important: true,
      text: `📦【军援生命线管道开启】${world.nations[fromNat]?.name || fromNat} 向 ${world.nations[toNat]?.name || toNat} 建立常态化重武器与防空弹药补给走廊！`
    });
    return true;
  }
  return false;
}

export function diplomacyTick(world){
  if(!world.diplomacy) return;

  // 军援管道按月/周输送
  for(const pipe of world.diplomacy.milAidPipes){
    const donor = world.nations[pipe.from];
    const receiver = world.nations[pipe.to];
    if(donor && receiver && donor.alive && receiver.alive){
      const actualTransfer = Math.min(pipe.monthlyEquip, donor.equip);
      donor.equip -= actualTransfer;
      receiver.equip += actualTransfer;
    }
  }
}

/**
 * 阵营管理系统 (v5.0 §2.4 / E2)
 */
export function createFaction(world, factionId, name, leaderNatId){
  world.factions = world.factions || {};
  world.factions[factionId] = {
    id: factionId,
    name,
    leader: leaderNatId,
    members: [leaderNatId]
  };
  const nat = world.nations[leaderNatId];
  if(nat) nat.faction = factionId;
  return world.factions[factionId];
}

export function joinFaction(world, natId, factionId){
  world.factions = world.factions || {};
  const faction = world.factions[factionId];
  const nat = world.nations[natId];
  if(!faction || !nat) return false;

  if(!faction.members.includes(natId)){
    faction.members.push(natId);
    nat.faction = factionId;

    world.events = world.events || [];
    world.events.push({
      type: 'faction_join',
      day: world.day,
      important: true,
      text: `🤝 阵营扩张：【${nat.name}】正式加入【${faction.name}】！`
    });
    return true;
  }
  return false;
}

export function leaveFaction(world, natId){
  world.factions = world.factions || {};
  const nat = world.nations[natId];
  if(!nat || !nat.faction) return false;

  const faction = world.factions[nat.faction];
  if(faction){
    faction.members = faction.members.filter(m => m !== natId);
    nat.faction = null;
    world.events = world.events || [];
    world.events.push({
      type: 'faction_leave',
      day: world.day,
      important: true,
      text: `🚪 阵营分裂：【${nat.name}】宣布脱离【${faction.name}】！`
    });
    return true;
  }
  return false;
}

export function getFactionMembers(world, factionId){
  if(!world.factions || !world.factions[factionId]) return [];
  return world.factions[factionId].members;
}

/**
 * 宣战与战争目标绑定 [H] (W5)
 */
export function declareWar(world, fromNat, toNat, wargoal = null){
  const from = world.nations[fromNat];
  const to = world.nations[toNat];
  if(!from || !to || fromNat === toNat) return false;

  from.atWarWith = from.atWarWith || [];
  to.atWarWith = to.atWarWith || [];

  if(!from.atWarWith.includes(toNat)) from.atWarWith.push(toNat);
  if(!to.atWarWith.includes(fromNat)) to.atWarWith.push(fromNat);

  world.activeWargoals = world.activeWargoals || [];
  const goalObj = typeof wargoal === 'string'
    ? { type: wargoal.split(':')[0], arg: wargoal.split(':')[1] || null }
    : (wargoal || { type: 'conquer', arg: null });

  world.activeWargoals.push({
    from: fromNat,
    to: toNat,
    goal: goalObj,
    day: world.day
  });

  world.events = world.events || [];
  world.events.push({
    type: 'war_declared',
    day: world.day,
    important: true,
    text: `⚔️【宣战】${from.name} 正式向 ${to.name} 宣战！战争目标：${goalObj.name || goalObj.type}。`
  });
  return true;
}

