import { test, expect } from '@playwright/test';

function activate(locator, isMobile) {
  return isMobile ? locator.tap() : locator.click();
}

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

test('result overlay mist-neon chrome + juice particles on connect-four end', async ({ page, isMobile }) => {
  test.skip(process.env.CI_GAME_FILTER === '__none__', 'selective CI skipped games');
  await page.addInitScript(() => {
    localStorage.setItem('clubhouse:juice', JSON.stringify({ haptics: true, fx: 'full' }));
  });
  await page.goto('./Games/Connect-Four/');
  await activate(page.getByRole('button', { name: '雙人對戰' }), isMobile);
  await activate(page.getByRole('button', { name: '經典', exact: true }), isMobile);
  await activate(page.getByRole('button', { name: '7×6', exact: true }), isMobile);
  for (const column of [1, 2, 1, 2, 1, 2, 1]) {
    await activate(page.getByRole('button', { name: `投入第 ${column} 欄`, exact: true }), isMobile);
  }

  const result = page.getByRole('dialog');
  await expect(result).toBeVisible();
  await expect(result).toHaveAttribute('data-result-overlay', '1');
  // Two-player ends use the neutral variant; celebrateResultOverlay still sparks via juice.
  await expect(result).toHaveAttribute('data-variant', /^(win|lose|neutral)$/);
  await expect(result).toHaveAttribute('data-emphasis', /^(standard|record)$/);
  await expect(result.locator('.result-overlay__billboard, .clubhouse-result-overlay__billboard')).toBeVisible();
  await expect(result.locator('.result-overlay__sheen, .clubhouse-result-overlay__sheen').first()).toBeVisible();
  await expect(result.locator('.result-overlay__card, .clubhouse-result-overlay__card').first()).toBeVisible();
  await expect(result.locator('.result-overlay__star, .clubhouse-result-overlay__star')).toHaveCount(5);
  await expect(page.locator('[data-clubhouse-juice="particles"]')).toHaveCount(1);
  await activate(result.getByRole('button', { name: '再玩一局' }), isMobile);
  await expect(result).toHaveCount(0);
});

test('result overlay skips confetti when juice fx is off', async ({ page, isMobile }) => {
  test.skip(process.env.CI_GAME_FILTER === '__none__', 'selective CI skipped games');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    localStorage.setItem('clubhouse:juice', JSON.stringify({ haptics: false, fx: 'off' }));
  });
  await page.goto('./Games/Connect-Four/');
  await activate(page.getByRole('button', { name: '雙人對戰' }), isMobile);
  for (const column of [1, 2, 1, 2, 1, 2, 1]) {
    await activate(page.getByRole('button', { name: `投入第 ${column} 欄`, exact: true }), isMobile);
  }
  const result = page.getByRole('dialog');
  await expect(result).toBeVisible();
  await expect(result).toHaveAttribute('data-result-overlay', '1');
  await expect(page.locator('[data-clubhouse-juice="particles"]')).toHaveCount(0);
});
