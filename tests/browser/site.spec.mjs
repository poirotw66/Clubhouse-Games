import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const { categories } = JSON.parse(fs.readFileSync(new URL('../../data/games.json', import.meta.url)));
const games = categories.flatMap((category) => category.games);
// Workspace Vite games under Games/ — Astra static demos use playPath and may
// lack shared chrome / pull optional CDNs, so they are listed in the menu only.
const allWorkspaceGames = games.filter((game) => game.gameFolder && !game.playPath);

/**
 * Selective PR CI sets CI_GAME_FILTER to a space/comma-separated list of
 * Games/<folder> names. `__none__` skips per-game loads/deep tests but keeps
 * site-shell coverage. Unset / empty / `full` / `*` → every workspace game.
 */
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
const workspaceGames = allWorkspaceGames.filter((game) => includesGame(game.gameFolder));

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
    // Sailing boots a WebGL title loop; mobile CI needs headroom beyond the 30s default.
    if (game.gameFolder === 'Sailing') test.setTimeout(60_000);
    await page.goto('./');
    await page.locator(`.game-tile[data-folder="${game.gameFolder}"] .tile-play`).click();
    await expect(page).toHaveURL(new RegExp(`/Games/${game.gameFolder}/$`));
    // Prefer the shared chrome over networkidle — games that preload BGM/media
    // (e.g. Koi-Koi) never go idle, and the afterEach hooks already catch bad assets.
    if (game.gameFolder === 'Sailing') {
      // Assert the real title lobby (not just a blank canvas) before leaving.
      await expect(page.getByRole('heading', { name: '海灣帆航' })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole('button', { name: '開始航行' })).toBeVisible();
      await expect(page.getByRole('group', { name: '遊玩模式' })).toBeVisible();
    }
    const back = page.getByRole('link', { name: /返回總覽/ });
    await expect(back).toBeVisible({ timeout: game.gameFolder === 'Sailing' ? 45_000 : undefined });
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
  test.skip(!includesGame('Memory-Match'), 'selective CI');
  await page.goto('./Games/Memory-Match/');
  const activate = (locator) => isMobile ? locator.tap() : locator.click();
  // PAIR_OPTIONS start at 6 pairs (depth update); HUD copy is "翻牌 N".
  await activate(page.getByRole('button', { name: '簡單 · 6 對' }));
  await expect(page.getByRole('button', { name: '背面牌', exact: true })).toHaveCount(12);
  await activate(page.getByRole('button', { name: '背面牌', exact: true }).first());
  await expect(page.getByRole('button', { name: '背面牌', exact: true })).toHaveCount(11);
  await activate(page.getByRole('button', { name: '背面牌', exact: true }).first());
  await expect(page.getByText(/翻牌\s*1/)).toBeVisible();
  await activate(page.getByRole('button', { name: '重開一局', exact: true }));
  await expect(page.getByRole('button', { name: '背面牌', exact: true })).toHaveCount(12);
  await expect(page.getByText(/翻牌\s*0/)).toBeVisible();
});

test('connect four: play a win and use the result overlay to restart', async ({ page, isMobile }) => {
  test.skip(!includesGame('Connect-Four'), 'selective CI');
  await page.goto('./Games/Connect-Four/');
  const activateBtn = (locator) => (isMobile ? locator.tap() : locator.click());
  await activateBtn(page.getByRole('button', { name: '雙人對戰' }));
  await activateBtn(page.getByRole('button', { name: '經典', exact: true }));
  await activateBtn(page.getByRole('button', { name: '7×6', exact: true }));
  for (const column of [1, 2, 1, 2, 1, 2, 1]) {
    const button = page.getByRole('button', { name: `投入第 ${column} 欄`, exact: true });
    await activateBtn(button);
  }
  const result = page.getByRole('dialog');
  await expect(result).toBeVisible();
  await expect(result).toHaveCSS('position', 'fixed');
  const restart = result.getByRole('button', { name: '再玩一局' });
  await activateBtn(restart);
  await expect(result).toHaveCount(0);
  await expect(page.getByRole('button', { name: '投入第 1 欄', exact: true })).toBeEnabled();
});

