/**
 * Headless playtest for Pick-Red depth: screenshots + short webm/mp4-ish video.
 * Serves against the already-running localhost:3000 clubhouse server.
 */
import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const OUT = '/opt/cursor/artifacts';
const BASE = 'http://localhost:3000/Games/Pick-Red/';

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1100, height: 900 },
  recordVideo: { dir: OUT, size: { width: 1100, height: 900 } },
  locale: 'zh-TW',
});
const page = await context.newPage();

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(OUT, 'pick_red_setup.png'), fullPage: true });

await page.getByRole('button', { name: /困難/ }).click();
await page.getByPlaceholder('例如 64aa2bl7').fill('pw1');
await page.getByRole('button', { name: '開始系列賽', exact: true }).click();

await page.getByRole('region', { name: '系列賽計分板' }).waitFor({ timeout: 10_000 });
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(OUT, 'pick_red_match_table.png'), fullPage: true });

const hand = page.getByRole('region', { name: '你的手牌' });
const queen = hand.getByRole('button', { name: '紅♦Q，10 分', exact: true });
await queen.waitFor({ timeout: 5_000 });
await queen.click();
await page.waitForTimeout(200);
await queen.click();
await page.waitForTimeout(900);

await page.getByRole('button', { name: '提示', exact: true }).click({ timeout: 15_000 }).catch(async () => {
  // May still be in flip/CPU — wait for human turn.
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: '提示', exact: true }).click();
});
await page.waitForTimeout(600);
await page.screenshot({ path: path.join(OUT, 'pick_red_hint_after_capture.png'), fullPage: true });

const undo = page.getByRole('button', { name: '復原', exact: true });
if (await undo.isEnabled()) {
  await undo.click();
  await page.waitForTimeout(400);
}

await page.screenshot({ path: path.join(OUT, 'pick_red_after_undo.png'), fullPage: true });

const videoPath = await page.video().path();
await context.close();
await browser.close();

const dest = path.join(OUT, 'pick_red_series_playtest.webm');
fs.renameSync(videoPath, dest);
console.log(JSON.stringify({ ok: true, screenshots: [
  'pick_red_setup.png',
  'pick_red_match_table.png',
  'pick_red_hint_after_capture.png',
  'pick_red_after_undo.png',
], video: dest }, null, 2));
