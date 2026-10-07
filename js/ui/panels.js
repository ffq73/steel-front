/* ============================================================
   ui/panels.js —— 统帅部 HUD / 工业总装抽屉 / 作战指挥 / 模态框
   v6.0 深度视效重构：领袖看板、战略缎带、集团军群将领带、军工流水线
   ============================================================ */

import { K } from '../data/constants.js';
import { availableFocuses, focusesFor } from '../engine/focus.js';
import { sound } from '../core/audio.js';
import { listSaves, saveGame, loadGame, deleteSave, exportSaveJson, importSaveJson } from '../save.js';
import { renderPortraitHtml, renderFlagHtml, renderLeaderPortraitHtml, renderGeneralPortraitHtml, getBlueprintSrc, getFocusMotherIconSrc, getCharacterPortraitSrc, getEventImageSrc, getNewspaperImageSrc, getProceduralBadgeSvg } from '../core/assets.js';
import { getCharacterDossier, getFocusDossier } from '../data/dossierData.js';
import { assignGeneral, unassignGeneral, promoteToMarshal } from '../engine/characters.js';
import { ECONOMIC_LAWS, CONSCRIPTION_LAWS, ADVISORS, switchEconomicLaw, switchConscriptionLaw, hireAdvisor } from '../engine/laws.js';
import { canPerformTensionAction, startJustifyWar, guaranteeIndependence, sendVolunteers, sendLendLease } from '../engine/tension.js';
import { createFront, assignToFront, createOffensiveArrow, createFallbackLine, pickOffensiveTarget } from '../engine/plans.js';
import { RESOURCE_TYPES, RESOURCES, NATION_RESOURCE_BASE, LINE_RESOURCE_NEED } from '../data/resources.js';
import { unitDetailHtml, prodDetailHtml, hexTitleInfo } from './detailSystem.js';
import { UNITS } from '../data/units.js';
import { TERRAIN } from '../data/terrain.js';
import { getHexWeather } from '../data/weather.js';
import { renderAirPanel } from './panelAir.js';
import { renderNavyPanel } from './panelNavy.js';
import { renderIntelPanel } from './panelIntel.js';
import { renderDoctrinePanel } from './panelDoctrine.js';
import { renderStatsPanel, openStatsModal } from './panelStats.js';
import { renderEraPanel } from './panelEra.js';
import { renderTradePanel } from './panelTrade.js';
import { renderDecisions } from './panelDecisions.js';   // v14.0 P2 决议面板
import { renderResearchPanel } from './panelResearch.js';   // v14.0 P4 科研面板
import { ArmyPanel } from './panelArmy.js';   // v14.1 E4：军与作战计划面板激活（此前整文件死代码）
import { IDEOLOGIES, IDEOLOGY_FACTIONS, getIdeology } from '../data/ideology.js';   // v14.0 P3
import { canHoldReferendum, canStartCivilWar, holdReferendum, startCivilWar } from '../engine/ideology.js';   // v14.0 P3

export function showToast(msg, duration = 2200){
  const el = document.getElementById('sf-toast');
  if(!el) return;
  el.textContent = msg;
  // v12.0 U3：左侧类型色条分档 —— bad 红 / warn 橙 / 默认 info 黄铜
  el.classList.remove('type-warn', 'type-bad');
  if(msg.includes('❌') || msg.includes('✗') || msg.includes('驳回')) el.classList.add('type-bad');
  else if(msg.includes('⚠') || msg.includes('‼')) el.classList.add('type-warn');
  el.classList.add('on');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('on'), duration);
}

/* ============================================================
   M4：命令队列面板（右侧，逐条可撤销）
   数据来源 ui.commandQueue —— 由 input.js 的 pushCommand 写入。
   仅在内容签名变化时重绘，避免每帧 innerHTML 抖动动画。
   ============================================================ */
const CMD_ICON = { '进攻':'⚔️', '推进':'➡️', '移动':'➡️', '支援攻击':'🛡️', '路径点':'📍', '战略调动':'🚂', '停止':'🛑' };
const CMD_CLS  = { '支援攻击':'is-support', '路径点':'is-waypoint' };

export function renderCommandQueue(ui){
  const el = document.getElementById('sf-cmdqueue');
  if(!el) return;
  const q = ui.commandQueue || [];
  const sig = q.map(c => c.id).join('|');
  if(el._sig === sig) return;              // 无变化：保留动画与 hover 态
  el._sig = sig;

  if(!q.length){ el.innerHTML = ''; return; }

  el.innerHTML =
    `<div class="sf-cmdqueue-head"><span>作战命令队列</span><b>${q.length}</b></div>` +
    q.map(c => {
      const kind = c.kind.replace(/^[^\u4e00-\u9fa5]*/, '');
      const icon = CMD_ICON[kind] || '·';
      return `<div class="sf-cmdq-item ${CMD_CLS[kind] || ''}" data-cmd="${c.id}">
        <span class="sf-cmdq-text" title="${c.text}">${icon} ${c.text.replace(/^[^\u4e00-\u9fa5]*\s*/, '')}</span>
        <span class="sf-cmdq-day">D${c.day}</span>
        <span class="sf-cmdq-x" data-cmd-x="${c.id}" title="撤销该条命令（清除相关部队命令）">×</span>
      </div>`;
    }).join('');
}

/* 事件委托：只绑定一次 */
export function bindCommandQueue(store, ui, onCancel){
  const el = document.getElementById('sf-cmdqueue');
  if(!el || el._bound) return;
  el._bound = true;
  el.addEventListener('click', e => {
    const x = e.target.closest('[data-cmd-x]');
    if(!x) return;
    sound.playClick();
    onCancel(store, ui, x.dataset.cmdX);
  });
}

export class HUD {
  constructor(store){
    this.store = store;
    this.planStance = 'balanced';
    this.initPlaqueAndPlanEvents();
  }

  initPlaqueAndPlanEvents(){
    // 领袖看板点击打开领袖档案/内阁统帅管理
    const leaderFrame = document.getElementById('hud-leader-frame');
    if(leaderFrame && !leaderFrame._bound){
      leaderFrame._bound = true;
      leaderFrame.addEventListener('click', () => {
        const w = this.store.world;
        const leader = (w.characters || []).find(c => c.nat === w.player && c.type === 'leader');
        sound.playClick();
        if(leader){
          openCharacterDossier(leader, this.store);
        } else {
          openCharactersModal(this.store);
        }
      });
    }

    // 国策快捷插槽点击打开国策树
    const focusSlot = document.getElementById('hud-focus-quick-slot');
    if(focusSlot && !focusSlot._bound){
      focusSlot._bound = true;
      focusSlot.addEventListener('click', () => {
        sound.playClick();
        openFocusModal(this.store);
      });
    }

    // 紧张度徽章点击打开外交界面
    const tensionBadge = document.getElementById('hud-tension-badge');
    if(tensionBadge && !tensionBadge._bound){
      tensionBadge._bound = true;
      tensionBadge.addEventListener('click', () => {
        sound.playClick();
        openCharactersModal(this.store, 'diplomacy');
      });
    }

    // 作战计划按钮绑定
    const btnFrontline = document.getElementById('sf-plan-frontline');
    if(btnFrontline && !btnFrontline._bound){
      btnFrontline._bound = true;
      btnFrontline.addEventListener('click', () => {
        const w = this.store.world;
        sound.playClick();
        const f = createFront(w, w.player);
        assignToFront(w, f.id);
        showToast(`★ 已划设【${f.name}】，${f.hexes.length} 格前线，全师展开填线！`);
      });
    }

    const btnSpearhead = document.getElementById('sf-plan-spearhead');
    if(btnSpearhead && !btnSpearhead._bound){
      btnSpearhead._bound = true;
      btnSpearhead.addEventListener('click', () => {
        const w = this.store.world;
        sound.playClick();
        // v12.0 S1：与 X 键共用 pickOffensiveTarget（矛头语义）
        const picked = pickOffensiveTarget(w, 'spearhead');
        if(picked){
          const f = (w.fronts && w.fronts.find(x => x.nat === w.player)) || createFront(w, w.player);
          createOffensiveArrow(w, f.id, [picked.target.idx], null, 'spearhead');
          showToast(`🎯 【${f.name}】进攻矛头已标定：${picked.target.city ? picked.target.city.name : '敌军枢纽'}（${picked.theater}）！`);
        } else {
          showToast('⚠️ 当前无处于交战状态的敌国目标');
        }
      });
    }

    const btnFallback = document.getElementById('sf-plan-fallback');
    if(btnFallback && !btnFallback._bound){
      btnFallback._bound = true;
      btnFallback.addEventListener('click', () => {
        const w = this.store.world;
        sound.playClick();
        const playerHexes = w.hexes.filter(h => h.owner === w.player).map(h => h.idx).slice(0, 5);
        createFallbackLine(w, w.player, playerHexes);
        showToast('🛡️ 纵深备用退守防线已勘定！');
      });
    }

    const btnFill = document.getElementById('sf-plan-fill');
    if(btnFill && !btnFill._bound){
      btnFill._bound = true;
      btnFill.addEventListener('click', () => {
        const w = this.store.world;
        sound.playClick();
        const f = (w.fronts || []).find(x => x.nat === w.player);
        if(f){
          assignToFront(w, f.id);
          showToast('⚔️ 前线各师团均势对齐完毕！');
        } else {
          const newF = createFront(w, w.player);
          assignToFront(w, newF.id);
          showToast(`⚔️ 自动建立【${newF.name}】并完成全军填线！`);
        }
      });
    }

    const btnStance = document.getElementById('sf-plan-stance');
    const stanceLabel = document.getElementById('sf-stance-label');
    if(btnStance && !btnStance._bound){
      btnStance._bound = true;
      btnStance.addEventListener('click', () => {
        sound.playClick();
        if(this.planStance === 'balanced'){
          this.planStance = 'aggressive';
          if(stanceLabel) stanceLabel.textContent = '狂暴突击';
          showToast('⚡ 作战姿态切换为：狂暴突击 (突破+15%, 战损+20%)');
        } else if(this.planStance === 'aggressive'){
          this.planStance = 'careful';
          if(stanceLabel) stanceLabel.textContent = '谨慎防守';
          showToast('🛡️ 作战姿态切换为：谨慎防守 (防御+15%, 组织度稳固)');
        } else {
          this.planStance = 'balanced';
          if(stanceLabel) stanceLabel.textContent = '平衡推进';
          showToast('⚖️ 作战姿态切换为：标准平衡推进');
        }
      });
    }

    const btnExec = document.getElementById('sf-plan-execute');
    if(btnExec && !btnExec._bound){
      btnExec._bound = true;
      btnExec.addEventListener('click', () => {
        const w = this.store.world;
        sound.playAlert();
        w.armies = w.armies || [];
        let army = w.armies.find(a => a.nat === w.player);
        if(!army){
          army = { id: 'army_p1', nat: w.player, divisions: [], executing: false, planning: 0.5 };
          w.armies.push(army);
        }
        army.executing = !army.executing;
        if(army.executing){
          btnExec.style.background = 'linear-gradient(180deg, #dc2626 0%, #991b1b 100%)';
          btnExec.querySelector('span').textContent = '暂停推进';
          showToast('🚩 最高统帅部命令：全线启动攻势作战！');
        } else {
          btnExec.style.background = 'linear-gradient(180deg, #15803d 0%, #14532d 100%)';
          btnExec.querySelector('span').textContent = '启动执行';
          showToast('⏸ 前线作战计划已暂停就地防守');
        }
      });
    }
  }

