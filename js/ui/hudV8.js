/* ============================================================
   ui/hudV8.js —— v8.0 M5 HUD 重构模块
   §6.1 顶栏三级分组 + 紧张度半圆表盘 + 可点击警报条
   §6.2/6.3 左右面板折叠（56px 图标条）
   §6.4 底部三段式（将领履历改上浮层）
   §6.5 迷你地图（220×140 预渲染 + 视口框 + 点击跳转 + M 键开关）
   §7   三级 Tooltip（L1 格 / L2 单位 / L3 指标，含日增量与边缘翻转）
   ============================================================ */

import { UNITS } from '../data/units.js';
import { TERRAIN } from '../data/terrain.js';
import { getUnitSupplyModifiers } from '../engine/logistics.js';
import { sound } from '../core/audio.js';
import { getHexWeather } from '../data/weather.js';
import { getMapSupplyHubs } from '../data/railways.js';
import { findProvinceAt } from '../core/geom.js';

const MINIMAP_W = 220, MINIMAP_H = 140;

/* 地形修正：数据里 1 = 无修正，转成 ±% 展示 */
function pct(v){
  const d = ((v ?? 1) - 1) * 100;
  return (d > 0 ? '+' : '') + d.toFixed(0) + '%';
}

/* ============================================================
   §6.1 紧张度半圆表盘
   ============================================================ */
const TENSION_ARC = 'M 6 40 A 34 34 0 0 1 74 40';   // 半圆弧路径

export function ensureTensionGauge(){
  let box = document.getElementById('hud-tension-gauge');
  if(box) return box;
  const host = document.getElementById('hud-tension-badge');
  if(!host) return null;
  host.innerHTML = `
    <div class="sf-tension-gauge" id="hud-tension-gauge">
      <svg viewBox="0 0 80 48" class="sf-tension-svg">
        <path d="M 6 40 A 34 34 0 0 1 74 40" fill="none" stroke="#2d3748" stroke-width="9" stroke-linecap="round"/>
        <path d="M 6 40 A 34 34 0 0 1 74 40" fill="none" stroke="#22c55e" stroke-width="9"
              stroke-linecap="round" stroke-dasharray="0 200" id="hud-tension-fill"/>
        <path d="M 52 40 A 34 34 0 0 1 74 40" fill="none" stroke="#ef4444" stroke-width="9"
              stroke-linecap="round" opacity="0.35" id="hud-tension-danger"/>
        <line id="hud-tension-needle" x1="40" y1="40" x2="40" y2="12"
              stroke="#ffd977" stroke-width="2.5" stroke-linecap="round"/>
        <circle cx="40" cy="40" r="4.5" fill="#b59247" stroke="#ffd977" stroke-width="1.5"/>
      </svg>
      <div class="sf-tension-readout">
        <span class="sf-tension-num" id="sf-tension">0%</span>
        <span class="sf-tension-cap">世界紧张度</span>
      </div>
    </div>`;
  return document.getElementById('hud-tension-gauge');
}

export function updateTensionGauge(store){
  const el = document.getElementById('hud-tension-fill');
  const nd = document.getElementById('hud-tension-needle');
  const num = document.getElementById('sf-tension');
  if(!el || !nd) return;
  const w = store.world;
  // world.tension = { value: 0-100, sources: [] }（见 engine/tension.js）
  const raw = (w.tension && typeof w.tension === 'object') ? w.tension.value : (w.tension ?? 0);
  const t = Math.max(0, Math.min(100, Number(raw) || 0));
  // 半圆弧长 = π × 34 ≈ 106.8
  const LEN = 106.8;
  el.setAttribute('stroke-dasharray', `${(t / 100 * LEN).toFixed(1)} 200`);
  el.setAttribute('stroke', t >= 75 ? '#ef4444' : t >= 50 ? '#f59e0b' : t >= 25 ? '#eab308' : '#22c55e');
  // 指针：180° → 0° 映射 0% → 100%
  const ang = Math.PI * (1 - t / 100);
  nd.setAttribute('x2', (40 + Math.cos(ang) * 28).toFixed(1));
  nd.setAttribute('y2', (40 - Math.sin(ang) * 28).toFixed(1));
  nd.setAttribute('stroke', t >= 75 ? '#ef4444' : '#ffd977');
  if(num) num.textContent = t.toFixed(0) + '%';
  const box = document.getElementById('hud-tension-gauge');
  if(box) box.classList.toggle('is-hot', t >= 75);
}

/* ============================================================
   §6.1 警报条（每条可点击定位）
   ============================================================ */
/* ============================================================
   §6.1 警报系统注册表（>=20 类，含三色光晕、点击定位、右键忽略、回收站恢复） [H]
   ============================================================ */
