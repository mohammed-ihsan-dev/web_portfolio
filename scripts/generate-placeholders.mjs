#!/usr/bin/env node
/**
 * Generates clearly-labelled MOCK imagery (abstract compositions, no stock,
 * no people) for projects, "off the screen" photos, playground experiments and
 * the Open Graph card. Replace these files with real assets later.
 *
 *   node scripts/generate-placeholders.mjs
 */
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const OUT = 'public';
const mono = "font-family='Menlo, Monaco, monospace'";
const sans = "font-family='Helvetica Neue, Helvetica, Arial, sans-serif'";

const grain = (id, opacity = 0.18, freq = 0.9) => `
  <filter id='${id}' x='0' y='0' width='100%' height='100%'>
    <feTurbulence type='fractalNoise' baseFrequency='${freq}' numOctaves='2' stitchTiles='stitch' result='n'/>
    <feColorMatrix in='n' type='matrix' values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${opacity} 0'/>
  </filter>`;

const label = (w, h, text, color) => `
  <text x='${w * 0.035}' y='${h - w * 0.035}' ${mono} font-size='${Math.round(w * 0.0125)}' letter-spacing='1.5' fill='${color}' opacity='0.8'>${text}</text>`;

function svg(w, h, body, defs = '') {
  return `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>
  <defs>${grain('g')}${defs}</defs>${body}
  <rect width='${w}' height='${h}' filter='url(#g)'/></svg>`;
}

