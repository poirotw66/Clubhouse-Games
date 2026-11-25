// ponytail: assert-based self-check for the sailing force model (no test framework).
// Run: node --experimental-vm-modules src/check-sailing.mjs  (or import from a tiny harness)
// Ceiling: covers no-go / beam-reach drive sign and the shape of the speed
// polar, not full integration.

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

// --- shape of the speed polar ------------------------------------------------
// Steady-state speed at a true wind angle, heading pinned so this measures the
// force model rather than the steering.
function steadySpeed(twaDeg) {
  const boat = createBoatState(Math.PI - (twaDeg * Math.PI) / 180);
  const heading = boat.heading;
  boat.surge = 1;
  for (let i = 0; i < 3000; i++) {
    boat.heading = heading;
    boat.yawRate = 0;
    stepSailing(boat, wind, { rudder: 0, trimDelta: 0, autoTrim: true }, 1 / 60, i / 60, 0);
  }
  return boat.speed;
}

{
  const polar = {};
  for (const twa of [45, 60, 90, 110, 130, 150, 180]) polar[twa] = steadySpeed(twa);

  // A reach is the quickest point of sail — the whole reason to bear away.
  const fastest = Object.keys(polar).reduce((a, b) => (polar[a] > polar[b] ? a : b));
  assert(Number(fastest) >= 60 && Number(fastest) <= 110,
    `expected a reach to be fastest, got TWA ${fastest} (${JSON.stringify(polar)})`);

  // Auto-trim must keep the sail working as the wind moves aft. Trimming to a
  // fixed fraction of the apparent wind angle stalls it here and guts the reach.
  assert(polar[110] > polar[45],
    `broad reach should beat close-hauled, got ${polar[110].toFixed(2)} vs ${polar[45].toFixed(2)}`);
  assert(polar[130] > polar[180],
    `broad reach should beat a dead run, got ${polar[130].toFixed(2)} vs ${polar[180].toFixed(2)}`);

  // No dead band between the reach and the run: bearing away must never be a
  // speed *gain*, or the boat feels broken to steer.
  assert(polar[150] >= polar[180] - 0.15,
    `dead band at TWA 150: ${polar[150].toFixed(2)} vs run ${polar[180].toFixed(2)}`);
}

// --- Easy Mode wind-driven propulsion and gentle steerage floor -------------
{
  // 1. Beam reach accelerates strongly with wind in Easy Mode.
  const easyBeam = createBoatState(Math.PI / 2);
  easyBeam.surge = 2;
  for (let i = 0; i < 300; i++) {
    stepSailing(easyBeam, wind, { rudder: 0, trimDelta: 0, autoTrim: true }, 1 / 60, i / 60, 0, true);
  }
  assert(easyBeam.surge > 7.0, `expected wind-driven beam reach speed > 7 m/s, got ${easyBeam.surge}`);

  // 2. Entering irons slows the boat down naturally (no motor holding high speed).
  const easyIrons = createBoatState(Math.PI);
  easyIrons.surge = 8.0;
  for (let i = 0; i < 600; i++) {
    stepSailing(easyIrons, wind, { rudder: 0, trimDelta: 0, autoTrim: true }, 1 / 60, i / 60, 0, true);
  }
  assert(easyIrons.surge < 0.5, `expected boat in irons to slow down, got ${easyIrons.surge}`);
  assert(easyBeam.surge > easyIrons.surge + 6.0,
    `beam reach should clearly beat irons in easy mode: ${easyBeam.surge} vs ${easyIrons.surge}`);

  // 3. Gentle minimum steerage floor (~2.5 m/s) when tacking through irons.
  const easyFloor = createBoatState(Math.PI);
  easyFloor.surge = 0.5;
  for (let i = 0; i < 90; i++) {
    stepSailing(easyFloor, wind, { rudder: 1, trimDelta: 0, autoTrim: true }, 1 / 60, i / 60, 0, true);
  }
  assert(easyFloor.surge >= 1.9 && easyFloor.surge <= 2.8,
    `expected gentle steerage floor (~2.5 m/s) during tack, got ${easyFloor.surge}`);
}

console.log('check-sailing: ok');
