import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for end-to-end tests. Specs go in ./e2e (none yet — coming
 * later). `webServer` boots the Angular dev server automatically for local runs.
 *
 * First-time setup needs the browser binaries: `npx playwright install`.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm start',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
