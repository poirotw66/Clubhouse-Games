import { test, expect } from '@playwright/test';

// Selective game PRs reuse the shell; full/shared runs verify its font payload.
const quickTags = process.env.SCOPE_FULL === 'false' ? [] : ['@smoke', '@mobile-smoke'];

test('hub fonts stay offline, retain all weights and fit the transfer budget', { tag: quickTags }, async ({ page, request }) => {
  const fonts = [];
  const failures = [];
  page.on('response', (response) => {
    if (new URL(response.url()).pathname.endsWith('.woff2')) fonts.push(response);
    if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`);
  });
  page.on('pageerror', (error) => failures.push(error.message));
  // The menu and all fonts must remain usable without third-party services.
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    return url.hostname === '127.0.0.1' ? route.continue() : route.abort();
  });
  await page.goto('./');
  const loaded = await page.evaluate(async () => {
    const faces = await Promise.all([400, 500, 600].map((weight) =>
      document.fonts.load(`${weight} 16px "Noto Sans TC"`, '遊戲總覽'),
    ));
    await document.fonts.ready;
    return faces.map((list) => list.length > 0 && list.every((face) => face.status === 'loaded'));
  });
  expect(loaded).toEqual([true, true, true]);
  await expect(page.locator('.game-tile').first()).toBeVisible();
  await page.locator('#game-search').fill('記憶配對');
  await expect(page.locator('.game-tile:visible')).toHaveCount(1);
  // Arbitrary input may use a system fallback, and must not fetch full fonts.
  await page.locator('#game-search').fill('𠮷龘');
  await expect(page.locator('#empty-state')).toBeVisible();
  await page.locator('#search-clear').click();
  await page.locator('[data-filter="board"]').click();
  await expect(page.locator('.game-tile:visible')).toHaveCount(3);
  const sizes = await Promise.all(fonts.map(async (response) => (await response.body()).length));
  expect(sizes.reduce((sum, size) => sum + size, 0)).toBeLessThan(420 * 1024);
  for (const weight of [400, 500, 600]) {
    expect(fonts.some((response) => response.url().endsWith(`noto-sans-tc-hub-${weight}.woff2`))).toBe(true);
    const original = await request.get(`./assets/fonts/files/noto-sans-tc-chinese-traditional-${weight}-normal.woff2`);
    expect(original.status(), 'full CJK sources are excluded from Pages').toBe(404);
  }
  expect(failures).toEqual([]);
});
