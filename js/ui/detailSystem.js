/* ============================================================
   ui/detailSystem.js —— 详情展开系统（单位档案 / 生产线装备档案）
   由 panels.js 委托调用：点击单位行/生产线卡片 → 展开完整介绍
   v7.0 E3/E4：单位详情纳入补给/断供/燃料状态下钻（B.3/§2.4）
   ============================================================ */

import { UNITS } from '../data/units.js';
import { ENCYCLOPEDIA } from '../data/encyclopedia.js';
import { getUnitSupplyModifiers } from '../engine/logistics.js';
import { getUnitFuelModifiers } from '../engine/resources.js';
import { LINE_RESOURCE_NEED } from '../data/resources.js';

/* 兵种角色说明 [B] —— 内容工业化：每兵种一段"使用手册" */
export const UNIT_ROLES = {
  inf: { name:'步兵 · 战线的骨架',
    text:'步兵是战线的骨架：宽度低、防御扎实、造价便宜。他们守得住壕沟、填得上缺口，但打开局面需要装甲与炮兵的肩膀。把步兵堆进敌人的 prepared defense，你只会得到一串伤亡数字。' },
  cav: { name:'骑兵 · 战线的补丁',
    text:'骑兵与摩托化部队是战线的补丁：速度快、组织一般。他们负责填补缺口、追击溃兵、抢占那些步兵来不及赶到的十字路口。别用他们去啃坚固设防的正面。' },
  mtn: { name:'山地师 · 恶劣地形之王',
    text:'山地师专为恶劣地形而生：在山地与丘陵，他们的攻防修正无可争议。但把他们派进平原，就浪费了一支精英——也浪费了训练他们的每一天。' },
  mot: { name:'摩托化 · 装甲的腿',
    text:'摩托化步兵把步兵的双腿换成轮子。他们与装甲协同推进时，是扩大突破口的最好选择；单独使用时，他们只是一群跑得快的软目标。' },
  larm: { name:'轻装甲 · 先声',
    text:'轻装甲师是装甲兵的先声：装甲薄、火力有限，但速度足以在敌人反应之前撕开缺口。他们的时代正在过去——让中坦来接班。' },
  arm: { name:'装甲师 · 决定性力量',
    text:'装甲师是决定性的力量：厚甲、重炮、高组织。把他们用在敌人最想不到的地方，配合摩托化步兵扩大战果——然后让整个战线为之转动。' }
};

const UNIT_NAMES = { inf:'步兵师', cav:'骑兵师', mtn:'山地师', mot:'摩托化师', larm:'轻装甲师', arm:'装甲师' };
const LINE_CATEGORY = { inf_eq:'步兵装备', art_eq:'火炮装备', tank_eq:'装甲战车', truck_eq:'运输车辆', sup_eq:'支援装备' };

/* 单位详情 HTML（点击单位行后展开） */
export function unitDetailHtml(world, u){
  const U = UNITS[u.type] || UNITS.inf;
  const nat = world.nations[u.nat];
  const role = UNIT_ROLES[u.type] || { name:'部队档案', text:'' };
  const cat = UNIT_CATEGORY[u.type];
  let hist = '';
  if(cat && typeof ENCYCLOPEDIA !== 'undefined'){
    const eq = (ENCYCLOPEDIA.equipments || []).find(e => e.category === cat);
    if(eq) hist = `<div class="ud-hist">📎 兵器档案 · ${eq.name}：${eq.history}</div>`;
  }
  const lvlName = { 1:'新兵', 2:'常规', 3:'老兵', 4:'精锐' }[u.level || 1] || '常规';

  // v7.0 E3/E4：补给与燃料状态下钻
  const sup = getUnitSupplyModifiers(u);
  const fuel = getUnitFuelModifiers(world, u);
  let supplyHtml = '';
  if(sup.isCutoff || sup.outOfSupplyDays > 0){
    supplyHtml = `<div class="ud-supply" style="border-left:2px solid #ef4444;background:rgba(239,68,68,0.08);padding:5px 8px;margin-top:6px;font-size:11px;color:#fca5a5;">
      ⚠️ <b>断供 ${sup.outOfSupplyDays} 天</b>：攻 ${(sup.atkMul*100).toFixed(0)}% · 防 ${(sup.defMul*100).toFixed(0)}% · 速 ${(sup.speedMul*100).toFixed(0)}%（宽限期 ${sup.supplyGrace} 天，附录 B.3）
    </div>`;
  } else if(u.supplyLevel != null && u.supplyLevel < 0.99){
    supplyHtml = `<div class="ud-supply" style="border-left:2px solid #f59e0b;background:rgba(245,158,11,0.08);padding:5px 8px;margin-top:6px;font-size:11px;color:#fcd34d;">
      ⚡ 补给紧张：该格补给率 ${(u.supplyLevel*100).toFixed(0)}%（远离补给枢纽辐射）
    </div>`;
  }
  if(fuel.starving){
    supplyHtml += `<div class="ud-supply" style="border-left:2px solid #f87171;background:rgba(248,113,113,0.08);padding:5px 8px;margin-top:4px;font-size:11px;color:#fca5a5;">
      🛢️ <b>燃料耗尽</b>：机动 -75% · 突破 -60%（§2.4，国家燃料池枯竭）
    </div>`;
  }

  return `<div class="unit-detail-inner">
    <div class="ud-title">${role.name}</div>
    <div class="ud-text">${role.text}</div>
    <div class="ud-stats">
      所属：${nat ? nat.name : u.nat} · 类型：${U.name} · 等级：Lv${u.level || 1}（${lvlName}）<br>
      软攻 ${U.soft} · 硬攻 ${U.hard} · 防御 ${U.def} · 突破 ${U.brk} · 硬度 ${Math.round(U.hardness*100)}% · 装甲 ${U.armor}<br>
      组织度上限 ${U.org} · 兵力 ${U.hp} · 战宽 ${U.width} · 速度 ${U.speed} · 训练 ${U.trainDays} 天
    </div>
    ${supplyHtml}
    ${hist}
  </div>`;
}

