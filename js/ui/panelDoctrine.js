/* ============================================================
   ui/panelDoctrine.js —— 军种学说系统与统帅部经验面板 (v9.0 §4-N4 / 附录 B.5) [H]
   左侧抽屉式面板，支持：
   1. 陆/海/空 三军经验 (XP) 仪表盘与 500 点上限
   2. 陆军 (4树) / 空军 (3树) / 海军 (3树) 独立学说树图谱
   3. 同军种学说树互斥锁定警示与前置依赖约束
   4. 节点 100 XP 实时研习交互与国家修正值加成
   5. 师经验阶梯四档加成档案 (0% / +25% / +50% / +75%)
   ============================================================ */

import { DOCTRINES_DATA } from '../data/doctrines.js';
import {
  unlockDoctrine,
  getDivisionExpTier,
  DIVISION_EXP_TIERS
} from '../engine/doctrine.js';
import { sound } from '../core/audio.js';
import { showToast } from './panels.js';   // v12.0 C47：alert 清零

let activeDoctrineBranch = 'land'; // 'land' | 'air' | 'navy' | 'experience'

export function renderDoctrinePanel(container, store){
  if(!container) return;
  const w = store.world;
  const p = w.player;
  const n = w.nations[p];
  if(!n) return;

  n.doctrines = n.doctrines || [];
  n.activeTrees = n.activeTrees || { land: null, air: null, navy: null };
  const armyXp = Math.floor(n.armyXp != null ? n.armyXp : 150);
  const airXP = Math.floor(n.airXP != null ? n.airXP : 100);
  const navyXP = Math.floor(n.navyXP != null ? n.navyXP : 100);

  let html = `
    <div class="sf-doctrine-panel" style="display:flex;flex-direction:column;gap:12px;color:var(--c-text);font-family:inherit;">
      <!-- 1. 顶栏：三军经验池与储备上限 -->
      <div style="background:var(--bg-box);border:1px solid var(--bg-box-border);border-radius:4px;padding:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <div style="font-weight:700;font-size:13px;color:var(--c-brass-bright);display:flex;align-items:center;gap:6px;">
            <span>🎖️</span> <span>三军统帅部作战经验 (XP) 储备</span>
          </div>
          <span style="font-size:10.5px;color:var(--c-text-muted);">单节点消耗 100 XP ｜ 储备上限 500 点 [H]</span>
        </div>

        <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:6px;font-size:11px;text-align:center;">
          <div style="background:rgba(0,0,0,0.3);padding:6px;border-radius:3px;border-top:2px solid #22c55e;">
            <div style="color:var(--c-text-muted);">陆军经验 (Army XP)</div>
            <div style="font-size:14px;font-weight:700;color:#86efac;margin-top:2px;">${armyXp} / 500</div>
          </div>
          <div style="background:rgba(0,0,0,0.3);padding:6px;border-radius:3px;border-top:2px solid #38bdf8;">
            <div style="color:var(--c-text-muted);">空军经验 (Air XP)</div>
            <div style="font-size:14px;font-weight:700;color:#7dd3fc;margin-top:2px;">${airXP} / 500</div>
          </div>
          <div style="background:rgba(0,0,0,0.3);padding:6px;border-radius:3px;border-top:2px solid #a855f7;">
            <div style="color:var(--c-text-muted);">海军经验 (Navy XP)</div>
            <div style="font-size:14px;font-weight:700;color:#d8b4fe;margin-top:2px;">${navyXP} / 500</div>
          </div>
        </div>
      </div>

      <!-- 2. 子标签切换条 -->
      <div style="display:flex;gap:4px;border-bottom:1px solid var(--c-border-dark,#334155);padding-bottom:4px;">
        <button class="sf-doc-branch-btn ${activeDoctrineBranch === 'land' ? 'active' : ''}" data-branch="land"
          style="flex:1;padding:6px 2px;font-size:11px;cursor:pointer;border-radius:3px;border:1px solid ${activeDoctrineBranch === 'land' ? 'var(--c-brass-bright)' : '#334155'};background:${activeDoctrineBranch === 'land' ? 'rgba(216,183,79,0.2)' : 'rgba(0,0,0,0.3)'};color:${activeDoctrineBranch === 'land' ? 'var(--c-brass-bright)' : 'var(--c-text-muted)'};font-weight:700;">
          🎖️ 陆军学说 (4树)
        </button>
        <button class="sf-doc-branch-btn ${activeDoctrineBranch === 'air' ? 'active' : ''}" data-branch="air"
          style="flex:1;padding:6px 2px;font-size:11px;cursor:pointer;border-radius:3px;border:1px solid ${activeDoctrineBranch === 'air' ? 'var(--c-brass-bright)' : '#334155'};background:${activeDoctrineBranch === 'air' ? 'rgba(216,183,79,0.2)' : 'rgba(0,0,0,0.3)'};color:${activeDoctrineBranch === 'air' ? 'var(--c-brass-bright)' : 'var(--c-text-muted)'};font-weight:700;">
          ✈️ 空军学说 (3树)
        </button>
        <button class="sf-doc-branch-btn ${activeDoctrineBranch === 'navy' ? 'active' : ''}" data-branch="navy"
          style="flex:1;padding:6px 2px;font-size:11px;cursor:pointer;border-radius:3px;border:1px solid ${activeDoctrineBranch === 'navy' ? 'var(--c-brass-bright)' : '#334155'};background:${activeDoctrineBranch === 'navy' ? 'rgba(216,183,79,0.2)' : 'rgba(0,0,0,0.3)'};color:${activeDoctrineBranch === 'navy' ? 'var(--c-brass-bright)' : 'var(--c-text-muted)'};font-weight:700;">
          ⚓ 海军学说 (3树)
        </button>
        <button class="sf-doc-branch-btn ${activeDoctrineBranch === 'experience' ? 'active' : ''}" data-branch="experience"
          style="flex:1;padding:6px 2px;font-size:11px;cursor:pointer;border-radius:3px;border:1px solid ${activeDoctrineBranch === 'experience' ? 'var(--c-brass-bright)' : '#334155'};background:${activeDoctrineBranch === 'experience' ? 'rgba(216,183,79,0.2)' : 'rgba(0,0,0,0.3)'};color:${activeDoctrineBranch === 'experience' ? 'var(--c-brass-bright)' : 'var(--c-text-muted)'};font-weight:700;">
          ⭐ 师部精锐梯队
        </button>
      </div>
  `;

  // ===== 内容分支 1: 师部精锐阶梯 =====
  if(activeDoctrineBranch === 'experience'){
    const myDivs = w.units.filter(u => u.nat === p && u.hp > 0);
    const tierCounts = { raw: 0, trained: 0, regular: 0, seasoned: 0, veteran: 0 };
    myDivs.forEach(u => {
      const expTier = getDivisionExpTier(u.exp || 0.3);
      tierCounts[expTier.id] = (tierCounts[expTier.id] || 0) + 1;
    });

    html += `
      <div style="background:var(--bg-box);border:1px solid var(--bg-box-border);border-radius:4px;padding:10px;font-size:12px;">
        <div style="font-weight:700;color:var(--c-brass-bright);margin-bottom:6px;">部队作战熟练度与经验加成梯队 [H]</div>
        <div style="color:var(--c-text-muted);font-size:11px;margin-bottom:10px;line-height:1.4;">
          部队通过实战进攻、防御交火与前线训练获取作战经验。经验决定师级作战属性乘数修正（软硬攻/突破/防御全量乘算）：
        </div>

        <div style="display:flex;flex-direction:column;gap:8px;">
          ${DIVISION_EXP_TIERS.map(t => {
            const cnt = tierCounts[t.id] || 0;
            const pct = myDivs.length ? Math.round(cnt / myDivs.length * 100) : 0;
            const bonusStr = t.bonus >= 0 ? `+${Math.round(t.bonus * 100)}%` : `${Math.round(t.bonus * 100)}%`;
            const color = t.bonus > 0.4 ? '#fbbf24' : (t.bonus > 0 ? '#38bdf8' : (t.bonus === 0 ? '#94a3b8' : '#ef4444'));

            return `
              <div style="background:rgba(0,0,0,0.3);border:1px solid #334155;border-radius:4px;padding:8px;display:flex;justify-content:space-between;align-items:center;">
                <div>
                  <div style="font-weight:700;color:${color};display:flex;align-items:center;gap:6px;">
                    <span>${t.id === 'veteran' ? '⭐⭐⭐' : (t.id === 'seasoned' ? '⭐⭐' : (t.id === 'regular' ? '⭐' : '•'))}</span>
                    <span>${t.name}</span>
                    <span style="font-size:10px;color:var(--c-text-muted);font-weight:normal;">(经验要求 ≥ ${Math.round(t.minExp * 100)}%)</span>
                  </div>
                  <div style="font-size:11px;color:var(--c-text-muted);margin-top:2px;">
                    战斗属性加成：<b style="color:${color}">${bonusStr}</b> (属性乘数 ×${t.mul.toFixed(2)})
                  </div>
                </div>
                <div style="text-align:right;">
                  <div style="font-size:14px;font-weight:700;color:var(--c-brass-bright);">${cnt} 师</div>
                  <div style="font-size:10px;color:var(--c-text-muted);">占比 ${pct}%</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  } else {
    // ===== 内容分支 2: 学说树 (陆军 / 空军 / 海军) =====
    const branchKey = activeDoctrineBranch;
    const branchTrees = DOCTRINES_DATA[branchKey] || {};
    const currentActiveTree = n.activeTrees?.[branchKey];
    const userXP = branchKey === 'land' ? armyXp : (branchKey === 'air' ? airXP : navyXP);

    html += `<div style="display:flex;flex-direction:column;gap:12px;">`;

    for(const treeId in branchTrees){
      const tree = branchTrees[treeId];
      const isLockedOut = (currentActiveTree != null && currentActiveTree !== treeId);
      const isCurrentTree = (currentActiveTree === treeId);

      let statusBadge = `<span style="font-size:10px;padding:2px 6px;border-radius:2px;background:rgba(100,116,139,0.2);color:#94a3b8;border:1px solid #475569;">可选流派</span>`;
      if(isCurrentTree){
        statusBadge = `<span style="font-size:10px;padding:2px 6px;border-radius:2px;background:rgba(34,197,94,0.2);color:#86efac;border:1px solid #22c55e;">● 研习中主干 [H]</span>`;
      } else if(isLockedOut){
        statusBadge = `<span style="font-size:10px;padding:2px 6px;border-radius:2px;background:rgba(239,68,68,0.2);color:#fca5a5;border:1px solid #ef4444;">🚫 同军种互斥锁定 [H]</span>`;
      }

      html += `
        <div style="background:var(--bg-box);border:1px solid ${isCurrentTree ? 'var(--c-brass-bright)' : (isLockedOut ? '#450a0a' : 'var(--bg-box-border)')};opacity:${isLockedOut ? '0.6' : '1'};border-radius:4px;padding:10px;">
          <!-- 树标题与流派说明 -->
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
            <div>
              <div style="font-weight:700;font-size:13px;color:${isCurrentTree ? 'var(--c-brass-bright)' : '#f1f5f9'};">
                ${tree.name}
              </div>
              <div style="font-size:11px;color:var(--c-text-muted);margin-top:2px;">
                ${tree.desc}
              </div>
            </div>
            <div>${statusBadge}</div>
          </div>

          <!-- 树节点流水线 -->
          <div style="display:flex;flex-direction:column;gap:6px;margin-top:10px;">
            ${tree.nodes.map((node, idx) => {
              const isResearched = (n.doctrines || []).includes(node.id);
              const reqMet = (!node.requires || !node.requires.length || node.requires.every(r => n.doctrines.includes(r)));
              const canAfford = (userXP >= (node.costXP || 100));

              let actionArea = '';
              if(isResearched){
                actionArea = `<div style="font-size:11px;font-weight:700;color:#22c55e;display:flex;align-items:center;gap:3px;">
                  <span>✓</span> <span>已修习</span>
                </div>`;
              } else if(isLockedOut){
                actionArea = `<button disabled style="padding:4px 8px;font-size:10px;background:#334155;color:#94a3b8;border:none;border-radius:3px;cursor:not-allowed;" title="同军种学说树互斥，无法选择">
                  🚫 互斥关闭
                </button>`;
              } else if(!reqMet){
                const reqNodeName = tree.nodes.find(x => node.requires.includes(x.id))?.name || '前置学说';
                actionArea = `<button disabled style="padding:4px 8px;font-size:10px;background:#1e293b;color:#64748b;border:1px solid #334155;border-radius:3px;cursor:not-allowed;" title="需要先研习：${reqNodeName}">
                  🔒 需研习前置
                </button>`;
              } else if(!canAfford){
                actionArea = `<button disabled style="padding:4px 8px;font-size:10px;background:#334155;color:#fca5a5;border:1px solid #7f1d1d;border-radius:3px;cursor:not-allowed;">
                  需 100 XP
                </button>`;
              } else {
                actionArea = `<button class="sf-unlock-doc-btn btn gold" data-branch="${branchKey}" data-tree="${treeId}" data-node="${node.id}"
                  style="padding:4px 10px;font-size:10.5px;font-weight:700;border-radius:3px;cursor:pointer;" title="消耗 100 XP 研习本学说节点">
                  研习 (100 XP)
                </button>`;
              }

              return `
                <div style="background:rgba(0,0,0,0.3);border:1px solid ${isResearched ? '#15803d' : '#334155'};border-radius:3px;padding:8px;display:flex;justify-content:space-between;align-items:center;">
                  <div style="flex:1;padding-right:10px;">
                    <div style="font-weight:700;font-size:12px;color:${isResearched ? '#86efac' : '#cbd5e1'};display:flex;align-items:center;gap:6px;">
                      <span style="font-size:10px;color:var(--c-text-muted);">[#${idx+1}]</span>
                      <span>${node.name}</span>
                    </div>
                    <div style="font-size:11px;color:var(--c-text-muted);margin-top:2px;line-height:1.3;">
                      ${node.desc}
                    </div>
                  </div>
                  <div>${actionArea}</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    html += `</div>`;
  }

  html += `</div>`;
  container.innerHTML = html;

  // 绑定子标签切换事件
  container.querySelectorAll('.sf-doc-branch-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      sound.playClick();
      activeDoctrineBranch = btn.dataset.branch;
      renderDoctrinePanel(container, store);
    });
  });

  // 绑定学说研习交互事件
  container.querySelectorAll('.sf-unlock-doc-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const bKey = btn.dataset.branch;
      const tId = btn.dataset.tree;
      const nId = btn.dataset.node;
      sound.playClick();

      const res = unlockDoctrine(w, p, bKey, tId, nId);
      if(res.ok){
        sound.playFanfare && sound.playFanfare();
        w.events.push({
          type: 'doctrine_unlocked',
          day: w.day,
          text: `【统帅部军令】研习完成最新作战学说：${res.node?.name || nId}！`,
          important: true
        });
        renderDoctrinePanel(container, store);
      } else {
        showToast(`⚠️ ${res.reason || '无法研习该学说'}`);
      }
    });
  });
}
