/* ============================================================
   ui/panelNavy.js —— 海军统帅部与战区海权总览面板 (v9.0 §4-N2 / §6) [H]
   左侧抽屉式面板（宽 550px），支持：
   1. 5 大战略海区海权态势卡片（红/黄/绿与 40% 情报硬门槛提示）
   2. 舰队编制矩阵、屏卫比 (3:1) 监视器与任务指派
   3. 登陆作战规划器（7天/师准备天数与制海条件检验）
   4. 远洋运输船与大西洋破交破损曲线
   ============================================================ */

import { K } from '../data/constants.js';
import {
  SEA_ZONES,
  calcSeaZoneSuperiority,
  calcFleetScreening,
  calcNavalInvasionPrep,
  validateNavalInvasion,
  getHexSeaZone
} from '../engine/navy.js';
import { sound } from '../core/audio.js';
import { showToast } from './panels.js';
import { planNavalInvasion, executeNavalInvasion, cancelNavalInvasion, listLandingSites } from '../engine/invasion.js';

export const NAVY_TASK_OPTIONS = [
  { id: 'patrol',         name: '⚓ 战区巡逻', desc: '在海区巡戈索敌，建立常规海权并提供视野' },
  { id: 'strike',         name: '⚔️ 突击舰队', desc: '在母港待机，巡逻舰接触敌舰队时全军出击' },
  { id: 'convoy_escort',  name: '🛡️ 航线护航', desc: '保护己方商船队，专职反潜与防空拦截' },
  { id: 'convoy_raiding', name: '🎯 远洋破交', desc: '以狼群潜艇猎杀敌方商船，切断原料进口' },
  { id: 'naval_invasion', name: '🚢 登陆支援', desc: '为登陆突击部队提供岸轰与滩头火力掩护' },
  { id: 'minelaying',     name: '💣 海区布雷', desc: '在关键海峡与近海布设水雷，阻滞敌舰通行' },
  { id: 'hold',           name: '⚓ 在港驻泊', desc: '在军港内修理维护，不产生海权与燃油消耗' }
];

