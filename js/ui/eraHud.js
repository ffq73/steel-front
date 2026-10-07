/* ============================================================
   ui/eraHud.js —— v8.0 M6 四副本专属 HUD 与面板
   一战：炮击准备仪表（环形进度 + 弹药消耗）/ 战争疲惫条 / 革命风险
   二战：装备缺口红点 / 计划加成角标 / 补给模式快捷
   冷战：双轨顶栏（对手情报估算）/ DEFCON 降级全屏红边 / 影响力投放面板
   现代：声望·疲劳条 / 红线警告框 / 制裁面板 / 军援管道面板 / 升级管控
   ============================================================ */

import { BARRAGE_MODES, setBarrageMode } from '../engine/barrage.js';
import { investInfluence, conductCovertOp } from '../engine/bloc.js';
import { imposeSanction, SANCTION_PACKAGES } from '../engine/sanctions.js';
import { sendAidPackage, AID_PACKAGES } from '../engine/milaid.js';
import { UNITS } from '../data/units.js';
import { sound } from '../core/audio.js';
import { showToast } from './panels.js';

/* 制裁强度 1–3：由制裁包的实际惩罚力度推导（数据结构本身无 severity 字段） */
function sanctionSeverity(p){
  if(!p) return 2;
  if((p.tradePenalty || 0) >= 0.25 || (p.reserveLoss || 0) >= 0.4) return 3;
  if((p.milPenalty || 0) >= 0.1 || (p.techSpeedPenalty || 0) >= 0.2) return 2;
  return 1;
}
/* 红线军援：escalationAdd >= 25 视为触碰对手战略红线（ATACMS / F-16 等） */
function isRedline(p){ return ((p && p.escalationAdd) || 0) >= 25; }

/* ============================================================
   一战
   ============================================================ */

/* 战争疲惫（0–100）：优先取 econSocial，其次 nation.warFatigue */
export function getWeariness(world, natId){
  const es = world.econSocial && world.econSocial.nations && world.econSocial.nations[natId];
  if(es && typeof es.warFatigue === 'number') return es.warFatigue;
  const n = world.nations[natId];
  return (n && typeof n.warFatigue === 'number') ? n.warFatigue : 0;
}

export function ensureEraSubtrack(){
  let sub = document.getElementById('sf-era-subtrack');
  if(!sub){
    sub = document.createElement('div');
    sub.id = 'sf-era-subtrack';
    sub.className = 'sf-era-subtrack';
    const topbar = document.querySelector('.sf-topbar');
    if(topbar && topbar.parentElement){
      topbar.parentElement.insertBefore(sub, topbar.nextSibling);
    }
  }
  return sub;
}

/* §8.1 战争疲惫国家条 + 革命风险警示（次级轨红条） */
export function renderWearinessBar(world){
  const sub = ensureEraSubtrack();
  if(!sub) return;
  sub.style.display = 'flex';
  let el = document.getElementById('sf-weariness');
  if(!el){
    let left = sub.querySelector('.sf-era-subtrack-left');
    if(!left){
      sub.innerHTML = `<div class="sf-era-subtrack-left"></div><div class="sf-era-subtrack-right"></div>`;
      left = sub.querySelector('.sf-era-subtrack-left');
    }
    el = document.createElement('div');
    el.id = 'sf-weariness';
    el.className = 'sf-wearbar';
    el.title = '战争疲惫：持续作战累积，越高越易爆发革命与厌战罢工';
    el.innerHTML = `<span class="sf-wearbar-label">总体战疲惫</span>
      <div class="sf-wearbar-track"><div class="sf-wearbar-fill" id="sf-wearbar-fill"></div></div>
      <span class="sf-wearbar-num" id="sf-wearbar-num">0%</span>`;
    left.appendChild(el);
  }
  const w = getWeariness(world, world.player);
  const fill = document.getElementById('sf-wearbar-fill');
  const num = document.getElementById('sf-wearbar-num');
  if(fill){
    fill.style.width = Math.min(100, w) + '%';
    fill.style.background = w >= 70 ? 'linear-gradient(90deg,#f97316,#ef4444)'
                          : w >= 40 ? 'linear-gradient(90deg,#eab308,#f97316)'
                                    : 'linear-gradient(90deg,#4ade80,#eab308)';
  }
  if(num) num.textContent = w.toFixed(0) + '%';
  el.classList.toggle('is-critical', w >= 70);

  // 革命风险：稳定度 <30 时顶栏闪红 + 专门警报行
  const n = world.nations[world.player];
  const stab = n ? (n.stability <= 1 ? n.stability * 100 : n.stability) : 100;
  el.classList.toggle('is-revolt', stab < 30);
}

