import { test, expect } from '@playwright/test';

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

function activate(locator, isMobile) {
  return isMobile ? locator.tap() : locator.click();
}

/** Stub vibrate + mark userActivation so shared juice canVibrate() is not gated. */
async function stubHaptics(page, { haptics = true } = {}) {
  await page.addInitScript((opts) => {
    window.__vibrateCalls = [];
    localStorage.setItem(
      'clubhouse:juice',
      JSON.stringify({ haptics: opts.haptics, fx: 'full' }),
    );
    Object.defineProperty(navigator, 'userActivation', {
      configurable: true,
      get: () => ({ hasBeenActive: true, isActive: true }),
    });
    navigator.vibrate = (pattern) => {
      window.__vibrateCalls.push(pattern);
      return true;
    };
  }, { haptics });
}

async function openSmash(page) {
  await page.goto('./Games/Block-the-smash/');
  await expect(page.getByRole('heading', { name: '羽毛球接殺' })).toBeVisible();
  await expect(page.locator('[data-juice-settings="1"]')).toBeVisible();
}

async function gameFrame(page) {
  const frame = page.frames().find((f) => /game\.html/i.test(f.url()));
  if (!frame) throw new Error('game.html iframe not found');
  return frame;
}

/**
 * Simulate the iframe miss path: game.html posts JUICE_HAPTIC → parent shell
 * calls haptic('error'). Avoids waiting on a natural shuttle miss (flaky in CI).
 */
async function postMissHaptic(page) {
  const frame = await gameFrame(page);
  await frame.evaluate(() => {
    parent.postMessage({ type: 'JUICE_HAPTIC', payload: 'error' }, '*');
  });
}

test('block-the-smash: juice settings persist under clubhouse:juice', async ({ page, isMobile }) => {
  test.skip(!includesGame('Block-the-smash'), 'selective CI');
  await openSmash(page);
  const settings = page.locator('[data-juice-settings="1"]');
  await expect(settings.getByRole('checkbox', { name: '觸覺震動' })).toBeChecked();

  await activate(settings.getByRole('checkbox', { name: '觸覺震動' }), isMobile);
  await activate(settings.getByRole('button', { name: '輕量', exact: true }), isMobile);

  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('clubhouse:juice') || '{}'),
  );
  expect(stored.haptics).toBe(false);
  expect(stored.fx).toBe('low');
});

test('block-the-smash: miss posts shared haptic through parent shell', async ({ page }) => {
  test.skip(!includesGame('Block-the-smash'), 'selective CI');
  await stubHaptics(page, { haptics: true });
  await openSmash(page);
  // Wait for game.html iframe so the parent message listener is live.
  await expect.poll(async () => (await gameFrame(page)).url(), { timeout: 10_000 }).toMatch(/game\.html/i);

  await postMissHaptic(page);

  await expect
    .poll(async () => page.evaluate(() => window.__vibrateCalls?.length ?? 0), {
      timeout: 5_000,
    })
    .toBeGreaterThan(0);
  const patterns = await page.evaluate(() => window.__vibrateCalls);
  // error preset is a multi-pulse array
  expect(Array.isArray(patterns[0])).toBe(true);
});

test('block-the-smash: juice respects haptics off on miss', async ({ page }) => {
  test.skip(!includesGame('Block-the-smash'), 'selective CI');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await stubHaptics(page, { haptics: false });
  await openSmash(page);
  await expect.poll(async () => (await gameFrame(page)).url(), { timeout: 10_000 }).toMatch(/game\.html/i);

  await postMissHaptic(page);
  await page.waitForTimeout(300);

  const vibrateCount = await page.evaluate(() => window.__vibrateCalls.length);
  expect(vibrateCount).toBe(0);
});
