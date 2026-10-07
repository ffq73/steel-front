/* ============================================================
   data/techs.js —— 科研：3 系 × 10 项（v2.0 §3.5）
   days 基准耗时；year 为史实年份（超前惩罚：早 1 年 +50%）
   effect 语法与国策解释器共用（见 engine/focus.js）
   ============================================================ */

export const TECH_BRANCHES = {
  industry: '工业',
  doctrine: '陆军学说',
  equipment: '陆军装备',
  air: '空军',            // v14.0 P4：新增三系
  navy: '海军',
  electronics: '电子',        // 雷达/无线电/计算机
  nuclear: '核物理与火箭'  // 冷战/现代关键
};

export const TECHS = [
  // 工业
  { id:'construction1', branch:'industry', name:'基础施工',    days:80,  year:1939, requires:[],
    effect:{ type:'modifier', scope:'nation', stat:'buildSpeed', value:0.10 } },
  { id:'industry1',     branch:'industry', name:'集中式工业',  days:100, year:1939, requires:[],
    effect:{ type:'modifier', scope:'nation', stat:'milOutput', value:0.10 } },
  { id:'industry2',     branch:'industry', name:'分散式工业',  days:100, year:1941, requires:['industry1'],
    effect:{ type:'modifier', scope:'nation', stat:'milOutput', value:0.10 } },
  { id:'construction2', branch:'industry', name:'先进施工',    days:100, year:1941, requires:['construction1'],
    effect:{ type:'modifier', scope:'nation', stat:'buildSpeed', value:0.10 } },
  { id:'efficiency1',   branch:'industry', name:'生产流水线',  days:120, year:1940, requires:['industry1'],
    effect:{ type:'modifier', scope:'nation', stat:'effCap', value:0.05 } },
  { id:'efficiency2',   branch:'industry', name:'机械化工场',  days:120, year:1942, requires:['efficiency1'],
    effect:{ type:'modifier', scope:'nation', stat:'effCap', value:0.05 } },
  { id:'excavation1',   branch:'industry', name:'挖掘设备',    days:90,  year:1939, requires:[],
    effect:{ type:'modifier', scope:'nation', stat:'buildSpeed', value:0.05 } },
  { id:'oil1',          branch:'industry', name:'合成燃料',    days:120, year:1940, requires:['industry1'],
    effect:{ type:'addPP', value:0 } },
  { id:'construction3', branch:'industry', name:'装配线施工',  days:120, year:1943, requires:['construction2'],
    effect:{ type:'modifier', scope:'nation', stat:'buildSpeed', value:0.10 } },
  { id:'industry3',     branch:'industry', name:'机械式计算机', days:120, year:1942, requires:['industry2'],
    effect:{ type:'modifier', scope:'nation', stat:'research', value:0.05 } },

  // 陆军学说（三选一互斥由 doctrineLine 字段表达）
  { id:'mobiledoc', branch:'doctrine', name:'机动作战·序', days:100, year:1939, requires:[], doctrineLine:'mobile',
    effect:{ type:'modifier', scope:'unit:all', stat:'brk', value:0.10 } },
  { id:'mobile2',   branch:'doctrine', name:'机动作战·集中装甲', days:120, year:1940, requires:['mobiledoc'], doctrineLine:'mobile',
    effect:{ type:'modifier', scope:'unit:arm', stat:'atk', value:0.10 } },
  { id:'mobile3',   branch:'doctrine', name:'机动作战·纵深突破', days:120, year:1941, requires:['mobile2'], doctrineLine:'mobile',
    effect:{ type:'modifier', scope:'unit:all', stat:'speed', value:0.15 } },
  { id:'fireplacedoc', branch:'doctrine', name:'优势火力·序', days:100, year:1939, requires:[], doctrineLine:'fire',
    effect:{ type:'modifier', scope:'unit:all', stat:'soft', value:0.10 } },
  { id:'fire2',     branch:'doctrine', name:'优势火力·压制', days:120, year:1940, requires:['fireplacedoc'], doctrineLine:'fire',
    effect:{ type:'modifier', scope:'unit:all', stat:'soft', value:0.10 } },
  { id:'fire3',     branch:'doctrine', name:'优势火力·决战', days:120, year:1941, requires:['fire2'], doctrineLine:'fire',
    effect:{ type:'modifier', scope:'unit:all', stat:'orgDamage', value:0.10 } },
  { id:'trenchdoc', branch:'doctrine', name:'堑壕纵深·序', days:100, year:1939, requires:[], doctrineLine:'trench',
    effect:{ type:'modifier', scope:'unit:all', stat:'def', value:0.12 } },
  { id:'trench2',   branch:'doctrine', name:'堑壕纵深·弹性防御', days:120, year:1940, requires:['trenchdoc'], doctrineLine:'trench',
    effect:{ type:'modifier', scope:'unit:all', stat:'org', value:0.05 } },
  { id:'trench3',   branch:'doctrine', name:'堑壕纵深·预备队', days:120, year:1941, requires:['trench2'], doctrineLine:'trench',
    effect:{ type:'modifier', scope:'nation', stat:'reinforce', value:0.05 } },
  { id:'grand1',    branch:'doctrine', name:'大兵团作战·序', days:100, year:1939, requires:[], doctrineLine:'grand',
    effect:{ type:'modifier', scope:'unit:all', stat:'brk', value:0.05 } },

  // 装备
  { id:'inf_weapon_1', branch:'equipment', name:'步兵武器 I',  days:60,  year:1939, requires:[], preset:true,
    effect:{ type:'modifier', scope:'unit:inf', stat:'soft', value:0.10 } },
  { id:'inf_weapon_2', branch:'equipment', name:'步兵武器 II', days:80,  year:1940, requires:['inf_weapon_1'],
    effect:{ type:'modifier', scope:'unit:inf', stat:'soft', value:0.10 } },
  { id:'artillery_1',  branch:'equipment', name:'牵引火炮',    days:90,  year:1939, requires:[],
    effect:{ type:'modifier', scope:'unit:all', stat:'soft', value:0.05 } },
  { id:'motorization', branch:'equipment', name:'摩托化',      days:90,  year:1940, requires:[],
    effect:{ type:'unlockUnit', unit:'mot' } },
  { id:'light_tank',   branch:'equipment', name:'轻型坦克',    days:100, year:1939, requires:[],
    effect:{ type:'unlockUnit', unit:'larm' } },
  { id:'medium_tank',  branch:'equipment', name:'中型坦克',    days:140, year:1941, requires:['light_tank'],
    effect:{ type:'unlockUnit', unit:'arm' } },
  { id:'tank_upgun',   branch:'equipment', name:'坦克换炮',    days:120, year:1942, requires:['medium_tank'],
    effect:{ type:'modifier', scope:'unit:arm', stat:'soft', value:0.15 } },
  { id:'engineer',     branch:'equipment', name:'工兵连',      days:80,  year:1939, requires:[],
    effect:{ type:'modifier', scope:'nation', stat:'entrenchMax', value:5 } },
  { id:'recon',        branch:'equipment', name:'侦察连',      days:80,  year:1940, requires:[],
    effect:{ type:'modifier', scope:'nation', stat:'reinforce', value:0.10 } },
  { id:'inf_weapon_3', branch:'equipment', name:'步兵武器 III', days:100, year:1942, requires:['inf_weapon_2'],
    effect:{ type:'modifier', scope:'unit:inf', stat:'soft', value:0.10 } },
  // ============================================================
  // v14.0 P4 新增四系（空军/海军/电子/核物理）—— 原版空海军系统此前无科技门控，
  // 属于"开局白给"，科技树形同虚设。新科技全部挂接到实际系统。
  // ============================================================

  // —— 空军 (8) ——
  { id:'aviation1',      branch:'air', name:'基础航空',     days:110, year:1939, requires:[],
    effect:{ type:'unlockAircraft', aircraft:['fighter','cas'] } },
  { id:'fighter1',       branch:'air', name:'轻型战斗机',   days:120, year:1940, requires:['aviation1'],
    effect:{ type:'modifier', scope:'nation', stat:'airSuperiority', value:0.10 } },
  { id:'fighter2',       branch:'air', name:'中期战斗机',   days:130, year:1942, requires:['fighter1'],
    effect:{ type:'unlockAircraft', aircraft:['fighter'], tier:2 } },
  { id:'cas1',           branch:'air', name:'近距支援机',   days:110, year:1941, requires:['aviation1'],
    effect:{ type:'unlockAircraft', aircraft:['cas'] } },
  { id:'tac_bomber1',    branch:'air', name:'战术轰炸机',   days:130, year:1942, requires:['aviation1'],
    effect:{ type:'unlockAircraft', aircraft:['tactical_bomber'] } },
  { id:'nav_bomber1',    branch:'air', name:'鱼雷轰炸机',   days:130, year:1942, requires:['cas1'],
    effect:{ type:'unlockAircraft', aircraft:['naval_bomber'] } },
  { id:'strat_bomber1',  branch:'air', name:'战略轰炸机',   days:150, year:1943, requires:['tac_bomber1'],
    effect:{ type:'unlockAircraft', aircraft:['strat_bomber'],
             extra:{ modifier:{ stat:'strategicBomb', value:0.20 } } } },
  { id:'heavy_fighter1', branch:'air', name:'重型战斗机',   days:150, year:1943, requires:['fighter2'],
    effect:{ type:'unlockAircraft', aircraft:['heavy_fighter'],
             extra:{ modifier:{ stat:'airSuperiority', value:0.08 } } } },

  // —— 海军 (8) ——
  { id:'naval_tech1',    branch:'navy', name:'海军基础',     days:110, year:1939, requires:[],
    effect:{ type:'unlockShip', ships:['destroyer','convoy'] } },
  { id:'transport_ship1',branch:'navy', name:'运输船',       days:110, year:1940, requires:['naval_tech1'],
    effect:{ type:'unlockFeature', feature:'transport_ship',
             extra:{ invasionCap:{ value:10 } } } },
  { id:'destroyer1',     branch:'navy', name:'驱逐舰',       days:120, year:1940, requires:['naval_tech1'],
    effect:{ type:'unlockShip', ships:['destroyer'], extra:{ modifier:{ stat:'convoyEscort', value:0.20 } } } },
  { id:'cruiser1',       branch:'navy', name:'轻巡洋舰',     days:140, year:1942, requires:['destroyer1'],
    effect:{ type:'unlockShip', ships:['cruiser'] } },
  { id:'battleship1',    branch:'navy', name:'战列舰',       days:150, year:1939, requires:['naval_tech1'],
    effect:{ type:'unlockShip', ships:['battleship'] } },
  { id:'submarine1',     branch:'navy', name:'潜艇',         days:130, year:1942, requires:['destroyer1'],
    effect:{ type:'unlockShip', ships:['submarine'],
             extra:{ modifier:{ stat:'convoyRaiding', value:0.30 } } } },
  { id:'carrier1',       branch:'navy', name:'航空母舰',     days:170, year:1942, requires:['cruiser1'],
    effect:{ type:'unlockShip', ships:['carrier'] } },
  { id:'landing_craft1', branch:'navy', name:'登陆艇',       days:140, year:1943, requires:['transport_ship1'],
    effect:{ type:'unlockFeature', feature:'landing_craft',
             extra:{ invasionCap:{ value:20 } } } },

  // —— 电子 (4) ——
  { id:'radio1',         branch:'electronics', name:'无线电',   days:100, year:1939, requires:[],
    effect:{ type:'modifier', scope:'nation', stat:'reinforceRate', value:0.05 } },
  { id:'radar1',         branch:'electronics', name:'雷达',     days:120, year:1938, requires:[],
    effect:{ type:'modifier', scope:'nation', stat:'airDetection', value:0.15 } },
  { id:'computer1',      branch:'electronics', name:'电子计算机', days:160, year:1944, requires:['radio1'],
    effect:{ type:'modifier', scope:'nation', stat:'research', value:0.15 } },
  { id:'radar2',         branch:'electronics', name:'雷达网络', days:150, year:1943, requires:['radar1','radio1'],
    effect:{ type:'modifier', scope:'nation', stat:'airDetection', value:0.15,
             extra:{ modifier:{ stat:'airSuperiority', value:0.06 } } } },

  // —— 核物理与火箭 (4) ——
  { id:'nuclear1',       branch:'nuclear', name:'核物理',     days:180, year:1942, requires:['radio1'],
    effect:{ type:'unlockFeature', feature:'nuclear_weapon' } },
  { id:'nuclear2',       branch:'nuclear', name:'核反应堆',   days:200, year:1945, requires:['nuclear1'],
    effect:{ type:'unlockFeature', feature:'nuclear_upgrade',
             extra:{ modifier:{ stat:'nuclearYield', value:0.50 } } } },
  { id:'rocket1',        branch:'nuclear', name:'火箭技术',   days:160, year:1942, requires:['radio1'],
    effect:{ type:'unlockFeature', feature:'rocket' } },
  { id:'rocket2',        branch:'nuclear', name:'弹道导弹',   days:180, year:1944, requires:['rocket1'],
    effect:{ type:'unlockFeature', feature:'rocket_advanced',
             extra:{ modifier:{ stat:'strategicBomb', value:0.10 } } } }

];
