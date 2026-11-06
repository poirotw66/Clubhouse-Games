/** Browser regression check. Start the root dev server first.
 * ASTRA_CHECK_BASE=http://127.0.0.1:3000 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium node gpt6-astra/shared/check-usability.mjs
 */
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
const base = process.env.ASTRA_CHECK_BASE || 'http://127.0.0.1:3000';
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(60_000);
  page.setDefaultNavigationTimeout(60_000);
  await page.goto(`${base}/gpt6-astra/index.html`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const { createResultOverlay } = await import('./shared/result-overlay.mjs');
    const trigger = document.createElement('button');
    trigger.id = 'focus-return';
    document.body.append(trigger);
    trigger.focus();
    window.testOverlay = createResultOverlay();
    window.gameShortcuts = 0;
    document.addEventListener('keydown', () => window.gameShortcuts++);
    window.testOverlay.show({ title: 'Result', onPrimary() {}, onSecondary() {} });
  });
  assert.equal(await page.locator('[data-part="primary"]').evaluate(el => el === document.activeElement), true);
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.locator('[data-part="secondary"]').evaluate(el => el === document.activeElement), true);
  await page.keyboard.press('Tab');
  assert.equal(await page.locator('[data-part="primary"]').evaluate(el => el === document.activeElement), true);
  await page.keyboard.press('Space');
  assert.equal(await page.evaluate(() => window.gameShortcuts), 0);
  await page.evaluate(() => window.testOverlay.hide());
  assert.equal(await page.locator('#focus-return').evaluate(el => el === document.activeElement), true);
  // A single action must wrap in both directions as well.
  await page.evaluate(() => window.testOverlay.show({ title: 'One action', onPrimary() {} }));
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.locator('[data-part="primary"]').evaluate(el => el === document.activeElement), true);
  await page.evaluate(() => window.testOverlay.destroy());
  assert.equal(await page.locator('#focus-return').evaluate(el => el === document.activeElement), true);

  await page.goto(`${base}/gpt6-astra/train/`, { waitUntil: 'domcontentloaded' });
  await page.locator('#solo').waitFor();
  await page.locator('#solo').focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('#overlay').classList.contains('hidden'));
  await page.keyboard.press('Escape');
  await page.locator('#resume').waitFor();
  await page.locator('#resume').focus();
  await page.keyboard.press('Space');
  await page.waitForFunction(() => document.querySelector('#overlay').classList.contains('hidden'));

  await page.goto(`${base}/gpt6-astra/loop-hero/`, { waitUntil: 'domcontentloaded' });
  await page.locator('#howtoClose').waitFor();
  await page.locator('#howtoClose').focus();
  await page.keyboard.press('Space');
  assert.equal(await page.locator('#howtoModal').evaluate(el => el.classList.contains('show')), false);
  await page.getByTestId('daily-start').focus();
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__cinderDebug.getGame()?.phase === 'run');

  await page.goto(`${base}/gpt6-astra/borderland/?test=1&touch=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__dustRiotTest);
  await page.evaluate(() => window.__dustRiotTest.beginRun());
  await page.locator('#btnFire').dispatchEvent('pointerdown', { pointerId: 7 });
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  assert.equal(await page.evaluate(() => window.__dustRiotTest.getUi()), 'paused');
  assert.equal(await page.locator('#touchBtns .held').count(), 0);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  assert.equal(await page.evaluate(() => window.__dustRiotTest.getUi()), 'paused');
  await page.goto(`${base}/gpt6-astra/webmcp-rubiks-cube/`, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-tab="timer"]').click();
  await page.locator('#btn-new-scramble').click();
  await page.waitForFunction(() => document.querySelector('#timer-phase').textContent.includes('已打亂'));
  await page.locator('#btn-timer-inspect').focus();
  await page.keyboard.press('Space');
  assert.match(await page.locator('#timer-phase').textContent(), /觀察中/);
  await page.evaluate(() => {
    document.activeElement.blur();
    document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', repeat: true, bubbles: true }));
  });
  assert.match(await page.locator('#timer-phase').textContent(), /觀察中/);
  await page.keyboard.press('Space');
  assert.match(await page.locator('#timer-phase').textContent(), /計時中/);
  console.log('Astra usability OK: result focus/Tab/shortcuts, Train and Loop Hero keyboard menus, Borderland hidden-tab pause, Rubiks timer repeat guard');
} finally {
  await browser.close();
}