export const ALERT_COLLECTORS = [
  // 1) 组织度不足
  (w, n, mine) => {
    const lowOrg = mine.filter(u => u.org < (UNITS[u.type]?.org || 60) * 0.30);
    if(!lowOrg.length) return null;
    const u = lowOrg[0];
    return { key:'org', icon:'🩸', tone:'warn', halo:'sf-alert-halo-yellow',
             text:`${lowOrg.length} 个师组织度<30%`, q:u.q, r:u.r, unitId:u.id, dismissible:true };
  },
  // 2) 兵力严重缺编
  (w, n, mine) => {
    const lowHp = mine.filter(u => u.hp < (UNITS[u.type]?.hp || 100) * 0.60);
    if(!lowHp.length) return null;
    const u = lowHp[0];
    return { key:'hp', icon:'🚑', tone:'warn', halo:'sf-alert-halo-yellow',
             text:`${lowHp.length} 个师兵力<60%`, q:u.q, r:u.r, unitId:u.id, dismissible:true };
  },
  // 3) 断供部队
  (w, n, mine) => {
    const cut = mine.filter(u => getUnitSupplyModifiers(u).isCutoff);
    if(!cut.length) return null;
    const u = cut[0];
    return { key:'supply', icon:'⛽', tone:'bad', halo:'sf-alert-halo-red',
             text:`${cut.length} 个师已断供`, q:u.q, r:u.r, unitId:u.id, dismissible:true };
  },
  // 4) 前线缺口：己方领土与敌接壤却无驻军（v10.1：mineHexKeys O(1) 查询替代线性扫描）
  (w, n, mine, mineHexKeys) => {
    const atWar = n ? (n.atWarWith || []) : [];
    if(!atWar.length) return null;
    const gaps = w.hexes.filter(h => {
      if(h.owner !== w.player || h.terrain === 'sea') return false;
      const touchesEnemy = h.adj.some(i => atWar.includes(w.hexes[i]?.owner));
      if(!touchesEnemy) return false;
      return !mineHexKeys.has(h.q + ',' + h.r);
    });
    if(!gaps.length) return null;
    return { key:'gap', icon:'🕳️', tone:'bad', halo:'sf-alert-halo-red',
             text:`前线有 ${gaps.length} 处缺口`, q:gaps[0].q, r:gaps[0].r, dismissible:true };
  },
  // 5) 待处理国策
  (w, n) => {
    if(n && (!n.focus || n.focus.id == null) && (n.pp || 0) >= 30){
      return { key:'no_national_focus', icon:'📜', tone:'info', halo:'sf-alert-halo-green',
               text:'国策槽空闲，可立即选取', dismissible:true };
    }
    return null;
  },
  // 6) 训练完成待部署
  (w, n) => {
    const tq = (n && n.training) ? n.training.filter(t => t.done) : [];
    if(!tq.length) return null;
    return { key:'divisions_ready_deploy', icon:'🎖️', tone:'info', halo:'sf-alert-halo-green',
             text:`${tq.length} 个师训练完毕待部署`, dismissible:true };
  },
  // 7) 空军联队未分配任务
  (w, n) => {
    const wings = (w.airWings || []).filter(wg => wg.nat === w.player && (!wg.task || wg.task === 'none'));
    if(!wings.length) return null;
    return { key:'air_no_mission', icon:'✈️', tone:'warn', halo:'sf-alert-halo-yellow',
             text:`${wings.length} 个空军联队未指派任务`, dismissible:true };
  },
  // 8) 机场超容警告
  (w, n) => {
    const bases = (w.airBases || []).filter(b => b.nat === w.player && b.count > (b.capacity || 200));
    if(!bases.length) return null;
    return { key:'airport_overcrowded', icon:'🛫', tone:'bad', halo:'sf-alert-halo-red',
             text:`${bases.length} 个机场严重超容`, q:bases[0].q, r:bases[0].r, dismissible:true };
  },
  // 9) 海军舰队无任务
  (w, n) => {
    const fleets = (w.fleets || []).filter(fl => fl.nat === w.player && (!fl.task || fl.task === 'hold'));
    if(!fleets.length) return null;
    return { key:'navy_no_mission', icon:'⚓', tone:'warn', halo:'sf-alert-halo-yellow',
             text:`${fleets.length} 支舰队在港无任务`, dismissible:true };
  },
  // 10) 关键海区制海权失守
  (w, n) => {
    const lostZones = (w.seaZones || []).filter(sz => sz.disputed && sz.superiority?.[w.player] < 0.4);
    if(!lostZones.length) return null;
    return { key:'sea_zone_lost', icon:'🌊', tone:'bad', halo:'sf-alert-halo-red',
             text:`${lostZones.length} 处关键海区制海权不足`, dismissible:true };
  },
  // 11) 登陆准备就绪
  (w, n) => {
    const readyInvasions = (w.navalInvasions || []).filter(inv => inv.nat === w.player && inv.ready && !inv.executing);
    if(!readyInvasions.length) return null;
    return { key:'naval_invasion_ready', icon:'🏖️', tone:'info', halo:'sf-alert-halo-green',
             text:'两栖登陆作战准备完毕，可发起突击', dismissible:true };
  },
  // 12) 特工被捕
  (w, n) => {
    // v11.0 修复：特工挂在 world.agencies[nat].operatives，不是 world.operatives
    const ag = (w.agencies || {})[w.player];
    const captured = ((ag && ag.operatives) || []).filter(op => op.captured);
    if(!captured.length) return null;
    return { key:'operative_captured', icon:'🕵️', tone:'bad', halo:'sf-alert-halo-red',
             text:`${captured.length} 名情报特工在敌境被捕`, dismissible:true };
  },
  // 13) 情报行动就绪 / 密码破译
  (w, n) => {
    // v11.0 修复：破译记录在 world.agencies[nat].crackedCiphers，行动史在 operationHistory
    const ag = (w.agencies || {})[w.player] || {};
    const broken = Object.values(ag.crackedCiphers || {}).filter(c => c && (c.daysLeft || 0) > 0);
    const readyOps = (ag.operationHistory || []).filter(op => op && op.ready);
    if(!readyOps.length && !broken.length) return null;
    return { key:'intel_operation_ready', icon:'📻', tone:'info', halo:'sf-alert-halo-green',
             text: broken.length ? '敌国军事密码破译成功！' : `${readyOps.length} 项绝密情报行动就绪`, dismissible:true };
  },
  // 14) 学说经验充足待研发 (100 XP)
  (w, n) => {
    // v11.0：空军/海军经验池在引擎里不存在，只认陆军经验，避免永远不触发的死条件
    if(n && (n.armyXp || 0) >= 100){
      return { key:'doctrine_xp_available', icon:'📘', tone:'info', halo:'sf-alert-halo-green',
               text:'军事经验充足，可解锁新军种学说', dismissible:true };
    }
    return null;
  },
  // 15) 贸易路线遭破交/切断
  (w, n) => {
    const raided = (w.tradeRoutes || []).filter(tr => (tr.importer === w.player || tr.exporter === w.player) && tr.raided);
    if(!raided.length) return null;
    return { key:'trade_route_raided', icon:'🚢', tone:'bad', halo:'sf-alert-halo-red',
             text:`${raided.length} 条海上贸易线遭潜艇破交袭击`, dismissible:true };
  },
  // 16) 附庸自主度达到临界
  (w, n) => {
    // v11.0 修复：附属关系记在宗主国 n.subjects（id 数组）+ 附属国 n.autonomy
    if(!n || !Array.isArray(n.subjects) || !n.subjects.length) return null;
    const critical = n.subjects
      .map((id) => w.nations[id])
      .filter((sub) => sub && sub.alive && ((sub.autonomy || 0) >= 950 || (sub.autonomy || 0) <= 50));
    if(!critical.length) return null;
    return { key:'subject_autonomy_critical', icon:'👑', tone:'warn', halo:'sf-alert-halo-yellow',
             text:`${critical.length} 个附属国自主度达到升降临界`, dismissible:true };
  },
  // 17) 生产线空闲
  (w, n) => {
    if(!n) return null;
    const idleMil = n.mil > 0 && !(n.productionLines && n.productionLines.length > 0);
    if(idleMil){
      return { key:'factory_idle', icon:'🏭', tone:'warn', halo:'sf-alert-halo-yellow',
               text:'有军用工厂处于闲置无排产状态', dismissible:true };
    }
    return null;
  },
  // 18) 核心装备严重赤字
  (w, n) => {
    if(!n) return null;
    const def = (n._resourceDeficit && Object.values(n._resourceDeficit).some(v => v > 0)) || (n.equip < -50);
    if(def){
      return { key:'equipment_deficit', icon:'📦', tone:'bad', halo:'sf-alert-halo-red',
               text:'战略资源或主力装备陷入严重赤字', dismissible:true };
    }
    return null;
  },
  // 19) 补给枢纽受威胁
  (w, n) => {
    const atWar = n ? (n.atWarWith || []) : [];
    if(!atWar.length) return null;
    // v11.0 修复：枢纽是由城市派生的，读 world.supplyHubs 恒为空
    const depots = getMapSupplyHubs(w).filter(h => h.owner === w.player);
    const threatened = depots.filter(dh => {
      const hx = w.at[dh.q + ',' + dh.r];
      return hx && hx.adj.some(ni => atWar.includes(w.hexes[ni]?.owner));
    });
    if(!threatened.length) return null;
    return { key:'supply_depot_threatened', icon:'🛡️', tone:'bad', halo:'sf-alert-halo-red',
             text:`${threatened.length} 处后勤枢纽紧邻敌前线受威胁`, q:threatened[0].q, r:threatened[0].r, dismissible:true };
  },
  // 20) 指挥点数溢出
  (w, n) => {
    if(n && (n.commandPower != null ? n.commandPower : 100) >= 195){
      return { key:'command_power_overflow', icon:'🔭', tone:'warn', halo:'sf-alert-halo-yellow',
               text:'指挥点数即将达到 200 点上限', dismissible:true };
    }
    return null;
  },
  // 21) 核武可投放
  (w, n) => {
    // v11.0 修复：核弹头在 world.nuclear.arsenals[nat]，不是 n.nuclearStockpile
    const nuke = (w.nuclear && w.nuclear.arsenals && w.nuclear.arsenals[w.player]) || 0;
    if(nuke > 0){
      return { key:'nuke_ready', icon:'☢️', tone:'warn', halo:'sf-alert-halo-yellow',
               text:`${nuke} 枚战略核弹头已装配就绪`, dismissible:true };
    }
    return null;
  },
  // 22) DEFCON 危机降级
  (w, n) => {
    // v11.0 修复：战备等级在 world.nuclear.defcon，不是 world.defcon
    const defcon = w.nuclear && w.nuclear.defcon;
    if(defcon && defcon <= 2){
      return { key:'defcon_alert', icon:'🚨', tone:'bad', halo:'sf-alert-halo-red',
               text:`DEFCON ${defcon} 核战争迫在眉睫`, dismissible:true };
    }
    return null;
  },
  // 23) 现代红线告警
  (w, n) => {
    // v11.0 修复：红线计量是 world.milAid.escalationGauge（0~100），不是 world.redlines
    const gauge = w.milAid && w.milAid.escalationGauge;
    if(typeof gauge === 'number' && gauge >= 80){
      return { key:'redline_violation', icon:'⛔', tone:'bad', halo:'sf-alert-halo-red',
               text:`战略安全红线已遭突破（危机指数 ${Math.round(gauge)}%）`, dismissible:true };
    }
    return null;
  },
  // 24) 科研空闲
  (w, n) => {
    // v11.0 修复：科研槽是 n.research.slots（数组，空槽为 null）
    const slots = n && n.research && n.research.slots;
    if(n && Array.isArray(slots) && slots.length && slots.every(sl => !sl)){
      return { key:'research_completed', icon:'🔬', tone:'info', halo:'sf-alert-halo-green',
               text:'科研机构空置，可启动新科技研发', dismissible:true };
    }
    return null;
  }
];

