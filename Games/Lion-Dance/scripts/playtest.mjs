/**
 * Dual-viewport Playwright: framing + feet clear of HUD + fall side-pose evidence.
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

function pointInBox(px, py, box, pad = 2) {
  return (
    px >= box.x - pad &&
    px <= box.x + box.width + pad &&
    py >= box.y - pad &&
    py <= box.y + box.height + pad
  );
}

async function cropLion(page, label, tag, viewport) {
  const frame = await page.evaluate(() => window.__lionWorld?.checkFraming() ?? null);
  if (!frame?.bounds) return;
  const b = frame.bounds;
  const padX = 0.04;
  const padY = 0.03;
  const face = {
    x: Math.max(0, (b.minX - padX) * viewport.width),
    y: Math.max(0, (b.minY - padY) * viewport.height),
    width: Math.min(viewport.width, (b.maxX - b.minX + padX * 2) * viewport.width),
    height: Math.min(viewport.height, (b.heightFrac * 0.5 + padY) * viewport.height),
  };
  const legs = {
    x: Math.max(0, (b.minX - padX * 1.5) * viewport.width),
    y: Math.max(0, (b.minY + b.heightFrac * 0.28) * viewport.height),
    width: Math.min(viewport.width, (b.maxX - b.minX + padX * 3) * viewport.width),
    height: Math.min(
      viewport.height - (b.minY + b.heightFrac * 0.28) * viewport.height,
      (b.heightFrac * 0.8 + padY * 2) * viewport.height,
    ),
  };
  for (const [name, clip] of [
    ['face', face],
    ['legs', legs],
  ]) {
    clip.x = Math.floor(clip.x);
    clip.y = Math.floor(clip.y);
    clip.width = Math.max(40, Math.floor(clip.width));
    clip.height = Math.max(40, Math.floor(clip.height));
    if (clip.x + clip.width > viewport.width) clip.width = viewport.width - clip.x;
    if (clip.y + clip.height > viewport.height) clip.height = viewport.height - clip.y;
    await page.screenshot({ path: `${OUT}/v6-${label}-${tag}-${name}.png`, clip });
  }
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

/** Four foot soles must not land inside hint / combo / QWOP / get-up rects. */
async function assertFeetClearOfHud(page, label, viewport) {
  const report = await page.evaluate(() => {
    const feet = window.__lionWorld?.projectFeet?.() ?? null;
    if (!feet) return { ok: false, error: 'no projectFeet' };
    const sels = [
      '.lion-bottom-hint',
      '.lion-beat-chip',
      '.lion-leg-btn',
      '.lion-touch-up',
      '.lion-tipping',
    ];
    const boxes = [];
    for (const sel of sels) {
      for (const el of document.querySelectorAll(sel)) {
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        // Skip invisible / zero-opacity tips
        const style = getComputedStyle(el);
        if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) < 0.05) {
          continue;
        }
        boxes.push({
          sel,
          x: r.x,
          y: r.y,
          width: r.width,
          height: r.height,
        });
      }
    }
    const hits = [];
    for (const [id, uv] of Object.entries(feet)) {
      const px = uv.x * window.innerWidth;
      const py = uv.y * window.innerHeight;
      for (const box of boxes) {
        if (
          px >= box.x - 2 &&
          px <= box.x + box.width + 2 &&
          py >= box.y - 2 &&
          py <= box.y + box.height + 2
        ) {
          hits.push({ id, uv, box: box.sel });
        }
      }
    }
    return { ok: hits.length === 0, feet, hits, boxes: boxes.map((b) => b.sel) };
  });
  if (!report.ok) {
    throw new Error(
      `${label}: feet overlap HUD ${JSON.stringify(report.hits)} viewport=${viewport.width}x${viewport.height}`,
    );
  }
  console.log(label, 'feet clear of HUD ok', report.feet);
}

