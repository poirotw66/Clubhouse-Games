import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const { categories } = JSON.parse(fs.readFileSync(new URL('../../data/games.json', import.meta.url)));
const games = categories.flatMap((category) => category.games);

// Track runtime exceptions and local asset errors throughout each interaction.
test.beforeEach(async ({ page, baseURL }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && message.location().url.startsWith(new URL(baseURL).origin)) {
      errors.push(message.text());
    }
  });
  page.on('response', (response) => {
    if (response.url().startsWith(new URL(baseURL).origin) && response.status() >= 400) {
      errors.push(`${response.status()} ${response.url()}`);
    }
  });
  page.on('requestfailed', (request) => {
    if (request.url().startsWith(new URL(baseURL).origin) && !request.failure()?.errorText.includes('ERR_ABORTED')) {
      errors.push(`${request.failure()?.errorText} ${request.url()}`);
    }
  });
  // External fonts are optional. Avoid depending on Google's availability in CI.
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) => route.fulfill({ body: '', contentType: 'text/css' }));
  page.__runtimeErrors = errors;
});

test.afterEach(async ({ page }) => {
  expect(page.__runtimeErrors, 'browser runtime / asset errors').toEqual([]);
});

test('artifact preview returns real 404s and survives malformed paths', async ({ request }) => {
  expect((await request.get('./Games/missing-game/')).status()).toBe(404);
  expect((await request.get('./Games/Memory-Match/missing.js')).status()).toBe(404);
  expect((await request.get('./%ZZ')).status()).toBe(400);
  expect((await request.get('./')).status()).toBe(200);
});

test('menu search, shared URL, categories and responsive covers', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.game-tile')).toHaveCount(games.length);
  await page.locator('#game-search').fill('記憶配對');
  await expect(page.locator('.game-tile:visible')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('#game-search')).toHaveValue('記憶配對');
  const cover = page.locator('.game-tile:visible img');
  await cover.scrollIntoViewIfNeeded();
  await expect.poll(() => cover.evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);
  expect(await cover.evaluate((img) => img.currentSrc)).toMatch(/optimized\/Memory-Match-(320|640)\.webp$/);
  await page.locator('#search-clear').click();
  await page.locator('[data-filter="board"]').click();
  await expect(page.locator('.game-tile:visible')).toHaveCount(categories.find((c) => c.id === 'board').games.length);
  await page.locator('#game-search').fill('no-such-game-xyz');
  await expect(page.locator('#empty-state')).toBeVisible();
  await page.locator('#reset-filters').click();
  await expect(page.locator('.game-tile:visible')).toHaveCount(games.length);
});

for (const game of games) {
  test(`${game.gameFolder}: loads from the menu and returns`, async ({ page }) => {
    await page.goto('./');
    await page.locator(`.game-tile[data-folder="${game.gameFolder}"] .tile-play`).click();
    await expect(page).toHaveURL(new RegExp(`/Games/${game.gameFolder}/$`));
    // Prefer the shared chrome over networkidle — games that preload BGM/media
    // (e.g. Koi-Koi) never go idle, and the afterEach hooks already catch bad assets.
    const back = page.getByRole('link', { name: /返回總覽/ });
    await expect(back).toBeVisible();
    await back.click();
    await expect(page.locator('#game-search')).toBeVisible();
    await expect(page.locator('#recent-list')).toContainText(game.name);
  });
}

test('memory match: touch/click cards, change difficulty and restart', async ({ page, isMobile }) => {
  await page.goto('./Games/Memory-Match/');
  const activate = (locator) => isMobile ? locator.tap() : locator.click();
  await activate(page.getByRole('button', { name: '簡單 · 4 對' }));
  await expect(page.getByRole('button', { name: '背面牌', exact: true })).toHaveCount(8);
  await activate(page.getByRole('button', { name: '背面牌', exact: true }).first());
  await expect(page.getByRole('button', { name: '背面牌', exact: true })).toHaveCount(7);
  await activate(page.getByRole('button', { name: '背面牌', exact: true }).first());
  await expect(page.getByText('翻牌次數：1', { exact: false })).toBeVisible();
  await activate(page.getByRole('button', { name: '重開一局', exact: true }));
  await expect(page.getByRole('button', { name: '背面牌', exact: true })).toHaveCount(8);
  await expect(page.getByText('翻牌次數：0', { exact: false })).toBeVisible();
});

test('connect four: play a win and use the result overlay to restart', async ({ page, isMobile }) => {
  await page.goto('./Games/Connect-Four/');
  for (const column of [1, 2, 1, 2, 1, 2, 1]) {
    const button = page.getByRole('button', { name: `投入第 ${column} 欄`, exact: true });
    if (isMobile) await button.tap();
    else await button.click();
  }
  const result = page.getByRole('dialog');
  await expect(result).toBeVisible();
  await expect(result).toHaveCSS('position', 'fixed');
  const restart = result.getByRole('button', { name: '再玩一局' });
  if (isMobile) await restart.tap();
  else await restart.click();
  await expect(result).toHaveCount(0);
  await expect(page.getByRole('button', { name: '投入第 1 欄', exact: true })).toBeEnabled();
});

