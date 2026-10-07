/* ============================================================
   engine/resistance.js —— 占领区治理与抵抗组织系统 (v5.0 §2.4 / E2)
   实现占领区治安度/抵抗度(0–100%)、顺从度(0–100%)、
   4档占领法案、驻军装备人力损耗与游击队破袭
   ============================================================ */

export const OCCUPATION_LAWS = {
  civilian_oversight: {
    id: 'civilian_oversight',
    name: '民事监督 (Civilian Oversight)',
    resistanceTarget: 25,
    factoryYield: 0.65,
    resourceYield: 0.65,
    garrisonCostMul: 0.5,
    desc: '保留地方文官治理体系，降低驻军消耗，但抵抗组织活动空间较大。'
  },
  military_governor: {
    id: 'military_governor',
    name: '军政长官区 (Military Governor)',
    resistanceTarget: 15,
    factoryYield: 0.55,
    resourceYield: 0.70,
    garrisonCostMul: 0.8,
    desc: '由野战军军官实施军事管制，有效压制反抗思潮，维持平稳工业产出。'
  },
  martial_law: {
    id: 'martial_law',
    name: '全面戒严 (Martial Law)',
    resistanceTarget: 5,
    factoryYield: 0.40,
    resourceYield: 0.80,
    garrisonCostMul: 1.2,
    desc: '实施宵禁与街垒巡逻，将抵抗活动压缩至最低，但工厂开工率下降。'
  },
  brutal_oppression: {
    id: 'brutal_oppression',
    name: '严酷搜剿 (Brutal Oppression)',
    resistanceTarget: 0,
    factoryYield: 0.25,
    resourceYield: 0.90,
    garrisonCostMul: 1.8,
    desc: '铁腕清剿地下党人与游击队，榨取矿产资源，但驻军伤亡与损耗剧增。'
  }
};

/**
 * 初始化占领区抵抗度
 */
export function initResistance(world){
  world.occupation = world.occupation || {};
  // 为每个国家设定默认占领法案
  for(const natId in world.nations){
    const nat = world.nations[natId];
    nat.occupationLaw = nat.occupationLaw || 'military_governor';
  }
}

/**
 * 设定占领法案
 */
export function setOccupationLaw(world, natId, lawId){
  const nat = world.nations[natId];
  if(!nat || !OCCUPATION_LAWS[lawId]) return false;
  nat.occupationLaw = lawId;
  return true;
}

/**
 * 该格是否有占领方驻军
 * W0-B1 修正：原写法 (world.units||[]).some(u => u.nat===hex.owner && u.hex===i)
 * 有两处都取不到值 ——
 *   ① 单位对象上从来没有 hex 字段（spawnUnit 只写 q/r/idx），
 *      所以 u.hex === i 恒为 false；
 *   ② world.units 是数组，u.hex 也不该拿来和格下标比。
 * 正确做法是走 hex.units 的 id 列表反查（battle.js 的 hexUnits 同构）。
 */
function hasGarrisonOf(world, hex, hexIdx, natId){
  const ids = hex.units;
  if(!ids || !ids.length) return false;
  const byId = new Map();
  for(const u of world.units) byId.set(u.id, u);
  for(const uid of ids){
    const u = byId.get(uid);
    if(u && u.nat === natId && u.hp > 0) return true;
  }
  return false;
}

/** 该格是否有工业设施（可被游击破袭） */
function hasIndustry(hex){
  return (hex.civ || 0) > 0 || (hex.mil || 0) > 0;
}

/** 格子的可读地名（城市优先） */
function hexLabel(hex){
  return (hex.city && hex.city.name) || hex.name || '该省';
}

/**
 * 每日抵抗度与顺从度结算 tick
 */
export function resistanceTick(world, rng){
  initResistance(world);
  if(!world.hexes) return;

  const hexCount = world.hexes.length;
  for(let i = 0; i < hexCount; i++){
    const hex = world.hexes[i];
    if(!hex || !hex.owner) continue;

    // 非核心本土格属于占领区。
    // W0-B1：hex.core 由 loadScenario 写入（此前全库只有 _orig，本分支恒不成立）。
    const isOccupied = hex.core && hex.core !== hex.owner;
    if(!isOccupied) continue;

    hex.resistance = hex.resistance || 0;
    hex.compliance = hex.compliance || 0;

    const occupier = world.nations[hex.owner];
    const lawId = occupier ? occupier.occupationLaw : 'military_governor';
    const law = OCCUPATION_LAWS[lawId] || OCCUPATION_LAWS.military_governor;

    // 检查是否有己方驻军部队位于该格
    const hasGarrison = hasGarrisonOf(world, hex, i, hex.owner);

    // 抵抗度向法案目标靠拢：
    // W7/§12 修正：原写法 targetRes 顶多到 law.resistanceTarget（最高仅 25%），
    // 导致游击破袭 (>=60) 与武装起义 (>=85) 在缺乏守军时也永远无法自然触发。
    // 现对齐 HOI4：无驻军部队巡逻治安时，地方地下抵抗组织肆虐，抵抗目标飙升至 65~90%；
    // 派兵驻扎 (hasGarrison) 时，治安军有效压制抵抗，使目标压低至法案设定值 (0~25%)。
    const targetRes = hasGarrison
      ? Math.max(0, law.resistanceTarget - 10)
      : Math.min(90, 65 + (law.resistanceTarget || 0));
    if(hex.resistance < targetRes){
      hex.resistance = Math.min(100, hex.resistance + 1);
    } else if(hex.resistance > targetRes){
      hex.resistance = Math.max(0, hex.resistance - 1);
    }

    // 顺从度随时间缓慢增长 (最大 100)
    if(hex.resistance < 30 && hex.compliance < 100){
      hex.compliance = Math.min(100, hex.compliance + 0.1);
    }

    // 驻军消耗与治安战损耗
    if(hasGarrison && occupier){
      // 每日扣除微量步兵装备损耗
      if(occupier.equipment && occupier.equipment.inf_eq){
        occupier.equipment.inf_eq = Math.max(0, occupier.equipment.inf_eq - (0.5 * law.garrisonCostMul));
      }
    }

    // 游击破袭：抵抗度 >= 60 有几率破坏工业设施
    // W0-B1 修正：原判据 hex.ind 从未被任何代码写入（恒 undefined）→ 破袭永不触发；
    // 改用真实存在的 civ/mil 字段。同时 rng 是函数不是对象，rng.next() 必抛 TypeError。
    if(hex.resistance >= 60 && hasIndustry(hex)){
      const roll = rng ? rng() : Math.random();
      if(roll < 0.05){ // 5% 概率破袭
        world.events = world.events || [];
        world.events.push({
          type: 'partisan_sabotage',
          day: world.day,
          important: false,
          text: `💣 游击破袭：【${hexLabel(hex)}】地下抵抗军炸毁了兵工车间与铁道运输线！`
        });
      }
    }

    // 武装起义：抵抗度 >= 85 且无守军，可能爆发地方义勇暴动
    if(hex.resistance >= 85 && !hasGarrison){
      const roll = rng ? rng() : Math.random();
      if(roll < 0.02){ // 2% 爆发暴动并归还原属国
        hex.owner = hex.core;
        hex.resistance = 20;
        world.events = world.events || [];
        world.events.push({
          type: 'partisan_rebellion',
          day: world.day,
          important: true,
          text: `🔥 光复起义：【${hexLabel(hex)}】人民发动武装起义，逐出占领军并收复国土！`
        });
      }
    }
  }
}
