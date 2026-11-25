import { expect, test } from '@playwright/test';
import { collectErrors, experience } from './helpers';

test.describe('mobile & tablet foundation', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch devices only');

  test('no WebGL, no motion libraries, no desktop scene markup', async ({ page }) => {
    const errors = collectErrors(page);
    const scripts: string[] = [];
    page.on('response', async (r) => {
      if (r.request().resourceType() !== 'script') return;
      try {
        scripts.push(await r.text());
      } catch {
        /* body unavailable (e.g. redirect) */
      }
    });
    await page.goto('/');
    await page.waitForTimeout(3000);
    await page.mouse.wheel(0, 1500).catch(() => {});
    await page.waitForTimeout(1000);

    expect(await experience(page)).toBe('mobile');
    expect(await page.locator('canvas').count()).toBe(0);
    // The desktop tree is removed after hydration (it was only CSS-hidden in the HTML).
    expect(await page.locator('[data-scene="hero-intro"]').count()).toBe(0);
    expect(await page.locator('.only-mobile').count()).toBe(1);

    const js = scripts.join('\n');
    expect(js, 'three.js must not be downloaded on mobile').not.toContain('WebGLRenderer');
    expect(js, 'GSAP ScrollTrigger must not be downloaded on mobile').not.toContain('ScrollTrigger');
    expect(js, 'Lenis must not be downloaded on mobile').not.toContain('lenis-smooth');
    expect(errors).toEqual([]);
  });

  test('character image and contact links are present', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('img', { name: /grey hoodie/ })).toBeVisible();
    await expect(page.locator('.only-mobile a[href^="mailto:"]')).toBeVisible();
  });
});
