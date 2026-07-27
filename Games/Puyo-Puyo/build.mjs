#!/usr/bin/env node
/**
 * "Build" for a dependency-free static game: copy src/ to dist/.
 * There is no bundler and no BASE_URL rewriting because every asset reference
 * in src/index.html is already relative, so the same output works under the
 * local dev server and under /<repo>/Games/Puyo-Puyo/ on GitHub Pages.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(dirname, 'src');
const outDir = path.join(dirname, 'dist');

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      copyRecursive(path.join(src, name), path.join(dest, name));
    }
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

if (!fs.existsSync(srcDir)) {
  console.error('Missing src/ directory');
  process.exit(1);
}

fs.rmSync(outDir, { recursive: true, force: true });
copyRecursive(srcDir, outDir);
console.log('Puyo Puyo: copied src/ -> dist/');
