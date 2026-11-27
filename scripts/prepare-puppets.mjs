#!/usr/bin/env node
/**
 * Layered 2D puppets from the dedicated pose renders (local, free: sharp only).
 *
 *   npm run assets:puppets                 all puppets in assets-src/character/puppets.json
 *   npm run assets:puppets -- --only desk  one puppet
 *   npm run assets:puppets -- --debug      also write layer previews to assets-src/character/debug/puppets
 *
 * Per puppet:
 *   1. load (optionally mirror, restoring logo patches so they read correctly)
 *   2. gentle colour correction toward the reference render (hoodie / skin / trousers)
 *   3. remove unwanted pixels: colour-flooded props (the beige seat), backdrop
 *      outside the `keep` polygons, erased objects (inpainted where they sat on the desk)
 *   4. edge matting against the local removed colour (no halos, no white/dark rims)
 *   5. split into layers (back → front, front-most polygon wins) and paint the
 *      parts each layer hides behind the layers in front (`fill`), so limbs can move
 *   6. bleed edge colours into transparent texels (no fringes under GPU filtering)
 *   7. crop + resize each layer → WebP, coverage grid per layer, manifest
 *
 * Originals in assets-src/ are never modified.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const CONFIG = path.join(ROOT, 'assets-src/character/puppets.json');
const DEBUG_DIR = path.join(ROOT, 'assets-src/character/debug/puppets');
const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const debug = args.includes('--debug');
const cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
const r4 = (n) => Math.round(n * 1e4) / 1e4;

/* ---------------- geometry helpers ---------------- */
function inPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
/** Anti-aliased polygon coverage (4×4 supersampling on edge pixels), 0..1 per pixel. */
function rasterize(poly, W, H) {
  const out = new Float32Array(W * H);
  let minX = W, minY = H, maxX = 0, maxY = 0;
  for (const [x, y] of poly) {
    minX = Math.min(minX, Math.floor(x)); maxX = Math.max(maxX, Math.ceil(x));
    minY = Math.min(minY, Math.floor(y)); maxY = Math.max(maxY, Math.ceil(y));
  }
  minX = Math.max(0, minX - 1); minY = Math.max(0, minY - 1); maxX = Math.min(W - 1, maxX + 1); maxY = Math.min(H - 1, maxY + 1);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const c = inPoly(x + 0.5, y + 0.5, poly);
      // cheap interior test: all four corners agree with the centre → no supersampling
      const a = inPoly(x, y, poly), b = inPoly(x + 1, y, poly), d = inPoly(x, y + 1, poly), e = inPoly(x + 1, y + 1, poly);
      if (a === c && b === c && d === c && e === c) {
        out[y * W + x] = c ? 1 : 0;
        continue;
      }
      let n = 0;
      for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) if (inPoly(x + (sx + 0.5) / 4, y + (sy + 0.5) / 4, poly)) n++;
      out[y * W + x] = n / 16;
    }
  }
  return out;
}
const mirrorPts = (pts, W) => pts.map(([x, y]) => [W - 1 - x, y]);

/* ---------------- image helpers ---------------- */
const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/**
 * Pull-push fill: every pixel with weight 0 receives a smooth interpolation of
 * the weighted pixels around it (multi-resolution). `w` = per-pixel weight.
 */
function pullPush(rgb, w, W, H) {
  const levels = [{ rgb: Float32Array.from(rgb), w: Float32Array.from(w), W, H }];
  for (let i = 0; i < W * H; i++) for (let c = 0; c < 3; c++) levels[0].rgb[i * 3 + c] *= w[i];
  while (levels.at(-1).W > 1 || levels.at(-1).H > 1) {
    const p = levels.at(-1);
    const nW = Math.max(1, Math.ceil(p.W / 2));
    const nH = Math.max(1, Math.ceil(p.H / 2));
    const nrgb = new Float32Array(nW * nH * 3);
    const nw = new Float32Array(nW * nH);
    for (let y = 0; y < p.H; y++) for (let x = 0; x < p.W; x++) {
      const s = y * p.W + x;
      const d = (y >> 1) * nW + (x >> 1);
      nw[d] += p.w[s];
      for (let c = 0; c < 3; c++) nrgb[d * 3 + c] += p.rgb[s * 3 + c];
    }
    levels.push({ rgb: nrgb, w: nw, W: nW, H: nH });
  }
  // push: coarse → fine; empty texels take the bilinearly sampled parent (smooth, no blocks)
  for (let l = levels.length - 2; l >= 0; l--) {
    const p = levels[l + 1];
    const q = levels[l];
    const norm = new Float32Array(p.W * p.H * 3);
    for (let i = 0; i < p.W * p.H; i++) {
      const pw = p.w[i] || 1e-9;
      for (let c = 0; c < 3; c++) norm[i * 3 + c] = p.rgb[i * 3 + c] / pw;
    }
    for (let y = 0; y < q.H; y++) for (let x = 0; x < q.W; x++) {
      const i = y * q.W + x;
      if (q.w[i] >= 1) continue;
      const fx = Math.min(p.W - 1, Math.max(0, (x + 0.5) / 2 - 0.5));
      const fy = Math.min(p.H - 1, Math.max(0, (y + 0.5) / 2 - 0.5));
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      const x1 = Math.min(p.W - 1, x0 + 1), y1 = Math.min(p.H - 1, y0 + 1);
      const tx = fx - x0, ty = fy - y0;
      const k = 1 - q.w[i];
      for (let c = 0; c < 3; c++) {
        const v = (norm[(y0 * p.W + x0) * 3 + c] * (1 - tx) + norm[(y0 * p.W + x1) * 3 + c] * tx) * (1 - ty) + (norm[(y1 * p.W + x0) * 3 + c] * (1 - tx) + norm[(y1 * p.W + x1) * 3 + c] * tx) * ty;
        q.rgb[i * 3 + c] += v * k;
      }
      q.w[i] = 1;
    }
  }
  const out = new Float32Array(W * H * 3);
  const L0 = levels[0];
  for (let i = 0; i < W * H; i++) for (let c = 0; c < 3; c++) out[i * 3 + c] = L0.rgb[i * 3 + c] / (L0.w[i] || 1);
  return out;
}

