/* ============================================================
   main.js —— v3 装配：world → store → render → ui → 主循环
   ============================================================ */

import { Camera } from './render/camera.js';
import { LayerRenderer } from './render/layers.js';
import { createStore } from './core/store.js';
import { makeWorld, loadScenario } from './engine/world.js';
import { dayTick } from './engine/tick.js';
import { victoryTick } from './engine/victory.js';
import { makeRng } from './core/rng.js';
import { K } from './data/constants.js';
import { bindInput, cancelCommand } from './ui/input.js';
import { initHudV8, updateTensionGauge, renderAlertBar, mapWidthRatio } from './ui/hudV8.js';
import { renderEraHud, onHexClickEra } from './ui/eraHud.js';
import * as barrageApi from './engine/barrage.js';
import * as sanctionsApi from './engine/sanctions.js';
import * as milaidApi from './engine/milaid.js';
import * as blocApi from './engine/bloc.js';
import * as dronesApi from './engine/drones.js';
import * as spaceApi from './engine/space.js';
import * as energyApi from './engine/energy.js';
import { HUD, LogPanel, Panels, openFocusModal, openSaveModal, openDifficultyModal, openCharactersModal, renderCommandQueue, bindCommandQueue } from './ui/panels.js';
import { openDesignerModal } from './ui/panelDesigner.js';
import { openStatsModal } from './ui/panelStats.js';
import { openEncyclopediaModal } from './ui/panelEncyclopedia.js';
import { NewsTicker } from './ui/newsTicker.js';
import { openPeaceConferenceModal } from './ui/panelPeace.js';
import { saveGame, loadGame, listSaves } from './save.js';
import { APP_SCREENS, screenManager, ERA_META } from './ui/screenManager.js';
import { SCENARIOS } from './data/scenarios.js';
import { renderMainMenu, disposeMainMenu, renderEraLobby, renderCountrySelect, renderAAR, registerScenarioPack } from './ui/screenPages.js';
import { MAP_MODES } from './render/mapModes.js';


import { sound } from './core/audio.js';
import { SCENARIO_TUTORIALS } from './data/tutorials.js';
import { renderTitleBannerHtml, renderFlagHtml } from './core/assets.js';

const DEV = /[?&]dev=1/.test(location.search);

/* v12.1 修复「开倍速后时间不自动流逝」：
   原先凡 important 事件一律急停，而剧本新闻时间线（现代开局几乎每周一条）、
   王牌诞生、社会动荡都会带 important —— 玩家开倍速后几秒就被静默拍停一次。
   现在只有真正需要玩家决策/罕见转折的事件才急停，其余保留音效与日志高亮。 */
const PAUSE_EVENT_TYPES = new Set([
  'war', 'capitulation', 'peace', 'defcon_shift', 'nuclear_escalation',
  'coup_success', 'coup_failed', 'revolution_rus', 'empire_collapse',
  'us_entry', 'unrestricted_sub_decision', 'mutiny_ger',
  'energy_cutoff', 'red_line_crisis', 'ceasefire_window_open'
]);

let W = null, store = null, cam = null, layers = null, canvas = null;
let hud, logPanel, panels, ui, newsTicker = null;
let hudV8 = null;      // v8.0 M5：迷你地图 + 三级 Tooltip 句柄
let rng = null;
let acc = 0, lastTs = 0, lastPanelDay = -1;
let lastCanvasW = 0, lastCanvasH = 0;

/* 画布自适应：屏切换（display:none→flex）与窗口缩放都会触发尺寸变化 */
function fitCanvas(){
  if(!canvas || !cam || !layers) return;
  if(canvas.clientWidth === lastCanvasW && canvas.clientHeight === lastCanvasH) return;
  lastCanvasW = canvas.clientWidth; lastCanvasH = canvas.clientHeight;
  cam.resize();
  if(layers){ layers.dpr = cam.dpr; layers.resize(); }
}


function setWorld(v){
  W = v;
  rng = makeRng(W.rngState);
  if(store) store.world = v;
  if(cam) cam.world = v;
}