/* v10.1 审查修复：collectAlerts 按天缓存。
   本函数每帧被 renderAlertBar 调用，其中"前线缺口"收集器要全图扫描 416 格
   并在单元检查里做 world.units.find 线性扫描 —— 实测每帧 5~7ms。
   警报集合至多每日变化一次，按 (day, units 数组引用) 失标即可。 */
let _alertCache = { day: -1, src: null, alerts: [] };
export function collectAlerts(world){
  if(_alertCache.day === world.day && _alertCache.src === world.units){
    return _alertCache.alerts;
  }
  const out = [];
  const n = world.nations[world.player];
  const mine = world.units.filter(u => u.nat === world.player && u.hp > 0);
  const mineHexKeys = new Set(mine.map(u => u.q + ',' + u.r));   // O(1) 驻军查询
  for(const collector of ALERT_COLLECTORS){
    try {
      const item = collector(world, n, mine, mineHexKeys);
      if(item) out.push(item);
    } catch(e){}
  }
  _alertCache = { day: world.day, src: world.units, alerts: out };
  return out;
}

export function renderAlertBar(store, cam, ui){
  const bar = document.getElementById('sf-alertbar');
  if(!bar) return;
  ui.dismissedAlerts = ui.dismissedAlerts || new Set();

  const allAlerts = collectAlerts(store.world);
  const activeAlerts = allAlerts.filter(a => !ui.dismissedAlerts.has(a.key));
  const dismissedCount = ui.dismissedAlerts.size;

  const sig = activeAlerts.map(a => a.key + a.text).join('|') + '#d:' + dismissedCount;
  if(bar._sig === sig) return;
  bar._sig = sig;

  // v9.5 U2：整条态势带显隐 = 有警报 或 副本态势 chips 可见
  const sub = document.getElementById('sf-era-subtrack');
  const band = document.getElementById('sf-statusband');
  const bandOn = activeAlerts.length > 0 || dismissedCount > 0 ||
                 !!(sub && sub.style.display !== 'none' && sub.innerHTML);
  if(band) band.classList.toggle('on', bandOn);

  if(!activeAlerts.length && dismissedCount === 0){
    bar.classList.remove('on');
    bar.innerHTML = '';
    return;
  }
  bar.classList.add('on');

  // v9.5 U3(P1-4)：lead 颜色随当前最高严重度；全 info 时降为蓝色「统帅部备忘」
  const sevRank = { bad: 3, warn: 2, info: 1 };
  const maxSev = activeAlerts.reduce((m, a) => Math.max(m, sevRank[a.tone || 'warn']), 0);
  const leadCls = maxSev >= 3 ? 'bad' : maxSev === 2 ? 'warn' : 'info';
  const leadTxt = maxSev >= 2 ? '⚠ 统帅部警报' : '💡 统帅部备忘';
  let html = `<span class="sf-alert-lead ${leadCls}">${leadTxt}</span>`;
  html += activeAlerts.map(a =>
    `<button class="sf-alert ${a.tone || 'warn'} ${a.halo || ''}" data-alert="${a.key}"
       data-q="${a.q ?? ''}" data-r="${a.r ?? ''}" data-unit="${a.unitId ?? ''}"
       title="左键点击定位目标 · 右键忽略此警报">
       <span class="sf-alert-ico">${a.icon}</span>${a.text}
     </button>`).join('');

  if(dismissedCount > 0){
    html += `<button class="sf-alert-recycle" id="sf-alert-recycle-btn" title="点击恢复所有已被忽略的警报">♻️ 恢复已忽略 (${dismissedCount})</button>`;
  }
  bar.innerHTML = html;

  if(!bar._bound){
    bar._bound = true;
    // 左键点击定位
    bar.addEventListener('click', e => {
      const rec = e.target.closest('#sf-alert-recycle-btn');
      if(rec){
        ui.dismissedAlerts.clear();
        sound.playClick();
        const dlg = document.getElementById('sf-toast');
        if(dlg){
          dlg.textContent = '♻️ 已恢复所有被忽略的战报警报';
          dlg.classList.add('on');
          clearTimeout(dlg._timer);
          dlg._timer = setTimeout(() => dlg.classList.remove('on'), 1600);
        }
        renderAlertBar(store, cam, ui);
        return;
      }
      const btn = e.target.closest('[data-alert]');
      if(!btn) return;
      const alertKey = btn.dataset.alert;

      // 空军相关警报直接打开左侧空军统帅部抽屉
      if(alertKey === 'air_no_mission' || alertKey === 'airport_overcrowded'){
        sound.playClick();
        const drawer = document.getElementById('sf-side-drawer');
        if(drawer) drawer.classList.remove('collapsed');
        const airBtn = document.querySelector('.sf-drawer-tab-btn[data-tab="air"]');
        if(airBtn) airBtn.click();
      }

      // 海军相关警报直接打开左侧海军统帅部抽屉
      if(alertKey === 'navy_no_mission' || alertKey === 'sea_zone_lost'){
        sound.playClick();
        const drawer = document.getElementById('sf-side-drawer');
        if(drawer) drawer.classList.remove('collapsed');
        const navyBtn = document.querySelector('.sf-drawer-tab-btn[data-tab="navy"]');
        if(navyBtn) navyBtn.click();
      }

      const q = Number(btn.dataset.q), r = Number(btn.dataset.r);
      if(!Number.isNaN(q) && !Number.isNaN(r)){
        sound.playClick();
        // 定位：把该格移到视口中心
        const p = cam.toPix(q, r);
        const cv = document.getElementById('sfmap');
        if(cv){
          cam.x = cv.clientWidth / 2 - p.x;
          cam.y = cv.clientHeight / 2 - p.y;
        }
      }
      const uid = Number(btn.dataset.unit);
      if(uid && ui && ui.selUnits){
        const u = store.world.units.find(x => x.id === uid);
        if(u){ ui.selHex = { q: u.q, r: u.r }; ui.selUnits = [u.id]; }
      }
      ui && ui.onSelect && ui.onSelect();
      ui && ui.invalidate && ui.invalidate();
      const dlg = document.getElementById('sf-toast');
      if(dlg){
        dlg.textContent = '📍 已定位：' + btn.textContent.trim();
        dlg.classList.add('on');
        clearTimeout(dlg._timer);
        dlg._timer = setTimeout(() => dlg.classList.remove('on'), 1600);
      }
    });

    // 右键忽略警报 [H]
    bar.addEventListener('contextmenu', e => {
      const btn = e.target.closest('[data-alert]');
      if(!btn) return;
      e.preventDefault();
      const key = btn.dataset.alert;
      if(key){
        ui.dismissedAlerts.add(key);
        sound.playClick();
        const dlg = document.getElementById('sf-toast');
        if(dlg){
          dlg.textContent = '🔕 已暂时忽略该警报（可点击回收站随时恢复）';
          dlg.classList.add('on');
          clearTimeout(dlg._timer);
          dlg._timer = setTimeout(() => dlg.classList.remove('on'), 1600);
        }
        renderAlertBar(store, cam, ui);
      }
    });
  }
}

