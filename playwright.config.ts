import { defineConfig, devices } from '@playwright/test';

/**
 * E2E suite. By default it builds nothing: run `npm run build` first, then
 * `npm run test:e2e` starts `next start` on :3200. Point BASE_URL at a running
 * server to skip that. Headless WebGL uses SwiftShader (software), so frame
 * rates in CI are not representative — see README for real-GPU numbers.
 */
const port = 3200;
const swiftshader = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const desktop = { viewport: { width: 1440, height: 900 } };

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.BASE_URL || `http://localhost:${port}`,
    trace: 'retain-on-failure',
  },
  webServer: process.env.BASE_URL
    ? undefined
    : { command: `npx next start -p ${port}`, port, reuseExistingServer: true, timeout: 120_000 },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], ...desktop, launchOptions: { args: swiftshader } } },
    { name: 'desktop-firefox', use: { ...devices['Desktop Firefox'], ...desktop } },
    { name: 'desktop-webkit', use: { ...devices['Desktop Safari'], ...desktop } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
    { name: 'mobile-webkit', use: { ...devices['iPhone 15'] } },
    { name: 'tablet-webkit', use: { ...devices['iPad Pro 11 landscape'] } },
  ],
});
