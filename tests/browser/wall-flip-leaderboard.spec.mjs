import { test, expect } from '@playwright/test';

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

test('wall-flip: 3D online leaderboard fetches from Supabase endpoint (mocked)', async ({ page }) => {
  test.skip(!includesGame('Wall-Flip'), 'selective CI');
  test.setTimeout(45_000);

  const mockBoard = [
    { name: 'StuntAce', score: 4250, rolls: 12, time_sec: 18.25, course: 0, created_at: new Date().toISOString() },
    { name: 'Drifter', score: 3800, rolls: 9, time_sec: 21.10, course: 0, created_at: new Date().toISOString() },
  ];

  let fetchCalled = false;
  await page.route(/\/rest\/v1\/wallflip_scores/, async (route) => {
    const req = route.request();
    if (req.method() === 'GET') {
      fetchCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockBoard),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await page.goto('./Games/Wall-Flip/index-3d.html');
  await expect.poll(async () => page.evaluate(() => !!window.__ready), { timeout: 15_000 }).toBe(true);
  await expect(page.locator('#boardBtn')).toBeVisible();

  // Open the leaderboard overlay
  await page.locator('#boardBtn').click();
  await expect(page.locator('#boardPanel')).toBeVisible();

  // Verify that the mocked board row was rendered
  await expect.poll(() => fetchCalled, { timeout: 10_000 }).toBe(true);
  await expect(page.locator('#boardRows')).toContainText('StuntAce');
  await expect(page.locator('#boardRows')).toContainText('4250');
  await expect(page.locator('#boardRows')).toContainText('Drifter');
});

test('wall-flip: submit score posts to Supabase endpoint (mocked)', async ({ page }) => {
  test.skip(!includesGame('Wall-Flip'), 'selective CI');
  test.setTimeout(45_000);

  const posts = [];
  await page.route(/\/rest\/v1\/wallflip_scores/, async (route) => {
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
        headers: {
          'content-range': '0-0/1',
        },
        body: JSON.stringify([{ id: 1, name: 'ProFlip', score: 4500 }]),
      });
      return;
    }
    if (req.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'content-range': '*/0',
        },
        body: '[]',
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.goto('./Games/Wall-Flip/index-3d.html');
  await expect.poll(async () => page.evaluate(() => !!window.__ready), { timeout: 15_000 }).toBe(true);

  // Trigger submission via helper
  await page.evaluate(() => {
    try {
      localStorage.removeItem('wallflip3.subT');
    } catch (_) {}
    window.__game.score = { total: 4500 };
    window.__sim.state.land = { rolls: 10 };
    window.__submitScore('ProFlip');
  });

  await expect.poll(() => posts.length).toBe(1);
  const post = posts[0];
  expect(post.body).toMatchObject({
    name: 'ProFlip',
    score: 4500,
    rolls: 10,
    course: 0,
  });
  expect(post.headers.apikey || post.headers.Apikey).toBeTruthy();
});

test('wall-flip: 2D submit score posts to Supabase endpoint (mocked)', async ({ page }) => {
  test.skip(!includesGame('Wall-Flip'), 'selective CI');
  test.setTimeout(45_000);

  const posts = [];
  await page.route(/\/rest\/v1\/wallflip_scores/, async (route) => {
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
        headers: {
          'content-range': '0-0/1',
        },
        body: JSON.stringify([{ id: 2, name: 'CanvasAce', score: 3800 }]),
      });
      return;
    }
    if (req.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'content-range': '*/0',
        },
        body: '[]',
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.goto('./Games/Wall-Flip/index.html');
  await expect.poll(async () => page.evaluate(() => !!window.__ready), { timeout: 15_000 }).toBe(true);

  await page.evaluate(() => {
    try {
      localStorage.removeItem('wallflip2.subT');
    } catch (_) {}
    window.__stats.total = 3800;
    window.__stats.rolls = 7;
    window.__stats.time = 22.4;
    window.__submitScore('CanvasAce');
  });

  await expect.poll(() => posts.length).toBe(1);
  const post = posts[0];
  expect(post.body).toMatchObject({
    name: 'CanvasAce',
    score: 3800,
    rolls: 7,
    course: 0,
  });
  expect(post.headers.apikey || post.headers.Apikey).toBeTruthy();
});