  update(){
    const n = this.store.world.nations[this.store.world.player];
    const w = this.store.world;
    if(!n) return;

    const pTag = w.player;
    const fullTag = { G: 'GER', P: 'POL', F: 'FRA', B: 'GBR', S: 'SOV', U: 'USA', R: 'RUS' }[pTag] || pTag;

    // 1. 日期与战役历时
    let dateStr = '';
    if(w.era === 'ww1'){
      const d = new Date(new Date(1914, 6, 28).getTime() + w.day * 86400000);
      dateStr = `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;
    } else if(w.era === 'coldwar'){
      const m = w.day;
      const yr = 1949 + Math.floor(m / 12);
      const mo = (m % 12) + 5;
      dateStr = `${yr}年${mo > 12 ? mo - 12 : mo}月`;
    } else if(w.era === 'modern'){
      dateStr = `2022年 · 第 ${w.day} 周`;
    } else {
      const d = new Date(new Date(1939, 8, 1).getTime() + w.day * 86400000);
      dateStr = `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;
    }

    const dateEl = document.getElementById('sf-date');
    if(dateEl) dateEl.textContent = dateStr;

    const dayCountEl = document.getElementById('sf-day-count');
    if(dayCountEl) dayCountEl.textContent = `战役历时: 第 ${w.day + 1} 天`  // v9.5 U1：显示层 +1，战役没有第 0 天;

    // 2. 领袖看板更新
    const leader = (w.characters || []).find(c => (c.nat === pTag || c.nat === fullTag) && c.type === 'leader');
    const leaderId = leader ? leader.id : (
      w.era === 'ww1' ? (fullTag === 'GER' ? 'wilhelm2' : 'nicholas2') :
      w.era === 'coldwar' ? (fullTag === 'GER' ? 'adenauer' : 'truman') :
      w.era === 'modern' ? (fullTag === 'UKR' ? 'zelensky' : 'putin') :
      (fullTag === 'GER' ? 'hitler' : (fullTag === 'SOV' ? 'stalin' : 'churchill'))
    );

    const leaderPortWrap = document.getElementById('hud-leader-portrait');
    if(leaderPortWrap && !leaderPortWrap._renderedId || leaderPortWrap._renderedId !== leaderId){
      leaderPortWrap._renderedId = leaderId;
      leaderPortWrap.innerHTML = renderLeaderPortraitHtml(leaderId);
    }

    const flagWrap = document.getElementById('hud-nation-flag-wrap');
    if(flagWrap && !flagWrap._renderedTag || flagWrap._renderedTag !== fullTag){
      flagWrap._renderedTag = fullTag;
      flagWrap.innerHTML = renderFlagHtml(fullTag, 28, 18);
    }

    const titleEl = document.getElementById('hud-nation-title');
    if(titleEl){
      const formalName = n.name || fullTag;
      const shortDisplay = formalName.length > 7 ? (formalName.includes('苏维埃') ? '苏联 · 苏维埃联盟' : formalName.slice(0, 6) + '…') : formalName;
      titleEl.textContent = shortDisplay;
      titleEl.title = `${formalName}（全称）`;
    }

    const ideoEl = document.getElementById('hud-ideology-badge');
    if(ideoEl){
      const lawNames = { peace: '和平主义', early_mob: '早期动员', partial: '部分动员', war: '全面战争', total: '总动员' };
      ideoEl.textContent = lawNames[n.law] || '最高统帅部';
    }

    // 国策环形进度条
    const focusText = document.getElementById('hud-focus-text');
    const focusArc = document.getElementById('hud-focus-arc-path');
    if(n.focus && n.focus.active){
      const allF = focusesFor(w, w.player);
      const fObj = allF.find(x => x.id === n.focus.active);
      const fName = fObj ? fObj.name : n.focus.active;
      const fDays = (fObj && fObj.days) || 70;
      const pct = Math.min(100, Math.round((n.focus.progress / fDays) * 100));
      const fqSlot2 = document.getElementById('hud-focus-quick-slot');
      if(fqSlot2) fqSlot2.classList.remove('cta');
      if(focusText) focusText.innerHTML = `国策: <b>${fName}</b> (${n.focus.progress}/${fDays}天)`;
      if(focusArc) focusArc.setAttribute('stroke-dasharray', `${pct}, 100`);
    } else {
      if(focusText) focusText.innerHTML = `国策: <b style="color:var(--dim)">待下达</b> (点击选取)`;
      const fqSlot = document.getElementById('hud-focus-quick-slot');
      if(fqSlot) fqSlot.classList.add('cta');
      if(focusArc) focusArc.setAttribute('stroke-dasharray', `0, 100`);
    }

    // 3. 宏观战略资源指标条（平滑横向滚轮支持）
    const ribbonEl = document.getElementById('hud-strategic-ribbon');
    if(ribbonEl && !ribbonEl._wheelBound){
      ribbonEl._wheelBound = true;
      ribbonEl.addEventListener('wheel', e => {
        if(e.deltaY !== 0){
          e.preventDefault();
          ribbonEl.scrollLeft += e.deltaY;
        }
      }, { passive: false });
    }

    const ppEl = document.getElementById('sf-pp');
    if(ppEl) ppEl.textContent = Math.floor(n.pp);

    const cpEl = document.getElementById('sf-cp');
    if(cpEl) cpEl.textContent = `${Math.floor(n.commandPower != null ? n.commandPower : 100)}/200`;

    const xpEl = document.getElementById('sf-xp');
    if(xpEl) xpEl.textContent = `${Math.floor(n.armyXp != null ? n.armyXp : 50)}`;

    // 3.1 v7.0 E4：战略资源汇总 + 燃料储备（悬停下钻 B.4 赤字公式）
    const resStrip = document.getElementById('sf-res-strip');
    if(resStrip){
      const fr = Math.floor(n.fuelReserve || 0);
      const deficits = [];
      let detailedTips = [];
      for(const r of RESOURCE_TYPES){
        const stock = Math.floor((n.resourceStock || {})[r] || 0);
        const def = Math.ceil((n._resourceDeficit || {})[r] || 0);
        const meta = RESOURCES[r];
        if(def > 0) deficits.push(`${meta.icon}${def}`);
        const base = (NATION_RESOURCE_BASE[w.player] || {})[r] || 0;
        detailedTips.push(`${meta.icon} ${meta.name}：库存 ${stock} · 产出 +${base}/天 ${def > 0 ? `(⚠️赤字 ${def}/天)` : '✓'}`);
      }
      const fuelHtml = `<span style="display:inline-flex;align-items:center;gap:2px;color:${n._fuelStarving ? '#f87171' : '#fbbf24'};">⛽<b>${fr}</b></span>`;
      // v9 精修：正常态不渲染「✓平稳」章（HOI4 惯例：异常才占用顶栏宽度），异常态红色告警
      const deficitHtml = deficits.length > 0
        ? `<span style="color:#f87171;font-weight:700;">⚠️缺${deficits.join(' ')}</span>`
        : '';
      resStrip.innerHTML = deficits.length > 0
        ? `${fuelHtml}<span style="opacity:0.35;">|</span>${deficitHtml}`
        : fuelHtml;
      const resItem = resStrip.closest('.sf-ribbon-item');
      if(resItem){
        resItem.title = `宏观战略资源池与燃料储备：\n⛽ 燃料储备: ${fr} (炼化 +${((NATION_RESOURCE_BASE[w.player] || {}).oil || 0) * 2}/天)\n───────────────────────\n${detailedTips.join('\n')}\n───────────────────────\n赤字影响：产线效率上限按缺失比削减，详情见左侧工业流水线`;
      }
    }

    const tensionEl = document.getElementById('sf-tension');
    if(tensionEl && w.tension){
      tensionEl.textContent = `${Math.round(w.tension.value)}%`;
      const tip = (w.tension.sources || []).slice(0, 8).map(s => `第${s.day}天: ${s.text} (+${s.value}%)`).join('\n');
      tensionEl.parentElement.title = tip ? `当前紧张度: ${w.tension.value}%\n最近事件:\n${tip}` : `世界紧张度: ${w.tension.value}%`;
    }

    const stabEl = document.getElementById('sf-stab-war');
    if(stabEl){
      // 兼容 0-1 与 0-100 两种存储口径（修复 6500% 双重缩放）
      const norm = v => v == null ? 0 : Math.round(v > 1 ? v : v * 100);
      const stab = norm(n.stability);
      const war = norm(n.warSupport);
      stabEl.textContent = `${stab}% / ${war}%`;
    }

    // v14.0 P2：人力池显示（HOI4 式"可用人力 / 上限"，池枯竭时标红）
    const mpEl = document.getElementById('sf-manpower');
    if(mpEl){
      let mp, mpCap = null, mpRatio = 1;
      if(n.manpowerCap != null){
        mp = Math.floor(n.manpowerPool || 0);
        mpCap = Math.floor(n.manpowerCap);
        mpRatio = mpCap > 0 ? mp / mpCap : 0;
      } else {
        mp = Math.round((n.civ * 180000 + n.mil * 120000) * 1.5);
      }
      mpEl.textContent = (mp >= 1000000 ? (mp / 1000000).toFixed(2) + 'M' : mp >= 1000 ? Math.round(mp / 1000) + 'K' : mp)
        + (mpCap ? ' / ' + Math.round(mpCap / 1000) + 'K' : '');
      const item = mpEl.closest ? mpEl.closest('.sf-ribbon-item') : null;
      if(item){
        item.style.color = mpRatio < 0.05 ? '#f87171' : '';
        item.title = mpCap
          ? ('人力池 ' + mp.toLocaleString() + ' / ' + mpCap.toLocaleString() + '\n'
             + '受征兵法（' + ({volunteer:'志愿兵役 1.5%', limited:'有限征兵 2.5%', extensive:'广泛征兵 5%', service_by_requirement:'强制服役 10%'}[n.law] || n.law) + '）与领土人口决定上限\n'
             + '训练新师与战场补员都从这里扣除；池枯竭则无法扩充与补员')
          : '可动员人力储备 (可征召/服役)';
      }
    }

    const milEl = document.getElementById('sf-mil');
    if(milEl) milEl.textContent = n.mil;

    const civEl = document.getElementById('sf-civ');
    if(civEl) civEl.textContent = n.civ;

    const equipEl = document.getElementById('sf-equip');
    if(equipEl) equipEl.textContent = Math.floor(n.equip);

    const divEl = document.getElementById('sf-div');
    if(divEl) divEl.textContent = w.units.filter(u => u.nat === w.player).length;

    // 难度按钮与音效按钮
    const diffBtn = document.getElementById('sf-diff-btn');
    if(diffBtn){
      const diffObj = K.DIFFICULTIES[w.difficulty || 'general'] || K.DIFFICULTIES.general;
      const dName = diffObj.name.split('(')[0];
      diffBtn.textContent = dName;
      diffBtn.title = `切换游戏难度 (当前: ${diffObj.name})`;
    }

    const audioBtn = document.getElementById('sf-audio-btn');
    if(audioBtn){
      audioBtn.textContent = sound.isMuted() ? '🔇' : '🔊';
      audioBtn.title = sound.isMuted() ? '点击开启音效' : '点击静音';
    }

    // 速度按钮高亮
    document.querySelectorAll('[data-speed]').forEach(b => {
      b.classList.toggle('active', w.speed > 0 && +b.dataset.speed === w.speed);
    });

    // 4. 底栏集团军群将领带 (524张将领肖像全面入轨实装)
    this.updateGeneralsStrip(w, fullTag, n);
  }

  updateGeneralsStrip(w, fullTag, n){
    const strip = document.getElementById('hud-generals-strip');
    if(!strip) return;

    // 获取我方将领
    let generals = (w.characters || []).filter(c => (c.nat === w.player || c.nat === fullTag) && c.type === 'general');
    if(!generals.length){
      // 备用名将保底
      generals = [
        { id: 'manstein', name: '曼施坦因', rank: 'marshal', skill: 5 },
        { id: 'guderian', name: '古德里安', rank: 'general', skill: 4 },
        { id: 'rommel', name: '隆美尔', rank: 'general', skill: 4 },
        { id: 'rundstedt', name: '伦德施泰特', rank: 'marshal', skill: 4 }
      ];
    }

    const activeGid = this.activeGeneralId || generals[0].id;
    const playerDivs = w.units.filter(u => u.nat === w.player);

    let html = '';
    for(const g of generals){
      const isSel = g.id === activeGid;
      const isMarshal = (g.rank === 'marshal');
      const rankStars = isMarshal ? '★★★★★' : '★★★';
      const divCount = isSel ? Math.min(24, playerDivs.length) : Math.floor(playerDivs.length / generals.length);

      html += `
        <div class="sf-general-card ${isSel ? 'active' : ''}" data-general-id="${g.id}" title="${g.name} · ${isMarshal ? '陆军元帅' : '战区上将'}">
          <div class="sf-general-rank-badge">${rankStars}</div>
          <div class="sf-general-div-badge" title="编组所辖师数 / 上限">${divCount}/24</div>
          ${renderGeneralPortraitHtml(g, 80, 58)}
          <div class="sf-general-card-meta">
            <span class="sf-general-card-name" title="${g.name}">${g.name.split('·').pop()}</span>
          </div>
        </div>
      `;
    }

    // v9.5 U5：将领带空槽补位（最多 6 槽）—— 填空 + 「编组新军」功能入口
    const cardCount = (html.match(/data-general-id/g) || []).length;
    for(let i = cardCount; i < 6; i++){
      html += `<div class="sf-general-card empty" data-sf-open-chars title="打开统帅部，任命将领组建新军">
        <span class="plus">＋</span><span>编组新军</span></div>`;
    }

    strip.innerHTML = html;

      // v9.5 U5：空槽点击 → 打开统帅面板
      strip.querySelectorAll('[data-sf-open-chars]').forEach(slot => {
        slot.addEventListener('click', () => {
          sound.playClick();
          const btn = document.getElementById('sf-chars-btn');
          if(btn) btn.click();
        });
      });

      // 绑定点击选中将领与调阅档案
      strip.querySelectorAll('[data-general-id]').forEach(card => {
        card.addEventListener('click', () => {
          sound.playClick();
          const prevId = this.activeGeneralId;
          this.activeGeneralId = card.dataset.generalId;
          if(prevId === this.activeGeneralId){
            // 再次点击已选将领，调阅 512×640 履历全案
            openCharacterDossier(this.activeGeneralId, this.store, () => this.updateGeneralsStrip(w, fullTag, n));
          } else {
            // §6.4：履历卡改为上浮覆盖层，点击将领卡才展开（不再常驻占版面）
            this._showGeneralDetail = true;
            showToast(`🎖️ 已选中统帅：${card.title.split('·')[0]} (再点一次调阅档案)`);
            this.updateGeneralsStrip(w, fullTag, n);
          }
        });
      });

      // 将领详情块（人员介绍系统：技能四维/简历/所辖部队）
      const detailEl = document.getElementById('sf-general-detail');
      if(detailEl){
        const g = generals.find(x => x.id === this.activeGeneralId) || generals[0];
        detailEl.innerHTML = generalDetailHtml(w, g, playerDivs);
        // §6.4：履历卡为上浮覆盖层 —— 仅在玩家点击将领卡后展开
        detailEl.classList.toggle('on', !!this._showGeneralDetail);
        const dossierBtn = detailEl.querySelector('#btn-open-general-dossier');
        if(dossierBtn){
          dossierBtn.addEventListener('click', () => {
            sound.playClick();
            openCharacterDossier(g, this.store, () => this.updateGeneralsStrip(w, fullTag, n));
          });
        }
      }
    }
  }

function generalDetailHtml(w, g, playerDivs){
    if(!g) return '';
    const isMarshal = g.rank === 'marshal';
    const skill = g.skill || 4;
    const planMax = Math.min(80, 30 + skill * 5);
    const dossier = getCharacterDossier(g, w);
    const bio = (dossier && dossier.bio) ? dossier.bio : `${g.name}，高级战区统帅。精通诸兵种协同战役穿插与防线构筑。`;

    // 格式化所辖编制，杜绝“步兵、步兵、步兵”
    const counts = {};
    for(const u of playerDivs){ counts[u.type] = (counts[u.type] || 0) + 1; }
    const names = { inf:'近卫步兵师', cav:'骑兵师', mtn:'山地师', mot:'摩托化机械师', larm:'轻装甲师', arm:'重装甲坦克师' };
    const divList = Object.entries(counts).map(([t, cnt]) => `${names[t] || t} ×${cnt}`).join(' · ');

    return `<div class="gd-box">
      <div class="gd-head" style="display:flex;justify-content:space-between;align-items:center;">
        <span>${g.name} · ${isMarshal ? '陆军元帅' : '战区上将'} · 技能 ★${skill}</span>
        <button class="btn gold btn-sm" id="btn-open-general-dossier">📜 调阅 512×640 军官履历全案</button>
      </div>
      <div class="gd-stats">进攻 ★${dossier?.skills?.attack || skill} / 防御 ★${dossier?.skills?.defense || Math.max(1, skill-1)} / 筹划 ★${dossier?.skills?.planning || skill} / 后勤 ★${dossier?.skills?.logistics || Math.max(1, skill-1)} · 指挥上限 24 师${isMarshal ? '（集团军群：5 个军）' : ''} · 计划加成上限 +${planMax}%</div>
      <div class="gd-bio" style="line-height:1.6;color:#cbd5e1;font-size:11.5px;margin:4px 0;">${bio}</div>
      <div class="gd-divs" style="font-size:11px;color:#94a3b8;">所辖编组（${playerDivs.length} 师）：<b style="color:#ffd977">${divList || '统帅部预备待命'}</b></div>
    </div>`;
  }


export class LogPanel {
  constructor(store, el){
    this.store = store;
    this.el = el;
  }
  update(){
    this.el.innerHTML = this.store.world.log.slice(0, 14).map(l =>
      `<div class="logline ${l.kind}"><span class="ld">D${l.day}</span>${l.text}</div>`).join('');
  }
}

export class Panels {
  constructor(store, ui){
    this.store = store;
    this.ui = ui;
    this.info = document.getElementById('sf-info');
    this.prod = document.getElementById('sf-prod');
    this.drawer = document.getElementById('sf-side-drawer');
    this.activeDrawerTab = 'prod';
    this.activeGeneralId = this.activeGeneralId || null;
    this.expandedProdType = null;
    this.expandedUnitId = null;
    // v14.1 E4：右轨三键对应的右面板页签（null = 默认选格详情视图）
    this.activeInfoTab = null;
    this._lastSelKey = '';
    // v14.1 E4：panelArmy.js 激活（野战军页签，容器常驻避免事件反复重绑）
    this.armyPanel = null;
    this.armyPanelHost = document.getElementById('sf-army-panel');
    this.initDrawerTabs();
    this.initInfoTabs();
    this.bindIndicatorDetails();
    this.bindDetailDelegation();
  }

  /* v14.1 E4：右面板页签（战区情报 / 地形修正 / 驻防名册）。
     再点一次当前页签 = 退回默认的选格详情视图。 */
  initInfoTabs(){
    if(!this.info) return;
    const tabs = document.querySelectorAll('.sf-info-tab-btn');
    tabs.forEach(btn => {
      btn.addEventListener('click', () => {
        sound.playClick();
        const id = btn.dataset.infoTab;
        this.activeInfoTab = (this.activeInfoTab === id) ? null : id;
        tabs.forEach(b => b.classList.toggle('active', b.dataset.infoTab === this.activeInfoTab));
        this.update();
      });
    });
  }

  setActiveInfoTab(id){
    const tabs = document.querySelectorAll('.sf-info-tab-btn');
    this.activeInfoTab = id;
    tabs.forEach(b => b.classList.toggle('active', b.dataset.infoTab === id));
    this.update();
  }

  /* 详情展开系统：点击单位行/生产线卡片 → 展开完整档案介绍 */
  bindDetailDelegation(){
    if(this._detailBound) return;
    this._detailBound = true;
    this.info.addEventListener('click', e => {
      const row = e.target.closest('.unit-row');
      if(!row) return;
      const uid = +row.dataset.uid;
      sound.playClick();
      this.expandedUnitId = (this.expandedUnitId === uid ? null : uid);
      this.update();
    });
    this.prod.addEventListener('click', e => {
      if(e.target.closest('.btn-mini') || e.target.closest('[data-train]') || e.target.closest('[data-deploy]')) return;
      const card = e.target.closest('.sf-prod-card');
      if(!card || !card.dataset.lineType) return;
      sound.playClick();
      const lt = card.dataset.lineType;
      this.expandedProdType = (this.expandedProdType === lt ? null : lt);
      this.update();
    });
  }

  /* 指标详情系统：顶栏每个指示器点击弹出完整说明与明细 */
  bindIndicatorDetails(){
    const map = { 'sf-pp':'pp', 'sf-cp':'cp', 'sf-xp':'xp', 'sf-tension':'tension',
                  'sf-stab-war':'stabwar', 'sf-equip':'equip', 'sf-div':'div', 'sf-mil':'factory' };
    for(const [elId, key] of Object.entries(map)){
      const el = document.getElementById(elId);
      if(!el) continue;
      const item = el.closest('.sf-ribbon-item') || el;
      if(item._indBound) continue;
      item._indBound = true;
      item.style.cursor = 'pointer';
      item.addEventListener('click', () => {
        sound.playClick();
        openIndicatorModal(this.store, key);
      });
    }
  }

