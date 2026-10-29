import { test, expect } from '@playwright/test';
import { includesAstra } from './astra-filter.mjs';

const LOOP_HERO = 'gpt6-astra/loop-hero/';

async function dismissHowto(page) {
  const howto = page.locator('#howtoModal.show');
  if (await howto.count()) {
    await page.locator('#howtoClose').click();
    await expect(howto).toHaveCount(0);
  }
}

test.describe('Astra Cinder Circuit (Loop Hero)', () => {
  test.skip(!includesAstra('loop-hero'), 'selective CI');
  test('camp shows daily panel, routes, and daily share text', async ({ page }) => {
    await page.goto(LOOP_HERO);
    await expect(page.getByRole('heading', { name: 'CINDER CIRCUIT' })).toBeVisible();
    await dismissHowto(page);

    const camp = page.locator('#campModal.show');
    await expect(camp).toBeVisible();
    await expect(page.getByTestId('daily-panel')).toBeVisible();
    await expect(page.getByTestId('daily-start')).toBeVisible();
    await expect(page.getByTestId('daily-share')).toBeVisible();

    const share = page.getByTestId('daily-share-text');
    await expect(share).not.toHaveValue('');
    await expect(share).toHaveValue(/每日迴路/);
    await expect(share).toHaveValue(/連續天數/);

    await expect(page.locator('#routeGrid .route-pick')).toHaveCount(3);
    await expect(page.locator('#routeGrid .route-pick[data-route="drowned"]')).toBeEnabled();
    await expect(page.locator('#routeGrid .route-pick[data-route="ashen"]')).toBeDisabled();
    await expect(page.locator('#routeGrid .route-pick[data-route="glassmere"]')).toBeDisabled();

    await page.getByTestId('daily-share').click();
    await expect(page.locator('#notification.show')).toBeVisible({ timeout: 5_000 });
  });

  test('daily start boots a seeded run with modifier chrome', async ({ page }) => {
    await page.goto(LOOP_HERO);
    await dismissHowto(page);

    const dailyMeta = await page.evaluate(() => window.__cinderDebug.getDaily());
    expect(dailyMeta.dateKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(dailyMeta.startingDeck.length).toBeGreaterThanOrEqual(4);

    await page.getByTestId('daily-start').click();
    await expect(page.locator('#campModal.show')).toHaveCount(0);

    const state = await page.evaluate(() => {
      const g = window.__cinderDebug.getGame();
      return {
        phase: g?.phase,
        daily: g?.daily,
        routeId: g?.routeId,
        hand: g?.hand?.map((c) => c.key),
        mod: g?.dailyMod?.id || g?.dailyModifierId,
      };
    });
    expect(state.phase).toBe('run');
    expect(state.daily).toBe(true);
    expect(state.routeId).toBe(dailyMeta.routeId);
    expect(state.hand.length).toBeGreaterThanOrEqual(3);
    expect(state.mod).toBeTruthy();
    await expect(page.locator('#hand .card').first()).toBeVisible();
    await expect(page.locator('#hintText')).toContainText(/Daily/i);
  });

  test('glassmere unlocks after clearing drowned and ashen', async ({ page }) => {
    await page.goto(LOOP_HERO);
    await dismissHowto(page);

    await page.evaluate(() => {
      window.__cinderDebug.setMeta({
        routeClears: { drowned: 1, ashen: 1, glassmere: 0 },
        unlockedRoutes: ['drowned', 'ashen'],
        cleared: { ember: 0, wick: 1, ash: 0 },
        howto: true,
        tutorial: true,
      });
    });

    await expect(page.locator('#routeGrid .route-pick[data-route="glassmere"]')).toBeEnabled();
    await page.locator('#routeGrid .route-pick[data-route="glassmere"]').click();
    await expect(
      page.locator('#routeGrid .route-pick[data-route="glassmere"].selected'),
    ).toBeVisible();

    await page.locator('#startBtn').click();
    await expect(page.locator('#campModal.show')).toHaveCount(0);

    const run = await page.evaluate(() => {
      const g = window.__cinderDebug.getGame();
      const route = window.__cinderDebug.currentRoute();
      const boss = window.__cinderDebug.currentBoss();
      return {
        routeId: g.routeId,
        routeName: route.name,
        bossName: boss.name,
        hand: g.hand.map((c) => c.key),
        exclusive: route.exclusiveCards,
      };
    });
    expect(run.routeId).toBe('glassmere');
    expect(run.routeName).toBe('Glassmere Rill');
    expect(run.bossName).toBe('The Stillglass Knell');
    expect(run.hand.some((k) => run.exclusive.includes(k))).toBe(true);
    await expect(page.locator('.map-panel .panel-title span').first()).toContainText('GLASSMERE');
  });

  test('touch: select card then place on highlighted road tile', async ({ page }) => {
    await page.goto(LOOP_HERO);
    await dismissHowto(page);
    await page.getByTestId('daily-start').click();
    await expect(page.locator('#campModal.show')).toHaveCount(0);

    await page.evaluate(() => {
      const t = window.__cinderDebug;
      const g = t.getGame();
      // Pause so placement is stable under touch.
      if (g.phase === 'run') {
        document.getElementById('pauseBtn').click();
      }
    });

    const card = page.locator('#hand .card').first();
    await expect(card).toBeVisible();
    await card.click();
    await expect(card).toHaveClass(/selected/);

    const placed = await page.evaluate(() => {
      const g = window.__cinderDebug.getGame();
      const selectedId = [...document.querySelectorAll('#hand .card.selected')].length;
      if (!selectedId) return { ok: false, reason: 'no-selected' };
      const cardBtn = document.querySelector('#hand .card.selected');
      const tip = cardBtn?.dataset?.tip || '';
      const where = tip.includes('ROAD') ? 'road' : 'verge';
      const cell = g.map.find((c) => {
        if (c.structure) return false;
        if (c.roadIndex === 0 || c.roadIndex === 10) return false;
        if (where === 'road') return c.roadIndex >= 0;
        return (
          c.roadIndex < 0 &&
          g.map.some(
            (n) =>
              n !== c &&
              Math.abs(n.x - c.x) <= 1 &&
              Math.abs(n.y - c.y) <= 1 &&
              n.roadIndex >= 0,
          )
        );
      });
      if (!cell) return { ok: false, reason: 'no-cell', where };
      // Click via canvas coordinate math used by the game.
      const canvas = document.getElementById('map');
      const rect = canvas.getBoundingClientRect();
      const TILE = 70;
      const W = 770;
      const H = 630;
      const s = Math.min(rect.width / W, rect.height / H);
      const ox = (rect.width - W * s) / 2;
      const oy = (rect.height - H * s) / 2;
      const clientX = rect.left + ox + (cell.x + 0.5) * TILE * s;
      const clientY = rect.top + oy + (cell.y + 0.5) * TILE * s;
      canvas.dispatchEvent(
        new MouseEvent('click', { clientX, clientY, bubbles: true }),
      );
      return {
        ok: true,
        placed: g.placed,
        structure: cell.structure,
      };
    });
    expect(placed.ok).toBe(true);
    expect(placed.placed).toBeGreaterThanOrEqual(1);
    expect(placed.structure).toBeTruthy();
  });
});
