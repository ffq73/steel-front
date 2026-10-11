/* ============================================================
   engine/navy.js —— 海军系统核心引擎 (v9.0 §4-N2 / 附录 B.3) [H]
   包含：海区划分、舰队编制、海军优势(制海权)与40%情报硬门槛、
         屏卫比(3:1)与命中撤退加成、海战开火与穿甲暴击、
         登陆作战准备天数与制海门槛判定、破交与运输船护航
   ============================================================ */

import { K } from '../data/constants.js';
import { atlasIsSea } from '../data/atlas.js';
import { hexDist } from '../core/geom.js';

/* 预设战略海区定义 (覆盖 20×14 地图所有海域) [H] */
/* ------------------------------------------------------------
   海区：按图集（data/atlas.js 的 64×30 欧洲图集）的经纬度区间派生。
   图集坐标 → 经度 ≈ -12 + q×1.47，纬度 ≈ 71 - r×1.43。
   一战与二战共用该图集，因此同一张海区表对两个剧本同时成立；
   其余剧本（剧本 A / 冷战 / 现代）地图不同，由 seaZonesFor 兜底成单一近海区，
   保证登陆门槛在这些剧本里依然可判定。
   v11.0 变更动因：原表写的是旧 26×16 地图的格子坐标，换图后全图
   getHexSeaZone() 返回 null —— 两栖登陆一直不可用，且警报里的
   「登陆准备完毕」永远不触发。
   ------------------------------------------------------------ */
const SEA_ZONE_BOXES = [
  { id: 'sz_arctic',        name: '挪威海与北冰洋', box: [ 8,  1, 22,  7] },
  // 英吉利海峡在本图只有 2 格宽，单列成区无法做制海权定量，与北海合并
  { id: 'sz_north_sea',     name: '北海与英吉利海峡', box: [ 7,  8, 17, 16] },
  { id: 'sz_baltic',        name: '波罗的海',       box: [18,  7, 26, 12] },
  { id: 'sz_bay_of_biscay', name: '比斯开湾与大西洋', box: [ 6, 14, 14, 22] },
  { id: 'sz_mediterranean', name: '地中海',         box: [16, 18, 40, 24] },
  { id: 'sz_black_sea',     name: '黑海',           box: [31, 16, 43, 21] },
  { id: 'sz_red_sea_gulf',  name: '红海与波斯湾',   box: [30, 24, 46, 29] }
];

/* 从图集掩膜算出每个海区实际包含的海面格 */
function buildSeaZones() {
  const out = [];
  for (const spec of SEA_ZONE_BOXES) {
    const [q0, r0, q1, r1] = spec.box;
    const hexes = [];
    let sq = 0, sr = 0;
    for (let r = r0; r <= r1; r++) {
      for (let q = q0; q <= q1; q++) {
        if (!atlasIsSea(q, r)) continue;
        hexes.push([q, r]); sq += q; sr += r;
      }
    }
    if (hexes.length < 2) continue;   // 空壳海区直接丢掉
    out.push({
      id: spec.id,
      name: spec.name,
      center: [Math.round(sq / hexes.length), Math.round(sr / hexes.length)],
      hexes
    });
  }
  return out;
}

export const SEA_ZONES = buildSeaZones();

/* 该世界是否就是图集网格？抽若干已知格核对海陆，全中才算。
   否则（剧本 A 带裁剪偏移、冷战/现代另有地图）图集海区会「碰巧」命中
   几格，得出一个看似有效其实错位的海区 —— 比直接兜底更危险。 */
function isAtlasGrid(world) {
  const probe = [[23, 13], [20, 10], [16, 15], [40, 12], [16, 21], [34, 10]];
  let hit = 0;
  for (const [q, r] of probe) {
    const h = world.at[q + ',' + r];
    if (!h) continue;
    if ((h.terrain === 'sea') === atlasIsSea(q, r)) hit++;
  }
  return hit >= probe.length - 1;
}

