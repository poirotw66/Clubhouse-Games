/**
 * Headed Playwright smoke: title → 3×3 classic → solve via IDA* path → result.
 * Writes screenshots under /opt/cursor/artifacts/.
 */
import { chromium } from 'playwright';
import path from 'node:path';
import { scrambleFromSeed } from '../src/fifteenLogic.ts';
import { optimalMoves, applyPath } from '../src/solver.ts';
import { isSolved } from '../src/fifteenLogic.ts';

const OUT = '/opt/cursor/artifacts';
const BASE = 'http://127.0.0.1:3015/';

async function main() {
  const browser = await chromium.launch({
    headless: false,
    executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage({ viewport: { width: 900, height: 1100 } });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=數字推盤');
  await page.screenshot({ path: path.join(OUT, 'fifteen-title.png'), fullPage: true });

  await page.getByRole('button', { name: '3×3', exact: true }).click();
  await page.getByRole('button', { name: '簡單', exact: true }).click();
  await page.getByRole('button', { name: '數字', exact: true }).click();
  await page.getByRole('button', { name: '經典模式', exact: true }).click();
  await page.waitForSelector('[aria-label*="推盤"]');
  await page.screenshot({ path: path.join(OUT, 'fifteen-play-3x3.png'), fullPage: true });

  // Read board from tile buttons (ordered by number label on screen positions via style left/top).
  const tiles = await page.locator('button[aria-label^="第"]').all();
  /** @type {{ tile: number, left: number, top: number }[]} */
  const placed = [];
  for (const t of tiles) {
    const label = await t.getAttribute('aria-label');
    const m = label && /第 (\d+)/.exec(label);
    if (!m) continue;
    const style = await t.evaluate((el) => {
      const s = getComputedStyle(el);
      return { left: parseFloat(s.left), top: parseFloat(s.top) };
    });
    placed.push({ tile: Number(m[1]), left: style.left, top: style.top });
  }
  const size = 3;
  const xs = [...new Set(placed.map((p) => p.left))].sort((a, b) => a - b);
  const ys = [...new Set(placed.map((p) => p.top))].sort((a, b) => a - b);
  /** @type {(number|null)[]} */
  const board = Array(size * size).fill(null);
  for (const p of placed) {
    const c = xs.indexOf(p.left);
    const r = ys.indexOf(p.top);
    board[r * size + c] = p.tile;
  }

  const solved = optimalMoves(board, size, 40);
  if (!solved.path) throw new Error('no solve path');
  console.log('board', board, 'optimal', solved.moves, 'path', solved.path);

  for (const idx of solved.path) {
    const num = board[idx];
    if (num == null) throw new Error(`empty at path idx ${idx}`);
    // Accessible name is the visible numeral; aria-label is also "第 N 格".
    const btn = page.locator(`button[aria-label^="第 ${num}"]`);
    await btn.click({ force: true });
    const empty = board.indexOf(null);
    board[empty] = num;
    board[idx] = null;
    await page.waitForTimeout(220);
  }

  await page.waitForSelector('text=完成');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, 'fifteen-result-par.png'), fullPage: true });

  // Campaign list
  await page.getByRole('button', { name: '回選單', exact: true }).click();
  await page.waitForSelector('text=經典模式');
  await page.getByRole('button', { name: /闖關階梯/ }).click();
  await page.waitForSelector('text=熱身 3×3');
  await page.screenshot({ path: path.join(OUT, 'fifteen-campaign.png'), fullPage: true });

  // Picture mode peek
  await page.getByRole('button', { name: '回標題', exact: true }).click();
  await page.getByRole('button', { name: '圖片拼圖', exact: true }).click();
  await page.getByRole('button', { name: '4×4', exact: true }).click();
  await page.getByRole('button', { name: '經典模式', exact: true }).click();
  await page.waitForSelector('[aria-label*="推盤"]');
  await page.screenshot({ path: path.join(OUT, 'fifteen-picture-4x4.png'), fullPage: true });

  const sample = scrambleFromSeed(3, 'easy', 1);
  const pathOpt = optimalMoves(sample.board, 3, sample.scrambleMoves);
  console.log(
    'playtest ok; sample solvable path exact?',
    pathOpt.exact,
    'restores?',
    isSolved(applyPath(sample.board, 3, pathOpt.path ?? []), 3),
  );

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
