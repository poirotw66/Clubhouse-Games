/**
 * Playwright full-career + clutch capture for M2.
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
let clutchSeen = 0;
let clutchShot = false;
let highlightShot = false;

for (let step = 0; step < 320; step++) {
  const body = await page.locator('body').innerText();

  if (body.includes('比賽關鍵局面') || body.includes('關鍵局面')) {
    clutchSeen += 1;
    if (!clutchShot) {
      await page.screenshot({ path: path.join(OUT, 'bl-m2-01-clutch-decision.png'), fullPage: true });
      clutchShot = true;
    }
  }

  if (body.includes('看生涯總結') || (body.includes('生涯總結') && body.includes('名人堂'))) {
    await page.screenshot({ path: path.join(OUT, 'bl-m2-03-retire.png'), fullPage: true });
    const summaryBtn = page.getByRole('button', { name: '看生涯總結' });
    if (await summaryBtn.count()) {
      await summaryBtn.click();
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: path.join(OUT, 'bl-m2-04-summary.png'), fullPage: true });
    const summaryBody = await page.locator('body').innerText();
    if (summaryBody.includes('關鍵時刻')) {
      highlightShot = true;
      await page.screenshot({ path: path.join(OUT, 'bl-m2-05-highlights.png'), fullPage: true });
    }
    break;
  }

  const choices = page.locator('button.bl-choice:visible');
  const n = await choices.count();
  if (n > 0) {
    let idx = 0;
    if (body.includes('比賽關鍵局面') || body.includes('關鍵局面')) {
      for (let i = 0; i < n; i++) {
        const t = await choices.nth(i).innerText();
        if (/磨深|確實|按兵|邊角|短打|卡好/.test(t)) {
          idx = i;
          break;
        }
      }
      // Capture result after click on first clutch
      await choices.nth(idx).click();
      decisions += 1;
      await page.waitForTimeout(200);
      if (!fs.existsSync(path.join(OUT, 'bl-m2-02-clutch-result.png'))) {
        await page.screenshot({ path: path.join(OUT, 'bl-m2-02-clutch-result.png'), fullPage: true });
      }
      continue;
    }
    if (body.includes('副課')) {
      for (let i = 0; i < n; i++) {
        const t = await choices.nth(i).innerText();
        if (t.includes('伸展') || t.includes('跑壘')) {
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
    } else if (/全國|黑豹|夏天/.test(body)) {
      for (let i = 0; i < n; i++) {
        const t = await choices.nth(i).innerText();
        if (t.includes('照著配置')) {
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
  clutchUiSightings: clutchSeen,
  clutchShot,
  highlightShot,
  elapsedMs: Date.now() - started,
  elapsedMin: Number(((Date.now() - started) / 60000).toFixed(2)),
};
fs.writeFileSync(path.join(OUT, 'bl-m2-browser-play.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
await browser.close();
