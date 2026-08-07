#!/usr/bin/env node
/**
 * Install all workspace dependencies once at the repo root.
 * Games live under Games/* as npm workspaces — no per-game npm install.
 * Also refreshes the overview menu and menu CSS so `npm run dev` is usable.
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

function run(label, command, args) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: false,
  });
  if (result.status !== 0) {
    console.error(`Failed: ${label}`);
    process.exit(result.status ?? 1);
  }
}

run('root (npm workspaces)', 'npm', ['install']);

const gameFolders = getGameFolders();
console.log(`\nInstalled root + ${gameFolders.length} workspace game(s).`);

run('generate menu + README', 'npm', ['run', 'generate']);
run('build menu CSS', 'npm', ['run', 'build:css']);

console.log(`
Setup complete.

Next:
  npm run build          # build every game into Games/<name>/dist/
  npm run build:game X   # build one game (folder name under Games/)
  npm run dev            # http://localhost:3000
`);
