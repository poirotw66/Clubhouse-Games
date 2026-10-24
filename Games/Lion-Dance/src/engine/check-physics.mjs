/**
 * Physics feel probes (v6 continuous traction).
 * Stable diagonal ~3 Hz → ~20–30 s / ≤2 falls; ~2 Hz still finishes; same-side tips fast.
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

// Measured (TRACTION=9.5 GRIP=6.5): diag3Hz ≈22.80s / 0 falls; diag2Hz ≈34.87s / 0 falls.
// ~3 swaps/s (period 1/3) — stable diagonal target: 20–30 s, ≤2 falls
{
  const { sim, falls } = runDiagonal(1 / 3);
  assert.ok(sim.finished, `diag3Hz should finish; x=${sim.x.toFixed(2)} t=${sim.elapsed.toFixed(2)}`);
  assert.ok(
    sim.elapsed >= 20 && sim.elapsed <= 30,
    `diag3Hz pace band failed t=${sim.elapsed.toFixed(2)} (want 20–30s, measured≈22.8)`,
  );
  assert.ok(falls <= 2, `diag3Hz should rarely fall; falls=${falls} (measured=0)`);
  console.log(
    `diag3Hz ok t=${sim.elapsed.toFixed(2)}s falls=${falls} vmax=${sim.maxSpeed.toFixed(2)} steps=${sim.stepCount}`,
  );
}

// Faster overlapping (~0.22 s) still finishes cleanly in the broader band
{
  const { sim, falls } = runDiagonal(0.22);
  assert.ok(sim.finished, `diagFast should finish; x=${sim.x.toFixed(2)}`);
  assert.ok(
    sim.elapsed >= 12 && sim.elapsed <= 30,
    `diagFast pace band failed t=${sim.elapsed.toFixed(2)} (measured≈15.2)`,
  );
  assert.ok(falls <= 2, `diagFast should rarely fall; falls=${falls}`);
  console.log(
    `diagFast ok t=${sim.elapsed.toFixed(2)}s falls=${falls} vmax=${sim.maxSpeed.toFixed(2)} steps=${sim.stepCount}`,
  );
}

// Slower human ~2 swaps/s — finishes slower, still upright
{
  const { sim, falls } = runDiagonal(0.5);
  assert.ok(sim.finished, `diag2Hz should finish; x=${sim.x.toFixed(2)} t=${sim.elapsed.toFixed(2)}`);
  assert.ok(
    sim.elapsed >= 30 && sim.elapsed <= 42,
    `diag2Hz pace band failed t=${sim.elapsed.toFixed(2)} (want ~35s, measured≈34.9)`,
  );
  assert.ok(falls <= 2, `diag2Hz should stay upright; falls=${falls} (measured=0)`);
  console.log(
    `diag2Hz ok t=${sim.elapsed.toFixed(2)}s falls=${falls} vmax=${sim.maxSpeed.toFixed(2)} steps=${sim.stepCount}`,
  );
}

// Random mash at 12s should trail a clean diagonal (both may finish by 30s now)
{
  const WINDOW = 12;
  const mash = createSim();
  let seed = 7;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  while (mash.elapsed < WINDOW && !mash.finished) {
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
  const clean = runDiagonal(1 / 3, WINDOW);
  assert.ok(
    mash.x < clean.sim.x * 0.85 || mash.fallCount > clean.falls,
    `mash should lag clean gait; mash=${mash.x.toFixed(1)} clean=${clean.sim.x.toFixed(1)} mashFalls=${mash.fallCount}`,
  );
  console.log(
    `mash${WINDOW} x=${mash.x.toFixed(1)}m falls=${mash.fallCount} vs clean x=${clean.sim.x.toFixed(1)} falls=${clean.falls}`,
  );
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
