#!/usr/bin/env node
/**
 * Builds the transparent character placeholder from the reference render.
 *
 *   node scripts/cutout-character.mjs <source.png> [outDir]
 *
 * The reference render has a flat near-white background. We flood-fill from the
 * image border through near-white pixels only (strict threshold), so the white
 * sneakers survive even where their outline is faint. The soft floor shadow
 * around the feet is converted into a translucent black shadow so it composites
 * on any background.
 *
 * Output (public/images/character/):
 *   placeholder.webp       — trimmed RGBA cut-out, 1400px tall (WebGL texture + <Image>)
 *   placeholder.meta.json  — pixel size + normalized foot baseline for scene placement
 *
 * This is a 2D stand-in. It is NOT a 3D character and has no skeleton.
 */
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const src = process.argv[2];
const outDir = process.argv[3] || 'public/images/character';
if (!src) {
  console.error('usage: node scripts/cutout-character.mjs <source.png> [outDir]');
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });

const { data, info } = await sharp(src).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width;
const H = info.height;
const px = (i) => [data[i * 3], data[i * 3 + 1], data[i * 3 + 2]];

// Luminance + Sobel gradient. The gradient acts as a barrier so the fill cannot
// slip through the faint outline of the white sneakers.
const L = new Float32Array(W * H);
for (let i = 0; i < W * H; i++) {
  const [r, g, b] = px(i);
  L[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const G = new Float32Array(W * H);
for (let y = 1; y < H - 1; y++) {
  for (let x = 1; x < W - 1; x++) {
    const i = y * W + x;
    const gx = L[i - W + 1] + 2 * L[i + 1] + L[i + W + 1] - L[i - W - 1] - 2 * L[i - 1] - L[i + W - 1];
    const gy = L[i + W - 1] + 2 * L[i + W] + L[i + W + 1] - L[i - W - 1] - 2 * L[i - W] - L[i - W + 1];
    G[i] = (Math.abs(gx) + Math.abs(gy)) / 8;
  }
}
// Dilate the gradient by 1px so thin outlines become solid walls.
const Gd = new Float32Array(W * H);
for (let y = 1; y < H - 1; y++) {
  for (let x = 1; x < W - 1; x++) {
    const i = y * W + x;
    let m = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) m = Math.max(m, G[i + dy * W + dx]);
    Gd[i] = m;
  }
}

// 1 = background (strict near-white, flat, connected to the border)
const bg = new Uint8Array(W * H);
const isNearWhite = (i) => {
  const [r, g, b] = px(i);
  const mn = Math.min(r, g, b);
  const mx = Math.max(r, g, b);
  return mn >= 246 && mx - mn <= 8 && Gd[i] < 1.6;
};
const queue = new Int32Array(W * H);
let qh = 0;
let qt = 0;
const seed = (i) => {
  if (!bg[i] && isNearWhite(i)) {
    bg[i] = 1;
    queue[qt++] = i;
  }
};
for (let x = 0; x < W; x++) {
  seed(x);
  seed((H - 1) * W + x);
}
for (let y = 0; y < H; y++) {
  seed(y * W);
  seed(y * W + W - 1);
}
while (qh < qt) {
  const i = queue[qh++];
  const x = i % W;
  const y = (i / W) | 0;
  if (x > 0) seed(i - 1);
  if (x < W - 1) seed(i + 1);
  if (y > 0) seed(i - W);
  if (y < H - 1) seed(i + W);
}

// Enclosed background holes (e.g. the gap between the legs): flat, very bright
// components that never touch the border. Shoe uppers are shaded, so they fail
// the flatness test or stay below the area threshold.
{
  const seen = new Uint8Array(W * H);
  const comp = new Int32Array(W * H);
  for (let start = 0; start < W * H; start++) {
    if (bg[start] || seen[start]) continue;
    const [r, g, b] = px(start);
    if (Math.min(r, g, b) < 250 || Gd[start] > 0.9) continue;
    let n = 0;
    let h = 0;
    comp[n++] = start;
    seen[start] = 1;
    let sumL = 0;
    while (h < n) {
      const i = comp[h++];
      sumL += L[i];
      const x = i % W;
      const y = (i / W) | 0;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) {
        if (j < 0 || seen[j] || bg[j]) continue;
        const [r2, g2, b2] = px(j);
        if (Math.min(r2, g2, b2) >= 248 && Gd[j] < 1.2) {
          seen[j] = 1;
          comp[n++] = j;
        }
      }
    }
    if (n > 2500 && sumL / n > 252.5) for (let k = 0; k < n; k++) bg[comp[k]] = 1;
  }
}