/** Normalised convolution: smooth colour field from sparse samples (box blur at 1/8 resolution). */
function colourField(rgb, mask, W, H, radius = 5) {
  const s = 8;
  const w = Math.ceil(W / s);
  const h = Math.ceil(H / s);
  const acc = new Float32Array(w * h * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!mask[i]) continue;
    const d = ((y / s) | 0) * w + ((x / s) | 0);
    acc[d * 4] += rgb[i * 3]; acc[d * 4 + 1] += rgb[i * 3 + 1]; acc[d * 4 + 2] += rgb[i * 3 + 2]; acc[d * 4 + 3] += 1;
  }
  const blur = new Float32Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 4;
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      const yy = y + dy, xx = x + dx;
      if (yy < 0 || xx < 0 || yy >= h || xx >= w) continue;
      const q = (yy * w + xx) * 4;
      for (let c = 0; c < 4; c++) blur[o + c] += acc[q + c];
    }
  }
  // fill cells with no samples from the nearest filled ones (pull-push on the small grid)
  const rgbSmall = new Float32Array(w * h * 3);
  const wSmall = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (blur[i * 4 + 3] > 0) {
      for (let c = 0; c < 3; c++) rgbSmall[i * 3 + c] = blur[i * 4 + c] / blur[i * 4 + 3];
      wSmall[i] = 1;
    }
  }
  const filled = pullPush(rgbSmall, wSmall, w, h);
  return (x, y) => {
    const fx = Math.min(w - 1, Math.max(0, x / s - 0.5));
    const fy = Math.min(h - 1, Math.max(0, y / s - 0.5));
    const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1);
    const tx = fx - x0, ty = fy - y0;
    const g = (xx, yy, c) => filled[(yy * w + xx) * 3 + c];
    return [0, 1, 2].map((c) => (g(x0, y0, c) * (1 - tx) + g(x1, y0, c) * tx) * (1 - ty) + (g(x0, y1, c) * (1 - tx) + g(x1, y1, c) * tx) * ty);
  };
}

/** Distance (px, chessboard-ish two-pass) to the nearest pixel where `mask` is false. */
function distanceInside(mask, W, H) {
  const INF = 1e9;
  const d = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) d[i] = mask[i] ? INF : 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!d[i]) continue;
    if (x > 0) d[i] = Math.min(d[i], d[i - 1] + 1);
    if (y > 0) d[i] = Math.min(d[i], d[i - W] + 1);
    if (x > 0 && y > 0) d[i] = Math.min(d[i], d[i - W - 1] + 1.414);
    if (x < W - 1 && y > 0) d[i] = Math.min(d[i], d[i - W + 1] + 1.414);
  }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
    const i = y * W + x;
    if (!d[i]) continue;
    if (x < W - 1) d[i] = Math.min(d[i], d[i + 1] + 1);
    if (y < H - 1) d[i] = Math.min(d[i], d[i + W] + 1);
    if (x < W - 1 && y < H - 1) d[i] = Math.min(d[i], d[i + W + 1] + 1.414);
    if (x > 0 && y < H - 1) d[i] = Math.min(d[i], d[i + W - 1] + 1.414);
  }
  return d;
}

