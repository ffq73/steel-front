/* ============================================================
   engine/sanctions.js —— 现代金融与科技多维制裁网络系统 (v5.0 §2.6 / E4)
   实现 SWIFT 切断、高科技半导体断供、主权资产冻结与二级制裁连带
   ============================================================ */

export const SANCTION_PACKAGES = {
  swift_ban: {
    id: 'swift_ban',
    name: 'SWIFT 国际结算通道切断',
    tradePenalty: 0.25,
    milPenalty: 0.15,
    stabilityHit: 10,
    desc: '阻断大宗跨境资金清算，被迫使用本币或易货贸易，交易成本急剧飙升。'
  },
  tech_embargo: {
    id: 'tech_embargo',
    name: '先进制程半导体与数控机床禁运',
    techSpeedPenalty: 0.20,
    milPenalty: 0.10,
    desc: '封锁精确制导芯片、热成像传感器与特种滚珠轴承，重武器产能扩张受阻。'
  },
  asset_freeze: {
    id: 'asset_freeze',
    name: '冻结海外央行主权储备与寡头资产',
    reserveLoss: 0.40,
    stabilityHit: 5,
    desc: '扣押数千亿美元离岸外汇与黄金储备，削弱宏观经济调节流动性。'
  },
  secondary_sanctions: {
    id: 'secondary_sanctions',
    name: '二级制裁长臂管辖警告',
    neutralTradePenalty: 0.15,
    desc: '警告第三方中立国企业不得协助规避制裁，否则同样切断美元结算。'
  }
};

export function initSanctions(world){
  world.sanctionsNetwork = world.sanctionsNetwork || {
    activeSanctions: [] // [ { from, to, packageId, day } ]
  };
}

export function imposeSanction(world, fromNat, toNat, packageId){
  initSanctions(world);
  const pkg = SANCTION_PACKAGES[packageId];
  const target = world.nations[toNat];
  const initiator = world.nations[fromNat];
  if(!pkg || !target || !initiator) return false;

  const exists = world.sanctionsNetwork.activeSanctions.some(s => s.from === fromNat && s.to === toNat && s.packageId === packageId);
  if(exists) return false;

  world.sanctionsNetwork.activeSanctions.push({
    from: fromNat,
    to: toNat,
    packageId,
    day: world.day
  });

  // 施加制裁打击效果
  target.modifiers = target.modifiers || {};
  if(pkg.milPenalty) target.modifiers.milOutput = (target.modifiers.milOutput || 0) - pkg.milPenalty;
  if(pkg.techSpeedPenalty) target.modifiers.techSpeed = (target.modifiers.techSpeed || 0) - pkg.techSpeedPenalty;
  if(pkg.stabilityHit) target.stability = Math.max(10, (target.stability || 70) - pkg.stabilityHit);

  world.events = world.events || [];
  world.events.push({
    type: 'sanction_imposed',
    day: world.day,
    important: true,
    text: `🚫 制裁落地：【${initiator.name}】对【${target.name}】启动【${pkg.name}】！`
  });

  return true;
}

export function getActiveSanctionsOn(world, natId){
  initSanctions(world);
  return world.sanctionsNetwork.activeSanctions.filter(s => s.to === natId);
}
