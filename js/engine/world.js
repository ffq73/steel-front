/* ============================================================
   engine/world.js —— 世界状态构造与查询（纯引擎，禁 DOM）
   v3.0：泛化 loadScenario(id, seed)，兼容 makeWorld(id, seed)
   ============================================================ */

import { K } from '../data/constants.js';
import { NATIONS, AT_WAR } from '../data/nations.js';
import { buildMap } from '../data/map.js';
import { buildProvincePolygons } from '../core/geom.js';
import { SCENARIOS } from '../data/scenarios.js';
import { UNITS } from '../data/units.js';
import { ERAS } from '../data/eras.js';
import { nationColor } from '../core/palette.js';
import { registerScenarioFocuses } from './focus.js';
import { getOrCreateArmy } from './plans.js';
import { initEconSocial } from './econSocial.js';
import { initNuclear } from './nuclear.js';
import { initManpower } from './manpower.js';   // v14.0 P2 人力池初始化
import { initIdeology } from './ideology.js';   // v14.0 P3 意识形态
import { initBloc } from './bloc.js';
import { initDrones } from './drones.js';
import { initSanctions } from './sanctions.js';
import { initMilAid } from './milaid.js';
import { initSpaceRace } from './space.js';
import { initEnergy } from './energy.js';
import { initDiplomacy } from './diplomacy.js';
import { initAir } from './air.js';
import { initNavy } from './navy.js';
import { initIntel } from './intel.js';
import { initDoctrines } from './doctrine.js';
import { initStats } from './stats.js';
import { initSubjects } from './subjects.js';
import { initTemplates, DEFAULT_TEMPLATE_BY_UNIT } from './template.js';
import { assignGeneral, applyGeneralModifiers } from './characters.js';
import { initStates } from './states.js';

