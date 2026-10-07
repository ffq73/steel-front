/* ============================================================
   data/weather.js —— 战区动态天气系统 (v7.0 §3.4)
   1. 极寒冬雪 (Deep Snow)、秋雨泥泞 (Mud / Rasputitsa) 与晴朗 (Clear)
   2. 随推演日期与地理纬度动态演变
   3. 地表着色覆层与气象参数输出
   ============================================================ */

/** 获取指定六角格的当前天气状态 */
export function getHexWeather(world, hex){
  if(!hex || hex.terrain === 'sea') return 'clear';
  if(hex.terrain === 'desert') return 'clear';

  const day = world ? (world.day || 0) : 0;
  // 推演周期模拟：
  // day 0~25: 9月秋季晴朗/微雨
  // day 25~50: 10~11月深秋，东欧普里皮亚季沼泽与平原进入泥泞期 (Mud)
  // day 51~130: 12月~2月冬季，北方及东线全境覆盖极寒冬雪 (Deep Snow)
  // day 131~170: 3~4月春汛融雪泥泞期 (Mud)
  // 其余时间晴朗
  const cycleDay = day % 365;

  // 1. 冬季暴雪覆盖（北欧与东欧、高海拔山脉）
  if(hex.terrain === 'mount' || (cycleDay >= 51 && cycleDay <= 130 && (hex.r <= 5 || hex.q >= 12))){
    return 'snow';
  }

  // 2. 泥泞期（秋雨或春汛）
  if((cycleDay >= 25 && cycleDay <= 50) || (cycleDay >= 131 && cycleDay <= 165)){
    if(hex.terrain === 'marsh' || hex.terrain === 'plain' || hex.r >= 6){
      return 'mud';
    }
  }

  // 3. 沼泽地形自带泥泞沼气特征
  if(hex.terrain === 'marsh'){
    return 'mud';
  }

  return 'clear';
}

/** 获取天气对战斗与机动的影响说明 */
export function getWeatherEffects(weather){
  if(weather === 'snow'){
    return { name: '极寒暴雪', moveMul: 0.70, atkMul: 0.85, defMul: 1.10, desc: '严寒降雪：机动航速 -30%，非冬装部队每日额外损耗' };
  } else if(weather === 'mud'){
    return { name: '深秋泥泞', moveMul: 0.50, atkMul: 0.80, defMul: 1.05, desc: '道路翻浆：战车航速降低 50%，装甲突击受阻' };
  }
  return { name: '晴朗无云', moveMul: 1.0, atkMul: 1.0, defMul: 1.0, desc: '气象良好：陆空全兵种标准作战效率' };
}
