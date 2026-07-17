import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'e2e/reports/html' }],
    ['json', { outputFile: 'e2e/reports/results.json' }],
  ],
  use: {
    baseURL: 'https://leads.creativecomet.tn',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    actionTimeout: 15000,
    navigationTimeout: 30000,
    browserName: 'chromium',
    launchOptions: {
      executablePath: undefined, // use Playwright's bundled Chromium
    },
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'chromium-tablet',
      use: { viewport: { width: 834, height: 1194 } },
    },
    {
      name: 'chromium-mobile',
      use: { viewport: { width: 390, height: 844 } },
    },
  ],
});