export function renderNavyPanel(container, store){
  if(!container) return;
  const w = store.world;
  const p = w.player;
  const n = w.nations[p];
  if(!n) return;

  const playerFleets = (w.fleets || []).filter(fl => fl.nat === p);
  const totalShips = playerFleets.reduce((s, fl) => s + (fl.ships?.length || 0), 0);
  const intelEff = (w.intelEfficiency?.[p] != null) ? w.intelEfficiency[p] : 0.60;
  const convoys = n.convoys != null ? n.convoys : 120;

  let html = `
    <div class="sf-navy-panel" style="display:flex;flex-direction:column;gap:12px;color:var(--c-text);font-family:inherit;">
      <!-- 1. 顶栏：海军总实力与战略指标 -->
      <div style="background:var(--bg-box);border:1px solid var(--bg-box-border);border-radius:4px;padding:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <div style="font-weight:700;font-size:14px;color:var(--c-brass-bright);display:flex;align-items:center;gap:6px;">
            <span>⚓</span> <span>海军统帅部与海权总览</span>
          </div>
          <div style="font-size:11px;color:${intelEff >= 0.40 ? 'var(--c-good)' : 'var(--c-bad)'};display:flex;align-items:center;gap:4px;">
            <span>情报效率: <b>${Math.round(intelEff * 100)}%</b></span>
            ${intelEff < 0.40 ? '<span title="情报低于40%海权强制归0">⚠️破门</span>' : ''}
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:6px;font-size:11px;text-align:center;">
          <div style="background:rgba(0,0,0,0.3);padding:6px;border-radius:3px;">
            <div style="color:var(--c-text-muted);">主力战舰</div>
            <div style="font-size:14px;font-weight:700;color:var(--c-brass-bright);">${totalShips} 艘</div>
          </div>
          <div style="background:rgba(0,0,0,0.3);padding:6px;border-radius:3px;">
            <div style="color:var(--c-text-muted);">现役舰队</div>
            <div style="font-size:14px;font-weight:700;color:#38bdf8;">${playerFleets.length} 支</div>
          </div>
          <div style="background:rgba(0,0,0,0.3);padding:6px;border-radius:3px;">
            <div style="color:var(--c-text-muted);">远洋商船</div>
            <div style="font-size:14px;font-weight:700;color:#a3e635;">${convoys} 艘</div>
          </div>
          <div style="background:rgba(0,0,0,0.3);padding:6px;border-radius:3px;">
            <div style="color:var(--c-text-muted);">管辖海区</div>
            <div style="font-size:14px;font-weight:700;color:#facc15;">${SEA_ZONES.length} 处</div>
          </div>
        </div>
      </div>

      <!-- 2. 战略海区制海权态势表 [H] -->
      <div style="background:var(--bg-box);border:1px solid var(--bg-box-border);border-radius:4px;padding:10px;">
        <div style="font-size:12px;font-weight:700;color:var(--c-brass-bright);margin-bottom:8px;display:flex;justify-content:space-between;">
          <span>🌊 战略海区制海权监控（40%情报硬门槛 [H]）</span>
          <span style="font-size:10.5px;color:var(--c-text-muted);">快捷键 F2 查看海权图层</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;max-height:160px;overflow-y:auto;padding-right:4px;">
  `;

  for(const sz of SEA_ZONES){
    const data = calcSeaZoneSuperiority(w, sz.id);
    const myRatio = data.ratios?.[p] ?? 0;
    const stat = data.status?.[p] || 'yellow';
    const myScore = Math.round(data.scores?.[p] || 0);
    const badgeColor = stat === 'green' ? 'var(--c-good)' : (stat === 'yellow' ? 'var(--c-warn)' : 'var(--c-bad)');
    const badgeText = stat === 'green' ? '制海优势' : (stat === 'yellow' ? '海权拉锯' : '劣势受制');

    html += `
      <div style="background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.06);border-left:3px solid ${badgeColor};padding:6px 8px;border-radius:3px;display:flex;justify-content:space-between;align-items:center;font-size:11px;">
        <div>
          <b style="color:#f1f5f9;">${sz.name}</b>
          <span style="color:var(--c-text-muted);margin-left:6px;">海军优势: <b style="color:#e2e8f0;">${myScore}</b> 点</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="color:${badgeColor};font-weight:700;">${(myRatio * 100).toFixed(1)}%</span>
          <span style="padding:1px 5px;border-radius:2px;font-size:10px;background:${badgeColor}22;color:${badgeColor};border:1px solid ${badgeColor}66;">${badgeText}</span>
        </div>
      </div>
    `;
  }

  html += `
        </div>
      </div>

      <!-- 3. 舰队编制与屏卫比监视器 [H] -->
      <div style="background:var(--bg-box);border:1px solid var(--bg-box-border);border-radius:4px;padding:10px;">
        <div style="font-size:12px;font-weight:700;color:var(--c-brass-bright);margin-bottom:8px;">
          🛡️ 舰队编制与屏卫效率矩阵 (3:1 资本/屏卫黄金比)
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;max-height:220px;overflow-y:auto;padding-right:4px;">
  `;

  if(!playerFleets.length){
    html += `<div style="text-align:center;color:var(--c-text-muted);font-size:11.5px;padding:16px;">当前暂无可指挥水面舰队。</div>`;
  } else {
    for(const fl of playerFleets){
      const sc = calcFleetScreening(fl.ships || []);
      const szName = SEA_ZONES.find(z => z.id === fl.seaZoneId)?.name || '在港';
      const isScreenFull = sc.screenRatio >= 1.0;

      html += `
        <div class="sf-fleet-card" data-fleet-id="${fl.id}" style="background:rgba(15,23,42,0.6);border:1px solid #334155;border-radius:4px;padding:8px;display:flex;flex-direction:column;gap:6px;font-size:11px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div style="display:flex;align-items:center;gap:6px;">
              <span style="font-size:16px;">⚓</span>
              <div>
                <b style="color:#f8fafc;">${fl.name}</b>
                <span style="color:#94a3b8;font-size:10px;margin-left:4px;">(资本 ${sc.capitals} | 屏卫 ${sc.screens} | 航母 ${sc.carriers} | 潜艇 ${sc.subs})</span>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:4px;">
              <span style="font-size:10px;color:var(--c-text-muted);">屏卫率:</span>
              <b style="color:${isScreenFull ? 'var(--c-good)' : 'var(--c-warn)'};">${Math.round(sc.screenRatio * 100)}%</b>
              <span style="font-size:9.5px;color:var(--c-text-muted);">${isScreenFull ? '(命中+40%)' : '(屏卫不足)'}</span>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
            <div>
              <label style="font-size:10px;color:var(--c-text-muted);display:block;margin-bottom:2px;">驻泊/任务海区：</label>
              <select class="sf-fleet-zone-sel" data-fleet-id="${fl.id}" style="width:100%;background:#0f172a;color:#cbd5e1;border:1px solid #475569;border-radius:3px;padding:2px 4px;font-size:10.5px;">
                ${SEA_ZONES.map(z => `<option value="${z.id}" ${z.id === fl.seaZoneId ? 'selected' : ''}>${z.name}</option>`).join('')}
              </select>
            </div>
            <div>
              <label style="font-size:10px;color:var(--c-text-muted);display:block;margin-bottom:2px;">战备任务：</label>
              <select class="sf-fleet-task-sel" data-fleet-id="${fl.id}" style="width:100%;background:#0f172a;color:#cbd5e1;border:1px solid #475569;border-radius:3px;padding:2px 4px;font-size:10.5px;">
                ${NAVY_TASK_OPTIONS.map(t => `<option value="${t.id}" ${t.id === fl.task ? 'selected' : ''}>${t.name}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>
      `;
    }
  }

  html += `
        </div>
      </div>

      <!-- 4. 登陆作战发起规划器 [H] -->
      <div style="background:var(--bg-box);border:1px solid var(--bg-box-border);border-radius:4px;padding:10px;">
        <div style="font-size:12px;font-weight:700;color:var(--c-brass-bright);margin-bottom:8px;">
          🚢 跨海登陆作战发起规划器 (7天/师准备周期 [H])
        </div>
        <div style="background:rgba(0,0,0,0.25);border:1px solid #334155;border-radius:4px;padding:8px;display:flex;flex-direction:column;gap:6px;font-size:11px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span>投送部队师数：</span>
            <input type="number" id="sf-inv-div-input" min="1" max="24" value="4" style="width:60px;background:#0f172a;color:#cbd5e1;border:1px solid #475569;border-radius:3px;padding:2px 4px;font-size:11px;text-align:center;">
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span>经行护航海区：</span>
            <select id="sf-inv-zone-sel" style="background:#0f172a;color:#cbd5e1;border:1px solid #475569;border-radius:3px;padding:2px 4px;font-size:11px;">
              ${SEA_ZONES.map(z => `<option value="${z.id}">${z.name}</option>`).join('')}
            </select>
          </div>
          <div id="sf-inv-preview-box" style="margin-top:4px;padding:6px;background:rgba(15,23,42,0.8);border-radius:3px;font-size:10.5px;color:#cbd5e1;border:1px solid #3b82c4;">
            准备周期：<b id="sf-inv-prep-days" style="color:#ffd977">28 天</b> | 状态：<b id="sf-inv-status" style="color:#22c55e">海权满足</b>
          </div>
          <button class="btn primary small" id="btn-launch-invasion" style="width:100%;margin-top:4px;padding:6px;">发起跨海登陆筹备</button>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;

  // 绑定事件：修改舰队海区与任务
  container.querySelectorAll('.sf-fleet-zone-sel').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const fleetId = e.target.dataset.fleetId;
      const fl = (w.fleets || []).find(f => f.id === fleetId);
      if(fl){
        fl.seaZoneId = e.target.value;
        sound.playClick();
        renderNavyPanel(container, store);
      }
    });
  });

  container.querySelectorAll('.sf-fleet-task-sel').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const fleetId = e.target.dataset.fleetId;
      const fl = (w.fleets || []).find(f => f.id === fleetId);
      if(fl){
        fl.task = e.target.value;
        sound.playClick();
        renderNavyPanel(container, store);
      }
    });
  });

  // 登陆规划器动态响应
  const divInput = container.querySelector('#sf-inv-div-input');
  const zoneSel = container.querySelector('#sf-inv-zone-sel');
  const updateInvPreview = () => {
    const divs = parseInt(divInput?.value || '4', 10);
    const zId = zoneSel?.value || 'sz_baltic';
    const prepDays = calcNavalInvasionPrep(divs, false);
    const check = validateNavalInvasion(w, p, [zId]);

    const daysEl = container.querySelector('#sf-inv-prep-days');
    const statusEl = container.querySelector('#sf-inv-status');
    if(daysEl) daysEl.textContent = `${prepDays} 天`;
    if(statusEl){
      statusEl.textContent = check.ok ? '海权与情报达标' : '海况不符';
      statusEl.style.color = check.ok ? 'var(--c-good)' : 'var(--c-bad)';
    }
  };

  divInput?.addEventListener('input', updateInvPreview);
  zoneSel?.addEventListener('change', updateInvPreview);

  /* v11.0：原来是两段 alert 占位（只校验不落地），现在立项 → 每日推进 →
     抢滩三步都真实发生，准备完毕会进警报条，登陆当日一次性扣滩头组织度。 */
  let pickedSite = null;
  const renderSites = () => {
    const host = container.querySelector('#sf-inv-sites');
    if(!host) return;
    const sites = listLandingSites(w, p).slice(0, 40);
    if(!sites.length){
      host.innerHTML = '<span style="color:var(--c-text-muted);font-size:11px;">当前没有可登陆的敌方海岸（需与敌国交战且目标临海）</span>';
      return;
    }
    pickedSite = pickedSite || sites[0];
    host.innerHTML = `
      <select id="sf-inv-site-sel" style="background:#0f172a;color:#cbd5e1;border:1px solid #475569;border-radius:3px;padding:2px 6px;font-size:11px;">
        ${sites.map((h) => `<option value="${h.idx}" ${h.idx === pickedSite.idx ? 'selected' : ''}>(${h.q},${h.r}) ${h.city ? h.city.name : ''} · ${w.nations[h.owner]?.name || h.owner}</option>`).join('')}
      </select>
      <span style="font-size:10.5px;color:var(--c-text-muted);margin-left:6px;">候选 ${sites.length} 处</span>`;
    host.querySelector('#sf-inv-site-sel')?.addEventListener('change', (e) => {
      pickedSite = w.hexes[+e.target.value];
    });
  };
  renderSites();

  container.querySelector('#btn-launch-invasion')?.addEventListener('click', () => {
    const divs = parseInt(divInput?.value || '4', 10);
    if(!pickedSite){ showToast('⚠️ 尚未选定登陆地点'); return; }
    const zId = zoneSel?.value || getHexSeaZone(pickedSite.q, pickedSite.r, w.seaZones) || null;
    const res = planNavalInvasion(w, p, zId, divs, pickedSite.idx);
    if(!res.ok){
      sound.playAlert();
      showToast(`⚠️ 登陆立项被驳回：${res.reason}`);
      return;
    }
    sound.playClick();
    showToast(`⚓ 登陆计划已立项：${res.count} 个师在 (${pickedSite.q},${pickedSite.r}) 集结，筹备 ${res.prepDays} 天`);
    renderNavyPanel(container, store);
  });

  // 进行中的登陆：进度条 + 立即抢滩 / 撤销
  container.querySelectorAll('[data-inv-go]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const r = executeNavalInvasion(w, btn.dataset.invGo);
      if(!r.ok){ sound.playAlert(); showToast(`⚠️ ${r.reason}`); return; }
      sound.playClick();
      showToast(`🌊 抢滩成功：${r.landed} 个师登上 (${r.target.q},${r.target.r})`);
      renderNavyPanel(container, store);
    });
  });
  container.querySelectorAll('[data-inv-cancel]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if(cancelNavalInvasion(w, btn.dataset.invCancel)){
        sound.playClick();
        showToast('已撤销登陆计划，师团回归原驻地待命');
        renderNavyPanel(container, store);
      }
    });
  });
}