function tickOnce(){
  const { events } = dayTick(W, rng);
  for(const ev of events){
    if(ev.hex != null && (ev.type==='capture' || ev.type==='destroyed')){
      const h = W.hexes[ev.hex];
      layers.addFloat(h.q, h.r, ev.text.slice(0,12),
        ev.type==='destroyed' ? '255,200,120' : '160,220,160');
      layers.invalidateMap();
      if(ev.type === 'capture') sound.playCapture();
      else if(ev.type === 'destroyed') sound.playAttack();
    }
    if(ev.important && PAUSE_EVENT_TYPES.has(ev.type)){
      W.speed = 0;
      sound.playAlert();
    }
  }
  if(W.day % 7 === 0) saveGame(W, 0, '自动存档');
}

function loop(ts, manual){
  fitCanvas();
  // v8.0 比例尺：按当前缩放换算（基准 1 格 ≈ 80km）
  if(!manual && (loop._sc = (loop._sc || 0) + 1) % 15 === 0 && cam){
    const el = document.getElementById('sf-map-scale-text');
    if(el){
      const pxPerHex = cam.size * cam.z * Math.sqrt(3);
      const km = Math.max(10, Math.round(200 / pxPerHex * 80 / 10) * 10);
      el.textContent = '200px ≈ ' + km + ' km';
    }
  }
  const dt = ts - lastTs; lastTs = ts;
  if(W && !W.over && W.speed>0){
    acc += dt;
    const step = K.DAY_MS[W.speed];
    let guard = 0;
    while(acc >= step && guard < 3 && !W.over && W.speed>0){
      acc -= step;
      tickOnce();
      guard++;
    }
  }
  if(W){
    // 战斗格集合（供渲染交叉剑）
    ui.battles.clear();
    // v10.1 审查修复：战斗格扫描复用帧首单位索引（原线性扫描在开战后每帧数万次比较）
    if(!loop._uIdxSrc || loop._uIdxSrc !== W.units){
      loop._uIdx = new Map(W.units.map(u => [u.id, u]));
      loop._uIdxSrc = W.units;
    }
    for(const u of W.units){
      if(u.hp>0 && u.order && u.order.type==='attack'){
        const h = W.at[u.order.target[0]+','+u.order.target[1]];
        if(h && h.units.some(id=>{
          const x = loop._uIdx.get(id);
          return x && x.hp>0 && x.nat!==u.nat && W.nations[u.nat].atWarWith.includes(x.nat);
        })) ui.battles.add(h.idx);
      }
    }
      layers.render(W, ui, ts);
      hud.update();
      // v8.0 M5：紧张度表盘 / 警报条 / 迷你地图随日推进刷新
    updateTensionGauge(store);
      renderAlertBar(store, cam, ui);
      renderEraHud(W, ui);              // v8.0 M6：副本专属 HUD（炮击仪表/疲惫条/红点/双轨/DEFCON/声望疲劳）
      if(hudV8 && hudV8.minimap) hudV8.minimap.draw();
      if(W.day !== lastPanelDay){
      lastPanelDay = W.day;
      panels.update();
      logPanel.update();
      layers.invalidateMap();
      if(hudV8 && hudV8.minimap) hudV8.minimap.invalidate();
    }
      if(newsTicker) newsTicker.update();
      // v7.0 E4：战后和会弹出（玩家为战胜方时，每局一次）
    if(W.pendingPeace && !W._peaceShown && W.pendingPeace.winners && W.pendingPeace.winners.includes(W.player)){
      W._peaceShown = true;
      openPeaceConferenceModal(store, () => { saveGame(W, 0, '和约签署'); });
    }
      const go = document.getElementById('sf-gameover');
    if(W.over && !go.classList.contains('on')) showGameOver();
    }
  if(!manual) requestAnimationFrame(loop);
}


/* ---------- v7.0：终局 → 战史复盘与授勋大厅（AAR） ---------- */
function gatherAARStats(){
  const playerName = W.nations[W.player] ? W.nations[W.player].name : W.player;
  const logs = W.log || [];
  const killLines = logs.filter(l => /被歼灭|歼灭/.test(l.text || '') && !(l.text || '').includes(playerName));
  const lossLines = logs.filter(l => /被歼灭|歼灭/.test(l.text || '') && (l.text || '').includes(playerName));
  const gens = (W.characters || []).filter(c => (c.nat === W.player) && (c.type === 'general' || c.role));
  return {
    kills: (W.stats && W.stats.kills) || killLines.length,
    losses: (W.stats && W.stats.losses) || lossLines.length,
    topGeneral: (panels && panels.activeGeneralId)
      ? (((W.characters || []).find(c => c.id === panels.activeGeneralId) || {}).name || null)
      : (gens[0] ? gens[0].name : null)
  };
}

