import { expect, test } from '@playwright/test';
import { collectErrors } from './helpers';

const routes = ['/', '/work', '/work/northbound', '/about', '/playground', '/contact'];

for (const route of routes) {
  test(`${route} renders without errors or horizontal overflow`, async ({ page }) => {
    const errors = collectErrors(page);
    const res = await page.goto(route);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1:visible')).toHaveCount(1);
    await page.waitForTimeout(1500);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });
}

test('unknown routes return 404', async ({ page }) => {
  const res = await page.goto('/does-not-exist');
  expect(res?.status()).toBe(404);
  await expect(page.getByText('Lost.')).toBeVisible();
});

test('SEO: metadata, canonical, structured data, sitemap, robots', async ({ page, request }) => {
  await page.goto('/work/northbound');
  await expect(page).toHaveTitle(/Northbound/);
  expect(await page.locator('meta[name="description"]').getAttribute('content')).toBeTruthy();
  expect(await page.locator('link[rel="canonical"]').getAttribute('href')).toContain('/work/northbound');
  expect(await page.locator('meta[property="og:image"]').count()).toBeGreaterThan(0);
  const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(ld.join(' ')).toContain('"CreativeWork"');
  expect(ld.join(' ')).toContain('"Person"');

  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.ok()).toBeTruthy();
  expect(await sitemap.text()).toContain('/work/northbound');
  const robots = await request.get('/robots.txt');
  expect(await robots.text()).toContain('Sitemap:');
});

test('content is server-rendered (crawlable without JavaScript)', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto('/');
  const html = await page.content();
  expect(html).toContain('Building Experiences');
  expect(html).toContain('Selected');
  expect(html).toContain('Northbound');
  // The preloader must never block a no-JS visitor.
  await expect(page.locator('h1:visible').first()).toBeVisible();
  await ctx.close();
});
