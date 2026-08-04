// ponytail: assert-based self-check for the stuck-detection coach.
// Ceiling: covers when a hint fires and which one wins, not how it is rendered.

import { createCoach, HINTS } from './coach.js';
import { NO_GO } from './sailing.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const dt = 1 / 60;
const base = {
  racing: true,
  awa: Math.PI / 2,
  noGo: NO_GO,
  speed: 8,
  luffing: 0,
  autoTrim: true,
  easy: true,
  guideTurn: 0,
  distToGate: 100,
};

/** Run `secs` of a fixed state and return the hint at the end. */
function run(coach, patch, secs, distStep = 0) {
  let hint = null;
  const s = { ...base, ...patch };
  for (let i = 0; i < secs * 60; i++) {
    s.distToGate += distStep;
    hint = coach.update(s, dt);
  }
  return hint;
}

// Sailing along fine must never produce a hint.
{
  const coach = createCoach();
  assert(run(coach, {}, 30, -0.05) === null, 'a boat sailing well should get no hints');
}

// Head to wind has to persist before it counts — a tack passes through it.
{
  const coach = createCoach();
  assert(run(coach, { awa: 0.1 }, 1.5) === null, 'a momentary head-to-wind should not nag');
  assert(run(coach, { awa: 0.1 }, 2)?.id === 'irons', 'sustained irons should raise the irons hint');
}

// Ranked, not piled up: stuck in irons is also stalled and off course, but the
// player needs the one instruction that unsticks them.
{
  const coach = createCoach();
  const hint = run(coach, { awa: 0.05, speed: 0.2, guideTurn: 2.0 }, 10);
  assert(hint?.id === 'irons', `expected irons to win, got ${hint?.id}`);
}

// Luffing only matters when the player owns the sheet; auto-trim fixes it.
{
  const coach = createCoach();
  assert(run(coach, { luffing: 0.8, autoTrim: true }, 8) === null,
    'auto-trim handles luffing, so it should not be reported');
  assert(run(coach, { luffing: 0.8, autoTrim: false }, 8)?.id === 'luffing',
    'manual luffing should be reported');
}

// Losing ground to the mark.
{
  const coach = createCoach();
  assert(run(coach, {}, 8, +0.06) === null, 'briefly losing ground should not nag');
  assert(run(coach, {}, 10, +0.06)?.id === 'receding', 'sustained loss of ground should be flagged');
}

// A tack costs ground for a few seconds; that must not trip the receding rule.
{
  const coach = createCoach();
  run(coach, {}, 20, -0.05);
  assert(run(coach, {}, 6, +0.06) === null, 'a tack should not trip the receding hint');
}

// Hints clear once the boat is sailing again.
{
  const coach = createCoach();
  assert(run(coach, { awa: 0.1 }, 4)?.id === 'irons', 'expected irons first');
  assert(run(coach, {}, 3) === null, 'hint should clear once the boat is sailing');
}

// Off-course guidance is an easy-mode idea; there is no green arrow to follow
// with it switched off.
{
  const coach = createCoach();
  assert(run(coach, { guideTurn: 2.0, easy: false }, 10) === null,
    'off-course hint needs easy mode');
  assert(run(coach, { guideTurn: 2.0, easy: true }, 10)?.id === 'offCourse',
    'off-course hint should fire in easy mode');
}

// Nothing fires outside the race itself.
{
  const coach = createCoach();
  assert(run(coach, { racing: false, awa: 0, speed: 0 }, 20) === null,
    'no coaching outside the race');
}

assert(new Set(HINTS.map((h) => h.id)).size === HINTS.length, 'hint ids must be unique');

console.log('check-coach: ok');
