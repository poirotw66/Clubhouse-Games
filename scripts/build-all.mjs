#!/usr/bin/env node
/**
 * Build every game into Games/<name>/dist/ (local relative base).
 * Usage: npm run build:all
 *
 * Parallelism: BUILD_JOBS or --jobs N (default: CPU count).
 * Optional filters: npm run build:all -- Coin Memory
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { mapPool, resolveJobCount } from './lib/parallel.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function parseArgs(argv) {
  const filters = [];
  let jobs = null;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
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
  return { filters, jobs };
}

function getGameFolders() {
  const gamesDir = path.join(root, 'Games');
  if (!fs.existsSync(gamesDir)) return [];
  return fs
    .readdirSync(gamesDir)
    .filter((name) => fs.existsSync(path.join(gamesDir, name, 'package.json')))
    .sort((a, b) => a.localeCompare(b));
}

function runBuild(name) {
  return new Promise((resolve) => {
    const child = spawn('node', [path.join(__dirname, 'build-game.mjs'), name], {
      cwd: root,
      shell: false,
      env: process.env,
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

const { filters, jobs } = parseArgs(process.argv.slice(2));
let gameFolders = getGameFolders();
if (filters.length > 0) {
  gameFolders = gameFolders.filter((name) => {
    const lower = name.toLowerCase();
    return filters.some((filter) => lower.includes(filter.toLowerCase()));
  });
}

if (gameFolders.length === 0) {
  console.log('No games to build.');
  process.exit(filters.length > 0 ? 1 : 0);
}

const concurrency = Math.min(jobs, gameFolders.length);
console.log(
  `Building ${gameFolders.length} game(s) with ${concurrency} job(s): ${gameFolders.join(', ')}\n`,
);

const wallStart = performance.now();
const results = await mapPool(gameFolders, concurrency, async (name) => {
  const start = performance.now();
  const result = await runBuild(name);
  const durationSec = (performance.now() - start) / 1000;
  console.log(`=== Build Games/${name} (${durationSec.toFixed(2)}s) ===`);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    console.log(`=== Games/${name}: FAILED (exit ${result.status}) ===`);
  }
  return { ...result, durationSec };
});

const wallSec = (performance.now() - wallStart) / 1000;
const failed = results.filter((row) => row.status !== 0).map((row) => row.name);
results
  .slice()
  .sort((a, b) => b.durationSec - a.durationSec)
  .forEach((row) => {
    const mark = row.status === 0 ? 'ok' : 'FAIL';
    console.log(`${row.durationSec.toFixed(2).padStart(7)}s  ${mark.padEnd(4)}  ${row.name}`);
  });
console.log(`wall ${wallSec.toFixed(2)}s across ${results.length} game(s), ${concurrency} job(s)`);

if (failed.length > 0) {
  console.error('\nFailed:', failed.join(', '));
  process.exit(1);
}

console.log(`\nDone. Built ${gameFolders.length} game(s).`);
