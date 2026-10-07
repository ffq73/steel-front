/* ============================================================
   core/geom.js —— hex 坐标几何（odd-r offset 存储 / axial-cube 计算）
   约定见主开发提示词 v2.0 §4.5.1。纯函数，无 DOM。
   ============================================================ */

/** odd-r offset 邻接表（六向） */
export function neighbors(q, r){
  if(r % 2 === 0){
    return [[q-1,r],[q+1,r],[q,r-1],[q-1,r-1],[q,r+1],[q-1,r+1]];
  }
  return [[q-1,r],[q+1,r],[q,r-1],[q+1,r-1],[q,r+1],[q+1,r+1]];
}
export const oddrNeighbors = neighbors;

/** offset → axial */
export function toAxial(q, r){
  return { q: q - ((r - (r & 1)) >> 1), r };
}

/** hex 距离（odd-r offset 输入） */
export function hexDist(q1, r1, q2, r2){
  const a = toAxial(q1, r1), b = toAxial(q2, r2);
  const dx = b.q - a.q, dz = b.r - a.r, dy = -(dx + dz);
  return Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz));
}

/** pixel → hex 反算（pointy-top，odd-r offset；需相机换算后的世界坐标） */
export function pixToHex(px, py, size){
  // 转 axial 浮点（pointy-top）：aq = (√3/3 * x - 1/3 * y) / size ; ar = (2/3 * y) / size
  const af = (Math.sqrt(3)/3 * px - (1/3) * py) / size;
  const rf = ((2/3) * py) / size;
  // axial → cube round
  const x = af, z = rf, y = -x - z;
  let rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);
  const dx = Math.abs(rx - x), dy = Math.abs(ry - y), dz = Math.abs(rz - z);
  if(dx > dy && dx > dz) rx = -ry - rz;
  else if(dy > dz) ry = -rx - rz;
  else rz = -rx - ry;
  // axial → odd-r offset
  const q = rx + ((rz - (rz & 1)) >> 1);
  return { q, r: rz };
}

/** hex 中心像素（pointy-top, odd-r） */
export function hexToPix(q, r, size){
  return { x: size * Math.sqrt(3) * (q + (r & 1 ? 0.5 : 0)), y: size * 1.5 * r };
}

/** 六个角点（用于描边/填充） */
export function hexCorners(cx, cy, s){
  const pts = [];
  for(let i=0;i<6;i++){
    const a = Math.PI/180 * (60*i - 30);
    pts.push([cx + s*Math.cos(a), cy + s*Math.sin(a)]);
  }
  return pts;
}

