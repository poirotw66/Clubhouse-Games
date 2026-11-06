import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const sandbox = {};
vm.runInNewContext(fs.readFileSync(new URL('../stunt-club.js', import.meta.url), 'utf8'), sandbox);
const { normalize, grade, settle } = sandbox.WallFlipClub;

test('contracts bank nothing on a crash, regardless of airborne feats', () => {
  for (const id of ['flips', 'precision', 'reserve']) {
    assert.equal(grade(id, { win: false, rolls: 8, soft: 30, level: 20, air: 100 }), 0);
  }
});

test('each contract has reachable inclusive medal thresholds', () => {
  assert.equal(grade('flips', { win: true, rolls: 0 }), 0);
  for (let n = 1; n <= 3; n++) assert.equal(grade('flips', { win: true, rolls: n }), n);
  for (const [quality, expected] of [[19, 0], [20, 1], [34, 1], [35, 2], [44, 2], [45, 3], [50, 3]]) {
    assert.equal(grade('precision', { win: true, soft: quality - 20, level: 20 }), expected);
  }
  for (const [air, expected] of [[29.9, 0], [30, 1], [49.9, 1], [50, 2], [69.9, 2], [70, 3]]) {
    assert.equal(grade('reserve', { win: true, air }), expected);
  }
});

test('medals are personal bests; crashes reset the streak without removing medals', () => {
  const original = normalize();
  const result = Object.freeze({ win: true, rolls: 3, total: 187 });
  const gold = settle(original, 'flips', result);
  assert.equal(original.medals.flips, 0);
  assert.equal(gold.medals.flips, 3);
  const silver = settle(gold, 'flips', { win: true, rolls: 2 });
  assert.equal(silver.medals.flips, 3);
  assert.equal(silver.streak, 2);
  const crash = settle(silver, 'flips', { win: false });
  assert.equal(crash.streak, 0);
  assert.equal(crash.bestStreak, 2);
  assert.equal(crash.medals.flips, 3);
  assert.equal(crash.medals.precision, 0);
  assert.equal(result.total, 187);
});

test('stored preferences cannot select unknown contracts or locked liveries', () => {
  for (const selected of ['constructor', '__proto__', 'unknown']) assert.equal(normalize({ selected }).selected, 'flips');
  assert.equal(normalize(null).selected, 'flips');
  assert.equal(normalize({ paint: 'violet' }).paint, 'mint');
  assert.equal(normalize({ paint: 'amber', medals: { flips: 3 } }).paint, 'amber');
  assert.equal(normalize({ paint: 'violet', medals: { flips: 3, reserve: 3 } }).paint, 'violet');
  const dirty = normalize({ medals: { flips: -3, precision: 99, reserve: '3' }, streak: -1, bestStreak: '9' });
  assert.equal(dirty.medals.flips, 0);
  assert.equal(dirty.medals.precision, 3);
  assert.equal(dirty.medals.reserve, 0);
  assert.equal(dirty.streak, 0);
  assert.equal(dirty.bestStreak, 0);
});
