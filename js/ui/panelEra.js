/* ============================================================
   ui/panelEra.js —— 时代专属特色机制交互面板 (v5.0 §2.7 / E5)
   包含四大时代独占交互：
   - 一战：炮击准备模式、战争疲惫与封锁/潜艇战
   - 二战：战区统帅指挥、占领区治理法案与阵营外交
   - 冷战：DEFCON 战备阶梯、末日钟、太空竞赛7大里程碑与阵营影响力
   - 现代：FPV 无人机打击、制裁网络、能源管道与军援升级红线
   ============================================================ */

import { BARRAGE_MODES, setBarrageMode } from '../engine/barrage.js';
import { activateUnrestrictedSubWarfare } from '../engine/attrition.js';
import { OCCUPATION_LAWS, setOccupationLaw } from '../engine/resistance.js';
import { getTheaterCombatBonus } from '../engine/theaters.js';
import { DEFCON_LEVELS, setDefcon, getDefcon } from '../engine/nuclear.js';
import { SPACE_MILESTONES, launchSpaceMission, getSpaceProgress } from '../engine/space.js';
import { BLOCS, investInfluence, conductCovertOp } from '../engine/bloc.js';
import { launchFpvStrike, deployElectronicWarfare } from '../engine/drones.js';
import { SANCTION_PACKAGES, imposeSanction } from '../engine/sanctions.js';
import { cutPipeline, getPipelineStatus } from '../engine/energy.js';
import { AID_PACKAGES, sendAidPackage } from '../engine/milaid.js';

/* v11.0：面板此前没有任何挂载点（renderEraPanel 全项目零调用），于是
   一战无限制潜艇战、二战占领区治理法案、冷战太空竞赛发射、现代 FPV/电子战
   这些引擎能力玩家一个都碰不到。现在由抽屉的「时代」页签挂载。
   原先用 toast() 反馈 —— 它会阻塞主渲染循环，改为注入的 toast 回调。 */
