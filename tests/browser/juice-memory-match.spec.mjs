import { test, expect } from '@playwright/test';

/**
 * Memory-Match-only juice coverage. Kept out of site.spec.mjs to avoid merge
 * conflicts with parallel game juice agents.
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

function activate(locator, isMobile) {
  return isMobile ? locator.tap() : locator.click();
}

async function dismissTipIfPresent(page, isMobile) {
  const tip = page.getByRole('button', { name: '關閉提示', exact: true });
  if (await tip.isVisible().catch(() => false)) {
    await activate(tip, isMobile);
  }
}

async function openEasyBoard(page, isMobile) {
  await page.goto('./Games/Memory-Match/');
  await dismissTipIfPresent(page, isMobile);
  const settings = page.locator('#mm-settings');
  if (!(await settings.isVisible().catch(() => false))) {
    await activate(page.getByRole('button', { name: /設定/ }), isMobile);
  }
  await expect(settings).toBeVisible();
  await activate(page.getByRole('button', { name: '經典', exact: true }), isMobile);
  await activate(page.getByRole('button', { name: /簡單 · 6 對/ }), isMobile);
  await expect(page.locator('[data-mm-grid="1"] .mm-card')).toHaveCount(12);
}

async function waitBoardUnlocked(page) {
  // After a resolve, no unmatched card should stay disabled from locks.
  await expect
    .poll(async () =>
      page.locator('[data-mm-grid="1"] .mm-card:not(.is-matched):disabled').count(),
    )
    .toBe(0);
}

/** Use the in-game hint peek to learn a matching pair, then flip those two cards. */
async function matchViaHint(page, isMobile) {
  await waitBoardUnlocked(page);
  const hintBtn = page.getByRole('button', { name: '提示', exact: true });
  await expect(hintBtn).toBeEnabled();
  await activate(hintBtn, isMobile);

  const peeked = page.locator('[data-mm-grid="1"] .mm-card.is-flipped:not(.is-matched)');
  await expect(peeked).toHaveCount(2, { timeout: 1_500 });
  const idxs = await peeked.evaluateAll((els) => {
    const all = [...els[0].closest('[data-mm-grid="1"]').querySelectorAll('.mm-card')];
    return els.map((el) => all.indexOf(el));
  });

  // Wait for hint peek to end before flipping for real.
  await expect(peeked).toHaveCount(0, { timeout: 2_000 });
  await waitBoardUnlocked(page);

  const cards = page.locator('[data-mm-grid="1"] .mm-card');
  await activate(cards.nth(idxs[0]), isMobile);
  await activate(cards.nth(idxs[1]), isMobile);
  // ScoreFlash (not the HUD "連擊 N" line)
  await expect(page.getByText(/配對 \+|連擊！/)).toBeVisible({ timeout: 2_000 });
  await waitBoardUnlocked(page);
}

/**
 * Flip two face-down cards until a miss. Soft shake is brief (~300ms) and starts
 * when the miss resolves — assert `data-juice-shake` as soon as 「未中」 appears.
 */
async function forceMiss(page, isMobile) {
  for (let attempt = 0; attempt < 8; attempt++) {
    await waitBoardUnlocked(page);
    const down = page.locator(
      '[data-mm-grid="1"] .mm-card:not(.is-matched)[aria-label="背面牌"]',
    );
    const n = await down.count();
    if (n < 2) return false;

    await activate(down.nth(0), isMobile);
    const down2 = page.locator(
      '[data-mm-grid="1"] .mm-card:not(.is-matched)[aria-label="背面牌"]',
    );
    await activate(down2.nth(Math.min(1, (await down2.count()) - 1)), isMobile);

    const flash = page.getByText(/配對 \+|連擊！|未中/);
    await expect(flash).toBeVisible({ timeout: 2_000 });
    const text = (await flash.textContent()) || '';
    if (text.includes('未中')) {
      // Soft shake is ~300ms; the 「未中」 flash can paint after it ends on slow
      // mobile CI. Prefer the MutationObserver latch (wired in the caller) and
      // fall back to a live attribute read.
      await expect
        .poll(
          async () =>
            page.evaluate(
              () =>
                window.__sawGridShake === true ||
                document.querySelector('[data-mm-grid="1"]')?.getAttribute('data-juice-shake') ===
                  '1',
            ),
          { timeout: 2_000 },
        )
        .toBe(true);
      await waitBoardUnlocked(page);
      return true;
    }
    await waitBoardUnlocked(page);
  }
  return false;
}

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
    if (
      request.url().startsWith(new URL(baseURL).origin) &&
      !request.failure()?.errorText.includes('ERR_ABORTED')
    ) {
      errors.push(`${request.failure()?.errorText} ${request.url()}`);
    }
  });
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) =>
    route.fulfill({ body: '', contentType: 'text/css' }),
  );
  page.__runtimeErrors = errors;
});

test.afterEach(async ({ page }) => {
  expect(page.__runtimeErrors || []).toEqual([]);
});

