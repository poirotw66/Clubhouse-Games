import assert from 'node:assert/strict';
import { StrideCoach } from './stride-coach.js';
import { CFG, makeHorseState, makeLegStates, simHorse } from './physics.js';

function land(coach, pair, time, distance = 1) {
  const legs = pair === 'A' ? [0, 3] : [1, 2];
  coach.recordStep(legs[0], time, distance);
  return coach.recordStep(legs[1], time + 0.05, distance);
}

// Keyboard activity and distance alone never manufacture grounded beats or drills.
{
  const coach = new StrideCoach();
  const held = { KeyQ: true, KeyP: true };
  assert.equal(coach.cue(held, 0).key, 'coach_lift');
  assert.equal(coach.cue(held, 0.25).key, 'coach_release');
  assert.equal(coach.cue({ KeyQ: true, KeyW: true }, 1).key, 'coach_diagonal');
  assert.equal(coach.cue({ KeyQ: true, KeyW: true, KeyO: true }, 1).key, 'coach_release_all');
  coach.advance(20, 50);
  assert.equal(coach.beats, 0);
  assert.deepEqual(coach.drills, [false, false, false]);
}

// Repeated single-hoof bouncing and stale unpaired contacts do not form strides.
{
  const coach = new StrideCoach();
  for (let i = 0; i < 12; i++) assert.equal(coach.recordStep(0, i * 0.1, 1), null);
  assert.equal(coach.beats, 0);
  assert.equal(coach.recordStep(3, 2, 1), null);
  assert.equal(coach.beats, 0);
}

// A four-hoof landing is one impact. Repeating a diagonal breaks alternation.
{
  const coach = new StrideCoach();
  assert.equal(land(coach, 'A', 0).streak, 1);
  assert.equal(land(coach, 'B', 0), null);
  assert.equal(coach.beats, 1);
  assert.equal(land(coach, 'A', 0.4).streak, 1);
  assert.equal(land(coach, 'B', 0.7).streak, 2);
  assert.equal(coach.nextPair, 'A');
  coach.advance(2, 2);
  assert.equal(coach.streak, 0, 'A dead rhythm must visibly expire');
  assert.equal(land(coach, 'A', 2.1).streak, 1);
}

// Actual deterministic physics must earn all three drills, without any mutation.
function simulate(observe) {
  const state = makeHorseState(), legs = makeLegStates();
  const coach = new StrideCoach();
  for (let i = 0; i < 2400; i++) {
    const time = (i + 1) * CFG.STEP;
    const input = Math.floor(i / 70) % 2
      ? [true, false, false, true, false] : [false, true, true, false, false];
    for (const event of simHorse(state, legs, input, CFG.STEP)) {
      if (observe && event.type === 'step') coach.recordStep(event.leg, time, state.x);
    }
    if (observe) coach.advance(time, state.x);
  }
  return { state, legs, coach };
}
{
  const baseline = simulate(false);
  const observed = simulate(true);
  assert.deepEqual(observed.state, baseline.state, 'Coaching cannot change physics, distance or score');
  assert.deepEqual(observed.legs, baseline.legs, 'Coaching cannot drive a leg');
  assert.ok(observed.state.x >= 5);
  assert.ok(observed.coach.beats > 6);
  assert.ok(observed.coach.beats <= observed.state.steps / 2, 'Two real hooves make one beat');
  assert.deepEqual(observed.coach.drills, [true, true, true]);
  observed.coach.breakStride();
  assert.equal(observed.coach.streak, 0);
  assert.deepEqual(observed.coach.drills, [true, true, true], 'Completed practice survives a fall');
  assert.equal(observed.coach.recordStep(3, 11, 8), null, 'A fall clears pending hoof contacts');
  observed.coach.reset();
  assert.deepEqual(observed.coach.drills, [false, false, false], 'A new session starts fresh');
  assert.equal(observed.coach.beats, 0);
}
console.log('check-stride-coach: ok (real contacts, no phantom beats, cadence expiry, practice progression, physics parity)');
