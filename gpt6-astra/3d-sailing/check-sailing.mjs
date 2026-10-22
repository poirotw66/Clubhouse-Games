#!/usr/bin/env node
/**
 * Logic check for Astra Windward (3D Sailing).
 * Covers course ladder, PB recording, unlocks, gate crossing, wind, ghosts,
 * stars, and Asia/Taipei daily ghost challenge.
 */
import assert from 'node:assert/strict';
import {
  COURSES,
  COURSE_ORDER,
  STORAGE_GHOSTS,
  STORAGE_PROGRESS,
  bestFor,
  collisionPenalty,
  createGhostPlayback,
  createGhostRecorder,
  crossedGate,
  defaultProgress,
  formatTime,
  formatTimePrecise,
  getCourse,
  isUnlocked,
  listCourses,
  loadGhost,
  loadProgress,
  rateStars,
  recordDnf,
  recordFinish,
  sampleWind,
  saveGhost,
  saveProgress,
  starGlyph,
  totalStars,
  unlockHint,
} from './rules.mjs';
import {
  STORAGE_DAILY,
  STORAGE_DAILY_GHOSTS,
  dailyCourseFromChallenge,
  defaultDailyProgress,
  formatDailyShareText,
  getDailyChallenge,
  loadDailyGhost,
  loadDailyProgress,
  previousTaipeiDateKey,
  recordDailyFinish,
  saveDailyGhost,
  seedFromString,
  taipeiDateKey,
} from './daily.mjs';

// Minimal localStorage for Node.
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
}

localStorage.removeItem(STORAGE_PROGRESS);
localStorage.removeItem(STORAGE_GHOSTS);
localStorage.removeItem(STORAGE_DAILY);
localStorage.removeItem(STORAGE_DAILY_GHOSTS);

assert.ok(COURSE_ORDER.length >= 8, 'need at least 8 courses');
assert.ok(listCourses().length >= 8);
assert.equal(listCourses().length, COURSE_ORDER.length);
assert.equal(COURSES[0].id, 'archipelago');
assert.equal(COURSES[0].unlockAfter, null);
assert.equal(COURSES[1].unlockAfter, 'archipelago');
assert.equal(COURSES[2].unlockAfter, 'beam-reach');

for (const c of COURSES) {
  assert.ok(c.gates.length >= 8, `${c.id} needs enough gates`);
  assert.ok(c.timeLimit >= 120 && c.timeLimit <= 240, `${c.id} time limit`);
  assert.ok(c.wind.baseSpeed > 0);
  assert.ok(Number.isFinite(c.start.x) && Number.isFinite(c.start.z));
  assert.ok(c.difficulty >= 1 && c.difficulty <= 5, `${c.id} difficulty`);
  assert.ok(Array.isArray(c.starTimes) && c.starTimes.length === 2, `${c.id} starTimes`);
  assert.ok(c.starTimes[0] < c.starTimes[1], `${c.id} gold < silver`);
}

assert.notEqual(
  JSON.stringify(getCourse('beam-reach').wind),
  JSON.stringify(getCourse('archipelago').wind),
  'courses must differ in wind',
);
assert.notEqual(
  JSON.stringify(getCourse('gusty-slalom').gates),
  JSON.stringify(getCourse('archipelago').gates),
  'courses must differ in gate layout',
);

// Distinct wind / gates across the expanded pack.
{
  const winds = new Set(COURSES.map((c) => JSON.stringify(c.wind)));
  const gates = new Set(COURSES.map((c) => JSON.stringify(c.gates)));
  assert.ok(winds.size >= 8, 'each course should have distinct wind');
  assert.ok(gates.size >= 8, 'each course should have distinct gates');
}

assert.equal(collisionPenalty('archipelago'), 4);
assert.equal(collisionPenalty('gusty-slalom'), 6);
assert.ok(collisionPenalty('gusty-slalom') > collisionPenalty('beam-reach'));
assert.ok(collisionPenalty('typhoon-run') >= collisionPenalty('gusty-slalom'));

assert.equal(formatTime(125.2), '2:06');
assert.match(formatTimePrecise(65.123), /^1:05\./);

assert.equal(rateStars('archipelago', 90, 0), 3);
assert.equal(rateStars('archipelago', 100, 0), 2);
assert.equal(rateStars('archipelago', 150, 2), 1);
assert.equal(starGlyph(2), '★★☆');

