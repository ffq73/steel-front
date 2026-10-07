import { K } from '../data/constants.js';

export function createTheater(world, natId, name){
  const nat = world.nations[natId];
  if(!nat) return null;
  nat.theaters = nat.theaters || {};
  const id = `theater_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const theater = {
    id,
    name,
    nat: natId,
    generalId: null,
    fronts: [],
    armies: [],
    units: []
  };
  nat.theaters[id] = theater;
  return theater;
}

export function assignGeneralToTheater(world, theaterId, generalId, natId){
  const nat = world.nations[natId];
  if(!nat || !nat.theaters || !nat.theaters[theaterId]) return false;

  const theater = nat.theaters[theaterId];
  theater.generalId = generalId;

  const c = (world.characters || []).find(x => x.id === generalId);
  if(c){
    c.assignedTheater = theaterId;
    c.assignedNation = natId;
  }
  return true;
}

export function assignFrontToTheater(world, theaterId, frontId, natId){
  const nat = world.nations[natId];
  if(!nat || !nat.theaters || !nat.theaters[theaterId]) return false;

  const theater = nat.theaters[theaterId];
  if(!theater.fronts.includes(frontId)){
    theater.fronts.push(frontId);
  }
  return true;
}

export function assignArmyToTheater(world, theaterId, armyId, natId){
  const nat = world.nations[natId];
  if(!nat || !nat.theaters || !nat.theaters[theaterId]) return false;
  const theater = nat.theaters[theaterId];
  theater.armies = theater.armies || [];
  if(!theater.armies.includes(armyId)) theater.armies.push(armyId);
  const army = (world.armies || []).find(a => a.id === armyId);
  if(army) army.theaterId = theaterId;
  return true;
}

/** 辅助：判断人物是否具有某特质 */
function hasCharTrait(c, traitName){
  if(!c || !c.traits) return false;
  return c.traits.some(t => {
    if(typeof t === 'string') return t === traitName;
    return t.id === traitName || t.name === traitName || t.stat === traitName;
  });
}

/**
 * W2-3: 集团军群 (Army Group) 系统
 * 由陆军元帅率领，默认可统领至多 5 个军（K.ARMY_GROUP_MAX_ARMIES）；
 * 若元帅具备 Expert Delegator 特质，上限提升至 7 个军。
 */
export function createArmyGroup(world, natId, name = '第1集团军群', marshalId = null){
  const nat = world.nations[natId];
  if(!nat) return null;
  nat.armyGroups = nat.armyGroups || {};
  world.armyGroups = world.armyGroups || [];
  const id = `ag_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const group = {
    id,
    name,
    nat: natId,
    marshalId,
    theaterId: null,
    armies: []
  };
  nat.armyGroups[id] = group;
  world.armyGroups.push(group);
  return group;
}

export function assignArmyToGroup(world, armyGroupId, armyId, natId){
  const nat = world.nations[natId];
  if(!nat) return false;
  const group = (nat.armyGroups && nat.armyGroups[armyGroupId]) || (world.armyGroups || []).find(g => g.id === armyGroupId);
  if(!group) return false;
  group.armies = group.armies || [];
  if(!group.armies.includes(armyId)){
    group.armies.push(armyId);
  }
  const army = (world.armies || []).find(a => a.id === armyId);
  if(army) army.armyGroupId = armyGroupId;
  return true;
}

export function getArmyGroupLimit(world, armyGroup){
  if(!armyGroup) return K.ARMY_GROUP_MAX_ARMIES;
  const marshal = (world.characters || []).find(c => c.id === armyGroup.marshalId);
  if(hasCharTrait(marshal, 'expert_delegator') || hasCharTrait(marshal, 'Expert Delegator')){
    return 7;
  }
  return K.ARMY_GROUP_MAX_ARMIES;
}

/**
 * 单军师上限：
 * 默认 24 师（K.ARMY_MAX_DIVISIONS）；
 * Skilled Staffer 特质将领提升至 30 师；
 * 若军命令/任务属于区域防御 (area_defense)，上限提升至 72 师。
 */
export function getArmyDivisionLimit(world, army){
  if(!army) return K.ARMY_MAX_DIVISIONS;
  if(army.orderType === 'area_defense' || army.areaDefense) return 72;
  const general = (world.characters || []).find(c => c.id === army.generalId);
  if(hasCharTrait(general, 'skilled_staffer') || hasCharTrait(general, 'Skilled Staffer')){
    return 30;
  }
  return K.ARMY_MAX_DIVISIONS;
}

export function calcArmyOverCapacityPenalty(divisionCount, limit){
  if(divisionCount <= limit) return 0;
  const over = divisionCount - limit;
  return Math.min(K.OVER_CAPACITY_PENALTY_MAX,
    K.OVER_CAPACITY_PENALTY_BASE + over * K.OVER_CAPACITY_PENALTY_PER_DIV);
}

export function getArmyOverCapacityPenalty(world, army){
  if(!army || !army.divisions) return 0;
  const limit = getArmyDivisionLimit(world, army);
  return calcArmyOverCapacityPenalty(army.divisions.length, limit);
}

export function getTheaterCombatBonus(world, theaterId, natId){
  const nat = world.nations[natId];
  if(!nat || !nat.theaters || !nat.theaters[theaterId]) return { atkBonus: 0, defBonus: 0, planBonus: 0 };

  const theater = nat.theaters[theaterId];
  if(!theater.generalId) return { atkBonus: 0, defBonus: 0, planBonus: 0 };

  const c = (world.characters || []).find(x => x.id === theater.generalId);
  if(!c) return { atkBonus: 0, defBonus: 0, planBonus: 0 };

  const attack = c.skills?.attack || 3;
  const defense = c.skills?.defense || 3;
  const planning = c.skills?.planning || 3;

  return {
    atkBonus: +(attack * 0.025).toFixed(3), // 2.5% 攻击加成每级
    defBonus: +(defense * 0.025).toFixed(3), // 2.5% 防御加成每级
    planBonus: +(planning * 0.05).toFixed(3) // 5% 计划累积加速
  };
}
