/* ============================================================
   engine/mods.js —— 修正键的统一解析（单一事实来源）
   ------------------------------------------------------------
   要解决的问题（W0-A2）
   --------------------
   数据层用 scope 表达修正的适用范围（data/techs.js、data/focuses.js）：

       { type:'modifier', scope:'nation', stat:'milOutput' }   → 写 nation.modifiers.milOutput
       { type:'modifier', scope:'unit:all', stat:'soft' }      → 写 nation.modifiers.all_soft
       { type:'modifier', scope:'unit:inf', stat:'atk' }       → 写 nation.modifiers.inf_atk

   research.js:87-92 负责把 (scope, stat) 映射成键，但**引擎侧从不去读**
   绝大多数这些键。battle.js 原本只读三个：

       mod(nat, 'atk')  /  mod(nat, 'def')  /  mod(nat, 'unitAtkArm')

   后果：54 项科技里 31 项声明了 modifier，其中 17 项完全无效 ——
   包括 inf_weapon_1/2/3（三级步兵武器升级，scope=unit:inf，stat=soft → inf_soft）
   与 mobile2 / tank_upgun / trenchdoc / mobile3 / fire2 / fire3 等。
   界面照画、数值照写、测试全绿，只是战斗时那个数字没人读。

   本模块的定位：**唯一**的键解析入口。引擎各系统不再自己拼键名，
   改为调用 unitMod()，按「越具体越优先，且逐层累加」解析：

       inf_soft  →  all_soft  →  soft

   为什么是累加而不是取第一个命中
   --------------------------------
   HOI4 的行为是「全军软攻 +10%」与「步兵软攻 +15%」相互独立叠加。
   若只取最具体的一个命中，则 inf_weapon_1 生效的同时 all_soft 会被忽略，
   玩家会看到「升级了步兵武器，火炮加成反而没了」这种反直觉结果。
   累加既符合直觉，也符合 HOI4。

   向后兼容
   --------
   · 旧键 'unitAtkArm' 仍被 battle.js 直接读取（它是 nation 作用域的独立语义：
     「全军装甲师攻击」），本模块不接管，保留以免改变现有行为。
   · 若 nation.modifiers 里没有任何相关键，unitMod 返回 0，
     调用方 `× (1 + 0)` —— 因此对未受该问题影响的剧本是**零行为变化**。
   ============================================================ */

/** 单位级可被修正的属性（与 data/units.js 的字段命名保持一致） */
export const UNIT_STATS = ['soft', 'hard', 'def', 'brk', 'orgDamage', 'speed', 'hp', 'org', 'atk'];

/* ============================================================
   旧键别名表（W0-C）
   ------------------------------------------------------------
   data/scenarios 下各剧本 characters.js 的 385 条将领特质里，词表是混的：
     · 已经是规范键：speed(33) atk(9) def(11) brk(2) milOutput(25) …
     · 旧键、引擎从不读：attack(82) defense(93) plan_speed(51) org_recovery(42)
   也就是说 385 条特质里有 268 条（attack + defense + plan_speed + org_recovery）
   写进了 nation.modifiers 里一个没人读的键 —— 与那 17 项失效科技是同一类断链，
   只是这次的"数据"是人物而不是科技。
   曼施坦因的 attack+0.2 因此对战斗完全无效。

   这里不改数据层（385 条记录逐条改易错且会掩盖问题），而是给引擎侧
   一张别名表：旧键在写入 modifiers 之前先归一。
   ============================================================ */
export const LEGACY_STAT_ALIAS = {
  attack: 'atk',
  defense: 'def',
  plan_speed: 'planning',
  org_recovery: 'orgRecovery'
};

/** 把旧键归一到规范键；未知键原样返回 */
export function normalizeStat(stat){
  return LEGACY_STAT_ALIAS[stat] || stat;
}

/**
 * 某个「单位类型 × 属性」在 nation.modifiers 里可能存在的全部键，
 * 由具体到泛化排列。
 */
export function modifierKeys(unitType, stat){
  const out = [];
  if(unitType) out.push(unitType + '_' + stat);
  out.push('all_' + stat);
  out.push(stat);
  return out;
}

/** 某国某属性的总加成（加总值，不是倍数）。无键时返回 0。 */
export function unitMod(nation, unitType, stat){
  const m = nation && nation.modifiers;
  if(!m) return 0;
  let sum = 0;
  for(const k of modifierKeys(unitType, stat)){
    const v = m[k];
    if(typeof v === 'number' && isFinite(v)) sum += v;
  }
  return sum;
}

/** 国家作用域的加成（等价于 unitMod(nation, null, stat)） */
export function nationMod(nation, stat){
  return unitMod(nation, null, stat);
}

/**
 * 一次性取出某单位在战斗里的全套加成，避免在逐小时循环里反复遍历键。
 * 返回的对象是「倍数」形式，直接乘即可。
 */
export function combatMods(nation, unitType){
  return {
    soft:  1 + unitMod(nation, unitType, 'soft'),
    hard:  1 + unitMod(nation, unitType, 'hard'),
    atk:   1 + unitMod(nation, unitType, 'atk'),
    def:   1 + unitMod(nation, unitType, 'def'),
    brk:   1 + unitMod(nation, unitType, 'brk'),
    orgDamage: 1 + unitMod(nation, unitType, 'orgDamage')
  };
}

/** 机动加成（movement.js 用；语义与 HOI4 的 division speed 一致） */
export function speedMod(nation, unitType){
  return 1 + unitMod(nation, unitType, 'speed');
}