import { defineConfig, devices } from '@playwright/test';

const baseURL = `http://127.0.0.1:4173/${process.env.REPO_NAME || 'Clubhouse-Games'}/`;
export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  workers: 2,
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'node scripts/preview-pages.mjs',
    env: { PREVIEW_PORT: '4173' },
    url: baseURL,
    reuseExistingServer: false,
  },
});