/* ---------------- colour correction ---------------- */
function classMedians(rgba, W, H) {
  const cls = { hoodie: [[], [], []], skin: [[], [], []], dark: [[], [], []] };
  for (let i = 0; i < W * H; i++) {
    if (rgba[i * 4 + 3] < 240) continue;
    const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), L = lum(r, g, b);
    let c = null;
    if (mx - mn < 28 && L > 80 && L < 200 && b >= g - 4) c = 'hoodie';
    else if (r > g + 25 && g > b + 8 && L > 90 && L < 215) c = 'skin';
    else if (L < 45) c = 'dark';
    if (c) for (let k = 0; k < 3; k++) cls[c][k].push([r, g, b][k]);
  }
  const med = (a) => (a.length ? a.sort((u, v) => u - v)[a.length >> 1] : null);
  return Object.fromEntries(Object.entries(cls).map(([k, v]) => [k, v[0].length > 500 ? v.map(med) : null]));
}
/**
 * Per-channel map that keeps white fixed (255 → 255, so white sneakers and
 * highlights never tint): y − 255 = k·(x − 255), k fitted on the (hoodie, skin,
 * dark) medians and blended by `amount`. Returned as [gain, offset].
 */
function colourMap(src, ref, amount) {
  const keys = Object.keys(ref).filter((k) => src[k]);
  const maps = [];
  for (let c = 0; c < 3; c++) {
    let num = 0, den = 0;
    for (const k of keys) {
      const x = src[k][c] - 255;
      const y = ref[k][c] - 255;
      num += x * y;
      den += x * x;
    }
    let kk = den > 1 ? num / den : 1;
    kk = Math.min(1.15, Math.max(0.88, kk));
    const gain = 1 + (kk - 1) * amount;
    maps.push([gain, 255 * (1 - gain)]);
  }
  return maps;
}

/* ---------------- removal rules ---------------- */
const RULES = {
  // The light beige seat in the hero render: low red-green difference (not skin), warm (not the white shoes).
  beige: (r, g, b) => {
    const L = lum(r, g, b);
    return L > 60 && r - g < 44 && r - g >= 6 && r - b >= 14 && r - b < 110 && g >= b - 4;
  },
  // Above the sneakers nothing light belongs to him except skin: any non-dark, non-skin pixel is seat.
  beigeUpper: (r, g, b) => lum(r, g, b) > 70 && r - g < 62,
  // Generated scenery behind the hero poses (sky gradient, beige sculpture hand, pale floor).
  sky: (r, g, b) => b - r > 22 && b > 140,
  beigeHand: (r, g, b) => r >= g && g >= b - 2 && r - b >= 16 && r - g < 40 && lum(r, g, b) > 55,
  floor: (r, g, b) => lum(r, g, b) > 175 && b >= g - 1 && Math.max(r, g, b) - Math.min(r, g, b) < 34,
  beigeNotSkin: (r, g, b) => r >= g && g >= b - 2 && r - b >= 12 && r - g < 22 && Math.max(r, g, b) - Math.min(r, g, b) >= 22 && lum(r, g, b) > 55,
  // The sculpture's shadowed underside: olive (green above blue); both trouser renders are neutral or cool black.
  oliveShadow: (r, g, b) => g >= b + 5 && r >= g - 3 && lum(r, g, b) < 140 && lum(r, g, b) > 42,
  // Anything light (floor + its shadows) — trousers are near-black and skin/socks are saturated warm.
  notTrouserOrSkin: (r, g, b) => lum(r, g, b) > 70 && !(r - b > 40 && r > g + 18),
  floorLavender: (r, g, b) => lum(r, g, b) > 120 && b - r >= 6 && b - g >= 5,
  floorShadow: (r, g, b) => b >= r && b >= g - 1 && Math.max(r, g, b) - Math.min(r, g, b) < 30 && lum(r, g, b) > 80,
  // Around the sneakers only the lavender-tinted floor goes (the sneakers are neutral white).
  floorTinted: (r, g, b) => lum(r, g, b) > 140 && b - r >= 3 && b - g >= 2,
  // Dark warm shading of the generated hand (trousers are cool black, skin is far redder).
  warmShadow: (r, g, b) => r >= g && g >= b - 4 && r - b >= 6 && r - g < 25 && lum(r, g, b) < 120 && lum(r, g, b) > 28,
  // Near the white sneakers: their shading picks up warm light from the seat, so demand real saturation.
  beigeStrict: (r, g, b) => {
    const L = lum(r, g, b);
    return L > 60 && Math.max(r, g, b) - Math.min(r, g, b) >= 24 && r - g < 44 && r - g >= 8 && g >= b - 4;
  },
};

/** Close pin-holes in a removal mask (shading speckle), limited to `limit` > 0.5. */
function closeHoles(removed, W, H, limit) {
  for (let pass = 0; pass < 2; pass++) {
    const add = [];
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (removed[i] || limit[i] < 0.5) continue;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) n += removed[i + dy * W + dx];
      if (n >= 6) add.push(i);
    }
    for (const i of add) removed[i] = 1;
  }
}

