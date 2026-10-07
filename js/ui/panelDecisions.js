/* ============================================================
   ui/panelDecisions.js —— 决议面板 (v14.0 P2 §3.1)
   四分类决议列表：条件不足显示原因、进行中显示剩余天数、可撤销
   ============================================================ */

import { DECISION_CATEGORIES } from '../data/decisions.js';
import { availableDecisions, fireDecision, cancelDecision } from '../engine/decisions.js';
import { showToast } from './panels.js';
import { sound } from '../core/audio.js';

export function renderDecisions(container, store){
  const w = store.world;
  const n = w.nations[w.player];
  if(!container || !n) return;
  const list = availableDecisions(w, w.player);
  const activeCount = list.filter(x => x.active).length;
  const availCount = list.filter(x => x.ok).length;

  const groups = DECISION_CATEGORIES.map(cat => {
    const items = list.filter(x => x.def.cat === cat.id);
    if(!items.length) return '';
    const rows = items.map(({ def, ok, reason, active }) => {
      const act = n.decisions && n.decisions.active ? n.decisions.active[def.id] : null;
      const left = act ? Math.max(0, Math.ceil(act.until - w.day)) : 0;
      const costTxt = def.cost > 0 ? `<span style="color:#d4af37">${def.cost} PP</span>` : '<span style="color:#56AC5B">免费</span>';
      const durTxt = def.duration ? `<span title="效果持续天数">⏱ ${def.duration}天</span>` : '';
      const srcTxt = def.source ? `<span class="d-src">${def.source}</span>` : '';
      let btn;
      if(active){
        btn = `<button class="btn small dec-cancel" data-dec-cancel="${def.id}">撤销</button>`;
      } else if(ok){
        const needHex = def.reqInfra != null || def.oncePerHex;
        btn = `<button class="btn small primary" data-dec="${def.id}" ${needHex ? 'data-needs-hex="1"' : ''}>执行</button>`;
      } else {
        btn = `<button class="btn small" disabled title="${reason}">不可用</button>`;
      }
      return `<div class="dec-row ${active ? 'on' : (ok ? '' : 'off')}">
        <div class="dec-main">
          <div class="dec-name">${def.name} ${srcTxt}
            <span class="dec-cost">${costTxt}</span> ${durTxt}
            ${def.once ? '<span class="dec-tag">一次性</span>' : ''}
            ${def.maxUses ? `<span class="dec-tag">上限${def.maxUses}次</span>` : ''}
            ${def.oncePerHex ? '<span class="dec-tag">每省一次</span>' : ''}
          </div>
          <div class="dec-desc">${def.desc}</div>
          ${active ? `<div class="dec-active">进行中 · 剩余 ${left} 天</div>`
                   : (!ok && reason ? `<div class="dec-reason">✖ ${reason}</div>` : '')}
        </div>
        <div class="dec-act">${btn}</div>
      </div>`;
    }).join('');
    return `<div class="dec-cat">
      <div class="dec-cat-head"><span class="dec-cat-icon">${cat.icon}</span>
        <span class="dec-cat-name">${cat.name}</span>
        <span class="dec-cat-desc">${cat.desc}</span>
        <span class="dec-cat-count">${items.filter(x => x.ok || x.active).length}/${items.length}</span>
      </div>
      ${rows}
    </div>`;
  }).join('');

  container.innerHTML = `
    <div class="dec-header">
      <div class="dec-title">📜 决议</div>
      <div class="dec-pp">政治点数 <b>${Math.floor(n.pp)}</b> <span class="dec-pp-max">/ ${1000}</span></div>
      <div class="dec-summary">可执行 ${availCount} · 进行中 ${activeCount} · 共 ${list.length}</div>
    </div>
    <div class="dec-hint">决议消耗政治点数换取强力效果，是中后期的主要操作抓手。限时效果到期自动失效。</div>
    ${groups}`;

  // 事件绑定
  container.querySelectorAll('[data-dec]').forEach(btn => {
    btn.addEventListener('click', () => {
      sound.playStamp();
      const id = btn.dataset.dec;
      const def = list.find(x => x.def.id === id);
      // 需要指定省份的决议：自动选一个满足条件的己方省
      let hex = null;
      if(btn.dataset.needsHex === '1'){
        const cands = w.hexes.filter(h => h.owner === w.player);
        hex = cands.sort((a, b) => (b.infra || 0) - (a.infra || 0))[0] || null;
      }
      const res = fireDecision(w, w.player, id, hex);
      if(res.ok){
        showToast('📜 决议已执行：' + (def ? def.def.name : id));
        renderDecisions(container, store);
      } else {
        showToast('⚠️ ' + res.msg);
      }
    });
  });
  container.querySelectorAll('[data-dec-cancel]').forEach(btn => {
    btn.addEventListener('click', () => {
      sound.playClick();
      const res = cancelDecision(w, w.player, btn.dataset.decCancel);
      showToast(res.ok ? '↩️ ' + res.msg : '⚠️ ' + res.msg);
      renderDecisions(container, store);
    });
  });
}
