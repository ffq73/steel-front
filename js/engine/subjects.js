/* ============================================================
   engine/subjects.js —— 国际贸易与附庸傀儡自治体系 (v9.0 §4-N5 / 附录 B.6) [H]
   包含：
   1. 国际贸易网络：1 民用工厂租赁 8 资源/天，贸易法案4档 (150 PP 切换)
   2. 贸易影响力模型 (Trade Influence: 基础150 + 宗主400 + 关系 + 距离衰减)
   3. 附庸国自治度五级梯队 (0-1000 分值，独立/自由领/殖民地/傀儡/整合傀儡)
   4. 傀儡国工业抽成机制 (整合傀儡上缴 25% 民工 + 75% 军工 [H])
   5. 自治指令 (压制/放权消耗 0.5 PP/天) 与 300 PP 吞并兼并
   6. 合作政府傀儡特权 (75% 民工 + 75% 军工)
   ============================================================ */

import { TRADE_LAWS, AUTONOMY_TIERS, NATION_RESOURCE_BASE } from '../data/resources.js';
import { hexDist } from '../core/geom.js';

/* 1. 初始化国家贸易与附庸数据 [H] */
export function initSubjects(world){
  world.tradeRoutes = world.tradeRoutes || [];
  world.routeUid = world.routeUid || 1;

  for(const natId in world.nations){
    const n = world.nations[natId];
    n.tradeLaw = n.tradeLaw || 'export_focus';
    n.tradeRoutes = n.tradeRoutes || [];
    n.convoys = n.convoys != null ? n.convoys : 150;
    n.convoysUsed = n.convoysUsed != null ? n.convoysUsed : 0;
    n.subjects = n.subjects || [];
    n.overlord = n.overlord || null;
    n.autonomy = n.autonomy != null ? n.autonomy : 1000;
    n.autonomyTier = n.autonomyTier || 'independent';
    n.subjectDirective = n.subjectDirective || null;
    n.rentedCivOut = n.rentedCivOut || 0; // 租借给别国的民工
    n.rentedCivIn = n.rentedCivIn || 0;   // 从外国赚取的民工
    n.tributeCiv = n.tributeCiv || 0;     // 傀儡上缴的民工
    n.tributeMil = n.tributeMil || 0;     // 傀儡上缴的军工
  }

  // 历史附庸关系预设（二战剧本大英帝国殖民帝国体系）
  const gbr = world.nations['GBR'] || world.nations['B'] || world.nations['ENG'];
  if(gbr){
    const subjectCandidates = [
      { id: 'CAN', autonomy: 850, tier: 'dominion' },
      { id: 'AST', autonomy: 850, tier: 'dominion' },
      { id: 'RAJ', autonomy: 550, tier: 'colony' },
      { id: 'SAF', autonomy: 850, tier: 'dominion' }
    ];
    for(const sub of subjectCandidates){
      const sNat = world.nations[sub.id];
      if(sNat && !sNat.overlord){
        sNat.overlord = gbr.id;
        sNat.autonomy = sub.autonomy;
        sNat.autonomyTier = sub.tier;
        if(!gbr.subjects.includes(sub.id)) gbr.subjects.push(sub.id);
      }
    }
  }
}

/* 2. 贸易影响力计算公式 [H]
   - 基础值 150
   - 附庸/傀儡关系 +400
   - 同盟/意识形态相合 +50
   - 交战国直接为 0 (不可通商)
   - 距离衰减：-0.02 * 距离 */
