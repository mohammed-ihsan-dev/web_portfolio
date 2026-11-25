import { expect, test } from '@playwright/test';
import { collectErrors, experience, settleScroll, waitForPreloader, wheelTo } from './helpers';

test.describe('desktop experience', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop only');

  test('preloader hands over to the hero; one shared canvas', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/');
    const mode = await experience(page);
    test.skip(mode !== 'desktop-3d', `WebGL experience not available in this browser (${mode})`);
    await waitForPreloader(page);
    await page.waitForFunction(() => document.documentElement.dataset.scene === 'ready', null, { timeout: 30_000 });
    expect(await page.locator('canvas').count()).toBe(1);
    await expect(page.locator('[data-hl-line]').first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('hero → intro sequence is scroll-driven and reversible', async ({ page }) => {
    await page.goto('/');
    test.skip((await experience(page)) !== 'desktop-3d', 'needs WebGL');
    await waitForPreloader(page);
    const sectionHeight = await page.locator('[data-scene="hero-intro"]').evaluate((el) => el.getBoundingClientRect().height);
    const vh = await page.evaluate(() => window.innerHeight);
    const end = sectionHeight - vh;

    const copyOpacity = () => page.locator('[data-intro-copy]').first().evaluate((el) => Number(getComputedStyle(el).opacity));
    const headlineY = () =>
      page.locator('[data-hl-exit]').first().evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m42);

    expect(await copyOpacity()).toBeLessThan(0.05);
    await wheelTo(page, end);
    await page.waitForTimeout(1800);
    expect(await copyOpacity()).toBeGreaterThan(0.95);
    expect(await headlineY()).toBeLessThan(-20);

    await wheelTo(page, 0);
    await page.waitForTimeout(1800);
    expect(await copyOpacity()).toBeLessThan(0.05);
    expect(Math.abs(await headlineY())).toBeLessThan(1);
  });

  test('static fallback when WebGL is disabled (?webgl=0)', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/?webgl=0');
    expect(await experience(page)).toBe('desktop-static');
    await page.waitForTimeout(1500);
    expect(await page.locator('canvas').count()).toBe(0);
    await expect(page.locator('[data-hero-fallback] img')).toBeVisible();
    await expect(page.locator('h1:visible')).toContainText('Building Experiences');
    expect(errors).toEqual([]);
  });

  test('prefers-reduced-motion gets the static experience', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    expect(await experience(page)).toBe('desktop-static');
    expect(await page.locator('canvas').count()).toBe(0);
    expect(await page.evaluate(() => document.documentElement.classList.contains('is-preloading'))).toBe(false);
  });

  test('client-side navigation with transition, then back restores scroll', async ({ page }) => {
    await page.goto('/work');
    await waitForPreloader(page).catch(() => {});
    await wheelTo(page, 420);
    const before = await settleScroll(page);

    // Mark the document: a full reload would lose this flag.
    await page.evaluate(() => ((window as unknown as { __spa: boolean }).__spa = true));
    await page.locator('a[href="/work/paper-atlas"]').first().click();
    await expect(page).toHaveURL(/\/work\/paper-atlas$/);
    await expect(page.locator('h1:visible')).toContainText('Paper Atlas');
    expect(await page.evaluate(() => (window as unknown as { __spa?: boolean }).__spa)).toBe(true);
    await page.waitForTimeout(800);
    expect(await page.evaluate(() => window.scrollY)).toBeLessThan(5);

    await page.goBack();
    await expect(page).toHaveURL(/\/work$/);
    await page.waitForTimeout(800);
    const after = await settleScroll(page);
    expect(Math.abs(after - before)).toBeLessThan(40);
  });
});