  initDrawerTabs(){
    const tabBtns = document.querySelectorAll('.sf-drawer-tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        sound.playClick();
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeDrawerTab = btn.dataset.tab;
        this.update();
      });
    });
  }

  update(){
    const w = this.store.world;
    const n = w.nations[w.player];
    if(!n) return;

    // v14.1 E4：野战军页签 —— 内容渲染到常驻的 sf-army-panel（ArmyPanel 自管事件），
    // 其余页签仍写 sf-prod；两容器互斥显示。
    if(this.activeDrawerTab === 'army' && this.armyPanelHost){
      this.prod.style.display = 'none';
      this.armyPanelHost.style.display = '';
      if(!this.armyPanel){
        this.armyPanel = new ArmyPanel(this.store, this.ui, this.armyPanelHost);
      }
      this.armyPanel.update();
      return;
    }
    this.prod.style.display = '';
    if(this.armyPanelHost) this.armyPanelHost.style.display = 'none';

    let html = '';

    // ===== TAB 1: 工业流水线 (带有装备三视图白线蓝图) =====
    if(this.activeDrawerTab === 'prod'){
      const allocated = (n.productionLines || []).reduce((sum, l) => sum + (l.factories || 0), 0);
      const freeMil = Math.max(0, n.mil - allocated);
      html += `<div style="font-size:12px;font-weight:700;color:var(--brass-bright);margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;">
        <span>军工总装流水线</span>
        <span style="font-size:11px;">空闲: <b style="color:${freeMil > 0 ? 'var(--hp-green-glow)' : 'var(--dim)'}">${freeMil}</b> / 总军厂: <b style="color:#f87171">${n.mil}</b></span>
      </div>`;

      if(n.productionLines && n.productionLines.length){
        const eqNames = K.EQUIP_NAMES || {};
        for(const line of n.productionLines){
          const nm = eqNames[line.type] || line.type;
          const stock = Math.floor(n.equipment ? (n.equipment[line.type] || 0) : 0);
          const effPct = Math.round(line.eff * 100);
          const daily = (line.factories * K.MIL_OUTPUT * line.eff / (K.EQUIP_COSTS[line.type] || 1)).toFixed(1);
          const bpSrc = getBlueprintSrc(line.type);

          html += `
            <div class="sf-prod-card" data-line-type="${line.type}">
              <img class="sf-prod-blueprint" src="${bpSrc}" alt="${nm}">
              <div class="sf-prod-head">
                <span class="sf-prod-title">⚙️ ${nm}</span>
                <span class="sf-prod-stock">库存 <b>${stock}</b> 件</span>
              </div>
              <div class="sf-prod-eff-row">
                <span>效率 ${effPct}%</span>
                <div class="sf-eff-meter"><div class="sf-eff-fill" style="width:${effPct}%"></div></div>
                <span style="color:var(--hp-green-glow)">+${daily}/天</span>
              </div>
              <div class="sf-prod-ctrl-row">
                <span style="font-size:11px;color:var(--dim)">生产线军厂:</span>
                <div class="sf-factory-stepper" style="display:flex;align-items:center;gap:6px;">
                  <button class="btn-mini" data-line-sub="${line.id}">-</button>
                  <input type="range" min="0" max="${Math.max(15, n.mil)}" value="${line.factories}" data-line-slider="${line.id}" style="width:75px;accent-color:var(--gold);cursor:pointer;" title="拖动滑块分配工厂数">
                  <span class="sf-factory-count" style="min-width:18px;text-align:center;">${line.factories}</span>
                  <button class="btn-mini" data-line-add="${line.id}">+</button>
                </div>
              </div>
            </div>
            ${this.expandedProdType === line.type ? `<div class="prod-detail" style="margin-bottom:8px;">${prodDetailHtml(w, line.type)}</div>` : ''}
          `;
        }
      }
    }

    // ===== TAB 2: 部队招募与训练动员 =====
    else if(this.activeDrawerTab === 'recruit'){
      html += `<div style="font-size:12px;font-weight:700;color:var(--brass-bright);margin-bottom:6px;">部队动员与建制编成</div>
        <div class="sf-recruit-grid">`;
      for(const [t, nm, cost] of [['inf','步兵师',400],['cav','骑兵师',350],['mtn','山地师',480],['mot','摩托化师',700],['arm','重装甲师',1400]]){
        html += `
          <button class="sf-recruit-btn" data-train="${t}">
            <span class="sf-recruit-name">🪖 ${nm}</span>
            <span class="sf-recruit-cost">消耗 ${cost} 点</span>
          </button>
        `;
      }
      html += `</div>`;
    }

    // ===== TAB 3: 训练队列与待部署池 =====
    else if(this.activeDrawerTab === 'queue'){
      html += `<div style="font-size:12px;font-weight:700;color:var(--brass-bright);margin-bottom:6px;">部队训练与部署状态</div>`;

      if(n.pool && n.pool.length){
        html += `
          <div style="background:rgba(34,197,94,0.15);border:1px solid #22c55e;border-radius:4px;padding:8px 10px;margin-bottom:10px;">
            <div style="font-size:12px;font-weight:bold;color:var(--hp-green-glow);margin-bottom:4px;">★ 待部署新师 ×${n.pool.length}</div>
            <button class="btn gold" style="width:100%" data-deploy>在所选己方省份部署</button>
          </div>
        `;
      }

      if(n.training && n.training.length){
        html += '<div style="font-size:11px;color:var(--dim);margin-bottom:4px;">军校训练队列:</div>';
        for(const t of n.training){
          const u = { inf:[400,90], cav:[350,60], mtn:[480,120], mot:[700,120], larm:[900,140], arm:[1400,180] }[t.type] || [400,90];
          const pct = Math.floor(t.costPaid / u[0] * 100);
          html += `
            <div style="background:#181f2b;border:1px solid #2d3748;border-radius:3px;padding:6px 8px;margin-bottom:6px;">
              <div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--ink);margin-bottom:3px;">
                <span>${({inf:'步兵师',cav:'骑兵师',mtn:'山地师',mot:'摩托化师',larm:'轻装师',arm:'装甲师'})[t.type]}</span>
                <span style="font-family:var(--font-mono);color:var(--brass-bright)">${pct}% · ${t.days}/${u[1]}天</span>
              </div>
              <div class="sf-eff-meter" style="margin:0"><div class="sf-eff-fill" style="width:${pct}%"></div></div>
            </div>
          `;
        }
      } else {
        html += `<div style="font-size:12px;color:var(--dim);text-align:center;padding:20px;">当前训练队列空闲</div>`;
      }

      if(n.build && n.build.kind){
        const qLen = (n.buildQueue || []).length;
        html += `<div style="margin-top:10px;font-size:11.5px;color:var(--brass-bright);border-top:1px dashed #334155;padding-top:8px;">
          🔨 工兵扩建：${n.build.kind==='mil'?'军工厂':n.build.kind==='civ'?'民工厂':n.build.kind==='infra'?'基础设施':n.build.kind==='air_base'?'空军基地':n.build.kind==='naval_base'?'海军基地':n.build.kind}（${Math.floor(n.build.prog)}/${n.build.need}点）${qLen ? ` · 队列等待 ${qLen} 项` : ''}
        </div>`;
      } else if((n.buildQueue || []).length){
        html += `<div style="margin-top:10px;font-size:11.5px;color:var(--brass-bright);border-top:1px dashed #334155;padding-top:8px;">
          🔨 建造队列：等待 ${n.buildQueue.length} 项（下一项 ${n.buildQueue[0].kind==='mil'?'军工厂':n.buildQueue[0].kind}）
        </div>`;
      }
    } else if(this.activeDrawerTab === 'air'){
      renderAirPanel(this.prod, this.store);
      return;
    } else if(this.activeDrawerTab === 'navy'){
      renderNavyPanel(this.prod, this.store);
      return;
    } else if(this.activeDrawerTab === 'intel'){
      renderIntelPanel(this.prod, this.store);
      return;
    } else if(this.activeDrawerTab === 'doctrine'){
      renderDoctrinePanel(this.prod, this.store);
      return;
    } else if(this.activeDrawerTab === 'trade'){
      renderTradePanel(this.prod, this.store);
      return;
    } else if(this.activeDrawerTab === 'stats'){
      renderStatsPanel(this.prod, this.store);
      return;
    } else if(this.activeDrawerTab === 'era'){
      // v11.0：时代专属机制总算有了入口
      this.prod.innerHTML = '';
      this.prod.appendChild(renderEraPanel(this.store.world, { toast: showToast }));
      return;
    } else if(this.activeDrawerTab === 'decisions'){
      // v14.0 P2：决议系统（HOI4 节奏释放阀）
      renderDecisions(this.prod, this.store);
      return;
    } else if(this.activeDrawerTab === 'research'){
      // v14.0 P4：科研科技树（此前科技无 UI 入口，等于沉睡系统）
      renderResearchPanel(this.prod, this.store);
      return;
    }

    this.prod.innerHTML = html;

    // —— v14.1 E4：右面板页签视图（右轨三键 / 手点页签皆可进入）——
    // 点选地块会切换 ui.selHex，此时自动退回默认的选格详情视图。
    const selKey = this.ui.selHex ? (this.ui.selHex.q + ',' + this.ui.selHex.r) : '';
    if(selKey !== this._lastSelKey){
      this._lastSelKey = selKey;
      this.activeInfoTab = null;
      document.querySelectorAll('.sf-info-tab-btn').forEach(b => b.classList.remove('active'));
    }
    if(this.activeInfoTab){
      if(this.activeInfoTab === 'theater') this.info.innerHTML = this.theaterOverviewHtml(w, n);
      else if(this.activeInfoTab === 'terrain') this.info.innerHTML = this.terrainModsHtml(w);
      else if(this.activeInfoTab === 'garrison') this.info.innerHTML = this.garrisonRosterHtml(w);
      return;
    }

    // —— 选中地块与部队情报详情 / 战区战略总览 ——
    if(!this.ui.selHex){
      this.info.innerHTML = this.theaterOverviewHtml(w, n);
      return;
    }


    if(!h){ this.info.innerHTML = ''; return; }
    const nat = w.nations[h.owner];
    const terrainData = K.TERRAIN_COMBAT_WIDTH[h.terrain] || { base: 80, flank: 40, name: h.terrain };
    const tDef = TERRAIN[h.terrain] || { def: 1.0, atk: 1.0, name: h.terrain };
    const weather = getHexWeather(w, h);
    const weatherNames = { clear: '晴朗无阻', mud: '深秋泥泞 (航速 -50%)', snow: '极寒暴雪 (损耗 +25%)' };
    // v9.5 U3：标题三级（城市名 > 地形区名 > 战区），坐标降为小字副标题
    const titleInfo = hexTitleInfo(h);
    const state = (w.stateById && h.stateId) ? w.stateById[h.stateId] : null;
    const climateNames = { temperate:'温带气候', arctic:'寒带极地', mediterranean:'地中海气候', arid:'干旱沙漠', tropical:'热带气候', ocean:'海洋气候' };
    const climateDesc = climateNames[h.climate] || h.climate || '温带气候';
    const resList = [];
    if(h.resources){
      const resLabels = { oil:'石油', rubber:'橡胶', aluminum:'铝', steel:'钢铁', tungsten:'钨', chromium:'铬' };
      for(const k in h.resources){
        if(h.resources[k] > 0) resList.push(`${resLabels[k] || k}+${h.resources[k]}`);
      }
    }

    let out = `
      <div class="ph-header" style="border-bottom:1px solid #334155;padding-bottom:8px;margin-bottom:8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div class="ph-name">${titleInfo.title}${h.city && h.city.cap ? ' ★ 首都' : ''}</div>
          <div>${renderFlagHtml(h.owner, 28, 18)}</div>
        </div>
        <div class="ph-meta" style="margin-top:4px;">
          归属主权：<b style="color:#ffd977">${nat ? nat.name : h.owner}</b>
          ${state ? ` · 所属行省：<b style="color:#60a5fa">${state.name}</b>` : ''}
          ${h.city ? ` · 战略胜利点 <b style="color:#ffd977">${h.city.w} VP</b>` : ''}
          ${titleInfo.subtitle ? ` · <span style="color:#64748b;font-size:10px;">${titleInfo.subtitle}</span>` : ''}
        </div>
      </div>

      <!-- 地形与战场宽度战术详报 -->
      <div style="background:rgba(15,23,42,0.6);border:1px solid #334155;border-radius:4px;padding:8px;margin-bottom:8px;">
        <div style="color:#cbd5e1;font-weight:bold;margin-bottom:4px;font-size:11px;">🏞️ 地形与战术修正</div>
        <div style="font-size:11px;color:#94a3b8;line-height:1.5;">
          地貌类型：<b style="color:#f1f5f9">${terrainData.name || h.terrain}</b> · 气候：<b style="color:#e2e8f0">${climateDesc}</b>${h.strait ? ' · ⚓ 战略海峡' : ''}${h.river ? ` · 🌊 ${h.river}` : ''}<br>
          战略资源：<b style="color:#e2e8f0">${resList.length ? resList.join(' · ') : '无'}</b> · 交通：<b>铁路 Lv${h.railLevel || 0}</b>${h.naval_base ? ` · <b>军港 Lv${h.naval_base}</b>` : ''}<br>
          战斗宽度：基础 <b>${terrainData.base}</b> · 侧翼进攻 <b>+${terrainData.flank}</b><br>
          防御修正：<b style="color:#4ade80">+${Math.round((tDef.def - 1) * 100)}%</b>${h.fort ? ` · 要塞工事 <b>Lv${h.fort} (+${h.fort * 15}%)</b>` : ''}<br>
          战区天候：<span style="color:#38bdf8">${weatherNames[weather] || weather}</span>
        </div>
      </div>
    `;

    if(h.owner === w.player){
      // v14.1 B5：建造面板 —— 5 类建筑、解除首都限制；军民工厂显示厂槽余量
      const slots = K.FACTORY_SLOTS_PER_HEX + (h.buildSlots || 0);
      const used = (h.civ || 0) + (h.mil || 0);
      const buildBtns = [
        ['mil', `🏗️ 军工厂 (${K.BUILD_COST.mil}点)`, used < slots],
        ['civ', `🏘️ 民用工厂 (${K.BUILD_COST.civ}点)`, used < slots],
        ['infra', `🛣️ 基础设施 (${K.BUILD_COST.infra}点)`, (h.infra || 0) < 10],
        ['air_base', `🛫 空军基地 (${K.BUILD_COST.air_base}点)`, true],
        ['naval_base', `⚓ 海军基地 (${K.BUILD_COST.naval_base}点)`, true]
      ];
      out += `
        <div style="margin:8px 0;display:grid;grid-template-columns:1fr 1fr;gap:4px;">
          ${buildBtns.map(([k, label, ok]) =>
            `<button class="btn ${ok ? 'gold' : ''}" style="padding:5px;font-size:10.5px;${ok ? '' : 'opacity:.45;pointer-events:none;'}" data-sfbuild="${k}"
              title="${k==='mil'||k==='civ' ? `厂槽 ${used}/${slots}` : '不占厂槽'}">${label}</button>`).join('')}
        </div>
      `;
      const qWait = (n.buildQueue || []).filter(b => b.q === h.q && b.r === h.r).length;
      if(n.build.kind && n.build.q === h.q && n.build.r === h.r){
        out += `<div style="font-size:11px;color:var(--brass-bright);margin-bottom:6px;">施工进度：${Math.floor(n.build.prog)} / ${n.build.need}${qWait ? ` · 本格排队 ${qWait} 项` : ''}</div>`;
      }
    }

    const us = h.units.map(id => w.units.find(x => x.id === id)).filter(Boolean);
    const names = { inf:'近卫步兵师', cav:'骑兵师', mtn:'山地师', mot:'摩托化机械师', larm:'轻装甲师', arm:'重装甲坦克师' };
    const natoIcons = { inf:'[X]', arm:'[⬭]', mot:'[⬭+X]', cav:'[╱]', mtn:'[⋏]', larm:'[⬭]' };

    if(us.length){
      out += `<div class="ph-units">
        <div style="font-size:11px;font-weight:bold;color:#cbd5e1;margin-bottom:4px;">🪖 驻防部队名册 (${us.length} 个师团)</div>
      `;
      for(const u of us){
        const U = UNITS[u.type] || { org: 60, hp: 100 };
        const uNat = w.nations[u.nat];
        const isSel = this.ui.selUnits.includes(u.id);
        const icon = natoIcons[u.type] || '[X]';

        out += `
          <div class="unit-row ${isSel ? 'sel' : ''}" data-uid="${u.id}">
            <div class="un">
              <span><b style="color:#ffd977;margin-right:4px;">${icon}</b> ${names[u.type] || u.type}${u.nat !== w.player ? ` <em>(${uNat ? uNat.name : u.nat})</em>` : ''}</span>
              <span style="font-family:var(--font-mono);font-size:11px;color:var(--brass-bright)">Lv${u.level || 1}</span>
            </div>
            <div class="bars">
              <div class="unit-bar-track" title="绿色兵员 HP"><div class="unit-bar-fill hp" style="width:${Math.min(100, u.hp/U.hp*100)}%"></div></div>
              <div class="unit-bar-track" title="黄色组织度 ORG"><div class="unit-bar-fill org" style="width:${Math.min(100, u.org/U.org*100)}%"></div></div>
            </div>
            <div class="stats">
              <span>兵员 ${Math.round(u.hp)}%</span>
              <span>组织度 ${Math.round(u.org)}/${U.org}</span>
              <span>堑壕 ${Math.floor((u.entrench || 0) * 100)}%</span>
            </div>
          </div>
          ${this.expandedUnitId === u.id ? `<div class="unit-detail">${unitDetailHtml(w, u)}</div>` : ''}
        `;
      }
      out += '</div>';
    } else {
      out += `<div style="font-size:11px;color:#64748b;padding:4px 0;">该地块当前暂无常驻作战部队。</div>`;
      // v9.5 U3：空州补一行战略价值，避免面板下半悬空
      out += `<div style="background:rgba(15,23,42,0.45);border:1px dashed #2e3a4d;border-radius:4px;padding:6px 8px;font-size:11px;color:#94a3b8;line-height:1.6;">
        <span style="color:#64748b;">战略价值</span>　胜利点 <b style="color:#cbd5e1">${h.city ? h.city.w : 0} VP</b>
        · 基建 <b style="color:#cbd5e1">Lv${h.infra || 0}</b>
        · 工业槽位 <b style="color:#cbd5e1">${(h.civ || 0) + (h.mil || 0)}</b>
      </div>`;
    }

    this.info.innerHTML = out;
  }

  /* —— v14.1 E4：战区情报视图（原「战略战区统帅总览」内联块提取复用）—— */
  theaterOverviewHtml(w, n){
    const myUnits = w.units.filter(u => u.nat === w.player && u.hp > 0);
    const inCombat = myUnits.filter(u => u.order && u.order.type === 'attack').length;
    const marching = myUnits.filter(u => u.order && u.order.type === 'advance').length;
    const garrison = myUnits.length - inCombat - marching;
    const counts = {};
    for(const u of myUnits){ counts[u.type] = (counts[u.type] || 0) + 1; }
    const unitTypeLabels = {
      inf: '步兵师', arm: '重型装甲师', larm: '轻装甲师',
      mot: '摩托化机械师', cav: '骑兵师', mtn: '山地猎兵师'
    };
    const wars = (n.atWarWith || []).map(t => w.nations[t]?.name || t).join('、') || '暂无交战国 (和平整备中)';
    const hubs = (w.hexes || []).filter(h => h.owner === w.player && h.city && h.city.w >= 3).length;
    return `
      <div class="theater-dossier-box">
        <div class="ph-name" style="font-size:16px;border-bottom:1px solid #334155;padding-bottom:6px;margin-bottom:8px;">
          🎖️ 战略战区统帅总览
        </div>
        <div style="font-size:11.5px;color:#94a3b8;margin-bottom:8px;line-height:1.5;">
          当前执政：<b style="color:#ffd977">${n.name}</b><br>
          交战态势：<span style="color:${n.atWarWith?.length ? '#ef4444' : '#22c55e'}">${wars}</span>
        </div>
        <div style="background:rgba(15,23,42,0.6);border:1px solid #334155;border-radius:4px;padding:8px;margin-bottom:8px;">
          <div style="color:#cbd5e1;font-weight:bold;margin-bottom:4px;font-size:11px;">⚔️ 战备兵力梯次</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:11px;color:#cbd5e1;">
            <span>现役总兵力: <b style="color:#ffd977">${myUnits.length}</b> 师</span>
            <span>前线突击: <b style="color:#ef4444">${inCombat}</b> 师</span>
            <span>战役机动: <b style="color:#38bdf8">${marching}</b> 师</span>
            <span>要塞卫戍: <b style="color:#22c55e">${garrison}</b> 师</span>
          </div>
        </div>
        <div style="background:rgba(15,23,42,0.6);border:1px solid #334155;border-radius:4px;padding:8px;margin-bottom:8px;">
          <div style="color:#cbd5e1;font-weight:bold;margin-bottom:4px;font-size:11px;">📋 师团编制分类统计</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:11px;color:#94a3b8;">
            ${Object.entries(counts).map(([t, cnt]) => `
              <div>${unitTypeLabels[t] || t}：<b style="color:#f1f5f9">${cnt}</b></div>
            `).join('')}
          </div>
        </div>
        <div style="background:rgba(15,23,42,0.6);border:1px solid #334155;border-radius:4px;padding:8px;margin-bottom:8px;">
          <div style="color:#cbd5e1;font-weight:bold;margin-bottom:4px;font-size:11px;">🚚 战区后勤保障态势</div>
          <div style="font-size:11px;color:#94a3b8;line-height:1.5;">
            核心补给枢纽：<b style="color:#ffd977">${hubs}</b> 处<br>
            国家工业厂力：<span style="color:#f87171">军工 ${n.mil || 0}</span> / <span style="color:#ffd977">民工 ${n.civ || 0}</span><br>
            装备库存总量：<b style="color:#38bdf8">${Math.floor(n.equip || 0)}</b> 点
          </div>
        </div>
        <div style="font-size:11px;color:#64748b;line-height:1.6;padding:4px;">
          💡 <b>战术作训指南</b>：<br>
          • 左键点击地图六角格：调阅省份战术档案与驻防部队<br>
          • 右键点击敌格：发动进攻突破；右键己方领土：战略机动<br>
          • 底部点击统帅头像：一键划设集团军前线与进攻矛头
        </div>
      </div>
    `;
  }

  /* —— v14.1 E4：地形修正视图（全军种通用的地形/战宽参照，高亮当前选格地貌）—— */
  terrainModsHtml(w){
    const selH = this.ui.selHex ? w.at[this.ui.selHex.q + ',' + this.ui.selHex.r] : null;
    const rows = Object.entries(K.TERRAIN_COMBAT_WIDTH).map(([key, tw]) => {
      const t = TERRAIN[key] || { def: 1.0, atk: 1.0, name: key, color: '#555' };
      const isSel = selH && selH.terrain === key;
      return `
        <div style="display:flex;align-items:center;gap:8px;font-size:11px;padding:5px 6px;border-radius:4px;${isSel ? 'background:rgba(216,183,79,0.14);border:1px solid #d8b74f;' : 'background:rgba(15,23,42,0.5);border:1px solid #2e3a4d;'}">
          <span style="width:12px;height:12px;border-radius:2px;flex:0 0 auto;background:${t.color || '#555'};"></span>
          <b style="color:#f1f5f9;flex:0 0 52px;">${t.name || key}</b>
          <span style="color:#94a3b8;flex:1;">攻 ${Math.round(((t.atk ?? 1) - 1) * 100)}% · 防 ${Math.round(((t.def ?? 1) - 1) * 100)}%</span>
          <span style="color:#38bdf8;flex:0 0 auto;">战宽 ${tw.base}${tw.flank ? ' +' + tw.flank : ''}</span>
        </div>
      `;
    }).join('');
    const wName = { clear:'晴朗', mud:'泥泞（移动 −50%）', snow:'暴雪（损耗 +25%）' };
    const selLine = selH
      ? `<div style="font-size:11px;color:#94a3b8;margin-bottom:6px;">当前选格：${(TERRAIN[selH.terrain] || {}).name || selH.terrain} · 天候 ${wName[getHexWeather(w, selH)] || '晴朗'}</div>`
      : `<div style="font-size:11px;color:#64748b;margin-bottom:6px;">点击地图六角格可高亮对应地貌。</div>`;
    return `
      <div class="theater-dossier-box">
        <div class="ph-name" style="font-size:15px;border-bottom:1px solid #334155;padding-bottom:6px;margin-bottom:8px;">📐 地形修正参照表</div>
        ${selLine}
        ${rows}
      </div>
    `;
  }

  /* —— v14.1 E4：驻防名册视图（全军师团按驻地/军建制罗列）—— */
  garrisonRosterHtml(w){
    const mine = w.units.filter(u => u.nat === w.player && u.hp > 0);
    if(!mine.length){
      return `<div style="font-size:12px;color:#64748b;padding:12px 4px;">当前无可指挥部队。</div>`;
    }
    const typeLabels = { inf:'步兵师', cav:'骑兵师', mtn:'山地师', mot:'摩托化师', larm:'轻装甲师', arm:'装甲师' };
    const armies = w.armies || [];
    const byArmy = new Map();
    for(const u of mine){
      const key = u.armyId || '_none';
      if(!byArmy.has(key)) byArmy.set(key, []);
      byArmy.get(key).push(u);
    }
    const rows = [...byArmy.entries()].map(([armyId, units]) => {
      const army = armies.find(a => a.id === armyId);
      const general = army && army.generalId ? (w.characters || []).find(c => c.id === army.generalId) : null;
      const title = army
        ? `🎖️ ${army.name}${general ? ` · ${general.name}` : ''}`
        : '📍 未编入野战军';
      const rowsU = units.map(u => {
        const U = UNITS[u.type] || { org: 60, hp: 100 };
        const h = w.at[u.q + ',' + u.r];
        const place = h && h.city ? h.city.name : `(${u.q},${u.r})`;
        return `
          <div class="unit-row ${this.ui.selUnits.includes(u.id) ? 'sel' : ''}" data-uid="${u.id}">
            <div class="un">
              <span><b style="color:#ffd977;margin-right:4px;">${typeLabels[u.type] || u.type}</b></span>
              <span style="color:#94a3b8;font-size:10.5px;">${place}</span>
            </div>
            <div class="bars">
              <div class="unit-bar-track"><div class="unit-bar-fill hp" style="width:${Math.min(100, u.hp / U.hp * 100)}%"></div></div>
              <div class="unit-bar-track"><div class="unit-bar-fill org" style="width:${Math.min(100, u.org / U.org * 100)}%"></div></div>
            </div>
          </div>
        `;
      }).join('');
      return `<div style="margin-bottom:10px;">
        <div style="font-size:11px;font-weight:bold;color:#cbd5e1;margin-bottom:4px;">${title}（${units.length} 师）</div>
        ${rowsU}
      </div>`;
    }).join('');
    return `
      <div class="theater-dossier-box">
        <div class="ph-name" style="font-size:15px;border-bottom:1px solid #334155;padding-bottom:6px;margin-bottom:8px;">📊 驻防名册（现役 ${mine.length} 师）</div>
        ${rows}
      </div>
    `;
  }

  bindProductionClicks(){
    this.prod.addEventListener('click', e => {
      const trainBtn = e.target.closest('[data-train]');
      if(trainBtn){
        sound.playClick();
        this.store.dispatch({ type:'TRAIN', unitType: trainBtn.dataset.train });
        this.update();
        return;
      }
      const depBtn = e.target.closest('[data-deploy]');
      if(depBtn && this.ui.selHex){
        sound.playClick();
        this.store.dispatch({ type:'DEPLOY', q: this.ui.selHex.q, r: this.ui.selHex.r });
        this.update();
        return;
      }
      const lineAdd = e.target.closest('[data-line-add]');
      if(lineAdd){
        sound.playClick();
        const lineId = lineAdd.dataset.lineAdd;
        const n = this.store.world.nations[this.store.world.player];
        const line = n.productionLines.find(l => l.id === lineId);
        if(line){
          const currentTotal = n.productionLines.reduce((s,l)=>s+l.factories, 0);
          if(currentTotal >= n.mil){
            showToast('⚠️ 无可用空闲军工厂，请先降低其他产线厂数');
          } else {
            this.store.dispatch({ type:'SET_LINE_FACTORIES', lineId, factories: line.factories + 1 });
            this.update();
          }
        }
        return;
      }
      const lineSub = e.target.closest('[data-line-sub]');
      if(lineSub){
        sound.playClick();
        const lineId = lineSub.dataset.lineSub;
        const line = this.store.world.nations[this.store.world.player].productionLines.find(l => l.id === lineId);
        if(line && line.factories > 0){
          this.store.dispatch({ type:'SET_LINE_FACTORIES', lineId, factories: line.factories - 1 });
          this.update();
        }
        return;
      }
    });

    const drawerEl = this.drawer || (typeof document !== 'undefined' && document.getElementById('sf-side-drawer')) || this.prod;
    if(drawerEl){
      drawerEl.addEventListener('input', e => {
        const slider = e.target.closest('[data-line-slider]');
        if(slider){
          const lineId = slider.dataset.lineSlider;
          const val = parseInt(slider.value, 10);
          if(!isNaN(val)){
            this.store.dispatch({ type:'SET_LINE_FACTORIES', lineId, factories: val });
            this.update();
          }
        }
      });
    }

    if(this.info){
      this.info.addEventListener('click', e => {
        const buildBtn = e.target.closest('[data-sfbuild]');
        if(buildBtn && this.ui.selHex){
          sound.playClick();
          // v14.1 B5：支持 5 类建筑（军民工厂占厂槽，基建/空海军基地不占）
          this.store.dispatch({ type:'BUILD', q: this.ui.selHex.q, r: this.ui.selHex.r, kind: buildBtn.dataset.sfbuild || 'mil' });
          this.update();
        }
      });
    }
  }
}

