/* ============================================================
   tools/bundle.cjs —— 零依赖单文件打包工具 (v3.0 W5)
   内联所有 JS/CSS/数据包，生成独立分发 HTML：
   1. dist/steel-front.html (全剧本集成版)
   2. dist/ww1.html (一战火药桶 1914 独立版)
   3. dist/ww2.html (二战全面战争 1939 独立版)
   4. dist/coldwar.html (冷战铁幕 1949 独立版)
   5. dist/modern.html (现代多极危机 2022 独立版)
   ============================================================ */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');

/* 严格拓扑依赖顺序清单 */
const ORDER = [
  'js/core/geom.js',
  'js/core/rng.js',
  'js/core/bus.js',
  'js/core/audio.js',
  'js/core/assets.js',
  'js/core/palette.js',
  'js/data/constants.js',
  'js/data/eras.js',
  'js/data/terrain.js',
  'js/data/units.js',
  'js/data/nations.js',
  'js/data/atlas.js',
  'js/data/theaters.js',
  'js/data/map.js',
  'js/data/techs.js',
  'js/data/focuses.js',
  'js/data/tutorials.js',
  'js/data/encyclopedia.js',
  'js/data/events40.js',
  'js/data/rivers.js',
  'js/data/railways.js',
  'js/data/weather.js',
  'js/data/dossierData.js',
  'js/data/provinceNames.js',
  'js/data/resources.js',
  'js/data/ideology.js',
  'js/data/decisions.js',
  'js/data/wargoals.js',   // v14.1 E6：剧本目标类型注册表
  'js/data/doctrines.js',

  // 一战数据包
  'js/data/scenarios/ww1/map.js',
  'js/data/scenarios/ww1/nations.js',
  'js/data/scenarios/ww1/characters.js',
  'js/data/scenarios/ww1/equipment.js',
  'js/data/scenarios/ww1/battalions.js',
  'js/data/scenarios/ww1/focuses.js',
  'js/data/scenarios/ww1/events.js',
  'js/data/scenarios/ww1/index.js',

  // 二战数据包
  'js/data/scenarios/ww2/map.js',
  'js/data/scenarios/ww2/nations.js',
  'js/data/scenarios/ww2/characters.js',
  'js/data/scenarios/ww2/equipment.js',
  'js/data/scenarios/ww2/focuses.js',
  'js/data/scenarios/ww2/events.js',
  'js/data/scenarios/ww2/index.js',

  // 冷战数据包
  'js/data/scenarios/coldwar/map.js',
  'js/data/scenarios/coldwar/nations.js',
  'js/data/scenarios/coldwar/characters.js',
  'js/data/scenarios/coldwar/equipment.js',
  'js/data/scenarios/coldwar/focuses.js',
  'js/data/scenarios/coldwar/events.js',
  'js/data/scenarios/coldwar/index.js',

  // 现代数据包
  'js/data/scenarios/modern/map.js',
  'js/data/scenarios/modern/nations.js',
  'js/data/scenarios/modern/characters.js',
  'js/data/scenarios/modern/equipment.js',
  'js/data/scenarios/modern/focuses.js',
  'js/data/scenarios/modern/events.js',
  'js/data/scenarios/modern/index.js',

  // 剧本总注册表
  'js/data/scenarios.js',

  // 引擎子系统
  'js/engine/invasion.js',
  'js/engine/plans.js',
  'js/engine/characters.js',
  'js/engine/theaters.js',
  'js/engine/air.js',
  'js/engine/navy.js',
  'js/engine/intel.js',
  'js/engine/doctrine.js',
  'js/engine/stats.js',
  'js/engine/subjects.js',
  'js/engine/barrage.js',
  'js/engine/attrition.js',
  'js/engine/resistance.js',
  'js/engine/bloc.js',
  'js/engine/space.js',
  'js/engine/drones.js',
  'js/engine/sanctions.js',
  'js/engine/energy.js',
  'js/engine/milaid.js',
  'js/engine/tension.js',
  'js/engine/laws.js',
  'js/engine/template.js',
  'js/engine/news.js',
  'js/engine/econSocial.js',
  'js/engine/nuclear.js',
  'js/engine/diplomacy.js',
  'js/engine/economy.js',
  'js/engine/research.js',
  'js/engine/focus.js',
  'js/engine/movement.js',
  'js/engine/battle.js',
  'js/engine/ai.js',
  'js/engine/victory.js',
  'js/engine/logistics.js',
  'js/engine/resources.js',
  'js/engine/peace.js',
  'js/engine/decisions.js',
  'js/engine/manpower.js',
  'js/engine/mods.js',
  'js/engine/ideology.js',
  'js/engine/aiStrategy.js',
  'js/engine/states.js',
  'js/engine/world.js',
  'js/engine/tick.js',

  // UI、状态、渲染
  'js/core/store.js',
  'js/save.js',
  'js/render/camera.js',
  'js/render/provinces.js',
  'js/render/mapModes.js',
  'js/render/eraLayers.js',
  'js/render/layers.js',
  'js/ui/input.js',
  'js/ui/panelArmy.js',
  'js/ui/panelAir.js',
  'js/ui/panelNavy.js',
  'js/ui/panelIntel.js',
  'js/ui/panelDoctrine.js',
  'js/ui/panelStats.js',
  'js/ui/panelTrade.js',
  'js/ui/panelDesigner.js',
  'js/ui/panelEncyclopedia.js',
  'js/ui/panelEra.js',
  'js/ui/newsTicker.js',
  'js/ui/detailSystem.js',
  'js/ui/panelPeace.js',
  'js/ui/panelDecisions.js',
  'js/ui/panelResearch.js',
  'js/ui/screenManager.js',
  'js/ui/screenPages.js',
  'js/ui/portraitMap.js',
  'js/ui/panels.js',
  'js/ui/treeLayout.js',   // W3-1/W3-2：树形布局纯函数
  'js/ui/hudV8.js',
  'js/ui/eraHud.js',
  'js/main.js'
];

