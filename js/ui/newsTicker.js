/* ============================================================
   ui/newsTicker.js —— 新闻滚动屏与统帅部号外特派弹窗 (v6.0 / §6.2)
   1024×576 宽屏历史油画大图、做旧打字机信笺、战地特派电讯
   ============================================================ */

import { sound } from '../core/audio.js';
import { getEventImageSrc, getNewspaperImageSrc } from '../core/assets.js';

export class NewsTicker {
  constructor(store){
    this.store = store;
    // v9.5 U2：电台从地图顶撤编，头条改挂底部日志条左翼（全页唯一电台入口）
    this.container = document.getElementById('sf-log-head');
    this.lastText = '';
  }

  update(){
    const w = this.store.world;
    if(!w) return;

    // 优先检查是否有待弹出的号外报纸
    if(w.pendingNewspaper){
      renderNewspaperModal(this.store);
    }

    if(!this.container) return;

    // 头条来源：号外快讯优先，回落到每日战报日志（两条 feed 合一，避免头条静默而日志有料）
    const latest = w.newsFeed && w.newsFeed.length
      ? { day: w.newsFeed[0].day, headline: w.newsFeed[0].headline }
      : (w.log && w.log.length ? { day: w.log[0].day, headline: String(w.log[0].text).split('\n')[0] } : null);

    if(!latest){
      // 空态：仅头条区一句静默文案（历史日志区为空，不重复文案）
      if(this.lastText !== '__quiet__'){
        this.lastText = '__quiet__';
        this.container.innerHTML = '<span class="sf-log-quiet">📻 战地电台静默中 —— 推进时间线，每日战报与历史事件将在此汇编</span>';
      }
      return;
    }

    const displayText = `第 ${latest.day} 天 · ${latest.headline}`;
    if(displayText !== this.lastText){
      this.lastText = displayText;
      this.container.innerHTML = `
        <span class="sf-log-head-tag">📻 最新电讯</span>
        <span class="sf-log-head-txt" title="${displayText}">第 ${latest.day} 天 · ${latest.headline}</span>
      `;
    }
  }
}

/**
 * 历史事件油画图片映射表 (支持 1024x576 宽屏大图)
 */
const EVENT_IMAGES = {
  ev_01: 'assets/ww2/events/event_danzig_fire.png',
  ev_02: 'assets/events/danzig.jpg',
  ev_03: 'assets/ww2/events/event_warsaw_siege.png',
  ev_04: 'assets/ww2/events/event_fall_of_france.png',
  ev_05: 'assets/ww2/events/event_kursk_armor.png',
  ev_06: 'assets/events/fall_france.jpg',
  ev_07: 'assets/ww2/events/event_factory_worker.png',
  ev_09: 'assets/ww2/events/event_warsaw_siege.png',
  ev_18: 'assets/ww2/events/event_barbarossa.png',
  ev_27: 'assets/ww2/events/event_final_ruins.png',
  ev_34: 'assets/ww2/events/event_field_map_room.png',
  ev_41: 'assets/ww2/events/event_yalta_conference.png',
  // 时代通用回退大图
  ww1: 'assets/events/marne.jpg',
  ww2: 'assets/ww2/events/event_danzig_fire.png',
  coldwar: 'assets/events/berlin_airlift.jpg',
  modern: 'assets/events/smo_start.jpg'
};

/**
 * 弹出 1024×576 军用历史大事件油画特派弹窗 (v6.0 §6.2)
 */