/** Touch vs click — same helper shape as Memory-Match / Connect-Four. */
function activate(locator, isMobile) {
  return isMobile ? locator.tap() : locator.click();
}

test('reversi: two-player mid-game, undo, and new-game menu', async ({ page, isMobile }) => {
  await page.goto('./Games/Reversi/');
  await activate(page.getByRole('button', { name: '雙人對戰' }), isMobile);
  const opening = page.getByRole('button', { name: '可下於第 3 列 4 欄', exact: true });
  await expect(opening).toBeVisible();
  await activate(opening, isMobile);
  await expect(page.getByRole('button', { name: '第 3 列 4 欄 黑', exact: true })).toBeVisible();
  await activate(page.getByRole('button', { name: '悔棋' }), isMobile);
  await expect(page.getByRole('button', { name: '可下於第 3 列 4 欄', exact: true })).toBeVisible();
  await activate(page.getByRole('button', { name: '新對局' }), isMobile);
  await expect(page.getByRole('button', { name: '雙人對戰' })).toBeVisible();
});

test('blackjack: bet, resolve a hand, and restart from the result overlay', async ({ page, isMobile }) => {
  test.setTimeout(45_000);
  await page.goto('./Games/Blackjack-main/');
  await activate(page.getByRole('button', { name: '$10', exact: true }), isMobile);
  await activate(page.getByRole('button', { name: '發牌' }), isMobile);

  // Insurance / even-money / stand / auto blackjack all lead to gameOver.
  const dialog = page.getByRole('dialog');
  await expect
    .poll(
      async () => {
        if (await dialog.isVisible().catch(() => false)) return 'done';
        for (const name of ['不保險', '均分 1:1', '繼續比牌', '停牌']) {
          const button = page.getByRole('button', { name, exact: true });
          if (await button.isVisible().catch(() => false)) {
            await activate(button, isMobile);
            return name;
          }
        }
        return 'wait';
      },
      { timeout: 20_000 },
    )
    .not.toBe('wait');

  await expect(dialog).toBeVisible({ timeout: 20_000 });
  await expect(dialog).toHaveCSS('position', 'fixed');
  const next = dialog.getByRole('button', { name: /下一局|重新開始/ });
  await activate(next, isMobile);
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: '發牌' })).toBeVisible();
});

test('pick-red: seeded hard deal, capture mid-game, and undo', async ({ page, isMobile }) => {
  test.setTimeout(45_000);
  await page.goto('./Games/Pick-Red/');
  await activate(page.getByRole('button', { name: /困難/ }), isMobile);
  await page.getByPlaceholder('例如 64aa2bl7').fill('pw1');
  await activate(page.getByRole('button', { name: '開始牌局', exact: true }), isMobile);

  const hand = page.getByRole('region', { name: '你的手牌' });
  const queen = hand.getByRole('button', { name: '紅♦Q，10 分', exact: true });
  await expect(queen).toBeVisible();
  await activate(queen, isMobile);
  await activate(queen, isMobile);
  await expect(hand.getByRole('button')).toHaveCount(11);

  // After the pile flip and one CPU turn, undo should restore the capture.
  const undo = page.getByRole('button', { name: '復原', exact: true });
  await expect(undo).toBeEnabled({ timeout: 15_000 });
  await activate(undo, isMobile);
  await expect(hand.getByRole('button', { name: '紅♦Q，10 分', exact: true })).toBeVisible();
  await expect(hand.getByRole('button')).toHaveCount(12);
});

test('big-two: seeded opener plays ♣3, then undo after the table updates', async ({ page, isMobile }) => {
  test.setTimeout(45_000);
  await page.goto('./Games/Big-Two/');
  await page.getByPlaceholder(/例如/).fill('abc');
  await activate(page.getByRole('button', { name: '開始牌局', exact: true }), isMobile);

  const hand = page.getByRole('region', { name: '你的手牌' });
  const club3 = hand.getByRole('button', { name: '♣3', exact: true });
  await expect(club3).toBeVisible();
  await activate(club3, isMobile);
  await activate(page.getByRole('button', { name: '出牌', exact: true }), isMobile);

  const table = page.getByRole('region', { name: '檯面' });
  await expect(table.getByRole('img', { name: '♣3' })).toBeVisible({ timeout: 5_000 });
  await expect(hand.getByRole('button', { name: '♣3', exact: true })).toHaveCount(0);

  const undo = page.getByRole('button', { name: '復原', exact: true });
  await expect(undo).toBeEnabled({ timeout: 15_000 });
  await activate(undo, isMobile);
  await expect(hand.getByRole('button', { name: '♣3', exact: true })).toBeVisible();
});
