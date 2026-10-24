/**
 * Physics feel probes (v6 continuous traction).
 * Overlapping diagonal swaps ~18–30 s; same-side falls fast; mash lags a clean gait.
 */
import assert from 'node:assert/strict';
import { createSim, getUpInPlace, stepPhysics } from './physics.ts';
import { FIXED_DT, TIME_LIMIT, TRACK_LENGTH } from './constants.ts';

const LEG_IDS = ['FL', 'FR', 'BL', 'BR'];

function holdOnly(sim, ids) {
  for (const id of LEG_IDS) sim.legs[id].held = ids.includes(id);
}

function step(sim) {
  return stepPhysics(sim, FIXED_DT, {
    tractionMul: 1,
    assist: false,
    onPlant: (leg, _e, impact) => ({ leg, perfect: false, combo: 0, impact }),
  });
}

/** Alternate diagonal pairs with no all-released gap (overlapping gait). */
function runDiagonal(period, limit = TIME_LIMIT) {
  const sim = createSim();
  let pairIdx = 0;
  let phaseT = 0;
  let falls = 0;
  const pairs = [
    ['FL', 'BR'],
    ['FR', 'BL'],
  ];
  while (!sim.finished && sim.elapsed < limit) {
    if (sim.fallen) {
      falls += 1;
      getUpInPlace(sim);
      phaseT = 0;
      continue;
    }
    phaseT += FIXED_DT;
    holdOnly(sim, pairs[pairIdx % 2]);
    if (phaseT >= period) {
      phaseT = 0;
      pairIdx += 1;
    }
    step(sim);
  }
  return { sim, falls };
}

// Same-side alternating → fall quickly (roll)
{
  const sim = createSim();
  let t = 0;
  let phase = 0;
  let phaseT = 0;
  while (t < 2.0 && !sim.fallen) {
    phaseT += FIXED_DT;
    t += FIXED_DT;
    if (phase === 0) {
      holdOnly(sim, ['FL', 'BL']);
      if (phaseT >= 0.12) {
        phase = 1;
        phaseT = 0;
      }
    } else {
      holdOnly(sim, ['FR', 'BR']);
      if (phaseT >= 0.12) {
        phase = 0;
        phaseT = 0;
      }
    }
    step(sim);
  }
  assert.ok(sim.fallen, 'same-side alternating should fall');
  assert.ok(t < 1.2, `same-side fall too slow t=${t.toFixed(2)}`);
  console.log(`same-side fall at t=${t.toFixed(2)}s`);
}

// Stable overlapping diagonals (~0.22 s swaps) finish in ~18–30 s with ~0 falls
{
  const { sim, falls } = runDiagonal(0.22);
  assert.ok(sim.finished, `diagonal should finish; x=${sim.x.toFixed(2)} t=${sim.elapsed.toFixed(2)}`);
  assert.ok(
    sim.elapsed >= 14 && sim.elapsed <= 35,
    `diagonal pace band failed t=${sim.elapsed.toFixed(2)} (want ~18–30s)`,
  );
  assert.ok(falls <= 2, `stable diagonal should rarely fall; falls=${falls}`);
  console.log(
    `diagonal ok t=${sim.elapsed.toFixed(2)}s falls=${falls} vmax=${sim.maxSpeed.toFixed(2)} steps=${sim.stepCount}`,
  );
}

// Random mash for 30s should trail a clean gait (not cruise past ~half track easily)
{
  const mash = createSim();
  let seed = 7;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  while (mash.elapsed < 30) {
    if (mash.fallen) {
      if (mash.fallSpin > 0.8) getUpInPlace(mash);
      else {
        step(mash);
        continue;
      }
    }
    for (const id of LEG_IDS) {
      if (rnd() < 0.02) mash.legs[id].held = !mash.legs[id].held;
    }
    step(mash);
  }
  const clean = runDiagonal(0.22, 30);
  assert.ok(
    mash.x < clean.sim.x * 0.85 || mash.x < TRACK_LENGTH * 0.55,
    `mash should lag clean gait; mash=${mash.x.toFixed(1)} clean30=${clean.sim.x.toFixed(1)}`,
  );
  console.log(`mash30 x=${mash.x.toFixed(1)}m falls=${mash.fallCount} vs clean30 x=${clean.sim.x.toFixed(1)}`);
}

// Holding all four: lose ground contact, then a small roll tips over
{
  const tip = createSim();
  holdOnly(tip, LEG_IDS);
  for (let i = 0; i < 240 * 0.4; i++) step(tip);
  assert.ok(
    tip.y < 1.1 || !Object.values(tip.legs).some((l) => l.grounded),
    'all-held should leave the ground springs',
  );
  tip.roll = 0.2;
  tip.rollVel = 0.5;
  let tipped = false;
  for (let i = 0; i < 240 * 2; i++) {
    step(tip);
    if (tip.fallen) {
      tipped = true;
      break;
    }
  }
  assert.ok(tipped, 'airborne all-held with roll should fall');
}

assert.ok(FIXED_DT <= 1 / 120 && FIXED_DT >= 1 / 300);
console.log('check-physics: ok');
