/* ============================================================
   engine/energy.js —— 现代能源依赖、管道断供与通胀冲击系统 (v5.0 §2.6 / E4)
   管理北溪/友谊输油管线状态、天然气反制牌、欧洲工业通胀与液化天然气(LNG)替代
   ============================================================ */

export const PIPELINES = {
  nord_stream: {
    id: 'nord_stream',
    name: '“北溪”海底天然气输送管道',
    supplier: 'RUS',
    transitTo: ['GER', 'FRA', 'ITA'],
    status: 'operational',
    capacity: 100 // 百万立方米/日
  },
  druzhba_oil: {
    id: 'druzhba_oil',
    name: '“友谊”输油管线南线与北线',
    supplier: 'RUS',
    transitTo: ['POL', 'GER', 'HUN', 'CZE', 'SVK'],
    status: 'operational',
    capacity: 80
  }
};

export function initEnergy(world){
  world.energy = world.energy || {
    pipelines: JSON.parse(JSON.stringify(PIPELINES)),
    lngSuppliers: ['USA', 'QAT'],
    marketShock: 0 // 0 - 100%
  };
}

export function cutPipeline(world, pipelineId, reason = '设备故障或管道破裂破坏'){
  initEnergy(world);
  const p = world.energy.pipelines[pipelineId];
  if(!p || p.status === 'severed') return false;

  p.status = 'severed';
  world.energy.marketShock = Math.min(100, world.energy.marketShock + 40);

  // 沿线欧洲主要消费国承受工业与物价冲击
  for(const natId of p.transitTo){
    const nat = world.nations[natId];
    if(nat){
      nat.modifiers = nat.modifiers || {};
      nat.modifiers.civOutput = (nat.modifiers.civOutput || 0) - 0.15; // 能源通胀扣减 15% 民工
      nat.stability = Math.max(10, (nat.stability || 75) - 10);
    }
  }

  world.events = world.events || [];
  world.events.push({
    type: 'energy_cutoff',
    day: world.day,
    important: true,
    text: `⚡【能源危机爆发】${p.name}供气彻底中断！原因：${reason}。欧洲天然气现货期货价格跳涨 200%，工业重镇面临停产危机！`
  });

  return true;
}

export function getPipelineStatus(world, pipelineId){
  initEnergy(world);
  return world.energy.pipelines[pipelineId]?.status || 'unknown';
}
