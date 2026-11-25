import { expect, test } from '@playwright/test';
import { waitForPreloader } from './helpers';

test('skip link is the first focus stop and targets main', async ({ page, isMobile, browserName }) => {
  test.skip(isMobile, 'keyboard flow tested on desktop');
  await page.goto('/about');
  await waitForPreloader(page).catch(() => {});
  // macOS WebKit only tabs to links with Option+Tab (Safari's default setting).
  await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
  const focused = page.locator(':focus');
  await expect(focused).toHaveText('Skip to content');
  await expect(focused).toHaveAttribute('href', '#main');
});

test('menu: dialog semantics, focus in, Escape out, focus returns', async ({ page, isMobile }) => {
  await page.goto('/about');
  await waitForPreloader(page).catch(() => {});
  const toggle = page.locator('button[aria-controls]').first();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  if (isMobile) await toggle.tap();
  else await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  const dialog = page.getByRole('dialog', { name: 'Site navigation' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('link', { name: /Work/ })).toBeVisible();
  await expect(dialog.locator('[aria-current="page"]')).toContainText('About');
  if (!isMobile) {
    await expect(page.locator(':focus')).toHaveAttribute('href', '/');
    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toBeFocused();
  } else {
    await dialog.getByRole('link', { name: /Work/ }).tap();
    await expect(page).toHaveURL(/\/work$/);
  }
});

test('every content image has an alt attribute; one visible h1 per page', async ({ page }) => {
  for (const route of ['/', '/work', '/about', '/playground']) {
    await page.goto(route);
    await page.waitForTimeout(800);
    const missing = await page.locator('img:not([alt])').count();
    expect(missing, `${route} images without alt`).toBe(0);
    await expect(page.locator('h1:visible')).toHaveCount(1);
  }
});
