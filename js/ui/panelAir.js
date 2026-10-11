/* ============================================================
   ui/panelAir.js —— 空军统帅部与战区制空权总览面板 (v9.0 §4-N1 / §6) [H]
   左侧抽屉式面板（宽 550px），支持：
   1. 8 大战区制空权态势卡片（红/黄/绿 制空比与防空削弱）
   2. 机场驻防列表与超容预警
   3. 联队编成、基地转场与 7 种作战任务即时指派
   4. 王牌飞行员名录（Good / Unique / Genius 三档特质与战绩）
   ============================================================ */

import { K } from '../data/constants.js';
import {
  AIR_REGIONS,
  AIRCRAFT_INFO,
  calcAirbaseEfficiency,
  calcRangeEfficiency,
  calcWingSuperiority,
  calcRegionAirSuperiority,
  updateAirbaseCounts,
  canUpgradeWing,
  upgradeWingDesign
} from '../engine/air.js';
import { sound } from '../core/audio.js';
import { showToast } from './panels.js';   // v12.0 C47：alert 清零

export const TASK_OPTIONS = [
  { id: 'air_superiority', name: '✈️ 争夺制空', desc: '压制敌空军，夺取战场绝对空优' },
  { id: 'cas',              name: '🛩️ 近距支援 (CAS)', desc: '支援前线地面交火，提供攻击与伤害加成' },
  { id: 'strat_bombing',    name: '🚀 战略轰炸', desc: '轰炸敌后方工厂、铁路、机场等基建设施' },
  { id: 'interception',     name: '🛡️ 防空拦截', desc: '优先截击敌战略与战术轰炸机' },
  { id: 'naval_strike',     name: '🛸 截击海运', desc: '寻歼近海敌方战舰与运兵船队' },
  { id: 'recon',            name: '👁️ 空中侦察', desc: '侦测敌方陆海军动向并提升最高情报值' },
  { id: 'air_supply',       name: '📦 空运补给', desc: '向缺乏铁路连通的突前部队空投补给' }
];