export function calcTradeInfluence(world, buyerNatId, sellerNatId){
  if(buyerNatId === sellerNatId) return 0;
  const buyer = world.nations[buyerNatId];
  const seller = world.nations[sellerNatId];
  if(!buyer || !seller || !buyer.alive || !seller.alive) return 0;

  // 交战中严禁通商
  if(buyer.atWarWith && buyer.atWarWith.includes(sellerNatId)) return 0;

  let influence = 150;

  // 宗主与附庸特权
  if(buyer.overlord === sellerNatId || seller.overlord === buyerNatId){
    influence += 400;
  }

  // 相同阵营/意识形态亲善
  if(buyer.faction && seller.faction && buyer.faction === seller.faction){
    influence += 50;
  }

  // W5-8：双边关系修正（world.relations −100~100 → 影响力 ±25）
  const rel = (world.relations || {})[[buyerNatId, sellerNatId].sort().join('|')] || 0;
  influence += Math.max(-25, Math.min(25, Math.round(rel / 4)));

  // 距离衰减（v14.1 B8：锚点改为两国首都间 hexDist）。
  // 旧实现「h.city?.cap === X || h.owner === X」的第二条件几乎总先命中任意格，
  // 所谓距离其实是「两国任意首格」的距离；首都解析不到时不做距离衰减。
  const capOf = (natId) => {
    const nat = world.nations[natId];
    if(nat && nat.capitalHexIdx != null && world.hexes[nat.capitalHexIdx]) return world.hexes[nat.capitalHexIdx];
    return world.hexes.find(h => h.city && h.city.cap === natId) || null;
  };
  const buyerHex = capOf(buyerNatId);
  const sellerHex = capOf(sellerNatId);
  if(buyerHex && sellerHex){
    const dist = hexDist(buyerHex.q, buyerHex.r, sellerHex.q, sellerHex.r);
    influence -= Math.round(dist * 2.5);
  }

  return Math.max(0, influence);
}

/* 3. 查询国家可出口资源池 [H] */
export function getExportableResources(world, natId){
  const n = world.nations[natId];
  if(!n) return {};
  const law = TRADE_LAWS[n.tradeLaw] || TRADE_LAWS.export_focus;
  const base = NATION_RESOURCE_BASE[natId] || {};
  const exportable = {};

  for(const r in base){
    const totalProd = (base[r] || 0);
    // 依贸易法案划分投入国际市场的份额
    const marketPool = Math.floor(totalProd * law.marketRatio);
    // 扣除已有出口合同占用的份额
    const exportedAlready = (world.tradeRoutes || [])
      .filter(rt => rt.seller === natId && rt.resource === r)
      .reduce((sum, rt) => sum + rt.amount, 0);
    exportable[r] = Math.max(0, marketPool - exportedAlready);
  }
  return exportable;
}

/* 4. 创建贸易航线 (1 民工 ⇄ 8 资源/天) [H] */
export function createTradeRoute(world, buyerNatId, sellerNatId, resource, civCount = 1){
  if(civCount <= 0) return { ok: false, reason: '采购民用工厂数必须大于0' };
  const buyer = world.nations[buyerNatId];
  const seller = world.nations[sellerNatId];
  if(!buyer || !seller) return { ok: false, reason: '国家不存在' };

  // 1. 影响力校验
  const influence = calcTradeInfluence(world, buyerNatId, sellerNatId);
  if(influence <= 0){
    return { ok: false, reason: '双边贸易影响力不足或处于交战封锁状态 [H]' };
  }

  // 2. 买方可用民工校验
  const freeCiv = Math.max(0, (buyer.civ || 0) - (buyer.rentedCivOut || 0));
  if(freeCiv < civCount){
    return { ok: false, reason: `可用民用工厂不足：当前空闲 ${freeCiv} 厂，需要 ${civCount} 厂 [H]` };
  }

  // 3. 卖方出口资源充足性校验 (1 民工 = 8 资源) [H]
  const amount = civCount * 8;
  const exportable = getExportableResources(world, sellerNatId);
  if((exportable[resource] || 0) < amount){
    return { ok: false, reason: `卖方市场出口额度不足：当前仅可提供 ${exportable[resource] || 0} 单位，需要 ${amount} 单位 [H]` };
  }

  // 4. 运输船占用（每 8 单位资源占用 1 艘运输船）
  const neededConvoys = civCount;
  const freeConvoys = Math.max(0, (buyer.convoys || 150) - (buyer.convoysUsed || 0));
  if(freeConvoys < neededConvoys){
    return { ok: false, reason: `护航运输船不足：需要 ${neededConvoys} 艘，空闲仅 ${freeConvoys} 艘` };
  }

  // 成功开辟贸易线
  const route = {
    id: world.routeUid++,
    buyer: buyerNatId,
    seller: sellerNatId,
    resource,
    civCount,
    amount,
    convoys: neededConvoys,
    day: world.day
  };

  world.tradeRoutes.push(route);
  buyer.rentedCivOut = (buyer.rentedCivOut || 0) + civCount;
  seller.rentedCivIn = (seller.rentedCivIn || 0) + civCount;
  buyer.convoysUsed = (buyer.convoysUsed || 0) + neededConvoys;

  // 接入买方 resources.js 进口通道
  buyer.resourceTrades = buyer.resourceTrades || [];
  buyer.resourceTrades.push({ id: route.id, resource, amount });

  return { ok: true, route };
}