/* ============================================================
   国策树模态框与战略国策档案卡系统 (v7.0 §4.1 / E1)
   ============================================================ */
export function openFocusModal(store){
  let modal = document.getElementById('sf-focus-modal');
  if(!modal){
    modal = document.createElement('div');
    modal.id = 'sf-focus-modal';
    modal.className = 'sf-overlay';
    document.body.appendChild(modal);
  }
  renderFocusTree(store, modal);
  modal.classList.add('on');
}

function renderFocusTree(store, modal){
  const w = store.world;
  const natId = w.player;
  const n = w.nations[natId];
  const list = focusesFor(w, natId);
  const avail = availableFocuses(w, natId).map(f => f.id);

  const chainTitles = {
    industry: '⚙️ 工业与资源统制',
    army:     '⚔️ 陆战学说与军工',
    armor:    '🛡️ 装甲突击与兵器',
    air:      '✈️ 空军战备与空优',
    navy:     '⚓ 海军重整与大洋',
    politics: '🏛️ 战略外交与地缘',
    diplomacy:'🌐 国际同盟与阵营',
    economy:  '📈 国家金融与配给',
    social:   '📢 社会动员与治安',
    intel:    '🕵️ 绝密情报与破译',
    nuclear:  '☢️ 核物理与终极威慑',
    character:'🎖️ 统帅部军官整肃'
  };

  const chains = {};
  for(const k of ['industry', 'army', 'air', 'navy', 'politics']){
    chains[k] = { title: chainTitles[k] || k, items: [] };
  }

  for(const f of list){
    const c = f.chain || 'industry';
    if(!chains[c]) chains[c] = { title: chainTitles[c] || c, items: [] };
    chains[c].items.push(f);
  }

  // 清除无内容的预设链
  for(const k in chains){
    if(chains[k].items.length === 0) delete chains[k];
    else chains[k].items.sort((a,b) => a.y - b.y);
  }

  let html = `<div class="focus-modal-box">
    <div class="modal-header">
      <div style="display:flex;align-items:center;gap:12px;">
        ${renderFlagHtml(natId, 36, 24)}
        <div>
          <h2 class="modal-title">${n ? n.name : natId} · 最高国家战略与全量国策树</h2>
          <div class="modal-sub">点击任何国策节点即可展开 150+ 字深度历史考据档案、前置互斥分支与全国收益清单</div>
        </div>
      </div>
      <button class="btn" id="sf-close-focus">关闭 (ESC)</button>
    </div>
    <div class="focus-chains-grid" style="grid-template-columns: repeat(${Math.min(5, Math.max(3, Object.keys(chains).length))}, 1fr);">`;

  for(const k in chains){
    const col = chains[k];
    const motherIconSrc = getFocusMotherIconSrc(k);

    html += `<div class="focus-chain-col">
      <div class="focus-chain-title" style="display:flex;align-items:center;justify-content:center;gap:6px;">
        <img src="${motherIconSrc}" alt="${k}" style="width:24px;height:24px;object-fit:contain;filter:drop-shadow(0 0 4px rgba(212,175,55,0.4))">
        <span>${col.title}</span>
      </div>`;
    for(const f of col.items){
      const isDone = n.focus.done.includes(f.id);
      const isActive = n.focus.active === f.id;
      const isAvail = avail.includes(f.id);
      const statusClass = isDone ? 'done' : isActive ? 'active' : isAvail ? 'available' : 'locked';
      const statusText = isDone ? '已完成' : isActive ? `进行中 (${n.focus.progress}/${f.days || 70}天)` : isAvail ? '可签署' : '未解锁';

      const reqNames = (f.requires || []).map(r => (list.find(x => x.id === r) || { name: r }).name);
      const reqBadge = reqNames.length ? `<div style="font-size:10px;color:#718096;margin-bottom:3px;display:flex;align-items:center;gap:4px;">
        <span style="color:#d4af37">▲ 前置:</span> ${reqNames.join(' + ')}
      </div>` : '';

      html += `<div class="focus-node-card ${statusClass}" data-foc="${f.id}" title="点击调阅【${f.name}】战略档案" style="position:relative;">
        ${reqBadge}
        <div style="font-size:13px;font-weight:bold;color:var(--ink);display:flex;justify-content:space-between;align-items:center;">
          <span>${f.name}</span>
          <span style="font-size:10px;padding:1px 6px;border-radius:2px;background:#2d3748;color:var(--brass-bright)">${statusText}</span>
        </div>
        <div style="font-size:11px;color:var(--dim);line-height:1.4;margin:4px 0;">${f.desc || ''}</div>
        <div style="font-size:10px;color:#a2c49d;background:rgba(0,0,0,0.3);padding:3px 6px;border-radius:2px;">
          ${(f.effects||[]).map(formatEffect).join(' | ')}
        </div>
        <div style="font-size:10px;color:var(--brass-bright);display:flex;justify-content:space-between;align-items:center;margin-top:4px;">
          <span>${isAvail ? '<b style="color:#4ade80;">⚡ 点击调阅/直接签署</b>' : '🔍 调阅战略档案'}</span>
          <span>⏱️ ${f.days || 70}天</span>
        </div>
      </div>`;
    }
    html += `</div>`;
  }

  html += `</div></div>`;
  modal.innerHTML = html;

  modal.querySelector('#sf-close-focus').addEventListener('click', () => modal.classList.remove('on'));

  modal.querySelectorAll('.focus-node-card').forEach(card => {
    card.addEventListener('click', () => {
      const fid = card.dataset.foc;
      const fObj = list.find(x => x.id === fid) || { id: fid, name: fid };
      sound.playClick();
      openFocusDossier(fObj, store, modal);
    });
  });
}

