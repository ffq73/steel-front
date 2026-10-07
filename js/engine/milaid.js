/* ============================================================
   engine/milaid.js —— 军援输送链、红线升级计量与战争疲劳和谈窗口 (v5.0 §2.6 / E4)
   支持多层级重武器包裹准入、核威慑红线升级表与70%疲劳停火谈判
   ============================================================ */

export const AID_PACKAGES = {
  himars_package: {
    id: 'himars_package',
    name: '海马斯精确火箭炮与卫星制导火箭弹包裹',
    equipBonus: 400,
    atkBonus: 0.15,
    escalationAdd: 12,
    desc: '突破射程限制，打击敌军纵深弹药补给库。'
  },
  patriot_battery: {
    id: 'patriot_battery',
    name: '“爱国者” PAC-3 防空导弹全套营级系统',
    equipBonus: 300,
    defBonus: 0.25,
    escalationAdd: 10,
    desc: '强化首都防空圈，拦截弹道导弹与巡航导弹。'
  },
  western_tanks: {
    id: 'western_tanks',
    name: '豹2A6与艾布拉姆斯北约主战坦克营',
    equipBonus: 500,
    atkBonus: 0.20,
    escalationAdd: 18,
    desc: '组建装甲反突击重拳，突破苏罗维金防线。'
  },
  atacms_long_range: {
    id: 'atacms_long_range',
    name: 'ATACMS 300公里超远程地对地战术导弹',
    equipBonus: 200,
    atkBonus: 0.25,
    escalationAdd: 25,
    desc: '跨越国境打击深层机场与指挥中枢，触碰敌方战略红线。'
  },
  f16_fighters: {
    id: 'f16_fighters',
    name: 'F-16“战隼”多用途第四代战斗机机群',
    equipBonus: 450,
    atkBonus: 0.25,
    defBonus: 0.15,
    escalationAdd: 28,
    desc: '争夺战区前线局部制空权，投掷滑翔制导炸弹。'
  }
};

export function initMilAid(world){
  world.milAid = world.milAid || {
    escalationGauge: 20, // 0 - 100% 危机升级指数
    packagesDelivered: [],
    ceasefireReady: false
  };
}

export function sendAidPackage(world, donorNatId, recipientNatId, packageId){
  initMilAid(world);
  const pkg = AID_PACKAGES[packageId];
  const donor = world.nations[donorNatId];
  const recipient = world.nations[recipientNatId];
  if(!pkg || !donor || !recipient) return false;

  world.milAid.packagesDelivered.push({
    donor: donorNatId,
    recipient: recipientNatId,
    packageId,
    day: world.day
  });

  // 发放装备与战斗力加成
  recipient.equip = (recipient.equip || 0) + pkg.equipBonus;
  recipient.modifiers = recipient.modifiers || {};
  if(pkg.atkBonus) recipient.modifiers.attack = (recipient.modifiers.attack || 0) + pkg.atkBonus;
  if(pkg.defBonus) recipient.modifiers.defense = (recipient.modifiers.defense || 0) + pkg.defBonus;

  // 推动大国战略红线危机攀升
  world.milAid.escalationGauge = Math.min(100, world.milAid.escalationGauge + pkg.escalationAdd);

  world.events = world.events || [];
  world.events.push({
    type: 'mil_aid_delivered',
    day: world.day,
    important: true,
    text: `📦 军援专列抵前：【${donor.name}】向【${recipient.name}】交付【${pkg.name}】！战区危机升级度上升至 ${world.milAid.escalationGauge}%！`
  });

  // 达到或突破 80% 触发最高核警报演练
  if(world.milAid.escalationGauge >= 80 && !world.milAid.nuclearAlertTriggered){
    world.milAid.nuclearAlertTriggered = true;
    world.events.push({
      type: 'red_line_crisis',
      day: world.day,
      important: true,
      text: `☢️【触碰大国战略红线】军援重武器深度打击引发严重危机，战略核力量展开非战略核武器战备突击演习！`
    });
  }

  return true;
}

export function updateWarFatigue(world, natId, delta){
  const nat = world.nations[natId];
  if(!nat) return 0;
  nat.warFatigue = Math.min(100, Math.max(0, (nat.warFatigue || 0) + delta));

  // 检查停火谈判窗口：当主要当事国疲劳均 >= 70 时开启谈判窗口
  checkCeasefireWindow(world);
  return nat.warFatigue;
}

export function checkCeasefireWindow(world){
  initMilAid(world);
  if(world.milAid.ceasefireReady) return;

  const rus = world.nations.RUS;
  const ukr = world.nations.UKR;
  if(rus && ukr && (rus.warFatigue || 0) >= 70 && (ukr.warFatigue || 0) >= 70){
    world.milAid.ceasefireReady = true;
    world.events = world.events || [];
    world.events.push({
      type: 'ceasefire_window_open',
      day: world.day,
      important: true,
      text: `🕊️【战略停火谈判窗口开启】双方在旷日持久的高烈度消耗战中均已精疲力竭（疲劳度均达到 70%），国际调停代表团在伊斯坦布尔与日内瓦紧急斡旋停火草案！`
    });
  }
}
