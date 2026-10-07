/* ============================================================
   ui/panelPeace.js —— 战后和平会议谈判桌 (v7.0 §2.3 / E4)
   全屏和会大厅：贡献度计分明细 / 割让·傀儡·非军事区·资源掠夺
   ============================================================ */

import { sound } from '../core/audio.js';
import { PEACE_ACTIONS, applyPeaceAction, closePeaceConference } from '../engine/peace.js';
import { showToast } from './panels.js';

let _pendingPick = null;   // { type } 等待选格的行动类型

export function openPeaceConferenceModal(store, onClose){
  const w = store.world;
  const conf = w.pendingPeace;
  if(!conf) return;
  let modal = document.getElementById('sf-peace-modal');
  if(!modal){
    modal = document.createElement('div');
    modal.id = 'sf-peace-modal';
    modal.className = 'sf-overlay sf-peace-overlay';
    document.body.appendChild(modal);
  }
  _pendingPick = null;

  function spentOf(actor){
    return (conf.actions[actor] || []).reduce((s, a) => s + (a.paid || 0), 0);
  }

  function render(){
    const loser = w.nations[conf.loser];
    const me = w.player;
    const myPts = conf.points[me] || 0;
    const mySpent = spentOf(me);
    const myLeft = myPts - mySpent;

    // 可索领土（战败国原始领土中仍非我方的格子）
    const claimable = w.hexes.filter(h => h._orig === conf.loser && h.owner !== me && !h.demilitarized);
    const dmzable = w.hexes.filter(h => h._orig === conf.loser && !h.demilitarized && h.owner === me);
    const puppetDone = !!conf._puppetDone;
    const hasRights = (w.nations[me].resourceRights || []).some(r => r.natId === conf.loser);

    const bkd = conf.breakdown[me] || {};
    modal.innerHTML = `
      <div class="sf-peace-box">
        <div class="peace-header">
          <div>
            <div class="peace-kicker">PARIS PEACE CONFERENCE · 战后和平会议</div>
            <h2 class="peace-title">${loser ? loser.name : conf.loser} 无条件投降</h2>
            <div class="peace-date">第 ${conf.day} 天 · 战胜国分列谈判桌</div>
          </div>
          <div class="peace-balance">
            <span class="lbl">和会点数余额</span>
            <span class="val">${myLeft}</span>
            <span class="lbl" style="font-size:10px;">总点数 ${myPts} · 已花费 ${mySpent}</span>
          </div>
        </div>

        <div class="peace-cols">
          <div class="peace-left">
            <div class="peace-section-title">📊 战争贡献度计分（本国防务省核定）</div>
            <table class="peace-table">
              <tr><td>造成敌军歼灭</td><td>${bkd.kills || 0} 师</td><td>+${bkd.killScore || 0}</td></tr>
              <tr><td>占领敌方胜利点</td><td>${bkd.occVP || 0} VP</td><td>+${bkd.occScore || 0}</td></tr>
              <tr><td>承受伤亡牺牲度</td><td>${bkd.losses || 0} 师</td><td>+${bkd.lossScore || 0}</td></tr>
              <tr><td>战略轰炸破坏度</td><td>—</td><td>+0.0</td></tr>
              <tr class="total"><td>合计（基础100）</td><td></td><td>${myPts}</td></tr>
            </table>
            <div class="peace-hint">权重：杀伤 35% · 占领 40% · 牺牲 15% · 轰炸 10%</div>

            <div class="peace-section-title" style="margin-top:14px;">⚖️ 谈判桌行动</div>
            <div class="peace-actions">
              <button class="btn peace-act" data-act="takeState" ${myLeft < PEACE_ACTIONS.takeState.costBase || !claimable.length ? 'disabled' : ''}>
                🗺️ 割让领土 <small>${PEACE_ACTIONS.takeState.costBase}+VP×5 点</small>
              </button>
              <button class="btn peace-act" data-act="puppet" ${myLeft < PEACE_ACTIONS.puppet.costBase || puppetDone ? 'disabled' : ''}>
                🏴 傀儡政权 <small>${PEACE_ACTIONS.puppet.costBase} 点${puppetDone ? ' ✓已建立' : ''}</small>
              </button>
              <button class="btn peace-act" data-act="demilitarize" ${myLeft < PEACE_ACTIONS.demilitarize.costBase || !dmzable.length ? 'disabled' : ''}>
                🕊️ 非军事区 <small>${PEACE_ACTIONS.demilitarize.costBase} 点</small>
              </button>
              <button class="btn peace-act" data-act="resourceRights" ${myLeft < PEACE_ACTIONS.resourceRights.costBase || hasRights ? 'disabled' : ''}>
                ⛏️ 资源掠夺 <small>${PEACE_ACTIONS.resourceRights.costBase} 点${hasRights ? ' ✓已攫取' : ''}</small>
              </button>
            </div>

            <div id="peace-pick-area"></div>
          </div>

          <div class="peace-right">
            <div class="peace-section-title">📜 已签署条款</div>
            <div id="peace-clauses">
              ${(conf.actions[me] || []).map(a => {
                if(a.type === 'takeState'){
                  const h = w.at[a.q + ',' + a.r];
                  return `<div class="peace-clause">🗺️ 割占 ${h && h.city ? h.city.name : `(${a.q},${a.r})`} <small>-${a.paid}点</small></div>`;
                }
                return `<div class="peace-clause">${PEACE_ACTIONS[a.type] ? PEACE_ACTIONS[a.type].name : a.type} <small>-${a.paid}点</small></div>`;
              }).join('') || '<div class="peace-hint">尚无条款签署</div>'}
            </div>
            <div class="peace-hint" style="margin-top:10px;">AI 战胜方将按占领现状自动托管其余领土。闭幕时未分配点数作废。</div>
          </div>
        </div>

        <div class="peace-footer">
          <button class="btn primary" id="sf-peace-close">📜 签署和约 · 闭幕和会</button>
        </div>
      </div>`;

    // 行动按钮
    modal.querySelectorAll('.peace-act').forEach(btn => {
      btn.addEventListener('click', () => {
        sound.playClick();
        const act = btn.dataset.act;
        if(act === 'takeState' || act === 'demilitarize'){
          _pendingPick = { type: act };
          renderPickArea(act === 'takeState' ? claimable : dmzable);
        } else {
          const res = applyPeaceAction(w, me, act, {});
          if(res.ok){ sound.playStamp(); showToast(`⚖️ 和约条款签署：${PEACE_ACTIONS[act].name}`); render(); }
          else showToast('⚠️ ' + res.msg);
        }
      });
    });

    modal.querySelector('#sf-peace-close').addEventListener('click', () => {
      sound.playStamp();
      closePeaceConference(w);
      modal.classList.remove('on');
      if(onClose) onClose();
    });

    modal.classList.add('on');
  }

  function renderPickArea(hexes){
    const area = modal.querySelector('#peace-pick-area');
    if(!area) return;
    if(!hexes.length){
      area.innerHTML = '<div class="peace-hint">无可选省份</div>';
      return;
    }
    area.innerHTML = `
      <div class="peace-section-title" style="margin-top:10px;">
        ${_pendingPick.type === 'takeState' ? '选择索取的省份' : '选择划设非军事区的省份'}（点击签署）
      </div>
      <div class="peace-pick-grid">
        ${hexes.slice(0, 60).map(h => {
          const cost = _pendingPick.type === 'takeState'
            ? PEACE_ACTIONS.takeState.costBase + (h.city ? h.city.w : 0) * PEACE_ACTIONS.takeState.costVP
            : PEACE_ACTIONS.demilitarize.costBase;
          return `<button class="btn peace-pick" data-q="${h.q}" data-r="${h.r}">
            ${h.city ? h.city.name : `(${h.q},${h.r})`} <small>${cost}点</small>
          </button>`;
        }).join('')}
      </div>`;
    area.querySelectorAll('.peace-pick').forEach(b => {
      b.addEventListener('click', () => {
        sound.playStamp();
        const res = applyPeaceAction(w, w.player, _pendingPick.type, { q: +b.dataset.q, r: +b.dataset.r });
        if(res.ok){
          showToast(`⚖️ 条款签署：${PEACE_ACTIONS[_pendingPick.type].name} (${b.dataset.q},${b.dataset.r})`);
          _pendingPick = null;
          render();
        } else {
          showToast('⚠️ ' + res.msg);
        }
      });
    });
  }

  render();
}