/* §8.1 炮击准备仪表：环形进度 + 圈内弹药消耗；点击在计划盘上弹出三选一 */
export function renderBarrageGauge(world, ui){
  const planBar = document.getElementById('hud-plan-actions');
  if(!planBar) return;
  let el = document.getElementById('sf-barrage-gauge');
  if(!el){
    el = document.createElement('div');
    el.id = 'sf-barrage-gauge';
    el.className = 'sf-barrage';
    el.title = '炮击准备：为当前作战计划设定炮火准备强度（点击三选一）';
    planBar.insertBefore(el, planBar.firstChild);
    el.addEventListener('click', () => openBarrageModal(world, ui));
  }
  const bar = (world.barrages && Object.values(world.barrages)[0]) || null;
  const mode = bar ? (BARRAGE_MODES[bar.mode] || BARRAGE_MODES.standard) : null;
  const pct = bar ? Math.min(1, bar.currentDays / Math.max(1, bar.targetDays)) : 0;
  const R = 15, C = 2 * Math.PI * R;
  el.innerHTML = `
    <svg viewBox="0 0 40 40" class="sf-barrage-svg">
      <circle cx="20" cy="20" r="${R}" fill="none" stroke="#2d3748" stroke-width="4.5"/>
      <circle cx="20" cy="20" r="${R}" fill="none" stroke="${bar && bar.ready ? '#4ade80' : '#f59e0b'}"
              stroke-width="4.5" stroke-linecap="round"
              stroke-dasharray="${(pct * C).toFixed(1)} ${C.toFixed(1)}"
              transform="rotate(-90 20 20)"/>
    </svg>
    <div class="sf-barrage-txt">
      <b>${mode ? mode.name.split(' ')[0] : '未设炮击'}</b>
      <span>${bar ? `${bar.currentDays}/${bar.targetDays}天 · 弹 ${bar.currentDays * (mode ? mode.artCostPerDay : 0)}` : '点击设定'}</span>
    </div>`;
  el.classList.toggle('is-ready', !!(bar && bar.ready));
}

/* 三选一弹窗 */
export function openBarrageModal(world, ui){
  const overlay = document.getElementById('sf-barrage-modal') || (() => {
    const d = document.createElement('div');
    d.id = 'sf-barrage-modal';
    d.className = 'sf-overlay sf-barrage-modal';
    document.body.appendChild(d);
    return d;
  })();
  const keys = Object.keys(BARRAGE_MODES);
  overlay.innerHTML = `
    <div class="sf-bm-box">
      <div class="sf-bm-head">炮击准备强度 <span>— 一战专属炮兵作战条令</span>
        <button class="sf-bm-x" id="sf-bm-close">×</button></div>
      <div class="sf-bm-cards">
        ${keys.map(k => {
          const m = BARRAGE_MODES[k];
          return `<button class="sf-bm-card" data-mode="${k}">
            <div class="sf-bm-name">${m.name}</div>
            <div class="sf-bm-stat"><span>准备</span><b>${m.prepDays} 天</b></div>
            <div class="sf-bm-stat"><span>耗弹</span><b>${m.artCostPerDay}/天</b></div>
            <div class="sf-bm-stat"><span>效果</span><b>壕沟 -${Math.round(m.entrenchReduce * 100)}%</b></div>
            ${m.exhaustionAdd ? `<div class="sf-bm-stat bad"><span>代价</span><b>疲惫 +${m.exhaustionAdd}</b></div>` : ''}
            <div class="sf-bm-desc">${m.desc}</div>
          </button>`;
        }).join('')}
      </div>
      <div class="sf-bm-foot">炮击将在「执行进攻」后按天累积，准备完毕时守方壕沟按上表削减。</div>
    </div>`;
  overlay.classList.add('on');
  const close = () => overlay.classList.remove('on');
  overlay.querySelector('#sf-bm-close').onclick = close;
  overlay.onclick = e => { if(e.target === overlay) close(); };
  overlay.querySelectorAll('[data-mode]').forEach(b => {
    b.onclick = () => {
      // 绑定到当前玩家的第一个计划
      const front = (world.fronts || []).find(f => f.nat === world.player);
      const planId = front ? front.id : ('plan_' + world.player);
      setBarrageMode(world, planId, b.dataset.mode);
      sound.playClick();
      showToast(`💥 炮击准备模式已设定：${BARRAGE_MODES[b.dataset.mode].name}`);
      close();
      renderBarrageGauge(world, ui);
    };
  });
}

