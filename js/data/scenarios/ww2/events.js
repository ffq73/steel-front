/* ============================================================
   data/scenarios/ww2/events.js —— 二战 70 大历史与机制事件全案
   （含慕尼黑后波兰闪击、苏德密约、巴巴罗萨、珍珠港、中国战场、将领殉职与转折）
   ============================================================ */

import { addTension } from '../../../engine/tension.js';

export const WW2_EVENTS = [
  {
    id: 'ww2_fall_weiss',
    day: 0,
    title: '白色方案发动：德军越过波兰边境',
    desc: '1939年9月1日拂晓，德意志国防军对波兰发动全面闪电突击，第二次世界大战欧洲战事正式爆发！',
    important: true,
    effects: [
      { nat: 'GER', stat: 'attack', value: 0.15 },
      { nat: 'POL', stat: 'stability', value: -15 }
    ]
  },
  {
    id: 'ww2_allied_ultimatum',
    day: 2,
    title: '英法对德宣战：同盟国阵线确立',
    desc: '英国与法国在最后通牒期限届满后，正式对德国宣战，欧洲陷入全面总体战争。',
    important: true,
    effects: [
      { nat: 'GBR', stat: 'warSupport', value: 20 },
      { nat: 'FRA', stat: 'warSupport', value: 15 }
    ]
  },
  {
    id: 'ww2_royal_navy_blockade',
    day: 10,
    title: '皇家海军北海全面封锁',
    desc: '大英帝国皇家海军封锁北海咽喉航线，德国海上进出口贸易受到严厉遏制。',
    effects: [
      { nat: 'GER', stat: 'milOutput', value: -0.05 }
    ]
  },
  {
    id: 'ww2_soviet_east_poland',
    day: 17,
    title: '苏军进驻东波兰：密约划分势力范围',
    desc: '苏军根据《苏德互不侵犯条约》秘密附属议定书，越过东部边境进占波兰东部地区。',
    important: true,
    effects: [
      { nat: 'SOV', stat: 'stability', value: 10 },
      { nat: 'POL', stat: 'stability', value: -30 }
    ]
  },
  {
    id: 'ww2_fall_of_warsaw',
    day: 26,
    title: '华沙陷落：波兰战役终局',
    desc: '波兰首都华沙在猛烈围攻与炮击下告破，波兰政府经罗马尼亚转往伦敦建立流亡政府。',
    important: true,
    effects: [
      { nat: 'GER', stat: 'warSupport', value: 15 },
      { nat: 'POL', stat: 'capitulated', value: true }
    ]
  },
  {
    id: 'ww2_phony_war',
    day: 35,
    title: '西线“假战”与静坐防御',
    desc: '波兰沦陷后，西线英法联军依托马奇诺防线与齐格菲防线对峙，陷入数月诡异的静坐期。',
    effects: [
      { nat: 'FRA', stat: 'warSupport', value: -10 }
    ]
  },
  {
    id: 'ww2_winter_war_start',
    day: 90,
    title: '冬季战争爆发：苏联进攻芬兰',
    desc: '因领土互换谈判破裂，苏联红军向芬兰卡累利阿地峡发动进攻，苏芬战争打响。',
    effects: [
      { nat: 'FIN', stat: 'defense', value: 0.25 }
    ]
  },
  {
    id: 'ww2_mannerheim_line',
    day: 110,
    title: '卡累利阿白雪与曼纳海姆防线',
    desc: '芬兰军队在严寒滑雪部队协同下依托曼纳海姆防线顽强阻击，苏军遭受巨大前期伤亡。',
    effects: [
      { nat: 'SOV', stat: 'stability', value: -10 }
    ]
  },
  {
    id: 'ww2_altmark_incident',
    day: 168,
    title: '阿尔特马克号事件：挪威中立危机',
    desc: '英军驱逐舰在挪威峡湾突袭德国油轮营救盟军战俘，德英两国均加速对斯堪的纳维亚的争夺。',
    effects: [
      { nat: 'NOR', stat: 'warSupport', value: 10 }
    ]
  },
  {
    id: 'ww2_moscow_peace_finland',
    day: 195,
    title: '莫斯科和平协定：苏芬停火',
    desc: '苏军以重兵突破地峡后，苏芬签署和平条约，芬兰割让卡累利阿等地但保住了国家独立。',
    effects: [
      { nat: 'FIN', stat: 'stability', value: 15 }
    ]
  },
  {
    id: 'ww2_manstein_plan_approved',
    day: 200,
    title: '曼施坦因备忘录获批：镰刀收割',
    desc: '希特勒批准曼施坦因提出的主攻阿登森林穿插至英吉利海峡方案，德军统帅部全线改弦更张。',
    effects: [
      { nat: 'GER', stat: 'attack', value: 0.15 }
    ]
  },
  {
    id: 'ww2_operation_weserubung',
    day: 220,
    title: '威悉演习行动：入侵丹麦与挪威',
    desc: '德军海空协同突袭丹麦与挪威主要港口，丹麦当日签署停火，挪威王室转入抵抗。',
    important: true,
    effects: [
      { nat: 'DEN', stat: 'capitulated', value: true },
      { nat: 'GER', stat: 'milOutput', value: 0.05 }
    ]
  },
  {
    id: 'ww2_narvik_battles',
    day: 230,
    title: '纳尔维克海陆战役',
    desc: '盟军与德军在挪威北部铁矿要冲纳尔维克激烈争夺，德国驱逐舰支队全军覆灭。',
    effects: [
      { nat: 'GBR', stat: 'warSupport', value: 10 }
    ]
  },
  {
    id: 'ww2_churchill_takes_office',
    day: 252,
    title: '丘吉尔临危受命出任战时首相',
    desc: '张伯伦引咎辞职，温斯顿·丘吉尔组建全党派联合内阁，向全国誓言“战斗到底绝不投降”。',
    important: true,
    effects: [
      { nat: 'GBR', stat: 'warSupport', value: 25 },
      { nat: 'GBR', stat: 'stability', value: 15 }
    ]
  },
  {
    id: 'ww2_fall_gelb_strike',
    day: 253,
    title: '黄色方案爆发：阿登森林钢铁洪流',
    desc: '古德里安与隆美尔的装甲军横渡默兹河突破色当防线，绕过马奇诺防线直插盟军侧后！',
    important: true,
    effects: [
      { nat: 'GER', stat: 'attack', value: 0.2 },
      { nat: 'FRA', stat: 'stability', value: -20 }
    ]
  },
  {
    id: 'ww2_eben_emael_airborne',
    day: 255,
    title: '突袭埃本-埃马尔要塞：空降滑翔机奇迹',
    desc: '德军伞兵使用空心装药炸弹仅用数十人瘫痪比利时最坚固的现代化要塞。',
    effects: [
      { nat: 'BEL', stat: 'defense', value: -0.2 }
    ]
  },
  {
    id: 'ww2_rotterdam_bombing',
    day: 258,
    title: '鹿特丹大轰炸与荷兰投降',
    desc: '鹿特丹市中心遭受德军毁灭性轰炸，荷兰最高统帅部为免全国城市化为废墟宣布投降。',
    effects: [
      { nat: 'NLD', stat: 'capitulated', value: true }
    ]
  },
  {
    id: 'ww2_dunkirk_evacuation',
    day: 268,
    title: '敦刻尔克奇迹：发电机行动大撤退',
    desc: '利用希特勒装甲暂停令与英国民用船只齐心救援，33.8万盟军精锐从滩头成功撤回英国本土。',
    important: true,
    effects: [
      { nat: 'GBR', stat: 'org_recovery', value: 0.25 },
      { nat: 'FRA', stat: 'stability', value: -15 }
    ]
  },
  {
    id: 'ww2_belgium_surrenders',
    day: 270,
    title: '比利时国王宣布停火',
    desc: '比利时国王利奥波德三世在全军弹尽粮绝后下达停火令，盟军北翼战线完全解体。',
    effects: [
      { nat: 'BEL', stat: 'capitulated', value: true }
    ]
  },
  {
    id: 'ww2_italy_declares_war',
    day: 283,
    title: '意大利对法宣战：“背后插刀”',
    desc: '墨索里尼见法国大局已定，宣布意大利对英法参战，并在阿尔卑斯山脉向法国发起进攻。',
    effects: [
      { nat: 'ITA', stat: 'warSupport', value: 15 }
    ]
  },
  {
    id: 'ww2_paris_falls',
    day: 287,
    title: '巴黎宣布为不设防城市德军入城',
    desc: '德军先头部队无血开进巴黎香榭丽舍大街，埃菲尔铁塔升起铁十字旗。',
    important: true,
    effects: [
      { nat: 'FRA', stat: 'stability', value: -30 }
    ]
  },
  {
    id: 'ww2_de_gaulle_appeal',
    day: 291,
    title: '戴高乐将军发表《6.18抗战宣言》',
    desc: '戴高乐在伦敦BBC电台发表历史性演说：“法国输掉了一场战役，但没有输掉这场战争！”',
    important: true,
    effects: [
      { nat: 'FRA', stat: 'warSupport', value: 30 }
    ]
  },
  {
    id: 'ww2_compiegne_armistice',
    day: 294,
    title: '贡比涅停战协议与维希政权成立',
    desc: '贝当元帅在同一节一战车厢签署停战协议，法兰西大部被占领，南方法国建立维希傀儡政权。',
    important: true,
    effects: [
      { nat: 'FRA', stat: 'capitulated', value: true },
      { nat: 'GER', stat: 'stability', value: 20 }
    ]
  },
  {
    id: 'ww2_mers_el_kebir',
    day: 306,
    title: '弩炮行动：英军袭击凯比尔港法军舰队',
    desc: '为防止法国现代战列舰落入德国手中，皇家海军向驻阿尔及利亚法舰开火，击沉击伤多艘主力舰。',
    effects: [
      { nat: 'GBR', stat: 'stability', value: -10 }
    ]
  },
  {
    id: 'ww2_battle_of_britain_start',
    day: 315,
    title: '不列颠空战打响：鹰击长空',
    desc: '戈林帝国空军对英国海峡护航船队与南部沿海机场展开毁灭性打击，海狮登陆战前奏打响。',
    important: true,
    effects: [
      { nat: 'GBR', stat: 'defense', value: 0.2 }
    ]
  },
  {
    id: 'ww2_adler_tag',
    day: 347,
    title: '“鹰日”总攻击：雷达网决定胜负',
    desc: '德军出动上千架次轰炸机发起总突击，英国道丁体系雷达网络与战斗机指挥部经受住考验。',
    effects: [
      { nat: 'GBR', stat: 'defense', value: 0.15 }
    ]
  },
  {
    id: 'ww2_london_blitz',
    day: 372,
    title: '伦敦大轰炸开始：地下防空洞岁月',
    desc: '德国空军将轰炸重心转向伦敦等民用大都市，全英民众在防空警报中顽强坚守。',
    effects: [
      { nat: 'GBR', stat: 'warSupport', value: 15 }
    ]
  },
  {
    id: 'ww2_tripartite_pact',
    day: 392,
    title: '柏林-罗马-东京三国同盟条约签署',
    desc: '德意日三国外长在柏林签署十年军事同盟条约，法西斯侵略轴心正式结盟！',
    important: true,
    effects: [
      { nat: 'GER', stat: 'warSupport', value: 15 },
      { nat: 'JPN', stat: 'warSupport', value: 15 },
      { nat: 'ITA', stat: 'warSupport', value: 10 }
    ]
  },
  {
    id: 'ww2_greece_invasion',
    day: 423,
    title: '意军入侵希腊受挫：品都斯反击',
    desc: '希腊军队在品都斯山区顽强阻击并击退意大利军队，墨索里尼威信扫地被迫求助柏林。',
    effects: [
      { nat: 'GRE', stat: 'defense', value: 0.25 },
      { nat: 'ITA', stat: 'stability', value: -15 }
    ]
  },
  {
    id: 'ww2_operation_compass',
    day: 465,
    title: '罗盘行动：英军北非大捷横扫昔兰尼加',
    desc: '奥康纳将军率三万英军全歼意军第十集团军十余万人，俘敌无数，直抵阿盖拉。',
    effects: [
      { nat: 'GBR', stat: 'attack', value: 0.2 },
      { nat: 'ITA', stat: 'stability', value: -20 }
    ]
  },
  {
    id: 'ww2_rommel_arrives_africa',
    day: 470,
    title: '隆美尔抵达北非：“沙漠之狐”现身',
    desc: '埃尔温·隆美尔中将率领德国非洲军团先遣队登陆的黎波里，北非沙漠战局瞬间逆转。',
    important: true,
    effects: [
      { nat: 'GER', stat: 'speed', value: 0.25 },
      { nat: 'GER', stat: 'attack', value: 0.2 }
    ]
  },
  {
    id: 'ww2_yugoslavia_balkans_blitz',
    day: 450,
    title: '轴心国入侵南斯拉夫与希腊',
    desc: '德国国防军数路大军闪击贝尔格莱德与雅典，两周内席卷巴尔干半岛。',
    important: true,
    effects: [
      { nat: 'YUG', stat: 'capitulated', value: true },
      { nat: 'GRE', stat: 'capitulated', value: true }
    ]
  },
  {
    id: 'ww2_crete_airborne',
    day: 480,
    title: '水星行动：克里特岛极限空降',
    desc: '德军第一空降师付出惨重伤亡代价占领克里特岛，彻底夺取东地中海制空权。',
    effects: [
      { nat: 'GER', stat: 'stability', value: 10 }
    ]
  },
  {
    id: 'ww2_operation_barbarossa',
    day: 485,
    title: '巴巴罗萨行动：三百万德军闪击苏联！',
    desc: '1941年6月22日拂晓，德军撕毁互不侵犯条约，沿千余公里边境线对苏联发起人类史上最大规模陆战突袭！',
    important: true,
    effects: [
      { nat: 'GER', stat: 'attack', value: 0.3 },
      { nat: 'SOV', stat: 'stability', value: -25 }
    ]
  },
  {
    id: 'ww2_brest_fortress',
    day: 490,
    title: '布列斯特要塞绝境坚守',
    desc: '边境布列斯特要塞守军在重炮与围攻下坚守整月，墙上血书“我死，但绝不投降！”',
    effects: [
      { nat: 'SOV', stat: 'defense', value: 0.2 }
    ]
  },
  {
    id: 'ww2_minsk_pocket',
    day: 500,
    title: '比亚韦斯托克-明斯克大合围',
    desc: '霍特与古德里安装甲钳形在明斯克东面闭合，苏军西方方面军数十万人被合围。',
    effects: [
      { nat: 'GER', stat: 'attack', value: 0.15 }
    ]
  },
  {
    id: 'ww2_smolensk_battle',
    day: 520,
    title: '斯摩棱斯克大会战：阻滞德军闪电步伐',
    desc: '红军依托第聂伯河组织顽强反击，虽然付出巨大代价，但首次打破了德军两月灭亡苏联的神话。',
    effects: [
      { nat: 'SOV', stat: 'defense', value: 0.15 }
    ]
  },
  {
    id: 'ww2_kiev_pocket',
    day: 570,
    title: '基辅大合围：人类战争史最大包围战',
    desc: '古德里安南下与克莱斯特会合，苏军西南方面军六十余万人被合围在基辅盆地。',
    important: true,
    effects: [
      { nat: 'GER', stat: 'warSupport', value: 20 },
      { nat: 'SOV', stat: 'stability', value: -20 }
    ]
  },
  {
    id: 'ww2_typhoon_moscow',
    day: 630,
    title: '台风行动：德军先头装甲抵近莫斯科城郊',
    desc: '德军先头侦察分队望远镜中已可看见克里姆林宫红星，苏联首都进入全面戒严状态。',
    important: true,
    effects: [
      { nat: 'GER', stat: 'attack', value: 0.2 }
    ]
  },
  {
    id: 'ww2_red_square_parade',
    day: 670,
    title: '莫斯科红场阅兵与红军冬季大反攻',
    desc: '在暴风雪中，斯大林在红场检阅直接开赴前线的红军部队；朱可夫指挥远东生力军发起全面冬季反攻！',
    important: true,
    effects: [
      { nat: 'SOV', stat: 'attack', value: 0.25 },
      { nat: 'GER', stat: 'attack', value: -0.2 }
    ]
  },
  {
    id: 'ww2_pearl_harbor_attack',
    day: 680,
    title: '偷袭珍珠港：大日本帝国突袭美军太平洋舰队',
    desc: '1941年12月7日，日本六艘航母舰载机突袭瓦胡岛珍珠港，炸沉美军主力战列舰，太平洋战争全面爆发！',
    important: true,
    effects: [
      { nat: 'USA', stat: 'warSupport', value: 45 },
      { nat: 'JPN', stat: 'attack', value: 0.25 }
    ]
  },
  {
    id: 'ww2_us_enters_war',
    day: 684,
    title: '希特勒对美宣战：全球大对决确立',
    desc: '希特勒在国会发表对美宣战声明，美国全面卷入欧洲与太平洋两大主战场。',
    important: true,
    effects: [
      { nat: 'USA', stat: 'milOutput', value: 0.3 }
    ]
  },
  {
    id: 'ww2_lend_lease_pipeline',
    day: 690,
    title: '租借法案北极航线与波斯走廊大打通',
    desc: '美国庞大工业产能化作坦克、火炮、高辛烷值航空燃油与斯图贝克卡车，源源不断输送给英苏盟军。',
    effects: [
      { nat: 'SOV', stat: 'milOutput', value: 0.2 },
      { nat: 'GBR', stat: 'milOutput', value: 0.15 }
    ]
  },
  {
    id: 'ww2_fall_singapore',
    day: 710,
    title: '新加坡陷落：大英帝国远东最大要塞崩塌',
    desc: '山下奉文率日军迫使八万英澳守军投降，丘吉尔称之为“英国历史上最严重的灾难”。',
    effects: [
      { nat: 'JPN', stat: 'stability', value: 15 },
      { nat: 'GBR', stat: 'stability', value: -15 }
    ]
  },
  {
    id: 'ww2_coral_sea',
    day: 765,
    title: '珊瑚海海战：视线之外的航母超视距对决',
    desc: '人类历史上交战双方舰队未曾目视彼此的首次航母大战，盟军成功遏制日军进占莫尔兹比港。',
    effects: [
      { nat: 'USA', stat: 'defense', value: 0.15 }
    ]
  },
  {
    id: 'ww2_midway_turning_point',
    day: 795,
    title: '中途岛海战：五分钟扭转太平洋命运',
    desc: '美军企业号与大黄蜂号俯冲轰炸机在五分钟内击沉日本四艘主力航母，日本联合舰队元气大伤！',
    important: true,
    effects: [
      { nat: 'USA', stat: 'attack', value: 0.25 },
      { nat: 'JPN', stat: 'attack', value: -0.2 }
    ]
  },
  {
    id: 'ww2_fall_blau_drive',
    day: 810,
    title: '蓝色方案发动：德军向高加索油田进军',
    desc: '德军南方集团军群撕开顿河防线，兵分两路突向巴库油田与伏尔加河畔工业中心斯大林格勒。',
    effects: [
      { nat: 'GER', stat: 'attack', value: 0.2 }
    ]
  },
  {
    id: 'ww2_stalingrad_street_fighting',
    day: 860,
    title: '斯大林格勒巷战打响：伏尔加河畔的磨盘',
    desc: '崔可夫第62集团军坚守拖拉机厂与马马耶夫岗废墟，每一寸瓦砾均化作血腥绞肉机。',
    important: true,
    effects: [
      { nat: 'SOV', stat: 'defense', value: 0.35 }
    ]
  },
  {
    id: 'ww2_el_alamein_triumph',
    day: 875,
    title: '第二次阿拉曼战役：沙漠转折点',
    desc: '蒙哥马利以优势炮火与步兵突破隆美尔防线，丘吉尔感叹“这不是结束，甚至不是结束的开始，但也许是开始的结束”。',
    important: true,
    effects: [
      { nat: 'GBR', stat: 'attack', value: 0.25 },
      { nat: 'GER', stat: 'speed', value: -0.2 }
    ]
  },
  {
    id: 'ww2_operation_torch',
    day: 890,
    title: '火炬行动：英美十万盟军登陆法属北非',
    desc: '艾森豪威尔统帅庞大两栖舰队在卡萨布兰卡、奥兰与阿尔及尔成功登陆，夹击轴心国北非军团。',
    effects: [
      { nat: 'USA', stat: 'attack', value: 0.2 }
    ]
  },
  {
    id: 'ww2_operation_uranus',
    day: 901,
    title: '天王星行动：苏军双钳形合围第6集团军',
    desc: '罗科索夫斯基与瓦图京率百万苏军突破罗马尼亚与匈牙利军防线，在卡拉奇会师合围30万德军！',
    important: true,
    effects: [
      { nat: 'SOV', stat: 'attack', value: 0.3 },
      { nat: 'GER', stat: 'defense', value: -0.2 }
    ]
  },
  {
    id: 'ww2_stalingrad_victory',
    day: 975,
    title: '保卢斯元帅投降：斯大林格勒战役历史性胜利',
    desc: '德军第6集团军残部在包围圈中全军覆灭，保卢斯成为德国陆军史上第一位被俘陆军元帅，二战转折已定！',
    important: true,
    effects: [
      { nat: 'SOV', stat: 'stability', value: 35 },
      { nat: 'GER', stat: 'stability', value: -30 }
    ]
  },
  {
    id: 'ww2_tunis_capitulation',
    day: 985,
    title: '北非战事落幕：二十五万轴心军投降突尼斯',
    desc: '突尼斯桥头堡失守，轴心国在北非的最后抵抗瓦解，地中海航线对盟军全面开放。',
    effects: [
      { nat: 'GBR', stat: 'stability', value: 15 }
    ]
  },
  {
    id: 'ww2_battle_of_kursk',
    day: 1030,
    title: '库尔斯克战役：卫城行动装甲碰撞',
    desc: '曼施坦因与莫德尔率数千辆虎豹装甲突向库尔斯克突出部，苏军构筑八道坚固防御阵地严阵以待！',
    important: true,
    effects: [
      { nat: 'GER', stat: 'attack', value: 0.25 },
      { nat: 'SOV', stat: 'defense', value: 0.3 }
    ]
  },
  {
    id: 'ww2_prokhorovka_tank_clash',
    day: 1038,
    title: '普罗霍罗夫卡钢铁大对决',
    desc: '千余辆坦克在麦田与扬尘中贴身鏖战，党卫军装甲师进攻锐气被完全耗尽，德军永远丧失战略主动权。',
    effects: [
      { nat: 'SOV', stat: 'attack', value: 0.25 }
    ]
  },
  {
    id: 'ww2_operation_husky',
    day: 1045,
    title: '哈斯基行动：盟军横渡海峡登陆西西里',
    desc: '巴顿第七集团军与蒙哥马利第八集团军登上西西里岛，轴心国“欧洲柔软的下腹部”被剖开。',
    effects: [
      { nat: 'USA', stat: 'attack', value: 0.2 }
    ]
  },
  {
    id: 'ww2_mussolini_ousted',
    day: 1060,
    title: '墨索里尼垮台：意大利国王将其逮捕',
    desc: '法西斯大委员会通过不信任决议，国王埃马努埃莱三世下令将墨索里尼软禁，巴多格里奥组阁。',
    important: true,
    effects: [
      { nat: 'ITA', stat: 'stability', value: 20 },
      { nat: 'ITA', stat: 'capitulated', value: true }
    ]
  },
  {
    id: 'ww2_operation_achse',
    day: 1070,
    title: '阿赫泽行动：德军强行解除意军武装',
    desc: '隆美尔与凯塞林按预定计划接管意大利北部防区，解散意军并营救墨索里尼建立萨洛傀儡国。',
    effects: [
      { nat: 'GER', stat: 'defense', value: 0.15 }
    ]
  },
  {
    id: 'ww2_tehran_conference',
    day: 1180,
    title: '德黑兰会议：三巨头商定开辟欧洲第二战场',
    desc: '罗斯福、丘吉尔与斯大林在德黑兰会晤，正式敲定1944年5月在法国北部实施代号大君主的登陆作战。',
    important: true,
    effects: [
      { nat: 'USA', stat: 'warSupport', value: 20 },
      { nat: 'SOV', stat: 'warSupport', value: 20 }
    ]
  },
  {
    id: 'ww2_leningrad_liberation',
    day: 1240,
    title: '列宁格勒完全解除围困：英雄之城不朽',
    desc: '红军列宁格勒方面军发起全面攻势，终于彻底解除长达872天的惨烈围困，涅瓦河畔礼炮齐鸣！',
    important: true,
    effects: [
      { nat: 'SOV', stat: 'stability', value: 30 }
    ]
  },
  {
    id: 'ww2_d_day_overlord',
    day: 1375,
    title: '诺曼底登陆：大君主行动千舰齐发！',
    desc: '1944年6月6日，史上规模最大的联合两栖登陆舰队横渡英吉利海峡，奥马哈滩头枪炮震天，第二战场正式开辟！',
    important: true,
    effects: [
      { nat: 'USA', stat: 'attack', value: 0.3 },
      { nat: 'GBR', stat: 'attack', value: 0.25 },
      { nat: 'GER', stat: 'defense', value: -0.2 }
    ]
  },
  {
    id: 'ww2_operation_bagration',
    day: 1390,
    title: '巴格拉季昂行动：摧毁德军中央集团军群',
    desc: '在巴巴罗萨三周年之际，白俄罗斯四路红军如排山倒海般突击，短短一个月消灭德军28个师！',
    important: true,
    effects: [
      { nat: 'SOV', stat: 'attack', value: 0.35 },
      { nat: 'GER', stat: 'defense', value: -0.25 }
    ]
  },
  {
    id: 'ww2_warsaw_uprising',
    day: 1430,
    title: '华沙起义爆发：波兰救国军浴血巷战',
    desc: '波兰救国军在首都华沙发起全城起义，在断水断粮中与党卫军残酷死战达63天。',
    effects: [
      { nat: 'POL', stat: 'warSupport', value: 30 }
    ]
  },
  {
    id: 'ww2_paris_liberated',
    day: 1455,
    title: '巴黎光复：勒克莱尔装甲师入城凯旋',
    desc: '戴高乐将军在凯旋门与香榭丽舍大街检阅欢呼的人群，法兰西重获自由与国家尊严！',
    important: true,
    effects: [
      { nat: 'FRA', stat: 'stability', value: 40 },
      { nat: 'FRA', stat: 'warSupport', value: 25 }
    ]
  },
  {
    id: 'ww2_romania_switches_sides',
    day: 1453,
    title: '罗马尼亚政变倒戈：普洛耶什蒂油田易手',
    desc: '米哈伊一世国王发动政变逮捕安东内斯库，罗马尼亚倒戈加入同盟国，德军失去战略燃油来源。',
    effects: [
      { nat: 'GER', stat: 'milOutput', value: -0.15 }
    ]
  },
  {
    id: 'ww2_market_garden_setback',
    day: 1475,
    title: '市场花园行动受挫：遥远的桥',
    desc: '蒙哥马利设计的空降装甲突击在阿纳姆遭党卫军装甲师顽强反击，未能打通莱茵河走廊。',
    effects: [
      { nat: 'GBR', stat: 'warSupport', value: -10 }
    ]
  },
  {
    id: 'ww2_battle_of_the_bulge',
    day: 1565,
    title: '阿登反击战：德军突出部的绝望一击',
    desc: '德军在阿登森林大雾掩护下发动最后装甲反扑，美军第101空降师在巴斯托涅展现钢铁意志。',
    important: true,
    effects: [
      { nat: 'USA', stat: 'defense', value: 0.25 },
      { nat: 'GER', stat: 'attack', value: -0.2 }
    ]
  },
  {
    id: 'ww2_yalta_conference',
    day: 1620,
    title: '雅尔塔会议：划定战后势力范围与联合国框架',
    desc: '克里米亚半岛三巨头峰会就德国战后四方分区占领、波兰边界与苏联对日参战达成决定性协议。',
    effects: [
      { nat: 'USA', stat: 'stability', value: 20 },
      { nat: 'SOV', stat: 'stability', value: 20 }
    ]
  },
  {
    id: 'ww2_elbe_day',
    day: 1700,
    title: '易北河会师：美苏红军托尔高握手',
    desc: '美军第69步兵师与苏联第58近卫步兵师在托尔高小镇易北河桥头历史性会师，德国被一分为二！',
    important: true,
    effects: [
      { nat: 'USA', stat: 'warSupport', value: 30 },
      { nat: 'SOV', stat: 'warSupport', value: 30 }
    ]
  },
  {
    id: 'ww2_fall_of_berlin',
    day: 1710,
    title: '帝国大厦红旗高扬：第三帝国宣告无条件投降',
    desc: '苏军彻底攻克柏林，希特勒在元首地堡中自戕身亡，德国签署无条件投降书，二战欧洲战事完全胜利！',
    important: true,
    effects: [
      { nat: 'GER', stat: 'capitulated', value: true },
      { nat: 'SOV', stat: 'stability', value: 50 },
      { nat: 'USA', stat: 'stability', value: 40 }
    ]
  }
];

