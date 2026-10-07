/* ============================================================
   core/bus.js —— 事件总线（engine → UI 单向；UI → engine 走 dispatch）
   ============================================================ */

const listeners = new Map();

export const bus = {
  on(type, fn){ (listeners.get(type) || listeners.set(type, []).get(type)).push(fn); },
  emit(type, payload){ for(const fn of listeners.get(type) || []) fn(payload); },
  clear(){ listeners.clear(); }
};