/* ============================================================
   二战
   ============================================================ */

/* §8.2 装备缺口红点：缺装备师数（按兵力/组织度低于满编 85% 估算缺编） */
export function countEquipDeficit(world){
  return world.units.filter(u => {
    if(u.nat !== world.player || u.hp <= 0) return false;
    const full = UNITS[u.type] || { hp: 100, org: 60 };
    return u.hp < full.hp * 0.85;
  }).length;
}

let _eqCache = { day: -1, n: 0 };
export function renderEquipDeficitBadge(world){
  if(_eqCache.day === world.day){ return _eqCache.n; }
  _eqCache.day = world.day;
  const host = document.getElementById('sf-prod') || document.querySelector('.sf-side-drawer');
  if(!host) return;
  const tab = [...document.querySelectorAll('.sf-drawer-tab-btn')].find(b => /工业|生产/.test(b.textContent));
  const n = countEquipDeficit(world);
  if(tab){
    let dot = tab.querySelector('.sf-deficit-dot');
    if(n > 0){
      if(!dot){
        dot = document.createElement('span');
        dot.className = 'sf-deficit-dot';
        tab.appendChild(dot);
      }
      dot.textContent = String(n);
      dot.title = `${n} 个师缺编（兵力 <85%），请补充装备`;
    } else if(dot) dot.remove();
  }
  _eqCache.n = n;
  return n;
}

/* §8.2 将领带「计划加成 %」角标 */
let _pbCache = { day: -1 };
export function renderPlanBonusBadges(world){
  if(_pbCache.day === world.day) return;
  _pbCache.day = world.day;
  const strip = document.getElementById('hud-generals-strip');
  if(!strip) return;
  const armies = (world.armies || []).filter(a => a.nat === world.player);
  strip.querySelectorAll('[data-general-id]').forEach(card => {
    const gid = card.dataset.generalId;
    const army = armies.find(a => a.generalId === gid);
    let badge = card.querySelector('.sf-plan-badge');
    if(army && army.planning > 0){
      if(!badge){
        badge = document.createElement('span');
        badge.className = 'sf-plan-badge';
        card.appendChild(badge);
      }
      badge.textContent = '+' + Math.round((army.planning || 0) * 100) + '%';
      badge.title = `作战计划加成 ${(army.planning * 100).toFixed(1)}%（执行中每日 -5%）`;
      badge.classList.toggle('executing', !!army.executing);
    } else if(badge) badge.remove();
  });
}

/* ============================================================
   冷战
   ============================================================ */

/* §8.3 双轨顶栏：下轨显示两极战略情报与 DEFCON 战备状态 */
export function renderRivalTrack(world){
  const sub = ensureEraSubtrack();
  if(!sub) return;
  sub.style.display = 'flex';

  const me = world.player;
  const rival = Object.keys(world.nations).find(id => id !== me && world.nations[id].alive !== false) || (me === 'SOV' ? 'USA' : 'SOV');
  const rn = world.nations[rival] || { name: (rival === 'USA' ? '美利坚合众国' : '苏维埃社会主义共和国联盟'), mil: 40, civ: 30 };
  const rDiv = world.units.filter(u => u.nat === rival && u.hp > 0).length;
  const mDiv = world.units.filter(u => u.nat === me && u.hp > 0).length;
  const rInf = rn.influence ? (rn.influence.USA ?? 0) + (rn.influence.SOV ?? 0) : 0;
  const rn_es = world.econSocial && world.econSocial.nations && world.econSocial.nations[rival];
  const prestige = rn_es ? rn_es.prestige : null;

  // 核态势与末日时钟
  const nuc = world.nuclear || { enabled: true, defcon: 5, doomsdayClock: 7.0 };
  const d = Math.max(1, Math.min(5, nuc.defcon || 5));
  const DEFCON_NAMES = { 5: '和平状态', 4: '情报戒备', 3: '空军动员', 2: '全面战备', 1: '核战爆发' };
  const dDesc = DEFCON_NAMES[d] || '戒备中';
  const doomsday = nuc.doomsdayClock != null ? (+nuc.doomsdayClock).toFixed(1) : '7.0';

    // v10.1 审查修复：签名缓存，避免每帧 innerHTML 重写造成布局抖动
  const rivalSig = world.day + ':' + world.player;
  if(sub.rivalSig === rivalSig) return;
  sub.rivalSig = rivalSig;
sub.innerHTML = `
    <div class="sf-era-subtrack-left">
      <div class="sf-rival-track" id="sf-rival-track" title="对手战略情报：根据谍报网络推算的假想敌实力与动向">
        <span class="sf-rt-tag">两极态势</span>
        <span class="sf-rt-label">对手</span>
        <b class="sf-rt-nat">${rn.name}</b>
        <span class="sf-rt-sep">｜</span>
        <span class="sf-rt-item">现役师 <b>${rDiv}</b> <span class="sf-rt-sub">(我方 ${mDiv})</span></span>
        <span class="sf-rt-sep">·</span>
        <span class="sf-rt-item">势力渗透 <b>${rInf}</b></span>
        ${prestige != null ? `<span class="sf-rt-sep">·</span><span class="sf-rt-item">声望 <b>${prestige}</b></span>` : ''}
        <span class="sf-rt-sep">·</span>
        <span class="sf-rt-item">工厂 <b>${(rn.mil || 0) + (rn.civ || 0)}</b></span>
      </div>
    </div>
    <div class="sf-era-subtrack-right">
      <div class="sf-defcon-pill" id="sf-defcon-pill" title="DEFCON 战备等级：5为和平常规，1为全面战略核交战。末日时钟反映核午夜距离。">
        <span class="sf-defcon-tag">战略战备</span>
        <span class="sf-defcon-level d${d}">DEFCON ${d}</span>
        <span class="sf-defcon-desc">${dDesc}</span>
        <span class="sf-rt-sep">｜</span>
        <span class="sf-doomsday-label">⏳ 末日之钟 <b>${doomsday}</b> 分钟到午夜</span>
      </div>
    </div>
  `;
}

