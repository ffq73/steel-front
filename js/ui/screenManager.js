/* ============================================================
   ui/screenManager.js —— v7.0 统帅部全景页面流状态机
   冷启动主菜单 → 四时代大厅 → 国家档案舱 → 战争大厅 → 战史复盘
   ============================================================ */

export const APP_SCREENS = {
  TITLE: 'screen-title',
  MAIN_MENU: 'screen-main-menu',
  ERA_SELECT: 'screen-era-select',
  COUNTRY_SELECT: 'screen-country-select',
  GAMEPLAY: 'screen-gameplay',
  AAR: 'screen-aar'
};

/* 四时代元数据（大厅卡牌与氛围主题） */
export const ERA_META = {
  ww1: {
    id: 'ww1', year: '1914', name: '火药桶', fullName: '一战 · 火药桶 1914',
    color: '#c5a059', themeClass: 'era-ww1',
    titleAsset: 'assets/titles/title_ww1.jpg',
    tags: ['堑壕压制 25%', '巨炮弹幕准备', '潜艇无限制战', '帝国解体链'],
    tick: '按日结算', intensity: 3,
    brief: '七月危机点燃欧洲火药桶。西线堑壕僵局、东线帝国碰撞——凡尔登的绞肉机正在等待第一批士兵。',
    conflict: '波兰走廊危机未始，萨拉热窝的枪声已响。同盟国与协约国All In 总体战，谁能撑过第一个冬天？'
  },
  ww2: {
    id: 'ww2', year: '1939', name: '全面战争', fullName: '二战 · 全面战争 1939',
    color: '#991b1b', themeClass: 'era-ww2',
    titleAsset: 'assets/titles/title_ww2.jpg',
    tags: ['大纵深突破', '四周年工业计划', '动态同盟条约', '历史名将指挥链'],
    tick: '按日结算', intensity: 4,
    brief: '白色方案已批准。150 万大军枕戈待旦，装甲矛头将第一次实践"闪电战"三个字。',
    conflict: '但泽或战争——柏林的回答早已写好。伦敦的保证书墨迹未干，华沙的选择只剩荣誉。'
  },
  coldwar: {
    id: 'coldwar', year: '1949', name: '铁幕降临', fullName: '冷战 · 铁幕 1949',
    color: '#225a6e', themeClass: 'era-coldwar',
    titleAsset: 'assets/titles/title_coldwar.jpg',
    tags: ['DEFCON 战备', '末日钟核双输', '太空竞赛声望', '代理人干预'],
    tick: '按月结算', intensity: 2,
    brief: '热战的硝烟散去，冷战的铁幕落下。影响力就是领土，威慑就是武器。',
    conflict: '两大阵营隔着核按钮对视。挖空一个第三世界国家的政权，比打赢一场会战更有价值。'
  },
  modern: {
    id: 'modern', year: '2022', name: '多极危机', fullName: '现代 · 多极危机 2022',
    color: '#0f172a', themeClass: 'era-modern',
    titleAsset: 'assets/titles/title_modern.jpg',
    tags: ['FPV 巡飞弹', 'SWIFT 断供制裁', '四原创人物剧情', '战争疲劳和谈'],
    tick: '按周结算', intensity: 3,
    brief: '2022 年 2 月 24 日凌晨，欧洲大陆再度响起炮声。制裁、军援、舆论与无人机共同构成新一代战场。',
    conflict: '旧大陆的火药桶再次被点燃——这一次，全世界都在屏幕前实时观战。'
  }
};

/* 各副本可玩国家圈定（T1 优先，标注推荐理由） */
export const ERA_PLAYABLE = {
  ww1: ['GER', 'FRA', 'GBR', 'RUS', 'AUS', 'OTT', 'ITA'],
  ww2: ['GER', 'SOV', 'GBR', 'FRA', 'USA', 'JPN', 'ITA', 'POL', 'CHN'],
  coldwar: ['USA', 'SOV', 'GBR', 'FRA', 'CHN'],
  modern: ['RUS', 'UKR', 'USA', 'GBR', 'FRA', 'GER', 'POL', 'JPN', 'IRN', 'ISR']
};

