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

test.describe('Cyber-Neon-Rush taste polish', () => {
  test.skip(!includesGame('Cyber-Neon-Rush'), 'selective CI');

  test('start poster, difficulty chips, and in-run HUD stay reachable', async ({ page }) => {
    await page.goto('./Games/Cyber-Neon-Rush/');
    await expect(page.locator('[data-ui="cyber-neon-start"]')).toBeVisible();
    await expect(page.getByRole('heading', { name: '霓虹疾馳' })).toBeVisible();
    await expect(page.getByRole('button', { name: '開始疾馳' })).toBeVisible();

    const hard = page.getByRole('button', { name: '狂飆' });
    await hard.click();
    await expect(hard).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('button', { name: '開始疾馳' }).click();
    await expect(page.getByLabel('動態計分板')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('canvas')).toBeVisible();

    // Dismiss first-run tip if present so the track stays readable.
    const tip = page.getByRole('button', { name: '知道了' });
    if (await tip.isVisible().catch(() => false)) {
      await tip.click();
    }

    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: '暫停' })).toBeVisible();
    await page.getByRole('button', { name: '繼續疾馳' }).click();
    await expect(page.getByLabel('動態計分板')).toBeVisible();
  });

  test('garage and howto panels open from the start poster', async ({ page }) => {
    await page.goto('./Games/Cyber-Neon-Rush/');
    await page.getByRole('button', { name: '操作教學' }).click();
    await expect(page.getByRole('dialog', { name: '操作教學' })).toBeVisible();
    await page.getByRole('button', { name: '知道了' }).click();
    await expect(page.getByRole('dialog', { name: '操作教學' })).toHaveCount(0);

    await page.getByRole('button', { name: /車庫與任務/ }).click();
    await expect(page.getByRole('dialog', { name: '車庫與任務' })).toBeVisible();
    await page.getByRole('button', { name: '返回選單' }).click();
    await expect(page.getByRole('dialog', { name: '車庫與任務' })).toHaveCount(0);
  });
});
