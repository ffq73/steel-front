/* ============================================================
   data/nations.js —— 国家数据（颜色/初始工厂/战争支持度/AI 参数）
   warSupport 决定投降界限：50% + 0.3 × ws / 100（§3.10）
   aiFocusPriority：国策 AI 的静态优先级（§3.9）

   v11.0 修正：
   1) 代码 B 在剧本 A 里是**英国**（FOCUSES.B 是英国国策树、armies.B 是
      远征军、目标含跨海作战），但本表把它写成了「波罗的海国家」并只给了
      civ:1 mil:0 —— 玩家在剧本 A 选英国，看到的是「波罗的海国家」、
      且几乎无工业。改为英国及其历史工业规模。
   2) G 的法案 'war_economy' 不是合法法案 id（合法值为 civilian/partial/
      war/total），经济结算无从匹配，改为 'war'。
   ============================================================ */

export const NATIONS = {
  G: { name:'德国',     color:'#7d8b9c', civ:8,  mil:10, equip:800,  warSupport:60,
       law:'war', ai:{ prodMul:1.0, decisionDelay:2, attackThreshold:2.0 },
       focusPriority:['four_year','army_expansion','armor_corps','blitzkrieg','danzig','west_offensive'] },
  P: { name:'波兰',     color:'#c96a80', civ:4,  mil:4,  equip:300,  warSupport:20,
       law:'civilian', ai:{ prodMul:1.0, decisionDelay:2, attackThreshold:2.4 },
       focusPriority:['army_modernization','fortification','entrench'] },
  F: { name:'法国',     color:'#4b84d6', civ:7,  mil:6,  equip:500,  warSupport:40,
       law:'partial', ai:{ prodMul:1.0, decisionDelay:2, attackThreshold:3.0 },
       focusPriority:['maginot','army_reform'] },
  S: { name:'苏联',     color:'#c0392b', civ:10, mil:8,  equip:1000, warSupport:70,
       law:'partial', ai:{ prodMul:1.0, decisionDelay:2, attackThreshold:2.4 },
       focusPriority:['five_year','deep_battle'] },
  // 剧本 A 的 B 是英国（本土 + 远征军），不是波罗的海三国
  B: { name:'英国',     color:'#a0522d', civ:9,  mil:7,  equip:700,  warSupport:50,
       law:'partial', ai:{ prodMul:1.0, decisionDelay:2, attackThreshold:2.6 },
       focusPriority:['shadow_factories','bef_reform','empire_cohesion'] },
  H: { name:'匈牙利',   color:'#8f9a55', civ:2,  mil:1,  equip:100,  warSupport:50,
       law:'civilian', ai:{ prodMul:1.0, decisionDelay:4, attackThreshold:9 },
       focusPriority:[] },
  N: { name:'中立国',   color:'#7b8290', civ:0,  mil:0,  equip:0,    warSupport:50,
       law:'civilian', ai:{ prodMul:0, decisionDelay:99, attackThreshold:99 },
       focusPriority:[] }
};

/* 阵营/开战关系（剧本 A） */
export const AT_WAR = [['G','P'],['G','F']];
