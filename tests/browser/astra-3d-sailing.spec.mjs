import { test, expect } from '@playwright/test';

const GAME = 'gpt6-astra/3d-sailing/?test=1';

test.describe('Astra Windward (3D Sailing)', () => {
  test('lobby shows expanded courses + daily panel', async ({ page }) => {
    await page.goto(GAME);
    await expect(page.getByRole('heading', { name: /fair wind/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('#course-list .course-btn')).toHaveCount(8, { timeout: 10_000 });
    await expect(page.locator('#daily-box')).toBeVisible();
    await expect(page.locator('#daily-date-line')).toContainText('Asia/Taipei');
    await expect(page.locator('#share-text')).not.toHaveValue('');
    await expect(page.getByRole('button', { name: '開始每日賽' })).toBeVisible();
    await expect(page.getByRole('button', { name: '複製分享文字' })).toBeVisible();

    // First course unlocked; a later star-gated course starts locked.
    const first = page.locator('#course-list .course-btn').first();
    await expect(first).toBeEnabled();
    await expect(first).toContainText('群島巡航');
    const locked = page.locator('#course-list .course-btn:disabled').first();
    await expect(locked).toBeVisible();
    await expect(locked.locator('.lock')).toHaveText('鎖定');

    // Touch controls exist in DOM (visible on coarse pointers / mobile project).
    await expect(page.locator('#touch-controls')).toHaveCount(1);
    await expect(page.locator('#touch-controls [data-key="Space"]')).toHaveCount(1);
    await expect(page.locator('#touch-controls [data-action="restart"]')).toHaveCount(1);

    const api = await page.evaluate(() => {
      const w = window.__windward;
      return {
        ready: !!w,
        courses: w?.listCourseIds?.() ?? [],
        stars: w?.totalStars?.() ?? -1,
      };
    });
    expect(api.ready).toBe(true);
    expect(api.courses.length).toBeGreaterThanOrEqual(8);
    expect(api.stars).toBe(0);
  });

  test('campaign finish records stars and unlocks next course', async ({ page }) => {
    await page.goto(GAME);
    await expect(page.locator('#start')).toBeVisible({ timeout: 15_000 });
    await page.locator('#start').click();

    await expect.poll(async () => page.evaluate(() => window.__windward?.state)).toBe('playing');

    await page.evaluate(() => {
      window.__windward.setElapsed(92.4);
      window.__windward.forceFinish(true);
    });

    await expect.poll(async () => page.evaluate(() => window.__windward?.state)).toBe('won');
    await expect.poll(async () =>
      page.evaluate(() => window.__windward?.progress?.unlocked?.includes('beam-reach')),
    ).toBe(true);
    await expect.poll(async () =>
      page.evaluate(() => window.__windward?.progress?.bests?.archipelago?.stars ?? 0),
    ).toBeGreaterThanOrEqual(1);

    // Result overlay present with Traditional Chinese labels.
    await expect(page.getByRole('heading', { name: /新紀錄|完賽/ })).toBeVisible();
    await page.getByRole('button', { name: '選航線' }).click();
    await expect(page.locator('#overlay')).not.toHaveClass(/hidden/);
    await expect(page.locator('#course-list .course-btn').nth(1)).toBeEnabled();
  });

  test('daily ghost race records best, streak, and share text', async ({ page }) => {
    await page.goto(GAME);
    await expect(page.getByRole('button', { name: '開始每日賽' })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole('button', { name: '開始每日賽' }).click();

    await expect.poll(async () =>
      page.evaluate(() => window.__windward?.isDailyRace === true && window.__windward?.state === 'playing'),
    ).toBe(true);

    const dateKey = await page.evaluate(() => window.__windward.dailyDateKey);
    expect(dateKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    await page.evaluate(() => {
      window.__windward.setElapsed(101.5);
      window.__windward.forceFinish(true);
    });

    await expect.poll(async () => page.evaluate(() => window.__windward?.state)).toBe('won');
    await expect.poll(async () =>
      page.evaluate(() => {
        const d = window.__windward.dailyProgress;
        const key = window.__windward.dailyDateKey;
        return d?.byDate?.[key]?.bestTime ?? null;
      }),
    ).toBeCloseTo(101.5, 1);
    await expect.poll(async () =>
      page.evaluate(() => window.__windward?.dailyProgress?.streak ?? 0),
    ).toBeGreaterThanOrEqual(1);

    await page.getByRole('button', { name: '選航線' }).click();
    await expect(page.locator('#daily-best')).not.toHaveText('—');
    await expect(page.locator('#share-text')).toHaveValue(new RegExp(dateKey));
    await expect(page.locator('#share-text')).toHaveValue(/連續天數/);
  });

  test('prefers-reduced-motion keeps lobby usable', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(GAME);
    await expect(page.locator('#course-list .course-btn').first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('#btn-daily')).toBeEnabled();
    await page.locator('#start').click();
    await expect.poll(async () => page.evaluate(() => window.__windward?.state)).toBe('playing');
    await page.keyboard.press('Escape');
    await expect(page.locator('#overlay')).not.toHaveClass(/hidden/);
  });
});
