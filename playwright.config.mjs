import { defineConfig, devices } from '@playwright/test';

const baseURL = `http://127.0.0.1:4173/${process.env.REPO_NAME || 'Clubhouse-Games'}/`;
// CI opts into smoke coverage; local and manual runs retain the complete suite.
const profile = process.env.CLUBHOUSE_TEST_PROFILE ?? 'full';
if (profile !== 'quick' && profile !== 'full') {
  throw new Error(`Invalid CLUBHOUSE_TEST_PROFILE: ${profile}. Expected quick or full.`);
}
const quick = profile === 'quick';

function resolveWorkers() {
  const raw = process.env.PLAYWRIGHT_WORKERS;
  if (raw !== undefined && raw !== '') {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isInteger(parsed) && parsed >= 1) return parsed;
  }
  // Bound WebGL contention in quick local runs as well as on CI runners.
  return process.env.CI || quick ? 2 : undefined;
}

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  workers: resolveWorkers(),
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, ...(quick ? { grep: /@smoke\b/ } : {}) },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, ...(quick ? { grep: /@mobile-smoke\b/ } : {}) },
  ],
  webServer: {
    command: 'node scripts/preview-pages.mjs',
    env: { PREVIEW_PORT: '4173' },
    url: baseURL,
    reuseExistingServer: false,
  },
});
