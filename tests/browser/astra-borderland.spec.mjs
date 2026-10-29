import { test, expect } from '@playwright/test';
import { includesAstra } from './astra-filter.mjs';

/**
 * Astra Dust Riot / Borderland — daily mutation + meta unlocks.
 * Runs under both desktop and mobile Playwright projects.
 * Three.js boot is slow on CI shards; keep generous timeouts.
 */
test.describe('Astra Borderland (Dust Riot)', () => {
  test.skip(!includesAstra('borderland'), 'selective CI');
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60_000);
  });

  async function bootMenu(page, isMobile) {
    await page.goto(
      'gpt6-astra/borderland/?test=1' + (isMobile ? '&touch=1' : ''),
      { waitUntil: 'domcontentloaded' },
    );
    await expect(page.locator('#start')).toBeVisible({ timeout: 45_000 });
    await expect
      .poll(() => page.evaluate(() => !!window.__dustRiotTest), { timeout: 45_000 })
      .toBe(true);
  }

  async function activate(locator, isMobile) {
    if (isMobile) await locator.tap();
    else await locator.click();
  }

  test('menu shows daily mutation and meta shop', async ({ page, isMobile }) => {
    await bootMenu(page, isMobile);
    await expect(page.locator('[data-mode="daily"]')).toBeVisible();
    await expect(page.locator('#openMeta')).toBeVisible();
    await expect(page.locator('#scrapDisplay')).toContainText('廢鐵');

    await activate(page.locator('[data-mode="daily"]'), isMobile);
    await expect(page.locator('#dailyCard')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#dailyCard')).toContainText('今日突變');
    await expect(page.locator('#dailyCard')).toContainText('禁用');

    const banned = await page.evaluate(() => window.__dustRiotTest.getDaily().bannedWeapon);
    await expect(page.locator(`[data-weapon="${banned}"]`)).toBeDisabled();

    await activate(page.locator('#openMeta'), isMobile);
    await expect(page.getByRole('heading', { name: '永久解鎖' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('[data-unlock="startBandage"]')).toBeVisible();
    await activate(page.locator('#metaBack'), isMobile);
    await expect(page.locator('#start')).toBeVisible();
  });

  test('daily run records best + share text; meta unlock persists', async ({ page, isMobile }) => {
    await bootMenu(page, isMobile);

    await page.evaluate(() => {
      const t = window.__dustRiotTest;
      t.setStats({
        scrap: 100,
        unlocked: {},
        bestByMode: {},
        clearsByMode: {},
        weaponClears: {},
        dailyPlayDates: [],
      });
    });

    await activate(page.locator('#openMeta'), isMobile);
    await expect(page.locator('[data-unlock="scavKit"]')).toBeVisible({ timeout: 15_000 });
    await activate(page.locator('[data-unlock="scavKit"]'), isMobile);
    await expect(page.locator('[data-unlock="scavKit"]')).toHaveClass(/owned/);
    await activate(page.locator('#metaBack'), isMobile);

    await activate(page.locator('[data-mode="daily"]'), isMobile);
    await expect(page.locator('#dailyCard')).toBeVisible({ timeout: 15_000 });
    await activate(page.locator('#start'), isMobile);

    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const t = window.__dustRiotTest;
            if (!t) return null;
            if (t.getUi() !== 'playing') t.beginRun();
            t.enableUnlockPlay();
            return { ui: t.getUi(), mode: t.getMode() };
          }),
        { timeout: 20_000 },
      )
      .toEqual({ ui: 'playing', mode: 'daily' });

    const state = await page.evaluate(() => {
      const t = window.__dustRiotTest;
      return {
        mutation: t.getRunMutation()?.id || null,
        banned: t.getActiveDaily()?.bannedWeapon || null,
        weapon: t.getWeapon(),
      };
    });
    expect(state.mutation).toBeTruthy();
    expect(state.weapon).not.toBe(state.banned);

    if (isMobile) {
      await expect(page.locator('#touchUI.show')).toBeVisible();
      await expect(page.locator('#btnFire')).toBeVisible();
    }

    await page.evaluate(() => {
      window.__dustRiotTest.finishRun('victory');
    });
    await expect(page.locator('#again')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#shareText')).toBeVisible();
    await expect(page.locator('#shareText')).not.toHaveValue('');
    await expect(page.locator('#copyShare')).toBeVisible();

    const storage = await page.evaluate(() => {
      const raw = localStorage.getItem('dust-riot-v3');
      return raw ? JSON.parse(raw) : null;
    });
    expect(storage).toBeTruthy();
    expect(storage.unlocked.scavKit).toBe(true);
    expect(storage.bestDaily?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(storage.dailyPlayDates?.length).toBeGreaterThan(0);
    expect(storage.clearsByMode?.daily).toBeGreaterThan(0);
  });

  test('classic easy start still works with weapons', async ({ page, isMobile }) => {
    await bootMenu(page, isMobile);
    await activate(page.locator('[data-mode="easy"]'), isMobile);
    await activate(page.locator('[data-weapon="shotgun"]'), isMobile);
    await activate(page.locator('#start'), isMobile);

    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const t = window.__dustRiotTest;
            if (!t) return null;
            if (t.getUi() !== 'playing') t.beginRun();
            t.enableUnlockPlay();
            return { ui: t.getUi(), weapon: t.getWeapon() };
          }),
        { timeout: 20_000 },
      )
      .toEqual({ ui: 'playing', weapon: 'shotgun' });

    const state = await page.evaluate(() => {
      const t = window.__dustRiotTest;
      return { wave: t.getWave(), kinds: t.getEnemyKinds().length };
    });
    expect(state.wave).toBeGreaterThanOrEqual(1);
    expect(state.kinds).toBeGreaterThan(0);
  });
});
