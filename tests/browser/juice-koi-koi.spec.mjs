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

function monthFromAlt(alt) {
  const m = String(alt || '').match(/^(\d+)月/);
  return m ? Number(m[1]) : null;
}

/**
 * Play one capturing hand card (and field pick when two options).
 * Avoids `.animate-pulse` — hint marks both hand and field, and field is first in DOM.
 */
async function playOneCapture(page, isMobile) {
  const fieldImgs = page.locator('[data-kk-table="1"] img[alt]');
  const fieldMonths = await fieldImgs.evaluateAll((els) =>
    els.map((el) => {
      const m = (el.getAttribute('alt') || '').match(/^(\d+)月/);
      return m ? Number(m[1]) : null;
    }).filter((n) => n != null),
  );
  const counts = new Map();
  for (const month of fieldMonths) counts.set(month, (counts.get(month) || 0) + 1);

  const handPanel = page.locator('.wafu-panel').filter({ has: page.getByText('你的手牌', { exact: true }) });
  const handImgs = handPanel.locator('img[alt]');
  const n = await handImgs.count();

  let pick = -1;
  let pickMonth = null;
  // Prefer single/triple field matches so playSfx('match') fires on the hand click.
  for (let prefer of [1, 3, 2]) {
    for (let i = 0; i < n; i++) {
      const alt = await handImgs.nth(i).getAttribute('alt');
      const month = monthFromAlt(alt);
      if (month != null && counts.get(month) === prefer) {
        pick = i;
        pickMonth = month;
        break;
      }
    }
    if (pick >= 0) break;
  }
  if (pick < 0) throw new Error('no hand/field month match available');

  await activate(handImgs.nth(pick).locator('xpath=..'), isMobile);

  if (counts.get(pickMonth) === 2) {
    const fieldCard = page.locator(`[data-kk-table="1"] img[alt^="${pickMonth}月"]`).first();
    await activate(fieldCard.locator('xpath=..'), isMobile);
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
  test.setTimeout(60_000);
  await page.addInitScript(() => {
    localStorage.setItem('clubhouse-koi-koi-howto-seen', '1');
    window.__vibrateCalls = [];
    navigator.vibrate = (pattern) => {
      window.__vibrateCalls.push(pattern);
      return true;
    };
  });
  await page.goto('./Games/Koi-Koi/');

  // Restart deals until a month match exists (most deals do).
  let captured = false;
  for (let attempt = 0; attempt < 12; attempt++) {
    if (attempt === 0) {
      await activate(page.getByRole('button', { name: '開始對局' }), isMobile);
    } else {
      // Undo is unavailable at open; start a fresh deal via idle restart.
      await page.goto('./Games/Koi-Koi/');
      await activate(page.getByRole('button', { name: '開始對局' }), isMobile);
    }
    await expect(page.locator('[data-kk-table="1"]')).toBeVisible();
    try {
      await playOneCapture(page, isMobile);
      await expect(page.getByText('配對成功', { exact: false })).toBeVisible({ timeout: 3_000 });
      captured = true;
      break;
    } catch {
      // try another deal
    }
  }
  expect(captured).toBe(true);

  const vibrateCount = await page.evaluate(() => window.__vibrateCalls.length);
  expect(vibrateCount).toBeGreaterThan(0);
  await expect(page.locator('[data-clubhouse-juice="particles"]')).toHaveCount(1);
});

test('koi-koi: juice respects reduced-motion and haptics off', async ({ page, isMobile }) => {
  test.skip(!includesGame('Koi-Koi'), 'selective CI');
  test.setTimeout(60_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
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

  let captured = false;
  for (let attempt = 0; attempt < 12; attempt++) {
    if (attempt === 0) {
      await activate(page.getByRole('button', { name: '開始對局' }), isMobile);
    } else {
      await page.goto('./Games/Koi-Koi/');
      await activate(page.getByRole('button', { name: '開始對局' }), isMobile);
    }
    try {
      await playOneCapture(page, isMobile);
      await expect(page.getByText('配對成功', { exact: false })).toBeVisible({ timeout: 3_000 });
      captured = true;
      break;
    } catch {
      // try another deal
    }
  }
  expect(captured).toBe(true);

  await expect(page.locator('[data-kk-table="1"]')).not.toHaveAttribute('data-juice-shake', '1');
  const vibrateCount = await page.evaluate(() => window.__vibrateCalls.length);
  expect(vibrateCount).toBe(0);
});