export function loadScenario(scenarioId = 'A', seed = 1){
  const sc = SCENARIOS[scenarioId] || SCENARIOS['A'];
  const eraKey = sc.era || 'ww2';
  const era = ERAS[eraKey] || ERAS.ww2;
  const mapData = sc.buildMap ? sc.buildMap() : buildMap();
  const { hexes, at } = mapData;
  buildProvincePolygons(hexes, K.HEX_SIZE);

  // v11.0：剧本国策树注册 —— 此前剧本自带的 88KB 国策树从未进入引擎，
  // 通用表又只覆盖 6 国，导致选中国/日本/美国时国策树是空的
  registerScenarioFocuses(scenarioId, sc.focuses);

  const world = {
    version: 3,
    scenario: scenarioId,
    // v14.1 E6：剧本目标与超时结算数据源（victory.js 统一解释；
    // A 教程剧本无 objectives，仍走其专用分支）
    objectives: sc.objectives || null,
    timeLimit: sc.timeLimit || null,
    era: eraKey,
    eraData: era,
    difficulty: 'general',
    player: sc.player || 'G',
    seed: seed >>> 0,
    rngState: seed >>> 0,
    day: 0,
    over: null,
    hexes,
    at,
    units: [],
    uid: 1,
    nations: {},
    log: [],
    events: [],
    characters: sc.characters ? JSON.parse(JSON.stringify(sc.characters)) : [],
    aiLog: []
  };

  const nationSource = sc.customNations || NATIONS;

  // W0-A3：先建 world.templates —— 必须在任何 spawnUnit 之前，
  // 否则新生成的师拿不到默认编制，battle.js/rivers.js/plans.js 的模板分支全空转。
  initTemplates(world);

  for(const id of sc.nations){
    const nd = nationSource[id] || {
      name: id, color: '#777', civ: 3, mil: 3, equip: 400,
      law: 'partial', warSupport: 50, ai: { prodMul: 1.0, decisionDelay: 2, attackThreshold: 2.0 },
      focusPriority: []
    };

    const startEquip = nd.equip || 400;
    const startMil = nd.mil || 4;

    world.nations[id] = {
      id,
      name: nd.name || id,
      // v11.0：把国家色夹到「深色地图上看得见」的明度区间，并拆开同色族
      color: nationColor(id, nd.color || '#888'),
      alive: true,
      capitulated: false,
      equip: startEquip,
      equipment: {
        inf_eq: Math.floor(startEquip * 1.5),
        art_eq: Math.floor(startEquip * 0.2),
        tank_eq: Math.floor(startEquip * 0.1),
        truck_eq: Math.floor(startEquip * 0.15),
        sup_eq: Math.floor(startEquip * 0.1)
      },
      productionLines: [
        { id:'inf_eq', type:'inf_eq', factories: Math.max(1, Math.floor(startMil * 0.45)), eff: K.EFF_START, cap: K.EFF_CAP },
        { id:'art_eq', type:'art_eq', factories: Math.max(0, Math.floor(startMil * 0.2)), eff: K.EFF_START, cap: K.EFF_CAP },
        { id:'tank_eq', type:'tank_eq', factories: Math.max(0, Math.floor(startMil * 0.2)), eff: K.EFF_START, cap: K.EFF_CAP },
        { id:'truck_eq', type:'truck_eq', factories: Math.max(0, Math.floor(startMil * 0.1)), eff: K.EFF_START, cap: K.EFF_CAP },
        { id:'sup_eq', type:'sup_eq', factories: Math.max(0, startMil - Math.floor(startMil*0.45) - Math.floor(startMil*0.2) - Math.floor(startMil*0.2) - Math.floor(startMil*0.1)), eff: K.EFF_START, cap: K.EFF_CAP }
      ],
      pp: 0,
      civ: nd.civ || 4,
      mil: startMil,
      law: nd.law || 'partial',
      // W0-B3/B4：经济法案与征兵法案是**两套独立字段**。
      // laws.js 写 economicLaw / conscriptionLaw，manpower.js 却读 n.law
      // 去查 CONSCRIPTION_LAWS 表 → 征兵法案的 manpowerRate 永远取不到，
      // ECONOMIC_LAWS.total 的 manpowerPenalty 也从未被读。
      // 这里把两个字段都显式落盘，消掉「读错字段名」这一类断链。
      economicLaw: nd.law || 'partial',
      conscriptionLaw: nd.conscriptionLaw || 'limited',
      tradeLaw: nd.tradeLaw || 'export_focus',
      warSupport: nd.warSupport ?? 50,
      stability: nd.stability ?? 65,
      // v14.1 E6：剧本声望/阵营数据此前从未落盘（coldwar nations.js 里的
      // prestige/faction 是死数据，econSocial 只能拿到 ?? 60 的兜底值）
      prestige: nd.prestige ?? 60,
      faction: nd.faction,
      atWarWith: [],
      build: { q:-1, r:-1, prog:0, need:0, kind:null },
      training: [],
      pool: [],
      techs: [],
      research: { slots:[], done:{} },
      focus: { active:null, progress:0, done:[] },
      focusPriority: nd.focusPriority || [],
      modifiers: {},                       // stat → Σvalue（由科技/国策/法案结算）
      ai: { ...(nd.ai || { prodMul:1.0, decisionDelay:2, attackThreshold:2.0 }), lastDecision:-99 }
    };

    // 初始科研槽
    for(let i=0; i < K.RESEARCH_SLOTS; i++){
      world.nations[id].research.slots.push(null);
    }
  }

  // 开战关系
  const warList = sc.atWar || AT_WAR;
  for(const [a, b] of warList){
    if(world.nations[a] && !world.nations[a].atWarWith.includes(b)){
      world.nations[a].atWarWith.push(b);
    }
    if(world.nations[b] && !world.nations[b].atWarWith.includes(a)){
      world.nations[b].atWarWith.push(a);
    }
  }

  // 预设科技
  if(sc.presetTech){
    for(const id in sc.presetTech){
      if(!world.nations[id]) continue;
      for(const tid of sc.presetTech[id]){
        if(tid){
          world.nations[id].techs.push(tid);
          world.nations[id].research.done[tid] = true;
        }
      }
    }
  }

  // 预设国策
  if(sc.presetFocus){
    for(const id in sc.presetFocus){
      if(world.nations[id]){
        world.nations[id].focus.done = [...sc.presetFocus[id]];
      }
    }
  }

  // 开局兵力部署
  if(sc.armies){
    SF2_deployNations(world, sc.armies);
  }

  // W0-C：开局长官任命。
  // 此前 generalId 恒为 null（唯一赋值点在死代码 panelArmy.js 里），
  // 于是 getGeneralSkills 永远返回 {3,3,3,3} —— 计划积累、战术判定、
  // 指挥官技能对战斗全部失效；385 条将领特质里 268 条因键名不对而空转。
  // 必须在 SF3_raiseFieldArmies **之前**执行：getOrCreateArmy 会顺位认领
  // assignedGenerals 里的第一位，先任命才有将领可认领。
  SF4_assignGenerals(world);

  // v11.0：为每个有部队的国家建立默认野战军
  // —— 作战计划（划前线 / 进攻矛头 / 填线 / 启动执行）此前全线空转：
  //    UI 调 createFront(w, player) 不传 armyId，front.armyId 恒为 null，
  //    assignToFront 谁都挂不上，planningTick 遍历空 divisions 列表，
  //    于是计划加成永远是 0。这里把「师 → 军」的归属关系建成，UI 侧
  //    现有的调用（不传 armyId）由 plans.js 自动解析到本国默认军。
  SF3_raiseFieldArmies(world);

  // 原始归属（投降度计算基准）与核心区标记
  // W0-B1：resistance.js 判占领区用的是 h.core，而此前全库只有 h._orig，
  // 导致 isOccupied 恒为 false —— 抵抗度/顺从度/游击破袭/武装起义整条链空转。
  // _orig 是「历史归属」（用于胜利点与和会），core 是「核心本土」标记（用于占领治理）。
  for(const h of world.hexes){
    h._orig = h.owner;
    h.core = h.owner;
  }

  // W7-1：州 (State) 层初始化 —— 聚合临近省份并建立工厂槽位与资源归属
  initStates(world);

  // v14.1 B8：落盘各国首都格索引（subjects.js 贸易距离等以此为准）。
  // 旧实现用「h.city?.cap === X || h.owner === X」找贸易距离锚点，
  // 第二个条件几乎总先命中任意格 → 距离其实是「两国任意首格」的距离。
  // 存 idx 而非 hex 引用，避免 savegame JSON 序列化出现循环引用。
  for(const id in world.nations){
    const cap = world.hexes.find(h => h.city && h.city.cap === id);
    if(cap) world.nations[id].capitalHexIdx = cap.idx;
  }

  // 单位经验/壕沟字段
  for(const u of world.units){
    u.exp = 1;
    u.level = 1;
    u.entrench = 0;
    u.planning = 0;
  }

  // v14.0 P2：建世界时即初始化人力池（否则暂停状态下顶栏读不到真实值）。
  // 必须放在时代分支之外 —— 四个时代都要有人力池。
  for(const nid in world.nations) initManpower(world, nid);
  // v14.0 P3：意识形态与执政党（决定外交合法性/傀儡等级/AI 倾向）
  initIdeology(world);

  // 冷战与现代剧本特有子系统装配
  if(eraKey === 'coldwar' || eraKey === 'modern'){
    initEconSocial(world);
    initNuclear(world);
    initDiplomacy(world);
    // v8.0 M6：冷战/现代专属子系统（影响力阵营 / 无人机 / 制裁网络 / 军援管道 / 太空竞赛）
    initBloc(world);
    initDrones(world);
    initSanctions(world);
    initMilAid(world);
    initSpaceRace(world);
    initEnergy(world);       // 能源格局：管线 / 断供冲击（现代能源依赖环）
  }

  // v9.0 N1：空军系统初始化（机场、联队、空区划分与制空权）
  initAir(world);
  // v9.0 N2：海军系统初始化（海区划分、舰队编制、海权与情报效率）
  initNavy(world);
  // v9.0 N3：情报与间谍系统初始化（机构5分支、特工名录、4类情报等级）
  initIntel(world);
  // v9.0 N4：军种学说系统初始化（陆海空学说树互斥、XP池、师级经验）
  initDoctrines(world);
  // v9.0 N6：战损统计与战史日志系统初始化
  initStats(world);
  // v9.0 N5：国际贸易网络与附庸自治体系初始化
  initSubjects(world);

  return world;
}

