/* ============================================================
   ui/screenPages.js —— 四张新屏幕的渲染器
   主菜单 / 时代大厅 / 国家档案舱 / 战史复盘（AAR）
   数据源：v3.0 四剧本数据包 + ERA_META + LEADER_META
   ============================================================ */

import { ERA_META, ERA_PLAYABLE, LEADER_META } from './screenManager.js';
import { renderFlagHtml, renderTitleBannerHtml, getProceduralBadgeSvg } from '../core/assets.js';
import { PORTRAIT_MAP, aarBackground } from './portraitMap.js';

const ERA_CODE = { ww1:'WW1', ww2:'WW2', coldwar:'CW', modern:'MOD' };
/* 现代副本虚构人物剧情线提示（[F]） */
const FICTIONAL_HOOKS = {
  RUS: '葛修傅', JPN: '吉爱习', USA: '小鹿', GBR: '王若伊'
};

/* 各时代剧本数据包注册表（由 main.js 注入，避免循环依赖） */
const SCENARIO_PACKS = {};
export function registerScenarioPack(eraKey, pack){
  SCENARIO_PACKS[eraKey] = pack;
}

function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

/* 领袖油画肖像；缺图回退为姓名徽章（C11） */
function renderLeaderImg(d){
  const pid = PORTRAIT_MAP[d.metaKey];
  const badge = getProceduralBadgeSvg(d.tag, d.leader.replace(/^.*政府$/, d.tag), d.color);
  if(!pid){
    return `<img src="${badge}" alt="${esc(d.leader)}" style="width:100%;height:100%;object-fit:cover;display:block;">`;
  }
  return `<img src="assets/portraits/leaders/${pid}.png" alt="${esc(d.leader)}" loading="lazy"
    style="width:100%;height:100%;object-fit:cover;display:block;"
    onerror="this.onerror=null;this.src='${badge}';">`;
}

/* ============================================================
   屏幕 1：主菜单
   ============================================================ */
export function renderMainMenu(container, hooks){
  const saves = hooks.findLatestSave && hooks.findLatestSave();
  container.innerHTML = `
    <div class="mm-bg-layer mm-kenburns" id="mm-bg"></div>
    <div class="mm-vignette"></div>
    <div class="mm-content">
      <div class="mm-logo-block">
        <div class="mm-logo-metal">
          <h1 class="mm-title">钢铁前线</h1>
          <div class="mm-title-en">STEEL FRONT</div>
        </div>
        <div class="mm-subtitle">全景历史大战略推演引擎 · 参谋部沙盘系统</div>
        <div class="mm-version">v7.0 · 全景页面流就绪 · 确定性沙盘引擎 · 4 剧本 × 51 国数据装载</div>
      </div>
      <div class="mm-menu-ribbon">
        <button class="mm-btn mm-btn-primary" data-act="campaign">
          <span class="mm-btn-icon">⚔️</span>
          <span class="mm-btn-text"><b>单人战役推演</b><i>CAMPAIGN · 选择时代与国家</i></span>
        </button>
        ${saves ? `
        <button class="mm-btn" data-act="continue">
          <span class="mm-btn-icon">📂</span>
          <span class="mm-btn-text"><b>继续历史档案</b><i>${esc(saves.saveName)} · ${saves.scenario.toUpperCase()} · 第${saves.day}天</i></span>
        </button>` : ''}
        <button class="mm-btn" data-act="codex">
          <span class="mm-btn-icon">📖</span>
          <span class="mm-btn-text"><b>最高统帅部档案库</b><i>装备 · 工业 · 人物 · 机制</i></span>
        </button>
        <button class="mm-btn" data-act="settings">
          <span class="mm-btn-icon">⚙️</span>
          <span class="mm-btn-text"><b>音画与作战设置</b><i>SETTINGS</i></span>
        </button>
        <button class="mm-btn" data-act="credits">
          <span class="mm-btn-icon">🎖️</span>
          <span class="mm-btn-text"><b>开发人员与考据鸣谢</b><i>CREDITS</i></span>
        </button>
      </div>
      <div class="mm-foot">确定性沙盘引擎 · 零依赖单文件 · 1914 → 2022</div>
    </div>
  `;

  // 背景轮播：四时代标题图（缺失回退为纯色渐变）
  const eras = ['ww1','ww2','coldwar','modern'];
  let bgIdx = 0;
  const bgEl = container.querySelector('#mm-bg');
  const rotate = () => {
    if(!document.body.contains(bgEl)) return;
    bgEl.style.backgroundImage = `url('${ERA_META[eras[bgIdx]].titleAsset}')`;
    bgIdx = (bgIdx + 1) % eras.length;
  };
  rotate();
  container._bgTimer = setInterval(rotate, 6000);

  container.querySelectorAll('[data-act]').forEach(btn => {
    btn.addEventListener('click', () => {
      const act = btn.dataset.act;
      if(act === 'campaign') hooks.onCampaign();
      else if(act === 'continue' && hooks.onContinue) hooks.onContinue(saves);
      else if(act === 'codex' && hooks.onCodex) hooks.onCodex();
      else if(act === 'settings' && hooks.onSettings) hooks.onSettings();
      else if(act === 'credits' && hooks.onCredits) hooks.onCredits();
    });
  });
}
export function disposeMainMenu(container){
  if(container && container._bgTimer) clearInterval(container._bgTimer);
}