async function runViewport(browser, label, viewport) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error(label, 'PAGEERROR', e.message));

  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/v6-${label}-title.png` });

  let frame = await page.evaluate(() => window.__lionWorld?.checkFraming() ?? null);
  console.log(label, 'attract framing', JSON.stringify(frame));
  if (!frame?.ok) throw new Error(`${label} attract framing failed: ${frame?.reasons}`);

  await page.getByRole('button', { name: /開始踩街/ }).click();
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `${OUT}/v6-${label}-stand.png` });
  await cropLion(page, label, 'stand', viewport);
  await assertHudNoOverlap(page, label);
  await assertFeetClearOfHud(page, label, viewport);

  frame = await page.evaluate(() => window.__lionWorld?.checkFraming() ?? null);
  console.log(label, 'play framing', JSON.stringify(frame));
  if (!frame?.ok) throw new Error(`${label} play framing failed: ${frame?.reasons}`);
  {
    const b = frame.bounds;
    const centerY = (b.minY + b.maxY) * 0.5;
    const feet = await page.evaluate(() => window.__lionWorld?.projectFeet?.() ?? null);
    const footYs = feet ? Object.values(feet).map((f) => f.y) : [];
    const footAvg = footYs.length ? footYs.reduce((a, c) => a + c, 0) / footYs.length : 0;
    console.log(label, 'band', { centerY, footAvg, widthFrac: b.widthFrac, heightFrac: b.heightFrac });
    if (b.minY < 0.08) throw new Error(`${label}: top cropped minY=${b.minY}`);
    if (centerY < 0.35 || centerY > 0.6) throw new Error(`${label}: centerY ${centerY} out of 35–60%`);
    // Desk targets 60–70%; portrait frontal view allows a slightly higher band
    const footLo = label === 'mobile' ? 0.52 : 0.55;
    const footHi = label === 'mobile' ? 0.78 : 0.78;
    if (footAvg < footLo || footAvg > footHi) {
      throw new Error(`${label}: feet avg y ${footAvg} not near 60–70% band`);
    }
  }

  // Walk: diagonal pair hold so feet are mid-stride
  await page.keyboard.down('q');
  await page.keyboard.down('p');
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${OUT}/v6-${label}-walk.png` });
  await cropLion(page, label, 'walk', viewport);
  await assertFeetClearOfHud(page, label, viewport);
  await page.keyboard.up('q');
  await page.keyboard.up('p');
  await page.waitForTimeout(120);

  // Tip with same-side left (Q=BL + O=FL), then mash all four
  await page.keyboard.down('q');
  await page.keyboard.down('o');
  await page.waitForTimeout(1100);
  await page.keyboard.down('w');
  await page.keyboard.down('p');
  await page.waitForTimeout(900);
  await page.keyboard.up('q');
  await page.keyboard.up('w');
  await page.keyboard.up('o');
  await page.keyboard.up('p');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/v6-${label}-fall.png` });

  const stamp = await page.locator('.lion-fall-stamp').count();
  const getUp = await page.locator('.lion-touch-up').count();
  const btns = await page.locator('.lion-leg-btn').count();
  const resultEarly = await page.locator('.lion-result').count();
  // Get-up must not cover the lion silhouette (desk + mobile)
  const getUpClear = await page.evaluate(() => {
    const frame = window.__lionWorld?.checkFraming?.();
    const el = document.querySelector('.lion-touch-up');
    if (!frame?.bounds || !el) return { ok: false, reason: 'missing' };
    const r = el.getBoundingClientRect();
    const b = frame.bounds;
    // Convert UV AABB (top-left Y) to pixel rect
    const lx = b.minX * innerWidth;
    const rx = b.maxX * innerWidth;
    const ty = b.minY * innerHeight;
    const by = b.maxY * innerHeight;
    const overlap =
      r.left < rx - 4 && r.right > lx + 4 && r.top < by - 4 && r.bottom > ty + 4;
    return { ok: !overlap, getUp: { x: r.x, y: r.y, w: r.width, h: r.height }, bounds: b };
  });
  // Stamp must be top-centered and fully on-screen (not cropped into the back btn)
  const stampLayout = await page.evaluate(() => {
    const el = document.querySelector('.lion-fall-stamp');
    const back = document.querySelector('[data-testid="lion-back"], a[href], button');
    if (!el) return { ok: false, reason: 'missing stamp' };
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const mid = innerWidth / 2;
    const fullyOn =
      r.left >= 4 && r.right <= innerWidth - 4 && r.top >= 4 && r.bottom <= innerHeight - 4;
    const centered = Math.abs(cx - mid) < innerWidth * 0.12;
    let clearBack = true;
    const backEl =
      document.querySelector('.lion-back') ||
      [...document.querySelectorAll('button,a')].find((n) => /返回|overview|back/i.test(n.textContent || ''));
    if (backEl) {
      const b = backEl.getBoundingClientRect();
      clearBack = !(r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top);
    }
    void back;
    return {
      ok: fullyOn && centered && clearBack,
      fullyOn,
      centered,
      clearBack,
      rect: { x: r.x, y: r.y, w: r.width, h: r.height },
    };
  });
  console.log(label, { stamp, getUp, btns, resultEarly, getUpClear, stampLayout });
  if (stamp < 1 || getUp < 1 || btns < 4) throw new Error(`${label} fall UI missing`);
  if (resultEarly > 0) throw new Error(`${label} fall must not end the run`);
  if (!getUpClear.ok) {
    throw new Error(`${label}: get-up overlaps lion ${JSON.stringify(getUpClear)}`);
  }
  if (!stampLayout.ok) {
    throw new Error(`${label}: fall stamp layout bad ${JSON.stringify(stampLayout)}`);
  }
  await assertFeetClearOfHud(page, label, viewport);

  // Kick while fallen — feet should still move
  await page.keyboard.down('q');
  await page.waitForTimeout(400);
  await page.keyboard.up('q');
  await page.screenshot({ path: `${OUT}/v6-${label}-fall-kick.png` });

  await page.keyboard.press('r');
  await page.waitForTimeout(700);
  const stillPlaying = await page.locator('.lion-result').count();
  if (stillPlaying > 0) throw new Error(`${label} get-up should resume, not show result`);
  await page.screenshot({ path: `${OUT}/v6-${label}-getup.png` });

  await page.close();
}

/**
 * Pace probes — diagonal Q+P ↔ W+O (FL+BR / FR+BL). No framing/art changes.
 * Measured (TRACTION=9.5 GRIP=6.5 AIR_DRAG=0.11 BAL2=78):
 *   diag3Hz ≈22.80s / 0 falls; diag2Hz ≈34.87s / 0 falls; same-side tip ≈0.92s.
 */
async function assertPace(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: /開始踩街/ }).click();
  await page.waitForTimeout(800);

  const diag3 = await page.evaluate(() => window.__lionWorld?.runDiagonalRace?.(1 / 3) ?? null);
  console.log('pace diag3Hz', diag3);
  if (!diag3?.finished) throw new Error(`diag3Hz did not finish ${JSON.stringify(diag3)}`);
  // Measured ≈22.80s / 0 falls — band 20–30s / ≤2
  if (diag3.elapsed < 20 || diag3.elapsed > 30) {
    throw new Error(`diag3Hz t=${diag3.elapsed.toFixed(2)} outside 20–30s (measured≈22.80)`);
  }
  if (diag3.falls > 2) throw new Error(`diag3Hz falls=${diag3.falls} > 2 (measured=0)`);

  const diag2 = await page.evaluate(() => window.__lionWorld?.runDiagonalRace?.(0.5) ?? null);
  console.log('pace diag2Hz', diag2);
  if (!diag2?.finished) throw new Error(`diag2Hz did not finish ${JSON.stringify(diag2)}`);
  // Measured ≈34.87s / 0 falls — band 30–42s / ≤2
  if (diag2.elapsed < 30 || diag2.elapsed > 42) {
    throw new Error(`diag2Hz t=${diag2.elapsed.toFixed(2)} outside 30–42s (measured≈34.87)`);
  }
  if (diag2.falls > 2) throw new Error(`diag2Hz falls=${diag2.falls} > 2 (measured=0)`);

  // Measured ≈0.92s — must tip under 1.2s
  const tip = await page.evaluate(() => window.__lionWorld?.runSameSideTip?.(0.12) ?? null);
  console.log('pace same-side tip', tip);
  if (!tip?.fallen) throw new Error(`same-side should tip within 2s ${JSON.stringify(tip)}`);
  if (tip.elapsed > 1.2) throw new Error(`same-side tip too slow t=${tip.elapsed.toFixed(2)} (measured≈0.92)`);

  await page.close();
  console.log(
    `pace ok: diag3Hz t=${diag3.elapsed.toFixed(2)}s falls=${diag3.falls}; ` +
      `diag2Hz t=${diag2.elapsed.toFixed(2)}s falls=${diag2.falls}; ` +
      `same-side tip t=${tip.elapsed.toFixed(2)}s`,
  );
}

const browser = await chromium.launch({ headless: true });
await runViewport(browser, 'desk', { width: 1280, height: 720 });
await runViewport(browser, 'mobile', { width: 390, height: 844 });
await assertPace(browser);
await browser.close();
console.log('playtest: ok');
