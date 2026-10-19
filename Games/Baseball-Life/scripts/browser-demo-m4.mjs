/**
 * Short demo: encyclopedia panel → create with legacy picker (if present) → chapter.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const OUT = '/opt/cursor/artifacts';
const videoDir = path.join(OUT, 'bl-m4-demo-raw');
fs.mkdirSync(videoDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  recordVideo: { dir: videoDir, size: { width: 1280, height: 900 } },
});
const page = await context.newPage();

await page.goto('http://127.0.0.1:4173/?seed=64aa2bl7', { waitUntil: 'networkidle' });
const guide = page.getByRole('button', { name: '知道了' });
if (await guide.count()) await guide.click();

const enc = page.getByRole('button', { name: /特殊能力圖鑑/ });
if (await enc.count()) {
  await enc.click();
  await page.waitForTimeout(1400);
}

await page.locator('#seed-input').fill('64aa2bl7');
await page.getByRole('button', { name: '開始新的棒球人生' }).click();
await page.waitForTimeout(600);

const body = await page.locator('body').innerText();
if (body.includes('遺產') || body.includes('New Game+')) {
  await page.waitForTimeout(1000);
  const pick = page.locator('button.bl-choice', { hasText: /血脈|家傳|師承/ }).first();
  if (await pick.count()) await pick.click();
  await page.waitForTimeout(400);
}

await page.locator('button', { hasText: '外野手' }).first().click();
await page.locator('#name-input').fill('圖鑑試玩');
await page.getByRole('button', { name: /入部|建立球員/ }).click();
await page.waitForTimeout(1200);

// Chapter intro
const choices = page.locator('button.bl-choice:visible');
if (await choices.count()) {
  await page.waitForTimeout(800);
  await choices.first().click();
  await page.waitForTimeout(900);
}

await context.close();
await browser.close();

const videos = fs.readdirSync(videoDir).filter((f) => f.endsWith('.webm'));
const src = path.join(videoDir, videos[0]);
const destWebm = path.join(OUT, 'bl-m4-encyclopedia-legacy-demo.webm');
fs.copyFileSync(src, destWebm);
if (process.env.SKIP_FFMPEG !== '1') {
  const { execSync } = await import('node:child_process');
  try {
    execSync(
      `ffmpeg -y -i ${destWebm} -c:v libx264 -pix_fmt yuv420p -an ${path.join(OUT, 'bl-m4-encyclopedia-legacy-demo.mp4')}`,
      { stdio: 'pipe' },
    );
  } catch {
    /* optional */
  }
}
console.log('demo written', destWebm);
