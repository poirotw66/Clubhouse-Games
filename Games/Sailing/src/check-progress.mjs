// Progress / unlock / ghost tape self-check.

import { listCourses } from './courses.js';
import {
  defaultProgress,
  isUnlocked,
  loadProgress,
  recordFinish,
  recordRegatta,
  saveProgress,
} from './progress.js';
import { createGhostRecorder, loadGhost, saveGhost } from './ghost.js';
import { createWind } from './sailing.js';
import { createCourse } from './courses.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// Minimal localStorage for Node check runs.
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
}

localStorage.removeItem('sailing-progress-v5');
localStorage.removeItem('sailing-ghosts-v1');

let progress = defaultProgress();
assert(isUnlocked(progress, 'harbor'), 'harbor starts unlocked');
assert(!isUnlocked(progress, 'beat'), 'beat starts locked');

const fin = recordFinish(progress, 'harbor', 'easy', 42.5);
progress = fin.progress;
assert(fin.isRecord, 'first finish is a record');
assert(isUnlocked(progress, 'beat'), 'finishing harbor unlocks beat');
assert(progress.bests.harbor.easy === 42.5, 'best stored');

const worse = recordFinish(progress, 'harbor', 'easy', 50);
assert(!worse.isRecord, 'slower time is not a record');
progress = worse.progress;
assert(progress.bests.harbor.easy === 42.5, 'best unchanged');

progress = recordFinish(progress, 'beat', 'pro', 55).progress;
assert(isUnlocked(progress, 'island'), 'finishing beat unlocks island');

progress = recordRegatta(progress, { points: 11, won: true });
assert(progress.regatta.wins === 1, 'regatta win counted');
assert(listCourses().every((c) => isUnlocked(progress, c.id)), 'regatta unlocks all');

saveProgress(progress);
const reloaded = loadProgress();
assert(reloaded.bests.harbor.easy === 42.5, 'progress survives reload');

const rec = createGhostRecorder();
const boat = { x: 0, z: 0, heading: 0, trim: 0.7, side: 1 };
for (let i = 0; i < 20; i++) {
  boat.x = i;
  boat.z = -i * 2;
  rec.push(0.2, i * 0.2, boat);
}
saveGhost('harbor', 'easy', rec.samples(), 12.5);
const tape = loadGhost('harbor', 'easy');
assert(tape && tape.samples.length >= 2, 'ghost tape saved');
assert(tape.time === 12.5, 'ghost time stored');

// Wind profile apply + gust edge.
{
  const course = createCourse('island');
  const wind = createWind(2, course.wind);
  assert(Math.abs(wind.baseFrom - course.wind.baseFrom) < 1e-6, 'wind profile applied');
  let sawGust = false;
  for (let t = 0; t < 120; t += 0.25) {
    wind.update(t);
    if (wind.consumeGustEdge()) sawGust = true;
  }
  assert(sawGust, 'expected at least one gust edge on island profile');
}

console.log('check-progress: ok');