/* 各时代国家档案舱的领袖与政体修饰（历史人物 [H] + 虚构 [F]） */
export const LEADER_META = {
  // —— 一战 ——
  GER_WW1: { leader: '德皇威廉二世', gov:'君主立宪制', ideology:'军国主义', spirits:['施里芬计划的遗产：初期攻势力 +10%', '容克贵族军官团：将领技能 +1', '英国海军封锁：战争疲惫累积 +25%'] },
  FRA_WW1: { leader: '普恩加莱总统', gov:'议会共和制', ideology:'复仇主义', spirits:['丧失的阿尔萨斯：对德攻势力 +10%', '凡尔登绞肉机：人力恢复 −15%'] },
  GBR_WW1: { leader: '劳合·乔治首相', gov:'议会君主制', ideology:'帝国主义', spirits:['日不落海军：海军封锁强度 +30%', '帝国远征军：增援部署 +15%'] },
  RUS_WW1: { leader: '尼古拉二世沙皇', gov:'君主专制', ideology:'正统主义', spirits:['无限人力：动员上限 +40%', '崩溃的前夜：革命风险 +50%'] },
  AUS_WW1: { leader: '弗朗茨·约瑟夫一世', gov:'二元君主国', ideology:'多民族帝国', spirits:['十一个民族：稳定 −25%', '老近卫军：组织度 +10%'] },
  OTT_WW1: { leader: '恩维尔帕夏', gov:'青年土耳其党', ideology:'泛突厥主义', spirits:['海峡咽喉：黑海封锁 +20%', '加里波利荣誉：防御 +15%'] },
  ITA_WW1: { leader: '维托里奥·埃马努埃莱三世', gov:'君主立宪', ideology:'机会主义', spirits:['摇摆的盟约：阵营选择自由', '山地精锐：阿尔卑斯攻防 +15%'] },
  // —— 二战 ——
  GER_WW2: { leader: '阿道夫·希特勒', gov:'元首独裁', ideology:'国家社会主义', spirits:['凡尔赛条约枷锁：早期动员限制', '闪电战学说：装甲突破 +15%', '四年计划：军工产出 +20%'] },
  SOV_WW2: { leader: '约瑟夫·斯大林', gov:'苏维埃体制', ideology:'共产主义', spirits:['大纵深战役理论：反攻 +15%', '乌拉尔工业东迁：军工恢复 +20%', '大清洗余波：将领技能 −1'] },
  GBR_WW2: { leader: '温斯顿·丘吉尔', gov:'战时内阁', ideology:'帝国主义', spirits:['我们决不投降：稳定 +25%', '皇家海军：封锁强度 +25%', '帝国自治领：增援 +10%'] },
  FRA_WW2: { leader: '保罗·雷诺政府', gov:'议会共和制', ideology:'防御主义', spirits:['马奇诺防线：边境防御 +40%', '大萧条余波：政治点产出 −15%'] },
  USA_WW2: { leader: '富兰克林·罗斯福', gov:'新政联盟', ideology:'民主干预主义', spirits:['民主兵工厂：工业产出 +30%', '两洋天堑：本土防御 +50%', '孤立主义余波：早期参战受限'] },
  JPN_WW2: { leader: '东条英机内阁', gov:'军部独裁', ideology:'军国主义', spirits:['大东亚共荣圈：资源获取 +20%', '武士道：组织度 +10%', '资源焦虑：石油储备有限'] },
  ITA_WW2: { leader: '贝尼托·墨索里尼', gov:'法西斯独裁', ideology:'法西斯主义', spirits:['新罗马帝国：地中海攻势力 +10%', '工业先天不足：装备产出 −15%'] },
  POL_WW2: { leader: '波兰流亡政府', gov:'共和国', ideology:'爱国主义', spirits:['荣誉即祖国：部队士气 +20%', '但泽走廊危机：开局即遭合围'] },
  CHN_WW2: { leader: '国民政府', gov:'一党训政', ideology:'三民主义', spirits:['持久抗战：消耗承受 +30%', '统一战线：国共协作事件', '工业西迁：大后方建设'] },
  // —— 冷战 ——
  USA_CW: { leader: '哈里·杜鲁门总统', gov:'两党制', ideology:'遏制主义', spirits:['马歇尔计划：经济影响力 +30%', '北约缔造者：盟友忠诚 +25%', '核垄断初期：威慑 +40%'] },
  SOV_CW: { leader: '约瑟夫·斯大林', gov:'苏维埃体制', ideology:'斯大林主义', spirits:['华约缔造者：阵营控制 +25%', '五年计划传统：重工业 +20%', '铁幕密码：谍报 +15%'] },
  GBR_CW: { leader: '克莱门特·艾德礼政府', gov:'议会民主制', ideology:'福利国家', spirits:['英联邦纽带：影响力 +15%', '独立核力量：威慑 +10%'] },
  FRA_CW: { leader: '第四共和国', gov:'议会共和制', ideology:'欧洲主义', spirits:['欧洲煤钢共同体：经济 +15%', '印度支那泥潭：战争疲惫 +20%'] },
  CHN_CW: { leader: '新中国政府', gov:'人民民主', ideology:'毛泽东思想', spirits:['抗美援朝：陆军士气 +20%', '自力更生：科技自主 +15%'] },
  // —— 现代 ——
  RUS_MOD: { leader: '俄罗斯联邦政府', gov:'联邦半总统制', ideology:'欧亚主义', spirits:['能源巨人：油气杠杆 +30%', '核武库继承者：威慑 +35%', '国际孤立：声望 −20%'] },
  UKR_MOD: { leader: '弗拉基米尔·泽连斯基', gov:'总统制', ideology:'亲欧改革', spirits:['战时团结：组织度 +20%', '西方军援管道：装备获取 +25%', '战争疲劳：人力恢复 −10%'] },
  USA_MOD: { leader: '白宫椭圆形办公室', gov:'两党制', ideology:'实用主义', spirits:['北约第 5 条：盟友威慑 +30%', '美元霸权：制裁效力 +25%', '国会掣肘：政策连续性 −15%'] },
  GBR_MOD: { leader: '威斯敏斯特内阁', gov:'议会君主制', ideology:'离岸平衡', spirits:['五眼情报联盟：情报 +30%', '特别关系：对美影响 +20%'] },
  FRA_MOD: { leader: '爱丽舍宫', gov:'半总统制', ideology:'战略自主', spirits:['核独立自主：威慑 +20%', '欧盟引擎：欧洲影响力 +15%'] },
  GER_MOD: { leader: '柏林联邦总理府', gov:'联邦制', ideology:'和平主义转向', spirits:['时代转折 Zeitenwende：军费 +25%', '能源转型阵痛：工业 −10%'] },
  POL_MOD: { leader: '华沙前沿政府', gov:'议会制', ideology:'前线国家', spirits:['东翼堡垒：防御 +25%', '北约东翼锚点：盟军驻扎'] },
  JPN_MOD: { leader: '东京国会', gov:'议会民主制', ideology:'和平宪法', spirits:['和平宪法：进攻受限', '岛链哨兵：海空 +20%'] },
  IRN_MOD: { leader: '德黑兰最高领袖府', gov:'神权共和', ideology:'抵抗轴心', spirits:['代理人网络：地区影响 +30%', '制裁淬炼：自给自足 +20%'] },
  ISR_MOD: { leader: '特拉维夫安全内阁', gov:'议会制', ideology:'安全优先', spirits:['铁穹防御：本土防御 +40%', '情报之王：谍报 +35%'] },
  // —— 虚构人物 [F] ——
  RUS_MOD_F: { leader: '葛修傅 [F]（虚构）', gov:'炉火阵线', ideology:'极左翼·革命输出', spirits:['钢铁纪律：军工产能 +25%', '炉火宪章：稳定 −5', '革命输出：对西方威胁 +30%'], fictional:true },
  JPN_MOD_F: { leader: '吉爱习 [F]（虚构）', gov:'旭日会内阁', ideology:'极右翼·正常国家化', spirits:['武士宪章：军工厂效率 +15%', '进攻计划 +10%', '国际舆论 −25'], fictional:true },
  USA_MOD_F: { leader: '小鹿 [F]（虚构）', gov:'务实内阁', ideology:'实用主义', spirits:['务实交易：秘密外交无惩罚', '民企产出 +10%', '选择性介入：军援灵活'], fictional:true },
  GBR_MOD_F: { leader: '王若伊 [F]（虚构）', gov:'影子外交内阁', ideology:'两面派·离岸平衡', spirits:['双面下注：双阵营秘密渠道', '情报行动 +25%', '暴露风险：每 90 天判定'], fictional:true }
};