/* ============================================================
   屏幕 2：四时代全景副本大厅
   ============================================================ */
export function renderEraLobby(container, hooks){
  const intensity = n => '★'.repeat(n) + '☆'.repeat(Math.max(0, 4-n));
  container.innerHTML = `
    <div class="era-topbar">
      <button class="btn" data-act="back">◄ 返回主菜单</button>
      <div class="era-topbar-title">最高统帅部 · 历史推演编年史书签</div>
      <button class="btn" data-act="mech">? 时代机制说明</button>
    </div>
    <div class="era-card-row" id="era-card-row">
      ${Object.values(ERA_META).map(era => `
        <div class="sf-era-card ${era.themeClass}" data-era="${era.id}">
          <div class="era-card-bg" style="background-image:url('${era.titleAsset}')"></div>
          <div class="era-card-year">${era.year}</div>
          <div class="era-card-name">${era.name}</div>
          <div class="era-card-fullname">${era.fullName}</div>
          <div class="era-card-tags">
            ${era.tags.map(t => `<span class="era-tag">${esc(t)}</span>`).join('')}
          </div>
          <div class="era-card-meta">结算：${era.tick} · 烈度 ${intensity(era.intensity)}</div>
        </div>
      `).join('')}
    </div>
    <div class="era-brief-bar">
      <div class="era-brief-text" id="era-brief-text">选择一个时代，进入国家沙盘挑选你的执政大国。</div>
      <button class="btn gold" data-act="enter" id="era-enter-btn" disabled>进入国家沙盘 ►</button>
    </div>
  `;

  let picked = null;
  container.querySelectorAll('.sf-era-card').forEach(card => {
    card.addEventListener('click', () => {
      container.querySelectorAll('.sf-era-card').forEach(c => c.classList.remove('picked'));
      card.classList.add('picked');
      picked = card.dataset.era;
      const era = ERA_META[picked];
      const brief = container.querySelector('#era-brief-text');
      if(brief) brief.textContent = `${era.fullName} —— ${era.conflict}`;
      const enter = document.getElementById('era-enter-btn');
      if(enter) enter.disabled = false;
    });
  });
  const enterBtn = container.querySelector('#era-enter-btn');
  if(enterBtn) enterBtn.addEventListener('click', () => { if(picked) hooks.onEraPicked(picked); });
  const backBtn = container.querySelector('[data-act="back"]');
  if(backBtn) backBtn.addEventListener('click', () => hooks.onBack());
  const mechBtn = container.querySelector('[data-act="mech"]');
  if(mechBtn) mechBtn.addEventListener('click', () => hooks.onMech && hooks.onMech());
}

/* ============================================================
   屏幕 3：国家挑选与沙盘档案舱
   ============================================================ */
