/* ============================================================
   data/wargoals.js —— 剧本目标 / 战争目标类型注册表（v14.1 W0-E6）
   ------------------------------------------------------------
   v14 文档 P6 已设计但文件至今不存在，本轮落地。

   剧本 objectives 数据形如：
     objectives: { GER: ['capture:巴黎', 'survive:120'], ... }
   字符串目标由 parseObjective 解析为 { type, arg, minScore }，
   类型语义在本表登记；victory.js 是唯一的解释方（统一判定，
   替代旧硬编码的 A/ww1/ww2 三分支）。

   effects 字段预留扩展位：
     - victory: 该类型计入剧本胜利判定（全部类型当前均为 true）
     - onPeace: 和会校验口径（W5-1/2 战争目标接入时使用）
   ============================================================ */

export const WARGOAL_TYPES = {
  capture: {
    id: 'capture',
    name: '攻占目标城市',
    desc: '己方控制以该名命名的城市格，且该城原属国已投降或损失过半胜利点',
    minScore: 1,
    effects: { victory: true, onPeace: 'validate' }
  },
  survive: {
    id: 'survive',
    name: '坚守天数',
    desc: '坚守至第 N 天而未投降',
    minScore: 1,
    effects: { victory: true }
  },
  prestige: {
    id: 'prestige',
    name: '声望达标',
    desc: '国家国际声望（n.prestige，来源：科技效应与太空竞赛里程碑）达到 N 点',
    minScore: 1,
    effects: { victory: true }
  },
  influence_lead: {
    id: 'influence_lead',
    name: '影响力主导',
    desc: '在经济社会层追踪的国家中，倾向本国阵营者占比达到 N%',
    minScore: 1,
    effects: { victory: true }
  },
  ceasefire: {
    id: 'ceasefire',
    name: '停火窗口',
    desc: '主要当事国战争疲劳均达 70% 后停火谈判窗口开启（world.milAid.ceasefireReady）',
    minScore: 1,
    effects: { victory: true }
  },
  redline: {
    id: 'redline',
    name: '红线未爆',
    desc: '军援危机升级指数全程未触及 100%（world.milAid.escalationGauge 只增不减，未触顶即未爆）',
    minScore: 1,
    effects: { victory: true }
  }
};

/* 解析 'type:arg' 形式的目标字符串；未登记类型按未知处理（判定恒不达成） */
export function parseObjective(str){
  const [type, rawArg] = String(str).split(':');
  const def = WARGOAL_TYPES[type] || null;
  const arg = rawArg != null && rawArg !== '' && !Number.isNaN(Number(rawArg)) ? Number(rawArg) : (rawArg || null);
  return {
    type,
    arg,
    minScore: def ? def.minScore : 0,
    name: def ? def.name : `未知目标(${type})`,
    known: !!def
  };
}
