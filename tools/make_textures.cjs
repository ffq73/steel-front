// tools/make_textures.cjs —— 生成四张 1024x1024 无缝平铺高精材质砖 (v10.0 P1)
// 1. parchment.jpg: 羊皮纸纤维纹理
// 2. wood_desk.jpg: 参谋桌深木纹
// 3. canvas.jpg: 军用帆布织纹
// 4. sea_ripple.jpg: 静谧海面微波纹理

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SIZE = 1024;
const OUT_DIR = path.join(__dirname, '../assets/textures');
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

// 周期性（环形）噪声生成器，保证 [0, SIZE) 在 x 和 y 方向完全周期连续平铺
function periodicNoise(x, y, w, h, freqX, freqY, phase = 0) {
  const u = (x / w) * Math.PI * 2 * freqX;
  const v = (y / h) * Math.PI * 2 * freqY;
  // 4D 环形嵌入采样
  const n1 = Math.sin(u + phase) * Math.cos(v - phase);
  const n2 = Math.cos(u * 2 - phase) * Math.sin(v * 2 + phase);
  const n3 = Math.sin(u * 4 + v * 3);
  return (n1 * 0.5 + n2 * 0.35 + n3 * 0.15);
}

// 边缘平滑无缝交叉混叠，保证四边完全无缝平铺
function makeSeamless(buf, w, h, blendSize = 64) {
  for (let y = 0; y < h; y++) {
    for (let c = 0; c < 3; c++) {
      for (let i = 0; i < blendSize; i++) {
        const t = (1 - Math.cos((i / blendSize) * Math.PI)) * 0.5; // 0 (edge) to 1 (inside)
        const leftIdx = (y * w + i) * 3 + c;
        const rightIdx = (y * w + (w - 1 - i)) * 3 + c;
        const vL = buf[leftIdx];
        const vR = buf[rightIdx];
        const avg = (vL + vR) * 0.5;
        buf[leftIdx] = Math.round(vL * t + avg * (1 - t));
        buf[rightIdx] = Math.round(vR * t + avg * (1 - t));
      }
    }
  }
  for (let x = 0; x < w; x++) {
    for (let c = 0; c < 3; c++) {
      for (let i = 0; i < blendSize; i++) {
        const t = (1 - Math.cos((i / blendSize) * Math.PI)) * 0.5;
        const topIdx = (i * w + x) * 3 + c;
        const btmIdx = ((h - 1 - i) * w + x) * 3 + c;
        const vT = buf[topIdx];
        const vB = buf[btmIdx];
        const avg = (vT + vB) * 0.5;
        buf[topIdx] = Math.round(vT * t + avg * (1 - t));
        buf[btmIdx] = Math.round(vB * t + avg * (1 - t));
      }
    }
  }
}

// 多八度周期 FBM
function periodicFBM(x, y, w, h, octaves = 4, lacunarity = 2.0, gain = 0.5) {
  let sum = 0, amp = 1, max = 0;
  for (let i = 0; i < octaves; i++) {
    const freq = Math.pow(2, i);
    sum += periodicNoise(x, y, w, h, freq, freq, i * 1.37) * amp;
    max += amp;
    amp *= gain;
  }
  return sum / max;
}

// 1. 羊皮纸纹 (Parchment)
async function generateParchment() {
  const buf = Buffer.alloc(SIZE * SIZE * 3);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const idx = (y * SIZE + x) * 3;
      const fbm = periodicFBM(x, y, SIZE, SIZE, 5, 2.0, 0.55); // -1 ~ 1
      const fbmFine = periodicFBM(x, y, SIZE, SIZE, 16, 2.0, 0.5);
      
      // 纤维杂点
      const speck = ((Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1) * 0.08;

      const factor = 1.0 + fbm * 0.12 + fbmFine * 0.05 + speck;
      
      // 暖象牙/老羊皮纸色基准：R: 228, G: 218, B: 196
      const r = Math.min(255, Math.max(0, Math.round(228 * factor)));
      const g = Math.min(255, Math.max(0, Math.round(218 * factor * 0.99)));
      const b = Math.min(255, Math.max(0, Math.round(196 * factor * 0.96)));

      buf[idx] = r;
      buf[idx + 1] = g;
      buf[idx + 2] = b;
    }
  }
  makeSeamless(buf, SIZE, SIZE);
  const dest = path.join(OUT_DIR, 'parchment.jpg');
  await sharp(buf, { raw: { width: SIZE, height: SIZE, channels: 3 } })
    .jpeg({ quality: 92 })
    .toFile(dest);
  console.log('✓ 生成:', dest);
}

