import { test, expect } from '@playwright/test';

function activate(locator, isMobile) {
  return isMobile ? locator.tap() : locator.click();
}

async function stubVibrate(page, { haptics = true } = {}) {
  await page.addInitScript((opts) => {
    window.__vibrateCalls = [];
    localStorage.setItem(
      'clubhouse:juice',
      JSON.stringify({ haptics: opts.haptics, fx: 'full' }),
    );
    // Skip Danmaku first-run overlay so play starts cleanly.
    localStorage.setItem('danmaku-abyss:howto-seen', '1');
    navigator.vibrate = (pattern) => {
      window.__vibrateCalls.push(pattern);
      return true;
    };
  }, { haptics });
}

test('danmaku-abyss: juice settings on title; bomb vibrates', async ({ page, isMobile }) => {
  test.setTimeout(60_000);
  await stubVibrate(page, { haptics: true });
  await page.goto('./Games/Danmaku-Abyss/');
  await expect(page.getByRole('heading', { name: /彈幕深淵/ })).toBeVisible();
  const settings = page.locator('[data-juice-settings="1"]');
  await expect(settings).toBeVisible();

  await activate(page.getByRole('button', { name: '潛入深淵', exact: true }), isMobile);
  await expect(page.getByRole('button', { name: '靈擊' })).toBeVisible({ timeout: 10_000 });
  await activate(page.getByRole('button', { name: '靈擊' }), isMobile);

  await expect
    .poll(async () => page.evaluate(() => window.__vibrateCalls.length))
    .toBeGreaterThan(0);
});

test('danmaku-abyss: haptics off skips bomb vibrate', async ({ page, isMobile }) => {
  test.setTimeout(60_000);
  await stubVibrate(page, { haptics: false });
  await page.goto('./Games/Danmaku-Abyss/');
  await activate(page.getByRole('button', { name: '潛入深淵', exact: true }), isMobile);
  await expect(page.getByRole('button', { name: '靈擊' })).toBeVisible({ timeout: 10_000 });
  await activate(page.getByRole('button', { name: '靈擊' }), isMobile);
  await page.waitForTimeout(400);
  const vibrateCount = await page.evaluate(() => window.__vibrateCalls.length);
  expect(vibrateCount).toBe(0);
});

test('instant-flash: miss vibrates on practice standstill', async ({ page, isMobile }) => {
  test.setTimeout(60_000);
  await stubVibrate(page, { haptics: true });
  await page.goto('./Games/Instant-Flash/');
  await expect(page.locator('[data-juice-settings="1"]')).toBeVisible();

  await activate(page.getByRole('button', { name: '練習設定', exact: true }), isMobile);
  await activate(page.getByRole('button', { name: '開始練習', exact: true }), isMobile);

  // Standing still through an attack yields LATE/MISS → impact haptic.
  await expect
    .poll(async () => page.evaluate(() => window.__vibrateCalls.length), {
      timeout: 20_000,
    })
    .toBeGreaterThan(0);
});

test('instant-flash: haptics off skips miss vibrate', async ({ page, isMobile }) => {
  test.setTimeout(60_000);
  await stubVibrate(page, { haptics: false });
  await page.goto('./Games/Instant-Flash/');
  await expect(page.locator('#juice-haptics')).not.toBeChecked();
  await activate(page.getByRole('button', { name: '練習設定', exact: true }), isMobile);
  await activate(page.getByRole('button', { name: '開始練習', exact: true }), isMobile);
  await page.waitForTimeout(8_000);
  const quiet = await page.evaluate(() => window.__vibrateCalls.length);
  expect(quiet).toBe(0);
});

test('switchpoint-run: juice settings persist under clubhouse:juice', async ({ page }) => {
  await page.goto('./Games/Switchpoint-Run/');
  await expect(page.getByRole('heading', { name: /岔道疾走/ })).toBeVisible();
  const settings = page.locator('[data-juice-settings="1"]');
  await expect(settings).toBeVisible();
  await page.locator('#juice-haptics').uncheck();
  await page.locator('#juice-fx').selectOption('low');
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('clubhouse:juice') || '{}'),
  );
  expect(stored.haptics).toBe(false);
  expect(stored.fx).toBe('low');
});
