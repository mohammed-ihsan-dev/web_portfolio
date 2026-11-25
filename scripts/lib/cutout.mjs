/**
 * Edge-aware background removal for flat-background character renders.
 * Pure sharp + typed arrays: no ML model, no downloads.
 *
 * Why not "make white pixels transparent": the character wears white sneakers.
 * Instead we flood-fill from the image border through pixels that match the
 * background colour AND sit in flat regions (Sobel gradient barrier), so the
 * faint outline of a white shoe stops the fill. Enclosed holes (gap between the
 * legs) are detected separately, the soft floor shadow is classified on its own,
 * and anti-aliased fringe from the backdrop is peeled.
 *
 * Works for any flat backdrop colour (sampled from the border). Busy or
 * gradient backgrounds need a matting model (see ZERO_BUDGET_PLAN.md §5).
 */
import sharp from 'sharp';

/**
 * @param {string|Buffer} src
 * @param {{ shadow?: 'keep' | 'remove', feather?: number, protect?: number[], debugMap?: string }} [opts]
 *   protect: [x0,y0,x1,y1] source-pixel box (the face) where pockets are never removed
 *   shadow: 'keep'   → floor shadow becomes translucent black (static images)
 *           'remove' → floor shadow is dropped (WebGL draws a dynamic one)
 */
