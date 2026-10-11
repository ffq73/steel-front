/* ============================================================
   engine/economy.js —— 资源 / 建造 / 生产（v2.0 §2.3 第 1-3 步 / A3 细化）
   ============================================================ */

import { K } from '../data/constants.js';
import { getLineResourceEff, tradeCivCost } from './resources.js';
import { canAffordRecruit, payRecruitManpower, initManpower } from './manpower.js';   // v14.0 P2
import { OCCUPATION_LAWS } from './resistance.js';
import { ECONOMIC_LAWS } from './laws.js';   // W4-5：消费品份额全五档真源

export function economyTick(world){
  for(const id in world.nations){
    const n = world.nations[id];
    if(!n.alive) continue;

    // 容错与向后兼容初始化
    if(!n.equipment){
      n.equipment = {
        inf_eq: Math.floor((n.equip || 400) * 1.5),
        art_eq: Math.floor((n.equip || 400) * 0.2),
        tank_eq: Math.floor((n.equip || 400) * 0.1),
        truck_eq: Math.floor((n.equip || 400) * 0.15),
        sup_eq: Math.floor((n.equip || 400) * 0.1)
      };
    }
    if(!n.productionLines || !n.productionLines.length){
      n.productionLines = [
        { id:'inf_eq', type:'inf_eq', factories: Math.max(1, Math.floor(n.mil * 0.45)), eff: K.EFF_START, cap: K.EFF_CAP },
        { id:'art_eq', type:'art_eq', factories: Math.max(0, Math.floor(n.mil * 0.2)), eff: K.EFF_START, cap: K.EFF_CAP },
        { id:'tank_eq', type:'tank_eq', factories: Math.max(0, Math.floor(n.mil * 0.2)), eff: K.EFF_START, cap: K.EFF_CAP },
        { id:'truck_eq', type:'truck_eq', factories: Math.max(0, Math.floor(n.mil * 0.1)), eff: K.EFF_START, cap: K.EFF_CAP },
        { id:'sup_eq', type:'sup_eq', factories: Math.max(0, n.mil - Math.floor(n.mil*0.45) - Math.floor(n.mil*0.2) - Math.floor(n.mil*0.2) - Math.floor(n.mil*0.1)), eff: K.EFF_START, cap: K.EFF_CAP }
      ];
    }

    // 1) 生产线效率与每日装备产出
    const effCap = K.EFF_CAP + (n.modifiers.effCap || 0);
    let totalEquipPtsGain = 0;

    for(const line of n.productionLines){
      line.cap = effCap;
      // 效率日增公式：日增 = 0.001 × cap² / current
      line.eff = Math.min(line.cap, line.eff + (K.EFF_GROWTH * line.cap * line.cap) / Math.max(0.01, line.eff));
      const costPerUnit = K.EQUIP_COSTS[line.type] || 1.0;
      const isAI = id !== world.player;
      const diffPreset = K.DIFFICULTIES[world.difficulty || 'general'] || K.DIFFICULTIES.general;
      const aiMult = isAI ? (diffPreset.prodMul || 1.0) : 1.0;
      // v7.0 E4：战略资源赤字折损（附录 B.4），产线效率上限随缺失资源下调
      const resEff = (typeof getLineResourceEff === 'function') ? getLineResourceEff(n, line.type, line.factories) : 1.0;
      const pts = line.factories * K.MIL_OUTPUT * line.eff * (1 + (n.modifiers.milOutput || 0)) * aiMult * resEff;
      const pieces = pts / costPerUnit;
      n.equipment[line.type] = (n.equipment[line.type] || 0) + pieces;
      totalEquipPtsGain += pts;
    }
    // 保持通用装备点与生产线同步（向后兼容）
    n.equip += totalEquipPtsGain;

    // 政治点（基础 +2/天，受稳定度与修正影响 [H]）
    const stab = (n.stability != null ? n.stability : 50) / 100;
    const stabMod = stab >= 0.5
      ? ((stab - 0.5) / 0.5) * (K.PP_STABILITY_BONUS || 0.2)
      : ((0.5 - stab) / 0.5) * (K.PP_STABILITY_PENALTY || -0.5);
    n.pp = Math.min(K.PP_MAX, n.pp + K.PP_PER_DAY * (1 + stabMod) * (1 + (n.modifiers.pp || 0)));

    // 指挥点数与陆军经验 [B]
    // W4-3：低战意惩罚（HOI4 精神：战争不得人心时指挥体系瘫痪）
    //   WS 0% → CP 日增 −95%；WS 100% → 满速。动员 −50% 见 manpower.js wsFactor。
    const wsRatio = (n.warSupport != null ? n.warSupport : 50) / 100;
    const cpGain = 0.5 * Math.max(0.05, wsRatio * wsRatio);
    n.commandPower = Math.min(200, (n.commandPower != null ? n.commandPower : 100) + cpGain);
    const divCount = (world.units || []).filter(u => u.nat === id).length;
    if(n.atWarWith && n.atWarWith.length){
      n.armyXp = (n.armyXp || 0) + 0.4 * divCount;
      // W4-2：战意 → 稳定度反向（向下漂移，只罚不奖）
      //   战意 100% → 稳定目标 100（无惩罚）；战意 0% → 稳定目标 70（−30）。
      //   每日最多漂移 0.1 点，只向下 —— 高战意不会在战时凭空抬升稳定度。
      const stabNow = n.stability != null ? n.stability : 50;
      const stabTarget = 100 - K.WS_STABILITY_PENALTY * (1 - wsRatio);
      if(stabNow > stabTarget){
        n.stability = Math.max(0, stabNow - Math.min(0.1, stabNow - stabTarget));
      }
    }

    // 2) 建造（民工厂产出，消费品占用按法案 + 资源贸易租借占用）
    //    v14.1 B5：n.buildQueue[] 排队、n.build 为当前施工项；队列空时自动取下一项。
    //    注：州（state）层属 W7-1，现阶段按 hex 建造并以此口径验收（sim B16）。
    if(!n.buildQueue) n.buildQueue = [];
    // W4-5：消费品份额读 ECONOMIC_LAWS 全五档（含 export_focus）。
    // 旧写法 K.CONSUMER_GOODS[n.law] ?? 0.20 —— 剧本 law 值跨剧本不统一
    //（§12-5：'early_mob'/'wartime' 不在四档内）时静默按 0.20 结算。
    const eLawEntry = ECONOMIC_LAWS[n.economicLaw || n.law];
    const cg = eLawEntry ? eLawEntry.consumerGoods : (K.CONSUMER_GOODS[n.law] ?? 0.20);
    const tradeOccup = (typeof tradeCivCost === 'function') ? Math.min(0.6, tradeCivCost(n)) : 0;

    // W7/§12：占领法案 factoryYield 接入 —— 占领区工厂受占领法与顺从度调制贡献给占领国
    let occupiedCiv = 0;
    if(world.hexes){
      const oLaw = OCCUPATION_LAWS[n.occupationLaw] || OCCUPATION_LAWS.military_governor;
      for(const h of world.hexes){
        if(h.owner === id && h.core && h.core !== id && (h.civ || 0) > 0){
          const comp = h.compliance || 0;
          const compMul = comp >= 60 ? 1.0 : comp >= 20 ? 0.75 : 0.5;
          occupiedCiv += (h.civ || 0) * (oLaw.factoryYield || 0.55) * compMul;
        }
      }
    }
    const effectiveCiv = n.civ + occupiedCiv;
    const buildPts = Math.max(0, effectiveCiv * K.CIV_OUTPUT * (1 - cg - tradeOccup)) * (1 + (n.modifiers.buildSpeed || 0));
    if(!n.build.kind && n.buildQueue.length){
      n.build = n.buildQueue.shift();
    }
    if(n.build.kind){
      const b = n.build;
      b.prog += buildPts;
      b.days = (b.days || 0) + 1;
      if(b.prog >= b.need){
        const h = world.hexes.find(x => x.q===b.q && x.r===b.r);
        const done = finishConstruction(world, n, b, h);
        if(done){
          world.events.push({ type:'built', day:world.day, kind:b.kind, text:`${n.name}：${BUILD_LABELS[b.kind] || b.kind}建成` });
        }
        n.build = { q:-1, r:-1, prog:0, need:0, kind:null };
      }
    }

    // 3) 生产（训练中的师：装备点按均摊支付 + 训练天数）
    if(n.training.length){
      const share = Math.floor(n.equip / n.training.length);
      for(const t of n.training){
        const cost = trainingCost(t.type);
        const pay = Math.min(share, cost - t.costPaid, n.equip);
        t.costPaid += pay; n.equip -= pay;
        t.days++;

        // 细分装备扣除
        const req = K.DIVISION_EQUIPMENT[t.type] || {};
        for(const eq in req){
          const needed = req[eq];
          const deduct = Math.min(n.equipment[eq] || 0, needed / trainingDays(t.type));
          n.equipment[eq] = Math.max(0, (n.equipment[eq] || 0) - deduct);
        }
      }
      for(let i=n.training.length-1;i>=0;i--){
        const t = n.training[i];
        if(t.costPaid >= trainingCost(t.type) && t.days >= trainingDays(t.type)){
          // v14.0 P2：人力池校验 —— 池不足则训练卡住（HOI4：人力耗尽无法扩充军力）
          if(n.manpowerCap == null) initManpower(world, id);
          if(!canAffordRecruit(n, t.type)){
            t.blocked = 'manpower';
            continue;
          }
          payRecruitManpower(n, t.type);
          t.blocked = null;
          n.training.splice(i,1);
          n.pool.push(t.type);
          world.events.push({
            type:'trained', day:world.day,
            text:`${n.name}的${t.type === 'inf' ? '步兵师' : t.type === 'cav' ? '骑兵师' : t.type === 'arm' ? '装甲师' : t.type === 'mot' ? '摩托化师' : '部队'}训练完成`
          });
        }
      }
    }
  }
}