/* 5. 撤销/终止贸易路线 [H] */
export function cancelTradeRoute(world, routeId){
  const idx = (world.tradeRoutes || []).findIndex(rt => rt.id === routeId);
  if(idx === -1) return { ok: false, reason: '贸易航线不存在' };
  const rt = world.tradeRoutes[idx];

  const buyer = world.nations[rt.buyer];
  const seller = world.nations[rt.seller];
  if(buyer){
    buyer.rentedCivOut = Math.max(0, (buyer.rentedCivOut || 0) - rt.civCount);
    buyer.convoysUsed = Math.max(0, (buyer.convoysUsed || 0) - rt.convoys);
    if(buyer.resourceTrades){
      buyer.resourceTrades = buyer.resourceTrades.filter(t => t.id !== routeId);
    }
  }
  if(seller){
    seller.rentedCivIn = Math.max(0, (seller.rentedCivIn || 0) - rt.civCount);
  }

  world.tradeRoutes.splice(idx, 1);
  return { ok: true };
}

/* 6. 切换贸易法案 (消耗 150 PP) [H] */
export function changeTradeLaw(world, natId, lawKey){
  const n = world.nations[natId];
  if(!n) return { ok: false, reason: '国家不存在' };
  const targetLaw = TRADE_LAWS[lawKey];
  if(!targetLaw) return { ok: false, reason: '法案不存在' };
  if(n.tradeLaw === lawKey) return { ok: false, reason: '当前已施行该贸易法案' };

  const cost = targetLaw.costPP || 150;
  if((n.pp || 0) < cost){
    return { ok: false, reason: `政治点数 (PP) 不足：需要 ${cost} 点，当前仅 ${Math.floor(n.pp || 0)} 点 [H]` };
  }

  n.pp -= cost;
  n.tradeLaw = lawKey;

  // 挂载法案属性修正
  n.modifiers = n.modifiers || {};
  if(targetLaw.effects.prodSpeed) n.modifiers.prodSpeed = targetLaw.effects.prodSpeed;
  if(targetLaw.effects.researchSpeed) n.modifiers.researchSpeed = targetLaw.effects.researchSpeed;
  if(targetLaw.effects.intelDefense) n.modifiers.intelDefense = targetLaw.effects.intelDefense;

  return { ok: true, law: targetLaw };
}

/* 7. 查询自治度阶梯对象 [H] */
export function getAutonomyTier(autonomyScore = 1000){
  if(autonomyScore >= 1000) return AUTONOMY_TIERS.independent;
  if(autonomyScore >= 800) return AUTONOMY_TIERS.dominion;
  if(autonomyScore >= 500) return AUTONOMY_TIERS.colony;
  if(autonomyScore >= 200) return AUTONOMY_TIERS.puppet;
  return AUTONOMY_TIERS.integrated_puppet;
}

/* 8. 调整附庸自治等级 (升/降级消耗 50 PP) [H] */
export function changeAutonomyLevel(world, overlordNatId, subjectNatId, direction = 'demote'){
  const o = world.nations[overlordNatId];
  const s = world.nations[subjectNatId];
  if(!o || !s || s.overlord !== overlordNatId){
    return { ok: false, reason: '非直属附庸国' };
  }

  const cost = 50;
  if((o.pp || 0) < cost){
    return { ok: false, reason: `宗主国政治点数不足：需要 ${cost} PP [H]` };
  }

  o.pp -= cost;
  if(direction === 'demote'){
    // 压低自治度 200 点
    s.autonomy = Math.max(0, (s.autonomy || 1000) - 200);
  } else {
    // 提升自治度 200 点
    s.autonomy = Math.min(1000, (s.autonomy || 0) + 200);
  }
  s.autonomyTier = getAutonomyTier(s.autonomy).id;

  return { ok: true, newAutonomy: s.autonomy, tier: s.autonomyTier };
}

