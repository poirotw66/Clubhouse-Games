import { test, expect } from '@playwright/test';

test.describe('Astra Rubik\'s Cube Academy', () => {
  test('lesson path + practice smoke', async ({ page }) => {
    await page.goto('gpt6-astra/webmcp-rubiks-cube/');
    await expect(page.getByRole('heading', { name: '魔術方塊學院' })).toBeVisible();
    await expect(page.locator('#lesson-list .lesson-item').first()).toBeVisible();

    // Concept lesson: mark complete
    await page.getByRole('button', { name: /認識三類方塊/ }).click();
    await expect(page.locator('#lesson-title')).toHaveText('認識三類方塊');
    await page.getByRole('button', { name: '我懂了，標記完成' }).click();
    await expect(page.locator('#progress-summary')).toContainText('1/');

    // Notation lesson: playback controls visible
    await page.getByRole('button', { name: /轉面記號/ }).click();
    await expect(page.locator('#practice-controls')).toBeVisible();
    await expect(page.locator('#lesson-alg')).toContainText("R U R' U'");
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page.locator('#move-count')).not.toHaveText('0');

    // Cheat sheet mode
    await page.getByRole('tab', { name: '公式表' }).click();
    await expect(page.locator('#sheet-list .sheet-card').first()).toBeVisible();
    await expect(page.locator('#sheet-list')).toContainText('Sune');

    // Timer / practice mode
    await page.getByRole('tab', { name: '計時練習' }).click();
    await page.getByRole('button', { name: '新打亂' }).click();
    await expect(page.locator('#timer-scramble')).not.toHaveText('—');
    await page.getByRole('button', { name: '產生逐步還原計畫' }).click();
    await expect(page.locator('#solve-steps li').first()).toBeVisible({ timeout: 15_000 });

    // Free-play mode still present
    await page.getByRole('tab', { name: '自由練習' }).click();
    await expect(page.getByRole('heading', { name: /自由練習/ })).toBeVisible();
    await expect(page.locator('#move-grid-free button').first()).toBeVisible();
  });

  test('freeplay page still boots', async ({ page }) => {
    await page.goto('gpt6-astra/webmcp-rubiks-cube/freeplay.html');
    await expect(page.locator('#pieces .cubie')).toHaveCount(26, { timeout: 10_000 });
    await expect(page.locator('#move-grid button').first()).toBeVisible();
  });
});