export function renderCountrySelect(container, hooks, eraKey){
  const era = ERA_META[eraKey];
  const pack = SCENARIO_PACKS[eraKey];
  const nationsData = pack ? (pack.customNations || pack.nations || {}) : {};
  const armiesData = pack ? (pack.armies || {}) : {};
  const playable = ERA_PLAYABLE[eraKey] || [];
  const dossiers = playable.map(tag => {
    const nd = nationsData[tag];
    if(!nd) return null;
    const metaKey = tag + '_' + ERA_CODE[eraKey];
    const lm = LEADER_META[metaKey] || {};
    const army = armiesData[tag] || {};
    const armyDivs = Object.values(army).reduce((s,v)=>s+v, 0) || 8;
    const fictionalHook = (eraKey === 'modern' && FICTIONAL_HOOKS[tag]) ? FICTIONAL_HOOKS[tag] : null;
    return {
      tag, metaKey, name: nd.name, color: nd.color, capital: nd.capital,
      leader: lm.leader || '现任政府',
      gov: lm.gov || '—',
      ideology: lm.ideology || '—',
      spirits: lm.spirits || ['国家精神整理中…'],
      fictional: !!lm.fictional,
      fictionalHook: fictionalHook || null,
      armyDivs,
      strength: {
        army: Math.min(10, Math.round(armyDivs / 4)),
        industry: Math.min(10, Math.round((nd.mil || 4) / 2.5)),
        resources: Math.min(10, Math.round((nd.equip || 400) / 250))
      },
      law: nd.law, warSupport: nd.warSupport, stability: nd.stability,
      ai: nd.ai
    };
  }).filter(Boolean);

  container.innerHTML = `
    <div class="era-topbar">
      <button class="btn" data-act="back">◄ 重选时代</button>
      <div class="era-topbar-title">剧本：${esc(era.fullName)} · 选择你的执政国家</div>
      <button class="btn" data-act="mech">? 作战手册</button>
    </div>
    <div class="cs-main">
      <div class="cs-mapzone" id="cs-mapzone">
        <canvas id="cs-minimap" width="900" height="560"></canvas>
        <div class="cs-map-hint">左键点选国土格选中国家 · 滚轮缩放 · 拖拽平移</div>
      </div>
      <aside class="sf-country-dossier" id="cs-dossier">
        <div class="cs-dossier-empty">点击地图上的国家国土，查看统帅部档案。</div>
      </aside>
    </div>
    <div class="cs-deploy-ribbon">
      <div class="cs-diff-group">
        <span class="cs-ribbon-label">推演难度</span>
        <button class="btn" data-diff="lieutenant" title="敌军产能 0.8 倍 · 决策迟缓 · 包围网阈值最高">列兵</button>
        <button class="btn" data-diff="historical" title="敌军产能 1.0 倍 · 史实节奏">上校</button>
        <button class="btn gold" data-diff="general" title="敌军产能 1.0 倍 · 标准主动 AI">上将</button>
        <button class="btn" data-diff="field_marshal" title="敌军产能 1.3 倍 · 决策迅捷 · 包围网紧密">元帅</button>
      </div>
      <div class="cs-iron-group">
        <label class="cs-iron-label"><input type="checkbox" id="cs-ironman"> 铁人模式（单存档硬核）</label>
      </div>
      <button class="cs-deploy-btn" id="cs-deploy-btn" disabled>
        签署总动员令 · 开赴前线 ►
      </button>
    </div>
  `;

  /* 状态 */
  let pickedTag = null;
  let difficulty = 'general';
  const ironman = () => container.querySelector('#cs-ironman') && container.querySelector('#cs-ironman').checked;

  /* 难度按钮 */
  container.querySelectorAll('[data-diff]').forEach(b => {
    b.addEventListener('click', () => {
      container.querySelectorAll('[data-diff]').forEach(x => x.classList.remove('gold'));
      b.classList.add('gold');
      difficulty = b.dataset.diff;
    });
  });

  /* 迷你沙盘：绘制全国地图 + 点击选国 */
  const cv = container.querySelector('#cs-minimap');
  const ctx = cv.getContext('2d');
  const mapData = pack && pack.buildMap ? pack.buildMap() : null;
  const allHexes = mapData ? mapData.hexes : [];
  const cam = { x:0, y:0, z: Math.min(cv.width / (26*1.8*30), cv.height / (16*1.5*30)) * 0.95, size: 30 };
  const toPix = (h) => ({ x: cam.size*1.732*(h.q + (h.r&1?0.5:0))*cam.z + cam.x, y: cam.size*1.5*h.r*cam.z + cam.y });
  const drawMini = () => {
    ctx.fillStyle = '#10141c'; ctx.fillRect(0,0,cv.width,cv.height);
    for(const h of allHexes){
      const p = toPix(h);
      const s = cam.size * cam.z * 0.95;
      const nd = nationsData[h.owner];
      ctx.beginPath();
      for(let i=0;i<6;i++){
        const a = Math.PI/180 * (60*i - 30);
        const px = p.x + s*Math.cos(a), py = p.y + s*Math.sin(a);
        if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
      }
      ctx.closePath();
      ctx.fillStyle = nd ? nd.color : '#333';
      ctx.globalAlpha = (pickedTag === h.owner) ? 0.95 : 0.45;
      ctx.fill();
      ctx.globalAlpha = 1;
      if(h.city && h.city.w >= 3){
        ctx.fillStyle = '#f2e8c8';
        ctx.font = `${Math.max(9, 10*cam.z)}px "Noto Serif SC",serif`;
        ctx.textAlign = 'center';
        ctx.fillText(h.city.name, p.x, p.y - s*0.6);
      }
    }
  };
  drawMini();

  cv.addEventListener('click', e => {
    const rect = cv.getBoundingClientRect();
    const px = (e.clientX-rect.left) * (cv.width/rect.width);
    const py = (e.clientY-rect.top) * (cv.height/rect.height);
    // 命中：遍历找最近格中心
    let best=null, bd=1e9;
    for(const h of allHexes){
      const p = toPix(h);
      const dd = (p.x-px)*(p.x-px) + (p.y-py)*(p.y-py);
      if(dd < bd){ bd=dd; best=h; }
    }
    if(!best || bd > Math.pow(cam.size*cam.z*1.2,2)) return;
    const tag = best.owner;
    const dossier = dossiers.find(d => d.tag === tag);
    if(!dossier){
      // 未列 playable 的国家：提示中立或次要国
      const nd = nationsData[tag];
      renderDossierPlaceholder(nd ? nd.name : tag, '该国在本剧本中由 AI 代管，暂未开放执政。');
      return;
    }
    pickedTag = tag;
    renderDossier(dossier);
    drawMini();
  });

  function renderDossierPlaceholder(name, note){
    const el = container.querySelector('#cs-dossier');
    el.innerHTML = `<div class="cs-dossier-empty"><b>${esc(name)}</b><br>${esc(note)}</div>`;
    document.getElementById('cs-deploy-btn').disabled = true;
  }

  function renderDossier(d){
    const el = container.querySelector('#cs-dossier');
    const spirits = d.spirits.map(s => `<div class="spirit-row"><span class="spirit-star">★</span>${esc(s)}</div>`).join('');
    const bar = (label, val, extra) => `
      <div class="cs-bar-row"><span class="cs-bar-label">${label}</span>
        <div class="cs-bar-track">${'<i class="cs-bar-seg"></i>'.repeat(val)}${'<i class="cs-bar-seg empty"></i>'.repeat(10-val)}</div>
        <span class="cs-bar-val">${extra}</span></div>`;
    el.innerHTML = `
      <div class="dossier-head">
        <div class="dossier-portrait">${renderLeaderImg(d)}</div>
        <div class="dossier-head-text">
          <div class="dossier-nation">${esc(d.name)}</div>
          <div class="dossier-leader">领袖：${esc(d.leader)}${d.fictional ? ' <span class="f-tag">[F 虚构]</span>' : ''}</div>
          <div class="dossier-gov">${esc(d.gov)} · ${esc(d.ideology)}</div>
        </div>
      </div>
      <div class="dossier-flag">${renderFlagHtml(d.tag, 120, 78)}</div>
      <div class="cs-bars">
        ${bar('陆军军力', d.strength.army, d.armyDivs + ' 师')}
        ${bar('工业产能', d.strength.industry, (nationsData[d.tag] ? nationsData[d.tag].mil : 4) + ' 军厂')}
        ${bar('资源自给', d.strength.resources, Math.floor((nationsData[d.tag] ? nationsData[d.tag].equip : 300)/100) + ' 基数')}
      </div>
      <div class="dossier-spirits">
        <div class="spirits-title">国家精神 National Spirits</div>
        ${spirits}
      </div>
      <div class="dossier-ai-note">AI 对手已按六维人格矩阵运作 · 包围网与至暗时刻机制待命</div>
      ${d.fictionalHook ? `<div class="dossier-fictional">剧情人物线索：<b>${esc(d.fictionalHook)} [F]</b> —— 本剧本中可通过专属国策链与事件网接管政权，或作为 AI 对手按其意识形态路线行动。</div>` : ''}
    `;
    const btn = document.getElementById('cs-deploy-btn');
    if(btn){
      btn.disabled = false;
      btn.classList.add('ready');
    }
  }

  /* 事件钩子 */
  const backBtn = container.querySelector('[data-act="back"]');
  if(backBtn) backBtn.addEventListener('click', () => hooks.onBack());
  const mechBtn = container.querySelector('[data-act="mech"]');
  if(mechBtn) mechBtn.addEventListener('click', () => hooks.onMech && hooks.onMech());
  const deployBtn = container.querySelector('#cs-deploy-btn');
  if(deployBtn) deployBtn.addEventListener('click', () => {
    hooks.onStart(pickedTag, difficulty, ironman());
  });
}

