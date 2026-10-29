#!/usr/bin/env node
/**
 * Decide affected coverage independently from quick/full validation depth.
 *
 * Outputs GitHub Actions-style key=value lines (and a JSON summary) describing:
 *   full=true|false     — build/typecheck/check every game
 *   test_profile=...    — quick automatic checks or full manual validation
 *   games=...           — space-separated game folder names (empty when full)
 *   astra=true|false    — whether any gpt6-astra demos are affected
 *   astra_games=[...]   — JSON array of affected Astra directory names
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
import { fileURLToPath, pathToFileURL } from 'node:url';

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

function listAstraGames() {
  const { categories } = JSON.parse(fs.readFileSync(path.join(root, 'data/games.json'), 'utf8'));
  return categories.flatMap((category) => category.games)
    .map((game) => /^gpt6-astra\/([^/]+)\/$/.exec(game.playPath || '')?.[1])
    .filter(Boolean)
    .sort();
}

function gitDiffNames(baseRef) {
  const mergeBase = execFileSync('git', ['merge-base', 'HEAD', baseRef], {
    cwd: root,
    encoding: 'utf8',
  }).trim();
  // Treat moves as deletion + addition so both dependent demos/games are checked.
  const out = execFileSync('git', ['diff', '--no-renames', '--name-only', '-z', `${mergeBase}...HEAD`], {
    cwd: root,
    encoding: 'utf8',
  });
  return out
    .split('\0')
    .filter(Boolean);
}

/** Paths that invalidate selective CI — shared infra / site shell / tooling. */
function isSharedInfra(filePath, allAstraGames) {
  // Only registered demos are isolated. Gallery files, vendor/shared assets,
  // and unknown paths conservatively invalidate the whole site.
  if (filePath.startsWith('gpt6-astra/')) {
    const demo = /^gpt6-astra\/([^/]+)\//.exec(filePath)?.[1];
    return !allAstraGames.includes(demo);
  }
  const patterns = [
    /^\.github\//,
    /^shared\//,
    /^tests\//,
    /^scripts\//,
    /^data\//,
    /^styles\//,
    /^assets\//,
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
function checkMatrixJson(scope, profile) {
  if (!scope.full) {
    return JSON.stringify({
      include: [{ id: 'selective', mode: 'filter', shard: '1', total: '1' }],
    });
  }
  if (profile === 'quick') {
    return JSON.stringify({
      include: [{ id: 'quick', mode: 'quick', shard: '1', total: '1' }],
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

export function resolveTestProfile(raw = process.env.CLUBHOUSE_TEST_PROFILE, forceFull = FORCE_FULL) {
  const profile = raw || 'full';
  if (profile !== 'quick' && profile !== 'full') {
    throw new Error('CLUBHOUSE_TEST_PROFILE must be quick or full.');
  }
  return forceFull ? 'full' : profile;
}

function writeOutput(scope) {
  const profile = resolveTestProfile();
  // Coverage can include every game while validation remains a quick smoke run.
  const lintMatrix = matrixJson(scope.full ? [1, 2] : [1]);
  const checkMatrix = checkMatrixJson(scope, profile);
  const testMatrix = matrixJson(scope.full && profile === 'full' ? [1, 2, 3, 4] : [1]);

  const lines = [
    `full=${scope.full}`,
    `test_profile=${profile}`,
    `games=${scope.games.join(' ')}`,
    `astra=${scope.astra}`,
    `astra_games=${JSON.stringify(scope.astraGames)}`,
    `reason=${scope.reason.replace(/[\r\n]/g, ' ')}`,
    `lint_matrix=${lintMatrix}`,
    `check_matrix=${checkMatrix}`,
    `test_matrix=${testMatrix}`,
  ];
  for (const line of lines) {
    console.log(line);
  }
  console.log(`scope_json=${JSON.stringify({ ...scope, testProfile: profile, lintMatrix, checkMatrix, testMatrix })}`);

  const githubOutput = process.env.GITHUB_OUTPUT;
  if (githubOutput) {
    fs.appendFileSync(githubOutput, `${lines.join('\n')}\n`);
  }
}

export function resolveChangedScope(changed, allGames, allAstraGames) {
  const full = (reason) => ({
    full: true, games: allGames, astra: true, astraGames: allAstraGames, reason,
  });
  if (changed.length === 0) return full('no-diff');
  const sharedHit = changed.find((filePath) => isSharedInfra(filePath, allAstraGames));
  if (sharedHit) return full(`shared:${sharedHit}`);

  const gameSet = new Set();
  const astraSet = new Set();
  for (const filePath of changed) {
    const astraGame = /^gpt6-astra\/([^/]+)\//.exec(filePath)?.[1];
    if (astraGame) astraSet.add(astraGame);
    const game = gameFromPath(filePath);
    // Deleted or unregistered workspace folders need the full consistency checks.
    if (game && !allGames.includes(game)) return full(`unknown-game:${game}`);
    if (game) gameSet.add(game);
  }
  const games = [...gameSet].sort((a, b) => a.localeCompare(b));
  const astraGames = [...astraSet].sort();
  return {
    full: false,
    games,
    astra: astraGames.length > 0,
    astraGames,
    reason: games.length > 0 || astraGames.length > 0 ? 'selective' : 'no-game-paths',
  };
}

function main() {
  const allGames = listGameFolders();
  const allAstraGames = listAstraGames();
  const writeFull = (reason) => writeOutput({
    full: true, games: allGames, astra: true, astraGames: allAstraGames, reason,
  });
  if (FORCE_FULL || EVENT_NAME !== 'pull_request') {
    writeFull(FORCE_FULL ? 'CI_FORCE_FULL' : `event:${EVENT_NAME || 'local'}`);
    return;
  }

  let baseRef = BASE_REF;
  if (baseRef && !baseRef.startsWith('origin/') && !baseRef.includes('/')) {
    baseRef = `origin/${baseRef}`;
  }
  if (!baseRef) {
    writeFull('missing-base-ref');
    return;
  }

  let changed;
  try {
    changed = gitDiffNames(baseRef);
  } catch (error) {
    writeFull(`diff-failed:${error.message}`);
    return;
  }

  writeOutput(resolveChangedScope(changed, allGames, allAstraGames));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main();
}