/**
 * 弹出高精度战略国策档案卡 (Focus Strategic Dossier)
 */
export function openFocusDossier(f, store, parentModal){
  let modal = document.getElementById('sf-focus-dossier-modal');
  if(!modal){
    modal = document.createElement('div');
    modal.id = 'sf-focus-dossier-modal';
    modal.className = 'sf-overlay sf-dossier-overlay';
    document.body.appendChild(modal);
  }

  const w = store.world;
  const n = w.nations[w.player];
  const dossier = getFocusDossier(f, w);

  const isDone = n.focus.done.includes(f.id);
  const isActive = n.focus.active === f.id;
  const isAvail = availableFocuses(w, w.player).some(x => x.id === f.id);
  const statusClass = isDone ? 'done' : isActive ? 'active' : isAvail ? 'available' : 'locked';
  const statusLabel = isDone ? '✔️ 国策已全面达成并永久生效'
    : isActive ? `⏳ 国策正在推演中 (已执行 ${n.focus.progress}/${dossier.days} 天)`
    : isAvail ? '⚡ 前置条件已具备 · 可签署下达'
    : '🔒 前置战略条件尚未达成';

  let reqsHtml = '';
  if(dossier.reqs && dossier.reqs.length){
    reqsHtml = dossier.reqs.map(rid => {
      const ok = n.focus.done.includes(rid);
      const reqF = focusesFor(w, w.player).find(x => x.id === rid) || { name: rid };
      return `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:3px;font-size:11px;background:${ok ? 'rgba(74,222,128,0.15)' : 'rgba(239,68,68,0.15)'};border:1px solid ${ok ? '#4ade80' : '#ef4444'};color:${ok ? '#4ade80' : '#fca5a5'};">
        ${ok ? '✔' : '✖'} ${reqF.name}
      </span>`;
    }).join(' ');
  } else {
    reqsHtml = '<span style="color:#4ade80;font-size:11.5px;">✔ 无前置依赖 (开局基石国策)</span>';
  }

  modal.innerHTML = `
    <div class="sf-focus-dossier-box">
      <!-- 顶部金属标题栏与母图 -->
      <div class="dossier-header-bar">
        <div style="display:flex;align-items:center;gap:14px;">
          <div class="dossier-mother-badge">
            <img src="${dossier.motherIcon}" alt="${dossier.chain}">
          </div>
          <div>
            <div style="display:flex;align-items:center;gap:8px;">
              <span class="dossier-chain-tag">${dossier.chain.toUpperCase()} 战略分支</span>
              <span class="dossier-status-pill ${statusClass}">${statusLabel}</span>
            </div>
            <h2 class="dossier-title">${dossier.title}</h2>
          </div>
        </div>
        <button class="btn" id="sf-close-focus-dossier">✕ 关闭</button>
      </div>

      <!-- 核心指标摘要条 -->
      <div class="dossier-specs-strip">
        <div class="dossier-spec-item">
          <span class="lbl">推演周期</span>
          <span class="val">⏱️ ${dossier.days} 天</span>
        </div>
        <div class="dossier-spec-item">
          <span class="lbl">每日政治点消耗</span>
          <span class="val">🏛️ -${dossier.ppCost} PP/天</span>
        </div>
        <div class="dossier-spec-item">
          <span class="lbl">所属学说链</span>
          <span class="val">📜 ${dossier.chain}</span>
        </div>
        <div class="dossier-spec-item">
          <span class="lbl">推进进度</span>
          <span class="val">${isActive ? `${n.focus.progress}/${dossier.days} 天` : isDone ? '100%' : '0%'}</span>
        </div>
      </div>

      <div class="dossier-body-scroll">
        <!-- 历史名言/引语 -->
        ${dossier.quote ? `<div class="dossier-quote">${dossier.quote}</div>` : ''}

        <!-- 150+ 字深度历史考据 -->
        <div class="dossier-section">
          <div class="dossier-section-title">📖 战役历史背景与地缘考据</div>
          <div class="dossier-history-text">${dossier.history}</div>
        </div>

        <!-- 战略前置依赖与互斥路线 -->
        <div class="dossier-section">
          <div class="dossier-section-title">🔗 战略前置脉络与互斥预警</div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <span style="font-size:12px;color:var(--dim)">必要前置国策：</span>
              ${reqsHtml}
            </div>
            ${dossier.exclusive ? `
              <div class="dossier-warning-box">
                ⚠️ <b>互斥分支警示</b>：一旦签署此动员令，【${dossier.exclusive}】路线将被永久封锁，不可兼得！
              </div>
            ` : ''}
          </div>
        </div>

        <!-- 详细战略数值收益清单 -->
        <div class="dossier-section">
          <div class="dossier-section-title">📊 签署后国家战略收益细目</div>
          <div class="dossier-effects-grid">
            ${dossier.effects.map(eff => `
              <div class="dossier-effect-badge">
                <span class="badge-icon">★</span>
                <span>${eff}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- 底部指令按钮栏 -->
      <div class="dossier-footer-bar">
        ${isAvail ? `
          <button class="btn gold-pulse" id="sf-sign-focus-btn" style="flex:1;padding:12px;font-size:15px;font-weight:bold;">
            ✍️ 签署统帅部动员令 · 立即推进此国策 (${dossier.days}天)
          </button>
        ` : isActive ? `
          <button class="btn" disabled style="flex:1;padding:12px;font-size:14px;background:#2d3748;color:var(--dim);">
            ⏳ 此国策正在严密推演中 · 参谋部已执行 ${n.focus.progress} / ${dossier.days} 天
          </button>
          <button class="btn gold" id="sf-rush-focus-btn" style="padding:12px 18px;font-size:13px;"
            title="${K.FOCUS_RUSH_PP} 政治点立刻缩短 ${K.FOCUS_RUSH_DAYS} 天">
            ⏩ 加速推进 (${K.FOCUS_RUSH_PP}PP / -${K.FOCUS_RUSH_DAYS}天)
          </button>
        ` : isDone ? `
          <button class="btn" disabled style="flex:1;padding:12px;font-size:14px;background:#1e293b;color:#4ade80;">
            ✔️ 此项国家宏图大略已全面达成并永久生效
          </button>
        ` : `
          <button class="btn" disabled style="flex:1;padding:12px;font-size:14px;background:#1f242d;color:#94a3b8;">
            🔒 前置战略条件尚未达成 · 无法签署动员令
          </button>
        `}
        <button class="btn" id="sf-back-focus-dossier" style="padding:12px 20px;">返回国策树</button>
      </div>
    </div>
  `;

  modal.classList.add('on');
  sound.playClick();

  modal.querySelector('#sf-close-focus-dossier').addEventListener('click', () => modal.classList.remove('on'));
  modal.querySelector('#sf-back-focus-dossier').addEventListener('click', () => modal.classList.remove('on'));

  const signBtn = modal.querySelector('#sf-sign-focus-btn');
  if(signBtn){
    signBtn.addEventListener('click', () => {
      sound.playStamp();
      store.dispatch({ type:'PICK_FOCUS', focusId: f.id });
      modal.classList.remove('on');
      if(parentModal) renderFocusTree(store, parentModal);
      showToast(`★ 统帅部动员令已签署：开始推进【${dossier.title}】！`);
    });
  }

  // 加速推进：顶栏指标弹窗一直宣称「100 点 = 缩短 7 天」，但此前**没有任何按钮**
  // 派发 RUSH_FOCUS —— 玩家照说明找不到入口。这里把入口补上。
  const rushBtn = modal.querySelector('#sf-rush-focus-btn');
  if(rushBtn){
    rushBtn.addEventListener('click', () => {
      if(n.pp < K.FOCUS_RUSH_PP){
        showToast(`⚠️ 政治点不足：加速推进需要 ${K.FOCUS_RUSH_PP} 点，当前 ${Math.floor(n.pp)} 点`);
        return;
      }
      sound.playClick();
      store.dispatch({ type:'RUSH_FOCUS' });
      modal.classList.remove('on');
      if(parentModal) renderFocusTree(store, parentModal);
      showToast(`⏩ 统帅部连夜调度：国策推进缩短 ${K.FOCUS_RUSH_DAYS} 天`);
    });
  }
}

function formatEffect(e){
  if(e.type === 'addFactory') return `+${e.count}${e.kind==='mil'?'军厂':'民厂'}`;
  if(e.type === 'addPP') return `+${e.value}政治点`;
  if(e.type === 'addBuilding') return `+${e.level}级${e.building==='fort'?'要塞':'设施'}`;
  if(e.type === 'unlockTech') return `解锁科技: ${e.tech}`;
  if(e.type === 'declareWar') return `对 ${e.target} 宣战`;
  if(e.type === 'setLaw') return `实行法案: ${e.law}`;
  if(e.type === 'modifier') return `${e.stat} +${Math.round(e.value*100)}%`;
  if(e.type === 'addResearchSlot') return `+${e.count}科研槽`;
  if(e.type === 'addArmyXp') return `+${e.value} 陆军经验`;
  /* v11.0：剧本国策树（ww1~modern）的效果类型也要有人话文案，
     否则国策卡的收益条会直接显示 addMil / addPrestige 这类英文标识符 */
  if(e.type === 'addMil') return `+${e.value} 军工厂`;
  if(e.type === 'addCiv') return `+${e.value} 民用工厂`;
  if(e.type === 'addEquip') return `+${e.value} 装备`;
  if(e.type === 'addStability') return `${e.value >= 0 ? '+' : ''}${e.value} 稳定度`;
  if(e.type === 'addWarSupport') return `${e.value >= 0 ? '+' : ''}${e.value} 战争支持度`;
  if(e.type === 'addPrestige') return `${e.value >= 0 ? '+' : ''}${e.value} 国际声望`;
  if(e.type === 'addModifier') return `${MODIFIER_LABELS[e.stat] || e.stat} ${e.value >= 0 ? '+' : ''}${Math.round(e.value*100)}%`;
  return e.type;
}

/* 修正器字段 → 中文（国策收益清单与提示条共用） */
const MODIFIER_LABELS = {
  attack: '攻击', defense: '防御', speed: '机动', org_recovery: '组织度恢复',
  plan_speed: '计划积累', researchSpeed: '科研速度', milOutput: '军工产出',
  pp: '政治点产出', stability: '稳定度', warSupport: '战争支持度',
  entrenchMax: '堑壕上限', planningMax: '计划上限', orgRecovery: '组织度恢复',
  convoyRaid: '破交效率', subAttack: '潜艇攻击', subDefense: '潜艇生存',
  airSuperiority: '制空权', buildSpeed: '建造速度', brk: '突破', hp: '兵力',
  atk: '攻击', def: '防御', org: '组织度'
};

/* ============================================================
   存档管理模态框
   ============================================================ */
export function openSaveModal(store, isSaving = false){
  let modal = document.getElementById('sf-save-modal');
  if(!modal){
    modal = document.createElement('div');
    modal.id = 'sf-save-modal';
    modal.className = 'sf-overlay';
    document.body.appendChild(modal);
  }
  renderSaveModal(store, modal, isSaving);
  modal.classList.add('on');
}

function renderSaveModal(store, modal, isSaving){
  const w = store.world;
  const saves = listSaves(w.scenario || 'A');

  let html = `<div class="brief-box" style="max-width:580px;width:90vw">
    <div class="modal-header">
      <div style="display:flex;align-items:center;gap:12px;">
        <span class="modal-emblem">🗂️</span>
        <div>
          <h2 class="modal-title">${isSaving ? '保存战役进度' : '载入与管理档案'}</h2>
          <div class="modal-sub">当前剧本：${w.scenario} · 第 ${w.day} 天</div>
        </div>
      </div>
      <button class="btn" id="sf-close-save">关闭 (ESC)</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px;margin:14px 0;">`;

  for(const item of saves){
    const dateStr = item.savedAt ? new Date(item.savedAt).toLocaleString() : '—';
    html += `
      <div style="background:#191e27;border:1px solid #333d4d;border-radius:4px;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <h4 style="font-size:14px;color:var(--brass-bright);margin-bottom:3px;">${item.slot === 0 ? '⚙️ ' : '💾 '}${item.saveName}</h4>
          <p style="font-size:11.5px;color:var(--dim);">${item.exists ? `战役第 ${item.day} 天 · 归档时间：${dateStr}` : '空档案槽'}</p>
        </div>
        <div style="display:flex;gap:6px;">
          ${item.slot !== 0 ? `<button class="btn gold" data-slot-save="${item.slot}">存入</button>` : ''}
          ${item.exists ? `<button class="btn primary" data-slot-load="${item.slot}">读取</button>` : ''}
          ${item.exists ? `<button class="btn" data-slot-export="${item.slot}">导出</button>` : ''}
          ${item.exists && item.slot !== 0 ? `<button class="btn" data-slot-del="${item.slot}">删</button>` : ''}
        </div>
      </div>
    `;
  }

  html += `</div>
    <div style="display:flex;justify-content:space-between;margin-top:14px;border-top:1px solid #2d3748;padding-top:12px">
      <div>
        <input type="file" id="sf-import-file" style="display:none" accept=".json">
        <button class="btn" id="sf-import-btn">📥 从文件导入</button>
      </div>
      <span class="modal-sub">ESC 键可随时关闭</span>
    </div>
  </div>`;

  modal.innerHTML = html;

  modal.querySelector('#sf-close-save').addEventListener('click', () => modal.classList.remove('on'));

  modal.querySelectorAll('[data-slot-save]').forEach(btn => {
    btn.addEventListener('click', () => {
      const slot = +btn.dataset.slotSave;
      sound.playClick();
      saveGame(w, slot, `手动存档 ${slot}`);
      renderSaveModal(store, modal, isSaving);
    });
  });

  modal.querySelectorAll('[data-slot-load]').forEach(btn => {
    btn.addEventListener('click', () => {
      const slot = +btn.dataset.slotLoad;
      sound.playClick();
      const loadedWorld = loadGame(w.scenario || 'A', slot);
      if(loadedWorld){
        store.world = loadedWorld;
        modal.classList.remove('on');
        location.reload();
      }
    });
  });

  modal.querySelectorAll('[data-slot-export]').forEach(btn => {
    btn.addEventListener('click', () => {
      const slot = +btn.dataset.slotExport;
      const json = exportSaveJson(w.scenario || 'A', slot);
      if(json){
        const blob = new Blob([json], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `SteelFront_${w.scenario}_Slot${slot}_Day${w.day}.json`;
        a.click();
      }
    });
  });

  modal.querySelectorAll('[data-slot-del]').forEach(btn => {
    btn.addEventListener('click', () => {
      const slot = +btn.dataset.slotDel;
      deleteSave(w.scenario || 'A', slot);
      renderSaveModal(store, modal, isSaving);
    });
  });

  const importBtn = modal.querySelector('#sf-import-btn');
  const fileInput = modal.querySelector('#sf-import-file');
  importBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if(file){
      const reader = new FileReader();
      reader.onload = evt => {
        try {
          importSaveJson(evt.target.result);
          sound.playCapture();
          // v12.0 C47：alert 占位清零，统一走 toast 通道
          showToast('📥 导入存档成功！正在加载...');
          location.reload();
        } catch(err){
          showToast('⚠️ 导入失败：文件格式不正确');
        }
      };
      reader.readAsText(file);
    }
  });
}

