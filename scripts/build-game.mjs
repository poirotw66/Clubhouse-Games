#!/usr/bin/env node
/**
 * Build one game into its dist/ folder. Usage: npm run build:game Blackjack-main
 * The game must have base in vite.config set to /Games/<name>/ so assets load under the single dev server.
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
