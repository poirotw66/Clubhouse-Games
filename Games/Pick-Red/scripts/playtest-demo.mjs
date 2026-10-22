/**
 * Headless playtest for Pick-Red depth: desktop + mobile screenshots and a short mp4.
 * Artifact filenames use the `pr-` prefix. Serves against localhost:3000.
 */
import { chromium, devices } from '@playwright/test';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const OUT = '/opt/cursor/artifacts';
const BASE = 'http://localhost:3000/Games/Pick-Red/';

fs.mkdirSync(OUT, { recursive: true });

async function toMp4(webmPath, mp4Path) {
  try {
    execFileSync(
      'ffmpeg',
      ['-y', '-i', webmPath, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-an', mp4Path],
      { stdio: 'ignore' },
    );
    return true;
  } catch {
    return false;
  }
}

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
  await page.screenshot({ path: path.join(OUT, 'pr-setup-desktop.png'), fullPage: true });

  await page.getByRole('region', { name: '每日牌桌' }).waitFor();
  await page.screenshot({ path: path.join(OUT, 'pr-daily-desktop.png'), fullPage: true });

  await page.getByRole('tab', { name: '對手梯' }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'pr-ladder-desktop.png'), fullPage: true });

  await page.getByRole('tab', { name: '開打' }).click();
  await page.getByRole('button', { name: /^打到 N 分/ }).click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, 'pr-setup-target-desktop.png'), fullPage: true });

  await page.getByRole('button', { name: /^打四圈/ }).click();
  await page.getByRole('button', { name: /困難/ }).click();
  await page.getByPlaceholder('例如 64aa2bl7').fill('pw1');
  await page.getByRole('button', { name: '開始系列賽', exact: true }).click();
  await page.getByRole('region', { name: '系列賽計分板' }).waitFor({ timeout: 10_000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'pr-series-table-desktop.png'), fullPage: true });

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /^單局/ }).click();
  await page.getByPlaceholder('例如 64aa2bl7').fill('pw1');
  await page.getByRole('button', { name: '開始單局', exact: true }).click();
  await page.getByRole('region', { name: '你的手牌' }).waitFor({ timeout: 10_000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'pr-single-desktop.png'), fullPage: true });

  await page.goto(`${BASE}?demo=mvp`, { waitUntil: 'networkidle' });
  await page.getByRole('dialog', { name: '系列賽結束' }).waitFor({ timeout: 10_000 });
  await page.getByRole('region', { name: 'MVP 統計' }).waitFor({ timeout: 5_000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'pr-mvp-desktop.png'), fullPage: true });

  // Demo clip: open daily → ladder → start first foe.
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: '挑戰今日', exact: true }).click();
  await page.getByRole('region', { name: '你的手牌' }).waitFor({ timeout: 10_000 });
  await page.waitForTimeout(600);
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.getByRole('tab', { name: '對手梯' }).click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /菜鳥阿明/ }).click();
  await page.getByRole('region', { name: '你的手牌' }).waitFor({ timeout: 10_000 });
  await page.waitForTimeout(800);

  const videoPath = await page.video().path();
  await context.close();
  await browser.close();
  const webm = path.join(OUT, 'pr-demo.webm');
  fs.renameSync(videoPath, webm);
  await toMp4(webm, path.join(OUT, 'pr-demo.mp4'));
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
  await page.screenshot({ path: path.join(OUT, 'pr-setup-mobile.png'), fullPage: true });

  await page.getByRole('region', { name: '每日牌桌' }).waitFor();
  await page.screenshot({ path: path.join(OUT, 'pr-daily-mobile.png'), fullPage: true });

  await page.getByRole('tab', { name: '對手梯' }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'pr-ladder-mobile.png'), fullPage: true });

  await page.getByRole('tab', { name: '開打' }).click();
  await page.getByRole('button', { name: /^打四圈/ }).click();
  await page.getByPlaceholder('例如 64aa2bl7').fill('pw1');
  await page.getByRole('button', { name: '開始系列賽', exact: true }).click();
  await page.getByRole('region', { name: '系列賽計分板' }).waitFor({ timeout: 10_000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'pr-series-table-mobile.png'), fullPage: true });

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /^單局/ }).click();
  await page.getByPlaceholder('例如 64aa2bl7').fill('pw1');
  await page.getByRole('button', { name: '開始單局', exact: true }).click();
  await page.getByRole('region', { name: '你的手牌' }).waitFor({ timeout: 10_000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'pr-single-mobile.png'), fullPage: true });

  await page.goto(`${BASE}?demo=mvp`, { waitUntil: 'networkidle' });
  await page.getByRole('dialog', { name: '系列賽結束' }).waitFor({ timeout: 10_000 });
  await page.getByRole('region', { name: 'MVP 統計' }).waitFor({ timeout: 5_000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'pr-mvp-mobile.png'), fullPage: true });

  await context.close();
  await browser.close();
}

await shootDesktop();
await shootMobile();
console.log(JSON.stringify({
  ok: true,
  screenshots: [
    'pr-setup-desktop.png',
    'pr-daily-desktop.png',
    'pr-ladder-desktop.png',
    'pr-setup-target-desktop.png',
    'pr-series-table-desktop.png',
    'pr-single-desktop.png',
    'pr-mvp-desktop.png',
    'pr-setup-mobile.png',
    'pr-daily-mobile.png',
    'pr-ladder-mobile.png',
    'pr-series-table-mobile.png',
    'pr-single-mobile.png',
    'pr-mvp-mobile.png',
  ],
  video: 'pr-demo.mp4',
}, null, 2));
