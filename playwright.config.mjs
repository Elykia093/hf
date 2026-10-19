import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 240_000,
  expect: { timeout: 20_000 },
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    browserName: 'chromium',
    viewport: { width: 1365, height: 768 },
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
    screenshot: 'on',
    trace: 'retain-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    { name: 'live', testMatch: 'keepalive.spec.mjs', timeout: 660_000 },
    { name: 'regression', testMatch: 'visit-space.spec.mjs', timeout: 30_000 }
  ]
});
