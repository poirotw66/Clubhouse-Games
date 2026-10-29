import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

// Isolated fixture: never alter the real games to test missing coverage.
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'clubhouse-runner-'));
fs.mkdirSync(path.join(root, 'scripts'));
fs.copyFileSync(new URL('./run-in-games.mjs', import.meta.url), path.join(root, 'scripts/run-in-games.mjs'));
for (const [name, scripts] of Object.entries({
  Covered: { lint: 'node -e "process.exit(0)"', check: 'node -e "process.exit(0)"' },
  Missing: {},
})) {
  const directory = path.join(root, 'Games', name);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify({ name: name.toLowerCase(), scripts }));
}
after(() => fs.rmSync(root, { recursive: true, force: true }));

function run(...args) {
  const result = spawnSync(process.execPath, [path.join(root, 'scripts/run-in-games.mjs'), ...args], {
    cwd: root, encoding: 'utf8', env: { ...process.env, CHECK_JOBS: '1' },
  });
  assert.ifError(result.error);
  return { status: result.status, output: result.stdout + result.stderr };
}

for (const script of ['lint', 'check']) {
  test(`${script}: full and selective runs fail missing coverage`, () => {
    for (const filters of [[], ['Missing'], ['Covered', 'Missing']]) {
      const result = run(script, ...filters);
      assert.equal(result.status, 1);
      assert.match(result.output, new RegExp(`Missing npm "${script}" script in: Missing`));
    }
  });
  test(`${script}: selecting a covered game succeeds`, () => {
    const result = run(script, 'Covered');
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /passed in 1 game/);
  });
}

test('optional scripts explicitly report skipped games', () => {
  for (const filters of [[], ['Missing']]) {
    const result = run('balance', ...filters);
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /Skipped \(optional script\): .*Missing/);
  }
});

test('exclusions and shards apply before missing coverage is evaluated', () => {
  const excluded = run('check', '--exclude', 'Missing');
  assert.equal(excluded.status, 0, excluded.output);
  const first = run('check', '--shard', '1/2');
  assert.equal(first.status, 0, first.output);
  const second = run('check', '--shard', '2/2');
  assert.equal(second.status, 1);
  assert.match(second.output, /Missing npm "check" script in: Missing/);
});

test('unknown game filters fail instead of claiming success', () => {
  const result = run('check', 'Does-Not-Exist');
  assert.equal(result.status, 1);
  assert.match(result.output, /No game matched filter/);
});

test('invalid validation profiles fail before any selected checks run', () => {
  const result = spawnSync(process.execPath, [path.join(root, 'scripts/run-in-games.mjs'), 'check', 'Covered'], {
    cwd: root, encoding: 'utf8', env: { ...process.env, CLUBHOUSE_TEST_PROFILE: 'typo' },
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /CLUBHOUSE_TEST_PROFILE must be quick or full/);
});
