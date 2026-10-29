import { test, expect } from '@playwright/test';
import { includesAstra } from './astra-filter.mjs';

test.describe('Astra WebMCP Mini Factory', () => {
  test.skip(!includesAstra('webmcp-mini-factory'), 'selective CI');
  test('campaign boots with levels, research, and daily controls', async ({ page }) => {
    await page.goto('gpt6-astra/webmcp-mini-factory/');
    await expect(page.getByRole('heading', { name: 'WebMCP Mini Factory' })).toBeVisible();
    await expect(page.locator('#board')).toBeVisible();
    await expect(page.locator('#levelSelect')).toBeVisible();
    await expect(page.locator('#levelSelect option')).toHaveCount(10);
    await expect(page.locator('#researchList li')).toHaveCount(8);
    await expect(page.getByRole('button', { name: /Daily Blueprint|Leave Daily/ })).toBeVisible();
    await expect(page.locator('#shareText')).toBeVisible();
    await expect(page.locator('#toolbar .tool-button').first()).toBeVisible();
    await expect(page.locator('#machines .machine').first()).toBeVisible();
  });

  test('daily blueprint mode toggles kit, share text, and exit', async ({ page }) => {
    await page.goto('gpt6-astra/webmcp-mini-factory/');
    await expect(page.locator('#dailyButton')).toBeVisible();

    await page.locator('#dailyButton').click();
    await expect(page.locator('#dailyButton')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#floorLabel')).toContainText(/Daily/i);
    await expect(page.locator('#levelSelect')).toBeDisabled();
    await expect(page.locator('#dailyDate')).toHaveText(/\d{4}-\d{2}-\d{2}/);
    await expect(page.locator('#shareText')).not.toHaveValue('');
    await expect(page.locator('#shareText')).toHaveValue(/每日藍圖/);
    await expect(page.locator('#missionTitle')).toContainText(/DAILY|BLUEPRINT|CLEARED/i);

    await page.locator('#shareCopy').click();
    await expect(page.locator('#toast')).toBeVisible();

    await page.locator('#dailyButton').click();
    await expect(page.locator('#dailyButton')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#levelSelect')).toBeEnabled();
    await expect(page.locator('#floorLabel')).toContainText('/ L');
  });

  test('touch toolbar can select inspect and open a machine inspector', async ({ page }) => {
    await page.goto('gpt6-astra/webmcp-mini-factory/');
    const inspect = page.locator('.tool-button[data-tool="inspect"]');
    await expect(inspect).toBeVisible();
    await inspect.tap().catch(async () => {
      await inspect.click();
    });
    await expect(inspect).toHaveAttribute('aria-pressed', 'true');

    const machine = page.locator('#machines .machine').first();
    await expect(machine).toBeVisible();
    await machine.tap().catch(async () => {
      await machine.click();
    });
    await expect(page.locator('#inspector')).toContainText(/Position|level|Recipe|Delete/i);
  });
});