/* ============================================================
   难度选择模态框
   ============================================================ */
export function openDifficultyModal(store){
  let modal = document.getElementById('sf-diff-modal');
  if(!modal){
    modal = document.createElement('div');
    modal.id = 'sf-diff-modal';
    modal.className = 'sf-overlay';
    document.body.appendChild(modal);
  }

  const cur = store.world.difficulty || 'general';
  let html = `<div class="brief-box" style="max-width:480px">
    <h2>选择 AI 战役难度</h2>
    <p class="bf-sub">实时调节敌军产能倍率、进攻门槛与反击频率。</p>
    <div style="display:flex;flex-direction:column;gap:10px;margin:16px 0">`;

  for(const k in K.DIFFICULTIES){
    const d = K.DIFFICULTIES[k];
    const isCur = d.id === cur;
    html += `<button class="btn ${isCur ? 'gold' : ''}" style="padding:10px 14px;text-align:left;display:flex;justify-content:space-between;align-items:center" data-set-diff="${d.id}">
      <div>
        <b style="font-size:14px;color:var(--ink)">${d.name}</b>
        <div style="font-size:11px;color:var(--dim);margin-top:3px">产能倍率 ${d.prodMul}x · 进攻门槛 ${d.attackThreshold} · 决策周期 ${d.decisionDelay}天</div>
      </div>
      ${isCur ? '<span style="color:var(--brass-bright);font-size:12px">● 当前选择</span>' : ''}
    </button>`;
  }

  html += `</div>
    <button class="btn primary" style="width:100%" id="sf-close-diff">确定</button>
  </div>`;

  modal.innerHTML = html;
  modal.classList.add('on');

  modal.querySelector('#sf-close-diff').addEventListener('click', () => modal.classList.remove('on'));
  modal.querySelectorAll('[data-set-diff]').forEach(btn => {
    btn.addEventListener('click', () => {
      sound.playClick();
      store.dispatch({ type:'SET_DIFFICULTY', payload: btn.dataset.setDiff });
      modal.classList.remove('on');
    });
  });
}

/* ============================================================
   统帅军官履历与领袖战略档案系统 (v7.0 §4.2 / E1)
   ============================================================ */