/** 某剧本地图上的海区：图集网格用派生表；否则把全部海面格并成一个近海区 */
export function seaZonesFor(world) {
  if (!world || !world.at) return SEA_ZONES;
  if (isAtlasGrid(world)) {
    const hits = [];
    for (const sz of SEA_ZONES) {
      const hexes = sz.hexes.filter(([q, r]) => {
        const h = world.at[q + ',' + r];
        return h && h.terrain === 'sea';
      });
      if (hexes.length >= 2) hits.push({ ...sz, hexes });
    }
    if (hits.length) return hits;
  }
  const hexes = [];
  let sq = 0, sr = 0;
  for (const h of world.hexes) {
    if (h.terrain !== 'sea') continue;
    hexes.push([h.q, h.r]); sq += h.q; sr += h.r;
  }
  if (!hexes.length) return [];
  return [{
    id: 'sz_coastal', name: '近海',
    center: [Math.round(sq / hexes.length), Math.round(sr / hexes.length)],
    hexes
  }];
}

/* 查找坐标所属海区 */
export function getHexSeaZone(q, r, zones){
  // v11.0：第三参可传 seaZonesFor(world) 的结果 —— 剧本 A / 冷战 / 现代
  // 的地图与图集不同，必须用它们各自解析出的海区表
  for(const sz of (zones || SEA_ZONES)){
    if(sz.hexes.some(([sq, sr]) => sq === q && sr === r)){
      return sz.id;
    }
  }
  return null;
}

/* 1. 单舰海军优势基数计算 [H]
   公式：0.005 × IC造价 + 0.05 × 舰员数
   参考值：战列舰 ≈ 300点，航母 ≈ 280点，重巡 ≈ 118点，轻巡 ≈ 79点，驱逐 ≈ 25点，潜艇 ≈ 8.5点 */
export function calcSingleShipSuperiority(shipType){
  const cfg = K.NAVY.SHIP_PARAMS[shipType];
  if(!cfg) return 0;
  const ic = cfg.ic || 1000;
  const mp = cfg.manpower || 200;
  return +(0.005 * ic + 0.05 * mp).toFixed(2);
}

/* 2. 舰队屏卫效率与航母掩护比计算 [H]
   - 屏卫比：每 1 艘资本舰(BB/CA)需 3 艘屏卫舰(DD/CL)
   - 满屏卫命中加成 +40%，撤退速度 +20%
   - 航母比：每 1 艘航母(CV)需 1 艘资本舰掩护，达标出击效率 +10% */
export function calcFleetScreening(ships){
  let capitals = 0, screens = 0, carriers = 0, subs = 0, convoys = 0;
  for(const s of ships){
    const type = typeof s === 'string' ? s : s.type;
    const cfg = K.NAVY.SHIP_PARAMS[type];
    if(!cfg) continue;
    if(cfg.type === 'capital') capitals++;
    else if(cfg.type === 'screen') screens++;
    else if(cfg.type === 'carrier') carriers++;
    else if(cfg.type === 'sub') subs++;
    else if(cfg.type === 'convoy') convoys++;
  }

  // 屏卫效率
  const neededScreens = capitals * K.NAVY.SCREEN_RATIO_REQUIRED;
  const screenRatio = capitals > 0 ? Math.min(1.0, screens / neededScreens) : 1.0;
  const hitBonus = +(screenRatio * K.NAVY.SCREEN_FULL_HIT_BONUS).toFixed(4);
  const retreatBonus = +(screenRatio * K.NAVY.SCREEN_FULL_RETREAT_BONUS).toFixed(4);

  // 航母掩护
  const carrierCovered = carriers === 0 ? true : (capitals >= carriers * K.NAVY.CARRIER_CAPITAL_RATIO);
  const carrierSortieBonus = carrierCovered && carriers > 0 ? K.NAVY.CARRIER_SORTIE_EFF_BONUS : 0.0;

  return {
    capitals,
    screens,
    carriers,
    subs,
    convoys,
    screenRatio: +screenRatio.toFixed(3),
    hitBonus,
    retreatBonus,
    carrierCovered,
    carrierSortieBonus
  };
}

/* 3. 海区海权计算与 40% 情报硬门槛 [H]
   公式：海权 = Σ单舰优势 × 任务乘数 × 制空乘数 × 水雷乘数 × 海军情报乘数
   ⚠️ 核心硬约束：海军情报效率 < 40% → 海权强制归零 (0)！ */
