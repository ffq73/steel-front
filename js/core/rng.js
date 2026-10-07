/* ============================================================
   core/rng.js —— mulberry32 确定性随机（C3：禁止 Math.random）
   状态可序列化（world.rngState 进存档），同种子同序列。
   ============================================================ */

export function makeRng(seed){
  let s = seed >>> 0;
  const rng = function(){
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.state = () => s;
  rng.setState = (v) => { s = v >>> 0; };
  rng.range = (min, max) => min + rng() * (max - min);
  rng.pick = (arr) => arr[Math.floor(rng() * arr.length) % arr.length];
  return rng;
}

/** 从世界恢复 rng（世界存档中携带 rngState） */
export function rngFromWorld(world){
  const r = makeRng(world.rngState >>> 0);
  return r;
}
