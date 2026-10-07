/* ============================================================
   engine/invasion.js —— 两栖登陆作战 (v11.0)
   ------------------------------------------------------------
   动因：面板上的「发起跨海登陆筹备」此前只 `alert(...)` 一句，
   `engine/navy.js` 只有只读的 validateNavalInvasion / calcNavalInvasionPrep，
   世界状态里也从来没有 `navalInvasions` 这个字段 ——
   于是警报收集器里的「两栖登陆准备完毕」也是一条永远不触发的死条件。
   诺曼底在这款游戏里是不存在的。

   本模块把这条链补全为三步：
     1. planNavalInvasion   校验（海权/情报门槛沿用 navy.js 的 [H] 规则）+ 立项
     2. invasionTick        每日推进准备进度，到时 ready
     3. executeNavalInvasion 实际把师团送上海滩（含滩头组织度惩罚）

   滩头惩罚采用「登陆当日一次性削减组织度」的写法，而不是改 battle.js 的
   攻防系数 —— 后者会动到 tools/sim.js 的 B1–B15 基准断言。
   ============================================================ */

import { K } from '../data/constants.js';
import { calcNavalInvasionPrep, validateNavalInvasion } from './navy.js';
import { hexDist, oddrNeighbors } from '../core/geom.js';

/* 登陆当日滩头组织度保留比例（[H] 诺曼底式抢滩：部队上岸即处于混乱状态） */
const BEACHHEAD_ORG_KEEP = 0.40;

function relocate(world, u, hex){
  const from = world.at[u.q + ',' + u.r];
  if(from && from.units){
    const i = from.units.indexOf(u.id);
    if(i >= 0) from.units.splice(i, 1);
  }
  u.q = hex.q; u.r = hex.r;
  hex.units = hex.units || [];
  if(!hex.units.includes(u.id)) hex.units.push(u.id);
  u.order = null;
  u.waypoints = null;
}

/** 目标格是否是可登陆的敌方海岸（陆地 + 与海相邻）
    注意：hex.adj 是「可通行邻接」，构建时刻意剔除了海洋，所以这里不能
    直接查 adj —— 必须用原始六向邻域去 world.at 里找海面格。 */
export function isLandableCoast(world, hex, natId){
  if(!hex || hex.terrain === 'sea') return false;
  if(hex.owner === natId) return false;
  for(const [nq, nr] of oddrNeighbors(hex.q, hex.r)){
    const nb = world.at[nq + ',' + nr];
    if(nb && nb.terrain === 'sea') return true;
  }
  return false;
}

/** 列出某国可以登陆的敌方海岸格（面板的下拉框用） */
export function listLandingSites(world, natId){
  return world.hexes.filter((h) => isLandableCoast(world, h, natId));
}

/**
 * 1. 立项：校验门槛 → 占用师团 → 写入 world.navalInvasions
 * 返回 { ok, reason?, id?, prepDays? }
 */
export function planNavalInvasion(world, natId, seaZoneId, divCount, targetHexIdx){
  const nat = world.nations[natId];
  const maxCap = nat.invasionCap || (nat.modifiers && nat.modifiers.invasionCap) || 10;
  const count = Math.max(1, Math.min(maxCap, divCount | 0));

  const target = world.hexes[targetHexIdx];
  if(!isLandableCoast(world, target, natId)){
    return { ok: false, reason: '目标必须是敌方沿海陆地格' };
  }
  if(!nat.atWarWith.includes(target.owner)){
    return { ok: false, reason: `尚未与 ${target.owner} 交战，无法实施登陆` };
  }

  const zone = seaZoneId || (target.seaZoneId || null);
  const check = validateNavalInvasion(world, natId, zone ? [zone] : []);
  if(!check.ok) return { ok: false, reason: check.reason };

  // 参与登陆的师：离目标最近的、未在交战中的己方师
  const pool = world.units
    .filter((u) => u.nat === natId && u.hp > 0 && !(u.order && u.order.type === 'attack'))
    .sort((a, b) => hexDist(a.q, a.r, target.q, target.r) - hexDist(b.q, b.r, target.q, target.r));
  if(pool.length < count){
    return { ok: false, reason: `可用于登陆的师不足（需 ${count} 个，现有 ${pool.length} 个）` };
  }

  world.navalInvasions = world.navalInvasions || [];
  const prepDays = calcNavalInvasionPrep(count, !!(nat.modifiers && nat.modifiers.invasionPrep));
  const invasion = {
    id: 'inv_' + world.day + '_' + world.navalInvasions.length,
    nat: natId,
    seaZoneId: zone,
    targetHexIdx,
    targetQ: target.q,
    targetR: target.r,
    divisionIds: pool.slice(0, count).map((u) => u.id),
    prepDays,
    progress: 0,
    ready: false,
    executing: false,
    landed: false,
    startedDay: world.day
  };
  world.navalInvasions.push(invasion);
  return { ok: true, id: invasion.id, prepDays, count };
}

