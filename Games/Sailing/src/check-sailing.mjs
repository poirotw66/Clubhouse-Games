// ponytail: assert-based self-check for the sailing force model (no test framework).
// Run: node --experimental-vm-modules src/check-sailing.mjs  (or import from a tiny harness)
// Ceiling: only covers no-go / beam-reach drive sign, not full integration.

import { createBoatState, createWind, stepSailing, pointOfSail, NO_GO } from './sailing.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const wind = createWind(0);
wind.baseFrom = Math.PI;
wind.from = Math.PI;
wind.speed = 8;
wind.update = () => {}; // freeze

// Head to wind: should produce near-zero / negative drive and irons label.
{
  const boat = createBoatState(Math.PI); // pointing upwind
  boat.surge = 0;
  stepSailing(boat, wind, { rudder: 0, trimDelta: 0, autoTrim: true }, 1 / 60, 0, 1);
  assert(Math.abs(boat.awa) < NO_GO + 0.05, `expected small AWA in irons, got ${boat.awa}`);
  assert(pointOfSail(boat.awa).key === 'irons', `expected irons, got ${pointOfSail(boat.awa).key}`);
  assert(boat.drive < 0.002, `expected no drive in irons, got ${boat.drive}`);
}

// Beam reach: heading perpendicular to wind → positive drive after a few steps.
{
  const boat = createBoatState(Math.PI / 2);
  boat.surge = 2;
  for (let i = 0; i < 90; i++) {
    stepSailing(boat, wind, { rudder: 0, trimDelta: 0, autoTrim: true }, 1 / 60, i / 60, 1);
  }
  assert(pointOfSail(boat.awa).key === 'beam' || pointOfSail(boat.awa).key === 'close'
    || pointOfSail(boat.awa).key === 'broad', `unexpected point ${pointOfSail(boat.awa).key}`);
  assert(boat.drive > 0, `expected positive drive on a reach, got ${boat.drive}`);
  assert(boat.surge > 1.5, `expected boat to keep speed, got ${boat.surge}`);
}

// From a standstill in irons, rudder must still yaw the boat so players can escape.
{
  const boat = createBoatState(Math.PI);
  boat.surge = 0;
  for (let i = 0; i < 120; i++) {
    stepSailing(boat, wind, { rudder: 1, trimDelta: 0, autoTrim: true }, 1 / 60, i / 60, 1);
  }
  assert(Math.abs(boat.heading - Math.PI) > 0.25, `expected turn out of irons, heading=${boat.heading}`);
}

console.log('check-sailing: ok');
