/* ============================================================
   data/scenarios/ww2/characters.js —— 二战 80 位历史领袖与名将全案
   （31 位国家领导人 + 49 位战区将领，符合 §3.5 与 W2 验收要求）
   ============================================================ */

export const WW2_CHARACTERS = [
  // ================= 31 位国家领袖 =================
  {
    id: 'hitler', name: '阿道夫·希特勒', nat: 'GER', type: 'leader', era: 'ww2', fictional: false,
    traits: [ { stat: 'attack', value: 0.15 }, { stat: 'warSupport', value: 20 }, { stat: 'stability', value: -10 } ],
    portrait: 'assets/portraits/leaders/hitler.png'
  },
  {
    id: 'mussolini', name: '贝尼托·墨索里尼', nat: 'ITA', type: 'leader', era: 'ww2', fictional: false,
    traits: [ { stat: 'warSupport', value: 10 }, { stat: 'defense', value: -0.05 } ],
    portrait: 'assets/portraits/leaders/mussolini.png'
  },
  {
    id: 'tojo', name: '东条英机', nat: 'JPN', type: 'leader', era: 'ww2', fictional: false,
    traits: [ { stat: 'attack', value: 0.1 }, { stat: 'milOutput', value: 0.15 }, { stat: 'stability', value: -5 } ],
    portrait: 'assets/portraits/leaders/tojo.png'
  },
  {
    id: 'stalin', name: '约瑟夫·斯大林', nat: 'SOV', type: 'leader', era: 'ww2', fictional: false,
    traits: [ { stat: 'defense', value: 0.2 }, { stat: 'org_recovery', value: 0.15 }, { stat: 'stability', value: 15 } ],
    portrait: 'assets/portraits/leaders/stalin.png'
  },
  {
    id: 'churchill', name: '温斯顿·丘吉尔', nat: 'GBR', type: 'leader', era: 'ww2', fictional: false,
    traits: [ { stat: 'warSupport', value: 25 }, { stat: 'defense', value: 0.15 } ],
    portrait: 'assets/portraits/leaders/churchill.png'
  },
  {
    id: 'roosevelt', name: '富兰克林·罗斯福', nat: 'USA', type: 'leader', era: 'ww2', fictional: false,
    traits: [ { stat: 'milOutput', value: 0.25 }, { stat: 'stability', value: 15 } ],
    portrait: 'assets/portraits/leaders/roosevelt.png'
  },
  {
    id: 'degaulle', name: '夏尔·戴高乐', nat: 'FRA', type: 'leader', era: 'ww2', fictional: false,
    traits: [ { stat: 'warSupport', value: 20 }, { stat: 'attack', value: 0.1 } ],
    portrait: 'assets/portraits/leaders/degaulle.png'
  },
  {
    id: 'petain', name: '菲利普·贝当', nat: 'FRA', type: 'leader', era: 'ww2', fictional: false,
    traits: [ { stat: 'defense', value: 0.1 }, { stat: 'warSupport', value: -20 } ],
    portrait: 'assets/portraits/leaders/petain.png'
  },
  {
    id: 'chiang', name: '蒋中正', nat: 'CHN', type: 'leader', era: 'ww2', fictional: false,
    traits: [ { stat: 'defense', value: 0.15 }, { stat: 'warSupport', value: 20 } ],
    portrait: 'assets/portraits/leaders/chiang.png'
  },
  {
    id: 'mao', name: '毛泽东', nat: 'CCP', type: 'leader', era: 'ww2', fictional: false,
    traits: [ { stat: 'org_recovery', value: 0.25 }, { stat: 'stability', value: 25 }, { stat: 'defense', value: 0.1 } ],
    portrait: 'assets/portraits/leaders/mao.png'
  },
  {
    id: 'sikorski', name: '瓦迪斯瓦夫·西科尔斯基', nat: 'POL', type: 'leader', era: 'ww2', fictional: false,
    traits: [ { stat: 'defense', value: 0.1 }, { stat: 'warSupport', value: 15 } ],
    portrait: 'assets/portraits/leaders/sikorski.png'
  },
  {
    id: 'mannerheim_ldr', name: '卡尔·曼纳海姆', nat: 'FIN', type: 'leader', era: 'ww2', fictional: false,
    traits: [ { stat: 'defense', value: 0.25 }, { stat: 'org_recovery', value: 0.15 } ],
    portrait: 'assets/portraits/leaders/mannerheim.png'
  },
  {
    id: 'horthy', name: '霍尔蒂·米克洛什', nat: 'HUN', type: 'leader', era: 'ww2', fictional: false,
    traits: [ { stat: 'stability', value: 10 } ],
    portrait: 'assets/portraits/leaders/horthy.png'
  },
  {
    id: 'antonescu', name: '扬·安东内斯库', nat: 'ROM', type: 'leader', era: 'ww2', fictional: false,
    traits: [ { stat: 'attack', value: 0.1 }, { stat: 'stability', value: -10 } ],
    portrait: 'assets/portraits/leaders/antonescu.png'
  },
  {
    id: 'boris3', name: '鲍里斯三世', nat: 'BUL', type: 'leader', era: 'ww2', fictional: false,
    traits: [ { stat: 'stability', value: 15 } ],
    portrait: 'assets/portraits/leaders/boris3.png'
  },
  {
    id: 'tito', name: '约瑟普·布罗兹·铁托', nat: 'YUG', type: 'leader', era: 'ww2', fictional: false,
    traits: [ { stat: 'org_recovery', value: 0.2 }, { stat: 'defense', value: 0.15 } ],
    portrait: 'assets/portraits/leaders/tito.png'
  },
  {
    id: 'metaxas', name: '扬尼斯·梅塔克萨斯', nat: 'GRE', type: 'leader', era: 'ww2', fictional: false,
    traits: [ { stat: 'defense', value: 0.2 } ],
    portrait: 'assets/portraits/leaders/metaxas.png'
  },
  {
    id: 'leopold3', name: '利奥波德三世', nat: 'BEL', type: 'leader', era: 'ww2', fictional: false,
    traits: [ { stat: 'defense', value: 0.05 } ],
    portrait: 'assets/portraits/leaders/leopold3.png'
  },
  {
    id: 'wilhelmina', name: '威廉明娜女王', nat: 'NLD', type: 'leader', era: 'ww2', fictional: false,
    traits: [ { stat: 'warSupport', value: 15 } ],
    portrait: 'assets/portraits/leaders/wilhelmina.png'
  },
  {
    id: 'haakon7', name: '哈康七世', nat: 'NOR', type: 'leader', era: 'ww2', fictional: false,
    traits: [ { stat: 'warSupport', value: 15 } ],
    portrait: 'assets/portraits/leaders/haakon7.png'
  },
  {
    id: 'christian10', name: '克里斯蒂安十世', nat: 'DEN', type: 'leader', era: 'ww2', fictional: false,
    traits: [ { stat: 'stability', value: 10 } ],
    portrait: 'assets/portraits/leaders/christian10.png'
  },
  {
    id: 'hansson', name: '佩尔·阿尔宾·汉松', nat: 'SWE', type: 'leader', era: 'ww2', fictional: false,
    traits: [ { stat: 'milOutput', value: 0.1 }, { stat: 'stability', value: 20 } ],
    portrait: 'assets/portraits/leaders/hansson.png'
  },
  {
    id: 'franco', name: '弗朗西斯科·佛朗哥', nat: 'SPN', type: 'leader', era: 'ww2', fictional: false,
    traits: [ { stat: 'defense', value: 0.1 }, { stat: 'stability', value: 10 } ],
    portrait: 'assets/portraits/leaders/franco.png'
  },
  {
    id: 'salazar', name: '安东尼奥·萨拉查', nat: 'POR', type: 'leader', era: 'ww2', fictional: false,
    traits: [ { stat: 'stability', value: 15 } ],
    portrait: 'assets/portraits/leaders/salazar.png'
  },
  {
    id: 'inonu', name: '伊斯梅特·伊诺努', nat: 'TUR', type: 'leader', era: 'ww2', fictional: false,
    traits: [ { stat: 'defense', value: 0.15 }, { stat: 'stability', value: 15 } ],
    portrait: 'assets/portraits/leaders/inonu.png'
  },
  {
    id: 'farouk1', name: '法鲁克一世', nat: 'EGY', type: 'leader', era: 'ww2', fictional: false,
    traits: [ { stat: 'stability', value: -5 } ],
    portrait: 'assets/portraits/leaders/farouk1.png'
  },
  {
    id: 'reza_shah', name: '礼萨·汗', nat: 'IRN', type: 'leader', era: 'ww2', fictional: false,
    traits: [ { stat: 'stability', value: 10 } ],
    portrait: 'assets/portraits/leaders/reza_shah.png'
  },
  {
    id: 'ibn_saud', name: '阿卜杜勒-阿齐兹·伊本·沙特', nat: 'SAU', type: 'leader', era: 'ww2', fictional: false,
    traits: [ { stat: 'stability', value: 20 } ],
    portrait: 'assets/portraits/leaders/ibn_saud.png'
  },
  {
    id: 'mackenzie_king', name: '麦肯齐·金', nat: 'CAN', type: 'leader', era: 'ww2', fictional: false,
    traits: [ { stat: 'milOutput', value: 0.15 } ],
    portrait: 'assets/portraits/leaders/mackenzie_king.png'
  },
  {
    id: 'curtin', name: '约翰·柯廷', nat: 'AST', type: 'leader', era: 'ww2', fictional: false,
    traits: [ { stat: 'defense', value: 0.15 }, { stat: 'warSupport', value: 15 } ],
    portrait: 'assets/portraits/leaders/curtin.png'
  },
  {
    id: 'vargas', name: '热图利奥·瓦加斯', nat: 'BRA', type: 'leader', era: 'ww2', fictional: false,
    traits: [ { stat: 'milOutput', value: 0.1 } ],
    portrait: 'assets/portraits/leaders/vargas.png'
  },

  // ================= 49 位战区名将与战略统帅 =================
  // --- 德国将领 (6) ---
  {
    id: 'manstein', name: '埃里希·冯·曼施坦因', nat: 'GER', type: 'general', era: 'ww2', fictional: false,
    traits: [ { stat: 'attack', value: 0.2 }, { stat: 'plan_speed', value: 0.25 } ],
    portrait: 'assets/portraits/generals/manstein.png'
  },
  {
    id: 'rommel', name: '埃尔温·隆美尔', nat: 'GER', type: 'general', era: 'ww2', fictional: false,
    traits: [ { stat: 'speed', value: 0.3 }, { stat: 'attack', value: 0.15 } ],
    portrait: 'assets/portraits/generals/rommel.png'
  },
  {
    id: 'guderian', name: '海因茨·古德里安', nat: 'GER', type: 'general', era: 'ww2', fictional: false,
    traits: [ { stat: 'attack', value: 0.25 }, { stat: 'speed', value: 0.2 } ],
    portrait: 'assets/portraits/generals/guderian.png'
  },
  {
    id: 'model', name: '瓦尔特·莫德尔', nat: 'GER', type: 'general', era: 'ww2', fictional: false,
    traits: [ { stat: 'defense', value: 0.3 }, { stat: 'org_recovery', value: 0.15 } ],
    portrait: 'assets/portraits/generals/model.png'
  },
  {
    id: 'rundstedt', name: '格尔德·冯·伦德施泰特', nat: 'GER', type: 'general', era: 'ww2', fictional: false,
    traits: [ { stat: 'plan_speed', value: 0.2 }, { stat: 'defense', value: 0.15 } ],
    portrait: 'assets/portraits/generals/rundstedt.png'
  },
  {
    id: 'kesselring', name: '阿尔贝特·凯塞林', nat: 'GER', type: 'general', era: 'ww2', fictional: false,
    traits: [ { stat: 'defense', value: 0.2 }, { stat: 'org_recovery', value: 0.2 } ],
    portrait: 'assets/portraits/generals/kesselring.png'
  },

  // --- 苏联将领 (6) ---
  {
    id: 'zhukov', name: '格奥尔基·朱可夫', nat: 'SOV', type: 'general', era: 'ww2', fictional: false,
    traits: [ { stat: 'attack', value: 0.25 }, { stat: 'org_recovery', value: 0.2 } ],
    portrait: 'assets/portraits/generals/zhukov.png'
  },
  {
    id: 'rokossovsky', name: '康斯坦丁·罗科索夫斯基', nat: 'SOV', type: 'general', era: 'ww2', fictional: false,
    traits: [ { stat: 'attack', value: 0.2 }, { stat: 'speed', value: 0.15 } ],
    portrait: 'assets/portraits/generals/rokossovsky.png'
  },
  {
    id: 'konev', name: '伊万·科涅夫', nat: 'SOV', type: 'general', era: 'ww2', fictional: false,
    traits: [ { stat: 'attack', value: 0.2 }, { stat: 'plan_speed', value: 0.15 } ],
    portrait: 'assets/portraits/generals/konev.png'
  },
  {
    id: 'chuikov', name: '瓦西里·崔可夫', nat: 'SOV', type: 'general', era: 'ww2', fictional: false,
    traits: [ { stat: 'defense', value: 0.35 }, { stat: 'org_recovery', value: 0.15 } ],
    portrait: 'assets/portraits/generals/chuikov.png'
  },
  {
    id: 'vasilevsky', name: '亚历山大·华西列夫斯基', nat: 'SOV', type: 'general', era: 'ww2', fictional: false,
    traits: [ { stat: 'plan_speed', value: 0.3 }, { stat: 'attack', value: 0.1 } ],
    portrait: 'assets/portraits/generals/vasilevsky.png'
  },
  {
    id: 'vatutin', name: '尼古拉·瓦图京', nat: 'SOV', type: 'general', era: 'ww2', fictional: false,
    traits: [ { stat: 'attack', value: 0.2 }, { stat: 'speed', value: 0.2 } ],
    portrait: 'assets/portraits/generals/vatutin.png'
  },

  // --- 英国将领 (4) ---
  {
    id: 'montgomery', name: '伯纳德·蒙哥马利', nat: 'GBR', type: 'general', era: 'ww2', fictional: false,
    traits: [ { stat: 'defense', value: 0.25 }, { stat: 'plan_speed', value: 0.2 } ],
    portrait: 'assets/portraits/generals/montgomery.png'
  },
  {
    id: 'alexander', name: '哈罗德·亚历山大', nat: 'GBR', type: 'general', era: 'ww2', fictional: false,
    traits: [ { stat: 'org_recovery', value: 0.2 }, { stat: 'defense', value: 0.15 } ],
    portrait: 'assets/portraits/generals/alexander.png'
  },
  {
    id: 'slim', name: '威廉·斯利姆', nat: 'GBR', type: 'general', era: 'ww2', fictional: false,
    traits: [ { stat: 'attack', value: 0.15 }, { stat: 'org_recovery', value: 0.25 } ],
    portrait: 'assets/portraits/generals/slim.png'
  },
  {
    id: 'mountbatten', name: '路易斯·蒙巴顿', nat: 'GBR', type: 'general', era: 'ww2', fictional: false,
    traits: [ { stat: 'speed', value: 0.2 }, { stat: 'plan_speed', value: 0.15 } ],
    portrait: 'assets/portraits/generals/mountbatten.png'
  },

  // --- 美国将领 (5) ---
  {
    id: 'eisenhower', name: '德怀特·艾森豪威尔', nat: 'USA', type: 'general', era: 'ww2', fictional: false,
    traits: [ { stat: 'plan_speed', value: 0.3 }, { stat: 'org_recovery', value: 0.2 } ],
    portrait: 'assets/portraits/generals/eisenhower.png'
  },
  {
    id: 'patton', name: '乔治·巴顿', nat: 'USA', type: 'general', era: 'ww2', fictional: false,
    traits: [ { stat: 'attack', value: 0.3 }, { stat: 'speed', value: 0.25 } ],
    portrait: 'assets/portraits/generals/patton.png'
  },
  {
    id: 'macarthur', name: '道格拉斯·麦克阿瑟', nat: 'USA', type: 'general', era: 'ww2', fictional: false,
    traits: [ { stat: 'attack', value: 0.2 }, { stat: 'defense', value: 0.15 } ],
    portrait: 'assets/portraits/generals/macarthur.png'
  },
  {
    id: 'bradley', name: '奥马尔·布拉德利', nat: 'USA', type: 'general', era: 'ww2', fictional: false,
    traits: [ { stat: 'defense', value: 0.2 }, { stat: 'plan_speed', value: 0.2 } ],
    portrait: 'assets/portraits/generals/bradley.png'
  },
  {
    id: 'nimitz', name: '切斯特·尼米兹', nat: 'USA', type: 'general', era: 'ww2', fictional: false,
    traits: [ { stat: 'plan_speed', value: 0.25 }, { stat: 'defense', value: 0.2 } ],
    portrait: 'assets/portraits/generals/nimitz.png'
  },

  // --- 中华民国抗战名将 (6) ---
  {
    id: 'sun_lijen', name: '孙立人', nat: 'CHN', type: 'general', era: 'ww2', fictional: false,
    traits: [ { stat: 'attack', value: 0.25 }, { stat: 'speed', value: 0.2 } ],
    portrait: 'assets/portraits/generals/sun_lijen.png'
  },
  {
    id: 'xue_yue', name: '薛岳', nat: 'CHN', type: 'general', era: 'ww2', fictional: false,
    traits: [ { stat: 'defense', value: 0.3 }, { stat: 'attack', value: 0.15 } ],
    portrait: 'assets/portraits/generals/xue_yue.png'
  },
  {
    id: 'li_zongren', name: '李宗仁', nat: 'CHN', type: 'general', era: 'ww2', fictional: false,
    traits: [ { stat: 'defense', value: 0.2 }, { stat: 'plan_speed', value: 0.15 } ],
    portrait: 'assets/portraits/generals/li_zongren.png'
  },
  {
    id: 'bai_chongxi', name: '白崇禧', nat: 'CHN', type: 'general', era: 'ww2', fictional: false,
    traits: [ { stat: 'plan_speed', value: 0.25 }, { stat: 'attack', value: 0.15 } ],
    portrait: 'assets/portraits/generals/bai_chongxi.png'
  },
  {
    id: 'zhang_zizhong', name: '张自忠', nat: 'CHN', type: 'general', era: 'ww2', fictional: false,
    traits: [ { stat: 'attack', value: 0.25 }, { stat: 'defense', value: 0.2 } ],
    portrait: 'assets/portraits/generals/zhang_zizhong.png'
  },
  {
    id: 'dai_anlan', name: '戴安澜', nat: 'CHN', type: 'general', era: 'ww2', fictional: false,
    traits: [ { stat: 'attack', value: 0.2 }, { stat: 'org_recovery', value: 0.15 } ],
    portrait: 'assets/portraits/generals/dai_anlan.png'
  },

  // --- 中国共产党抗日名将 (5) ---
  {
    id: 'peng_dehuai', name: '彭德怀', nat: 'CCP', type: 'general', era: 'ww2', fictional: false,
    traits: [ { stat: 'attack', value: 0.25 }, { stat: 'org_recovery', value: 0.2 } ],
    portrait: 'assets/portraits/generals/peng_dehuai.png'
  },
  {
    id: 'lin_biao', name: '林彪', nat: 'CCP', type: 'general', era: 'ww2', fictional: false,
    traits: [ { stat: 'attack', value: 0.3 }, { stat: 'plan_speed', value: 0.25 } ],
    portrait: 'assets/portraits/generals/lin_biao.png'
  },
  {
    id: 'liu_bocheng', name: '刘伯承', nat: 'CCP', type: 'general', era: 'ww2', fictional: false,
    traits: [ { stat: 'plan_speed', value: 0.3 }, { stat: 'defense', value: 0.2 } ],
    portrait: 'assets/portraits/generals/liu_bocheng.png'
  },
  {
    id: 'xu_xiangqian', name: '徐向前', nat: 'CCP', type: 'general', era: 'ww2', fictional: false,
    traits: [ { stat: 'org_recovery', value: 0.25 }, { stat: 'defense', value: 0.2 } ],
    portrait: 'assets/portraits/generals/xu_xiangqian.png'
  },
  {
    id: 'su_yu', name: '粟裕', nat: 'CCP', type: 'general', era: 'ww2', fictional: false,
    traits: [ { stat: 'attack', value: 0.25 }, { stat: 'speed', value: 0.25 } ],
    portrait: 'assets/portraits/generals/su_yu.png'
  },

  // --- 日本将领 (5) ---
  {
    id: 'yamamoto', name: '山本五十六', nat: 'JPN', type: 'general', era: 'ww2', fictional: false,
    traits: [ { stat: 'attack', value: 0.25 }, { stat: 'plan_speed', value: 0.2 } ],
    portrait: 'assets/portraits/generals/yamamoto.png'
  },
  {
    id: 'yamashita', name: '山下奉文', nat: 'JPN', type: 'general', era: 'ww2', fictional: false,
    traits: [ { stat: 'speed', value: 0.25 }, { stat: 'attack', value: 0.2 } ],
    portrait: 'assets/portraits/generals/yamashita.png'
  },
  {
    id: 'okamura', name: '冈村宁次', nat: 'JPN', type: 'general', era: 'ww2', fictional: false,
    traits: [ { stat: 'defense', value: 0.2 }, { stat: 'plan_speed', value: 0.15 } ],
    portrait: 'assets/portraits/generals/okamura.png'
  },
  {
    id: 'kuribayashi', name: '栗林忠道', nat: 'JPN', type: 'general', era: 'ww2', fictional: false,
    traits: [ { stat: 'defense', value: 0.35 }, { stat: 'org_recovery', value: 0.2 } ],
    portrait: 'assets/portraits/generals/kuribayashi.png'
  },
  {
    id: 'nagumo', name: '南云忠一', nat: 'JPN', type: 'general', era: 'ww2', fictional: false,
    traits: [ { stat: 'attack', value: 0.15 }, { stat: 'plan_speed', value: -0.1 } ],
    portrait: 'assets/portraits/generals/nagumo.png'
  },

  // --- 意大利将领 (3) ---
  {
    id: 'badoglio', name: '佩特罗·巴多格里奥', nat: 'ITA', type: 'general', era: 'ww2', fictional: false,
    traits: [ { stat: 'defense', value: 0.1 } ],
    portrait: 'assets/portraits/generals/badoglio.png'
  },
  {
    id: 'graziani', name: '鲁道夫·格拉齐亚尼', nat: 'ITA', type: 'general', era: 'ww2', fictional: false,
    traits: [ { stat: 'attack', value: 0.15 }, { stat: 'org_recovery', value: -0.1 } ],
    portrait: 'assets/portraits/generals/graziani.png'
  },
  {
    id: 'messe', name: '乔瓦尼·梅塞', nat: 'ITA', type: 'general', era: 'ww2', fictional: false,
    traits: [ { stat: 'defense', value: 0.2 }, { stat: 'org_recovery', value: 0.15 } ],
    portrait: 'assets/portraits/generals/messe.png'
  },

  // --- 法国将领 (3) ---
  {
    id: 'leclerc', name: '菲利普·勒克莱尔', nat: 'FRA', type: 'general', era: 'ww2', fictional: false,
    traits: [ { stat: 'attack', value: 0.2 }, { stat: 'speed', value: 0.25 } ],
    portrait: 'assets/portraits/generals/leclerc.png'
  },
  {
    id: 'gamelin', name: '莫里斯·甘末林', nat: 'FRA', type: 'general', era: 'ww2', fictional: false,
    traits: [ { stat: 'defense', value: 0.05 }, { stat: 'speed', value: -0.15 } ],
    portrait: 'assets/portraits/generals/gamelin.png'
  },
  {
    id: 'juin', name: '阿尔丰斯·朱安', nat: 'FRA', type: 'general', era: 'ww2', fictional: false,
    traits: [ { stat: 'attack', value: 0.15 }, { stat: 'org_recovery', value: 0.15 } ],
    portrait: 'assets/portraits/generals/juin.png'
  },

  // --- 波兰将领 (2) ---
  {
    id: 'anders', name: '瓦迪斯瓦夫·安德斯', nat: 'POL', type: 'general', era: 'ww2', fictional: false,
    traits: [ { stat: 'defense', value: 0.2 }, { stat: 'attack', value: 0.15 } ],
    portrait: 'assets/portraits/generals/anders.png'
  },
  {
    id: 'maczek', name: '斯坦尼斯瓦夫·马切克', nat: 'POL', type: 'general', era: 'ww2', fictional: false,
    traits: [ { stat: 'speed', value: 0.25 }, { stat: 'attack', value: 0.15 } ],
    portrait: 'assets/portraits/generals/maczek.png'
  },

  // --- 芬兰、罗马尼亚、匈牙利 (3) ---
  {
    id: 'mannerheim_gen', name: '曼纳海姆元帅', nat: 'FIN', type: 'general', era: 'ww2', fictional: false,
    traits: [ { stat: 'defense', value: 0.3 }, { stat: 'org_recovery', value: 0.2 } ],
    portrait: 'assets/portraits/generals/mannerheim.png'
  },
  {
    id: 'dumitrescu', name: '佩特雷·杜米特雷斯库', nat: 'ROM', type: 'general', era: 'ww2', fictional: false,
    traits: [ { stat: 'attack', value: 0.15 }, { stat: 'defense', value: 0.1 } ],
    portrait: 'assets/portraits/generals/dumitrescu.png'
  },
  {
    id: 'lakatos', name: '拉卡托什·盖佐', nat: 'HUN', type: 'general', era: 'ww2', fictional: false,
    traits: [ { stat: 'defense', value: 0.15 } ],
    portrait: 'assets/portraits/generals/lakatos.png'
  },
  {
    id: 'brooke', name: '艾伦·布鲁克', nat: 'GBR', type: 'general', era: 'ww2', fictional: false,
    traits: [ { stat: 'plan_speed', value: 0.25 }, { stat: 'defense', value: 0.2 } ],
    portrait: 'assets/portraits/generals/brooke.png'
  }
];