/* v14.1 B5：五类建筑的完工结算。返回 false 表示目标格已丢失（易主/不存在），
   此时工时作废不发事件。air_base 同步 world.airBases（initAir 的容量模型）；
   naval_base 仅落等级，其交战读点等 W6 海战模型（与 NAVY 惰性开关同一处理）。 */
const BUILD_LABELS = { mil:'军工厂', civ:'民工厂', infra:'基础设施', air_base:'空军基地', naval_base:'海军基地', fort:'要塞' };

function finishConstruction(world, n, b, h){
  if(!h) return false;
  switch(b.kind){
    case 'mil': {
      h.mil = (h.mil || 0) + 1; n.mil = (n.mil || 0) + 1;
      // 新军工厂自动归入第一条生产线（步兵装备）
      if(n.productionLines && n.productionLines[0]){
        n.productionLines[0].factories = Math.min(K.LINE_FACTORY_CAP, n.productionLines[0].factories + 1);
      }
      break;
    }
    case 'civ':
      h.civ = (h.civ || 0) + 1; n.civ = (n.civ || 0) + 1;
      break;
    case 'infra':
      h.infra = Math.min(10, (h.infra || 0) + 1);
      break;
    case 'air_base': {
      const lv = Math.min(K.AIR ? K.AIR.MAX_AIRBASE_LEVEL : 10, (h.buildings?.air_base || 0) + 1);
      h.buildings = h.buildings || {};
      h.buildings.air_base = lv;
      const ab = (world.airBases || []).find(x => x.q === h.q && x.r === h.r);
      if(ab){
        ab.level = lv;
        ab.capacity = lv * (K.AIR ? K.AIR.BASE_CAPACITY_PER_LEVEL : 200);
      } else {
        world.airBases = world.airBases || [];
        world.airBases.push({
          id: `ab_${h.q}_${h.r}`, name: `前线机场 (${h.q},${h.r})`,
          nat: h.owner, q: h.q, r: h.r, level: lv,
          capacity: lv * (K.AIR ? K.AIR.BASE_CAPACITY_PER_LEVEL : 200), count: 0
        });
      }
      break;
    }
    case 'naval_base':
      h.buildings = h.buildings || {};
      h.buildings.naval_base = (h.buildings.naval_base || 0) + 1;
      break;
    default:
      return false;
  }

  // W7-1：同步更新所属州 (State) 的建筑账本
  if(world && world.stateById && h.stateId && world.stateById[h.stateId]){
    const st = world.stateById[h.stateId];
    if(b.kind === 'mil') st.buildings.mil = (st.buildings.mil || 0) + 1;
    else if(b.kind === 'civ') st.buildings.civ = (st.buildings.civ || 0) + 1;
    else if(b.kind === 'infra') st.buildings.infra = Math.max(st.buildings.infra || 0, h.infra);
    else if(b.kind === 'air_base') st.buildings.air_base = (st.buildings.air_base || 0) + 1;
    else if(b.kind === 'naval_base') st.buildings.naval_base = (st.buildings.naval_base || 0) + 1;
    else if(b.kind === 'fort') st.buildings.fort = (st.buildings.fort || 0) + 1;
  }

  return true;
}