export async function cutout(src, opts = {}) {
  const shadowMode = opts.shadow ?? 'keep';
  const { data, info } = await sharp(src).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  const N = W * H;

  /* ---------- background colour: median of the border ---------- */
  const border = [];
  for (let x = 0; x < W; x += 2) border.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y += 2) border.push(y * W, y * W + W - 1);
  const med = (c) => {
    const v = border.map((i) => data[i * 3 + c]).sort((a, b) => a - b);
    return v[v.length >> 1];
  };
  const bgc = [med(0), med(1), med(2)];
  const bgL = 0.2126 * bgc[0] + 0.7152 * bgc[1] + 0.0722 * bgc[2];

  /* ---------- luminance + dilated Sobel gradient (the barrier) ---------- */
  const L = new Float32Array(N);
  for (let i = 0; i < N; i++) L[i] = 0.2126 * data[i * 3] + 0.7152 * data[i * 3 + 1] + 0.0722 * data[i * 3 + 2];
  const G = new Float32Array(N);
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      const gx = L[i - W + 1] + 2 * L[i + 1] + L[i + W + 1] - L[i - W - 1] - 2 * L[i - 1] - L[i + W - 1];
      const gy = L[i + W - 1] + 2 * L[i + W] + L[i + W + 1] - L[i - W - 1] - 2 * L[i - W] - L[i - W + 1];
      G[i] = (Math.abs(gx) + Math.abs(gy)) / 8;
    }
  }
  const Gd = new Float32Array(N);
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      let m = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) m = Math.max(m, G[i + dy * W + dx]);
      Gd[i] = m;
    }
  }

  const dist = (i) =>
    Math.max(Math.abs(data[i * 3] - bgc[0]), Math.abs(data[i * 3 + 1] - bgc[1]), Math.abs(data[i * 3 + 2] - bgc[2]));
  const sat = (i) => {
    const r = data[i * 3];
    const g = data[i * 3 + 1];
    const b = data[i * 3 + 2];
    return Math.max(r, g, b) - Math.min(r, g, b);
  };

  /* ---------- 1 = background: border-connected, close to bg colour, flat ---------- */
  const bg = new Uint8Array(N);
  const queue = new Int32Array(N);
  let qh = 0;
  let qt = 0;
  const isBg = (i) => dist(i) <= 9 && Gd[i] < 1.6;
  const seed = (i) => {
    if (!bg[i] && isBg(i)) {
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

  /* ---------- enclosed holes: large, very flat, bg-coloured components ---------- */
  {
    const seen = new Uint8Array(N);
    const comp = new Int32Array(N);
    for (let start = 0; start < N; start++) {
      if (bg[start] || seen[start] || dist(start) > 5 || Gd[start] > 0.9) continue;
      let n = 0;
      let h = 0;
      comp[n++] = start;
      seen[start] = 1;
      let sumD = 0;
      while (h < n) {
        const i = comp[h++];
        sumD += dist(i);
        const x = i % W;
        const y = (i / W) | 0;
        for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) {
          if (j < 0 || seen[j] || bg[j]) continue;
          if (dist(j) <= 7 && Gd[j] < 1.2) {
            seen[j] = 1;
            comp[n++] = j;
          }
        }
      }
      if (n > N * 0.0016 && sumD / n < 2.5) for (let k = 0; k < n; k++) bg[comp[k]] = 1;
    }
  }

  /* ---------- 2 = floor shadow: darker than bg, unsaturated, smooth, low in frame ---------- */
  const SHADOW_TOP = Math.round(H * 0.88);
  // Contact shadow beside the soles darkens quickly (gradient up to ~3); shoe
  // edges are far sharper (~10), so this still stops at the sneakers.
  const isShadow = (i, from) => {
    if (sat(i) > 14 || L[i] < bgL - 70 || L[i] > bgL - 1) return false;
    return Gd[i] < 3.2 && Math.abs(L[i] - L[from]) < 4.5;
  };
  qh = 0;
  qt = 0;
  for (let y = SHADOW_TOP; y < H; y++) for (let x = 0; x < W; x++) if (bg[y * W + x] === 1) queue[qt++] = y * W + x;
  while (qh < qt) {
    const i = queue[qh++];
    const x = i % W;
    const y = (i / W) | 0;
    for (const n of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > SHADOW_TOP ? i - W : -1, y < H - 1 ? i + W : -1]) {
      if (n < 0 || bg[n]) continue;
      if (isShadow(n, i)) {
        bg[n] = 2;
        queue[qt++] = n;
      }
    }
  }
  // The palest rim of the floor shadow is backdrop-coloured but enclosed by the
  // darker shadow ring, so the border flood never reached it. Re-flood from the
  // shadow zone (same gradient barrier, so shoe edges still stop it), twice.
  for (let pass = 0; pass < 2; pass++) {
    qh = 0;
    qt = 0;
    for (let y = SHADOW_TOP; y < H; y++) for (let x = 0; x < W; x++) if (bg[y * W + x]) queue[qt++] = y * W + x;
    while (qh < qt) {
      const i = queue[qh++];
      const x = i % W;
      const y = (i / W) | 0;
      for (const n of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > SHADOW_TOP ? i - W : -1, y < H - 1 ? i + W : -1]) {
        if (n < 0 || bg[n]) continue;
        if (isBg(n)) {
          bg[n] = 1;
          queue[qt++] = n;
        } else if (isShadow(n, i)) {
          bg[n] = 2;
          queue[qt++] = n;
        }
      }
    }
  }

  // Backdrop-coloured pockets: gaps between curls, between sleeve and torso,
  // between hand and hip. Small, enclosed, bordered by darker material. Shoe
  // interiors are bordered by light shading (kept); the face box is protected.
  const protect = opts.protect;
  {
    const seen = new Uint8Array(N);
    const comp = new Int32Array(N);
    for (let start = 0; start < N; start++) {
      if (bg[start] || seen[start] || dist(start) > 22) continue;
      let n = 0;
      let h = 0;
      comp[n++] = start;
      seen[start] = 1;
      let edgeL = 0;
      let edgeN = 0;
      while (h < n && n < 6000) {
        const i = comp[h++];
        const x = i % W;
        const y = (i / W) | 0;
        for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) {
          if (j < 0 || seen[j] || bg[j]) continue;
          if (dist(j) <= 22) {
            seen[j] = 1;
            comp[n++] = j;
          } else {
            edgeL += L[j];
            edgeN++;
          }
        }
      }
      const cx = comp[0] % W;
      const cy = (comp[0] / W) | 0;
      const inFace = protect && cx >= protect[0] && cx <= protect[2] && cy >= protect[1] && cy <= protect[3];
      if (!inFace && n < 6000 && edgeN && edgeL / edgeN < 175) for (let k = 0; k < n; k++) bg[comp[k]] = 1;
    }
  }

  for (let round = 0; round < 4; round++) {
    const flip = [];
    for (let y = Math.max(2, SHADOW_TOP - 20); y < H - 2; y++) {
      for (let x = 2; x < W - 2; x++) {
        const i = y * W + x;
        if (bg[i] !== 0) continue;
        let s = 0;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (bg[i + dy * W + dx] !== 0) s++;
        if (s >= 15 && sat(i) <= 14) flip.push(i);
      }
    }
    for (const i of flip) bg[i] = 2;
  }

  /* ---------- fringe: backdrop-tinted anti-aliasing on the silhouette ---------- */
  for (let pass = 0; pass < 3; pass++) {
    const peel = [];
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        if (bg[i] !== 0) continue;
        if (!(bg[i - 1] === 1 || bg[i + 1] === 1 || bg[i - W] === 1 || bg[i + W] === 1)) continue;
        if (dist(i) <= 33 + pass * 6 && sat(i) <= 14) peel.push(i);
      }
    }
    for (const i of peel) bg[i] = 1;
  }

  if (opts.debugMap) {
    const map = Buffer.alloc(N * 3);
    for (let i = 0; i < N; i++) {
      const c = bg[i] === 0 ? [220, 40, 40] : bg[i] === 2 ? [40, 200, 80] : [10, 10, 10];
      map.set(c, i * 3);
    }
    await sharp(map, { raw: { width: W, height: H, channels: 3 } }).png().toFile(opts.debugMap);
  }

  /* ---------- compose RGBA ---------- */
  const rgba = Buffer.alloc(N * 4);
  const hard = Buffer.alloc(N);
  for (let i = 0; i < N; i++) {
    if (bg[i] === 0) {
      rgba[i * 4] = data[i * 3];
      rgba[i * 4 + 1] = data[i * 3 + 1];
      rgba[i * 4 + 2] = data[i * 3 + 2];
      hard[i] = 255;
    } else if (bg[i] === 2 && shadowMode === 'keep') {
      rgba[i * 4] = 18;
      rgba[i * 4 + 1] = 18;
      rgba[i * 4 + 2] = 20;
      hard[i] = Math.round(Math.max(0, Math.min(1, (bgL - 3 - L[i]) / 60)) * 0.9 * 255);
    }
  }
  const soft = await sharp(hard, { raw: { width: W, height: H, channels: 1 } })
    .blur(opts.feather ?? 0.7)
    .extractChannel(0)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const sc = soft.info.channels;
  for (let i = 0; i < N; i++) rgba[i * 4 + 3] = bg[i] === 0 ? soft.data[i * sc] : hard[i];

  /* ---------- edge matting: remove the backdrop halo (e.g. around dark curls) ----------
   * Observed C = a·F + (1−a)·B. F comes from nearby interior pixels, B is the
   * backdrop colour, so a = (C−B)·(F−B)/|F−B|². Colour is un-mixed accordingly.
   * Where F ≈ B (white shoe on white), the pixel stays as it is. */
  const isFig = (i) => bg[i] === 0;
  const interior = new Uint8Array(N);
  for (let y = 2; y < H - 2; y++) {
    for (let x = 2; x < W - 2; x++) {
      const i = y * W + x;
      if (!isFig(i)) continue;
      let ok = true;
      for (let dy = -2; dy <= 2 && ok; dy++) for (let dx = -2; dx <= 2; dx++) if (!isFig(i + dy * W + dx)) { ok = false; break; }
      interior[i] = ok ? 1 : 0;
    }
  }
  for (let y = 3; y < H - 3; y++) {
    for (let x = 3; x < W - 3; x++) {
      const i = y * W + x;
      if (interior[i]) continue;
      const nearFigure = isFig(i) || (bg[i] === 1 && dist(i) > 9);
      if (!nearFigure) continue;
      let fr = 0;
      let fg = 0;
      let fb = 0;
      let n = 0;
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const j = i + dy * W + dx;
          if (!interior[j]) continue;
          fr += data[j * 3];
          fg += data[j * 3 + 1];
          fb += data[j * 3 + 2];
          n++;
        }
      }
      if (!n) continue;
      fr /= n;
      fg /= n;
      fb /= n;
      const d0 = fr - bgc[0];
      const d1 = fg - bgc[1];
      const d2 = fb - bgc[2];
      const den = d0 * d0 + d1 * d1 + d2 * d2;
      if (den < 900) continue; // foreground too close to the backdrop: leave as classified
      const c0 = data[i * 3] - bgc[0];
      const c1 = data[i * 3 + 1] - bgc[1];
      const c2 = data[i * 3 + 2] - bgc[2];
      const a = Math.max(0, Math.min(1, (c0 * d0 + c1 * d1 + c2 * d2) / den));
      const k = i * 4;
      if (a < 0.04) {
        rgba[k + 3] = 0;
        continue;
      }
      const un = (c, b, f) => Math.max(0, Math.min(255, Math.round(a > 0.2 ? (c - (1 - a) * b) / a : f)));
      rgba[k] = un(data[i * 3], bgc[0], fr);
      rgba[k + 1] = un(data[i * 3 + 1], bgc[1], fg);
      rgba[k + 2] = un(data[i * 3 + 2], bgc[2], fb);
      rgba[k + 3] = Math.round(Math.min(isFig(i) ? 255 : 200, a * 255));
    }
  }

  /* ---------- bounds + sole baseline ---------- */
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
  return { rgba, width: W, height: H, bbox: { minX, minY, maxX, maxY }, footY, background: bgc };
}

/** Crop with padding, resize to a target height, encode WebP. Returns the crop transform. */
export async function exportCrop(result, { padding = 8, height, file, quality = 88 }) {
  const { rgba, width: W, height: H, bbox } = result;
  const minX = Math.max(0, bbox.minX - padding);
  const minY = Math.max(0, bbox.minY - padding);
  const maxX = Math.min(W - 1, bbox.maxX + padding);
  const maxY = Math.min(H - 1, bbox.maxY + padding);
  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  const outH = Math.min(height ?? ch, ch);
  const scale = outH / ch;
  const outW = Math.round(cw * scale);
  await sharp(rgba, { raw: { width: W, height: H, channels: 4 } })
    .extract({ left: minX, top: minY, width: cw, height: ch })
    .resize(outW, outH, { kernel: 'lanczos3' })
    .webp({ quality, alphaQuality: 100, effort: 6, smartSubsample: true })
    .toFile(file);
  return { crop: { x: minX, y: minY, w: cw, h: ch }, scale, width: outW, height: outH };
}
