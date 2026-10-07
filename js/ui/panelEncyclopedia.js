/* ============================================================
   ui/panelEncyclopedia.js —— 百科全书与战略资料馆 UI (v4.0 §4.1 / P4)
   全方位浏览 18 种装备、6 种工业机制、8 大核心指标、8 档国家法案与将领档案
   ============================================================ */

import { ENCYCLOPEDIA } from '../data/encyclopedia.js';
import { renderPortraitHtml } from '../core/assets.js';
import { sound } from '../core/audio.js';

export function openEncyclopediaModal(store, defaultTab = 'equip'){
  let modal = document.getElementById('sf-encyclopedia-modal');
  if(!modal){
    modal = document.createElement('div');
    modal.id = 'sf-encyclopedia-modal';
    modal.className = 'sf-overlay';
    document.body.appendChild(modal);
  }

  const w = store.world;
  let activeTab = defaultTab;
  let searchKeyword = '';
  let equipCat = 'all';

  function render(){
    let html = `<div class="brief-box" style="max-width:880px;max-height:88vh;display:flex;flex-direction:column;padding:22px;">
      <!-- 顶部标题与搜索 -->
      <div class="modal-header">
        <div style="display:flex;align-items:center;gap:12px;">
          <span class="modal-emblem">📖</span>
          <div>
            <h2 class="modal-title">钢铁前线 · 军事与战略百科全书</h2>
            <div class="modal-sub">涵盖二战单兵/重型军械、大工业物流、战略指标与战史档案</div>
          </div>
        </div>
        <button class="btn" id="sf-close-ency">关闭 (ESC)</button>
      </div>

      <!-- 选项卡导航 -->
      <div style="display:flex;gap:8px;margin-bottom:12px;border-bottom:1px solid #334;padding-bottom:8px;flex-wrap:wrap;">
        <button class="btn ${activeTab==='equip'?'gold':''}" data-tab="equip">🔫 陆战装备 (18)</button>
        <button class="btn ${activeTab==='ind'?'gold':''}" data-tab="ind">🏭 工业与后勤 (6)</button>
        <button class="btn ${activeTab==='metrics'?'gold':''}" data-tab="metrics">📊 核心指标体系 (8)</button>
        <button class="btn ${activeTab==='laws'?'gold':''}" data-tab="laws">📜 动员与经济体制 (8)</button>
        <button class="btn ${activeTab==='chars'?'gold':''}" data-tab="chars">🎖️ 历史人物档案</button>
      </div>

      <!-- 内容区 -->
      <div style="flex:1;overflow-y:auto;padding-right:6px;">`;

    // ===== 1. 陆战装备 =====
    if(activeTab === 'equip'){
      html += `<div style="display:flex;gap:6px;margin-bottom:12px;align-items:center;flex-wrap:wrap;">
        <span style="font-size:12px;color:var(--dim)">分类筛选:</span>
        <button class="btn ${equipCat==='all'?'gold':''}" style="font-size:11px;padding:2px 8px;" data-cat="all">全部</button>
        <button class="btn ${equipCat==='步兵装备'?'gold':''}" style="font-size:11px;padding:2px 8px;" data-cat="步兵装备">步兵武器</button>
        <button class="btn ${equipCat==='火炮装备'?'gold':''}" style="font-size:11px;padding:2px 8px;" data-cat="火炮装备">身管火炮</button>
        <button class="btn ${equipCat==='装甲战车'?'gold':''}" style="font-size:11px;padding:2px 8px;" data-cat="装甲战车">装甲车辆</button>
        <button class="btn ${equipCat==='运输车辆'?'gold':''}" style="font-size:11px;padding:2px 8px;" data-cat="运输车辆">战术运输</button>
        <button class="btn ${equipCat==='支援装备'?'gold':''}" style="font-size:11px;padding:2px 8px;" data-cat="支援装备">支援器材</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(380px, 1fr));gap:12px;">`;

      const list = ENCYCLOPEDIA.equipments.filter(e => equipCat === 'all' || e.category === equipCat);
      for(const item of list){
        html += `<div style="background:rgba(255,255,255,0.03);border:1px solid #334;border-radius:4px;padding:10px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <b style="font-size:14px;color:var(--gold);">${item.name}</b>
            <span style="font-size:11px;color:var(--dim);">${item.category} · ${item.year}年</span>
          </div>
          <div style="font-size:12px;color:var(--ink);line-height:1.45;margin-bottom:6px;">${item.desc}</div>
          <div style="font-size:11.5px;color:#90caf9;background:rgba(0,0,0,0.25);padding:4px 6px;border-radius:3px;margin-bottom:6px;">
            <b>战备性能</b>：${item.stats}
          </div>
          <div style="font-size:11.5px;color:var(--dim);line-height:1.4;border-top:1px solid #223;padding-top:4px;">
            <b>战史实录</b>：${item.history}
          </div>
        </div>`;
      }
      html += `</div>`;
    }

    // ===== 2. 工业与后勤 =====
    else if(activeTab === 'ind'){
      html += `<div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(380px, 1fr));gap:12px;">`;
      for(const item of ENCYCLOPEDIA.industries){
        html += `<div style="background:rgba(255,255,255,0.03);border:1px solid #334;border-radius:4px;padding:10px;">
          <div style="font-size:14px;font-weight:bold;color:var(--gold);margin-bottom:4px;">${item.name}</div>
          <div style="font-size:12px;color:var(--ink);line-height:1.5;margin-bottom:8px;">${item.desc}</div>
          <div style="font-size:11.5px;color:var(--green);background:rgba(0,0,0,0.25);padding:5px 8px;border-radius:3px;">
            <b>游戏核心运行规则</b>：${item.rules}
          </div>
        </div>`;
      }
      html += `</div>`;
    }

    // ===== 3. 核心指标 =====
    else if(activeTab === 'metrics'){
      html += `<div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(380px, 1fr));gap:12px;">`;
      for(const item of ENCYCLOPEDIA.metrics){
        html += `<div style="background:rgba(255,255,255,0.03);border:1px solid #334;border-radius:4px;padding:10px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <b style="font-size:14px;color:var(--gold);">${item.name}</b>
            <span style="font-size:11px;color:var(--dim);">${item.category}</span>
          </div>
          <div style="font-size:12px;color:var(--ink);line-height:1.5;margin-bottom:8px;">${item.desc}</div>
          <div style="font-size:11.5px;color:#ffa726;background:rgba(0,0,0,0.25);padding:5px 8px;border-radius:3px;">
            <b>战役数值结算影响</b>：${item.effects}
          </div>
        </div>`;
      }
      html += `</div>`;
    }

    // ===== 4. 国家法案 =====
    else if(activeTab === 'laws'){
      html += `<div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(380px, 1fr));gap:12px;">`;
      for(const item of ENCYCLOPEDIA.laws){
        html += `<div style="background:rgba(255,255,255,0.03);border:1px solid #334;border-radius:4px;padding:10px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <b style="font-size:14px;color:var(--gold);">${item.name}</b>
            <span style="font-size:11px;color:var(--dim);">耗费 ${item.cost} PP</span>
          </div>
          <div style="font-size:12px;color:var(--ink);line-height:1.5;">${item.desc}</div>
        </div>`;
      }
      html += `</div>`;
    }

    // ===== 5. 历史人物档案 =====
    else if(activeTab === 'chars'){
      const allChars = w.characters || [];
      html += `<div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(380px, 1fr));gap:12px;">`;
      for(const c of allChars){
        html += `<div style="display:flex;gap:12px;background:rgba(255,255,255,0.03);border:1px solid #334;border-radius:4px;padding:10px;">
          ${renderPortraitHtml(c, 70)}
          <div style="flex:1;min-width:0;">
            <div style="font-weight:bold;color:var(--gold);font-size:14px;">
              ${c.name} ${c.fictional ? '<span style="color:#d8b74f;font-size:11px">[F 虚构人物]</span>' : ''}
            </div>
            <div style="font-size:11px;color:var(--dim);margin:2px 0 4px 0;">阵营: ${w.nations[c.nat]?w.nations[c.nat].name:c.nat} · ${c.type==='leader'?'国家领袖':'军团统帅'}</div>
            <div style="font-size:11.5px;color:var(--ink);line-height:1.45;margin-bottom:6px;">${c.bio || '高级指挥官'}</div>
            ${c.skills ? `<div style="font-size:11px;color:#90caf9;">攻: ${c.skills.attack} · 防: ${c.skills.defense} · 策: ${c.skills.planning} · 后: ${c.skills.tactics}</div>` : ''}
          </div>
        </div>`;
      }
      html += `</div>`;
    }

    html += `</div></div>`;
    modal.innerHTML = html;
    modal.classList.add('on');

    modal.querySelector('#sf-close-ency').addEventListener('click', () => modal.classList.remove('on'));

    modal.querySelectorAll('[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        sound.playClick();
        activeTab = btn.dataset.tab;
        render();
      });
    });

    modal.querySelectorAll('[data-cat]').forEach(btn => {
      btn.addEventListener('click', () => {
        sound.playClick();
        equipCat = btn.dataset.cat;
        render();
      });
    });
  }

  render();
}