test('connect four: popout, series target, personality, and puzzle smoke', async ({ page, isMobile }) => {
  test.skip(!includesGame('Connect-Four'), 'selective CI');
  await page.goto('./Games/Connect-Four/');
  const activateBtn = (locator) => (isMobile ? locator.tap() : locator.click());

  await activateBtn(page.getByRole('button', { name: '電腦（你執紅）' }));
  await activateBtn(page.getByRole('button', { name: 'PopOut', exact: true }));
  await expect(page.getByRole('button', { name: '投下', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'PopOut 取出', exact: true })).toBeVisible();
  await activateBtn(page.getByRole('button', { name: '8×7', exact: true }));
  await expect(page.getByRole('button', { name: '投入第 8 欄', exact: true })).toBeVisible();
  await activateBtn(page.getByRole('button', { name: '5 勝', exact: true }));
  await expect(page.getByText('先取 5 勝', { exact: false })).toBeVisible();
  await activateBtn(page.getByRole('button', { name: '鐵壁', exact: true }));
  await expect(page.getByText('優先擋殺', { exact: false })).toBeVisible();

  await activateBtn(page.getByRole('button', { name: /謎題/ }));
  await expect(page.getByRole('button', { name: /橫線一擊/ })).toBeVisible();
  await activateBtn(page.getByRole('button', { name: /橫線一擊/ }));
  await activateBtn(page.getByRole('button', { name: '投入第 4 欄', exact: true }));
  const puzzleResult = page.getByRole('dialog');
  await expect(puzzleResult).toBeVisible();
  await expect(puzzleResult.getByText('謎題完成', { exact: false })).toBeVisible();
  await activateBtn(puzzleResult.getByRole('button', { name: '下一題' }));
  await expect(page.getByText('步內取勝', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: '投入第 4 欄', exact: true })).toBeEnabled();
});

/** Touch vs click — same helper shape as Memory-Match / Connect-Four. */
function activate(locator, isMobile) {
  return isMobile ? locator.tap() : locator.click();
}

