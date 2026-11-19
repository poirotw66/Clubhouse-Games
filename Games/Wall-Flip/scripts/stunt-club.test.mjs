import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const sandbox = {};
vm.runInNewContext(fs.readFileSync(new URL('../stunt-club.js', import.meta.url), 'utf8'), sandbox);
const { normalize, grade, settle } = sandbox.WallFlipClub;

const coachSandbox = {};
vm.runInNewContext(fs.readFileSync(new URL('../flight-coach.js', import.meta.url), 'utf8'), coachSandbox);
const { analyse, advance, limits, targetLimits } = coachSandbox.WallFlipFlight;

test('contracts bank nothing on a crash, regardless of airborne feats', () => {
  for (const id of ['flips', 'precision', 'reserve']) {
    assert.equal(grade(id, { win: false, rolls: 8, soft: 30, level: 20, air: 100 }), 0);
  }
});

test('each contract has reachable inclusive medal thresholds', () => {
  assert.equal(grade('flips', { win: true, rolls: 0 }), 0);
  for (let n = 1; n <= 3; n++) assert.equal(grade('flips', { win: true, rolls: n }), n);
  for (const [quality, expected] of [[19, 0], [20, 1], [31, 1], [32, 2], [39, 2], [40, 3], [50, 3]]) {
    assert.equal(grade('precision', { win: true, soft: quality - 20, level: 20 }), expected);
  }
  for (const [air, expected] of [[24.9, 0], [25, 1], [44.9, 1], [45, 2], [64.9, 2], [65, 3]]) {
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

test('License 03 precision landing target zone detects micro-alignment and descent thresholds', () => {
  assert.equal(targetLimits.tilt, 6.25 * Math.PI / 180);
  assert.ok(Math.abs(targetLimits.descent - 6 / 3.6) < 1e-6);

  // When airborne, targetZone requires BOTH micro-tilt (<= 6.25 deg) and slow descent (<= 6 km/h = 1.667 m/s)
  const inside = analyse({ mode: 'air', vy: -1.2, tilt: 5 * Math.PI / 180, rw: 1.0, air: 50 });
  assert.equal(inside.targetAligned, true);
  assert.equal(inside.targetSlow, true);
  assert.equal(inside.targetSettled, true);
  assert.equal(inside.targetZone, true);

  // Exceeding target tilt (> 6.25 deg) but within safe landing tilt (<= 25 deg)
  const wideTilt = analyse({ mode: 'air', vy: -1.2, tilt: 10 * Math.PI / 180, rw: 1.0, air: 50 });
  assert.equal(wideTilt.aligned, true, 'Within safe 25 deg landing cone');
  assert.equal(wideTilt.targetAligned, false, 'Outside micro-alignment target');
  assert.equal(wideTilt.targetZone, false);

  // Exceeding target descent (> 6 km/h) but within safe descent (<= 5 m/s = 18 km/h)
  const fastDescent = analyse({ mode: 'air', vy: -3.0, tilt: 4 * Math.PI / 180, rw: 1.0, air: 50 });
  assert.equal(fastDescent.slow, true, 'Within safe 5 m/s landing limit');
  assert.equal(fastDescent.targetSlow, false, 'Exceeds 6 km/h target descent');
  assert.equal(fastDescent.targetZone, false);

  // Grounded or crashed states never activate target zone
  assert.equal(analyse({ mode: 'road', vy: 0, tilt: 0, rw: 0, u: -10 }).targetZone, false);
  assert.equal(analyse({ mode: 'landed', vy: 0, tilt: 0, rw: 0 }).targetZone, false);
});

test('License 03 precision criteria strictly requires soft >= 20 and level >= 15 on successful touchdown', () => {
  // Advance to License 03 requires level 2 completed with soft >= 20 and level >= 15
  assert.equal(advance(2, { win: true, soft: 20, level: 15 }), 3, 'Exact minimum threshold unlocks License 03');
  assert.equal(advance(2, { win: true, soft: 25, level: 18 }), 3, 'High quality touchdown unlocks License 03');
  assert.equal(advance(2, { win: true, soft: 19.9, level: 20 }), 2, 'Soft < 20 fails License 03');
  assert.equal(advance(2, { win: true, soft: 30, level: 14.9 }), 2, 'Level < 15 fails License 03');
  assert.equal(advance(2, { win: false, soft: 30, level: 20 }), 2, 'Crash cannot advance License');

  // Passing License 03 guarantees at least Silver medal (threshold 32) in Stunt Club precision contract
  const minPrecision = { win: true, soft: 20, level: 15 };
  assert.ok(grade('precision', minPrecision) >= 2, 'License 03 passing score achieves at least Silver in Stunt Club');
  const maxPrecision = { win: true, soft: 30, level: 20 };
  assert.equal(grade('precision', maxPrecision), 3, 'Perfect precision touchdown earns Gold (3 medals)');
});

test('3D mega runway distance milestone detection tracks 50m intervals along 1420m tarmac', () => {
  const RUNWAY_START_X = -16;
  const milestones = [
    { d: 50, tag: '50 M' }, { d: 100, tag: '100 M' }, { d: 150, tag: '150 M' },
    { d: 200, tag: '200 M' }, { d: 250, tag: '250 M' }, { d: 300, tag: '300 M' },
    { d: 400, tag: '400 M' }, { d: 500, tag: '500 M' }, { d: 600, tag: '600 M' },
    { d: 800, tag: '800 M' }, { d: 1000, tag: '1000 M' }, { d: 1200, tag: '1200 M' },
  ];

  function detectMilestones(x) {
    const flightDist = RUNWAY_START_X - x;
    return milestones.filter(m => flightDist >= m.d).map(m => m.d);
  }

  // Before 50m milestone
  assert.deepEqual(detectMilestones(-50), []);
  assert.deepEqual(detectMilestones(-65.9), []);

  // Reaching exactly 50m (x = -66)
  assert.deepEqual(detectMilestones(-66), [50]);

  // Reaching 100m, 150m, 200m at 50m intervals
  assert.deepEqual(detectMilestones(-116), [50, 100]);
  assert.deepEqual(detectMilestones(-166), [50, 100, 150]);
  assert.deepEqual(detectMilestones(-216), [50, 100, 150, 200]);
  assert.deepEqual(detectMilestones(-316), [50, 100, 150, 200, 250, 300]);

  // Deep runway milestones
  assert.deepEqual(detectMilestones(-516), [50, 100, 150, 200, 250, 300, 400, 500]);
  assert.deepEqual(detectMilestones(-1216), [50, 100, 150, 200, 250, 300, 400, 500, 600, 800, 1000, 1200]);
});

test('soft touchdown scoring integrates with Stunt Club contracts and streak persistence', () => {
  let profile = normalize();
  // Flips run
  profile = settle(profile, 'flips', { win: true, rolls: 3, soft: 28, level: 19 });
  assert.equal(profile.medals.flips, 3);
  assert.equal(profile.streak, 1);

  // Precision run with high soft touchdown (SOFT 26 + LEVEL 18 = 44 >= 40 Gold)
  profile = settle(profile, 'precision', { win: true, soft: 26, level: 18, rolls: 1 });
  assert.equal(profile.medals.precision, 3);
  assert.equal(profile.streak, 2);

  // Reserve run with 70% air left
  profile = settle(profile, 'reserve', { win: true, air: 70 });
  assert.equal(profile.medals.reserve, 3);
  assert.equal(profile.streak, 3);
  assert.equal(profile.bestStreak, 3);

  // Total stars = 9 unlocks violet livery
  assert.equal(profile.medals.flips + profile.medals.precision + profile.medals.reserve, 9);
  const updated = normalize({ ...profile, paint: 'violet' });
  assert.equal(updated.paint, 'violet');
});
