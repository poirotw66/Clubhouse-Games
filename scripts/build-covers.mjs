import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(root, 'assets/covers');
const output = path.join(source, 'optimized');
const { categories } = JSON.parse(await fs.readFile(path.join(root, 'data/games.json'), 'utf8'));
await fs.mkdir(output, { recursive: true });
let originalBytes = 0;
let webpBytes = 0;
for (const { gameFolder } of categories.flatMap((category) => category.games)) {
  const input = path.join(source, `${gameFolder}.jpg`);
  originalBytes += (await fs.stat(input)).size;
  for (const width of [320, 640]) {
    const result = await sharp(input).rotate().resize(width, width * 3 / 4, { fit: 'cover' })
      .webp({ quality: 78 }).toFile(path.join(output, `${gameFolder}-${width}.webp`));
    if (width === 640) webpBytes += result.size;
    if (result.size > 150 * 1024) throw new Error(`${gameFolder}: ${width}px cover exceeds 150 KiB`);
  }
  const fallback = await sharp(input).rotate().resize(640, 480, { fit: 'cover' })
    .jpeg({ quality: 78, mozjpeg: true }).toFile(path.join(output, `${gameFolder}-640.jpg`));
  if (fallback.size > 200 * 1024) throw new Error(`${gameFolder}: JPEG cover exceeds 200 KiB`);
}
console.log(`Covers: ${(originalBytes / 1024).toFixed(0)} KiB originals → ${(webpBytes / 1024).toFixed(0)} KiB at 640px WebP (${(100 * (1 - webpBytes / originalBytes)).toFixed(1)}% smaller).`);