test('reversi: two-player mid-game, undo, and new-game menu', async ({ page, isMobile }) => {
  test.skip(!includesGame('Reversi'), 'selective CI');
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

test('reversi: puzzle mode solves the first corner étude', async ({ page, isMobile }) => {
  test.skip(!includesGame('Reversi'), 'selective CI');
  await page.goto('./Games/Reversi/');
  await activate(page.getByRole('button', { name: '殘局謎題' }), isMobile);
  // Sequential unlock: only the first étude is open.
  await expect(page.getByRole('button', { name: /1\. 角地到手/ })).toBeEnabled();
  await expect(page.getByRole('button', { name: /2\. 右上角（鎖定）/ })).toBeDisabled();
  await activate(page.getByRole('button', { name: /1\. 角地到手/ }), isMobile);
  // Black to move takes a1 (row 1, col 1) — the only legal winning corner.
  const corner = page.getByRole('button', { name: '可下於第 1 列 1 欄', exact: true });
  await expect(corner).toBeVisible();
  await activate(corner, isMobile);
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await expect(dialog).toHaveAttribute('aria-label', /謎題完成/);
  await activate(dialog.getByRole('button', { name: /下一題|再試一次/ }), isMobile);
  // Next étude is now playable (unlocked by clearing #1).
  await expect(page.getByRole('button', { name: '可下於第 1 列 8 欄', exact: true })).toBeVisible({
    timeout: 10_000,
  });
});

test('reversi: opponent ladder unlocks the first challenge', async ({ page, isMobile }) => {
  test.skip(!includesGame('Reversi'), 'selective CI');
  await page.goto('./Games/Reversi/');
  await activate(page.getByRole('button', { name: '對手名冊' }), isMobile);
  await expect(page.getByText('貪心小子')).toBeVisible();
  await expect(page.getByRole('button', { name: '挑戰' }).first()).toBeEnabled();
  await expect(page.getByRole('button', { name: '鎖定' }).first()).toBeVisible();
  await activate(page.getByRole('button', { name: '挑戰' }).first(), isMobile);
  await expect(page.getByText('貪心小子')).toBeVisible();
  await expect(page.getByRole('button', { name: '悔棋' })).toBeVisible();
});

test('blackjack: bet, resolve a hand, and restart from the result overlay', async ({ page, isMobile }) => {
  test.skip(!includesGame('Blackjack-main'), 'selective CI');
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
  test.skip(!includesGame('Pick-Red'), 'selective CI');
  test.setTimeout(45_000);
  await page.goto('./Games/Pick-Red/');
  await activate(page.getByRole('button', { name: /困難/ }), isMobile);
  // Default lobby is series (四圈); pin a seed and start.
  await page.getByPlaceholder('例如 64aa2bl7').fill('pw1');
  await activate(page.getByRole('button', { name: '開始系列賽', exact: true }), isMobile);

  await expect(page.getByRole('region', { name: '系列賽計分板' })).toBeVisible();

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

test('pick-red: single mode starts without series scoreboard', async ({ page, isMobile }) => {
  test.skip(!includesGame('Pick-Red'), 'selective CI');
  test.setTimeout(30_000);
  await page.goto('./Games/Pick-Red/');
  await activate(page.getByRole('button', { name: /^單局/ }), isMobile);
  await page.getByPlaceholder('例如 64aa2bl7').fill('pw1');
  await activate(page.getByRole('button', { name: '開始單局', exact: true }), isMobile);

  await expect(page.getByRole('region', { name: '系列賽計分板' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: '你的手牌' })).toBeVisible();
  await expect(page.getByRole('button', { name: '紅♦Q，10 分', exact: true })).toBeVisible();
});

test('big-two: seeded opener plays ♣3, then undo after the table updates', async ({ page, isMobile }) => {
  test.skip(!includesGame('Big-Two'), 'selective CI');
  test.setTimeout(45_000);
  // Skip the soft first-run guide so the lobby「開始系列賽」is the only match.
  await page.addInitScript(() => {
    localStorage.setItem('clubhouse-big-two-howto-seen', '1');
  });
  await page.goto('./Games/Big-Two/');
  await page.getByPlaceholder(/例如/).fill('abc');
  await activate(page.getByRole('button', { name: '開始系列賽', exact: true }), isMobile);

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
  test.skip(!includesGame('Fifteen-Puzzle'), 'selective CI');
  await page.goto('./Games/Fifteen-Puzzle/');
  // Title lobby: pick scramble tier, then start classic play (tiles are role=gridcell).
  await expect(page.getByRole('heading', { name: '數字推盤' })).toBeVisible();
  await activate(page.getByRole('group', { name: '打亂難度' }).getByRole('button', { name: '簡單', exact: true }), isMobile);
  await activate(page.getByRole('button', { name: '經典模式', exact: true }), isMobile);
  await expect(page.getByText('經典', { exact: false })).toBeVisible();
  await expect(page.getByText('步數：0', { exact: false })).toBeVisible();
  await expect(page.getByRole('grid', { name: /乘 .* 推盤/ })).toBeVisible();

  // PuzzleBoard exposes tiles as gridcells with aria-label「第 N 格」(N = tile value).
  const movable = page.getByRole('gridcell', { name: /第 \d+ 格/ }).and(page.locator(':enabled'));
  await expect(movable.first()).toBeVisible();
  await activate(movable.first(), isMobile);
  await expect(page.getByText('步數：1', { exact: false })).toBeVisible();

  await activate(page.getByRole('button', { name: '復原', exact: true }), isMobile);
  await expect(page.getByText('步數：0', { exact: false })).toBeVisible();

  await activate(page.getByRole('button', { name: '重開', exact: true }), isMobile);
  await expect(page.getByText('步數：0', { exact: false })).toBeVisible();
  await expect(page.getByRole('gridcell', { name: /第 \d+ 格/ }).and(page.locator(':enabled')).first()).toBeVisible();
});

test('checkers: variants, two-player opening, undo, and new game', async ({ page, isMobile }) => {
  test.skip(!includesGame('Checkers'), 'selective CI');
  await page.goto('./Games/Checkers/');
  await expect(page.getByRole('heading', { name: '西洋跳棋', exact: true })).toBeVisible();

  // International 10×10 uses A–J labels and 20 pieces per side.
  await activate(page.getByRole('button', { name: /國際式 10×10/ }), isMobile);
  await expect(page.getByRole('button', { name: 'black man at A3', exact: true })).toBeVisible();
  await expect(page.getByText('J', { exact: true }).first()).toBeVisible();

  // Back to American 8×8 for the opening sequence.
  await activate(page.getByRole('button', { name: /美式 8×8/ }), isMobile);

  // Switch to 雙人 so the bot does not race the undo assertion.
  await activate(page.getByRole('button', { name: /對戰・|雙人對戰|系列賽|謎題/ }).first(), isMobile);
  await activate(page.getByRole('button', { name: '雙人', exact: true }), isMobile);

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

test('checkers: puzzle mode unlock ladder and first puzzle board', async ({ page, isMobile }) => {
  test.skip(!includesGame('Checkers'), 'selective CI');
  await page.goto('./Games/Checkers/');
  await activate(page.getByRole('button', { name: /對戰・|雙人對戰|系列賽|謎題/ }).first(), isMobile);
  await activate(page.getByRole('button', { name: '謎題', exact: true }), isMobile);

  await expect(page.getByText(/殘局謎題（10 題/)).toBeVisible();
  await expect(page.getByRole('button', { name: /1\. 一擊必殺/ })).toBeEnabled();
  await expect(page.getByRole('button', { name: /2\. 🔒/ })).toBeDisabled();

  // First puzzle: black to jump the lone white man.
  await expect(page.getByRole('button', { name: /black man at/ }).first()).toBeVisible();
  await expect(page.getByText(/已解 0\/10/)).toBeVisible();
});

test('dialed-color: single-color round through feedback, overlay, and replay', async ({ page, isMobile }) => {
  test.skip(!includesGame('Dialed-Color'), 'selective CI');
  test.setTimeout(45_000);
  await page.goto('./Games/Dialed-Color/');
  await expect(page.getByRole('heading', { name: '色感記憶' })).toBeVisible();
  await activate(page.getByRole('button', { name: '1 秒', exact: true }), isMobile);
  await activate(page.getByRole('button', { name: '單色挑戰', exact: true }), isMobile);

  const submit = page.getByRole('button', { name: '提交', exact: true });
  await expect(submit).toBeVisible({ timeout: 10_000 });
  await activate(submit, isMobile);

  // Per-round feedback with HSL distance bars, then results overlay.
  await expect(page.getByText('回合回饋', { exact: true })).toBeVisible();
  await activate(page.getByRole('button', { name: '看結果', exact: true }), isMobile);

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveCSS('position', 'fixed');
  await activate(dialog.getByRole('button', { name: '查看色差', exact: true }), isMobile);
  await expect(dialog).toHaveCount(0);

  // 再玩一次 restarts the same mode (showing → guessing), not the landing screen.
  await activate(page.getByRole('button', { name: '再玩一次', exact: true }), isMobile);
  await expect(page.getByRole('button', { name: '提交', exact: true })).toBeVisible({ timeout: 10_000 });
});

test('dialed-color: daily challenge landing, share copy, and stats', async ({ page, isMobile }) => {
  test.skip(!includesGame('Dialed-Color'), 'selective CI');
  test.setTimeout(90_000);
  await page.goto('./Games/Dialed-Color/');
  await activate(page.getByRole('button', { name: /每日挑戰/ }), isMobile);

  // Daily flashes 5 colors at 2s each before guessing.
  const submit = page.getByRole('button', { name: '提交', exact: true });
  await expect(submit).toBeVisible({ timeout: 20_000 });

  for (let i = 0; i < 5; i += 1) {
    await activate(page.getByRole('button', { name: '提交', exact: true }), isMobile);
    await expect(page.getByText('回合回饋', { exact: true })).toBeVisible();
    const nextLabel = i < 4 ? '繼續' : '看結果';
    await activate(page.getByRole('button', { name: nextLabel, exact: true }), isMobile);
  }

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await activate(dialog.getByRole('button', { name: '查看並分享', exact: true }), isMobile);
  await expect(page.getByRole('button', { name: /複製分享結果/ })).toBeVisible();

  await activate(page.getByRole('button', { name: '回首頁', exact: true }), isMobile);
  await activate(page.getByRole('button', { name: '統計', exact: true }), isMobile);
  await expect(page.getByRole('heading', { name: '統計與紀錄' })).toBeVisible();
  await activate(page.getByRole('button', { name: '回首頁', exact: true }), isMobile);
  await expect(page.getByRole('heading', { name: '色感記憶' })).toBeVisible();
});

test('every-corner: seeded easy mid-path, undo, and give-up overlay', async ({ page, isMobile }) => {
  test.skip(!includesGame('Every-Corner'), 'selective CI');
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

test('freecell: scoring HUD, seeded deal, daily, stats, hint, redeal', async ({ page, isMobile }) => {
  test.skip(!includesGame('FreeCell'), 'selective CI');
  // Keep headroom on busy CI shards (par rating + mode toggles).
  test.setTimeout(90_000);
  await page.goto('./Games/FreeCell/');
  await expect(page.getByRole('heading', { name: '空當接龍', exact: true })).toBeVisible();
  await expect(page.getByText(/分數\s+\d+/)).toBeVisible();

  await page.locator('#freecell-seed').fill('11982');
  await activate(page.getByRole('button', { name: '發此局', exact: true }), isMobile);
  await expect(page.locator('#freecell-seed')).toHaveValue('11982');

  await activate(page.getByRole('button', { name: '提示' }), isMobile);
  // Hint paints a sky ring on the suggested source/dest; redeal must clear it.
  await activate(page.getByRole('button', { name: '重新發同局' }), isMobile);
  await expect(page.locator('#freecell-seed')).toHaveValue('11982');

  await activate(page.locator('#freecell-daily'), isMobile);
  await expect(page.getByText(/今日挑戰/)).toBeVisible();
  await expect(page.locator('#freecell-seed')).toBeDisabled();
  await expect(page.locator('#freecell-seed')).not.toHaveValue('', { timeout: 20_000 });

  await activate(page.getByRole('button', { name: '戰績' }), isMobile);
  const stats = page.getByRole('dialog', { name: /戰績/ });
  await expect(stats).toBeVisible();
  await activate(stats.getByRole('button', { name: '關閉戰績' }), isMobile);
  await expect(stats).toHaveCount(0);

  // Leave daily before 2-cell / new-game so seed input is editable and deals stay light.
  await activate(page.locator('#freecell-daily'), isMobile);
  await expect(page.locator('#freecell-seed')).toBeEnabled({ timeout: 20_000 });

  await activate(page.getByRole('button', { name: '2 格', exact: true }), isMobile);
  await expect(page.getByText(/悔棋/)).toBeVisible();

  await activate(page.getByRole('button', { name: '新遊戲' }), isMobile);
  await expect(page.locator('#freecell-seed')).not.toHaveValue('', { timeout: 20_000 });
  await expect(page.getByRole('button', { name: '提示' })).toBeEnabled();
});

test('klondike: scoring modes, seeded deal, daily toggle, hint, redeal', async ({ page, isMobile }) => {
  test.skip(!includesGame('Klondike'), 'selective CI');
  await page.goto('./Games/Klondike/');
  await expect(page.getByRole('heading', { name: '接龍', exact: true })).toBeVisible();

  await activate(page.getByRole('button', { name: '維加斯', exact: true }), isMobile);
  await expect(page.getByText(/維加斯\s+-52/)).toBeVisible();

  await activate(page.getByRole('button', { name: '標準', exact: true }), isMobile);
  await page.locator('#klondike-seed').fill('11982');
  await activate(page.getByRole('button', { name: '發此局', exact: true }), isMobile);
  await expect(page.locator('#klondike-seed')).toHaveValue('11982');

  await activate(page.getByRole('button', { name: '提示' }), isMobile);
  await activate(page.getByRole('button', { name: '重新發同局', exact: true }), isMobile);
  await expect(page.locator('#klondike-seed')).toHaveValue('11982');

  await activate(page.locator('#klondike-daily'), isMobile);
  await expect(page.getByText(/今日挑戰/)).toBeVisible();
  await expect(page.locator('#klondike-seed')).toBeDisabled();

  // Seed today's best + keep daily mode on across reload (do not re-toggle 每日).
  await page.evaluate(() => {
    const today = (() => {
      const shifted = new Date(Date.now() + 8 * 60 * 60_000);
      const y = shifted.getUTCFullYear();
      const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
      const d = String(shifted.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    })();
    localStorage.setItem(
      'clubhouse:klondike:daily',
      JSON.stringify([
        {
          date: today,
          won: true,
          score: 320,
          elapsedSec: 180,
          moves: 90,
          drawCount: 1,
          scoreMode: 'standard',
        },
      ]),
    );
    localStorage.setItem(
      'clubhouse:klondike:settings:v1',
      JSON.stringify({
        drawCount: 1,
        scoreMode: 'standard',
        solvableOnly: true,
        playDaily: true,
      }),
    );
  });
  await page.reload();
  await expect(page.getByText(/今日挑戰/)).toBeVisible();
  await expect(page.locator('#klondike-share')).toBeVisible();

  await activate(page.getByRole('button', { name: '戰績' }), isMobile);
  const stats = page.getByRole('dialog', { name: /戰績/ });
  await expect(stats).toBeVisible();
  await expect(stats.getByText(/今日挑戰/)).toBeVisible();
  await expect(stats.getByRole('button', { name: /複製分享結果/ })).toBeVisible();
  await activate(stats.getByRole('button', { name: '關閉戰績' }), isMobile);
  await expect(stats).toHaveCount(0);

  await activate(page.getByRole('button', { name: '新局' }), isMobile);
  await expect(page.getByRole('button', { name: '提示' })).toBeEnabled();
});

test('reversi: two-player completes a round through the result overlay', async ({ page, isMobile }) => {
  test.skip(!includesGame('Reversi'), 'selective CI');
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
  test.skip(!includesGame('Clockwork-Keep'), 'selective CI');
  // Undefended harsh lose is ~50s of rAF time once waves keep advancing.
  test.setTimeout(120_000);
  // Skip the soft first-run guide so lobby「開始遊戲」is the only dialog CTA match.
  await page.addInitScript(() => {
    localStorage.setItem('clockwork-keep:howto-seen', '1');
  });
  await page.goto('./Games/Clockwork-Keep/');
  await activate(page.getByRole('button', { name: '嚴苛', exact: true }), isMobile);
  await activate(page.getByRole('button', { name: '開始遊戲', exact: true }), isMobile);

  // Prep: select the cheapest tower and click the canvas to place, then undo.
  // Palette is grid-cols-3 / sm:grid-cols-6 (six towers); target by tower name.
  const tower = page.getByRole('button', { name: /發條弩台/ }).first();
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

test('clockwork-keep: map unlocks, branch panel, and mission pack size', async ({ page, isMobile }) => {
  test.skip(!includesGame('Clockwork-Keep'), 'selective CI');
  test.setTimeout(60_000);
  await page.addInitScript(() => {
    localStorage.setItem('clockwork-keep:howto-seen', '1');
    // Seed enough clears to unlock fork/islands free-play and branch B.
    localStorage.setItem(
      'clockwork-keep:missions-v1',
      JSON.stringify({
        clearedCount: 2,
        cleared: { 'corridor-standard': true, 'corridor-harsh': true },
        bestScore: {},
        bestWave: {},
      }),
    );
  });
  await page.goto('./Games/Clockwork-Keep/');
  await expect(page.getByRole('heading', { name: '發條守城' })).toBeVisible();
  await expect(page.getByRole('button', { name: '分岔', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: '群島', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: /雙口/ })).toBeDisabled();
  await expect(page.getByRole('button', { name: /隘道/ })).toBeDisabled();
  await activate(page.getByRole('button', { name: '分岔', exact: true }), isMobile);
  await expect(page.getByRole('button', { name: '分岔', exact: true })).toHaveClass(/border-amber-400/);
  // Accessible name comes from aria-label「開啟任務包。…」, not the visible label.
  await activate(page.getByRole('button', { name: /開啟任務包.*2\/10/ }), isMobile);
  await expect(page.getByRole('dialog', { name: /任務包/ })).toBeVisible();
  await expect(page.getByText('07・分岔試煉')).toBeVisible();
  await expect(page.getByText('08・群島嚴苛')).toBeVisible();
  await expect(page.getByText('09・雙口夾擊')).toBeVisible();
  await expect(page.getByText('10・隘道重錘')).toBeVisible();
  await activate(page.getByRole('button', { name: '關閉任務包' }), isMobile);

  // Branch UI on open map so the click cell is never a rock.
  await activate(page.getByRole('button', { name: '開闊', exact: true }), isMobile);
  await activate(page.getByRole('button', { name: '開始遊戲', exact: true }), isMobile);
  const tower = page.getByRole('button', { name: /發條弩台/ }).first();
  await activate(tower, isMobile);
  const canvas = page.locator('canvas').first();
  const box = await canvas.boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.click(box.x + box.width * 0.35, box.y + box.height * 0.45);
  // Select placed tower → shared upgrade → exclusive branch chooser.
  await page.mouse.click(box.x + box.width * 0.35, box.y + box.height * 0.45);
  await activate(page.getByRole('button', { name: /基礎升級/ }), isMobile);
  await page.mouse.click(box.x + box.width * 0.35, box.y + box.height * 0.45);
  await expect(page.getByRole('button', { name: /穿甲釘/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /連射弦/ })).toBeVisible();
  await activate(page.getByRole('button', { name: /穿甲釘/ }), isMobile);
  await expect(page.getByText(/穿甲釘/)).toBeVisible();
});

test('mystery-liquid-sort: howto seeded, mix challenge and hint on home/game', async ({ page, isMobile }) => {
  test.skip(!includesGame('Mystery-Liquid-Sort'), 'selective CI');
  test.setTimeout(45_000);
  // Seed howto so「知道了」cannot collide with other CTAs under strict mode.
  await page.addInitScript(() => {
    localStorage.setItem('mls-howto-seen', '1');
    localStorage.setItem('mls-mix-intro-seen', '1');
  });
  await page.goto('./Games/Mystery-Liquid-Sort/');
  await expect(page.getByRole('heading', { name: '神秘液體排序' })).toBeVisible();
  await expect(page.getByRole('button', { name: '混合墨水挑戰' })).toBeVisible();
  await activate(page.getByRole('button', { name: '混合墨水挑戰' }), isMobile);
  await expect(page.getByRole('dialog', { name: '混合墨水挑戰' })).toBeVisible();
  await activate(page.getByRole('button', { name: '開始第一關' }), isMobile);
  await expect(page.getByText('混色配方')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: '提示' })).toBeVisible();
});

test('instant-flash: menu modes, ladder unlock, and practice HUD', async ({ page, isMobile }) => {
  test.skip(!includesGame('Instant-Flash'), 'selective CI');
  test.setTimeout(45_000);
  await page.goto('./Games/Instant-Flash/');
  await expect(page.getByRole('heading', { name: '剎那一閃' })).toBeVisible();
  await expect(page.getByRole('button', { name: '對決階梯' })).toBeVisible();
  await expect(page.getByRole('button', { name: /每日對決/ })).toBeVisible();
  await expect(page.getByRole('button', { name: '雙人拔刀' })).toBeVisible();

  await activate(page.getByRole('button', { name: '對決階梯' }), isMobile);
  await expect(page.getByText('見習浪人')).toBeVisible();
  await expect(page.getByRole('button', { name: '挑戰' }).first()).toBeEnabled();
  await expect(page.getByRole('button', { name: '鎖定' }).first()).toBeVisible();
  await activate(page.getByRole('button', { name: '挑戰' }).first(), isMobile);
  await expect(page.getByText(/對決 · 見習浪人/)).toBeVisible();
  await expect(page.getByLabel('左斬')).toBeVisible();
  await expect(page.getByLabel('右斬')).toBeVisible();

  // Return via ending is hard mid-fight; reload menu for practice smoke.
  await page.goto('./Games/Instant-Flash/');
  await activate(page.getByRole('button', { name: '練習設定' }), isMobile);
  await activate(page.getByRole('button', { name: '飛刀特訓' }), isMobile);
  await activate(page.getByRole('button', { name: '開始練習' }), isMobile);
  await expect(page.getByText(/練習 ·/)).toBeVisible();
  await expect(page.getByRole('button', { name: '結束練習' })).toBeVisible();
  await activate(page.getByRole('button', { name: '結束練習' }), isMobile);
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-label', '練習結束');
  await activate(dialog.getByRole('button', { name: '主選單' }), isMobile);
  await expect(page.getByRole('heading', { name: '剎那一閃' })).toBeVisible();
});

test('instant-flash: versus mode mounts split controls', async ({ page, isMobile }) => {
  test.skip(!includesGame('Instant-Flash'), 'selective CI');
  await page.goto('./Games/Instant-Flash/');
  await activate(page.getByRole('button', { name: '雙人拔刀' }), isMobile);
  await expect(page.getByText('雙人拔刀')).toBeVisible();
  await expect(page.getByLabel('玩家一待機／出刀')).toBeVisible();
  await expect(page.getByLabel('玩家二待機／出刀')).toBeVisible();
  await expect(page.getByRole('button', { name: '結束對戰' })).toBeVisible();
});

test('puyo-puyo: modes, mission ladder, tutorial panel, and nightmare difficulty', async ({ page, isMobile }) => {
  test.skip(!includesGame('Puyo-Puyo'), 'selective CI');
  test.setTimeout(45_000);
  await page.goto('./Games/Puyo-Puyo/');
  await expect(page.getByRole('heading', { name: /魔法氣泡/ })).toBeVisible();
  await expect(page.locator('#career-stats')).toBeVisible();

  const mode = page.locator('#match-mode');
  await expect(mode).toBeVisible();
  await mode.selectOption('mission');
  await expect(page.locator('#quest-panel')).toBeVisible();
  await expect(page.getByRole('heading', { name: /任務/ })).toBeVisible();
  await expect(page.locator('#mission-select')).toBeVisible();
  // Ladder has ≥20 quests (pack 1 + pack 2; later ones locked until earlier clears).
  await expect(page.locator('#mission-select option')).toHaveCount(22);
  await expect(page.locator('#career-stats')).toContainText(/任務\s*0\/22/);
  await expect(page.locator('#player-card-p2')).toBeHidden({ timeout: 5_000 });
  await expect(page.locator('#player-card-p2')).toHaveAttribute('hidden', '');
  await expect(page.getByRole('button', { name: '顯示落點提示', exact: true })).toBeVisible();
  await activate(page.getByRole('button', { name: '顯示落點提示', exact: true }), isMobile);
  await expect(page.locator('#p1-status')).toContainText('提示');

  await mode.selectOption('tutorial');
  await expect(page.locator('#quest-panel')).toBeVisible();
  // Stage 1 is「消除入門」; later stages keep「…教室」in the title.
  await expect(page.getByRole('heading', { name: /消除入門|教室/ })).toBeVisible();
  await expect(page.getByRole('button', { name: '下一課', exact: true })).toBeVisible();
  await expect(page.locator('#p1-status')).toContainText('提示');

  await mode.selectOption('practice');
  await expect(page.locator('#quest-panel')).toBeHidden();
  await expect(page.locator('#mode-badge')).toContainText('自由練習');

  await mode.selectOption('cpu');
  await expect(page.locator('#difficulty-field')).toBeVisible();
  await page.locator('#cpu-difficulty').selectOption('nightmare');
  await expect(page.locator('#mode-badge')).toContainText('CPU');
  await expect(page.locator('#match-status')).toContainText('惡夢');
  await expect(page.locator('#match-status')).toContainText(/4\s*手前瞻|分帧/);
});

test('puyo-puyo: daily puzzle share + board theme unlock UI', async ({ page, isMobile }) => {
  test.skip(!includesGame('Puyo-Puyo'), 'selective CI');
  test.setTimeout(45_000);
  await page.goto('./Games/Puyo-Puyo/');
  const mode = page.locator('#match-mode');
  await mode.selectOption('daily');
  await expect(page.locator('#mode-badge')).toContainText('每日');
  await expect(page.locator('#quest-panel')).toBeVisible();
  await expect(page.locator('#daily-meta')).toBeVisible();
  await expect(page.locator('#daily-meta')).toContainText(/台北|連勝/);
  await expect(page.getByRole('button', { name: '複製分享', exact: true })).toBeVisible();
  await activate(page.getByRole('button', { name: '複製分享', exact: true }), isMobile);
  await expect(page.locator('#board-theme')).toBeVisible();
  await expect(page.locator('#board-theme option')).toHaveCount(4);
  await expect(page.locator('#board-theme option[value="classic"]')).toBeEnabled();
  await expect(page.locator('#board-theme option[value="sunset"]')).toBeDisabled();
  await expect(page.locator('#career-stats')).toContainText(/每日連勝/);
});

test('puyo-puyo: mission hint drop clears first quest overlay', async ({ page, isMobile }) => {
  test.skip(!includesGame('Puyo-Puyo'), 'selective CI');
  test.setTimeout(60_000);
  await page.goto('./Games/Puyo-Puyo/');
  await page.locator('#match-mode').selectOption('mission');
  await expect(page.locator('#quest-panel')).toBeVisible();
  // First mission is a one-move 2-chain; hard-drop the preloaded pair after aligning via hint.
  await activate(page.getByRole('button', { name: '顯示落點提示', exact: true }), isMobile);
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  // Hint for m1 is col 2 rot 0 — spawn is already col 2; hard drop.
  await page.keyboard.press(' ');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await expect(dialog).toHaveCSS('position', 'fixed');
  await expect(page.locator('#result-title')).toContainText(/成功|再試/);
  await activate(dialog.getByRole('button', { name: '再玩一局', exact: true }), isMobile);
  await expect(dialog).toHaveCount(0);
});

test('danmaku-abyss: craft picker, mode pack, capture gallery, dive HUD', async ({ page, isMobile }) => {
  test.skip(!includesGame('Danmaku-Abyss'), 'selective CI');
  test.setTimeout(60_000);
  await page.goto('./Games/Danmaku-Abyss/');
  await expect(page.getByRole('heading', { name: '彈幕深淵', exact: true })).toBeVisible();

  // Dismiss first-run guide if present so title CTAs stay clickable.
  const howto = page.getByRole('dialog').filter({ hasText: '上手' });
  if (await howto.count()) {
    await activate(howto.getByRole('button', { name: '知道了' }), isMobile);
    await expect(howto).toHaveCount(0);
  }

  const craftBtn = page.getByRole('button', { name: /選擇機體/ });
  await expect(craftBtn).toBeVisible();
  await activate(craftBtn, isMobile);
  const crafts = page.getByRole('dialog', { name: /選擇機體/ });
  await expect(crafts).toBeVisible();
  await expect(crafts.getByText('迅羽')).toBeVisible();
  await expect(crafts.getByText('重炮')).toBeVisible();
  await expect(crafts.getByText('縫影')).toBeVisible();
  await activate(crafts.getByRole('button', { name: '關閉機體選擇' }), isMobile);
  await expect(crafts).toHaveCount(0);

  await activate(page.getByRole('button', { name: '符卡圖鑑' }), isMobile);
  const gallery = page.getByRole('dialog', { name: /符卡圖鑑/ });
  await expect(gallery).toBeVisible();
  await activate(gallery.getByRole('button', { name: '關閉符卡圖鑑' }), isMobile);
  await expect(gallery).toHaveCount(0);

  const modesBtn = page.getByRole('button', { name: /模式.*關卡包/ });
  await expect(modesBtn).toBeVisible();
  await activate(modesBtn, isMobile);
  const modes = page.getByRole('dialog', { name: /模式.*關卡包/ });
  await expect(modes).toBeVisible();
  await expect(modes.getByText('燈守演習')).toBeVisible();
  await expect(modes.getByText('雙弦')).toBeVisible();
  await expect(modes.getByText('裂壁')).toBeVisible();
  await activate(modes.getByRole('button', { name: '關閉模式關卡包' }), isMobile);
  await expect(modes).toHaveCount(0);

  await activate(page.getByRole('button', { name: '潛入深淵' }), isMobile);
  await expect(page.getByLabel('彈幕戰場')).toBeVisible();
  await expect(page.getByText(/機體/)).toBeVisible();
  await expect(page.getByRole('button', { name: /靈擊/ })).toBeVisible();
});

test('roguelike-snake: builds, Ironsnake warning, daily streak, and run HUD', async ({
  page,
  isMobile,
}) => {
  test.skip(!includesGame('Roguelike-Snake'), 'selective CI');
  await page.goto('./Games/Roguelike-Snake/');
  await expect(page.getByRole('heading', { name: '蛇窟迴廊' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '起始身分' })).toBeVisible();
  await expect(page.getByRole('button', { name: /青鱗幼蛇/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /未解鎖/ }).first()).toBeDisabled();
  await expect(page.getByRole('heading', { name: '每日挑戰' })).toBeVisible();
  await expect(page.getByText(/連勝\s*\d+/)).toBeVisible();
  await expect(page.getByRole('button', { name: '開始今日挑戰' })).toBeVisible();
  await expect(page.getByRole('button', { name: '複製每日挑戰分享文案' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Ironsnake/ })).toBeVisible();

  await activate(page.getByRole('button', { name: /Ironsnake/ }), isMobile);
  const warn = page.getByRole('dialog', { name: /Ironsnake 硬派模式/ });
  await expect(warn).toBeVisible();
  await expect(warn.getByText(/HP 固定為 1/)).toBeVisible();
  await expect(warn.getByText(/4 選 1/)).toBeVisible();
  await expect(warn.getByText(/加血|回血/)).toBeVisible();
  await activate(warn.getByRole('button', { name: '取消' }), isMobile);
  await expect(warn).toBeHidden();

  await activate(page.getByRole('button', { name: /^成就/ }), isMobile);
  await expect(page.getByRole('dialog', { name: '成就' })).toBeVisible();
  await activate(
    page.getByRole('dialog', { name: '成就' }).getByRole('button', { name: '關閉' }),
    isMobile,
  );

  await activate(page.getByRole('button', { name: '開始探索' }), isMobile);
  await expect(page.getByText('青鱗幼蛇')).toBeVisible();
  await expect(page.getByRole('button', { name: '暫停' })).toBeVisible();
  await expect(page.getByText(/第\s*1\s*層/)).toBeVisible();
  // Touch dash pad is md:hidden; assert it only on the mobile project.
  if (isMobile) {
    await expect(page.getByRole('button', { name: '衝刺' })).toBeVisible();
  }
});
