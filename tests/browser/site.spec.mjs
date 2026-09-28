import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const { categories } = JSON.parse(fs.readFileSync(new URL('../../data/games.json', import.meta.url)));
const games = categories.flatMap((category) => category.games);
// Workspace Vite games under Games/ — Astra static demos use playPath and may
// lack shared chrome / pull optional CDNs, so they are listed in the menu only.
const workspaceGames = games.filter((game) => game.gameFolder && !game.playPath);

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

for (const game of workspaceGames) {
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

test('Astra playPath tiles are listed and point at gpt6-astra/', async ({ page }) => {
  const astra = games.filter((game) => game.playPath);
  expect(astra.length).toBeGreaterThan(0);
  await page.goto('./');
  await page.locator('[data-filter="astra"]').click();
  await expect(page.locator('.game-tile:visible')).toHaveCount(astra.length);
  const first = astra[0];
  const tile = page.locator(`.game-tile[data-folder="${first.gameFolder}"]`);
  await expect(tile.locator('.tile-play')).toHaveAttribute('href', first.playPath);
});

test('homepage Astra zone and nav reach the gallery hub', async ({ page }) => {
  await page.goto('./');
  const navAstra = page.locator('.site-nav a[href="gpt6-astra/"]');
  await expect(navAstra).toBeVisible();
  const zone = page.locator('#astra-zone');
  await expect(zone).toBeVisible();
  await expect(zone.getByRole('link', { name: '進入畫廊' })).toHaveAttribute('href', 'gpt6-astra/');
  await expect(zone.getByRole('link', { name: '本頁清單' })).toHaveAttribute('href', '#category-astra');
  await expect(page.locator('#category-astra .group-hub')).toHaveAttribute('href', 'gpt6-astra/');
  await zone.getByRole('link', { name: '進入畫廊' }).click();
  await expect(page).toHaveURL(/\/gpt6-astra\/?$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

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

test('fifteen-puzzle: slide a tile, undo, and restart', async ({ page, isMobile }) => {
  await page.goto('./Games/Fifteen-Puzzle/');
  await activate(page.getByRole('button', { name: '簡單', exact: true }), isMobile);
  await expect(page.getByText('步數：0', { exact: false })).toBeVisible();

  const movable = page.getByRole('button', { name: /第 \d+ 格/ }).and(page.locator(':enabled'));
  await expect(movable.first()).toBeVisible();
  await activate(movable.first(), isMobile);
  await expect(page.getByText('步數：1', { exact: false })).toBeVisible();

  await activate(page.getByRole('button', { name: '復原', exact: true }), isMobile);
  await expect(page.getByText('步數：0', { exact: false })).toBeVisible();

  await activate(page.getByRole('button', { name: '重開一局', exact: true }), isMobile);
  await expect(page.getByText('步數：0', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: /第 \d+ 格/ }).and(page.locator(':enabled')).first()).toBeVisible();
});

test('checkers: two-player opening move, undo, and new game', async ({ page, isMobile }) => {
  await page.goto('./Games/Checkers/');
  // Default mode is 雙人對戰; black opens from A3 → B4.
  const opener = page.getByRole('button', { name: 'black man at A3', exact: true });
  await expect(opener).toBeVisible();
  await activate(opener, isMobile);
  await activate(page.getByRole('button', { name: 'Empty B4', exact: true }), isMobile);
  await expect(page.getByRole('button', { name: 'black man at B4', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'black man at A3', exact: true })).toHaveCount(0);

  await activate(page.getByRole('button', { name: '悔棋', exact: true }), isMobile);
  await expect(page.getByRole('button', { name: 'black man at A3', exact: true })).toBeVisible();

  await activate(page.getByRole('button', { name: '新遊戲', exact: true }), isMobile);
  await expect(page.getByRole('button', { name: 'black man at A3', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'black man at B4', exact: true })).toHaveCount(0);
});

test('dialed-color: single-color round through result overlay and replay', async ({ page, isMobile }) => {
  test.setTimeout(45_000);
  await page.goto('./Games/Dialed-Color/');
  await activate(page.getByRole('button', { name: '1 秒', exact: true }), isMobile);
  await activate(page.getByRole('button', { name: '單色挑戰', exact: true }), isMobile);

  const seeResult = page.getByRole('button', { name: '看結果', exact: true });
  await expect(seeResult).toBeVisible({ timeout: 10_000 });
  await activate(seeResult, isMobile);

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveCSS('position', 'fixed');
  await activate(dialog.getByRole('button', { name: '查看色差', exact: true }), isMobile);
  await expect(dialog).toHaveCount(0);

  // 再玩一次 restarts the same mode (showing → guessing), not the landing screen.
  await activate(page.getByRole('button', { name: '再玩一次', exact: true }), isMobile);
  await expect(page.getByRole('button', { name: '看結果', exact: true })).toBeVisible({ timeout: 10_000 });
});

test('every-corner: seeded easy mid-path, undo, and give-up overlay', async ({ page, isMobile }) => {
  test.setTimeout(45_000);
  await page.goto('./Games/Every-Corner/');
  await activate(page.getByRole('button', { name: /輕鬆/ }), isMobile);
  await page.locator('#seed-input').fill('pw1');
  await activate(page.getByRole('button', { name: '用這組種子碼開始', exact: true }), isMobile);

  const board = page.getByRole('img', { name: /的盤面/ });
  await expect(board).toBeVisible();
  await expect(board).toHaveAttribute('aria-label', /已走 0 格/);

  // First arrow places the path on checkpoint 1; second extends one cell when free.
  await page.keyboard.press('ArrowRight');
  await expect(board).toHaveAttribute('aria-label', /已走 1 格/, { timeout: 5_000 });
  await page.keyboard.press('ArrowRight');
  await expect
    .poll(async () => (await board.getAttribute('aria-label')) ?? '', { timeout: 5_000 })
    .toMatch(/已走 [12] 格/);

  const stepped = /已走 2 格/.test((await board.getAttribute('aria-label')) ?? '');
  if (stepped) {
    await activate(page.getByRole('button', { name: '退回上一步', exact: true }), isMobile);
    await expect(board).toHaveAttribute('aria-label', /已走 1 格/);
  }

  await activate(page.getByRole('button', { name: '放棄並看答案', exact: true }), isMobile);
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveCSS('position', 'fixed');
  await activate(dialog.getByRole('button', { name: '再試同一題', exact: true }), isMobile);
  await expect(dialog).toHaveCount(0);
  await expect(board).toHaveAttribute('aria-label', /已走 0 格/);
});

test('freecell: seeded deal, hint, redeal same, and new game', async ({ page, isMobile }) => {
  await page.goto('./Games/FreeCell/');
  await page.locator('#freecell-seed').fill('11982');
  await activate(page.getByRole('button', { name: '發此局', exact: true }), isMobile);
  await expect(page.locator('#freecell-seed')).toHaveValue('11982');

  await activate(page.getByRole('button', { name: '提示' }), isMobile);
  // Hint paints a sky ring on the suggested source/dest; redeal must clear it.
  await activate(page.getByRole('button', { name: '重新發同局' }), isMobile);
  await expect(page.locator('#freecell-seed')).toHaveValue('11982');

  await activate(page.getByRole('button', { name: '新遊戲' }), isMobile);
  await expect(page.locator('#freecell-seed')).not.toHaveValue('');
  await expect(page.getByRole('button', { name: '提示' })).toBeEnabled();
});

test('reversi: two-player completes a round through the result overlay', async ({ page, isMobile }) => {
  // Greedy play is fast alone; keep headroom when Clockwork shares the worker pool.
  test.setTimeout(120_000);
  await page.goto('./Games/Reversi/');
  await activate(page.getByRole('button', { name: '雙人對戰' }), isMobile);

  const dialog = page.getByRole('dialog');
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline && !(await dialog.isVisible().catch(() => false))) {
    const legal = page.getByRole('button', { name: /可下於/ }).and(page.locator(':enabled'));
    if ((await legal.count()) > 0) {
      await activate(legal.first(), isMobile);
      continue;
    }
    const pass = page.getByRole('button', { name: /Pass/ });
    if (await pass.isVisible().catch(() => false)) {
      await activate(pass, isMobile);
      continue;
    }
    await page.waitForTimeout(50);
  }

  await expect(dialog).toBeVisible({ timeout: 5_000 });
  await expect(dialog).toHaveCSS('position', 'fixed');
  await expect(dialog).toHaveAttribute('aria-label', /獲勝|和局|對局結束/);
  await activate(dialog.getByRole('button', { name: '再玩一局' }), isMobile);
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: /可下於/ }).and(page.locator(':enabled')).first()).toBeVisible();
});

