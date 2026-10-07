/* 资产健康巡检：扫描代码中引用的 assets/ 路径，报告缺失文件（等价 sf_check_health 的 brokenImages） */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SCAN_EXT = ['.js', '.html', '.css'];

const refs = new Set();
function walk(dir){
  for(const e of fs.readdirSync(dir, { withFileTypes: true })){
    if(e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if(e.isDirectory()) walk(p);
    else if(SCAN_EXT.includes(path.extname(e.name))){
      const s = fs.readFileSync(p, 'utf-8');
      for(const m of s.matchAll(/assets\/[\w\-./\u4e00-\u9fff]+\.(?:png|jpg|jpeg|svg|webp|mp3|wav)/g)){
        refs.add(m[0]);
      }
    }
  }
}
walk(path.join(ROOT, 'js'));
{
  const s = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf-8');
  for(const m of s.matchAll(/assets\/[\w\-./\u4e00-\u9fff]+\.(?:png|jpg|jpeg|svg|webp|mp3|wav)/g)){
    refs.add(m[0]);
  }
}

const missing = [], ok = [];
for(const r of refs){
  const clean = r.split(/['"`)\s]/)[0];
  if(fs.existsSync(path.join(ROOT, clean))) ok.push(clean);
  else missing.push(clean);
}

// manifest 中登记的文件是否存在于磁盘
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/manifest.json'), 'utf-8'));
const manifestMissing = [];
for(const e of (manifest.entries || [])){
  const p = typeof e === 'string' ? e : (e.path || e.file || e.src);
  if(p && !fs.existsSync(path.join(ROOT, p))) manifestMissing.push(p);
}

console.log(`引用扫描: ${refs.size} 条资产引用`);
console.log(`OK 存在: ${ok.length}`);
console.log(`MISSING 缺失: ${missing.length}`);
if(missing.length){
  for(const m of missing.slice(0, 30)) console.log('  MISSING:', m);
}
console.log(`manifest 登记 ${manifest.entries.length} 项，磁盘缺失 ${manifestMissing.length}`);
if(manifestMissing.length){
  for(const m of manifestMissing.slice(0, 10)) console.log('  MANIFEST_MISSING:', m);
}
process.exit(missing.length ? 1 : 0);