// 2 = floor shadow: grey, unsaturated, connected to background, below the ankles,
// and lighter than the sneaker outlines. Grown from the background with a
// gradient guard so it stops at the sole edges.
const SHADOW_TOP = Math.round(H * 0.905);
const lum = (i) => {
  const [r, g, b] = px(i);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const isShadow = (i, from) => {
  const [r, g, b] = px(i);
  const mn = Math.min(r, g, b);
  const mx = Math.max(r, g, b);
  if (mx - mn > 12 || mn < 196) return false;
  // Shadows change slowly; sole edges are sharp.
  return Gd[i] < 2.0 && Math.abs(lum(i) - lum(from)) < 2.4;
};
qh = 0;
qt = 0;
for (let y = SHADOW_TOP; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (bg[i] === 1) queue[qt++] = i;
  }
}
while (qh < qt) {
  const i = queue[qh++];
  const x = i % W;
  const y = (i / W) | 0;
  const nb = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > SHADOW_TOP ? i - W : -1, y < H - 1 ? i + W : -1];
  for (const n of nb) {
    if (n < 0 || bg[n]) continue;
    if (isShadow(n, i)) {
      bg[n] = 2;
      queue[qt++] = n;
    }
  }
}

// Speckle cleanup in the shadow zone: a figure pixel mostly surrounded by shadow
// is a shadow pixel the gradient guard rejected. Majority filter, a few rounds.
for (let round = 0; round < 4; round++) {
  const flip = [];
  for (let y = Math.max(2, SHADOW_TOP - 20); y < H - 2; y++) {
    for (let x = 2; x < W - 2; x++) {
      const i = y * W + x;
      if (bg[i] !== 0) continue;
      let s = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (bg[i + dy * W + dx] !== 0) s++;
      const [r, g, b] = px(i);
      if (s >= 15 && Math.max(r, g, b) - Math.min(r, g, b) <= 14) flip.push(i);
    }
  }
  for (const i of flip) bg[i] = 2;
}

// Fringe cleanup: bright, unsaturated figure pixels touching the background are
// anti-aliasing leftovers from the white backdrop. Peel two layers.
for (let pass = 0; pass < 3; pass++) {
  const peel = [];
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (bg[i] !== 0) continue;
      const touches = bg[i - 1] === 1 || bg[i + 1] === 1 || bg[i - W] === 1 || bg[i + W] === 1;
      if (!touches) continue;
      const [r, g, b] = px(i);
      const mn = Math.min(r, g, b);
      const mx = Math.max(r, g, b);
      if (mn >= 222 - pass * 6 && mx - mn <= 14) peel.push(i);
    }
  }
  for (const i of peel) bg[i] = 1;
}

// Compose RGBA. Figure pixels opaque; shadow pixels become black with alpha from darkness.
const rgba = Buffer.alloc(W * H * 4);
const alphaMask = Buffer.alloc(W * H);
for (let i = 0; i < W * H; i++) {
  const [r, g, b] = px(i);
  if (bg[i] === 0) {
    rgba[i * 4] = r;
    rgba[i * 4 + 1] = g;
    rgba[i * 4 + 2] = b;
    alphaMask[i] = 255;
  } else if (bg[i] === 2) {
    const a = Math.max(0, Math.min(1, (252 - lum(i)) / 60));
    rgba[i * 4] = 18;
    rgba[i * 4 + 1] = 18;
    rgba[i * 4 + 2] = 20;
    alphaMask[i] = Math.round(a * 0.9 * 255);
  } else {
    alphaMask[i] = 0;
  }
}

// Soften the figure edge by ~1px so the strict mask doesn't alias.
const soft = await sharp(alphaMask, { raw: { width: W, height: H, channels: 1 } })
  .blur(0.7)
  .extractChannel(0)
  .raw()
  .toBuffer({ resolveWithObject: true });
const sc = soft.info.channels;
for (let i = 0; i < W * H; i++) rgba[i * 4 + 3] = bg[i] === 0 ? soft.data[i * sc] : alphaMask[i];

// Trim to content bounds (alpha > 8) with a little padding.
let minX = W;
let minY = H;
let maxX = 0;
let maxY = 0;
let footY = 0;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (rgba[i * 4 + 3] > 8) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    if (bg[i] === 0 && y > footY) footY = y;
  }
}
const pad = 8;
minX = Math.max(0, minX - pad);
minY = Math.max(0, minY - pad);
maxX = Math.min(W - 1, maxX + pad);
maxY = Math.min(H - 1, maxY + pad);
const cw = maxX - minX + 1;
const ch = maxY - minY + 1;

const TARGET_H = 1400;
const scale = TARGET_H / ch;
const outW = Math.round(cw * scale);
await sharp(rgba, { raw: { width: W, height: H, channels: 4 } })
  .extract({ left: minX, top: minY, width: cw, height: ch })
  .resize(outW, TARGET_H, { kernel: 'lanczos3' })
  .webp({ quality: 88, alphaQuality: 100, effort: 6 })
  .toFile(path.join(outDir, 'placeholder.webp'));

const meta = {
  source: path.basename(src),
  width: outW,
  height: TARGET_H,
  aspect: +(outW / TARGET_H).toFixed(5),
  // Normalized (0 top .. 1 bottom) row of the lowest opaque sole pixel.
  footY: +((footY - minY) / ch).toFixed(5),
  note: '2D placeholder cut-out. Not a rigged 3D character.',
};
fs.writeFileSync(path.join(outDir, 'placeholder.meta.json'), JSON.stringify(meta, null, 2));
console.log(meta);
