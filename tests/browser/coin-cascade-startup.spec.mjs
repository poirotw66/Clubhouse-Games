import { test, expect } from '@playwright/test';

const filter = (process.env.CI_GAME_FILTER || '').trim();
const included = !filter || filter === '*' || filter.toLowerCase() === 'full'
  || filter.split(/[\s,]+/).includes('Coin-Cascade');

if (included) {
  for (const entry of ['free', 'daily', 'mode']) {
    test(`coin-cascade ${entry}: start a live machine and accept a coin @smoke @mobile-smoke`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto('./Games/Coin-Cascade/');
      await expect(page.getByRole('heading', { name: '幣潮', exact: true })).toBeVisible();
      if (entry === 'free') {
        await page.getByRole('button', { name: '投幣開始', exact: true }).click();
      } else if (entry === 'daily') {
        await page.getByRole('button', { name: /^每日挑戰/ }).click();
        await page.getByRole('dialog').getByRole('button', { name: '開始每日挑戰', exact: true }).click();
      } else {
        await page.getByRole('button', { name: /^挑戰／模式包/ }).click();
        await page.getByRole('dialog').getByRole('button', { name: '開始第一關', exact: true }).click();
      }
      const canvas = page.locator('canvas[aria-label="幣潮台面"]');
      await expect(canvas).toBeVisible();
      await expect(page.locator('.cc-play')).toBeVisible();
      const credits = page.locator('.cc-hud .cc-hud-chip').filter({ hasText: /^投幣\s*\d+$/ }).locator('b');
      const initial = Number(await credits.textContent());
      expect(initial).toBeGreaterThan(0);
      await canvas.click();
      await expect(credits).toHaveText(String(initial - 1));
      await expect(page.locator('.cc-cooldown-dot')).toHaveClass(/is-ready/);
      await page.keyboard.press('Space');
      await expect(credits).toHaveText(String(initial - 2));
      await page.keyboard.press('p');
      await expect(page.locator('.cc-pause-card')).toBeVisible();
      const marker = page.locator('.cc-cycle-marker');
      const pausedPosition = await marker.getAttribute('style');
      await page.waitForTimeout(300);
      await expect(marker).toHaveAttribute('style', pausedPosition);
      await page.keyboard.press('p');
      await expect(page.locator('.cc-pause-card')).toBeHidden();
      // Return through the real hub link, then re-enter the title and start again.
      await page.getByRole('link', { name: '返回總覽' }).click();
      await page.goto('./Games/Coin-Cascade/');
      await expect(page.getByRole('button', { name: '投幣開始', exact: true })).toBeVisible();
      await page.getByRole('button', { name: '投幣開始', exact: true }).click();
      await expect(canvas).toBeVisible();
      expect(errors).toEqual([]);
    });
  }
}
