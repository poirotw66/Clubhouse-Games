import { test, expect } from '@playwright/test';

const filter = (process.env.CI_GAME_FILTER || '').trim();
const includes = (folder) => !filter || filter === '*' || filter.toLowerCase() === 'full'
  || filter.split(/[\s,]+/).includes(folder);

async function expectNoHorizontalOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
}

if (includes('Wall-Flip')) {
  test('wall-flip entry: guide and language controls preserve the launch screen', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('wallflip.viewMode', '2d'));
    await page.goto('./Games/Wall-Flip/');
    const launch = page.locator('#wfLaunch');
    await expect(launch).toBeVisible();
    await expectNoHorizontalOverflow(page);
    const guide = page.locator('.wf-launch-guide').filter({ has: page.locator('[data-copy="guide"]') });
    await guide.locator('summary').focus();
    await page.keyboard.press('Space');
    await expect(guide).toHaveAttribute('open', '');
    await expect(launch).toBeVisible();
    await page.locator('.wf-launch-lang').click();
    await expect(page.locator('#launchStart')).toHaveText('Launch this run →');
    await page.locator('#launchStart').click();
    await expect(launch).toBeHidden();
    await expect(page.locator('canvas#c')).toBeVisible();
  });
}

if (includes('Clip-Clop')) {
  test('clip-clop entry: keyboard gait rehearsal requires the two diagonal pairs', async ({ page }) => {
    test.setTimeout(45_000);
    await page.goto('./Games/Clip-Clop/');
    await expect.poll(() => page.evaluate(() => !!window.__ready), { timeout: 30_000 }).toBe(true);
    for (const key of ['q', 'w', 'o']) await page.keyboard.down(key);
    await expect(page.locator('#gaitProgress')).toHaveText('0 / 2');
    for (const key of ['q', 'w', 'o']) await page.keyboard.up(key);
    for (const key of ['q', 'p']) await page.keyboard.down(key);
    await expect(page.locator('#gaitProgress')).toHaveText('1 / 2');
    for (const key of ['q', 'p']) await page.keyboard.up(key);
    for (const key of ['w', 'o']) await page.keyboard.down(key);
    await expect(page.locator('#gaitProgress')).toHaveText('2 / 2');
    for (const key of ['w', 'o']) await page.keyboard.up(key);
  });

  test('clip-clop entry: learn both diagonal beats and start a real race', async ({ page }) => {
    test.setTimeout(45_000);
    await page.goto('./Games/Clip-Clop/');
    await expect.poll(() => page.evaluate(() => !!window.__ready), { timeout: 30_000 }).toBe(true);
    await expectNoHorizontalOverflow(page);
    await page.locator('#gaitBeatA').click();
    await expect(page.locator('#gaitProgress')).toHaveText('1 / 2');
    await page.locator('#gaitBeatB').click();
    await expect(page.locator('#gaitProgress')).toHaveText('2 / 2');
    await expect(page.locator('#gaitStage')).toHaveAttribute('data-progress', '2');
    // Training is optional and must not change the actual race state.
    expect(await page.evaluate(() => window.__game?.state)).not.toBe('run');
    await page.locator('#startBtn').click();
    await expect.poll(() => page.evaluate(() => window.__game?.state)).toBe('run');
  });
}

if (includes('Baseball-Life')) {
  test('baseball-life entry: optional guide, keyboard chapters and shared seed lead to player creation', async ({ page }) => {
    await page.goto('./Games/Baseball-Life/?seed=64aa2bl7');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    const firstChapter = page.getByRole('tab', { name: /高中篇/ });
    await firstChapter.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: /選秀篇/ })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#bl-chapter-panel')).toContainText('電話響起');
    await page.getByRole('button', { name: /第一次當球員/ }).click();
    await expect(page.getByRole('dialog', { name: '三步上手' })).toBeVisible();
    await page.getByRole('button', { name: '知道了' }).click();
    await page.locator('.bl-seed-settings summary').click();
    await expect(page.locator('#seed-input')).toHaveValue('64aa2bl7');
    await page.getByRole('button', { name: '開始新的棒球人生', exact: true }).click();
    await expect(page.getByRole('heading', { name: '建立球員', exact: true })).toBeVisible();
    await expect(page.getByText('64aa2bl7', { exact: true })).toBeVisible();
    await expect(page.locator('#name-input')).toBeVisible();
  });
}
