#!/usr/bin/env node
/**
 * Decide CI scope for pull_request vs full runs.
 *
 * Outputs GitHub Actions-style key=value lines (and a JSON summary) describing:
 *   full=true|false     — run every game / full Playwright suite
 *   games=...           — space-separated game folder names (empty when full)
 *   astra=true|false    — run gpt6-astra logic checks
 *   reason=...          — why this scope was chosen
 *
 * Full scope when:
 *   - event is not pull_request (push/main, workflow_dispatch)
 *   - CI_FORCE_FULL=1
 *   - shared infra changes (shared/, tests/, scripts/, root config, workflow, data/, site shell)
 *
 * Usage:
 *   node scripts/ci-changed-scope.mjs
 *   BASE_REF=origin/main node scripts/ci-changed-scope.mjs
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const FORCE_FULL = process.env.CI_FORCE_FULL === '1' || process.env.CI_FORCE_FULL === 'true';
const EVENT_NAME = process.env.GITHUB_EVENT_NAME || '';
const BASE_REF =
  process.env.BASE_REF ||
  process.env.GITHUB_BASE_REF ||
  (process.env.GITHUB_EVENT_NAME === 'pull_request' ? 'origin/main' : '');

function listGameFolders() {
  const gamesDir = path.join(root, 'Games');
  if (!fs.existsSync(gamesDir)) return [];
  return fs
    .readdirSync(gamesDir)
    .filter((name) => fs.existsSync(path.join(gamesDir, name, 'package.json')))
    .sort((a, b) => a.localeCompare(b));
}

function gitDiffNames(baseRef) {
  const mergeBase = execFileSync('git', ['merge-base', 'HEAD', baseRef], {
    cwd: root,
    encoding: 'utf8',
  }).trim();
  const out = execFileSync('git', ['diff', '--name-only', `${mergeBase}...HEAD`], {
    cwd: root,
    encoding: 'utf8',
  });
  return out
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Paths that invalidate selective CI — shared infra / site shell / tooling. */
function isSharedInfra(filePath) {
  const patterns = [
    /^\.github\//,
    /^shared\//,
    /^tests\//,
    /^scripts\//,
    /^data\//,
    /^styles\//,
    /^assets\//,
    /^gpt6-astra\//,
    /^package\.json$/,
    /^package-lock\.json$/,
    /^\.nvmrc$/,
    /^playwright\.config\./,
    /^server\.mjs$/,
    /^index\.html$/,
    /^tailwind\.config\./,
    /^postcss\.config\./,
    /^tsconfig/,
  ];
  return patterns.some((re) => re.test(filePath));
}

function gameFromPath(filePath) {
  const match = /^Games\/([^/]+)\//.exec(filePath);
  return match ? match[1] : null;
}

function matrixJson(shards) {
  return JSON.stringify({ shard: shards });
}

/**
 * Full check matrix isolates Coin-Cascade (CPU-heavy physics sim) on its own
 * runner with CHECK_JOBS=1 so it is not contended by sibling games. Remaining
 * games split across three shards.
 */
function checkMatrixJson(scope) {
  if (!scope.full) {
    return JSON.stringify({
      include: [{ id: 'selective', mode: 'filter', shard: '1', total: '1' }],
    });
  }
  return JSON.stringify({
    include: [
      { id: 'coin-cascade', mode: 'solo', shard: 'solo', total: '1' },
      { id: 'rest-1', mode: 'rest', shard: '1', total: '3' },
      { id: 'rest-2', mode: 'rest', shard: '2', total: '3' },
      { id: 'rest-3', mode: 'rest', shard: '3', total: '3' },
    ],
  });
}

function writeOutput(scope) {
  // Full runs shard across runners; selective PRs keep a single shard.
  const lintMatrix = matrixJson(scope.full ? [1, 2] : [1]);
  const checkMatrix = checkMatrixJson(scope);
  const testMatrix = matrixJson(scope.full ? [1, 2, 3, 4] : [1]);

  const lines = [
    `full=${scope.full}`,
    `games=${scope.games.join(' ')}`,
    `astra=${scope.astra}`,
    `reason=${scope.reason}`,
    `lint_matrix=${lintMatrix}`,
    `check_matrix=${checkMatrix}`,
    `test_matrix=${testMatrix}`,
  ];
  for (const line of lines) {
    console.log(line);
  }
  console.log(`scope_json=${JSON.stringify({ ...scope, lintMatrix, checkMatrix, testMatrix })}`);

  const githubOutput = process.env.GITHUB_OUTPUT;
  if (githubOutput) {
    fs.appendFileSync(githubOutput, `${lines.join('\n')}\n`);
  }
}

function main() {
  const allGames = listGameFolders();

  if (FORCE_FULL || EVENT_NAME !== 'pull_request') {
    writeOutput({
      full: true,
      games: allGames,
      astra: true,
      reason: FORCE_FULL ? 'CI_FORCE_FULL' : `event:${EVENT_NAME || 'local'}`,
    });
    return;
  }

  let baseRef = BASE_REF;
  if (baseRef && !baseRef.startsWith('origin/') && !baseRef.includes('/')) {
    baseRef = `origin/${baseRef}`;
  }
  if (!baseRef) {
    writeOutput({
      full: true,
      games: allGames,
      astra: true,
      reason: 'missing-base-ref',
    });
    return;
  }

  let changed;
  try {
    changed = gitDiffNames(baseRef);
  } catch (error) {
    writeOutput({
      full: true,
      games: allGames,
      astra: true,
      reason: `diff-failed:${error.message}`,
    });
    return;
  }

  if (changed.length === 0) {
    writeOutput({
      full: true,
      games: allGames,
      astra: true,
      reason: 'no-diff',
    });
    return;
  }

  const sharedHit = changed.find((filePath) => isSharedInfra(filePath));
  if (sharedHit) {
    writeOutput({
      full: true,
      games: allGames,
      astra: true,
      reason: `shared:${sharedHit}`,
    });
    return;
  }

  const gameSet = new Set();
  let astra = false;
  for (const filePath of changed) {
    if (filePath.startsWith('gpt6-astra/')) {
      astra = true;
      continue;
    }
    const game = gameFromPath(filePath);
    if (game && allGames.includes(game)) {
      gameSet.add(game);
    }
  }

  const games = [...gameSet].sort((a, b) => a.localeCompare(b));
  writeOutput({
    full: false,
    games,
    astra,
    reason: games.length > 0 || astra ? 'selective' : 'no-game-paths',
  });
}

main();
