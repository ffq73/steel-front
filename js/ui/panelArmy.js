/* ============================================================
   ui/panelArmy.js —— 军与作战计划交互面板 (v4.0 §2.7 / P1)
   支持军建制管理、将领技能四维、一键划线/填线/画箭头/执行/战术选择
   ============================================================ */

import { K } from '../data/constants.js';
import { renderPortraitHtml } from '../core/assets.js';
import { getGeneralSkills, getArmyPlanCap, createFront, assignToFront, createArrow, createFallbackLine, executeArrow } from '../engine/plans.js';
import { sound } from '../core/audio.js';
import { showToast } from './panels.js';   // v12.0 C47：alert 清零

export class ArmyPanel {
  constructor(store, ui, container){
    this.store = store;
    this.ui = ui;
    this.container = container;
    this.selectedArmyId = null;
  }

  ensureDefaultArmies(){
    const w = this.store.world;
    w.armies = w.armies || [];
    if(!w.armies.length && w.player){
      const playerDivs = w.units.filter(u => u.nat === w.player);
      const half = Math.ceil(playerDivs.length / 2);
      
      const a1 = {
        id: 'army_1',
        name: '东线第1野战军',
        nat: w.player,
        generalId: (w.characters && w.characters.find(c => c.nat === w.player && c.type === 'general')) ? w.characters.find(c => c.nat === w.player && c.type === 'general').id : null,
        divisions: playerDivs.slice(0, half).map(u => { u.armyId = 'army_1'; return u.id; }),
        frontId: null,
        arrowIds: [],
        fallbackHexes: [],
        planning: 0,
        executing: false
      };

      const a2 = {
        id: 'army_2',
        name: '西线守备军',
        nat: w.player,
        generalId: null,
        divisions: playerDivs.slice(half).map(u => { u.armyId = 'army_2'; return u.id; }),
        frontId: null,
        arrowIds: [],
        fallbackHexes: [],
        planning: 0,
        executing: false
      };

      w.armies.push(a1, a2);
    }

    if(!this.selectedArmyId && w.armies.length){
      this.selectedArmyId = w.armies[0].id;
    }
  }

  cycleArmy(){
    const w = this.store.world;
    const playerArmies = (w.armies || []).filter(a => a.nat === w.player);
    if(!playerArmies.length) return;
    const curIdx = playerArmies.findIndex(a => a.id === this.selectedArmyId);
    const nextIdx = (curIdx + 1) % playerArmies.length;
    this.selectedArmyId = playerArmies[nextIdx].id;
    this.update();
  }

