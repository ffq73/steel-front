/* ============================================================
   data/focuses.js —— 全量国策树（v2.0 §3.6 / v3.0 §3.6）
   支持 G(德)、P(波)、F(法)、S(苏)、B(英)、H(匈) 六国
   每节点 70 天；同时仅 1 个；进行中 -1PP/天；不可取消。
   x: 链索引(0=工业, 1=军事, 2=政治/外交)
   y: 节点层级(0, 1, 2, 3...)
   ============================================================ */

export const FOCUSES = {
  // —— 德国 (42个全量历史国策五大分支：工业、陆军、空军、海军、战略外交) ——
  G: [
    // 0: 工业链 (8个)
    { id:'four_year', chain:'industry', name:'四年计划', days:70, requires:[], x:0, y:0, desc:'建立国家统制经济，为总体战储备工业基础。', effects:[{ type:'addFactory', kind:'civ', count:2 }] },
    { id:'autobahn', chain:'industry', name:'帝国高速公路网', days:70, requires:['four_year'], x:0, y:1, desc:'铺设贯穿东西的混凝土战略交通动脉，加速物资调动。', effects:[{ type:'modifier', scope:'nation', stat:'buildSpeed', value:0.10 }] },
    { id:'hermann_goring_werke', chain:'industry', name:'国家钢铁托拉斯', days:70, requires:['autobahn'], x:0, y:2, desc:'在萨尔茨吉特开采低品位铁矿，扩充重型铸钢厂。', effects:[{ type:'addFactory', kind:'mil', count:2 }] },
    { id:'synfuel', chain:'industry', name:'煤炭液化工程', days:70, requires:['hermann_goring_werke'], x:0, y:3, desc:'勒纳合成燃料厂投产，以褐煤制取高标号合成汽油。', effects:[{ type:'addPP', value:100 }, { type:'modifier', scope:'nation', stat:'pp', value:0.1 }] },
    { id:'buna_rubber', chain:'industry', name:'丁苯合成橡胶工业', days:70, requires:['synfuel'], x:0, y:4, desc:'自研聚丁二烯人造橡胶，彻底摆脱马来亚天然橡胶封锁。', effects:[{ type:'modifier', scope:'nation', stat:'milOutput', value:0.10 }] },
    { id:'speer_armaments', chain:'industry', name:'施佩尔军工整合总署', days:70, requires:['buna_rubber'], x:0, y:5, desc:'引入民用流水线标准化生产，打破军种分割争抢产能。', effects:[{ type:'addFactory', kind:'mil', count:3 }] },
    { id:'total_war', chain:'industry', name:'总体战体制宣言', days:70, requires:['speer_armaments'], x:0, y:6, desc:'动员全社会一切闲置劳力与机床，国家进入总动员体制。', effects:[{ type:'setLaw', law:'total' }] },
    { id:'underground_factories', chain:'industry', name:'地下耐炸兵工所', days:70, requires:['total_war'], x:0, y:7, desc:'将装配车间迁入图林根盐矿隧道，无惧战略轰炸。', effects:[{ type:'addFactory', kind:'mil', count:2 }, { type:'addPP', value:150 }] },

    // 1: 陆军链 (8个)
    { id:'army_innovations', chain:'army', name:'陆军学说创新', days:70, requires:[], x:1, y:0, desc:'反思大团堑壕战教训，探索快速机动协同突破。', effects:[{ type:'addArmyXp', value:20 }] },
    { id:'armor_corps', chain:'army', name:'装甲兵建设', days:70, requires:['army_innovations'], x:1, y:1, desc:'古德里安与曼施坦因装甲突击理论实验，编组独立装甲旅。', effects:[{ type:'unlockTech', tech:'light_tank' }] },
    { id:'blitzkrieg', chain:'army', name:'闪电战学说', days:70, requires:['armor_corps'], x:1, y:2, desc:'集中装甲集群突穿弱点，装甲矛头纵深穿插大范围包抄。', effects:[{ type:'modifier', scope:'unit:arm', stat:'atk', value:0.15 }, { type:'modifier', scope:'unit:arm', stat:'brk', value:0.20 }] },
    { id:'mot_supply', chain:'army', name:'摩托化纵队', days:70, requires:['blitzkrieg'], x:1, y:3, desc:'配发三吨卡车与轻型牵引车，摩托化步兵紧随战车巩固突破口。', effects:[{ type:'unlockTech', tech:'motorization' }] },
    { id:'kampfgruppe', chain:'army', name:'战斗群战术协同', days:70, requires:['mot_supply'], x:1, y:4, desc:'允许营连级根据前线战况灵活跨军种重组战斗群，提升前线主动权。', effects:[{ type:'modifier', scope:'nation', stat:'planningMax', value:0.10 }] },
    { id:'research_slot_okh', chain:'army', name:'最高统帅部研究院', days:70, requires:['kampfgruppe'], x:1, y:5, desc:'集中陆军顶尖科研工程师攻关战车火炮精密工艺。', effects:[{ type:'addResearchSlot', count:1 }] },
    { id:'inf_artillery_focus', chain:'army', name:'步炮战术大融合', days:70, requires:['research_slot_okh'], x:1, y:6, desc:'将重型伴随榴弹炮直接前置下放到师级，增强步兵攻坚硬实力。', effects:[{ type:'modifier', scope:'unit:inf', stat:'atk', value:0.10 }] },
    { id:'panzer_advanced', chain:'army', name:'重型战车研制预案', days:70, requires:['inf_artillery_focus'], x:1, y:7, desc:'研制重甲倾斜防护战车与大口径高初速火炮，压制敌方中坚装甲。', effects:[{ type:'unlockTech', tech:'medium_tank' }, { type:'addArmyXp', value:30 }] },

    // 2: 空军链 (8个)
    { id:'air_innovations', chain:'air', name:'航空兵重整', days:70, requires:[], x:2, y:0, desc:'建立帝国独立空军军种，制定全天候空中近距支援战术。', effects:[{ type:'addPP', value:100 }] },
    { id:'stuka_doctrine', chain:'air', name:'斯图卡俯冲轰炸学说', days:70, requires:['air_innovations'], x:2, y:1, desc:'利用精确俯冲轰炸点穴式摧毁敌军前线堡垒、桥梁与防空阵地。', effects:[{ type:'modifier', scope:'nation', stat:'atk', value:0.05 }] },
    { id:'bf109_superiority', chain:'air', name:'梅塞施密特空中优势', days:70, requires:['stuka_doctrine'], x:2, y:2, desc:'全金属单翼战斗机 Bf 109 形成绝对战术空优，扫清一切敌机干扰。', effects:[{ type:'modifier', scope:'nation', stat:'airSuperiority', value:0.15 }] },
    { id:'ju52_airlift', chain:'air', name:'容克战略空运力量', days:70, requires:['bf109_superiority'], x:2, y:3, desc:'建立 Ju 52 运输机大队，为深入敌后的装甲先锋空投油料弹药。', effects:[{ type:'modifier', scope:'nation', stat:'orgRecovery', value:0.10 }] },
    { id:'condor_legion', chain:'air', name:'秃鹰军团实战总结', days:70, requires:['ju52_airlift'], x:2, y:4, desc:'全面汲取格尔尼卡与埃布罗河战役经验，革新四指编队空战法。', effects:[{ type:'addArmyXp', value:25 }] },
    { id:'freya_radar', chain:'air', name:'弗雷亚地面预警雷达', days:70, requires:['condor_legion'], x:2, y:5, desc:'沿海岸线修筑大型超短波早期预警雷达网，捕捉来袭敌机编队。', effects:[{ type:'modifier', scope:'nation', stat:'def', value:0.05 }] },
    { id:'night_interceptors', chain:'air', name:'帝国夜间截击中队', days:70, requires:['freya_radar'], x:2, y:6, desc:'双发重型战机加装机载雷达与倾斜机炮，守卫本土鲁尔夜空。', effects:[{ type:'modifier', scope:'nation', stat:'def', value:0.05 }] },
    { id:'jet_propulsion', chain:'air', name:'喷气动力前沿实验', days:70, requires:['night_interceptors'], x:2, y:7, desc:'佩讷明德与亨克尔实验室涡轮喷气发动机突破音障试飞。', effects:[{ type:'addResearchSlot', count:1 }] },

    // 3: 海军链 (8个)
    { id:'naval_rearmament', chain:'navy', name:'重建帝国海军', days:70, requires:[], x:3, y:0, desc:'撕毁凡尔赛造舰吨位桎梏，重组公海舰队与基尔港要塞。', effects:[{ type:'addPP', value:100 }] },
    { id:'wolfpack_doctrine', chain:'navy', name:'邓尼茨狼群学说', days:70, requires:['naval_rearmament'], x:3, y:1, desc:'数十艘 U 艇分散搜索、无线电集中引路、夜间水面围猎商船队。', effects:[{ type:'modifier', scope:'nation', stat:'subAttack', value:0.20 }] },
    { id:'commerce_raiding', chain:'navy', name:'大洋通商破坏战', days:70, requires:['wolfpack_doctrine'], x:3, y:2, desc:'动用袖珍战列舰突入南大西洋与印度洋，掐断盟国航运生命线。', effects:[{ type:'modifier', scope:'nation', stat:'convoyRaid', value:0.15 }] },
    { id:'plan_z', chain:'navy', name:'Z 计划主力舰工程', days:70, requires:['commerce_raiding'], x:3, y:3, desc:'开工建造俾斯麦级战列舰与大型重巡洋舰，挑战皇家海军霸权。', effects:[{ type:'addFactory', kind:'mil', count:2 }] },
    { id:'sub_bases', chain:'navy', name:'大西洋潜艇要塞群', days:70, requires:['plan_z'], x:3, y:4, desc:'在比斯开湾修筑厚逾数米的混凝土防弹潜艇洞库掩体。', effects:[{ type:'modifier', scope:'nation', stat:'subDefense', value:0.25 }] },
    { id:'advanced_torpedoes', chain:'navy', name:'声自导与磁性水雷', days:70, requires:['sub_bases'], x:3, y:5, desc:'排除初期撞针故障，实装锁定敌舰螺旋桨噪音的音响鱼雷。', effects:[{ type:'modifier', scope:'nation', stat:'subAttack', value:0.15 }] },
    { id:'cruiser_support', chain:'navy', name:'重巡巡弋支队', days:70, requires:['advanced_torpedoes'], x:3, y:6, desc:'高速大型巡洋舰前出冰岛海峡，牵制北极航线护航主力。', effects:[{ type:'modifier', scope:'nation', stat:'atk', value:0.05 }] },
    { id:'unrestricted_sub', chain:'navy', name:'全面无限制潜艇战', days:70, requires:['cruiser_support'], x:3, y:7, desc:'划定全欧交战封锁海域，对任何驶向不列颠的船只格杀勿论。', effects:[{ type:'modifier', scope:'nation', stat:'convoyRaid', value:0.25 }] },

    // 4: 战略与外交链 (10个)
    { id:'rhineland', chain:'politics', name:'重进莱茵兰', days:70, requires:[], x:4, y:0, desc:'撕毁凡尔赛枷锁进军非军事区，重振国防军威望。', effects:[{ type:'addPP', value:150 }] },
    { id:'anti_comintern', chain:'politics', name:'反共产国际协定', days:70, requires:['rhineland'], x:4, y:1, desc:'与罗马和东京确立轴心框架，阻遏共产主义意识形态渗透。', effects:[{ type:'addPP', value:100 }] },
    { id:'anschluss', chain:'politics', name:'德奥合并', days:70, requires:['anti_comintern'], x:4, y:2, desc:'大德意志版图整合，接管奥地利军工厂与外汇黄金储备。', effects:[{ type:'addFactory', kind:'civ', count:2 }, { type:'addPP', value:100 }] },
    { id:'munich_agreement', chain:'politics', name:'慕尼黑协定', days:70, requires:['anschluss'], x:4, y:3, desc:'利用英法绥靖政策索取苏台德要塞区，拆解捷克防线。', effects:[{ type:'addPP', value:120 }] },
    { id:'czechoslovakia', chain:'politics', name:'波希米亚与摩拉维亚保护国', days:70, requires:['munich_agreement'], x:4, y:4, desc:'彻底肢解捷克斯洛伐克，吞并斯柯达巨型兵工厂。', effects:[{ type:'addFactory', kind:'mil', count:3 }, { type:'addPP', value:80 }] },
    { id:'reassert_eastern', chain:'politics', name:'重申东方领土索求', days:70, requires:['czechoslovakia'], x:4, y:5, desc:'正式要求收回但泽自由市主权与贯穿波兰走廊的铁路通行权。', effects:[{ type:'addPP', value:100 }] },
    { id:'danzig', chain:'politics', name:'但泽或战争', days:70, requires:['reassert_eastern'], x:4, y:6, desc:'向华沙发出最后通牒，打通东普鲁士走廊。', effects:[{ type:'declareWar', target:'P' }, { type:'event', eventId:'danzig_or_war' }] },
    { id:'molotov_ribbentrop', chain:'politics', name:'莫洛托夫-里宾特洛甫条约', days:70, requires:['danzig'], x:4, y:7, desc:'同莫斯科签署互不侵犯条约与秘密附属议定书，瓜分东欧势力范围。', effects:[{ type:'addPP', value:150 }] },
    { id:'around_maginot', chain:'politics', name:'绕过马奇诺防线', days:70, requires:['molotov_ribbentrop'], x:4, y:8, desc:'贯彻曼施坦因方案，挥师阿登峡谷，截断英法主力退路。', effects:[{ type:'declareWar', target:'F' }] },
    { id:'operation_weser', chain:'politics', name:'威瑟堡行动', days:70, requires:['around_maginot'], x:4, y:9, desc:'海空联合突击丹麦与挪威，确保纳尔维克冬季铁矿石生命线。', effects:[{ type:'addFactory', kind:'civ', count:2 }, { type:'addPP', value:100 }] }
  ],


  // —— 波兰 ——
  P: [
    // 工业链
    { id:'industry_P', chain:'industry', name:'中央工业区(COP)', days:70, requires:[],
      x:0, y:0, desc:'在维斯瓦河与萨恩河三角洲建立内陆安全工业基地。',
      effects:[{ type:'addFactory', kind:'civ', count:2 }] },
    { id:'arms_P', chain:'industry', name:'华沙国有兵工厂', days:70, requires:['industry_P'],
      x:0, y:1, desc:'自研 7TP 战车与波兰造步枪。',
      effects:[{ type:'addFactory', kind:'mil', count:2 }] },
    { id:'heavy_ind_p', chain:'industry', name:'工业疏散法令', days:70, requires:['arms_P'],
      x:0, y:2, desc:'将重型机床后撤至东部省份。',
      effects:[{ type:'addFactory', kind:'mil', count:1 }, { type:'addPP', value:80 }] },

    // 军事链
    { id:'army_modernization', chain:'army', name:'军队现代化', days:70, requires:[],
      x:1, y:0, desc:'吸取波苏战争经验，整合步兵师防守战术。',
      effects:[{ type:'modifier', scope:'unit:inf', stat:'def', value:0.10 }] },
    { id:'fortification', chain:'army', name:'边境要塞化', days:70, requires:['army_modernization'],
      x:1, y:1, desc:'在但泽走廊与边界构筑混凝土碉堡网。',
      effects:[{ type:'addBuilding', building:'fort', level:1, at:'border' }] },
    { id:'entrench', chain:'army', name:'维斯瓦河防线', days:70, requires:['fortification'],
      x:1, y:2, desc:'依托天然河流构筑最后决战纵深。',
      effects:[{ type:'modifier', scope:'nation', stat:'entrenchMax', value:5 }] },
    { id:'cav_brigades', chain:'army', name:'独立骑兵旅突击', days:70, requires:['entrench'],
      x:1, y:3, desc:'利用轻骑兵机动性穿插敌军后方补给。',
      effects:[{ type:'modifier', scope:'unit:cav', stat:'atk', value:0.15 }] },

    // 政治链
    { id:'guarantee', chain:'politics', name:'寻求英法安全保障', days:70, requires:[],
      x:2, y:0, desc:'签订双边互助条约，威慑侵略者。',
      effects:[{ type:'addPP', value:120 }] },
    { id:'mobilize', chain:'politics', name:'全国战备动员', days:70, requires:['guarantee'],
      x:2, y:1, desc:'征召预备役官兵，进入总动员状态。',
      effects:[{ type:'setLaw', law:'total' }] },
    { id:'romania_bridgehead', chain:'politics', name:'罗马尼亚桥头堡计划', days:70, requires:['mobilize'],
      x:2, y:2, desc:'留存通往南方的生命走廊，等待盟军补给。',
      effects:[{ type:'addPP', value:100 }, { type:'modifier', scope:'unit:inf', stat:'org', value:0.05 }] }
  ],

  // —— 法国 ——
  F: [
    // 工业链
    { id:'electrification', chain:'industry', name:'工业电气化', days:70, requires:[],
      x:0, y:0, desc:'现代化电网覆盖洛林与北部工业带。',
      effects:[{ type:'addFactory', kind:'civ', count:2 }] },
    { id:'industry_F', chain:'industry', name:'国有化兵工厂', days:70, requires:['electrification'],
      x:0, y:1, desc:'将施耐德等军火巨头纳入战时委员会统筹。',
      effects:[{ type:'addFactory', kind:'mil', count:2 }] },
    { id:'tank_production_f', chain:'industry', name:'索玛S35生产线', days:70, requires:['industry_F'],
      x:0, y:2, desc:'大规模生产优秀的索玛中型坦克。',
      effects:[{ type:'addFactory', kind:'mil', count:2 }] },

    // 军事链
    { id:'maginot', chain:'army', name:'延伸马奇诺防线', days:70, requires:[],
      x:1, y:0, desc:'沿德法边境修筑钢铁防线，令任何正攻成为绝望。',
      effects:[{ type:'addBuilding', building:'fort', level:2, at:'border' }] },
    { id:'army_reform', chain:'army', name:'有条不紊战术', days:70, requires:['maginot'],
      x:1, y:1, desc:'注重重炮火力支援与掩护步兵推进。',
      effects:[{ type:'modifier', scope:'unit:inf', stat:'def', value:0.12 },
               { type:'modifier', scope:'unit:inf', stat:'org', value:0.05 }] },
    { id:'degaulle_mech', chain:'army', name:'机械化装甲军构想', days:70, requires:['army_reform'],
      x:1, y:2, desc:'采纳戴高乐上校的机动作战建议，组建独立装甲师。',
      effects:[{ type:'unlockTech', tech:'light_tank' },
               { type:'modifier', scope:'unit:arm', stat:'atk', value:0.10 }] },

    // 政治链
    { id:'alliance_F', chain:'politics', name:'巩固同盟条约', days:70, requires:[],
      x:2, y:0, desc:'强化英法最高战争委员会紧密协作。',
      effects:[{ type:'addPP', value:150 }] },
    { id:'war_readiness_f', chain:'politics', name:'战时内阁统领', days:70, requires:['alliance_F'],
      x:2, y:1, desc:'平息政争，一致对外。',
      effects:[{ type:'setLaw', law:'war' }] }
  ],

  // —— 苏联 ——
  S: [
    // 工业链
    { id:'five_year', chain:'industry', name:'第三个五年计划', days:70, requires:[],
      x:0, y:0, desc:'斯大林格勒拖拉机厂与马格尼托哥尔斯克钢铁厂全速运转。',
      effects:[{ type:'addFactory', kind:'civ', count:3 }] },
    { id:'ural_complex', chain:'industry', name:'乌拉尔重工基地', days:70, requires:['five_year'],
      x:0, y:1, desc:'在敌方轰炸机航程之外建设安全军工中心。',
      effects:[{ type:'addFactory', kind:'mil', count:3 }] },
    { id:'tractor_tank', chain:'industry', name:'拖拉机厂转产', days:70, requires:['ural_complex'],
      x:0, y:2, desc:'哈尔科夫机车厂转向批量生产 T-34 前身试验车。',
      effects:[{ type:'addFactory', kind:'mil', count:2 }, { type:'unlockTech', tech:'light_tank' }] },

    // 军事链
    { id:'deep_battle', chain:'army', name:'大纵深战役理论', days:70, requires:[],
      x:1, y:0, desc:'图哈切夫斯基留下的全纵深火力和机械化打击理论。',
      effects:[{ type:'modifier', scope:'unit:all', stat:'brk', value:0.10 }] },
    { id:'red_artillery', chain:'army', name:'战争之神——红军炮兵', days:70, requires:['deep_battle'],
      x:1, y:1, desc:'组建密集炮兵突破师，粉碎任何坚固筑垒。',
      effects:[{ type:'modifier', scope:'unit:inf', stat:'atk', value:0.15 }] },
    { id:'soviet_mass', chain:'army', name:'红色近卫军重编', days:70, requires:['red_artillery'],
      x:1, y:2, desc:'源源不断的后备兵源源源补充前线。',
      effects:[{ type:'modifier', scope:'unit:inf', stat:'hp', value:0.10 }] },

    // 政治链
    { id:'purge', chain:'politics', name:'内务部整肃防谍', days:70, requires:[],
      x:2, y:0, desc:'清除军队异己分子，确保指挥链绝对忠诚。',
      effects:[{ type:'addPP', value:180 }] },
    { id:'east_poland', chain:'politics', name:'进军西白俄罗斯与西乌克兰', days:70, requires:['purge'],
      x:2, y:1, desc:'根据密约，波兰溃败之际收回东部领土。',
      effects:[{ type:'addPP', value:100 }] }
  ],

  // —— 英国 ——
  B: [
    // 工业链
    { id:'shadow_factories', chain:'industry', name:'影子工厂计划', days:70, requires:[],
      x:0, y:0, desc:'汽车厂转产航空发动机与反坦克炮。',
      effects:[{ type:'addFactory', kind:'civ', count:2 }] },
    { id:'arms_uk', chain:'industry', name:'战时生产部法案', days:70, requires:['shadow_factories'],
      x:0, y:1, desc:'比弗布鲁克勋爵统筹军工生产，破除瓶颈。',
      effects:[{ type:'addFactory', kind:'mil', count:3 }] },
    { id:'merchant_navy', chain:'industry', name:'商船队与护航体系', days:70, requires:['arms_uk'],
      x:0, y:2, desc:'以驱逐舰与护航航母网守住大西洋生命线。',
      effects:[{ type:'modifier', scope:'nation', stat:'convoyRaid', value:-0.15 },
               { type:'addPP', value:100 }] },

    // 军事链
    { id:'bef_reform', chain:'army', name:'远征军现代化装备', days:70, requires:[],
      x:1, y:0, desc:'全摩托化远征步兵师，配备步兵坦克。',
      effects:[{ type:'modifier', scope:'unit:inf', stat:'def', value:0.10 }] },
    { id:'royal_tank', chain:'army', name:'皇家装甲兵团实验', days:70, requires:['bef_reform'],
      x:1, y:1, desc:'马蒂尔达与巡航坦克协同战术。',
      effects:[{ type:'modifier', scope:'unit:arm', stat:'def', value:0.15 }] },
    { id:'desert_army', chain:'army', name:'沙漠集团军机动战', days:70, requires:['royal_tank'],
      x:1, y:2, desc:'在昔兰尼加的无掩护侧翼上练出合成机动战法。',
      effects:[{ type:'modifier', scope:'nation', stat:'planningMax', value:0.10 },
               { type:'addArmyXp', value:25 }] },

    // 政治链
    { id:'empire_cohesion', chain:'politics', name:'帝国国防协作', days:70, requires:[],
      x:2, y:0, desc:'自治领与殖民地资源汇聚本土。',
      effects:[{ type:'addPP', value:150 }] },
    { id:'churchill_rally', chain:'politics', name:'至暗时刻演讲', days:70, requires:['empire_cohesion'],
      x:2, y:1, desc:'我们将在海滩作战，我们决不投降！',
      effects:[{ type:'setLaw', law:'total' }] },
    { id:'home_chain_radar', chain:'politics', name:'本土链雷达网', days:70, requires:['churchill_rally'],
      x:2, y:2, desc:'沿海岸线布设预警雷达，把拦截效率提到最高。',
      effects:[{ type:'modifier', scope:'nation', stat:'def', value:0.08 },
               { type:'addResearchSlot', count:1 }] }
  ],

  // —— 匈牙利 ——
  H: [
    // 工业链
    { id:'gyor_program', chain:'industry', name:'杰尔整备计划', days:70, requires:[],
      x:0, y:0, desc:'十亿彭戈现代工业重整法案。',
      effects:[{ type:'addFactory', kind:'mil', count:2 }] },
    { id:'bauxite_mining', chain:'industry', name:'铝土矿开发', days:70, requires:['gyor_program'],
      x:0, y:1, desc:'为轴心国阵营提供重要航空工业金属。',
      effects:[{ type:'addFactory', kind:'civ', count:1 }] },
    { id:'danube_refinery', chain:'industry', name:'多瑙河炼油与航运', days:70, requires:['bauxite_mining'],
      x:0, y:2, desc:'把罗马尼亚原油经多瑙河水道接入本国炼厂。',
      effects:[{ type:'addPP', value:100 }, { type:'addFactory', kind:'civ', count:1 }] },

    // 军事链
    { id:'secret_rearm', chain:'army', name:'布莱德协定扩军', days:70, requires:[],
      x:1, y:0, desc:'打破特里亚农条约军备限制，公开恢复征兵。',
      effects:[{ type:'modifier', scope:'unit:inf', stat:'atk', value:0.10 }] },
    { id:'honved_corps', chain:'army', name:'皇家霍恩维德步兵师', days:70, requires:['secret_rearm'],
      x:1, y:1, desc:'继承奥匈传统的高山与平原步兵。',
      effects:[{ type:'modifier', scope:'unit:inf', stat:'org', value:0.05 }] },
    { id:'rapid_brigade', chain:'army', name:'快速旅与骑兵机械化', days:70, requires:['honved_corps'],
      x:1, y:2, desc:'把骑兵旅改装成轻型装甲侦察群，跟上德军推进节奏。',
      effects:[{ type:'modifier', scope:'unit:cav', stat:'atk', value:0.15 },
               { type:'unlockTech', tech:'motorization' }] },

    // 政治链
    { id:'revisionism', chain:'politics', name:'领土声索运动', days:70, requires:[],
      x:2, y:0, desc:'霍尔蒂摄政王誓言收复被割让的失地。',
      effects:[{ type:'addPP', value:120 }] },
    { id:'axis_lean', chain:'politics', name:'签署反共产国际协定', days:70, requires:['revisionism'],
      x:2, y:1, desc:'紧密靠拢柏林与罗马，寻求大国庇护。',
      effects:[{ type:'addPP', value:100 }] },
    { id:'vienna_award', chain:'politics', name:'维也纳裁决与北特兰西瓦尼亚', days:70, requires:['axis_lean'],
      x:2, y:2, desc:'借轴心国仲裁收回喀尔巴阡山以东的匈牙利语区。',
      effects:[{ type:'addFactory', kind:'civ', count:2 },
               { type:'modifier', scope:'nation', stat:'stability', value:10 }] }
  ],

  N: []
};

// 3-letter country tag aliases
FOCUSES.GER = FOCUSES.G;
FOCUSES.SOV = FOCUSES.S;
FOCUSES.GBR = FOCUSES.B;
FOCUSES.FRA = FOCUSES.F;
FOCUSES.POL = FOCUSES.P;
FOCUSES.HUN = FOCUSES.H;