function showGameOver(){
  if(W.over.win) sound.playVictory();
  else sound.playDefeat();
  W.speed = 0;
  sound.playGate();
  const stats = gatherAARStats();
  W.stats = { ...(W.stats || {}), ...stats };
  const aarEl = document.getElementById(APP_SCREENS.AAR);
  if(!aarEl){ return; }
  renderAAR(aarEl, { world: W, over: W.over });
  // AAR 底部按钮接线
  aarEl.querySelectorAll('[data-act]').forEach(b => {
    b.addEventListener('click', () => {
      sound.playClick();
      const act = b.dataset.act;
      if(act === 'replay'){
        const era = W.scenario;
        const prevPlayer = W.player;
        screenManager.switchTo(APP_SCREENS.COUNTRY_SELECT);
        renderCountrySelect(document.getElementById(APP_SCREENS.COUNTRY_SELECT), countrySelectHooks, era);
      }else if(act === 'menu'){
        S2MainMenu();
      }
    });
  });
  screenManager.switchTo(APP_SCREENS.AAR);
}

/* ---------- v7.0：屏幕跳转辅助 ---------- */
function S2MainMenu(){
  disposeMainMenu(document.getElementById(APP_SCREENS.MAIN_MENU));
  screenManager.switchTo(APP_SCREENS.MAIN_MENU);
  renderMainMenu(document.getElementById(APP_SCREENS.MAIN_MENU), mainMenuHooks());
}

function findLatestSave(){
  let best = null;
  for(const sc of ['A', 'ww1', 'ww2', 'coldwar', 'modern']){
    let list = [];
    try { list = listSaves(sc) || []; } catch(e){ list = []; }
    for(const s of list){
      if(s && s.exists && s.savedAt && (!best || s.savedAt > best.savedAt)){
        best = { ...s, scenario: sc };
      }
    }
  }
  return best;
}

const countrySelectHooks = {
  onBack(){ sound.playGate(); renderEraLobbyInto(); },
  onMech(){ openEraManual(currentEraKey); },
  onStart(tag, difficulty, ironman){ startBattle(currentEraKey, tag, difficulty, ironman); }
};
let currentEraKey = null;

function renderEraLobbyInto(){
  const el = document.getElementById(APP_SCREENS.ERA_SELECT);
  renderEraLobby(el, {
    onBack(){ sound.playGate(); S2MainMenu(); },
    onEraPicked(eraKey){
      currentEraKey = eraKey;
      document.body.className = 'theme-' + eraKey;
      sound.playStamp();
      screenManager.switchTo(APP_SCREENS.COUNTRY_SELECT);
      renderCountrySelect(document.getElementById(APP_SCREENS.COUNTRY_SELECT), countrySelectHooks, eraKey);
    },
    onMech(){ openEraManual(document.body.className.replace('theme-','') || 'ww2'); }
  });
  screenManager.switchTo(APP_SCREENS.ERA_SELECT);
}

function openEraManual(eraKey){
  const era = ERA_META[eraKey] || ERA_META.ww2;
  const helpEl = document.getElementById('sf-help');
  if(!helpEl) return;
  helpEl.innerHTML = `
    <div class="brief-box" style="max-width:640px">
      <h2>${era.fullName} · 时代机制</h2>
      <div class="bf-sub">结算节奏：${era.tick} · 推演烈度 ${'★'.repeat(era.intensity)}</div>
      <ul style="line-height:1.9;font-size:13px;padding-left:20px">
        ${era.tags.map(t => `<li>${t}</li>`).join('')}
        <li>${era.brief}</li>
      </ul>
      <div style="margin-top:14px;text-align:right">
        <button class="btn gold" onclick="document.getElementById('sf-help').classList.remove('on')">了解</button>
      </div>
    </div>`;
  helpEl.classList.add('on');
}

