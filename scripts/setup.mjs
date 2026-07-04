#!/usr/bin/env node
/**
 * Install root and all game subproject dependencies under Games/.
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

function runInstall(cwd, label) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync('npm', ['install'], {
    cwd,
    stdio: 'inherit',
    shell: true,
  });
  if (result.status !== 0) {
    console.error(`Failed: ${label}`);
    process.exit(result.status ?? 1);
  }
}

runInstall(root, 'root');

const gameFolders = getGameFolders();
for (const name of gameFolders) {
  runInstall(path.join(root, 'Games', name), `Games/${name}`);
}

console.log(`\nDone. Installed root + ${gameFolders.length} game(s).`);

console.log('\n=== build menu CSS ===');
const cssResult = spawnSync('npm', ['run', 'build:css'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
});
if (cssResult.status !== 0) {
  process.exit(cssResult.status ?? 1);
}
