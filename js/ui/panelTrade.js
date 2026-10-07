/* ============================================================
   ui/panelTrade.js —— 国际贸易网络与附庸自治抽屉面板 (v9.0 §4-N5 / 附录 B.6) [H]
   包含：
   1. 国际贸易枢纽：4 档贸易法案 (150 PP 切换)、活动航线列表
   2. 全球资源采购市场 (1 民工 ⇄ 8 资源、影响力校验、一键签发航线)
   3. 附庸与傀儡国统辖：自治度 0-1000 进度阶梯、工厂上缴抽成
   4. 附庸指令台 (压制/放权、50 PP 升降级、300 PP 兼并吞并)
   ============================================================ */

import { TRADE_LAWS, AUTONOMY_TIERS, RESOURCES, RESOURCE_TYPES } from '../data/resources.js';
import {
  calcTradeInfluence,
  getExportableResources,
  createTradeRoute,
  cancelTradeRoute,
  changeTradeLaw,
  getAutonomyTier,
  changeAutonomyLevel,
  annexSubject
} from '../engine/subjects.js';
import { sound } from '../core/audio.js';
import { showToast } from './panels.js';   // v12.0 C47：alert 清零

let activeTradeTab = 'trade'; // 'trade' | 'subjects'

export function renderTradePanel(container, store){
  if(!container) return;
  const w = store.world;
  const p = w.player;
  const n = w.nations[p];
  if(!n) return;

  const freeCiv = Math.max(0, (n.civ || 0) - (n.rentedCivOut || 0));
  const freeConvoys = Math.max(0, (n.convoys || 150) - (n.convoysUsed || 0));

  let html = `
    <div class="sf-trade-panel" style="display:flex;flex-direction:column;gap:10px;color:var(--c-text);font-family:inherit;">
      <!-- 顶栏：民工与运输船资源指标 -->
      <div style="background:var(--bg-box);border:1px solid var(--bg-box-border);border-radius:4px;padding:8px 10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <div style="font-weight:700;font-size:13px;color:var(--c-brass-bright);display:flex;align-items:center;gap:6px;">
            <span>🚢</span> <span>国际贸易网络与附庸自治枢纽</span>
          </div>
          <span style="font-size:10px;color:var(--c-text-muted);">1 民工 ⇄ 8 资源/天 [H]</span>
        </div>

        <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:6px;font-size:11px;text-align:center;">
          <div style="background:rgba(0,0,0,0.3);padding:6px;border-radius:3px;">
            <div style="color:var(--c-text-muted);">可用民用工厂</div>
            <div style="font-size:13px;font-weight:700;color:${freeCiv > 0 ? '#38bdf8' : '#f87171'};margin-top:2px;">
              ${freeCiv} / ${n.civ || 0}
            </div>
          </div>
          <div style="background:rgba(0,0,0,0.3);padding:6px;border-radius:3px;">
            <div style="color:var(--c-text-muted);">护航运输船</div>
            <div style="font-size:13px;font-weight:700;color:#facc15;margin-top:2px;">
              ${freeConvoys} / ${n.convoys || 150}
            </div>
          </div>
          <div style="background:rgba(0,0,0,0.3);padding:6px;border-radius:3px;">
            <div style="color:var(--c-text-muted);">傀儡工厂进贡</div>
            <div style="font-size:13px;font-weight:700;color:#4ade80;margin-top:2px;">
              +${n.tributeCiv || 0}民 / +${n.tributeMil || 0}军
            </div>
          </div>
        </div>
      </div>

      <!-- 子标签切换 -->
      <div style="display:flex;gap:4px;">
        <button class="sf-trade-tab-btn ${activeTradeTab === 'trade' ? 'active' : ''}" data-tab="trade"
          style="flex:1;padding:5px 2px;font-size:11px;cursor:pointer;border-radius:3px;border:1px solid ${activeTradeTab === 'trade' ? 'var(--c-brass-bright)' : '#334155'};background:${activeTradeTab === 'trade' ? 'rgba(216,183,79,0.2)' : 'rgba(0,0,0,0.3)'};color:${activeTradeTab === 'trade' ? 'var(--c-brass-bright)' : 'var(--c-text-muted)'};font-weight:700;">
          🌐 国际贸易采购
        </button>
        <button class="sf-trade-tab-btn ${activeTradeTab === 'subjects' ? 'active' : ''}" data-tab="subjects"
          style="flex:1;padding:5px 2px;font-size:11px;cursor:pointer;border-radius:3px;border:1px solid ${activeTradeTab === 'subjects' ? 'var(--c-brass-bright)' : '#334155'};background:${activeTradeTab === 'subjects' ? 'rgba(216,183,79,0.2)' : 'rgba(0,0,0,0.3)'};color:${activeTradeTab === 'subjects' ? 'var(--c-brass-bright)' : 'var(--c-text-muted)'};font-weight:700;">
          👑 附庸与傀儡管辖 (${(n.subjects || []).length})
        </button>
      </div>
  `;

  if(activeTradeTab === 'trade'){
    html += renderTradeTabContent(w, p, n, freeCiv);
  } else {
    html += renderSubjectsTabContent(w, p, n);
  }

  html += `</div>`;
  container.innerHTML = html;

  bindTradeEvents(container, store);
}

