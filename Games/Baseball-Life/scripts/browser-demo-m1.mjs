/**
 * Short headed recording of dual-slot HS training for walkthrough video.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const OUT = '/opt/cursor/artifacts';
const videoDir = path.join(OUT, 'bl-m1-video-tmp');
fs.mkdirSync(videoDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  recordVideo: { dir: videoDir, size: { width: 1280, height: 800 } },
});
const page = await context.newPage();

await page.goto('http://127.0.0.1:4173/?seed=64aa2bl7', { waitUntil: 'networkidle' });
const guide = page.getByRole('button', { name: '知道了' });
if (await guide.count()) await guide.click();
await page.waitForTimeout(400);
await page.locator('#seed-input').fill('64aa2bl7');
await page.getByRole('button', { name: '開始新的棒球人生' }).click();
await page.waitForTimeout(500);
await page.locator('button', { hasText: '外野手' }).first().click();
await page.locator('#name-input').fill('試玩外野');
await page.getByRole('button', { name: '建立球員並開始遊戲' }).click();
await page.waitForTimeout(800);

// Primary → secondary loops for a few HS turns
for (let turn = 0; turn < 6; turn++) {
  const body = await page.locator('body').innerText();
  if (body.includes('畢業') || body.includes('路徑')) break;
  const choices = page.locator('button.bl-choice:visible');
  const n = await choices.count();
  if (!n) {
    await page.keyboard.press('1');
    await page.waitForTimeout(350);
    continue;
  }
  let idx = 0;
  const text = await page.locator('body').innerText();
  if (text.includes('副課')) {
    for (let i = 0; i < n; i++) {
      const t = await choices.nth(i).innerText();
      if (t.includes('伸展') || t.includes('筆記')) {
        idx = i;
        break;
      }
    }
  } else if (text.includes('主課')) {
    for (let i = 0; i < n; i++) {
      const t = await choices.nth(i).innerText();
      if (t.includes(['跑壘', '揮棒', '守備', '重量'][turn % 4])) {
        idx = i;
        break;
      }
    }
  } else if (/全國|黑豹|夏天/.test(text)) {
    for (let i = 0; i < n; i++) {
      const t = await choices.nth(i).innerText();
      if (t.includes('照著配置')) {
        idx = i;
        break;
      }
    }
  } else if (text.includes('高風險') || text.includes('抉擇')) {
    idx = n - 1;
  }
  await choices.nth(idx).click();
  await page.waitForTimeout(450);
}

await page.waitForTimeout(600);
await context.close();
await browser.close();

const videos = fs.readdirSync(videoDir).filter((f) => f.endsWith('.webm'));
if (videos.length === 0) throw new Error('no video recorded');
const src = path.join(videoDir, videos[0]);
const dest = path.join(OUT, 'bl-m1-dual-slot-demo.webm');
fs.copyFileSync(src, dest);
console.log(JSON.stringify({ video: dest, size: fs.statSync(dest).size }));
