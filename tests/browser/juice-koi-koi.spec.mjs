import { test, expect } from '@playwright/test';
import fs from 'node:fs';

/**
 * Selective PR CI sets CI_GAME_FILTER to a space/comma-separated list of
 * Games/<folder> names. `__none__` skips per-game loads/deep tests but keeps
 * site-shell coverage. Unset / empty / `full` / `*` → every workspace game.
 * (Same helper shape as site.spec.mjs — keep in sync for filter semantics.)
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

// Touch games.json so selective CI still treats this file as game-aware.
void fs.readFileSync(new URL('../../data/games.json', import.meta.url));

/** Touch vs click — same helper shape as site.spec.mjs. */
function activate(locator, isMobile) {
  return isMobile ? locator.tap() : locator.click();
}

/** Deterministic Fisher–Yates via mulberry32(seed) replacing Math.random. */
function installSeededRandom(seed) {
  return `
    (() => {
      let a = ${seed} >>> 0;
      Math.random = () => {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    })();
  `;
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
    if (request.url().startsWith(new URL(baseURL).origin) && !request.failure()?.errorText.includes('ERR_ABORTED')) {
      errors.push(`${request.failure()?.errorText} ${request.url()}`);
    }
  });
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) =>
    route.fulfill({ body: '', contentType: 'text/css' }),
  );
  page.__runtimeErrors = errors;
});

test.afterEach(async ({ page }) => {
  expect(page.__runtimeErrors || []).toEqual([]);
});

test('koi-koi: juice settings panel in rules modal', async ({ page, isMobile }) => {
  test.skip(!includesGame('Koi-Koi'), 'selective CI');
  await page.addInitScript(() => {
    localStorage.setItem('clubhouse-koi-koi-howto-seen', '1');
  });
  await page.goto('./Games/Koi-Koi/');
  await activate(page.getByRole('button', { name: '遊戲規則' }), isMobile);
  const dialog = page.getByRole('dialog', { name: '遊戲規則' });
  await expect(dialog).toBeVisible();
  const panel = dialog.locator('[data-juice-settings="1"]');
  await expect(panel).toBeVisible();
  await expect(panel.getByLabel('觸覺震動')).toBeVisible();
  await expect(panel.getByRole('group', { name: '特效強度' })).toBeVisible();
});

test('koi-koi: juice match place+sparkle vibrate stub', async ({ page, isMobile }) => {
  test.skip(!includesGame('Koi-Koi'), 'selective CI');
  test.setTimeout(45_000);
  // Seed 0: player hand has a single-month field match (12月 桐) for an instant capture.
  await page.addInitScript(installSeededRandom(0));
  await page.addInitScript(() => {
    localStorage.setItem('clubhouse-koi-koi-howto-seen', '1');
    window.__vibrateCalls = [];
    navigator.vibrate = (pattern) => {
      window.__vibrateCalls.push(pattern);
      return true;
    };
  });
  await page.goto('./Games/Koi-Koi/');
  await activate(page.getByRole('button', { name: '開始對局' }), isMobile);
  await expect(page.locator('[data-kk-table="1"]')).toBeVisible();
  await activate(page.getByRole('button', { name: '提示' }), isMobile);
  // After hint, only the recommended hand card pulses (field is not highlighted yet).
  const hinted = page.locator('.animate-pulse').first();
  await expect(hinted).toBeVisible();
  await activate(hinted, isMobile);
  await expect(page.getByText('配對成功', { exact: false })).toBeVisible({ timeout: 5_000 });
  const vibrateCount = await page.evaluate(() => window.__vibrateCalls.length);
  expect(vibrateCount).toBeGreaterThan(0);
  await expect(page.locator('[data-clubhouse-juice="particles"]')).toHaveCount(1);
});

test('koi-koi: juice respects reduced-motion and haptics off', async ({ page, isMobile }) => {
  test.skip(!includesGame('Koi-Koi'), 'selective CI');
  test.setTimeout(45_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(installSeededRandom(0));
  await page.addInitScript(() => {
    localStorage.setItem('clubhouse-koi-koi-howto-seen', '1');
    localStorage.setItem('clubhouse:juice', JSON.stringify({ haptics: false, fx: 'full' }));
    window.__vibrateCalls = [];
    navigator.vibrate = (pattern) => {
      window.__vibrateCalls.push(pattern);
      return true;
    };
  });
  await page.goto('./Games/Koi-Koi/');
  await activate(page.getByRole('button', { name: '開始對局' }), isMobile);
  await activate(page.getByRole('button', { name: '提示' }), isMobile);
  const hinted = page.locator('.animate-pulse').first();
  await activate(hinted, isMobile);
  await expect(page.getByText('配對成功', { exact: false })).toBeVisible({ timeout: 5_000 });
  await expect(page.locator('[data-kk-table="1"]')).not.toHaveAttribute('data-juice-shake', '1');
  const vibrateCount = await page.evaluate(() => window.__vibrateCalls.length);
  expect(vibrateCount).toBe(0);
});
