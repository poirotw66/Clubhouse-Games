#!/usr/bin/env node
/**
 * Build every game into Games/<name>/dist/ (local relative base).
 * Usage: npm run build:all
 */

import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function getGameFolders() {
  const gamesDir = path.join(root, 'Games');
  if (!fs.existsSync(gamesDir)) return [];
  return fs.readdirSync(gamesDir).filter((name) =>
    fs.existsSync(path.join(gamesDir, name, 'package.json')),
  );
}

const gameFolders = getGameFolders();
if (gameFolders.length === 0) {
  console.log('No games to build.');
  process.exit(0);
}

const failed = [];
for (const name of gameFolders) {
  console.log(`\n=== Build Games/${name} ===`);
  const result = spawnSync('node', [path.join(__dirname, 'build-game.mjs'), name], {
    cwd: root,
    stdio: 'inherit',
    shell: false,
  });
  if (result.status !== 0) failed.push(name);
}

if (failed.length > 0) {
  console.error('\nFailed:', failed.join(', '));
  process.exit(1);
}

console.log(`\nDone. Built ${gameFolders.length} game(s).`);
