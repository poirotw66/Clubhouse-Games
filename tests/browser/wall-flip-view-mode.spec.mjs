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

/** Clear prefs once for the next document — not on every subsequent navigation. */
async function resetViewModeOnce(page, mode = null) {
  await page.goto('./Games/Wall-Flip/');
  await page.evaluate((next) => {
    try {
      sessionStorage.removeItem('wallflip.webglFallback');
      if (next === '2d' || next === '3d') localStorage.setItem('wallflip.viewMode', next);
      else localStorage.removeItem('wallflip.viewMode');
    } catch (e) {}
  }, mode);
}

async function openWallFlip2d(page) {
  await resetViewModeOnce(page, '2d');
  await page.goto('./Games/Wall-Flip/');
  await expect(page.locator('body[data-view-mode="2d"]')).toBeVisible();
  await expect(page.getByTestId('view-mode-switch')).toBeVisible();
  await expect(page.getByTestId('start-mode-pick')).toBeVisible();
  await expect(page.locator('canvas#c')).toBeVisible();
}

async function canvasHasInk(page, selector) {
  return page.evaluate((sel) => {
    const c = document.querySelector(sel);
    if (!(c instanceof HTMLCanvasElement) || c.width < 8 || c.height < 8) return false;
    try {
      const ctx = c.getContext('2d');
      if (ctx) {
        const { data } = ctx.getImageData(0, 0, Math.min(c.width, 64), Math.min(c.height, 64));
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] > 8 && (data[i] > 8 || data[i + 1] > 8 || data[i + 2] > 8)) return true;
        }
        return false;
      }
    } catch (e) {
      /* WebGL canvas: reading 2d pixels may throw — size + presence is enough */
    }
    return c.width > 0 && c.height > 0;
  }, selector);
}

test('wall-flip: 2D start screen renders and exposes view switch', async ({ page }) => {
  test.skip(!includesGame('Wall-Flip'), 'selective CI');
  await openWallFlip2d(page);
  await expect(page.getByTestId('view-mode-2d')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('view-mode-3d')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('start-mode-2d')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('start-mode-3d')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('start-mode-2d')).toContainText(/2D/);
  await expect(page.getByTestId('start-mode-3d')).toContainText(/3D/);
  await expect.poll(() => canvasHasInk(page, 'canvas#c'), { timeout: 8_000 }).toBe(true);
  const stored = await page.evaluate(() => localStorage.getItem('wallflip.viewMode'));
  expect(stored).toBe('2d');
});

test('wall-flip: start-panel mode card switches to 3D and preference persists', async ({ page, isMobile }) => {
  test.skip(!includesGame('Wall-Flip'), 'selective CI');
  await openWallFlip2d(page);

  const threeCard = page.getByTestId('start-mode-3d');
  await expect(threeCard).toBeVisible();
  if (isMobile) await threeCard.tap();
  else await threeCard.click();

  await expect(page).toHaveURL(/index-3d\.html/);
  await expect(page.locator('body[data-view-mode="3d"]')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#stage canvas')).toBeVisible();
  await expect(page.getByTestId('start-mode-pick')).toBeVisible();
  await expect(page.getByTestId('start-mode-3d')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('view-mode-3d')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#start')).toBeVisible();
  await expect.poll(async () => {
    return page.evaluate(() => {
      const c = document.querySelector('#stage canvas');
      return !!(c && c.width > 0 && c.height > 0);
    });
  }, { timeout: 8_000 }).toBe(true);

  const stored = await page.evaluate(() => localStorage.getItem('wallflip.viewMode'));
  expect(stored).toBe('3d');

  // Re-enter via the hub folder URL — remembered 3D preference should redirect.
  await page.goto('./Games/Wall-Flip/');
  await expect(page).toHaveURL(/index-3d\.html/);
  await expect(page.locator('body[data-view-mode="3d"]')).toBeVisible();
  await expect(page.getByTestId('start-mode-pick')).toBeVisible();
});

test('wall-flip: start-panel card switches back to 2D and is remembered', async ({ page, isMobile }) => {
  test.skip(!includesGame('Wall-Flip'), 'selective CI');
  await resetViewModeOnce(page, '3d');
  await page.goto('./Games/Wall-Flip/index-3d.html');
  await expect(page.locator('body[data-view-mode="3d"]')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('start-mode-pick')).toBeVisible();

  const twoCard = page.getByTestId('start-mode-2d');
  if (isMobile) await twoCard.tap();
  else await twoCard.click();

  await expect(page.locator('body[data-view-mode="2d"]')).toBeVisible({ timeout: 10_000 });
  await expect(page).not.toHaveURL(/index-3d\.html/);
  await expect(page.locator('canvas#c')).toBeVisible();
  await expect(page.getByTestId('start-mode-pick')).toBeVisible();
  await expect(page.getByTestId('start-mode-2d')).toHaveAttribute('aria-pressed', 'true');
  const stored = await page.evaluate(() => localStorage.getItem('wallflip.viewMode'));
  expect(stored).toBe('2d');
});

test('wall-flip: focused start-mode card Space does not start the game', async ({ page }) => {
  test.skip(!includesGame('Wall-Flip'), 'selective CI');
  await openWallFlip2d(page);
  await page.getByTestId('start-mode-3d').click();
  await expect(page.locator('#start')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('start-mode-pick')).toBeVisible();

  // Focus the already-active 3D card: Space should activate the button (no-op) and
  // must NOT be handled as the game "start" shortcut that hides #start.
  await page.getByTestId('start-mode-3d').focus();
  await page.keyboard.press('Space');
  await page.waitForTimeout(200);
  await expect(page.locator('#start')).toBeVisible();
  await expect(page.locator('body[data-view-mode="3d"]')).toBeVisible();

  // Arrow keys move focus between the two start-panel cards.
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByTestId('start-mode-2d')).toBeFocused();
  await page.keyboard.press('Space');
  await page.waitForTimeout(200);
  // Space on the inactive card navigates to 2D — still not a game start.
  await expect(page.locator('body[data-view-mode="2d"]')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('start-mode-pick')).toBeVisible();

  // API URL input owns the keyboard while focused (HUD gear is hidden on start).
  await page.evaluate(() => {
    document.getElementById('apiPanel')?.classList.add('on');
  });
  const apiInput = page.locator('#apiInput');
  await expect(apiInput).toBeVisible();
  await apiInput.focus();
  await page.keyboard.type(' ');
  await page.keyboard.press('Space');
  await page.waitForTimeout(150);
  await expect(page.getByTestId('start-mode-pick')).toBeVisible();
  await expect(page.locator('#apiPanel')).toHaveClass(/on/);
  await expect(apiInput).toHaveValue(/ /);
});
