#!/usr/bin/env node
/**
 * Static placeholder for mobile / no-WebGL / OG image: the reference render cut
 * out WITH its soft floor shadow (translucent black). Same algorithm as the
 * WebGL pose assets (scripts/lib/cutout.mjs).
 *
 *   node scripts/cutout-character.mjs <source.png> [outDir]
 */
import fs from 'node:fs';
import path from 'node:path';
import { cutout, exportCrop } from './lib/cutout.mjs';

const src = process.argv[2];
const outDir = process.argv[3] || 'public/images/character';
if (!src) {
  console.error('usage: node scripts/cutout-character.mjs <source.png> [outDir]');
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });

const result = await cutout(src, { shadow: 'keep' });
const out = await exportCrop(result, { height: 1400, file: path.join(outDir, 'placeholder.webp'), padding: 8 });
const meta = {
  source: path.basename(src),
  width: out.width,
  height: out.height,
  aspect: +(out.width / out.height).toFixed(5),
  // Normalized (0 top .. 1 bottom) row of the lowest opaque sole pixel.
  footY: +((result.footY - out.crop.y) / out.crop.h).toFixed(5),
  note: 'Static cut-out with baked floor shadow (mobile, no-WebGL fallback, OG image).',
};
fs.writeFileSync(path.join(outDir, 'placeholder.meta.json'), JSON.stringify(meta, null, 2) + '\n');
console.log(meta);
