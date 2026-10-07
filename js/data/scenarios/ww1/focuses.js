/* ============================================================
   data/scenarios/ww1/focuses.js —— 一战全量国策树（T1各24节点，T2各8-12节点）
   ============================================================ */

export const WW1_FOCUSES = {
  // ==================== 德意志帝国 (GER) 24 节点 ====================
  GER: [
    // 工业链 (8)
    { id:'krupp_works', chain:'industry', name:'克虏伯重工动员', days:70, requires:[], x:0, y:0, desc:'埃森军工厂加速制造大贝尔莎重型榴弹炮。', effects:[{ type:'addFactory', kind:'mil', count:2 }] },
    { id:'synthetic_nitrate', chain:'industry', name:'哈伯-博施制氮法', days:70, requires:['krupp_works'], x:0, y:1, desc:'攻克化肥与炸药合成工艺，打破智利硝石封锁。', effects:[{ type:'addPP', value:100 }, { type:'addFactory', kind:'mil', count:2 }] },
    { id:'steel_consolidation', chain:'industry', name:'莱茵兰钢铁统合', days:70, requires:['synthetic_nitrate'], x:0, y:2, desc:'将全国生铁与焦煤产能优先倾斜至军械生产。', effects:[{ type:'addFactory', kind:'civ', count:2 }] },
    { id:'ersatz_materials', chain:'industry', name:'战时代用材料开发', days:70, requires:['steel_consolidation'], x:0, y:3, desc:'开发人造织物、合成橡胶与纸质绷带。', effects:[{ type:'modifier', scope:'nation', stat:'milOutput', value:0.1 }] },
    { id:'hindenburg_program', chain:'industry', name:'兴登堡计划', days:70, requires:['ersatz_materials'], x:0, y:4, desc:'全面战时劳役动员，弹药与重武器产量翻倍。', effects:[{ type:'addFactory', kind:'mil', count:3 }, { type:'setLaw', law:'total' }] },
    { id:'railway_logistics_ww1', chain:'industry', name:'帝国军用铁道总署', days:70, requires:['hindenburg_program'], x:0, y:5, desc:'优化东西双线军列调度，实现跨战区兵力迅速转运。', effects:[{ type:'modifier', scope:'unit:all', stat:'speed', value:0.2 }] },
    { id:'aerospace_gotha', chain:'industry', name:'哥达重型轰炸机厂', days:70, requires:['railway_logistics_ww1'], x:0, y:6, desc:'建立远程战略空袭力量。', effects:[{ type:'addFactory', kind:'mil', count:2 }] },
    { id:'total_blockade_defiance', chain:'industry', name:'自给自足闭环经济', days:70, requires:['aerospace_gotha'], x:0, y:7, desc:'粉碎英国海上经济封锁的最后手段。', effects:[{ type:'addPP', value:200 }, { type:'addResearchSlot', count:1 }] },

    // 军事链 (8)
    { id:'schlieffen_plan', chain:'army', name:'施里芬计划展开', days:70, requires:[], x:1, y:0, desc:'右翼强有力的大回旋，穿越比利时直扑巴黎后背。', effects:[{ type:'modifier', scope:'unit:all', stat:'planning', value:0.25 }] },
    { id:'heavy_siege_guns', chain:'army', name:'超重型围城巨炮', days:70, requires:['schlieffen_plan'], x:1, y:1, desc:'以420毫米重炮轰塌列日与那慕尔的坚固装甲炮塔。', effects:[{ type:'modifier', scope:'unit:inf', stat:'atk', value:0.15 }] },
    { id:'trench_doctrine', chain:'army', name:'纵深壕沟防御战术', days:70, requires:['heavy_siege_guns'], x:1, y:2, desc:'构筑前后三道多阶壕沟网与铁丝网屏障。', effects:[{ type:'modifier', scope:'nation', stat:'entrenchMax', value:10 }] },
    { id:'chlorine_gas', chain:'army', name:'毒气突袭实验', days:70, requires:['trench_doctrine'], x:1, y:3, desc:'在伊普尔释放氯气瓶，令敌军阵线陷入窒息与恐慌。', effects:[{ type:'modifier', scope:'unit:all', stat:'atk', value:0.15 }] },
    { id:'stormtroopers', chain:'army', name:'暴风突击队(Stosstruppen)', days:70, requires:['chlorine_gas'], x:1, y:4, desc:'挑选精锐小分队携带冲锋枪、手榴弹与火焰喷射器渗透突破。', effects:[{ type:'modifier', scope:'unit:inf', stat:'brk', value:0.25 }, { type:'modifier', scope:'unit:inf', stat:'atk', value:0.10 }] },
    { id:'albatross_fighters', chain:'army', name:'信天翁与空中骑士', days:70, requires:['stormtroopers'], x:1, y:5, desc:'争夺前线天空，压制协约国侦察气球。', effects:[{ type:'modifier', scope:'nation', stat:'air', value:0.2 }] },
    { id:'elastic_defense', chain:'army', name:'弹性防御体系', days:70, requires:['albatross_fighters'], x:1, y:6, desc:'前沿少留部队，依托后方筑垒区发起果断逆袭。', effects:[{ type:'modifier', scope:'unit:inf', stat:'def', value:0.15 }] },
    { id:'kaiser_battle', chain:'army', name:'皇帝会战决死攻势', days:70, requires:['elastic_defense'], x:1, y:7, desc:'倾尽东线全部老兵在西线发动终极决战。', effects:[{ type:'modifier', scope:'unit:all', stat:'atk', value:0.20 }, { type:'modifier', scope:'unit:all', stat:'org', value:0.10 }] },

    // 政治/外交链 (8)
    { id:'kaiser_speech', chain:'politics', name:'城堡和平(Burgfriedenspolitik)', days:70, requires:[], x:2, y:0, desc:'德皇宣布不再分党派，全帝国团结如一人。', effects:[{ type:'addPP', value:150 }] },
    { id:'secure_austria', chain:'politics', name:'空白支票承诺', days:70, requires:['kaiser_speech'], x:2, y:1, desc:'向奥匈盟友承诺德国的无条件全方位支持。', effects:[{ type:'modifier', scope:'nation', stat:'stability', value:10 }] },
    { id:'balkan_diplomacy', chain:'politics', name:'拉拢奥斯曼与保加利亚', days:70, requires:['secure_austria'], x:2, y:2, desc:'打通柏林到巴格达的铁路线，包围俄罗斯南方。', effects:[{ type:'addPP', value:100 }] },
    { id:'anti_entente_propaganda', chain:'politics', name:'神圣战争号召', days:70, requires:['balkan_diplomacy'], x:2, y:3, desc:'指斥协约国的围堵阴谋，激发全民同仇敌忾。', effects:[{ type:'addPP', value:120 }] },
    { id:'unrestricted_sub', chain:'politics', name:'无限制潜艇战决议', days:70, requires:['anti_entente_propaganda'], x:2, y:4, desc:'猎杀任何驶向英国海域的商船，试图饥饿伦敦。', effects:[{ type:'modifier', scope:'nation', stat:'threat', value:25 }] },
    { id:'brest_litovsk_terms', chain:'politics', name:'东方胜利远景', days:70, requires:['unrestricted_sub'], x:2, y:5, desc:'击垮俄国意志，迫其签署割让西线领土的和平协议。', effects:[{ type:'addFactory', kind:'civ', count:4 }] },
    { id:'mitteleuropa', chain:'politics', name:'中欧帝国联盟体系', days:70, requires:['brest_litovsk_terms'], x:2, y:6, desc:'建立德意志主导的泛欧关税同盟与卫星国网络。', effects:[{ type:'addPP', value:250 }] },
    { id:'world_hegemony_ww1', chain:'politics', name:'太阳下的地盘', days:70, requires:['mitteleuropa'], x:2, y:7, desc:'彻底取代大英帝国成为世界第一强权。', effects:[{ type:'addPP', value:300 }] }
  ],

  // ==================== 法兰西第三共和国 (FRA) 24 节点 ====================
  FRA: [
    // 工业链 (8)
    { id:'creusot_artillery', chain:'industry', name:'施耐德-克鲁索重炮扩产', days:70, requires:[], x:0, y:0, desc:'加急制造著名的M1897式75毫米野战速射炮。', effects:[{ type:'addFactory', kind:'mil', count:2 }] },
    { id:'paris_defense_works', chain:'industry', name:'巴黎外围筑垒化', days:70, requires:['creusot_artillery'], x:0, y:1, desc:'构筑环绕首都的堑壕防御带与防空火力阵地。', effects:[{ type:'addFactory', kind:'civ', count:2 }] },
    { id:'women_in_factories', chain:'industry', name:'女工进驻弹药厂', days:70, requires:['paris_defense_works'], x:0, y:2, desc:'动员全国妇女走上生产线，填补男性参军后的劳力空白。', effects:[{ type:'addFactory', kind:'mil', count:2 }] },
    { id:'tank_ft17', chain:'industry', name:'雷诺FT-17轻型坦克', days:70, requires:['women_in_factories'], x:0, y:3, desc:'首创旋转炮塔设计的现代化步兵伴随坦克。', effects:[{ type:'unlockTech', tech:'light_tank' }] },
    { id:'saint_chamond', chain:'industry', name:'重型突破突击炮', days:70, requires:['tank_ft17'], x:0, y:4, desc:'研制突破德军堑壕的履带式钢铁巨兽。', effects:[{ type:'addFactory', kind:'mil', count:2 }] },
    { id:'us_credit_flow', chain:'industry', name:'摩根财团战时信贷', days:70, requires:['saint_chamond'], x:0, y:5, desc:'引入北美无限美元资本购买战略物资。', effects:[{ type:'addPP', value:150 }] },
    { id:'colonial_raw_materials', chain:'industry', name:'法属西非与印度支那资源输入', days:70, requires:['us_credit_flow'], x:0, y:6, desc:'从广袤殖民地运回橡胶、铝土与粮食。', effects:[{ type:'addFactory', kind:'civ', count:3 }] },
    { id:'industrial_triumph_fra', chain:'industry', name:'胜利的兵工厂', days:70, requires:['colonial_raw_materials'], x:0, y:7, desc:'法国军工产能在战争末期跃居协约国之冠。', effects:[{ type:'addResearchSlot', count:1 }] },

    // 军事链 (8)
    { id:'plan_xvii', chain:'army', name:'第十七号作战计划', days:70, requires:[], x:1, y:0, desc:'倡导"进攻精神(Élan Vital)"，向阿尔萨斯-洛林全力进攻。', effects:[{ type:'modifier', scope:'unit:all', stat:'atk', value:0.10 }] },
    { id:'seventy_five_rapid', chain:'army', name:'75速射炮弹幕战术', days:70, requires:['plan_xvii'], x:1, y:1, desc:'密集破片弹雨横扫一切开阔地上的敌军步兵。', effects:[{ type:'modifier', scope:'unit:inf', stat:'atk', value:0.15 }] },
    { id:'taxi_mobilize', chain:'army', name:'马恩河出租车紧急动员', days:70, requires:['seventy_five_rapid'], x:1, y:2, desc:'征集巴黎全部出租车彻夜将生力军送上前线堵住缺口。', effects:[{ type:'modifier', scope:'unit:all', stat:'org', value:0.15 }] },
    { id:'they_shall_not_pass', chain:'army', name:'凡尔登誓言：他们绝不能通过', days:70, requires:['taxi_mobilize'], x:1, y:3, desc:'建立巴勒迪克到凡尔登的圣路补给线，轮换全军坚守。', effects:[{ type:'modifier', scope:'unit:inf', stat:'def', value:0.25 }, { type:'modifier', scope:'nation', stat:'entrenchMax', value:10 }] },
    { id:'air_spad', chain:'army', name:'斯帕德战斗机大队', days:70, requires:['they_shall_not_pass'], x:1, y:4, desc:'吉讷梅与方克等法国王牌飞行员主宰前线天空。', effects:[{ type:'modifier', scope:'nation', stat:'air', value:0.2 }] },
    { id:'creeping_barrage', chain:'army', name:'徐进弹幕射击法', days:70, requires:['air_spad'], x:1, y:5, desc:'步兵严格紧随弹坑推进，火炮在前方百米处同步推进。', effects:[{ type:'modifier', scope:'unit:inf', stat:'brk', value:0.20 }] },
    { id:'combined_arms_ww1', chain:'army', name:'步坦炮步空一体战', days:70, requires:['creeping_barrage'], x:1, y:6, desc:'协同雷诺坦克集群突破德军兴登堡防线。', effects:[{ type:'modifier', scope:'unit:all', stat:'atk', value:0.15 }] },
    { id:'foch_general_offensive', chain:'army', name:'福煦元帅百日总反攻', days:70, requires:['combined_arms_ww1'], x:1, y:7, desc:'协约国联军全线出击，粉碎德意志最后抵抗意志。', effects:[{ type:'modifier', scope:'unit:all', stat:'atk', value:0.20 }] },

    // 政治链 (8)
    { id:'sacred_union', chain:'politics', name:'神圣联盟统合', days:70, requires:[], x:2, y:0, desc:'左翼社会党与天主教保守党放下分歧共赴国难。', effects:[{ type:'addPP', value:150 }] },
    { id:'revanche_spirit', chain:'politics', name:'复仇主义热潮', days:70, requires:['sacred_union'], x:2, y:1, desc:'洗雪1870年色当之辱，誓死收复阿尔萨斯与洛林！', effects:[{ type:'modifier', scope:'nation', stat:'warSupport', value:15 }] },
    { id:'balkan_aid', chain:'politics', name:'援助塞尔维亚与萨洛尼卡', days:70, requires:['revanche_spirit'], x:2, y:2, desc:'在巴尔干开辟第二战场，牵制同盟国南翼。', effects:[{ type:'addPP', value:100 }] },
    { id:'entente_war_council', chain:'politics', name:'协约国最高战争委员会', days:70, requires:['balkan_aid'], x:2, y:3, desc:'与大英帝国建立联合统帅部与统一后勤分配。', effects:[{ type:'addPP', value:120 }] },
    { id:'quell_mutinies', chain:'politics', name:'贝当安抚兵变', days:70, requires:['entente_war_council'], x:2, y:4, desc:'改善伙食与轮休待遇，制止前线大规模骚乱。', effects:[{ type:'modifier', scope:'nation', stat:'stability', value:15 }] },
    { id:'tiger_leadership', chain:'politics', name:'克列孟梭铁血内阁', days:70, requires:['quell_mutinies'], x:2, y:5, desc:'"我的外交政策：打仗！我的内政方针：打仗！"', effects:[{ type:'setLaw', law:'total' }] },
    { id:'alsace_liberation', chain:'politics', name:'阿尔萨斯-洛林回归', days:70, requires:['tiger_leadership'], x:2, y:6, desc:'半个世纪的失地重新升起三色旗。', effects:[{ type:'addPP', value:200 }] },
    { id:'versailles_order', chain:'politics', name:'凡尔赛主导秩序', days:70, requires:['alsace_liberation'], x:2, y:7, desc:'肢解同盟国殖民地与舰队，确立欧洲新秩序。', effects:[{ type:'addPP', value:300 }] }
  ],

  // ==================== 俄罗斯帝国 (RUS) 24 节点 ====================
  RUS: [
    // 工业链 (8)
    { id:'petrograd_munition', chain:'industry', name:'普梯洛夫兵工厂动员', days:70, requires:[], x:0, y:0, desc:'彼得格勒工业区加班加点生产步枪与炮弹。', effects:[{ type:'addFactory', kind:'mil', count:2 }] },
    { id:'trans_siberian_upgrade', chain:'industry', name:'西伯利亚大铁路运力提升', days:70, requires:['petrograd_munition'], x:0, y:1, desc:'加急将远东驻军与海参崴物资调往东欧战场。', effects:[{ type:'modifier', scope:'unit:all', stat:'speed', value:0.15 }] },
    { id:'baku_oil_rail', chain:'industry', name:'巴库油田输油专线', days:70, requires:['trans_siberian_upgrade'], x:0, y:2, desc:'为铁路机车与战时工厂提供源源不断的重油能源。', effects:[{ type:'addFactory', kind:'civ', count:2 }] },
    { id:'donbass_coal_iron', chain:'industry', name:'顿巴斯煤铁联合体', days:70, requires:['baku_oil_rail'], x:0, y:3, desc:'开采顿巴斯黑金，铸造帝俄重型野战军火。', effects:[{ type:'addFactory', kind:'mil', count:2 }] },
    { id:'allied_munitions_convoy', chain:'industry', name:'摩尔曼斯克与阿尔汉格尔斯克航线', days:70, requires:['donbass_coal_iron'], x:0, y:4, desc:'接收英法两洋海运送来的高额军械援助。', effects:[{ type:'addFactory', kind:'mil', count:2 }] },
    { id:'central_war_industry', chain:'industry', name:'中央军事工业委员会', days:70, requires:['allied_munitions_convoy'], x:0, y:5, desc:'整合民间商会与重工业主参与战时总动员。', effects:[{ type:'addPP', value:100 }] },
    { id:'ural_iron_reserve', chain:'industry', name:'乌拉尔冶金扩张', days:70, requires:['central_war_industry'], x:0, y:6, desc:'深挖内陆资源底蕴。', effects:[{ type:'addFactory', kind:'civ', count:2 }] },
    { id:'imperial_arsenal_peak', chain:'industry', name:'千万子弹计划', days:70, requires:['ural_iron_reserve'], x:0, y:7, desc:'克服"炮弹饥荒"，保障前线无穷尽的火力供应。', effects:[{ type:'addResearchSlot', count:1 }] },

    // 军事链 (8)
    { id:'slavic_steamroller', chain:'army', name:'俄罗斯压路机启动', days:70, requires:[], x:1, y:0, desc:'凭借无穷尽的灰衣大军向东普鲁士和加里西亚两路进发。', effects:[{ type:'modifier', scope:'unit:inf', stat:'hp', value:0.15 }] },
    { id:'cossack_cavalry_corps', chain:'army', name:'哥萨克骑兵军团突击', days:70, requires:['slavic_steamroller'], x:1, y:1, desc:'发挥顿河与库班哥萨克卓越骑术，斩断敌后补给线。', effects:[{ type:'modifier', scope:'unit:cav', stat:'atk', value:0.20 }] },
    { id:'galicia_offensive', chain:'army', name:'加里西亚大会战', days:70, requires:['cossack_cavalry_corps'], x:1, y:2, desc:'重创奥匈帝国主力，围攻坚固的普热梅希尔要塞。', effects:[{ type:'modifier', scope:'unit:all', stat:'atk', value:0.10 }] },
    { id:'caucasus_mountain_war', chain:'army', name:'萨勒卡密什高加索大捷', days:70, requires:['galicia_offensive'], x:1, y:3, desc:'在严冬高加索群峰击溃奥斯曼第三军团。', effects:[{ type:'modifier', scope:'unit:inf', stat:'def', value:0.15 }] },
    { id:'brusilov_breakthrough', chain:'army', name:'布鲁西洛夫突穿战术', days:70, requires:['caucasus_mountain_war'], x:1, y:4, desc:'多突击群在全战线同时发起突击，令敌军预备队无法兼顾。', effects:[{ type:'modifier', scope:'unit:all', stat:'atk', value:0.25 }, { type:'modifier', scope:'unit:all', stat:'brk', value:0.20 }] },
    { id:'storm_shock_battalions', chain:'army', name:'冲锋营与死亡营组建', days:70, requires:['brusilov_breakthrough'], x:1, y:5, desc:'招募死士组成撕碎德军铁丝网的第一梯队。', effects:[{ type:'modifier', scope:'unit:inf', stat:'atk', value:0.10 }] },
    { id:'ilya_muromets_bomber', chain:'army', name:'西科尔斯基四发重轰炸机', days:70, requires:['storm_shock_battalions'], x:1, y:6, desc:'世界上第一款四引擎战略轰炸机巡航东欧。', effects:[{ type:'modifier', scope:'nation', stat:'air', value:0.2 }] },
    { id:'march_on_berlin_ww1', chain:'army', name:'进军西里西亚与柏林', days:70, requires:['ilya_muromets_bomber'], x:1, y:7, desc:'终结德奥同盟的大陆争霸梦想。', effects:[{ type:'modifier', scope:'unit:all', stat:'atk', value:0.20 }] },

    // 政治/革命链 (8) —— 关键机制：可走向保皇或苏联诞生！
    { id:'slavic_protector', chain:'politics', name:'全斯拉夫保护者宣言', days:70, requires:[], x:2, y:0, desc:'誓死捍卫塞尔维亚主权，迎击日耳曼同盟。', effects:[{ type:'addPP', value:120 }] },
    { id:'orthodox_cross_on_bosphorus', chain:'politics', name:'收复君士坦丁堡宿愿', days:70, requires:['slavic_protector'], x:2, y:1, desc:'数百年东正教夙愿，控制博斯普鲁斯海峡出海口。', effects:[{ type:'addPP', value:150 }] },
    { id:'tsar_takes_command', chain:'politics', name:'沙皇亲临最高统帅部', days:70, requires:['orthodox_cross_on_bosphorus'], x:2, y:2, desc:'尼古拉二世进驻莫吉廖夫，政治威信与战局彻底绑定。', effects:[{ type:'modifier', scope:'nation', stat:'warSupport', value:10 }, { type:'modifier', scope:'nation', stat:'stability', value:-10 }] },
    { id:'rasputin_influence', chain:'politics', name:'宫廷迷雾与政治危机', days:70, requires:['tsar_takes_command'], x:2, y:3, desc:'贵族阶层对战争指导产生巨大分歧与焦虑。', effects:[{ type:'modifier', scope:'nation', stat:'stability', value:-15 }] },
    { id:'bread_and_peace', chain:'politics', name:'面包与和平的呼声', days:70, requires:['rasputin_influence'], x:2, y:4, desc:'后方通胀与粮食短缺引发广泛工人罢工潮。', effects:[{ type:'event', eventId:'february_revolution' }] },
    { id:'provisional_government_ww1', chain:'politics', name:'克伦斯基临时政府掌权', days:70, requires:['bread_and_peace'], x:2, y:5, desc:'沙皇退位，共和国成立，宣布继续对德作战。', effects:[{ type:'setLaw', law:'partial' }] },
    { id:'lenin_sealed_train', chain:'politics', name:'列宁归国与四月提纲', days:70, requires:['provisional_government_ww1'], x:2, y:6, desc:'一切权力归苏维埃！全部土地归农民！立刻停战！', effects:[{ type:'event', eventId:'october_revolution' }] },
    { id:'decree_on_peace', chain:'politics', name:'苏维埃和平法令', days:70, requires:['lenin_sealed_train'], x:2, y:7, desc:'退出帝国主义大战，建立世界上第一个工农政权。', effects:[{ type:'addPP', value:300 }] }
  ],

  // ==================== 大英帝国 (GBR) 24 节点 ====================
  GBR: [
    // 工业链 (8)
    { id:'vickers_maxim', chain:'industry', name:'维克斯水冷重机枪量产', days:70, requires:[], x:0, y:0, desc:'步兵防御的核心支柱，喷吐致命弹幕。', effects:[{ type:'addFactory', kind:'mil', count:2 }] },
    { id:'munitions_of_war_act', chain:'industry', name:'军火法案动员', days:70, requires:['vickers_maxim'], x:0, y:1, desc:'由劳合·乔治统筹全国车间与私企转向战备。', effects:[{ type:'addFactory', kind:'mil', count:3 }] },
    { id:'woolwich_arsenal_expansion', chain:'industry', name:'伍尔维奇皇家兵工厂扩建', days:70, requires:['munitions_of_war_act'], x:0, y:2, desc:'大英帝国最庞大的国家炮弹工厂。', effects:[{ type:'addFactory', kind:'mil', count:2 }] },
    { id:'tank_landships', chain:'industry', name:'陆地巡洋舰委员会与水柜(Tank)', days:70, requires:['woolwich_arsenal_expansion'], x:0, y:3, desc:'秘密制造马克I型菱形坦克以碾碎堑壕铁丝网。', effects:[{ type:'unlockTech', tech:'light_tank' }] },
    { id:'merchant_navy_convoy', chain:'industry', name:'护航船队体制建立', days:70, requires:['tank_landships'], x:0, y:4, desc:'皇家海军驱逐舰护航商船，彻底瓦解德军潜艇封锁。', effects:[{ type:'addFactory', kind:'civ', count:3 }] },
    { id:'dominion_resources_flow', chain:'industry', name:'加拿大与澳大利亚矿业大输血', days:70, requires:['merchant_navy_convoy'], x:0, y:5, desc:'自治领全力支援母国战争。', effects:[{ type:'addFactory', kind:'civ', count:2 }] },
    { id:'mass_tank_production_ww1', chain:'industry', name:'马克IV型坦克大批量下线', days:70, requires:['dominion_resources_flow'], x:0, y:6, desc:'康布雷战役中数百辆坦克协同突击的物质基础。', effects:[{ type:'addFactory', kind:'mil', count:3 }] },
    { id:'britain_industrial_might', chain:'industry', name:'全球帝国工业全开', days:70, requires:['mass_tank_production_ww1'], x:0, y:7, desc:'用压倒性的钢铁与财富耗死同盟国。', effects:[{ type:'addResearchSlot', count:1 }] },

    // 军事链 (8)
    { id:'kitchener_army', chain:'army', name:'基钦纳新军大征兵', days:70, requires:[], x:1, y:0, desc:'"祖国需要你！"数百万人组成的志愿者新军开拔欧洲。', effects:[{ type:'modifier', scope:'unit:inf', stat:'hp', value:0.20 }] },
    { id:'bef_channel_shield', chain:'army', name:'远征军守护英吉利海峡', days:70, requires:['kitchener_army'], x:1, y:1, desc:'阻滞德军突向敦刻尔克与加来的企图。', effects:[{ type:'modifier', scope:'unit:inf', stat:'def', value:0.15 }] },
    { id:'blockade_germany', chain:'army', name:'北海饥饿远程封锁', days:70, requires:['bef_channel_shield'], x:1, y:2, desc:'大舰队封锁北海咽喉，截断德国全部粮食与原料输入。', effects:[{ type:'modifier', scope:'nation', stat:'threat', value:20 }] },
    { id:'gallipoli_enterprise', chain:'army', name:'达达尼尔海峡攻势', days:70, requires:['blockade_germany'], x:1, y:3, desc:'企图打通黑海海峡与俄军联络，迫降奥斯曼帝国。', effects:[{ type:'addPP', value:100 }] },
    { id:'somme_offensive', chain:'army', name:'索姆河大战炮兵狂轰', days:70, requires:['gallipoli_enterprise'], x:1, y:4, desc:'七天七夜百万发炮弹洗地，摧毁敌军堑壕工事。', effects:[{ type:'modifier', scope:'unit:inf', stat:'atk', value:0.15 }] },
    { id:'sopwith_camel', chain:'army', name:'索普威斯骆驼战斗机', days:70, requires:['somme_offensive'], x:1, y:5, desc:'皇家空军诞生，夺取西线制空权。', effects:[{ type:'modifier', scope:'nation', stat:'air', value:0.25 }] },
    { id:'cambrai_tank_shock', chain:'army', name:'康布雷坦克集中装甲突击', days:70, requires:['sopwith_camel'], x:1, y:6, desc:'不经漫长炮火准备，直接由坦克集群撕开防线。', effects:[{ type:'modifier', scope:'unit:arm', stat:'atk', value:0.20 }] },
    { id:'hundred_days_advance', chain:'army', name:'帝国军团百日突破进军', days:70, requires:['cambrai_tank_shock'], x:1, y:7, desc:'黑格指挥英联邦大军突入比利时，粉碎兴登堡防线。', effects:[{ type:'modifier', scope:'unit:all', stat:'atk', value:0.20 }] },

    // 政治链 (8)
    { id:'scrap_of_paper', chain:'politics', name:'捍卫比利时中立条约', days:70, requires:[], x:2, y:0, desc:'绝不容忍公理被视为"一纸废条"，对德宣战！', effects:[{ type:'addPP', value:150 }] },
    { id:'dominion_rally', chain:'politics', name:'大英帝国联合自治领集结', days:70, requires:['scrap_of_paper'], x:2, y:1, desc:'加拿大、澳新军团、印度军团跨海赴欧参战。', effects:[{ type:'modifier', scope:'nation', stat:'warSupport', value:15 }] },
    { id:'arab_revolt_lawrence', chain:'politics', name:'阿拉伯大起义与劳伦斯', days:70, requires:['dominion_rally'], x:2, y:2, desc:'策动汉志与叙利亚贝都因部族反抗奥斯曼苏丹。', effects:[{ type:'addPP', value:120 }] },
    { id:'balfour_declaration', chain:'politics', name:'贝尔福宣言与中东安排', days:70, requires:['arab_revolt_lawrence'], x:2, y:3, desc:'重塑奥斯曼瓦解后的中东势力版图。', effects:[{ type:'addPP', value:100 }] },
    { id:'draw_in_america', chain:'politics', name:'齐默尔曼电报拦截与美英亲善', days:70, requires:['balfour_declaration'], x:2, y:4, desc:'破译德国秘密电文移交华盛顿，催化美国参战。', effects:[{ type:'addPP', value:150 }] },
    { id:'war_cabinet_system', chain:'politics', name:'五人战时内阁统御', days:70, requires:['draw_in_america'], x:2, y:5, desc:'打破议会官僚扯皮，实现战时绝对中央集权。', effects:[{ type:'setLaw', law:'total' }] },
    { id:'rule_britannia_ww1', chain:'politics', name:'统治吧不列颠', days:70, requires:['war_cabinet_system'], x:2, y:6, desc:'公海舰队投降，皇家海军保持不可撼动的大洋霸权。', effects:[{ type:'addPP', value:250 }] },
    { id:'empire_at_its_zenith', chain:'politics', name:'日不落帝国极盛时代', days:70, requires:['rule_britannia_ww1'], x:2, y:7, desc:'领土面积达到人类历史巅峰。', effects:[{ type:'addPP', value:300 }] }
  ],

  // ==================== 奥匈帝国 (AUS) 24 节点 ====================
  AUS: [
    // 工业链 (8)
    { id:'skoda_heavy_guns', chain:'industry', name:'斯柯达比尔森军火库', days:70, requires:[], x:0, y:0, desc:'制造享誉欧陆的305毫米攻城重臼炮。', effects:[{ type:'addFactory', kind:'mil', count:2 }] },
    { id:'steyr_mannlicher', chain:'industry', name:'施泰尔曼利夏步枪生产', days:70, requires:['skoda_heavy_guns'], x:0, y:1, desc:'保障各军区步兵的标准轻武器供给。', effects:[{ type:'addFactory', kind:'mil', count:2 }] },
    { id:'danube_barge_trans', chain:'industry', name:'多瑙河战备航运网', days:70, requires:['steyr_mannlicher'], x:0, y:2, desc:'沟通奥地利工业带与匈牙利粮仓的生命线。', effects:[{ type:'addFactory', kind:'civ', count:2 }] },
    { id:'hungarian_granary', chain:'industry', name:'匈牙利平原战时统购', days:70, requires:['danube_barge_trans'], x:0, y:3, desc:'稳定维也纳与布达佩斯日益吃紧的面粉面包供应。', effects:[{ type:'modifier', scope:'nation', stat:'stability', value:10 }] },
    { id:'trieste_naval_yard', chain:'industry', name:'的里雅斯特造船厂', days:70, requires:['hungarian_granary'], x:0, y:4, desc:'为亚得里亚海舰队建造无畏舰与潜艇。', effects:[{ type:'addFactory', kind:'mil', count:2 }] },
    { id:'bohemian_precision_mach', chain:'industry', name:'波希米亚精密机械动员', days:70, requires:['trieste_naval_yard'], x:0, y:5, desc:'发挥捷克熟练技工优势加速雷达与光学瞄准研制。', effects:[{ type:'addFactory', kind:'civ', count:2 }] },
    { id:'war_loan_subscriptions', chain:'industry', name:'帝国战时公债发行', days:70, requires:['bohemian_precision_mach'], x:0, y:6, desc:'向帝国各民族臣民筹集真金白银。', effects:[{ type:'addPP', value:120 }] },
    { id:'double_eagle_arsenal', chain:'industry', name:'双头鹰帝国兵工联合', days:70, requires:['war_loan_subscriptions'], x:0, y:7, desc:'奠定双元帝国长期对抗外敌的基础。', effects:[{ type:'addResearchSlot', count:1 }] },

    // 军事链 (8)
    { id:'punish_serbia', chain:'army', name:'惩戒塞尔维亚决议', days:70, requires:[], x:1, y:0, desc:'越过萨瓦河与多瑙河发动惩罚性军事行动。', effects:[{ type:'modifier', scope:'unit:all', stat:'atk', value:0.10 }] },
    { id:'carpathian_defense', chain:'army', name:'喀尔巴阡要塞群防御', days:70, requires:['punish_serbia'], x:1, y:1, desc:'依托高山严冬构筑阻止沙俄骑兵渗入匈牙利的血肉长城。', effects:[{ type:'modifier', scope:'unit:inf', stat:'def', value:0.20 }, { type:'modifier', scope:'nation', stat:'entrenchMax', value:10 }] },
    { id:'isonzo_defense', chain:'army', name:'伊松佐河高山阵地战', days:70, requires:['carpathian_defense'], x:1, y:2, desc:'在喀斯特石灰岩绝壁上构筑碉堡击碎意大利步兵冲锋。', effects:[{ type:'modifier', scope:'unit:inf', stat:'def', value:0.25 }] },
    { id:'mountain_gebirgsjager', chain:'army', name:'高山猎兵(Gebirgsjäger)特训', days:70, requires:['isonzo_defense'], x:1, y:3, desc:'滑雪山地部队在提洛尔阿尔卑斯绝峰展开特种作战。', effects:[{ type:'modifier', scope:'unit:mtn', stat:'atk', value:0.25 }] },
    { id:'tyrol_offensive', chain:'army', name:'特伦蒂诺惩罚攻势', days:70, requires:['mountain_gebirgsjager'], x:1, y:4, desc:'从阿尔卑斯群山俯冲突袭波河平原背部。', effects:[{ type:'modifier', scope:'unit:all', stat:'brk', value:0.15 }] },
    { id:'german_command_mesh', chain:'army', name:'德奥联合作战参谋部', days:70, requires:['tyrol_offensive'], x:1, y:5, desc:'接受德军将领战术指导，在戈尔利采撕碎俄军防线。', effects:[{ type:'modifier', scope:'unit:all', stat:'atk', value:0.15 }] },
    { id:'caporetto_triumph', chain:'army', name:'卡波雷托突破奇迹', days:70, requires:['german_command_mesh'], x:1, y:6, desc:'毒气渗透加突击队一举打崩意军，俘虏三十万敌众。', effects:[{ type:'modifier', scope:'unit:all', stat:'atk', value:0.25 }] },
    { id:'danube_dominance', chain:'army', name:'多瑙河双头鹰胜利进军', days:70, requires:['caporetto_triumph'], x:1, y:7, desc:'巩固中欧大帝国领土完整。', effects:[{ type:'modifier', scope:'unit:all', stat:'org', value:0.15 }] },

    // 政治链 (8)
    { id:'franz_ferdinand_martyr', chain:'politics', name:'萨拉热窝悲剧复仇', days:70, requires:[], x:2, y:0, desc:'皇储遇刺，双元君主国举国哀悼，发出最后通牒。', effects:[{ type:'addPP', value:150 }] },
    { id:'dual_monarchy_accord', chain:'politics', name:'奥地利-匈牙利协调法案', days:70, requires:['franz_ferdinand_martyr'], x:2, y:1, desc:'巩固德意志人与马扎尔人在帝国中的主导同盟。', effects:[{ type:'modifier', scope:'nation', stat:'stability', value:10 }] },
    { id:'croat_loyalist_corps', chain:'politics', name:'动员克罗地亚与波斯尼亚忠诚部队', days:70, requires:['dual_monarchy_accord'], x:2, y:2, desc:'许诺战后自治权以激发南斯拉夫臣民抗击塞尔维亚。', effects:[{ type:'addPP', value:100 }] },
    { id:'polish_legion_pilsudski', chain:'politics', name:'毕苏斯基波兰军团组建', days:70, requires:['croat_loyalist_corps'], x:2, y:3, desc:'鼓励波兰志愿兵抗击俄国，许诺战后复国。', effects:[{ type:'modifier', scope:'unit:inf', stat:'atk', value:0.10 }] },
    { id:'karl_peace_initiative', chain:'politics', name:'卡尔一世和平密探(西克斯图斯之信)', days:70, requires:['polish_legion_pilsudski'], x:2, y:4, desc:'新皇即位试图与英法秘密接触寻求体面和平。', effects:[{ type:'addPP', value:120 }] },
    { id:'united_states_of_greater_austria', chain:'politics', name:'大奥地利合众国联邦化构想', days:70, requires:['karl_peace_initiative'], x:2, y:5, desc:'打破双元二元制，将帝国重组为多民族联邦以求图存。', effects:[{ type:'modifier', scope:'nation', stat:'stability', value:20 }] },
    { id:'preserve_habsburg_legacy', chain:'politics', name:'哈布斯堡王朝存续神话', days:70, requires:['united_states_of_greater_austria'], x:2, y:6, desc:'熬过最漫长的寒冬，维系六百年古老帝国。', effects:[{ type:'addPP', value:200 }] },
    { id:'central_european_harmony', chain:'politics', name:'多瑙河联邦长治久安', days:70, requires:['preserve_habsburg_legacy'], x:2, y:7, desc:'证明多民族帝国依然能在现代化世界中立足。', effects:[{ type:'addPP', value:300 }] }
  ],

  // ==================== 奥斯曼帝国 (OTT) 24 节点 ====================
  OTT: [
    // 工业链 (8)
    { id:'tophane_arsenal', chain:'industry', name:'托普哈内帝国兵工厂整饬', days:70, requires:[], x:0, y:0, desc:'升级君士坦丁堡的步枪与子弹制造工坊。', effects:[{ type:'addFactory', kind:'mil', count:1 }] },
    { id:'hejaz_railway_defense', chain:'industry', name:'汉志铁路防卫加固', days:70, requires:['tophane_arsenal'], x:0, y:1, desc:'确保大马士革至麦地那的圣地铁路线畅通。', effects:[{ type:'addFactory', kind:'civ', count:2 }] },
    { id:'german_gold_loan', chain:'industry', name:'德意志帝国五百万黄金借款', days:70, requires:['hejaz_railway_defense'], x:0, y:2, desc:'柏林专列送来黄金支持奥斯曼帝国财政。', effects:[{ type:'addPP', value:150 }] },
    { id:'mesopotamia_oil_springs', chain:'industry', name:'美索不达米亚石油勘探', days:70, requires:['german_gold_loan'], x:0, y:3, desc:'保护摩苏尔与基尔库克的天然石油涌泉。', effects:[{ type:'addFactory', kind:'civ', count:2 }] },
    { id:'german_weapons_import', chain:'industry', name:'毛瑟枪与克虏伯大炮专列输入', days:70, requires:['mesopotamia_oil_springs'], x:0, y:4, desc:'随着保加利亚参战打通跨欧专列。', effects:[{ type:'addFactory', kind:'mil', count:2 }] },
    { id:'anatolia_craft_guilds', chain:'industry', name:'安纳托利亚手工作坊国家化', days:70, requires:['german_weapons_import'], x:0, y:5, desc:'动员小亚细亚民间手艺人生产被服与军毯。', effects:[{ type:'addFactory', kind:'civ', count:2 }] },
    { id:'black_sea_coaling', chain:'industry', name:'宗古尔达克煤矿高产', days:70, requires:['anatolia_craft_guilds'], x:0, y:6, desc:'为黑海舰队与伊斯坦布尔机车提供黑煤燃料。', effects:[{ type:'addFactory', kind:'mil', count:1 }] },
    { id:'sublime_porte_industry', chain:'industry', name:'大维齐尔战时经济总局', days:70, requires:['black_sea_coaling'], x:0, y:7, desc:'实现奥斯曼帝国的战时工业自主。', effects:[{ type:'addResearchSlot', count:1 }] },

    // 军事链 (8)
    { id:'goeben_breslau', chain:'army', name:'戈本号与布雷斯劳号战列巡洋舰接收', days:70, requires:[], x:1, y:0, desc:'挂起新月旗驶入黑海炮击俄国港口，正式引爆战火。', effects:[{ type:'modifier', scope:'nation', stat:'threat', value:20 }] },
    { id:'straits_forts', chain:'army', name:'达达尼尔海峡岸防雷区封锁', days:70, requires:['goeben_breslau'], x:1, y:1, desc:'铺设密集水雷网并部署克虏伯岸防火炮。', effects:[{ type:'modifier', scope:'unit:inf', stat:'def', value:0.25 }, { type:'modifier', scope:'nation', stat:'entrenchMax', value:10 }] },
    { id:'gallipoli_resistance', chain:'army', name:'加里波利寸土不让', days:70, requires:['straits_forts'], x:1, y:2, desc:'凯末尔中校高呼："我不命令你们进攻，我命令你们去死！"', effects:[{ type:'modifier', scope:'unit:inf', stat:'org', value:0.20 }, { type:'modifier', scope:'unit:inf', stat:'def', value:0.20 }] },
    { id:'siege_of_kut', chain:'army', name:'库特要塞围歼战', days:70, requires:['gallipoli_resistance'], x:1, y:3, desc:'在美索不达米亚合围汤森德将军所率整支英印师团。', effects:[{ type:'modifier', scope:'unit:all', stat:'atk', value:0.15 }] },
    { id:'caucasus_mountain_campaign', chain:'army', name:'高加索雪山反突击', days:70, requires:['siege_of_kut'], x:1, y:4, desc:'恩维尔帕夏企图重夺巴统与卡尔斯重镇。', effects:[{ type:'modifier', scope:'unit:mtn', stat:'atk', value:0.20 }] },
    { id:'sinai_canal_raid', chain:'army', name:'西奈半岛突袭苏伊士运河', days:70, requires:['caucasus_mountain_campaign'], x:1, y:5, desc:'派遣骆驼骑兵穿过沙漠奇袭英军帝国命脉。', effects:[{ type:'modifier', scope:'unit:cav', stat:'speed', value:0.25 }] },
    { id:'islamic_army_of_caucasus', chain:'army', name:'高加索伊斯兰军团组建', days:70, requires:['sinai_canal_raid'], x:1, y:6, desc:'努里帕夏率部向巴库油田全力挺进。', effects:[{ type:'modifier', scope:'unit:all', stat:'atk', value:0.15 }] },
    { id:'eternal_crescent_army', chain:'army', name:'新月雄师威震近东', days:70, requires:['islamic_army_of_caucasus'], x:1, y:7, desc:'粉碎协约国肢解奥斯曼帝国的野心。', effects:[{ type:'modifier', scope:'unit:all', stat:'org', value:0.15 }] },

    // 政治链 (8)
    { id:'jihad_declaration', chain:'politics', name:'向协约国宣告圣战(Cihad)', days:70, requires:[], x:2, y:0, desc:'谢赫伊斯兰宣布针对英法俄的泛伊斯兰圣战。', effects:[{ type:'addPP', value:150 }] },
    { id:'three_pashas_triumvirate', chain:'politics', name:'三帕夏执政团铁腕统治', days:70, requires:['jihad_declaration'], x:2, y:1, desc:'恩维尔、塔拉特、杰马尔全面把控帝国权力。', effects:[{ type:'setLaw', law:'total' }] },
    { id:'capitulations_abolished', chain:'politics', name:'彻底废除治外法权不平等条约', days:70, requires:['three_pashas_triumvirate'], x:2, y:2, desc:'终结列强在帝国境内的领事裁判特权。', effects:[{ type:'addPP', value:120 }] },
    { id:'pan_turkism_dream', chain:'politics', name:'泛突厥主义理想宣扬', days:70, requires:['capitulations_abolished'], x:2, y:3, desc:'联络阿塞拜疆与中亚各突厥突厥语部族。', effects:[{ type:'modifier', scope:'nation', stat:'expansion', value:0.2 }] },
    { id:'repress_arab_nationalism', chain:'politics', name:'镇压大马士革分离主义', days:70, requires:['pan_turkism_dream'], x:2, y:4, desc:'铁腕清除英法情报人员渗透与叛乱分子。', effects:[{ type:'modifier', scope:'nation', stat:'stability', value:15 }] },
    { id:'treaty_with_bolsheviks', chain:'politics', name:'与苏维埃政权划界协定', days:70, requires:['repress_arab_nationalism'], x:2, y:5, desc:'趁沙皇倒台收复卡尔斯、阿尔达汉与阿尔特温。', effects:[{ type:'addPP', value:180 }] },
    { id:'preservation_of_the_caliphate', chain:'politics', name:'哈里发权威永续', days:70, requires:['treaty_with_bolsheviks'], x:2, y:6, desc:'捍卫伊斯兰世界精神领袖地位。', effects:[{ type:'addPP', value:200 }] },
    { id:'resurgent_porte', chain:'politics', name:'近东帝国伟大复兴', days:70, requires:['preservation_of_the_caliphate'], x:2, y:7, desc:'告别"西亚病夫"屈辱，成为欧亚枢纽大国。', effects:[{ type:'addPP', value:300 }] }
  ],

  // ==================== 塞尔维亚王国 (SRB) 12 节点 ====================
  SRB: [
    { id:'cer_mountain_stand', chain:'army', name:'策尔山阻击奇迹', days:70, requires:[], x:0, y:0, desc:'普特尼克元帅迎头痛击奥匈入侵军，取得协约国战初首胜。', effects:[{ type:'modifier', scope:'unit:inf', stat:'def', value:0.25 }] },
    { id:'kolubara_counter', chain:'army', name:'科卢巴拉河全面逆袭', days:70, requires:['cer_mountain_stand'], x:0, y:1, desc:'在退无可退的深冬绝境中全线反攻，收复贝尔格莱德。', effects:[{ type:'modifier', scope:'unit:all', stat:'atk', value:0.20 }] },
    { id:'serbian_typhus_relief', chain:'industry', name:'战胜斑疹伤寒疫情', days:70, requires:['kolubara_counter'], x:0, y:2, desc:'在英法医疗队援助下控制致命瘟疫。', effects:[{ type:'modifier', scope:'nation', stat:'stability', value:15 }] },
    { id:'great_retreat_albania', chain:'army', name:'翻越阿尔巴尼亚雪山的远征', days:70, requires:['serbian_typhus_relief'], x:0, y:3, desc:'国王、政府与残部携伤员翻越绝壁，保留复国火种。', effects:[{ type:'modifier', scope:'unit:all', stat:'org', value:0.20 }] },
    { id:'corfu_reorganization', chain:'politics', name:'科孚岛整补与宣言', days:70, requires:[], x:1, y:0, desc:'与南斯拉夫委员会达成协议，共建战后南斯拉夫王国。', effects:[{ type:'addPP', value:150 }] },
    { id:'allied_salonica_link', chain:'politics', name:'与萨洛尼卡盟军会师', days:70, requires:['corfu_reorganization'], x:1, y:1, desc:'重新换装法式军械重返马其顿前线。', effects:[{ type:'addFactory', kind:'mil', count:2 }] },
    { id:'dobro_pole_breakthrough', chain:'army', name:'多布罗波尔突穿攻势', days:70, requires:['allied_salonica_link'], x:1, y:2, desc:'塞尔维亚老兵以狂飙突进步伐击溃保加利亚防线。', effects:[{ type:'modifier', scope:'unit:all', stat:'brk', value:0.25 }] },
    { id:'liberate_belgrade', chain:'politics', name:'解放贝尔格莱德与祖国', days:70, requires:['dobro_pole_breakthrough'], x:1, y:3, desc:'驱逐一切同盟国占领军，实现民族复兴。', effects:[{ type:'addPP', value:250 }] }
  ],

  // ==================== 意大利王国 (ITA) 12 节点 ====================
  ITA: [
    { id:'london_pact', chain:'politics', name:'签署秘密伦敦条约', days:70, requires:[], x:0, y:0, desc:'协约国许诺将南提洛尔、伊斯特拉与达尔马提亚割予意大利。', effects:[{ type:'declareWar', target:'AUS' }, { type:'addPP', value:150 }] },
    { id:'ansaldo_fiat_expansion', chain:'industry', name:'安萨尔多与菲亚特军工厂动员', days:70, requires:['london_pact'], x:0, y:1, desc:'都灵与热那亚工业三角区转产重机枪与装甲车。', effects:[{ type:'addFactory', kind:'mil', count:3 }] },
    { id:'isonzo_offensives', chain:'army', name:'十一进伊松佐河战役', days:70, requires:['ansaldo_fiat_expansion'], x:0, y:2, desc:'卡多尔纳将军以坚决意志不断消耗奥匈守军。', effects:[{ type:'modifier', scope:'unit:inf', stat:'atk', value:0.15 }] },
    { id:'alpini_elite_corps', chain:'army', name:'阿尔卑斯高山特种部队(Alpini)', days:70, requires:['isonzo_offensives'], x:0, y:3, desc:'在永久冻土与悬崖峭壁间用索道与炸药作战。', effects:[{ type:'modifier', scope:'unit:mtn', stat:'atk', value:0.25 }] },
    { id:'piave_river_stand', chain:'army', name:'皮亚韦河决死死守', days:70, requires:[], x:1, y:0, desc:'卡波雷托惨败后全军誓言："绝不再退过皮亚韦河！"', effects:[{ type:'modifier', scope:'unit:inf', stat:'def', value:0.30 }] },
    { id:'arditi_dagger_troops', chain:'army', name:'阿迪蒂敢死队(Arditi)', days:70, requires:['piave_river_stand'], x:1, y:1, desc:'口衔匕首双手持手榴弹的突击精锐撕碎敌军前线。', effects:[{ type:'modifier', scope:'unit:inf', stat:'brk', value:0.25 }] },
    { id:'vittorio_veneto_strike', chain:'army', name:'维托里奥·维内托大反攻', days:70, requires:['arditi_dagger_troops'], x:1, y:2, desc:'终结奥匈帝国的最后一击，迫使其签署停战协定。', effects:[{ type:'modifier', scope:'unit:all', stat:'atk', value:0.20 }] },
    { id:'italia_irredenta_complete', chain:'politics', name:'收复未收复领土夙愿达成', days:70, requires:['vittorio_veneto_strike'], x:1, y:3, desc:'特伦托与的里雅斯特正式回归祖国怀抱。', effects:[{ type:'addPP', value:250 }] },
    // v12.1 扩充：第三列 —— 工业、能源与殖民纵深
    { id:'italian_shipyards_wartime', chain:'industry', name:'热那亚与的里雅斯特造船总动员', days:70, requires:['ansaldo_fiat_expansion'], x:2, y:0, desc:'战列舰龙骨与驱逐舰批次在船台上排队——海军造舰计划全面提速。', effects:[{ type:'addFactory', kind:'mil', count:2 }] },
    { id:'alpine_hydro_grid', chain:'industry', name:'阿尔卑斯水电工业网', days:70, requires:['italian_shipyards_wartime'], x:2, y:1, desc:'山涧里的涡轮机点亮了北意大利工厂——战时电力自给的关键。', effects:[{ type:'addCiv', value:4 }] },
    { id:'alfa_aviation_motors', chain:'industry', name:'航空发动机国产化攻关', days:70, requires:['alpine_hydro_grid'], x:2, y:2, desc:'比阿吉奥与伊索塔-弗拉斯基尼的航发终于摆脱了进口依赖。', effects:[{ type:'addEquip', value:350 }, { type:'addResearchSlot', count:1 }] },
    { id:'libya_oasis_settlement', chain:'politics', name:'利比亚绿洲殖民开发', days:70, requires:['italia_irredenta_complete'], x:2, y:3, desc:'的黎波里塔尼亚的灌溉渠与农场——"第四海岸"的雄心与负担。', effects:[{ type:'addCiv', value:2 }, { type:'addPP', value:100 }] }
  ],

  // ==================== 比利时王国 (BEL) 8 节点 ====================
  BEL: [
    { id:'liege_forts', chain:'army', name:'列日装甲炮台要塞群抗击', days:70, requires:[], x:0, y:0, desc:'莱曼将军指挥环形混凝土堡垒拖延德军施里芬计划达十一天。', effects:[{ type:'addBuilding', building:'fort', level:2, at:'border' }] },
    { id:'king_albert_resistance', chain:'politics', name:'骑士国王亲统陆军', days:70, requires:['liege_forts'], x:0, y:1, desc:'阿尔贝一世身先士卒留在前线阵地。', effects:[{ type:'addPP', value:150 }, { type:'modifier', scope:'unit:all', stat:'org', value:0.15 }] },
    { id:'flood_yser_gates', chain:'army', name:'打开纽波特水闸放水淹没伊瑟河', days:70, requires:['king_albert_resistance'], x:0, y:2, desc:'引北海海水淹没低地平原，让德军装甲与步兵寸步难行。', effects:[{ type:'modifier', scope:'unit:inf', stat:'def', value:0.35 }] },
    { id:'free_belgium_endures', chain:'politics', name:'未屈服的比利时', days:70, requires:['flood_yser_gates'], x:0, y:3, desc:'在最后一片泥泞国土坚守四年直至胜利。', effects:[{ type:'addPP', value:250 }] },
    // v12.1 扩充：第二列 —— 流亡工业、海外军团与民防生命线
    { id:'havre_industry_relocation', chain:'industry', name:'工业迁往勒阿弗尔与英国', days:70, requires:['king_albert_resistance'], x:1, y:0, desc:'被占领区的机械与工程师转移到未沦陷的狭长地带与海峡对岸。', effects:[{ type:'addFactory', kind:'civ', count:2 }] },
    { id:'congo_force_campaign', chain:'army', name:'比属刚果远征军转战东非', days:70, requires:['free_belgium_endures'], x:1, y:1, desc:'土著步兵与比利时军官组成的军团在热带雨林里追击德属东非守军。', effects:[{ type:'addPP', value:100 }, { type:'modifier', scope:'unit:inf', stat:'org', value:0.15 }] },
    { id:'belgian_war_charities', chain:'politics', name:'全国救济委员会与海外募款', days:70, requires:['havre_industry_relocation'], x:1, y:2, desc:'胡佛的委员会喂饱了七百万比利时人——中立的粮道成了生命线。', effects:[{ type:'addPP', value:100 }, { type:'modifier', scope:'nation', stat:'stability', value:10 }] },
    { id:'ypres_iron_ridge', chain:'army', name:'伊普尔残墙下的轮回坚守', days:70, requires:['congo_force_campaign'], x:1, y:3, desc:'毒气与泥浆里的四次大会战摧毁了这座城市，也淬炼了这支军队。', effects:[{ type:'modifier', scope:'unit:inf', stat:'def', value:0.20 }] }
  ],

  // ==================== 保加利亚王国 (BUL) 8 节点 ====================
  BUL: [
    { id:'macedonia_claims', chain:'politics', name:'马其顿归属诉求', days:70, requires:[], x:0, y:0, desc:'誓言夺回被塞尔维亚与希腊瓜分的祖先故土。', effects:[{ type:'addPP', value:150 }] },
    { id:'join_central_powers', chain:'politics', name:'加入同盟国阵营', days:70, requires:['macedonia_claims'], x:0, y:1, desc:'与德奥两国签署条约，协同进攻塞尔维亚。', effects:[{ type:'declareWar', target:'SRB' }] },
    { id:'balkan_prussia_army', chain:'army', name:'巴尔干普鲁士陆军突击', days:70, requires:['join_central_powers'], x:0, y:2, desc:'凶悍的保加利亚刺刀冲锋在多布罗波尔横扫敌阵。', effects:[{ type:'modifier', scope:'unit:inf', stat:'atk', value:0.20 }] },
    { id:'salonica_stalemate', chain:'army', name:'坚守瓦尔达尔河防线', days:70, requires:['balkan_prussia_army'], x:0, y:3, desc:'压制协约国东方联军达三年之久。', effects:[{ type:'modifier', scope:'unit:inf', stat:'def', value:0.20 }] },
    // v12.1 扩充：第二列 —— 动员、经济与战争终局
    { id:'bulgarian_mobilization_1915', chain:'army', name:'1915年全面动员令', days:70, requires:['macedonia_claims'], x:1, y:0, desc:'六十万大军跨过边界时，这个巴尔干小国倾尽了最后一名壮丁。', effects:[{ type:'addFactory', kind:'mil', count:2 }] },
    { id:'dobrudza_offensive', chain:'army', name:'多布罗加方向攻势', days:70, requires:['salonica_stalemate'], x:1, y:1, desc:'与德军并肩南下夺取康斯坦察与罗马尼亚产粮区。', effects:[{ type:'modifier', scope:'unit:all', stat:'atk', value:0.15 }] },
    { id:'russia_bread_supply', chain:'industry', name:'对德粮食与原料出口走廊', days:70, requires:['bulgarian_mobilization_1915'], x:1, y:2, desc:'保加利亚成为同盟国的南粮北运枢纽，用小麦换取煤与军械。', effects:[{ type:'addPP', value:150 }, { type:'addFactory', kind:'civ', count:1 }] },
    { id:'armistice_salonica_break', chain:'politics', name:'东方战线最后的链条', days:70, requires:['dobrudza_offensive'], x:1, y:3, desc:'当德军抽身西去，孤悬的防线与疲惫的国家一起走向终局抉择。', effects:[{ type:'addPP', value:200 }] }
  ],

  // ==================== 罗马尼亚王国 (ROM) 8 节点 ====================
  ROM: [
    { id:'transylvania_pledge', chain:'politics', name:'布加勒斯特密约签署', days:70, requires:[], x:0, y:0, desc:'协约国许诺特兰西瓦尼亚与巴纳特为参战报酬。', effects:[{ type:'declareWar', target:'AUS' }, { type:'addPP', value:150 }] },
    { id:'carpathian_crossing', chain:'army', name:'越过喀尔巴阡山口突击', days:70, requires:['transylvania_pledge'], x:0, y:1, desc:'进军特兰西瓦尼亚盆地重镇。', effects:[{ type:'modifier', scope:'unit:all', stat:'atk', value:0.15 }] },
    { id:'ploiesti_oil_security', chain:'industry', name:'普洛耶什蒂油田战时封锁', days:70, requires:['carpathian_crossing'], x:0, y:2, desc:'在敌军占领前坚壁清野烧毁油井避免资敌。', effects:[{ type:'addPP', value:100 }] },
    { id:'great_union_1918', chain:'politics', name:'大罗马尼亚统一', days:70, requires:['ploiesti_oil_security'], x:0, y:3, desc:'特兰西瓦尼亚、比萨拉比亚与布科维纳汇聚一统。', effects:[{ type:'addPP', value:250 }] },
    // v12.1 扩充：第二列 —— 1916-1918 的完整战争弧线
    { id:'bucharest_fortress_line', chain:'army', name:'布加勒斯特筑垒线防御', days:70, requires:['transylvania_pledge'], x:1, y:0, desc:'法式参谋部改造的军队依托多瑙河三角洲组织纵深防御。', effects:[{ type:'addBuilding', building:'fort', level:2, at:'border' }] },
    { id:'marasesti_last_stand', chain:'army', name:'马拉塞什蒂血战', days:70, requires:['bucharest_fortress_line'], x:1, y:1, desc:'1917年夏天罗马尼亚军队在亡国边缘打出最光彩的一战。', effects:[{ type:'modifier', scope:'unit:inf', stat:'def', value:0.25 }] },
    { id:'oil_for_allies_deal', chain:'industry', name:'普洛耶什蒂原油协约国专供', days:70, requires:['ploiesti_oil_security'], x:1, y:2, desc:'战前欧洲第五大产油区——每一桶原油都是战略筹码。', effects:[{ type:'addPP', value:150 }, { type:'addFactory', kind:'mil', count:1 }] },
    { id:'bessarabia_union', chain:'politics', name:'比萨拉比亚议会决议合并', days:70, requires:['marasesti_last_stand'], x:1, y:3, desc:'俄国崩溃后，摩尔多瓦议会投票加入罗马尼亚王国。', effects:[{ type:'addPP', value:150 }] }
  ],

  // ==================== 希腊王国 (GRE) 8 节点 ====================
  GRE: [
    { id:'national_schism_resolution', chain:'politics', name:'平息国家分裂危机', days:70, requires:[], x:0, y:0, desc:'韦尼泽洛斯临时政府与雅典王廷达成妥协。', effects:[{ type:'addPP', value:150 }] },
    { id:'join_salonica_front', chain:'army', name:'希腊九个师全面开赴马其顿', days:70, requires:['national_schism_resolution'], x:0, y:1, desc:'协助英法联军发起斯特鲁马河战役。', effects:[{ type:'modifier', scope:'unit:inf', stat:'atk', value:0.15 }] },
    { id:'skra_di_legen_victory', chain:'army', name:'斯克拉迪莱根坚固筑垒突击', days:70, requires:['join_salonica_front'], x:0, y:2, desc:'希腊步兵在炮火掩护下夺占保加利亚坚固阵地。', effects:[{ type:'modifier', scope:'unit:all', stat:'brk', value:0.20 }] },
    { id:'megali_idea_glory', chain:'politics', name:'伟大理想(Megali Idea)远景', days:70, requires:['skra_di_legen_victory'], x:0, y:3, desc:'迈向爱琴海两岸与色雷斯的故土复归。', effects:[{ type:'addPP', value:250 }] },
    // v12.1 扩充：第二列 —— 海岛、侨民与小亚细亚棋局
    { id:'crete_aegean_integration', chain:'politics', name:'克里特与爱琴诸岛正式合并', days:70, requires:['national_schism_resolution'], x:1, y:0, desc:'巴尔干战争的战利品在法律上归属雅典——爱琴海成为希腊内湖的一半。', effects:[{ type:'addPP', value:100 }, { type:'addFactory', kind:'civ', count:1 }] },
    { id:'lemnos_allied_base', chain:'industry', name:'利姆诺斯岛穆德罗斯锚地开放', days:70, requires:['crete_aegean_integration'], x:1, y:1, desc:'协约国舰队以此为跳板进攻达达尼尔——希腊的港口成为东方战线的枢纽。', effects:[{ type:'addPP', value:100 }, { type:'addFactory', kind:'mil', count:1 }] },
    { id:'asia_minor_venizelos', chain:'politics', name:'韦尼泽洛斯的小亚细亚蓝图', days:70, requires:['megali_idea_glory'], x:1, y:2, desc:'士麦那的希腊社区、罗马帝国的旧梦——野心即将撞上现实的山峦。', effects:[{ type:'addPP', value:150 }] },
    { id:'greek_expedition_corps', chain:'army', name:'远征军团北上乌克兰', days:70, requires:['skra_di_legen_victory'], x:1, y:3, desc:'两个师远赴黑海北岸协助白军——希腊军队最后一次为"伟大理想"远征。', effects:[{ type:'modifier', scope:'unit:all', stat:'org', value:0.15 }] }
  ],

  // ==================== 美利坚合众国 (USA) 8 节点 ====================
  USA: [
    { id:'strict_neutrality', chain:'politics', name:'宣布严格中立声明', days:70, requires:[], x:0, y:0, desc:'威尔逊呼吁国人在思想与行动上保持中立。', effects:[{ type:'addPP', value:100 }] },
    { id:'liberty_loans', chain:'industry', name:'自由公债与两洋武器大生产', days:70, requires:['strict_neutrality'], x:0, y:1, desc:'底特律与匹兹堡开足马力为协约国供应钢铁与卡车。', effects:[{ type:'addFactory', kind:'mil', count:4 }] },
    { id:'lusitania_reaction', chain:'politics', name:'卢西塔尼亚号沉没强硬抗议', days:70, requires:['liberty_loans'], x:0, y:2, desc:'警告柏林潜艇战必将引发严重后果。', effects:[{ type:'modifier', scope:'nation', stat:'warSupport', value:25 }] },
    { id:'fourteen_points', chain:'politics', name:'十四点和平原则公布', days:70, requires:['lusitania_reaction'], x:0, y:3, desc:'民族自决、公开条约与国联设想，重塑战后世界道德灯塔。', effects:[{ type:'addPP', value:200 }] },
    { id:'doughboys_arrival', chain:'army', name:'美国远征军(AEF)登陆法国', days:70, requires:['fourteen_points'], x:0, y:4, desc:'潘兴将军率两百万生力军抵达圣纳泽尔。', effects:[{ type:'modifier', scope:'unit:inf', stat:'hp', value:0.25 }] },
    { id:'saint_mihiel_drive', chain:'army', name:'圣米耶勒突出部歼灭战', days:70, requires:['doughboys_arrival'], x:0, y:5, desc:'美军独立兵团首次大规模战役胜利。', effects:[{ type:'modifier', scope:'unit:all', stat:'atk', value:0.20 }] },
    { id:'meuse_argonne_strike', chain:'army', name:'默兹-阿登攻势强攻', days:70, requires:['saint_mihiel_drive'], x:0, y:6, desc:'美军历史上最大规模地面战役，打断德军撤退铁路线。', effects:[{ type:'modifier', scope:'unit:all', stat:'brk', value:0.20 }] },
    { id:'arsenal_of_democracy_ww1', chain:'industry', name:'民主兵工厂初步成型', days:70, requires:['meuse_argonne_strike'], x:0, y:7, desc:'美国正式迈入世界头号经济与军事强权行列。', effects:[{ type:'addResearchSlot', count:1 }] }
  ]
};