function mainMenuHooks(){
  return {
    findLatestSave,
    onCampaign(){ sound.playGate(); renderEraLobbyInto(); },
    onContinue(save){
      if(!save) return;
      sound.playStamp();
      const w = loadGame(save.scenario, save.slot);
      if(!w){ toast('该存档已损坏或不兼容，已跳过'); return; }
      startBattle(save.scenario, w.player, w.difficulty || 'general', false, w);
    },
    onCodex(){
      try {
        const tmp = loadScenario('ww2', 1);
        openEncyclopediaModal({ world: tmp });
      } catch(e){ toast('档案库暂时无法打开'); }
    },
    onSettings(){
      sound.toggleMute();
      toast(sound.isMuted() ? '♪ 音效已关闭' : '♪ 音效已开启');
    },
    onCredits(){
      const helpEl = document.getElementById('sf-help');
      if(!helpEl) return;
      helpEl.innerHTML = `<div class="brief-box" style="max-width:620px">
        <h2>开发与考据鸣谢</h2>
        <p style="font-size:13px;line-height:1.9">《钢铁前线 Steel Front》—— 零依赖 Web 大战略推演引擎。</p>
        <ul style="font-size:12.5px;line-height:1.9;padding-left:20px;color:#b9c0ca">
          <li>机制参考：Hearts of Iron IV（Paradox Interactive）之战斗宽度/计划加成/世界紧张度结构</li>
          <li>历史考据：1914–2022 各国战役史、装备档案与人物列传（详见各副本百科）</li>
          <li>虚构人物：葛修傅 / 吉爱习 / 小鹿 / 王若伊 [F] —— 仅存于虚构剧情线</li>
        </ul>
        <div style="margin-top:14px;text-align:right">
          <button class="btn gold" onclick="document.getElementById('sf-help').classList.remove('on')">返回</button>
        </div>
      </div>`;
      helpEl.classList.add('on');
    }
  };
}

/* ---------- v7.0：签署动员令 → 启动战局 ---------- */
function startBattle(eraKey, playerTag, difficulty, ironman, preloadedWorld){
  const scKey = (eraKey === 'A') ? 'A' : eraKey;
  let world = preloadedWorld;
  if(!world){
    world = loadScenario(scKey, (Date.now() & 0xffff) >>> 0);
    // 玩家选国覆盖默认剧本主角
    if(playerTag && world.nations[playerTag]){
      world.player = playerTag;
    }
  }
  if(difficulty) world.difficulty = difficulty;
  if(ironman) world.ironman = true;
  // 铁人模式：禁用作弊调试栏（v7.0 §4.3）
  const devbar = document.getElementById('sf-devbar');
  if(devbar){ devbar.classList.toggle('on', DEV && !world.ironman); }
  W = world;
  setWorld(W);
  if(!store) store = createStore(W); else store.world = W;

  initGameScene();
  updateBriefing(W);
  const briefEl = document.getElementById('sf-brief');
  if(briefEl) briefEl.classList.add('on');
  // 视野自适应（v8.0）：优先框住玩家领土 → 全图陆地 → 首都
  // v9.5 U4：拟合目标 = 玩家领土 ∪ 接壤邻国，再外扩 2 格（战略视野完整）
  const computeFocusHexes = () => {
    const own = W.hexes.filter(h => h.owner === W.player);
    if(!own.length) return W.hexes.filter(h => h.terrain !== 'sea' && h.owner !== 'N');
    const focus = new Set(own.map(h => h.idx));
    let frontier = own.map(h => h.idx);
    for(let hop = 0; hop < 2; hop++){
      const next = [];
      for(const idx of frontier){
        for(const ni of W.hexes[idx].adj){
          if(!focus.has(ni)){ focus.add(ni); next.push(ni); }
        }
      }
      frontier = next;
    }
    return [...focus].map(i => W.hexes[i]);
  };
  const fitView = () => {
    if(!cam) return;
    const focus = computeFocusHexes();
    if(focus.length >= 6){ cam.fitToHexes(focus, 46); return; }
    const land = W.hexes.filter(h => h.terrain !== 'sea' && h.owner !== 'N');
    if(land.length){ cam.fitToHexes(land, 60); return; }
    const cap = W.hexes.find(h => h.city && h.city.cap === W.player) || W.hexes.find(h => h.city);
    if(cap) cam.fitToHexes([cap], 120);
  };
  window.__sfFitView = fitView;   // v9.5 U4：resize 防抖重拟合用
  if(layers){ layers.invalidateTerrain(); layers.invalidateMap(); }
  sound.playStamp();
  screenManager.switchTo(APP_SCREENS.GAMEPLAY);
  fitCanvas();          // 屏切换后画布尺寸才确定
  fitView();
  layers && layers.invalidateTerrain();
}

