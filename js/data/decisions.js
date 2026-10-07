/* ============================================================
   data/decisions.js —— 决议系统数据层 (v14.0 P2 §3.1)
   参照 HOI4 通用决议表（萌娘百科）：决议是玩家的"节奏释放阀"——
   消耗 PP 换取一次性强力效果或限时增益，是中后期的主要操作抓手。
   考据标注 [H] = HOI4 原版决议 / [B] = 本作标定
   ============================================================ */

export const DECISION_CATEGORIES = [
  { id:'peace',      name:'和平建设', icon:'🏗', desc:'不打仗时也能推进国家积累' },
  { id:'war',        name:'战时动员', icon:'⚔', desc:'战时强令增产，代价是稳定度' },
  { id:'economic',   name:'经济统制', icon:'🏭', desc:'直接干预生产与物资' },
  { id:'diplomatic', name:'外交斡旋', icon:'🤝', desc:'关系、傀儡国与自己阵营' }
];

/* effect 字段说明
   mods    —— 限时修正，写入 n.modifiers，duration 到期自动撤销
   instant —— 即时结算效果（数值直接改）
   weekly  —— 每周效果（每日 tick 折算 1/7）
   penalty —— 即时负面效果（稳定度/战争支持度）
   req*    —— 前置条件
*/
export const DECISIONS = [
  // ================= 和平建设 =================
  {
    id:'reorg_railway', name:'重组铁路系统', cat:'peace', cost:0, duration:120,
    once:true, source:'[H]',
    desc:'120 天内补给枢纽建造速度 +300%，效果结束时立即撤销。这是每个交战国开局的第一件事。',
    effect:{ mods:{ supplyHubBuild: 3.0 } }
  },
  {
    id:'improve_work_env', name:'改进工作环境', cat:'peace', cost:100, duration:180,
    source:'[H]', reqStabilityMax:60,
    desc:'生活消费品消耗 -5%，并持续改善劳资关系（每周稳定度 +0.5%）。',
    effect:{ mods:{ consumerGoods:-0.05 }, weekly:{ stability:0.5 } }
  },
  {
    id:'regional_industry', name:'区域工业整合', cat:'peace', cost:100,
    source:'[H]', reqInfra:5, oncePerHex:true,
    desc:'在基建已满级的省份增加 1 个建筑位。工业国的扩张利器。',
    effect:{ instant:{ buildSlot:1 } }
  },
  {
    id:'develop_mineral', name:'开发当地矿产', cat:'peace', cost:25, maxUses:8,
    source:'[H]', reqTech:'excavation1', cooldown:30,
    desc:'启动区域采矿，30 天后获得 1 单位该省资源。每省上限 8 次。',
    effect:{ instant:{ resource:1 } }
  },
  {
    id:'expand_civilian', name:'扩建民用部门', cat:'peace', cost:150,
    source:'[B]', reqCiv:12, once:true,
    desc:'全国 +2 座民用工厂（需已有 12 座民用工厂）。',
    effect:{ instant:{ civFactory:2 } }
  },

  // ================= 战时动员 =================
  {
    id:'emergency_industry', name:'紧急工业拨款', cat:'war', cost:100, atWar:true,
    source:'[H]', oncePerHex:true,
    desc:'在选定省份 +1 建筑位。代价：稳定度 -2.5%、战争支持度 -2.5%。',
    effect:{ instant:{ buildSlot:1 }, penalty:{ stability:-2.5, warSupport:-2.5 } }
  },
  {
    id:'convert_industry', name:'紧急工业转变', cat:'war', cost:100, atWar:true,
    source:'[H]', reqCiv:5, once:true,
    desc:'5 座民用工厂转为军用工厂。代价：稳定度 -3%、战争支持度 -5%。',
    effect:{ instant:{ civToMil:5 }, penalty:{ stability:-3, warSupport:-5 } }
  },
  {
    id:'war_production', name:'战时生产法', cat:'war', cost:150, duration:180, atWar:true,
    source:'[H]',
    desc:'180 天内军工厂产出 +10%、消费品 -3%。停火前请注意收尾。',
    effect:{ mods:{ milOutput:0.10, consumerGoods:-0.03 } }
  },
  {
    id:'requisition_trains', name:'征用民用卡车', cat:'war', cost:0, atWar:true,
    source:'[H]', reqTech:'construction2', once:true,
    desc:'立即获得 15 辆运输车辆。代价：稳定度 -5%。',
    effect:{ instant:{ equipment:{ truck_eq:15 } }, penalty:{ stability:-5 } }
  },
  {
    id:'women_work', name:'女性参加工作', cat:'war', cost:100, atWar:true,
    source:'[H]', reqLaw:'total', reqWarSupportMin:50, once:true,
    desc:'人力储备 +3%（总动员法 + 战争支持度 50% 以上可用）。战后立即撤销。',
    effect:{ instant:{ manpowerBonus:0.03 }, penalty:{ stability:-5 } }
  },
  {
    id:'war_propaganda', name:'战争宣传', cat:'war', cost:100, duration:90,
    source:'[H]', reqWarSupportMax:50,
    desc:'90 天内每周战争支持度 +0.5%。舆论是最好的补给。',
    effect:{ weekly:{ warSupport:0.5 } }
  },
  {
    id:'hero_propaganda', name:'英雄主义宣传', cat:'war', cost:100, duration:180, atWar:true,
    source:'[H]',
    desc:'180 天内，因战斗伤亡导致的每周战争支持度损失 -0.6%。止损专用。',
    effect:{ weekly:{ warSupportLossReduce:0.6 } }
  },

  // ================= 经济统制 =================
  {
    id:'austerity', name:'鼓励节俭', cat:'economic', cost:50, duration:180, atWar:true,
    source:'[H]',
    desc:'180 天内生活消费品 -5%。民心与工厂效率的折中。',
    effect:{ mods:{ consumerGoods:-0.05 } }
  },
  {
    id:'full_utilization', name:'全面动员生产', cat:'economic', cost:200, duration:240,
    source:'[B]', reqLaw:'total',
    desc:'总动员法下可用：240 天内军工厂产出 +20%。代价：稳定度 -10%、消费品 +3%。',
    effect:{ mods:{ milOutput:0.20, consumerGoods:0.03 }, penalty:{ stability:-10 } }
  },
  {
    id:'resource_mobilization', name:'资源管制', cat:'economic', cost:100, duration:180, atWar:true,
    source:'[B]',
    desc:'180 天内六大战略资源产出 +15%，但民用工厂产出 -5%。',
    effect:{ mods:{ resourceOutput:0.15, civOutput:-0.05 } }
  },

  // ================= 外交斡旋 =================
  {
    id:'improve_relations', name:'改善国际关系', cat:'diplomatic', cost:150,
    source:'[H]', oncePer:30,
    desc:'与所有交战国关系 +50。外交是另一种补给线。',
    effect:{ instant:{ relations:50 } }
  },
  {
    id:'puppet_propaganda', name:'在傀儡国推广思想', cat:'diplomatic', cost:100, duration:120,
    source:'[H]', reqPuppet:true,
    desc:'在傀儡国内每日消耗 0.5 PP，120 天内提升其执政党支持。',
    effect:{ mods:{ puppetSupport:1.0 }, dailyPP:0.5, weekly:{ puppetSupport:1.0 } }
  },
  {
    id:'anti_corruption', name:'整饬吏治', cat:'diplomatic', cost:100, duration:180,
    source:'[B]',
    desc:'180 天内每周稳定度 +0.3%、战争支持度 +0.2%。慢功夫，但两类指标一起涨。',
    effect:{ weekly:{ stability:0.3, warSupport:0.2 } }
  },
  {
    id:'cultural_exchange', name:'文化交流协定', cat:'diplomatic', cost:100, duration:365,
    source:'[B]', once:true,
    desc:'365 天内每日 +0.5 科研点（科技 +10%），并小幅改善关系。',
    effect:{ mods:{ researchSpeed:0.10 }, weekly:{ relations:0.5 } }
  }
];

/** 取决议定义 */
export function getDecision(id){
  return DECISIONS.find(d => d.id === id) || null;
}