export function renderEraPanel(world, hooks = {}){
  const toast = typeof hooks.toast === 'function' ? hooks.toast : (m) => {};
  const container = document.createElement('div');
  container.className = 'panel-era-container';
  container.style.cssText = 'padding: 16px; color: #e0e0e0; font-family: sans-serif;';

  const era = world.era || 'ww2';
  const playerNat = world.nations[world.player] || {};

  if(era === 'ww1'){
    container.innerHTML = `
      <div style="border-bottom: 2px solid #5a4632; padding-bottom: 8px; margin-bottom: 12px;">
        <h3 style="margin: 0; color: #deb887;">⚔️ 一战堑壕与总体消耗战体系 (WW1)</h3>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div style="background: rgba(0,0,0,0.3); padding: 12px; border-radius: 4px; border: 1px solid #4a3c31;">
          <h4 style="margin: 0 0 8px 0; color: #ffcc66;">🎯 炮火准备模式 (Artillery Barrage)</h4>
          <p style="font-size: 12px; color: #bbb;">选择进攻战役发起前的压制炮火形式：</p>
          <div style="display: flex; flex-direction: column; gap: 6px;" id="ww1-barrage-buttons">
            ${Object.values(BARRAGE_MODES).map(m => `
              <button class="btn-era" data-mode="${m.id}" style="padding: 6px 10px; background: #2b221a; border: 1px solid #705844; color: #fff; text-align: left; cursor: pointer; border-radius: 3px;">
                <strong>${m.name}</strong> (${m.prepDays}天) - 日耗火炮: ${m.artCostPerDay}
                <div style="font-size: 11px; color: #aaa;">${m.desc}</div>
              </button>
            `).join('')}
          </div>
        </div>

        <div style="background: rgba(0,0,0,0.3); padding: 12px; border-radius: 4px; border: 1px solid #4a3c31;">
          <h4 style="margin: 0 0 8px 0; color: #ff6666;">⏳ 战争疲惫度与大洋封锁</h4>
          <div style="margin-bottom: 10px;">
            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
              <span>国内战争疲惫:</span>
              <strong style="color: ${playerNat.warExhaustion > 60 ? '#ff4444' : '#44ff44'};">${(playerNat.warExhaustion || 0).toFixed(1)}%</strong>
            </div>
            <div style="background: #222; height: 10px; border-radius: 5px; overflow: hidden;">
              <div style="background: ${playerNat.warExhaustion > 60 ? '#cc2222' : '#888'}; width: ${Math.min(100, playerNat.warExhaustion || 0)}%; height: 100%;"></div>
            </div>
            <div style="font-size: 11px; color: #999; margin-top: 4px;">阈值警报：≥60% 爆发工人总罢工，≥80% 触发十月革命或帝国解体！</div>
          </div>
          ${world.player === 'GER' ? `
            <div style="border-top: 1px dashed #555; padding-top: 8px;">
              <button id="btn-unrestricted-sub" style="width: 100%; padding: 8px; background: #551111; border: 1px solid #aa3333; color: #fff; cursor: pointer; border-radius: 3px; font-weight: bold;">
                🌊 发动【无限制潜艇战】(豪赌速决英国)
              </button>
              <div style="font-size: 11px; color: #aaa; margin-top: 4px;">加速英国战争疲惫，但将在 12 个月后促成美国正式参战！</div>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    // 绑定 WW1 事件
    setTimeout(() => {
      container.querySelectorAll('#ww1-barrage-buttons button').forEach(btn => {
        btn.onclick = () => {
          setBarrageMode(world, 'active_plan', btn.dataset.mode);
          toast(`已设定炮击模式为: ${btn.dataset.mode}`);
        };
      });
      const subBtn = container.querySelector('#btn-unrestricted-sub');
      if(subBtn){
        subBtn.onclick = () => {
          activateUnrestrictedSubWarfare(world);
          toast('德国最高统帅部已签署并批准无限制潜艇战指令！');
        };
      }
    }, 10);

  } else if(era === 'ww2'){
    container.innerHTML = `
      <div style="border-bottom: 2px solid #5a2222; padding-bottom: 8px; margin-bottom: 12px;">
        <h3 style="margin: 0; color: #ff9999;">🛡️ 二战战区统帅与占领区治理体系 (WW2)</h3>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div style="background: rgba(0,0,0,0.3); padding: 12px; border-radius: 4px; border: 1px solid #4a2222;">
          <h4 style="margin: 0 0 8px 0; color: #ffcc66;">🗺️ 占领区治安与治理法案</h4>
          <p style="font-size: 12px; color: #bbb;">针对占领领土实施不同的军事管治：</p>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            ${Object.values(OCCUPATION_LAWS).map(law => `
              <label style="display: flex; align-items: flex-start; gap: 8px; font-size: 12px; cursor: pointer; background: #2a1818; padding: 6px; border-radius: 3px; border: 1px solid ${playerNat.occupationLaw === law.id ? '#ff6666' : '#442222'};">
                <input type="radio" name="occ-law" value="${law.id}" ${playerNat.occupationLaw === law.id ? 'checked' : ''} style="margin-top: 2px;">
                <div>
                  <strong>${law.name}</strong> (目标抵抗度: ${law.resistanceTarget}%)
                  <div style="font-size: 11px; color: #aaa;">民工产出: ${(law.factoryYield*100)}% · 资源提取: ${(law.resourceYield*100)}%</div>
                  <div style="font-size: 11px; color: #888;">${law.desc}</div>
                </div>
              </label>
            `).join('')}
          </div>
        </div>

        <div style="background: rgba(0,0,0,0.3); padding: 12px; border-radius: 4px; border: 1px solid #4a2222;">
          <h4 style="margin: 0 0 8px 0; color: #66ccff;">🎖️ 战区指挥部 (Theaters) 与阵营</h4>
          <div style="font-size: 12px; margin-bottom: 8px;">
            所属同盟阵营: <strong style="color: #ffcc00;">${playerNat.faction ? playerNat.faction.toUpperCase() : '中立/独立'}</strong>
          </div>
          <div style="background: #1e1111; padding: 8px; border-radius: 3px; margin-bottom: 8px; font-size: 12px;">
            <div><strong>当前战区编成:</strong></div>
            <div style="color: #aaa; margin-top: 4px;">• 欧洲主陆战区 (集团军司令部由主力元帅直辖，全线进攻 +12.5%, 计划加速 +25%)</div>
            <div style="color: #aaa;">• 大西洋潜艇特遣舰队 (实施破交与运输遮断)</div>
          </div>
          <div style="font-size: 11px; color: #999;">
            * 提示：委任具有“装甲专家”或“攻坚工程”特质的将领至战区，全战区所属师团均可获得统帅属性辐射加成。
          </div>
        </div>
      </div>
    `;

    setTimeout(() => {
      container.querySelectorAll('input[name="occ-law"]').forEach(r => {
        r.onchange = () => {
          setOccupationLaw(world, world.player, r.value);
          toast(`已切换占领治理法案为: ${r.value}`);
        };
      });
    }, 10);

  } else if(era === 'coldwar'){
    const defcon = getDefcon(world);
    const space = getSpaceProgress(world, world.player);
    container.innerHTML = `
      <div style="border-bottom: 2px solid #22445a; padding-bottom: 8px; margin-bottom: 12px;">
        <h3 style="margin: 0; color: #88ccff;">☢️ 冷战 DEFCON 戒备、末日钟与太空争霸 (1949)</h3>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div style="background: rgba(0,0,0,0.3); padding: 12px; border-radius: 4px; border: 1px solid #1a3a4a;">
          <h4 style="margin: 0 0 8px 0; color: #ff5555;">🚨 战略战备阶梯 (DEFCON) 与末日钟</h4>
          <div style="display: flex; gap: 4px; margin-bottom: 10px;">
            ${[5, 4, 3, 2, 1].map(lvl => `
              <div style="flex: 1; padding: 8px 2px; text-align: center; border-radius: 3px; font-size: 11px; font-weight: bold; background: ${defcon === lvl ? (lvl === 1 ? '#ff0000' : (lvl === 2 ? '#ff6600' : '#ffcc00')) : '#222'}; color: ${defcon === lvl ? '#000' : '#777'};">
                DEFCON ${lvl}
              </div>
            `).join('')}
          </div>
          <div style="font-size: 12px; color: #ccc; margin-bottom: 6px;">
            当前戒备状态: <strong style="color: #ff9999;">${DEFCON_LEVELS[defcon].name} - ${DEFCON_LEVELS[defcon].title}</strong>
          </div>
          <div style="font-size: 12px; color: #ccc; margin-bottom: 6px;">
            末日钟读数: <strong style="color: #ff4444;">${(world.nuclear?.doomsdayClock || 7.0).toFixed(1)} 分钟至午夜</strong>
          </div>
          <div style="font-size: 11px; color: #888;">
            警告：美苏两大核大国直接正面交火将导致末日钟归零，直接进入 DEFCON 1 并触发全球核浩劫双输终局！
          </div>
        </div>

        <div style="background: rgba(0,0,0,0.3); padding: 12px; border-radius: 4px; border: 1px solid #1a3a4a;">
          <h4 style="margin: 0 0 8px 0; color: #ffff66;">🚀 太空竞赛 7 大历史里程碑</h4>
          <div style="font-size: 12px; margin-bottom: 6px;">
            已达成成就: <strong>${space.completedCount} / 7</strong> · 累积科技声望: <strong style="color: #ffcc00;">${space.prestige}</strong>
          </div>
          <div style="display: flex; flex-direction: column; gap: 4px; max-height: 160px; overflow-y: auto;">
            ${SPACE_MILESTONES.map((m, idx) => `
              <div style="font-size: 11px; padding: 4px 6px; background: ${idx < space.completedCount ? '#1a3322' : '#222'}; border-radius: 3px; display: flex; justify-content: space-between; align-items: center;">
                <span>${idx + 1}. ${m.name}</span>
                ${idx < space.completedCount ? '<span style="color: #44ff44;">✓ 完成</span>' : (idx === space.completedCount ? `<button class="btn-space-launch" data-id="${m.id}" style="padding: 2px 6px; font-size: 10px; cursor: pointer;">发射</button>` : '<span style="color: #666;">未解锁</span>')}
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    setTimeout(() => {
      container.querySelectorAll('.btn-space-launch').forEach(btn => {
        btn.onclick = () => {
          launchSpaceMission(world, world.player, btn.dataset.id);
          toast(`已立项并成功执行太空任务: ${btn.dataset.id}`);
        };
      });
    }, 10);

  } else if(era === 'modern'){
    container.innerHTML = `
      <div style="border-bottom: 2px solid #224433; padding-bottom: 8px; margin-bottom: 12px;">
        <h3 style="margin: 0; color: #88ffbb;">🛰️ 现代无人化、制裁网络与危机升级红线 (2022)</h3>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div style="background: rgba(0,0,0,0.3); padding: 12px; border-radius: 4px; border: 1px solid #1a3a2a;">
          <h4 style="margin: 0 0 8px 0; color: #66ffcc;">🕹️ FPV 巡飞弹打击与电子战</h4>
          <p style="font-size: 12px; color: #bbb;">无人机侦察使前线堑壕防护削减 50%，配合巡飞弹实施高精度斩首：</p>
          <div style="display: flex; gap: 8px; margin-bottom: 8px;">
            <button id="btn-fpv-strike" style="flex: 1; padding: 6px; background: #1a4a3a; border: 1px solid #2a7a5a; color: #fff; cursor: pointer; border-radius: 3px; font-size: 12px;">
              💥 组织 FPV 巡飞弹夜袭突击
            </button>
            <button id="btn-ew-deploy" style="flex: 1; padding: 6px; background: #2a3a4a; border: 1px solid #3a5a7a; color: #fff; cursor: pointer; border-radius: 3px; font-size: 12px;">
              📡 展开车载战术电子战 (EW) 屏障
            </button>
          </div>
          <div style="font-size: 11px; color: #aaa;">
            电子战强度达到 60% 时，将使敌方 50% 以上无人机信号受阻坠毁。
          </div>
        </div>

        <div style="background: rgba(0,0,0,0.3); padding: 12px; border-radius: 4px; border: 1px solid #1a3a2a;">
          <h4 style="margin: 0 0 8px 0; color: #ff9966;">📦 军援生命线与危机升级计量</h4>
          <div style="margin-bottom: 8px;">
            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 2px;">
              <span>战区危机升级度:</span>
              <strong style="color: ${world.milAid?.escalationGauge >= 80 ? '#ff3333' : '#ffaa33'};">${world.milAid?.escalationGauge || 20}%</strong>
            </div>
            <div style="background: #222; height: 8px; border-radius: 4px; overflow: hidden;">
              <div style="background: ${world.milAid?.escalationGauge >= 80 ? '#cc2222' : '#ff9900'}; width: ${world.milAid?.escalationGauge || 20}%; height: 100%;"></div>
            </div>
          </div>
          <div style="font-size: 11px; color: #999; margin-bottom: 8px;">
            北溪管线状态: <strong style="color: ${getPipelineStatus(world, 'nord_stream') === 'severed' ? '#ff4444' : '#44ff44'};">${getPipelineStatus(world, 'nord_stream').toUpperCase()}</strong>
          </div>
          <div style="font-size: 11px; color: #aaa;">
            交涉与和谈：当双方战争疲劳均 ≥ 70% 时，将自动触发伊斯坦布尔和平谈判停火草案。
          </div>
        </div>
      </div>
    `;

    setTimeout(() => {
      const strikeBtn = container.querySelector('#btn-fpv-strike');
      if(strikeBtn){
        strikeBtn.onclick = () => {
          const res = launchFpvStrike(world, world.player, 0, 20);
          toast(`已实施 FPV 突袭！命中率 ${(res.hitRate*100).toFixed(0)}%，造成软杀伤 ${res.damageSoft}`);
        };
      }
      const ewBtn = container.querySelector('#btn-ew-deploy');
      if(ewBtn){
        ewBtn.onclick = () => {
          deployElectronicWarfare(world, world.player, 0.65);
          toast('已部署 65% 强度战术电子战全频段电磁干扰！');
        };
      }
    }, 10);
  }

  return container;
}