export function openCharacterDossier(c, store, onUpdate){
  let modal = document.getElementById('sf-character-dossier-modal');
  if(!modal){
    modal = document.createElement('div');
    modal.id = 'sf-character-dossier-modal';
    modal.className = 'sf-overlay sf-dossier-overlay';
    document.body.appendChild(modal);
  }

  const w = store.world;
  const n = w.nations[w.player];
  const charObj = (typeof c === 'string')
    ? ((w.characters || []).find(x => x.id === c) || { id: c, name: c, nat: w.player, type: 'leader' })
    : c;

  const dossier = getCharacterDossier(charObj, w);
  const isAssigned = (n && n.assignedGenerals && n.assignedGenerals.includes(dossier.id));
  const isMarshal = dossier.rank === 'marshal';
  const isLeader = dossier.type === 'leader';
  const portraitSrc = getCharacterPortraitSrc(charObj);

  modal.innerHTML = `
    <div class="sf-char-dossier-box">
      <!-- 关闭按钮 -->
      <button class="dossier-close-x" id="sf-close-char-dossier">✕</button>

      <div class="sf-char-dossier-grid">
        <!-- 左栏：512x640 高清油画肖像与军衔牌 -->
        <div class="char-dossier-left">
          <div class="char-portrait-frame">
            <img class="char-portrait-img" src="${portraitSrc}" alt="${dossier.name}"
              onerror="this.onerror=null;this.src='${getProceduralBadgeSvg(dossier.id, dossier.name)}';">
            <div class="char-portrait-vignette"></div>
            <div class="char-flag-ribbon">
              ${renderFlagHtml(dossier.nat, 36, 22)}
            </div>
          </div>
          <div class="char-service-status ${isAssigned ? 'assigned' : isLeader ? 'leader' : 'ready'}">
            ${isLeader ? '● 国家元首 / 最高统帅' : isAssigned ? '● 现役集团军指挥官' : '● 陆军总参谋部待命'}
          </div>
          <div class="char-command-tag">
            ${isLeader ? '战略统揽 · 内阁决策' : isAssigned ? `所辖兵力：${dossier.assignedCount} 个师团` : '随时可委派前线集团军'}
          </div>
        </div>

        <!-- 右栏：统帅履历、四维技能与战历传记 -->
        <div class="char-dossier-right">
          <!-- 标头 -->
          <div class="char-dossier-header">
            <div style="display:flex;align-items:center;gap:10px;">
              <span class="char-rank-badge ${isMarshal ? 'marshal' : isLeader ? 'leader' : 'general'}">
                ${isLeader ? '👑 国家领袖' : isMarshal ? '★★★★★ 陆军元帅' : '★★★ 陆军上将'}
              </span>
              <span class="char-origin-tag">${dossier.origin}</span>
            </div>
            <h1 class="char-dossier-name">${dossier.name}</h1>
            <div class="char-lifespan-text">生卒年：${dossier.lifespan}</div>
          </div>

          <!-- 四维指挥技能条 (Attack, Defense, Planning, Logistics) -->
          <div class="char-skills-panel">
            <div class="char-skills-title">🎖️ 统帅部四维战术技能评级</div>
            <div class="char-skills-grid">
              <!-- 进攻 -->
              <div class="skill-row">
                <div class="skill-meta">
                  <span class="skill-name">⚔️ 进攻突破 (Attack)</span>
                  <span class="skill-score">Lv ${dossier.skills.attack} / 10 · 软硬攻 +${dossier.skills.attack * 5}%</span>
                </div>
                <div class="skill-bar-track">
                  <div class="skill-bar-fill atk" style="width:${dossier.skills.attack * 10}%"></div>
                </div>
              </div>

              <!-- 防御 -->
              <div class="skill-row">
                <div class="skill-meta">
                  <span class="skill-name">🛡️ 坚守防线 (Defense)</span>
                  <span class="skill-score">Lv ${dossier.skills.defense} / 10 · 堑壕与韧性 +${dossier.skills.defense * 5}%</span>
                </div>
                <div class="skill-bar-track">
                  <div class="skill-bar-fill def" style="width:${dossier.skills.defense * 10}%"></div>
                </div>
              </div>

              <!-- 筹划 -->
              <div class="skill-row">
                <div class="skill-meta">
                  <span class="skill-name">📐 战役筹划 (Planning)</span>
                  <span class="skill-score">Lv ${dossier.skills.planning} / 10 · 筹划速度 +${dossier.skills.planning * 5}%</span>
                </div>
                <div class="skill-bar-track">
                  <div class="skill-bar-fill plan" style="width:${dossier.skills.planning * 10}%"></div>
                </div>
              </div>

              <!-- 后勤 -->
              <div class="skill-row">
                <div class="skill-meta">
                  <span class="skill-name">🚚 后勤损耗 (Logistics)</span>
                  <span class="skill-score">Lv ${dossier.skills.logistics} / 10 · 断供损耗 -${dossier.skills.logistics * 5}%</span>
                </div>
                <div class="skill-bar-track">
                  <div class="skill-bar-fill log" style="width:${dossier.skills.logistics * 10}%"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- 200~300 字人物生平与历史评传 -->
          <div class="char-bio-panel">
            <div class="char-bio-title">📜 战史履历与人物评传</div>
            <div class="char-bio-text">${dossier.bio}</div>
          </div>

          <!-- 特性勋章 -->
          <div class="char-traits-panel">
            <div class="char-traits-title">🏅 军事特性与战功勋章</div>
            <div class="char-traits-grid">
              ${dossier.traits.map(t => `
                <div class="char-trait-pill">
                  <span class="pill-name">${t.name}</span>
                  <span class="pill-desc">${t.desc}</span>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- 操作按钮栏 -->
          <div class="char-actions-bar">
            ${!isLeader ? `
              <button class="btn ${isAssigned ? 'primary' : 'gold'}" id="sf-dossier-toggle-assign" style="flex:1;padding:10px;">
                ${isAssigned ? '🪖 解除集团军前线指挥' : '⚔️ 委任集团军指挥官'}
              </button>
              ${!isMarshal ? `
                <button class="btn" id="sf-dossier-promote" style="padding:10px 16px;">
                  🎖️ 晋升陆军元帅 (50 CP)
                </button>
              ` : `
                <button class="btn" disabled style="padding:10px 16px;background:#1e293b;color:#4ade80;">
                  ★ 最高元帅军衔
                </button>
              `}
            ` : ''}
            <button class="btn" id="sf-dossier-close" style="padding:10px 20px;">关闭档案 (ESC)</button>
          </div>
        </div>
      </div>
    </div>
  `;

  modal.classList.add('on');
  sound.playClick();

  modal.querySelector('#sf-close-char-dossier').addEventListener('click', () => modal.classList.remove('on'));
  modal.querySelector('#sf-dossier-close').addEventListener('click', () => modal.classList.remove('on'));

  const toggleBtn = modal.querySelector('#sf-dossier-toggle-assign');
  if(toggleBtn){
    toggleBtn.addEventListener('click', () => {
      sound.playClick();
      if(isAssigned){
        unassignGeneral(w, dossier.id, w.player);
        showToast(`已解除【${dossier.name}】的前线集团军指挥职务`);
      } else {
        assignGeneral(w, dossier.id, w.player);
        showToast(`★ 已委任【${dossier.name}】统领前线主力集团军！`);
      }
      modal.classList.remove('on');
      if(onUpdate) onUpdate();
    });
  }

  const promoteBtn = modal.querySelector('#sf-dossier-promote');
  if(promoteBtn){
    promoteBtn.addEventListener('click', () => {
      sound.playClick();
      const ok = promoteToMarshal(w, dossier.id, w.player);
      if(ok){
        sound.playStamp();
        showToast(`🎉 授衔晋升：【${dossier.name}】已正式晋升为陆军元帅！`);
        modal.classList.remove('on');
        if(onUpdate) onUpdate();
      } else {
        showToast('⚠️ 指挥点数不足 (需要 50 CP) 或无法晋升');
      }
    });
  }
}

/* ============================================================
   内阁、法案、统帅部与外交综合模态框
   ============================================================ */
export function openCharactersModal(store, defaultTab = 'generals'){
  let modal = document.getElementById('sf-chars-modal');
  if(!modal){
    modal = document.createElement('div');
    modal.id = 'sf-chars-modal';
    modal.className = 'sf-overlay';
    document.body.appendChild(modal);
  }

  const w = store.world;
  const n = w.nations[w.player];
  if(!n) return;

  let activeTab = defaultTab;
  let targetNat = Object.keys(w.nations).find(k => k !== w.player) || 'P';

  function renderList(){
    const fullTag = { G: 'GER', P: 'POL', F: 'FRA', B: 'GBR', S: 'SOV', U: 'USA', R: 'RUS', H: 'HOL' }[w.player] || w.player;
    let natChars = (w.characters || []).filter(c => c.nat === w.player || c.nat === fullTag);
    if(!natChars.length && (fullTag === 'GER' || w.player === 'G')){
      natChars = [
        { id: 'hitler', name: '阿道夫·希特勒', nat: 'GER', type: 'leader', era: 'ww2', traits: [ { stat: 'attack', value: 0.15 }, { stat: 'warSupport', value: 20 }, { stat: 'stability', value: -10 } ] },
        { id: 'manstein', name: '埃里希·冯·曼施坦因', nat: 'GER', type: 'general', rank: 'marshal', skills: { attack: 5, defense: 4, planning: 5, tactics: 4 } },
        { id: 'guderian', name: '海因茨·古德里安', nat: 'GER', type: 'general', rank: 'general', skills: { attack: 5, defense: 2, planning: 4, tactics: 5 } },
        { id: 'rommel', name: '埃尔温·隆美尔', nat: 'GER', type: 'general', rank: 'general', skills: { attack: 5, defense: 3, planning: 3, tactics: 5 } },
        { id: 'rundstedt', name: '格尔德·冯·伦德施泰特', nat: 'GER', type: 'general', rank: 'marshal', skills: { attack: 4, defense: 4, planning: 4, tactics: 3 } }
      ];
    }

    let html = `<div class="brief-box" style="max-width:840px;max-height:88vh;display:flex;flex-direction:column;padding:22px;">
      <div class="modal-header">
        <div style="display:flex;align-items:center;gap:12px;">
          ${renderFlagHtml(w.player, 36, 24)}
          <div>
            <h2 class="modal-title">${n.name} · 最高统帅部与内政外交</h2>
            <div class="modal-sub">政治点: <b style="color:var(--brass-bright)">${Math.floor(n.pp)}</b> · 指挥点: <b style="color:#38bdf8">${Math.floor(n.commandPower||100)}/200</b> · 陆战经验: <b style="color:#4ade80">${Math.floor(n.armyXp||50)}</b> · 紧张度: <b style="color:#f87171">${Math.round(w.tension?w.tension.value:0)}%</b></div>
          </div>
        </div>
        <button class="btn" id="sf-close-chars">关闭 (ESC)</button>
      </div>

      <div style="display:flex;gap:8px;margin:12px 0;border-bottom:1px solid #2d3748;padding-bottom:8px;">
        <button class="btn ${activeTab==='generals'?'gold':''}" data-tab="generals">🎖️ 统帅部将领</button>
        <button class="btn ${activeTab==='laws'?'gold':''}" data-tab="laws">📜 政治与经济法案</button>
        <button class="btn ${activeTab==='advisors'?'gold':''}" data-tab="advisors">🤝 内阁三系顾问</button>
        <button class="btn ${activeTab==='diplomacy'?'gold':''}" data-tab="diplomacy">🌐 国际局势与外交</button>
      </div>

      <div style="flex:1;overflow-y:auto;padding-right:6px;">`;

    // ===== TAB 1: 统帅部将领 =====
    if(activeTab === 'generals'){
      const leaders = natChars.filter(c => c.type === 'leader');
      const generals = natChars.filter(c => c.type === 'general');

      if(leaders.length){
        html += '<h4 style="color:var(--brass-bright);margin-bottom:8px;">国家元首与最高领袖</h4>';
        for(const l of leaders){
          html += `
            <div class="sf-leader-card-item" data-inspect-char="${l.id}" title="点击调阅【${l.name}】512x640 领袖战略档案" style="display:flex;gap:14px;background:#18202c;border:1px solid #334155;border-radius:4px;padding:12px;margin-bottom:12px;cursor:pointer;transition:border-color 0.2s;">
              <div style="width:68px;height:84px;border:1.5px solid #5a4020;border-radius:3px;overflow:hidden;flex-shrink:0;">
                ${renderLeaderPortraitHtml(l.id, 68)}
              </div>
              <div style="flex:1;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <b style="font-size:16px;color:var(--ink)">${l.name}</b>
                  <span style="font-size:10px;padding:2px 8px;border-radius:2px;background:#713f12;color:#fef08a;border:1px solid #ca8a04;">👑 国家元首</span>
                </div>
                <div style="font-size:11.5px;color:var(--dim);margin:4px 0 6px;">最高统帅部核心特质 · 点击调阅512×640生平传记与战略属性</div>
                <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
                  ${(l.traits||[]).map(t => {
                    const statLabels = { attack: '部队攻击', defense: '部队防御', warSupport: '战争支持度', stability: '国家稳定度', milOutput: '军工产出', org_recovery: '组织度恢复' };
                    const num = Math.abs(t.value) > 1 ? Math.round(t.value) : Math.round(t.value * 100);
                    const valStr = t.value >= 0 ? `+${num}%` : `${num}%`;
                    return `<span style="font-size:11px;background:#242c38;border:1px solid #3e4a5d;padding:2px 6px;border-radius:2px;color:var(--brass-bright)">${statLabels[t.stat] || t.stat}: ${valStr}</span>`;
                  }).join('')}
                  <button class="btn btn-sm gold" style="margin-left:auto;" data-inspect-char="${l.id}">📜 调阅战略档案</button>
                </div>
              </div>
            </div>
          `;
        }
      }

      html += '<h4 style="color:var(--brass-bright);margin:14px 0 8px;">战区将领名册（点击任意将领调阅 512×640 军官履历全案）</h4>';
      if(!generals.length){
        html += '<div style="color:var(--dim);text-align:center;padding:20px;">当前剧本暂无将领名册</div>';
      } else {
        html += '<div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(360px, 1fr));gap:10px;">';
        for(const g of generals){
          const isAssigned = (n.assignedGenerals || []).includes(g.id);
          const isMarshal = (g.rank === 'marshal');
          html += `
            <div class="sf-general-row-item" data-inspect-char="${g.id}" title="点击调阅【${g.name}】512x640 军官履历全案" style="display:flex;gap:12px;background:#18202c;border:1px solid #334155;border-radius:4px;padding:10px;cursor:pointer;transition:all 0.15s;">
              <div style="width:58px;height:72px;border:1.5px solid #4a5b73;border-radius:3px;overflow:hidden;flex-shrink:0;">
                ${renderGeneralPortraitHtml(g.id, 58, 72)}
              </div>
              <div style="flex:1;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <b style="font-size:14px;color:var(--ink)">${g.name}</b>
                  <span style="font-size:10px;padding:1px 6px;border-radius:2px;background:#273344;color:var(--brass-bright)">${isMarshal ? '★★★★★ 元帅' : '★★★ 上将'}</span>
                </div>
                <div style="font-size:11px;color:var(--dim);margin:3px 0 6px;">攻 ${g.skills?.attack||3} · 防 ${g.skills?.defense||3} · 计 ${g.skills?.planning||3} · 术 ${g.skills?.tactics||3}</div>
                <div style="display:flex;gap:6px;align-items:center;">
                  <button class="btn ${isAssigned ? 'primary' : 'gold'}" data-toggle-general="${g.id}">
                    ${isAssigned ? '解除指挥' : '委任集团军'}
                  </button>
                  ${!isMarshal ? `<button class="btn" data-promote="${g.id}">晋升元帅</button>` : ''}
                  <button class="btn btn-sm" data-inspect-char="${g.id}">📜 履历档案</button>
                </div>
              </div>
            </div>
          `;
        }
        html += '</div>';
      }
    }

    // ===== TAB 2: 法案 =====
    else if(activeTab === 'laws'){
      // ===== v14.0 P3：意识形态与执政党 =====
      {
        const ideo = getIdeology(n.ideology);
        const facs = IDEOLOGY_FACTIONS[n.ideology] || [];
        const sup = Math.round(n.rulingSupport || 0);
        const supColor = sup > 50 ? '#56AC5B' : (sup > 30 ? '#EEC923' : '#DE5646');
        html += `<h4 style="color:var(--brass-bright);margin-bottom:8px;">意识形态与执政党</h4>
          <div style="background:#18202c;border:1px solid #334155;border-radius:4px;padding:11px;margin-bottom:14px;">
            <div style="display:flex;align-items:center;gap:9px;margin-bottom:7px;">
              <span style="font-size:20px;">${ideo.icon}</span>
              <b style="color:${ideo.color};font-size:14px;">${ideo.name}</b>
              <span style="font-size:10.5px;color:#8a94a6;">${(facs.find(f=>f.id===n.ideologyFaction)||{name:''}).name}</span>
              ${n.civilWar ? '<span style="font-size:10px;color:#DE5646;">⚠ 内战中</span>' : ''}
            </div>
            <div style="font-size:10.5px;color:#9aa4b2;line-height:1.5;margin-bottom:8px;">${ideo.desc}</div>
            <div style="font-size:11px;color:#c8d0dc;margin-bottom:4px;">执政党支持度 <b style="color:${supColor};">${sup}%</b>
              <span style="color:#6b7688;font-size:10px;">（公投需 &gt;50%，内战需稳定度&lt;50%）</span></div>
            <div style="height:7px;background:#0f141c;border:1px solid #334155;border-radius:3px;overflow:hidden;">
              <div style="width:${sup}%;height:100%;background:${supColor};"></div>
            </div>
            <div style="margin-top:9px;display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
              <span style="font-size:10.5px;color:#8a94a6;">改换意识形态：</span>`;
        for(const key in IDEOLOGIES){
          const io = IDEOLOGIES[key];
          if(key === n.ideology) continue;
          const refChk = canHoldReferendum(store.world, w.player, key);
          const cwChk = canStartCivilWar(store.world, w.player, key);
          html += `<button class="btn small" data-ideo-change="${key}" data-method="${refChk.ok ? 'referendum' : (cwChk.ok ? 'civil_war' : '')}"
            ${(!refChk.ok && !cwChk.ok) ? 'disabled title="' + (refChk.reason || cwChk.reason) + '"' : ''}
            style="font-size:10.5px;padding:3px 8px;">${io.icon} ${io.name}</button>`;
        }
        html += `</div>
            <div style="font-size:9.5px;color:#6b7688;margin-top:6px;line-height:1.5;">
              公投：支持度&gt;50% + 100PP，和平改换 · 内战：稳定度&lt;50%，叛军分兵倒戈，平叛后改换
            </div>
          </div>`;
      }
      html += '<h4 style="color:var(--brass-bright);margin-bottom:8px;">国家经济动员法案</h4><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;">';
      for(const k in ECONOMIC_LAWS){
        const l = ECONOMIC_LAWS[k];
        const isCur = n.economicLaw === k || n.law === k;
        html += `
          <div style="background:#18202c;border:1px solid ${isCur ? 'var(--panel-border-gold)' : '#334155'};border-radius:4px;padding:10px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
              <b style="color:var(--ink)">${l.name}</b>
              ${isCur ? '<span style="color:var(--brass-bright);font-size:11px;">● 现行法案</span>' : ''}
            </div>
            <div style="font-size:11px;color:var(--dim);line-height:1.5;">${l.desc}</div>
            ${!isCur ? `<button class="btn gold" style="margin-top:8px;" data-eco-law="${k}">切换法案 (150 PP)</button>` : ''}
          </div>
        `;
      }
      html += '</div>';

      html += '<h4 style="color:var(--brass-bright);margin-bottom:8px;">国家兵役征募法案</h4><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">';
      for(const k in CONSCRIPTION_LAWS){
        const l = CONSCRIPTION_LAWS[k];
        const isCur = n.conscriptionLaw === k;
        html += `
          <div style="background:#18202c;border:1px solid ${isCur ? 'var(--panel-border-gold)' : '#334155'};border-radius:4px;padding:10px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
              <b style="color:var(--ink)">${l.name}</b>
              ${isCur ? '<span style="color:var(--brass-bright);font-size:11px;">● 现行兵役</span>' : ''}
            </div>
            <div style="font-size:11px;color:var(--dim);line-height:1.5;">${l.desc}</div>
            ${!isCur ? `<button class="btn gold" style="margin-top:8px;" data-con-law="${k}">施行兵役 (150 PP)</button>` : ''}
          </div>
        `;
      }
      html += '</div>';
    }

    // ===== TAB 3: 顾问 =====
    else if(activeTab === 'advisors'){
      html += '<h4 style="color:var(--brass-bright);margin-bottom:8px;">内阁三系特命顾问任命</h4><div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(240px, 1fr));gap:10px;">';
      for(const cat in ADVISORS){
        const list = ADVISORS[cat];
        for(const adv of list){
          const isHired = (n.advisors && n.advisors[cat] === adv.id);
          html += `
            <div style="background:#18202c;border:1px solid ${isHired ? 'var(--panel-border-gold)' : '#334155'};border-radius:4px;padding:10px;">
              <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                <b style="color:var(--ink)">${adv.name}</b>
                ${isHired ? '<span style="color:var(--brass-bright);font-size:11px;">● 在职</span>' : ''}
              </div>
              <div style="font-size:11px;color:var(--dim);line-height:1.5;margin-bottom:8px;">${adv.desc}</div>
              ${!isHired ? `<button class="btn gold" data-hire-cat="${cat}" data-hire-id="${adv.id}">任命顾问 (150 PP)</button>` : ''}
            </div>
          `;
        }
      }
      html += '</div>';
    }

    // ===== TAB 4: 外交与地缘局势 =====
    else if(activeTab === 'diplomacy'){
      const curTension = Math.round(w.tension ? w.tension.value : 0);
      const otherNats = Object.keys(w.nations).filter(k => k !== w.player);
      const targetObj = w.nations[targetNat] || { name: targetNat };

      const canJustify = canPerformTensionAction(w, w.player, 'justify') && n.pp >= 50;
      const canGuarantee = canPerformTensionAction(w, w.player, 'guarantee') && n.pp >= 25;
      const canVolunteers = curTension >= 30 && n.pp >= 30;
      const canLend = (curTension >= 50 || (n.allies||[]).includes(targetNat)) && n.pp >= 20;

      html += `
        <div style="display:flex;gap:20px;flex-wrap:wrap;">
          <div style="flex:1;min-width:300px;">
            <div style="font-size:14px;font-weight:bold;color:var(--brass-bright);margin-bottom:6px;">
              当前世界紧张度: <span style="font-size:18px;color:#f87171">${curTension}%</span>
            </div>
            <div style="width:100%;height:10px;background:#18202c;border:1px solid #334155;border-radius:5px;overflow:hidden;margin-bottom:12px;">
              <div style="width:${curTension}%;height:100%;background:linear-gradient(90deg, #f97316, #ef4444);transition:width 0.3s;"></div>
            </div>

            <div style="font-size:13px;font-weight:bold;color:var(--brass-bright);margin-bottom:8px;">外交目标国选择</div>
            <div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap;">`;
      for(const ok of otherNats){
        const onat = w.nations[ok];
        const isSel = ok === targetNat;
        html += `<button class="btn ${isSel ? 'gold' : ''}" style="font-size:12px;padding:4px 10px;" data-sel-nat="${ok}">
          ${onat ? onat.name : ok}
        </button>`;
      }
      html += `</div>

            <div style="font-size:13px;font-weight:bold;color:var(--brass-bright);margin-bottom:8px;">对【${targetObj.name}】开展外交行动</div>
            <div style="display:flex;flex-direction:column;gap:8px;">
              <button class="btn ${canJustify ? 'gold' : ''}" data-act="justify" ${!canJustify ? 'disabled' : ''} style="text-align:left;padding:8px 12px;">
                <b>🗡️ 制造战争借口 (50 PP)</b>
                <div style="font-size:11px;color:var(--dim)">法西斯/共产主义无门槛；中立国需25%；民主国需50%紧张度。耗时30天</div>
              </button>
              <button class="btn ${canGuarantee ? 'gold' : ''}" data-act="guarantee" ${!canGuarantee ? 'disabled' : ''} style="text-align:left;padding:8px 12px;">
                <b>🛡️ 保证独立条约 (25 PP)</b>
                <div style="font-size:11px;color:var(--dim)">民主国随时可保障；中立国需25%；法西斯需40%紧张度</div>
              </button>
              <button class="btn ${canVolunteers ? 'gold' : ''}" data-act="volunteers" ${!canVolunteers ? 'disabled' : ''} style="text-align:left;padding:8px 12px;">
                <b>🪖 派遣志愿干预部队 (30 PP)</b>
                <div style="font-size:11px;color:var(--dim)">全球紧张度必须 >= 30%，向目标国派出实战观察旅</div>
              </button>
              <button class="btn ${canLend ? 'gold' : ''}" data-act="lend" ${!canLend ? 'disabled' : ''} style="text-align:left;padding:8px 12px;">
                <b>🚢 战时装备租借法案 (20 PP)</b>
                <div style="font-size:11px;color:var(--dim)">全球紧张度 >= 50% 或 同盟国条约缔约国，首批调拨150装备</div>
              </button>
            </div>
          </div>

          <div style="flex:1;min-width:300px;">
            <div style="font-size:13px;font-weight:bold;color:var(--brass-bright);margin-bottom:8px;">世界地缘事件源起</div>
            <div style="background:rgba(0,0,0,0.3);border:1px solid #334155;border-radius:4px;padding:8px;max-height:300px;overflow-y:auto;font-size:12px;">`;
      const srcs = (w.tension && w.tension.sources) || [];
      if(!srcs.length){
        html += `<div style="color:var(--dim);text-align:center;padding:20px;">尚无紧张度波动记录</div>`;
      } else {
        for(const s of srcs){
          html += `
            <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #232d3d;">
              <span><b style="color:var(--dim)">第${s.day}天</b> · ${s.text}</span>
              <span style="color:#f87171;font-weight:bold;">+${s.value}%</span>
            </div>
          `;
        }
      }
      html += `</div></div></div>`;
    }

    html += `</div></div>`;
    modal.innerHTML = html;
    modal.classList.add('on');

    modal.querySelector('#sf-close-chars').addEventListener('click', () => modal.classList.remove('on'));

    modal.querySelectorAll('[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        sound.playClick();
        activeTab = btn.dataset.tab;
        renderList();
      });
    });

    modal.querySelectorAll('[data-inspect-char]').forEach(el => {
      el.addEventListener('click', (e) => {
        if(e.target.closest('[data-toggle-general]') || e.target.closest('[data-promote]')) return;
        const cid = el.dataset.inspectChar;
        const cObj = natChars.find(x => x.id === cid) || cid;
        sound.playClick();
        openCharacterDossier(cObj, store, renderList);
      });
    });

    modal.querySelectorAll('[data-toggle-general]').forEach(btn => {
      btn.addEventListener('click', () => {
        sound.playClick();
        const gid = btn.dataset.toggleGeneral;
        const curAssigned = (n.assignedGenerals || []).includes(gid);
        if(curAssigned) unassignGeneral(w, gid, w.player);
        else assignGeneral(w, gid, w.player);
        renderList();
      });
    });

    modal.querySelectorAll('[data-promote]').forEach(btn => {
      btn.addEventListener('click', () => {
        sound.playClick();
        const gid = btn.dataset.promote;
        if(promoteToMarshal(w, gid, w.player)) renderList();
      });
    });

    // v14.0 P3：改换意识形态（公投 / 内战）
    modal.querySelectorAll('[data-ideo-change]').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.ideoChange;
        const method = btn.dataset.method;
        if(method === 'referendum'){
          sound.playStamp();
          const r = holdReferendum(w, w.player, target);
          showToast(r.ok ? '🗳️ ' + r.msg : '⚠️ ' + r.msg);
        } else if(method === 'civil_war'){
          sound.playAlert();
          const r = startCivilWar(w, w.player, target);
          showToast(r.ok ? '⚔️ ' + r.msg : '⚠️ ' + r.msg);
        } else {
          showToast('⚠️ 当前条件无法改换意识形态');
        }
        renderList();
      });
    });

    modal.querySelectorAll('[data-eco-law]').forEach(btn => {
      btn.addEventListener('click', () => {
        sound.playClick();
        switchEconomicLaw(w, w.player, btn.dataset.ecoLaw);
        renderList();
      });
    });

    modal.querySelectorAll('[data-con-law]').forEach(btn => {
      btn.addEventListener('click', () => {
        sound.playClick();
        switchConscriptionLaw(w, w.player, btn.dataset.conLaw);
        renderList();
      });
    });

    modal.querySelectorAll('[data-hire-cat]').forEach(btn => {
      btn.addEventListener('click', () => {
        sound.playClick();
        hireAdvisor(w, w.player, btn.dataset.hireCat, btn.dataset.hireId);
        renderList();
      });
    });

    modal.querySelectorAll('[data-sel-nat]').forEach(btn => {
      btn.addEventListener('click', () => {
        sound.playClick();
        targetNat = btn.dataset.selNat;
        renderList();
      });
    });

    modal.querySelectorAll('[data-act]').forEach(btn => {
      btn.addEventListener('click', () => {
        sound.playClick();
        const act = btn.dataset.act;
        if(act === 'justify') startJustifyWar(w, w.player, targetNat);
        else if(act === 'guarantee') guaranteeIndependence(w, w.player, targetNat);
        else if(act === 'volunteers') sendVolunteers(w, w.player, targetNat);
        else if(act === 'lend') sendLendLease(w, w.player, targetNat);
        renderList();
      });
    });
  }

  renderList();
}

/* ============================================================
   指标详情弹窗系统 —— 每个顶栏指标都有完整说明与明细（§5 内容工业化）
   ============================================================ */

