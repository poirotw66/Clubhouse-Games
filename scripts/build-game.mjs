#!/usr/bin/env node
/**
 * Build one game into its dist/ folder. Usage: npm run build:game Blackjack-main
 * Each game should use base: process.env.BASE_URL || './' in vite.config so that:
 * - Local dev: no BASE_URL is set, base is relative and works under server.mjs (Games/<name>/dist/).
 * - GitHub Pages: build-for-pages.mjs sets BASE_URL=/${REPO_NAME}/Games/<name>/ when building.
 */

import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const name = process.argv[2];

if (!name) {
  console.error('Usage: npm run build:game <folder>');
  console.error('Example: npm run build:game Blackjack-main');
  process.exit(1);
}

const gameDir = path.join(root, 'Games', name);
if (!fs.existsSync(gameDir)) {
  console.error('No such game folder: Games/' + name);
  process.exit(1);
}

const result = spawnSync('npm', ['run', 'build'], {
  cwd: gameDir,
  stdio: 'inherit',
  shell: true,
});

process.exit(result.status ?? 1);
