#!/usr/bin/env node
/**
 * Character asset preparation (local, free: sharp + optional ffmpeg).
 *
 *   npm run assets:character                       all poses whose source image exists
 *   npm run assets:character -- --only 02-laptop-working
 *   npm run assets:character -- --grid 02-laptop-working      measurement grid for marking joints
 *   npm run assets:character -- --parts            body-part segmentation previews (debug only)
 *   npm run assets:character -- --frames <dir|video.mp4> --name wave [--fps 24] [--height 900] [--atlas]
 *
 * Sources stay untouched in assets-src/. Outputs:
 *   public/images/character/poses/<id>.webp + manifest.json (consumed by the WebGL character)
 *   public/images/character/sequences/<name>/… + manifest.json (frame sequences)
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { cutout, exportCrop } from './lib/cutout.mjs';

const ROOT = process.cwd();
const CATALOGUE = path.join(ROOT, 'assets-src/character/poses.json');
const POSE_SRC_DIR = path.join(ROOT, 'assets-src/character/poses');
const DEBUG_DIR = path.join(ROOT, 'assets-src/character/debug');
const SEQ_DIR = path.join(ROOT, 'public/images/character/sequences');

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const cat = JSON.parse(fs.readFileSync(CATALOGUE, 'utf8'));
const r5 = (n) => Math.round(n * 1e5) / 1e5;

function sourceFor(pose) {
  if (pose.source) return path.join(ROOT, pose.source);
  for (const ext of ['png', 'jpg', 'jpeg', 'webp']) {
    const p = path.join(POSE_SRC_DIR, `${pose.id}.${ext}`);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/* ---------- measurement grid ---------- */
