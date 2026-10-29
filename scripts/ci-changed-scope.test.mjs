import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveChangedScope, resolveTestProfile } from './ci-changed-scope.mjs';
import { includesAstra } from '../tests/browser/astra-filter.mjs';

const games = ['Memory-Match', 'Wall-Flip'];
const demos = ['archer', 'train', 'webmcp-mini-factory'];
const scope = (changed) => resolveChangedScope(changed, games, demos);

test('an isolated Astra demo selects only its own checks and no Vite builds', () => {
  assert.deepEqual(scope(['gpt6-astra/train/rules.mjs']), {
    full: false, games: [], astra: true, astraGames: ['train'], reason: 'selective',
  });
});

test('mixed changes deduplicate and retain both game families', () => {
  const result = scope([
    'Games/Wall-Flip/index.html', 'gpt6-astra/train/index.html',
    'gpt6-astra/archer/rules.mjs', 'gpt6-astra/train/rules.mjs',
  ]);
  assert.equal(result.full, false);
  assert.deepEqual(result.games, ['Wall-Flip']);
  assert.deepEqual(result.astraGames, ['archer', 'train']);
});

test('gallery, shared assets, unknown demos, and root infrastructure stay full', () => {
  for (const file of [
    'gpt6-astra/index.html', 'gpt6-astra/manifest.json',
    'gpt6-astra/shared/sfx.mjs', 'gpt6-astra/vendor/three/build/three.module.min.js',
    'gpt6-astra/thumbs/train.webp', 'gpt6-astra/new-demo/index.html',
    'shared/juice.ts', 'data/games.json', 'scripts/build-for-pages.mjs',
    'tests/browser/site.spec.mjs', '.github/workflows/build.yml', 'package-lock.json',
  ]) {
    const result = scope([file]);
    assert.equal(result.full, true, file);
    assert.deepEqual(result.games, games, file);
    assert.deepEqual(result.astraGames, demos, file);
  }
});

test('empty diff and removed workspace folders fail safe to full coverage', () => {
  assert.equal(scope([]).full, true);
  assert.equal(scope(['Games/Removed/package.json']).full, true);
});

test('workspace-only changes do not run Astra interactions', () => {
  const result = scope(['Games/Memory-Match/src/App.tsx']);
  assert.deepEqual(result.games, ['Memory-Match']);
  assert.deepEqual(result.astraGames, []);
  assert.equal(result.astra, false);
});

test('documentation-only changes keep the shell without building games', () => {
  const result = scope(['README.md', '07-astra/train.md']);
  assert.equal(result.full, false);
  assert.equal(result.reason, 'no-game-paths');
  assert.deepEqual(result.games, []);
  assert.deepEqual(result.astraGames, []);
});

test('browser filter runs all locally and exactly the selected CI demos', () => {
  assert.equal(includesAstra('train', ''), true);
  assert.equal(includesAstra('train', '[]'), false);
  assert.equal(includesAstra('train', '["train"]'), true);
  assert.equal(includesAstra('archer', '["train"]'), false);
  assert.throws(() => includesAstra('train', 'invalid'));
  assert.throws(() => includesAstra('train', '{}'));
  assert.throws(() => includesAstra('train', '[null]'));
});

test('main pushes and forced PR runs still emit complete scopes', () => {
  for (const overrides of [
    { GITHUB_EVENT_NAME: 'push', CI_FORCE_FULL: '' },
    { GITHUB_EVENT_NAME: 'pull_request', CI_FORCE_FULL: '1', BASE_REF: 'missing-ref' },
  ]) {
    const env = { ...process.env, ...overrides };
    delete env.GITHUB_OUTPUT;
    const stdout = execFileSync(process.execPath, [
      fileURLToPath(new URL('./ci-changed-scope.mjs', import.meta.url)),
    ], { env, encoding: 'utf8' });
    const result = JSON.parse(stdout.split('\n').find((line) => line.startsWith('scope_json=')).slice(11));
    assert.equal(result.full, true);
    assert.ok(result.games.includes('Wall-Flip'));
    assert.ok(result.astraGames.includes('train'));
    assert.ok(result.astraGames.includes('webmcp-mini-factory'));
  }
});


