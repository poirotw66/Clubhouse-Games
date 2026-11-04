import { test, expect } from '@playwright/test';

function resolveGameFilter() {
  const raw = (process.env.CI_GAME_FILTER || '').trim();
  if (!raw || raw === '*' || raw.toLowerCase() === 'full') return null;
  if (raw === '__none__') return new Set();
  return new Set(raw.split(/[\s,]+/).filter(Boolean));
}

const gameFilter = resolveGameFilter();
function includesGame(folder) {
  return !gameFilter || gameFilter.has(folder);
}

test.describe('Clip-Clop mobile UI and R button get-up tests', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!includesGame('Clip-Clop'), 'selective CI');
  });

  test('mobile UI displays action dock, touchReset button, and responds to fall with get-up alert', async ({ page }) => {
    test.setTimeout(45_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('./Games/Clip-Clop/');
    await expect.poll(async () => page.evaluate(() => !!window.__ready), { timeout: 30_000 }).toBe(true);

    // Start race
    await page.locator('#startBtn').click();
    await expect.poll(async () => page.evaluate(() => window.__game?.state)).toBe('run');

    // Mobile action dock and ticker are visible on mobile viewport
    const actionDock = page.locator('#mobileActionDock');
    const touchReset = page.locator('#touchReset');
    const ticker = page.locator('#mobileCockpitBar');
    await expect(actionDock).toBeVisible();
    await expect(touchReset).toBeVisible();
    await expect(ticker).toBeVisible();
    await expect(touchReset).toContainText(/重整|Reset/);

    // Fast-forward countdown
    await page.evaluate(() => {
      window.__game.countdown = 0;
    });

    // Induce fall by rolling the horse past threshold
    await page.evaluate(() => {
      const G = window.__game;
      G.roll = 1.2;
      for (let i = 0; i < 40; i++) window.__tick(0.016);
    });

    // Horse is now fallen
    await expect.poll(async () => page.evaluate(() => window.__game?.state), { timeout: 10_000 }).toBe('fallen');

    // Settle fall pose to landed
    await page.evaluate(() => {
      if (window.__game?.fallPose) {
        window.__game.fallPose.landed = true;
      }
      for (let i = 0; i < 10; i++) window.__tick(0.016);
    });

    // Verify fall prompt is visible and touchReset has .fall-alert
    const fallPrompt = page.locator('#fallPrompt');
    await expect(fallPrompt).toBeVisible();
    await expect(touchReset).toHaveClass(/fall-alert/);
    await expect(touchReset).toContainText(/起身|Get Up/);

    // Click #touchReset on mobile to get up
    await touchReset.click({ force: true });

    // Verify horse starts rising
    await expect.poll(async () => page.evaluate(() => {
      const p = window.__game?.fallPose;
      return p ? p.rise > 0 : true;
    }), { timeout: 10_000 }).toBe(true);

    // Advance ticks until horse stands up and state is run
    await page.evaluate(() => {
      for (let i = 0; i < 60; i++) window.__tick(0.016);
    });
    await expect.poll(async () => page.evaluate(() => window.__game?.state)).toBe('run');
    await expect(fallPrompt).toBeHidden();
    await expect(touchReset).not.toHaveClass(/fall-alert/);
  });

  test('tapping fallPrompt directly gets the horse up', async ({ page }) => {
    test.setTimeout(45_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('./Games/Clip-Clop/');
    await expect.poll(async () => page.evaluate(() => !!window.__ready), { timeout: 30_000 }).toBe(true);

    await page.locator('#startBtn').click();
    await page.evaluate(() => {
      window.__game.countdown = 0;
      window.__game.roll = -1.2;
      for (let i = 0; i < 40; i++) window.__tick(0.016);
    });
    await expect.poll(async () => page.evaluate(() => window.__game?.state)).toBe('fallen');

    await page.evaluate(() => {
      if (window.__game?.fallPose) window.__game.fallPose.landed = true;
      for (let i = 0; i < 10; i++) window.__tick(0.016);
    });

    const fallPrompt = page.locator('#fallPrompt');
    await expect(fallPrompt).toBeVisible();

    // Tap fall prompt
    await fallPrompt.click({ force: true });

    await expect.poll(async () => page.evaluate(() => {
      const p = window.__game?.fallPose;
      return p ? p.rise > 0 : true;
    })).toBe(true);
  });

  test('mobile cockpit drawer opens via toggle and closes via backdrop tap or close button', async ({ page }) => {
    test.setTimeout(45_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('./Games/Clip-Clop/');
    await expect.poll(async () => page.evaluate(() => !!window.__ready), { timeout: 30_000 }).toBe(true);

    await page.locator('#startBtn').click();
    const toggleBtn = page.locator('#mobCockpitToggle');
    const leftWing = page.locator('#cockpitLeft');
    const backdrop = page.locator('#cockpitBackdrop');

    await expect(leftWing).toBeHidden();
    await expect(backdrop).toBeHidden();

    // Open drawer
    await toggleBtn.click();
    await expect(leftWing).toBeVisible();
    await expect(backdrop).toBeVisible();

    // Close via backdrop click
    await backdrop.click({ position: { x: 10, y: 10 } });
    await expect(leftWing).toBeHidden();
    await expect(backdrop).toBeHidden();

    // Open again and close via ✕ button
    await toggleBtn.click();
    await expect(leftWing).toBeVisible();
    const closeLeft = page.locator('#cockpitCloseLeft');
    await closeLeft.click();
    await expect(leftWing).toBeHidden();
  });
});
