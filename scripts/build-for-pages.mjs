#!/usr/bin/env node
/**
 * Build the full site for GitHub Pages into OUT_DIR (default: dist).
 * - Copies static assets (menu, specs, docs) to output
 * - Builds each game in Games/ with BASE_URL set and copies dist to output/Games/<name>/
 * Usage: REPO_NAME=Clubhouse-Games node scripts/build-for-pages.mjs
 *
 * Parallelism: BUILD_JOBS or --jobs N (default: CPU count).
 * Optional filters (after options) limit which games are Vite-built; static shell
 * is always produced. Example: node scripts/build-for-pages.mjs --jobs 4 Memory
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { mapPool, resolveJobCount } from './lib/parallel.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const REPO_NAME = process.env.REPO_NAME || 'Clubhouse-Games';
const OUT_DIR = process.env.OUT_DIR || path.join(root, 'dist');

const STATIC_COPY = [
  'index.html',
  'assets',
  'README.md',
  'docs',
  '01-cards',
  '02-board',
  '03-tiles-dice',
  '04-sports-arcade',
  '05-puzzle',
  '06-minigames',
  '07-astra',
  // Static GPT-6 / Astra one-shots (no Vite build); linked via playPath in games.json.
  'gpt6-astra',
];

function parseArgs(argv) {
  const filters = [];
  let jobs = null;
  let staticOnly = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--static-only') {
      staticOnly = true;
      continue;
    }
    if (arg === '--jobs' || arg === '-j') {
      jobs = Number.parseInt(argv[++i], 10);
      continue;
    }
    if (arg.startsWith('--jobs=')) {
      jobs = Number.parseInt(arg.slice('--jobs='.length), 10);
      continue;
    }
    if (arg.startsWith('-j') && arg.length > 2) {
      jobs = Number.parseInt(arg.slice(2), 10);
      continue;
    }
    if (arg.startsWith('-')) {
      console.error(`Unknown option: ${arg}`);
      process.exit(1);
    }
    filters.push(arg);
  }
  if (jobs === null) jobs = resolveJobCount('BUILD_JOBS');
  if (!Number.isInteger(jobs) || jobs < 1) {
    console.error(`Invalid --jobs value: ${jobs}`);
    process.exit(1);
  }
  return { filters, jobs, staticOnly };
}

function cpRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      cpRecursive(path.join(src, name), path.join(dest, name));
    }
  } else {
    // Original cover masters stay in the repository; the site uses derivatives.
    if (path.dirname(src) === path.join(root, 'assets', 'covers') && src.endsWith('.jpg')) {
      const derivative = path.join(path.dirname(src), 'optimized', `${path.basename(src, '.jpg')}-640.jpg`);
      if (fs.existsSync(derivative)) return;
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

function getGameFolders() {
  const gamesDir = path.join(root, 'Games');
  if (!fs.existsSync(gamesDir)) return [];
  return fs
    .readdirSync(gamesDir)
    .filter((name) => {
      const pkg = path.join(gamesDir, name, 'package.json');
      return fs.existsSync(pkg);
    })
    .sort((a, b) => a.localeCompare(b));
}

function runGameBuild(name, baseUrl) {
  return new Promise((resolve) => {
    const gameDir = path.join(root, 'Games', name);
    const child = spawn('npm', ['run', 'build'], {
      cwd: gameDir,
      env: { ...process.env, BASE_URL: baseUrl },
      shell: false,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('close', (code, signal) => {
      resolve({ name, status: signal ? 1 : code ?? 1, stdout, stderr });
    });
    child.on('error', (error) => {
      resolve({ name, status: 1, stdout, stderr: `${stderr}${error.message}\n` });
    });
  });
}

const { filters, jobs, staticOnly } = parseArgs(process.argv.slice(2));

console.log('Build for GitHub Pages');
console.log('  REPO_NAME:', REPO_NAME);
console.log('  OUT_DIR:', OUT_DIR);
console.log('  BUILD_JOBS:', jobs);
if (staticOnly) console.log('  static-only: true');

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

let gameFolders = staticOnly ? [] : getGameFolders();
if (!staticOnly && filters.length > 0) {
  gameFolders = gameFolders.filter((name) => {
    const lower = name.toLowerCase();
    return filters.some((filter) => lower.includes(filter.toLowerCase()));
  });
  if (gameFolders.length === 0) {
    console.error(`No games matched filter(s): ${filters.join(', ')}`);
    process.exit(1);
  }
}

console.log('  Games to build:', gameFolders.length ? gameFolders.join(', ') : '(none)');

const concurrency = Math.min(jobs, Math.max(1, gameFolders.length));
const wallStart = performance.now();
const results = await mapPool(gameFolders, concurrency, async (name) => {
  const baseUrl = `/${REPO_NAME}/Games/${name}/`;
  const start = performance.now();
  console.log('  Build', name, 'with BASE_URL=', baseUrl);
  const result = await runGameBuild(name, baseUrl);
  const durationSec = (performance.now() - start) / 1000;
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    return { ...result, durationSec };
  }
  const distDir = path.join(root, 'Games', name, 'dist');
  const outGameDir = path.join(OUT_DIR, 'Games', name);
  if (!fs.existsSync(path.join(distDir, 'index.html'))) {
    return {
      name,
      status: 1,
      stdout: result.stdout,
      stderr: `${result.stderr}${name} built without dist/index.html\n`,
      durationSec,
    };
  }
  fs.mkdirSync(path.join(OUT_DIR, 'Games'), { recursive: true });
  cpRecursive(distDir, outGameDir);
  console.log('  Copied', name, '->', outGameDir, `(${durationSec.toFixed(2)}s)`);
  return { ...result, durationSec };
});

const failed = results.filter((row) => row.status !== 0);
if (failed.length > 0) {
  for (const row of failed) {
    console.error('Build failed for', row.name);
    if (row.stderr) process.stderr.write(row.stderr);
  }
  process.exit(1);
}

const wallSec = (performance.now() - wallStart) / 1000;
console.log(
  `Done. Output in ${OUT_DIR} (games builds wall ${wallSec.toFixed(2)}s, ${concurrency} job(s))`,
);
