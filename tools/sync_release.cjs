const fs = require('fs');
const path = require('path');

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const releaseDir = path.resolve('../钢铁前线_完整单机可玩版');
console.log('Syncing assets to:', releaseDir);

// 1. Sync assets
copyDirRecursive('assets', path.join(releaseDir, 'assets'));
console.log('✓ Assets synchronized.');

// 2. Sync html files
fs.copyFileSync('dist/steel-front.html', path.join(releaseDir, 'index.html'));
fs.copyFileSync('dist/steel-front.html', path.join(releaseDir, '开始游戏(全剧本集成版).html'));
fs.copyFileSync('dist/ww1.html', path.join(releaseDir, '剧本1_一战火药桶1914.html'));
fs.copyFileSync('dist/ww2.html', path.join(releaseDir, '剧本2_二战全面战争1939.html'));
fs.copyFileSync('dist/coldwar.html', path.join(releaseDir, '剧本3_冷战铁幕1949.html'));
fs.copyFileSync('dist/modern.html', path.join(releaseDir, '剧本4_现代多极危机2022.html'));
console.log('✓ Bundled HTML entrypoints synchronized.');

console.log('Release package sync complete!');