/* §8.3 DEFCON 降级全屏红边闪烁 */
let lastDefcon = 5;
export function checkDefconFlash(world){
  const nuc = world.nuclear;
  if(!nuc || !nuc.enabled) return;
  const d = nuc.defcon || 5;
  if(d < lastDefcon){
    const fx = document.getElementById('sf-defcon-flash') || (() => {
      const el = document.createElement('div');
      el.id = 'sf-defcon-flash';
      document.body.appendChild(el);
      return el;
    })();
    fx.className = 'sf-defcon-flash on';
    fx.innerHTML = `<div class="sf-df-box">⚠ DEFCON 降级至 <b>${d}</b><br>
      <span>${d <= 2 ? '核冲突风险极高，任何误判都可能触发全面交换' : '危机升级，对手战备等级同步提升'}</span></div>`;
    try{ sound.playAttack(); }catch(_){}
    setTimeout(() => fx.classList.remove('on'), 2600);
  }
  lastDefcon = d;
}

/* §8.3 影响力投放面板：点击他国格 → 投放点数 / 政变 / 改组 三按钮（带成功率预估） */
export function openInfluencePanel(world, targetNat, ui){
  if(!targetNat || targetNat === world.player) return false;
  const tn = world.nations[targetNat];
  if(!tn) return false;
  const overlay = document.getElementById('sf-influence-panel') || (() => {
    const d = document.createElement('div');
    d.id = 'sf-influence-panel';
    d.className = 'sf-overlay sf-influence-panel';
    document.body.appendChild(d);
    return d;
  })();
  const inf = tn.influence || (tn.influence = { USA: 30, SOV: 30 });
  const me = world.player;
  const mine = inf[me] ?? 0;
  const rival = Object.keys(inf).find(k => k !== me);
  const rivalVal = rival ? (inf[rival] ?? 0) : 0;
  const es = world.econSocial && world.econSocial.nations && world.econSocial.nations[me];
  const intel = es ? es.intelPoints : 50;

  // 成功率：影响力越高越易；情报点越多越易
  const rate = (base, bonus) => Math.max(5, Math.min(95,
    Math.round(base + (mine - rivalVal) * 0.6 + Math.min(20, intel * 0.2) + bonus)));
  const rows = [
    { op:'invest',  name:'经济渗透',  cost:15, desc:'投入政治与经济资本，稳步提升影响力',
      p: Math.max(70, Math.min(99, 70 + Math.min(25, intel * 0.25))) },
    { op:'coup',    name:'策动政变',  cost:35, desc:'推翻亲对手政权，一次翻转立场',
      p: rate(18, 0) },
    { op:'realign', name:'阵营改组',  cost:28, desc:'逼迫该国退出对手阵营并倒向己方',
      p: rate(26, -6) }
  ];

  overlay.innerHTML = `
    <div class="sf-ip-box">
      <div class="sf-ip-head">
        <span class="sf-ip-flag" style="background:${tn.color}"></span>
        <b>${tn.name}</b><span class="sf-ip-sub">影响力投放面板</span>
        <button class="sf-ip-x" id="sf-ip-close">×</button>
      </div>
      <div class="sf-ip-bars">
        <div class="sf-ip-bar">
          <span>${world.nations[me].name}</span>
          <div class="sf-ip-track"><i style="width:${mine}%;background:#3b82f6"></i></div>
          <b>${mine}%</b>
        </div>
        <div class="sf-ip-bar">
          <span>${rival ? world.nations[rival].name : '对手'}</span>
          <div class="sf-ip-track"><i style="width:${rivalVal}%;background:#dc3c3c"></i></div>
          <b>${rivalVal}%</b>
        </div>
      </div>
      <div class="sf-ip-intel">情报点 <b>${intel}</b> · 行动成功率随影响力差与情报点提升</div>
      <div class="sf-ip-ops">
        ${rows.map(r => `<button class="sf-ip-op" data-op="${r.op}" data-cost="${r.cost}" data-p="${r.p}">
          <div class="sf-ip-op-name">${r.name}</div>
          <div class="sf-ip-op-cost">耗 ${r.cost} 情报点</div>
          <div class="sf-ip-op-rate ${r.p >= 60 ? 'good' : r.p >= 35 ? 'mid' : 'bad'}">成功率 ${r.p}%</div>
          <div class="sf-ip-op-desc">${r.desc}</div>
        </button>`).join('')}
      </div>
    </div>`;
  overlay.classList.add('on');
  const close = () => overlay.classList.remove('on');
  overlay.querySelector('#sf-ip-close').onclick = close;
  overlay.onclick = e => { if(e.target === overlay) close(); };
  overlay.querySelectorAll('[data-op]').forEach(b => {
    b.onclick = () => {
      const op = b.dataset.op;
      const cur = world.econSocial && world.econSocial.nations && world.econSocial.nations[me];
      if(cur && cur.intelPoints < +b.dataset.cost){
        showToast(`⚠️ 情报点不足：需要 ${b.dataset.cost}，当前 ${Math.round(cur.intelPoints)}`);
        return;
      }
      if(cur) cur.intelPoints -= +b.dataset.cost;
      let ok = true;
      if(op === 'invest') ok = investInfluence(world, me, targetNat, 15);
      else ok = conductCovertOp(world, me, targetNat, op, Math.random);
      sound.playClick();
      showToast(ok ? `🌐 ${b.querySelector('.sf-ip-op-name').textContent}已执行：目标 ${tn.name}`
                   : `⚠️ 行动失败：目标国内局势不允许该操作`);
      close();
      ui && ui.invalidate && ui.invalidate();
    };
  });
  return true;
}

