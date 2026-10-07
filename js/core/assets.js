/* ============================================================
   core/assets.js —— 美术资产管理与程序化回退徽章系统 (v6.0 / C11)
   无论真实图片是否存在，绝不白屏、绝不报错，回退到矢量/程序化徽章
   ============================================================ */

export const ASSET_FALLBACKS = {
  // 领袖与原创人物回退色与简字
  hitler: { color: '#333333', text: '希特勒' },
  stalin: { color: '#8b0000', text: '斯大林' },
  churchill: { color: '#b22222', text: '丘吉尔' },
  roosevelt: { color: '#2e5b88', text: '罗斯福' },
  chiang: { color: '#2a52be', text: '蒋中正' },
  mao: { color: '#c8102e', text: '毛泽东' },
  wilhelm2: { color: '#1b2a47', text: '威廉二世' },
  nicholas2: { color: '#1a365d', text: '尼古拉二世' },
  george5: { color: '#742a2a', text: '乔治五世' },
  poincare: { color: '#2b4c7e', text: '彭加勒' },
  franz_joseph: { color: '#82632b', text: '约瑟夫一世' },
  truman: { color: '#2e5b88', text: '杜鲁门' },
  khrushchev: { color: '#8b0000', text: '赫鲁晓夫' },
  putin: { color: '#c41230', text: '普京' },
  zelensky: { color: '#d8b74f', text: '泽连斯基' },
  biden: { color: '#2e5b88', text: '拜登' },
  ge_xiufu: { color: '#8b0000', text: '葛修傅[F]' },
  yoshi_aixi: { color: '#8b1c1c', text: '吉爱习[F]' },
  xiao_lu: { color: '#1f4788', text: '小鹿[F]' },
  wang_ruoyi: { color: '#444455', text: '王若伊[F]' },
  manstein: { color: '#444444', text: '曼施坦因' },
  guderian: { color: '#555544', text: '古德里安' },
  rommel: { color: '#665533', text: '隆美尔' },
  rundstedt: { color: '#333344', text: '伦德施泰特' },
  zhukov: { color: '#8b0000', text: '朱可夫' },
  zhukov_cw: { color: '#8b0000', text: '朱可夫' },
  rokossovsky: { color: '#7b1113', text: '罗科索夫斯基' },
  konev: { color: '#8b2222', text: '科涅夫' },
  konev_cw: { color: '#8b2222', text: '科涅夫' },
  sokolovsky: { color: '#7b1113', text: '索科洛夫斯基' },
  eisenhower: { color: '#2a4365', text: '艾森豪威尔' },
  eisenhower_cw: { color: '#2a4365', text: '艾森豪威尔' },
  patton: { color: '#234e52', text: '巴顿' },
  macarthur: { color: '#234e52', text: '麦克阿瑟' },
  macarthur_cw: { color: '#234e52', text: '麦克阿瑟' },
  ridgway: { color: '#1e3a8a', text: '李奇微' },
  westmoreland: { color: '#164e63', text: '威斯特摩兰' },
  montgomery: { color: '#742a2a', text: '蒙哥马利' },
  sun_lijen: { color: '#2a52be', text: '孙立人' },
  peng_dehuai: { color: '#c8102e', text: '彭德怀' },
  peng_dehuai_cw: { color: '#c8102e', text: '彭德怀' },
  lin_biao_cw: { color: '#991b1b', text: '林彪' },
  guevara: { color: '#065f46', text: '格瓦拉' },
  vo_nguyen_giap: { color: '#831843', text: '武元甲' },
  stalin_cw: { color: '#8b0000', text: '斯大林' },
  mao_cw: { color: '#c8102e', text: '毛泽东' },
  churchill_cw: { color: '#b22222', text: '丘吉尔' },
  degaulle_cw: { color: '#1e3a8a', text: '戴高乐' },
  tito_cw: { color: '#831843', text: '铁托' },
  hindenburg: { color: '#2b3648', text: '兴登堡' },
  ludendorff: { color: '#364052', text: '鲁登道夫' },
  brusilov: { color: '#522b2b', text: '勃鲁西洛夫' },
  haig: { color: '#5a3d28', text: '黑格' },
  joffre: { color: '#28415a', text: '霞飞' }
};

