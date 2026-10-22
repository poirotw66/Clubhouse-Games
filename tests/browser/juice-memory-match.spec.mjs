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

/** Face-down cards use aria-label "背面牌"; revealed/matched use the face id. */
async function faceDownCards(page) {
  return page.locator('[data-mm-grid="1"] .mm-card:not(.is-matched)[aria-label="背面牌"]');
}

async function waitResolve(page) {
  await expect(page.locator('[data-mm-grid="1"] .mm-card:disabled').first())
    .toBeHidden({ timeout: 3_000 })
    .catch(() => {});
  // Resolve timers: match ~480ms, miss ~780ms; give headroom.
  await page.waitForTimeout(900);
}

/**
 * Flip one unmatched pair using known faces after an exploratory reveal.
 * Returns 'match' | 'miss'.
 */
async function flipOnePairAttempt(page, isMobile, memory) {
  const down = await faceDownCards(page);
  const n = await down.count();
  if (n < 2) return 'done';

  // Prefer a known match in memory.
  for (const [face, idxs] of memory) {
    if (idxs.length >= 2) {
      const cards = page.locator('[data-mm-grid="1"] .mm-card');
      const a = cards.nth(idxs[0]);
      const b = cards.nth(idxs[1]);
      if ((await a.getAttribute('aria-label')) === '背面牌' && (await b.getAttribute('aria-label')) === '背面牌') {
        await activate(a, isMobile);
        await activate(b, isMobile);
        memory.delete(face);
        await waitResolve(page);
        return 'match';
      }
    }
  }

  // Flip an unknown card, then try to match from memory or a second unknown.
  const first = down.first();
  const firstIndex = await first.evaluate((el) => {
    const all = [...el.closest('[data-mm-grid="1"]').querySelectorAll('.mm-card')];
    return all.indexOf(el);
  });
  await activate(first, isMobile);
  const face = await page
    .locator('[data-mm-grid="1"] .mm-card')
    .nth(firstIndex)
    .getAttribute('aria-label');
  if (!face || face === '背面牌') throw new Error('flip did not reveal face');

  const known = memory.get(face) || [];
  const partner = known.find((i) => i !== firstIndex);
  if (partner != null) {
    await activate(page.locator('[data-mm-grid="1"] .mm-card').nth(partner), isMobile);
    memory.delete(face);
    await waitResolve(page);
    return 'match';
  }

  // Pick another face-down card that is not firstIndex.
  const remaining = page.locator(
    '[data-mm-grid="1"] .mm-card:not(.is-matched)[aria-label="背面牌"]',
  );
  await expect(remaining.first()).toBeVisible();
  const second = remaining.first();
  const secondIndex = await second.evaluate((el) => {
    const all = [...el.closest('[data-mm-grid="1"]').querySelectorAll('.mm-card')];
    return all.indexOf(el);
  });
  await activate(second, isMobile);
  const face2 = await page
    .locator('[data-mm-grid="1"] .mm-card')
    .nth(secondIndex)
    .getAttribute('aria-label');

  // Record both faces while they are briefly visible / before miss flip-back.
  for (const [f, i] of [
    [face, firstIndex],
    [face2, secondIndex],
  ]) {
    if (!f || f === '背面牌') continue;
    const list = memory.get(f) || [];
    if (!list.includes(i)) list.push(i);
    memory.set(f, list);
  }

  await waitResolve(page);
  const stillMatched = await page
    .locator('[data-mm-grid="1"] .mm-card')
    .nth(firstIndex)
    .evaluate((el) => el.classList.contains('is-matched'));
  if (stillMatched) {
    memory.delete(face);
    return 'match';
  }
  return 'miss';
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
    navigator.vibrate = (pattern) => {
      window.__vibrateCalls.push(pattern);
      return true;
    };
  });
  await openEasyBoard(page, isMobile);

  // Flip → tap haptic
  const beforeFlip = await page.evaluate(() => window.__vibrateCalls.length);
  await activate(
    page.locator('[data-mm-grid="1"] .mm-card[aria-label="背面牌"]').first(),
    isMobile,
  );
  await expect
    .poll(async () => page.evaluate(() => window.__vibrateCalls.length))
    .toBeGreaterThan(beforeFlip);

  // Continue until at least one match and one miss, then clear the board.
  const memory = new Map();
  let sawMatch = false;
  let sawMiss = false;
  for (let i = 0; i < 40; i++) {
    const remaining = await faceDownCards(page);
    if ((await remaining.count()) === 0) break;
    // If first flip left a single card open from the tap check, close it with a second flip.
    const openFace = page.locator(
      '[data-mm-grid="1"] .mm-card.is-flipped:not(.is-matched)',
    );
    if ((await openFace.count()) === 1 && (await remaining.count()) >= 1) {
      await activate(remaining.first(), isMobile);
      await waitResolve(page);
      const matched = await page.locator('[data-mm-grid="1"] .mm-card.is-matched').count();
      if (matched > 0) sawMatch = true;
      else sawMiss = true;
      continue;
    }
    const result = await flipOnePairAttempt(page, isMobile, memory);
    if (result === 'match') sawMatch = true;
    if (result === 'miss') sawMiss = true;
    if (result === 'done') break;
  }

  expect(sawMatch).toBe(true);
  expect(sawMiss).toBe(true);
  await expect(page.locator('[data-clubhouse-juice="particles"]')).toHaveCount(1, {
    timeout: 5_000,
  });

  // Finish clearing if needed.
  for (let i = 0; i < 30; i++) {
    if ((await faceDownCards(page).count()) === 0) break;
    await flipOnePairAttempt(page, isMobile, memory);
  }
  await expect(page.locator('[data-mm-grid="1"] .mm-card.is-matched')).toHaveCount(12, {
    timeout: 15_000,
  });
  await expect(page.locator('[data-mm-grid="1"]')).toHaveAttribute('data-juice-shake', '1', {
    timeout: 3_000,
  });
  const vibrateCount = await page.evaluate(() => window.__vibrateCalls.length);
  expect(vibrateCount).toBeGreaterThan(3);
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
  await activate(down.nth(1), isMobile);
  await waitResolve(page);

  await expect(page.locator('[data-mm-grid="1"]')).not.toHaveAttribute('data-juice-shake', '1');
  const vibrateCount = await page.evaluate(() => window.__vibrateCalls.length);
  expect(vibrateCount).toBe(0);
});