export function calcSeaZoneSuperiority(world, seaZoneId){
  const sz = SEA_ZONES.find(z => z.id === seaZoneId);
  const fleets = (world.fleets || []).filter(f => f.seaZoneId === seaZoneId && f.ships?.length > 0);
  const scores = {};
  const fleetReports = [];

  for(const fl of fleets){
    scores[fl.nat] = scores[fl.nat] || 0;
    const taskMul = (K.NAVY.TASK_MULTIPLIERS && K.NAVY.TASK_MULTIPLIERS[fl.task] != null)
      ? K.NAVY.TASK_MULTIPLIERS[fl.task]
      : 1.0;

    // 海军情报效率（默认 0.60，受特工网络与空中侦察影响）
    const intelEff = (world.intelEfficiency?.[fl.nat] != null) ? world.intelEfficiency[fl.nat] : 0.60;

    // 单舰队基础海权分
    let fleetBaseScore = 0;
    for(const sh of fl.ships){
      const type = typeof sh === 'string' ? sh : sh.type;
      fleetBaseScore += calcSingleShipSuperiority(type);
    }

    // 制空加成乘数：若空区有制空权，制空优势可达 1.25x，劣势 0.75x
    const airRatio = fl.airRatio ?? 0.50;
    const airMul = +(0.75 + airRatio * 0.50).toFixed(2);

    // 水雷乘数
    const mineCount = world.seaMines?.[seaZoneId]?.[fl.nat] || 0;
    const mineMul = +(1.0 + Math.min(0.50, mineCount * 0.001)).toFixed(2);

    // 硬门槛判定：情报效率 < 40% → 海权为 0 [H]
    let finalFleetSup = 0;
    if(intelEff < K.NAVY.INTEL_THRESHOLD){
      finalFleetSup = 0;
    } else {
      finalFleetSup = +(fleetBaseScore * taskMul * airMul * mineMul * intelEff).toFixed(2);
    }

    scores[fl.nat] += finalFleetSup;
    fleetReports.push({
      fleetId: fl.id,
      nat: fl.nat,
      baseScore: fleetBaseScore,
      taskMul,
      intelEff,
      intelBelowThreshold: intelEff < K.NAVY.INTEL_THRESHOLD,
      finalSup: finalFleetSup
    });
  }

  // 计算双方比例
  const total = Object.values(scores).reduce((s, v) => s + v, 0);
  const ratios = {};
  const status = {};

  for(const nat in scores){
    const s = scores[nat];
    const enemySum = total - s;
    const ratio = total > 0 ? (s / (s + enemySum)) : 0.50;
    ratios[nat] = +ratio.toFixed(4);
    if(ratio >= 0.60) status[nat] = 'green';
    else if(ratio >= 0.40) status[nat] = 'yellow';
    else status[nat] = 'red';
  }

  return { seaZoneId, scores, total: +total.toFixed(2), ratios, status, fleets: fleetReports };
}

/* 4. 登陆作战准备天数与制海条件检验 [H]
   - 准备时间：每师 7 天（10 师 = 70 天）；1940 登陆艇减半
   - 登陆条件：经行海区海权 > 50% 且海军情报效率 >= 40% */
export function calcNavalInvasionPrep(divisionCount, has1940Tech = false){
  const daysPerDiv = has1940Tech
    ? (K.NAVY.INVASION_PREP_DAYS_PER_DIV / 2)
    : K.NAVY.INVASION_PREP_DAYS_PER_DIV;
  return Math.ceil(divisionCount * daysPerDiv);
}

export function validateNavalInvasion(world, nat, pathSeaZoneIds){
  if(!pathSeaZoneIds || !pathSeaZoneIds.length){
    return { ok: false, reason: '未指定登陆路径经行海区' };
  }

  const intelEff = (world.intelEfficiency?.[nat] != null) ? world.intelEfficiency[nat] : 0.60;
  if(intelEff < K.NAVY.INVASION_INTEL_REQ){
    return {
      ok: false,
      reason: `海军情报效率仅 ${(intelEff * 100).toFixed(0)}%，低于 40% 硬门槛，无法锁定护航航道与掌握海情`
    };
  }

  for(const szId of pathSeaZoneIds){
    const data = calcSeaZoneSuperiority(world, szId);
    const ratio = data.ratios?.[nat] ?? 0;
    if(ratio <= K.NAVY.INVASION_SUPERIORITY_REQ){
      const szName = SEA_ZONES.find(z => z.id === szId)?.name || szId;
      return {
        ok: false,
        reason: `${szName} 制海权不足（当前 ${(ratio * 100).toFixed(1)}% ≤ 50%），存在被敌水面舰队拦截覆灭风险`
      };
    }
  }

  return { ok: true, reason: '海况良好，海权与情报满足登陆发起条件' };
}

