/* ============================================================
   engine/econSocial.js —— 经济社会层系统（冷战/现代核心 §3.7）
   管理：财政三池（军备/民政/情报）、社会稳定、国际声望、阵营影响力
   ============================================================ */

export function initEconSocial(world){
  world.econSocial = world.econSocial || {
    enabled: true,
    nations: {}
  };

  for(const natId in world.nations){
    const n = world.nations[natId];
    world.econSocial.nations[natId] = {
      treasury: 1000,
      taxRate: 0.25,
      // 财政三池分配比例（默认：军备 40%, 民政 40%, 情报 20%）
      budget: { mil: 0.4, civ: 0.4, intel: 0.2 },
      intelPoints: 50,
      prestige: n.prestige ?? 60,
      stability: n.stability ?? 70,
      warFatigue: 0,
      // 影响力分布：向全球各国的渗透点数
      influenceSent: {},
      // 本国受各阵营影响比例：{ USA: 75, SOV: 20 }
      influenceReceived: { ...(n.influenceReceived || {}) },
      bloc: n.faction || 'neutral'
    };
  }
}

export function setBudgetPools(world, natId, { mil, civ, intel }){
  if(!world.econSocial || !world.econSocial.nations[natId]) return false;
  const total = mil + civ + intel;
  if(total <= 0) return false;
  world.econSocial.nations[natId].budget = {
    mil: mil / total,
    civ: civ / total,
    intel: intel / total
  };
  return true;
}

export function investProxy(world, donorNat, targetNat, points){
  if(!world.econSocial) return false;
  const d = world.econSocial.nations[donorNat];
  const t = world.econSocial.nations[targetNat];
  if(!d || !t || d.intelPoints < points) return false;

  d.intelPoints -= points;
  t.influenceReceived[donorNat] = (t.influenceReceived[donorNat] || 0) + points * 1.5;

  world.events.push({
    type: 'proxy_aid',
    day: world.day,
    important: false,
    text: `🌐【代理人援助】${world.nations[donorNat].name} 向 ${world.nations[targetNat].name} 注入干预点数，影响力大幅提升！`
  });

  updateBlocAlignment(world, targetNat);
  return true;
}

export function updateBlocAlignment(world, natId){
  const t = world.econSocial.nations[natId];
  if(!t) return;
  const recv = t.influenceReceived;
  let maxDonor = null;
  let maxVal = 0;
  for(const donor in recv){
    if(recv[donor] > maxVal){
      maxVal = recv[donor];
      maxDonor = donor;
    }
  }

  // 阵营向背阈值：影响力 ≥ 60 且领先后手 15 点以上改弦更张
  if(maxVal >= 60){
    const oldBloc = t.bloc;
    let newBloc = 'neutral';
    if(maxDonor === 'USA' || maxDonor === 'GBR') newBloc = 'nato';
    else if(maxDonor === 'SOV') newBloc = 'warsaw';
    else if(maxDonor === 'CHN') newBloc = 'non_aligned';

    if(oldBloc !== newBloc){
      t.bloc = newBloc;
      const n = world.nations[natId];
      if(n) n.faction = newBloc;
      world.events.push({
        type: 'bloc_switch',
        day: world.day,
        important: true,
        text: `🚩【阵营向背重组】在各方影响力博弈下，${world.nations[natId]?.name || natId} 政治天平倾斜，正式加入【${newBloc.toUpperCase()}】阵营！`
      });
    }
  }
}

export function econSocialMonthlyTick(world){
  if(!world.econSocial) return;

  for(const natId in world.econSocial.nations){
    const es = world.econSocial.nations[natId];
    const n = world.nations[natId];
    if(!n || !n.alive) continue;

    // 1. 财政月收入计算：Σ格经济值 × 税率
    const ownedHexes = world.hexes.filter(h => h.owner === natId);
    const econBase = ownedHexes.reduce((sum, h) => sum + (h.econValue || 1), 0);
    const monthlyIncome = Math.round(econBase * es.taxRate * 20);
    es.treasury += monthlyIncome;

    // 2. 财政三池结算
    const milSpend = Math.round(monthlyIncome * es.budget.mil);
    const civSpend = Math.round(monthlyIncome * es.budget.civ);
    const intelSpend = Math.round(monthlyIncome * es.budget.intel);

    // 军工池转化为装备产能与储备
    n.equip = (n.equip || 0) + Math.round(milSpend * 0.8);
    // 民生池维护社会稳定度
    if(civSpend > 50){
      es.stability = Math.min(100, es.stability + 1);
    } else {
      es.stability = Math.max(0, es.stability - 1);
    }
    // 情报池积累干预点数
    es.intelPoints = Math.min(200, es.intelPoints + Math.round(intelSpend / 10));

    // 3. 稳定度危机触发检查（< 30% 触发社会动荡）
    if(es.stability < 30 && !es.crisisActive){
      es.crisisActive = true;
      world.events.push({
        type: 'social_unrest',
        day: world.day,
        important: true,
        text: `⚠️【社会危机预警】${n.name} 社会稳定度已跌破 30%，全国爆发大规模反战罢工与抗议，生产与决策严重受阻！`
      });
      n.modifiers.milOutput = (n.modifiers.milOutput || 0) - 0.25;
    } else if(es.stability >= 45 && es.crisisActive){
      es.crisisActive = false;
      n.modifiers.milOutput = (n.modifiers.milOutput || 0) + 0.25;
    }

    // 同步到国家主对象
    n.stability = es.stability;
  }
}
