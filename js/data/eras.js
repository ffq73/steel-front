/* ============================================================
   data/eras.js —— 时代修正表（v3.0 §1 / §3.8）
   四个剧本共用同一确定性战斗内核，时代特征由时代修正表调控。
   ============================================================ */

export const ERAS = {
  ww1: {
    id: 'ww1',
    name: '一战时代 (1914)',
    startYear: 1914,
    tickUnit: 'day',             // 结算周期：日
    entrenchMax: 0.25,           // [B] 堑壕上限提升至 25%（堑壕消耗战）
    entrenchPerDay: 0.03,        // [B] 每日掘壕 +3%
    atkMultiplier: 0.85,         // [B] 进攻基础惩罚 0.85
    baseWidth: 6,
    stackLimit: 6,
    cavalryBonus: 1.2,           // 骑兵机动价值
    gasAllowed: true,            // 毒气事件支持
    nuclearAllowed: false,
    airGroundWeight: 0.5,
    econSocialWeight: 'low'
  },

  ww2: {
    id: 'ww2',
    name: '二战时代 (1939)',
    startYear: 1939,
    tickUnit: 'day',             // 结算周期：日
    entrenchMax: 0.15,           // [H] 堑壕上限 15%（标准标定）
    atkMultiplier: 1.0,          // [B] 标准攻击倍率
    baseWidth: 6,
    stackLimit: 6,
    cavalryBonus: 1.0,
    gasAllowed: false,
    nuclearAllowed: false,
    airGroundWeight: 1.0,
    econSocialWeight: 'medium'
  },
  coldwar: {
    id: 'coldwar',
    name: '冷战时代 (1949)',
    startYear: 1949,
    tickUnit: 'month',           // 结算周期：月
    entrenchMax: 0.15,
    atkMultiplier: 1.0,
    baseWidth: 6,
    stackLimit: 4,               // [B] 堆叠上限 4
    cavalryBonus: 0.5,
    gasAllowed: false,
    nuclearAllowed: true,        // 末日钟与核威慑
    airGroundWeight: 1.5,        // 空军对地权重上升
    econSocialWeight: 'very-high'// 经济、社会、影响力权重极高
  },
  modern: {
    id: 'modern',
    name: '现代危机 (2022)',
    startYear: 2022,
    tickUnit: 'week',            // 结算周期：周
    entrenchMax: 0.10,           // [B] 无人机侦察让堑壕减半
    atkMultiplier: 1.1,          // 精确制导武器
    baseWidth: 4,                // 接触战规模小（宽度 4）
    stackLimit: 4,
    cavalryBonus: 0.1,
    gasAllowed: false,
    nuclearAllowed: true,        // 红线信号与核门槛
    airGroundWeight: 1.8,        // 精确打击支援层
    econSocialWeight: 'maximum'  // 制裁/能源/战争疲劳主导
  }
};
