/* ============================================================
   data/doctrines.js —— 三军作战学说树数据规范 (v9.0 §4-N4 / 附录 B.5) [H]
   包含：
   - 陆军 4 树：机动战 / 优势火力 / 大战略 / 大规模突击 (同军种互斥)
   - 空军 3 树：战略破坏 / 战场支援 / 作战完整性
   - 海军 3 树：存在舰队 / 贸易封锁 / 基地打击
   - 节点标准成本：100 XP
   ============================================================ */

export const DOCTRINES_DATA = {
  // ==================== 陆军四大经典学说树 [H] ====================
  land: {
    mobile_warfare: {
      id: 'mobile_warfare',
      name: '机动战学说 (Mobile Warfare)',
      desc: '以集中装甲部队与摩托化机械协同突击，强调速度、突破与闪击切割',
      treeType: 'land',
      nodes: [
        {
          id: 'mw_blitzkrieg',
          name: '闪电战 (Blitzkrieg)',
          costXP: 100,
          requires: [],
          effects: { planSpeed: 0.50, divSpeed: 0.10, moveOrgLoss: -0.10, tankBreakthrough: 0.20 },
          desc: '计划积累速度 +50%，师移动速度 +10%，行军组织度损耗 -10%，装甲突破 +20% [H]'
        },
        {
          id: 'mw_delay',
          name: '迟滞战术 (Delay)',
          costXP: 100,
          requires: ['mw_blitzkrieg'],
          effects: { infOrg: 15, motOrg: 15 },
          desc: '步兵营与摩托化步兵营基础组织度 +15 [H]'
        },
        {
          id: 'mw_elastic_def',
          name: '弹性防御 (Elastic Defense)',
          costXP: 100,
          requires: ['mw_delay'],
          effects: { reinforceRate: 0.02 },
          desc: '预备队每小时战役增援率 +2% [H]'
        },
        {
          id: 'mw_armored_spearhead',
          name: '装甲先锋 (Armored Spearhead)',
          costXP: 100,
          requires: ['mw_elastic_def'],
          effects: { tankOrg: 3, tankBreakthrough: 0.20 },
          desc: '装甲营组织度 +3，坦克突破 +20% [H]'
        },
        {
          id: 'mw_modern_blitzkrieg',
          name: '现代闪击战 (Modern Blitzkrieg)',
          costXP: 100,
          requires: ['mw_armored_spearhead'],
          effects: { tankOrg: 3, tankBreakthrough: 0.20, motBreakthrough: 0.15, planning: 0.25 },
          desc: '坦克组织度 +3/突破 +20%，摩托化步兵突破 +15%，计划积累 +25% [H]'
        }
      ]
    },

    superior_firepower: {
      id: 'superior_firepower',
      name: '优势火力学说 (Superior Firepower)',
      desc: '以海量火炮覆盖与前线强大压制火力摧毁敌人，重视一线营软攻与支援连',
      treeType: 'land',
      nodes: [
        {
          id: 'sf_superior_firepower',
          name: '绝对火力优势',
          costXP: 100,
          requires: [],
          effects: { frontlineSoftAtk: 0.10 },
          desc: '一线战斗营软攻 +10% [H]'
        },
        {
          id: 'sf_integrated_support',
          name: '一体化支援协同 (Integrated Support)',
          costXP: 100,
          requires: ['sf_superior_firepower'],
          effects: { supportOrg: 10, supportSoftAtk: 0.25 },
          desc: '支援连组织度 +10，支援连软攻 +25% [H]'
        },
        {
          id: 'sf_concentrated_fire',
          name: '集中炮火毁伤 (Concentrated Fire)',
          costXP: 100,
          requires: ['sf_integrated_support'],
          effects: { hardAtk: 0.10 },
          desc: '全师硬目标穿甲杀伤 (硬攻) +10% [H]'
        },
        {
          id: 'sf_combined_arms',
          name: '诸兵种联合打击 (Combined Arms)',
          costXP: 100,
          requires: ['sf_concentrated_fire'],
          effects: { tankHardAtk: 0.10, tankSoftAtk: 0.10 },
          desc: '坦克硬攻 +10%，软攻 +10% [H]'
        },
        {
          id: 'sf_airland_battle',
          name: '空地一体战 (AirLand Battle)',
          costXP: 100,
          requires: ['sf_combined_arms'],
          effects: { airSuperiorityBonus: 0.15, frontlineOrg: 5 },
          desc: '战区空优对地面协同加成 +15%，一线战斗营组织度 +5 [H]'
        }
      ]
    },

    grand_battleplan: {
      id: 'grand_battleplan',
      name: '大战略学说 (Grand Battleplan)',
      desc: '依靠严谨的参谋计划与坚固的预设堑壕工事，稳扎稳打步步为营',
      treeType: 'land',
      nodes: [
        {
          id: 'gb_trench_warfare',
          name: '堑壕纵深要塞战 (Trench Warfare)',
          costXP: 100,
          requires: [],
          effects: { maxEntrench: 10, entrenchRate: 0.25 },
          desc: '最大堑壕壕沟上限 +10，每日挖壕速度 +25% [H]'
        },
        {
          id: 'gb_grand_battleplan',
          name: '大战略作战计划 (Grand Battle Plan)',
          costXP: 100,
          requires: ['gb_trench_warfare'],
          effects: { maxPlanning: 0.10, dailyCP: 0.25 },
          desc: '作战计划槽位上限 +10%，每日指挥点增长 +0.25 [H]'
        },
        {
          id: 'gb_grand_assault',
          name: '宏大步炮协同突击 (Grand Assault)',
          costXP: 100,
          requires: ['gb_grand_battleplan'],
          effects: { breakthrough: 0.10, softAtk: 0.05 },
          desc: '突击进攻突破 +10%，全军软攻 +5% [H]'
        },
        {
          id: 'gb_night_assault',
          name: '夜间奇袭突进战术 (Night Assault)',
          costXP: 100,
          requires: ['gb_grand_assault'],
          effects: { nightAtk: 0.25 },
          desc: '夜战攻击惩罚大幅降低 (+25% 夜战属性) [H]'
        },
        {
          id: 'gb_central_planning',
          name: '中央统帅参谋统筹 (Central Planning)',
          costXP: 100,
          requires: ['gb_night_assault'],
          effects: { maxPlanning: 0.10, maxCP: 30, planDecay: -0.10 },
          desc: '最大计划值再 +10%，指挥点数储备上限 +30，计划执行消耗 -10%/天 [H]'
        }
      ]
    },

    mass_assault: {
      id: 'mass_assault',
      name: '大规模突击学说 (Mass Assault)',
      desc: '以取之不尽的庞大人力储备与压倒性人海冲锋淹没敌人，战线宽度大幅缩减',
      treeType: 'land',
      nodes: [
        {
          id: 'ma_defense_in_depth',
          name: '纵深防御体系 (Defense in Depth)',
          costXP: 100,
          requires: [],
          effects: { maxEntrench: 5, reinforceRate: 0.02 },
          desc: '最大堑壕 +5，预备队每小时战役增援率 +2% [H]'
        },
        {
          id: 'ma_large_front',
          name: '宽正面前线保障 (Large Front Ops)',
          costXP: 100,
          requires: ['ma_defense_in_depth'],
          effects: { supplyConsumption: -0.10 },
          desc: '全师补给物资与口粮消耗 -10% [H]'
        },
        {
          id: 'ma_vast_offensives',
          name: '广阔攻势展开 (Vast Offensives)',
          costXP: 100,
          requires: ['ma_large_front'],
          effects: { infCombatWidth: -0.3 },
          desc: '步兵营作战宽度 -0.3 (允许在标准战宽塞入更多部队) [H]'
        },
        {
          id: 'ma_human_wave',
          name: '人海无畏冲锋 (Human Wave Offensive)',
          costXP: 100,
          requires: ['ma_vast_offensives'],
          effects: { infCombatWidth: -0.4, reinforceRate: 0.15, recruitablePop: 0.05 },
          desc: '步兵作战宽度再 -0.4，战役增援骰 +15%，适役动员人口 +5% [H]'
        },
        {
          id: 'ma_guerrilla',
          name: '游击敌后持久战 (Guerrilla Warfare)',
          costXP: 100,
          requires: ['ma_human_wave'],
          effects: { outOfSupplyPenalty: -0.30, resistanceGrowth: 0.25 },
          desc: '断粮断油战斗惩罚减免 30%，占领区抵抗爆发增长 +25% [H]'
        }
      ]
    }
  },

  // ==================== 空军三大战略学说树 [H] ====================
  air: {
    strategic_destruction: {
      id: 'strategic_destruction',
      name: '战略破坏学说 (Strategic Destruction)',
      desc: '以重型四发轰炸机摧毁敌国军民工业基地、铁路干线与合成油厂',
      treeType: 'air',
      nodes: [
        { id: 'ad_air_sup', name: '制空权优先 (Air Superiority)', costXP: 100, requires: [], effects: { fighterSuperiority: 0.15 }, desc: '战斗机与重战制空效率 +15%' },
        { id: 'ad_day_bomb', name: '昼间精密轰炸', costXP: 100, requires: ['ad_air_sup'], effects: { stratBombDmg: 0.20 }, desc: '战略轰炸对工业设施伤害 +20%' },
        { id: 'ad_escort', name: '远程机群护航', costXP: 100, requires: ['ad_day_bomb'], effects: { escortEfficiency: 0.25 }, desc: '战略轰炸机自卫与护卫效率 +25%' }
      ]
    },
    battlefield_support: {
      id: 'battlefield_support',
      name: '战场支援学说 (Battlefield Support)',
      desc: '以斯图卡俯冲轰炸机与战术轰炸机直接协同陆军突破，消灭前线敌装甲',
      treeType: 'air',
      nodes: [
        { id: 'ad_dive_bomb', name: '俯冲轰炸攻击', costXP: 100, requires: [], effects: { casGroundDmg: 0.20 }, desc: 'CAS 对地面部队伤害 +20%' },
        { id: 'ad_direct_support', name: '近距空中掩护', costXP: 100, requires: ['ad_dive_bomb'], effects: { casWidthCapBonus: 0.20 }, desc: 'CAS 参战战宽上限 +20%' },
        { id: 'ad_air_ground', name: '空地突击枢纽', costXP: 100, requires: ['ad_direct_support'], effects: { groundAttackBonus: 0.10 }, desc: '优势制空下地面部队攻击 +10%' }
      ]
    },
    operational_integrity: {
      id: 'operational_integrity',
      name: '作战完整性学说 (Operational Integrity)',
      desc: '侧重战术轰炸机多用途打击与前线防空拦截，平衡争夺空优与战役轰炸',
      treeType: 'air',
      nodes: [
        { id: 'ad_tac_flex', name: '战术空军多用途机动', costXP: 100, requires: [], effects: { tacBombEff: 0.20 }, desc: '战术轰炸机任务效率 +20%' },
        { id: 'ad_air_intercept', name: '雷达引导截击', costXP: 100, requires: ['ad_tac_flex'], effects: { interceptionSpeed: 0.25 }, desc: '拦截作战效率 +25%' }
      ]
    }
  },

  // ==================== 海军三大远洋学说树 [H] ====================
  navy: {
    fleet_in_being: {
      id: 'fleet_in_being',
      name: '存在舰队学说 (Fleet in Being)',
      desc: '以重装甲战列舰与重巡为核心，牢牢控制近海与关键要塞海峡',
      treeType: 'navy',
      nodes: [
        { id: 'nd_battleship_focus', name: '战列舰决定论', costXP: 100, requires: [], effects: { bbOrg: 10, bbArmor: 0.10 }, desc: '战列舰组织度 +10，装甲厚度 +10%' },
        { id: 'nd_escort_screen', name: '护卫屏卫屏障', costXP: 100, requires: ['nd_battleship_focus'], effects: { screenBonus: 0.15 }, desc: '驱逐舰防空与屏卫效率 +15%' }
      ]
    },
    trade_interdiction: {
      id: 'trade_interdiction',
      name: '贸易封锁与狼群学说 (Trade Interdiction)',
      desc: '以成群的柴电攻击潜艇伏击敌远洋补给线，彻底扼杀岛国与外援',
      treeType: 'navy',
      nodes: [
        { id: 'nd_wolfpack', name: '大西洋狼群战术', costXP: 100, requires: [], effects: { subRaidingEff: 0.30, subDetectNegate: 0.20 }, desc: '潜艇破交击沉效率 +30%，隐匿度 +20%' },
        { id: 'nd_night_raiding', name: '水面夜间鱼雷突袭', costXP: 100, requires: ['nd_wolfpack'], effects: { torpedoCrit: 0.10 }, desc: '鱼雷暴击率额外 +10%' }
      ]
    },
    base_strike: {
      id: 'base_strike',
      name: '基地打击航母学说 (Base Strike)',
      desc: '航空母舰为特混舰队核心，依靠数百架舰载机实施跨超视距超远程歼灭',
      treeType: 'navy',
      nodes: [
        { id: 'nd_carrier_strike', name: '航母机动特混编队', costXP: 100, requires: [], effects: { cvSortieEff: 0.20 }, desc: '航母舰载机出击效率 +20%' },
        { id: 'nd_deck_ops', name: '甲板紧急弹射规程', costXP: 100, requires: ['nd_carrier_strike'], effects: { cvPlaneDmg: 0.25 }, desc: '舰载轰炸机鱼雷与炸弹杀伤 +25%' }
      ]
    }
  }
};
