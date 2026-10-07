/* ============================================================
   data/scenarios/modern/events.js —— 现代「多极危机 2022」60 大事件全案
   （36 条史实事件 + 24 条虚构人物与联动网络事件 [F]）
   严格遵循 C9（客观中性）与 C10（所有虚构事件强制带 [F] 标记）
   ============================================================ */

export const MODERN_EVENTS = [
  // ================= 36 条现代史实事件 (W+1 至 W+120 周) =================
  {
    id: 'm_smo_start', week: 1,
    title: '2022年2月24日：乌克兰全境战事打响',
    desc: '俄罗斯军队从北部、东部及南部多路越过边界，基辅鲍里斯波尔机场等地响起警报，乌克兰宣布全国战时状态。',
    important: true,
    effects: [ { nat: 'UKR', stat: 'warSupport', value: 30 }, { nat: 'RUS', stat: 'attack', value: 0.15 } ]
  },
  {
    id: 'm_snake_island', week: 1,
    title: '蛇岛黑海对峙电文公布',
    desc: '黑海蛇岛乌克兰边防驻军在无线电通信中表达不屈意志，电文迅速传遍全球社交媒体网络。',
    effects: [ { nat: 'UKR', stat: 'warSupport', value: 20 } ]
  },
  {
    id: 'm_hostomel_airport', week: 2,
    title: '霍斯托梅尔安东诺夫机场争夺战',
    desc: '俄军近卫空降突击旅在基辅西北安东诺夫机场机降，乌军特种部队与国民卫队组织炮火阻击。',
    effects: [ { nat: 'UKR', stat: 'defense', value: 0.2 } ]
  },
  {
    id: 'm_swift_sanctions', week: 2,
    title: '西方国家将主要俄银行移出SWIFT系统',
    desc: '美欧宣布史无前例金融制裁，冻结俄罗斯央行部分海外储备资产并切断主要金融机构SWIFT通道。',
    important: true,
    effects: [ { nat: 'RUS', stat: 'milOutput', value: -0.1 }, { nat: 'GER', stat: 'stability', value: -5 } ]
  },
  {
    id: 'm_kherson_captured', week: 3,
    title: '第聂伯河要冲赫尔松市易手',
    desc: '俄军从克里米亚北上部队越过安东诺夫斯基大桥进驻赫尔松市中心，打通克里米亚淡水走廊。',
    effects: [ { nat: 'RUS', stat: 'warSupport', value: 15 } ]
  },
  {
    id: 'm_mariupol_siege', week: 4,
    title: '亚速海港口马里乌波尔围城战展开',
    desc: '俄军与顿涅茨克武装完成了对亚速海沿岸重工业大城马里乌波尔的合围，市区陷入残酷巷战。',
    important: true,
    effects: [ { nat: 'UKR', stat: 'defense', value: 0.15 } ]
  },
  {
    id: 'm_istanbul_talks', week: 5,
    title: '伊斯坦布尔和平接触性谈判',
    desc: '俄乌代表团在土耳其多尔玛巴赫切宫举行面对面磋商，双方就中立地位与安全保障交换草案。',
    effects: [ { nat: 'UKR', stat: 'stability', value: 10 }, { nat: 'RUS', stat: 'stability', value: 10 } ]
  },
  {
    id: 'm_kyiv_redeploy', week: 6,
    title: '俄军战线调整：从基辅北部全线撤离',
    desc: '俄军统帅部宣布完成第一阶段主要任务，将部队从基辅、切尔尼戈夫方向撤离，主力转进顿巴斯。',
    important: true,
    effects: [ { nat: 'UKR', stat: 'prestige', value: 25 }, { nat: 'UKR', stat: 'stability', value: 20 } ]
  },
  {
    id: 'm_moskva_sunk', week: 8,
    title: '黑海舰队旗舰莫斯科号导弹巡洋舰沉没',
    desc: '俄罗斯黑海舰队万吨级光荣级巡洋舰在黑海海域受损起火后沉没，黑海制海权态势发生深远改变。',
    important: true,
    effects: [ { nat: 'RUS', stat: 'stability', value: -15 }, { nat: 'UKR', stat: 'prestige', value: 25 } ]
  },
  {
    id: 'm_azovstal_end', week: 12,
    title: '亚速钢铁厂地下堡垒战事结束',
    desc: '坚守马里乌波尔亚速钢铁厂地下复杂通道两个多月的残余守军走出阵地放下武器，亚速海陆桥打通。',
    important: true,
    effects: [ { nat: 'RUS', stat: 'warSupport', value: 20 } ]
  },
  {
    id: 'm_eu_candidate_ukr', week: 17,
    title: '欧盟正式授予乌克兰候选国地位',
    desc: '欧洲理事会全票通过决议，正式给予乌克兰与摩尔多瓦欧盟候选国地位，欧洲一体化进程提速。',
    effects: [ { nat: 'UKR', stat: 'prestige', value: 30 } ]
  },
  {
    id: 'm_snake_island_evac', week: 18,
    title: '蛇岛守军调整驻泊',
    desc: '在乌军远程火炮与无人机持续压制下，俄军撤出蛇岛驻守人员，黑海西北水域航道威胁缓解。',
    effects: [ { nat: 'UKR', stat: 'prestige', value: 15 } ]
  },
  {
    id: 'm_black_sea_grain', week: 21,
    title: '黑海粮食运输倡议在伊斯坦布尔签署',
    desc: '在联合国与土耳其斡旋下，俄乌土联合设立协调中心，确保乌克兰农产品经黑海人道主义走廊安全外运。',
    effects: [ { nat: 'UKR', stat: 'civOutput', value: 0.15 }, { nat: 'RUS', stat: 'prestige', value: 15 } ]
  },
  {
    id: 'm_zaporizhzhia_iaea', week: 24,
    title: '国际原子能机构专家进驻扎波罗热核电站',
    desc: '欧洲最大核电站周边频遭炮击引发全球核安全忧虑，格罗西率IAEA专家团跨越火线实施现场核查。',
    effects: [ { nat: 'UKR', stat: 'stability', value: 10 } ]
  },
  {
    id: 'm_kharkiv_offensive', week: 28,
    title: '乌克兰陆军打响哈尔科夫闪电大反攻',
    desc: '乌军在巴拉克列亚方向突然实施机械化穿插，数日内收复大片失地，战线推进数十公里！',
    important: true,
    effects: [ { nat: 'UKR', stat: 'attack', value: 0.25 }, { nat: 'RUS', stat: 'defense', value: -0.2 } ]
  },
  {
    id: 'm_izyum_liberated', week: 29,
    title: '伊久姆与库皮扬斯克铁路枢纽光复',
    desc: '乌军先头部队开进伊久姆与奥斯科尔河畔库皮扬斯克，俄军北部补给枢纽被彻底截断。',
    effects: [ { nat: 'UKR', stat: 'stability', value: 25 }, { nat: 'UKR', stat: 'prestige', value: 25 } ]
  },
  {
    id: 'm_donbas_referendum', week: 30,
    title: '顿巴斯及扎波罗热、赫尔松举行入俄公投',
    desc: '卢甘斯克、顿涅茨克、扎波罗热与赫尔松四地举行投票，克里姆林宫举行隆重条约签署仪式。',
    important: true,
    effects: [ { nat: 'RUS', stat: 'warSupport', value: 25 } ]
  },
  {
    id: 'm_partial_mobilization', week: 30,
    title: '俄罗斯宣布实施部分军事动员',
    desc: '普京总统签署总统令启动30万人部分动员，俄军大规模征召预备役人员补充一线作战部队。',
    important: true,
    effects: [ { nat: 'RUS', stat: 'equip', value: 600 }, { nat: 'RUS', stat: 'stability', value: -10 } ]
  },
  {
    id: 'm_nord_stream_blast', week: 31,
    title: '北溪一号与北溪二号海底管道剧烈爆炸',
    desc: '波罗的海博恩霍姆岛附近海底天然气管道遭遇蓄意水下爆炸，数亿立方米天然气喷涌，欧洲能源桥梁断裂。',
    important: true,
    effects: [ { nat: 'GER', stat: 'milOutput', value: -0.15 }, { nat: 'GER', stat: 'stability', value: -15 } ]
  },
  {
    id: 'm_crimea_bridge_blast', week: 32,
    title: '克里米亚刻赤海峡大桥遭遇爆炸事件',
    desc: '刻赤大桥公路桥面一辆货车发生剧烈爆炸导致桥跨部分垮塌，油罐列车起火，战略通道短暂停顿。',
    effects: [ { nat: 'RUS', stat: 'stability', value: -15 } ]
  },
  {
    id: 'm_energy_infrastructure_strikes', week: 33,
    title: '俄军对乌克兰能源电网实施远程导弹打击',
    desc: '上百枚空基巡航导弹与自杀式无人机对变电站与热电厂实施饱和打击，基辅等大城市出现大范围停电。',
    effects: [ { nat: 'UKR', stat: 'civOutput', value: -0.2 } ]
  },
  {
    id: 'm_kherson_right_bank_evac', week: 37,
    title: '俄军第聂伯河右岸防线撤回左岸整饬',
    desc: '鉴于安东诺夫斯基桥等补给通道遭高精度火箭炮切断，苏罗维金大将下令赫尔松守军撤往左岸建立坚固防线。',
    important: true,
    effects: [ { nat: 'UKR', stat: 'prestige', value: 35 }, { nat: 'UKR', stat: 'stability', value: 20 } ]
  },
  {
    id: 'm_western_tanks_pledge', week: 48,
    title: '德美英批准向乌提供豹2与M1艾布拉姆斯主战坦克',
    desc: '德国朔尔茨政府与美国拜登政府正式放行重装甲援助，西方现代主战坦克与步兵战车列装乌克兰军团。',
    important: true,
    effects: [ { nat: 'UKR', stat: 'equip', value: 600 }, { nat: 'UKR', stat: 'attack', value: 0.15 } ]
  },
  {
    id: 'm_bakhmut_grinder', week: 55,
    title: '巴赫穆特“绞肉机”巷战激烈僵持',
    desc: '顿巴斯交通要冲巴赫穆特演变为重炮与突击队残酷拉锯战，双方在此投入精锐展开血腥消耗。',
    effects: [ { nat: 'UKR', stat: 'defense', value: 0.2 }, { nat: 'RUS', stat: 'attack', value: 0.15 } ]
  },
  {
    id: 'm_bakhmut_taken', week: 64,
    title: '巴赫穆特市区作战行动告一段落',
    desc: '经过长达224天的持续攻坚，瓦格纳武装宣告攻占巴赫穆特市中心政府大楼及西郊高地。',
    effects: [ { nat: 'RUS', stat: 'warSupport', value: 20 } ]
  },
  {
    id: 'm_southern_counteroffensive', week: 66,
    title: '乌克兰南部扎波罗热战线反攻打响',
    desc: '乌军集中多支北约装备旅在罗博季涅等方向向托克马克挺进，冲击俄军多层纵深防线。',
    important: true,
    effects: [ { nat: 'UKR', stat: 'attack', value: 0.2 } ]
  },
  {
    id: 'm_prigozhin_march', week: 69,
    title: '瓦格纳车队进军莫斯科：惊心动魄二十四小时',
    desc: '普里戈任率瓦格纳武装从罗斯托夫沿M4高速公路向莫斯科进发，在卢卡申科斡旋下车队于距莫斯科200公里处调头。',
    important: true,
    effects: [ { nat: 'RUS', stat: 'stability', value: -25 } ]
  },
  {
    id: 'm_surovikin_line_holds', week: 75,
    title: '苏罗维金防线密集雷区与反装甲防御生效',
    desc: '由大纵深雷场、龙齿防坦克锥与卡-52武装直升机构成的苏罗维金防线经受住冲击，南部战线重归对峙。',
    important: true,
    effects: [ { nat: 'RUS', stat: 'defense', value: 0.3 } ]
  },
  {
    id: 'm_october_7_gaza', week: 84,
    title: '中东局势突变：加沙地带爆发新一轮大规模冲突',
    desc: '哈马斯突袭以色列南部社区引发铁剑行动，以军重兵进入加沙，中东多国陷入严重危机连锁。',
    important: true,
    effects: [ { nat: 'ISR', stat: 'warSupport', value: 35 }, { nat: 'USA', stat: 'stability', value: -10 } ]
  },
  {
    id: 'm_red_sea_crisis', week: 90,
    title: '也门胡塞武装对曼德海峡商船实施封锁',
    desc: '胡塞武装宣布以无人机和反舰导弹打击关联以色列及美英船只，全球红海航运大面积绕行好望角。',
    important: true,
    effects: [ { nat: 'GBR', stat: 'milOutput', value: -0.1 }, { nat: 'IRN', stat: 'prestige', value: 20 } ]
  },
  {
    id: 'm_prosperity_guardian', week: 94,
    title: '繁荣卫士行动：多国舰队红海联合护航',
    desc: '美国牵头组建多国海军特混舰队在红海实施拦截反舰导弹作业，英美战机多次打击陆上雷达站。',
    effects: [ { nat: 'USA', stat: 'prestige', value: 15 } ]
  },
  {
    id: 'm_avdiivka_captured', week: 103,
    title: '俄军完全攻占顿涅茨克门户阿夫杰耶夫卡',
    desc: '历经数月钳形合围与重磅制导滑翔炸弹猛攻，乌军新总司令瑟尔斯基下令撤离阿夫杰耶夫卡焦化厂。',
    important: true,
    effects: [ { nat: 'RUS', stat: 'warSupport', value: 25 }, { nat: 'UKR', stat: 'stability', value: -15 } ]
  },
  {
    id: 'm_nordic_nato_expansion', week: 106,
    title: '芬兰与瑞典先后正式加入北约',
    desc: '芬兰与瑞典终结数十年乃至数百年军事不结盟政策，北约北翼边境线延长上千公里，波罗的海成为北约内海。',
    important: true,
    effects: [ { nat: 'USA', stat: 'prestige', value: 30 }, { nat: 'RUS', stat: 'defense', value: -0.1 } ]
  },
  {
    id: 'm_czech_ammo_initiative', week: 108,
    title: '捷克倡议全球采购上百万发大口径炮弹',
    desc: '捷克总统牵头欧盟多国筹资在非西方国家采购80万发155与122毫米炮弹，缓解前线炮弹短缺。',
    effects: [ { nat: 'UKR', stat: 'equip', value: 500 } ]
  },
  {
    id: 'm_iran_retaliatory_strike', week: 112,
    title: '伊朗直接向以色列本土实施大规模无人机导弹反击',
    desc: '伊朗伊斯兰革命卫队发射数百架无人机与弹道导弹直扑内盖夫空军基地，以美英法多层防空联手拦截。',
    important: true,
    effects: [ { nat: 'IRN', stat: 'prestige', value: 35 }, { nat: 'ISR', stat: 'defense', value: 0.2 } ]
  },
  {
    id: 'm_switzerland_peace_summit', week: 120,
    title: '瑞士布尔根施托克乌克兰和平高级别峰会',
    desc: '九十余国代表齐聚瑞士商讨核安全、粮食安全与战俘释放三项基石，多极世界和平呼声高涨。',
    important: true,
    effects: [ { nat: 'UKR', stat: 'prestige', value: 35 }, { nat: 'USA', stat: 'stability', value: 20 } ]
  },

  // ================= 24 条虚构人物与四人联动网络事件 [F] =================
  {
    id: 'f_ev_ge_strike_wave', week: 15,
    title: '[F] 炉火阵线工潮：伏尔加河畔坦克厂大罢工',
    desc: '[F] 葛修傅在伏尔加格勒拖拉机厂向数万名工人发表演讲，痛陈物资调度腐败，号召组建工人监察委员会。',
    important: true,
    effects: [ { nat: 'RUS', stat: 'stability', value: -15 } ]
  },
  {
    id: 'f_ev_ge_enters_cabinet', week: 24,
    title: '[F] 葛修傅民选入阁出任战时生产副总理',
    desc: '[F] 在杜马左翼议员强烈推动下，葛修傅入阁主掌军工总装配链，老工业区支持率飙升。',
    important: true,
    effects: [ { nat: 'RUS', stat: 'milOutput', value: 0.2 } ]
  },
  {
    id: 'f_ev_ge_red_may_day', week: 35,
    title: '[F] 红场五一劳动者大游行与红旗海',
    desc: '[F] 葛修傅与炉火阵线纠察队走过红场列宁墓，高举“工厂属于工人士兵”标语，震动克里姆林宫政坛。',
    effects: [ { nat: 'RUS', stat: 'warSupport', value: 20 } ]
  },
  {
    id: 'f_ev_ge_total_plan', week: 45,
    title: '[F] 葛修傅推行战时工人总动员法',
    desc: '[F] 宣布没收寡头资产收归国营，全国关键军工企业实行军事化三班倒管理，武器下线速度激增。',
    effects: [ { nat: 'RUS', stat: 'equip', value: 800 } ]
  },
  {
    id: 'f_ev_ge_red_white_schism', week: 55,
    title: '[F] 红白对立：俄罗斯内部路线分歧表面化',
    desc: '[F] 军工委员会与传统寡头发生激烈正面对峙，军队中下层军官普遍倒向葛修傅的激进战时统制。',
    important: true,
    effects: [ { nat: 'RUS', stat: 'stability', value: -20 } ]
  },
  {
    id: 'f_ev_ge_belarus_alliance', week: 65,
    title: '[F] 炉火阵线与白俄罗斯建立红色工业联盟',
    desc: '[F] 葛修傅出访明斯克签署联合重工业拖拉机与火箭炮生产总协议，独联体北方工业走廊成型。',
    effects: [ { nat: 'BLR', stat: 'stability', value: 20 } ]
  },
  {
    id: 'f_ev_ge_gosplan_reborn', week: 78,
    title: '[F] 葛修傅签署全面恢复计划经济法令',
    desc: '[F] 国家计委全面接管民用与工业物资分配，消费品配给制保障前线无限制弹药消耗。',
    effects: [ { nat: 'RUS', stat: 'civOutput', value: -0.1 }, { nat: 'RUS', stat: 'milOutput', value: 0.25 } ]
  },
  {
    id: 'f_ev_ge_steel_flood_strike', week: 95,
    title: '[F] 葛修傅发起红星钢铁洪流决断',
    desc: '[F] 上千辆新造T-90M坦克与步战车集群在无人机群掩护下展开全线突击，誓要打破长期阵地僵局。',
    important: true,
    effects: [ { nat: 'RUS', stat: 'attack', value: 0.3 } ]
  },

  {
    id: 'f_ev_ya_speech', week: 16,
    title: '[F] 旭日会崛起：吉爱习国会震撼演说',
    desc: '[F] 吉爱习在众议院讲台抨击战后和平主义枷锁，疾呼“日本必须成为拥有正规军队的正常国家”。',
    important: true,
    effects: [ { nat: 'JPN', stat: 'warSupport', value: 25 }, { nat: 'JPN', stat: 'stability', value: -10 } ]
  },
  {
    id: 'f_ev_ya_export_principles', week: 26,
    title: '[F] 旭日会推动修改防卫装备转移三原则',
    desc: '[F] 日本正式放开致命性武器出口限制，三菱重工与川崎重工装甲与防空雷达订单涌向海外。',
    effects: [ { nat: 'JPN', stat: 'milOutput', value: 0.15 } ]
  },
  {
    id: 'f_ev_ya_izumo_carrier_jet', week: 38,
    title: '[F] 出云号首降F-35B正式正规航母化',
    desc: '[F] 改装耐热甲板后的出云号搭载五代垂直起降战机在横须贺外海完成着舰测试，旭日会举行盛大庆典。',
    effects: [ { nat: 'JPN', stat: 'attack', value: 0.2 } ]
  },
  {
    id: 'f_ev_ya_national_honor', week: 50,
    title: '[F] 吉爱习发表历史与尊严宣言引发亚太抗议',
    desc: '[F] 吉爱习参拜靖国神社并发表演讲，引发中韩等国强烈外交抗议，东京街头爆发大规模反战对峙。',
    effects: [ { nat: 'JPN', stat: 'prestige', value: -30 }, { nat: 'JPN', stat: 'stability', value: -15 } ]
  },
  {
    id: 'f_ev_ya_nuclear_latency_debate', week: 62,
    title: '[F] 吉爱习动议讨论核共享与核门槛',
    desc: '[F] 旭日会公开提交利用数千吨钚储备开展核动力与战术核威慑论证的议案，华盛顿传达严厉私下关切。',
    important: true,
    effects: [ { nat: 'JPN', stat: 'defense', value: 0.25 }, { nat: 'USA', stat: 'stability', value: -15 } ]
  },

  {
    id: 'f_ev_xl_war_contracts', week: 18,
    title: '[F] 小鹿签署特别战时贸易与军工拨款',
    desc: '[F] 白宫特别经济顾问小鹿推行千亿美元订单打包法案，宾夕法尼亚与德克萨斯老厂区机器轰鸣。',
    important: true,
    effects: [ { nat: 'USA', stat: 'civOutput', value: 0.15 }, { nat: 'USA', stat: 'equip', value: 600 } ]
  },
  {
    id: 'f_ev_xl_allied_burden_talks', week: 32,
    title: '[F] 小鹿强硬要求欧洲盟国提高防务开支',
    desc: '[F] 小鹿在布鲁塞尔北约财长峰会上拍板：欧洲各国必须在半年内将GDP的2.5%实打实投向弹药产能。',
    effects: [ { nat: 'GER', stat: 'milOutput', value: 0.15 }, { nat: 'FRA', stat: 'milOutput', value: 0.1 } ]
  },
  {
    id: 'f_ev_xl_secret_shuttle', week: 46,
    title: '[F] 小鹿秘密渠道多方穿梭外交',
    desc: '[F] 小鹿不顾两党极化，秘密在日内瓦与海湾多国接触，试图以跨大西洋能源合同换取地缘止血。',
    effects: [ { nat: 'USA', stat: 'stability', value: 15 } ]
  },
  {
    id: 'f_ev_xl_lng_export_boom', week: 60,
    title: '[F] 能源独立：小鹿批准最大LNG出口配额',
    desc: '[F] 美湾数十艘液化天然气超级油轮起航驶向欧洲鹿特丹港，美国确立全球第一大能源出口国地位。',
    effects: [ { nat: 'USA', stat: 'civOutput', value: 0.2 }, { nat: 'GER', stat: 'stability', value: 15 } ]
  },

  {
    id: 'f_ev_wr_shadow_assessment', week: 20,
    title: '[F] 白厅灰色主教王若伊主持绝密外交评估',
    desc: '[F] 王若伊在白厅地堡召集军情六处高层闭门研判：英国绝不能在一棵树上吊死，必须拥有双面底牌。',
    effects: [ { nat: 'GBR', stat: 'plan_speed', value: 0.25 } ]
  },
  {
    id: 'f_ev_wr_intel_interception', week: 36,
    title: '[F] 王若伊截获东欧战场绝密军事计划',
    desc: '[F] 军情六处深层线人带出俄乌前线最新调动代号，王若伊将部分情报隐秘转售给多方以积累筹码。',
    effects: [ { nat: 'GBR', stat: 'prestige', value: 20 } ]
  },
  {
    id: 'f_ev_wr_london_secret_pact', week: 48,
    title: '[F] 伦敦密约：王若伊与吉爱习秘密军事技术暗盘',
    desc: '[F] 王若伊与远道而来的吉爱习在泰晤士河畔私人庄园达成绝密备忘录：英日深层共享下一代战机与隐身雷达！',
    important: true,
    effects: [ { nat: 'GBR', stat: 'equip', value: 500 }, { nat: 'JPN', stat: 'attack', value: 0.2 } ]
  },
  {
    id: 'f_ev_wr_leak_scandal', week: 70,
    title: '[F] 伦敦密约泄密风波与英国内阁质询',
    desc: '[F] 泰晤士报头版披露“白厅灰色主教向远东出卖绝密技术”，王若伊从容面对下议院严厉质询化险为夷。',
    effects: [ { nat: 'GBR', stat: 'stability', value: -15 } ]
  },

  // —— 四人深层多极联动跨阵营事件 (§6.5) ——
  {
    id: 'f_ev_red_energy_clash', week: 82,
    title: '[F] 红场断供：葛修傅能源牌与小鹿能源独立正面对撞',
    desc: '[F] 葛修傅下令全面切断途经任何第三方管线的油气输送，小鹿紧急动员全球美商能源船队补位，全球能源市场剧烈震荡！',
    important: true,
    effects: [ { nat: 'RUS', stat: 'prestige', value: 20 }, { nat: 'USA', stat: 'civOutput', value: 0.15 }, { nat: 'GER', stat: 'stability', value: -20 } ]
  },
  {
    id: 'f_ev_atlantic_rift', week: 96,
    title: '[F] 大西洋的裂缝：小鹿与王若伊的双面博弈危机',
    desc: '[F] 白宫情报总监向小鹿汇报英国与外部势力的暗盘往来，小鹿当面质问王若伊，英美特别关系面临战后最严峻考验。',
    important: true,
    effects: [ { nat: 'USA', stat: 'stability', value: -10 }, { nat: 'GBR', stat: 'stability', value: -10 } ]
  },
  {
    id: 'f_ev_final_reckoning', week: 115,
    title: '[F] 最后的抉择：四位人物共同谱写多极终局新秩序',
    desc: '[F] 葛修傅的钢铁前线、吉爱习的正常国家化、小鹿的务实大交易与王若伊的平衡筹码在日内瓦最终交汇，历史走入全新多极世界！',
    important: true,
    effects: [
      { nat: 'RUS', stat: 'stability', value: 30 },
      { nat: 'USA', stat: 'stability', value: 30 },
      { nat: 'JPN', stat: 'stability', value: 30 },
      { nat: 'GBR', stat: 'stability', value: 30 }
    ]
  }
];

