import { test, expect } from '@playwright/test';

/**
 * Blackjack-only juice coverage. Kept out of site.spec.mjs to avoid merge
 * conflicts with parallel game juice agents.
 */

function resolveGameFilter() {
  const raw = (process.env.CI_GAME_FILTER || '').trim();
  if (!raw || raw === '*' || raw.toLowerCase() === 'full') return null;
  if (raw === '__none__') return new Set();
  return new Set(raw.split(/[\s,]+/).filter(Boolean));
}

const gameFilter = resolveGameFilter();
function includesGame(folder) {
  return !gameFilter || gameFilter.has(folder);
}

function activate(locator, isMobile) {
  return isMobile ? locator.tap() : locator.click();
}

test.beforeEach(async ({ page, baseURL }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && message.location().url.startsWith(new URL(baseURL).origin)) {
      errors.push(message.text());
    }
  });
  page.on('response', (response) => {
    if (response.url().startsWith(new URL(baseURL).origin) && response.status() >= 400) {
      errors.push(`${response.status()} ${response.url()}`);
    }
  });
  page.on('requestfailed', (request) => {
    if (
      request.url().startsWith(new URL(baseURL).origin) &&
      !request.failure()?.errorText.includes('ERR_ABORTED')
    ) {
      errors.push(`${request.failure()?.errorText} ${request.url()}`);
    }
  });
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) =>
    route.fulfill({ body: '', contentType: 'text/css' }),
  );
  page.__runtimeErrors = errors;
});

test('blackjack: juice settings panel in rules modal', async ({ page, isMobile }) => {
  test.skip(!includesGame('Blackjack-main'), 'selective CI');
  await page.goto('./Games/Blackjack-main/');
  await activate(page.getByRole('button', { name: '規則' }), isMobile);
  await expect(page.getByRole('heading', { name: '規則與模式' })).toBeVisible();
  const panel = page.locator('[data-juice-settings="1"]');
  await expect(panel).toBeVisible();
  await expect(panel.getByLabel('觸覺震動')).toBeVisible();
  await expect(panel.getByRole('group', { name: '特效強度' })).toBeVisible();
  expect(page.__runtimeErrors).toEqual([]);
});

test('blackjack: juice chip tap and deal place+dust', async ({ page, isMobile }) => {
  test.skip(!includesGame('Blackjack-main'), 'selective CI');
  test.setTimeout(45_000);
  await page.addInitScript(() => {
    window.__vibrateCalls = [];
    navigator.vibrate = (pattern) => {
      window.__vibrateCalls.push(pattern);
      return true;
    };
  });
  await page.goto('./Games/Blackjack-main/');
  await expect(page.locator('[data-bj-felt="1"]')).toBeVisible();

  await activate(page.getByRole('button', { name: '$10', exact: true }), isMobile);
  await expect
    .poll(async () => page.evaluate(() => window.__vibrateCalls.length))
    .toBeGreaterThan(0);

  const afterChip = await page.evaluate(() => window.__vibrateCalls.length);
  await activate(page.getByRole('button', { name: '發牌' }), isMobile);
  await expect
    .poll(async () => page.evaluate(() => window.__vibrateCalls.length))
    .toBeGreaterThan(afterChip);
  await expect(page.locator('[data-clubhouse-juice="particles"]')).toHaveCount(1);
  expect(page.__runtimeErrors).toEqual([]);
});

test('blackjack: juice respects reduced-motion and haptics off', async ({ page, isMobile }) => {
  test.skip(!includesGame('Blackjack-main'), 'selective CI');
  test.setTimeout(45_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    localStorage.setItem('clubhouse:juice', JSON.stringify({ haptics: false, fx: 'full' }));
    window.__vibrateCalls = [];
    navigator.vibrate = (pattern) => {
      window.__vibrateCalls.push(pattern);
      return true;
    };
  });
  await page.goto('./Games/Blackjack-main/');
  await activate(page.getByRole('button', { name: '$10', exact: true }), isMobile);
  await activate(page.getByRole('button', { name: '發牌' }), isMobile);
  await expect(page.locator('[data-bj-felt="1"]')).not.toHaveAttribute('data-juice-shake', '1');
  const vibrateCount = await page.evaluate(() => window.__vibrateCalls.length);
  expect(vibrateCount).toBe(0);
  expect(page.__runtimeErrors).toEqual([]);
});