// 2. 参谋桌深胡桃木纹 (Wood Desk)
async function generateWoodDesk() {
  const buf = Buffer.alloc(SIZE * SIZE * 3);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const idx = (y * SIZE + x) * 3;
      // 木纹沿 y 轴延伸，x 轴方向有年轮环
      const turb = periodicFBM(x, y, SIZE, SIZE, 3, 2.0, 0.5) * 4.0;
      const fineGrain = periodicNoise(x, y, SIZE, SIZE, 48, 2, 0.5) * 0.25;
      const ring = Math.sin((x / SIZE * Math.PI * 16) + turb + fineGrain);
      
      const v = (ring + 1) * 0.5; // 0 ~ 1
      const factor = 0.75 + v * 0.35 + fineGrain * 0.1;

      // 深胡桃木基色: R: 42, G: 31, B: 24
      const r = Math.min(255, Math.max(0, Math.round(44 * factor)));
      const g = Math.min(255, Math.max(0, Math.round(33 * factor)));
      const b = Math.min(255, Math.max(0, Math.round(25 * factor)));

      buf[idx] = r;
      buf[idx + 1] = g;
      buf[idx + 2] = b;
    }
  }
  makeSeamless(buf, SIZE, SIZE);
  const dest = path.join(OUT_DIR, 'wood_desk.jpg');
  await sharp(buf, { raw: { width: SIZE, height: SIZE, channels: 3 } })
    .jpeg({ quality: 92 })
    .toFile(dest);
  console.log('✓ 生成:', dest);
}

// 3. 军用橄榄绿帆布织纹 (Canvas)
async function generateCanvas() {
  const buf = Buffer.alloc(SIZE * SIZE * 3);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const idx = (y * SIZE + x) * 3;
      // 织物经纬线周期 (约 8 像素一个经纬线网眼)
      const wx = Math.sin((x / SIZE) * Math.PI * 2 * 128);
      const wy = Math.sin((y / SIZE) * Math.PI * 2 * 128);
      const weave = (wx * wy) * 0.35;
      const rough = periodicFBM(x, y, SIZE, SIZE, 8, 2.0, 0.4) * 0.15;

      const factor = 1.0 + weave + rough;

      // 军用橄榄绿基色: R: 52, G: 62, B: 48
      const r = Math.min(255, Math.max(0, Math.round(52 * factor)));
      const g = Math.min(255, Math.max(0, Math.round(62 * factor)));
      const b = Math.min(255, Math.max(0, Math.round(48 * factor)));

      buf[idx] = r;
      buf[idx + 1] = g;
      buf[idx + 2] = b;
    }
  }
  makeSeamless(buf, SIZE, SIZE);
  const dest = path.join(OUT_DIR, 'canvas.jpg');
  await sharp(buf, { raw: { width: SIZE, height: SIZE, channels: 3 } })
    .jpeg({ quality: 92 })
    .toFile(dest);
  console.log('✓ 生成:', dest);
}

// 4. 静谧深海波纹 (Sea Ripple)
async function generateSeaRipple() {
  const buf = Buffer.alloc(SIZE * SIZE * 3);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const idx = (y * SIZE + x) * 3;
      // 多向周期海浪波纹
      const w1 = periodicNoise(x, y, SIZE, SIZE, 8, 12, 0);
      const w2 = periodicNoise(x, y, SIZE, SIZE, 14, 7, 1.2);
      const w3 = periodicNoise(x, y, SIZE, SIZE, 20, 20, 2.5);
      const wave = (w1 * 0.5 + w2 * 0.35 + w3 * 0.15);

      const factor = 1.0 + wave * 0.22;

      // 深邃海蓝基色: R: 14, G: 28, B: 46
      const r = Math.min(255, Math.max(0, Math.round(14 * factor)));
      const g = Math.min(255, Math.max(0, Math.round(28 * factor)));
      const b = Math.min(255, Math.max(0, Math.round(46 * factor)));

      buf[idx] = r;
      buf[idx + 1] = g;
      buf[idx + 2] = b;
    }
  }
  makeSeamless(buf, SIZE, SIZE);
  const dest = path.join(OUT_DIR, 'sea_ripple.jpg');
  await sharp(buf, { raw: { width: SIZE, height: SIZE, channels: 3 } })
    .jpeg({ quality: 92 })
    .toFile(dest);
  console.log('✓ 生成:', dest);
}

async function main() {
  console.log('开始生成四张 1024x1024 无缝平铺高精材质砖...');
  await generateParchment();
  await generateWoodDesk();
  await generateCanvas();
  await generateSeaRipple();
  console.log('全部 4 张材质砖生成完毕！');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
