/* ============================================================
   engine/characters.js —— 历史人物与将领系统（v4.0 §2.1 / P1）
   支持指派战区/统帅、四维技能、晋升元帅、战损殉职
   ============================================================ */

import { K } from '../data/constants.js';
import { normalizeStat } from './mods.js';

export function getCharacterSkills(c){
  if(!c) return { attack: 3, defense: 3, planning: 3, tactics: 3, rank: 'general' };
  c.skills = c.skills || {};
  return {
    attack: c.skills.attack || (c.traits && c.traits.some(t => t.stat === 'attack') ? 5 : 3),
    defense: c.skills.defense || (c.traits && c.traits.some(t => t.stat === 'defense') ? 5 : 3),
    planning: c.skills.planning || (c.traits && c.traits.some(t => t.stat === 'plan_speed') ? 5 : 4),
    tactics: c.skills.tactics || 4,
    rank: c.rank || 'general'
  };
}

export function assignGeneral(world, generalId, natId){
  const n = world.nations[natId];
  if(!n) return false;
  n.assignedGenerals = n.assignedGenerals || [];
  if(!n.assignedGenerals.includes(generalId)){
    n.assignedGenerals.push(generalId);
    applyGeneralModifiers(world, natId);
    return true;
  }
  return false;
}

export function unassignGeneral(world, generalId, natId){
  const n = world.nations[natId];
  if(!n || !n.assignedGenerals) return false;
  const i = n.assignedGenerals.indexOf(generalId);
  if(i >= 0){
    n.assignedGenerals.splice(i, 1);
    applyGeneralModifiers(world, natId);
    return true;
  }
  return false;
}

export function promoteToMarshal(world, charId, natId){
  const n = world.nations[natId];
  if(!n) return false;
  n.commandPower = n.commandPower != null ? n.commandPower : 100;
  if(n.commandPower < K.COMMAND_POWER_PROMOTE_MARSHAL) return false;

  const c = (world.characters || []).find(x => x.id === charId);
  if(!c || c.rank === 'marshal') return false;

  // 扣减指挥点数 50
  n.commandPower -= K.COMMAND_POWER_PROMOTE_MARSHAL;
  c.rank = 'marshal';

  // 晋升为元帅，临时 -1 技能等级 [H]
  c.skills = c.skills || getCharacterSkills(c);
  c.skills.attack = Math.max(1, c.skills.attack - 1);
  c.skills.defense = Math.max(1, c.skills.defense - 1);
  c.skills.planning = Math.max(1, c.skills.planning - 1);
  c.skills.tactics = Math.max(1, c.skills.tactics - 1);

  world.events = world.events || [];
  world.events.push({
    type: 'promote_marshal',
    day: world.day,
    important: false,
    text: `🎖️ 授衔任命：${n.name}将领【${c.name}】晋升为陆军元帅！可统领集团军群。`
  });

  return true;
}

export function applyGeneralModifiers(world, natId){
  const n = world.nations[natId];
  if(!n) return;
  const generals = n.assignedGenerals || [];
  const chars = (world.characters || []);

  // 幂等：先撤销上一次施加的量。
  // 原实现只做 `n.modifiers[stat] += value`，每次调用都会再叠一遍 ——
  // 而 assignGeneral/unassignGeneral/promote 都会调用它，
  // 于是「任命两位将领」会把特质加成变成 4 倍（实测德国 atk 叠到 +90%）。
  if(n._generalApplied){
    for(const stat in n._generalApplied){
      n.modifiers[stat] = (n.modifiers[stat] || 0) - n._generalApplied[stat];
      if(Math.abs(n.modifiers[stat]) < 1e-12) delete n.modifiers[stat];
    }
  }

  // 重算并记录将领贡献的修正项
  const applied = {};
  for(const gid of generals){
    const c = chars.find(x => x.id === gid);
    if(c && c.traits){
      for(const t of c.traits){
        // W0-C：归一旧键。385 条特质里 attack(82)/defense(93)/plan_speed(51)/
        // org_recovery(42) 共 268 条写的是引擎不读的旧键 ——
        // 曼施坦因的 attack+0.2 此前对战斗完全无效。
        const stat = normalizeStat(t.stat);
        applied[stat] = (applied[stat] || 0) + t.value;
      }
    }
  }

  n.generalModifiers = applied;
  n._generalApplied = { ...applied };
  for(const stat in applied){
    n.modifiers[stat] = (n.modifiers[stat] || 0) + applied[stat];
  }
}

export function checkGeneralCasualty(world, unit, battleReport, rng){
  if(!unit || unit.hp > 0) return null;
  const n = world.nations[unit.nat];
  if(!n || !n.assignedGenerals || !n.assignedGenerals.length) return null;

  // 师团全歼时，将领有 15% 概率殉职或被俘
  const roll = rng ? rng() : Math.random();
  if(roll < 0.15){
    const victimId = n.assignedGenerals[Math.floor(roll * n.assignedGenerals.length)];
    const c = (world.characters || []).find(x => x.id === victimId);
    if(c){
      unassignGeneral(world, victimId, unit.nat);
      c.status = 'kia';
      const eventText = `⚠️ 悲痛战报：${n.name}将领【${c.name}】在部队全灭战斗中英勇殉职，修正加成终止！`;
      world.events.push({
        type: 'general_kia',
        day: world.day,
        important: true,
        text: eventText
      });
      return c;
    }
  }
  return null;
}
