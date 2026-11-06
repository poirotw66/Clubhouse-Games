import { test, expect } from '@playwright/test';

const filter = (process.env.CI_GAME_FILTER || '').trim();
const includes = (folder) => !filter || filter === '*' || filter.toLowerCase() === 'full'
  || filter.split(/[\s,]+/).includes(folder);

const savedCareer = (page) => page.evaluate(() =>
  JSON.parse(localStorage.getItem('clubhouse:baseball-life:save')));

if (includes('Wall-Flip')) {
  test('wall-flip gameplay: flight stages lead to an actionable attempt review', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('wallflip.viewMode', '2d'));
    await page.goto('./Games/Wall-Flip/');
    await page.locator('#launchStart').click();
    await page.keyboard.down('Space');
    await page.keyboard.down('x');
    await page.evaluate(() => window.__wfStep(2));
    const coach = page.getByTestId('flight-coach');
    await expect(coach).toBeVisible();
    await expect(coach).toHaveAttribute('data-flight-stage', /climb|descent/);
    await page.keyboard.up('Space');
    await page.keyboard.up('x');
    await page.evaluate(() => window.__wfStep(12));
    await expect(page.getByTestId('flight-review')).toBeVisible();
    await expect(page.locator('[data-review-tip]')).not.toBeEmpty();
    await page.locator('[data-coach-retry]').click();
    await expect(page.getByTestId('flight-review')).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  });

  test('wall-flip gameplay: 3D throttle releases while a coach control has focus and restart exposes the current simulation', async ({ page }) => {
    test.setTimeout(45_000);
    await page.goto('./Games/Wall-Flip/index-3d.html');
    await expect.poll(() => page.evaluate(() => !!window.__ready), { timeout: 30_000 }).toBe(true);
    await page.locator('#startBtn').click();
    const initial = await page.evaluate(() => window.__sim.state.u);
    await page.keyboard.down('Space');
    await expect.poll(() => page.evaluate(() => window.__sim.state.u)).toBeGreaterThan(initial);
    await page.locator('[data-flight-toggle]').focus();
    await page.keyboard.up('Space');
    await expect.poll(() => page.evaluate(() => window.__sim.state.drive)).toBe(false);
    await page.evaluate(() => {
      document.activeElement.blur();
      window.__testOldSim = window.__sim;
    });
    await page.keyboard.press('r');
    expect(await page.evaluate(() => window.__sim !== window.__testOldSim)).toBe(true);
  });
}

if (includes('Clip-Clop')) {
  test('clip-clop gameplay: actual diagonal hoof contacts complete the practice rhythm drills', async ({ page }) => {
    test.setTimeout(45_000);
    await page.goto('./Games/Clip-Clop/');
    await expect.poll(() => page.evaluate(() => !!window.__ready), { timeout: 30_000 }).toBe(true);
    await page.locator('#practiceBtn').click();
    await page.evaluate(() => {
      window.__manual = true;
      for (let i = 0; i < 200; i++) window.__tick(1 / 60, true);
    });
    await expect(page.locator('#coachPractice')).toBeVisible();
    for (let i = 0; i < 12; i++) {
      const pair = i % 2 ? ['q', 'p'] : ['w', 'o'];
      for (const key of pair) await page.keyboard.down(key);
      await page.evaluate(() => {
        for (let frame = 0; frame < 18; frame++) window.__tick(1 / 60, true);
      });
      for (const key of pair) await page.keyboard.up(key);
    }
    await page.evaluate(() => window.__tick(0));
    await expect.poll(async () => Number(await page.locator('#strideCoach').getAttribute('data-drills'))).toBeGreaterThanOrEqual(2);
    expect(await page.evaluate(() => window.__game.x)).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.__game.practice)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  });
}

if (includes('Baseball-Life')) {
  test('baseball-life gameplay: preview, deliberate double-slot training, held keys and undo replay', async ({ page }) => {
    await page.goto('./Games/Baseball-Life/?seed=64aa2bl7');
    await page.getByRole('button', { name: '開始新的棒球人生', exact: true }).click();
    await page.locator('#name-input').fill('節奏球員');
    await page.getByRole('button', { name: '建立球員並開始遊戲', exact: true }).click();
    for (let i = 0; i < 12; i++) {
      if ((await savedCareer(page)).decision?.kind === 'training') break;
      await page.keyboard.press('1');
    }
    await expect(page.locator('[data-training-workspace="true"]')).toBeVisible();
    const initial = await savedCareer(page);
    await page.locator('[data-training-option="weight"]').click();
    await expect(page.locator('[data-training-preview="true"]')).toBeVisible();
    expect((await savedCareer(page)).choices.length).toBe(initial.choices.length);
    await page.keyboard.down('2');
    await page.keyboard.down('2');
    await page.keyboard.up('2');
    expect((await savedCareer(page)).choices.length).toBe(initial.choices.length);

    await page.keyboard.down('Enter');
    await expect.poll(async () => (await savedCareer(page)).pendingPrimaryId).toBe('weight');
    await page.keyboard.down('Enter');
    await page.keyboard.up('Enter');
    expect((await savedCareer(page)).choices.length).toBe(initial.choices.length + 1);
    await page.locator('[data-training-option="stretch"]').click();
    expect((await savedCareer(page)).choices.length).toBe(initial.choices.length + 1);
    await page.locator('[data-training-confirm="true"]').click();
    await expect.poll(async () => (await savedCareer(page)).choices.length).toBe(initial.choices.length + 2);
    const completed = await savedCareer(page);
    expect(completed.pendingPrimaryId).toBeNull();
    await expect(page.locator('[data-training-result="true"]')).toBeVisible();

    await page.getByRole('button', { name: /上一步/ }).click();
    await expect.poll(async () => (await savedCareer(page)).pendingPrimaryId).toBe('weight');
    await page.locator('[data-training-option="stretch"]').click();
    await page.locator('[data-training-confirm="true"]').click();
    await expect.poll(async () => (await savedCareer(page)).choices.length).toBe(initial.choices.length + 2);
    const replayed = await savedCareer(page);
    expect(replayed.report.dice).toBe(completed.report.dice);
    expect(replayed.report.deltas).toEqual(completed.report.deltas);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  });
}
