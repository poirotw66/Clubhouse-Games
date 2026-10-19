/**
 * Short Playwright recording: chapter intro → a few turns → rival clutch or story.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const OUT = '/opt/cursor/artifacts';
fs.mkdirSync(OUT, { recursive: true });
const videoDir = path.join(OUT, 'bl-m3-demo-raw');
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
await page.locator('#seed-input').fill('64aa2bl7');
await page.getByRole('button', { name: '開始新的棒球人生' }).click();
await page.waitForTimeout(400);
await page.locator('button', { hasText: '外野手' }).first().click();
await page.locator('#name-input').fill('試玩外野');
await page.getByRole('button', { name: '建立球員並開始遊戲' }).click();
await page.waitForTimeout(800);

// Pause on chapter intro
await page.waitForTimeout(1200);
let sawHighlight = false;

for (let step = 0; step < 80; step++) {
  const body = await page.locator('body').innerText();
  const choices = page.locator('button.bl-choice:visible');
  const n = await choices.count();
  if (n === 0) {
    await page.keyboard.press('1');
    await page.waitForTimeout(120);
    continue;
  }

  const isChapter = body.includes('生涯章節');
  const isStory = body.includes('人際事件');
  const isRival = body.includes('對決・');

  if (isChapter || isStory || isRival) {
    await page.waitForTimeout(900);
  }

  let idx = 0;
  if (body.includes('副課')) {
    for (let i = 0; i < n; i++) {
      const t = await choices.nth(i).innerText();
      if (t.includes('伸展') || t.includes('筆記')) {
        idx = i;
        break;
      }
    }
  } else if (body.includes('主課')) {
    for (let i = 0; i < n; i++) {
      const t = await choices.nth(i).innerText();
      if (t.includes('跑壘') || t.includes('揮棒')) {
        idx = i;
        break;
      }
    }
  } else if (/全國|黑豹/.test(body) && !body.includes('關鍵') && !isRival) {
    for (let i = 0; i < n; i++) {
      const t = await choices.nth(i).innerText();
      if (t.includes('照著配置')) {
        idx = i;
        break;
      }
    }
  } else if (isStory) {
    for (let i = 0; i < n; i++) {
      const t = await choices.nth(i).innerText();
      if (/燃料|聊天|聽完|致意/.test(t)) {
        idx = i;
        break;
      }
    }
  }

  await choices.nth(idx).click();
  await page.waitForTimeout(isChapter || isStory || isRival ? 700 : 100);

  if ((isStory || isRival) && !sawHighlight) {
    sawHighlight = true;
    await page.waitForTimeout(1400);
    break;
  }
}

await context.close();
await browser.close();

const videos = fs.readdirSync(videoDir).filter((f) => f.endsWith('.webm'));
if (videos.length === 0) throw new Error('no video recorded');
const src = path.join(videoDir, videos[0]);
const dest = path.join(OUT, 'bl-m3-chapter-rival-demo.webm');
fs.copyFileSync(src, dest);
console.log(JSON.stringify({ dest, sawHighlight, bytes: fs.statSync(dest).size }, null, 2));