/* 5. 海战穿甲减伤与暴击结算 [H]
   - 穿甲减伤：-90% × (1 - 穿甲/装甲)，上限 90%
   - 暴击：鱼雷 20%，其他火炮 10%；弹仓命中 +900% (10x伤害) */
export function calcNavalDamage(attackerWeapon, defenderArmor, isTorpedo = false, rng = Math.random){
  const rawDmg = attackerWeapon.damage || 50;
  const piercing = attackerWeapon.piercing || 10;
  const armor = defenderArmor || 10;

  let pierceMitigation = 0;
  if(armor > piercing){
    const ratio = piercing / armor;
    pierceMitigation = Math.min(K.NAVY.PIERCE_DEF_MAX_REDUCTION, (1.0 - ratio) * 0.90);
  }

  const critChance = isTorpedo ? K.NAVY.CRIT_CHANCE_TORPEDO : K.NAVY.CRIT_CHANCE_GUN;
  const isCrit = rng() < critChance;
  const isMagazineDetonation = isCrit && (rng() < 0.15); // 暴击中 15% 几率引爆弹药库

  let dmg = rawDmg * (1 - pierceMitigation);
  if(isMagazineDetonation){
    dmg *= (1 + K.NAVY.MAGAZINE_DETONATION_MULT); // +900% 致命殉爆
  } else if(isCrit){
    dmg *= 2.0; // 普通暴击 2x
  }

  return {
    damage: +dmg.toFixed(2),
    pierceMitigation: +pierceMitigation.toFixed(3),
    isCrit,
    isMagazineDetonation
  };
}

