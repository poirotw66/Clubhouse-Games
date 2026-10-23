import { test, expect } from '@playwright/test';

/**
 * Regression: stacked solitaire cards must fully expose rank+suit corners.
 * FreeCell (空當接龍) and Klondike (接龍) both fan vertically; Klondike waste
 * also fans horizontally.
 */

const VIEWPORTS = [
  { width: 375, height: 720 },
  { width: 390, height: 844 },
  { width: 768, height: 900 },
  { width: 1280, height: 900 },
];

function includesGame(folder) {
  const raw = (process.env.CI_GAME_FILTER || '').trim();
  if (!raw || raw === '*' || raw.toLowerCase() === 'full') return true;
  if (raw === '__none__') return false;
  return new Set(raw.split(/[\s,]+/).filter(Boolean)).has(folder);
}

/** Top-left corners in each tableau column; consecutive pairs must not overlap. */
async function measureCornerOverlap(page) {
  return page.evaluate(() => {
    const cols = [...document.querySelectorAll('[data-tableau-col]')];
    let worstOverlap = 0;
    let pairs = 0;
    const samples = [];
    for (const col of cols) {
      const slots = [...col.querySelectorAll('[data-tableau-slot]')];
      const corners = slots
        .map((slot) => {
          const corner = slot.querySelector('[data-card-corner="top"]');
          if (!corner) return null;
          const r = corner.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return null;
          return { top: r.top, bottom: r.bottom, height: r.height, text: corner.textContent?.replace(/\s+/g, '') };
        })
        .filter(Boolean);
      for (let i = 0; i < corners.length - 1; i++) {
        const a = corners[i];
        const b = corners[i + 1];
        const overlap = a.bottom - b.top;
        pairs += 1;
        if (overlap > worstOverlap) worstOverlap = overlap;
        if (samples.length < 4) {
          samples.push({
            a: a.text,
            b: b.text,
            overlap: Math.round(overlap * 10) / 10,
            peek: Math.round((b.top - a.top) * 10) / 10,
            labelH: Math.round(a.height * 10) / 10,
          });
        }
      }
    }
    return { worstOverlap, pairs, samples };
  });
}

/** Peek CSS var must be at least the measured corner label height. */
async function measurePeekVsCorner(page, peekVar) {
  return page.evaluate((varName) => {
    const col = document.querySelector('[data-tableau-col]');
    const corner = document.querySelector('[data-card-corner="top"]');
    if (!col || !corner) return null;
    // getPropertyValue returns the calc() source; resolve via a probe element.
    const probe = document.createElement('div');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = `position:absolute;left:0;top:0;width:1px;height:var(${varName});visibility:hidden;pointer-events:none`;
    col.appendChild(probe);
    const peekPx = probe.getBoundingClientRect().height;
    probe.remove();
    const labelH = corner.getBoundingClientRect().height;
    return {
      peekPx: Math.round(peekPx * 10) / 10,
      labelH: Math.round(labelH * 10) / 10,
    };
  }, peekVar);
}

for (const viewport of VIEWPORTS) {
  test(`freecell tableau corners do not overlap @${viewport.width}`, async ({ page }) => {
    test.skip(!includesGame('FreeCell'), 'selective CI');
    await page.setViewportSize(viewport);
    await page.goto('./Games/FreeCell/');
    await expect(page.getByRole('heading', { name: '空當接龍', exact: true })).toBeVisible();
    await page.locator('#freecell-seed').fill('11982');
    await page.getByRole('button', { name: '發此局', exact: true }).click();
    await expect(page.locator('[data-tableau-col]').first()).toBeVisible();

    const peek = await measurePeekVsCorner(page, '--fc-fan-peek');
    expect(peek, 'fan peek metrics').not.toBeNull();
    expect(peek.peekPx, `peek ${peek.peekPx} >= label ${peek.labelH}`).toBeGreaterThanOrEqual(peek.labelH - 0.5);

    const { worstOverlap, pairs, samples } = await measureCornerOverlap(page);
    expect(pairs, 'stacked corner pairs').toBeGreaterThan(10);
    // Allow sub-pixel AA; require a clear gap so suit glyphs are not clipped.
    expect(
      worstOverlap,
      `overlap ${worstOverlap}px samples=${JSON.stringify(samples)}`,
    ).toBeLessThanOrEqual(-2);
  });

  test(`klondike fan peek covers corner @${viewport.width}`, async ({ page }) => {
    test.skip(!includesGame('Klondike'), 'selective CI');
    await page.setViewportSize(viewport);
    await page.goto('./Games/Klondike/');
    await expect(page.getByRole('heading', { name: '接龍', exact: true })).toBeVisible();
    await page.locator('#klondike-seed').fill('11982');
    await page.getByRole('button', { name: '發此局', exact: true }).click();
    await expect(page.locator('[data-tableau-col]').first()).toBeVisible();

    const peek = await measurePeekVsCorner(page, '--kl-fan-face-up');
    expect(peek, 'face-up peek metrics').not.toBeNull();
    expect(peek.peekPx, `peek ${peek.peekPx} >= label ${peek.labelH}`).toBeGreaterThanOrEqual(peek.labelH - 0.5);

    // Build a face-up stack via hint loops so overlap is measured, not only vars.
    for (let i = 0; i < 12; i++) {
      const hint = page.getByRole('button', { name: '提示' });
      if (await hint.isDisabled()) break;
      await hint.click();
      await page.waitForTimeout(80);
      // Tap the sky-ringed source if present, else try double-click playable cards.
      const hinted = page.locator('.ring-sky-400, .ring-4.ring-sky-400').first();
      if (await hinted.count()) {
        await hinted.click({ force: true }).catch(() => {});
      }
      await page.waitForTimeout(120);
      const stacked = await measureCornerOverlap(page);
      if (stacked.pairs > 0) {
        expect(
          stacked.worstOverlap,
          `klondike overlap ${stacked.worstOverlap} @${viewport.width} samples=${JSON.stringify(stacked.samples)}`,
        ).toBeLessThanOrEqual(0.5);
        break;
      }
    }
  });
}
