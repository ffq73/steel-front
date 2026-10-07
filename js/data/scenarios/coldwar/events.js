/* ============================================================
   data/scenarios/coldwar/events.js —— 冷战 55 大历史与机制事件全案
   （月度粒度：M+1 至 M+511，含柏林封锁、古巴导弹危机、太空竞赛、代理人战争）
   ============================================================ */

import { escalateDoomsdayClock } from '../../../engine/nuclear.js';

export const COLDWAR_EVENTS = [
  {
    id: 'cw_berlin_blockade', month: 1,
    title: '柏林空中走廊与封锁解除',
    desc: '西方盟国实施史上最大规模全天候空中运输走廊，苏联随后解除对西柏林的水陆封锁。',
    important: true,
    effects: [ { nat: 'USA', stat: 'prestige', value: 20 }, { nat: 'GER_W', stat: 'stability', value: 15 } ]
  },
  {
    id: 'cw_nato_founded', month: 2,
    title: '北大西洋公约组织宣告成立',
    desc: '十二国在华盛顿签署《北大西洋公约》，建立集体防御体系，冷战阵营对抗体制化。',
    important: true,
    effects: [ { nat: 'USA', stat: 'prestige', value: 20 } ]
  },
  {
    id: 'cw_soviet_first_nuke', month: 4,
    title: '第一闪电：苏联首颗原子弹试爆成功',
    desc: '塞米巴拉金斯克试验场蘑菇云升起，美国核垄断被彻底打破，冷战进入双核时代！',
    important: true,
    effects: [ { nat: 'SOV', stat: 'prestige', value: 30 }, { nat: 'USA', stat: 'stability', value: -10 } ]
  },
  {
    id: 'cw_prc_founded', month: 5,
    title: '中华人民共和国开国大典',
    desc: '毛泽东在天安门城楼庄严宣告中央人民政府成立，占人类四分之一的中国人民站起来了！',
    important: true,
    effects: [ { nat: 'CHN', stat: 'stability', value: 35 }, { nat: 'SOV', stat: 'prestige', value: 20 } ]
  },
  {
    id: 'cw_korean_war_start', month: 13,
    title: '朝鲜战争爆发：三八线炮声轰鸣',
    desc: '半岛南北战事全线打响，朝鲜人民军迅速突破汉城，美国杜鲁门政府决定武装介入。',
    important: true,
    effects: [ { nat: 'PRK', stat: 'attack', value: 0.25 }, { nat: 'USA', stat: 'warSupport', value: 25 } ]
  },
  {
    id: 'cw_incheon_landing', month: 16,
    title: '麦克阿瑟仁川登陆成功',
    desc: '美军陆战第一师在仁川成功实施两栖登陆，截断人民军后方补给线，战局急转直下。',
    effects: [ { nat: 'USA', stat: 'attack', value: 0.2 } ]
  },
  {
    id: 'cw_pva_enters_korea', month: 17,
    title: '中国人民志愿军跨过鸭绿江参战！',
    desc: '彭德怀率志愿军雄赳赳气昂昂跨过鸭绿江，连续发动战役反击，将战线推回三八线附近！',
    important: true,
    effects: [ { nat: 'CHN', stat: 'attack', value: 0.3 }, { nat: 'CHN', stat: 'prestige', value: 30 }, { nat: 'USA', stat: 'warSupport', value: -15 } ]
  },
  {
    id: 'cw_korean_armistice', month: 50,
    title: '板门店停战协定签署',
    desc: '历时三年零一个月的朝鲜战争正式停火，双方在军事分界线各自后撤，冷战第一场大热战落幕。',
    important: true,
    effects: [ { nat: 'CHN', stat: 'stability', value: 20 }, { nat: 'USA', stat: 'stability', value: 15 } ]
  },
  {
    id: 'cw_bandung_conf', month: 71,
    title: '万隆亚非会议求同存异',
    desc: '周恩来总理提出和平共处五项原则，二十九个亚非国家团结反对殖民主义，不结盟运动孕育诞生。',
    important: true,
    effects: [ { nat: 'CHN', stat: 'prestige', value: 35 }, { nat: 'IND', stat: 'prestige', value: 25 } ]
  },
  {
    id: 'cw_warsaw_pact_signed', month: 72,
    title: '华沙条约组织正式缔结',
    desc: '面对西德加入北约，苏联与东欧七国在华沙缔结友好合作互助条约，欧洲两大军事集团全面对峙。',
    important: true,
    effects: [ { nat: 'SOV', stat: 'defense', value: 0.2 } ]
  },
  {
    id: 'cw_suez_crisis', month: 89,
    title: '苏伊士运河危机爆发',
    desc: '埃及收回运河，英法以联合进军西奈，美苏同时施加严厉外交与金融压力迫使英法撤军。',
    important: true,
    effects: [ { nat: 'EGY', stat: 'prestige', value: 30 }, { nat: 'GBR', stat: 'prestige', value: -30 }, { nat: 'FRA', stat: 'prestige', value: -20 } ]
  },
  {
    id: 'cw_hungary_1956', month: 90,
    title: '匈牙利十月事件与苏军整饬',
    desc: '布达佩斯爆发激烈政治动荡，苏军装甲部队开进平息危机，东方阵营内部出现剧烈震荡。',
    effects: [ { nat: 'SOV', stat: 'prestige', value: -15 }, { nat: 'HUN', stat: 'stability', value: 10 } ]
  },
  {
    id: 'cw_sputnik_launch', month: 101,
    title: '斯普特尼克一号升空：太空竞赛开幕',
    desc: '苏联发射人类第一颗人造地球卫星，其无线电蜂鸣声传遍全球，美国举国陷入“斯普特尼克危机”。',
    important: true,
    effects: [ { nat: 'SOV', stat: 'prestige', value: 45 }, { nat: 'USA', stat: 'prestige', value: -15 } ]
  },
  {
    id: 'cw_gagarin_space', month: 143,
    title: '加加林飞天：东方一号遨游寰宇',
    desc: '尤里·加加林成为进入太空的第一人，高呼“出发吧！”，苏联在载人航天领域再次领跑世界！',
    important: true,
    effects: [ { nat: 'SOV', stat: 'prestige', value: 40 } ]
  },
  {
    id: 'cw_bay_of_pigs', month: 143,
    title: '猪湾事件惨败：流亡军全军覆灭',
    desc: '中央情报局策划的古巴流亡分子两栖入侵在吉隆滩被卡斯特罗军队迅速全歼，肯尼迪政府威信大挫。',
    effects: [ { nat: 'CUB', stat: 'stability', value: 30 }, { nat: 'USA', stat: 'prestige', value: -20 } ]
  },
  {
    id: 'cw_berlin_wall_built', month: 147,
    title: '柏林墙开始修筑：铁幕实体化',
    desc: '东德安全部队在东西柏林分界线连夜拉起铁丝网并筑起高墙，两德与东西欧分裂彻底固化。',
    important: true,
    effects: [ { nat: 'GER_E', stat: 'stability', value: 20 }, { nat: 'USA', stat: 'prestige', value: -10 } ]
  },
  {
    id: 'cw_belgrade_nam', month: 148,
    title: '贝尔格莱德首届不结盟国家首脑会议',
    desc: '铁托、尼赫鲁与纳赛尔联合发表宣言，确立不依附美苏任何一大军事集团的独立中立立场。',
    effects: [ { nat: 'YUG', stat: 'prestige', value: 30 }, { nat: 'IND', stat: 'prestige', value: 20 } ]
  },
  {
    id: 'cw_cuban_missile_crisis', month: 161,
    title: '古巴导弹危机：人类最接近核战争的十三天',
    desc: 'U-2侦察机拍到苏联在古巴部署中程核弹道导弹，肯尼迪下令对古巴实施海上封锁隔离！',
    important: true,
    effects: [
      { nat: 'USA', stat: 'warSupport', value: 30 }
    ],
    onTrigger(world){
      escalateDoomsdayClock(world, 4.0, '古巴导弹危机爆发，美苏核舰队大西洋直接对峙');
    }
  },
  {
    id: 'cw_cuban_missile_peace', month: 162,
    title: '赫鲁晓夫同意撤除导弹：危机化解',
    desc: '美苏达成秘密协议：苏联撤出古巴核导弹，美国承诺不入侵古巴并秘密撤除驻土耳其木星导弹。',
    important: true,
    effects: [ { nat: 'USA', stat: 'stability', value: 25 }, { nat: 'SOV', stat: 'stability', value: 15 } ]
  },
  {
    id: 'cw_partial_test_ban', month: 171,
    title: '部分禁止核试验条约签署',
    desc: '美英苏签署条约禁止在大气层、外层空间和水下进行核武器试验，美苏开通莫斯科-华盛顿热线。',
    effects: [ { nat: 'USA', stat: 'stability', value: 15 }, { nat: 'SOV', stat: 'stability', value: 15 } ]
  },
  {
    id: 'cw_gulf_of_tonkin', month: 183,
    title: '北部湾事件与美军升级越战',
    desc: '美国驱逐舰与北越鱼雷艇在北部湾交火，美国国会通过决议授权总统在东南亚动用武装力量。',
    effects: [ { nat: 'USA', stat: 'warSupport', value: 20 } ]
  },
  {
    id: 'cw_china_first_nuke', month: 185,
    title: '中国首颗原子弹罗布泊试爆成功！',
    desc: '西北大漠腾起巨大蘑菇云，中国打破超级大国核讹诈，庄严承诺不首先使用核武器！',
    important: true,
    effects: [ { nat: 'CHN', stat: 'prestige', value: 45 }, { nat: 'CHN', stat: 'defense', value: 0.25 } ]
  },
  {
    id: 'cw_vietnam_boots_ground', month: 190,
    title: '美军地面部队大规模进驻越南',
    desc: '数万名美国海军陆战队员在岘港登陆，越南战争迅速演变为数十万美军卷入的残酷丛林消耗战。',
    effects: [ { nat: 'USA', stat: 'stability', value: -15 } ]
  },
  {
    id: 'cw_france_leaves_nato_command', month: 202,
    title: '戴高乐宣布法国退出北约军事一体化',
    desc: '戴高乐总统坚持法国战略自主与独立核威慑，要求外国军队限期撤离法国领土。',
    important: true,
    effects: [ { nat: 'FRA', stat: 'prestige', value: 30 }, { nat: 'USA', stat: 'prestige', value: -15 } ]
  },
  {
    id: 'cw_six_day_war', month: 217,
    title: '六日战争：以色列先发制人闪击大捷',
    desc: '以军空军数小时内摧毁埃及空军主力，占领西奈半岛、戈兰高地与约旦河西岸。',
    important: true,
    effects: [ { nat: 'ISR', stat: 'attack', value: 0.25 }, { nat: 'EGY', stat: 'stability', value: -25 } ]
  },
  {
    id: 'cw_prague_spring', month: 224,
    title: '布拉格之春：带有人道面孔的社会主义',
    desc: '杜布切克当选捷共第一书记，发起废除新闻审查与政治经济改革，东方阵营暗流涌动。',
    important: true,
    effects: [ { nat: 'CZE', stat: 'prestige', value: 25 }, { nat: 'SOV', stat: 'stability', value: -10 } ]
  },
  {
    id: 'cw_danube_operation', month: 231,
    title: '华约联军开进布拉格：多瑙河行动',
    desc: '苏军与华约多国数十万部队与数千辆坦克夜袭布拉格，强行终止改革，有限主权论付诸实施。',
    important: true,
    effects: [ { nat: 'SOV', stat: 'prestige', value: -30 }, { nat: 'CZE', stat: 'stability', value: -20 } ]
  },
  {
    id: 'cw_zhenbao_island', month: 238,
    title: '珍宝岛武装冲突：中苏关系彻底破裂',
    desc: '中苏边防部队在乌苏里江珍宝岛爆发激烈武装交火，苏联一度考虑对华实施外科手术核打击。',
    important: true,
    effects: [ { nat: 'CHN', stat: 'defense', value: 0.2 }, { nat: 'SOV', stat: 'stability', value: -10 } ]
  },
  {
    id: 'cw_apollo_11', month: 242,
    title: '阿波罗11号登月：个人一小步人类一大步',
    desc: '阿姆斯特朗踏上月球宁静海表面，全美数亿人热泪盈眶，美国在太空竞赛中赢得终极象征胜利！',
    important: true,
    effects: [ { nat: 'USA', stat: 'prestige', value: 50 }, { nat: 'USA', stat: 'stability', value: 25 } ]
  },
  {
    id: 'cw_ping_pong_diplomacy', month: 263,
    title: '小球转动大球：中美乒乓外交破冰',
    desc: '美国乒乓球队应邀访华，周恩来总理亲切接见，中美二十余年隔绝冰山初见消融。',
    important: true,
    effects: [ { nat: 'CHN', stat: 'prestige', value: 25 }, { nat: 'USA', stat: 'prestige', value: 25 } ]
  },
  {
    id: 'cw_china_un_seat', month: 270,
    title: '联合国大会第2758号决议通过',
    desc: '联大以压倒性多数通过决议，恢复中华人民共和国在联合国的一切合法权利与安理会常任理事国地位！',
    important: true,
    effects: [ { nat: 'CHN', stat: 'prestige', value: 50 }, { nat: 'USA', stat: 'prestige', value: -15 } ]
  },
  {
    id: 'cw_nixon_visits_china', month: 273,
    title: '尼克松访华：改变世界的一周',
    desc: '尼克松跨越大洋在北京机场与周恩来热烈握手，中美发表《上海公报》，全球大三角格局确立！',
    important: true,
    effects: [ { nat: 'USA', stat: 'prestige', value: 35 }, { nat: 'CHN', stat: 'stability', value: 25 } ]
  },
  {
    id: 'cw_salt_1_treaty', month: 276,
    title: '美苏签署第一阶段限制战略武器条约SALT I',
    desc: '尼克松与勃列日涅夫在莫斯科签署条约与反导条约ABM，大国核军备竞赛进入协议规管时代。',
    effects: [ { nat: 'USA', stat: 'stability', value: 20 }, { nat: 'SOV', stat: 'stability', value: 20 } ]
  },
  {
    id: 'cw_yom_kippur_war', month: 293,
    title: '第四次中东战争：赎罪日突袭与西奈反击',
    desc: '埃及渡过运河突破巴列夫防线，叙利亚突击戈兰高地；以军随后在沙龙指挥下实施反合围。',
    important: true,
    effects: [ { nat: 'ISR', stat: 'defense', value: 0.2 }, { nat: 'EGY', stat: 'prestige', value: 20 } ]
  },
  {
    id: 'cw_first_oil_crisis', month: 294,
    title: '第一次石油危机：欧佩克实施石油禁运',
    desc: '阿拉伯产油国联手大幅提升原油标价并对亲以西方国家禁运，西方世界陷入二战后最严重经济滞胀。',
    important: true,
    effects: [ { nat: 'USA', stat: 'milOutput', value: -0.2 }, { nat: 'GBR', stat: 'milOutput', value: -0.25 }, { nat: 'SAU', stat: 'prestige', value: 35 } ]
  },
  {
    id: 'cw_paris_peace_accords', month: 286,
    title: '巴黎和平协定签署美军全面撤出越南',
    desc: '基辛格与黎德寿签署协定，美军作战部队完全撤离南越，旷日持久的印支噩梦对美落幕。',
    effects: [ { nat: 'USA', stat: 'stability', value: 20 } ]
  },
  {
    id: 'cw_fall_of_saigon', month: 311,
    title: '西贡陷落：越南南北正式统一',
    desc: '北越坦克冲入南越总统府铁门，美国直升机从使馆屋顶撤离最后人员，越南战争全线胜利结束！',
    important: true,
    effects: [ { nat: 'VNM', stat: 'stability', value: 40 }, { nat: 'USA', stat: 'prestige', value: -25 } ]
  },
  {
    id: 'cw_helsinki_accords', month: 315,
    title: '赫尔辛基最后文件签署',
    desc: '三十五国在芬兰签署协定，西方正式承认二战后欧洲现有边界不可侵犯，换取人权条款承诺。',
    important: true,
    effects: [ { nat: 'SOV', stat: 'prestige', value: 25 }, { nat: 'USA', stat: 'prestige', value: 20 } ]
  },
  {
    id: 'cw_china_reform_opening', month: 355,
    title: '中国十一届三中全会：改革开放春雷',
    desc: '邓小平主持确立实事求是思想路线，将全党工作重心转移到经济建设上来，中国开启腾飞之路！',
    important: true,
    effects: [ { nat: 'CHN', stat: 'civOutput', value: 0.35 }, { nat: 'CHN', stat: 'stability', value: 30 } ]
  },
  {
    id: 'cw_iran_revolution', month: 356,
    title: '伊朗伊斯兰革命：巴列维王朝覆灭',
    desc: '霍梅尼乘机重返德黑兰，亲美的巴列维国王流亡海外，伊朗伊斯兰共和国建立，中东格局大变！',
    important: true,
    effects: [ { nat: 'IRN', stat: 'stability', value: 35 }, { nat: 'USA', stat: 'prestige', value: -25 } ]
  },
  {
    id: 'cw_iran_hostage_crisis', month: 365,
    title: '德黑兰美国大使馆人质危机',
    desc: '伊朗学生占领美国使馆扣押52名人质长达444天，鹰爪营救行动在沙漠遭遇机毁人亡惨败。',
    effects: [ { nat: 'USA', stat: 'prestige', value: -30 }, { nat: 'USA', stat: 'stability', value: -15 } ]
  },
  {
    id: 'cw_soviet_afghan_invasion', month: 367,
    title: '苏联出兵阿富汗：“帝国坟场”的泥潭',
    desc: '苏军精锐空降兵突袭喀布尔阿明宫，数十万苏军大举越界，陷入长达十年的残酷游击消耗战。',
    important: true,
    effects: [ { nat: 'SOV', stat: 'prestige', value: -35 }, { nat: 'SOV', stat: 'milOutput', value: -0.15 } ]
  },
  {
    id: 'cw_moscow_olympics_boycott', month: 374,
    title: '西方大举抵制莫斯科奥运会',
    desc: '以美国为首的六十余个国家因苏联入侵阿富汗联合抵制莫斯科夏奥会，冷战文化对立登峰造极。',
    effects: [ { nat: 'SOV', stat: 'prestige', value: -20 } ]
  },
  {
    id: 'cw_poland_solidarity', month: 375,
    title: '波兰团结工会运动在格但斯克爆发',
    desc: '瓦文萨领导造船厂工人大罢工并成立独立自治工会，东欧剧变的前奏在波罗的海之滨响起。',
    effects: [ { nat: 'POL', stat: 'stability', value: -20 } ]
  },
  {
    id: 'cw_reagan_sdi_speech', month: 406,
    title: '里根发表星球大战演说：战略防御倡议',
    desc: '美国宣布研发天基激光与反导卫星拦截苏联弹道导弹，在经济与技术前沿全方位施压苏联。',
    important: true,
    effects: [ { nat: 'USA', stat: 'prestige', value: 30 }, { nat: 'SOV', stat: 'stability', value: -15 } ]
  },
  {
    id: 'cw_gorbachev_general_sec', month: 430,
    title: '戈尔巴乔夫就任苏共中央总书记',
    desc: '五十四岁的年轻改革派戈尔巴乔夫入主克里姆林宫，全面推行公开化与加速发展战略。',
    important: true,
    effects: [ { nat: 'SOV', stat: 'prestige', value: 25 } ]
  },
  {
    id: 'cw_chernobyl_disaster', month: 443,
    title: '切尔诺贝利核事故：静默的灾难',
    desc: '四号反应堆剧烈爆炸释放巨量放射性尘埃，苏联动员数十万清理人抢险，财政与体制公信力重创。',
    important: true,
    effects: [ { nat: 'SOV', stat: 'stability', value: -35 }, { nat: 'SOV', stat: 'milOutput', value: -0.15 } ]
  },
  {
    id: 'cw_reykjavik_summit', month: 449,
    title: '雷克雅未克首脑峰会：历史性接触',
    desc: '里根与戈尔巴乔夫在冰岛霍夫迪别墅通宵谈判，几乎就销毁全部核武器达成意向，冷战坚冰裂解。',
    effects: [ { nat: 'USA', stat: 'stability', value: 20 }, { nat: 'SOV', stat: 'stability', value: 20 } ]
  },
  {
    id: 'cw_inf_treaty_signed', month: 463,
    title: '美苏签署《中导条约》',
    desc: '美苏首次达成不仅限制而且彻底销毁整整一类核武器的条约，欧洲前沿紧张局势空前缓和。',
    important: true,
    effects: [ { nat: 'USA', stat: 'prestige', value: 30 }, { nat: 'SOV', stat: 'prestige', value: 30 } ]
  },
  {
    id: 'cw_soviet_leaves_afghanistan', month: 477,
    title: '苏军第40集团军完全撤离阿富汗',
    desc: '格罗莫夫将军徒步走过阿姆河友谊大桥，长达九年两月的阿富汗血腥消耗战彻底告终。',
    effects: [ { nat: 'SOV', stat: 'stability', value: 15 } ]
  },
  {
    id: 'cw_fall_of_berlin_wall', month: 486,
    title: '柏林墙倒塌：铁幕彻底瓦解！',
    desc: '1989年11月9日夜，沙博夫斯基口误后成千上万东柏林市民涌向检查站，冷战标志性巨墙在欢歌中坍塌！',
    important: true,
    effects: [ { nat: 'GER_W', stat: 'stability', value: 40 }, { nat: 'GER_E', stat: 'capitulated', value: true } ]
  },
  {
    id: 'cw_german_reunification', month: 497,
    title: '两德正式统一：德意志重归一体',
    desc: '东德五大州正式并入联邦德国，两德在二战分裂四十五年后再次合二为一，欧洲新格局开启。',
    important: true,
    effects: [ { nat: 'GER_W', stat: 'prestige', value: 35 }, { nat: 'GER_W', stat: 'stability', value: 30 } ]
  },
  {
    id: 'cw_warsaw_pact_dissolved', month: 506,
    title: '华沙条约组织正式宣告解散',
    desc: '各成员国外长与防长在布拉格签署议定书，存在三十六年的华沙条约军事同盟寿终正寝。',
    important: true,
    effects: [ { nat: 'SOV', stat: 'prestige', value: -40 } ]
  },
  {
    id: 'cw_soviet_dissolution', month: 511,
    title: '苏联解体红旗降下：冷战半世纪终局',
    desc: '1991年12月25日夜，克里姆林宫顶端苏联镰刀铁锤红旗缓缓降下，俄罗斯三色旗升起，冷战历史正式画上句号！',
    important: true,
    effects: [ { nat: 'SOV', stat: 'capitulated', value: true }, { nat: 'USA', stat: 'prestige', value: 60 } ]
  },
  {
    id: 'cw_congo_crisis', month: 135,
    title: '刚果危机爆发与联合国维和',
    desc: '加丹加宣布独立，卢蒙巴总理遇害，联合国维和部队首次卷入重武器维和实战。',
    effects: [ { nat: 'USA', stat: 'stability', value: -5 } ]
  }
];

export function checkColdWarEvents(world){
  const m = world.day; // 冷战以月为 tick
  const triggered = [];

  for(const ev of COLDWAR_EVENTS){
    if(ev.month === m && !world.events.some(e => e.id === ev.id)){
      const item = {
        id: ev.id,
        day: m,
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

      if(ev.onTrigger) ev.onTrigger(world);
    }
  }

  return triggered;
}