/* ---------------- main per puppet ---------------- */
async function buildPuppet(p) {
  const { data, info } = await sharp(path.join(ROOT, p.source)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  let rgba = Buffer.from(data);
  const M = (pts) => (p.mirror ? mirrorPts(pts, W) : pts);

  /* 1. mirror (+ restore logos that must not read backwards) */
  if (p.mirror) {
    const out = Buffer.alloc(rgba.length);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) rgba.copy(out, (y * W + (W - 1 - x)) * 4, (y * W + x) * 4, (y * W + x) * 4 + 4);
    rgba = out;
    for (const [x0, y0, x1, y1] of p.unmirror ?? []) {
      // original box → mirrored box; flip its content back in place
      const mx0 = W - 1 - x1, mx1 = W - 1 - x0;
      for (let y = y0; y <= y1; y++) for (let k = 0; k < (mx1 - mx0 + 1) >> 1; k++) {
        const a = (y * W + mx0 + k) * 4, b = (y * W + mx1 - k) * 4;
        for (let c = 0; c < 4; c++) { const t = rgba[a + c]; rgba[a + c] = rgba[b + c]; rgba[b + c] = t; }
      }
    }
  }

  const original = Buffer.from(rgba);
  /* 2. colour correction */
  const src = classMedians(rgba, W, H);
  const maps = colourMap(src, cfg.referenceColours, cfg.colourCorrection);
  for (let i = 0; i < W * H; i++) for (let c = 0; c < 3; c++) rgba[i * 4 + c] = Math.max(0, Math.min(255, Math.round(rgba[i * 4 + c] * maps[c][0] + maps[c][1])));

  const a0 = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) a0[i] = rgba[i * 4 + 3] / 255;
  const rgb = new Float32Array(W * H * 3);
  for (let i = 0; i < W * H; i++) for (let c = 0; c < 3; c++) rgb[i * 3 + c] = rgba[i * 4 + c];

  /* 3. what to remove */
  const removed = new Uint8Array(W * H); // opaque pixels that are not part of the puppet
  for (const op of p.remove ?? []) {
    // colour rule inside a polygon (e.g. the beige seat: trousers, shoes and skin fail the rule and stay)
    const m = rasterize(M(op.polygon), W, H);
    for (const ex of op.except ?? []) {
      const e = rasterize(M(ex), W, H);
      for (let i = 0; i < W * H; i++) if (e[i] > 0) m[i] = 0;
    }
    const rule = RULES[op.rule];
    for (let i = 0; i < W * H; i++) if (m[i] > 0.5 && a0[i] > 0.02 && rule(original[i * 4], original[i * 4 + 1], original[i * 4 + 2])) removed[i] = 1;
    closeHoles(removed, W, H, m);
  }
  let keep = null;
  let deskMask = null;
  if (p.keep) {
    keep = new Float32Array(W * H);
    const polys = [...p.keep.polygons, ...p.layers.filter((l) => l.polygon).map((l) => l.polygon)];
    for (const poly of polys) {
      const m = rasterize(M(poly), W, H);
      for (let i = 0; i < W * H; i++) keep[i] = Math.max(keep[i], m[i]);
    }
    deskMask = rasterize(M(p.keep.polygons[0]), W, H);
    for (let i = 0; i < W * H; i++) if (a0[i] > 0.02 && keep[i] < 0.5) removed[i] = 1;
  }
  if (p.open) {
    // Morphological opening inside a region: kept strokes thinner than ~2·radius px
    // (seam lines of the generated scenery) go; solid shapes (legs, shoes) survive.
    const m = rasterize(M(p.open.polygon), W, H);
    const r = p.open.radius ?? 2;
    const kept = (i) => !removed[i] && a0[i] > 0.5;
    const er = new Uint8Array(W * H);
    for (let y = r; y < H - r; y++) for (let x = r; x < W - r; x++) {
      const i = y * W + x;
      if (!kept(i)) continue;
      let ok = 1;
      for (let dy = -r; dy <= r && ok; dy++) for (let dx = -r; dx <= r; dx++) if (!kept(i + dy * W + dx)) { ok = 0; break; }
      er[i] = ok;
    }
    for (let y = r; y < H - r; y++) for (let x = r; x < W - r; x++) {
      const i = y * W + x;
      if (m[i] < 0.5 || !kept(i)) continue;
      let any = 0;
      for (let dy = -r; dy <= r && !any; dy++) for (let dx = -r; dx <= r; dx++) if (er[i + dy * W + dx]) { any = 1; break; }
      if (!any) removed[i] = 1;
    }
  }
  const softBoxes = (p.keep?.soft ?? []).map(([x0, y0, x1, y1, tol]) => (p.mirror ? [W - 1 - x1, y0, W - 1 - x0, y1, tol] : [x0, y0, x1, y1, tol]));
  const softBox = (x, y) => softBoxes.find(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
  const inSoft = (x, y) => Boolean(softBox(x, y));
  if (softBoxes.length) {
    // Hair against the backdrop: grow the removed region into backdrop-coloured
    // pixels (connected to it, inside the soft boxes) — gaps between curls included.
    const field = colourField(rgb, removed, W, H, 3);
    const q = [];
    for (let i = 0; i < W * H; i++) if (removed[i]) q.push(i);
    const near = (i, x, y) => {
      const [br, bg, bb] = field(x, y);
      const d = Math.max(Math.abs(rgb[i * 3] - br), Math.abs(rgb[i * 3 + 1] - bg), Math.abs(rgb[i * 3 + 2] - bb));
      const L = lum(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]);
      const box = softBox(x, y);
      return d < (box?.[4] ?? p.keep.softTolerance ?? 34) && L > (box?.[5] ?? p.keep.hairMaxL ?? 46) && L < 150;
    };
    while (q.length) {
      const i = q.pop();
      const x = i % W;
      for (const n of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
        if (n < 0 || n >= W * H || removed[n] || a0[n] < 0.02) continue;
        const nx = n % W, ny = (n / W) | 0;
        if (!inSoft(nx, ny) || !near(n, nx, ny)) continue;
        removed[n] = 1;
        q.push(n);
      }
    }
  }
  const erased = new Uint8Array(W * H);
  const withinFill = [];
  for (const e of p.erase ?? []) {
    const m = rasterize(M(e.polygon), W, H);
    for (let i = 0; i < W * H; i++) {
      if (m[i] < 0.5) continue;
      if (e.inpaint === 'within') {
        // fill only inside its object (e.g. the monitor behind the plant's leaves); elsewhere it goes
        withinFill.push([i, e]);
        continue;
      }
      if (e.inpaint && deskMask && deskMask[i] > 0.5) erased[i] = 1;
      else removed[i] = 1;
    }
  }

  /* 3a. 'within' erasures: refill from the object they cover (inside its polygon), remove the rest */
  if (withinFill.length) {
    const groups = new Map();
    for (const [i, e] of withinFill) {
      if (!groups.has(e)) groups.set(e, []);
      groups.get(e).push(i);
    }
    for (const [e, list] of groups) {
      const obj = rasterize(M(e.within), W, H);
      const hole = new Uint8Array(W * H);
      for (const i of list) hole[i] = 1;
      const w = new Float32Array(W * H);
      for (let i = 0; i < W * H; i++) w[i] = obj[i] > 0.99 && !hole[i] && !removed[i] && a0[i] > 0.9 && (!e.minL || lum(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]) > e.minL) ? 1 : 0;
      const fill = pullPush(rgb, w, W, H);
      for (const i of list) {
        if (obj[i] > 0.5) {
          for (let c = 0; c < 3; c++) rgb[i * 3 + c] = fill[i * 3 + c];
          a0[i] = 1;
          removed[i] = 0;
        } else {
          removed[i] = 1;
        }
      }
    }
  }

  /* 3b. inpaint erased desk areas: continue each row of clean wood into the hole (keeps the
   *     desk's own front-to-back gradient), with a feathered seam and fine grain */
  for (const e of p.erase ?? []) {
    if (e.inpaint !== 'rowExtend') continue;
    const m = rasterize(M(e.polygon), W, H);
    // `from` is in original orientation; mirrored images swap the side
    const fromRight = (e.from === 'right') !== Boolean(p.mirror);
    const skip = (e.skip ?? []).map(([x0, y0, x1, y1]) => (p.mirror ? [W - 1 - x1, y0, W - 1 - x0, y1] : [x0, y0, x1, y1]));
    const skipped = (x, y) => skip.some(([x0, y0, x1, y1]) => x >= x0 - 8 && x <= x1 + 8 && y >= y0 && y <= y1);
    const mine = (i) => erased[i] && m[i] > 0.5; // this erasure only (several can share a row)
    for (let y = 0; y < H; y++) {
      let x0 = -1, x1 = -1;
      for (let x = 0; x < W; x++) if (mine(y * W + x)) { if (x0 < 0) x0 = x; x1 = x; }
      if (x0 < 0) continue;
      const samples = [];
      const dir = fromRight ? 1 : -1;
      for (let x = fromRight ? x1 + 3 : x0 - 3, n = 0; x >= 0 && x < W && n < 400 && samples.length < 36; x += dir, n++) {
        const i = y * W + x;
        if (erased[i] || removed[i] || deskMask[i] < 0.99 || skipped(x, y)) continue;
        if (lum(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]) < 120) continue;
        samples.push(i);
      }
      if (!samples.length) continue;
      const med = [0, 1, 2].map((c) => samples.map((i) => rgb[i * 3 + c]).sort((a, b) => a - b)[samples.length >> 1]);
      for (let x = x0; x <= x1; x++) {
        const i = y * W + x;
        if (!mine(i)) continue;
        const grain = ((((x * 73856093) ^ (y * 19349663)) >>> 0) % 5) - 2;
        for (let c = 0; c < 3; c++) rgb[i * 3 + c] = med[c] + grain;
        a0[i] = 1;
      }
    }
    // vertical smoothing inside the filled area (rows can differ by a few levels)
    for (let pass = 0; pass < 2; pass++) for (let y = 1; y < H - 1; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!mine(i) || !mine(i - W) || !mine(i + W)) continue;
      for (let c = 0; c < 3; c++) rgb[i * 3 + c] = (rgb[(i - W) * 3 + c] + 2 * rgb[i * 3 + c] + rgb[(i + W) * 3 + c]) / 4;
    }
  }

  /* 4. matting at the boundary between kept and removed pixels:
   *    C = a·F + (1−a)·B, with B the smooth local colour of what was removed and
   *    F the colour of the NEAREST solidly-kept pixel (so a white shoe next to
   *    black trousers is judged against white, not against a grey average). */
  const alpha = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) alpha[i] = removed[i] ? 0 : a0[i] * (keep ? Math.min(1, keep[i] * 1.0001) : 1);
  if (removed.some(Boolean)) {
    const field = colourField(rgb, removed, W, H, 3);
    const notRemoved = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) notRemoved[i] = removed[i] ? 0 : 1;
    const toRemoved = distanceInside(notRemoved, W, H);
    const band = p.keep?.softBand ?? 5;
    const hairBand = p.keep?.hairBand ?? band;
    const R = (x, y) => (inSoft(x, y) ? hairBand : band);
    // nearest interior source per band pixel (multi-source BFS)
    const src = new Int32Array(W * H).fill(-1);
    const inBand = (i) => {
      const x = i % W, y = (i / W) | 0;
      if (a0[i] < 0.02) return false;
      return removed[i] ? true : toRemoved[i] <= R(x, y);
    };
    let q = [];
    for (let i = 0; i < W * H; i++) {
      if (removed[i] || a0[i] < 0.9) continue;
      const x = i % W, y = (i / W) | 0;
      if (toRemoved[i] > R(x, y) && toRemoved[i] <= R(x, y) + 2) { src[i] = i; q.push(i); }
    }
    while (q.length) {
      const next = [];
      for (const i of q) {
        const x = i % W;
        for (const n of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
          if (n < 0 || n >= W * H || src[n] >= 0 || !inBand(n)) continue;
          // removed pixels only one step beyond the kept edge
          if (removed[n] && !(toRemoved[i] > 0 || !removed[i])) continue;
          src[n] = src[i];
          next.push(n);
        }
      }
      q = next;
    }
    for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
      const i = y * W + x;
      const s = src[i];
      if (s < 0 || s === i) continue;
      if (removed[i]) {
        // removed pixels may regain partial alpha only right at the edge
        let touches = false;
        for (const n of [i - 1, i + 1, i - W, i + W]) if (!removed[n] && a0[n] > 0.5) touches = true;
        if (!touches) continue;
      }
      const fr = rgb[s * 3], fg = rgb[s * 3 + 1], fb = rgb[s * 3 + 2];
      const [br, bg, bb] = field(x, y);
      const d0 = fr - br, d1 = fg - bg, d2 = fb - bb;
      const den = d0 * d0 + d1 * d1 + d2 * d2;
      if (den < 700) continue; // too little contrast: keep the polygon/rule decision
      const c0 = rgb[i * 3] - br, c1 = rgb[i * 3 + 1] - bg, c2 = rgb[i * 3 + 2] - bb;
      const aRaw = (c0 * d0 + c1 * d1 + c2 * d2) / den;
      const a = Math.max(0, Math.min(1, aRaw));
      // A real mixed edge pixel lies on the F–B line. Far from it, it's a different
      // material (a white sneaker next to black trousers): leave it alone.
      const e0 = c0 - a * d0, e1 = c1 - a * d1, e2 = c2 - a * d2;
      if (!removed[i] && Math.sqrt(e0 * e0 + e1 * e1 + e2 * e2) > 16) continue;
      const next = removed[i] ? Math.min(a, 0.6) * a0[i] : a * a0[i];
      alpha[i] = removed[i] ? (next < 0.1 ? 0 : next) : Math.min(alpha[i], next);
      if (a > 0.12) {
        // un-mix the removed colour
        rgb[i * 3] = Math.max(0, Math.min(255, (rgb[i * 3] - (1 - a) * br) / a));
        rgb[i * 3 + 1] = Math.max(0, Math.min(255, (rgb[i * 3 + 1] - (1 - a) * bg) / a));
        rgb[i * 3 + 2] = Math.max(0, Math.min(255, (rgb[i * 3 + 2] - (1 - a) * bb) / a));
      } else {
        rgb[i * 3] = fr; rgb[i * 3 + 1] = fg; rgb[i * 3 + 2] = fb;
      }
    }
  }

  /* 4b. drop specks: small islands far from the figure */
  {
    const seen = new Uint8Array(W * H);
    const comp = [];
    const comps = [];
    for (let s = 0; s < W * H; s++) {
      if (seen[s] || alpha[s] < 0.12) continue;
      comp.length = 0;
      comp.push(s);
      seen[s] = 1;
      for (let h = 0; h < comp.length; h++) {
        const i = comp[h];
        const x = i % W;
        for (const n of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
          if (n < 0 || n >= W * H || seen[n] || alpha[n] < 0.12) continue;
          seen[n] = 1;
          comp.push(n);
        }
      }
      comps.push(comp.slice());
    }
    const largest = comps.reduce((m, c) => Math.max(m, c.length), 0);
    for (const c of comps) if (c.length < Math.max(400, largest * 0.002)) for (const i of c) alpha[i] = 0;
    for (let i = 0; i < W * H; i++) if (alpha[i] < 0.12 && !seen[i]) alpha[i] = 0;
  }

  /* 5. layers: ownership (front-most polygon wins; a layer without polygon takes the rest) */
  const layers = p.layers;
  const polyMasks = layers.map((l) => (l.polygon ? rasterize(M(l.polygon), W, H) : null));
  const owner = new Int16Array(W * H).fill(-1);
  const restIdx = layers.findIndex((l) => !l.polygon);
  for (let i = 0; i < W * H; i++) {
    if (alpha[i] <= 0) continue;
    const x = i % W, y = (i / W) | 0;
    let o = -1;
    for (let k = layers.length - 1; k >= 0; k--) {
      const m = polyMasks[k];
      if (!m || m[i] < 0.5) continue;
      const ex = layers[k].darkExclude;
      if (ex) {
        const mx = p.mirror ? W - 1 - x : x;
        if (mx >= ex.minX && y >= ex.minY && lum(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]) < ex.maxL) continue;
      }
      o = k;
      break;
    }
    owner[i] = o >= 0 ? o : restIdx;
  }

  fs.mkdirSync(path.join(ROOT, cfg.output.dir, p.id), { recursive: true });
  // `scaleFrom`: a render from the same scene and camera as another shares its scale (and pixel space).
  const scaleHead = p.scaleFrom ? cfg.puppets.find((q) => q.id === p.scaleFrom).head : p.head;
  const metresPerPx = cfg.headMetres / (scaleHead.chin[1] - scaleHead.crown[1]);
  const outLayers = [];
  for (let k = 0; k < layers.length; k++) {
    const L = layers[k];
    const la = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) if (owner[i] === k) la[i] = alpha[i];
    let lrgb = Float32Array.from(rgb);
    // hidden parts of this layer (covered by layers in front)
    if (L.fill) {
      const fillPoly = L.fill === true ? L.polygon : L.fill.polygon;
      const fm = rasterize(M(fillPoly), W, H);
      const w = new Float32Array(W * H);
      for (let i = 0; i < W * H; i++) w[i] = owner[i] === k && alpha[i] > 0.9 ? 1 : 0;
      const filled = pullPush(rgb, w, W, H);
      for (let i = 0; i < W * H; i++) {
        if (fm[i] <= 0 || la[i] >= 0.999) continue;
        const coveredByFront = owner[i] > k || (owner[i] === -1 && false);
        if (!coveredByFront) continue;
        const grain = ((((i * 2654435761) >>> 0) % 9) - 4) * 0.8;
        for (let c = 0; c < 3; c++) lrgb[i * 3 + c] = la[i] > 0 ? lrgb[i * 3 + c] : filled[i * 3 + c] + grain;
        la[i] = Math.max(la[i], fm[i] * Math.min(1, alpha[i] + 0.0001 > 0 ? 1 : 0));
      }
    }
    // bounding box
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (la[y * W + x] > 0.004) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) { console.warn(`  ! ${p.id}/${L.name} is empty`); continue; }
    const pad = 6;
    x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(W - 1, x1 + pad); y1 = Math.min(H - 1, y1 + pad);
    const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
    // colour bleed into transparent texels
    const bw = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) bw[i] = la[i] > 0.5 ? 1 : 0;
    const bled = pullPush(lrgb, bw, W, H);
    const buf = Buffer.alloc(cw * ch * 4);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const i = (y + y0) * W + (x + x0);
      const o = (y * cw + x) * 4;
      const useOwn = la[i] > 0.5;
      for (let c = 0; c < 3; c++) buf[o + c] = Math.max(0, Math.min(255, Math.round(useOwn ? lrgb[i * 3 + c] : bled[i * 3 + c])));
      buf[o + 3] = Math.round(Math.max(0, Math.min(1, la[i])) * 255);
    }
    const outW = Math.max(1, Math.round(cw * p.scale));
    const outH = Math.max(1, Math.round(ch * p.scale));
    const file = path.join(cfg.output.dir, p.id, `${L.name}.webp`);
    await sharp(buf, { raw: { width: cw, height: ch, channels: 4 } })
      .resize(outW, outH, { kernel: 'lanczos3' })
      .webp({ quality: 86, alphaQuality: 92, effort: 6, smartSubsample: true })
      .toFile(path.join(ROOT, file));
    // coverage per mesh cell (source px cells over the layer rect)
    const cell = L.cell ?? 16;
    const cols = Math.ceil(cw / cell), rows = Math.ceil(ch / cell);
    let cover = '';
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      let any = false;
      for (let y = r * cell - 2; y < (r + 1) * cell + 2 && !any; y++) for (let x = c * cell - 2; x < (c + 1) * cell + 2; x++) {
        if (x < 0 || y < 0 || x >= cw || y >= ch) continue;
        if (la[(y + y0) * W + (x + x0)] > 0.02) { any = true; break; }
      }
      cover += any ? '1' : '.';
    }
    if (debug) {
      fs.mkdirSync(DEBUG_DIR, { recursive: true });
      await sharp(buf, { raw: { width: cw, height: ch, channels: 4 } }).png().toFile(path.join(DEBUG_DIR, `${p.id}-${L.name}.png`));
    }
    const kb = Math.round(fs.statSync(path.join(ROOT, file)).size / 1024);
    console.log(`  ${L.name.padEnd(8)} ${outW}×${outH}  ${kb} KB`);
    outLayers.push({
      name: L.name,
      src: `${cfg.output.publicPath}/${p.id}/${L.name}.webp`,
      rect: [x0, y0, cw, ch],
      bone: L.bone ?? 'root',
      cell,
      cols,
      rows,
      cover,
      weights: (L.weights ?? []).map((w) => ({
        ...(w.chain ? { chain: M(w.chain), bones: w.bones, parent: w.parent, blend: w.blend, startBlend: w.startBlend } : {}),
        ...(w.region ? { region: M(w.region) } : {}),
        ...(w.bone ? { bone: w.bone } : {}),
        ...(w.feather ? { feather: w.feather } : {}),
      })),
    });
  }

  const anchors = Object.fromEntries(Object.entries(p.anchors ?? {}).map(([k, v]) => [k, M([v])[0]]));
  const bones = Object.fromEntries(Object.entries(p.bones).map(([k, b]) => [k, { parent: b.parent ?? null, pivot: M([b.pivot])[0] }]));
  const entry = {
    id: p.id,
    width: W,
    height: H,
    mirrored: Boolean(p.mirror),
    metresPerPx: Number(metresPerPx.toPrecision(6)),
    head: { crown: M([p.head.crown])[0], chin: M([p.head.chin])[0] },
    anchors,
    bones,
    layers: outLayers,
    colour: maps.map((m) => m.map(r4)),
  };
  if (p.deskTop) {
    // Lines in (mirrored) source px for the procedural desk base: y = a + b·x in ORIGINAL coords.
    const line = ([a, b]) => (p.mirror ? [a + b * (W - 1), -b] : [a, b]);
    // Desk colour along the bottom rows (for the procedural extension/panel).
    const sample = (xs) => xs.map((x) => {
      let r = 0, g = 0, b = 0, n = 0;
      for (let y = H - 14; y < H - 2; y++) for (let dx = -6; dx <= 6; dx++) {
        const i = y * W + Math.min(W - 1, Math.max(0, x + dx));
        if (alpha[i] < 0.9) continue;
        r += rgb[i * 3]; g += rgb[i * 3 + 1]; b += rgb[i * 3 + 2]; n++;
      }
      return n ? [Math.round(r / n), Math.round(g / n), Math.round(b / n)] : null;
    });
    const xs = Array.from({ length: 13 }, (_, i) => Math.round((i / 12) * (W - 1)));
    entry.deskTop = { far: line(p.deskTop.far), front: line(p.deskTop.front), ends: p.deskTop.ends, bottomColours: xs.map((x) => [x, sample([x])[0]]).filter((s) => s[1]) };
  }
  return entry;
}

async function main() {
  // Metre scale comes from the base pose's head height (same as the pose pipeline).
  const poseManifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/images/character/poses/manifest.json'), 'utf8'));
  cfg.headMetres = poseManifest.headMetres;
  const manifestPath = path.join(ROOT, cfg.output.manifest);
  const previous = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : { puppets: [] };
  const entries = new Map(previous.puppets.map((p) => [p.id, p]));
  for (const p of cfg.puppets) {
    if (only && only !== p.id) continue;
    if (!fs.existsSync(path.join(ROOT, p.source))) {
      console.warn(`! ${p.id}: missing ${p.source}`);
      entries.delete(p.id);
      continue;
    }
    console.log(`✓ ${p.id}`);
    entries.set(p.id, await buildPuppet(p));
  }
  const manifest = {
    $comment: 'Generated by scripts/prepare-puppets.mjs from assets-src/character/puppets.json — do not edit by hand.',
    headMetres: cfg.headMetres,
    puppets: cfg.puppets.map((p) => entries.get(p.id)).filter(Boolean),
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest) + '\n');
  console.log(`manifest → ${path.relative(ROOT, manifestPath)}`);
}

await main();
