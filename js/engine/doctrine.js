/* ============================================================
   engine/doctrine.js —— 军种学说系统与经验(XP)树核心引擎 (v9.0 §4-N4 / 附录 B.5) [H]
   包含：
   - 陆/海/空 三军独立学说树与同军种互斥锁定
   - 节点 100 XP 购买制与 500 XP 储备上限
   - 师经验四档加成阶梯 (0% / +25% / +50% / +75%)
   - 学说效果挂载至国家 modifiers 体系
   ============================================================ */

import { K } from '../data/constants.js';
import { DOCTRINES_DATA } from '../data/doctrines.js';

/* 师经验四档加成阶梯规范 [H] */
export const DIVISION_EXP_TIERS = [
  { id: 'raw',      name: '乌合新兵', minExp: 0.00, bonus: -0.25, mul: 0.75 },
  { id: 'trained',  name: '训练完成', minExp: 0.10, bonus:  0.00, mul: 1.00 },
  { id: 'regular',  name: '常规正规', minExp: 0.30, bonus:  0.25, mul: 1.25 },
  { id: 'seasoned', name: '百战精锐', minExp: 0.75, bonus:  0.50, mul: 1.50 },
  { id: 'veteran',  name: '老练近卫', minExp: 0.90, bonus:  0.75, mul: 1.75 }
];

/* 1. 师经验等级与战斗属性乘数查询 [H]
   - Trained ≥10% (0% 加成，基准 1.00)
   - Regular ≥30% (+25% 加成，1.25)
   - Seasoned ≥75% (+50% 加成，1.50)
   - Veterans ≥90% (+75% 加成，1.75) */
export function getDivisionExpTier(expRatio = 0.30){
  for(let i = DIVISION_EXP_TIERS.length - 1; i >= 0; i--){
    if(expRatio >= DIVISION_EXP_TIERS[i].minExp){
      return DIVISION_EXP_TIERS[i];
    }
  }
  return DIVISION_EXP_TIERS[0];
}

/* W1-7：XP 入账唯一入口（阶梯所有者）—— 档位随之刷新 u.level（1~5）。
   阶梯：乌合 0 / 训练 10 / 常规 30 / 百战 75 / 老练 90 XP（expRatio = xp/100）。 */
export function addUnitXp(u, amount){
  u.xp = (u.xp || 0) + amount;
  const tier = getDivisionExpTier(u.xp / K.XP_RATIO_SCALE);
  u.level = DIVISION_EXP_TIERS.indexOf(tier) + 1;
  return tier;
}

/* 2. 初始化国家学说数据与经验池 [H] */
export function initDoctrines(world){
  for(const natId in world.nations){
    const n = world.nations[natId];
    n.armyXp = n.armyXp != null ? n.armyXp : 150;
    n.airXP = n.airXP != null ? n.airXP : 100;
    n.navyXP = n.navyXP != null ? n.navyXP : 100;
    n.doctrines = n.doctrines || [];
    n.activeTrees = n.activeTrees || { land: null, air: null, navy: null };
  }

  // 预设主要参战国历史初始学说 [H]
  const ger = world.nations['GER'] || world.nations['G'];
  if(ger && !ger.doctrines.length){
    ger.doctrines.push('mw_blitzkrieg');
    ger.activeTrees.land = 'mobile_warfare';
    applyDoctrineEffects(ger, 'mw_blitzkrieg');
  }

  const sov = world.nations['SOV'] || world.nations['S'];
  if(sov && !sov.doctrines.length){
    sov.doctrines.push('ma_defense_in_depth');
    sov.activeTrees.land = 'mass_assault';
    applyDoctrineEffects(sov, 'ma_defense_in_depth');
  }

  const gbr = world.nations['GBR'] || world.nations['B'];
  if(gbr && !gbr.doctrines.length){
    gbr.doctrines.push('gb_trench_warfare');
    gbr.doctrines.push('nd_battleship_focus');
    gbr.activeTrees.land = 'grand_battleplan';
    gbr.activeTrees.navy = 'fleet_in_being';
    applyDoctrineEffects(gbr, 'gb_trench_warfare');
    applyDoctrineEffects(gbr, 'nd_battleship_focus');
  }

  const fra = world.nations['FRA'] || world.nations['F'];
  if(fra && !fra.doctrines.length){
    fra.doctrines.push('gb_trench_warfare');
    fra.activeTrees.land = 'grand_battleplan';
    applyDoctrineEffects(fra, 'gb_trench_warfare');
  }
}

