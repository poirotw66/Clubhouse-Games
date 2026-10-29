#!/usr/bin/env node
/** Build offline CJK subsets after generating the hub menu. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';

const root = fileURLToPath(new URL('../', import.meta.url));
const fontsDir = path.join(root, 'assets/fonts');
// Include generated markup, catalogue text, and dynamic status/recent-game copy.
// New catalogue entries are included automatically on every npm run generate.
const inputs = ['index.html', 'data/games.json', 'assets/menu.js'];
const sources = await Promise.all(inputs.map((file) => fs.readFile(path.join(root, file), 'utf8')));
const text = [...new Set([...sources.join('\n')].filter((char) => char.codePointAt(0) > 0xff))]
  .sort((a, b) => a.codePointAt(0) - b.codePointAt(0))
  .join('');
if (!text) throw new Error('Hub font corpus contains no non-Latin characters.');

const output = path.join(fontsDir, 'optimized');
await fs.mkdir(output, { recursive: true });
let originalBytes = 0;
let subsetBytes = 0;
for (const weight of [400, 500, 600]) {
  const source = await fs.readFile(path.join(fontsDir, 'files', `noto-sans-tc-chinese-traditional-${weight}-normal.woff2`));
  const subset = await subsetFont(source, text, {
    targetFormat: 'woff2',
    // Preserve copyright, license, and license URL metadata in each derivative.
    preserveNameIds: [0, 13, 14],
  });
  if (subset.length > 128 * 1024) {
    throw new Error(`Hub CJK font ${weight} exceeds the 128 KiB subset budget.`);
  }
  await fs.writeFile(path.join(output, `noto-sans-tc-hub-${weight}.woff2`), subset);
  originalBytes += source.length;
  subsetBytes += subset.length;
}
console.log(
  `Hub CJK fonts: ${(originalBytes / 1024).toFixed(0)} KiB originals -> ` +
  `${(subsetBytes / 1024).toFixed(0)} KiB subsets (${[...text].length} corpus characters, weights 400/500/600).`,
);