export function checkModernEvents(world){
  const w = world.day; // 现代副本以周为 tick
  const triggered = [];

  // 1. 每周日历历史与机制事件
  for(const ev of MODERN_EVENTS){
    if(ev.week === w && !world.events.some(e => e.id === ev.id)){
      const item = {
        id: ev.id,
        day: w,
        important: ev.important || false,
        text: `【${ev.title}】\n${ev.desc}`
      };
      triggered.push(item);

      if(ev.effects){
        for(const eff of ev.effects){
          const n = world.nations[eff.nat];
          if(n){
            if(eff.stat === 'capitulated'){
              n.capitulated = eff.value;
            } else if(eff.stat === 'stability' || eff.stat === 'warSupport' || eff.stat === 'prestige'){
              n[eff.stat] = Math.max(0, Math.min(100, (n[eff.stat] || 50) + eff.value));
            } else {
              n.modifiers[eff.stat] = (n.modifiers[eff.stat] || 0) + eff.value;
            }
          }
        }
      }
    }
  }

  // 2. 现代「至暗时刻链」（玩家失地 ≥40% 触发保底动员）
  const playerNat = world.nations[world.player];
  if(playerNat && !playerNat.darkHourTriggered){
    const initOwned = world.hexes.filter(h => h._orig === world.player).length;
    const currentOwned = world.hexes.filter(h => h.owner === world.player).length;
    if(initOwned > 0 && (initOwned - currentOwned) / initOwned >= 0.40){
      playerNat.darkHourTriggered = true;
      const item = {
        type: 'dark_hour',
        day: w,
        important: true,
        text: `🔥【至暗时刻·绝地动员】${playerNat.name} 领土失守超过 40%，触发最高战时危急总动员法！全军组织度恢复 +30%，免费调集战略后备步兵！`
      };
      triggered.push(item);
      playerNat.modifiers.org_recovery = (playerNat.modifiers.org_recovery || 0) + 0.3;
      playerNat.modifiers.defense = (playerNat.modifiers.defense || 0) + 0.25;
      playerNat.equip += 800;
    }
  }

  return triggered;
}