/* ---------- project compositions ---------- */
const projectArt = {
  northbound: (w, h, v) => svg(w, h, `
    <rect width='${w}' height='${h}' fill='#1d3584'/>
    <circle cx='${w * (0.64 + v * 0.1)}' cy='${h * 0.62}' r='${h * 0.52}' fill='#f2efe6'/>
    <rect x='0' y='${h * 0.7}' width='${w}' height='${h * 0.3}' fill='#1d3584' opacity='0.92'/>
    ${Array.from({ length: 9 }, (_, i) => `<line x1='0' x2='${w}' y1='${h * (0.72 + i * 0.03)}' y2='${h * (0.72 + i * 0.03)}' stroke='#f2efe6' stroke-opacity='${0.5 - i * 0.05}' stroke-width='1.5'/>`).join('')}
    <text x='${w * 0.05}' y='${h * 0.17}' ${sans} font-size='${h * 0.12}' font-weight='600' letter-spacing='-4' fill='#f2efe6'>N—B</text>
    ${label(w, h, 'MOCK PROJECT / NORTHBOUND / PLACEHOLDER', '#f2efe6')}`),
  'paper-atlas': (w, h, v) => svg(w, h, `
    <rect width='${w}' height='${h}' fill='#ebe5d8'/>
    ${Array.from({ length: 6 }, (_, i) => `<rect x='${w * (0.12 + i * 0.035)}' y='${h * (0.14 + i * 0.03)}' width='${w * 0.62}' height='${h * 0.62}' fill='#f8f5ee' stroke='#1a1a1a' stroke-opacity='0.18'/>`).join('')}
    <circle cx='${w * (0.78 - v * 0.2)}' cy='${h * 0.28}' r='${w * 0.05}' fill='#d4472f'/>
    ${Array.from({ length: 12 }, (_, i) => `<rect x='${w * 0.36}' y='${h * (0.36 + i * 0.026)}' width='${w * (0.3 - (i % 4) * 0.04)}' height='${h * 0.008}' fill='#1a1a1a' opacity='0.55'/>`).join('')}
    ${label(w, h, 'MOCK PROJECT / PAPER ATLAS / PLACEHOLDER', '#1a1a1a')}`),
  'soft-machines': (w, h, v) => svg(w, h, `
    <rect width='${w}' height='${h}' fill='#d8d2ee'/>
    <g filter='url(#blur)'>
      <circle cx='${w * (0.32 + v * 0.1)}' cy='${h * 0.42}' r='${h * 0.3}' fill='#f3a6c8'/>
      <circle cx='${w * 0.66}' cy='${h * 0.6}' r='${h * 0.34}' fill='#8fa8ff'/>
      <circle cx='${w * 0.52}' cy='${h * 0.24}' r='${h * 0.18}' fill='#fff6d8'/>
    </g>
    <rect x='${w * 0.08}' y='${h * 0.08}' width='${w * 0.84}' height='${h * 0.84}' fill='none' stroke='#151515' stroke-opacity='0.35'/>
    ${label(w, h, 'MOCK PROJECT / SOFT MACHINES / PLACEHOLDER', '#151515')}`, `<filter id='blur'><feGaussianBlur stdDeviation='${Math.round(w * 0.045)}'/></filter>`),
  'field-studio': (w, h, v) => svg(w, h, `
    <rect width='${w}' height='${h}' fill='#646b40'/>
    ${Array.from({ length: 5 }, (_, r) => Array.from({ length: 5 }, (_, c) => `<rect x='${w * (0.14 + c * 0.15)}' y='${h * (0.14 + r * 0.15)}' width='${w * 0.11}' height='${w * 0.11}' fill='${(r + c + Math.round(v * 3)) % 4 === 0 ? '#e4edb4' : 'none'}' stroke='#e4edb4' stroke-opacity='0.55'/>`).join('')).join('')}
    ${label(w, h, 'MOCK PROJECT / FIELD STUDIO / PLACEHOLDER', '#e4edb4')}`),
  'low-orbit': (w, h, v) => svg(w, h, `
    <rect width='${w}' height='${h}' fill='#16171b'/>
    ${Array.from({ length: 7 }, (_, i) => `<ellipse cx='${w * 0.5}' cy='${h * 0.52}' rx='${w * (0.1 + i * 0.07)}' ry='${h * (0.04 + i * 0.03)}' fill='none' stroke='#cfd6e6' stroke-opacity='${0.55 - i * 0.06}' transform='rotate(${-12 + v * 8} ${w * 0.5} ${h * 0.52})'/>`).join('')}
    <circle cx='${w * 0.5}' cy='${h * 0.52}' r='${h * 0.09}' fill='#e9e6dd'/>
    <circle cx='${w * (0.78 - v * 0.1)}' cy='${h * 0.43}' r='${h * 0.018}' fill='#e4edb4'/>
    ${label(w, h, 'MOCK PROJECT / LOW ORBIT / PLACEHOLDER', '#cfd6e6')}`),
  'quiet-index': (w, h, v) => svg(w, h, `
    <rect width='${w}' height='${h}' fill='#f2f0ea'/>
    ${Array.from({ length: 16 }, (_, i) => `<rect x='${w * 0.1}' y='${h * (0.12 + i * 0.045)}' width='${w * (0.2 + ((i * 37) % 50) / 100)}' height='${h * 0.012}' fill='#121212' opacity='${i === 5 + Math.round(v * 4) ? 1 : 0.22}'/>`).join('')}
    <rect x='${w * 0.66}' y='${h * 0.58}' width='${w * 0.22}' height='${w * 0.22}' fill='#e4edb4'/>
    ${label(w, h, 'MOCK PROJECT / QUIET INDEX / PLACEHOLDER', '#121212')}`),
};

/* ---------- "off the screen" photo placeholders: soft out-of-focus light ---------- */
const photo = (w, h, colors, tag) =>
  svg(w, h, `
    <rect width='${w}' height='${h}' fill='${colors[0]}'/>
    <g filter='url(#soft)'>
      <circle cx='${w * 0.3}' cy='${h * 0.35}' r='${Math.min(w, h) * 0.32}' fill='${colors[1]}'/>
      <circle cx='${w * 0.72}' cy='${h * 0.62}' r='${Math.min(w, h) * 0.38}' fill='${colors[2]}'/>
      <circle cx='${w * 0.55}' cy='${h * 0.2}' r='${Math.min(w, h) * 0.14}' fill='${colors[3]}'/>
    </g>
    ${label(w, h, `PLACEHOLDER PHOTO / ${tag}`, '#111')}`, `<filter id='soft'><feGaussianBlur stdDeviation='${Math.round(Math.min(w, h) * 0.09)}'/></filter>`);

/* ---------- playground experiments ---------- */
const experiments = [
  (w, h) => svg(w, h, `<rect width='${w}' height='${h}' fill='#f3f2ee'/>${Array.from({ length: 22 }, (_, i) => `<circle cx='${w * 0.42}' cy='${h * 0.5}' r='${(i + 1) * h * 0.035}' fill='none' stroke='#111' stroke-opacity='${0.9 - i * 0.035}' stroke-width='1.4'/>`).join('')}${label(w, h, 'MOCK EXPERIMENT / RING FIELD', '#111')}`),
  (w, h) => svg(w, h, `<rect width='${w}' height='${h}' fill='#111214'/>${Array.from({ length: 26 }, (_, r) => Array.from({ length: 20 }, (_, c) => { const d = Math.hypot(c - 10, r - 11); return `<circle cx='${w * (0.06 + c * 0.046)}' cy='${h * (0.05 + r * 0.035)}' r='${Math.max(0.6, 5 - d * 0.32)}' fill='#e4edb4' opacity='${Math.max(0.15, 1 - d * 0.07)}'/>`; }).join('')).join('')}${label(w, h, 'MOCK EXPERIMENT / DOT WEATHER', '#e4edb4')}`),
  (w, h) => svg(w, h, `<rect width='${w}' height='${h}' fill='#dfe5f2'/>${Array.from({ length: 36 }, (_, i) => `<line x1='${w / 2}' y1='${h / 2}' x2='${w / 2 + Math.cos(i / 36 * 6.283) * w * 0.42}' y2='${h / 2 + Math.sin(i / 36 * 6.283) * h * 0.42}' stroke='#1b2a55' stroke-opacity='${0.25 + (i % 3) * 0.2}'/>`).join('')}<circle cx='${w / 2}' cy='${h / 2}' r='${w * 0.12}' fill='#1b2a55'/>${label(w, h, 'MOCK EXPERIMENT / TYPE ORBIT', '#1b2a55')}`),
  (w, h) => svg(w, h, `<rect width='${w}' height='${h}' fill='#f1ece3'/>${Array.from({ length: 30 }, (_, i) => `<path d='M0 ${h * (0.1 + i * 0.028)} ${Array.from({ length: 13 }, (_, k) => `Q ${w * (k / 12 + 1 / 24)} ${h * (0.1 + i * 0.028) + Math.sin(k + i * 0.4) * 22} ${w * ((k + 1) / 12)} ${h * (0.1 + i * 0.028)}`).join(' ')}' fill='none' stroke='#2a2a2a' stroke-opacity='0.55'/>`).join('')}${label(w, h, 'MOCK EXPERIMENT / LINE TIDE', '#2a2a2a')}`),
  (w, h) => svg(w, h, `<defs><linearGradient id='lg' x1='0' y1='0' x2='0.4' y2='1'><stop offset='0' stop-color='#f6c9a8'/><stop offset='0.55' stop-color='#c9b6e8'/><stop offset='1' stop-color='#2a2f4f'/></linearGradient>${grain('g2', 0.4, 1.3)}</defs><rect width='${w}' height='${h}' fill='url(#lg)'/><rect width='${w}' height='${h}' filter='url(#g2)'/>${label(w, h, 'MOCK EXPERIMENT / GRAIN STUDY', '#fff')}`),
  (w, h) => svg(w, h, `<rect width='${w}' height='${h}' fill='#e9ece4'/>${Array.from({ length: 10 }, (_, r) => Array.from({ length: 16 }, (_, c) => `<rect x='${w * (0.04 + c * 0.06)}' y='${h * (0.06 + r * 0.09)}' width='${w * 0.05}' height='${h * 0.075}' rx='6' fill='#5d6b46' opacity='${(Math.sin(c * 0.6 + r * 0.9) + 1) / 2 * 0.8 + 0.1}'/>`).join('')).join('')}${label(w, h, 'MOCK EXPERIMENT / SOFT GRID', '#2b3320')}`),
];

async function write(file, svgString, w, h, format = 'webp') {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let img = sharp(Buffer.from(svgString)).resize(w, h);
  img = format === 'jpg' ? img.jpeg({ quality: 86, mozjpeg: true }) : img.webp({ quality: 82, effort: 5 });
  await img.toFile(file);
}

const projects = [
  ['northbound', 2000, 1250],
  ['paper-atlas', 1500, 1875],
  ['soft-machines', 1800, 1350],
  ['field-studio', 1400, 1400],
  ['low-orbit', 2000, 1250],
  ['quiet-index', 1500, 1875],
];

for (const [slug, w, h] of projects) {
  const art = projectArt[slug];
  await write(`${OUT}/images/projects/${slug}/cover.webp`, art(w, h, 0), w, h);
  await write(`${OUT}/images/projects/${slug}/shot-1.webp`, art(1600, 1000, 0.6), 1600, 1000);
  await write(`${OUT}/images/projects/${slug}/shot-2.webp`, art(1200, 1500, 1), 1200, 1500);
}

const photos = [
  ['frame-01', 1200, 1500, ['#e9d6c2', '#f4b37a', '#c76d4c', '#fff3d6'], 'WARM LIGHT'],
  ['frame-02', 1400, 1000, ['#d9dadb', '#f2f2f0', '#9a9ca0', '#ffffff'], 'GREY FIELD'],
  ['frame-03', 1000, 1250, ['#dfe6d2', '#b7c99a', '#eef3e2', '#7d9466'], 'PALE GREEN'],
  ['frame-04', 1500, 1000, ['#d8cbe0', '#f1b9a6', '#7f79a8', '#fbe3c9'], 'DUSK'],
];
for (const [name, w, h, colors, tag] of photos) await write(`${OUT}/images/offscreen/${name}.webp`, photo(w, h, colors, tag), w, h);

const expSizes = [
  [1600, 1000],
  [1000, 1300],
  [1200, 1200],
  [1200, 1200],
  [1000, 1300],
  [1600, 1000],
];
for (let i = 0; i < experiments.length; i++) {
  const [w, h] = expSizes[i];
  await write(`${OUT}/images/playground/exp-0${i + 1}.webp`, experiments[i](w, h), w, h);
}

/* ---------- Open Graph card with the character cut-out ---------- */
{
  const w = 1200;
  const h = 630;
  const bg = svg(w, h, `
    <rect width='${w}' height='${h}' fill='#fbfbf9'/>
    ${Array.from({ length: 7 }, (_, i) => `<line x1='${40 + i * 186.7}' x2='${40 + i * 186.7}' y1='0' y2='${h}' stroke='#0c0c0d' stroke-opacity='0.06'/>`).join('')}
    <text x='48' y='86' ${mono} font-size='16' letter-spacing='2' fill='#74747a'>CREATIVE DEVELOPER — PLACEHOLDER</text>
    <text x='40' y='470' ${sans} font-size='150' font-weight='600' letter-spacing='-8' fill='#0c0c0d'>Your Name</text>
    <rect x='48' y='520' width='210' height='34' fill='#e4edb4'/>
    <text x='60' y='543' ${mono} font-size='14' letter-spacing='1' fill='#0c0c0d'>PORTFOLIO — 2026</text>`);
  const base = await sharp(Buffer.from(bg)).png().toBuffer();
  const fig = await sharp(`${OUT}/images/character/placeholder.webp`).resize({ height: 600 }).toBuffer();
  await sharp(base)
    .composite([{ input: fig, left: 880, top: 30 }])
    .jpeg({ quality: 86, mozjpeg: true })
    .toFile(`${OUT}/og.jpg`);
}

console.log('placeholders written');