const IND_META = {
  pp:      { title:'政治点 Political Power', icon:'📜',
    body:(w,n)=>`<p><b>当前储备：${Math.floor(n.pp)} / 200</b>　每日产出：+2.0（受稳定度修正）</p>
      <p>政治点是国家的意志资源。用途：</p><ul>
      <li>雇佣内阁顾问（政治/经济/军事，各 150 点）</li>
      <li>切换经济法案与征兵法案（150 点）</li>
      <li>加速国策进度（100 点 = 缩短 7 天）</li>
      <li>改善关系、制造战争借口等外交行动</li></ul>
      <p>当前经济法案：<b>${({civilian:'民用经济',partial:'早期动员',war:'战时经济',total:'总动员',early_mob:'早期动员'})[n.law]||n.law}</b></p>` },
  cp:      { title:'指挥点数 Command Power', icon:'🔭',
    body:(w,n)=>`<p><b>当前储备：${Math.floor(n.commandPower||100)} / 200</b>　每日恢复：+0.5</p>
      <p>指挥点数是统帅部的调度资源：</p><ul>
      <li>雇佣新将领：20 点</li><li>晋升陆军元帅（可辖集团军群）：50 点</li>
      <li>发动战术卡与战区指令</li></ul>
      <p>陆军学说与国策可以提升上限与恢复速度。</p>` },
  xp:      { title:'陆军经验 Army Experience', icon:'⭐',
    body:(w,n)=>`<p><b>当前储备：${Math.floor(n.armyXp||0)}</b>　来源：部队每日训练与实战积累</p>
      <p>用途：</p><ul><li>师设计器：调整模板每 1 营位消耗 5 点</li>
      <li>陆军学说强化（25–100 点）</li><li>编练新式部队的解锁前提</li></ul>
      <p>让部队上战场，是攒经验的唯一捷径——也是唯一学费。</p>` },
  tension: { title:'世界紧张度 World Tension', icon:'🌐',
    body:(w,n)=>{
      const src = (w.tension && w.tension.sources || []).slice(0,10)
        .map(s=>`<li>第${s.day}天：${s.text}（+${s.value}%）</li>`).join('');
      return `<p><b>当前世界紧张度：${w.tension?Math.round(w.tension.value):0}%</b></p>
      <p>紧张度由侵略行为产生：制造战争借口（按目标军力）、宣战、吞并、以及重大历史事件。</p>
      ${src?`<p><b>近期来源：</b></p><ul>${src}</ul>`:''}
      <p><b>紧张度门槛</b>（行动解锁所需最低值）：</p><ul>
      <li>制造战争借口：法西斯/共产 0% · 中立 25% · 民主 50%</li>
      <li>保证独立：法西斯 40% · 民主 0% · 中立 25%</li>
      <li>加入阵营：法西斯 20% · 民主 40% · 中立 30%</li></ul>
      <p>紧张度越高，中立国越倾向于抱团自保——侵略者会把整个世界推向自己的对面。</p>`; } },
  stabwar: { title:'稳定度与战争支持度', icon:'⚖️',
    body:(w,n)=>`<p><b>稳定度：${Math.round((n.stability!=null?(n.stability>1?n.stability:n.stability*100):85))}%</b>
      　<b>战争支持度：${Math.round((n.warSupport!=null?(n.warSupport>1?n.warSupport:n.warSupport*100):60))}%</b></p>
      <ul><li>稳定度影响政治点产出：0% 时 −50%，100% 时 +20%</li>
      <li>稳定度过低（&lt;30）将触发政治危机事件链：罢工、内阁倒台甚至内战</li>
      <li>战争支持度决定<b>投降界限</b>：50% + 0.3 × 战争支持度。界限越低，敌人占领多少土地你才会屈服</li></ul>
      <p>维持稳定的手段：民政拨款、胜利、贸易；失去稳定的手段：伤亡、封锁、通货膨胀。</p>` },
  factory: { title:'工厂与工业', icon:'🏭',
    body:(w,n)=>{
      const BUILD_KIND_NAMES = { mil:'军工厂', civ:'民工厂', infra:'基础设施', air_base:'空军基地', naval_base:'海军基地' };
      const q = n.build && n.build.kind ? `<p><b>建造队列：</b>${BUILD_KIND_NAMES[n.build.kind] || n.build.kind} 施工中 ${Math.floor(n.build.prog)}/${n.build.need}（位于 ${n.build.q},${n.build.r}）${(n.buildQueue || []).length ? ` · 另有 ${n.buildQueue.length} 项排队` : ''}</p>` : '<p>建造队列空闲。</p>';
      return `<p><b>军用工厂：${n.mil}</b>（每厂 5 装备点/天 × 生产线效率）<br>
      <b>民用工厂：${n.civ}</b>（每厂 5 建造点/天，扣除消费品份额）</p>
      <p>民工厂负责建造：民工厂 5000 点 / 军工厂 6000 点 / 基础设施 3000 点。
      每格最多 4 座工厂，15 座可同时施工。</p>
      <p>经济法案决定消费品占用：民用 35% / 早期动员 20% / 战时 10% / 总动员 5%。</p>${q}`; } },
  equip:   { title:'装备库存明细', icon:'📦',
    body:(w,n)=>{
      const names = { inf_eq:'步兵装备', art_eq:'火炮', tank_eq:'坦克', truck_eq:'卡车', sup_eq:'支援装备' };
      const rows = Object.entries(n.equipment||{}).map(([k,v])=>{
        const line = (n.productionLines||[]).find(l=>l.type===k);
        const out = line ? (line.factories * 5 * Math.min(line.cap, line.eff)).toFixed(1) : '0';
        return `<tr><td>${names[k]||k}</td><td>${Math.floor(v)}</td><td>+${out}/天</td><td>${line?Math.floor(line.factories)+' 厂':'—'}</td></tr>`;
      }).join('');
      return `<p>装备由军工厂沿生产线产出，效率随时间从 10% 爬升至 50%。换产线保留一半效率。</p>
      <table class="enc-table"><tr><th>类型</th><th>库存</th><th>日产量</th><th>生产线</th></tr>${rows}</table>
      <p>用途：训练与补员新师（按模板消耗）、为现有师补充兵力损失。</p>`; } },
  div:     { title:'现役师团总览', icon:'⚔️',
    body:(w,n)=>{
      const mine = w.units.filter(u=>u.nat===w.player);
      const cnt = {}; mine.forEach(u=>{ cnt[u.type]=(cnt[u.type]||0)+1; });
      const names = { inf:'步兵师', cav:'骑兵师', mtn:'山地师', mot:'摩托化师', larm:'轻装甲师', arm:'装甲师' };
      const rows = Object.entries(cnt).map(([t,c])=>`<tr><td>${names[t]||t}</td><td>${c}</td></tr>`).join('');
      return `<p><b>现役师团 ${mine.length} 个。</b></p><table class="enc-table"><tr><th>类型</th><th>数量</th></tr>${rows}</table>
      <p>点击地图上的部队格，可在右侧详情中查看每个师的组织度、兵力与壕沟状态，并展开完整档案。</p>`; } }
};

export function showModal(html){
  let modal = document.getElementById('sf-generic-modal');
  if(!modal){
    modal = document.createElement('div');
    modal.id = 'sf-generic-modal';
    modal.className = 'sf-overlay';
    document.body.appendChild(modal);
  }
  modal.innerHTML = `<div class="brief-box" style="max-width:580px;">${html}</div>`;
  modal.classList.add('on');
  modal.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => modal.classList.remove('on'));
  });
}

export function openIndicatorModal(store, key){
  const w = store.world;
  const n = w.nations[w.player];
  const meta = IND_META[key];
  if(!meta) return;
  showModal(`
    <h3>${meta.icon} ${meta.title}</h3>
    <div class="kind">国家指标详情</div>
    <div class="txt">${meta.body(w, n)}</div>
    <div class="close-row"><button class="btn" data-close>了解</button></div>
  `);
}

/* ============================================================
   钢四经典战地战术对阵视窗 (openBattleModal)
   点击战斗气泡时弹出，完整展示攻守双方师团、组织度、兵力、战宽与战术
   ============================================================ */
export function openBattleModal(store, hexIdx){
  let modal = document.getElementById('sf-battle-modal');
  if(!modal){
    modal = document.createElement('div');
    modal.id = 'sf-battle-modal';
    modal.className = 'sf-overlay sf-battle-overlay';
    document.body.appendChild(modal);
  }

  const w = store.world;
  const h = w.hexes[hexIdx];
  if(!h) return;

  // 收集进攻方与防御方
  const attackers = w.units.filter(u =>
    u.hp > 0 && u.order && u.order.type === 'attack' &&
    u.order.target[0] === h.q && u.order.target[1] === h.r
  );
  const sampleAtk = attackers[0];
  const atkNatTag = sampleAtk ? sampleAtk.nat : w.player;
  const defenders = (h.units || []).map(id => w.units.find(x => x.id === id))
    .filter(u => u && u.hp > 0 && (!sampleAtk || (w.nations[sampleAtk.nat]?.atWarWith || []).includes(u.nat)));
  const defNatTag = defenders[0] ? defenders[0].nat : h.owner;

  const atkNat = w.nations[atkNatTag] || { name: atkNatTag, color: '#3b82f6' };
  const defNat = w.nations[defNatTag] || { name: defNatTag, color: '#ef4444' };

  // 战术优势评分
  let atkPower = 0, defPower = 0;
  for(const a of attackers){
    const U = UNITS[a.type] || { soft: 10, hard: 2 };
    atkPower += (U.soft + U.hard * 1.5) * (a.org / 60) * (a.hp / 100);
  }
  for(const d of defenders){
    const U = UNITS[d.type] || { def: 15, armor: 0 };
    const ent = 1 + (d.entrench || 0);
    defPower += (U.def + U.armor * 2) * (d.org / 60) * (d.hp / 100) * ent;
  }
  const rawAdvantage = Math.round((atkPower / (atkPower + defPower + 0.001)) * 100);
  const advantage = Math.min(99, Math.max(1, rawAdvantage));

  const isPlayerAtk = (atkNatTag === w.player);
  const isPlayerDef = (defNatTag === w.player);
  const playerAdvantage = isPlayerAtk ? advantage : isPlayerDef ? (100 - advantage) : advantage;

  const scoreClass = playerAdvantage >= 55 ? 'green' : playerAdvantage >= 40 ? 'yellow' : 'red';
  const statusText = playerAdvantage >= 55 ? '战局突破推进中' : playerAdvantage >= 40 ? '战线焦灼拉锯中' : '攻势受挫 / 处于下风';

  // 渲染部队卡片
  const renderUnitCard = (u) => {
    const U = UNITS[u.type] || { name: '主力师', org: 60, hp: 100, soft: 10, def: 15 };
    const hpPct = Math.min(100, Math.max(0, (u.hp / U.hp) * 100));
    const orgPct = Math.min(100, Math.max(0, (u.org / U.org) * 100));
    return `
      <div class="sf-battle-unit-item">
        <div class="sf-bunit-top">
          <span>${u.name || (U.name + ' #' + u.id)}</span>
          <span style="font-size:10.5px;color:#cbd5e1;">Lv${u.level||1} · 战宽 ${U.width}W</span>
        </div>
        <div class="sf-bunit-bars">
          <div>
            <div class="sf-bbar-lbl"><span>兵力 (HP)</span><span>${Math.round(u.hp)}%</span></div>
            <div class="sf-bbar-track"><div class="sf-bbar-fill hp" style="width:${hpPct}%;"></div></div>
          </div>
          <div>
            <div class="sf-bbar-lbl"><span>组织度 (ORG)</span><span>${Math.round(u.org)}/${U.org}</span></div>
            <div class="sf-bbar-track"><div class="sf-bbar-fill org" style="width:${orgPct}%;"></div></div>
          </div>
        </div>
      </div>
    `;
  };

  const hexTitle = h.city ? `${h.city.name} (${h.q}, ${h.r})` : `前线要冲 (${h.q}, ${h.r})`;

  modal.innerHTML = `
    <div class="sf-battle-box">
      <!-- 弹窗顶栏 -->
      <div class="sf-battle-header">
        <div class="sf-battle-title">
          <span>⚔️ 战地战术对阵视窗 · ${hexTitle}</span>
        </div>
        <button class="dossier-close-x" id="sf-close-battle-modal">✕</button>
      </div>

      <!-- 中军对决战况横幅 -->
      <div class="sf-battle-clash-banner">
        <div class="sf-clash-party">
          <div style="width:12px;height:40px;background:${atkNat.color};border-radius:2px;"></div>
          <div>
            <div class="sf-clash-nat-name">${atkNat.name} (进攻集团)</div>
            <div class="sf-clash-general">参战师团：${attackers.length} 师 · 突破战力 ${Math.round(atkPower)}</div>
          </div>
        </div>

        <div class="sf-clash-meter-box">
          <div class="sf-clash-circle ${scoreClass}">${playerAdvantage}</div>
          <div class="sf-clash-status-text">${statusText}</div>
        </div>

        <div class="sf-clash-party def">
          <div>
            <div class="sf-clash-nat-name">${defNat.name} (防御集团)</div>
            <div class="sf-clash-general">守备师团：${defenders.length} 师 · 防御战力 ${Math.round(defPower)}</div>
          </div>
          <div style="width:12px;height:40px;background:${defNat.color};border-radius:2px;"></div>
        </div>
      </div>

      <!-- 战地环境与战宽修正 -->
      <div class="sf-battle-modifiers">
        <span class="sf-mod-pill buff">📐 地形战宽：${h.terrain === 'mount' ? '50W (山地狭窄)' : h.terrain === 'city' ? '60W (街垒)' : '80W (开阔)'}</span>
        <span class="sf-mod-pill">⛰️ 地貌：${TERRAIN[h.terrain]?.name || '平原'}</span>
        ${h.river ? '<span class="sf-mod-pill debuff">🌊 渡河强攻 (-30% 攻击惩罚)</span>' : ''}
        ${defenders.some(d => d.entrench > 0.05) ? '<span class="sf-mod-pill buff">⛏️ 守方堑壕 (+25% 坚韧度)</span>' : ''}
        <span class="sf-mod-pill">⚡ 进攻战术：闪电战突袭 (+15% 突破)</span>
        <span class="sf-mod-pill">🛡️ 防守战术：弹性纵深防御 (+15% 防御)</span>
      </div>

      <!-- 双方师团对阵清单 -->
      <div class="sf-battle-grid">
        <!-- 进攻师团 -->
        <div class="sf-battle-col">
          <div class="sf-battle-col-header">
            <span>进攻序列 (${attackers.length} 师)</span>
            <span>突击姿态</span>
          </div>
          <div class="sf-battle-units-list">
            ${attackers.map(renderUnitCard).join('') || '<div style="color:#64748b;font-size:12px;padding:20px;text-align:center;">暂无参战部队</div>'}
          </div>
        </div>

        <!-- 防御师团 -->
        <div class="sf-battle-col">
          <div class="sf-battle-col-header">
            <span>防御序列 (${defenders.length} 师)</span>
            <span>依托掩体</span>
          </div>
          <div class="sf-battle-units-list">
            ${defenders.map(renderUnitCard).join('') || '<div style="color:#64748b;font-size:12px;padding:20px;text-align:center;">防线已洞穿空虚</div>'}
          </div>
        </div>
      </div>

      <!-- 底部指令栏 -->
      <div class="sf-battle-footer">
        <div>
          ${isPlayerAtk ? `
            <button class="btn" id="sf-battle-retreat-btn" style="background:linear-gradient(180deg,#dc2626,#991b1b);border:1px solid #f87171;color:#fff;">
              🛑 紧急撤退 / 停止进攻
            </button>
          ` : '<span style="font-size:12px;color:#94a3b8;">前线守军坚守战位中...</span>'}
        </div>
        <button class="btn" id="sf-battle-close-btn" style="background:#1e293b;border:1px solid #475569;color:#e2e8f0;">
          关闭视窗 (ESC)
        </button>
      </div>
    </div>
  `;

  modal.classList.add('on');
  sound.playClick();

  // 绑定关闭与撤退事件
  const close = () => {
    modal.classList.remove('on');
    sound.playClick();
  };
  modal.querySelector('#sf-close-battle-modal')?.addEventListener('click', close);
  modal.querySelector('#sf-battle-close-btn')?.addEventListener('click', close);

  modal.querySelector('#sf-battle-retreat-btn')?.addEventListener('click', () => {
    sound.playAlert();
    for(const u of attackers){
      if(u.nat === w.player){
        u.order = null; // 取消进攻，就地整备
      }
    }
    showToast('🚩 我军攻势已下达停火指令，部队就地转入防御');
    close();
  });
}