/* ============================================================
   现代
   ============================================================ */

/* §8.4 声望条 + 疲劳条 */
export function renderPrestigeFatigue(world){
  const sub = ensureEraSubtrack();
  if(!sub) return;
  sub.style.display = 'flex';
  const es = world.econSocial && world.econSocial.nations && world.econSocial.nations[world.player];
  const prestige = es ? (es.prestige ?? 0) : 0;
  const fatigue = getWeariness(world, world.player);
    // v10.1 审查修复：签名缓存，避免每帧 innerHTML 重写造成布局抖动
  const pfSig = world.day + ':' + world.player;
  if(sub.pfSig === pfSig) return;
  sub.pfSig = pfSig;
sub.innerHTML = `
    <div class="sf-era-subtrack-left">
      <div class="sf-pf-bars" id="sf-prestige-bars">
        <span class="sf-rt-tag" style="background:rgba(59,130,246,0.25);border-color:#3b82f6;color:#93c5fd;">大国综合态势</span>
        <div class="sf-pf-row" title="国际声望：影响调停能力与盟友支援意愿">
          <span>声望</span>
          <div class="sf-pf-track"><i style="width:${Math.min(100, prestige)}%;background:linear-gradient(90deg,#60a5fa,#a78bfa)"></i></div>
          <b>${Math.round(prestige)}</b>
        </div>
        <div class="sf-pf-row ${fatigue >= 70 ? 'hot' : ''}" title="战争疲劳：≥70% 时国内支持度急剧下滑">
          <span>疲劳</span>
          <div class="sf-pf-track"><i style="width:${Math.min(100, fatigue)}%;background:${fatigue >= 70 ? 'linear-gradient(90deg,#f97316,#ef4444)' : 'linear-gradient(90deg,#eab308,#f97316)'}"></i></div>
          <b>${Math.round(fatigue)}</b>
        </div>
      </div>
    </div>
    <div class="sf-era-subtrack-right">
      <span class="sf-rt-item" style="color:#94a3b8;font-size:10.5px;">🛰️ 现代混合战争体系 · 全域战场感知连线中</span>
    </div>
  `;
}