test('cross-directory moves select both source and destination game families', () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'clubhouse-scope-moves-')));
  const git = (...args) => execFileSync('git', [
    '-c', 'user.name=Scope Test', '-c', 'user.email=scope@example.invalid',
    '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', ...args,
  ], { cwd: root, encoding: 'utf8' });
  const write = (file, text) => {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text);
  };
  try {
    git('init', '-q');
    git('config', 'diff.renames', 'true');
    write('scripts/ci-changed-scope.mjs', fs.readFileSync(new URL('./ci-changed-scope.mjs', import.meta.url)));
    write('data/games.json', JSON.stringify({ categories: [{ games: [
      { playPath: 'gpt6-astra/train/' }, { playPath: 'gpt6-astra/archer/' },
    ] }] }));
    for (const game of games) write(`Games/${game}/package.json`, '{}');
    write('gpt6-astra/train/rules.mjs', 'export const rule = 1;\n');
    write('Games/Memory-Match/src/rules.js', 'export const matchRule = 2;\n');
    git('add', '.');
    git('commit', '-qm', 'Fixture base');
    git('branch', 'fixture-base');
    fs.mkdirSync(path.join(root, 'gpt6-astra/archer'), { recursive: true });
    fs.renameSync(path.join(root, 'gpt6-astra/train/rules.mjs'), path.join(root, 'gpt6-astra/archer/rules.mjs'));
    fs.mkdirSync(path.join(root, 'Games/Wall-Flip/src'), { recursive: true });
    fs.renameSync(path.join(root, 'Games/Memory-Match/src/rules.js'), path.join(root, 'Games/Wall-Flip/src/rules.js'));
    git('add', '.');
    git('commit', '-qm', 'Move rules across demos and workspace games');
    assert.match(git('diff', '--name-status', 'fixture-base...HEAD'),
      /R100\s+gpt6-astra\/train\/rules\.mjs\s+gpt6-astra\/archer\/rules\.mjs/);
    const env = {
      ...process.env, GITHUB_EVENT_NAME: 'pull_request', CI_FORCE_FULL: '',
      BASE_REF: 'refs/heads/fixture-base',
    };
    delete env.GITHUB_OUTPUT;
    const stdout = execFileSync(process.execPath, [path.join(root, 'scripts/ci-changed-scope.mjs')], {
      cwd: root, env, encoding: 'utf8',
    });
    const result = JSON.parse(stdout.split('\n').find((line) => line.startsWith('scope_json=')).slice(11));
    assert.equal(result.full, false);
    assert.deepEqual(result.games, games);
    assert.deepEqual(result.astraGames, ['archer', 'train']);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Unicode and newline filenames retain scope and cannot split GitHub output lines', () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'clubhouse-scope-paths-')));
  const git = (...args) => execFileSync('git', [
    '-c', 'user.name=Scope Test', '-c', 'user.email=scope@example.invalid',
    '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', ...args,
  ], { cwd: root, encoding: 'utf8' });
  const write = (file, text) => {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text);
  };
  try {
    git('init', '-q');
    git('config', 'core.quotePath', 'true');
    write('scripts/ci-changed-scope.mjs', fs.readFileSync(new URL('./ci-changed-scope.mjs', import.meta.url)));
    write('data/games.json', JSON.stringify({ categories: [{ games: [
      { playPath: 'gpt6-astra/train/' }, { playPath: 'gpt6-astra/archer/' },
    ] }] }));
    for (const game of games) write(`Games/${game}/package.json`, '{}');
    git('add', '.');
    git('commit', '-qm', 'Fixture base');
    git('branch', 'fixture-base');
    write('gpt6-astra/train/caf\u00e9.mjs', 'export const rule = 1;\n');
    write('gpt6-astra/archer/rules\nnext.mjs', 'export const rule = 2;\n');
    write('Games/Memory-Match/public/\u5922.mp3', 'Fixture audio');
    write('Games/Wall-Flip/rules\nnext.js', 'const rule = 3;\n');
    git('add', '.');
    git('commit', '-qm', 'Add Unicode and newline game filenames');
    const outputFile = path.join(root, '.git/scope-output');
    const env = {
      ...process.env, GITHUB_EVENT_NAME: 'pull_request', CI_FORCE_FULL: '',
      BASE_REF: 'refs/heads/fixture-base', GITHUB_OUTPUT: outputFile,
    };
    const runScope = () => {
      fs.writeFileSync(outputFile, '');
      const stdout = execFileSync(process.execPath, [path.join(root, 'scripts/ci-changed-scope.mjs')], {
        cwd: root, env, encoding: 'utf8',
      });
      return JSON.parse(stdout.split('\n').find((line) => line.startsWith('scope_json=')).slice(11));
    };
    const selective = runScope();
    assert.equal(selective.full, false);
    assert.deepEqual(selective.games, games);
    assert.deepEqual(selective.astraGames, ['archer', 'train']);
    const sharedFile = 'assets/\u5922\r\nsettings.json';
    write(sharedFile, '{}');
    git('add', '.');
    git('commit', '-qm', 'Add shared Unicode asset with line breaks');
    const full = runScope();
    assert.equal(full.full, true);
    assert.equal(full.reason, `shared:${sharedFile}`);
    const output = fs.readFileSync(outputFile, 'utf8');
    assert.ok(!output.includes('\r'));
    const lines = output.trimEnd().split('\n');
    assert.equal(lines.length, 9);
    assert.ok(lines.every((line) => /^[a-z_]+=/.test(line)));
    assert.ok(lines.includes(`reason=shared:${sharedFile.replace(/[\r\n]/g, ' ')}`));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('validation profiles are explicit and force-full retains complete validation', () => {
  assert.equal(resolveTestProfile('', false), 'full');
  assert.equal(resolveTestProfile('quick', false), 'quick');
  assert.equal(resolveTestProfile('full', false), 'full');
  assert.equal(resolveTestProfile('quick', true), 'full');
  assert.throws(() => resolveTestProfile('typo', false), /must be quick or full/);
});

test('quick main coverage uses one check and browser runner; manual full retains all shards', () => {
  for (const profile of ['quick', 'full']) {
    const env = {
      ...process.env, GITHUB_EVENT_NAME: profile === 'quick' ? 'push' : 'workflow_dispatch',
      CLUBHOUSE_TEST_PROFILE: profile, CI_FORCE_FULL: '',
    };
    delete env.GITHUB_OUTPUT;
    const stdout = execFileSync(process.execPath, [
      fileURLToPath(new URL('./ci-changed-scope.mjs', import.meta.url)),
    ], { env, encoding: 'utf8' });
    const result = JSON.parse(stdout.split('\n').find((line) => line.startsWith('scope_json=')).slice(11));
    assert.equal(result.full, true);
    assert.equal(result.testProfile, profile);
    assert.equal(JSON.parse(result.lintMatrix).shard.length, 2);
    assert.equal(JSON.parse(result.checkMatrix).include.length, profile === 'quick' ? 1 : 4);
    assert.equal(JSON.parse(result.testMatrix).shard.length, profile === 'quick' ? 1 : 4);
  }
});
