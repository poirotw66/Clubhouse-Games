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

async function startEasyDrill(page, isMobile) {
  await activate(page.getByRole('button', { name: '簡單', exact: true }), isMobile);
  await activate(page.getByRole('button', { name: /10 球/ }), isMobile);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // Park the racket in a corner so approaching shuttles are not soft-blocked (no swing).
  const frame = await gameFrame(page);
  await frame.evaluate(() => {
    window.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 8, clientY: 8, bubbles: true }),
    );
  });
}

async function waitForMissHaptic(page) {
  const frame = await gameFrame(page);
  // Natural miss: shuttle clears the court → iframe posts JUICE_HAPTIC → parent haptic('error').
  await expect
    .poll(async () => frame.evaluate(() => document.getElementById('miss-val')?.textContent || '0'), {
      timeout: 30_000,
    })
    .not.toBe('0');
  await expect
    .poll(async () => page.evaluate(() => window.__vibrateCalls?.length ?? 0), {
      timeout: 5_000,
    })
    .toBeGreaterThan(0);
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

test('block-the-smash: miss posts shared haptic through parent shell', async ({ page, isMobile }) => {
  test.skip(!includesGame('Block-the-smash'), 'selective CI');
  test.setTimeout(60_000);
  await page.addInitScript(() => {
    window.__vibrateCalls = [];
    navigator.vibrate = (pattern) => {
      window.__vibrateCalls.push(pattern);
      return true;
    };
  });
  await openSmash(page);
  await startEasyDrill(page, isMobile);
  await waitForMissHaptic(page);
  const patterns = await page.evaluate(() => window.__vibrateCalls);
  expect(patterns.length).toBeGreaterThan(0);
  // error preset is a multi-pulse array
  expect(Array.isArray(patterns[0])).toBe(true);
});

test('block-the-smash: juice respects haptics off on miss', async ({ page, isMobile }) => {
  test.skip(!includesGame('Block-the-smash'), 'selective CI');
  test.setTimeout(60_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    localStorage.setItem('clubhouse:juice', JSON.stringify({ haptics: false, fx: 'full' }));
    window.__vibrateCalls = [];
    navigator.vibrate = (pattern) => {
      window.__vibrateCalls.push(pattern);
      return true;
    };
  });
  await openSmash(page);
  await startEasyDrill(page, isMobile);
  const frame = await gameFrame(page);
  await expect
    .poll(async () => frame.evaluate(() => document.getElementById('miss-val')?.textContent || '0'), {
      timeout: 30_000,
    })
    .not.toBe('0');
  const vibrateCount = await page.evaluate(() => window.__vibrateCalls.length);
  expect(vibrateCount).toBe(0);
});