async function grid(id) {
  const pose = cat.poses.find((p) => p.id === id);
  const src = pose && sourceFor(pose);
  if (!src || !fs.existsSync(src)) throw new Error(`No source image for ${id}`);
  const { width: W, height: H } = await sharp(src).metadata();
  const lines = [];
  for (let x = 0; x < W; x += 32) lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="${x % 128 ? '#f6b' : '#e00'}" stroke-width="1" opacity="0.6"/>`);
  for (let y = 0; y < H; y += 32) lines.push(`<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${y % 128 ? '#9bf' : '#00e'}" stroke-width="1" opacity="0.6"/>`);
  for (let x = 0; x < W; x += 128)
    for (let y = 0; y < H; y += 128) lines.push(`<text x="${x + 3}" y="${y + 12}" font-size="11" font-family="Menlo" fill="#000">${x},${y}</text>`);
  fs.mkdirSync(DEBUG_DIR, { recursive: true });
  const out = path.join(DEBUG_DIR, `${id}-grid.png`);
  await sharp(src).composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${lines.join('')}</svg>`) }]).png().toFile(out);
  console.log(`grid → ${path.relative(ROOT, out)}  (mark joints in poses.json using these source-pixel coordinates)`);
}

/* ---------- body-part segmentation preview ---------- */
function inPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function partOf(rig, x, y) {
  if (inPoly(x, y, rig.arms.L)) return 'arm-left';
  if (inPoly(x, y, rig.arms.R)) return 'arm-right';
  if (y < rig.joints.neck[1]) return 'head';
  if (y < rig.joints.pelvis[1]) return 'torso';
  return x < rig.crotchX ? 'leg-left' : 'leg-right';
}
/** Runtime mesh grid for rigged poses (must match nothing else: the runtime reads cols/rows from here). */
const RIG_GRID = { cols: 36, rows: 104 };

/**
 * Per-cell part map for the runtime mesh: '.' empty, '0' body, '1' left arm, '2' right arm.
 * Arms are flood-filled over opaque pixels from the wrist/elbow, constrained to their
 * outline, so torso pixels across a gap never ride along with a swinging arm.
 */
function partGrid(pose, result, crop, label = new Uint8Array(result.width * result.height)) {
  const { rgba, width: W, height: H } = result;
  const opaque = (i) => rgba[i * 4 + 3] > 100;
  const fill = (poly, seeds, id) => {
    const q = [];
    for (const [sx, sy] of seeds) {
      // nearest opaque pixel to the seed
      let best = -1;
      for (let r = 0; r < 12 && best < 0; r++)
        for (let dy = -r; dy <= r && best < 0; dy++)
          for (let dx = -r; dx <= r; dx++) {
            const x = Math.round(sx) + dx;
            const y = Math.round(sy) + dy;
            const i = y * W + x;
            if (x >= 0 && y >= 0 && x < W && y < H && opaque(i) && inPoly(x, y, poly)) {
              best = i;
              break;
            }
          }
      if (best >= 0 && !label[best]) {
        label[best] = id;
        q.push(best);
      }
    }
    while (q.length) {
      const i = q.pop();
      const x = i % W;
      const y = (i / W) | 0;
      for (const n of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) {
        if (n < 0 || label[n] || !opaque(n)) continue;
        if (!inPoly(n % W, (n / W) | 0, poly)) continue;
        label[n] = id;
        q.push(n);
      }
    }
  };
  const J = pose.rig.joints;
  fill(pose.rig.arms.L, [J.wristL, J.elbowL, J.fingersL], 1);
  fill(pose.rig.arms.R, [J.wristR, J.elbowR, J.fingersR], 2);
  const { cols, rows } = RIG_GRID;
  const counts = new Uint32Array(cols * rows * 3);
  for (let y = crop.y; y < crop.y + crop.h; y++) {
    const iy = Math.min(rows - 1, Math.floor(((y - crop.y) / crop.h) * rows));
    for (let x = crop.x; x < crop.x + crop.w; x++) {
      const i = y * W + x;
      if (rgba[i * 4 + 3] < 24) continue;
      const ix = Math.min(cols - 1, Math.floor(((x - crop.x) / crop.w) * cols));
      counts[(iy * cols + ix) * 3 + label[i]]++;
    }
  }
  let data = '';
  for (let c = 0; c < cols * rows; c++) {
    const b = counts[c * 3];
    const l = counts[c * 3 + 1];
    const r = counts[c * 3 + 2];
    data += b + l + r === 0 ? '.' : l > b && l >= r ? '1' : r > b && r > l ? '2' : '0';
  }
  return { cols, rows, data };
}

/**
 * Background extension for 2.5D arms: the hoodie's sides are hidden behind the
 * hanging sleeves in the photo-like render, so a swinging arm would uncover
 * nothing. Paint the hidden torso under each sleeve by carrying the torso's own
 * edge pixels outward (row by row, slightly darkened, small vertical jitter).
 * Output is a separate mostly-transparent texture drawn behind the arms.
 */
async function buildUnderlay(pose, result, label, crop, out, file) {
  const { rgba, width: W, height: H } = result;
  const J = pose.rig.joints;
  // Hidden torso only: shoulder line to the hoodie hem, a few cm out from the body edge.
  const y0 = Math.round(Math.min(J.shoulderL[1], J.shoulderR[1]) - 6);
  const y1 = Math.round(J.pelvis[1] - 40);
  const REACH = 34;
  const SOLID = 20;
  const INSET = 8; // also under the outermost body pixels: grid cells that carry an arm take a few with them
  const mid = Math.round(pose.rig.crotchX);
  const under = Buffer.alloc(W * H * 4);
  const isBody = (x, y) => x >= 0 && x < W && label[y * W + x] === 0 && rgba[(y * W + x) * 4 + 3] > 200;
  // Per row and side: robust mean colour of a 32 px window inside the body edge,
  // then smoothed vertically so the fill reads as fabric, not stripes.
  const rowsN = y1 - y0 + 1;
  const means = { 1: new Float32Array(rowsN * 3), 2: new Float32Array(rowsN * 3) };
  const valid = { 1: new Uint8Array(rowsN), 2: new Uint8Array(rowsN) };
  const edges = { 1: new Int32Array(rowsN).fill(-1), 2: new Int32Array(rowsN).fill(-1) };
  for (let y = y0; y <= y1; y++) {
    for (const side of [1, 2]) {
      const dir = side === 1 ? 1 : -1;
      let edge = -1;
      for (let x = side === 1 ? 0 : W - 1; side === 1 ? x < mid : x > mid; x += dir) {
        if (isBody(x, y)) {
          edge = x;
          break;
        }
      }
      if (edge < 0) continue;
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let k = 8; k < 40; k++) {
        const x = edge + dir * k;
        if (!isBody(x, y)) continue;
        const si = (y * W + x) * 4;
        r += rgba[si];
        g += rgba[si + 1];
        b += rgba[si + 2];
        n++;
      }
      if (!n) continue;
      edges[side][y - y0] = edge;
      const o = (y - y0) * 3;
      means[side][o] = r / n;
      means[side][o + 1] = g / n;
      means[side][o + 2] = b / n;
      valid[side][y - y0] = 1;
    }
  }
  const smooth = (side) => {
    const src = means[side];
    const dst = new Float32Array(src.length);
    for (let i = 0; i < rowsN; i++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let k = -14; k <= 14; k++) {
        const j = i + k;
        if (j < 0 || j >= rowsN || !valid[side][j]) continue;
        r += src[j * 3];
        g += src[j * 3 + 1];
        b += src[j * 3 + 2];
        n++;
      }
      if (n) {
        dst[i * 3] = r / n;
        dst[i * 3 + 1] = g / n;
        dst[i * 3 + 2] = b / n;
      }
    }
    return dst;
  };
  const sm = { 1: smooth(1), 2: smooth(2) };
  let painted = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const side = x < mid ? 1 : 2;
      const o = (y - y0) * 3;
      const e = edges[side][y - y0];
      if (!sm[side][o] || e < 0) continue;
      // signed distance outward from the body edge (negative = inside the body)
      const d = side === 1 ? e - x : x - e;
      if (d > REACH || d < -INSET) continue;
      if (d > 0 && (label[i] !== side || rgba[i * 4 + 3] < 40)) continue;
      // slight shade (it sits behind the arm) + fine grain; fades out like a side turning away
      const grain = 1 + (((x * 73856093) ^ (y * 19349663)) % 7) / 400;
      const k = (0.9 - 0.08 * (Math.max(0, d) / REACH)) * grain;
      under[i * 4] = Math.min(255, sm[side][o] * k);
      under[i * 4 + 1] = Math.min(255, sm[side][o + 1] * k);
      under[i * 4 + 2] = Math.min(255, sm[side][o + 2] * k);
      under[i * 4 + 3] = d <= SOLID ? 255 : Math.round(255 * (1 - (d - SOLID) / (REACH - SOLID)));
      painted++;
    }
  }
  const sharpImg = (await import('sharp')).default;
  await sharpImg(under, { raw: { width: W, height: H, channels: 4 } })
    .extract({ left: crop.x, top: crop.y, width: crop.w, height: crop.h })
    .resize(out.width, out.height, { kernel: 'lanczos3' })
    .blur(0.6)
    .webp({ quality: 80, alphaQuality: 90 })
    .toFile(file);
  // cells that carry underlay pixels (same grid as the part map)
  const { cols, rows } = RIG_GRID;
  const flags = new Uint8Array(cols * rows);
  for (let y = y0; y <= y1; y++)
    for (let x = crop.x; x < crop.x + crop.w; x++)
      if (under[(y * W + x) * 4 + 3]) {
        const ix = Math.min(cols - 1, Math.floor(((x - crop.x) / crop.w) * cols));
        const iy = Math.min(rows - 1, Math.floor(((y - crop.y) / crop.h) * rows));
        flags[iy * cols + ix] = 1;
      }
  return { cells: Array.from(flags, (f) => (f ? '1' : '.')).join(''), painted };
}

async function exportParts(pose, result) {
  if (!pose.rig) return;
  const { rgba, width: W, height: H } = result;
  const parts = {};
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (rgba[i + 3] < 8) continue;
      const part = partOf(pose.rig, x, y);
      (parts[part] ??= Buffer.alloc(W * H * 4)).set(rgba.subarray(i, i + 4), i);
    }
  }
  const dir = path.join(DEBUG_DIR, 'parts', pose.id);
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, buf] of Object.entries(parts)) {
    await sharp(buf, { raw: { width: W, height: H, channels: 4 } }).trim().png().toFile(path.join(dir, `${name}.png`));
  }
  console.log(`  parts → ${path.relative(ROOT, dir)} (${Object.keys(parts).join(', ')}). Occluded areas are empty: the runtime deforms one mesh instead of moving cut-out layers.`);
}

/* ---------- poses ---------- */
async function poses() {
  const only = value('only');
  const ref = cat.poses.find((p) => p.id === cat.scale.reference);
  const refPx = ref.anchors.feet[1] - ref.head.crown[1];
  const metresPerPxRef = cat.scale.figureHeightMetres / refPx;
  const headMetres = (ref.head.chin[1] - ref.head.crown[1]) * metresPerPxRef;

  fs.mkdirSync(path.join(ROOT, cat.output.dir), { recursive: true });
  const manifestPath = path.join(ROOT, cat.output.manifest);
  const previous = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : { poses: [] };
  const entries = new Map(previous.poses.map((p) => [p.id, p]));
  const missing = [];

  for (const pose of cat.poses) {
    const src = sourceFor(pose);
    if (!src || !fs.existsSync(src)) {
      entries.delete(pose.id);
      missing.push({ id: pose.id, expectedSource: `assets-src/character/poses/${pose.id}.png` });
      continue;
    }
    if (only && only !== pose.id) continue;
    if (!pose.head) {
      console.warn(`! ${pose.id}: no "head" crown/chin measurement — falling back to reference scale. Run --grid ${pose.id} and add it.`);
    }
    const metresPerPx = pose.head ? headMetres / (pose.head.chin[1] - pose.head.crown[1]) : metresPerPxRef;
    // Protect the face (eye whites, teeth) from pocket removal.
    const protect = pose.head
      ? (() => {
          const hh = pose.head.chin[1] - pose.head.crown[1];
          const cx = (pose.head.chin[0] + pose.head.crown[0]) / 2;
          return [cx - hh * 0.45, pose.head.crown[1] + hh * 0.3, cx + hh * 0.45, pose.head.chin[1] + 4];
        })()
      : undefined;
    const result = await cutout(src, { shadow: 'remove', protect });
    const file = path.join(ROOT, cat.output.dir, `${pose.id}.webp`);
    const out = await exportCrop(result, { height: pose.maxHeight, file, padding: 10 });
    const { crop } = out;
    const norm = ([x, y]) => [r5((x - crop.x) / crop.w), r5((y - crop.y) / crop.h)];
    let grid = null;
    let under = null;
    if (pose.rig) {
      const label = new Uint8Array(result.width * result.height);
      grid = partGrid(pose, result, crop, label);
      under = await buildUnderlay(pose, result, label, crop, out, path.join(ROOT, cat.output.dir, `${pose.id}.under.webp`));
    }
    const anchors = {};
    for (const [k, v] of Object.entries(pose.anchors ?? {})) anchors[k] = norm(v);
    if (!anchors.feet) anchors.feet = [r5(0.5), r5((result.footY - crop.y) / crop.h)];

    entries.set(pose.id, {
      id: pose.id,
      src: `${cat.output.publicPath}/${pose.id}.webp`,
      width: out.width,
      height: out.height,
      aspect: r5(out.width / out.height),
      worldWidth: r5(crop.w * metresPerPx),
      worldHeight: r5(crop.h * metresPerPx),
      anchor: pose.anchor ?? 'feet',
      anchors,
      head: pose.head ? { crown: norm(pose.head.crown), chin: norm(pose.head.chin) } : null,
      rig: pose.rig
        ? {
            joints: Object.fromEntries(Object.entries(pose.rig.joints).map(([k, v]) => [k, norm(v)])),
            crotchX: r5((pose.rig.crotchX - crop.x) / crop.w),
            arms: { L: pose.rig.arms.L.map(norm), R: pose.rig.arms.R.map(norm) },
            parts: grid,
            underlay: under ? { src: `${cat.output.publicPath}/${pose.id}.under.webp`, cells: under.cells } : null,
          }
        : null,
      camera: pose.camera,
      props: pose.props,
    });
    const kb = Math.round(fs.statSync(file).size / 1024);
    console.log(`✓ ${pose.id}  ${out.width}×${out.height}  ${kb} KB  ${r5(crop.h * metresPerPx)} m tall image`);
    if (flag('parts')) await exportParts(pose, result);
  }

  const ordered = cat.poses.map((p) => entries.get(p.id)).filter(Boolean);
  const manifest = {
    $comment: 'Generated by scripts/prepare-character.mjs — do not edit by hand.',
    headMetres: r5(headMetres),
    poses: ordered,
    missing,
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`manifest → ${path.relative(ROOT, manifestPath)} (${ordered.length} ready, ${missing.length} still needed)`);
}

/* ---------- frame sequences (from a folder of frames or a video via ffmpeg) ---------- */
async function frames() {
  const input = value('frames');
  const name = value('name');
  if (!input || !name) throw new Error('--frames <dir|video> --name <sequence-name> required');
  const fps = Number(value('fps') ?? 24);
  const targetH = Number(value('height') ?? 900);
  let dir = input;
  if (fs.statSync(input).isFile()) {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'frames-'));
    execFileSync('ffmpeg', ['-loglevel', 'error', '-i', input, '-vf', `fps=${fps}`, path.join(dir, '%04d.png')]);
  }
  const files = fs.readdirSync(dir).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).sort();
  if (!files.length) throw new Error(`No frames in ${dir}`);

  // Cut out every frame, then crop ALL frames with the union box so the figure never jitters.
  const results = [];
  for (const f of files) results.push(await cutout(path.join(dir, f), { shadow: 'remove' }));
  const u = results.reduce(
    (b, r) => ({
      minX: Math.min(b.minX, r.bbox.minX),
      minY: Math.min(b.minY, r.bbox.minY),
      maxX: Math.max(b.maxX, r.bbox.maxX),
      maxY: Math.max(b.maxY, r.bbox.maxY),
    }),
    { minX: Infinity, minY: Infinity, maxX: 0, maxY: 0 },
  );
  const outDir = path.join(SEQ_DIR, name);
  fs.mkdirSync(outDir, { recursive: true });
  let size = null;
  for (let i = 0; i < results.length; i++) {
    const r = { ...results[i], bbox: u };
    size = await exportCrop(r, { height: targetH, file: path.join(outDir, `${String(i + 1).padStart(4, '0')}.webp`), padding: 6, quality: 84 });
  }
  let atlas = null;
  if (flag('atlas')) {
    const cols = Math.ceil(Math.sqrt(results.length));
    const rows = Math.ceil(results.length / cols);
    const tiles = await Promise.all(
      fs.readdirSync(outDir).filter((f) => /^\d{4}\.webp$/.test(f)).sort().map((f, i) => ({
        input: path.join(outDir, f),
        left: (i % cols) * size.width,
        top: Math.floor(i / cols) * size.height,
      })),
    );
    await sharp({ create: { width: cols * size.width, height: rows * size.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite(tiles)
      .webp({ quality: 84, alphaQuality: 100 })
      .toFile(path.join(outDir, 'atlas.webp'));
    atlas = { src: `/images/character/sequences/${name}/atlas.webp`, cols, rows };
  }
  const mPath = path.join(SEQ_DIR, 'manifest.json');
  const m = fs.existsSync(mPath) ? JSON.parse(fs.readFileSync(mPath, 'utf8')) : { sequences: [] };
  m.sequences = m.sequences.filter((s) => s.name !== name);
  m.sequences.push({ name, count: results.length, fps, width: size.width, height: size.height, base: `/images/character/sequences/${name}/`, atlas });
  fs.writeFileSync(mPath, JSON.stringify(m, null, 2) + '\n');
  console.log(`✓ sequence "${name}": ${results.length} frames at ${size.width}×${size.height}${atlas ? ' + atlas' : ''}`);
}

if (value('grid')) await grid(value('grid'));
else if (value('frames')) await frames();
else await poses();