let progress = defaultProgress();
assert.ok(isUnlocked(progress, 'archipelago'));
assert.ok(!isUnlocked(progress, 'beam-reach'));
assert.ok(!isUnlocked(progress, 'gusty-slalom'));
assert.ok(!isUnlocked(progress, 'narrow-channel'));
assert.ok(!isUnlocked(progress, 'tradewind-loop'));
assert.ok(!isUnlocked(progress, 'typhoon-run'));
assert.match(unlockHint(progress, getCourse('narrow-channel')), /5★/);

const fin = recordFinish(progress, 'archipelago', 92.4, 1);
progress = fin.progress;
assert.ok(fin.isRecord);
assert.deepEqual(fin.unlocked, ['beam-reach']);
assert.ok(isUnlocked(progress, 'beam-reach'));
assert.equal(bestFor(progress, 'archipelago').bestTime, 92.4);
assert.equal(bestFor(progress, 'archipelago').collisions, 1);
assert.equal(bestFor(progress, 'archipelago').stars, 2, 'gold time with a collision is 2★');
assert.equal(progress.clears, 1);
assert.equal(totalStars(progress), 2);

const worse = recordFinish(progress, 'archipelago', 100, 0);
assert.ok(!worse.isRecord);
progress = worse.progress;
assert.equal(bestFor(progress, 'archipelago').bestTime, 92.4);
assert.equal(bestFor(progress, 'archipelago').collisions, 1, 'PB collisions stay with the record run');
assert.equal(bestFor(progress, 'archipelago').stars, 2, 'stars never downgrade on slower run');

const gold = recordFinish(progress, 'archipelago', 90, 0);
progress = gold.progress;
assert.ok(gold.isRecord);
assert.equal(bestFor(progress, 'archipelago').stars, 3, 'clean gold run upgrades to 3★');
assert.equal(totalStars(progress), 3);

const better = recordFinish(progress, 'archipelago', 88, 3);
progress = better.progress;
assert.ok(better.isRecord);
assert.equal(bestFor(progress, 'archipelago').bestTime, 88);
assert.equal(bestFor(progress, 'archipelago').collisions, 3);
assert.equal(bestFor(progress, 'archipelago').stars, 3, 'stars never downgrade on dirtier PB');

progress = recordFinish(progress, 'beam-reach', 110, 0).progress;
assert.ok(isUnlocked(progress, 'gusty-slalom'));

progress = recordDnf(progress);
assert.equal(progress.races, 6);

saveProgress(progress);
const reloaded = loadProgress();
assert.equal(reloaded.bests.archipelago.bestTime, 88);
assert.ok(reloaded.unlocked.includes('gusty-slalom'));
assert.ok(reloaded.bests.archipelago.stars >= 1);

// Star-gated unlock (narrow-channel needs 5★).
{
  let p = defaultProgress();
  p = recordFinish(p, 'archipelago', 90, 0).progress; // 3★
  assert.ok(!isUnlocked(p, 'narrow-channel'));
  p = recordFinish(p, 'beam-reach', 85, 0).progress; // +3★ = 6★
  assert.ok(isUnlocked(p, 'narrow-channel'), '5★ should unlock narrow-channel');
}

// Time-gated unlock (tradewind-loop needs beam-reach PB ≤ 100).
{
  let p = defaultProgress();
  p = recordFinish(p, 'archipelago', 100, 0).progress;
  p = recordFinish(p, 'beam-reach', 105, 0).progress;
  assert.ok(!isUnlocked(p, 'tradewind-loop'));
  p = recordFinish(p, 'beam-reach', 99, 0).progress;
  assert.ok(isUnlocked(p, 'tradewind-loop'), 'PB under 100 unlocks tradewind-loop');
}

// Gate crossing: sail north through a gate facing north from south.
{
  const course = [[0, -45]];
  const start = { x: 0, z: 45 };
  const before = { x: 0, z: -40 };
  const after = { x: 0, z: -50 };
  assert.ok(crossedGate(before, after, course, 0, start), 'should cross gate line');
  assert.ok(
    !crossedGate({ x: 0, z: -40 }, { x: 0, z: -42 }, course, 0, start),
    'short move on same side does not count',
  );
  assert.ok(
    !crossedGate({ x: 30, z: -40 }, { x: 30, z: -50 }, course, 0, start),
    'wide miss should not count',
  );
}

// Wind sampling moves with shiftAmp.
{
  const calm = sampleWind(getCourse('archipelago').wind, 10);
  const gustyA = sampleWind(getCourse('gusty-slalom').wind, 0);
  const gustyB = sampleWind(getCourse('gusty-slalom').wind, 40);
  assert.ok(Math.abs(gustyA.heading - gustyB.heading) > 0.05, 'gusty wind should shift');
  assert.ok(Number.isFinite(calm.gust) && calm.gust > 0);
}

