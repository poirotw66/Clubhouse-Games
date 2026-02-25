#!/usr/bin/env node
/**
 * Build the full site for GitHub Pages into OUT_DIR (default: dist).
 * - Copies static assets (menu, specs, docs) to output
 * - Builds each game in Games/ with BASE_URL set and copies dist to output/Games/<name>/
 * Usage: REPO_NAME=Clubhouse-Games node scripts/build-for-pages.mjs
 */

import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const REPO_NAME = process.env.REPO_NAME || 'Clubhouse-Games';
const OUT_DIR = process.env.OUT_DIR || path.join(root, 'dist');

const STATIC_COPY = [
  'index.html',
  'README.md',
  'docs',
  '01-cards',
  '02-board',
  '03-tiles-dice',
  '04-sports-arcade',
  '05-puzzle',
  '06-minigames',
];

function cpRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      cpRecursive(path.join(src, name), path.join(dest, name));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

function getGameFolders() {
  const gamesDir = path.join(root, 'Games');
  if (!fs.existsSync(gamesDir)) return [];
  return fs.readdirSync(gamesDir).filter((name) => {
    const pkg = path.join(gamesDir, name, 'package.json');
    return fs.existsSync(pkg);
  });
}

console.log('Build for GitHub Pages');
console.log('  REPO_NAME:', REPO_NAME);
console.log('  OUT_DIR:', OUT_DIR);

if (fs.existsSync(OUT_DIR)) {
  fs.rmSync(OUT_DIR, { recursive: true });
}
fs.mkdirSync(OUT_DIR, { recursive: true });

for (const name of STATIC_COPY) {
  const src = path.join(root, name);
  if (!fs.existsSync(src)) continue;
  const dest = path.join(OUT_DIR, name);
  console.log('  Copy', name);
  cpRecursive(src, dest);
}

const gameFolders = getGameFolders();
console.log('  Games to build:', gameFolders.length ? gameFolders.join(', ') : '(none)');

for (const name of gameFolders) {
  const gameDir = path.join(root, 'Games', name);
  const baseUrl = `/${REPO_NAME}/Games/${name}/`;
  console.log('  Build', name, 'with BASE_URL=', baseUrl);
  const result = spawnSync('npm', ['run', 'build'], {
    cwd: gameDir,
    env: { ...process.env, BASE_URL: baseUrl },
    stdio: 'inherit',
    shell: true,
  });
  if (result.status !== 0) {
    console.error('Build failed for', name);
    process.exit(1);
  }
  const distDir = path.join(gameDir, 'dist');
  const outGameDir = path.join(OUT_DIR, 'Games', name);
  if (fs.existsSync(distDir)) {
    fs.mkdirSync(path.join(OUT_DIR, 'Games'), { recursive: true });
    cpRecursive(distDir, outGameDir);
    console.log('  Copied', name, '->', outGameDir);
  }
}

console.log('Done. Output in', OUT_DIR);