/* ------------------------------------------------------------------
   自检：ORDER 必须覆盖 js/ 下所有被 import 的模块。
   漏登记时模块体不会进入 bundle，只剩调用点 → 单文件版抛 ReferenceError，
   而 devserver 走源码一切正常，故表现为"源码好的、打包是坏的"。
   ------------------------------------------------------------------ */
(function verifyOrder(){
  const orderSet = new Set(ORDER.map(p => p.replace(/\\/g, '/')));
  const missing = new Set();
  const walk = dir => {
    for(const name of fs.readdirSync(dir)){
      const abs = path.join(dir, name);
      const st = fs.statSync(abs);
      if(st.isDirectory()){ walk(abs); continue; }
      if(!name.endsWith('.js')) continue;
      const rel = path.relative(root, abs).replace(/\\/g, '/');
      const src = fs.readFileSync(abs, 'utf8');
      const re = /(?:^|\n)\s*import\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g;
      let m;
      while((m = re.exec(src))){
        const spec = m[1];
        if(!spec.startsWith('.')) continue;                 // 裸包名不管
        const target = path.relative(root, path.resolve(path.dirname(abs), spec))
          .replace(/\\/g, '/');
        if(!orderSet.has(target)) missing.add(`${rel}  →  ${target}`);
      }
    }
  };
  walk(path.join(root, 'js'));
  if(missing.size){
    console.error('\n✗ 打包清单 tools/bundle.cjs 的 ORDER 缺少以下模块：');
    for(const s of missing) console.error('   ' + s);
    console.error('  漏登记的模块不会被打进单文件版，dist 会抛 ReferenceError。\n');
    process.exit(1);
  }
})();