test('memory-match: juice settings in #mm-settings persist under clubhouse:juice', async ({
  page,
  isMobile,
}) => {
  test.skip(!includesGame('Memory-Match'), 'selective CI');
  await page.goto('./Games/Memory-Match/');
  await dismissTipIfPresent(page, isMobile);
  const settings = page.locator('#mm-settings');
  if (!(await settings.isVisible().catch(() => false))) {
    await activate(page.getByRole('button', { name: /設定/ }), isMobile);
  }
  const panel = settings.locator('[data-juice-settings="1"]');
  await expect(panel).toBeVisible();
  await expect(panel.getByLabel('觸覺震動')).toBeVisible();
  await expect(panel.getByRole('group', { name: '特效強度' })).toBeVisible();

  await panel.getByLabel('觸覺震動').uncheck();
  await panel.getByRole('button', { name: '輕量', exact: true }).click();
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('clubhouse:juice') || '{}'),
  );
  expect(stored.haptics).toBe(false);
  expect(stored.fx).toBe('low');
});

test('memory-match: flip tap, match sparkle, miss soft-shake, clear confetti', async ({
  page,
  isMobile,
}) => {
  test.skip(!includesGame('Memory-Match'), 'selective CI');
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    window.__vibrateCalls = [];
    window.__sawGridShake = false;
    navigator.vibrate = (pattern) => {
      window.__vibrateCalls.push(pattern);
      return true;
    };
  });
  await openEasyBoard(page, isMobile);
  await page.evaluate(() => {
    window.__sawGridShake = false;
    const grid = document.querySelector('[data-mm-grid="1"]');
    if (!grid) throw new Error('missing data-mm-grid');
    new MutationObserver(() => {
      if (grid.getAttribute('data-juice-shake') === '1') window.__sawGridShake = true;
    }).observe(grid, { attributes: true, attributeFilter: ['data-juice-shake'] });
  });

  // Flip → tap haptic
  const beforeFlip = await page.evaluate(() => window.__vibrateCalls.length);
  await activate(
    page.locator('[data-mm-grid="1"] .mm-card[aria-label="背面牌"]').first(),
    isMobile,
  );
  await expect
    .poll(async () => page.evaluate(() => window.__vibrateCalls.length))
    .toBeGreaterThan(beforeFlip);

  // Close the lone open card with a second flip (likely a miss), then continue.
  const stillOpen = page.locator('[data-mm-grid="1"] .mm-card.is-flipped:not(.is-matched)');
  if ((await stillOpen.count()) === 1) {
    await activate(
      page.locator('[data-mm-grid="1"] .mm-card:not(.is-matched)[aria-label="背面牌"]').first(),
      isMobile,
    );
    await waitBoardUnlocked(page);
  }

  // Miss → error haptic + soft shake on the grid (asserted inside forceMiss)
  const missed = await forceMiss(page, isMobile);
  expect(missed).toBe(true);
  await expect(page.locator('[data-mm-grid="1"]')).not.toHaveAttribute('data-juice-shake', '1', {
    timeout: 2_000,
  });

  // Match → success/combo + sparkle particles
  const beforeMatch = await page.evaluate(() => window.__vibrateCalls.length);
  await matchViaHint(page, isMobile);
  await expect
    .poll(async () => page.evaluate(() => window.__vibrateCalls.length))
    .toBeGreaterThan(beforeMatch);
  await expect(page.locator('[data-clubhouse-juice="particles"]')).toHaveCount(1);

  // Combo match (second consecutive) → combo haptic + sparkle
  await matchViaHint(page, isMobile);
  await expect(page.getByText(/連擊！/)).toBeVisible();

  // Clear remaining pairs via hint, then confetti + grid shake
  await page.evaluate(() => {
    window.__sawGridShake = false;
  });
  for (let i = 0; i < 8; i++) {
    const left = await page
      .locator('[data-mm-grid="1"] .mm-card:not(.is-matched)[aria-label="背面牌"]')
      .count();
    if (left === 0) break;
    await matchViaHint(page, isMobile);
  }
  await expect(page.locator('[data-mm-grid="1"] .mm-card.is-matched')).toHaveCount(12, {
    timeout: 10_000,
  });
  // Clear-board shake is short; MutationObserver may be the only reliable catch.
  await expect
    .poll(async () => page.evaluate(() => window.__sawGridShake === true))
    .toBe(true);
  await expect(page.locator('[data-clubhouse-juice="particles"]')).toHaveCount(1);
  const vibrateCount = await page.evaluate(() => window.__vibrateCalls.length);
  expect(vibrateCount).toBeGreaterThan(5);
});

test('memory-match: juice respects reduced-motion and haptics off', async ({ page, isMobile }) => {
  test.skip(!includesGame('Memory-Match'), 'selective CI');
  test.setTimeout(60_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    localStorage.setItem('clubhouse:juice', JSON.stringify({ haptics: false, fx: 'full' }));
    window.__vibrateCalls = [];
    navigator.vibrate = (pattern) => {
      window.__vibrateCalls.push(pattern);
      return true;
    };
  });
  await openEasyBoard(page, isMobile);

  const down = page.locator('[data-mm-grid="1"] .mm-card[aria-label="背面牌"]');
  await activate(down.nth(0), isMobile);
  await activate(
    page.locator('[data-mm-grid="1"] .mm-card:not(.is-matched)[aria-label="背面牌"]').first(),
    isMobile,
  );
  await waitBoardUnlocked(page);

  await expect(page.locator('[data-mm-grid="1"]')).not.toHaveAttribute('data-juice-shake', '1');
  const vibrateCount = await page.evaluate(() => window.__vibrateCalls.length);
  expect(vibrateCount).toBe(0);
});