export function renderNewspaperModal(store){
  const w = store.world;
  const paper = w.pendingNewspaper;
  if(!paper) return;

  let modal = document.getElementById('sf-news-modal');
  if(!modal){
    modal = document.createElement('div');
    modal.id = 'sf-news-modal';
    modal.className = 'sf-overlay';
    document.body.appendChild(modal);
  }

  // 匹配事件油画或时代代表性大图
  let bannerSrc = EVENT_IMAGES[paper.id] || getEventImageSrc(paper.id, w.era) || 'assets/ww2/events/event_danzig_fire.png';
  let newspaperHeadSrc = getNewspaperImageSrc(w.era || 'ww2');
  let fallbackSrc = 'assets/events/danzig.jpg';

  modal.innerHTML = `
    <div class="modal-event-box" style="max-width:760px;">
      <!-- 时代战时报纸特刊报头 -->
      <div style="width:100%;height:72px;overflow:hidden;background:#0d121a;border-bottom:2px solid #5a4020;position:relative;">
        <img src="${newspaperHeadSrc}" alt="newspaper masthead" style="width:100%;height:100%;object-fit:cover;filter:contrast(1.05) brightness(0.9);"
          onerror="this.style.display='none';">
        <div style="position:absolute;inset:0;background:linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.65) 100%);"></div>
        <div style="position:absolute;bottom:6px;left:14px;right:14px;display:flex;justify-content:space-between;align-items:center;color:#fef08a;font-size:11.5px;font-family:var(--font-mono);text-shadow:0 1px 3px #000;">
          <span>📰 ${paper.paperName || '战时特刊 EXTRA'}</span>
          <span>${paper.date || `第 ${paper.day} 天`} · 国际战局特别快讯</span>
        </div>
      </div>

      <!-- 顶部 1024x576 宽屏历史油画插图 -->
      <div style="position:relative;width:100%;height:240px;overflow:hidden;background:#10151f;">
        <img class="modal-event-banner" src="${bannerSrc}" alt="${paper.headline}" style="width:100%;height:100%;object-fit:cover;display:block;"
          onerror="this.onerror=null;this.src='${fallbackSrc}';">
        <div style="position:absolute;inset:0;box-shadow:inset 0 0 30px rgba(0,0,0,0.85);pointer-events:none;"></div>
      </div>

      <!-- 电讯正文公文区 -->
      <div class="modal-event-body">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #3d4a5d;padding-bottom:6px;">
          <div style="font-size:11px;letter-spacing:2px;color:var(--brass-bright);text-transform:uppercase;font-weight:bold;">
            ★★★ SONDERBERICHT · 战地最高统帅部特派公文 ★★★
          </div>
          <div style="font-size:11px;color:#fca5a5;font-family:var(--font-mono);">
            全球紧张度: ${Math.round(w.tension ? w.tension.value : 0)}% · 绝密等级
          </div>
        </div>

        <h2 class="modal-event-headline">${paper.headline}</h2>
        <div class="modal-event-text">${paper.desc}</div>

        <!-- 历史决断选项组 -->
        <div class="modal-event-options">
          ${paper.choices.map((c, idx) => `
            <button class="btn-event-choice" data-paper-choice="${idx}">
              <span>▶ <b>${c.text}</b></span>
              <span style="font-size:11px;color:var(--brass-bright);">${formatChoiceEffect(c.effect)}</span>
            </button>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  modal.classList.add('on');
  sound.playAlert();

  modal.querySelectorAll('[data-paper-choice]').forEach(btn => {
    btn.addEventListener('click', () => {
      sound.playClick();
      const choiceIdx = +btn.dataset.paperChoice;
      const c = paper.choices[choiceIdx];
      if(c && c.effect){
        applyEventEffect(store.world, c.effect);
      }
      w.pendingNewspaper = null;
      modal.classList.remove('on');
    });
  });
}

function formatChoiceEffect(effect){
  if(!effect) return '';
  const parts = [];
  if(effect.pp) parts.push(`政治点 ${effect.pp > 0 ? '+' : ''}${effect.pp}`);
  if(effect.armyXp) parts.push(`陆战经验 +${effect.armyXp}`);
  if(effect.warSupport) parts.push(`战争支持度 +${effect.warSupport}%`);
  if(effect.equipLoss) parts.push(`装备 -${effect.equipLoss}`);
  if(effect.civGain) parts.push(`民用工厂 +${effect.civGain}`);
  if(effect.atkArm) parts.push(`装甲进攻 +${Math.round(effect.atkArm*100)}%`);
  return parts.join(' · ');
}

function applyEventEffect(world, effect){
  const n = world.nations[world.player];
  if(!n) return;
  if(effect.pp) n.pp = Math.max(0, n.pp + effect.pp);
  if(effect.armyXp) n.armyXp = (n.armyXp || 0) + effect.armyXp;
  if(effect.warSupport) n.warSupport = Math.min(100, (n.warSupport || 50) + effect.warSupport);
  if(effect.equipGain) n.equip = (n.equip || 0) + effect.equipGain;
  if(effect.equipLoss) n.equip = Math.max(0, (n.equip || 0) - effect.equipLoss);
  if(effect.civGain) n.civ = (n.civ || 0) + effect.civGain;
}