/* ---------- v8.0 M2：地图模式切换与图例条 ---------- */
function setMapModeByIndex(idx){
  if(!layers || !MAP_MODES[idx]) return;
  layers.setMapMode(MAP_MODES[idx].id);
  updateMapLegend(idx);
  sound.playClick();
}

function updateMapLegend(idx){
  const el = document.getElementById('sf-map-legend');
  if(!el) return;
  const m = MAP_MODES[idx] || MAP_MODES[0];
  let legendHtml = '';
  // v13.1：默认（地形）模式也给常驻图例 —— 地貌色块 / 占领斜纹 / 前线 / 河流，
  // 让玩家一眼读懂沙盘配色，而不是靠猜。没有读图依据的"好看"没有意义。
  if(m.id === 'default'){
    legendHtml = [
      ['平原', '#6f7d4e'], ['森林', '#2f4a30'], ['山地', '#5b5449'],
      ['丘陵', '#7d6440'], ['沼泽', '#3c4f42'], ['城市', '#4a5260'], ['沙漠', '#8a7550']
    ].map(([n, c]) => `<span class="lg-item"><span class="lg-swatch" style="background:${c}"></span>${n}</span>`).join('')
    + '<span class="lg-sep"></span>'
    + '<span class="lg-item"><span class="lg-swatch lg-hatch"></span>占领区</span>'
    + '<span class="lg-item"><span class="lg-swatch" style="background:#ef4444"></span>前线</span>'
    + '<span class="lg-item"><span class="lg-swatch" style="background:#38bdf8"></span>河流</span>';
    el.innerHTML = `<span class="lg-key">地形</span><span class="lg-name">地貌与态势</span>${legendHtml}`;
    el.classList.add('on');
    return;
  }
  if(m.legend.type === 'grad'){
    legendHtml = `<span class="lg-grad"><span class="lg-sub">${m.legend.min}</span>
      <span class="lg-strip">${m.legend.stops.map(c => '<i style="background:' + c + '"></i>').join('')}</span>
      <span class="lg-sub">${m.legend.max}</span>
      <span class="lg-sub">${m.legend.label}</span></span>`;
  }else if(m.legend.type === 'list'){
    legendHtml = m.legend.items.map(([n, c]) =>
      '<span class="lg-item"><span class="lg-swatch" style="background:' + c + '"></span>' + n + '</span>').join('');
  }
  el.innerHTML = `<span class="lg-key">${m.key}</span>
    <span class="lg-name">${m.name}</span>
    <span class="lg-sub">${m.sub}</span>${legendHtml}`;
  el.classList.add('on');
}