export function makeWorld(scenarioId = 'A', seed = 1){
  return loadScenario(scenarioId, seed);
}

/* 智能部署：把兵力放到与敌国接壤的前线格 */
function SF2_deployNations(world, armies){
  const front = (nat, enemyNat) => world.hexes.filter(h =>
    h.owner===nat && h.adj.some(ni => world.hexes[ni].owner===enemyNat));
  const capHex = (nat) => world.hexes.find(h => h.city && h.city.cap===nat);
  const cities = (nat) => world.hexes.filter(h => h.owner===nat && h.city && !h.city.cap)
    .sort((a,b)=> b.city.w - a.city.w);

  const spread = (nat, types, hexes) => {
    if(!hexes || !hexes.length) return;
    let i = 0;
    for(const t of types){
      const h = hexes[i % hexes.length]; i++;
      spawnUnit(world, t, h.q, h.r, nat);
    }
  };

  for(const id in armies){
    const n = world.nations[id];
    if(!n) continue;
    const enemies = n.atWarWith.filter(e => world.nations[e] && world.nations[e].alive);
    const list = [];
    for(const t in armies[id]){
      for(let i=0; i < armies[id][t]; i++) list.push(t);
    }
    if(!enemies.length){
      spread(id, list, capHex(id) ? [capHex(id)] : cities(id));
      continue;
    }
    // 剧本 A 保持史实设定：德军全主力压向波兰前线
    if(world.scenario === 'A'){
      const main = front(id, enemies[0]);
      spread(id, list, main.length ? main : (capHex(id) ? [capHex(id)] : []));
      continue;
    }

    // 多战线剧本（如一战东西两线、现代俄乌/中东）：首都预留卫戍，部队均匀分配至各大敌国前线
    const cap = capHex(id);
    if(cap && list.length >= 6){
      const garrCount = Math.min(2, Math.floor(list.length * 0.08));
      for(let i=0; i<garrCount; i++){
        spawnUnit(world, list.shift(), cap.q, cap.r, id);
      }
    }

    const allFronts = [];
    for(const e of enemies){
      const f = front(id, e);
      if(f.length) allFronts.push(f);
    }

    if(!allFronts.length){
      spread(id, list, cap ? [cap] : cities(id));
      continue;
    }

    let fIdx = 0;
    for(const t of list){
      const curFront = allFronts[fIdx % allFronts.length];
      const h = curFront[(Math.floor(fIdx / allFronts.length)) % curFront.length];
      spawnUnit(world, t, h.q, h.r, id);
      fIdx++;
    }
  }
}

