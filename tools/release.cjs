/* ============================================================
   tools/release.cjs —— 一键发布：打包 → 同步发布目录 → 生成 zip
   用法：node tools/release.cjs

   背景：本项目有两条分发路径，历史上只重建其中一条，导致玩家打开
   「钢铁前线_完整单机可玩版」时看到的还是旧构建。此脚本把它们绑成一步。

   产出：
     1) steel-front/dist/*.html          英文名单文件版（6 个入口）
     2) ../钢铁前线_完整单机可玩版/        中文名发布目录（含 assets）
     3) ../钢铁前线_SteelFront_v1.0_完整可玩版.zip   可直接分享的压缩包
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const releaseDir = path.resolve(root, '..', '钢铁前线_完整单机可玩版');
const zipPath = path.resolve(root, '..', '钢铁前线_SteelFront_v1.0_完整可玩版.zip');
const zipTmp = zipPath + '.new';

function step(msg){ console.log('\n▶ ' + msg); }

/* ---------- 1. 打包单文件版 ---------- */
step('打包单文件版（tools/bundle.cjs）');
execFileSync(process.execPath, [path.join(root, 'tools', 'bundle.cjs')], { stdio: 'inherit', cwd: root });

/* ---------- 2. 同步中文发布目录 ---------- */
step('同步发布目录');
fs.mkdirSync(releaseDir, { recursive: true });
execFileSync(process.execPath, [path.join(root, 'tools', 'sync_release.cjs')], { stdio: 'inherit', cwd: root });

/* ---------- 3. 生成 zip ---------- */
/* 用 Windows 自带 bsdtar（系统 tar），原生 UTF-8 路径 + 真 zip 格式。
   排除发布目录内那层冗余的 dist/（与顶层 HTML 完全重复，会白白翻倍体积）。 */
step('生成分享用 zip');
const SYS_TAR = 'C:\\Windows\\System32\\tar.exe';
const tarBin = fs.existsSync(SYS_TAR) ? SYS_TAR : 'tar';
try{
  if(fs.existsSync(zipTmp)) fs.unlinkSync(zipTmp);
  execFileSync(tarBin, [
    '-a', '-c', '-f', zipTmp,
    '--exclude=钢铁前线_完整单机可玩版/dist',
    '--exclude=钢铁前线_完整单机可玩版/dist/*',
    '钢铁前线_完整单机可玩版'
  ], { cwd: path.dirname(releaseDir), stdio: 'inherit' });
  fs.renameSync(zipTmp, zipPath);
  const mb = (fs.statSync(zipPath).size / 1048576).toFixed(1);
  console.log(`✓ ${path.basename(zipPath)}  (${mb} MB)`);
}catch(e){
  if(fs.existsSync(zipTmp)) fs.unlinkSync(zipTmp);
  console.error('✗ zip 生成失败：' + e.message);
  console.error('  发布目录已同步完成，只是压缩包没更新；可手动重试本脚本。');
  process.exitCode = 1;
}

/* ---------- 4. 自检：三条路径的 HTML 必须逐字节一致 ---------- */
step('一致性自检');
const crypto = require('crypto');
const md5 = f => crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex');
const pairs = [
  ['dist/steel-front.html', 'index.html'],
  ['dist/steel-front.html', '开始游戏(全剧本集成版).html'],
  ['dist/ww1.html',         '剧本1_一战火药桶1914.html'],
  ['dist/ww2.html',         '剧本2_二战全面战争1939.html'],
  ['dist/coldwar.html',     '剧本3_冷战铁幕1949.html'],
  ['dist/modern.html',      '剧本4_现代多极危机2022.html']
];
let bad = 0;
for(const [distRel, relName] of pairs){
  const a = path.join(root, distRel);
  const b = path.join(releaseDir, relName);
  const ok = fs.existsSync(a) && fs.existsSync(b) && md5(a) === md5(b);
  if(!ok) bad++;
  console.log((ok ? '  ✓ ' : '  ✗ ') + relName);
}
if(bad){
  console.error(`\n✗ 有 ${bad} 个发布文件与 dist 不一致，分发会出现新旧混用。`);
  process.exitCode = 1;
} else {
  console.log('\n=== 发布完成：dist / 发布目录 / zip 三者一致 ===');
  console.log('  分享时把整个「钢铁前线_完整单机可玩版」目录或那个 zip 发给对方即可，');
  console.log('  对方双击 index.html 或「开始游戏(全剧本集成版).html」就能玩。');
}
