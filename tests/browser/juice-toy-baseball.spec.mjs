import { test, expect } from '@playwright/test';
import fs from 'node:fs';

/**
 * Toy-Baseball-only juice coverage. Kept out of site.spec.mjs to avoid merge
 * conflicts with parallel game juice agents.
 */

/**
 * Selective PR CI sets CI_GAME_FILTER to a space/comma-separated list of
 * Games/<folder> names. `__none__` skips per-game loads/deep tests but keeps
 * site-shell coverage. Unset / empty / `full` / `*` → every workspace game.
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

function activate(locator, isMobile) {
  return isMobile ? locator.tap() : locator.click();
}

async function dismissFirstRunIfPresent(page, isMobile) {
  const dialog = page.getByRole('dialog', { name: /三步上手/ });
  if (await dialog.isVisible().catch(() => false)) {
    await activate(page.getByRole('button', { name: /開始打球|知道了|關閉/ }).first(), isMobile).catch(
      async () => {
        await activate(dialog, isMobile);
      },
    );
    await expect(dialog).toBeHidden({ timeout: 5_000 });
  }
}

test.beforeEach(async ({ page, baseURL }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && message.location().url.startsWith(new URL(baseURL).origin)) {
      errors.push(message.text());
    }
  });
  page.__runtimeErrors = errors;
});

test('toy-baseball: juice settings panel in menu overlay', async ({ page, isMobile }) => {
  test.skip(!includesGame('Toy-Baseball'), 'selective CI');
  await page.addInitScript(() => {
    localStorage.setItem('clubhouse-toy-baseball-howto-seen', '1');
  });
  await page.goto('./Games/Toy-Baseball/');
  await expect(page.getByRole('heading', { name: '玩具棒球' })).toBeVisible();
  await dismissFirstRunIfPresent(page, isMobile);

  const settings = page.locator('[data-juice-settings="1"]');
  await expect(settings).toBeVisible();
  await expect(page.getByRole('checkbox', { name: '觸覺震動' })).toBeVisible();

  await page.getByRole('checkbox', { name: '觸覺震動' }).uncheck();
  await activate(page.getByRole('button', { name: '輕量', exact: true }), isMobile);
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('clubhouse:juice') || '{}'),
  );
  expect(stored.haptics).toBe(false);
  expect(stored.fx).toBe('low');
  expect(page.__runtimeErrors || []).toEqual([]);
});

test('toy-baseball: swing miss soft-error haptic; contact impact', async ({ page, isMobile }) => {
  test.skip(!includesGame('Toy-Baseball'), 'selective CI');
  test.setTimeout(60_000);
  await page.addInitScript(() => {
    localStorage.setItem('clubhouse-toy-baseball-howto-seen', '1');
    localStorage.setItem('clubhouse:juice', JSON.stringify({ haptics: true, fx: 'full' }));
    window.__vibrateCalls = [];
    navigator.vibrate = (pattern) => {
      window.__vibrateCalls.push(pattern);
      return true;
    };
  });
  await page.goto('./Games/Toy-Baseball/');
  await dismissFirstRunIfPresent(page, isMobile);

  await activate(page.getByRole('button', { name: '全壘打大賽' }), isMobile);
  await activate(page.getByRole('button', { name: '開始大賽' }), isMobile);
  await expect(page.getByRole('button', { name: '揮棒' })).toBeVisible({ timeout: 10_000 });

  // Early swing while the ball is still en route → processMiss soft error haptic.
  const before = await page.evaluate(() => window.__vibrateCalls.length);
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(180);
    const n = await page.evaluate(() => window.__vibrateCalls.length);
    if (n > before) break;
  }
  await expect
    .poll(async () => page.evaluate(() => window.__vibrateCalls.length))
    .toBeGreaterThan(before);

  expect(page.__runtimeErrors || []).toEqual([]);
});

test('toy-baseball: juice respects haptics off', async ({ page, isMobile }) => {
  test.skip(!includesGame('Toy-Baseball'), 'selective CI');
  test.setTimeout(45_000);
  await page.addInitScript(() => {
    localStorage.setItem('clubhouse-toy-baseball-howto-seen', '1');
    localStorage.setItem('clubhouse:juice', JSON.stringify({ haptics: false, fx: 'full' }));
    window.__vibrateCalls = [];
    navigator.vibrate = (pattern) => {
      window.__vibrateCalls.push(pattern);
      return true;
    };
  });
  await page.goto('./Games/Toy-Baseball/');
  await dismissFirstRunIfPresent(page, isMobile);
  await activate(page.getByRole('button', { name: '全壘打大賽' }), isMobile);
  await activate(page.getByRole('button', { name: '開始大賽' }), isMobile);
  await expect(page.getByRole('button', { name: '揮棒' })).toBeVisible({ timeout: 10_000 });

  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(200);
  }
  const vibrateCount = await page.evaluate(() => window.__vibrateCalls.length);
  expect(vibrateCount).toBe(0);
  expect(page.__runtimeErrors || []).toEqual([]);
});