  update(){
    if(!this.container) return;
    this.ensureDefaultArmies();

    const w = this.store.world;
    const n = w.nations[w.player];
    if(!n) return;

    const armies = (w.armies || []).filter(a => a.nat === w.player);
    const army = armies.find(a => a.id === this.selectedArmyId) || armies[0];
    if(!army){
      this.container.innerHTML = '<div style="padding:10px;color:var(--dim)">无编制野战军</div>';
      return;
    }

    const skills = getGeneralSkills(w, army.generalId);
    const generalObj = (w.characters || []).find(c => c.id === army.generalId);
    const planCap = getArmyPlanCap(w, army);
    const isOverCap = army.divisions.length > K.ARMY_MAX_DIVISIONS;
    const overDivs = Math.max(0, army.divisions.length - K.ARMY_MAX_DIVISIONS);
    const overPenalty = isOverCap ? Math.min(K.OVER_CAPACITY_PENALTY_MAX, K.OVER_CAPACITY_PENALTY_BASE + overDivs * K.OVER_CAPACITY_PENALTY_PER_DIV) : 0;

    let html = `
      <div class="army-panel-box" style="font-size:12px;">
        <!-- 军选择标签 -->
        <div style="display:flex;gap:4px;margin-bottom:8px;border-bottom:1px solid var(--line);padding-bottom:6px;overflow-x:auto;">
    `;

    for(const a of armies){
      const isSel = a.id === army.id;
      html += `<button class="btn ${isSel ? 'gold' : ''}" style="font-size:11px;padding:3px 6px;" data-select-army="${a.id}">${a.name}</button>`;
    }

    html += `
        </div>

        <!-- 军长信息与四维技能 -->
        <div style="display:flex;gap:8px;background:rgba(255,255,255,0.03);border:1px solid #334;border-radius:4px;padding:6px;margin-bottom:8px;">
          ${generalObj ? renderPortraitHtml(generalObj, 48) : '<div style="width:48px;height:60px;background:#222;border:1px dashed #555;display:flex;align-items:center;justify-content:center;color:#888;font-size:11px;">未指派</div>'}
          <div style="flex:1;min-width:0;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <b style="color:var(--gold);font-size:13px;">${generalObj ? generalObj.name : '军统帅未定'}</b>
              <span style="font-size:10px;padding:1px 4px;background:#3a4454;border-radius:2px;color:#eee;">
                ${skills.rank === 'marshal' ? '陆军元帅' : '军长'}
              </span>
            </div>
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:2px;margin:4px 0;font-size:10.5px;text-align:center;">
              <div style="background:#281b1b;color:#f99;border-radius:2px;padding:1px 0;">攻 ${skills.attack}</div>
              <div style="background:#1b2428;color:#9cf;border-radius:2px;padding:1px 0;">防 ${skills.defense}</div>
              <div style="background:#24281b;color:#df9;border-radius:2px;padding:1px 0;">计 ${skills.planning}</div>
              <div style="background:#28201b;color:#fd9;border-radius:2px;padding:1px 0;">谋 ${skills.tactics}</div>
            </div>
            ${skills.rank !== 'marshal' && generalObj ? `
              <button class="btn" style="font-size:10px;padding:1px 6px;width:100%;margin-top:2px;" data-promote-marshal="${generalObj.id}">
                晋升元帅 (花50指挥点)
              </button>
            ` : ''}
          </div>
        </div>

        <!-- 编制状态与超编预警 (C14) -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <span>军直辖编制：<b>${army.divisions.length}</b> / ${K.ARMY_MAX_DIVISIONS} 师</span>
          <span style="color:${isOverCap ? 'var(--red)' : 'var(--green)'};font-size:11px;">
            ${isOverCap ? `⚠️ 超编惩罚 -${Math.round(overPenalty*100)}%` : '编制合规'}
          </span>
        </div>

        <!-- 计划槽 -->
        <div style="margin-bottom:8px;background:rgba(0,0,0,0.3);border:1px solid #334;border-radius:4px;padding:6px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:11px;">
            <span>作战计划槽 (上限 ${Math.round(planCap*100)}%)</span>
            <b style="color:var(--gold)">${(army.planning*100).toFixed(1)}%</b>
          </div>
          <div style="height:6px;background:#1a1d24;border-radius:3px;overflow:hidden;position:relative;">
            <div style="height:100%;background:linear-gradient(90deg,#8b0000,#d8b74f);width:${Math.min(100, (army.planning/planCap)*100)}%;"></div>
          </div>
          <div style="font-size:10px;color:var(--dim);margin-top:3px;">
            ${army.executing ? '🔥 正在执行推进中（每日计划 -5%）' : '⏳ 战线筹备集结中（每日计划 +' + (K.PLAN_ACCUM_RATE * skills.planning / 10 * 100).toFixed(1) + '%）'}
          </div>
        </div>

        <!-- 核心操作按钮组 (C13 鼠标一键操作) -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:8px;">
          <button class="btn gold" style="font-size:11px;padding:5px;" data-tool="front">
            [F] 划定前线
          </button>
          <button class="btn gold" style="font-size:11px;padding:5px;" data-tool="assign">
            [G] 一键填线
          </button>
          <button class="btn" style="font-size:11px;padding:5px;" data-tool="arrow">
            [X] 进攻箭头
          </button>
          <button class="btn" style="font-size:11px;padding:5px;" data-tool="fallback">
            [V] 退守线
          </button>
        </div>

        <!-- 执行推进总按钮 -->
        <button class="btn ${army.executing ? 'primary' : 'gold'}" style="width:100%;padding:8px;font-size:13px;font-weight:bold;margin-bottom:8px;" data-toggle-exec>
          ${army.executing ? '⏸ 暂停计划推进' : '⚔️ 开始推进 (执行计划)'}
        </button>

        <!-- 战术卡战备选择 -->
        <div style="border-top:1px dashed var(--line);padding-top:6px;margin-top:4px;">
          <div style="font-size:11px;color:var(--dim);margin-bottom:4px;">军级战备预设战术 (谋略掷点)：</div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;">
            ${Object.keys(K.TACTICS).map(k => {
              const t = K.TACTICS[k];
              return `<button class="btn" style="font-size:10px;padding:3px 2px;" data-set-tactic="${t.id}" title="${t.desc}">${t.name}</button>`;
            }).join('')}
          </div>
        </div>
      </div>
    `;

    this.container.innerHTML = html;
    this.bindEvents();
  }

