/**
 * Headless capture of mid-fight + boss visuals for walkthrough artifacts.
 * Uses the game's own createRun/step via page evaluation where possible,
 * and UI clicks for mode practice.
 */
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const OUT = '/opt/cursor/artifacts';
const BASE = process.env.DANMAKU_URL || 'http://localhost:3000';
fs.mkdirSync(OUT, { recursive: true });

async function dismissHowto(page) {
  const howto = page.getByRole('button', { name: /知道了|開始|關閉|OK/i }).first();
  if (await howto.isVisible({ timeout: 1500 }).catch(() => false)) {
    await howto.click();
  }
  // Also try clicking outside / any primary dismiss.
  const seen = page.locator('text=知道了');
  if (await seen.isVisible({ timeout: 800 }).catch(() => false)) {
    await seen.click();
  }
}

async function waitDenseField(page, minBullets = 40, timeoutMs = 20000) {
  await page.waitForFunction(
    (min) => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return false;
      // Heuristic: HUD shows stage and canvas is painting; also peek React state via window hook if present.
      const w = window;
      if (w.__DA_STATE && Array.isArray(w.__DA_STATE.bullets)) {
        return w.__DA_STATE.bullets.length >= min;
      }
      return true;
    },
    minBullets,
    { timeout: timeoutMs },
  );
  // Always wait a bit so patterns bloom on screen.
  await page.waitForTimeout(2800);
}

async function captureViewport(browser, name, size, run) {
  const context = await browser.newContext({
    viewport: size,
    deviceScaleFactor: 1,
    recordVideo: name.includes('video')
      ? { dir: OUT, size }
      : undefined,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(25000);
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await dismissHowto(page);
  await run(page);
  await context.close();
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  // Desktop mid-fight.
  await captureViewport(browser, 'desktop-mid', { width: 1280, height: 800 }, async (page) => {
    await page.getByRole('button', { name: /潛入深淵/ }).click();
    await dismissHowto(page);
    await page.waitForSelector('canvas', { timeout: 10000 });
    // Let curtains bloom — several midways + stacked rings.
    await page.waitForTimeout(12000);
    await page.screenshot({ path: path.join(OUT, 'desktop-1280x800-midfight.png'), fullPage: false });
  });

  // Desktop boss via 燈守演習.
  await captureViewport(browser, 'desktop-boss', { width: 1280, height: 800 }, async (page) => {
    const modesBtn = page.getByRole('button', { name: /模式|關卡/ }).first();
    if (await modesBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await modesBtn.click();
    } else {
      // Fallback: click any control mentioning 模式.
      await page.locator('button', { hasText: /模式/ }).first().click({ timeout: 5000 });
    }
    await page.waitForTimeout(400);
    const practice = page.getByText(/燈守演習/).first();
    await practice.click();
    // Some UIs need a confirm / start.
    const start = page.getByRole('button', { name: /開始|潛入|挑戰|進入/ }).first();
    if (await start.isVisible({ timeout: 2000 }).catch(() => false)) {
      await start.click();
    }
    await dismissHowto(page);
    await page.waitForSelector('canvas', { timeout: 10000 });
    await page.waitForTimeout(5500);
    await page.screenshot({ path: path.join(OUT, 'desktop-1280x800-boss.png'), fullPage: false });
  });

  // Mobile mid-fight.
  await captureViewport(browser, 'mobile-mid', { width: 390, height: 844 }, async (page) => {
    await page.getByRole('button', { name: /潛入深淵/ }).click();
    await dismissHowto(page);
    await page.waitForSelector('canvas', { timeout: 10000 });
    await page.waitForTimeout(4500);
    await page.screenshot({ path: path.join(OUT, 'mobile-390x844-midfight.png'), fullPage: false });
  });

  // Mobile boss.
  await captureViewport(browser, 'mobile-boss', { width: 390, height: 844 }, async (page) => {
    const modesBtn = page.locator('button', { hasText: /模式/ }).first();
    await modesBtn.click({ timeout: 8000 });
    await page.waitForTimeout(400);
    await page.getByText(/燈守演習/).first().click();
    const start = page.getByRole('button', { name: /開始|潛入|挑戰|進入/ }).first();
    if (await start.isVisible({ timeout: 2000 }).catch(() => false)) {
      await start.click();
    }
    await dismissHowto(page);
    await page.waitForSelector('canvas', { timeout: 10000 });
    await page.waitForTimeout(5500);
    await page.screenshot({ path: path.join(OUT, 'mobile-390x844-boss.png'), fullPage: false });
  });

  // ~20s gameplay video: mid-fight then boss practice.
  {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      recordVideo: { dir: OUT, size: { width: 1280, height: 800 } },
    });
    const page = await context.newPage();
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await dismissHowto(page);
    await page.getByRole('button', { name: /潛入深淵/ }).click();
    await dismissHowto(page);
    await page.waitForSelector('canvas');
    // Weave a bit so the video shows motion through curtains.
    for (let i = 0; i < 18; i++) {
      await page.keyboard.down(i % 2 === 0 ? 'ArrowLeft' : 'ArrowRight');
      await page.waitForTimeout(200);
      await page.keyboard.up(i % 2 === 0 ? 'ArrowLeft' : 'ArrowRight');
      await page.keyboard.down('Shift');
      await page.waitForTimeout(250);
      await page.keyboard.up('Shift');
      await page.waitForTimeout(200);
    }
    await page.getByRole('button', { name: /返回總覽/ }).click().catch(() => {});
    await page.waitForTimeout(600);
    const modesBtn = page.locator('button', { hasText: /模式/ }).first();
    if (await modesBtn.isVisible().catch(() => false)) {
      await modesBtn.click();
      await page.getByText(/燈守演習/).first().click();
      const start = page.getByRole('button', { name: /開始|潛入|挑戰|進入/ }).first();
      if (await start.isVisible({ timeout: 1500 }).catch(() => false)) await start.click();
      await page.waitForSelector('canvas');
      for (let i = 0; i < 16; i++) {
        await page.keyboard.down(i % 3 === 0 ? 'ArrowLeft' : i % 3 === 1 ? 'ArrowRight' : 'ArrowUp');
        await page.waitForTimeout(180);
        await page.keyboard.up(i % 3 === 0 ? 'ArrowLeft' : i % 3 === 1 ? 'ArrowRight' : 'ArrowUp');
        await page.waitForTimeout(220);
      }
    }
    await page.waitForTimeout(800);
    const video = page.video();
    await context.close();
    if (video) {
      const vpath = await video.path();
      const dest = path.join(OUT, 'gameplay-dense-fight-boss.webm');
      fs.renameSync(vpath, dest);
      console.log('video', dest);
    }
  }

  await browser.close();
  console.log('artifacts written to', OUT);
  console.log(fs.readdirSync(OUT).filter((f) => /\.(png|webm|jpg)$/.test(f)).join('\n'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
