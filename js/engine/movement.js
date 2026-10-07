/* ============================================================
   engine/movement.js —— 移动 / 接敌 / 推进命令（§2.3 第 6 步）
   order 类型：attack {target,_dest?} | advance {dest} | move {path}
   v7.0 E3：断供航速惩罚(B.3) / 燃料断油瘫痪(§2.4) / 恶劣天气泥泞减速(§3.4)
   ============================================================ */

import { K } from '../data/constants.js';
import { UNITS } from '../data/units.js';
import { hexDist } from '../core/geom.js';
import { getUnitSupplyModifiers } from './logistics.js';
import { getUnitFuelModifiers } from './resources.js';
import { getHexWeather } from '../data/weather.js';
import { speedMod } from './mods.js';
import { updateStateOwnership } from './states.js';

/* 单位当日有效机动速度（断供×燃料×天气×地形四重约束） */
export function effectiveSpeed(world, u){
  let speed = UNITS[u.type].speed;
  // W0-A2：all_speed（tech:mobile3「纵深突破」）与 <type>_speed（一战国策）
  // 此前无人读取，机动加成完全失效。
  speed *= speedMod(world.nations[u.nat], u.type);
  const sup = getUnitSupplyModifiers(u);
  speed *= sup.speedMul;
  const fuel = getUnitFuelModifiers(world, u);
  speed *= fuel.speedMul;
  const h = world.at[u.q + ',' + u.r];
  if(h){
    const weather = getHexWeather(world, h);
    if(weather === 'mud') speed *= 0.5;      // 泥泞：航速 -50% (§3.4)
    else if(weather === 'snow') speed *= 0.7; // 暴雪：航速 -30%

    // W7/§12：地形机动减速与气候带影响
    if(h.terrain === 'mount') speed *= 0.65;
    else if(h.terrain === 'marsh') speed *= 0.60;
    else if(h.terrain === 'forest') speed *= 0.85;
    else if(h.terrain === 'hills') speed *= 0.90;
    else if(h.terrain === 'desert') speed *= 0.85;

    if(h.climate === 'arctic' && (weather === 'snow' || weather === 'mud')) speed *= 0.8;
  }
  if(u.strategic) speed *= 1.8;              // v8.0 M4 战略调动：铁路/公路机动 ×1.8
  return Math.max(0.2, speed);
}

