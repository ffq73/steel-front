/* ============================================================
   ui/panelStats.js —— 全球大账本、折线图表与战役日志 (v9.0 §4-N6) [H]
   包含：
   1. Ledger 全球各国对比总表（对齐 HOI4 1024×703 规格，多字段排序/阵营过滤）
   2. 原生 Canvas 历史时序图表（零依赖，工厂/师数/伤亡/装备曲线）
   3. 战史战报与战役日志（Battle Log & AAR，重大交战记录）
   4. 战损与装备损失盘点表
   ============================================================ */

import { getLedgerData, sortAndFilterLedger } from '../engine/stats.js';
import { sound } from '../core/audio.js';

let activeStatsTab = 'ledger'; // 'ledger' | 'charts' | 'battles' | 'losses'
let activeLedgerFilter = 'all';
let activeLedgerSort = 'totalFactories';
let activeLedgerSortAsc = false;
let activeChartMetric = 'factories'; // 'factories' | 'divs' | 'casualties' | 'equip'

/* 1. 抽屉内嵌渲染入口 */
export function renderStatsPanel(container, store){
  if(!container) return;
  const w = store.world;
  const p = w.player;

  let html = `
    <div class="sf-stats-panel" style="display:flex;flex-direction:column;gap:10px;color:var(--c-text);font-family:inherit;">
      <!-- 顶栏标题与子标签切换 -->
      <div style="background:var(--bg-box);border:1px solid var(--bg-box-border);border-radius:4px;padding:8px 10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <div style="font-weight:700;font-size:13px;color:var(--c-brass-bright);display:flex;align-items:center;gap:6px;">
            <span>📊</span> <span>全球战略统计、账本与战史</span>
          </div>
          <button class="sf-stats-popout-btn btn" style="padding:2px 8px;font-size:10px;cursor:pointer;" title="全屏视口展开大账本">
            ⛶ 全屏大账本
          </button>
        </div>

        <div style="display:flex;gap:4px;">
          <button class="sf-stats-tab-btn ${activeStatsTab === 'ledger' ? 'active' : ''}" data-tab="ledger"
            style="flex:1;padding:5px 2px;font-size:10.5px;cursor:pointer;border-radius:3px;border:1px solid ${activeStatsTab === 'ledger' ? 'var(--c-brass-bright)' : '#334155'};background:${activeStatsTab === 'ledger' ? 'rgba(216,183,79,0.2)' : 'rgba(0,0,0,0.3)'};color:${activeStatsTab === 'ledger' ? 'var(--c-brass-bright)' : 'var(--c-text-muted)'};font-weight:700;">
            大账本 (Ledger)
          </button>
          <button class="sf-stats-tab-btn ${activeStatsTab === 'charts' ? 'active' : ''}" data-tab="charts"
            style="flex:1;padding:5px 2px;font-size:10.5px;cursor:pointer;border-radius:3px;border:1px solid ${activeStatsTab === 'charts' ? 'var(--c-brass-bright)' : '#334155'};background:${activeStatsTab === 'charts' ? 'rgba(216,183,79,0.2)' : 'rgba(0,0,0,0.3)'};color:${activeStatsTab === 'charts' ? 'var(--c-brass-bright)' : 'var(--c-text-muted)'};font-weight:700;">
            走势曲线
          </button>
          <button class="sf-stats-tab-btn ${activeStatsTab === 'battles' ? 'active' : ''}" data-tab="battles"
            style="flex:1;padding:5px 2px;font-size:10.5px;cursor:pointer;border-radius:3px;border:1px solid ${activeStatsTab === 'battles' ? 'var(--c-brass-bright)' : '#334155'};background:${activeStatsTab === 'battles' ? 'rgba(216,183,79,0.2)' : 'rgba(0,0,0,0.3)'};color:${activeStatsTab === 'battles' ? 'var(--c-brass-bright)' : 'var(--c-text-muted)'};font-weight:700;">
            战史日志 (AAR)
          </button>
          <button class="sf-stats-tab-btn ${activeStatsTab === 'losses' ? 'active' : ''}" data-tab="losses"
            style="flex:1;padding:5px 2px;font-size:10.5px;cursor:pointer;border-radius:3px;border:1px solid ${activeStatsTab === 'losses' ? 'var(--c-brass-bright)' : '#334155'};background:${activeStatsTab === 'losses' ? 'rgba(216,183,79,0.2)' : 'rgba(0,0,0,0.3)'};color:${activeStatsTab === 'losses' ? 'var(--c-brass-bright)' : 'var(--c-text-muted)'};font-weight:700;">
            装备折损
          </button>
        </div>
      </div>
  `;

  if(activeStatsTab === 'ledger'){
    html += renderLedgerContent(w);
  } else if(activeStatsTab === 'charts'){
    html += renderChartsContent(w);
  } else if(activeStatsTab === 'battles'){
    html += renderBattleLogContent(w);
  } else if(activeStatsTab === 'losses'){
    html += renderLossesContent(w);
  }

  html += `</div>`;
  container.innerHTML = html;

  bindStatsEvents(container, store);
  if(activeStatsTab === 'charts'){
    drawStatsChart(w);
  }
}