/* §8.4 红线警告框：军援/打击触及对手红线时顶部弹红框（含三档反应预估） */
export function checkRedlineWarning(world, deltaLevel){
  if(!deltaLevel || deltaLevel <= 0) return;
  let el = document.getElementById('sf-redline-warn');
  if(!el){
    el = document.createElement('div');
    el.id = 'sf-redline-warn';
    document.body.appendChild(el);
  }
  const est = deltaLevel >= 3
    ? { t:'核威慑信号', d:'对手已提升战略力量战备等级，误判风险极高' }
    : deltaLevel === 2
      ? { t:'部分动员', d:'对手将在边境方向增兵并提高戒备' }
      : { t:'外交警告', d:'对手将发出严厉照会并在国际场合施压' };
  el.className = 'sf-redline-warn on';
  el.innerHTML = `
    <div class="sf-rl-head">⚠ 已触及对手红线 <span>升级等级 +${deltaLevel}</span>
      <button class="sf-rl-x" id="sf-rl-close">×</button></div>
    <div class="sf-rl-body">
      <div class="sf-rl-row"><span>预计反应</span><b>${est.t}</b></div>
      <div class="sf-rl-desc">${est.d}</div>
    </div>`;
  const close = () => el.classList.remove('on');
  el.querySelector('#sf-rl-close').onclick = close;
  setTimeout(close, 6000);
  try{ sound.playAttack(); }catch(_){}
}

/* §8.4 制裁网络面板：多选国家 → 一键组网（显示反噬预估） */
export function openSanctionPanel(world, ui){
  const overlay = document.getElementById('sf-sanction-panel') || (() => {
    const d = document.createElement('div');
    d.id = 'sf-sanction-panel';
    d.className = 'sf-overlay sf-sanction-panel';
    document.body.appendChild(d);
    return d;
  })();
  const targets = Object.keys(world.nations).filter(id => id !== world.player && world.nations[id].alive !== false);
  const active = (world.diplomacy && world.diplomacy.sanctions) || [];
  overlay.innerHTML = `
    <div class="sf-sp-box">
      <div class="sf-sp-head">制裁网络组网 <span>多选目标国 → 一键施加制裁包</span>
        <button class="sf-sp-x" id="sf-sp-close">×</button></div>
      <div class="sf-sp-pkgs">
        ${Object.entries(SANCTION_PACKAGES).map(([k, p]) => `
          <label class="sf-sp-pkg">
            <input type="radio" name="sp-pkg" value="${k}" ${k === 'heavy' ? 'checked' : ''}>
            <b>${p.name || k}</b><span>强度 ${sanctionSeverity(p)} · ${p.desc || ''}</span>
          </label>`).join('')}
      </div>
      <div class="sf-sp-targets">
        ${targets.map(id => {
          const n = world.nations[id];
          const hit = active.filter(s => s.to === id).length;
          return `<label class="sf-sp-target ${hit ? 'has' : ''}">
            <input type="checkbox" value="${id}">
            <span class="sf-sp-swatch" style="background:${n.color}"></span>
            <b>${n.name}</b>${hit ? `<i>S${hit}</i>` : ''}
          </label>`;
        }).join('')}
      </div>
      <div class="sf-sp-foot">
        <div class="sf-sp-backlash">反噬预估：<b id="sf-sp-bl">—</b></div>
        <button class="btn gold" id="sf-sp-apply">一键组网</button>
      </div>
    </div>`;
  overlay.classList.add('on');
  const close = () => overlay.classList.remove('on');
  overlay.querySelector('#sf-sp-close').onclick = close;
  overlay.onclick = e => { if(e.target === overlay) close(); };

  const updateBl = () => {
    const picked = [...overlay.querySelectorAll('.sf-sp-target input:checked')].map(i => i.value);
    const pkg = overlay.querySelector('input[name="sp-pkg"]:checked');
    const sev = sanctionSeverity(SANCTION_PACKAGES[pkg.value] || {});
    const trade = picked.reduce((s, id) => s + (world.nations[id].civ || 0), 0);
    const backlash = Math.round(picked.length * sev * 1.8 + trade * 0.15);
    overlay.querySelector('#sf-sp-bl').textContent =
      picked.length ? `${picked.length} 国 · 预计我方贸易损失 ${backlash} 装备点/月` : '—';
  };
  overlay.querySelectorAll('input').forEach(i => i.addEventListener('change', updateBl));
  overlay.querySelector('#sf-sp-apply').onclick = () => {
    const picked = [...overlay.querySelectorAll('.sf-sp-target input:checked')].map(i => i.value);
    const pkg = overlay.querySelector('input[name="sp-pkg"]:checked').value;
    if(!picked.length){ showToast('⚠️ 请先勾选至少一个目标国'); return; }
    let n = 0;
    for(const id of picked) if(imposeSanction(world, world.player, id, pkg)) n++;
    sound.playClick();
    showToast(n ? `🧾 制裁网络已组建：对 ${n} 国施加 ${SANCTION_PACKAGES[pkg].name || pkg}` : '⚠️ 制裁未生效');
    close();
    ui && ui.invalidate && ui.invalidate();
  };
  updateBl();
}