/* 6. 初始化世界海军数据 */
export function initNavy(world){
  world.fleets = world.fleets || [];
  world.seaZones = seaZonesFor(world);
  world.seaMines = world.seaMines || {};
  world.convoys = world.convoys || {};
  world.intelEfficiency = world.intelEfficiency || {};

  const gerTag = world.nations['GER'] ? 'GER' : (world.nations['G'] ? 'G' : 'GER');
  const gbrTag = world.nations['GBR'] ? 'GBR' : (world.nations['B'] ? 'B' : 'GBR');
  const sovTag = world.nations['SOV'] ? 'SOV' : (world.nations['S'] ? 'S' : 'SOV');
  const fraTag = world.nations['FRA'] ? 'FRA' : (world.nations['F'] ? 'F' : 'FRA');

  // 初始化各强国情报效率基准
  world.intelEfficiency[gerTag] = world.intelEfficiency[gerTag] ?? 0.65;
  world.intelEfficiency[gbrTag] = world.intelEfficiency[gbrTag] ?? 0.85;
  world.intelEfficiency[sovTag] = world.intelEfficiency[sovTag] ?? 0.50;
  world.intelEfficiency[fraTag] = world.intelEfficiency[fraTag] ?? 0.60;

  // 初始化预设主力舰队与分舰队
  if(!world.fleets.length){
    // 德国海军 (公海舰队与狼群)
    world.fleets.push({
      id: `fleet_${gerTag}_kbf`,
      name: '德意志公海战斗群',
      nat: gerTag,
      seaZoneId: 'sz_baltic',
      task: 'patrol',
      ships: [
        { id: 'bb_bismarck', type: 'bb', name: '俾斯麦号战列舰', hp: 450, org: 50 },
        { id: 'bb_tirpitz', type: 'bb', name: '提尔皮茨号战列舰', hp: 450, org: 50 },
        { id: 'ca_hipper', type: 'ca', name: '希佩尔海军上将号', hp: 220, org: 45 },
        { id: 'ca_eugen', type: 'ca', name: '欧根亲王号', hp: 220, org: 45 },
        { id: 'cl_leipzig', type: 'cl', name: '莱比锡号轻巡', hp: 160, org: 50 },
        { id: 'cl_nurnberg', type: 'cl', name: '纽伦堡号轻巡', hp: 160, org: 50 },
        { id: 'dd_z1', type: 'dd', name: '第1驱逐舰队', hp: 80, org: 55 },
        { id: 'dd_z2', type: 'dd', name: '第2驱逐舰队', hp: 80, org: 55 },
        { id: 'dd_z3', type: 'dd', name: '第3驱逐舰队', hp: 80, org: 55 },
        { id: 'dd_z4', type: 'dd', name: '第4驱逐舰队', hp: 80, org: 55 }
      ]
    });

    world.fleets.push({
      id: `fleet_${gerTag}_wolfpack`,
      name: '大西洋破交潜艇第1支队',
      nat: gerTag,
      seaZoneId: 'sz_north_sea',
      task: 'convoy_raiding',
      ships: [
        { id: 'u47', type: 'ss', name: 'U-47 潜艇', hp: 40, org: 30 },
        { id: 'u48', type: 'ss', name: 'U-48 潜艇', hp: 40, org: 30 },
        { id: 'u99', type: 'ss', name: 'U-99 潜艇', hp: 40, org: 30 },
        { id: 'u100', type: 'ss', name: 'U-100 潜艇', hp: 40, org: 30 }
      ]
    });

    // 英国皇家海军 (本土舰队与海峡巡防)
    world.fleets.push({
      id: `fleet_${gbrTag}_home`,
      name: '皇家海军本土主力舰队',
      nat: gbrTag,
      seaZoneId: 'sz_north_sea',
      task: 'strike',
      ships: [
        { id: 'bb_hood', type: 'bb', name: '胡德号战列巡洋舰', hp: 430, org: 50 },
        { id: 'bb_king_george', type: 'bb', name: '乔治五世国王号', hp: 450, org: 50 },
        { id: 'cv_ark_royal', type: 'cv', name: '皇家方舟号航母', hp: 350, org: 40 },
        { id: 'ca_norfolk', type: 'ca', name: '诺福克号重巡', hp: 220, org: 45 },
        { id: 'ca_suffolk', type: 'ca', name: '萨福克号重巡', hp: 220, org: 45 },
        { id: 'cl_belfast', type: 'cl', name: '贝尔法斯特号轻巡', hp: 160, org: 50 },
        { id: 'cl_sheffield', type: 'cl', name: '谢菲尔德号轻巡', hp: 160, org: 50 },
        { id: 'dd_tribal1', type: 'dd', name: '部落级驱逐群A', hp: 80, org: 55 },
        { id: 'dd_tribal2', type: 'dd', name: '部落级驱逐群B', hp: 80, org: 55 },
        { id: 'dd_tribal3', type: 'dd', name: '部落级驱逐群C', hp: 80, org: 55 },
        { id: 'dd_tribal4', type: 'dd', name: '部落级驱逐群D', hp: 80, org: 55 }
      ]
    });

    // 苏联红旗波罗的海舰队
    world.fleets.push({
      id: `fleet_${sovTag}_baltic`,
      name: '红旗波罗的海舰队',
      nat: sovTag,
      seaZoneId: 'sz_baltic',
      task: 'patrol',
      ships: [
        { id: 'bb_marat', type: 'bb', name: '马拉号战列舰', hp: 420, org: 45 },
        { id: 'ca_kirov', type: 'ca', name: '基洛夫号巡洋舰', hp: 210, org: 45 },
        { id: 'cl_maxim', type: 'cl', name: '马克西姆·高尔基号', hp: 155, org: 50 },
        { id: 'dd_gnevny1', type: 'dd', name: '愤怒级驱逐群', hp: 80, org: 55 },
        { id: 'ss_shch1', type: 'ss', name: '鲑鱼级潜艇编队', hp: 40, org: 30 }
      ]
    });
  }
}

/* 沿海陆战重炮岸轰支援 [H] (W6) */
export function getShoreBombardmentModifier(world, hex, friendlyNat, enemyNat){
  if(!world || !hex || !K.NAVY || !K.NAVY.ENABLE_COMBAT_MODIFIER) return { atkMul: 1.0, defMul: 1.0 };
  if(!hex.adj || !hex.adj.length) return { atkMul: 1.0, defMul: 1.0 };
  const seaAdj = hex.adj.map(idx => world.hexes[idx]).filter(h => h && h.terrain === 'sea');
  if(!seaAdj.length) return { atkMul: 1.0, defMul: 1.0 };

  let friendlyGuns = 0;
  for(const sh of seaAdj){
    const szId = getHexSeaZone(sh.q, sh.r, world.seaZones);
    if(!szId) continue;
    const fleets = (world.fleets || []).filter(f => f.seaZoneId === szId && f.nat === friendlyNat && f.task !== 'retreat');
    for(const fl of fleets){
      for(const s of (fl.ships || [])){
        const type = typeof s === 'string' ? s : s.type;
        if(type === 'bb') friendlyGuns += 4;
        else if(type === 'ca') friendlyGuns += 2;
        else if(type === 'cl') friendlyGuns += 1;
      }
    }
  }

  if(friendlyGuns <= 0) return { atkMul: 1.0, defMul: 1.0 };
  const debuff = Math.min(Math.abs(K.NAVY.SHORE_BOMBARDMENT_MAX || 0.25), friendlyGuns * 0.02);
  return {
    atkMul: +(1.0 + debuff * 0.5).toFixed(3),
    defMul: +(1.0 - debuff).toFixed(3)
  };
}