/* 2. 渲染大账本表格内容 [H] */
function renderLedgerContent(w){
  const rawLedger = getLedgerData(w);
  const ledger = sortAndFilterLedger(rawLedger, activeLedgerFilter, activeLedgerSort, activeLedgerSortAsc);

  return `
    <div style="background:var(--bg-box);border:1px solid var(--bg-box-border);border-radius:4px;padding:8px;font-size:11px;">
      <!-- 过滤器 -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <div style="display:flex;gap:4px;">
          ${[
            { id: 'all', name: '全部' },
            { id: 'axis', name: '轴心' },
            { id: 'allies', name: '同盟' },
            { id: 'comintern', name: '共产' },
            { id: 'at_war', name: '交战' }
          ].map(f => `
            <button class="sf-ledger-filter-btn ${activeLedgerFilter === f.id ? 'active' : ''}" data-filter="${f.id}"
              style="padding:2px 6px;font-size:10px;cursor:pointer;border-radius:2px;border:1px solid ${activeLedgerFilter === f.id ? 'var(--c-brass-bright)' : '#475569'};background:${activeLedgerFilter === f.id ? 'rgba(216,183,79,0.3)' : 'transparent'};color:${activeLedgerFilter === f.id ? 'var(--c-brass-bright)' : 'var(--c-text-muted)'};">
              ${f.name}
            </button>
          `).join('')}
        </div>
        <div style="font-size:10px;color:var(--c-text-muted);">
          点击表头可重新升降序排序
        </div>
      </div>

      <!-- 表格 -->
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;text-align:left;font-size:10.5px;">
          <thead>
            <tr style="border-bottom:1px solid #334155;color:var(--c-brass-bright);white-space:nowrap;">
              <th style="padding:4px 6px;cursor:pointer;" data-sort="name">国家 ${activeLedgerSort==='name'?(activeLedgerSortAsc?'▲':'▼'):''}</th>
              <th style="padding:4px 6px;cursor:pointer;" data-sort="divs">师数 ${activeLedgerSort==='divs'?(activeLedgerSortAsc?'▲':'▼'):''}</th>
              <th style="padding:4px 6px;cursor:pointer;" data-sort="totalFactories">总工厂 ${activeLedgerSort==='totalFactories'?(activeLedgerSortAsc?'▲':'▼'):''}</th>
              <th style="padding:4px 6px;cursor:pointer;" data-sort="casualties">战损伤亡 ${activeLedgerSort==='casualties'?(activeLedgerSortAsc?'▲':'▼'):''}</th>
              <th style="padding:4px 6px;cursor:pointer;" data-sort="equipStock">库存 ${activeLedgerSort==='equipStock'?(activeLedgerSortAsc?'▲':'▼'):''}</th>
              <th style="padding:4px 6px;cursor:pointer;" data-sort="controlledHexes">地块 ${activeLedgerSort==='controlledHexes'?(activeLedgerSortAsc?'▲':'▼'):''}</th>
            </tr>
          </thead>
          <tbody>
            ${ledger.map(row => `
              <tr style="border-bottom:1px solid rgba(255,255,255,0.05);background:${row.id === w.player ? 'rgba(216,183,79,0.1)' : 'transparent'};">
                <td style="padding:4px 6px;display:flex;align-items:center;gap:4px;">
                  <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${row.color};"></span>
                  <b style="color:${row.id === w.player ? 'var(--c-brass-bright)' : '#e2e8f0'}">${row.name}</b>
                </td>
                <td style="padding:4px 6px;font-weight:700;color:#93c5fd;">${row.divs}</td>
                <td style="padding:4px 6px;"><span style="color:#ef4444">${row.mil}</span> + <span style="color:#38bdf8">${row.civ}</span> = <b>${row.totalFactories}</b></td>
                <td style="padding:4px 6px;color:#fca5a5;">${row.casualties.toLocaleString()}</td>
                <td style="padding:4px 6px;color:#fde047;">${row.equipStock}</td>
                <td style="padding:4px 6px;color:#cbd5e1;">${row.controlledHexes}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/* 3. 渲染原生 Canvas 图表容器 */
function renderChartsContent(w){
  return `
    <div style="background:var(--bg-box);border:1px solid var(--bg-box-border);border-radius:4px;padding:8px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <span style="font-size:11px;font-weight:700;color:var(--c-brass-bright);">战役历史演变曲线</span>
        <div style="display:flex;gap:4px;">
          ${[
            { id: 'factories', name: '总军工厂' },
            { id: 'divs', name: '陆军师数' },
            { id: 'casualties', name: '人员伤亡' },
            { id: 'equip', name: '装备储备' }
          ].map(m => `
            <button class="sf-chart-metric-btn ${activeChartMetric === m.id ? 'active' : ''}" data-metric="${m.id}"
              style="padding:2px 6px;font-size:10px;cursor:pointer;border-radius:2px;border:1px solid ${activeChartMetric === m.id ? 'var(--c-brass-bright)' : '#475569'};background:${activeChartMetric === m.id ? 'rgba(216,183,79,0.3)' : 'transparent'};color:${activeChartMetric === m.id ? 'var(--c-brass-bright)' : 'var(--c-text-muted)'};">
              ${m.name}
            </button>
          `).join('')}
        </div>
      </div>

      <div style="width:100%;height:220px;background:#090d14;border:1px solid #1e293b;border-radius:3px;position:relative;overflow:hidden;">
        <canvas id="sf-stats-canvas" width="480" height="220" style="width:100%;height:100%;display:block;"></canvas>
      </div>
      <div style="margin-top:6px;font-size:10px;color:var(--c-text-muted);display:flex;justify-content:space-between;">
        <span>历史采样点: ${(w.stats?.history || []).length} 天</span>
        <span>黄:德 ｜ 红:苏 ｜ 蓝:法 ｜ 白:波</span>
      </div>
    </div>
  `;
}

/* 4. 原生 Canvas 曲线绘制算法 (零外部依赖，极速轻量) [H] */
function drawStatsChart(w){
  const canvas = document.getElementById('sf-stats-canvas');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  if(!ctx) return;

  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  const history = w.stats?.history || [];
  if(history.length < 2){
    ctx.fillStyle = '#64748b';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('正在积累时序推演数据（需推演推进至少2天）...', width / 2, height / 2);
    return;
  }

  // 坐标系边距
  const padLeft = 40, padRight = 15, padTop = 15, padBottom = 25;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  // 获取主要参与国历史序列
  const trackedNats = ['G', 'GER', 'P', 'POL', 'F', 'FRA', 'S', 'SOV', 'B', 'GBR'];
  const presentNats = Object.keys(w.nations).filter(k => trackedNats.includes(k));

  let maxVal = 10;
  for(const h of history){
    for(const natId of presentNats){
      const val = h.nations?.[natId]?.[activeChartMetric] || 0;
      if(val > maxVal) maxVal = val;
    }
  }

  // 绘制网格背景线
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for(let i = 0; i <= 4; i++){
    const y = padTop + (plotH / 4) * i;
    ctx.moveTo(padLeft, y);
    ctx.lineTo(width - padRight, y);

    // Y 轴刻度文字
    ctx.fillStyle = '#64748b';
    ctx.font = '9px monospace';
    ctx.textAlign = 'right';
    const markVal = Math.round(maxVal * (1 - i / 4));
    ctx.fillText(markVal >= 1000 ? (markVal/1000).toFixed(1)+'k' : markVal, padLeft - 4, y + 3);
  }
  ctx.stroke();

  // 绘制折线
  const colors = {
    GER: '#facc15', G: '#facc15',
    SOV: '#ef4444', S: '#ef4444',
    GBR: '#38bdf8', B: '#38bdf8',
    FRA: '#60a5fa', F: '#60a5fa',
    POL: '#f8fafc', P: '#f8fafc'
  };

  for(const natId of presentNats){
    const color = colors[natId] || w.nations[natId]?.color || '#94a3b8';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();

    for(let i = 0; i < history.length; i++){
      const val = history[i].nations?.[natId]?.[activeChartMetric] || 0;
      const x = padLeft + (i / (history.length - 1)) * plotW;
      const y = padTop + (1 - val / maxVal) * plotH;
      if(i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

/* 5. 渲染战役日志 (Battle Log & AAR) [H] */
function renderBattleLogContent(w){
  const log = w.stats?.battleLog || [];
  if(!log.length){
    return `<div style="background:var(--bg-box);border:1px solid var(--bg-box-border);border-radius:4px;padding:20px;text-align:center;color:var(--c-text-muted);font-size:11.5px;">战事刚启，暂无大规模交战记录</div>`;
  }

  return `
    <div style="background:var(--bg-box);border:1px solid var(--bg-box-border);border-radius:4px;padding:8px;font-size:11px;">
      <div style="font-weight:700;color:var(--c-brass-bright);margin-bottom:6px;display:flex;justify-content:space-between;">
        <span>历史重大交锋战报 (近 ${log.length} 场)</span>
        <span style="font-size:10px;color:var(--c-text-muted);">按时间逆序</span>
      </div>

      <div style="display:flex;flex-direction:column;gap:6px;max-height:400px;overflow-y:auto;">
        ${log.slice(0, 30).map(b => {
          const atkName = w.nations[b.atkNat]?.name || b.atkNat;
          const defName = w.nations[b.defNat]?.name || b.defNat;
          const vicName = w.nations[b.victor]?.name || b.victor;

          return `
            <div style="background:rgba(0,0,0,0.3);border:1px solid #334155;border-radius:3px;padding:6px 8px;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
                <span style="color:#94a3b8;font-size:10px;">第 ${b.day} 天 ｜ ${b.hexName}</span>
                <span style="font-size:10px;padding:1px 4px;border-radius:2px;background:${b.captured ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'};color:${b.captured ? '#86efac' : '#fca5a5'};">
                  ${b.captured ? '★ 阵地攻克' : '战线僵持'}
                </span>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;">
                <div>
                  <b style="color:#ffd977;">${atkName}</b> <span style="color:var(--c-text-muted);">进攻</span> <b style="color:#93c5fd;">${defName}</b>
                </div>
                <div style="font-size:10.5px;color:var(--c-text-muted);">
                  胜方: <b style="color:#38bdf8;">${vicName}</b>
                </div>
              </div>
              <div style="display:flex;gap:12px;font-size:10px;color:var(--c-text-muted);margin-top:3px;border-top:1px dashed rgba(255,255,255,0.06);padding-top:3px;">
                <span>攻方伤亡: <b style="color:#f87171;">-${b.atkCasualties}</b></span>
                <span>守方伤亡: <b style="color:#f87171;">-${b.defCasualties}</b></span>
                ${b.destroyedCount > 0 ? `<span style="color:#ef4444;font-weight:700;">歼灭部队: ${b.destroyedCount} 师</span>` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

/* 6. 渲染装备损失盘点 [H] */
function renderLossesContent(w){
  const losses = w.stats?.losses || {};

  return `
    <div style="background:var(--bg-box);border:1px solid var(--bg-box-border);border-radius:4px;padding:8px;font-size:11px;">
      <div style="font-weight:700;color:var(--c-brass-bright);margin-bottom:8px;">
        各参战国主战军械战损累计 (Equipment Losses)
      </div>

      <div style="display:flex;flex-direction:column;gap:6px;">
        ${Object.entries(w.nations).map(([natId, n]) => {
          const l = losses[natId] || { inf_eq: 0, art_eq: 0, tank_eq: 0 };
          const total = (l.inf_eq || 0) + (l.art_eq || 0) + (l.tank_eq || 0);

          return `
            <div style="background:rgba(0,0,0,0.3);border:1px solid #334155;border-radius:3px;padding:8px;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                <span style="font-weight:700;color:${n.color || '#e2e8f0'};">${n.name || natId}</span>
                <span style="font-weight:700;color:#f87171;">总战损: ${total.toLocaleString()} 件</span>
              </div>
              <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:4px;font-size:10px;color:var(--c-text-muted);">
                <div style="background:rgba(255,255,255,0.02);padding:4px;border-radius:2px;">
                  步枪/机枪: <b style="color:#fca5a5;">${(l.inf_eq || 0).toLocaleString()}</b>
                </div>
                <div style="background:rgba(255,255,255,0.02);padding:4px;border-radius:2px;">
                  重炮/野战炮: <b style="color:#fca5a5;">${(l.art_eq || 0).toLocaleString()}</b>
                </div>
                <div style="background:rgba(255,255,255,0.02);padding:4px;border-radius:2px;">
                  坦克装甲车: <b style="color:#fca5a5;">${(l.tank_eq || 0).toLocaleString()}</b>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

/* 7. 事件绑定委托 */
function bindStatsEvents(container, store){
  container.querySelectorAll('.sf-stats-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      sound.playClick();
      activeStatsTab = btn.dataset.tab;
      renderStatsPanel(container, store);
    });
  });

  container.querySelectorAll('.sf-ledger-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      sound.playClick();
      activeLedgerFilter = btn.dataset.filter;
      renderStatsPanel(container, store);
    });
  });

  container.querySelectorAll('[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      sound.playClick();
      const sKey = th.dataset.sort;
      if(activeLedgerSort === sKey){
        activeLedgerSortAsc = !activeLedgerSortAsc;
      } else {
        activeLedgerSort = sKey;
        activeLedgerSortAsc = false;
      }
      renderStatsPanel(container, store);
    });
  });

  container.querySelectorAll('.sf-chart-metric-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      sound.playClick();
      activeChartMetric = btn.dataset.metric;
      renderStatsPanel(container, store);
    });
  });

  const popoutBtn = container.querySelector('.sf-stats-popout-btn');
  if(popoutBtn){
    popoutBtn.addEventListener('click', () => {
      sound.playClick();
      openStatsModal(store);
    });
  }
}

