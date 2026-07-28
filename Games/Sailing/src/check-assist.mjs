// ponytail: assert-based self-check for the easy-mode navigation assist.
// Ceiling: checks what the guidance recommends and that it is sailable, not
// how it is drawn.

import { createBoatState, createWind, stepSailing } from './sailing.js';
import { createAssist, BEAT_TWA, wrap } from './assist.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const D = (r) => (r * 180) / Math.PI;

const wind = createWind(0);
wind.baseFrom = Math.PI;
wind.from = Math.PI;
wind.speed = 7;
wind.update = () => {};

const at = (x, z, heading = 0) => {
  const b = createBoatState(heading);
  b.x = x;
  b.z = z;
  return b;
};

// Wind blows from heading PI, i.e. from -Z, so -Z is upwind.
const assist = createAssist();

// A mark straight downwind is sailed straight at.
{
  const boat = at(0, 0, 0);
  assist.reset(boat, wind);
  const rec = assist.recommend(boat, wind, { x: 0, z: 200 });
  assert(!rec.beating, 'downwind mark should not be a beat');
  assert(Math.abs(wrap(rec.heading - 0)) < 0.01,
    `expected to steer straight downwind, got ${D(rec.heading).toFixed(0)}°`);
}

// A mark straight upwind cannot be sailed at: the guidance must offer a
// layline, never the bearing itself.
{
  const boat = at(0, 0, Math.PI);
  assist.reset(boat, wind);
  const rec = assist.recommend(boat, wind, { x: 0, z: -200 });
  assert(rec.beating, 'upwind mark should be flagged as a beat');
  const twa = Math.abs(wrap(rec.heading - wind.from));
  assert(Math.abs(twa - BEAT_TWA) < 0.01,
    `expected the beating angle, got TWA ${D(twa).toFixed(0)}°`);
}

// Every recommended heading must actually drive the boat — a guidance arrow
// pointing into the no-go zone would be worse than none at all.
{
  const boat = at(0, 0, 0);
  assist.reset(boat, wind);
  for (const [x, z] of [[0, -200], [-150, -150], [150, -150], [200, 0], [0, 200], [-80, -10]]) {
    const rec = assist.recommend(boat, wind, { x, z });
    const test = createBoatState(rec.heading);
    test.surge = 1;
    for (let i = 0; i < 1200; i++) {
      test.heading = rec.heading;
      test.yawRate = 0;
      stepSailing(test, wind, { rudder: 0, trimDelta: 0, autoTrim: true }, 1 / 60, i / 60, 0);
    }
    assert(test.speed > 1.5,
      `guidance toward (${x},${z}) gives only ${test.speed.toFixed(2)} m/s`);
  }
}

// The recommendation must not chatter when the mark sits dead upwind, or the
// arrow becomes unfollowable.
{
  const boat = at(0, 0, wrap(Math.PI + BEAT_TWA));
  assist.reset(boat, wind);
  const first = assist.recommend(boat, wind, { x: 0, z: -200 }).tack;
  let flips = 0;
  for (let i = 0; i < 200; i++) {
    boat.x = Math.sin(i * 0.7) * 1.5; // jitter across the rhumb line
    const t = assist.recommend(boat, wind, { x: 0, z: -200 }).tack;
    if (t !== first) flips++;
  }
  assert(flips === 0, `tack recommendation chattered ${flips}/200 frames`);
}

// One-key tack must land on the other side of the wind, and clear of the no-go
// zone even when starting head to wind.
{
  for (const startTwa of [BEAT_TWA, -BEAT_TWA, 0.15, -0.15]) {
    const boat = at(0, 0, wrap(wind.from + startTwa));
    assist.reset(boat, wind);
    const target = assist.otherTack(boat, wind);
    const twa = wrap(target - wind.from);
    assert(Math.abs(twa) >= BEAT_TWA - 0.01,
      `tack from TWA ${D(startTwa).toFixed(0)}° lands at ${D(twa).toFixed(0)}°, inside the no-go zone`);
    if (Math.abs(startTwa) > 0.01) {
      assert(Math.sign(twa) === -Math.sign(startTwa),
        `tack from TWA ${D(startTwa).toFixed(0)}° stayed on the same side`);
    }
  }
}

// The easy-mode steerage floor has to rescue a boat stuck head to wind, while
// staying far too slow to be a way of actually getting anywhere.
{
  const stuck = createBoatState(Math.PI);
  stuck.surge = 0;
  for (let i = 0; i < 600; i++) {
    stepSailing(stuck, wind, { rudder: 0, trimDelta: 0, autoTrim: true }, 1 / 60, i / 60, 0, true);
  }
  assert(stuck.surge > 0.9, `easy mode should keep steerage way, got ${stuck.surge.toFixed(2)}`);
  assert(stuck.surge < 1.6, `steerage floor is too fast to be a rescue: ${stuck.surge.toFixed(2)}`);

  const hard = createBoatState(Math.PI);
  hard.surge = 0;
  for (let i = 0; i < 600; i++) {
    stepSailing(hard, wind, { rudder: 0, trimDelta: 0, autoTrim: true }, 1 / 60, i / 60, 0, false);
  }
  assert(hard.surge < 0.6, `normal mode should still go dead in irons, got ${hard.surge.toFixed(2)}`);
}

console.log('check-assist: ok');
