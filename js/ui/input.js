/* ============================================================
   ui/input.js —— 战术微操与作战指挥输入系统 (v7.0 钢四深度操作版)
   左键单击选格/部队 · Shift+左键多格多部队增量选择 · 鼠标框选多师
   右键机动开进/协同突击 · 点击战斗气泡查看战地战术视窗
   [H] 急停挖壕 · [S] 选一半 · [A] 全选部队 · [Z/X/C/V] 作战计划 · [Tab] 切换军团
   ============================================================ */

import { hexDist, findProvinceAt } from '../core/geom.js';
import { K } from '../data/constants.js';
import { sound } from '../core/audio.js';
import { showToast, openBattleModal, renderCommandQueue } from './panels.js';
import { createFront, assignToFront, createOffensiveArrow, createFallbackLine, bendArrow, reshapeArrow, getOrCreateArmy, pickOffensiveTarget } from '../engine/plans.js';
import { checkCombatWidth } from '../engine/battle.js';
import { onHexClickEra } from './eraHud.js';

/* v8.0 M4：命令队列（右侧可取消） */
export function pushCommand(store, ui, kind, unitIds){
  ui.commandQueue = ui.commandQueue || [];
  const names = { '进攻':'⚔️', '推进':'➡️', '支援攻击':'🛡️', '路径点':'📍', '移动':'➡️' };
  ui.commandQueue.unshift({
    id: 'cmd' + Date.now() + Math.random().toString(36).slice(2, 6),
    kind, unitIds: [...unitIds], day: store.world.day,
    text: (names[kind] || '·') + ' ' + kind + ' × ' + unitIds.length + ' 师'
  });
  if(ui.commandQueue.length > 5) ui.commandQueue.pop();
  renderCommandQueue(ui);
}

/* 取消一条命令：清除队列中这些师的命令 */
export function cancelCommand(store, ui, cmdId){
  const idx = (ui.commandQueue || []).findIndex(c => c.id === cmdId);
  if(idx < 0) return;
  const cmd = ui.commandQueue[idx];
  for(const uid of cmd.unitIds){
    store.dispatch({ type:'CANCEL_ORDER', unitId: uid });
  }
  ui.commandQueue.splice(idx, 1);
  showToast('已撤销：' + cmd.text);
  ui.onSelect();
}

