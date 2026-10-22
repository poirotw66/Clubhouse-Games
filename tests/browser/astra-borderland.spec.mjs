import { test, expect } from '@playwright/test';

/**
 * Astra Dust Riot / Borderland — daily mutation + meta unlocks.
 * Runs under both desktop and mobile Playwright projects.
 */
test.describe('Astra Borderland (Dust Riot)', () => {
  test('menu shows daily mutation and meta shop', async ({ page, isMobile }) => {
    await page.goto('gpt6-astra/borderland/?test=1' + (isMobile ? '&touch=1' : ''));
    await expect(page.locator('#start')).toBeVisible();
    await expect(page.locator('[data-mode="daily"]')).toBeVisible();
    await expect(page.locator('#openMeta')).toBeVisible();
    await expect(page.locator('#scrapDisplay')).toContainText('廢鐵');

    const activate = async (locator) => {
      if (isMobile) await locator.tap();
      else await locator.click();
    };

    await activate(page.locator('[data-mode="daily"]'));
    await expect(page.locator('#dailyCard')).toBeVisible();
    await expect(page.locator('#dailyCard')).toContainText('今日突變');
    await expect(page.locator('#dailyCard')).toContainText('禁用');

    const banned = await page.evaluate(() => window.__dustRiotTest.getDaily().bannedWeapon);
    await expect(page.locator(`[data-weapon="${banned}"]`)).toBeDisabled();

    await activate(page.locator('#openMeta'));
    await expect(page.getByRole('heading', { name: '永久解鎖' })).toBeVisible();
    await expect(page.locator('[data-unlock="startBandage"]')).toBeVisible();
    await activate(page.locator('#metaBack'));
    await expect(page.locator('#start')).toBeVisible();
  });

  test('daily run records best + share text; meta unlock persists', async ({ page, isMobile }) => {
    test.setTimeout(45_000);
    await page.goto('gpt6-astra/borderland/?test=1' + (isMobile ? '&touch=1' : ''));
    await expect(page.locator('#start')).toBeVisible();

    const activate = async (locator) => {
      if (isMobile) await locator.tap();
      else await locator.click();
    };

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

    await activate(page.locator('#openMeta'));
    await activate(page.locator('[data-unlock="scavKit"]'));
    await expect(page.locator('[data-unlock="scavKit"]')).toHaveClass(/owned/);
    await activate(page.locator('#metaBack'));

    await activate(page.locator('[data-mode="daily"]'));
    await activate(page.locator('#start'));
    await page.waitForTimeout(500);

    const playing = await page.evaluate(() => {
      const t = window.__dustRiotTest;
      if (t.getUi() !== 'playing') t.beginRun();
      t.enableUnlockPlay();
      return {
        ui: t.getUi(),
        mode: t.getMode(),
        mutation: t.getRunMutation()?.id || null,
        banned: t.getActiveDaily()?.bannedWeapon || null,
        weapon: t.getWeapon(),
        touch: t.isTouchMode(),
      };
    });
    expect(playing.ui).toBe('playing');
    expect(playing.mode).toBe('daily');
    expect(playing.mutation).toBeTruthy();
    expect(playing.weapon).not.toBe(playing.banned);

    if (isMobile) {
      await expect(page.locator('#touchUI.show')).toBeVisible();
      await expect(page.locator('#btnFire')).toBeVisible();
    }

    await page.evaluate(() => {
      window.__dustRiotTest.finishRun('victory');
    });
    await expect(page.locator('#again')).toBeVisible();
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
    await page.goto('gpt6-astra/borderland/?test=1' + (isMobile ? '&touch=1' : ''));
    const activate = async (locator) => {
      if (isMobile) await locator.tap();
      else await locator.click();
    };
    await activate(page.locator('[data-mode="easy"]'));
    await activate(page.locator('[data-weapon="shotgun"]'));
    await activate(page.locator('#start'));
    await page.waitForTimeout(400);
    const state = await page.evaluate(() => {
      const t = window.__dustRiotTest;
      if (t.getUi() !== 'playing') t.beginRun();
      t.enableUnlockPlay();
      return {
        ui: t.getUi(),
        weapon: t.getWeapon(),
        wave: t.getWave(),
        kinds: t.getEnemyKinds(),
      };
    });
    expect(state.ui).toBe('playing');
    expect(state.weapon).toBe('shotgun');
    expect(state.wave).toBeGreaterThanOrEqual(1);
    expect(state.kinds.length).toBeGreaterThan(0);
  });
});
