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

/** Desktop hides on-screen controls (`md:hidden`); use keys. Mobile taps the pad. */
async function focusPlayfield(page) {
  await page.locator('[data-tetris-board="1"]').click({ position: { x: 8, y: 8 } });
}

async function rotateClockwise(page, isMobile) {
  if (isMobile) {
    await activate(page.getByRole('button', { name: '順時針旋轉' }), true);
  } else {
    await focusPlayfield(page);
    await page.keyboard.press('ArrowUp');
  }
}

async function hardDropPiece(page, isMobile) {
  if (isMobile) {
    await activate(page.getByRole('button', { name: '瞬間落下' }), true);
  } else {
    await focusPlayfield(page);
    await page.keyboard.press('Space');
  }
}

test('tetris: juice settings, rotate tap, hard-drop shake', async ({ page, isMobile }) => {
  test.skip(!includesGame('Tetris'), 'selective CI');
  await page.addInitScript(() => {
    localStorage.removeItem('clubhouse:tetris-coach');
    window.__vibrateCalls = [];
    navigator.vibrate = (pattern) => {
      window.__vibrateCalls.push(pattern);
      return true;
    };
  });
  await page.goto('./Games/Tetris/');
  await expect(page.getByRole('region', { name: '技巧說明' })).toBeVisible();
  await expect(page.locator('[data-juice-settings="1"]')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: '觸覺震動' })).toBeVisible();

  const beforeRotate = await page.evaluate(() => window.__vibrateCalls.length);
  await rotateClockwise(page, isMobile);
  await expect
    .poll(async () => page.evaluate(() => window.__vibrateCalls.length))
    .toBeGreaterThan(beforeRotate);

  await hardDropPiece(page, isMobile);
  await expect(page.locator('[data-tetris-board="1"]')).toHaveAttribute('data-juice-shake', '1');
  const vibrateCount = await page.evaluate(() => window.__vibrateCalls.length);
  expect(vibrateCount).toBeGreaterThan(beforeRotate);
});

test('tetris: juice respects reduced-motion and haptics off', async ({ page, isMobile }) => {
  test.skip(!includesGame('Tetris'), 'selective CI');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    localStorage.removeItem('clubhouse:tetris-coach');
    localStorage.setItem('clubhouse:juice', JSON.stringify({ haptics: false, fx: 'full' }));
    window.__vibrateCalls = [];
    navigator.vibrate = (pattern) => {
      window.__vibrateCalls.push(pattern);
      return true;
    };
  });
  await page.goto('./Games/Tetris/');
  await expect(page.locator('[data-juice-settings="1"]')).toBeVisible();
  await rotateClockwise(page, isMobile);
  await hardDropPiece(page, isMobile);
  await expect(page.locator('[data-tetris-board="1"]')).not.toHaveAttribute('data-juice-shake', '1');
  const vibrateCount = await page.evaluate(() => window.__vibrateCalls.length);
  expect(vibrateCount).toBe(0);
});
