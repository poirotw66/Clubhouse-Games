#!/usr/bin/env node
/**
 * Run an npm script in every game that defines it, and fail if any of them do.
 * Games without the script are skipped, not treated as failures — not every
 * game has a typecheck or a logic check.
 *
 * Runs with bounded concurrency (default: CPU count). Output is buffered per
 * game so parallel runs stay readable. By default every matching game runs and
 * failures are collected at the end (same quality bar as serial CI).
 *
 * Usage:
 *   node scripts/run-in-games.mjs <script-name> [options] [game-filter...]
 *
 * Options:
 *   --jobs N, -j N   Max concurrent games (default: CPU count; env CHECK_JOBS)
 *   --fail-fast      Stop scheduling new games after the first failure
 *
 * Positional filters (after options) match game folder names case-insensitively
 * as substrings. Example: node scripts/run-in-games.mjs check Coin Big-Two
 */

import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function cpuCount() {
  if (typeof os.availableParallelism === 'function') {
    return os.availableParallelism();
  }
  return Math.max(1, os.cpus()?.length || 1);
}

function parseArgs(argv) {
  const positional = [];
  let jobs = null;
  let failFast = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--fail-fast') {
      failFast = true;
      continue;
    }
    if (arg === '--jobs' || arg === '-j') {
      const raw = argv[i + 1];
      if (raw === undefined || raw.startsWith('-')) {
        console.error(`Missing value for ${arg}`);
        process.exit(1);
      }
      jobs = Number.parseInt(raw, 10);
      i += 1;
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
    positional.push(arg);
  }

  const scriptName = positional[0];
  const filters = positional.slice(1);

  if (jobs === null) {
    const fromEnv = process.env.CHECK_JOBS;
    if (fromEnv !== undefined && fromEnv !== '') {
      jobs = Number.parseInt(fromEnv, 10);
    } else {
      jobs = cpuCount();
    }
  }

  if (!Number.isInteger(jobs) || jobs < 1) {
    console.error(`Invalid --jobs value (need a positive integer): ${jobs}`);
    process.exit(1);
  }

  return { scriptName, filters, jobs, failFast };
}

function runNpmScript(gameDir, scriptName) {
  return new Promise((resolve) => {
    const child = spawn('npm', ['run', scriptName], {
      cwd: gameDir,
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
    child.on('error', (error) => {
      resolve({
        status: 1,
        stdout,
        stderr: `${stderr}${error.message}\n`,
      });
    });
    child.on('close', (code, signal) => {
      resolve({
        status: signal ? 1 : code ?? 1,
        stdout,
        stderr,
      });
    });
  });
}

function printGameResult(name, scriptName, result, durationSec) {
  console.log(`=== ${name}: npm run ${scriptName} (${durationSec.toFixed(2)}s) ===`);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    console.log(`=== ${name}: FAILED (exit ${result.status}) ===`);
  }
}

const { scriptName, filters, jobs, failFast } = parseArgs(process.argv.slice(2));
if (!scriptName) {
  console.error(
    'Usage: node scripts/run-in-games.mjs <script-name> [--jobs N] [--fail-fast] [game-filter...]',
  );
  process.exit(1);
}

const gamesDir = path.join(root, 'Games');
if (!fs.existsSync(gamesDir)) {
  console.log('No Games/ directory.');
  process.exit(0);
}

let games = fs.readdirSync(gamesDir).filter((name) => {
  const pkgPath = path.join(gamesDir, name, 'package.json');
  if (!fs.existsSync(pkgPath)) return false;
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return Boolean(pkg.scripts?.[scriptName]);
  } catch {
    return false;
  }
});

if (filters.length > 0) {
  games = games.filter((name) => {
    const lower = name.toLowerCase();
    return filters.some((filter) => lower.includes(filter.toLowerCase()));
  });
  if (games.length === 0) {
    console.error(
      `No game with "${scriptName}" matched filter(s): ${filters.join(', ')}`,
    );
    process.exit(1);
  }
}

games.sort((a, b) => a.localeCompare(b));

if (games.length === 0) {
  console.log(`No game defines an npm "${scriptName}" script.`);
  process.exit(0);
}

const concurrency = Math.min(jobs, games.length);
console.log(
  `Running "${scriptName}" in ${games.length} game(s) with ${concurrency} job(s)` +
    `${failFast ? ' (fail-fast)' : ''}: ${games.join(', ')}\n`,
);

const failed = [];
const timings = [];
let nextIndex = 0;
let stopScheduling = false;
const wallStart = performance.now();

async function worker() {
  while (true) {
    if (stopScheduling) return;
    const index = nextIndex;
    nextIndex += 1;
    if (index >= games.length) return;

    const name = games[index];
    const start = performance.now();
    const result = await runNpmScript(path.join(gamesDir, name), scriptName);
    const durationSec = (performance.now() - start) / 1000;
    timings.push({ name, durationSec, ok: result.status === 0 });
    printGameResult(name, scriptName, result, durationSec);

    if (result.status !== 0) {
      failed.push(name);
      if (failFast) stopScheduling = true;
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));

const wallSec = (performance.now() - wallStart) / 1000;
timings.sort((a, b) => b.durationSec - a.durationSec);

console.log('\n--- per-game wall time (slowest first) ---');
for (const row of timings) {
  const mark = row.ok ? 'ok' : 'FAIL';
  console.log(`${row.durationSec.toFixed(2).padStart(7)}s  ${mark.padEnd(4)}  ${row.name}`);
}
console.log(`wall ${wallSec.toFixed(2)}s across ${timings.length} game(s), ${concurrency} job(s)`);

if (failed.length > 0) {
  const skipped = stopScheduling
    ? games.filter((name) => !timings.some((row) => row.name === name))
    : [];
  console.error(`\n"${scriptName}" failed in: ${failed.join(', ')}`);
  if (skipped.length > 0) {
    console.error(`Not started (fail-fast): ${skipped.join(', ')}`);
  }
  process.exit(1);
}

console.log(`\nDone. "${scriptName}" passed in ${timings.length} game(s).`);
