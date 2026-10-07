/* ============================================================
   ui/panelResearch.js —— 科研面板 (v14.0 P4 §5)
   7 系科技树（工业/陆军学说/陆军装备/空军/海军/电子/核物理），
   显示在研槽位、可研究项（含前置提示与超前年份惩罚）、已完成科技。
   ============================================================ */

import { TECHS, TECH_BRANCHES } from '../data/techs.js';
import { availableTechs, startResearch, techUnmetRequires } from '../engine/research.js';
import { K } from '../data/constants.js';
import { showToast } from './panels.js';
import { sound } from '../core/audio.js';

const EFFECT_LABEL = {
  modifier: t => {
    const scope = t.effect.scope || 'nation';
    const v = t.effect.value;
    const sign = v >= 0 ? '+' : '';
    const names = {
      buildSpeed: '建造速度', milOutput: '军工产出', effCap: '产线效率上限',
      research: '科研速度', reinforce: '预备队增援', entrenchMax: '堑壕上限',
      airSuperiority: '制空权', airDetection: '对空探测', strategicBomb: '战略轰炸',
      convoyEscort: '护航效率', convoyRaiding: '破交效率', nuclearYield: '核当量'
    };
    return (names[t.effect.stat] || t.effect.stat) + ' ' + sign + Math.round(v * 100) + '%';
  },
  unlockUnit: t => '解锁 ' + (t.effect.unit || '').toUpperCase() + ' 兵种',
  unlockAircraft: t => '解锁机种：' + (t.effect.aircraft || []).map(a => ({ fighter:'战斗机', cas:'CAS', heavy_fighter:'重型战斗机', naval_bomber:'鱼雷轰炸机', tactical_bomber:'战术轰炸机', strat_bomber:'战略轰炸机' }[a] || a)).join('、'),
  unlockShip: t => '解锁舰种：' + (t.effect.ships || []).map(s => ({ destroyer:'驱逐舰', cruiser:'巡洋舰', battleship:'战列舰', carrier:'航母', submarine:'潜艇', convoy:'运输船' }[s] || s)).join('、'),
  unlockFeature: t => '解锁能力：' + ({ nuclear_weapon:'核武器', nuclear_upgrade:'核反应堆', rocket:'火箭', rocket_advanced:'弹道导弹', transport_ship:'运输船', landing_craft:'登陆艇' }[t.effect.feature] || t.effect.feature),
  addResearchSlot: t => '+' + t.effect.count + ' 科研槽',
  addPP: t => '+' + t.effect.value + ' 政治点数'
};

function effectText(t){
  if(!t || !t.effect) return '';
  const fn = EFFECT_LABEL[t.effect.type];
  let s = fn ? fn(t) : t.effect.type;
  if(t.effect.extra && t.effect.extra.invasionCap) s += '（登陆上限 ' + t.effect.extra.invasionCap.value + '）';
  return s;
}

let activeBranchTab = 'industry'; // 默认选工业