/* ------------------------------------------------------------------
   自检 4：跨模块顶层 const/let/class 撞名扫描。
   压平打包把所有模块体并进同一个脚本作用域：devserver（ESM，各模块
   独立作用域）里相安无事的两个顶层 `const CROP`，压平后即
   "Identifier has already been declared" —— 整个 1.3MB 脚本解析失败，
   双击 dist 白屏，而源码模式毫无异样（v12 实际事故）。
   const/let/class 重复声明是 SyntaxError，必须构建期硬失败；
   function/var 重复声明合法（压平后后者覆盖前者）但语义与 ESM 不符，
   降级为警告。
   ------------------------------------------------------------------ */
(function verifyTopLevelCollisions(){
  const strict = new Map();   // name -> [module,...]  (const/let/class)
  const loose = new Map();    // name -> [module,...]  (function/var)
  const declRe = /^(export\s+)?(const|let|class|function|var)\s+([A-Za-z_$][\w$]*)/gm;
  for(const rel of ORDER){
    const src = fs.readFileSync(path.join(root, rel), 'utf8');
    let m;
    while((m = declRe.exec(src))){
      const kind = m[2], name = m[3];
      const bucket = (kind === 'const' || kind === 'let' || kind === 'class') ? strict : loose;
      if(!bucket.has(name)) bucket.set(name, []);
      bucket.get(name).push(rel);
    }
  }
  const fatal = [...strict.entries()].filter(([, mods]) => mods.length > 1);
  if(fatal.length){
    console.error('\n✗ 跨模块顶层 const/let/class 撞名（压平后 = SyntaxError，dist 白屏）：');
    for(const [name, mods] of fatal) console.error(`   ${name}  ←  ${mods.join(', ')}`);
    console.error('  请给模块私有常量加模块前缀改名（参考 WW1_CROP）。\n');
    process.exit(1);
  }
  const warn = [...loose.entries()].filter(([, mods]) => mods.length > 1);
  if(warn.length){
    console.warn('\n⚠ 跨模块顶层 function/var 同名（合法但压平后后者覆盖前者，与 ESM 语义不符）：');
    for(const [name, mods] of warn.slice(0, 10)) console.warn(`   ${name}  ←  ${mods.join(', ')}`);
    if(warn.length > 10) console.warn(`   …另有 ${warn.length - 10} 组`);
  }
})();

let bundleCode = '';
/* ------------------------------------------------------------------
   命名空间导入（import * as X from './m.js'）无法靠「压平到一个作用域」满足：
   模块体进了包，但没有任何对象绑到 X 这个名字上 → 运行时 ReferenceError。
   这里在打包期为每个命名空间导入合成一个对象字面量。
   ------------------------------------------------------------------ */