export const ASSET_MAP = {
  titles: {
    ww1: 'assets/titles/title_ww1.jpg',
    ww2: 'assets/titles/title_ww2.jpg',
    coldwar: 'assets/titles/title_coldwar.jpg',
    modern: 'assets/titles/title_modern.jpg'
  },
  leaders: {
    // 二战
    hitler: 'assets/ww2/portraits/leader_hitler.png',
    stalin: 'assets/ww2/portraits/leader_stalin.png',
    churchill: 'assets/ww2/portraits/leader_churchill.png',
    roosevelt: 'assets/ww2/portraits/leader_roosevelt.png',
    chiang: 'assets/ww2/portraits/leader_chiang.png',
    de_gaulle: 'assets/ww2/portraits/leader_de_gaulle.png',
    pilsudski: 'assets/ww2/portraits/leader_pilsudski.png',
    // 一战
    wilhelm2: 'assets/ww1/portraits/leader_wilhelm2.png',
    nicholas2: 'assets/ww1/portraits/leader_nicholas2.png',
    george5: 'assets/ww1/portraits/leader_george5.png',
    poincare: 'assets/ww1/portraits/leader_poincare.png',
    franz_joseph: 'assets/ww1/portraits/leader_franz_joseph.png',
    enver: 'assets/ww1/portraits/leader_enver.png',
    // 冷战
    truman: 'assets/coldwar/portraits/leader_truman.png',
    khrushchev: 'assets/coldwar/portraits/leader_khrushchev.png',
    eisenhower: 'assets/coldwar/portraits/leader_eisenhower.png',
    eisenhower_cw: 'assets/coldwar/portraits/leader_eisenhower.png',
    stalin_cw: 'assets/portraits/leaders/stalin.png',
    mao: 'assets/coldwar/portraits/leader_mao.png',
    mao_cw: 'assets/coldwar/portraits/leader_mao.png',
    tito: 'assets/coldwar/portraits/leader_tito.png',
    tito_cw: 'assets/coldwar/portraits/leader_tito.png',
    adenauer: 'assets/coldwar/portraits/leader_adenauer.png',
    churchill_cw: 'assets/portraits/leaders/churchill.png',
    degaulle_cw: 'assets/portraits/leaders/degaulle.png',
    kennedy: 'assets/portraits/leaders/kennedy.png',
    nixon: 'assets/portraits/leaders/nixon.png',
    reagan: 'assets/portraits/leaders/reagan.png',
    brezhnev: 'assets/portraits/leaders/brezhnev.png',
    gorbachev: 'assets/portraits/leaders/gorbachev.png',
    castro: 'assets/portraits/leaders/castro.png',
    ho_chi_minh: 'assets/portraits/leaders/ho_chi_minh.png',
    kim_il_sung: 'assets/portraits/leaders/kim_il_sung.png',
    // 现代
    putin: 'assets/modern/portraits/leader_putin.png',
    zelensky: 'assets/modern/portraits/leader_zelensky.png',
    biden: 'assets/modern/portraits/leader_biden.png',
    macron: 'assets/modern/portraits/leader_macron.png',
    scholz: 'assets/modern/portraits/leader_scholz.png',
    khamenei: 'assets/modern/portraits/leader_khamenei.png',
    netanyahu: 'assets/modern/portraits/leader_netanyahu.png',
    erdogan: 'assets/modern/portraits/leader_erdogan.png',
    // 现代原创角色
    ge_xiufu: 'assets/modern/portraits/char_ge_xiufu_main.png',
    yoshi_aixi: 'assets/modern/portraits/char_yoshi_aixi_main.png',
    xiao_lu: 'assets/modern/portraits/char_xiao_lu_main.png',
    wang_ruoyi: 'assets/modern/portraits/char_wang_ruoyi_main.png'
  },
  generals: {
    // 二战
    manstein: 'assets/ww2/portraits/general_manstein.png',
    guderian: 'assets/ww2/portraits/general_guderian.png',
    rommel: 'assets/ww2/portraits/general_rommel.png',
    rundstedt: 'assets/ww2/portraits/general_rundstedt.png',
    model: 'assets/ww2/portraits/general_model.png',
    zhukov: 'assets/ww2/portraits/general_zhukov.png',
    rokossovsky: 'assets/ww2/portraits/general_rokossovsky.png',
    konev: 'assets/ww2/portraits/general_konev.png',
    chuikov: 'assets/ww2/portraits/general_chuikov.png',
    vasilevsky: 'assets/ww2/portraits/general_vasilevsky.png',
    vatutin: 'assets/ww2/portraits/general_vatutin.png',
    eisenhower: 'assets/ww2/portraits/general_eisenhower_ww2.png',
    patton: 'assets/ww2/portraits/general_patton.png',
    macarthur: 'assets/ww2/portraits/general_macarthur.png',
    nimitz: 'assets/ww2/portraits/general_nimitz.png',
    montgomery: 'assets/ww2/portraits/general_montgomery.png',
    alexander: 'assets/ww2/portraits/general_alexander.png',
    de_lattre: 'assets/ww2/portraits/general_de_lattre.png',
    sun_liren: 'assets/ww2/portraits/general_sun_liren.png',
    peng_dehuai: 'assets/ww2/portraits/general_peng_dehuai.png',
    kesselring: 'assets/ww2/portraits/general_kesselring.png',
    // 冷战
    zhukov_cw: 'assets/portraits/generals/zhukov.png',
    konev_cw: 'assets/portraits/generals/konev.png',
    sokolovsky: 'assets/portraits/generals/sokolovsky.png',
    macarthur_cw: 'assets/portraits/generals/macarthur.png',
    ridgway: 'assets/portraits/generals/ridgway.png',
    westmoreland: 'assets/portraits/generals/westmoreland.png',
    peng_dehuai_cw: 'assets/portraits/generals/peng_dehuai.png',
    lin_biao_cw: 'assets/portraits/generals/lin_biao.png',
    guevara: 'assets/portraits/generals/guevara.png',
    vo_nguyen_giap: 'assets/portraits/generals/giap.png',
    // 一战
    hindenburg: 'assets/ww1/portraits/general_hindenburg.png',
    ludendorff: 'assets/ww1/portraits/general_ludendorff.png',
    mackensen: 'assets/ww1/portraits/general_mackensen.png',
    falkenhayn: 'assets/ww1/portraits/general_falkenhayn.png',
    schlieffen: 'assets/ww1/portraits/general_schlieffen.png',
    brusilov: 'assets/ww1/portraits/general_brusilov.png',
    haig: 'assets/ww1/portraits/general_haig.png',
    joffre: 'assets/ww1/portraits/general_joffre.png',
    foch: 'assets/ww1/portraits/general_foch.png',
    conrad: 'assets/ww1/portraits/general_conrad.png',
    // 现代
    gerasimov: 'assets/modern/portraits/general_gerasimov.png',
    shoigu: 'assets/modern/portraits/general_shoigu.png',
    surovikin: 'assets/modern/portraits/general_surovikin.png',
    teplinsky: 'assets/modern/portraits/general_teplinsky.png',
    zaluzhnyi: 'assets/modern/portraits/general_zaluzhnyi.png',
    syrskyi: 'assets/modern/portraits/general_syrskyi.png',
    budanov: 'assets/modern/portraits/general_budanov.png',
    milley: 'assets/modern/portraits/general_milley.png',
    austin: 'assets/modern/portraits/general_austin.png',
    cavoli: 'assets/modern/portraits/general_cavoli.png'
  },
  blueprints: {
    inf_equip: 'assets/techs/tech_equipment_blueprint_rifle.png',
    artillery: 'assets/techs/tech_equipment_blueprint_field_gun.png',
    support_equip: 'assets/techs/tech_equipment_blueprint_mg.png',
    light_armor: 'assets/techs/tech_equipment_blueprint_light_tank.png',
    tank: 'assets/techs/tech_equipment_blueprint_main_tank.png',
    truck: 'assets/techs/tech_equipment_blueprint_motor_truck.png',
    fighter: 'assets/techs/tech_doctrine_air_superiority.png',
    drone: 'assets/techs/tech_equipment_blueprint_drone_strike.png'
  }
};

