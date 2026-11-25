import type { Page } from '@playwright/test';

/** Console noise that comes from headless/software GL or dev tooling, not from the site. */
const IGNORED = [/GL Driver Message/i, /KHR_parallel_shader_compile/i, /THREE\.Clock/i, /React DevTools/i, /GPU stall/i, /WebGL.*(software|swiftshader)/i, /Automatic fallback to software WebGL/i];

export function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (IGNORED.some((r) => r.test(text))) return;
    errors.push(`console.error: ${text}`);
  });
  return errors;
}

export async function experience(page: Page) {
  return page.evaluate(() => document.documentElement.dataset.experience);
}

/**
 * Scroll to a Y position with a native scroll (like dragging the scrollbar).
 * Lenis syncs to native scroll and ScrollTrigger updates from it, so this
 * exercises the same choreography deterministically in every engine.
 */
export async function wheelTo(page: Page, target: number) {
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), target);
  await settleScroll(page);
}

/** Wait until smooth scrolling has come to rest. */
export async function settleScroll(page: Page) {
  let last = -1;
  for (let i = 0; i < 20; i++) {
    const y = await page.evaluate(() => window.scrollY);
    if (Math.abs(y - last) < 1) return y;
    last = y;
    await page.waitForTimeout(150);
  }
  return last;
}

export async function waitForPreloader(page: Page) {
  await page.waitForFunction(() => !document.documentElement.classList.contains('is-preloading'), null, { timeout: 30_000 });
}