/* v11.0：把每个参战国的师编成野战军（每军不超过 K.ARMY_MAX_DIVISIONS），
   并回写 u.armyId。作战计划系统依赖这层归属，否则整条链路空转。 */
function SF3_raiseFieldArmies(world){
  for(const id in world.nations){
    const mine = world.units.filter((u) => u.hp > 0 && u.nat === id);
    if(!mine.length) continue;
    const per = Math.max(1, K.ARMY_MAX_DIVISIONS || 24);
    for(let i = 0; i < mine.length; i += per){
      const slice = mine.slice(i, i + per);
      const no = Math.floor(i / per) + 1;
      const army = getOrCreateArmy(
        world,
        `army_${id}_${no}`,
        id,
        `${world.nations[id].name}第${no}野战军`
      );
      army.divisions = slice.map((u) => u.id);
      for(const u of slice) u.armyId = army.id;
    }
  }
}

/* W0-C：开局长官任命 —— 把剧本自带的将领挂到 assignedGenerals，
   并结算其特质加成。数量上限 = 该国将建的军数（每军一位，与 HOI4 的
   "一名将领带 24 师、5 名元帅带 5 个军" 口径一致；多余的将领留给玩家改派）。 */
function SF4_assignGenerals(world){
  const chars = world.characters || [];
  const alias = (world.scenario && SCENARIOS[world.scenario] && SCENARIOS[world.scenario].nationAlias) || {};
  for(const id in world.nations){
    const n = world.nations[id];
    const divCount = world.units.filter(u => u.nat === id && u.hp > 0).length;
    if(!divCount) continue;
    const armyCount = Math.max(1, Math.ceil(divCount / (K.ARMY_MAX_DIVISIONS || 24)));
    // 角色名册可能用另一套国号（剧本 A 用单字母代号，角色用 GER/POL/…）
    const codes = new Set([id, alias[id]].filter(Boolean));
    const pool = chars.filter(c => codes.has(c.nat) && c.type === 'general');
    if(!pool.length) continue;
    // 元帅优先（rank === 'marshal'），其余按原顺序
    pool.sort((a, b) => (b.rank === 'marshal' ? 1 : 0) - (a.rank === 'marshal' ? 1 : 0));
    for(const c of pool.slice(0, armyCount)) assignGeneral(world, c.id, id);
    applyGeneralModifiers(world, id);
  }
}

export function spawnUnit(world, type, q, r, nat){
  const u = UNITS[type] || UNITS.inf;
  const unit = {
    id: world.uid++, type, nat, q, r,
    org: u.org, hp: u.hp, exp: 1, level: 1, entrench: 0, planning: 0, order: null
  };
  // W0-A3：挂上该兵种的默认编制（构成比 1.0，零平衡漂移）。
  // 玩家在编制设计器里换模板后，这里保存的 templateId 才会产生差异。
  if(DEFAULT_TEMPLATE_BY_UNIT[type]) unit.templateId = DEFAULT_TEMPLATE_BY_UNIT[type];
  world.units.push(unit);
  const targetHex = world.at[q + ',' + r];
  if(targetHex){
    targetHex.units = targetHex.units || [];
    targetHex.units.push(unit.id);
  }
  return unit;
}

export function hexUnits(world, h){
  if(!h || !h.units) return [];
  return h.units.map(id => world.units.find(u => u.id === id)).filter(Boolean);
}
export function hexAt(world, q, r){ return world.at[q + ',' + r] || null; }
export function unitById(world, id){ return world.units.find(u => u.id === id) || null; }
export function log(world, text, kind){
  world.log.unshift({ day: world.day, text, kind: kind || '' });
  if(world.log.length > 150) world.log.pop();
}
