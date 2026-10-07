/* ============================================================
   engine/space.js —— 太空竞赛与科技声望系统 (v5.0 §2.5 / E3)
   包含 7 大历史里程碑（人造卫星/加加林/阿波罗登月/空间站）、
   大国威望争夺与双用途军工技术外溢加成
   ============================================================ */

export const SPACE_MILESTONES = [
  {
    id: 'sputnik_1',
    name: '首颗人造地球卫星入轨 (Sputnik 1 / Explorer 1)',
    civCost: 50,
    prestige: 50,
    techBonus: 0.05,
    desc: '宣告人类太空时代来临，第一道来自宇宙的无线电蜂鸣声震撼五大洲。'
  },
  {
    id: 'laika_orbit',
    name: '轨道生物生命维持系统验证 (Laika / Ham)',
    civCost: 60,
    prestige: 60,
    techBonus: 0.05,
    desc: '突破生物高过载与失重生存技术，为载人航天奠定生理与医学根基。'
  },
  {
    id: 'gagarin_flight',
    name: '首位人类太空宇航突破 (Gagarin / Glenn)',
    civCost: 90,
    prestige: 100,
    stabilityBonus: 10,
    warSupportBonus: 15,
    techBonus: 0.08,
    desc: '“出发吧！”人类首次用肉眼俯瞰蔚蓝星球，全球战略声望达到炽热巅峰。'
  },
  {
    id: 'first_spacewalk',
    name: '人类首次出舱太空漫步 (Leonov / White)',
    civCost: 110,
    prestige: 110,
    techBonus: 0.08,
    desc: '系留宇航服经受住真空与剧烈温差考验，迈出人类在广袤虚空中的独立一步。'
  },
  {
    id: 'lunar_orbiter',
    name: '环月轨道探测器与软着陆照相 (Luna 9 / Lunar Orbiter)',
    civCost: 130,
    prestige: 130,
    techBonus: 0.10,
    desc: '高精度摄影测绘月球陨石坑与静海着陆区，深空遥测导航技术实现飞跃。'
  },
  {
    id: 'apollo_moon_landing',
    name: '阿波罗载人登月：人类的一大步 (Apollo 11)',
    civCost: 200,
    prestige: 250,
    techBonus: 0.15,
    stabilityBonus: 20,
    desc: '“个人的一小步，人类的一大步”。登月舱稳稳降落静海，确立太空竞赛终极历史霸权。'
  },
  {
    id: 'space_station',
    name: '礼炮号 / 天空实验室 载人轨道空间站建立',
    civCost: 180,
    prestige: 200,
    techBonus: 0.12,
    reconBonus: 0.20,
    desc: '常态化近地轨道实验室开启长期太空驻留，具备全天候战术对地轨道侦察能力。'
  }
];

export function initSpaceRace(world){
  world.spaceRace = world.spaceRace || {
    completed: {}, // { milestoneId: { natId, day } }
    progress: {
      USA: { completedCount: 0, prestige: 0, currentProject: null, daysLeft: 0 },
      SOV: { completedCount: 0, prestige: 0, currentProject: null, daysLeft: 0 }
    }
  };
}

export function launchSpaceMission(world, natId, milestoneId){
  initSpaceRace(world);
  const nat = world.nations[natId];
  if(!nat) return false;

  const milestone = SPACE_MILESTONES.find(m => m.id === milestoneId);
  if(!milestone) return false;

  // 必须按顺序或者先行完成前置
  const p = world.spaceRace.progress[natId] || { completedCount: 0, prestige: 0 };
  const mIndex = SPACE_MILESTONES.findIndex(m => m.id === milestoneId);
  if(mIndex > p.completedCount) return false; // 必须依次研发

  if(world.spaceRace.completed[milestoneId] && world.spaceRace.completed[milestoneId].natId === natId){
    return false; // 已完成
  }

  // 结算完成
  p.completedCount = Math.max(p.completedCount, mIndex + 1);
  p.prestige += milestone.prestige;
  // v14.1 E6：太空声望同步回写国家字段（此前只进 spaceRace 私池，
  // victory.js 的 prestige 目标与国家声望口径读不到它）
  nat.prestige = (nat.prestige || 0) + milestone.prestige;
  world.spaceRace.completed[milestoneId] = { natId, day: world.day };

  // 增益发放
  nat.stability = Math.min(100, (nat.stability || 70) + (milestone.stabilityBonus || 5));
  nat.modifiers = nat.modifiers || {};
  nat.modifiers.techSpeed = (nat.modifiers.techSpeed || 0) + milestone.techBonus;

  world.events = world.events || [];
  world.events.push({
    type: 'space_milestone',
    day: world.day,
    important: true,
    text: `🚀 太空壮举：【${nat.name}】成功实现【${milestone.name}】！科技声望 +${milestone.prestige}！`
  });

  return true;
}

export function getSpaceProgress(world, natId){
  initSpaceRace(world);
  return world.spaceRace.progress[natId] || { completedCount: 0, prestige: 0 };
}