export function setLineFactories(nation, lineId, factories){
  if(!nation || !nation.productionLines) return;
  const line = nation.productionLines.find(l => l.id === lineId);
  if(!line) return;
  const currentTotal = nation.productionLines.reduce((s,l)=>s+l.factories, 0);
  const diff = factories - line.factories;
  if(currentTotal + diff <= nation.mil && factories >= 0 && factories <= K.LINE_FACTORY_CAP){
    line.factories = factories;
  }
}

/**
 * 切换生产线装备类型 (保留 50% 生产效率)
 */
export function switchLineType(line, newType){
  if(!line || line.type === newType) return;
  line.type = newType;
  line.eff = Math.max(K.EFF_START, +(line.eff * 0.5).toFixed(4));
}

/**
 * W3-3：生产线 optimal 一键分配（纯函数式结算，UI 一键调用的引擎真源）。
 * 把空闲军工厂按各线现有占比分配下去，同时尊重单线上限 K.LINE_FACTORY_CAP
 * 与单格厂槽语义（全国总厂不超过 n.mil）。返回 { allocated, lines }。
 * deterministic —— tests/ui_logic.test.js 直接断言守恒与占比不变性。
 */
export function allocateFactoriesOptimal(world, natId){
  const n = world.nations[natId];
  if(!n || !n.productionLines || !n.productionLines.length) return { allocated: 0, lines: [] };
  const used = n.productionLines.reduce((s, l) => s + (l.factories || 0), 0);
  let free = (n.mil || 0) - used;
  if(free <= 0) return { allocated: 0, lines: n.productionLines.map(l => ({ id: l.id, factories: l.factories })) };

  // 按现有占比分配（保持玩家比例偏好），逐个厂落位避免整除误差
  const total = Math.max(1, used);
  const want = n.productionLines.map(l => ({ line: l, share: (l.factories || 0) / total }));
  let allocated = 0;
  let guard = 0;
  while(free > 0 && guard < 1000){
    guard++;
    // 每轮把 1 个厂给「share×(used+allocated) 最缺额」的未满线
    let best = null, bestGap = -1;
    for(const w of want){
      const cur = w.line.factories || 0;
      if(cur >= K.LINE_FACTORY_CAP) continue;
      const gap = w.share * (used + allocated) - cur;
      if(gap > bestGap){ bestGap = gap; best = w; }
    }
    if(!best) break;   // 全部线到顶
    best.line.factories += 1;
    allocated += 1;
    free -= 1;
  }
  return { allocated, lines: n.productionLines.map(l => ({ id: l.id, factories: l.factories })) };
}

function trainingCost(type){
  return type==='inf' ? 400 : type==='cav' ? 350 : type==='mtn' ? 480 :
         type==='mot' ? 700 : type==='larm' ? 900 : 1400;
}
function trainingDays(type){
  return type==='inf' ? 90 : type==='cav' ? 60 : type==='mtn' ? 120 :
         type==='mot' ? 120 : type==='larm' ? 140 : 180;
}
export { trainingCost, trainingDays };