export function getAssetFallback(id, defaultName = '指挥官'){
  const cleanId = (id || '').replace(/_(cw|ww1|ww2|mod)$/, '');
  return ASSET_FALLBACKS[id] || ASSET_FALLBACKS[cleanId] || { color: '#445566', text: defaultName };
}

/* 生成程序化回退徽章的 SVG Data URI，带金铜双边饰与统帅徽章 */
export function getProceduralBadgeSvg(id, name, color = '#242e3d'){
  const cleanId = (id || '').replace(/_(cw|ww1|ww2|mod)$/, '');
  const fb = ASSET_FALLBACKS[id] || ASSET_FALLBACKS[cleanId] || { color, text: (name && name !== id) ? name : cleanId };
  const safeText = String(fb.text || cleanId || id).replace(/</g, '').replace(/>/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#243042"/>
        <stop offset="100%" stop-color="#121822"/>
      </linearGradient>
    </defs>
    <rect width="128" height="128" rx="6" fill="url(#bg)" stroke="#d4af37" stroke-width="2.5"/>
    <rect x="5" y="5" width="118" height="118" rx="4" fill="none" stroke="#5a687c" stroke-width="1" stroke-dasharray="3,2"/>
    <circle cx="64" cy="46" r="22" fill="#1b2432" stroke="#d4af37" stroke-width="1.5"/>
    <polygon points="64,30 67.5,41 79,41 69.5,48 73,59 64,52 55,59 58.5,48 49,41 60.5,41" fill="#ffd977" stroke="#997a2e" stroke-width="0.8"/>
    <rect x="14" y="82" width="100" height="26" rx="3" fill="rgba(10,14,20,0.85)" stroke="#3a485a" stroke-width="1"/>
    <text x="64" y="100" font-family="'Cinzel', 'Noto Serif SC', serif, sans-serif" font-size="12" font-weight="bold" fill="#ffd977" text-anchor="middle" letter-spacing="0.5">${safeText}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/* 渲染领袖肖像 HTML 元素，带 C11 自动回退保护 */
export function renderLeaderPortraitHtml(charOrId, size = 64){
  let id = typeof charOrId === 'string' ? charOrId : charOrId.id;
  let name = typeof charOrId === 'string' ? charOrId : (charOrId.name || id);
  const cleanId = (id || '').replace(/_(cw|ww1|ww2|mod)$/, '');
  let src = (typeof charOrId === 'object' && charOrId.portrait) || ASSET_MAP.leaders[id] || ASSET_MAP.leaders[cleanId] || `assets/portraits/leaders/${id}.png` || `assets/portraits/leaders/${cleanId}.png`;
  let fallback = getProceduralBadgeSvg(id, name);

  return `<img class="sf-leader-img" src="${src}" alt="${name}"
    style="width:100%;height:100%;object-fit:cover;display:block;"
    onerror="this.onerror=null;this.src='${fallback}';">`;
}

/* 渲染将领肖像 HTML 元素 */
export function renderGeneralPortraitHtml(charOrId, width = 56, height = 70){
  let id = typeof charOrId === 'string' ? charOrId : charOrId.id;
  let name = typeof charOrId === 'string' ? charOrId : (charOrId.name || id);
  const cleanId = (id || '').replace(/_(cw|ww1|ww2|mod)$/, '');
  let src = (typeof charOrId === 'object' && charOrId.portrait) || 
            ASSET_MAP.generals[id] || 
            ASSET_MAP.generals[cleanId] || 
            `assets/portraits/generals/${id}.png` || 
            `assets/portraits/generals/${cleanId}.png`;
  let fallback = getProceduralBadgeSvg(id, name);

  return `<img class="sf-general-card-img" src="${src}" alt="${name}" width="${width}" height="${height}"
    style="object-fit:cover;display:block;"
    onerror="this.onerror=null;this.src='${fallback}';">`;
}

/* 通用肖像渲染 */
export function renderPortraitHtml(charOrId, size = 64){
  let id = typeof charOrId === 'string' ? charOrId : charOrId.id;
  let name = typeof charOrId === 'string' ? charOrId : (charOrId.name || id);
  let src = ASSET_MAP.generals[id] || ASSET_MAP.leaders[id] || (typeof charOrId === 'object' && charOrId.portrait) || '';
  let fallback = getProceduralBadgeSvg(id, name);

  return `<img class="sf-portrait-img" src="${src}" alt="${name}" width="${size}" height="${Math.round(size * 1.25)}"
    style="object-fit:cover;border-radius:4px;border:1px solid #4a5468;background:#1a1d24;vertical-align:middle;"
    onerror="this.onerror=null;this.src='${fallback}';">`;
}

/* 渲染国旗 HTML 元素，带做旧材质回退 */
export function renderFlagHtml(tag, width = 36, height = 24){
  let src = `assets/flags/${tag}_weathered.png`;
  let fallbackSvg = `assets/flags/${tag}.svg`;
  let safeFallback = `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#2a3545"/><text x="${width/2}" y="${height/2+4}" font-size="10" font-weight="bold" fill="#ffd977" text-anchor="middle">${tag}</text></svg>`
  )}`;

  return `<img class="sf-flag-img sf-nation-flag" src="${src}" alt="${tag}" width="${width}" height="${height}"
    style="object-fit:cover;border-radius:2px;border:1px solid rgba(255,255,255,0.2);vertical-align:middle;display:inline-block;"
    onerror="this.onerror=function(){this.onerror=null;this.src='${safeFallback}';};this.src='${fallbackSvg}';">`;
}

/* 渲染剧本标题大图 */
export function renderTitleBannerHtml(scKey){
  let src = ASSET_MAP.titles[scKey] || `assets/titles/title_${scKey}.jpg`;
  return `<div class="sf-title-banner" style="position:relative;width:100%;border-radius:6px;overflow:hidden;margin-bottom:12px;border:1px solid #5a6478;max-height:220px;background:#12151b;">
    <img src="${src}" alt="${scKey}" style="width:100%;height:auto;display:block;object-fit:cover;filter:brightness(0.92);"
      onerror="this.style.display='none';">
  </div>`;
}

/* 获取任何人物的高清油画肖像路径（512x640 巨幅，带全路径回退检测） */
export function getCharacterPortraitSrc(charOrId){
  if(!charOrId) return 'assets/portraits/leaders/hitler.png';
  let id = typeof charOrId === 'string' ? charOrId : charOrId.id;
  if(typeof charOrId === 'object' && charOrId.portrait) return charOrId.portrait;
  if(ASSET_MAP.leaders[id]) return ASSET_MAP.leaders[id];
  if(ASSET_MAP.generals[id]) return ASSET_MAP.generals[id];
  return `assets/portraits/generals/${id}.png`;
}

/* 获取历史事件的宽幅油画插图路径 */
export function getEventImageSrc(eventId, era = 'ww2'){
  const EVENT_DIRECT_MAP = {
    ev_01: 'assets/ww2/events/event_danzig_fire.png',
    ev_02: 'assets/events/danzig.jpg',
    ev_03: 'assets/ww2/events/event_warsaw_siege.png',
    ev_04: 'assets/ww2/events/event_fall_of_france.png',
    ev_05: 'assets/ww2/events/event_kursk_armor.png',
    ev_06: 'assets/events/fall_france.jpg',
    ev_07: 'assets/ww2/events/event_factory_worker.png',
    ev_08: 'assets/events/danzig.jpg',
    ev_09: 'assets/ww2/events/event_warsaw_siege.png',
    ev_18: 'assets/ww2/events/event_barbarossa.png',
    ev_26: 'assets/ww2/events/event_kursk_armor.png',
    ev_27: 'assets/ww2/events/event_final_ruins.png',
    ev_33: 'assets/ww2/events/event_fall_of_france.png',
    ev_34: 'assets/ww2/events/event_field_map_room.png',
    ev_40: 'assets/ww2/events/event_final_ruins.png',
    ev_41: 'assets/ww2/events/event_yalta_conference.png'
  };
  if(EVENT_DIRECT_MAP[eventId]) return EVENT_DIRECT_MAP[eventId];
  if(era === 'ww1') return 'assets/events/marne.jpg';
  if(era === 'coldwar') return 'assets/events/berlin_airlift.jpg';
  if(era === 'modern') return 'assets/events/smo_start.jpg';
  return 'assets/ww2/events/event_danzig_fire.png';
}

/* 获取时代战时报纸特刊头版插图路径 */
export function getNewspaperImageSrc(era = 'ww2'){
  const cleanEra = ['ww1', 'ww2', 'coldwar', 'modern'].includes(era) ? era : 'ww2';
  return `assets/${cleanEra}/newspapers/newspaper_${cleanEra}.png`;
}

/* 渲染装备蓝图小图 */
export function getBlueprintSrc(type){
  return ASSET_MAP.blueprints[type] || 'assets/techs/tech_equipment_blueprint_rifle.png';
}

/* 渲染国策母图路径 */
export function getFocusMotherIconSrc(chain = 'industry'){
  const validChains = ['industry', 'army', 'armor', 'air', 'navy', 'diplomacy', 'politics', 'economy', 'social', 'intel', 'nuclear', 'character'];
  const c = validChains.includes(chain) ? chain : 'industry';
  return `assets/icons/focus_mother_${c}.png`;
}
