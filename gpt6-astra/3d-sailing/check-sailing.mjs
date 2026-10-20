#!/usr/bin/env node
/**
 * Logic check for Astra Windward (3D Sailing).
 * Covers course ladder, PB recording, unlocks, gate crossing, wind, ghosts.
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
  recordDnf,
  recordFinish,
  sampleWind,
  saveGhost,
  saveProgress,
} from './rules.mjs';

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

assert.equal(COURSE_ORDER.length, 3);
assert.equal(listCourses().length, 3);
assert.equal(COURSES[0].id, 'archipelago');
assert.equal(COURSES[0].unlockAfter, null);
assert.equal(COURSES[1].unlockAfter, 'archipelago');
assert.equal(COURSES[2].unlockAfter, 'beam-reach');

for (const c of COURSES) {
  assert.ok(c.gates.length >= 8, `${c.id} needs enough gates`);
  assert.ok(c.timeLimit >= 120 && c.timeLimit <= 240, `${c.id} time limit`);
  assert.ok(c.wind.baseSpeed > 0);
  assert.ok(Number.isFinite(c.start.x) && Number.isFinite(c.start.z));
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

assert.equal(collisionPenalty('archipelago'), 4);
assert.equal(collisionPenalty('gusty-slalom'), 6);
assert.ok(collisionPenalty('gusty-slalom') > collisionPenalty('beam-reach'));

assert.equal(formatTime(125.2), '2:06');
assert.match(formatTimePrecise(65.123), /^1:05\./);

let progress = defaultProgress();
assert.ok(isUnlocked(progress, 'archipelago'));
assert.ok(!isUnlocked(progress, 'beam-reach'));
assert.ok(!isUnlocked(progress, 'gusty-slalom'));

const fin = recordFinish(progress, 'archipelago', 92.4, 1);
progress = fin.progress;
assert.ok(fin.isRecord);
assert.deepEqual(fin.unlocked, ['beam-reach']);
assert.ok(isUnlocked(progress, 'beam-reach'));
assert.equal(bestFor(progress, 'archipelago').bestTime, 92.4);
assert.equal(bestFor(progress, 'archipelago').collisions, 1);
assert.equal(progress.clears, 1);

const worse = recordFinish(progress, 'archipelago', 100, 0);
assert.ok(!worse.isRecord);
progress = worse.progress;
assert.equal(bestFor(progress, 'archipelago').bestTime, 92.4);
assert.equal(bestFor(progress, 'archipelago').collisions, 1, 'PB collisions stay with the record run');

const better = recordFinish(progress, 'archipelago', 88, 3);
progress = better.progress;
assert.ok(better.isRecord);
assert.equal(bestFor(progress, 'archipelago').bestTime, 88);
assert.equal(bestFor(progress, 'archipelago').collisions, 3);

progress = recordFinish(progress, 'beam-reach', 110, 0).progress;
assert.ok(isUnlocked(progress, 'gusty-slalom'));

progress = recordDnf(progress);
assert.equal(progress.races, 5);

saveProgress(progress);
const reloaded = loadProgress();
assert.equal(reloaded.bests.archipelago.bestTime, 88);
assert.ok(reloaded.unlocked.includes('gusty-slalom'));

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

console.log('check-sailing: ok');