/** 2D 射线交叉法判断点 (px, py) 是否在多边形内部 (v11.0 M4) */
export function pointInPoly(px, py, polygon){
  if(!polygon || polygon.length < 3) return false;
  let inside = false;
  const n = polygon.length;
  for(let i = 0, j = n - 1; i < n; j = i++){
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = ((yi > py) !== (yj > py)) &&
        (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
    if(intersect) inside = !inside;
  }
  return inside;
}

/** 确定性字符串哈希 (0.0 ~ 1.0) */
function getGeoHash(s){
  let h = 2166136261 >>> 0;
  for(let i=0; i<s.length; i++){
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return (h >>> 0) / 4294967296;
}

/** 为全域地块生成真正的不规则历史多边形行省拓扑与无缝水密边界 (v11.0 §2 M2) */
export function buildProvincePolygons(hexes, size = 48){
  if(!hexes || !hexes.length) return hexes;

  // 1. 确定性顶点微扰哈希表（同顶点由相邻三格共享同一坐标，确保绝对水密）
  const cornerMap = new Map();
  function getJitteredCorner(px, py){
    const k = Math.round(px) + ',' + Math.round(py);
    if(cornerMap.has(k)) return cornerMap.get(k);
    const a = getGeoHash(k + ':a') * Math.PI * 2;
    const d = (0.12 + 0.16 * getGeoHash(k + ':d')) * size;
    const pt = [px + Math.cos(a)*d, py + Math.sin(a)*d];
    cornerMap.set(k, pt);
    return pt;
  }

  // 2. 确定性有机弯曲边界细分（两相邻省份的共有边界共享完全一致的微弯曲线）
  const edgeMap = new Map();
  function getSubdividedEdge(p1, p2){
    const k1 = Math.round(p1[0]) + ',' + Math.round(p1[1]);
    const k2 = Math.round(p2[0]) + ',' + Math.round(p2[1]);
    const forward = k1 < k2;
    const eKey = forward ? k1 + '_' + k2 : k2 + '_' + k1;
    let midPts;
    if(edgeMap.has(eKey)){
      midPts = edgeMap.get(eKey);
    } else {
      const dx = (forward ? p2[0] - p1[0] : p1[0] - p2[0]);
      const dy = (forward ? p2[1] - p1[1] : p1[1] - p2[1]);
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      const disp = (getGeoHash(eKey) - 0.5) * 0.32 * size;
      const start = forward ? p1 : p2;
      const m1 = [start[0] + dx*0.35 + nx*disp, start[1] + dy*0.35 + ny*disp];
      const m2 = [start[0] + dx*0.68 - nx*disp*0.5, start[1] + dy*0.68 - ny*disp*0.5];
      midPts = [m1, m2];
      edgeMap.set(eKey, midPts);
    }
    return forward ? midPts : [midPts[1], midPts[0]];
  }

  for(const h of hexes){
    const {x: cx, y: cy} = hexToPix(h.q, h.r, size);
    h.center = { x: cx, y: cy };
    const rawCorners = hexCorners(cx, cy, size);
    const jCorners = rawCorners.map(([x,y]) => getJitteredCorner(x, y));
    const poly = [];
    for(let i=0; i<6; i++){
      const c1 = jCorners[i];
      const c2 = jCorners[(i+1)%6];
      poly.push(c1);
      const mids = getSubdividedEdge(c1, c2);
      poly.push(...mids);
    }
    h.polygon = poly;
    h.neighborEdges = {};
  }

  // 真实历史行省名称字典 (v11.0 §2 M2)
  const REGION_NAMES = {
    GER: ['勃兰登堡', '东普鲁士', '西里西亚', '波美拉尼亚', '萨克森', '莱茵兰', '威斯特法伦', '汉诺威', '巴伐利亚', '施瓦本', '图林根', '黑森', '荷尔斯泰因', '梅克伦堡', '萨尔', '巴登'],
    SOV: ['莫斯科', '斯摩棱斯克', '维亚济马', '图拉', '库尔斯克', '沃罗涅日', '布良斯克', '顿巴斯', '扎波罗热', '哈尔科夫', '基辅', '明斯克', '维捷布斯克', '普斯科夫', '诺夫哥罗德', '列宁格勒', '罗斯托夫', '斯大林格勒', '奥尔沙', '波洛茨克', '日托米尔', '文尼察', '切尔卡瑟', '第聂伯罗'],
    POL: ['马佐夫舍', '大波兰', '小波兰', '卢布林', '库亚维', '波德拉谢', '西里西亚', '克拉科夫', '波兹南', '罗兹', '比亚韦斯托克', '维尔诺', '格但斯克走廊'],
    FRA: ['法兰西岛', '诺曼底', '布列塔尼', '洛林', '阿尔萨斯', '香槟', '皮卡第', '勃艮第', '普罗旺斯', '阿基坦', '朗格多克', '奥弗涅', '弗朗什-孔泰', '罗纳'],
    GBR: ['大伦敦', '英格兰中部', '约克郡', '兰开夏', '苏格兰高地', '洛锡安', '威尔士', '康沃尔', '肯特', '诺森伯兰'],
    ITA: ['拉齐奥', '伦巴第', '皮埃蒙特', '威尼托', '托斯卡纳', '艾米利亚', '坎帕尼亚', '西西里', '撒丁', '卡拉布里亚', '阿普利亚'],
    CHN: ['直隶', '山东', '河南', '山西', '江苏', '浙江', '安徽', '湖北', '湖南', '江西', '陕西', '四川', '广东', '广西', '辽宁', '吉林', '黑龙江'],
    CCP: ['陕甘宁', '晋察冀', '晋冀鲁豫', '晋绥', '太行山', '吕梁山', '沂蒙山', '延安核心区'],
    JPN: ['关东', '关西', '中部', '东北', '九州', '四国', '北海道', '中国地方'],
    USA: ['新英格兰', '纽约州', '宾夕法尼亚', '中西部', '五大湖', '弗吉尼亚', '卡罗来纳', '佐治亚', '得克萨斯', '加利福尼亚', '华盛顿州'],
    DEFAULT: ['战略防区', '平原战区', '高地防区', '河谷走廊', '要塞防线', '边境走廊', '森林战区', '湖区枢纽']
  };

  for(const h of hexes){
    if(!h.name){
      if(h.city && h.city.name){
        h.name = h.city.name;
      } else {
        const pool = REGION_NAMES[h.owner] || REGION_NAMES.DEFAULT;
        const hash = Math.floor(getGeoHash(h.q + ':' + h.r) * 100000);
        const baseName = pool[hash % pool.length];
        const num = (Math.floor(hash / pool.length) % 9) + 1;
        h.name = baseName + '第' + num + '防区';
      }
    }
  }

  // 计算并缓存相邻行省共有多边形曲线边缘（确保战线与国界 100% 沿自然省界贴合绘制）
  for(const h of hexes){
    if(!h.adj) continue;
    const raw0 = hexCorners(h.center.x, h.center.y, size);
    for(const ni of h.adj){
      const nh = hexes[ni];
      if(!nh || h.neighborEdges[ni]) continue;
      const rawN = hexCorners(nh.center.x, nh.center.y, size);
      const sharedJCorners = [];
      for(let i=0; i<6; i++){
        for(let j=0; j<6; j++){
          if(Math.hypot(raw0[i][0] - rawN[j][0], raw0[i][1] - rawN[j][1]) < 1.5){
            sharedJCorners.push(getJitteredCorner(raw0[i][0], raw0[i][1]));
          }
        }
      }
      if(sharedJCorners.length >= 2){
        const ca = sharedJCorners[0], cb = sharedJCorners[1];
        const mids = getSubdividedEdge(ca, cb);
        const edgePts = [ca, mids[0], mids[1], cb];
        h.neighborEdges[ni] = edgePts;
        nh.neighborEdges = nh.neighborEdges || {};
        nh.neighborEdges[h.idx] = [cb, mids[1], mids[0], ca];
      }
    }
  }
  return hexes;
}

/** 基于射线交叉法极速捕获屏幕坐标 (px, py) 命中的真实不规则历史行省 (v11.0 M4) */
export function findProvinceAt(world, cam, px, py){
  if(!world || !world.hexes || !world.hexes.length) return cam.toHex(px, py);
  const wx = (px - cam.x) / cam.z;
  const wy = (py - cam.y) / cam.z;
  if(world.provinces && typeof world.provinces.pickProvince === 'function'){
    const hit = world.provinces.pickProvince(wx, wy);
    if(hit) return hit.hex || hit;
  }
  const rough = cam.toHex(px, py);
  const candidate = world.at[rough.q + ',' + rough.r];
  if(candidate && candidate.polygon && pointInPoly(wx, wy, candidate.polygon)){
    return candidate;
  }
  if(candidate && candidate.adj){
    for(const ni of candidate.adj){
      const nh = world.hexes[ni];
      if(nh && nh.polygon && pointInPoly(wx, wy, nh.polygon)){
        return nh;
      }
    }
  }
  for(const h of world.hexes){
    if(h.polygon && pointInPoly(wx, wy, h.polygon)){
      return h;
    }
  }
  return candidate || rough;
}