/* 3. 应用学说节点属性至国家 modifiers 体系 [H] */
export function applyDoctrineEffects(nation, nodeId){
  let node = null;
  for(const branch in DOCTRINES_DATA){
    for(const treeId in DOCTRINES_DATA[branch]){
      const found = DOCTRINES_DATA[branch][treeId].nodes.find(n => n.id === nodeId);
      if(found){ node = found; break; }
    }
    if(node) break;
  }
  if(!node || !node.effects) return;

  nation.modifiers = nation.modifiers || {};
  for(const effKey in node.effects){
    nation.modifiers[effKey] = (nation.modifiers[effKey] || 0) + node.effects[effKey];
  }
}

export function getXpKey(branchKey){
  if(branchKey === 'land' || branchKey === 'army') return 'armyXp';
  if(branchKey === 'air') return 'airXP';
  if(branchKey === 'navy') return 'navyXP';
  return `${branchKey}XP`;
}

/* 4. 解锁学说节点主入口 [H]
   规则：
   - 陆军 4 树同军种互斥锁定（研究一条后不能跨树兼修）
   - 每节点 100 XP，XP 不足时拒绝并提示
   - 前置学说条件必须满足 */
export function unlockDoctrine(world, natId, branchKey, treeId, nodeId){
  const n = world.nations[natId];
  if(!n) return { ok: false, reason: '国家不存在' };

  const tree = DOCTRINES_DATA[branchKey]?.[treeId];
  if(!tree) return { ok: false, reason: '学说树不存在' };

  const node = tree.nodes.find(x => x.id === nodeId);
  if(!node) return { ok: false, reason: '学说节点不存在' };

  n.doctrines = n.doctrines || [];
  n.activeTrees = n.activeTrees || { land: null, air: null, navy: null };

  // 1. 已解锁检查
  if(n.doctrines.includes(nodeId)){
    return { ok: false, reason: '该学说节点已成功研习' };
  }

  // 2. 同军种互斥校验 [H]
  if(n.activeTrees[branchKey] && n.activeTrees[branchKey] !== treeId){
    const currentTreeName = DOCTRINES_DATA[branchKey][n.activeTrees[branchKey]]?.name || n.activeTrees[branchKey];
    return {
      ok: false,
      reason: `同军种学说树互斥：当前已锁定【${currentTreeName}】，不可跨树兼修 [H]`
    };
  }

  // 3. 前置节点校验 [H]
  if(node.requires && node.requires.length){
    for(const req of node.requires){
      if(!n.doctrines.includes(req)){
        const reqNode = tree.nodes.find(x => x.id === req);
        return {
          ok: false,
          reason: `前置学说未就绪：请先研习【${reqNode?.name || req}】`
        };
      }
    }
  }

  // 4. XP 充足性校验 [H]
  const xpKey = getXpKey(branchKey);
  const cost = node.costXP || 100;
  const currentXP = n[xpKey] != null ? n[xpKey] : 0;
  if(currentXP < cost){
    const branchName = branchKey === 'land' || branchKey === 'army' ? '陆军' : (branchKey === 'air' ? '空军' : '海军');
    return {
      ok: false,
      reason: `${branchName}作战经验 (XP) 不足：当前 ${Math.floor(currentXP)} 点，需要 ${cost} 点 [H]`
    };
  }

  // 扣减 XP 并锁定学说树
  n[xpKey] -= cost;
  n.activeTrees[branchKey] = treeId;
  n.doctrines.push(nodeId);
  applyDoctrineEffects(n, nodeId);

  return { ok: true, node, remainingXP: n[xpKey] };
}

/* 5. 战斗/训练增加 XP [H]
   上限 500 点 */
export function addNationXP(world, natId, branchKey, amount){
  const n = world.nations[natId];
  if(!n || amount <= 0) return;
  const xpKey = getXpKey(branchKey);
  n[xpKey] = Math.min(500, (n[xpKey] || 0) + amount);
}

/* 6. 每日学说经验被动积攒 (战时实战增长) [H] */
export function doctrineTick(world){
  for(const natId in world.nations){
    const n = world.nations[natId];
    if(!n || !n.alive) continue;
    if(n.atWarWith && n.atWarWith.length > 0){
      n.armyXp = Math.min(500, (n.armyXp || 0) + 0.25);
      n.airXP = Math.min(500, (n.airXP || 0) + 0.15);
      n.navyXP = Math.min(500, (n.navyXP || 0) + 0.15);
    }
  }
}

