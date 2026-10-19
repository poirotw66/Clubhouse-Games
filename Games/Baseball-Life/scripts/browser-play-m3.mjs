/**
 * Playwright full-career + chapter / people capture for M3.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const OUT = '/opt/cursor/artifacts';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const started = Date.now();

await page.goto('http://127.0.0.1:4173/?seed=64aa2bl7', { waitUntil: 'networkidle' });
const guide = page.getByRole('button', { name: '知道了' });
if (await guide.count()) await guide.click();
await page.locator('#seed-input').fill('64aa2bl7');
await page.getByRole('button', { name: '開始新的棒球人生' }).click();
await page.waitForTimeout(300);
await page.locator('button', { hasText: '外野手' }).first().click();
await page.locator('#name-input').fill('試玩外野');
await page.getByRole('button', { name: '建立球員並開始遊戲' }).click();
await page.waitForTimeout(400);

let decisions = 0;
let chapterSeen = 0;
let storySeen = 0;
let rivalSeen = 0;
let chapterShot = false;
let storyShot = false;
let rivalShot = false;

for (let step = 0; step < 360; step++) {
  const body = await page.locator('body').innerText();

  if (body.includes('生涯章節') || /第.+章/.test(body)) {
    chapterSeen += 1;
    if (!chapterShot) {
      await page.screenshot({ path: path.join(OUT, 'bl-m3-01-chapter.png'), fullPage: true });
      chapterShot = true;
    }
  }
  if (body.includes('人際事件') || body.includes('教練・') || body.includes('隊友・')) {
    storySeen += 1;
    if (!storyShot) {
      await page.screenshot({ path: path.join(OUT, 'bl-m3-02-story.png'), fullPage: true });
      storyShot = true;
    }
  }
  if (body.includes('對決・') || body.includes('宿敵')) {
    rivalSeen += 1;
    if (!rivalShot && body.includes('對決・')) {
      await page.screenshot({ path: path.join(OUT, 'bl-m3-03-rival-clutch.png'), fullPage: true });
      rivalShot = true;
    }
  }

  if (body.includes('看生涯總結') || (body.includes('生涯總結') && body.includes('名人堂'))) {
    await page.screenshot({ path: path.join(OUT, 'bl-m3-04-retire.png'), fullPage: true });
    const summaryBtn = page.getByRole('button', { name: '看生涯總結' });
    if (await summaryBtn.count()) {
      await summaryBtn.click();
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: path.join(OUT, 'bl-m3-05-summary.png'), fullPage: true });
    break;
  }

  const choices = page.locator('button.bl-choice:visible');
  const n = await choices.count();
  if (n > 0) {
    let idx = 0;
    if (body.includes('副課')) {
      for (let i = 0; i < n; i++) {
        const t = await choices.nth(i).innerText();
        if (t.includes('伸展') || t.includes('筆記') || t.includes('跑壘')) {
          idx = i;
          break;
        }
      }
    } else if (body.includes('主課')) {
      for (let i = 0; i < n; i++) {
        const t = await choices.nth(i).innerText();
        if (t.includes(['跑壘', '揮棒', '守備', '重量'][step % 4])) {
          idx = i;
          break;
        }
      }
    } else if (/全國|黑豹|夏天/.test(body) && !body.includes('關鍵')) {
      for (let i = 0; i < n; i++) {
        const t = await choices.nth(i).innerText();
        if (t.includes('照著配置')) {
          idx = i;
          break;
        }
      }
    } else if (body.includes('人際事件')) {
      for (let i = 0; i < n; i++) {
        const t = await choices.nth(i).innerText();
        if (/聊天|聽完|致意|燃料/.test(t)) {
          idx = i;
          break;
        }
      }
    }
    await choices.nth(idx).click();
    decisions += 1;
    await page.waitForTimeout(70);
    continue;
  }

  await page.keyboard.press('1');
  decisions += 1;
  await page.waitForTimeout(70);
}

const result = {
  decisions,
  chapterUiSightings: chapterSeen,
  storyUiSightings: storySeen,
  rivalUiSightings: rivalSeen,
  chapterShot,
  storyShot,
  rivalShot,
  elapsedMs: Date.now() - started,
  elapsedMin: Number(((Date.now() - started) / 60000).toFixed(2)),
};
fs.writeFileSync(path.join(OUT, 'bl-m3-browser-play.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
await browser.close();