/* ---------- v7.0：局内场景装配（首次进入战局时执行一次） ---------- */
let gameSceneReady = false;
function initGameScene(){
  if(gameSceneReady) return;
  gameSceneReady = true;
  hud = new HUD(store);
  logPanel = new LogPanel(store, document.getElementById('sf-log'));
  panels = new Panels(store, ui);
  panels.bindProductionClicks();
  newsTicker = new NewsTicker(store);
  bindInput(canvas, store, cam, ui);
  bindCommandQueue(store, ui, cancelCommand);
  renderCommandQueue(ui);
  // v8.0 M5：HUD 重构（紧张度表盘 / 警报条 / 折叠图标条 / 迷你地图 / 三级 Tooltip）
  hudV8 = initHudV8(store, cam, ui);
  // v11.0 修复：Panels 构造时 bindIndicatorDetails 已经跑过一轮，而 #sf-tension
  // 是上面 initHudV8 → ensureTensionGauge 才创建的 —— 于是「点击紧张度数字看
  // 明细」这条交互永远不会生效。HUD 装配完成后再绑一次补上（_indBound 已去重）。
  panels.bindIndicatorDetails();

  document.querySelectorAll('[data-speed]').forEach(b=>{
    b.addEventListener('click', ()=>{
      sound.playClick();
      store.dispatch({ type:'SET_SPEED', payload:+b.dataset.speed });
    });
  });
  const focusBtn = document.getElementById('sf-focus-btn');
  if(focusBtn) focusBtn.addEventListener('click', ()=>{ sound.playClick(); openFocusModal(store); });
  const charsBtn = document.getElementById('sf-chars-btn');
  if(charsBtn) charsBtn.addEventListener('click', ()=>{ sound.playClick(); openCharactersModal(store); });
  const designerBtn = document.getElementById('sf-designer-btn');
  if(designerBtn) designerBtn.addEventListener('click', ()=>{ sound.playClick(); openDesignerModal(store); });
  const statsBtn = document.getElementById('sf-stats-btn');
  if(statsBtn) statsBtn.addEventListener('click', ()=>{ sound.playClick(); openStatsModal(store); });
  const encyBtn = document.getElementById('sf-encyclopedia-btn');
  if(encyBtn) encyBtn.addEventListener('click', ()=>{ sound.playClick(); openEncyclopediaModal(store); });
  const diffBtn = document.getElementById('sf-diff-btn');
  if(diffBtn) diffBtn.addEventListener('click', ()=>{ sound.playClick(); openDifficultyModal(store); });
  const audioBtn = document.getElementById('sf-audio-btn');
  if(audioBtn) audioBtn.addEventListener('click', ()=>{ sound.toggleMute(); hud.update(); });
  const saveBtn = document.getElementById('sf-save-btn');
  if(saveBtn) saveBtn.addEventListener('click', ()=>{ sound.playClick(); openSaveModal(store, true); });
  const helpBtn = document.getElementById('sf-help-btn');
  if(helpBtn) helpBtn.addEventListener('click', ()=>{ sound.playClick(); openEraManual(W.scenario || 'ww2'); });
  const menuBtn = document.getElementById('sf-menu-btn');
  if(menuBtn) menuBtn.addEventListener('click', ()=>{ sound.playGate(); S2MainMenu(); });

  const devbar = document.getElementById('sf-devbar');
  if(devbar && !devbar._bound){
    devbar._bound = true;
    devbar.querySelectorAll('[data-dev]').forEach(b => {
      b.addEventListener('click', () => {
        sound.playClick();
        const act = b.dataset.dev;
        const n = W.nations[W.player];
        if(act === 'equip'){
          if(n){ n.equip = (n.equip || 0) + 2000; toast('⚡ [作弊] 战略装备点 +2000！'); hud.update(); }
        } else if(act === 'skip'){
          for(let i = 0; i < 30; i++) tickOnce();
          toast('⚡ [作弊] 战局快速推演 30 天！');
          hud.update(); panels.update(); layers.invalidateTerrain(); layers.invalidateMap();
        } else if(act === 'win'){
          const enemies = (n && n.atWarWith) || [];
          if(enemies.length > 0){
            const targetNat = enemies[0];
            const tNation = W.nations[targetNat];
            if(tNation){
              tNation.capitulated = true;
              toast(`⚡ [作弊] 敌国【${tNation.name || targetNat}】宣布无条件投降！`);
              victoryTick(W);
              hud.update();
            }
          } else {
            toast('⚠️ 当前无处于交战状态的敌对国家');
          }
        } else if(act === 'ai'){
          toast(`🤖 AI决策日志：${W.aiLog ? W.aiLog.slice(-3).map(x=>x.text).join(' | ') : '暂无'}`);
        }
      });
    });
  }
}

function toast(t){
  const el = document.getElementById('sf-toast');
  el.textContent = t; el.classList.add('on');
  clearTimeout(toast._t); toast._t = setTimeout(()=>el.classList.remove('on'), 2000);
}