/* ============================================================
   屏幕 5：终局战史复盘与将领授勋大厅（AAR）
   ============================================================ */
export function renderAAR(container, data){
  const { world, over } = data;
  const era = ERA_META[world.scenario] || ERA_META.ww2;
  const playerHexes = world.hexes.filter(h => h.owner === world.player).length;
  const totalHexes = world.hexes.filter(h => h._orig === world.player).length || playerHexes;
  const playerDivs = world.units.filter(u => u.nat === world.player).length;
  const stats = world.stats || { kills:0, losses:0, hexesTaken:0 };
  const headline = over.win
    ? { img: aarBackground(world.scenario, true), text:'帝国的旗帜插上了敌人的最后一道防线。历史将由胜利者书写。' }
    : { img: aarBackground(world.scenario, false), text:'号角吹响，但命运没有站在我们这一边。废墟之下，记忆仍在。' };

  const topGeneral = (world.stats && world.stats.topGeneral) || null;
  const medal = { ww1:'铁十字勋章', ww2:'胜利勋章', coldwar:'红星勋章', modern:'荣誉勋章' }[world.scenario] || '荣誉勋章';

  container.innerHTML = `
    <div class="aar-headline" style="background-image:url('${headline.img}')">
      <div class="aar-headline-overlay">
        <div class="aar-era-tag">${esc(era.fullName)}</div>
        <h1>${over.win ? '战 略 胜 利' : '战 役 终 局'}</h1>
        <p>${esc(over.text)}</p>
        <p class="aar-headline-quote">${esc(headline.text)}</p>
      </div>
    </div>
    <div class="aar-body">
      <div class="aar-ledger">
        <div class="aar-ledger-title">战役资产清算总账</div>
        <div class="aar-ledger-grid">
          <div class="aar-stat"><span class="aar-stat-val">${world.day}</span><span class="aar-stat-label">推演天数</span></div>
          <div class="aar-stat"><span class="aar-stat-val">${stats.kills}</span><span class="aar-stat-label">歼灭敌军师</span></div>
          <div class="aar-stat"><span class="aar-stat-val">${stats.losses}</span><span class="aar-stat-label">我军损失</span></div>
          <div class="aar-stat"><span class="aar-stat-val">${playerHexes}</span><span class="aar-stat-label">掌握地区</span></div>
        </div>
      </div>
      <div class="aar-hof">
        <div class="aar-hof-title">战区名将授勋台 · Hall of Fame</div>
        <div class="aar-medal">
          <div class="aar-medal-badge">🎖️</div>
          <div class="aar-medal-text">
            <b>${medal}</b>
            <span>授予本局战功最卓著之统帅</span>
          </div>
        </div>
        ${topGeneral ? `<div class="aar-topgen">${esc(topGeneral)}</div>` : ''}
      </div>
      <div class="aar-actions">
        <button class="btn primary" data-act="replay">重现历史 · 再次挑战</button>
        <button class="btn" data-act="menu">返回统帅部大厅</button>
      </div>
    </div>
  `;
  container.querySelectorAll('[data-act]').forEach(b => {
    b.addEventListener('click', () => {
      if(b.dataset.act === 'replay' && hooks.onReplay) hooks.onReplay();
      if(b.dataset.act === 'menu' && hooks.onMenu) hooks.onMenu();
    });
  });
}
