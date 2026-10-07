/* ============================================================
   data/ideology.js —— 意识形态体系 (v14.0 P3 §4.1)
   依据 HOI4（萌娘百科「政治派别」/ Wiki: Ideology）：
   四种意识形态 + 亚形态，决定外交合法性、傀儡等级、AI 宣战倾向。
   [H] = HOI4 原版规则  [B] = 本作标定
   ============================================================ */

export const IDEOLOGIES = {
  democratic: {
    id: 'democratic', name: '民主主义', color: '#3b82c4', icon: '🗳️',
    desc: '蓝线。不能傀儡他国，但可保障他国独立、对他国禁运花费最低。',
    canPuppet: false,            // [H] 民主主义不得傀儡其他国家
    puppetTier: 'satellite',     // 即便成立也只能是卫星国
    justifySpeed: 1.0,           // [H] 正当化战争目标速度
    guaranteeIndependence: true, // [H] 可保障不同意识形态国家的独立
    embargoCost: 0.6,            // [B] 禁运成本系数（民主主义最低）
    aiAggression: 1.0,
    drift: { same: 0.02, other: 0.01, rival: -0.01 }   // [H] 每日政党支持度漂移
  },
  communism: {
    id: 'communism', name: '共产主义', color: '#c0392b', icon: '☭',
    desc: '红线。受限较少，可自由傀儡与输出革命。',
    canPuppet: true,
    puppetTier: 'satellite',
    justifySpeed: 1.0,
    guaranteeIndependence: false,
    embargoCost: 1.0,
    aiAggression: 1.15,
    drift: { same: 0.02, other: 0.01, rival: -0.01 }
  },
  fascism: {
    id: 'fascism', name: '法西斯主义', color: '#8b8b3a', icon: '⚡',
    desc: '右转/棕线。与主要国家交战时正当化战争目标快 80%，傀儡默认为专员辖区。',
    canPuppet: true,
    puppetTier: 'pupil',         // [H] 法西斯主义傀儡默认等级更低（专员辖区）
    justifySpeed: 1.8,           // [H] 萌娘百科：法西斯对主要国家交战时快 80%
    guaranteeIndependence: false,
    embargoCost: 1.0,
    aiAggression: 1.8,           // [H] AI 宣战倾向显著更高
    drift: { same: 0.02, other: 0.01, rival: -0.01 }
  },
  neutrality: {
    id: 'neutrality', name: '中立主义', color: '#7d7d7d', icon: '⚪',
    desc: '倒车线。意识形态变化抵制能力 -30%。',
    canPuppet: true,
    puppetTier: 'satellite',
    justifySpeed: 1.0,
    guaranteeIndependence: false,
    embargoCost: 1.0,
    aiAggression: 0.85,
    ideologyChangeResist: 0.30,  // [H] 中立主义：意识形态变化抵制 -30%
    drift: { same: 0.02, other: 0.01, rival: -0.01 }
  }
};

/** 亚形态（HOI4 每个意识形态下有 3-5 个变体）[H] */
export const IDEOLOGY_FACTIONS = {
  democratic: [
    { id:'conservative', name:'保守主义',   drift:0.02 },
    { id:'liberalism',   name:'自由主义',   drift:0.02 },
    { id:'dem_soc',      name:'民主社会主义', drift:0.02 }
  ],
  communism: [
    { id:'leninism',     name:'列宁主义',   drift:0.02 },
    { id:'marxism',      name:'马克思主义', drift:0.02 },
    { id:'stalinism',    name:'斯大林主义', drift:0.02 },
    { id:'trotskyism',   name:'托洛茨基主义', drift:0.02 }
  ],
  fascism: [
    { id:'gaponism',     name:'长枪党主义', drift:0.02 },
    { id:'rexism',       name:'雷克斯主义', drift:0.02 },
    { id:'nazism',       name:'国家社会主义', drift:0.02 }
  ],
  neutrality: [
    { id:'oligarchism',  name:'寡头政治',   drift:0.02 },
    { id:'despotism',    name:'专制主义',   drift:0.02 },
    { id:'centrism',     name:'温和主义',   drift:0.02 }
  ]
};

/** 傀儡等级（HOI4 停战会议） */
export const PUPPET_TIERS = {
  satellite: { id:'satellite', name:'卫星国', desc:'宗主可征召其人力与工厂抽成，但保留内政。' },
  pupil:     { id:'pupil',     name:'专员辖区', desc:'控制更紧，宗主几乎全权支配。' }
};

/** 各时代各国初始意识形态（缺省走 neutrality） */
export const ERA_IDEOLOGY = {
  ww1: { G:'fascism', P:'democratic', F:'democratic', B:'democratic', S:'communism', R:'communism',
         A:'democratic', O:'neutrality', U:'neutrality', Y:'communism' },
  ww2: { G:'fascism', P:'democratic', F:'democratic', B:'democratic', S:'communism', R:'communism',
         U:'democratic', J:'fascism', C:'fascism', M:'fascism', I:'fascism', Y:'communism' },
  coldwar: { G:'democratic', P:'communism', F:'communism', B:'democratic', S:'communism', R:'communism',
             U:'democratic', C:'communism', Y:'democratic' },
  modern: { G:'democratic', P:'communism', F:'democratic', B:'democratic', S:'communism', R:'communism',
            U:'democratic', C:'communism' }
};

export function getIdeology(id){
  return IDEOLOGIES[id] || IDEOLOGIES.neutrality;
}