function exportedNamesOf(rel){
  const src = fs.readFileSync(path.join(root, rel), 'utf8');
  const out = [];
  const declRe = /export\s+(?:async\s+)?(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g;
  let m;
  while((m = declRe.exec(src))) out.push({ exported: m[1], local: m[1] });
  // export { a, b as c } —— 压平后 local 在作用域里，导出名为 c
  const braceRe = /export\s*\{([\s\S]*?)\}/g;
  while((m = braceRe.exec(src))){
    for(const part of m[1].split(',')){
      const t = part.trim();
      if(!t) continue;
      const asMatch = t.match(/^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/);
      if(asMatch) out.push({ exported: asMatch[2], local: asMatch[1] });
      else if(/^[A-Za-z_$][\w$]*$/.test(t)) out.push({ exported: t, local: t });
    }
  }
  return out;
}

function namespaceBindings(){
  const bindings = [];
  const seen = new Set();
  const nsRe = /(?:^|\n)\s*import\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\s+['"]([^'"]+)['"]/g;
  for(const rel of ORDER){
    const abs = path.join(root, rel);
    const src = fs.readFileSync(abs, 'utf8');
    let m;
    while((m = nsRe.exec(src))){
      const [nsName, spec] = [m[1], m[2]];
      if(!spec.startsWith('.')) continue;
      const target = path.relative(root, path.resolve(path.dirname(abs), spec)).replace(/\\/g, '/');
      if(seen.has(nsName + '|' + target)) continue;
      seen.add(nsName + '|' + target);
      bindings.push({ nsName, target, names: exportedNamesOf(target) });
    }
  }
  return bindings;
}

const NS_BINDINGS = namespaceBindings();
// 合成失败（导出名一个都没解析到）说明该模块的导出形式没被覆盖，必须显式报错而不是发出空对象
for(const b of NS_BINDINGS){
  if(!b.names.length){
    console.error(`\n✗ 命名空间导入 \`import * as ${b.nsName} from '${b.target}'\` 解析不到任何导出名。`);
    console.error('  合成出的对象会是空的，运行时报 undefined。请检查该模块的导出写法。\n');
    process.exit(1);
  }
}
const nsBlock = NS_BINDINGS.length
  ? '\n/* ===== 命名空间导入合成（import * as X） ===== */\n'
    + NS_BINDINGS.map(b =>
        `var ${b.nsName} = { ${b.names.map(n => n.exported === n.local ? n.exported : `${n.exported}: ${n.local}`).join(', ')} };`
      ).join('\n') + '\n'
  : '';

for(const rel of ORDER){
  // 命名空间对象必须在 main.js 顶层代码执行前就位
  if(rel === 'js/main.js') bundleCode += nsBlock;
  let code = fs.readFileSync(path.join(root, rel), 'utf8');
  // 剥离 ES Module 导入与导出语法
  code = code.replace(/import\s*\{[\s\S]*?\}\s*from\s*['"][^'"]+['"];?/g, '');
  code = code.replace(/import\s+[\w*\s,{}]+from\s*['"][^'"]+['"];?/g, '');
  code = code.replace(/import\s+['"][^'"]+['"];?/g, '');
  code = code.replace(/export\s+default\s+/g, '');
  code = code.replace(/export\s+(const|let|var|function|class)\s+/g, '$1 ');
  code = code.replace(/export\s*\{[\s\S]*?\};?/g, '');
  bundleCode += `/* ===== ${rel} ===== */\n` + code + '\n';
}

const css = fs.readFileSync(path.join(root, 'css/tokens.css'), 'utf8')
  + '\n' + fs.readFileSync(path.join(root, 'css/style.css'), 'utf8')
  + '\n' + fs.readFileSync(path.join(root, 'css/screens.css'), 'utf8')
  + '\n' + fs.readFileSync(path.join(root, 'css/era.css'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

/* ------------------------------------------------------------------
   自检 3：模块体真的都进包了吗？
   verifyOrder 保证「被 import 的模块都在 ORDER 里」，但不保证这些模块
   的**函数体**确实写进了产物。历史上就出过 ORDER 漏登记 → dist 少了
   整个模块体 → 单文件版在入口处抛 ReferenceError → 所有 HUD 初始化被跳过，
   而源码走 devserver 一切正常，表现为「我打开的还是之前的」。
   这里逐模块核对：每个 export 出来的顶层名字，在产物里必须能找到同名的
   顶层声明。找不到就说明那一整块代码没进包。
   ------------------------------------------------------------------ */
(function verifyBodies(){
  const missing = [];
  for(const rel of ORDER){
    const src = fs.readFileSync(path.join(root, rel), 'utf8');
    const names = new Set();
    const declRe = /export\s+(?:async\s+)?(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g;
    let m;
    while((m = declRe.exec(src))) names.add(m[1]);
    for(const n of names){
      // 压平后声明形式：function n( / class n / const|let|var n =
      const re = new RegExp(
        '(?:^|[\\s;{}])(?:function\\s+' + n + '\\b|class\\s+' + n + '\\b'
        + '|(?:const|let|var)\\s+' + n + '\\s*=)'
      );
      if(!re.test(bundleCode)) missing.push(`${rel} → 顶层声明 ${n} 不在产物里`);
    }
  }
  if(missing.length){
    console.error('\n✗ 以下模块的代码没有真正进入 bundle：');
    for(const s of missing.slice(0, 20)) console.error('   ' + s);
    if(missing.length > 20) console.error(`   …另有 ${missing.length - 20} 项`);
    console.error('  单文件版会在运行时报 ReferenceError，而源码模式看不出来。\n');
    process.exit(1);
  }
})();

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
// 增量策略：dist/assets 已存在且文件数一致则跳过整目录复制（cpSync 大批量小文件复制易被安全软件静默终止）
const assetsSrc = path.join(root, 'assets');
const assetsDst = path.join(root, 'dist/assets');
function countFiles(dir){
  let n = 0;
  if(!fs.existsSync(dir)) return 0;
  for(const e of fs.readdirSync(dir, { withFileTypes: true })){
    const p = path.join(dir, e.name);
    if(e.isDirectory()) n += countFiles(p);
    else n++;
  }
  return n;
}
if(fs.existsSync(assetsSrc)){
  const srcCount = countFiles(assetsSrc);
  const dstCount = countFiles(assetsDst);
  if(dstCount !== srcCount){
    // 逐文件增量复制（只补缺失项）。fs.cpSync 整目录复制 800+ 文件会触发
    // 本机安全软件的批量写拦截，进程被无声杀死（exit 127，无任何输出）。
    let copied = 0, failed = 0;
    const copyMissing = (src, dst) => {
      for(const e of fs.readdirSync(src, { withFileTypes: true })){
        const sp = path.join(src, e.name);
        const dp = path.join(dst, e.name);
        if(e.isDirectory()){
          if(!fs.existsSync(dp)) fs.mkdirSync(dp, { recursive: true });
          copyMissing(sp, dp);
        } else {
          if(fs.existsSync(dp)) continue;
          try { fs.copyFileSync(sp, dp); copied++; }
          catch(err){ failed++; }
        }
      }
    };
    copyMissing(assetsSrc, assetsDst);
    console.log(`资产增量同步: 补齐 ${copied} 个缺失文件${failed ? `（失败 ${failed}）` : ''}`);
  } else {
    console.log(`资产目录已完整 (${srcCount} 文件)，跳过复制`);
  }
}

function buildHtml(targetFile, defaultScenario = null){
  let html = indexHtml
    .replace('<link rel="stylesheet" href="css/tokens.css">', '')
    .replace('<link rel="stylesheet" href="css/screens.css">', '')
    .replace('<link rel="stylesheet" href="css/era.css">', '')
    .replace('<link rel="stylesheet" href="css/style.css">',
    '<style>\n' + css + '\n</style>');
  let customCode = bundleCode;
  if(defaultScenario){
    customCode += `\n/* 覆盖开局默认剧本为: ${defaultScenario} */\nif(typeof loadScenario === 'function' && typeof state !== 'undefined'){ state.world = loadScenario('${defaultScenario}', 42); }\n`;
  }
  html = html.replace('<script type="module" src="js/main.js"></script>',
    '<script>\n' + customCode + '\n</script>');

  const outPath = path.join(root, 'dist', targetFile);
  fs.writeFileSync(outPath, html, 'utf8');
  const sizeKb = Math.round(fs.statSync(outPath).size / 1024);
  console.log(`✓ 打包输出: dist/${targetFile.padEnd(18)} (${sizeKb} KB)`);
  return sizeKb;
}

console.log('=== 开始构建多入口单文件分发包 ===');
const sizes = {};
sizes['steel-front.html'] = buildHtml('steel-front.html');
sizes['ww1.html'] = buildHtml('ww1.html', 'ww1');
sizes['ww2.html'] = buildHtml('ww2.html', 'ww2');
sizes['coldwar.html'] = buildHtml('coldwar.html', 'coldwar');
sizes['modern.html'] = buildHtml('modern.html', 'modern');

console.log('\n=== dist 分发包文件大小表 ===');
for(const name in sizes){
  console.log(`  ${name.padEnd(20)}: ${sizes[name]} KB`);
}
