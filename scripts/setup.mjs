#!/usr/bin/env node
/**
 * Install all workspace dependencies once at the repo root.
 * Games live under Games/* as npm workspaces — no per-game npm install.
 * Usage: npm run setup
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

console.log('\n=== root (npm workspaces) ===');
const result = spawnSync('npm', ['install'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
});
if (result.status !== 0) {
  console.error('Failed: npm install at root');
  process.exit(result.status ?? 1);
}

const gameFolders = getGameFolders();
console.log(`\nDone. Installed root + ${gameFolders.length} workspace game(s).`);

console.log('\n=== build menu CSS ===');
const cssResult = spawnSync('npm', ['run', 'build:css'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
});
if (cssResult.status !== 0) {
  process.exit(cssResult.status ?? 1);
}
