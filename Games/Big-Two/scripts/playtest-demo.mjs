/**
 * Headless playtest for Big-Two depth: desktop + mobile screenshots and a short video.
 * Expects `npm run dev` already serving http://localhost:3000/
 */
import { chromium, devices } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const OUT = '/opt/cursor/artifacts';
const BASE = 'http://localhost:3000/';

fs.mkdirSync(OUT, { recursive: true });

function toMp4(webmPath, mp4Path) {
  const result = spawnSync(
    'ffmpeg',
    ['-y', '-i', webmPath, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-an', mp4Path],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
    throw new Error('ffmpeg webm→mp4 failed');
  }
}

async function shootDesktop() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
  });
  const context = await browser.newContext({
    viewport: { width: 1100, height: 900 },
    recordVideo: { dir: OUT, size: { width: 1100, height: 900 } },
    locale: 'zh-TW',
  });
  const page = await context.newPage();

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  // Dismiss first-run guide if present.
  const guideClose = page.getByRole('button', { name: /開始打牌|知道了|關閉|略過/ });
  if (await guideClose.first().isVisible().catch(() => false)) {
    await guideClose.first().click();
    await page.waitForTimeout(200);
  }
  await page.screenshot({ path: path.join(OUT, 'b2-setup-desktop.png'), fullPage: true });

  await page.getByRole('tab', { name: '對手梯' }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'b2-ladder-desktop.png'), fullPage: true });

  await page.getByRole('tab', { name: '開打' }).click();
  await page.getByRole('button', { name: /^單局/ }).click();
  await page.getByPlaceholder('例如 64aa2bl7').fill('pw1');
  await page.getByRole('button', { name: '開始單局', exact: true }).click();
  await page.getByRole('region', { name: '你的手牌' }).waitFor({ timeout: 10_000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, 'b2-single-table-desktop.png'), fullPage: true });

  await page.goto(`${BASE}?demo=mvp`, { waitUntil: 'networkidle' });
  await page.getByRole('dialog', { name: '系列賽結束' }).waitFor({ timeout: 10_000 });
  await page.getByRole('region', { name: 'MVP 統計' }).waitFor({ timeout: 5_000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, 'b2-mvp-desktop.png'), fullPage: true });

  const videoPath = await page.video().path();
  await context.close();
  await browser.close();
  const webm = path.join(OUT, 'b2-demo-raw.webm');
  fs.renameSync(videoPath, webm);
  toMp4(webm, path.join(OUT, 'b2-demo.mp4'));
  try {
    fs.unlinkSync(webm);
  } catch {
    /* ignore */
  }
}

async function shootMobile() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
  });
  const iPhone = devices['iPhone 13'];
  const context = await browser.newContext({
    ...iPhone,
    locale: 'zh-TW',
  });
  const page = await context.newPage();

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const guideClose = page.getByRole('button', { name: /開始打牌|知道了|關閉|略過/ });
  if (await guideClose.first().isVisible().catch(() => false)) {
    await guideClose.first().click();
    await page.waitForTimeout(200);
  }
  await page.screenshot({ path: path.join(OUT, 'b2-setup-mobile.png'), fullPage: true });

  await page.getByRole('tab', { name: '對手梯' }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'b2-ladder-mobile.png'), fullPage: true });

  await context.close();
  await browser.close();
}

await shootDesktop();
await shootMobile();
console.log(
  JSON.stringify(
    {
      ok: true,
      artifacts: fs.readdirSync(OUT).filter((f) => f.startsWith('b2-')),
    },
    null,
    2,
  ),
);
