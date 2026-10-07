/* ============================================================
   data/rivers.js —— 战术水系与河流边界系统 (v7.0 §3.2 / v11.0 重排)
   1. 欧洲与东亚主要历史河流 (莱茵河、维斯瓦河、多瑙河、第聂伯河、伏尔加河等)
   2. 六角格边界边集 (Edge Set) 与双向查询
   3. 渡河进攻惩罚计算 (-30% 攻击力，工兵连减免 50%)
   4. 贝塞尔平滑曲线 (Bezier Spline) 控制点生成

   v11.0 变更：河流路径从「旧 20×14 / 26×16 地图坐标」改为
   **data/atlas.js 的 58×30 图集坐标**。一战与二战共用同一图集，
   因此同一张河流表对两个剧本同时成立；不存在对应格子的河段由
   getAllRiverEdges / hasRiverCrossing 的存在性校验自动跳过。
   ============================================================ */

function edgeKey(q1, r1, q2, r2){
  if(q1 < q2 || (q1 === q2 && r1 < r2)){
    return `${q1},${r1}-${q2},${r2}`;
  }
  return `${q2},${r2}-${q1},${r1}`;
}

/* 用折线（一串相邻六角格）声明河流，自动展开成边界边集 */
function chain(points){
  const edges = [];
  for(let i = 0; i + 1 < points.length; i++){
    const [q1, r1] = points[i], [q2, r2] = points[i + 1];
    edges.push([q1, r1, q2, r2]);
  }
  return edges;
}

/* 核心历史河流定义表（图集坐标，q 0~43 为欧陆段，48~57 为东亚插图） */
export const RIVERS_DATA = [
  { name: '莱茵河 (Rhine)', color: '#38bdf8',
    // 巴塞尔 → 斯特拉斯堡 → 科隆 → 鹿特丹入海
    edges: chain([[19,16],[19,15],[19,14],[18,13],[18,12],[19,11]]) },
  { name: '鲁尔河 (Ruhr)', color: '#38bdf8',
    edges: chain([[19,14],[18,14],[17,14]]) },
  { name: '默兹河 (Meuse)', color: '#38bdf8',
    // 凡尔登 → 列日 → 低地
    edges: chain([[18,15],[18,14],[17,13],[17,12]]) },
  { name: '塞纳河 (Seine)', color: '#38bdf8',
    edges: chain([[17,16],[16,15],[16,14]]) },
  { name: '卢瓦尔河 (Loire)', color: '#38bdf8',
    edges: chain([[15,17],[14,16],[12,16]]) },
  { name: '罗讷河 (Rhône)', color: '#38bdf8',
    edges: chain([[19,18],[19,19],[18,19]]) },
  { name: '波河 (Po)', color: '#38bdf8',
    edges: chain([[20,17],[21,17],[22,17]]) },
  { name: '易北河 (Elbe)', color: '#38bdf8',
    // 布拉格 → 德累斯顿 → 汉堡
    edges: chain([[24,15],[23,14],[22,13],[21,13]]) },
  { name: '奥得河 (Oder)', color: '#38bdf8',
    edges: chain([[24,14],[24,13],[23,12]]) },
  { name: '维斯瓦河 (Vistula)', color: '#38bdf8',
    // 克拉科夫 → 华沙 → 但泽
    edges: chain([[28,15],[27,14],[27,13],[27,12]]) },
  { name: '尼曼河 (Niemen)', color: '#38bdf8',
    edges: chain([[32,12],[31,11]]) },
  { name: '多瑙河 (Danube)', color: '#38bdf8',
    // 维也纳 → 布达佩斯 → 贝尔格莱德 → 布加勒斯特 → 黑海
    edges: chain([[25,16],[26,16],[27,16],[27,17],[27,18],[28,18],[29,18],[30,18],[31,18]]) },
  { name: '第聂伯河 (Dnieper)', color: '#38bdf8',
    // 斯摩棱斯克 → 基辅 → 黑海
    edges: chain([[32,12],[33,13],[34,14],[35,15],[34,16],[33,17],[32,18]]) },
  { name: '顿河 (Don)', color: '#38bdf8',
    edges: chain([[41,13],[41,15],[41,16],[42,17]]) },
  { name: '伏尔加河 (Volga)', color: '#38bdf8',
    // 莫斯科 → 斯大林格勒 → 里海
    edges: chain([[40,12],[41,13],[42,14],[43,15],[44,16],[45,17]]) },
  { name: '尼罗河 (Nile)', color: '#38bdf8',
    edges: chain([[35,29],[35,28],[36,27],[36,26]]) },
  { name: '底格里斯-幼发拉底 (Tigris)', color: '#38bdf8',
    edges: chain([[42,28],[43,27],[44,26],[45,25]]) },
  { name: '长江 (Yangtze)', color: '#38bdf8',
    edges: chain([[55,21],[56,21],[57,21],[58,20]]) },
  { name: '黄河 (Yellow)', color: '#38bdf8',
    edges: chain([[55,17],[56,17],[57,16],[58,16]]) }
];

/* 快速边集查询表 (缓存) */
let _riverEdgeSet = null;

function buildRiverEdgeSet(){
  if(_riverEdgeSet) return _riverEdgeSet;
  _riverEdgeSet = new Set();
  for(const r of RIVERS_DATA){
    for(const edge of r.edges){
      _riverEdgeSet.add(edgeKey(edge[0], edge[1], edge[2], edge[3]));
    }
  }
  return _riverEdgeSet;
}

/** 查询两相邻六角格之间是否存在河流边界 */
export function hasRiverCrossing(world, q1, r1, q2, r2){
  const set = buildRiverEdgeSet();
  return set.has(edgeKey(q1, r1, q2, r2));
}

/** 计算渡河战斗修正系数（基础 -30%，工兵连减半为 -15%） */
export function getRiverPenalty(world, u, fromQ, fromR, toQ, toR){
  if(!hasRiverCrossing(world, fromQ, fromR, toQ, toR)){
    return 1.0;
  }
  // 检查是否搭载工兵连 (Engineer Support)
  // W0-A3 修正：字段名是 supports（复数），工兵连 id 是 sup_eng。
  // 原写法 tmpl.support + 'eng' 两处都取不到值 → 工兵减半从未生效。
  let hasEngineer = false;
  if(u && u.templateId && world && world.templates && world.templates[u.templateId]){
    const tmpl = world.templates[u.templateId];
    if(tmpl.supports && tmpl.supports.includes('sup_eng')) hasEngineer = true;
  }
  return hasEngineer ? 0.85 : 0.70;
}

/** 获取全部河流边列表（用于沙盘渲染管线） */
export function getAllRiverEdges(world){
  const results = [];
  for(const r of RIVERS_DATA){
    for(const edge of r.edges){
      // 验证世界中是否存在对应的两格
      const k1 = edge[0] + ',' + edge[1];
      const k2 = edge[2] + ',' + edge[3];
      if(world && world.at && (!world.at[k1] || !world.at[k2])) continue;
      results.push({
        name: r.name,
        q1: edge[0], r1: edge[1],
        q2: edge[2], r2: edge[3]
      });
    }
  }
  return results;
}