/* 1. 国际贸易子标签内容 */
function renderTradeTabContent(w, p, n, freeCiv){
  const currentLaw = TRADE_LAWS[n.tradeLaw] || TRADE_LAWS.export_focus;
  const myRoutes = (w.tradeRoutes || []).filter(rt => rt.buyer === p);

  return `
    <!-- 1. 贸易法案选择器 -->
    <div style="background:var(--bg-box);border:1px solid var(--bg-box-border);border-radius:4px;padding:8px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <span style="font-weight:700;font-size:12px;color:var(--c-brass-bright);">国家贸易法案 (Trade Law)</span>
        <span style="font-size:10px;color:var(--c-text-muted);">切换消耗 150 PP [H]</span>
      </div>

      <div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:4px;">
        ${Object.values(TRADE_LAWS).map(law => {
          const isCurrent = (n.tradeLaw === law.id);
          return `
            <div style="background:rgba(0,0,0,0.3);border:1px solid ${isCurrent ? 'var(--c-brass-bright)' : '#334155'};border-radius:3px;padding:6px;display:flex;flex-direction:column;justify-content:space-between;">
              <div>
                <div style="font-weight:700;font-size:11px;color:${isCurrent ? 'var(--c-brass-bright)' : '#cbd5e1'};display:flex;justify-content:space-between;">
                  <span>${law.name.split('(')[0]}</span>
                  ${isCurrent ? '<span style="color:#22c55e;font-size:10px;">● 当前施行</span>' : ''}
                </div>
                <div style="font-size:9.5px;color:var(--c-text-muted);margin:2px 0;">${law.desc}</div>
              </div>
              ${!isCurrent ? `
                <button class="sf-trade-law-btn btn" data-law="${law.id}"
                  style="margin-top:4px;padding:2px 6px;font-size:9.5px;border-radius:2px;cursor:pointer;">
                  施行 (150 PP)
                </button>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <!-- 2. 我方活动贸易航线 -->
    <div style="background:var(--bg-box);border:1px solid var(--bg-box-border);border-radius:4px;padding:8px;">
      <div style="font-weight:700;font-size:12px;color:var(--c-brass-bright);margin-bottom:6px;">
        已签署进口航线 (${myRoutes.length})
      </div>

      ${!myRoutes.length ? `
        <div style="text-align:center;padding:12px;color:var(--c-text-muted);font-size:11px;">暂无活动贸易航线，可在下方市场签发进口合同</div>
      ` : `
        <div style="display:flex;flex-direction:column;gap:4px;">
          ${myRoutes.map(rt => {
            const sellerName = w.nations[rt.seller]?.name || rt.seller;
            const resInfo = RESOURCES[rt.resource] || { name: rt.resource, icon: '📦' };

            return `
              <div style="background:rgba(0,0,0,0.3);border:1px solid #334155;border-radius:3px;padding:6px 8px;display:flex;justify-content:space-between;align-items:center;">
                <div style="font-size:11px;">
                  <span style="font-size:14px;vertical-align:middle;">${resInfo.icon}</span>
                  <b>${resInfo.name}</b> × <span style="color:#38bdf8;font-weight:700;">+${rt.amount}/天</span>
                  <span style="color:var(--c-text-muted);font-size:10px;">(来自: ${sellerName} ｜ 耗费 ${rt.civCount} 民工 + ${rt.convoys} 船)</span>
                </div>
                <button class="sf-trade-cancel-btn btn" data-route-id="${rt.id}" style="padding:2px 6px;font-size:10px;cursor:pointer;">
                  撤销
                </button>
              </div>
            `;
          }).join('')}
        </div>
      `}
    </div>

    <!-- 3. 国际资源采购市场 -->
    <div style="background:var(--bg-box);border:1px solid var(--bg-box-border);border-radius:4px;padding:8px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <span style="font-weight:700;font-size:12px;color:var(--c-brass-bright);">全球资源采购市场 (1民工=8单位)</span>
        <span style="font-size:10px;color:var(--c-text-muted);">受影响力与法案配额制约</span>
      </div>

      <div style="display:flex;flex-direction:column;gap:6px;max-height:300px;overflow-y:auto;">
        ${Object.keys(w.nations).filter(k => k !== p && w.nations[k].alive).map(natId => {
          const seller = w.nations[natId];
          const inf = calcTradeInfluence(w, p, natId);
          const exportable = getExportableResources(w, natId);
          const availableRes = Object.entries(exportable).filter(([r, amt]) => amt >= 8);

          if(!availableRes.length || inf <= 0) return '';

          return `
            <div style="background:rgba(0,0,0,0.3);border:1px solid #334155;border-radius:3px;padding:6px 8px;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                <span style="font-weight:700;font-size:11.5px;color:${seller.color || '#fff'};">
                  ${seller.name || natId}
                </span>
                <span style="font-size:10px;color:#94a3b8;">
                  贸易影响力: <b style="color:#facc15;">${inf}</b> 点
                </span>
              </div>

              <div style="display:flex;flex-wrap:wrap;gap:4px;">
                ${availableRes.map(([resKey, amt]) => {
                  const rObj = RESOURCES[resKey] || { name: resKey, icon: '📦' };
                  return `
                    <button class="sf-trade-buy-btn btn" data-seller="${natId}" data-res="${resKey}"
                      style="padding:3px 6px;font-size:10px;cursor:pointer;border:1px solid #334155;background:#1e293b;border-radius:3px;display:flex;align-items:center;gap:3px;"
                      title="租借 1 民工开辟贸易线，每日获取 8 单位 ${rObj.name}">
                      <span>${rObj.icon}</span>
                      <span>${rObj.name}</span>
                      <span style="color:#38bdf8;">(${amt})</span>
                      <b style="color:var(--c-brass-bright);">+8</b>
                    </button>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        }).filter(Boolean).join('') || `
          <div style="text-align:center;padding:12px;color:var(--c-text-muted);font-size:11px;">暂无有充足盈余的和平外贸伙伴</div>
        `}
      </div>
    </div>
  `;
}

/* 2. 附庸与傀儡管辖子标签内容 */
function renderSubjectsTabContent(w, p, n){
  const subjectIds = n.subjects || [];

  return `
    <div style="background:var(--bg-box);border:1px solid var(--bg-box-border);border-radius:4px;padding:8px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <span style="font-weight:700;font-size:12px;color:var(--c-brass-bright);">宗主国统辖附庸清单</span>
        <span style="font-size:10px;color:var(--c-text-muted);">整合傀儡进贡: 25%民工 + 75%军工 [H]</span>
      </div>

      ${!subjectIds.length ? `
        <div style="background:rgba(0,0,0,0.3);border:1px dashed #334155;border-radius:3px;padding:24px;text-align:center;color:var(--c-text-muted);font-size:11.5px;">
          当前尚无附庸傀儡政权<br>
          <span style="font-size:10.5px;color:#64748b;">可通过战后和会强制建立傀儡，或间谍破译完成「组建合作政府」特权。</span>
        </div>
      ` : `
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${subjectIds.map(subId => {
            const sub = w.nations[subId];
            if(!sub) return '';
            const autonomy = Math.round(sub.autonomy != null ? sub.autonomy : 500);
            const tier = getAutonomyTier(autonomy);
            const pct = Math.round(autonomy / 1000 * 100);

            const surrenderCiv = Math.floor((sub.civ || 0) * tier.civSurrender);
            const surrenderMil = Math.floor((sub.mil || 0) * tier.milSurrender);

            return `
              <div style="background:rgba(0,0,0,0.3);border:1px solid #334155;border-radius:4px;padding:8px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                  <div style="font-weight:700;font-size:12px;color:${sub.color || '#fff'};display:flex;align-items:center;gap:6px;">
                    <span>👑</span> <span>${sub.name || subId}</span>
                  </div>
                  <span style="font-size:10px;padding:1px 6px;border-radius:2px;background:rgba(216,183,79,0.2);color:var(--c-brass-bright);border:1px solid var(--c-brass-bright);">
                    ${tier.name}
                  </span>
                </div>

                <!-- 自治度进度条 -->
                <div style="margin:6px 0;">
                  <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--c-text-muted);margin-bottom:2px;">
                    <span>自治度分值</span>
                    <span><b>${autonomy}</b> / 1000 点 (${pct}%)</span>
                  </div>
                  <div style="height:6px;background:#1e293b;border-radius:3px;overflow:hidden;">
                    <div style="height:100%;width:${pct}%;background:linear-gradient(90deg, #ef4444, #eab308, #22c55e);"></div>
                  </div>
                </div>

                <!-- 产能上缴盘点 -->
                <div style="display:flex;justify-content:space-between;font-size:10.5px;color:var(--c-text-muted);background:rgba(255,255,255,0.02);padding:4px 6px;border-radius:2px;margin-bottom:6px;">
                  <span>民工上缴: <b style="color:#38bdf8;">+${surrenderCiv}</b> / ${sub.civ || 0}</span>
                  <span>军工上缴: <b style="color:#ef4444;">+${surrenderMil}</b> / ${sub.mil || 0}</span>
                </div>

                <!-- 操作指令群 -->
                <div style="display:flex;gap:4px;flex-wrap:wrap;">
                  <button class="sf-subject-dir-btn btn ${sub.subjectDirective === 'suppress' ? 'gold' : ''}" data-sub="${subId}" data-dir="suppress"
                    style="flex:1;padding:3px 4px;font-size:10px;cursor:pointer;" title="持续消耗 0.5 PP/天，自治度每日 -0.5">
                    ${sub.subjectDirective === 'suppress' ? '正在压制' : '压制 (-0.5PP)'}
                  </button>
                  <button class="sf-subject-dir-btn btn ${sub.subjectDirective === 'increase' ? 'gold' : ''}" data-sub="${subId}" data-dir="increase"
                    style="flex:1;padding:3px 4px;font-size:10px;cursor:pointer;" title="持续消耗 0.5 PP/天，自治度每日 +0.5">
                    ${sub.subjectDirective === 'increase' ? '正在放权' : '放权 (+0.5PP)'}
                  </button>
                  <button class="sf-subject-level-btn btn" data-sub="${subId}" data-action="demote"
                    style="padding:3px 6px;font-size:10px;cursor:pointer;" title="消耗 50 PP 强力压降一级自治等级">
                    降级 (50PP)
                  </button>
                  ${autonomy <= 100 ? `
                    <button class="sf-subject-annex-btn btn gold" data-sub="${subId}"
                      style="padding:3px 6px;font-size:10px;font-weight:700;cursor:pointer;" title="消耗 300 PP 和平兼并为本土">
                      吞并 (300PP)
                    </button>
                  ` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    </div>
  `;
}

/* 3. 事件绑定 */
function bindTradeEvents(container, store){
  const w = store.world;
  const p = w.player;

  container.querySelectorAll('.sf-trade-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      sound.playClick();
      activeTradeTab = btn.dataset.tab;
      renderTradePanel(container, store);
    });
  });

  // 施行贸易法案
  container.querySelectorAll('.sf-trade-law-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      sound.playClick();
      const res = changeTradeLaw(w, p, btn.dataset.law);
      if(res.ok){
        sound.playFanfare && sound.playFanfare();
        renderTradePanel(container, store);
      } else {
        showToast(`⚠️ ${res.reason}`);
      }
    });
  });

  // 采购资源
  container.querySelectorAll('.sf-trade-buy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      sound.playClick();
      const seller = btn.dataset.seller;
      const resKey = btn.dataset.res;
      const res = createTradeRoute(w, p, seller, resKey, 1);
      if(res.ok){
        sound.playCoin && sound.playCoin();
        renderTradePanel(container, store);
      } else {
        showToast(`⚠️ ${res.reason}`);
      }
    });
  });

  // 撤销航线
  container.querySelectorAll('.sf-trade-cancel-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      sound.playClick();
      const rId = +btn.dataset.routeId;
      cancelTradeRoute(w, rId);
      renderTradePanel(container, store);
    });
  });

  // 附庸指令
  container.querySelectorAll('.sf-subject-dir-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      sound.playClick();
      const subId = btn.dataset.sub;
      const dir = btn.dataset.dir;
      const sub = w.nations[subId];
      if(sub){
        sub.subjectDirective = (sub.subjectDirective === dir ? null : dir);
        renderTradePanel(container, store);
      }
    });
  });

  // 附庸升降级
  container.querySelectorAll('.sf-subject-level-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      sound.playClick();
      const subId = btn.dataset.sub;
      const act = btn.dataset.action;
      const res = changeAutonomyLevel(w, p, subId, act);
      if(res.ok){
        renderTradePanel(container, store);
      } else {
        showToast(`⚠️ ${res.reason}`);
      }
    });
  });

  // 兼并吞并
  container.querySelectorAll('.sf-subject-annex-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      sound.playClick();
      const subId = btn.dataset.sub;
      const res = annexSubject(w, p, subId);
      if(res.ok){
        sound.playFanfare && sound.playFanfare();
        showToast('★ 附庸领土与在编陆军已全面整合归入宗主国！');
        renderTradePanel(container, store);
      } else {
        showToast(`⚠️ ${res.reason}`);
      }
    });
  });
}