export function renderResearchPanel(container, store){
  const w = store.world;
  const n = w.nations[w.player];
  if(!container || !n) return;

  const avail = availableTechs(w, w.player);
  const curYear = 1939 + Math.floor(w.day / 365);
  const slots = n.research.slots || [];

  // 学科 Tab 栏
  const branchKeys = Object.keys(TECH_BRANCHES);
  if(!branchKeys.includes(activeBranchTab)) activeBranchTab = branchKeys[0];

  const tabHtml = `<div class="rs-tabs" style="display:flex;gap:6px;margin-bottom:12px;overflow-x:auto;padding-bottom:4px;border-bottom:1px solid rgba(212,175,55,0.2);">
    ${branchKeys.map(bid => {
      const isSel = bid === activeBranchTab;
      const totalInBranch = TECHS.filter(t => t.branch === bid).length;
      const doneInBranch = TECHS.filter(t => t.branch === bid && n.research.done[t.id]).length;
      return `<button class="btn ${isSel ? 'gold' : ''}" data-rs-tab="${bid}" style="font-size:12px;padding:4px 10px;white-space:nowrap;">
        ${TECH_BRANCHES[bid]} <span style="font-size:10px;opacity:0.8;">(${doneInBranch}/${totalInBranch})</span>
      </button>`;
    }).join('')}
  </div>`;

  // 渲染当前分支科技树
  const list = TECHS.filter(t => t.branch === activeBranchTab);
  const done = list.filter(t => n.research.done[t.id]).length;

  // 树状层级：根据 requires 深度组织
  const rows = list.map(t => {
    const isDone = !!n.research.done[t.id];
    const isActive = slots.includes(t.id);
    const unmet = techUnmetRequires(w, w.player, t.id);
    const can = avail.some(a => a.id === t.id);
    const ahead = Math.max(0, t.year - curYear);
    const aheadTxt = ahead > 0 ? `<span class="rs-ahead" title="超前研究惩罚">⚠ 超前 ${ahead} 年</span>` : '';
    let btn;
    if(isDone) btn = '<span class="rs-done">✓ 已掌握</span>';
    else if(isActive){
      const p = (n.research.progress && n.research.progress[w.player + ':' + t.id]) || 0;
      const pct = Math.min(100, Math.round(p / t.days * 100));
      btn = `<span class="rs-active">研发中 ${pct}%</span>
             <button class="btn small rs-cancel" data-rs-cancel="${t.id}" style="margin-left:6px;">中止</button>`;
    } else if(can) btn = `<button class="btn small primary" data-rs="${t.id}">启动研发</button>`;
    else btn = `<span class="rs-locked" title="前置未完成">${unmet.length ? '需前置：' + unmet.map(u => (TECHS.find(x=>x.id===u)||{name:u}).name).join('、') : '前置受锁'}</span>`;

    const reqNames = (t.requires || []).map(r => (TECHS.find(x => x.id === r) || { name: r }).name);
    const reqBadge = reqNames.length ? `<div style="font-size:10px;color:#8a94a6;margin-top:2px;">前置依赖: ${reqNames.join(' ➔ ')}</div>` : '';

    return `<div class="rs-row ${isDone ? 'done' : (isActive ? 'on' : (can ? '' : 'off'))}" style="margin-bottom:8px;border-left:3px solid ${isDone ? '#81c784' : isActive ? '#64b5f6' : can ? '#d4af37' : '#4a5568'};background:rgba(255,255,255,0.02);padding:8px 12px;border-radius:4px;display:flex;align-items:center;justify-content:space-between;">
      <div class="rs-main" style="flex:1;">
        <div class="rs-name" style="font-weight:700;font-size:13px;color:var(--ink);">
          ${t.name} ${aheadTxt}
          <span class="rs-days" style="font-size:11px;color:var(--dim);margin-left:8px;">⏱️ ${t.days}天</span>
          <span class="rs-year" style="font-size:11px;color:var(--gold);margin-left:6px;">📅 ${t.year}年</span>
        </div>
        <div class="rs-eff" style="font-size:11px;color:#a0aec0;margin-top:2px;">${effectText(t)}</div>
        ${reqBadge}
      </div>
      <div class="rs-act" style="margin-left:12px;">${btn}</div>
    </div>`;
  }).join('');

  container.innerHTML = `
    <div class="rs-header" style="margin-bottom:12px;">
      <div class="rs-title" style="font-size:18px;font-weight:bold;color:var(--gold);display:flex;align-items:center;gap:8px;">
        <span>🔬 国家工业与尖端国防科研院</span>
      </div>
      <div class="rs-year" style="font-size:12px;color:var(--dim);margin-top:4px;">
        当前国际历法 <b>${curYear} 年</b> · 军工科研槽 <b>${slots.filter(Boolean).length}/${slots.length}</b> 运转中
      </div>
    </div>
    <div class="rs-slots" style="display:flex;gap:8px;margin-bottom:12px;">
      ${slots.map((s, i) => `<div class="rs-slot ${s ? 'busy' : ''}" style="flex:1;padding:8px;border:1px dashed ${s ? '#64b5f6' : '#4a5568'};border-radius:4px;background:rgba(255,255,255,0.03);text-align:center;font-size:11.5px;">
        ${s ? `<b style="color:#64b5f6">⚙️ ${esc(s)}</b>` : '<span style="color:#5a6472">空闲科研位</span>'}
      </div>`).join('')}
    </div>
    ${tabHtml}
    <div class="rs-cat-tree" style="max-height:55vh;overflow-y:auto;padding-right:6px;">
      ${rows}
    </div>`;

  function esc(str){
    const t = TECHS.find(x => x.id === str);
    return t ? t.name : str;
  }

  // 绑定 Tab 切换
  container.querySelectorAll('[data-rs-tab]').forEach(tabBtn => {
    tabBtn.addEventListener('click', () => {
      sound.playClick();
      activeBranchTab = tabBtn.dataset.rsTab;
      renderResearchPanel(container, store);
    });
  });

  // 绑定研发与取消
  container.querySelectorAll('[data-rs]').forEach(btn => {
    btn.addEventListener('click', () => {
      sound.playClick();
      const id = btn.dataset.rs;
      if(startResearch(w, w.player, id)){
        const t = TECHS.find(x => x.id === id);
        showToast('🔬 开始研究：' + t.name + '（' + t.days + ' 天）');
        renderResearchPanel(container, store);
      } else {
        showToast('⚠️ 科研槽已满或前置未完成');
      }
    });
  });

  container.querySelectorAll('[data-rs-cancel]').forEach(btn => {
    btn.addEventListener('click', () => {
      sound.playClick();
      const id = btn.dataset.rsCancel;
      const idx = slots.indexOf(id);
      if(idx >= 0){
        slots[idx] = null;
        if(n.research.progress) delete n.research.progress[w.player + ':' + id];
        showToast('↩️ 已中止研究');
        renderResearchPanel(container, store);
      }
    });
  });
}