/* §8.4 军援管道面板：流量滑条 + 装备类型 + 暴露概率 */
export function openAidPanel(world, recipientNat, ui){
  if(!recipientNat || recipientNat === world.player) return false;
  const rn = world.nations[recipientNat];
  if(!rn) return false;
  const overlay = document.getElementById('sf-aid-panel') || (() => {
    const d = document.createElement('div');
    d.id = 'sf-aid-panel';
    d.className = 'sf-overlay sf-aid-panel';
    document.body.appendChild(d);
    return d;
  })();
  const pipes = (world.diplomacy && world.diplomacy.milAidPipes) || [];
  const existing = pipes.find(p => p.from === world.player && p.to === recipientNat);
  overlay.innerHTML = `
    <div class="sf-ap-box">
      <div class="sf-ap-head"><b>${rn.name}</b><span>军援管道</span>
        <button class="sf-ap-x" id="sf-ap-close">×</button></div>
      <div class="sf-ap-row"><label>月流量</label>
        <input type="range" id="sf-ap-flow" min="0" max="400" step="20" value="${existing ? existing.monthlyEquip : 120}">
        <b id="sf-ap-flowv">${existing ? existing.monthlyEquip : 120}</b> 装备点/月</div>
      <div class="sf-ap-row"><label>装备类型</label>
        <div class="sf-ap-pkgs">
          ${Object.entries(AID_PACKAGES).map(([k, p], i) => `
            <label class="sf-ap-pkg ${isRedline(p) ? 'redline' : ''}">
              <input type="radio" name="ap-pkg" value="${k}" ${i === 0 ? 'checked' : ''}>
              <b>${p.name || k}</b>${isRedline(p) ? '<i>红线</i>' : ''}
            </label>`).join('')}
        </div>
      </div>
      <div class="sf-ap-expose">暴露概率 <b id="sf-ap-exp">—</b></div>
      <div class="sf-ap-foot">
        <span>流量越大、装备越先进，越容易触及对手红线</span>
        <button class="btn gold" id="sf-ap-apply">建立/更新管道</button>
      </div>
    </div>`;
  overlay.classList.add('on');
  const close = () => overlay.classList.remove('on');
  overlay.querySelector('#sf-ap-close').onclick = close;
  overlay.onclick = e => { if(e.target === overlay) close(); };

  const calc = () => {
    const flow = +overlay.querySelector('#sf-ap-flow').value;
    const pkg = overlay.querySelector('input[name="ap-pkg"]:checked');
    const redline = isRedline(AID_PACKAGES[pkg.value] || {});
    // 暴露概率：流量 + 红线加成
    const exp = Math.min(98, Math.round(flow / 6 + (redline ? 35 : 0)));
    overlay.querySelector('#sf-ap-flowv').textContent = flow;
    overlay.querySelector('#sf-ap-exp').textContent = exp + '%' + (redline ? '（红线武器，显著提高升级风险）' : '');
    overlay.querySelector('#sf-ap-exp').className = exp >= 60 ? 'bad' : exp >= 30 ? 'mid' : 'good';
    return { flow, pkg: pkg.value, redline, exp };
  };
  overlay.querySelector('#sf-ap-flow').addEventListener('input', calc);
  overlay.querySelectorAll('input[name="ap-pkg"]').forEach(i => i.addEventListener('change', calc));
  calc();

  overlay.querySelector('#sf-ap-apply').onclick = () => {
    const cfg = calc();
    if(cfg.flow <= 0){
      const idx = pipes.findIndex(p => p.from === world.player && p.to === recipientNat);
      if(idx >= 0) pipes.splice(idx, 1);
      showToast('🚚 已停止对该国的军援管道');
      close();
      return;
    }
    const ok = sendAidPackage(world, world.player, recipientNat, cfg.pkg);
    if(ok){
      const p = pipes.find(x => x.from === world.player && x.to === recipientNat);
      if(p){ p.monthlyEquip = cfg.flow; p.redline = cfg.redline; }
      sound.playClick();
      showToast(`🚚 军援管道已建立：${rn.name} ← ${cfg.flow} 装备点/月${cfg.redline ? '（含红线武器）' : ''}`);
      if(cfg.redline) checkRedlineWarning(world, 2);
    } else {
      showToast('⚠️ 军援管道建立失败：该国外交立场不允许');
    }
    close();
    ui && ui.invalidate && ui.invalidate();
  };
  return true;
}