/* ============================================================
   §6.2/6.3 面板折叠（56px 图标条）
   ============================================================ */
export function bindPanelCollapse(cam){
  const app = document.getElementById('sf-app');
  if(!app) return;

  const mkBtn = (id, side, glyphs, titles, tabIds) => {
    const el = document.getElementById(id);
    if(!el || el._bound) return;
    el._bound = true;
    el.innerHTML = glyphs.map((g, i) =>
      `<button class="sf-rail-btn" data-rail="${side}" data-idx="${i}" title="${titles[i]}">${g}</button>`).join('')
      + `<button class="sf-rail-toggle" data-rail-toggle="${side}" title="展开面板">»</button>`;
    el.addEventListener('click', e => {
      const t = e.target.closest('[data-rail-toggle]');
      if(t){
        sound.playClick();
        app.classList.remove('collapsed-' + side);
        resized && resized();
        return;
      }
      const b = e.target.closest('[data-rail]');
      if(!b) return;
      sound.playClick();
      // 展开面板并激活对应页签
      // v14.1 E4：左右轨都按页签 id 绑定。旧实现按 DOM 序号索引，
      // 左抽屉页签增补后「科研」按钮错点成「空军战区」，右轨则因
      // 右面板没有 .sf-drawer-tab-btn 而 tabs=[] 点击无事发生。
      app.classList.remove('collapsed-' + side);
      const idx = +b.dataset.idx;
      const tabId = tabIds && tabIds[idx];
      const tab = tabId
        ? document.querySelector(side === 'left'
            ? `.sf-drawer-tab-btn[data-tab="${tabId}"]`
            : `.sf-info-tab-btn[data-info-tab="${tabId}"]`)
        : null;
      if(tab) tab.click();
      resized && resized();
    });
  };

  mkBtn('sf-rail-left', 'left', ['🏭','🎖️','📋','🔬'], ['工业流水线','部队招募','训练队列','科研'],
        ['prod','recruit','queue','research']);
  mkBtn('sf-rail-right', 'right', ['📋','📐','📊'], ['战区情报','地形修正','驻防名册'],
        ['theater','terrain','garrison']);

  const btns = [
    ['sf-collapse-left', 'left', '«', '折叠左侧军工抽屉 (56px 图标条)'],
    ['sf-collapse-right', 'right', '»', '折叠右侧情报面板 (56px 图标条)']
  ];
  for(const [id, side, glyph, title] of btns){
    const b = document.getElementById(id);
    if(!b || b._bound) continue;
    b._bound = true;
    b.title = title;
    b.textContent = glyph;
    b.addEventListener('click', () => {
      sound.playClick();
      app.classList.toggle('collapsed-' + side);
      resized && resized();
    });
  }

  let resized = null;
  if(cam){
    resized = () => {
      // 画布尺寸变化后重算缓冲区
      window.dispatchEvent(new Event('resize'));
    };
  }
}

