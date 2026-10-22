import { test, expect } from '@playwright/test';

function activate(locator, isMobile) {
  return isMobile ? locator.tap() : locator.click();
}

test('puyo-puyo: juice settings persist under clubhouse:juice', async ({ page }) => {
  await page.goto('./Games/Puyo-Puyo/');
  await expect(page.getByRole('heading', { name: /魔法氣泡/ })).toBeVisible();
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

test('puyo-puyo: move taps vibrate; mission win shakes field', async ({ page, isMobile }) => {
  test.setTimeout(60_000);
  await page.addInitScript(() => {
    window.__vibrateCalls = [];
    navigator.vibrate = (pattern) => {
      window.__vibrateCalls.push(pattern);
      return true;
    };
  });
  await page.goto('./Games/Puyo-Puyo/');
  await page.locator('#match-mode').selectOption('mission');
  await expect(page.locator('#quest-panel')).toBeVisible();

  // Sideways move → tap haptic, then restore spawn column for the mission drop.
  await page.keyboard.press('ArrowLeft');
  await expect
    .poll(async () => page.evaluate(() => window.__vibrateCalls.length))
    .toBeGreaterThan(0);
  await page.keyboard.press('ArrowRight');

  // First mission: hint + hard drop clears a 2-chain win.
  await activate(page.getByRole('button', { name: '顯示落點提示', exact: true }), isMobile);
  await page.keyboard.press(' ');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#result-title')).toContainText(/成功/);

  const shook = page.locator('.field-frame[data-juice-shake="1"], #p1-field[data-juice-shake="1"]');
  await expect(shook.first()).toBeVisible({ timeout: 2_000 });
  const vibrateCount = await page.evaluate(() => window.__vibrateCalls.length);
  expect(vibrateCount).toBeGreaterThan(1);
});

test('puyo-puyo: juice respects reduced-motion and haptics off', async ({ page, isMobile }) => {
  test.setTimeout(60_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    localStorage.setItem('clubhouse:juice', JSON.stringify({ haptics: false, fx: 'full' }));
    window.__vibrateCalls = [];
    navigator.vibrate = (pattern) => {
      window.__vibrateCalls.push(pattern);
      return true;
    };
  });
  await page.goto('./Games/Puyo-Puyo/');
  await page.locator('#match-mode').selectOption('mission');
  await activate(page.getByRole('button', { name: '顯示落點提示', exact: true }), isMobile);
  await page.keyboard.press(' ');
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[data-juice-shake="1"]')).toHaveCount(0);
  const vibrateCount = await page.evaluate(() => window.__vibrateCalls.length);
  expect(vibrateCount).toBe(0);
});
