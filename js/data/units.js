/* ============================================================
   data/units.js —— 单位表 + 支援连（v2.0 §5.2）
   soft/hard：对软/硬目标攻击；brk：突破（进攻方被打击时使用）
   hardness：硬度（决定敌方 soft/hard 加权）；armor/piercing：甲弹对抗
   cost 为 v0.2 简化：统一装备点（A3 里程碑再拆分装备类型）
   ============================================================ */

export const UNITS = {
  inf: { name:'步兵师', soft:6,  hard:1,  def:14, brk:4,  org:60, hp:100,
         hardness:0.0, width:2, speed:1, armor:0,  piercing:1,
         cost:400,  trainDays:90,  unlock:null },
  cav: { name:'骑兵师', soft:5,  hard:0,  def:10, brk:5,  org:50, hp:90,
         hardness:0.0, width:2, speed:2, armor:0,  piercing:1,
         cost:350,  trainDays:60,  unlock:null },
  mtn: { name:'山地师', soft:7,  hard:1,  def:13, brk:5,  org:55, hp:90,
         hardness:0.0, width:2, speed:1, armor:0,  piercing:1,
         cost:480,  trainDays:120, unlock:{focus:'alpine corps'} },
  mot: { name:'摩托化师', soft:9, hard:2, def:12, brk:8, org:65, hp:110,
         hardness:0.2, width:2, speed:2, armor:0,  piercing:2,
         cost:700,  trainDays:120, unlock:{tech:'motorization'} },
  larm:{ name:'轻装甲师', soft:14, hard:8, def:9, brk:16, org:60, hp:100,
         hardness:0.6, width:2, speed:2, armor:25, piercing:20,
         cost:900,  trainDays:140, unlock:{tech:'light_tank'} },
  arm: { name:'装甲师', soft:20, hard:14, def:10, brk:24, org:70, hp:120,
         hardness:0.8, width:3, speed:2, armor:40, piercing:35,
         cost:1400, trainDays:180, unlock:{tech:'medium_tank'} }
};

/* 支援连：不占战斗宽度；1 师限挂 1 旅（A3 实装，v0.2 仅数据） */
export const SUPPORT = {
  art: { name:'炮兵', soft:8, def:4,  entrench:0 },
  eng: { name:'工兵', def:6,  entrench:10, terrainNegate:0.5 },
  log: { name:'后勤', supply:-0.15, hpLoss:-0.10 },
  rec: { name:'侦察', speed:0.5, reinforce:0.10 }
};

/* 师经验等级（§3.7.1） */
export const EXP_LEVELS = [
  { name:'新兵', mul:0.75 },
  { name:'常规', mul:1.00 },
  { name:'老兵', mul:1.15 },
  { name:'精锐', mul:1.30 }
];