/* 国家档案舱数据：从剧本 nations 派生 + LEADER_META 拼合 */
export function buildDossierList(eraKey, nationsData){
  const playable = ERA_PLAYABLE[eraKey] || [];
  return playable.map(tag => {
    const nd = nationsData[tag];
    if(!nd) return null;
    const metaKey = tag + '_' + eraKey.replace('ww1','WW1').replace('ww2','WW2').replace('coldwar','CW').replace('modern','MOD');
    const lm = LEADER_META[metaKey] || LEADER_META[tag + '_' + eraKey.toUpperCase()] || {};
    const armyDivs = nd.armyDivs || 12;
    return {
      tag,
      name: nd.name,
      color: nd.color,
      capital: nd.capital,
      leader: lm.leader || '现任政府',
      gov: lm.gov || nd.law || '—',
      ideology: lm.ideology || '—',
      spirits: lm.spirits || ['国家精神整理中…'],
      fictional: !!lm.fictional,
      strength: {
        army: Math.min(10, Math.round((nd.armyDivs || 10) / 4)),
        industry: Math.min(10, Math.round((nd.mil || 4) / 2.5)),
        resources: Math.min(10, Math.round((nd.equip || 400) / 250))
      },
      law: nd.law,
      warSupport: nd.warSupport,
      stability: nd.stability,
      ai: nd.ai
    };
  }).filter(Boolean);
}

/* ============================================================
   ScreenManager —— 页面状态机（§0.2 / §6.2）
   ============================================================ */
export class ScreenManager {
  constructor(){
    this.currentScreen = null;
    this.handlers = {};   // screenKey → { onEnter, onLeave }
  }
  register(screenKey, handlers){
    this.handlers[screenKey] = handlers || {};
  }
  switchTo(screenKey, payload = {}){
    const old = this.currentScreen;
    if(old === screenKey) return;
    if(old && this.handlers[old] && this.handlers[old].onLeave) this.handlers[old].onLeave(payload);
    document.querySelectorAll('.sf-screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(screenKey);
    if(!target){ console.error('screen not found:', screenKey); return; }
    target.classList.add('active');
    this.currentScreen = screenKey;
    if(this.handlers[screenKey] && this.handlers[screenKey].onEnter) this.handlers[screenKey].onEnter(payload);
    window.scrollTo(0, 0);
  }
}

/* 单例（main.js 装配后挂到 window 便于 onerror 调试） */
export const screenManager = new ScreenManager();
