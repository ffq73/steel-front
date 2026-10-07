/* ============================================================
   tools/atlas_view.cjs —— 图集检视器
   把 atlas.js 的陆海层与国界层渲染成终端文本，便于人眼核对海岸线与
   国家轮廓（一次性工具，可删）。
   用法：node tools/atlas_view.cjs [ww2|ww1]
   ============================================================ */
'use strict';
const { pathToFileURL } = require('url');
const path = require('path');

const root = path.resolve(__dirname, '..');
const mod = (p) => import(pathToFileURL(path.join(root, p)).href);

const NAMES = {
  1: '德国', 2: '意大利', 3: '英国', 4: '法国', 5: '苏联', 6: '波兰', 7: '匈牙利',
  8: '罗马尼亚', 9: '南斯拉夫', a: '保加利亚', b: '希腊', c: '土耳其', d: '挪威',
  e: '瑞典', f: '丹麦', g: '芬兰', h: '荷兰', i: '比利时', j: '瑞士', k: '西班牙',
  l: '葡萄牙', m: '埃及', n: '伊拉克', o: '伊朗', p: '沙特', q: '中国', r: '日本',
  s: '中共', t: '美国', u: '加拿大', '~': '中立/无主'
};
const NAMES_WW1 = {
  1: '德国', 2: '奥匈', 3: '英国', 4: '法国', 5: '俄国', 6: '意大利', 7: '塞尔维亚',
  8: '罗马尼亚', 9: '保加利亚', a: '希腊', b: '奥斯曼', c: '荷兰', d: '比利时',
  e: '瑞士', f: '西班牙', g: '葡萄牙', h: '丹麦', i: '挪威', j: '瑞典', k: '黑山',
  l: '阿尔巴尼亚', '~': '中立/无主'
};

(async () => {
  const A = await mod('js/data/atlas.js');
  const which = (process.argv[2] || 'ww2').toLowerCase();
  const own = which === 'ww1' ? A.OWN_WW1 : A.OWN_WW2;
  const names = which === 'ww1' ? NAMES_WW1 : NAMES;

  const ruler = '    ' + Array.from({ length: A.ATLAS_W }, (_, i) => String(i % 10)).join('');
  console.log('=== 陆海轮廓（█陆地 ·海洋）===');
  console.log(ruler);
  A.LAND.forEach((row, r) => {
    console.log(String(r).padStart(2, ' ') + '  ' + row.replace(/L/g, '█').replace(/~/g, '·'));
  });

  console.log(`\n=== 国界层 ${which} ===`);
  console.log(ruler);
  own.forEach((row, r) => {
    let line = '';
    for (let q = 0; q < A.ATLAS_W; q++) {
      line += A.LAND[r][q] === '~' ? '·' : (row[q] === '~' ? ' ' : row[q]);
    }
    console.log(String(r).padStart(2, ' ') + '  ' + line);
  });

  const st = A.atlasStats(own);
  console.log(`\n=== 统计 ===  陆地 ${st.land} 格`);
  for (const [k, n] of Object.entries(st.byNat).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${(names[k] || k).padEnd(10)} ${String(n).padStart(4)} 格`);
  }

  // 连片性：把每国的领土做**六边形**连通分量，列出碎片（跨海飞地属正常）
  const geom = await mod('js/core/geom.js');
  const seen = new Set();
  const comps = [];
  for (let r = 0; r < A.ATLAS_H; r++) {
    for (let q = 0; q < A.ATLAS_W; q++) {
      if (A.LAND[r][q] === '~' || seen.has(q + ',' + r)) continue;
      const code = own[r][q];
      const stack = [[q, r]]; seen.add(q + ',' + r);
      let size = 0;
      while (stack.length) {
        const [cq, cr] = stack.pop(); size++;
        for (const [nq, nr] of geom.oddrNeighbors(cq, cr)) {
          const k = nq + ',' + nr;
          if (nq < 0 || nr < 0 || nq >= A.ATLAS_W || nr >= A.ATLAS_H) continue;
          if (A.LAND[nr][nq] === '~' || seen.has(k) || own[nr][nq] !== code) continue;
          seen.add(k); stack.push([nq, nr]);
        }
      }
      comps.push({ code, size, q, r });
    }
  }
  const byCode = {};
  for (const c of comps) (byCode[c.code] = byCode[c.code] || []).push(c);
  console.log('\n=== 领土破碎度（跨海飞地正常；同侧断裂才是画错）===');
  for (const [k, list] of Object.entries(byCode).sort((a, b) => b[1].length - a[1].length)) {
    if (list.length <= 1) continue;
    const main = Math.max(...list.map((x) => x.size));
    const bits = list.filter((x) => x.size < main)
      .sort((a, b) => b.size - a.size)
      .map((x) => `${x.size}格@(${x.q},${x.r})`);
    console.log(`  ${(names[k] || k).padEnd(10)} 主块 ${String(main).padStart(3)} 格，碎片 ${list.length - 1} 个：${bits.join(' ')}`);
  }
})();