function updateBriefing(world){
  const el = document.getElementById('sf-brief');
  if(!el || !world) return;
  const scKey = world.scenario || 'ww2';
  const n = world.nations[world.player];
  const scNames = {
    ww1: '一战 · 火药桶 1914',
    ww2: '二战 · 全面战争 1939',
    A: '二战 · 白色方案 1939',
    coldwar: '冷战 · 铁幕初启 1949',
    modern: '现代 · 多极危机 2022'
  };
  const scObjs = {
    ww1: '打破堑壕僵局，粉碎同盟国/协约国防线，迫使敌对阵营投降。',
    ww2: '集中装甲矛头进行深度突击，突破敌方防线并占领关键胜利点。',
    A: '120 天内迫使波兰投降，西线不要被法国突破。',
    coldwar: '积累核威慑与科技优势，避免全面核浩劫的同时争夺地缘阵营霸权。',
    modern: '应对现代高科技冲突与信息战，保卫国家主权并实现停火战略主动。'
  };

  el.innerHTML = `
    <div class="brief-box" style="max-width:580px;padding:24px;">
      ${renderTitleBannerHtml(scKey === 'A' ? 'ww2' : scKey)}
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
        ${renderFlagHtml(world.player, 48, 32)}
        <div>
          <h1 style="font-size:22px;margin:0;color:var(--gold);">${scNames[scKey] || scKey}</h1>
          <div class="bf-sub" style="margin:2px 0 0 0;">你指挥【${n ? n.name : world.player}】· v3.0 跨时代大战略引擎</div>
        </div>
      </div>
      <p style="font-size:13.5px;line-height:1.7;"><b>战役目标</b>：${scObjs[scKey] || '实现阵营战略胜利。'}</p>
      <ul style="font-size:12.5px;color:var(--dim);line-height:1.7;margin:10px 0 16px 20px;">
        <li>左键选格选师；右键相邻敌格=进攻，右键己方格=调动推进</li>
        <li>顶部菜单可随时打开【全量国策树】与【内阁与将领】任命核心统帅</li>
        <li>空格键暂停，1/2/3 调速；点击右上方「?」可随时翻阅当前剧本作战手册</li>
      </ul>
      <button class="btn primary" style="width:100%;padding:10px;font-size:14px;" onclick="document.getElementById('sf-brief').classList.remove('on')">开 战</button>
    </div>
  `;
}

function boot(){
  canvas = document.getElementById('sfmap');
  cam = new Camera(canvas);
  layers = new LayerRenderer(canvas, cam);
  window.addEventListener('resize', () => { lastCanvasW = 0; fitCanvas(); });
  // v9.5 U4：视口尺寸变化后 300ms 防抖重拟合视野（消除宽屏下世界悬空居中）
  let refitTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(refitTimer);
    refitTimer = setTimeout(() => {
      if(window.__sfFitView && W && !W.over) window.__sfFitView();
    }, 300);
  });
  fitCanvas();

  ui = { selHex:null, selUnits:[], hover:null, battles:new Set(),
         unitStyle: (localStorage.getItem('sf_unit_style') || 'nato'), boxSelect:null, layers,
         onSelect(){ panels && panels.update(); renderCommandQueue(ui); },
         invalidate(){ layers && (layers.invalidateTerrain(), layers.invalidateMap()); } };

  /* —— v7.0：注入四时代剧本数据包（供时代大厅与国家档案舱读取） —— */
  for(const key of ['ww1','ww2','coldwar','modern']){
    if(SCENARIOS[key]) registerScenarioPack(key, SCENARIOS[key]);
  }

  /* —— v7.0 页面流：注册屏幕处理器 —— */
  screenManager.register(APP_SCREENS.MAIN_MENU, {});
  screenManager.register(APP_SCREENS.ERA_SELECT, {});
  screenManager.register(APP_SCREENS.COUNTRY_SELECT, {});
  screenManager.register(APP_SCREENS.GAMEPLAY, {});
  screenManager.register(APP_SCREENS.AAR, {});

  /* —— 局内快捷键：ESC 关闭任意活动模态框/档案卡，终局时返回主菜单 —— */
  document.addEventListener('keydown', e => {
    if(e.key === 'Escape'){
      // 检查是否有活动的模态框或档案卡覆盖层
      const openOverlays = Array.from(document.querySelectorAll('.sf-overlay.on, .modal.on, .sf-dossier-overlay, #sf-help.on, #sf-brief.on, #sf-peace-modal.on'));
      if(openOverlays.length > 0){
        e.preventDefault();
        e.stopPropagation();
        sound.playClick();
        const topModal = openOverlays[openOverlays.length - 1];
        if(topModal.id === 'sf-character-dossier-modal' || topModal.id === 'sf-focus-dossier-modal' || topModal.id === 'sf-newspaper-modal'){
          topModal.remove();
        } else {
          topModal.classList.remove('on');
        }
        return;
      }
      if(screenManager.currentScreen === APP_SCREENS.GAMEPLAY){
        if(W && W.over) {
          S2MainMenu();
        }
      }
    }
  });

  /* —— URL 直启（兼容 dist 多入口与旧调试链接） —— */
  const params = new URLSearchParams(location.search);
  const urlSc = params.get('scenario');
  const urlPlayer = params.get('player');
  const validScenarios = ['A','ww1','ww2','coldwar','modern'];

  if(urlSc && validScenarios.includes(urlSc)){
    const tmp = loadScenario(urlSc, 42);
    const defPlayer = urlPlayer && tmp.nations[urlPlayer] ? urlPlayer : tmp.player;
    startBattle(urlSc, defPlayer, 'general', false);
    requestAnimationFrame(loop);
    return;
  }

  /* —— 冷启动：渲染主菜单并停留 —— */
  renderMainMenu(document.getElementById(APP_SCREENS.MAIN_MENU), mainMenuHooks());
  screenManager.switchTo(APP_SCREENS.MAIN_MENU);
  requestAnimationFrame(loop);
}