/**
 * 2. 每日推进准备进度
 */
export function invasionTick(world){
  const list = world.navalInvasions;
  if(!list || !list.length) return;
  for(const inv of list){
    if(inv.ready || inv.landed) continue;
    // 目标格易主（已被自己拿下）→ 本次登陆作废
    const t = world.hexes[inv.targetHexIdx];
    if(!t || t.owner === inv.nat){ inv.ready = false; inv.cancelled = true; continue; }
    // 参登陆的师被打光 → 作废
    const alive = inv.divisionIds.filter((id) => world.units.some((u) => u.id === id && u.hp > 0));
    if(alive.length < inv.divisionIds.length){
      inv.divisionIds = alive;
      if(!alive.length){ inv.cancelled = true; continue; }
    }
    inv.progress++;
    if(inv.progress >= inv.prepDays){
      inv.ready = true;
      if(world.events){
        world.events.push({
          type: 'naval_invasion_ready',
          day: world.day,
          text: `⚓【登陆准备完毕】${world.nations[inv.nat].name}对 (${inv.targetQ},${inv.targetR}) 的两栖突击已就绪，${inv.divisionIds.length} 个师待命上船。`,
          important: inv.nat === world.player
        });
      }
    }
  }
  world.navalInvasions = list.filter((inv) => !inv.cancelled);
}

/**
 * 3. 发起登陆：把师团送上海滩，滩头组织度打折
 */
export function executeNavalInvasion(world, invasionId){
  const inv = (world.navalInvasions || []).find((x) => x.id === invasionId);
  if(!inv) return { ok: false, reason: '找不到该登陆计划' };
  if(!inv.ready) return { ok: false, reason: `准备尚未完成（${inv.progress}/${inv.prepDays} 天）` };
  const target = world.hexes[inv.targetHexIdx];
  if(!target) return { ok: false, reason: '目标格已不存在' };

  let landed = 0;
  for(const uid of inv.divisionIds){
    const u = world.units.find((x) => x.id === uid && x.hp > 0);
    if(!u) continue;
    relocate(world, u, target);
    // 滩头惩罚：上岸即损失 60% 组织度（不改编制与兵力）
    const maxOrg = (u.orgMax || u.org || 0);
    u.org = Math.max(1, Math.floor((maxOrg || u.org) * BEACHHEAD_ORG_KEEP));
    landed++;
  }
  inv.landed = true;
  inv.executing = true;
  inv.divisionIds = [];
  if(world.events){
    world.events.push({
      type: 'naval_invasion_launched',
      day: world.day,
      text: `🌊【抢滩登陆】${world.nations[inv.nat].name} ${landed} 个师在 (${target.q},${target.r}) 强行上岸！`,
      important: true
    });
  }
  world.navalInvasions = (world.navalInvasions || []).filter((x) => x.id !== invasionId);
  return { ok: true, landed, target };
}

/** 撤销一份登陆计划 */
export function cancelNavalInvasion(world, invasionId){
  const before = (world.navalInvasions || []).length;
  world.navalInvasions = (world.navalInvasions || []).filter((x) => x.id !== invasionId);
  return world.navalInvasions.length < before;
}

/**
 * W2-1: 将海军入侵接入军级作战计划系统
 */
export function createNavalInvasionPlan(world, natId, seaZoneId, divCount, targetHexIdx, armyId = null){
  const res = planNavalInvasion(world, natId, seaZoneId, divCount, targetHexIdx);
  if(res.ok && armyId && world.armies){
    const army = world.armies.find(a => a.id === armyId);
    if(army){
      army.navalInvasionId = res.id;
      army.orderType = 'naval_invasion';
    }
  }
  return res;
}
