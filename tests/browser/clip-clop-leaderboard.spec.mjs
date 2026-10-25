import { test, expect } from '@playwright/test';

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

async function openClipClop(page) {
  await page.goto('./Games/Clip-Clop/');
  await expect.poll(async () => page.evaluate(() => !!window.__ready), {
    timeout: 30_000,
  }).toBe(true);
  await expect(page.locator('#resultScreen')).toBeHidden();
}

async function openUploadResult(page, opts = {}) {
  await page.evaluate(() => {
    try {
      localStorage.removeItem('cc_last_upload');
    } catch (_) {
      /* ignore */
    }
  });
  const code = await page.evaluate(async (options) => {
    return window.__openResultForUpload(options);
  }, opts);
  expect(code).toMatch(/^CC[01]\./);
  await expect(page.locator('#resultScreen')).toBeVisible();
  await expect(page.locator('#uploadRow')).toBeVisible();
  await expect(page.locator('#nameRow')).toBeVisible();
  return code;
}

test('clip-clop: name field accepts spaces without restarting', async ({ page }) => {
  test.skip(!includesGame('Clip-Clop'), 'selective CI');
  test.setTimeout(45_000);
  await openClipClop(page);
  await openUploadResult(page, { finishTime: 29.1, falls: 1 });

  const name = page.locator('#nameInput');
  await name.click();
  await name.fill('');
  await name.pressSequentially('Bo Bo', { delay: 40 });

  await expect(name).toHaveValue('Bo Bo');
  // Result card must stay up — Space must not call primaryAction/retry.
  await expect(page.locator('#resultScreen')).toBeVisible();
  await expect.poll(async () => page.evaluate(() => window.__game?.state)).toBe('done');
});

test('clip-clop: online leaderboard submit posts battle code (mocked)', async ({ page }) => {
  test.skip(!includesGame('Clip-Clop'), 'selective CI');
  test.setTimeout(45_000);

  const posts = [];
  await page.route(/\/rest\/v1\/clipclop_scores/, async (route) => {
    const req = route.request();
    if (req.method() === 'POST') {
      posts.push({
        url: req.url(),
        body: req.postDataJSON(),
        headers: req.headers(),
      });
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: '',
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '[]',
    });
  });

  await openClipClop(page);
  const code = await openUploadResult(page, { finishTime: 27.4, falls: 0 });

  const name = page.locator('#nameInput');
  await name.fill('測試馬 A');
  await page.locator('#uploadBtn').click();

  await expect(page.locator('#toast')).toBeVisible();
  await expect(page.locator('#toast')).toContainText(/上傳|Uploaded|uploaded/i);

  await expect.poll(() => posts.length).toBe(1);
  const post = posts[0];
  expect(post.body).toMatchObject({
    name: '測試馬 A',
    time_ms: 27400,
    falls: 0,
    mode: 'normal',
    day: null,
  });
  expect(post.body.code).toBe(code);
  expect(post.body.code).toMatch(/^CC[01]\./);
  expect(post.headers.apikey || post.headers.Apikey).toBeTruthy();
});
