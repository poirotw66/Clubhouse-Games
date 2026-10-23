import { test, expect } from '@playwright/test';

/**
 * Dominoes-only juice coverage. Kept out of site.spec.mjs to avoid merge
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

/** Hand tiles use aria-label "L-R"; end anchors use 「出在…」. */
async function playOneTile(page, isMobile) {
  await activate(page.getByRole('button', { name: '雙人', exact: true }), isMobile);
  // Draw rules give a clear 抽牌 path when the seat cannot match open ends.
  await activate(page.getByRole('button', { name: '摸牌制', exact: true }), isMobile);
  await expect(page.locator('[data-dominoes-board="1"]')).toBeVisible();
  await expect(page.getByRole('button', { name: /^\d+-\d+$/ }).first()).toBeVisible({
    timeout: 10_000,
  });

  for (let attempt = 0; attempt < 24; attempt++) {
    const drawBtn = page.getByRole('button', { name: '抽牌', exact: true });
    if (await drawBtn.isVisible()) {
      await activate(drawBtn, isMobile);
      continue;
    }
    const passBtn = page.getByRole('button', { name: '跳過', exact: true });
    if (await passBtn.isVisible()) {
      await activate(passBtn, isMobile);
      continue;
    }

    const endButtons = page.getByRole('button', { name: /出在/ });
    const endCount = await endButtons.count();
    const pips = new Set();
    for (let e = 0; e < endCount; e++) {
      const label = await endButtons.nth(e).getAttribute('aria-label');
      const m = label && label.match(/（(\d+)）/);
      if (m) pips.add(Number(m[1]));
    }

    const handTiles = page.getByRole('button', { name: /^\d+-\d+$/ });
    const count = await handTiles.count();
    for (let i = 0; i < count; i++) {
      const name = await handTiles.nth(i).getAttribute('aria-label');
      const parts = name ? name.split('-').map(Number) : [];
      if (pips.size > 0 && !parts.some((p) => pips.has(p))) continue;
      await activate(handTiles.nth(i), isMobile);
      const enabledEnd = page.getByRole('button', { name: /出在/ }).and(page.locator(':enabled'));
      if ((await enabledEnd.count()) > 0) {
        await activate(enabledEnd.first(), isMobile);
        return;
      }
    }
  }
  throw new Error('could not place a dominoes tile for juice coverage');
}

test('dominoes: juice settings panel in rules modal', async ({ page, isMobile }) => {
  test.skip(!includesGame('Dominoes'), 'selective CI');
  await page.addInitScript(() => {
    localStorage.setItem('clubhouse-dominoes-howto-seen', '1');
  });
  await page.goto('./Games/Dominoes/');
  await activate(page.getByRole('button', { name: '規則', exact: true }), isMobile);
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const panel = dialog.locator('[data-juice-settings="1"]');
  await expect(panel).toBeVisible();
  await expect(panel.getByLabel('觸覺震動')).toBeVisible();
  await expect(panel.getByRole('group', { name: '特效強度' })).toBeVisible();
  expect(page.__runtimeErrors).toEqual([]);
});

test('dominoes: juice place vibrate stub and dust particles', async ({ page, isMobile }) => {
  test.skip(!includesGame('Dominoes'), 'selective CI');
  test.setTimeout(45_000);
  await page.addInitScript(() => {
    localStorage.setItem('clubhouse-dominoes-howto-seen', '1');
    window.__vibrateCalls = [];
    navigator.vibrate = (pattern) => {
      window.__vibrateCalls.push(pattern);
      return true;
    };
  });
  await page.goto('./Games/Dominoes/');
  await playOneTile(page, isMobile);
  const vibrateCount = await page.evaluate(() => window.__vibrateCalls.length);
  expect(vibrateCount).toBeGreaterThan(0);
  await expect(page.locator('[data-clubhouse-juice="particles"]')).toHaveCount(1);
  expect(page.__runtimeErrors).toEqual([]);
});

test('dominoes: juice respects reduced-motion and haptics off', async ({ page, isMobile }) => {
  test.skip(!includesGame('Dominoes'), 'selective CI');
  test.setTimeout(45_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    localStorage.setItem('clubhouse-dominoes-howto-seen', '1');
    localStorage.setItem('clubhouse:juice', JSON.stringify({ haptics: false, fx: 'full' }));
    window.__vibrateCalls = [];
    navigator.vibrate = (pattern) => {
      window.__vibrateCalls.push(pattern);
      return true;
    };
  });
  await page.goto('./Games/Dominoes/');
  await playOneTile(page, isMobile);
  await expect(page.locator('[data-dominoes-board="1"]')).not.toHaveAttribute(
    'data-juice-shake',
    '1',
  );
  const vibrateCount = await page.evaluate(() => window.__vibrateCalls.length);
  expect(vibrateCount).toBe(0);
  expect(page.__runtimeErrors).toEqual([]);
});
