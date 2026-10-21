/**
 * Headless playtest for Pick-Red depth: desktop + mobile screenshots and a short webm.
 * Serves against the already-running localhost:3000 clubhouse server.
 */
import { chromium, devices } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const OUT = '/opt/cursor/artifacts';
const BASE = 'http://localhost:3000/Games/Pick-Red/';

fs.mkdirSync(OUT, { recursive: true });

async function shootDesktop() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1100, height: 900 },
    recordVideo: { dir: OUT, size: { width: 1100, height: 900 } },
    locale: 'zh-TW',
  });
  const page = await context.newPage();

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, 'pick_red_setup_desktop.png'), fullPage: true });

  await page.getByRole('button', { name: /^打到 N 分/ }).click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, 'pick_red_setup_target_desktop.png'), fullPage: true });

  await page.getByRole('button', { name: /^打四圈/ }).click();
  await page.getByRole('button', { name: /困難/ }).click();
  await page.getByPlaceholder('例如 64aa2bl7').fill('pw1');
  await page.getByRole('button', { name: '開始系列賽', exact: true }).click();
  await page.getByRole('region', { name: '系列賽計分板' }).waitFor({ timeout: 10_000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'pick_red_series_table_desktop.png'), fullPage: true });

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /^單局/ }).click();
  await page.getByPlaceholder('例如 64aa2bl7').fill('pw1');
  await page.getByRole('button', { name: '開始單局', exact: true }).click();
  await page.getByRole('region', { name: '你的手牌' }).waitFor({ timeout: 10_000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'pick_red_single_desktop.png'), fullPage: true });

  await page.goto(`${BASE}?demo=mvp`, { waitUntil: 'networkidle' });
  await page.getByRole('dialog', { name: '系列賽結束' }).waitFor({ timeout: 10_000 });
  await page.getByRole('region', { name: 'MVP 統計' }).waitFor({ timeout: 5_000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'pick_red_mvp_desktop.png'), fullPage: true });

  const videoPath = await page.video().path();
  await context.close();
  await browser.close();
  fs.renameSync(videoPath, path.join(OUT, 'pick_red_series_playtest.webm'));
}

async function shootMobile() {
  const browser = await chromium.launch({ headless: true });
  const iPhone = devices['iPhone 13'];
  const context = await browser.newContext({
    ...iPhone,
    locale: 'zh-TW',
  });
  const page = await context.newPage();

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, 'pick_red_setup_mobile.png'), fullPage: true });

  await page.getByRole('button', { name: /^打四圈/ }).click();
  await page.getByPlaceholder('例如 64aa2bl7').fill('pw1');
  await page.getByRole('button', { name: '開始系列賽', exact: true }).click();
  await page.getByRole('region', { name: '系列賽計分板' }).waitFor({ timeout: 10_000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'pick_red_series_table_mobile.png'), fullPage: true });

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /^單局/ }).click();
  await page.getByPlaceholder('例如 64aa2bl7').fill('pw1');
  await page.getByRole('button', { name: '開始單局', exact: true }).click();
  await page.getByRole('region', { name: '你的手牌' }).waitFor({ timeout: 10_000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'pick_red_single_mobile.png'), fullPage: true });

  await page.goto(`${BASE}?demo=mvp`, { waitUntil: 'networkidle' });
  await page.getByRole('dialog', { name: '系列賽結束' }).waitFor({ timeout: 10_000 });
  await page.getByRole('region', { name: 'MVP 統計' }).waitFor({ timeout: 5_000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'pick_red_mvp_mobile.png'), fullPage: true });

  await context.close();
  await browser.close();
}

await shootDesktop();
await shootMobile();
console.log(JSON.stringify({
  ok: true,
  screenshots: [
    'pick_red_setup_desktop.png',
    'pick_red_setup_target_desktop.png',
    'pick_red_series_table_desktop.png',
    'pick_red_single_desktop.png',
    'pick_red_mvp_desktop.png',
    'pick_red_setup_mobile.png',
    'pick_red_series_table_mobile.png',
    'pick_red_single_mobile.png',
    'pick_red_mvp_mobile.png',
  ],
  video: 'pick_red_series_playtest.webm',
}, null, 2));
