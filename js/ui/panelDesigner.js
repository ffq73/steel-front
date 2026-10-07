/* ============================================================
   ui/panelDesigner.js —— 师设计器 UI (v4.0 §3.3 / P3)
   5×5 战斗营方阵 + 5 支援连槽位，实时属性核算与换装缺编提示
   ============================================================ */

import { BATTALIONS, SUPPORT_COMPANIES, calcTemplateStats, calcTemplateDiff, createDefaultTemplates, convertDivisionTemplate,
         validateTemplate, REGIMENT_CLASS, TEMPLATE_TIERS, templateAdjust } from '../engine/template.js';
import { sound } from '../core/audio.js';

export function openDesignerModal(store){
  let modal = document.getElementById('sf-designer-modal');
  if(!modal){
    modal = document.createElement('div');
    modal.id = 'sf-designer-modal';
    modal.className = 'sf-overlay';
    document.body.appendChild(modal);
  }

  const w = store.world;
  const n = w.nations[w.player];
  if(!n) return;

  w.templates = w.templates || createDefaultTemplates();
  let selectedTmplKey = Object.keys(w.templates)[0] || 'infantry_standard';
  // 正在编辑的临时编制深拷贝
  let workingTemplate = JSON.parse(JSON.stringify(w.templates[selectedTmplKey]));
  let originalTemplate = JSON.parse(JSON.stringify(workingTemplate));

  function render(){
    const stats = calcTemplateStats(workingTemplate);
    // v14.0 P1：营列合规提示（HOI4 规则：一列不可混装类型）
    const vchk = validateTemplate(workingTemplate);
    const warnHtml = vchk.ok ? '' :
      `<div style="margin:8px 0;padding:7px 10px;background:rgba(224,96,85,0.12);
           border-left:2px solid #e06055;font-size:11.5px;color:#f0a29a;">
         ⚠ 编制不合规：${vchk.errors.map(e => e.msg).join('；')}
       </div>`;

    const xpCost = calcTemplateDiff(originalTemplate, workingTemplate);
    const canAffordXP = (n.armyXp || 0) >= xpCost;
    workingTemplate.tier = workingTemplate.tier || 'regular';

    let html = `<div class="brief-box" style="max-width:920px;max-height:90vh;display:flex;flex-direction:column;padding:22px;">
      <!-- 顶部标题与预设选择 -->
      <div class="modal-header">
        <div style="display:flex;align-items:center;gap:12px;">
          <span class="modal-emblem">📐</span>
          <div>
            <h2 class="modal-title">师编制设计器与装备管理</h2>
            <div class="modal-sub">
              陆战经验: <b style="color:#81c784">${Math.floor(n.armyXp || 50)} XP</b> · 修改槽位花费: <b style="color:${canAffordXP ? 'var(--gold)' : '#ff6b6b'}">${xpCost} XP</b>
            </div>
          </div>
        </div>
        <button class="btn" id="sf-close-designer">关闭 (ESC)</button>
      </div>

      <!-- v14.0 P1：配给等级（HOI4 elite/regular/reserve） -->
      <div style="display:flex;gap:8px;margin-bottom:10px;align-items:center;flex-wrap:wrap;
                  padding:6px 9px;background:rgba(255,255,255,0.03);border-left:2px solid #b59247;">
        <span style="font-size:12px;color:var(--gold);font-weight:700;">配给等级</span>`;
    for(const tid in TEMPLATE_TIERS){
      const t = TEMPLATE_TIERS[tid];
      const sel = workingTemplate.tier === tid;
      html += `<button class="btn ${sel ? 'gold' : ''}" style="font-size:11.5px;padding:3px 10px;"
        title="${t.desc}" data-set-tier="${tid}">${t.name}${sel ? ' ✓' : ''}</button>`;
    }
    html += `<span style="font-size:10px;color:#8a94a6;margin-left:4px;">${TEMPLATE_TIERS[workingTemplate.tier].desc}</span></div>

      <!-- 预设选择器 -->
      <div style="display:flex;gap:8px;margin-bottom:14px;align-items:center;flex-wrap:wrap;">
        <span style="font-size:13px;color:var(--dim)">选择模板:</span>`;
    for(const k in w.templates){
      const t = w.templates[k];
      const isSel = k === selectedTmplKey;
      html += `<button class="btn ${isSel ? 'gold' : ''}" style="font-size:12px;" data-select-tmpl="${k}">
        ${t.icon || '🎖️'} ${t.name}
      </button>`;
    }
    html += `</div>

      ${warnHtml}
      <!-- 主工作区：左 5x5 + 5槽，右 属性面板 -->
      <div style="display:flex;gap:18px;flex:1;overflow-y:auto;padding-right:6px;">
        <!-- 左侧：方阵与支援 -->
        <div style="flex:1.3;min-width:380px;">
          <div style="font-size:11px;color:#8a94a6;margin-bottom:10px;line-height:1.5;">
            营列规则：同一列只能放同类型营（线列/炮兵/装甲/支援）· 战斗营宽度 步2 炮3 防空1 反坦克1
          </div>
          <div style="font-size:13px;font-weight:bold;color:var(--gold);margin-bottom:6px;">支援连 (最多 5 个，不占战斗宽度)</div>
          <div style="display:flex;gap:8px;margin-bottom:14px;">`;
    for(let s = 0; s < 5; s++){
      const supId = workingTemplate.supports[s];
      const supObj = supId ? SUPPORT_COMPANIES[supId] : null;
      html += `<div class="btn" style="flex:1;height:54px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:${supObj?'rgba(216,183,79,0.1)':'rgba(255,255,255,0.03)'};border:1px dashed ${supObj?'var(--gold)':'#445'};cursor:pointer;padding:2px;" data-slot-sup="${s}">
        <span style="font-size:18px;">${supObj ? supObj.icon : '➕'}</span>
        <span style="font-size:10.5px;color:var(--ink);">${supObj ? supObj.name : '支援槽'}</span>
      </div>`;
    }
    html += `</div>

          <div style="font-size:13px;font-weight:bold;color:var(--gold);margin-bottom:6px;">战斗营方阵 (5 列 × 5 行)</div>
          <div style="display:grid;grid-template-columns:repeat(5, 1fr);gap:6px;">`;
    for(let r = 0; r < 5; r++){
      for(let c = 0; c < 5; c++){
        const batId = (workingTemplate.grid[c] && workingTemplate.grid[c][r]) || null;
        const bObj = batId ? BATTALIONS[batId] : null;
        html += `<div class="btn" style="height:56px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:${bObj?'rgba(100,181,246,0.1)':'rgba(255,255,255,0.02)'};border:1px solid ${bObj?'#42a5f5':'#334'};cursor:pointer;padding:2px;" data-slot-combat="${c},${r}">
          <span style="font-size:16px;">${bObj ? bObj.icon : '＋'}</span>
          <span style="font-size:10px;color:var(--ink);">${bObj ? bObj.name : '空'}</span>
        </div>`;
      }
    }
    html += `</div>
        </div>

        <!-- 右侧：属性核算与装备缺编 -->
        <div style="flex:1;min-width:320px;background:rgba(0,0,0,0.25);border:1px solid #334;border-radius:4px;padding:12px;display:flex;flex-direction:column;">
          <div style="font-size:14px;font-weight:bold;color:var(--gold);border-bottom:1px solid #334;padding-bottom:6px;margin-bottom:8px;">
            📊 师综合战备属性
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12.5px;margin-bottom:12px;">
            <div style="grid-column: span 2;background:rgba(212,175,55,0.08);padding:4px 8px;border-radius:3px;border-left:2px solid var(--gold);font-size:11.5px;">
              编制构成比: <b style="color:var(--gold)">x${((templateAdjust(w, workingTemplate, workingTemplate.refUnit || 'inf') || {}).soft || 1.0).toFixed(2)}</b> (软攻比例挂载)
            </div>
            <div>战斗宽度: <b style="color:#ffb74d">${stats.width}</b></div>
            <div>组织度: <b style="color:#81c784">${stats.org}</b></div>
            <div>人员编制: <b style="color:var(--ink)">${stats.manpower}</b></div>
            <div>装甲率: <b style="color:#64b5f6">${Math.round(stats.armor * 100)}%</b></div>
            <div>对软目标(软攻): <b style="color:#e57373">${stats.softAtk}</b></div>
            <div>对硬目标(硬攻): <b style="color:#ba68c8">${stats.hardAtk}</b></div>
            <div>防御值: <b style="color:#4db6ac">${stats.defense}</b></div>
            <div>突破值: <b style="color:#fff176">${stats.breakthrough}</b></div>
            <div>壕沟上限: <b style="color:var(--gold)">${Math.round(stats.entrenchMax * 100)}%</b></div>
          </div>

          <div style="font-size:13px;font-weight:bold;color:var(--gold);border-bottom:1px solid #334;padding-bottom:4px;margin-bottom:6px;">
            📦 单师装备需求与国家库存对比
          </div>
          <div style="font-size:12px;display:flex;flex-direction:column;gap:5px;margin-bottom:12px;">`;

    const eqNames = { inf_eq: '步兵装备', art_eq: '火炮', tank_eq: '坦克', truck_eq: '卡车', sup_eq: '支援装备' };
    let hasDeficit = false;
    for(const eq in stats.equipNeeded){
      const need = stats.equipNeeded[eq];
      if(need > 0){
        const stock = Math.floor(n.equipment ? (n.equipment[eq] || 0) : 0);
        const isDeficit = stock < need;
        if(isDeficit) hasDeficit = true;
        html += `<div style="display:flex;justify-content:space-between;border-bottom:1px solid #223;padding-bottom:2px;">
          <span>${eqNames[eq] || eq}</span>
          <span>需 <b>${need}</b> / 库 <b style="color:${isDeficit ? '#ff6b6b' : 'var(--green)'}">${stock}</b></span>
        </div>`;
      }
    }

    if(hasDeficit){
      html += `<div style="font-size:11.5px;color:#ff6b6b;background:rgba(255,0,0,0.1);padding:4px 6px;border-radius:3px;margin-top:4px;">
        ⚠️ 注意：当前国家军需库存不足以完全武装此编制师，换装将导致缺编减员！
      </div>`;
    } else {
      html += `<div style="font-size:11.5px;color:var(--green);padding:4px 0;">
        ✓ 库存充足，可随时整编换装。
      </div>`;
    }

    html += `</div>

          <!-- 保存与整编按钮 -->
          <div style="margin-top:auto;display:flex;flex-direction:column;gap:8px;">
            <button class="btn ${canAffordXP ? 'gold' : ''}" id="sf-save-template" ${!canAffordXP ? 'disabled' : ''}>
              💾 保存编制设计 (花费 ${xpCost} XP)
            </button>
            <button class="btn primary" id="sf-refit-all">
              🔄 全军整编：将所有前线步兵师换装为此编制
            </button>
          </div>
        </div>
      </div>
    </div>`;

    modal.innerHTML = html;
    modal.classList.add('on');

    // 绑定事件
    modal.querySelector('#sf-close-designer').addEventListener('click', () => modal.classList.remove('on'));

    // 切换模板
    // v14.0 P1：配给等级切换
    modal.querySelectorAll('[data-set-tier]').forEach(btn => {
      btn.addEventListener('click', () => {
        sound.playClick();
        workingTemplate.tier = btn.dataset.setTier;
        render();
      });
    });
    modal.querySelectorAll('[data-select-tmpl]').forEach(btn => {
      btn.addEventListener('click', () => {
        sound.playClick();
        selectedTmplKey = btn.dataset.selectTmpl;
        workingTemplate = JSON.parse(JSON.stringify(w.templates[selectedTmplKey]));
        originalTemplate = JSON.parse(JSON.stringify(workingTemplate));
        render();
      });
    });

    // 点击支援槽位
    modal.querySelectorAll('[data-slot-sup]').forEach(btn => {
      btn.addEventListener('click', () => {
        sound.playClick();
        const slotIdx = +btn.dataset.slotSup;
        promptSupportSelect(slotIdx);
      });
    });

    // 点击战斗营槽位
    modal.querySelectorAll('[data-slot-combat]').forEach(btn => {
      btn.addEventListener('click', () => {
        sound.playClick();
        const [c, r] = btn.dataset.slotCombat.split(',').map(Number);
        promptCombatSelect(c, r);
      });
    });

    // 保存模板
    const saveBtn = modal.querySelector('#sf-save-template');
    if(saveBtn){
      saveBtn.addEventListener('click', () => {
        sound.playClick();
        if(n.armyXp >= xpCost){
          n.armyXp -= xpCost;
          w.templates[selectedTmplKey] = JSON.parse(JSON.stringify(workingTemplate));
          originalTemplate = JSON.parse(JSON.stringify(workingTemplate));
          render();
        }
      });
    }

    // 全军整编
    const refitBtn = modal.querySelector('#sf-refit-all');
    if(refitBtn){
      refitBtn.addEventListener('click', () => {
        sound.playClick();
        let count = 0;
        for(const u of w.units){
          if(u.nat === w.player && (u.type === 'inf' || !u.templateId)){
            convertDivisionTemplate(w, u, selectedTmplKey);
            count++;
          }
        }
        w.events = w.events || [];
        w.events.push({
          type: 'refit',
          day: w.day,
          important: false,
          text: `🪖 陆军整编：已将 ${count} 个前线师改制换装为【${workingTemplate.name}】！`
        });
        render();
      });
    }
  }

  function promptSupportSelect(slotIdx){
    const options = [
      { id: null, name: '【清空槽位】' },
      ...Object.values(SUPPORT_COMPANIES)
    ];
    let pickHtml = `<div class="brief-box" style="max-width:340px;">
      <h3 style="margin:0 0 10px 0;font-size:16px;color:var(--gold);">选择支援连</h3>
      <div style="display:flex;flex-direction:column;gap:6px;">`;
    for(const opt of options){
      pickHtml += `<button class="btn" style="text-align:left;padding:6px 10px;" data-pick-sup="${opt.id || ''}">
        ${opt.icon || '❌'} <b>${opt.name}</b>
      </button>`;
    }
    pickHtml += `</div>
      <button class="btn" style="width:100%;margin-top:10px;" id="sf-cancel-pick">取消</button>
    </div>`;

    const pickModal = document.createElement('div');
    pickModal.className = 'sf-overlay on';
    pickModal.innerHTML = pickHtml;
    document.body.appendChild(pickModal);

    pickModal.querySelector('#sf-cancel-pick').addEventListener('click', () => pickModal.remove());
    pickModal.querySelectorAll('[data-pick-sup]').forEach(b => {
      b.addEventListener('click', () => {
        sound.playClick();
        const val = b.dataset.pickSup || null;
        workingTemplate.supports = workingTemplate.supports || [];
        workingTemplate.supports[slotIdx] = val;
        pickModal.remove();
        render();
      });
    });
  }

  function promptCombatSelect(col, row){
    // v14.0 P1：按营类分组（HOI4 规则：一列只能放同类营），
    // 并对"会与本列已有营混装"的选项给出禁用的视觉提示。
    const colClass = (workingTemplate.grid[col] || []).filter(Boolean)
      .map(id => REGIMENT_CLASS[id]).find(Boolean) || null;
    const GROUPS = [
      { cls: 'line', label: '线列部队' },
      { cls: 'artillery', label: '炮兵' },
      { cls: 'armor', label: '装甲 / 摩托化' },
      { cls: 'support', label: '支援性营（防空 / 反坦克）' }
    ];
    let pickHtml = `<div class="brief-box" style="max-width:380px;">
      <h3 style="margin:0 0 4px 0;font-size:16px;color:var(--gold);">选择战斗营</h3>
      <div style="font-size:10.5px;color:#8a94a6;margin-bottom:10px;">
        第 ${col + 1} 营列${colClass ? '（当前为' + GROUPS.find(g=>g.cls===colClass).label + '）' : ''} · 营列内不可混装不同类型
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;">`;
    pickHtml += `<button class="btn" style="text-align:left;padding:6px 10px;" data-pick-bat="">
      ❌ <b>【清空槽位】</b></button>`;
    for(const g of GROUPS){
      const items = Object.values(BATTALIONS).filter(b => REGIMENT_CLASS[b.id] === g.cls);
      if(!items.length) continue;
      pickHtml += `<div style="font-size:10px;color:#6b7688;margin-top:4px;">${g.label}</div>`;
      for(const opt of items){
        const conflict = colClass && colClass !== g.cls;
        const extra = [];
        if(opt.width) extra.push('宽' + opt.width);
        if(opt.softAtk) extra.push('软' + opt.softAtk);
        if(opt.hardAtk) extra.push('硬' + opt.hardAtk);
        if(opt.defense) extra.push('防' + opt.defense);
        if(opt.breakthrough) extra.push('突' + opt.breakthrough);
        if(opt.airDefense) extra.push('对空' + opt.airDefense);
        if(opt.pierceBonus) extra.push('穿甲+' + opt.pierceBonus);
        if(opt.terrainBonus) extra.push('山地+' + Math.round(opt.terrainBonus.mount*100) + '%');
        pickHtml += `<button class="btn" style="text-align:left;padding:6px 10px;${conflict ? 'opacity:0.4;' : ''}"
          ${conflict ? 'disabled title="同一营列不可混装不同类型"' : ''} data-pick-bat="${opt.id}">
          ${opt.icon || '❖'} <b>${opt.name}</b> <span style="color:#8a94a6;font-size:10px;">${extra.join(' ')}</span>
          ${opt.manpower ? '<span style="color:#6b7688;font-size:10px;">人力' + opt.manpower + '</span>' : ''}
        </button>`;
      }
    }
    pickHtml += `</div>
      <button class="btn" style="width:100%;margin-top:10px;" id="sf-cancel-bat">取消</button>
    </div>`;

    const pickModal = document.createElement('div');
    pickModal.className = 'sf-overlay on';
    pickModal.innerHTML = pickHtml;
    document.body.appendChild(pickModal);

    pickModal.querySelector('#sf-cancel-bat').addEventListener('click', () => pickModal.remove());
    pickModal.querySelectorAll('[data-pick-bat]').forEach(b => {
      b.addEventListener('click', () => {
        sound.playClick();
        const val = b.dataset.pickBat || null;
        workingTemplate.grid = workingTemplate.grid || [[], [], [], [], []];
        workingTemplate.grid[col] = workingTemplate.grid[col] || [];
        workingTemplate.grid[col][row] = val;
        pickModal.remove();
        render();
      });
    });
  }

  render();
}
