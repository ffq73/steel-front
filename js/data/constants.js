/* ============================================================
   data/constants.js —— ★ 全部平衡常数集中于此（v2.0 §5.3）
   标记：[H] = HOI4 官方/社区 Wiki；[B] = 本作自定标定（tools/sim.js 回归）
   禁止在逻辑代码中出现裸数字（C5）。
   ============================================================ */

export const K = {
  // —— 战斗（§3.7 → v14.0 P0 逐小时结算）——
  ROUNDS_PER_DAY: 4,          // [B] 每日交火当量（HOI4 24 小时 tick 的聚合常数）
  // v14.0 P0：HOI4 每小时独立结算一轮交火，本作对齐。
  // 实现方式：日总量不变的前提下，把交火摊到 24 个小时逐段结算，
  // 使溃退时机、预备队增援、战术骰都以"小时"为粒度发生。
  HOURS_PER_DAY: 24,          // [H] HOI4 陆战每小时一轮（Land battle Wiki）
  HOUR_ORG_DMG_CAP: 0,        // [B] 单小时组织伤害上限（= ORG_DMG_CAP / HOURS_PER_DAY，见文件末尾求值）
  DEFENSE_FACTOR: 4,          // [H] 防御/突破减伤因子：承伤 ×(1 − 防御/4)，保底 25%
  COUNTER_RATIO: 0.6,         // [B] 反击基准 = 本小时攻方输出 × 0.6（再过突破减伤与小时封顶）
  DEFENSE_FLOOR: 0.25,        // [H] 减伤下限（防御再高也只减 75%）
  HIT_COVERED: 0.10,          // [H] 防御未耗尽时的命中率
  HIT_UNCOVERED: 0.40,        // [H] 防御耗尽后的命中率
  ORG_PER_HIT: 1.0,           // [B] 见策划案 §3.7.6 标定推导
  HP_PER_HIT: 0.5,            // [B] HOI4 org 骰 d4 / hp 骰 d2 → 比例 0.5
  // v14.0 P0 重标定：引入 4 倍防御减伤后，单次攻击的有效输出下降，
  // 需提高 DMG_MULT 补回节奏。扫描标定（tools/sim.js B1/B4 双锚点）：
  //   1.2(旧) → B1 P50=5 / B4 P50=7（无减伤基线）
  //   1.8 → 8/19   2.2 → 6/16   2.6 → 5/13   3.0 → 5/12   3.2 → 4/11 ✓
  // 3.2 使 B1 回到 4 天（贴近原 4.2 锚点），B4 壕沟场景 11 天
  //（壕沟+防御令守方强 2.75 倍，与 HOI4 的防御价值感一致）。
  DMG_MULT: 1.8,              // [B] 综合伤害倍率（v14.1 W1 重标定：逐对减伤释放了 0.25 地板，3.2→1.8 保节奏）
  ORG_DMG_CAP: 35,            // [B] 单格单日组织伤害上限：使 B2（2 装甲+计划）落在 1.5–3 天而非 0.9 天
  DICE_MIN: 0.75, DICE_MAX: 1.25,
  // （W1：旧 1:13 缩尺的 BASE_WIDTH 6 / WIDTH_PER_FLANK 3 / WIDTH_MAX 18 已由
  //   上方 HOI4 原值组取代 —— 同名常量复用为新口径，全部常量另有真实读取点）
  // —— 人力池 (v14.0 P2 §3.2) ——
  POP_PER_HEX: 200000,        // [B] 每格领土人口（20 万），与地图格数相乘得总人口
  MANPOWER_DAILY_REGEN: 0.002,// [B] 人力池每日回补 = 池上限 × 0.2%（≈每周 1.4%，HOI4 同量级）
  REINFORCE_MANPOWER_RATIO: 0.6, // [B] 补员：恢复 1% 兵力消耗该师全员的 0.6% 人力
  // 装备可靠性 [H]（HOI4：可靠性影响组织恢复率与损耗）
  RELIABILITY_START: 1.0,      // [H] 新产装备可靠性
  RELIABILITY_MIN: 0.5,        // [H] 可靠性下限（HOI4 装备磨损到 50% 报废）
  RELIABILITY_DECAY_DAYS: 45,  // [B] 每 45 天（一个师训练周期）衰减一档
  RELIABILITY_DECAY_STEP: 0.04,// [B] 每档衰减 4%
  TIER_RECOVER_MUL: { elite: 1.15, regular: 1.0, reserve: 0.85 },  // [B] 配给等级对恢复率的加成
  // —— 补给上限 (v14.0 P2 §3.3) ——
  // HOI4（Supply Guide）：补给是绝对值，枢纽 + 基建（每级 +0.3）供 给，
  // 超出上限的部分直接浪费。本作保留 supplyLevel 0~1 语义（E3 断供曲线依赖），
  // 另建"承载上限 supplyCap"与"利用率"，仅在过载时施加额外削弱。
  SUPPLY_DEMAND_PER_DIVISION: 1.0, // [B] 每师每日补给需求（缩尺单位）
  SUPPLY_HUB_BASE: 4.0,             // [B] 单个连通枢纽的基础供给
  SUPPLY_HUB_MOTOR: 1.6,            // [B] 摩托化等级每级 +60% 供给（马→卡车→多卡）
  SUPPLY_INFRA_BONUS: 0.3,          // [H] 每级基建提供的底供（HOI4 原版 0.3）
  SUPPLY_RAIL_BONUS: 0.2,           // [H] W7-2：每级铁路等级补带上限 +0.2（railLevel 0-3 首个游戏读点）
  SUPPLY_OVERLOAD_PENALTY: 0.40,    // [B] 过载时补给率最多削弱 40%（HOI4 补给不足有下限）
  MANPOWER_PER_DIVISION: {    // [B] 各兵种编制人力（千人）
    inf: 1000, cav: 800, mtn: 900, mot: 1200, larm: 1400, arm: 1600
  },
  RETREAT_ORG: 0.15,          // [B] 撤退阈值（组织 < 15% 上限）
  ORG_RECOVER_PER_DAY: 5,     // [B] 仅在未交战且位于己方格时恢复
  ORG_RECOVER_PER_HOUR: 0,    // [B] 每小时组织恢复 = ORG_RECOVER_PER_DAY / 24（见文件末尾求值）
  ENTRENCH_PER_DAY: 0.02,     // [H] 壕沟每日 +2%
  ENTRENCH_MAX: 0.15,         // [H] 壕沟上限 15%
  PLANNING_PER_DAY: 0.02,     // [H] 计划加成每日 +2%
  PLANNING_MAX: 0.30,         // [H] 上限 30%
  REINFORCE_BASE: 0.30,       // [B] 预备队每日加入概率
  REINFORCE_REC: 0.10,        // [H] 侦察连 +10%
  STACK_LIMIT: 6,             // [B] 每格堆叠上限（替代补给系统）
  STRENGTH_FLOOR: 0.30,       // [H] 缺编部队火力下限系数
  EQUIP_PER_HP: 1.0,          // [B] 补 1 点兵力消耗 1 装备点
  HP_REGEN_PER_DAY: 2,        // [B] 每日补员上限（兵力点）

  // —— 政治 / 国策（§3.6）——
  PP_PER_DAY: 2.0,            // [H]
  PP_STABILITY_PENALTY: -0.5, // [H] 稳定性 0% → -50%
  PP_STABILITY_BONUS: 0.2,    // [H] 稳定性 100% → +20%
  WS_STABILITY_PENALTY: 30,   // [H] W4-2：战意 0% 时战时稳定度目标 −30 点（每日向下漂移 ≤0.1）
  PP_MAX: 2000,               // [H]
  ADVISOR_SWAP_COOLDOWN: 7,   // [H] W4-4：同一顾问槽 7 天冷却（每周重选）
  PP_FOCUS_COST: 1.0,         // [H] 国策进行中 -1PP/天
  FOCUS_DAYS: 70,             // [H]
  FOCUS_RUSH_PP: 100,         // [B] 加速国策花费
  FOCUS_RUSH_DAYS: 7,         // [B] 加速缩短天数
  ADVISOR_COST: 150,          // [H] 法案/顾问通常 150PP

  // —— 经济（§3.4）——
  CIV_OUTPUT: 5,              // [H] 民工厂基础产出 5 建造点/天
  MIL_OUTPUT: 5,              // [H] 军工厂基础产出 5 装备点/天
  EFF_START: 0.10,            // [H] 生产线效率起始 10%
  EFF_CAP: 0.50,              // [H] 效率上限 50%
  EFF_GROWTH: 0.001,          // [H] 日增 = 0.001 × cap² / current
  LINE_FACTORY_CAP: 15,       // [H] 单条生产线最多 15 厂
  CONSUMER_GOODS: { civilian:0.35, export_focus:0.30, partial:0.20, war:0.10, total:0.05 },  // W4-5：+export_focus  // [H] 结构 + [B] 数值
  // v14.1 B5：5 类建筑 —— 军民工厂受厂槽约束，基建/空海军基地不占厂槽
  BUILD_COST: { civ:5000, mil:6000, infra:3000, fort:2000, air_base:4000, naval_base:4500 },  // [B] 成本
  FACTORY_SLOTS_PER_HEX: 3,   // [B] 每格厂槽（v14.1 B5：4→3，对齐 HOI4 每州 3 建筑位）
  BUILD_QUEUE_MAX: 10,        // [B] v14.1 B5 建造队列上限
  BUILD_BATCH: 15,            // [H] 单项目最多 15 厂同时施工

  // —— 科研（§3.5）——
  RESEARCH_SLOTS: 3,          // [H] 初始 3 槽
  RESEARCH_SLOTS_MAX: 5,      // [H] 国策最多 +2
  AHEAD_PENALTY_PER_YEAR: 0.5,// [B] 超前惩罚：早 1 年 +50% 耗时
  SWITCH_KEEP: 0.5,           // [B] 切换项目保留 50% 进度

  // —— 胜负（§3.10）——
  VP_PROVINCE: 1,             // [H] 每格至少 1 点
  VP_CITY_MULT: 10,           // [H] 命名城市按 VP 等级 ×10
  SURRENDER_BASE: 0.50,       // [B] 投降界限 = 50% + 0.3 × 战争支持度(0-100)
  SURRENDER_WS: 0.30,         // [B]
  CAPTURE_LOOT: 0.5,          // [H] 投降后装备一半归占领者
  ANNIHILATION_LOOT: 0.3,     // [B] 歼灭后装备 30% 回收给占领者

  // —— 时间 ——
  // v11.0：地图从 416 格放大到 1920 格，横穿全图所需天数翻了数倍，
  // 因此补一档 8 天/秒（5x）让玩家不必等到天荒地老
  DAY_MS: [0, 1000, 500, 250, 125],// [B] 暂停/1x/2x/4x/8x（1x = 1 天/秒）
  SPEED_LABELS: ["⏸", "1x", "2x", "4x", "8x"],
  MAX_CATCHUP_PER_FRAME: 3,   // [B] 单帧最多补 3 天（防雪崩）

  // —— 装备类型与生产（§3.4）——
  EQUIP_TYPES: ['inf_eq', 'art_eq', 'tank_eq', 'truck_eq', 'sup_eq'],
  EQUIP_NAMES: {
    inf_eq: '步兵装备',
    art_eq: '火炮',
    tank_eq: '坦克',
    truck_eq: '卡车',
    sup_eq: '支援装备',
    air_eq: '空军装备'
  },
  EQUIP_COSTS: {
    inf_eq: 0.5,    // 步枪/轻武器造价低
    art_eq: 3.0,    // 火炮
    tank_eq: 12.0,  // 坦克
    truck_eq: 2.0,  // 军用卡车
    sup_eq: 4.0,    // 电台/工程/野战医疗支援装备
    air_eq: 4.0     // W6-3：空军装备（每架飞机 4 装备点，联队由 airProductionTick 从库存补充）
  },
  DIVISION_EQUIPMENT: {
    inf:  { inf_eq: 100, sup_eq: 10 },
    cav:  { inf_eq: 80,  sup_eq: 10 },
    mtn:  { inf_eq: 120, art_eq: 20 },
    mot:  { inf_eq: 100, truck_eq: 40 },
    larm: { tank_eq: 40, truck_eq: 20 },
    arm:  { tank_eq: 60, truck_eq: 30, art_eq: 20 }
  },

  // —— AI 难度四档（§3.10）——
  // v14.0 P5：难度由 4 档扩为 10 档（HOI4 式 AI 强度 1-10）[H]
  //   prodMul        AI 工厂产出倍率
  //   decisionDelay  决策间隔（天）
  //   attackThreshold 发起进攻所需的战力比
  //   rallyRatio     集结度要求（低于则继续集结，不进攻）
  //   restOrgRatio   组织度低于此比例时强制休整
  //   maxOffensiveDays 连续进攻上限（超过则休整）
  //   focusFire      是否集中兵力（true=集中，false=多线铺开）
  DIFFICULTIES: {
    historical:    { id:'historical',    name:'史实模式 (AI 5)', aiLevel:5, prodMul:1.0, decisionDelay:2, attackThreshold:2.0, threatThreshold:80, rallyRatio:0.60, restOrgRatio:0.40, maxOffensiveDays:4, focusFire:true },
    lieutenant:    { id:'lieutenant',    name:'中尉·简易 (AI 3)', aiLevel:3, prodMul:0.8, decisionDelay:3, attackThreshold:2.6, threatThreshold:100, rallyRatio:0.80, restOrgRatio:0.30, maxOffensiveDays:2, focusFire:false },
    general:       { id:'general',       name:'上将·标准 (AI 6)', aiLevel:6, prodMul:1.05, decisionDelay:2, attackThreshold:1.9, threatThreshold:75, rallyRatio:0.55, restOrgRatio:0.42, maxOffensiveDays:5, focusFire:true },
    field_marshal: { id:'field_marshal', name:'元帅·挑战 (AI 9)', aiLevel:9, prodMul:1.3, decisionDelay:1, attackThreshold:1.55, threatThreshold:55, rallyRatio:0.45, restOrgRatio:0.48, maxOffensiveDays:7, focusFire:true },
    // 1~10 精细梯度（供 tools/ai_balance.js 与自定义难度使用）
    ai_1:  { id:'ai_1',  name:'AI 1  ', aiLevel:1,  prodMul:0.70, decisionDelay:4, attackThreshold:3.0, threatThreshold:120, rallyRatio:0.90, restOrgRatio:0.25, maxOffensiveDays:2, focusFire:false },
    ai_3:  { id:'ai_3',  name:'AI 3  ', aiLevel:3,  prodMul:0.85, decisionDelay:3, attackThreshold:2.4, threatThreshold:100, rallyRatio:0.75, restOrgRatio:0.32, maxOffensiveDays:3, focusFire:false },
    ai_5:  { id:'ai_5',  name:'AI 5  ', aiLevel:5,  prodMul:1.00, decisionDelay:2, attackThreshold:2.0, threatThreshold:80,  rallyRatio:0.60, restOrgRatio:0.40, maxOffensiveDays:4, focusFire:true },
    ai_7:  { id:'ai_7',  name:'AI 7  ', aiLevel:7,  prodMul:1.15, decisionDelay:2, attackThreshold:1.75, threatThreshold:68, rallyRatio:0.50, restOrgRatio:0.45, maxOffensiveDays:6, focusFire:true },
    ai_10: { id:'ai_10', name:'AI 10 ', aiLevel:10, prodMul:1.40, decisionDelay:1, attackThreshold:1.45, threatThreshold:50, rallyRatio:0.40, restOrgRatio:0.52, maxOffensiveDays:8, focusFire:true }
  },

  // —— 地图 ——
  HEX_SIZE: 34,               // [B] zoom=1 时 hex 外接半径（像素）

  // —— v4.0 前线与作战计划常数（§2）——
  COMMAND_POWER_CAP: 200,             // [H] 指挥点数上限
  COMMAND_POWER_HIRE_GENERAL: 20,     // [H] 招募将领消耗
  COMMAND_POWER_PROMOTE_MARSHAL: 50,  // [H] 晋升元帅消耗
  ARMY_MAX_DIVISIONS: 24,             // [H] 单军军长指挥师上限
  ARMY_GROUP_MAX_ARMIES: 5,           // [H] 集团军群辖军上限
  OVER_CAPACITY_PENALTY_BASE: 0.25,   // [H] 超编基础惩罚 -25%
  OVER_CAPACITY_PENALTY_PER_DIV: 0.025,// [B] 每超编1师额外 -2.5%
  OVER_CAPACITY_PENALTY_MAX: 0.50,    // [B] 超编惩罚封顶 -50%
  PLAN_ACCUM_RATE: 0.02,              // [H] 基础计划积累速率 +2%/天
  PLAN_BASE_CAP: 0.30,                // [H] 基础计划上限 30%
  PLAN_ARROW_BONUS: 0.10,             // [B] 每增加一条有效进攻箭头 +10%
  PLAN_MAX_CAP: 0.50,                 // [B] 计划加成封顶 50%
  PLAN_DECAY_RATE: 0.05,              // [B] 执行日每日计划消耗 -5%
  PLAN_MANUAL_PENALTY: 0.05,          // [H/B] 手动微操时全军计划流失 -5%

  // —— v7.0 地形战斗宽度上限表（§2.2）——
  // —— W1 战斗内核（v14.1）：战宽对齐 HOI4 原版 ——
  // TERRAIN_COMBAT_WIDTH 直接用 HOI4 Wiki 原值（不再用 1:13 缩尺的 scaleBase/scaleFlank）；
  // 师宽换算走 WIDTH_SCALE：本作 1 师 = UNITS.width(2) × WIDTH_SCALE(5) = HOI4 的 10 宽。
  TERRAIN_COMBAT_WIDTH: {
    plain:  { base: 70, flank: 35, name: '平原' },
    forest: { base: 60, flank: 30, name: '森林' },
    mount:  { base: 50, flank: 25, name: '山脉' },
    urban:  { base: 80, flank: 40, name: '城市' },
    city:   { base: 80, flank: 40, name: '城市' },
    marsh:  { base: 50, flank: 25, name: '沼泽' },
    hills:  { base: 70, flank: 35, name: '丘陵' },
    desert: { base: 70, flank: 35, name: '沙漠' }
  },
  WIDTH_SCALE: 5,             // [B] 师宽换算系数（2 宽师 → 10 宽，对齐 HOI4 师宽文化）
  BASE_WIDTH: 70,             // [H] 地形缺失时的兜底战宽（= 平原）
  WIDTH_PER_FLANK: 35,        // [H] 每附加进攻方向战宽（= 平原侧翼）
  WIDTH_MAX: 175,             // [H] 战宽上限（70 + 35×3，最多 1 主方向 + 3 侧翼）
  WIDTH_MAX_DIRECTIONS: 4,    // [H] 计入战宽的方向数上限
  WIDTH_OVERFLOW_TOL: 0.25,   // [B] 预备队增援允许挤入的超宽容差（≤师宽 25% 的缺口可挤入）
  WIDTH_OVERFLOW_CAP: 0.33,   // [H] 超宽惩罚封顶 -33%（HOI4 原版）
  // v14.1 W1 裁决：系数回到 HOI4 原版的 1.0。原 2.0 是为补偿「全场均值减伤」
  // 时代铺兵手感的旧标定；逐师配对落地后超宽惩罚由真实战宽结算承载。
  WIDTH_OVERFLOW_COEF: 1.0,

  // —— W1-3 包围 / 要塞 / 夜间 ——
  ENCIRCLED_DEF_MUL: 0.70,        // [H] 包围（所有相邻陆格被敌控）守方防御 ×0.70
  FORT_ATK_PENALTY: 0.15,         // [H] 要塞每级攻方 -15%（HOI4 原版）
  NIGHT_COMBAT_MUL: 0.50,         // [H] 夜间双方输出 ×0.5（HOI4 原版）
  NIGHT_START_HOUR: 22,           // [H] 夜战窗口 22:00–05:59（每日 8 小时）
  NIGHT_END_HOUR: 6,

  // —— W1-4 指挥官技能（HOI4：每点 +2.5% 攻/防双向）——
  COMMANDER_SKILL_COMBAT: 0.025,

  // —— W1-7 经验（HOI4 五档；doctrine.DIVISION_EXP_TIERS 为唯一权威）——
  COMBAT_XP_PER_DAY: 1,           // [B] 参战每日 +1 XP
  EXERCISE_XP_PER_DAY: 1,         // [B] 演习每日 +1 XP（战前练兵）
  XP_RATIO_SCALE: 100,            // [B] expRatio = xp / 100（阶梯 10/30/75/90 XP）

  // —— v7.0 战术相克矩阵表（§2.2）——
  TACTICS: {
    // 进攻方战术
    blitz:            { id: 'blitz',            name: '装甲闪击',   role: 'attack', atkMul: 1.20, breakMul: 1.25, counteredBy: 'anti_tank_depth',   desc: '古德里安装甲突破理论，攻击 +20%，突破 +25%' },
    pincer:           { id: 'pincer',           name: '钳形合围',   role: 'attack', atkMul: 1.15, breakMul: 1.10, counteredBy: 'evacuation',        desc: '两翼高速合围兜底，攻击 +15%' },
    creeping_barrage: { id: 'creeping_barrage', name: '步炮弹幕徐进', role: 'attack', atkMul: 1.10, artBonus: 0.25, counteredBy: 'elastic_defense', desc: '弹幕逐层徐进掩护，无视守军 25% 堑壕' },
    infiltration:     { id: 'infiltration',     name: '夜间渗透奇袭', role: 'attack', atkMul: 1.25, stealth: true,   counteredBy: 'illuminated_ambush', desc: '暗夜多路穿插，突击攻击 +25%' },
    assault:          { id: 'assault',          name: '正面强攻',   role: 'attack', dmgDealMul: 1.30, dmgTakeMul: 1.20, desc: '正面猛烈突贯，输出 ×1.3，自损 ×1.2' },
    shock:            { id: 'shock',            name: '快速突袭',   role: 'attack', firstDayAtkMul: 1.50, desc: '战役骤起突击，首日攻击 ×1.5' },

    // 防守方战术
    anti_tank_depth:  { id: 'anti_tank_depth',  name: '纵深反坦克壕阵', role: 'defense', defMul: 1.25, counters: 'blitz',            desc: '库尔斯克式梯次防线，克制装甲闪击，防御 +25%' },
    evacuation:       { id: 'evacuation',       name: '战略撤退保全', role: 'defense', defMul: 1.10, retainOrg: 0.70, counters: 'pincer', desc: '曼施坦因后撤反击，克制钳形合围，撤退组织度保留 70%' },
    elastic_defense:  { id: 'elastic_defense',  name: '弹性波次防守', role: 'defense', defMul: 1.15, reflectMul: 1.20, counters: 'creeping_barrage', desc: '兴登堡防线弹性布局，克制徐进弹幕，反击伤害 +20%' },
    illuminated_ambush:{ id: 'illuminated_ambush',name: '全线照明与集火', role: 'defense', defMul: 1.20, trapDmgMul: 2.0, counters: 'infiltration', desc: '探照灯照亮黑夜陷阱，克制夜间渗透，敌承受双倍伤亡' },
    delay:            { id: 'delay',            name: '层层迟滞',   role: 'defense', enemySpeedMul: 0.50, enemyOrgDmgMul: 0.50, desc: '层层阻击迟滞敌军推进' },

    // 历史别名兼容
    flank:            { id: 'flank',            name: '包抄(钳形)', role: 'attack', atkMul: 1.15, needArmorPct: 0.30, counteredBy: 'evacuation', desc: '装甲侧翼穿插，攻击 +15%' },
    elastic_def:      { id: 'elastic_def',      name: '弹性防御',   role: 'defense', defMul: 1.15, counters: 'creeping_barrage', desc: '空间换时间，防御 +15%' },
    depth_def:        { id: 'depth_def',        name: '纵深防御',   role: 'defense', defMul: 1.10, reflectMul: 1.20, counters: 'blitz', desc: '梯次阵地抵御，防御 +10% 且反击伤害 ×1.2' }
  },

  // —— v7.0 后勤补给参数表（§2.1 / 附录 B.3 断供曲线）——
  SUPPLY_PARAMS: {
    GRACE_DAYS: 3,                // 补给宽限期：随身干粮 72 小时 (3天) 0 惩罚
    DAILY_ATK_PENALTY: 0.125,     // [B.3] 断供 4~7 天：攻击惩罚 = (天数-3) × 12.5%
    MAX_ATK_PENALTY: 0.50,        // [B.3] 攻击最高减损 -50%
    DAILY_DEF_PENALTY: 0.15,      // [§2.1] 断供后每日防御减损 -15%
    MAX_DEF_PENALTY: 0.60,        // [§2.1] 防御最高减损 -60%
    DAILY_SPEED_PENALTY: 0.40,    // [§2.1] 断供后每日航速减损 -40%
    MAX_SPEED_PENALTY: 0.80,      // [§2.1] 航速最高减损 -80%
    DAILY_ATTRITION: 0.025,       // [§2.1] 断供后每日装备人员蒸发 -2.5%
    COLLAPSE_DAYS: 7,             // [B.3] 断供超 7 天：组织度上限 20%、每日 3.0% 装备人员损失
    COLLAPSE_ORG_CAP: 0.20,       // [B.3] 彻底断供组织度上限
    COLLAPSE_DAILY_LOSS: 0.03,    // [B.3] 彻底断供每日装备人员损失 3.0%

    // 枢纽末端摩托化等级
    MOTORIZATION: [
      { level: 0, name: '徒步/马车运输', truckCost: 0,  radius: 2, mudPenalty: 0.0 },
      { level: 1, name: '轻度卡车摩托化', truckCost: 20, radius: 3, mudPenalty: -0.30 },
      { level: 2, name: '全机械化补给队', truckCost: 50, radius: 4, mudPenalty: -0.70 }
    ]
  },

  // —— v9.0 空军系统参数表（§4-N1 / 附录 B.2）[H] ——
  AIR: {
    // W0-A1（2026-10）打开：getBattleAirModifier 的实现是完整的，且 battle.js:283-287
    // 早已在消费它（atkEff *= airMod.atkMul / defPool *= airMod.defMul），
    // 关着的唯一后果是制空权与近距支援对战斗的影响恒为 0 —— 空军 511 行代码纯摆设。
    // 打开后无联队的战场 ratios 双双落在 0.50（adv=0）→ 倍率仍为 1.0，
    // 因此对「无空军」的沙盒与旧测试仍是零漂移。
    ENABLE_COMBAT_MODIFIER: true,   // [B] 陆军战斗挂载：制空权地面加成 + CAS 支援
    BASE_CAPACITY_PER_LEVEL: 200,   // [H] 机场每级容量 200 架
    MAX_AIRBASE_LEVEL: 10,          // [H] 机场最高 10 级 (2000架)
    OVERCROWD_EFF_PENALTY: 2.0,     // [H] 超容每 1% 任务效率 -2% (超 50% 效率归 0)
    OVERCROWD_MAX_PENALTY: 1.0,     // [H] 超容最高惩罚 -100%
    STANDARD_WING_SIZE: 100,        // [H] 联队标准规模 100 架
    UPGRADE_XP_COST: 100,           // [H] W6-4：机型设计改进每次 100 空军经验
    MAX_WING_SIZE: 1000,            // [H] 联队上限 1000 架

    // 机种制空权重 [H]
    WEIGHTS: {
      heavy_fighter: 1.25,          // [H] 重型战斗机 1.25
      fighter: 1.00,                // [H] 战斗机 1.00
      cas: 1.00,                    // [H] 近距空中支援 CAS 1.00
      naval_bomber: 1.00,           // [H] 海军轰炸机 1.00
      tactical_bomber: 1.00,        // [H] 战术轰炸机 1.00
      strat_bomber: 0.01,           // [H] 战略轰炸机 0.01
      transport: 0.00               // [H] 运输机 0.00
    },

    // CAS 近距支援参数 [H]
    CAS_WIDTH_MULT: 3,              // [H] 参战飞机上限 = 敌方战线宽度 × 3
    CAS_ATTACK_BONUS_BASE: 0.25,    // [H] 攻击加成基数 +25%
    CAS_ORG_DAMAGE: 0.04,           // [H] CAS 对 org 伤害系数 0.04
    CAS_STR_DAMAGE: 0.04,           // [H] CAS 对 str/hp 伤害系数 0.04
    CAS_AA_MAX_REDUCTION: 0.75,     // [H] 防空最高减伤 75%
    CAS_AA_SHOOTDOWN: 0.07,         // [H] 防空击落率 7%

    // 战略轰炸建筑伤害系数 [H]
    STRAT_BOMB_TARGETS: {
      infra: 1.00, civ: 1.00, mil: 1.00, dockyard: 1.00,
      refinery: 1.00, fuel_silo: 1.00, reactor: 1.00,
      air_base: 0.50, radar: 0.50,
      anti_air: 0.10, dam: 0.00
    },
    PROVINCE_AA_VULNERABILITY: -0.12, // [H] 每级州防空 -12% 脆弱度
    PROVINCE_AA_AIR_SUPERIORITY: -0.05,// [H] 每级州防空 -5% 敌方空优

    // 航程覆盖惩罚阶梯 [H]
    RANGE_PENALTIES: [
      { minCoverage: 1.00, penalty: 0.00 },
      { minCoverage: 0.84, penalty: 0.16 },
      { minCoverage: 0.60, penalty: 0.40 },
      { minCoverage: 0.30, penalty: 0.70 }
    ],

    // 王牌生成与阶梯 [H]
    ACE_TIERS: {
      good:   { id: 'good',   name: '王牌飞行员',   effBonus: 0.05, wingExpBonus: 0.10 },
      unique: { id: 'unique', name: '传奇王牌',     effBonus: 0.10, wingExpBonus: 0.20 },
      genius: { id: 'genius', name: '天纵奇才王牌', effBonus: 0.15, wingExpBonus: 0.30 }
    },

    // 空优对地影响 [H]
    // 补一个常量：敌制空权对**攻击**的惩罚。
    // 原先 air.js:458 复用了 SUPERIORITY_MOVE_PENALTY_MAX（机动 −50%）
    // 来压制攻方攻击，那是张冠李戴：HOI4 Wiki「Land battle」明写
    // "Enemy air superiority: up to -35% penalty for whichever side is
    // facing hostile air superiority"，机动另有其值。
    // 这个修正此前被 ENABLE_COMBAT_MODIFIER=false 完全掩盖，从未生效；
    // W0-A1 打开开关后它第一次进入实战，必须先与原版对齐。
    SUPERIORITY_ATK_PENALTY_MAX: -0.35, // [H] 遭敌制空权时攻击/突破最高 -35%
    SUPERIORITY_DEF_PENALTY_MAX: -0.50, // [H] 劣势方防御最高 -50%
    SUPERIORITY_MOVE_PENALTY_MAX: -0.50,// [H] 劣势方移速最高 -50%（仅用于机动，勿挪作攻击）
    SUPERIORITY_GROUND_BUFF_MAX: 0.20,  // [H] 优势方地面最高 +20% 攻 / +20% 防

    // 颜色阈值 [H]
    COLORS: {
      red: 0.40,    // < 40% 红色劣势 [H]
      yellow: 0.60  // 40% - 60% 黄色拉锯，> 60% 绿色制空 [H]
    },

    // 空运补给 [H]
    AIR_SUPPLY_PER_PLANE: 0.20          // [H] 每架运输机 0.2 补给/天
  },

  NAVY: {
    // v14.1 W6：开启海战模型与岸轰支援开关
    ENABLE_COMBAT_MODIFIER: true,       // [H] 海战模型与逐舰交火/岸轰支援全面启用
    SHORE_BOMBARDMENT_MAX: -0.25,       // [H] 战列舰/巡洋舰重炮岸轰削弱上限 -25%
    INTEL_THRESHOLD: 0.40,              // [H] 海军情报效率硬门槛：< 40% → 海权为 0
    BASE_HIT_CHANCE: 0.10,              // [H] 基础命中率 10%
    DEPTH_CHARGE_HIT_CHANCE: 0.11,      // [H] 深水炸弹命中率 11%
    SCREEN_RATIO_REQUIRED: 3,           // [H] 3 屏卫 / 1 资本舰
    SCREEN_FULL_HIT_BONUS: 0.40,        // [H] 满屏卫命中加成 +40%
    SCREEN_FULL_RETREAT_BONUS: 0.20,    // [H] 满屏卫撤退速度 +20%
    CARRIER_CAPITAL_RATIO: 1,           // [H] 1 资本舰 / 1 航母
    CARRIER_SORTIE_EFF_BONUS: 0.10,     // [H] 航母出击效率 +10%
    CARRIER_PLANE_DAMAGE_MULT: 5.0,     // [H] 航母载机伤害 ×500%

    // 海军优势单舰参数 [H]：0.005 × IC + 0.05 × 舰员
    SHIP_PARAMS: {
      bb:      { name: '战列舰', ic: 12000, manpower: 5000, type: 'capital', armor: 32, piercing: 34, hp: 450, org: 50 },  // 60 + 250 = 310点
      cv:      { name: '航空母舰', ic: 11000, manpower: 4500, type: 'carrier', armor: 15, piercing: 10, hp: 350, org: 40 }, // 55 + 225 = 280点
      ca:      { name: '重巡洋舰', ic: 5500,  manpower: 1800, type: 'capital', armor: 18, piercing: 20, hp: 220, org: 45 },  // 27.5 + 90 = 117.5点
      cl:      { name: '轻巡洋舰', ic: 3800,  manpower: 1200, type: 'screen',  armor: 10, piercing: 12, hp: 160, org: 50 },  // 19 + 60 = 79点
      dd:      { name: '驱逐舰',   ic: 1400,  manpower: 350,  type: 'screen',  armor: 2,  piercing: 5,  hp: 80,  org: 55 },  // 7 + 17.5 = 24.5点
      ss:      { name: '攻击潜艇', ic: 900,   manpower: 80,   type: 'sub',     armor: 0,  piercing: 28, hp: 40,  org: 30 },  // 4.5 + 4 = 8.5点 (几乎不贡献海权)
      convoy:  { name: '运输船',   ic: 100,   manpower: 10,   type: 'convoy',  armor: 0,  piercing: 0,  hp: 20,  org: 10 }
    },

    // 任务乘数 [H]
    TASK_MULTIPLIERS: {
      patrol: 1.0,          // [H] 巡逻 100%
      strike: 1.0,          // [H] 突击舰队 100%
      convoy_escort: 1.0,   // [H] 护航 100%
      naval_invasion: 1.0,  // [H] 登陆支援 100%
      minelaying: 0.30,     // [H] 布雷 30%
      convoy_raiding: 0.10, // [H] 破交 10%
      hold: 0.0             // 在港驻泊 0%
    },

    // 穿甲减伤参数 [H]：-90% × (1 - 穿甲/装甲)，上限 90%
    PIERCE_DEF_MAX_REDUCTION: 0.90,

    // 暴击概率 [H]
    CRIT_CHANCE_TORPEDO: 0.20,      // 鱼雷 20%
    CRIT_CHANCE_GUN: 0.10,          // 其他火炮 10%
    MAGAZINE_DETONATION_MULT: 9.0,  // 弹仓殉爆 +900% (10x伤害)

    // 登陆作战参数 [H]
    INVASION_PREP_DAYS_PER_DIV: 7,  // 每师 7 天 (10师 = 70天)
    INVASION_SUPERIORITY_REQ: 0.50, // 需经行海区海权 > 50%
    INVASION_INTEL_REQ: 0.40,       // 且情报效率 >= 40%
    INVASION_PENALTY_ATK: -0.50,    // 滩头进攻惩罚 -50%
    INVASION_PENALTY_BREAK: -0.50,  // 滩头突破惩罚 -50%

    // 目标选择权重 [H]
    TARGET_WEIGHTS: {
      capital: 30,
      carrier: 15,
      screen: 3,
      sub: 4,
      sub_to_convoy: 600,      // 潜艇对运输船 600
      non_sub_to_convoy: 60    // 非潜艇对运输船 60
    }
  },

  // —— v9.0 间谍与情报系统参数表（§4-N3 / 附录 B.4）[H] ——
  INTEL: {
    // W0-A1（2026-10）打开：calcIntelCombatBonus 实现完整，但此前全库 0 引用，
    // 情报优势对战斗的影响恒为 0。打开后由 battle.js 挂载。
    // 零漂移保证：双方情报等级相同时 diff=0 → 加成 0；
    // 开局所有国家情报等级一致（calcIntelLevels 对无机构国家一律返回 10/10/10/10），
    // 因此对既有测试与沙盒仍是 0。
    ENABLE_COMBAT_MODIFIER: true,       // [B] 情报优势 → 攻防加成挂载
    // 战斗加成核心参数 [H]
    COMBAT_BONUS_PER_PP: 0.003,         // [H] 陆军情报差每 1pp 攻防突破 +0.3%
    COMBAT_BONUS_THRESHOLD_PP: 5,       // [H] 情报差 ≥ 5pp 时激活加成 (5pp -> +1.5%)
    COMBAT_BONUS_CAP: 0.15,             // [H] 战斗情报加成上限 +15% (50pp 封顶)

    // 密码与破译参数 [H]
    CIPHER_BASE_STRENGTH: 12000,        // [H] 基础密码强度 12000
    CIPHER_LEVEL_STRENGTH: 4250,        // [H] 每级密码学 +4250 强度 (Lv7 -> 41750)
    CIPHER_CRACKED_DAYS: 30,            // [H] 破译有效周期 30 天
    CIPHER_RESET_RATIO: 0.50,           // [H] 破译过期后重置为 50% 进度
    PEACE_DECRYPTION_PENALTY: 0.50,     // [H] 非战时破译积累速度 -50%

    // 间谍机构与特工参数 [H]
    AGENCY_CREATION_CIV: 5,             // [H] 组建机构需 5 民用工厂
    AGENCY_CREATION_DAYS: 30,           // [H] 组建机构需 30 天
    AGENCY_UPGRADE_DAYS: 30,            // [H] 机构分支升级需 30 天
    OPERATIVE_SLOT_PER_UPGRADES: 5,     // [H] 每 5 次机构升级增加 1 特工槽
    OPERATIVE_MAX_SLOTS: 10,            // [H] 特工槽位上限 10
    OPERATIVE_RECRUIT_CD_DAYS: 30,      // [H] 特工招募冷却 30 天
    REPEAT_OP_COST_MULT: 1.15,          // [H] 重复执行同目标同行动成本每次 +15%
    ALLIANCE_INTEL_SHARE_RATIO: 0.30    // [H] 同阵营盟友情报共享差额 30%
  }
};


/* ============================================================
   v14.0 P0 派生值（日 → 小时口径换算）
   这些值不能写在 K 字面量里（自引用），故在对象构造后统一求值。
   ============================================================ */
K.HOUR_ORG_DMG_CAP     = K.ORG_DMG_CAP / K.HOURS_PER_DAY;   // 35/24 ≈ 1.458
K.ORG_RECOVER_PER_HOUR = K.ORG_RECOVER_PER_DAY / K.HOURS_PER_DAY;

/** 防御·突破 4 倍减伤：承伤系数 = max(下限, 1 − 防御/(4×攻击)) */
export function defenseMitigation(defense, attack){
  if(!(attack > 0)) return 1;
  return Math.max(K.DEFENSE_FLOOR, 1 - defense / (K.DEFENSE_FACTOR * attack));
}
