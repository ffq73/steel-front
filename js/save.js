/* ============================================================
   save.js —— 存档系统 v3（v3.0 §3.13 / §7）
   槽位规则：steelfront.v3.<scenario>.<slot>
   slot 0 = 自动存档（每7天/关键事件落盘）
   slot 1-3 = 手动存档槽
   支持多剧本、多槽位、命名、删除、JSON 导入与导出
   ============================================================ */

const V3_PREFIX = 'steelfront.v3';

/* ============================================================
   v10.1 审查修复：行省几何是「派生数据」，绝不入档。
   buildProvinces 会把 cell/polygon/共享边挂到 world 与 hex 上，
   其中 hex.cell ↔ cell.hex 成环 —— JSON.stringify 直接抛循环引用，
   导致 v10 之后所有存档静默失败（saveGame 的 try/catch 吞掉了异常）。
   规则：存档剥离，载入后由 layers 首帧 ensureWorldProvinces 重建。
   ============================================================ */
const SAVE_REPLACER = (key, value) => {
  if(key === 'provinces' || key === '_provinces') return undefined; // world 级派生
  if(key === 'cell') return undefined;                              // hex→cell 回环
  if(key === 'polygon' || key === 'neighborEdges' || key === 'centroid') return undefined; // hex 级派生几何
  return value;
};
function stripDerived(world){
  if(!world || typeof world !== 'object') return world;
  delete world.provinces;
  delete world._provinces;
  if(Array.isArray(world.hexes)){
    for(const h of world.hexes){ delete h.cell; delete h.polygon; delete h.neighborEdges; delete h.centroid; }
  }
  return world;
}
const V2_LEGACY_KEY = 'steelfront.save.v2';

export function getSaveKey(scenarioId, slot = 0){
  const sc = scenarioId || 'A';
  return `${V3_PREFIX}.${sc}.${slot}`;
}

export function saveGame(world, slot = 0, customName = ''){
  try {
    if(!world) return false;
    const sc = world.scenario || 'A';
    world.rngState = (world.rngState || 0) >>> 0;
    const key = getSaveKey(sc, slot);
    const saveObj = {
      version: 3,
      scenario: sc,
      slot,
      savedAt: Date.now(),
      saveName: customName || (slot === 0 ? '自动存档' : `存档槽位 ${slot}`),
      day: world.day,
      player: world.player,
      world
    };
    localStorage.setItem(key, JSON.stringify(saveObj, SAVE_REPLACER));
    // 同步保留一份 v2 键名以防旧代码只认 v2
    if(slot === 0 || slot === 1){
      localStorage.setItem(V2_LEGACY_KEY, JSON.stringify(world, SAVE_REPLACER));
    }
    return true;
  } catch(e) {
    console.error('存档失败:', e);
    return false;
  }
}

// 存档健全性校验：拦截旧版本损坏存档（如首都归属错乱/单位悬空）
function validateWorld(w){
  try{
    if(!w || !Array.isArray(w.hexes) || w.hexes.length < 100) return false;
    if(!w.nations || !w.player || !w.nations[w.player]) return false;
    const at = w.at || {};
    for(const u of (w.units || [])){
      if(!at[u.q + ',' + u.r]) return false;   // 单位站在不存在的格上 = 地图版本不匹配
    }
    // 开局 5 天内首都即不属于原归属 → 旧损坏存档
    const cap = w.hexes.find(h => h.city && h.city.cap);
    if(cap && (w.day || 0) < 5 && cap.owner !== cap.city.cap) return false;
    return true;
  }catch(e){ return false; }
}

export function loadGame(scenarioId = 'A', slot = null){
  try {
    // 若未指定 slot，按顺序优先尝试：slot 1 -> slot 0 -> v2 legacy
    if(slot === null){
      for(const s of [1, 2, 3, 0]){
        const k = getSaveKey(scenarioId, s);
        const raw = localStorage.getItem(k);
        if(raw){
          const parsed = JSON.parse(raw);
          const w = parsed && parsed.world;
          if(w && validateWorld(w)){ stripDerived(w); return w; }
        }
      }
      // 尝试 legacy v2 格式
      const legacyRaw = localStorage.getItem(V2_LEGACY_KEY);
      if(legacyRaw){
        const parsed = JSON.parse(legacyRaw);
        if(parsed && (parsed.version === 2 || parsed.version === 3) && validateWorld(parsed)){ stripDerived(parsed); return parsed; }
      }
      return null;
    }

    const key = getSaveKey(scenarioId, slot);
    const raw = localStorage.getItem(key);
    if(!raw) return null;
    const parsed = JSON.parse(raw);
    const w = parsed.world || parsed;
    return validateWorld(w) ? w : null;
  } catch(e) {
    console.error('读档失败:', e);
    return null;
  }
}

export function listSaves(scenarioId = 'A'){
  const list = [];
  try {
    for(let slot = 0; slot <= 3; slot++){
      const key = getSaveKey(scenarioId, slot);
      const raw = localStorage.getItem(key);
      if(raw){
        try {
          const item = JSON.parse(raw);
          list.push({
            slot,
            exists: true,
            saveName: item.saveName || (slot === 0 ? '自动存档' : `存档 ${slot}`),
            savedAt: item.savedAt || 0,
            day: item.day || (item.world ? item.world.day : 0),
            player: item.player || (item.world ? item.world.player : 'G')
          });
        } catch(err){
          list.push({ slot, exists: false, saveName: `损坏的存档 ${slot}` });
        }
      } else {
        list.push({
          slot,
          exists: false,
          saveName: slot === 0 ? '空自动档' : `空槽位 ${slot}`
        });
      }
    }
  } catch(e){}
  return list;
}

export function deleteSave(scenarioId = 'A', slot = 0){
  try {
    localStorage.removeItem(getSaveKey(scenarioId, slot));
    return true;
  } catch(e){
    return false;
  }
}

export function exportSaveJson(scenarioId = 'A', slot = 0){
  try {
    const raw = localStorage.getItem(getSaveKey(scenarioId, slot));
    if(!raw) return null;
    return raw;
  } catch(e){
    return null;
  }
}

export function importSaveJson(jsonString){
  try {
    const data = JSON.parse(jsonString);
    const world = data.world || data;
    if(!world || typeof world.day !== 'number' || !world.hexes){
      throw new Error('无效的钢铁前线存档格式');
    }
    const sc = world.scenario || 'A';
    saveGame(world, 1, '导入的存档');
    return world;
  } catch(e){
    throw e;
  }
}

export function clearSave(){
  try {
    for(const sc of ['A', 'ww1', 'ww2', 'coldwar', 'modern']){
      for(let s = 0; s <= 3; s++){
        localStorage.removeItem(getSaveKey(sc, s));
      }
    }
    localStorage.removeItem(V2_LEGACY_KEY);
  } catch(e){}
}

export function hasSave(scenarioId = 'A'){
  const saves = listSaves(scenarioId);
  return saves.some(s => s.exists);
}