/* 折叠后地图区宽度占比（供验收测量） */
export function mapWidthRatio(){
  const main = document.querySelector('.sf-main');
  const map = document.querySelector('.sf-mapwrap');
  if(!main || !map) return 0;
  const mw = main.getBoundingClientRect().width;
  const mapw = map.getBoundingClientRect().width;
  return mw ? mapw / mw : 0;
}

/* ============================================================
   §6.5 迷你地图
   ============================================================ */
export class Minimap {
  constructor(store, cam, ui){
    this.store = store; this.cam = cam; this.ui = ui;
    this.visible = false;
    this.buf = document.createElement('canvas');   // 离屏预渲染
    this.buf.width = MINIMAP_W; this.buf.height = MINIMAP_H;
    this.dirty = true;
    this._drag = false;

    const host = document.getElementById('sf-minimap');
    if(!host) return;
    host.innerHTML = `
      <canvas id="sf-minimap-canvas" width="${MINIMAP_W}" height="${MINIMAP_H}"></canvas>
      <div class="sf-minimap-tools">
        <span class="sf-minimap-title">战役态势图</span>
        <button class="sf-minimap-x" id="sf-minimap-close" title="关闭 [M]">×</button>
      </div>`;
    this.canvas = document.getElementById('sf-minimap-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.host = host;

    host.addEventListener('mousedown', e => { this._drag = true; this._apply(e); });
    host.addEventListener('mousemove', e => { if(this._drag) this._apply(e); });
    window.addEventListener('mouseup', () => { this._drag = false; });
    host.addEventListener('wheel', e => {
      e.preventDefault();
      this.cam.zoomAt(this.cam.canvas ? this.cam.canvas.clientWidth / 2 : 300,
                       this.cam.canvas ? this.cam.canvas.clientHeight / 2 : 200,
                       e.deltaY < 0 ? 1.15 : 0.87);
      this.ui && this.ui.invalidate && this.ui.invalidate();
    }, { passive: false });
    const x = document.getElementById('sf-minimap-close');
    if(x) x.addEventListener('click', () => this.toggle(false));
  }

  toggle(force){
    this.visible = (force === undefined) ? !this.visible : !!force;
    if(this.host) this.host.classList.toggle('on', this.visible);
    if(this.visible) this.dirty = true;
    window.dispatchEvent(new Event('resize'));
  }

  /* 世界坐标 → 迷你地图像素 */
  _transform(){
    const wb = this._worldBounds();
    const pad = 3;
    const sx = (MINIMAP_W - pad * 2) / wb.w;
    const sy = (MINIMAP_H - pad * 2) / wb.h;
    const s = Math.min(sx, sy);
    return { wb, s, ox: pad + ((MINIMAP_W - pad * 2) - wb.w * s) / 2,
             oy: pad + ((MINIMAP_H - pad * 2) - wb.h * s) / 2 };
  }

  _worldBounds(){ return wbOf(this.store.world, this.cam.size); }

  /* 归属变更时调用 */
  invalidate(){ this.dirty = true; }

  prerender(){
    const ctx = this.buf.getContext('2d');
    const w = this.store.world;
    const S = this.cam.size;
    const wb = wbOf(w, S);
    const t = { wb, s: 0, ox: 0, oy: 0 };
    {
      const pad = 3;
      const s = Math.min((MINIMAP_W - pad * 2) / wb.w, (MINIMAP_H - pad * 2) / wb.h);
      t.s = s;
      t.ox = pad + ((MINIMAP_W - pad * 2) - wb.w * s) / 2;
      t.oy = pad + ((MINIMAP_H - pad * 2) - wb.h * s) / 2;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, MINIMAP_W, MINIMAP_H);
    ctx.fillStyle = '#0a0f16';
    ctx.fillRect(0, 0, MINIMAP_W, MINIMAP_H);

    const R = Math.max(1.6, S * t.s * 0.62);
    // 领土色块
    for(const h of w.hexes){
      const x = t.ox + (wpX(h, S) - wb.x) * t.s;
      const y = t.oy + (wpY(h, S) - wb.y) * t.s;
      const nat = w.nations[h.owner];
      ctx.fillStyle = h.terrain === 'sea' ? '#12212f' : (nat ? nat.color : '#3a4453');
      ctx.fillRect(x - R, y - R, R * 2, R * 2);
    }
    // 玩家领土描边（仅边境格）
    ctx.strokeStyle = '#ffd977';
    ctx.lineWidth = 1;
    for(const h of w.hexes){
      if(h.owner !== w.player) continue;
      if(!h.adj.some(i => w.hexes[i].owner !== w.player)) continue;
      const x = t.ox + (wpX(h, S) - wb.x) * t.s;
      const y = t.oy + (wpY(h, S) - wb.y) * t.s;
      ctx.strokeRect(x - R, y - R, R * 2, R * 2);
    }
    this.dirty = false;
  }

  draw(){
    if(!this.visible || !this.ctx) return;
    if(this.dirty) this.prerender();
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, MINIMAP_W, MINIMAP_H);
    ctx.drawImage(this.buf, 0, 0);

    // 主视口框
    const t = this._transform();
    const cv = document.getElementById('sfmap');
    if(cv){
      const vx = this.cam.x, vy = this.cam.y;
      const vw = cv.clientWidth, vh = cv.clientHeight;
      const wb = t.wb;
      // 屏幕 → 世界 → 迷你
      const wx0 = (0 - vx) / this.cam.z, wy0 = (0 - vy) / this.cam.z;
      const x0 = t.ox + (wx0 - wb.x) * t.s;
      const y0 = t.oy + (wy0 - wb.y) * t.s;
      const rw = (vw / this.cam.z) * t.s;
      const rh = (vh / this.cam.z) * t.s;
      ctx.strokeStyle = 'rgba(255,255,255,0.92)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x0, y0, rw, rh);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(x0, y0, rw, rh);
    }
  }

