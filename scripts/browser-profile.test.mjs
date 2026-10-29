import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const cli = fileURLToPath(new URL('../node_modules/@playwright/test/cli.js', import.meta.url));
const { categories } = JSON.parse(fs.readFileSync(new URL('../data/games.json', import.meta.url)));
const games = categories.flatMap((category) => category.games);

// Listing never starts a browser or preview server, and leaves test artifacts intact.
function list({ profile, gameFilter, astraFilter, full } = {}) {
  const env = { ...process.env };
  for (const key of [
    'CLUBHOUSE_TEST_PROFILE', 'CI_GAME_FILTER', 'CI_ASTRA_FILTER', 'SCOPE_FULL',
    'PLAYWRIGHT_JSON_OUTPUT_FILE', 'PLAYWRIGHT_JSON_OUTPUT_DIR', 'PLAYWRIGHT_JSON_OUTPUT_NAME',
  ]) delete env[key];
  if (profile !== undefined) env.CLUBHOUSE_TEST_PROFILE = profile;
  if (gameFilter !== undefined) env.CI_GAME_FILTER = gameFilter;
  if (astraFilter !== undefined) env.CI_ASTRA_FILTER = JSON.stringify(astraFilter);
  if (full !== undefined) env.SCOPE_FULL = String(full);
  const result = spawnSync(process.execPath, [cli, 'test', '--list', '--reporter=json'], {
    cwd: root, env, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
  });
  assert.ifError(result.error);
  if (result.status !== 0) return { ...result, tests: [] };
  const report = JSON.parse(result.stdout);
  const tests = [];
  function collect(suite) {
    for (const spec of suite.specs || []) {
      for (const entry of spec.tests) tests.push({
        title: spec.title, project: entry.projectName, expectedStatus: entry.expectedStatus,
      });
    }
    for (const nested of suite.suites || []) collect(nested);
  }
  for (const suite of report.suites) collect(suite);
  return { ...result, tests };
}

function selected(options) {
  const result = list(options);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  return result.tests;
}

test('unset and explicit full profiles preserve the same complete inventory', () => {
  const defaultTests = selected();
  const fullTests = selected({ profile: 'full' });
  assert.deepEqual(defaultTests, fullTests);
  assert.ok(fullTests.length > 300);
  assert.ok(fullTests.some((entry) => entry.title.includes('daily ghost race records best')));
  assert.ok(fullTests.some((entry) => entry.title.includes('focused start-mode card Space')));
});

test('quick covers every registered game once on desktop and six mobile scenarios', () => {
  const quick = selected({ profile: 'quick' });
  const desktop = quick.filter((entry) => entry.project === 'desktop');
  const mobile = quick.filter((entry) => entry.project === 'mobile');
  for (const game of games.filter((game) => game.gameFolder)) {
    const suffix = game.playPath ? 'static demo loads from the menu' : 'loads from the menu and returns';
    assert.ok(desktop.some((entry) => entry.title === `${game.gameFolder}: ${suffix}`), game.gameFolder);
  }
  // Four shell checks plus the font budget complement the per-game desktop checks.
  assert.equal(desktop.length, games.filter((game) => game.gameFolder).length + 5);
  assert.equal(mobile.length, 6);
  assert.ok(mobile.some((entry) => entry.title.startsWith('memory match:')));
  assert.ok(mobile.some((entry) => entry.title.startsWith('connect four:')));
  assert.ok(mobile.some((entry) => entry.title.startsWith('hub fonts')));
  assert.ok(quick.every((entry) => entry.expectedStatus === 'passed'));
});

test('quick mixed PR scope selects affected games without registering skipped deep tests', () => {
  const quick = selected({
    profile: 'quick', gameFilter: 'Memory-Match', astraFilter: ['train'], full: false,
  });
  assert.equal(quick.length, 10);
  assert.ok(quick.some((entry) => entry.title === 'Memory-Match: loads from the menu and returns'));
  assert.ok(quick.some((entry) => entry.title === 'Astra-train: static demo loads from the menu'));
  assert.ok(quick.some((entry) => entry.project === 'mobile' && entry.title.startsWith('memory match:')));
  assert.ok(quick.every((entry) => !entry.title.startsWith('connect four:')));
  assert.ok(quick.every((entry) => !entry.title.startsWith('hub fonts')));
  assert.ok(quick.every((entry) => entry.expectedStatus === 'passed'));
});

test('quick static-only scope keeps shell coverage without unavailable games', () => {
  const quick = selected({
    profile: 'quick', gameFilter: '__none__', astraFilter: [], full: false,
  });
  assert.equal(quick.length, 7);
  assert.equal(quick.filter((entry) => entry.project === 'desktop').length, 4);
  assert.equal(quick.filter((entry) => entry.project === 'mobile').length, 3);
  assert.ok(quick.every((entry) => entry.expectedStatus === 'passed'));
});

test('unknown profiles fail instead of silently reducing coverage', () => {
  for (const profile of ['fast', '']) {
    const result = list({ profile });
    assert.notEqual(result.status, 0);
    assert.match(result.stdout + result.stderr, /Invalid CLUBHOUSE_TEST_PROFILE:/);
  }
});