export function renderAirPanel(container, store){
  if(!container) return;
  const w = store.world;
  const p = w.player;
  const n = w.nations[p];
  if(!n) return;

  updateAirbaseCounts(w);

  const playerWings = (w.airWings || []).filter(wg => wg.nat === p);
  const totalPlanes = playerWings.reduce((s, wg) => s + wg.count, 0);
  const playerBases = (w.airBases || []).filter(b => b.nat === p);
  const allAces = playerWings.flatMap(wg => (wg.aces || []).map(a => ({ ...a, wingId: wg.id })));

  let html = `
    <div class="sf-air-panel" style="display:flex;flex-direction:column;gap:12px;color:var(--c-text);font-family:inherit;">
      <!-- 1. 顶栏：空军总兵力与战备指标 -->
      <div style="background:var(--bg-box);border:1px solid var(--bg-box-border);border-radius:4px;padding:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <div style="font-weight:700;font-size:14px;color:var(--c-brass-bright);display:flex;align-items:center;gap:6px;">
            <span>✈️</span> <span>空军统帅部与战区总览</span>
          </div>
          <button class="btn small primary" id="btn-air-new-wing" style="padding:2px 8px;font-size:11px;" title="消耗 100 架空军装备库存成军（库存来自 air_eq 产线）">+ 新编联队</button>
          <button class="btn small" id="btn-air-line" style="padding:2px 8px;font-size:11px;" title="在工业流水线追加一条空军装备产线（用 optimal/滑块分厂）">⚙️ 转产空军装备</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:6px;font-size:11px;text-align:center;">
          <div style="background:rgba(0,0,0,0.3);padding:6px;border-radius:3px;">
            <div style="color:var(--c-text-muted);">现役战机</div>
            <div style="font-size:14px;font-weight:700;color:var(--c-brass-bright);">${totalPlanes} 架</div>
          </div>
          <div style="background:rgba(0,0,0,0.3);padding:6px;border-radius:3px;">
            <div style="color:var(--c-text-muted);">编制联队</div>
            <div style="font-size:14px;font-weight:700;color:#38bdf8;">${playerWings.length} 支</div>
          </div>
          <div style="background:rgba(0,0,0,0.3);padding:6px;border-radius:3px;">
            <div style="color:var(--c-text-muted);">空军基地</div>
            <div style="font-size:14px;font-weight:700;color:#a3e635;">${playerBases.length} 处</div>
          </div>
          <div style="background:rgba(0,0,0,0.3);padding:6px;border-radius:3px;">
            <div style="color:var(--c-text-muted);">战功王牌</div>
            <div style="font-size:14px;font-weight:700;color:#facc15;">${allAces.length} 人</div>
          </div>
        </div>
      </div>

      <!-- 2. 空区制空权监控面板 [H] -->
      <div style="background:var(--bg-box);border:1px solid var(--bg-box-border);border-radius:4px;padding:10px;">
        <div style="font-size:12px;font-weight:700;color:var(--c-brass-bright);margin-bottom:8px;display:flex;justify-content:space-between;">
          <span>🌐 战区制空权态势（红/黄/绿 三级掌控）</span>
          <span style="font-size:10.5px;color:var(--c-text-muted);">快捷键 F3 打开制空图层</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;max-height:160px;overflow-y:auto;padding-right:4px;">
  `;

  for(const reg of AIR_REGIONS){
    const data = calcRegionAirSuperiority(w, reg.id);
    const myRatio = data.ratios?.[p] ?? 0.5;
    const stat = data.status?.[p] || 'yellow';
    const wingsInReg = playerWings.filter(wg => wg.regionId === reg.id);
    const planesInReg = wingsInReg.reduce((s, wg) => s + wg.count, 0);

    const badgeColor = stat === 'green' ? 'var(--c-good)' : (stat === 'yellow' ? 'var(--c-warn)' : 'var(--c-bad)');
    const badgeText = stat === 'green' ? '制空优势' : (stat === 'yellow' ? '空中拉锯' : '劣势受制');

    html += `
      <div style="background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.06);border-left:3px solid ${badgeColor};padding:6px 8px;border-radius:3px;display:flex;justify-content:space-between;align-items:center;font-size:11px;">
        <div>
          <b style="color:#f1f5f9;">${reg.name}</b>
          <span style="color:var(--c-text-muted);margin-left:6px;">驻防: <b style="color:#e2e8f0;">${planesInReg}</b> 架 (${wingsInReg.length} 联队)</span>
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

      <!-- 3. 作战联队编制与任务指派表 [H] -->
      <div style="background:var(--bg-box);border:1px solid var(--bg-box-border);border-radius:4px;padding:10px;">
        <div style="font-size:12px;font-weight:700;color:var(--c-brass-bright);margin-bottom:8px;">
          📋 联队作战指令矩阵 (${playerWings.length} 个编队)
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;max-height:220px;overflow-y:auto;padding-right:4px;">
  `;

  if(!playerWings.length){
    html += `<div style="text-align:center;color:var(--c-text-muted);font-size:11.5px;padding:16px;">暂无可调遣空军联队，请先新建联队并部署至机场。</div>`;
  } else {
    for(const wg of playerWings){
      const info = AIRCRAFT_INFO[wg.type] || { name: wg.type, icon: '✈️' };
      const base = w.airBases?.find(b => b.id === wg.baseId) ||
                   w.airBases?.find(b => b.q === wg.baseHex?.[0] && b.r === wg.baseHex?.[1]);
      const baseEff = base ? calcAirbaseEfficiency(base, base.count) : 1.0;
      const targetReg = AIR_REGIONS.find(r => r.id === wg.regionId);
      const targetCenter = targetReg ? targetReg.center : (wg.baseHex || [0,0]);
      const rangeEff = wg.baseHex ? calcRangeEfficiency(wg.baseHex, targetCenter, wg.type) : 1.0;
      const totalEff = Math.round(baseEff * rangeEff * 100);

      html += `
        <div class="sf-air-wing-row" data-wing-id="${wg.id}" style="background:rgba(15,23,42,0.6);border:1px solid #334155;border-radius:4px;padding:8px;display:flex;flex-direction:column;gap:6px;font-size:11px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div style="display:flex;align-items:center;gap:6px;">
              <span style="font-size:16px;">${info.icon}</span>
              <div>
                <b style="color:#f8fafc;">${info.name}</b>
                <span style="color:#94a3b8;font-size:10px;margin-left:4px;">#${wg.id} (${wg.count}架)</span>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
              <span style="font-size:10px;color:var(--c-text-muted);">综合效率:</span>
              <b style="color:${totalEff >= 80 ? 'var(--c-good)' : (totalEff >= 50 ? 'var(--c-warn)' : 'var(--c-bad)')};">${totalEff}%</b>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
            <div>
              <label style="font-size:10px;color:var(--c-text-muted);display:block;margin-bottom:2px;">部署战区：</label>
              <select class="sf-wing-reg-sel" data-wing-id="${wg.id}" style="width:100%;background:#0f172a;color:#cbd5e1;border:1px solid #475569;border-radius:3px;padding:2px 4px;font-size:10.5px;">
                ${AIR_REGIONS.map(r => `<option value="${r.id}" ${r.id === wg.regionId ? 'selected' : ''}>${r.name}</option>`).join('')}
              </select>
            </div>
            <div>
              <label style="font-size:10px;color:var(--c-text-muted);display:block;margin-bottom:2px;">作战任务：</label>
              <select class="sf-wing-task-sel" data-wing-id="${wg.id}" style="width:100%;background:#0f172a;color:#cbd5e1;border:1px solid #475569;border-radius:3px;padding:2px 4px;font-size:10.5px;">
                ${TASK_OPTIONS.map(t => `<option value="${t.id}" ${t.id === wg.task ? 'selected' : ''}>${t.name}</option>`).join('')}
              </select>
            </div>
          </div>

          ${(wg.aces && wg.aces.length) ? `
            <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:2px;">
              ${wg.aces.map(a => `
                <span style="font-size:10px;padding:1px 5px;background:#854d0e;color:#fef08a;border-radius:2px;border:1px solid #ca8a04;">
                  ⭐ ${a.name} (+${Math.round(a.effBonus * 100)}%效率)
                </span>
              `).join('')}
            </div>
          ` : ''}

          <!-- W6-4：机型设计改进（8 条预置升级链，airXP 100/次） -->
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:2px;">
            <span style="font-size:10px;color:var(--c-text-muted);">${wg.designName || '原型设计'}${(wg.upgradeLevel || 0) > 0 ? ` · 效率 +${(wg.upgradeLevel || 0) * 8}%` : ''}</span>
            <button class="btn small" data-wing-upgrade="${wg.id}" style="padding:1px 6px;font-size:10px;" title="花 100 空军经验换装改型（任务效率 +8%/级）">✈️ 机型改进</button>
          </div>
        </div>
      `;
    }
  }

  html += `
        </div>
      </div>

      <!-- 4. 空军基地与机库超容监控 [H] -->
      <div style="background:var(--bg-box);border:1px solid var(--bg-box-border);border-radius:4px;padding:10px;">
        <div style="font-size:12px;font-weight:700;color:var(--c-brass-bright);margin-bottom:8px;">
          🛫 机场基建设施与机位容量
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;max-height:140px;overflow-y:auto;">
  `;

  for(const b of playerBases){
    const cap = b.capacity || (b.level * K.AIR.BASE_CAPACITY_PER_LEVEL);
    const count = b.count || 0;
    const isOver = count > cap;
    const eff = calcAirbaseEfficiency(b, count);
    const effPct = Math.round(eff * 100);

    html += `
      <div style="background:rgba(0,0,0,0.25);border:1px solid ${isOver ? 'var(--c-bad)' : '#334155'};border-radius:3px;padding:6px;font-size:11px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
          <b style="color:#e2e8f0;">${b.name}</b>
          <span style="color:#94a3b8;">Lv.${b.level}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:10.5px;">
          <span>驻机: <b style="color:${isOver ? 'var(--c-bad)' : '#38bdf8'}">${count}</b> / ${cap}</span>
          <span style="color:${effPct < 100 ? 'var(--c-bad)' : 'var(--c-good)'};">${effPct}% 任务效率</span>
        </div>
      </div>
    `;
  }

  html += `
        </div>
      </div>

      <!-- 5. 传奇王牌名人堂 [H] -->
      <div style="background:var(--bg-box);border:1px solid var(--bg-box-border);border-radius:4px;padding:10px;">
        <div style="font-size:12px;font-weight:700;color:var(--c-brass-bright);margin-bottom:8px;">
          🎖️ 蓝天雄鹰 · 现役王牌名录 (${allAces.length} 名)
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;max-height:110px;overflow-y:auto;">
  `;

  if(!allAces.length){
    html += `<div style="color:var(--c-text-muted);font-size:11px;">空战交火中战机联队将有几率催生王牌飞行员。</div>`;
  } else {
    for(const a of allAces){
      html += `
        <div style="background:#1e293b;border:1px solid #475569;border-radius:3px;padding:4px 8px;font-size:10.5px;display:flex;flex-direction:column;gap:2px;">
          <div style="color:#fef08a;font-weight:700;">🎖️ ${a.name}</div>
          <div style="color:#94a3b8;font-size:9.5px;">特质: ${a.tierName} | 效率: +${Math.round(a.effBonus * 100)}%</div>
        </div>
      `;
    }
  }

  html += `
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;

  // 绑定事件：修改联队战区与作战任务
  container.querySelectorAll('.sf-wing-reg-sel').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const wingId = e.target.dataset.wingId;
      const wing = (w.airWings || []).find(wg => wg.id === wingId);
      if(wing){
        wing.regionId = e.target.value;
        sound.playClick();
        renderAirPanel(container, store);
      }
    });
  });

  container.querySelectorAll('.sf-wing-task-sel').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const wingId = e.target.dataset.wingId;
      const wing = (w.airWings || []).find(wg => wg.id === wingId);
      if(wing){
        wing.task = e.target.value;
        sound.playClick();
        renderAirPanel(container, store);
      }
    });
  });

  // W6-4：机型设计改进按钮
  container.querySelectorAll('[data-wing-upgrade]').forEach(btn => {
    btn.addEventListener('click', () => {
      sound.playClick();
      const res = upgradeWingDesign(w, btn.dataset.wingUpgrade);
      if(res.ok) showToast(`✈️ 换装「${res.name}」（效率累计 +${res.level * 8}%）`);
      else showToast('⚠️ ' + res.reason);
      renderAirPanel(container, store);
    });
  });

  // 绑定新编联队按钮（W6-3：消耗空军装备库存，不再凭空打印 100 架）
  const btnNew = container.querySelector('#btn-air-new-wing');
  if(btnNew){
    btnNew.addEventListener('click', () => {
      const n = w.nations[p];
      n.equipment = n.equipment || {};
      const stock = n.equipment.air_eq || 0;
      if(stock < K.AIR.STANDARD_WING_SIZE){
        showToast(`⚠️ 空军装备库存不足（${Math.floor(stock)}/100 架）——请先转产空军装备`);
        return;
      }
      if(!playerBases.length){
        showToast('⚠️ 无可用空军基地！');
        return;
      }
      const base = playerBases[0];
      const newWing = {
        id: `wing_${p}_${(w.airWings?.length || 0) + 1}`,
        nat: p,
        type: 'fighter',
        count: K.AIR.STANDARD_WING_SIZE,
        baseId: base.id,
        baseHex: [base.q, base.r],
        task: 'air_superiority',
        regionId: AIR_REGIONS[0].id,
        exp: 1.0,
        aces: []
      };
      n.equipment.air_eq = stock - K.AIR.STANDARD_WING_SIZE;
      w.airWings = w.airWings || [];
      w.airWings.push(newWing);
      sound.playClick();
      showToast('🛫 新联队成军：消耗 100 架空军装备');
      renderAirPanel(container, store);
    });
  }

  // W6-3：转产空军装备 —— 追加一条 air_eq 产线（0 厂起步，用 optimal/滑块分厂）
  const btnLine = container.querySelector('#btn-air-line');
  if(btnLine){
    btnLine.addEventListener('click', () => {
      const n = w.nations[p];
      n.productionLines = n.productionLines || [];
      if(n.productionLines.some(l => l.type === 'air_eq')){
        showToast('✓ 已存在空军装备产线（去工业流水线分厂即可）');
        return;
      }
      n.productionLines.push({
        id: `air_eq_${Date.now() % 100000}`,
        type: 'air_eq',
        factories: 0,
        eff: K.EFF_START,
        cap: K.EFF_CAP
      });
      sound.playClick();
      showToast('⚙️ 空军装备产线已建立：去「工业流水线」分配军工厂');
      renderAirPanel(container, store);
    });
  }
}