test('clockwork-keep: place/undo, undefended lose overlay, and replay', async ({ page, isMobile }) => {
  // Undefended harsh lose is ~50s of rAF time once waves keep advancing.
  test.setTimeout(120_000);
  await page.goto('./Games/Clockwork-Keep/');
  await activate(page.getByRole('button', { name: '嚴苛', exact: true }), isMobile);
  await activate(page.getByRole('button', { name: '開始遊戲', exact: true }), isMobile);

  // Prep: select the cheapest tower and click the canvas to place, then undo.
  const tower = page.locator('.grid.grid-cols-4 button').first();
  await expect(tower).toBeEnabled();
  await activate(tower, isMobile);
  const canvas = page.locator('canvas').first();
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.5);
  const undo = page.getByRole('button', { name: '撤銷' });
  await expect(undo).toBeEnabled();
  await activate(undo, isMobile);
  await expect(undo).toBeDisabled();

  const dialog = page.getByRole('dialog');
  await activate(page.getByRole('button', { name: '開始下一波' }), isMobile);
  const waveDeadline = Date.now() + 90_000;
  while (Date.now() < waveDeadline && !(await dialog.isVisible())) {
    // count() is non-waiting — during a wave this control is replaced by 強行加壓.
    const next = page.getByRole('button', { name: '開始下一波' });
    if ((await next.count()) > 0 && (await next.isEnabled())) {
      await activate(next, isMobile);
    }
    await page.waitForTimeout(200);
  }

  await expect(dialog).toBeVisible({ timeout: 5_000 });
  await expect(dialog).toHaveCSS('position', 'fixed');
  await expect(dialog).toHaveAttribute('aria-label', '城池失守');
  await activate(dialog.getByRole('button', { name: '再玩一次' }), isMobile);
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: '開始下一波' })).toBeVisible();
});