// Ghost recorder / playback / PB-only save.
{
  const rec = createGhostRecorder();
  const boat = { x: 0, z: 0, heading: 0 };
  for (let i = 0; i < 24; i++) {
    boat.x = i * 2;
    boat.z = -i;
    boat.heading = i * 0.02;
    rec.push(0.2, i * 0.2, boat);
  }
  assert.ok(rec.samples().length >= 2);
  assert.ok(saveGhost('archipelago', rec.samples(), 12.5));
  const tape = loadGhost('archipelago');
  assert.ok(tape && tape.samples.length >= 2);
  assert.equal(tape.time, 12.5);

  assert.ok(!saveGhost('archipelago', rec.samples(), 13.0), 'slower ghost must not overwrite');
  assert.ok(saveGhost('archipelago', rec.samples(), 11.0), 'faster ghost overwrites');

  const play = createGhostPlayback(loadGhost('archipelago'));
  const mid = play.sample(2);
  assert.ok(Number.isFinite(mid.x) && Number.isFinite(mid.z));
  const done = play.sample(999);
  assert.ok(done.done);
}

// ——— Daily ghost (Asia/Taipei) ———
{
  assert.match(taipeiDateKey(Date.parse('2026-10-22T04:00:00+08:00')), /^2026-10-22$/);
  assert.equal(previousTaipeiDateKey('2026-10-22'), '2026-10-21');
  assert.equal(
    seedFromString('windward-daily:2026-10-22'),
    seedFromString('windward-daily:2026-10-22'),
  );
  assert.notEqual(
    seedFromString('windward-daily:2026-10-22'),
    seedFromString('windward-daily:2026-10-23'),
  );

  const dayA = getDailyChallenge('2026-10-22');
  const dayA2 = getDailyChallenge('2026-10-22');
  const dayB = getDailyChallenge('2026-10-23');
  assert.equal(dayA.courseId, dayA2.courseId);
  assert.equal(JSON.stringify(dayA.wind), JSON.stringify(dayA2.wind));
  assert.ok(
    dayA.courseId !== dayB.courseId ||
      JSON.stringify(dayA.wind) !== JSON.stringify(dayB.wind) ||
      dayA.timeLimit !== dayB.timeLimit,
    'different dates should vary challenge',
  );
  assert.ok(COURSES.some((c) => c.id === dayA.courseId));

  const playable = dailyCourseFromChallenge(dayA);
  assert.equal(playable.gates.length, getCourse(dayA.courseId).gates.length);
  assert.ok(playable.id.startsWith('daily:'));

  let daily = defaultDailyProgress();
  const r1 = recordDailyFinish(daily, '2026-10-22', dayA.courseId, 100, 1);
  daily = r1.daily;
  assert.ok(r1.isRecord);
  assert.equal(daily.streak, 1);
  assert.equal(daily.byDate['2026-10-22'].bestTime, 100);

  const r2 = recordDailyFinish(daily, '2026-10-22', dayA.courseId, 110, 0);
  daily = r2.daily;
  assert.ok(!r2.isRecord);
  assert.equal(daily.byDate['2026-10-22'].bestTime, 100);
  assert.equal(daily.streak, 1, 'same-day streak unchanged');

  const r3 = recordDailyFinish(daily, '2026-10-23', dayB.courseId, 95, 0);
  daily = r3.daily;
  assert.equal(daily.streak, 2, 'consecutive day increments streak');

  const r4 = recordDailyFinish(daily, '2026-10-25', dayB.courseId, 90, 0);
  daily = r4.daily;
  assert.equal(daily.streak, 1, 'gap resets streak');

  const share = formatDailyShareText(daily, '2026-10-25');
  assert.match(share, /2026-10-25/);
  assert.match(share, /連續天數/);
  assert.match(share, /今日最佳/);

  const rec = createGhostRecorder();
  for (let i = 0; i < 10; i++) {
    rec.push(0.2, i * 0.2, { x: i, z: -i, heading: 0 });
  }
  assert.ok(saveDailyGhost('2026-10-22', rec.samples(), 12));
  assert.ok(!saveDailyGhost('2026-10-22', rec.samples(), 13));
  const tape = loadDailyGhost('2026-10-22');
  assert.ok(tape && tape.time === 12);

  const roundTrip = loadDailyProgress();
  assert.equal(roundTrip.streak, 1);
  assert.equal(roundTrip.byDate['2026-10-25'].bestTime, 90);
}

console.log('check-sailing: ok');