export function checkWW2Events(world){
  const day = world.day;
  const triggered = [];

  // 1. 每日日历历史事件
  for(const ev of WW2_EVENTS){
    if(ev.day === day && !world.events.some(e => e.id === ev.id)){
      const item = {
        id: ev.id,
        day,
        important: ev.important || false,
        text: `【${ev.title}】\n${ev.desc}`
      };
      triggered.push(item);

      if(ev.id === 'ww2_fall_weiss') addTension(world, 25, '白色方案：德军越过波兰边境', 'GER', 'POL');
      if(ev.id === 'ww2_allied_ultimatum') addTension(world, 10, '英法对德宣战：同盟国参战', 'GBR', 'GER');
      if(ev.id === 'ww2_soviet_east_poland') addTension(world, 15, '苏军进驻东波兰：势力范围划分', 'SOV', 'POL');
      if(ev.id === 'ww2_fall_of_warsaw') addTension(world, 10, '波兰投降：华沙沦陷', 'GER', 'POL');

      // 应用效果
      if(ev.effects){
        for(const eff of ev.effects){
          const n = world.nations[eff.nat];
          if(n){
            if(eff.stat === 'capitulated'){
              n.capitulated = eff.value;
            } else if(eff.stat === 'stability' || eff.stat === 'warSupport'){
              n[eff.stat] = Math.max(0, Math.min(100, (n[eff.stat] || 50) + eff.value));
            } else {
              n.modifiers[eff.stat] = (n.modifiers[eff.stat] || 0) + eff.value;
            }
          }
        }
      }
    }
  }

  // 2. 中国战场保底与至暗时刻事件
  const chn = world.nations['CHN'];
  if(chn && !chn.darkHourTriggered){
    // 检查中国失地比例（基于初始核心城市）
    const chnCities = world.hexes.filter(h => h.city && (h.city.name === '南京' || h.city.name === '上海' || h.city.name === '武汉'));
    const lostCount = chnCities.filter(h => h.owner !== 'CHN').length;
    if(lostCount >= 2){
      chn.darkHourTriggered = true;
      const item = {
        type: 'dark_hour',
        day,
        important: true,
        text: '🔥【至暗时刻·地无分南北年无分老幼】中国核心平原重镇相继沦陷，全民抗战总动员法令触发！全军组织度恢复提升30%，后方源源不断动员新军！'
      };
      triggered.push(item);
      chn.modifiers.org_recovery = (chn.modifiers.org_recovery || 0) + 0.3;
      chn.modifiers.defense = (chn.modifiers.defense || 0) + 0.2;
      chn.equip += 600;
    }
  }

  return triggered;
}
