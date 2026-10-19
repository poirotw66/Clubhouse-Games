/**
 * Playwright: two careers to demonstrate encyclopedia + legacy NG+.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const OUT = '/opt/cursor/artifacts';
fs.mkdirSync(OUT, { recursive: true });

async function playCareer(page, { seed, name, pickLegacy }) {
  await page.goto(`http://127.0.0.1:4173/?seed=${seed}`, { waitUntil: 'networkidle' });
  const guide = page.getByRole('button', { name: '知道了' });
  if (await guide.count()) await guide.click();

  // Expand encyclopedia if visible
  const enc = page.getByRole('button', { name: /特殊能力圖鑑/ });
  if (await enc.count()) {
    await enc.click();
    await page.waitForTimeout(300);
    if (!fs.existsSync(path.join(OUT, 'bl-m4-01-encyclopedia.png'))) {
      await page.screenshot({ path: path.join(OUT, 'bl-m4-01-encyclopedia.png'), fullPage: true });
    }
  }

  await page.locator('#seed-input').fill(seed);
  await page.getByRole('button', { name: '開始新的棒球人生' }).click();
  await page.waitForTimeout(300);

  // Legacy picker on create screen
  const body = await page.locator('body').innerText();
  if (body.includes('遺產') || body.includes('New Game+')) {
    await page.screenshot({ path: path.join(OUT, 'bl-m4-02-legacy-picker.png'), fullPage: true });
    if (pickLegacy) {
      const legacyBtn = page.locator('button.bl-choice', { hasText: /師承|血脈|家傳/ }).first();
      if (await legacyBtn.count()) await legacyBtn.click();
    }
  }

  await page.locator('button', { hasText: '外野手' }).first().click();
  await page.locator('#name-input').fill(name);
  await page.getByRole('button', { name: /建立球員並開始遊戲|入部/ }).click();
  await page.waitForTimeout(400);

  let decisions = 0;
  for (let step = 0; step < 360; step++) {
    const text = await page.locator('body').innerText();
    if (text.includes('看生涯總結') || (text.includes('生涯總結') && text.includes('名人堂'))) {
      await page.screenshot({
        path: path.join(OUT, name.includes('二代') ? 'bl-m4-04-career2-summary.png' : 'bl-m4-03-career1-retire.png'),
        fullPage: true,
      });
      const summaryBtn = page.getByRole('button', { name: '看生涯總結' });
      if (await summaryBtn.count()) {
        await summaryBtn.click();
        await page.waitForTimeout(500);
      }
      await page.screenshot({
        path: path.join(OUT, name.includes('二代') ? 'bl-m4-05-career2-done.png' : 'bl-m4-03b-career1-summary.png'),
        fullPage: true,
      });
      // Back to title
      const again = page.getByRole('button', { name: /再來一段|回到標題|標題/ });
      if (await again.count()) await again.first().click();
      else {
        // SummaryScreen usually has a button to title
        const titleish = page.locator('button', { hasText: /標題|再打|新的/ });
        if (await titleish.count()) await titleish.first().click();
      }
      await page.waitForTimeout(400);
      break;
    }

    const choices = page.locator('button.bl-choice:visible');
    const n = await choices.count();
    if (n > 0) {
      let idx = 0;
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
          if (t.includes(['跑壘', '揮棒', '守備', '重量'][step % 4])) {
            idx = i;
            break;
          }
        }
      }
      await choices.nth(idx).click();
      decisions += 1;
      await page.waitForTimeout(50);
      continue;
    }
    await page.keyboard.press('1');
    decisions += 1;
    await page.waitForTimeout(50);
  }
  return decisions;
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const started = Date.now();

const d1 = await playCareer(page, { seed: '64aa2bl7', name: '試玩外野', pickLegacy: false });
const d2 = await playCareer(page, { seed: 'm4gen2b', name: '二代外野', pickLegacy: true });

// Final encyclopedia progress
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
const enc = page.getByRole('button', { name: /特殊能力圖鑑/ });
if (await enc.count()) {
  await enc.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, 'bl-m4-06-encyclopedia-after.png'), fullPage: true });
}

const result = {
  career1Decisions: d1,
  career2Decisions: d2,
  elapsedMs: Date.now() - started,
  elapsedMin: Number(((Date.now() - started) / 60000).toFixed(2)),
};
fs.writeFileSync(path.join(OUT, 'bl-m4-browser-play.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
await browser.close();