/* §8.4 升级管控面板：三档影响 AI 红线响应 */
export function openEscalationPanel(world, ui){
  const overlay = document.getElementById('sf-esc-panel') || (() => {
    const d = document.createElement('div');
    d.id = 'sf-esc-panel';
    d.className = 'sf-overlay sf-esc-panel';
    document.body.appendChild(d);
    return d;
  })();
  const cur = world.escalationMode || 'balanced';
  const TIERS = [
    { id:'restrained', name:'克制', desc:'压制援助规模与武器等级，最大化降低对手升级概率', p:20 },
    { id:'balanced',   name:'均衡', desc:'按当前战况动态调整，风险与收益折中', p:50 },
    { id:'aggressive', name:'激进', desc:'大规模高等级军援，最快改变战场态势但极易触发反击', p:82 }
  ];
  overlay.innerHTML = `
    <div class="sf-ep-box">
      <div class="sf-ep-head">升级管控档位 <span>影响对手红线响应概率</span>
        <button class="sf-ep-x" id="sf-ep-close">×</button></div>
      <div class="sf-ep-tiers">
        ${TIERS.map(t => `<button class="sf-ep-tier ${cur === t.id ? 'on' : ''}" data-tier="${t.id}">
          <div class="sf-ep-name">${t.name}</div>
          <div class="sf-ep-p ${t.p >= 70 ? 'bad' : t.p >= 35 ? 'mid' : 'good'}">升级概率 ${t.p}%</div>
          <div class="sf-ep-desc">${t.desc}</div>
        </button>`).join('')}
      </div>
    </div>`;
  overlay.classList.add('on');
  const close = () => overlay.classList.remove('on');
  overlay.querySelector('#sf-ep-close').onclick = close;
  overlay.onclick = e => { if(e.target === overlay) close(); };
  overlay.querySelectorAll('[data-tier]').forEach(b => {
    b.onclick = () => {
      world.escalationMode = b.dataset.tier;
      sound.playClick();
      showToast(`🎚️ 升级管控已切换至「${TIERS.find(t => t.id === b.dataset.tier).name}」档`);
      close();
    };
  });
}

/* ============================================================
   统一入口：按副本渲染对应 HUD
   ============================================================ */
export function renderEraHud(world, ui){
  if(!world) return;
  const sub = document.getElementById('sf-era-subtrack');
  switch(world.scenario){
    case 'ww1':
      renderWearinessBar(world);
      renderBarrageGauge(world, ui);
      break;
    case 'ww2':
      if(sub){ sub.style.display = 'none'; sub.innerHTML = ''; }
      renderEquipDeficitBadge(world);
      renderPlanBonusBadges(world);
      break;
    case 'coldwar':
      renderRivalTrack(world);
      checkDefconFlash(world);
      break;
    case 'modern':
      renderPrestigeFatigue(world);
      checkDefconFlash(world);
      break;
    default:
      if(sub){ sub.style.display = 'none'; sub.innerHTML = ''; }
      break;
  }
}

/* 地图点击派发：冷/现代专属面板 */
export function onHexClickEra(world, hex, ui){
  if(!world || !hex) return false;
  const owner = hex.owner;
  if(owner === world.player) return false;
  if(world.scenario === 'coldwar' && owner && world.nations[owner]){
    return openInfluencePanel(world, owner, ui);
  }
  if(world.scenario === 'modern' && owner && world.nations[owner]){
    return openAidPanel(world, owner, ui);
  }
  return false;
}