  _apply(e){
    const r = this.host.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const t = this._transform();
    // 迷你 → 世界
    const wx = (mx - t.ox) / t.s + t.wb.x;
    const wy = (my - t.oy) / t.s + t.wb.y;
    // 世界 → 屏幕（居中）
    const cv = document.getElementById('sfmap');
    if(!cv) return;
    this.cam.x = cv.clientWidth / 2 - wx * this.cam.z;
    this.cam.y = cv.clientHeight / 2 - wy * this.cam.z;
    this.ui && this.ui.invalidate && this.ui.invalidate();
  }
}

/* 小工具：世界像素边界与格中心（供 Minimap 复用，避免逐格重算） */
function wpX(h, S){ return S * Math.sqrt(3) * (h.q + 0.5 * (h.r & 1)); }
function wpY(h, S){ return S * 1.5 * h.r; }

function wbOf(w, S){
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for(const h of w.hexes){
    const x = wpX(h, S), y = wpY(h, S);
    if(x < minX) minX = x;
    if(y < minY) minY = y;
    if(x > maxX) maxX = x;
    if(y > maxY) maxY = y;
  }
  return { x: minX - S, y: minY - S, w: (maxX - minX) + S * 2, h: (maxY - minY) + S * 2 };
}

/* ============================================================
   §7 三级 Tooltip
   ============================================================ */