/* 战略海区水面与潜艇舰队交战实质模型 [H] (W6) */
export function navalCombatTick(world, rng = Math.random){
  if(!world.fleets || !world.fleets.length || !K.NAVY || !K.NAVY.ENABLE_COMBAT_MODIFIER) return;

  const zones = world.seaZones || SEA_ZONES;
  for(const sz of zones){
    const fleetsInZone = world.fleets.filter(f => f.seaZoneId === sz.id && f.ships && f.ships.length > 0 && f.task !== 'retreat');
    if(fleetsInZone.length < 2) continue;

    for(let i = 0; i < fleetsInZone.length; i++){
      for(let j = i + 1; j < fleetsInZone.length; j++){
        const fA = fleetsInZone[i];
        const fB = fleetsInZone[j];
        if(!fA.ships.length || !fB.ships.length) continue;
        const atWar = world.nations[fA.nat]?.atWarWith?.includes(fB.nat);
        if(!atWar) continue;

        // 接触检定
        if(rng() > 0.40) continue;
        resolveNavalClash(world, fA, fB, rng);
      }
    }
  }
}

/** 两个舰队的一轮交火结算 */
function resolveNavalClash(world, fA, fB, rng){
  const scrA = calcFleetScreening(fA.ships);
  const scrB = calcFleetScreening(fB.ships);

  exchangeFire(world, fA, fB, scrB, scrA.hitBonus, rng);
  if(fB.ships.length > 0 && fA.ships.length > 0){
    exchangeFire(world, fB, fA, scrA, scrB.hitBonus, rng);
  }

  checkFleetRetreat(world, fA);
  checkFleetRetreat(world, fB);
}

function exchangeFire(world, attackerFleet, defenderFleet, defScreening, attHitBonus, rng){
  if(!attackerFleet.ships.length || !defenderFleet.ships.length) return;

  const attShip = attackerFleet.ships[Math.floor(rng() * attackerFleet.ships.length)];
  const attType = typeof attShip === 'string' ? attShip : attShip.type;
  const attParam = K.NAVY.SHIP_PARAMS[attType] || { armor: 10, piercing: 10, ic: 1000 };

  const screens = defenderFleet.ships.filter(s => {
    const t = typeof s === 'string' ? s : s.type;
    return t === 'dd' || t === 'cl';
  });
  const capitals = defenderFleet.ships.filter(s => {
    const t = typeof s === 'string' ? s : s.type;
    return t === 'bb' || t === 'ca' || t === 'cv';
  });

  let targetShip;
  const bypassScreen = defScreening.screenRatio < 1.0 && rng() > defScreening.screenRatio;
  if(bypassScreen && capitals.length > 0){
    targetShip = capitals[Math.floor(rng() * capitals.length)];
  } else if(screens.length > 0){
    targetShip = screens[Math.floor(rng() * screens.length)];
  } else {
    targetShip = defenderFleet.ships[Math.floor(rng() * defenderFleet.ships.length)];
  }

  const defType = typeof targetShip === 'string' ? targetShip : targetShip.type;
  const defParam = K.NAVY.SHIP_PARAMS[defType] || { armor: 10, piercing: 10 };

  const hitChance = K.NAVY.BASE_HIT_CHANCE * (1 + attHitBonus);
  if(rng() > hitChance) return;

  const isTorpedo = attType === 'ss' || (attType === 'dd' && rng() < 0.5);
  let weaponDmg = (attParam.piercing || 10) * 4;
  if(attType === 'cv') weaponDmg *= K.NAVY.CARRIER_PLANE_DAMAGE_MULT;

  const hitResult = calcNavalDamage(
    { damage: weaponDmg, piercing: attParam.piercing },
    defParam.armor,
    isTorpedo,
    rng
  );

  targetShip.hp = Math.max(0, (targetShip.hp || 100) - hitResult.damage);
  targetShip.org = Math.max(0, (targetShip.org || 50) - Math.round(hitResult.damage * 0.25));

  if(targetShip.hp <= 0){
    const idx = defenderFleet.ships.indexOf(targetShip);
    if(idx >= 0) defenderFleet.ships.splice(idx, 1);

    const shipName = targetShip.name || `${defenderFleet.nat} ${defType}`;
    const detonationTxt = hitResult.isMagazineDetonation ? '【💥弹药库致命殉爆】' : '';
    world.events = world.events || [];
    world.events.push({
      type: 'naval_ship_sunk',
      day: world.day,
      important: true,
      text: `🌊 海战捷报：${attackerFleet.name} 击沉了 ${defenderFleet.name} 的【${shipName}】！${detonationTxt}`
    });
  }
}