  bindEvents(){
    this.container.querySelectorAll('[data-select-army]').forEach(b => {
      b.addEventListener('click', () => {
        sound.playClick();
        this.selectedArmyId = b.dataset.selectArmy;
        this.update();
      });
    });

    this.container.querySelectorAll('[data-promote-marshal]').forEach(b => {
      b.addEventListener('click', () => {
        sound.playClick();
        const cid = b.dataset.promoteMarshal;
        this.store.dispatch({ type: 'PROMOTE_MARSHAL', charId: cid });
        this.update();
      });
    });

    this.container.querySelectorAll('[data-tool]').forEach(b => {
      b.addEventListener('click', () => {
        sound.playClick();
        const tool = b.dataset.tool;
        const w = this.store.world;
        const army = (w.armies || []).find(a => a.id === this.selectedArmyId);
        if(!army) return;

        if(tool === 'front'){
          // 自动求解或根据当前选格划线
          const front = createFront(w, w.player, [], army.id);
          assignToFront(w, front.id);
          this.store.emit();
          this.update();
        } else if(tool === 'assign'){
          if(army.frontId){
            assignToFront(w, army.frontId);
          } else {
            const front = createFront(w, w.player, [], army.id);
            assignToFront(w, front.id);
          }
          this.store.emit();
          this.update();
        } else if(tool === 'arrow'){
          // 自动寻找距离前线最近的敌方重要城市或边界格
          if(army.frontId){
            const front = w.fronts.find(f => f.id === army.frontId);
            const targetHex = w.hexes.find(h => h.city && h.owner !== w.player) || w.hexes.find(h => h.owner !== w.player);
            if(front && targetHex){
              createArrow(w, front.id, [targetHex.idx], army.id);
              this.store.emit();
              this.update();
            }
          }
        } else if(tool === 'fallback'){
          const myCap = w.hexes.find(h => h.city && h.city.cap === w.player);
          if(myCap){
            createFallbackLine(w, w.player, [myCap.idx], army.id);
            this.store.emit();
            this.update();
          }
        }
      });
    });

    const execBtn = this.container.querySelector('[data-toggle-exec]');
    if(execBtn){
      execBtn.addEventListener('click', () => {
        sound.playClick();
        const w = this.store.world;
        const army = (w.armies || []).find(a => a.id === this.selectedArmyId);
        if(!army) return;
        if(army.executing){
          army.executing = false;
        } else {
          executeArrow(w, army.id);
        }
        this.store.emit();
        this.update();
      });
    }

    this.container.querySelectorAll('[data-set-tactic]').forEach(b => {
      b.addEventListener('click', () => {
        sound.playClick();
        const tacticId = b.dataset.setTactic;
        const w = this.store.world;
        w.tacticsState = w.tacticsState || {};
        w.tacticsState.preferred = tacticId;
        showToast(`已选择战役战术预案：【${K.TACTICS[tacticId].name}】 ${K.TACTICS[tacticId].desc}`);
      });
    });
  }
}
