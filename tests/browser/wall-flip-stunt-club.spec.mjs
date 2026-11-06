import { test, expect } from '@playwright/test';

const filter = (process.env.CI_GAME_FILTER || '').trim();
const included = !filter || filter === '*' || filter.toLowerCase() === 'full' || filter.split(/[\s,]+/).includes('Wall-Flip');
test.beforeEach(() => test.skip(!included, 'selective CI'));
const profile = page => page.evaluate(() => JSON.parse(localStorage.getItem('wallflip.stuntClub.v1')));

test('wall-flip club: challenge choice survives 2D/3D switching and locked paint stays locked', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('wallflip.viewMode', '2d'));
  await page.goto('./Games/Wall-Flip/');
  await expect(page.locator('[data-paint="amber"]')).toBeDisabled();
  await expect(page.locator('[data-paint="violet"]')).toBeDisabled();
  await page.locator('[data-contract="reserve"]').click();
  await expect(page.locator('[data-contract="reserve"]')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('start-mode-3d').click();
  await expect(page.locator('#startBtn')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('[data-contract="reserve"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.wf-launch-lang').click();
  await expect(page.locator('[data-contract="reserve"]')).toContainText('Air saver');
  await page.locator('#startBtn').click();
  await expect(page.locator('.wf-club-live')).toContainText('Air saver');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test('wall-flip club: a real landing banks medals once, unlocks paint and a crash keeps the collection', async ({ page }, testInfo) => {
  test.setTimeout(45000);
  await page.goto('./Games/Wall-Flip/index-3d.html');
  await expect(page.locator('#startBtn')).toBeVisible({ timeout: 15000 });
  await page.locator('[data-contract="precision"]').click();
  await page.locator('#startBtn').click();
  // Pilot the actual fixed-step physics using jets; never assign an outcome or score.
  const landing = await page.evaluate(() => {
    const sim = window.__sim;
    const step = 1 / 240;
    let target = null;
    for (let i = 0; i < 10000; i++) {
      const st = sim.state;
      if (st.mode === 'landed' || st.mode === 'crash') break;
      const input = { drive: st.mode === 'road', suck: st.mode === 'road' && st.u > 0, left: false, right: false };
      if (st.mode === 'air') {
        target ??= Math.ceil((st.roll - 1e-6) / (2 * Math.PI)) * 2 * Math.PI;
        const error = st.roll + st.rw / 7 - target;
        if (Math.abs(error) > 0.015) {
          input.left = error < 0 && st.air > 2; input.right = error > 0 && st.air > 2;
        } else if (st.vy < -Math.max(0.3, Math.min(8, (st.y - 0.7) * 1.1)) && st.air > 1) {
          input.left = input.right = true;
        }
      }
      sim.step(step, input);
    }
    return { mode: sim.state.mode, land: sim.state.land };
  });
  expect(landing.mode).toBe('landed');
  await page.locator('#nameSkipBtn').click({ timeout: 10000 });
  await expect(page.getByTestId('flight-review')).toBeVisible();
  await expect(page.locator('.wf-club-outcome')).toContainText('★★★', { timeout: 10000 });
  const earned = await profile(page);
  expect(earned.medals.precision).toBe(3);
  expect(earned.streak).toBe(1);
  await page.locator('.wf-club-next summary').click();
  const totalBox = await page.locator('#resTotal').boundingBox();
  const reviewBox = await page.getByTestId('flight-review').boundingBox();
  expect(reviewBox.y).toBeGreaterThanOrEqual(totalBox.y + totalBox.height);
  await page.screenshot({ path: testInfo.outputPath('club-gold.png') });
  await expect(page.locator('.wf-club-review [data-paint="amber"]')).toBeEnabled();
  await page.locator('.wf-club-review [data-paint="amber"]').click();
  expect((await profile(page)).paint).toBe('amber');
  expect((await profile(page)).streak).toBe(1);

  await page.goto('./Games/Wall-Flip/index-3d.html');
  await page.getByTestId('start-mode-2d').click();
  await expect(page.locator('[data-paint="amber"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#launchStart').click();
  await page.keyboard.down('Space');
  await page.evaluate(() => window.__wfStep(2));
  await page.keyboard.up('Space');
  await page.evaluate(() => window.__wfStep(12));
  await expect(page.locator('.wf-club-outcome')).toContainText('挑戰未完成');
  const failed = await profile(page);
  expect(failed.medals.precision).toBe(3);
  expect(failed.streak).toBe(0);
  expect(failed.bestStreak).toBe(1);
  await page.locator('.wf-club-next summary').click();
  await page.locator('.wf-club-review [data-contract="reserve"]').click();
  await expect(page.getByTestId('flight-review')).toBeVisible();
  await page.locator('[data-coach-retry]').click();
  await expect(page.locator('.wf-club-live')).toContainText('省氣高手');
});

test('wall-flip club: demo flight never awards medals or changes a saved streak', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('wallflip.viewMode', '2d');
    localStorage.setItem('wallflip.stuntClub.v1', JSON.stringify({ medals: { flips: 1 }, selected: 'flips', streak: 4, bestStreak: 5 }));
  });
  await page.goto('./Games/Wall-Flip/?demo=1');
  const before = await profile(page);
  await page.evaluate(() => window.__wfStep(15));
  await expect(page.locator('.wf-club-outcome')).toContainText('示範練習');
  expect(await profile(page)).toEqual(before);
});