function checkFleetRetreat(world, fleet){
  if(!fleet.ships || !fleet.ships.length) return;
  const avgOrg = fleet.ships.reduce((s, sh) => s + (sh.org || 0), 0) / fleet.ships.length;
  if(avgOrg < 15 && fleet.task !== 'retreat'){
    fleet.task = 'retreat';
    world.events = world.events || [];
    world.events.push({
      type: 'naval_fleet_retreat',
      day: world.day,
      important: false,
      text: `⚓ 组织溃散：${fleet.name} 遭受严重创伤，全队脱离接触撤回基地港口！`
    });
  }
}

/* 7. 每日海军总结算管线 (每日 step 9 调用) */
export function navyTick(world, rng = Math.random){
  if(!world.fleets || !world.fleets.length) return;

  // 1. 刷新全海区制海权态势缓存
  world.seaSuperiorityCache = {};
  for(const sz of SEA_ZONES){
    world.seaSuperiorityCache[sz.id] = calcSeaZoneSuperiority(world, sz.id);
  }

  // 2. 水面与潜艇舰队实质交火结算 [H] (W6)
  navalCombatTick(world, rng);

  // 3. 破交巡检与运输船损失模拟 [H]
  const raidingFleets = world.fleets.filter(f => f.task === 'convoy_raiding');
  for(const fl of raidingFleets){
    const enemies = Object.keys(world.nations).filter(n => {
      return world.nations[fl.nat]?.atWarWith?.includes(n);
    });
    if(!enemies.length) continue;

    // 潜艇对运输船高权重 600 猎杀
    if(rng() < 0.25){ // 25% 日接触概率
      const targetNat = enemies[Math.floor(rng() * enemies.length)];
      const victim = world.nations[targetNat];
      if(victim && (victim.convoys || 50) > 0){
        const sunk = Math.min(victim.convoys || 50, Math.floor(1 + rng() * 3));
        victim.convoys = Math.max(0, (victim.convoys || 50) - sunk);
        if(world.events && (fl.nat === world.player || targetNat === world.player)){
          world.events.push({
            type: 'naval_convoy_sunk',
            day: world.day,
            text: `【大西洋破交】${fl.name} 伏击击沉了 ${targetNat} 的 ${sunk} 艘远洋运输船！`,
            important: false
          });
        }
      }
    }
  }
}

/* ============================================================
   v14.0 P4 —— 海军科技门控
   舰种与登陆能力改由 nation.unlockedShips / features 决定，
   运输船 → 登陆兵力上限 10，登陆艇 → 20（HOI4 运输科技链）。
   ============================================================ */

/** 某国当前可建造的舰种 */
export function shipsAvailable(world, natId){
  const n = world.nations[natId];
  if(!n) return [];
  if(!n.unlockedShips || !n.unlockedShips.length) return ['convoy'];   // 旧档兼容
  return n.unlockedShips;
}

/** 登陆兵力上限（运输船 10 / 登陆艇 20） */
export function invasionCapacity(world, natId){
  const n = world.nations[natId];
  if(!n) return 10;
  // W7-2：海军基地等级扩登陆容量（B5 建造的 naval_base 首个游戏读点）
  let navalLevels = 0;
  for(const h of world.hexes){
    if(h.owner !== natId) continue;
    navalLevels += (h.buildings && h.buildings.naval_base) || h.naval_base || 0;
  }
  return (n.invasionCap || 10) + Math.min(10, navalLevels * 2);
}

/** 是否具备某特性（核打击 / 火箭 / 登陆艇） */
export function hasFeature(world, natId, feature){
  const n = world.nations[natId];
  return !!(n && n.features && n.features[feature]);
}