export function bindInput(canvas, store, cam, ui){
  canvas.style.cursor = 'grab';

  let dragging = false;
  let dragButton = -1;
  let moved = false;
  let dragStart = { x: 0, y: 0 };
  let lastPos = { x: 0, y: 0 };
  let isBoxSelecting = false;
  let lastHoverHex = null;
  let isSpaceDown = false;
  let spacePanMoved = false;
  let altPath = [];
  let altDrawing = false;

  // 物理惯性平滑滑行系统 (Physics Momentum)
  let velocitySamples = [];
  let momentumAnimId = null;

  function stopMomentum(){
    if(momentumAnimId != null){
      cancelAnimationFrame(momentumAnimId);
      momentumAnimId = null;
    }
  }

  function startMomentum(){
    stopMomentum();
    const now = performance.now();
    const recent = velocitySamples.filter(s => (now - s.t) <= 120);
    if(recent.length < 2) return;

    let sumDx = 0, sumDy = 0, sumDt = 0;
    for(const s of recent){
      sumDx += s.dx;
      sumDy += s.dy;
      sumDt += s.dt;
    }
    if(sumDt <= 0) return;

    // 换算成每 16.6ms 帧位移
    let vx = (sumDx / sumDt) * 16.6;
    let vy = (sumDy / sumDt) * 16.6;
    const spd = Math.hypot(vx, vy);
    if(spd < 1.0) return;

    // 限制初速度
    if(spd > 50){
      vx = (vx / spd) * 50;
      vy = (vy / spd) * 50;
    }

    function glide(){
      cam.x += vx;
      cam.y += vy;
      vx *= 0.90; // 0.90 摩擦阻尼
      vy *= 0.90;
      ui.invalidate();

      if(Math.hypot(vx, vy) >= 0.25){
        momentumAnimId = requestAnimationFrame(glide);
      } else {
        stopMomentum();
      }
    }
    momentumAnimId = requestAnimationFrame(glide);
  }

  canvas.addEventListener('mousedown', e => {
    stopMomentum();

    const rect = canvas.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    dragging = true;
    dragButton = e.button;
    moved = false;
    dragStart = { x: e.clientX, y: e.clientY };
    lastPos = { x: e.clientX, y: e.clientY };
    velocitySamples = [{ dx: 0, dy: 0, dt: 16, t: performance.now() }];

    // 0. Alt+右键：绘制/编辑进攻箭头轴线
    if(e.button === 2 && e.altKey){
      const h = findProvinceAt(store.world, cam, offsetX, offsetY);
      const hx = store.world.at[h.q + ',' + h.r];
      altDrawing = true;
      altPath = hx ? [hx.idx] : [];
      e.preventDefault();
      return;
    }

    // 1. Shift+左键拖拽：进入战术框选多师模式
    if(e.button === 0 && e.shiftKey){
      isBoxSelecting = true;
      ui.boxSelect = { active: true, x0: offsetX, y0: offsetY, x1: offsetX, y1: offsetY };
      return;
    }

    // 2. 左键 / 中键 / 右键 / 空格键：统一进入平滑地图拖拽
    isBoxSelecting = false;
    ui.boxSelect = null;
    canvas.style.cursor = 'grabbing';
    if(e.button === 1) e.preventDefault();
  });

  window.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    // 处于 canvas 内部时更新悬停格
    if(offsetX >= 0 && offsetX <= canvas.clientWidth && offsetY >= 0 && offsetY <= canvas.clientHeight){
      const curHex = findProvinceAt(store.world, cam, offsetX, offsetY);
      ui.hover = { q: curHex.q, r: curHex.r };
      if(!lastHoverHex || lastHoverHex.q !== curHex.q || lastHoverHex.r !== curHex.r){
        lastHoverHex = curHex;
      }
    }

    // Alt+右键绘制箭头
    if(altDrawing){
      const curHex = findProvinceAt(store.world, cam, offsetX, offsetY);
      const hx = store.world.at[curHex.q + ',' + curHex.r];
      if(hx && altPath[altPath.length - 1] !== hx.idx) altPath.push(hx.idx);
      return;
    }

    if(!dragging){
      if(!isSpaceDown && canvas.style.cursor !== 'grab'){
        canvas.style.cursor = 'grab';
      }
      return;
    }

    const dist = Math.hypot(e.clientX - dragStart.x, e.clientY - dragStart.y);
    if(dist > 3){
      moved = true;
      if(isSpaceDown) spacePanMoved = true;
    }

    const dx = e.clientX - lastPos.x;
    const dy = e.clientY - lastPos.y;
    const now = performance.now();
    const dt = Math.max(1, now - (velocitySamples[velocitySamples.length - 1]?.t || now - 16));

    lastPos = { x: e.clientX, y: e.clientY };
    velocitySamples.push({ dx, dy, dt, t: now });
    if(velocitySamples.length > 8) velocitySamples.shift();

    if(isBoxSelecting){
      const startX = dragStart.x - rect.left;
      const startY = dragStart.y - rect.top;
      ui.boxSelect = {
        active: true,
        x0: startX,
        y0: startY,
        x1: offsetX,
        y1: offsetY
      };
      ui.invalidate();
    } else if(moved){
      // 1:1 响应屏幕像素位移，零迟滞
      cam.x += dx;
      cam.y += dy;
      canvas.style.cursor = 'grabbing';
      ui.invalidate();
    }
  });

  window.addEventListener('mouseup', e => {
    if(!dragging && !altDrawing) return;

    canvas.style.cursor = 'grab';
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const wasMoved = moved;
    const wasButton = dragButton;
    const wasBoxSelecting = isBoxSelecting;

    dragging = false;
    dragButton = -1;
    isBoxSelecting = false;

    // A. 框选部队结算（Shift+左键且发生有效拖拽）
    if(wasBoxSelecting && wasMoved && ui.boxSelect && ui.boxSelect.active){
      const minX = Math.min(ui.boxSelect.x0, ui.boxSelect.x1);
      const maxX = Math.max(ui.boxSelect.x0, ui.boxSelect.x1);
      const minY = Math.min(ui.boxSelect.y0, ui.boxSelect.y1);
      const maxY = Math.max(ui.boxSelect.y0, ui.boxSelect.y1);

      const capturedUnits = [];
      for(const u of store.world.units){
        if(u.nat === store.world.player && u.hp > 0){
          const p = cam.toPix(u.q, u.r);
          if(p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY){
            capturedUnits.push(u.id);
          }
        }
      }

      ui.boxSelect = null;
      if(capturedUnits.length > 0){
        ui.selUnits = [...new Set(capturedUnits)];
        const topU = store.world.units.find(x => x.id === ui.selUnits[0]);
        if(topU) ui.selHex = { q: topU.q, r: topU.r };
        sound.playClick();
        showToast(`🎯 战术框选：已选中战区 ${ui.selUnits.length} 个师团！`);
        ui.onSelect();
      }
      ui.invalidate();
      return;
    }
    ui.boxSelect = null;

    // B. 若发生了拖拽移动，启动物理惯性滑行，并终止点击响应
    if(wasMoved){
      startMomentum();
      ui.invalidate();
      return;
    }

    // C. 仅在 canvas 内部且未移动时，判定为精准单击
    if(clickX < 0 || clickX > canvas.clientWidth || clickY < 0 || clickY > canvas.clientHeight) return;

    if(wasButton === 0){
      handleLeftClick(clickX, clickY, e);
    }
  });

  window.addEventListener('blur', () => {
    dragging = false;
    dragButton = -1;
    isBoxSelecting = false;
    stopMomentum();
    canvas.style.cursor = 'grab';
  });

  function handleLeftClick(clickX, clickY, e){
    // v8.0 M4：[Alt+左键] 弯曲进攻箭头 —— 将该格插入箭头轴线
    if(e.altKey){
      const h = findProvinceAt(store.world, cam, clickX, clickY);
      const hx = store.world.at[h.q + ',' + h.r];
      if(hx){
        sound.playClick();
        const r = bendArrow(store.world, hx.idx);
        showToast(r.msg);
        ui.invalidate();
      }
      return;
    }

    // 2. 检测是否点击了活动战斗气泡
    const activeBubbles = (ui.layers && ui.layers.activeBubbles) || [];
    for(const b of activeBubbles){
      const dist = Math.hypot(clickX - b.x, clickY - b.y);
      if(dist <= b.r + 8){
        openBattleModal(store, b.hexIdx);
        return;
      }
    }

    // 3. 正常不规则历史行省点击与选择 (v11.0 M4)
    const hex = findProvinceAt(store.world, cam, clickX, clickY);
    const h = store.world.at[hex.q + ',' + hex.r];
    if(!h) return;

    const friendlyInHex = (h.units || []).map(id => store.world.units.find(x => x.id === id))
      .filter(u => u && u.nat === store.world.player && u.hp > 0).map(u => u.id);

    if(e.shiftKey){
      // Shift+左键：多格增量选中
      if(friendlyInHex.length > 0){
        const allAlreadySelected = friendlyInHex.every(id => ui.selUnits.includes(id));
        if(allAlreadySelected){
          ui.selUnits = ui.selUnits.filter(id => !friendlyInHex.includes(id));
        } else {
          ui.selUnits = [...new Set([...ui.selUnits, ...friendlyInHex])];
        }
        ui.selHex = { q: h.q, r: h.r };
        sound.playClick();
        showToast(`🎖️ 当前多选部队：${ui.selUnits.length} 师`);
      }
    } else {
      // 普通单点选择
      if(ui.selHex && ui.selHex.q === hex.q && ui.selHex.r === hex.r){
        ui.selHex = null;
        ui.selUnits = [];
      } else {
        // v8.0 M6：冷/现代点击他国格 → 打开专属外交面板（影响力投放 / 军援管道）
        if(!e.shiftKey && !(ui.selUnits && ui.selUnits.length) &&
           h.owner !== store.world.player && store.world.nations[h.owner]){
          if(onHexClickEra(store.world, h, ui)) return;
        }
        ui.selHex = { q: h.q, r: h.r };
        ui.selUnits = friendlyInHex;
        if(friendlyInHex.length > 0) sound.playClick();
      }
    }
    ui.onSelect();
  }

  // §5.1：左键双击部队/地块
  canvas.addEventListener('dblclick', e => {
    const rect = canvas.getBoundingClientRect();
    const hex = findProvinceAt(store.world, cam, e.clientX - rect.left, e.clientY - rect.top);
    const h = store.world.at[hex.q + ',' + hex.r];
    if(!h) return;
    const w = store.world;
    const clicked = (h.units || []).map(id => w.units.find(x => x.id === id))
      .filter(x => x && x.nat === w.player && x.hp > 0);
    if(!clicked.length) return;

    if(e.ctrlKey){
      // Ctrl+双击：选中全图同类编制
      const proto = clicked[0].template || clicked[0].type;
      const sameTpl = w.units.filter(x => x.nat === w.player && x.hp > 0 &&
        (x.template || x.type) === proto).map(x => x.id);
      ui.selUnits = sameTpl;
      ui.selHex = { q: clicked[0].q, r: clicked[0].r };
      sound.playClick();
      showToast(`🖱️ [Ctrl+双击] 已选中全图同类部队：${sameTpl.length} 个师（编制 ${proto}）`);
    } else {
      // 双击地块：全选当前要冲驻扎的全部己方部队
      ui.selUnits = clicked.map(x => x.id);
      ui.selHex = { q: clicked[0].q, r: clicked[0].r };
      sound.playClick();
      showToast(`🖱️ 已全选要冲驻扎部队：${clicked.length} 个师（${h.city ? h.city.name : '该省份'}）`);
    }
    ui.onSelect();
  });

  // 右键：向所选部队下达移动/进攻战术指令
  canvas.addEventListener('contextmenu', e => {
    e.preventDefault();

    // 若刚才进行了鼠标拖拽平移，则直接吞掉本次右键菜单/指令，绝不误发战术命令
    if(moved){
      return;
    }

    // v8.0 M4：[Alt+右键拖] 编辑箭头线形 —— 不触发任何部队命令
    if(altDrawing){
      const path = altPath.slice();
      altDrawing = false;
      altPath = [];
      if(path.length >= 2){
        sound.playClick();
        const r = reshapeArrow(store.world, path);
        showToast(r.msg + (r.ok ? '' : ''));
        ui.invalidate();
      } else {
        showToast('⚠️ 线形编辑需拖拽经过至少 2 格');
      }
      return;
    }

    const rect = canvas.getBoundingClientRect();
    handleRightClick(e.clientX - rect.left, e.clientY - rect.top, e);
  });

  function handleRightClick(clickX, clickY, e){
    const hex = findProvinceAt(store.world, cam, clickX, clickY);
    const h = store.world.at[hex.q + ',' + hex.r];
    if(!h || !ui.selUnits.length) return;

    let orderedCount = 0;
    const isFriendly = (h.owner === store.world.player);
    const isEnemy = ((store.world.nations[store.world.player]?.atWarWith || []).includes(h.owner));
    const isWaypoint = !!e.shiftKey;     // v8.0 M4：Shift+右键 = 追加路径点
    const isSupport  = !!e.ctrlKey;      // v8.0 M4：Ctrl+右键 = 原地支援攻击
    const distToTarget = (u) => hexDist(u.q, u.r, hex.q, hex.r);

    for(const uid of ui.selUnits){
      const u = store.world.units.find(x => x.id === uid);
      if(!u || u.nat !== store.world.player) continue;

      // 手操惩罚 C15
      if(u.armyId && u.inPlan){
        store.dispatch({ type: 'MANUAL_PENALTY', armyId: u.armyId, unitId: u.id });
      }

      // 支援攻击：不相邻则提示非法
      if(isSupport){
        if(isEnemy && distToTarget(u) === 1){
          store.dispatch({ type:'SUPPORT', unitId: uid, q: hex.q, r: hex.r });
          pushCommand(store, ui, '支援攻击', [uid]);
          orderedCount++;
        }else if(isEnemy){
          showToast('⚠️ 支援攻击需要相邻：该师距目标 ' + distToTarget(u) + ' 格，请先推进');
        }
        continue;
      }
      // 路径点：追加到队列尾部（不打断当前命令）
      if(isWaypoint){
        store.dispatch({ type:'WAYPOINT', unitId: uid, q: hex.q, r: hex.r });
        pushCommand(store, ui, '路径点', [uid]);
        orderedCount++;
        continue;
      }

      const d = hexDist(u.q, u.r, hex.q, hex.r);
      if(isFriendly){
        if(d > 0){
          store.dispatch({ type: 'ADVANCE', unitId: uid, q: hex.q, r: hex.r });
          pushCommand(store, ui, '移动', [uid]);
          orderedCount++;
        }
      } else if(isEnemy){
        // 近处直接发起合围突击，远处沿最短路径急行军逼近
        store.dispatch({ type: d === 1 ? 'ATTACK' : 'ADVANCE', unitId: uid, q: hex.q, r: hex.r });
        pushCommand(store, ui, d === 1 ? '进攻' : '推进', [uid]);
        orderedCount++;
      }
    }

    if(orderedCount > 0){
      if(isEnemy){
        sound.playAttack();
        showToast(`⚔️ 突击命令：${orderedCount} 支主力师已向目标发起协同进攻！`);
      } else {
        sound.playClick();
        showToast(`➡️ 行军命令：${orderedCount} 支主力师正机动开赴目标要冲`);
      }
    }

    // §5.3：进攻无战宽余量 → 兵牌抖动 + toast 说明原因
    if(isEnemy && orderedCount > 0){
      const capped = checkCombatWidth(store.world, hex.q, hex.r);
      if(capped.full){
        ui.shakeHex = { q: hex.q, r: hex.r, until: Date.now() + 1500 };
        showToast(`⚠️ 该格战斗宽度已满（上限 ${capped.width}，已投入 ${capped.used} 宽），${capped.waiting} 个师待命中`, 3200);
      }
    }
    ui.onSelect();
  }

  // 平滑对数滚轮缩放 (以鼠标光标所在经纬为锚点)
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    stopMomentum();
    const rect = canvas.getBoundingClientRect();
    const zoomFactor = Math.exp(-e.deltaY * 0.0016);
    const clampedFactor = Math.max(0.78, Math.min(1.28, zoomFactor));
    cam.zoomAt(e.clientX - rect.left, e.clientY - rect.top, clampedFactor);
    ui.invalidate();
  }, { passive: false });

  // 键盘快捷键松开处理 (用于 Space 平移/暂停解耦)
  document.addEventListener('keyup', e => {
    const tgt = e.target;
    if(tgt && typeof tgt.closest === 'function' && tgt.closest('input, textarea')) return;
    if(e.code === 'Space'){
      if(!spacePanMoved){
        store.dispatch({ type: 'SET_SPEED', payload: 'toggle' });
        sound.playClick();
      }
      isSpaceDown = false;
      spacePanMoved = false;
      canvas.style.cursor = '';
    }
  });

  // 键盘快捷键体系
  document.addEventListener('keydown', e => {
    // 忽略在输入框中的按键（合成事件的目标可能不是元素，需先做类型守卫）
    const tgt = e.target;
    if(tgt && typeof tgt.closest === 'function' && tgt.closest('input, textarea')) return;

    if(e.code === 'Space'){
      e.preventDefault();
      if(!e.repeat){
        isSpaceDown = true;
        spacePanMoved = false;
        canvas.style.cursor = 'grab';
      }
      return;
    }

    // 加速与减速快捷键 (+ / -)；上界随 DAY_MS 档位数走，避免写死 3 档
    if(e.key === '=' || e.key === '+'){
      e.preventDefault();
      const maxSpd = K.DAY_MS.length - 1;
      const spd = Math.min(maxSpd, (store.world.speed || 1) + 1);
      store.dispatch({ type: 'SET_SPEED', payload: spd });
      sound.playClick();
      return;
    }
    if(e.key === '-' || e.key === '_'){
      e.preventDefault();
      const spd = Math.max(1, (store.world.speed || 1) - 1);
      store.dispatch({ type: 'SET_SPEED', payload: spd });
      sound.playClick();
      return;
    }

    // 基础速度档位（若未绑定控制编组则调节速度）
    if(e.key === '1' && !(ui.controlGroups && ui.controlGroups['1']?.length)) store.dispatch({ type: 'SET_SPEED', payload: 1 });
    if(e.key === '2' && !(ui.controlGroups && ui.controlGroups['2']?.length)) store.dispatch({ type: 'SET_SPEED', payload: 2 });
    if(e.key === '3' && !(ui.controlGroups && ui.controlGroups['3']?.length)) store.dispatch({ type: 'SET_SPEED', payload: 3 });
    if(e.key === '4' && !(ui.controlGroups && ui.controlGroups['4']?.length)) store.dispatch({ type: 'SET_SPEED', payload: 4 });

    // [H] 急停就地构筑堑壕 (Halt)
    if(e.key === 'h' || e.key === 'H'){
      if(ui.selUnits && ui.selUnits.length){
        for(const uid of ui.selUnits){
          const u = store.world.units.find(x => x.id === uid);
          if(u && u.nat === store.world.player) u.order = null;
        }
        sound.playClick();
        showToast(`🛑 所选 ${ui.selUnits.length} 师已急停，原地构筑掩体堑壕防守`);
        ui.onSelect();
      }
    }

    // [S] 选一半：在已选师团中保留一半（HOI4 "select half"）
    if(e.key === 's' || e.key === 'S'){
      if(e.ctrlKey || e.metaKey) return;      // 不干扰 Ctrl+S 等浏览器组合键
      if(ui.selUnits && ui.selUnits.length > 1){
        const half = Math.ceil(ui.selUnits.length / 2);
        ui.selUnits = ui.selUnits.slice(0, half);
        sound.playClick();
        showToast(`✂️ 已选一半：保留 ${ui.selUnits.length} 个师`);
        ui.onSelect();
      } else if(ui.selUnits && ui.selUnits.length === 1){
        showToast('⚠️ 只选中 1 个师，无法再选一半；请先框选或按 [A] 全选');
      } else {
        showToast('⚠️ 尚未选中任何师团，请先左键点选或框选部队');
      }
    }

    // [A] 快速全选当前全国主力部队 (Select All)
    if(e.key === 'a' || e.key === 'A'){
      const allPlayerUnits = store.world.units.filter(u => u.nat === store.world.player && u.hp > 0).map(u => u.id);
      if(allPlayerUnits.length){
        ui.selUnits = allPlayerUnits;
        sound.playClick();
        showToast(`🚩 统帅动员：已全选全国主力部队 (共 ${ui.selUnits.length} 师)`);
        ui.onSelect();
      }
    }

    // [Z] 沿边境一键划设前线 (Frontline)
    if(e.key === 'z' || e.key === 'Z'){
      sound.playClick();
      const f = createFront(store.world, store.world.player);
      assignToFront(store.world, f.id);
      showToast('★ 统帅部前线已沿边境划设，全师展开填线！');
      ui.invalidate();
    }

    // [X] 划设攻势线 (Offensive Line) / [Shift+X] 标定进攻矛头 (Spearhead)
    // v12.0 S1：选靶统一走 engine/plans.pickOffensiveTarget（C44 玩家视角基准）
    if(e.key === 'x' || e.key === 'X'){
      sound.playClick();
      const w = store.world;
      const isSpearhead = !!e.shiftKey;
      const picked = pickOffensiveTarget(w, isSpearhead ? 'spearhead' : 'offensive');
      if(!picked){
        showToast('⚠️ 当前无处于交战状态的敌国目标，无法标定进攻轴线');
        return;
      }
      const { target, theater } = picked;
      const targetName = target.city ? target.city.name : '敌军纵深';
      const f = (w.fronts && w.fronts.find(x => x.nat === w.player)) || createFront(w, w.player);
      createOffensiveArrow(w, f.id, [target.idx], null, isSpearhead ? 'spearhead' : 'offensive');
      showToast(isSpearhead
        ? `🔻 进攻矛头已标定：全师沿单轴直插 ${targetName}（${theater} · 窄正面强突破）`
        : `🎯 攻势线已标定：宽正面逐层推进至 ${targetName}（${theater}）`);
      ui.invalidate();
    }

    // [C] 退守备用防线 (Fallback)
    if(e.key === 'c' || e.key === 'C'){
      sound.playClick();
      const w = store.world;
      const playerHexes = w.hexes.filter(h => h.owner === w.player).map(h => h.idx).slice(0, 5);
      createFallbackLine(w, w.player, playerHexes);
      showToast('🛡️ 纵深备用退守防线已勘定！');
      ui.invalidate();
    }

    // [V] 填线均势对齐 (Align / Fill)
    if(e.key === 'v' || e.key === 'V'){
      sound.playClick();
      const w = store.world;
      const f = (w.fronts || []).find(x => x.nat === w.player);
      if(f){
        assignToFront(w, f.id);
        showToast('⚔️ 前线各师团均势对齐完毕！');
      } else {
        const newF = createFront(w, w.player);
        assignToFront(w, newF.id);
        showToast('⚔️ 自动建立防线并完成全军填线！');
      }
      ui.invalidate();
    }

    // [B] 战略调动切换（×1.8 速度，不可战斗）
    if(e.key === 'b' || e.key === 'B'){
      if(ui.selUnits && ui.selUnits.length){
        let on = 0;
        for(const uid of ui.selUnits){
          const u = store.world.units.find(x => x.id === uid);
          if(!u || u.nat !== store.world.player) continue;
          store.dispatch({ type:'STRATEGIC', unitId: uid });
          if(u.strategic) on++;
        }
        sound.playClick();
        showToast(on ? `🚂 战略调动：${on} 师已切换铁路/公路机动（速度 ×1.8，不可战斗）` : '🚂 已取消战略调动');
        ui.onSelect();
      }
    }

    // [Ctrl+H] 移出当前作战计划
    if((e.key === 'h' || e.key === 'H') && e.ctrlKey){
      if(ui.selUnits && ui.selUnits.length){
        let n = 0;
        for(const uid of ui.selUnits){
          const u = store.world.units.find(x => x.id === uid);
          if(u && u.armyId){ store.dispatch({ type:'DETACH', unitId: uid }); n++; }
        }
        sound.playClick();
        showToast(n ? `已从作战计划移出 ${n} 个师（计划加成将下降）` : '所选部队不在任何作战计划中');
        ui.onSelect();
      }
      e.preventDefault();
      return;
    }

    // [Del] 删除所选部队命令（Shift+Del 清空全部）
    if(e.key === 'Delete' || e.key === 'del'){
      if(ui.selUnits && ui.selUnits.length){
        for(const uid of ui.selUnits) store.dispatch({ type:'CANCEL_ORDER', unitId: uid });
        if(e.shiftKey) store.world.units.filter(u => u.nat === store.world.player).forEach(u => { u.order = null; u.waypoints = []; });
        ui.commandQueue = [];
        sound.playClick();
        showToast('已删除命令' + (e.shiftKey ? '（全军）' : `（${ui.selUnits.length} 师）`));
        ui.onSelect();
      }
      e.preventDefault();
      return;
    }

    // [Tab] 切换军团编成：循环选中各野战军的全部师团
    if(e.key === 'Tab'){
      e.preventDefault();
      const w = store.world;
      w.armies = w.armies || [];
      let mine = w.armies.filter(a => a.nat === w.player);

      // 尚无编成时按现有兵力自动编成两支野战军
      if(!mine.length){
        const divs = w.units.filter(x => x.nat === w.player && x.hp > 0);
        if(!divs.length){ showToast('⚠️ 当前没有可编成的师团'); return; }
        const mid = Math.ceil(divs.length / 2);
        const a1 = getOrCreateArmy(w, 'army_' + w.player + '_1', w.player, '第1野战军');
        const a2 = getOrCreateArmy(w, 'army_' + w.player + '_2', w.player, '第2野战军');
        a1.divisions = divs.slice(0, mid).map(x => x.id);
        a2.divisions = divs.slice(mid).map(x => x.id);
        mine = [a1, a2];
      }

      ui.armyCycle = ((ui.armyCycle ?? -1) + 1) % mine.length;
      const army = mine[ui.armyCycle];
      const ids = (army.divisions || []).filter(id => {
        const x = w.units.find(y => y.id === id); return x && x.hp > 0;
      });
      ui.selUnits = ids;
      if(ids.length){
        const top = w.units.find(y => y.id === ids[0]);
        if(top) ui.selHex = { q: top.q, r: top.r };
      }
      sound.playClick();
      showToast(`🎖️ 已切换至 ${army.name || army.id}：选中 ${ids.length} 个师（共 ${mine.length} 支野战军）`);
      ui.onSelect();
    }

    // [Ctrl+1..9] 绑定控制编组 / [1..9] 选定编组（双按居中） [H]
    const numMatch = e.code && e.code.match(/^(?:Digit|Numpad)([1-9])$/);
    if(numMatch){
      const gNum = numMatch[1];
      ui.controlGroups = ui.controlGroups || {};
      if(e.ctrlKey){
        e.preventDefault();
        if(ui.selUnits && ui.selUnits.length){
          ui.controlGroups[gNum] = [...ui.selUnits];
          sound.playClick();
          showToast(`🚩 战术编组已绑定：第 [${gNum}] 特遣队 (${ui.selUnits.length} 师)`);
        } else {
          delete ui.controlGroups[gNum];
          showToast(`🚩 已清空第 [${gNum}] 特遣队编组`);
        }
        return;
      } else if(!e.altKey && !e.shiftKey && !e.metaKey){
        const grp = ui.controlGroups[gNum];
        if(grp && grp.length){
          const validIds = grp.filter(id => {
            const u = store.world.units.find(x => x.id === id);
            return u && u.hp > 0 && u.nat === store.world.player;
          });
          if(validIds.length){
            e.preventDefault();
            const now = Date.now();
            const isDoubleTap = (ui._lastNumTapKey === gNum && (now - (ui._lastNumTapTime || 0)) < 500);
            ui._lastNumTapKey = gNum;
            ui._lastNumTapTime = now;

            ui.selUnits = validIds;
            const leadUnit = store.world.units.find(x => x.id === validIds[0]);
            if(leadUnit){
              ui.selHex = { q: leadUnit.q, r: leadUnit.r };
              if(isDoubleTap){
                // 双按居中镜头 [H]
                const p = cam.toPix(leadUnit.q, leadUnit.r);
                const cv = document.getElementById('sfmap');
                if(cv){
                  cam.x = cv.clientWidth / 2 - p.x;
                  cam.y = cv.clientHeight / 2 - p.y;
                }
                showToast(`🎯 镜头已居中对准第 [${gNum}] 特遣队旗舰师`);
              } else {
                showToast(`🎖️ 已选中第 [${gNum}] 特遣队 (${validIds.length} 师，再按一次居中镜头)`);
              }
            }
            sound.playClick();
            ui.onSelect();
            ui.invalidate();
            return;
          }
        }
      }
    }

    // [K] 演习训练一轮 / [Shift+K] 训练至满级 [H]
    if(e.key === 'k' || e.key === 'K'){
      if(ui.selUnits && ui.selUnits.length){
        let count = 0;
        const trainMax = !!e.shiftKey;
        for(const uid of ui.selUnits){
          const u = store.world.units.find(x => x.id === uid);
          if(!u || u.nat !== store.world.player) continue;
          u.training = true;
          u.trainMax = trainMax;
          count++;
        }
        sound.playClick();
        showToast(trainMax
          ? `🎖️ 持续演训：${count} 个师已进入长期强化训练（直至满经验）`
          : `🎖️ 战术演习：${count} 个师开始单轮实弹训练`);
        ui.onSelect();
        ui.invalidate();
      } else {
        showToast('⚠️ 请先点选需要训练的师团');
      }
    }

    // [N] 昼夜战术光影遮罩开关 [H]
    if(e.key === 'n' || e.key === 'N'){
      cam.dayNight = !cam.dayNight;
      sound.playClick();
      showToast(cam.dayNight ? '🌙 昼夜循环光影：开启' : '☀️ 昼夜循环光影：关闭');
      ui.invalidate();
    }

    // [,] 兵牌配色方案切换：国家色 vs 阵营色 [H]
    if(e.key === ','){
      ui.counterColorScheme = (ui.counterColorScheme === 'faction' ? 'nation' : 'faction');
      sound.playClick();
      showToast(ui.counterColorScheme === 'faction' ? '🎨 兵牌配色：阵营红蓝对抗色' : '🎨 兵牌配色：国家传统代表色');
      ui.invalidate();
    }

    // [Ctrl+F1] 全部战术地图模式快捷盘 [H]
    if(e.ctrlKey && (e.key === 'F1' || e.key === 'f1')){
      e.preventDefault();
      sound.playClick();
      showToast('🗺️ 地图模式导航：F1默认 / F2海权 / F3制空 / F4补给 / F5地形 / F6抵抗 / F7资源 / F8工业 / F9阵营 / F10天气 / F11战区 / F12战力');
    }
  });
}

