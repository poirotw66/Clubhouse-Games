/**
 * Dual-viewport Playwright: framing + HUD non-overlap + evidence screenshots.
 * Usage: LION_URL=http://127.0.0.1:4180/ node scripts/playtest.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = process.env.LION_SHOTS || '/opt/cursor/artifacts';
mkdirSync(OUT, { recursive: true });
const BASE = process.env.LION_URL || 'http://127.0.0.1:4180/';

function boxesOverlap(a, b, pad = 1) {
  return !(
    a.x + a.width <= b.x + pad ||
    b.x + b.width <= a.x + pad ||
    a.y + a.height <= b.y + pad ||
    b.y + b.height <= a.y + pad
  );
}

async function assertHudNoOverlap(page, label) {
  const boxes = await page.evaluate(() => {
    const pick = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    };
    return {
      left: pick('[data-testid="lion-hud-left"]'),
      right: pick('[data-testid="lion-hud-right"]'),
      mute: pick('[data-testid="lion-icon-mute"]'),
      help: pick('[data-testid="lion-icon-help"]'),
    };
  });
  for (const [name, box] of Object.entries(boxes)) {
    if (!box || box.width < 1 || box.height < 1) {
      throw new Error(`${label}: missing HUD box ${name}`);
    }
  }
  for (const card of ['left', 'right']) {
    for (const icon of ['mute', 'help']) {
      if (boxesOverlap(boxes[card], boxes[icon])) {
        throw new Error(
          `${label}: ${icon} overlaps ${card} card ` +
            JSON.stringify({ card: boxes[card], icon: boxes[icon] }),
        );
      }
    }
  }
  console.log(label, 'HUD overlap ok');
}

async function runViewport(browser, label, viewport) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error(label, 'PAGEERROR', e.message));

  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/v4-${label}-title.png` });

  let frame = await page.evaluate(() => window.__lionWorld?.checkFraming() ?? null);
  console.log(label, 'attract framing', JSON.stringify(frame));
  if (!frame?.ok) throw new Error(`${label} attract framing failed: ${frame?.reasons}`);

  await page.getByRole('button', { name: /開始踩街/ }).click();
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `${OUT}/v4-${label}-play.png` });
  await assertHudNoOverlap(page, label);

  frame = await page.evaluate(() => window.__lionWorld?.checkFraming() ?? null);
  console.log(label, 'play framing', JSON.stringify(frame));
  if (!frame?.ok) throw new Error(`${label} play framing failed: ${frame?.reasons}`);

  // Mid-step: hold diagonal long enough for a clear knee bend + raised boots
  await page.keyboard.down('q');
  await page.keyboard.down('p');
  await page.waitForTimeout(550);
  await page.screenshot({ path: `${OUT}/v4-${label}-step.png` });
  await page.keyboard.up('q');
  await page.keyboard.up('p');
  await page.waitForTimeout(180);

  // Tip over
  await page.keyboard.down('q');
  await page.keyboard.down('w');
  await page.keyboard.down('o');
  await page.keyboard.down('p');
  await page.waitForTimeout(1800);
  await page.keyboard.up('q');
  await page.keyboard.up('w');
  await page.keyboard.up('o');
  await page.keyboard.up('p');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/v4-${label}-fall.png` });

  const stamp = await page.locator('.lion-fall-stamp').count();
  const getUp = await page.locator('.lion-touch-up').count();
  const btns = await page.locator('.lion-leg-btn').count();
  console.log(label, { stamp, getUp, btns });
  if (stamp < 1 || getUp < 1 || btns < 4) throw new Error(`${label} fall UI missing`);

  await page.waitForTimeout(3500);
  if ((await page.locator('.lion-result').count()) === 0) await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/v4-${label}-result.png` });

  await page.close();
}

const browser = await chromium.launch({ headless: true });
await runViewport(browser, 'desk', { width: 1280, height: 720 });
await runViewport(browser, 'mobile', { width: 390, height: 844 });
await browser.close();
console.log('playtest: ok');
