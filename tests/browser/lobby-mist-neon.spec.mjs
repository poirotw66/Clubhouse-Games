import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page, baseURL }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && message.location().url.startsWith(new URL(baseURL).origin)) {
      errors.push(message.text());
    }
  });
  page.__runtimeErrors = errors;
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) =>
    route.fulfill({ body: '', contentType: 'text/css' }),
  );
});

test.afterEach(async ({ page }) => {
  expect(page.__runtimeErrors, 'browser runtime / asset errors').toEqual([]);
});

test('lobby mist-neon stage mounts and respects juice fx off', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('#dream-bg')).toBeVisible();
  await expect(page.locator('[data-lobby-sweep]')).toHaveCount(1);
  await expect(page.locator('[data-lobby-mesh]')).toHaveCount(1);
  await expect(page.locator('[data-hero-stage]')).toBeVisible();
  await expect(page.locator('.neon-tube')).toBeVisible();
  await expect(page.locator('.hero-prop')).toHaveCount(4);
  await expect(page.locator('#lobby-fx')).toHaveCount(1);
  await expect(page.locator('.dream-orb')).toHaveCount(3);
  await expect(page.locator('html')).toHaveAttribute('data-juice-fx', /^(full|low|off)$/);

  await page.addInitScript(() => {
    localStorage.setItem('clubhouse:juice', JSON.stringify({ haptics: true, fx: 'off' }));
  });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-juice-fx', 'off');
  // Canvas stays in DOM but CSS hides it when fx is off.
  await expect(page.locator('#lobby-fx')).toBeHidden();
  await expect(page.locator('.neon-tube')).toBeVisible();
});

test('lobby mist-neon respects prefers-reduced-motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('data-juice-fx', 'off');
  await expect(page.locator('#lobby-fx')).toBeHidden();
  // Core menu chrome must remain usable.
  await expect(page.locator('#game-search')).toBeVisible();
  await expect(page.locator('.game-tile').first()).toBeVisible();
});

test('lobby search still works under mist-neon chrome', async ({ page }) => {
  await page.goto('./');
  await page.locator('#game-search').fill('記憶配對');
  await expect(page.locator('.game-tile:visible')).toHaveCount(1);
  await page.locator('#search-clear').click();
  await expect(page.locator('#game-search')).toHaveValue('');
});
