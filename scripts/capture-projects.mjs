#!/usr/bin/env node
/**
 * Screenshots of the live project websites (owner-authorised client work).
 *
 *   npm run assets:projects                 all projects
 *   npm run assets:projects -- --only zinda-learn
 *
 * Raw captures go to assets-src/projects/<slug>/ (kept as sources); optimised
 * WebP at the exact sizes the site uses go to public/images/projects/<slug>/:
 *   cover.webp  landscape layouts: the desktop homepage; portrait layouts: the phone homepage
 *   shot-1.webp desktop, one screen further down the page (16:10)
 *   shot-2.webp the site on a phone (4:5; one screen down when the cover already shows the top)
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { chromium, devices } from 'playwright';

const ROOT = process.cwd();
const PROJECTS = [
  { slug: 'halima-trading', url: 'https://halimatrading.com/', cover: [2000, 1250] },
  // Its homepage is one screen (swipe carousel), so the second phone shot is the journal page.
  { slug: 'press-d-cafe', url: 'https://www.pressdcafe.ae/', cover: [1500, 1875], phoneSecond: 'https://www.pressdcafe.ae/blog' },
  { slug: 'zinda-learn', url: 'https://zinda-learn.com/', cover: [1800, 1350] },
];
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;

/** Scroll the page, or the element that actually scrolls when a site uses its own scroll container. */
async function scrollPageTo(page, y) {
  await page.evaluate((top) => {
    window.scrollTo(0, top);
    let best = null;
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      if (!/(auto|scroll)/.test(cs.overflowY) || el.scrollHeight <= el.clientHeight + 50) continue;
      if (!best || el.clientHeight * el.clientWidth > best.clientHeight * best.clientWidth) best = el;
    }
    if (best && document.documentElement.scrollHeight <= innerHeight + 50) best.scrollTop = top;
  }, y);
}

/** Load, let entrance animations and lazy images settle, then return to the top. */
async function prepare(page, url) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 }).catch(() => page.waitForLoadState('load'));
  await page.waitForTimeout(3500);
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < Math.min(h, 6000); y += 500) {
    await scrollPageTo(page, y);
    await page.waitForTimeout(250);
  }
  await scrollPageTo(page, 0);
  await page.waitForTimeout(2000);
}

const browser = await chromium.launch();
for (const p of PROJECTS) {
  if (only && only !== p.slug) continue;
  const src = path.join(ROOT, 'assets-src/projects', p.slug);
  const out = path.join(ROOT, 'public/images/projects', p.slug);
  fs.mkdirSync(src, { recursive: true });
  fs.mkdirSync(out, { recursive: true });

  // desktop: viewport sized to the cover's aspect at 1440 px wide, DPR 2
  const [cw, ch] = p.cover;
  const desk = await browser.newContext({ viewport: { width: 1440, height: ch > cw ? 900 : Math.round((1440 * ch) / cw) }, deviceScaleFactor: 2 });
  const page = await desk.newPage();
  await prepare(page, p.url);
  await page.screenshot({ path: path.join(src, 'desktop-top.png') });
  const vh = await page.evaluate(() => innerHeight);
  await page.setViewportSize({ width: 1440, height: 900 });
  await scrollPageTo(page, Math.max(900, vh));
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(src, 'desktop-section.png') });
  await desk.close();

  // phone: the first screen, and one screen further down
  const phone = await browser.newContext({ ...devices['iPhone 13'] });
  const mp = await phone.newPage();
  await prepare(mp, p.url);
  await mp.screenshot({ path: path.join(src, 'mobile-top.png') });
  if (p.phoneSecond) await prepare(mp, p.phoneSecond);
  else {
    await scrollPageTo(mp, 844);
    await mp.waitForTimeout(2500);
  }
  await mp.screenshot({ path: path.join(src, 'mobile-section.png') });
  await phone.close();

  const webp = (img, w, h, file) =>
    sharp(img).resize(w, h, { fit: 'cover', position: 'top' }).webp({ quality: 80, effort: 6 }).toFile(path.join(out, file));
  // Portrait covers read best as the phone layout; landscape ones as the desktop homepage.
  const portrait = ch > cw;
  await webp(path.join(src, portrait ? 'mobile-top.png' : 'desktop-top.png'), cw, ch, 'cover.webp');
  await webp(path.join(src, 'desktop-section.png'), 1600, 1000, 'shot-1.webp');
  await webp(path.join(src, portrait ? 'mobile-section.png' : 'mobile-top.png'), 1200, 1500, 'shot-2.webp');
  const kb = (f) => Math.round(fs.statSync(path.join(out, f)).size / 1024);
  console.log(`✓ ${p.slug}: cover ${kb('cover.webp')} KB, shot-1 ${kb('shot-1.webp')} KB, shot-2 ${kb('shot-2.webp')} KB`);
}
await browser.close();
