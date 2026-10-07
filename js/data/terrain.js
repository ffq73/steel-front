/* ============================================================
   data/terrain.js —— 地形系数表（v2.0 §5.1 / v12.0 M2 色板重制）
   v12.0 M2：只动 color（atk/def 系数是 sim.js B 系断言依赖，禁止改动）。
   新色板目标：在 0.32 alpha 政治色覆盖下仍能一眼区分七种地貌 ——
   平原暖麦绿 / 森林深针叶绿 / 丘陵赭黄 / 山地冷灰 / 沼泽浊绿 /
   沙漠沙金 / 城市冷灰蓝。
   ============================================================ */

export const TERRAIN = {
  plain : { name:'平原', atk:1.00, def:1.00, color:'#5d6b40' },
  forest: { name:'森林', atk:0.85, def:1.15, color:'#1e3a24' },
  hills : { name:'丘陵', atk:0.80, def:1.20, color:'#8a6d3b' },
  mount : { name:'山地', atk:0.60, def:1.25, color:'#5c6470' },
  city  : { name:'城市', atk:0.70, def:1.40, color:'#49566b' },
  marsh : { name:'沼泽', atk:0.70, def:1.10, color:'#3d5442' },
  desert: { name:'沙漠', atk:0.90, def:0.90, color:'#b08d4f' }
};