/* 9. 吞并兼并整合傀儡 (消耗 300 PP) [H] */
export function annexSubject(world, overlordNatId, subjectNatId){
  const o = world.nations[overlordNatId];
  const s = world.nations[subjectNatId];
  if(!o || !s || s.overlord !== overlordNatId){
    return { ok: false, reason: '非直属附庸国' };
  }

  if(s.autonomy > 100){
    return { ok: false, reason: `自治度必须低于 100 点（当前 ${Math.floor(s.autonomy)} 点），方可启动和平吞并 [H]` };
  }

  const cost = 300;
  if((o.pp || 0) < cost){
    return { ok: false, reason: `吞并需要 ${cost} 点政治点数 (PP) [H]` };
  }

  o.pp -= cost;
  // 领土全盘转移至宗主
  for(const h of world.hexes){
    if(h.owner === subjectNatId){
      h.owner = overlordNatId;
    }
  }

  // 部队收编入宗主序列
  for(const u of world.units){
    if(u.nat === subjectNatId){
      u.nat = overlordNatId;
    }
  }

  s.alive = false;
  s.overlord = null;
  o.subjects = (o.subjects || []).filter(id => id !== subjectNatId);

  return { ok: true };
}

/* 10. 每日贸易与附庸结算管线 [H]
   - 压制附庸 (-0.5 PP/天, 自治度 -0.5/天)
   - 整合傀儡工厂抽成 (25% 民工 + 75% 军工上缴宗主 [H]) */
export function subjectsTick(world){
  if(!world.nations) return;

  for(const natId in world.nations){
    const n = world.nations[natId];
    if(!n.alive) continue;

    // 清空旧抽成
    n.tributeCiv = 0;
    n.tributeMil = 0;

    // 附庸自治度自然演进与宗主指令
    if(n.overlord){
      const overlord = world.nations[n.overlord];
      if(overlord && overlord.alive){
        // 指令结算
        if(n.subjectDirective === 'suppress' && (overlord.pp || 0) >= 0.5){
          overlord.pp -= 0.5;
          n.autonomy = Math.max(0, (n.autonomy || 500) - 0.5);
        } else if(n.subjectDirective === 'increase' && (overlord.pp || 0) >= 0.5){
          overlord.pp -= 0.5;
          n.autonomy = Math.min(1000, (n.autonomy || 500) + 0.5);
        }
        n.autonomyTier = getAutonomyTier(n.autonomy).id;

        // 依阶梯执行工厂产能抽成 [H]
        const tier = getAutonomyTier(n.autonomy);
        const surrenderCiv = Math.floor((n.civ || 0) * tier.civSurrender);
        const surrenderMil = Math.floor((n.mil || 0) * tier.milSurrender);

        overlord.tributeCiv = (overlord.tributeCiv || 0) + surrenderCiv;
        overlord.tributeMil = (overlord.tributeMil || 0) + surrenderMil;
      }
    }
  
  /* W0-B2：把附庸上缴的工厂真正并入宗主经济。
     断链事实：此前只累加到 overlord.tributeCiv / tributeMil，
     且只有 panelTrade.js 会去读它（纯显示）——
     于是「整合傀儡上缴 75% 军工厂 / 25% 民工厂」这条 HOI4 式收益从未进账。 */
  for(const ovId in world.nations){
    const ov = world.nations[ovId];
    if(!ov || !ov.tributeCiv && !ov.tributeMil) continue;
    const dc = Math.floor(ov.tributeCiv || 0);
    const dm = Math.floor(ov.tributeMil || 0);
    if(dc) ov.civ = (ov.civ || 0) + dc;
    if(dm) ov.mil = (ov.mil || 0) + dm;
    ov.tributeCiv = (ov.tributeCiv || 0) - dc;
    ov.tributeMil = (ov.tributeMil || 0) - dm;
  }
}
}