export class TooltipSystem {
  constructor(store, cam, ui){
    this.store = store; this.cam = cam; this.ui = ui;
    this.el = document.getElementById('sf-tooltip');
    if(!this.el){
      this.el = document.createElement('div');
      this.el.id = 'sf-tooltip';
      document.body.appendChild(this.el);
    }
    this.timer = null;
    this.cur = null;      // { key, level }
    this.canvas = document.getElementById('sfmap');

    // L1 格级 / L2 单位级：canvas 悬停
    this.canvas.addEventListener('mousemove', e => {
      const r = this.canvas.getBoundingClientRect();
      this._mouse = { x: e.clientX, y: e.clientY, lx: e.clientX - r.left, ly: e.clientY - r.top };
      this._scheduleCanvasTip();
    });
    this.canvas.addEventListener('mouseleave', () => this.hide());

    // L3 指标级：顶栏指标悬停
    document.querySelectorAll('[data-tip]').forEach(el => {
      el.addEventListener('mouseenter', ev => {
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.showMetric(el.dataset.tip, el), 300);
      });
      el.addEventListener('mouseleave', () => { clearTimeout(this.timer); this.hide(); });
    });
  }

  _scheduleCanvasTip(){
    clearTimeout(this.timer);
    const m = this._mouse;
    if(!m) return;
    this.timer = setTimeout(() => {
      const h = findProvinceAt(this.store.world, this.cam, m.lx, m.ly) || (() => {
        const { q, r } = this.cam.toHex(m.lx, m.ly);
        return this.store.world.at[q + ',' + r];
      })();
      if(!h) return;
      // 优先单位级（鼠标压在某师兵牌上）
      const unit = this._unitUnderCursor(m.lx, m.ly, h);
      if(unit) this.showUnit(unit, m);
      else this.showHex(h, m);
    }, 200);
  }

  /* 命中测试：兵牌是方框，落在其内即视为悬停单位
     v12.0 M5 (C46)：显示层是单张封面兵牌 + ×N 角标 → 命中区域即那张卡，
     命中返回堆内 hp+org 最高的封面师（与渲染排序同源）；
     堆内全部师由 L1 省份情报舱的「驻守编成」列表下钻。 */
  _unitUnderCursor(lx, ly, h){
    const mine = (h.units || []).map(id => this.store.world.units.find(u => u.id === id))
      .filter(u => u && u.hp > 0);
    if(!mine.length) return null;
    const p = this.cam.toPix(h.q, h.r);
    const z = this.cam.z;
    const bw = Math.max(13, 26 * z), bh = Math.max(9, 17 * z);
    if(Math.abs(lx - p.x) <= bw / 2 + 2 && Math.abs(ly - p.y) <= bh / 2 + 2){
      return [...mine].sort((a, b) => (b.hp + b.org) - (a.hp + a.org))[0];
    }
    return null;
  }

  hide(){
    this.el.classList.remove('on');
    this.cur = null;
  }

  _place(mx, my){
    const el = this.el;
    el.classList.add('on');
    const w = el.offsetWidth, h = el.offsetHeight;
    const vw = window.innerWidth, vh = window.innerHeight;
    let x = mx + 16, y = my + 16;
    // 边缘翻转
    if(x + w > vw - 8) x = mx - w - 16;
    if(y + h > vh - 8) y = my - h - 16;
    x = Math.max(6, Math.min(x, vw - w - 6));
    y = Math.max(6, Math.min(y, vh - h - 6));
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.classList.toggle('flip-x', x + w > vw - 40);
  }

  /* L1：省份战术情报舱（Province Tactical Dossier HUD） */
  showHex(h, m){
    const w = this.store.world;
    const owner = w.nations[h.owner];
    const ter = TERRAIN[h.terrain] || {};
    const gar = (h.units || []).map(id => w.units.find(u => u.id === id))
      .filter(u => u && u.hp > 0)
      .sort((a, b) => (b.hp + b.org) - (a.hp + a.org));   // v12.0 M5：与兵牌封面排序同源
    const key = 'hex:' + h.idx;
    if(this.cur === key) return;
    this.cur = key;
    this.el.className = 'lv1';

    const weather = getHexWeather(w, h);
    const weatherText = {
      'clear': '☀️ 晴朗 · 良好机动',
      'snow': '❄️ 极寒深雪 · 航速 -30%',
      'mud': '🌧️ 深秋翻浆 · 航速 -50%'
    }[weather] || '☀️ 良好';

    const fortLvl = h.fort || 0;
    const fortStr = fortLvl > 0 ? `🛡️ 永固工事 Lv.${fortLvl} (+${fortLvl * 15}%防)` : '无工事';

    const hubs = getMapSupplyHubs(w);
    const isNearHub = hubs.some(hub => Math.hypot(hub.q - h.q, hub.r - h.r) <= 3);
    const supplyStr = isNearHub ? '🟢 畅通 (枢纽辐射 95%)' : '🟡 一般 (公路辐射 75%)';

    const typeNames = { 'inf':'步兵师', 'tank':'装甲师', 'mot':'摩托化师', 'mech':'机械化师', 'mount':'山地师', 'cav':'骑兵师', 'marine':'陆战师', 'para':'伞兵师' };

    let garHtml = '';
    if(gar.length > 0){
      garHtml = `
        <div style="margin-top:6px;padding-top:4px;border-top:1px dashed #334155;">
          <div style="display:flex;justify-content:space-between;font-size:10px;color:#b59247;font-weight:700;margin-bottom:3px;">
            <span>驻守编成 (${gar.length} 师)</span>
            <span>HP / 组织度</span>
          </div>
          ${gar.slice(0, 4).map(u => {
            const uName = u.name || (typeNames[u.type] || u.type || '主力师');
            const disp = uName.length > 8 ? uName.slice(0, 7) + '…' : uName;
            const hpPct = Math.min(100, Math.max(0, Math.round(u.hp <= 1.05 ? u.hp * 100 : u.hp)));
            const orgPct = Math.min(100, Math.max(0, Math.round((u.org || 1) <= 1.05 ? (u.org || 1) * 100 : (u.org || 100))));
            return `
            <div style="display:flex;align-items:center;justify-content:space-between;font-size:10px;background:rgba(255,255,255,0.04);padding:2px 4px;border-radius:2px;margin-bottom:2px;">
              <span title="${uName}">${disp}</span>
              <div style="display:flex;gap:3px;align-items:center;">
                <div style="width:20px;height:4px;background:#000;border-radius:2px;overflow:hidden;"><div style="width:${hpPct}%;height:100%;background:#22c55e;"></div></div>
                <div style="width:20px;height:4px;background:#000;border-radius:2px;overflow:hidden;"><div style="width:${orgPct}%;height:100%;background:#eab308;"></div></div>
              </div>
            </div>`;
          }).join('')}
          ${gar.length > 4 ? `<div style="font-size:9px;color:#94a3b8;text-align:right;">+ 其余 ${gar.length - 4} 师</div>` : ''}
        </div>`;
    }

    this.el.innerHTML = `
      <div class="tt-head"><b>${h.name || (h.city ? h.city.name : `第 ${h.idx} 防区`)}${h.city && h.city.cap ? ' ★首都' : ''}</b>
        <span class="tt-owner" style="color:${owner ? owner.color : '#888'}">${owner ? owner.name : '中立'}</span></div>
      <div class="tt-row"><span>地形环境</span><b>${ter.name || h.terrain} (防 ${pct(ter.def)} / 攻 ${pct(ter.atk)})</b></div>
      <div class="tt-row"><span>地表气象</span><b>${weatherText}</b></div>
      <div class="tt-row"><span>要塞工事</span><b>${fortStr}</b></div>
      <div class="tt-row"><span>后勤补给</span><b>${supplyStr}</b></div>
      ${h.city ? `<div class="tt-row"><span>胜利点</span><b>${h.city.vp ?? h.city.w ?? 0} VP</b></div>` : ''}
      ${garHtml}
      <div class="tt-hint">右键机动开进/协同突击 · 双击全选驻防师</div>`;
    this._place(m.x, m.y);
  }

  /* L2：单位级中卡（300px） */
  showUnit(u, m){
    const w = this.store.world;
    const key = 'unit:' + u.id;
    const f = UNITS[u.type] || {};
    const sup = getUnitSupplyModifiers(u);
    const gen = (w.armies || []).find(a => (a.divisions || []).includes(u.id));
    const cmd = u.order
      ? (u.order.type === 'attack' ? '进攻 ' + u.order.target :
         u.order.type === 'advance' ? '推进 ' + u.order.dest :
         u.order.type === 'support' ? '支援射击 ' + u.order.target : u.order.type)
      : '待命';
    // 数值缓存 1 秒用于日增量
    this._delta = this._delta || {};
    const prev = this._delta[key];
    const now = Date.now();
    let orgDelta = null;
    if(prev && now - prev.t < 1200) orgDelta = u.org - prev.org;
    if(!prev || now - prev.t > 800) this._delta[key] = { org: u.org, hp: u.hp, t: now };

    if(this.cur === key + ':' + Math.round(u.org)) return;
    this.cur = key + ':' + Math.round(u.org);
    this.el.className = 'lv2';
    const arrow = v => v == null || v === 0 ? '' :
      `<em class="${v > 0 ? 'up' : 'down'}">${v > 0 ? '↑+' : '↓'}${v}</em>`;
    this.el.innerHTML = `
      <div class="tt-head"><b>${u.nat} 第 ${u.id} 师</b><span class="tt-owner">${f.name || u.type}</span></div>
      <div class="tt-grid">
        <div><span>组织度</span><b>${u.org.toFixed(0)} / ${f.org || '—'}</b>${arrow(orgDelta)}</div>
        <div><span>兵力</span><b>${u.hp.toFixed(0)} / ${f.hp || '—'}</b></div>
        <div><span>战宽</span><b>${f.width ?? '—'}</b></div>
        <div><span>软攻/硬攻</span><b>${f.soft ?? '—'} / ${f.hard ?? '—'}</b></div>
        <div><span>经验等级</span><b>Lv${u.level || 1} (${u.exp || 0}%)</b></div>
        <div><span>壕沟</span><b>${((u.entrench || 0) * 100).toFixed(0)}%</b></div>
      </div>
      <div class="tt-row"><span>当前命令</span><b>${cmd}</b></div>
      <div class="tt-row"><span>所属将领</span><b>${gen ? (gen.name || gen.id) : '未编入'}</b></div>
      <div class="tt-row"><span>补给状态</span><b class="${sup.isCutoff ? 'bad' : 'ok'}">${sup.isCutoff ? '已断供 ' + sup.outOfSupplyDays + ' 天' : '正常'}</b></div>`;
    this._place(m.x, m.y);
  }

  /* L3：指标级大卡（380px，含日增量与分解） */
  showMetric(kind, anchor){
    const w = this.store.world;
    const n = w.nations[w.player];
    const key = 'metric:' + kind;
    this._mdelta = this._mdelta || {};
    const snap = {
      pp: n.pp, stab: n.stability, war: n.warSupport, civ: n.civ, mil: n.mil,
      equip: n.equip, div: w.units.filter(u => u.nat === w.player && u.hp > 0).length,
      tension: (w.tension && typeof w.tension === 'object') ? (w.tension.value || 0) : (w.tension ?? 0),
      fuel: n.fuel || 0, manpower: n.pool || 0,
      cp: n.cp || 0, xp: n.xp || 0, factory: (n.mil ?? 0) + (n.civ ?? 0)
    };
    const prevM = this._mdelta[key];
    let d = null;
    if(prevM && Date.now() - prevM.t > 400) d = (snap[kind] ?? 0) - (prevM.v ?? 0);
    if(!prevM || Date.now() - prevM.t > 600) this._mdelta[key] = { v: snap[kind], t: Date.now() };

    const META = {
      pp:      { title:'政治点数', unit:'点', desc:'用于内阁顾问、法案与外交行动，每日 +2（受稳定度修正）。', parts:() => [['基础产出','+2.0/天'], ['稳定度修正', (n.stability >= 0.5 ? '+0%' : '-20%')]] },
      stab:    { title:'国家稳定度', unit:'%', desc:'低于 50% 将拖慢工厂产出并升高叛乱风险。', parts:() => [['战争状态', n.atWarWith && n.atWarWith.length ? '-10%' : '0%'], ['法案', (n.law || 'partial')]] },
      war:     { title:'战争支持度', unit:'%', desc:'低于 50% 时无法通过全面动员类法案。', parts:() => [['被宣战', n.atWarWith && n.atWarWith.length ? '+15%' : '0%'], ['战场胜利','视战报']] },
      civ:     { title:'民用工厂', unit:'个', desc:'投入建造项目，扩大工业基础。', parts:() => [['已占领区','见工业地图模式']] },
      mil:     { title:'军用工厂', unit:'个', desc:'开动生产线持续产出各类装备。', parts:() => [['生产线', (n.productionLines || []).length + ' 条'], ['装备点', Math.round(n.equip) + '']] },
      equip:   { title:'装备点库存', unit:'点', desc:'全军换装与补编的总库存，不足将导致缺编。', parts:() => Object.entries(n.equipment || {}).slice(0, 5).map(([k, v]) => [k, Math.round(v)]) },
      div:     { title:'现役师团', unit:'个', desc:'当前在编且未覆灭的陆军师总数。', parts:() => [['训练中', ((n.training || []).length) + ' 个']] },
      tension: { title:'世界紧张度', unit:'%', desc:'全球对抗升级程度，越高越容易获得宣战借口。', parts:() => [['当前阶段', snap.tension >= 75 ? '全面战争临界' : snap.tension >= 50 ? '高度紧张' : '局部摩擦']] },
      fuel:    { title:'燃料储备', unit:'桶', desc:'装甲与摩托化部队机动的硬约束，断油将瘫痪。', parts:() => [['断供部队', w.units.filter(u => u.nat === w.player && getUnitSupplyModifiers(u).isCutoff).length + ' 个']] },
      manpower:{ title:'人力池', unit:'人', desc:'补充伤亡与组建新师的人口储备。', parts:() => Object.entries(n.pool || {}).slice(0, 3).map(([k, v]) => [k, v]) },
      cp:      { title:'指挥点数', unit:'点', desc:'用于将领战术特技、编制重组与作战动员。', parts:() => [['将领特技','每次 -25 点'], ['上限', (n.cpMax || 200) + ' 点']] },
      xp:      { title:'陆战作战经验', unit:'点', desc:'用于师设计器调整与陆军学说强化。', parts:() => [['来源','战斗与演习积累'], ['用途','学说与编制解锁']] },
      factory: { title:'工业工厂', unit:'个', desc:'军用工厂开动生产线，民用工厂投入建造。', parts:() => [['军用工厂', (n.mil ?? 0) + ' 个'], ['民用工厂', (n.civ ?? 0) + ' 个'], ['生产线', (n.productionLines || []).length + ' 条']] }
    };
    const meta = META[kind];
    if(!meta) return;
    this.cur = key;
    this.el.className = 'lv3';
    const dv = d == null ? '' : `<em class="${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${d > 0 ? '↑+' : d < 0 ? '↓' : ''}${Math.abs(d) < 0.05 ? '±0' : Math.abs(d) % 1 ? d.toFixed(2) : d.toFixed(0)}${meta.unit === '%' ? 'pp' : ''}</em>`;
    const parts = meta.parts();
    this.el.innerHTML = `
      <div class="tt-head"><b>${meta.title}</b><span class="tt-owner">指标详解</span></div>
      <div class="tt-big"><span class="tt-num">${typeof snap[kind] === 'number' ? (snap[kind] % 1 ? snap[kind].toFixed(1) : snap[kind].toFixed(0)) : '—'}</span>
        <span class="tt-unit">${meta.unit}</span>${dv}</div>
      <div class="tt-parts">${parts.map(([k, v]) => `<div class="tt-row"><span>${k}</span><b>${v}</b></div>`).join('')}</div>
      <div class="tt-desc">${meta.desc}</div>`;
    const r = anchor.getBoundingClientRect();
    this._place(r.left + r.width / 2, r.bottom + 2);
  }
}

/* ============================================================
   统一初始化
   ============================================================ */
export function initHudV8(store, cam, ui){
  ensureTensionGauge();
  bindPanelCollapse(cam);
  const minimap = new Minimap(store, cam, ui);
  const tooltips = new TooltipSystem(store, cam, ui);

  // M 键开关迷你地图
  document.addEventListener('keydown', e => {
    const t = e.target;
    if(t && typeof t.closest === 'function' && t.closest('input, textarea')) return;
    if(e.key === 'm' || e.key === 'M'){
      if(e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      minimap.toggle();
      sound.playClick();
    }
  });

  return { minimap, tooltips };
}