/* v8.0 M3：U 键切换部队标识（NATO ↔ 兵种图标） */
document.addEventListener('keydown', e => {
  if(e.key !== 'u' && e.key !== 'U') return;
  if(e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  const next = (ui && ui.unitStyle === 'icon') ? 'nato' : 'icon';
  if(ui) ui.unitStyle = next;
  localStorage.setItem('sf_unit_style', next);
  toast('部队标识：' + (next === 'nato' ? '北约符号' : '兵种图标'));
});

/* v8.0 M2：F1–F12 地图模式（拦截浏览器默认行为，F5 刷新 / F11 全屏 / F12 开发者工具）
   v14.1 E5：F11 战区与兵力、F12 战力优势接入（绘制函数早已完整实现） */
document.addEventListener('keydown', e => {
  if(!e.key || !e.key.startsWith('F')) return;
  const n = parseInt(e.key.slice(1), 10);
  if(!(n >= 1 && n <= 12)) return;
  if(e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  if(SF && SF.store && SF.store.world && SF.store.world.over) return;
  if(!MAP_MODES[n - 1]) return;
  e.preventDefault();
  e.stopPropagation();
  setMapModeByIndex(n - 1);
}, true);

document.addEventListener('DOMContentLoaded', boot);

/* 调试句柄（仅 UI 层；engine 保持无 DOM） */
window.SF = {
  showGameOver,
  setMapModeByIndex,
  /* 手动推进一帧（后台标签 rAF 被浏览器节流时用于测试/调试） */
  advanceFrame(n = 1){
    for(let i=0;i<n;i++) loop(performance.now() + i*16, true);
    return W ? W.day : -1;
  },
  /* 快进 N 天（不依赖 rAF） */
  fastForward(days = 10){
    for(let i=0;i<days;i++){ if(!W || W.over) break; tickOnce(); }
    hud && hud.update(); panels && panels.update();
    return W ? W.day : -1;
  },
  get world(){ return W; },
  get store(){ return store; },
  get camera(){ return cam; },
  get layers(){ return layers; },
  get ui(){ return ui; },
  get hudV8(){ return hudV8; },
  /* v8.0 M6：四副本专属引擎系统句柄（调试与验收脚本用） */
  engine: { barrage: barrageApi, sanctions: sanctionsApi, milaid: milaidApi,
            bloc: blocApi, drones: dronesApi, space: spaceApi, energy: energyApi },
  get mapWidthRatio(){ return mapWidthRatio(); },
  loadScenario(id){
    W = loadScenario(id, (Date.now() & 0xffff) >>> 0);
    setWorld(W);
    layers.invalidateTerrain();
    layers.invalidateMap();
    return W;
  },
  tickOnce
};
