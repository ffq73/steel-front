/* ============================================================
   ui/panelIntel.js —— 间谍与情报局总览面板 (v9.0 §4-N3 / §6) [H]
   左侧抽屉式面板（宽 600px），支持：
   1. 5 大情报机构升级分支树（情报/防御/隐秘/培训/密码学）
   2. 特工编制名录与任务指派（渗透/反间谍/静默）
   3. 目标国四维情报等级四色进度条与精度说明
   4. 19 种历史情报行动发射台（含同目标+15%复利成本递增）
   5. 恩尼格玛密码破译机与30天密码破解红利期
   ============================================================ */

import { K } from '../data/constants.js';
import {
  INTEL_OPERATIONS,
  calcCipherStrength,
  calcIntelCombatBonus,
  calcRepeatOperationCostMultiplier,
  calcIntelLevels,
  planIntelOperation,
  cancelIntelOperation
} from '../engine/intel.js';
import { sound } from '../core/audio.js';
import { showToast } from './panels.js';

export function renderIntelPanel(container, store){
  if(!container) return;
  const w = store.world;
  const p = w.player;
  const n = w.nations[p];
  if(!n) return;

  const agency = w.agencies?.[p];
  if(!agency){
    container.innerHTML = `<div style="padding:20px;text-align:center;color:var(--c-text-muted);">尚未建立国家情报机构</div>`;
    return;
  }

  // 默认查看交战国或主要对手
  const enemies = n.atWarWith || [];
  const otherNations = Object.keys(w.nations).filter(k => k !== p);
  const targetNat = agency.selectedTarget || (enemies.length ? enemies[0] : otherNations[0] || p);
  agency.selectedTarget = targetNat;

  const intel = calcIntelLevels(w, p, targetNat);
  const targetName = w.nations[targetNat]?.name || targetNat;
  const combatBonus = calcIntelCombatBonus(intel.army, w.intelCache?.[targetNat]?.[p]?.army || 50);

  // 密码学参数
  const myCryptLv = agency.upgrades?.cryptology || 0;
  const targetCryptLv = w.agencies?.[targetNat]?.upgrades?.cryptology || 0;
  const targetCipherStrength = calcCipherStrength(targetCryptLv);
  const cipherProg = agency.cipherProgress?.[targetNat] || 0;
  const cipherPct = Math.min(100, Math.round(cipherProg / targetCipherStrength * 100));
  const isCracked = (agency.crackedCiphers?.[targetNat] || 0) > 0;
  const crackedDaysLeft = agency.crackedCiphers?.[targetNat] || 0;

  let html = `
    <div class="sf-intel-panel" style="display:flex;flex-direction:column;gap:12px;color:var(--c-text);font-family:inherit;">
      <!-- 1. 顶栏：情报局概貌与特工编制 -->
      <div style="background:var(--bg-box);border:1px solid var(--bg-box-border);border-radius:4px;padding:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <div style="font-weight:700;font-size:14px;color:var(--c-brass-bright);display:flex;align-items:center;gap:6px;">
            <span>🕵️</span> <span>${agency.name}</span>
          </div>
          <div style="font-size:11px;color:var(--c-text-muted);">
            特工槽位: <b style="color:#38bdf8;">${(agency.operatives || []).length}</b> / ${Math.min(10, 1 + Math.floor(Object.values(agency.upgrades).reduce((s,v)=>s+v,0)/5))}
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:6px;font-size:11px;text-align:center;">
          <div style="background:rgba(0,0,0,0.3);padding:6px;border-radius:3px;">
            <div style="color:var(--c-text-muted);">现役特工</div>
            <div style="font-size:14px;font-weight:700;color:var(--c-brass-bright);">${(agency.operatives || []).length} 名</div>
          </div>
          <div style="background:rgba(0,0,0,0.3);padding:6px;border-radius:3px;">
            <div style="color:var(--c-text-muted);">机构升级分支</div>
            <div style="font-size:14px;font-weight:700;color:#a3e635;">${Object.values(agency.upgrades || {}).reduce((s,v)=>s+v,0)} 级</div>
          </div>
          <div style="background:rgba(0,0,0,0.3);padding:6px;border-radius:3px;">
            <div style="color:var(--c-text-muted);">破译密码本</div>
            <div style="font-size:14px;font-weight:700;color:#facc15;">${Object.keys(agency.crackedCiphers || {}).length} 份</div>
          </div>
        </div>
      </div>

      <!-- 2. 目标国情报渗透等级与精度指示器 [H] -->
      <div style="background:var(--bg-box);border:1px solid var(--bg-box-border);border-radius:4px;padding:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <div style="font-size:12px;font-weight:700;color:var(--c-brass-bright);">
            🎯 目标国情报监控与渗透网
          </div>
          <select id="sf-intel-target-sel" style="background:#0f172a;color:#cbd5e1;border:1px solid #475569;border-radius:3px;padding:2px 6px;font-size:11px;">
            ${otherNations.map(k => `<option value="${k}" ${k === targetNat ? 'selected' : ''}>${w.nations[k]?.name || k}</option>`).join('')}
          </select>
        </div>

        ${combatBonus > 0 ? `
          <div style="background:rgba(34, 197, 94, 0.12);border:1px solid #22c55e;border-radius:3px;padding:4px 8px;font-size:10.5px;color:#86efac;margin-bottom:8px;display:flex;justify-content:space-between;">
            <span>⚔️ 陆军情报压制激活 (情报差 ≥ 5pp)：</span>
            <b>软攻/硬攻/防御/突破 +${(combatBonus * 100).toFixed(1)}% [H]</b>
          </div>
        ` : `
          <div style="background:rgba(255, 255, 255, 0.05);border-radius:3px;padding:4px 8px;font-size:10.5px;color:var(--c-text-muted);margin-bottom:8px;">
            情报优势低于 5pp，暂未激活陆军战力修正 (满额 +15%)
          </div>
        `}

        <div style="display:flex;flex-direction:column;gap:6px;font-size:11px;">
          <!-- 民政 -->
          <div>
            <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
              <span>🏛️ 民政与工业情报</span>
              <b style="color:#60a5fa">${intel.civ}% · ${intel.civ >= 30 ? '精确工厂' : '区间估算 (±50%)'}</b>
            </div>
            <div style="height:6px;background:rgba(0,0,0,0.4);border-radius:3px;overflow:hidden;">
              <div style="height:100%;width:${intel.civ}%;background:#3b82c4;"></div>
            </div>
          </div>
          <!-- 陆军 -->
          <div>
            <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
              <span>⚔️ 陆军与编制情报</span>
              <b style="color:#f87171">${intel.army}% · ${intel.army >= 70 ? '精确编制' : (intel.army >= 30 ? '估算 (±50%)' : '粗略 (±80%)')}</b>
            </div>
            <div style="height:6px;background:rgba(0,0,0,0.4);border-radius:3px;overflow:hidden;">
              <div style="height:100%;width:${intel.army}%;background:#ef4444;"></div>
            </div>
          </div>
          <!-- 海军 -->
          <div>
            <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
              <span>🌊 海军与动向情报</span>
              <b style="color:#38bdf8">${intel.navy}% · ${intel.navy >= 40 ? '海权有效(≥40%门槛)' : '⚠️ 海权强制归0'}</b>
            </div>
            <div style="height:6px;background:rgba(0,0,0,0.4);border-radius:3px;overflow:hidden;">
              <div style="height:100%;width:${intel.navy}%;background:#0284c7;"></div>
            </div>
          </div>
          <!-- 空军 -->
          <div>
            <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
              <span>✈️ 空军与基地情报</span>
              <b style="color:#a3e635">${intel.air}% · ${intel.air >= 50 ? '探明驻防机群' : '模糊'}</b>
            </div>
            <div style="height:6px;background:rgba(0,0,0,0.4);border-radius:3px;overflow:hidden;">
              <div style="height:100%;width:${intel.air}%;background:#84cc16;"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- 3. 恩尼格玛密码机与密电破译 [H] -->
      <div style="background:var(--bg-box);border:1px solid var(--bg-box-border);border-radius:4px;padding:10px;">
        <div style="font-size:12px;font-weight:700;color:var(--c-brass-bright);margin-bottom:6px;display:flex;justify-content:space-between;">
          <span>📟 密码学破译处 (12000 + 4250 × Lv [H])</span>
          <span style="font-size:10.5px;color:var(--c-text-muted);">目标加密强度: ${targetCipherStrength}</span>
        </div>
        ${isCracked ? `
          <div style="background:rgba(234, 179, 8, 0.15);border:1px solid #eab308;border-radius:4px;padding:8px;text-align:center;">
            <div style="color:#fef08a;font-weight:700;font-size:12px;">⭐ ${targetName} 密码已被全面破解！</div>
            <div style="color:#cbd5e1;font-size:10.5px;margin-top:2px;">
              全领域情报 +60% | 空军拦截 +25% | 剩余有效: <b style="color:#ffd977">${crackedDaysLeft} 天</b>
            </div>
          </div>
        ` : `
          <div>
            <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px;">
              <span>对 ${targetName} 破译进度：</span>
              <b style="color:#facc15">${cipherProg} / ${targetCipherStrength} (${cipherPct}%)</b>
            </div>
            <div style="height:8px;background:rgba(0,0,0,0.4);border-radius:4px;overflow:hidden;margin-bottom:6px;">
              <div style="height:100%;width:${cipherPct}%;background:linear-gradient(90deg, #ca8a04, #facc15);"></div>
            </div>
            <button class="btn small primary" id="btn-focus-cipher" style="width:100%;padding:4px;font-size:11px;">
              ${agency.cipherTarget === targetNat ? '正在全力解密该国密电...' : `锁定 ${targetName} 为破译主攻目标`}
            </button>
          </div>
        `}
      </div>

      <!-- 4. 19 项历史情报行动清单与发射台 [H] -->
      <div style="background:var(--bg-box);border:1px solid var(--bg-box-border);border-radius:4px;padding:10px;">
        <div style="font-size:12px;font-weight:700;color:var(--c-brass-bright);margin-bottom:6px;display:flex;justify-content:space-between;">
          <span>🎯 特工隐秘行动中心 (重复执行成本每次 +15% [H])</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;max-height:220px;overflow-y:auto;padding-right:4px;">
  `;

  for(const opKey in INTEL_OPERATIONS){
    const op = INTEL_OPERATIONS[opKey];
    const execCount = w.operationHistory?.[p]?.[targetNat]?.[opKey] || 0;
    const costMult = calcRepeatOperationCostMultiplier(execCount);

    html += `
      <div class="sf-op-card" style="background:rgba(15,23,42,0.6);border:1px solid #334155;border-radius:4px;padding:6px 8px;font-size:10.5px;display:flex;flex-direction:column;gap:3px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <b style="color:#f8fafc;font-size:11px;">${op.name}</b>
          <span style="color:#94a3b8;">需特工: <b style="color:#38bdf8">${op.operatives}</b> | 网络: <b style="color:#ffd977">${op.network}%</b></span>
        </div>
        <div style="color:var(--c-text-muted);font-size:10px;">${op.desc}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:2px;">
          <span style="color:#94a3b8;">历时: ${op.days}天 | 风险: ${Math.round(op.risk * 100)}% ${execCount > 0 ? `| <b style="color:#f87171">成本 ×${costMult}</b>` : ''}</span>
          <button class="btn small" data-intel-op="${opKey}" style="padding:2px 6px;font-size:10px;">筹备行动</button>
        </div>
      </div>
    `;
  }

  html += `
        </div>
      </div>
    </div>
  `;

  // —— 进行中的秘密行动（v11.0）——
  const activeOps = (w.activeOperations || []).filter((o) => o.nat === p);
  if(activeOps.length){
    html += `
      <div style="margin-top:12px;border-top:1px solid #334155;padding-top:8px;">
        <div style="font-size:11.5px;font-weight:700;color:var(--brass-bright);margin-bottom:6px;">进行中的秘密行动</div>
        ${activeOps.map((o) => {
          const spec = INTEL_OPERATIONS[o.opId] || { name: o.opId };
          const pct = Math.min(100, Math.round((o.progress / o.days) * 100));
          return `<div style="display:flex;align-items:center;gap:8px;font-size:11px;margin-bottom:4px;">
            <span style="flex:1;color:#e2e8f0;">${spec.name} → ${w.nations[o.targetNat]?.name || o.targetNat}</span>
            <span style="color:#94a3b8;">${o.progress}/${o.days} 天</span>
            <div style="width:70px;height:6px;background:#1e293b;border-radius:3px;overflow:hidden;">
              <div style="width:${pct}%;height:100%;background:#38bdf8;"></div>
            </div>
            <button class="btn small" data-intel-cancel="${o.id}" style="padding:1px 6px;font-size:10px;">撤销</button>
          </div>`;
        }).join('')}
      </div>`;
  }

  container.innerHTML = html;

  // v11.0：按钮从「弹个 alert」改为真的立项 —— 校验机构/特工/网络/政治点，
  // 占用特工、扣政治点、写入 world.activeOperations，由 intelTick 每日推进结算。
  container.querySelectorAll('[data-intel-op]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const res = planIntelOperation(w, p, btn.dataset.intelOp, targetNat);
      if(res.ok){
        sound.playClick();
        btn.textContent = `已立项 ${res.days}天`;
        btn.disabled = true;
      } else {
        sound.playAlert();
        showToast(`⚠️ 行动驳回：${res.reason}`);
        btn.title = res.reason;
        btn.textContent = '行动驳回';
        btn.style.color = 'var(--c-bad)';
      }
    });
  });
  container.querySelectorAll('[data-intel-cancel]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if(cancelIntelOperation(w, btn.dataset.intelCancel)) sound.playClick();
    });
  });

  // 绑定目标国切换
  const targetSel = container.querySelector('#sf-intel-target-sel');
  if(targetSel){
    targetSel.addEventListener('change', (e) => {
      agency.selectedTarget = e.target.value;
      sound.playClick();
      renderIntelPanel(container, store);
    });
  }

  // 绑定锁定解密目标按钮
  const btnCipher = container.querySelector('#btn-focus-cipher');
  if(btnCipher){
    btnCipher.addEventListener('click', () => {
      agency.cipherTarget = targetNat;
      sound.playClick();
      renderIntelPanel(container, store);
    });
  }
}