/* 8. 独立弹窗 (1024×703 规格) [H] */
export function openStatsModal(store){
  let modal = document.getElementById('sf-stats-modal');
  if(!modal){
    modal = document.createElement('div');
    modal.id = 'sf-stats-modal';
    modal.className = 'sf-overlay on';
    modal.innerHTML = `
      <div class="brief-box" style="width:1024px;max-width:96vw;height:720px;max-height:92vh;padding:20px;display:flex;flex-direction:column;gap:12px;background:#0d121c;border:1px solid var(--c-brass-bright);box-shadow:0 10px 40px rgba(0,0,0,0.8);">
        <div class="modal-header">
          <div style="display:flex;align-items:center;gap:12px;">
            <span class="modal-emblem">📊</span>
            <div>
              <h2 class="modal-title">全球大账本与战史档案馆 (Ledger &amp; AAR)</h2>
              <div class="modal-sub">生产 / 后勤 / 人力 / 外交全指标 Ledger，战史事件按日归档</div>
            </div>
          </div>
          <button class="btn" id="sf-stats-modal-close" style="padding:4px 12px;font-size:12px;">关闭 (ESC)</button>
        </div>
        <div id="sf-stats-modal-body" style="flex:1;overflow-y:auto;"></div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('#sf-stats-modal-close').addEventListener('click', () => {
      sound.playClick();
      modal.classList.remove('on');
    });
  }

  modal.classList.add('on');
  const body = modal.querySelector('#sf-stats-modal-body');
  renderStatsPanel(body, store);
}
