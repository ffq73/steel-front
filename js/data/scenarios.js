/* ============================================================
   data/scenarios.js —— 四时间线剧本注册表（v3.0 §3.2）
   ============================================================ */

import { WW1_SCENARIO } from './scenarios/ww1/index.js';
import { WW2_SCENARIO } from './scenarios/ww2/index.js';
import { COLDWAR_SCENARIO } from './scenarios/coldwar/index.js';
import { MODERN_SCENARIO } from './scenarios/modern/index.js';

export const SCENARIOS = {
  // —— 二战：白色方案 1939（基准剧本 A）——
  A: {
    id:'A', name:'白色方案 1939', start:'1939-09-01', timeLimit:120, player:'G', era:'ww2',
    characters: WW2_SCENARIO.characters,
    nations:['G','P','F','S','B','H'],
    // W0-C：本剧本复用了 ww2 的角色名册（角色 nat 是 GER/POL/FRA/SOV/GBR/HUN），
    // 但本国代号是单字母 G/P/F/S/B/H —— 两者永远匹配不上，
    // 于是「按 nat 找本国将领」的结果恒为空，开局没有任何将领被任命。
    // 这张表把剧本代号映射到角色名册使用的国号。
    nationAlias:{ G:'GER', P:'POL', F:'FRA', S:'SOV', B:'GBR', H:'HUN' },
    atWar:[['G','P'],['G','F']],
    presetTech:{ G:['inf_weapon_1'], P:[], F:[], S:[], B:[], H:[] },
    presetFocus:{ G:['rhineland'], P:[], F:[], S:[], B:[], H:[] },
    armies:{
      G:{ inf:22, cav:1, arm:3 },
      P:{ inf:13, cav:2 },
      F:{ inf:10 },
      S:{ inf:8 },
      B:{ inf:1 },
      H:{ inf:1 }
    },
    events:[
      { id:'soviet_partition', day:18,
        desc:'苏联进军波兰东部（里宾特洛甫-莫洛托夫密约）',
        run(world){ return engine_sovietPartition(world); } }
    ],
    objectives:{ G:['capture:华沙'], P:['survive:60'] }
  },

  // —— 二战：全面战争 1939（完整全球与东亚战区数据包）——
  ww2: WW2_SCENARIO,

  // —— 一战：火药桶 1914（完整数据包）——
  ww1: WW1_SCENARIO,

  // —— 冷战：铁幕 1949（月度战略结算与核威慑）——
  coldwar: COLDWAR_SCENARIO,

  // —— 现代：多极危机 2022（周结算、制裁、能源与四人物网络 [F]）——
  modern: MODERN_SCENARIO
};

function engine_sovietPartition(world){
  const gains = [];
  for(const h of world.hexes){
    if(h.owner !== 'P') continue;
    const nearS = h.adj.some(ni => world.hexes[ni].owner === 'S');
    if(nearS) gains.push(h);
  }
  for(const h of gains){
    for(const uid of [...h.units]){
      const u = world.units.find(x => x.id === uid);
      if(u && u.nat === 'P'){ u.hp = 0; }
    }
    h.owner = 'S';
  }
  return { text:`苏联进军波兰东部，接管 ${gains.length} 个地区，波兰腹背受敌！`, kind:'war' };
}