export function processMove(world, u){
  // v8.0 M4：支援姿态原地开火，不移动；牵制 (pin) 与区域防御 (area_defense) 原地据守
  if(u.order && (u.order.type === 'support' || u.order.type === 'pin' || u.order.type === 'area_defense')) return;
  // v8.0 M4：路径点队列 —— 前一条命令结束时消费下一个航路点
  if(!u.order && u.waypoints && u.waypoints.length){
    const wp = u.waypoints.shift();
    u.order = { type: 'advance', dest: [wp.q, wp.r] };
  }
  if(!u.order) return;
  if(u.order.type === 'attack' || u.order.type === 'spearhead' || u.order.type === 'breakthrough'){
    const [tq,tr] = u.order.target || u.order.dest || [];
    if(tq == null || tr == null) return;
    const h = world.at[tq+','+tr];
    if(!h) return;
    // 目标已无敌（被友军占领或敌军撤离）→ 进入并继续推进
    const hostiles = hexUnitsOf(world, h).filter(x => x.hp>0 && world.nations[u.nat].atWarWith.includes(x.nat));
    if(!hostiles.length){
      // v12.1：只进入己方或敌国格；目标已被盟军占据时不得涌入（命令就地转化）
      if(hexDist(u.q,u.r,h.q,h.r) === 1 && !hexUnitsOf(world,h).includes(u) &&
         (h.owner === u.nat || world.nations[u.nat].atWarWith.includes(h.owner))){
        enterHex(world, u, h);
      }
      const nextType = (u.order.type === 'spearhead' || u.order.type === 'breakthrough') ? u.order.type : 'advance';
      u.order = u.order._dest ? { type: nextType, dest: u.order._dest, target: u.order._dest, _dest: u.order._dest, directFocus: u.order.directFocus } : null;
      return;
    }
    // 有守军 → 保持攻击姿态（战斗阶段处理）
    return;
  }
  if(u.order.type === 'advance' || u.order.type === 'spearhead' || u.order.type === 'breakthrough'){
    let steps = effectiveSpeed(world, u);
    while(steps-- > 0 && u.order){
      const [dq,dr] = u.order.dest || u.order.target || [];
      if(dq == null || dr == null) break;
      const here = world.at[u.q+','+u.r];
      if(!here) break;
      // 1) 逢敌接战：
      // 若具有 directFocus 或是矛头/突破命令，保持作战战术轴线集中，仅打阻挡在前进轴心正前方的敌格，不被侧翼无关敌格诱散
      const isFocused = u.order.type === 'spearhead' || u.order.type === 'breakthrough' || u.order.directFocus;
      let enemyAdj=null, ed=1e9;
      const curDist = hexDist(u.q, u.r, dq, dr);
      for(const ni of here.adj){
        const nh = world.hexes[ni];
        if(world.nations[u.nat].atWarWith.includes(nh.owner)){
          const dd = hexDist(nh.q,nh.r,dq,dr);
          if(isFocused){
            if(dd < curDist && dd < ed){
              ed = dd; enemyAdj = nh;
            }
          } else {
            if(dd < ed){ ed = dd; enemyAdj = nh; }
          }
        }
      }
      if(enemyAdj){
        const atkType = (u.order.type === 'spearhead' || u.order.type === 'breakthrough') ? u.order.type : 'attack';
        u.order = { type: atkType, target:[enemyAdj.q,enemyAdj.r], dest: u.order.dest, _dest:u.order.dest, directFocus: u.order.directFocus };
        return;
      }
      // 2) 向目标方向的己方空/驻扎格走位（堆叠上限）
      const destH = world.at[dq+','+dr];
      let best=null, bd=hexDist(u.q,u.r,dq,dr);
      // 抵达判定：只有真正站在目标格上，命令才算完成
      // （此前只判"目标格是己方且有空位"就收兵，导致右键点己方格远程机动原地不动）
      if(dq === u.q && dr === u.r){
        u.order = null;
        return;
      }
      for(const ni of here.adj){
        const nh = world.hexes[ni];
        if(nh.owner !== u.nat) continue;
        if(hexUnitsOf(world,nh).length >= K.STACK_LIMIT) continue;
        const dd = hexDist(nh.q,nh.r,dq,dr);
        if(dd <= bd){ bd=dd; best=nh; }
      }
      if(!best){ u.order=null; return; }
      leaveHex(world, u);
      u.q = best.q; u.r = best.r;
      best.units.push(u.id);
    }
    return;
  }
  if(u.order.type === 'move'){
    let steps = effectiveSpeed(world, u);
    while(steps-- > 0 && u.order){
      const nextHex = u.order.path[0];
      if(!nextHex){ u.order = null; break; }
      if(nextHex.owner !== u.nat){ u.order=null; break; }
      if(hexUnitsOf(world,nextHex).length >= K.STACK_LIMIT){ u.order=null; break; }
      leaveHex(world, u);
      u.q = nextHex.q; u.r = nextHex.r;
      nextHex.units.push(u.id);
      u.order.path.shift();
      if(!u.order.path.length) u.order = null;
    }
  }
}

function hexUnitsOf(world, h){
  return h.units.map(id => world.units.find(u => u.id === id)).filter(Boolean);
}
function leaveHex(world, u){
  const h = world.at[u.q+','+u.r];
  const i = h.units.indexOf(u.id);
  if(i>=0) h.units.splice(i,1);
}
export function enterHex(world, u, h){
  const oh = world.at[u.q+','+u.r];
  const i = oh.units.indexOf(u.id);
  if(i>=0) oh.units.splice(i,1);
  u.q = h.q; u.r = h.r;
  h.units.push(u.id);
  // v12.1 修复：占领只发生在敌国格上。此前只判 h.owner !== u.nat，
  // 陈旧攻击命令会让盟军部队"和平接管"盟友的城市（试玩中奥匈部队
  // 进驻德军刚夺回的柏林 → 柏林归奥匈 → 误触发协约国胜利终局）。
  if(h.owner !== u.nat && world.nations[u.nat].atWarWith.includes(h.owner)){
    h.owner = u.nat;
    if(world.stateById && h.stateId){
      updateStateOwnership(world, h.stateId);
    }
    world.events.push({ type:'capture', day:world.day,
      text:`${world.nations[h.owner].name}占领${h.city ? h.city.name : `(${h.q},${h.r})`}${h.city&&h.city.cap?'（首都）':''}`,
      hex:h.idx, important: !!(h.city && h.city.cap) });
  }
}