export const UNIT_CATEGORY = { inf:'步兵装备', cav:'步兵装备', mtn:'步兵装备', mot:'运输车辆', larm:'装甲战车', arm:'装甲战车' };

/* 生产线装备档案 HTML（点击生产线卡片后展开） */
export function prodDetailHtml(world, lineType){
  const cat = LINE_CATEGORY[lineType] || '';
  const items = (ENCYCLOPEDIA.equipments || []).filter(e => e.category === cat);
  const list = items.map(e =>
    `<div class="pd-item"><b>${e.name}</b>（${e.year} 年定型）<br>${e.desc}<br><span class="pd-stats">${e.stats}</span></div>`
  ).join('');
  // v7.0 E4：产线战略资源需求下钻
  const need = LINE_RESOURCE_NEED[lineType];
  const needTxt = need
    ? Object.entries(need).map(([r, v]) => `${{ oil:'石油', steel:'钢铁', aluminum:'铝', tungsten:'钨', rubber:'橡胶', chromium:'铬' }[r] || r} ${v}/厂·日`).join(' · ')
    : '无战略资源需求';
  return `<div class="pd-title">装备类别：${cat || '未知'}</div>
    <div class="pd-text">该生产线产出的装备用于编成与补员对应类型的师。生产线效率从 10% 起步，
    随持续生产爬升至 50%——转换产品线会损失一半效率，机器和人一样不喜欢改行。</div>
    <div class="pd-item" style="border-left:2px solid #b59247;margin-bottom:6px;">🧲 <b>战略资源需求</b>：${needTxt}<br>
    <span class="pd-stats">资源赤字时产线效率上限 = max(10%, 1 − 0.125×缺失比)（附录 B.4）</span></div>
    ${list ? `<div class="pd-list">${list}</div>` : ''}`;
}

/* ============================================================
   v9.5 U3：六角格显示名 —— 城市名 > 地形区名 > 战区
   纯函数（无 DOM），供面板与 tests/ui_copy.test.js 共用。
   区名词库按格索引确定性选取（禁 Math.random），避免全图同名单调。
   ============================================================ */
export const HEX_REGION_NAMES = {
  plain:  ['平原旷野', '开阔地'],
  forest: ['林地', '森林地带'],
  mount:  ['山地隘口', '山岭'],
  hills:  ['丘陵地带'],
  desert: ['荒漠'],
  marsh:  ['沼泽湿地'],
  sea:    ['海域']
};

/** @returns {{ title:string, isCity:boolean, subtitle:string }} */
export function hexTitleInfo(h){
  if(h.city && h.city.name){
    return { title: h.city.name, isCity: true, subtitle: `坐标 (${h.q}, ${h.r})` };
  }
  const cands = HEX_REGION_NAMES[h.terrain];
  if(cands && cands.length){
    return { title: cands[h.idx % cands.length], isCity: false, subtitle: `坐标 (${h.q}, ${h.r})` };
  }
  return { title: `战区坐标 (${h.q}, ${h.r})`, isCity: false, subtitle: '' };
}
