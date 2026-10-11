/* ============================================================
   ui/treeLayout.js —— 树形布局纯函数（W3-1 科技树图 / W3-2 国策树图共用）
   ------------------------------------------------------------
   输入节点集（{ id, requires|pre }），输出：
     - pos:   { [id]: { x: 列号, y: 层级 } }（y = 最长路径深度，x = DFS 整洁布局）
     - edges: [{ from, to }]（前置 → 节点，供画连线）
     - cols / rows: 画布尺寸
   兼容两种数据形态：科技（requires）与国策（requires 或 pre）。
   纯函数、确定性、无 DOM —— tests/ui_logic.test.js 直接断言。
   ============================================================ */

/**
 * @param {Array<{id:string, requires?:string[], pre?:string[]}>} nodes
 * @param {object} [opts] { idKey='id', reqKey=null }
 *   reqKey 缺省时自动探测：节点有 requires 用 requires，否则用 pre。
 */
export function layoutForest(nodes, opts = {}){
  const idKey = opts.idKey || 'id';
  const byId = new Map();
  for(const nd of nodes) byId.set(nd[idKey], nd);

  const reqOf = (nd) => {
    if(opts.reqKey) return nd[opts.reqKey] || [];
    if(Array.isArray(nd.requires)) return nd.requires;
    if(Array.isArray(nd.pre)) return nd.pre;
    return [];
  };

  const children = new Map();   // parentId -> [childId]
  const roots = [];
  for(const nd of nodes){
    const reqs = reqOf(nd).filter(r => byId.has(r));   // 只连树内已知的父节点
    if(!reqs.length) roots.push(nd[idKey]);
    for(const r of reqs){
      if(!children.has(r)) children.set(r, []);
      children.set(r, children.get(r).concat(nd[idKey]));
    }
  }

  // y = 最长路径深度（带环守卫：环上节点落到 root 兜底层）
  const depthMemo = new Map();
  const depthOf = (id, stack) => {
    if(depthMemo.has(id)) return depthMemo.get(id);
    if(stack.has(id)) return 0;                      // 环守卫
    stack.add(id);
    const nd = byId.get(id);
    const reqs = reqOf(nd).filter(r => byId.has(r));
    let d = 0;
    for(const r of reqs) d = Math.max(d, depthOf(r, stack) + 1);
    stack.delete(id);
    depthMemo.set(id, d);
    return d;
  };
  for(const nd of nodes) depthOf(nd[idKey], new Set());

  // x = DFS 整洁布局：叶节点按序占新列，父节点居中于子节点
  const pos = {};
  let nextX = 0;
  const assignX = (id, stack) => {
    if(pos[id] !== undefined) return pos[id].x;
    if(stack.has(id)) return 0;                      // 环守卫
    stack.add(id);
    const kids = children.get(id) || [];
    let x;
    if(!kids.length){
      x = nextX++;
    } else {
      const xs = [];
      for(const k of kids){
        if(!stack.has(k)) xs.push(assignX(k, stack));
      }
      x = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : nextX++;
    }
    stack.delete(id);
    pos[id] = { x, y: depthMemo.get(id) || 0 };
    return x;
  };
  for(const r of roots) assignX(r, new Set());

  // 兜底：不在任何根的子树（孤立环等）平铺到新列
  for(const nd of nodes){
    if(pos[nd[idKey]] === undefined){
      pos[nd[idKey]] = { x: nextX++, y: depthMemo.get(nd[idKey]) || 0 };
    }
  }

  const edges = [];
  for(const nd of nodes){
    for(const r of reqOf(nd)){
      if(byId.has(r) && pos[r]) edges.push({ from: r, to: nd[idKey] });
    }
  }

  const cols = Math.max(1, ...nodes.map(nd => Math.round(pos[nd[idKey]].x) + 1));
  const rows = Math.max(1, ...nodes.map(nd => pos[nd[idKey]].y + 1));
  return { pos, edges, cols, rows, children };
}
