/**
 * Playwright full-career smoke for M1.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BL_URL || 'http://127.0.0.1:4173/?seed=64aa2bl7';
const OUT = '/opt/cursor/artifacts';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const started = Date.now();

await page.goto(BASE, { waitUntil: 'networkidle' });
// Dismiss first-run guide if present
const guide = page.getByRole('button', { name: '知道了' });
if (await guide.count()) await guide.click();

await page.locator('#seed-input').fill('64aa2bl7');
await page.getByRole('button', { name: '開始新的棒球人生' }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(OUT, 'bl-m1-02-create.png'), fullPage: true });

await page.locator('button', { hasText: '外野手' }).first().click();
await page.locator('#name-input').fill('試玩外野');
// TouchButton aria-label overrides visible text for getByRole name matching.
await page.getByRole('button', { name: '建立球員並開始遊戲' }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(OUT, 'bl-m1-03-hs-primary.png'), fullPage: true });

let decisions = 0;
let sawSecondary = false;
let sawAbility = false;
let sawMotivation = false;
let secondaryShot = false;
let abilityShot = false;

for (let step = 0; step < 280; step++) {
  const body = await page.locator('body').innerText();
  if (body.includes('動機')) sawMotivation = true;
  if (/特殊能力|機會眼|盜壘起動|守備範圍|強打拉打|球質沉重/.test(body)) {
    sawAbility = true;
    if (!abilityShot) {
      await page.screenshot({ path: path.join(OUT, 'bl-m1-05-ability.png'), fullPage: true });
      abilityShot = true;
    }
  }
  if (body.includes('副課')) {
    sawSecondary = true;
    if (!secondaryShot) {
      await page.screenshot({ path: path.join(OUT, 'bl-m1-04-hs-secondary.png'), fullPage: true });
      secondaryShot = true;
    }
  }

  if (body.includes('生涯總結') || (body.includes('名人堂') && body.includes('分享'))) {
    await page.screenshot({ path: path.join(OUT, 'bl-m1-07-summary.png'), fullPage: true });
    break;
  }

  const summaryBtn = page.getByRole('button', { name: '看生涯總結' });
  if (await summaryBtn.count()) {
    await page.screenshot({ path: path.join(OUT, 'bl-m1-06-retire.png'), fullPage: true });
    await summaryBtn.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, 'bl-m1-07-summary.png'), fullPage: true });
    break;
  }

  const choices = page.locator('button.bl-choice:visible');
  const choiceCount = await choices.count();
  if (choiceCount > 0) {
    let idx = 0;
    if (body.includes('副課')) {
      for (let i = 0; i < choiceCount; i++) {
        const t = await choices.nth(i).innerText();
        if (t.includes('伸展') || t.includes('筆記') || t.includes('跑壘')) {
          idx = i;
          break;
        }
      }
    } else if (body.includes('主課')) {
      // Rotate primary drills: prefer run/swing/field over rest
      for (let i = 0; i < choiceCount; i++) {
        const t = await choices.nth(i).innerText();
        const prefer = ['跑壘', '揮棒', '守備', '重量'][step % 4];
        if (t.includes(prefer)) {
          idx = i;
          break;
        }
      }
    } else if (/全國|黑豹|夏天/.test(body)) {
      for (let i = 0; i < choiceCount; i++) {
        const t = await choices.nth(i).innerText();
        if (t.includes('照著配置') || t.includes('保護')) {
          idx = i;
          break;
        }
      }
    }
    await choices.nth(idx).click();
    decisions += 1;
    await page.waitForTimeout(80);
    continue;
  }

  // Fallback keyboard
  await page.keyboard.press('1');
  decisions += 1;
  await page.waitForTimeout(80);
}

const elapsedMs = Date.now() - started;
const result = {
  decisions,
  elapsedMs,
  elapsedMin: Number((elapsedMs / 60000).toFixed(2)),
  sawSecondary,
  sawMotivation,
  sawAbility,
};
fs.writeFileSync(path.join(OUT, 'bl-m1-browser-play.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
await browser.close();
