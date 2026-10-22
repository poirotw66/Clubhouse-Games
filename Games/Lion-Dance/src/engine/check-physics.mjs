/**
 * Physics invariants for the QWOP-style lion walker (no Three.js).
 * Mirrors the core plant impulse + a diagonal gait smoke walk.
 */
import assert from 'node:assert/strict';

const FIXED_DT = 1 / 180;
const TRACK_LENGTH = 50;
const BODY_HEIGHT = 1.15;
const FALL_PITCH = 0.72;
const FALL_ROLL = 0.62;
const LEG_ATTACH = {
  FL: { x: 0.72, z: -0.32 },
  FR: { x: 0.72, z: 0.32 },
  BL: { x: -0.72, z: -0.32 },
  BR: { x: -0.72, z: 0.32 },
};
const LEG_IDS = ['FL', 'FR', 'BL', 'BR'];
const TIME_LIMIT = 90;

function estimateStepImpulse(swingAhead) {
  const ahead = Math.max(0, swingAhead);
  return 0.45 + ahead * 1.35;
}

function makeLeg(id) {
  return {
    id,
    held: false,
    lift: 0,
    swing: 0,
    swingVel: 0,
    plantX: LEG_ATTACH[id].x,
    pushT: 0,
    wasHeld: false,
  };
}

function createSim() {
  const legs = {};
  for (const id of LEG_IDS) legs[id] = makeLeg(id);
  return {
    x: 0,
    y: BODY_HEIGHT,
    vx: 0,
    vy: 0,
    pitch: 0,
    roll: 0,
    pitchVel: 0,
    rollVel: 0,
    fallen: false,
    fallSpin: 0,
    finished: false,
    finishAnim: 0,
    legs,
    elapsed: 0,
    stepCount: 0,
  };
}

function planted(leg) {
  return leg.lift < 0.15 && !leg.held;
}

/** Minimal twin of production stepPhysics for gait verification. */
function stepPhysics(sim, dt = FIXED_DT) {
  if (sim.finished) {
    sim.finishAnim = Math.min(1, sim.finishAnim + dt * 0.85);
    return null;
  }
  if (sim.fallen) return null;

  sim.elapsed += dt;
  let heldCount = 0;
  for (const id of LEG_IDS) {
    const leg = sim.legs[id];
    if (leg.held) heldCount += 1;
    if (leg.held) {
      leg.lift += (1 - leg.lift) * Math.min(1, 16 * dt);
      const swingForce = (1.05 - leg.swing) * 22 - leg.swingVel * 5;
      leg.swingVel += swingForce * dt;
      leg.swing += leg.swingVel * dt;
      leg.pushT = 0;
    } else {
      if (leg.wasHeld && leg.lift > 0.18) {
        const ahead = Math.max(0, leg.swing);
        sim.vx += estimateStepImpulse(ahead);
        const front = id === 'FL' || id === 'FR' ? 1 : -1;
        sim.pitchVel += front * ahead * -0.55;
        const left = id === 'FL' || id === 'BL' ? -1 : 1;
        sim.rollVel += left * ahead * 0.28;
        leg.pushT = 0.22 + ahead * 0.1;
        sim.stepCount += 1;
      }
      leg.lift += (0 - leg.lift) * Math.min(1, 18 * dt);
      const swingForce = (0 - leg.swing) * 12 - leg.swingVel * 6;
      leg.swingVel += swingForce * dt;
      leg.swing += leg.swingVel * dt;
      if (leg.pushT > 0) {
        leg.pushT -= dt;
        sim.vx += 1.8 * dt;
      }
    }
    leg.wasHeld = leg.held;
  }

  const supports = LEG_IDS.filter((id) => planted(sim.legs[id]));
  sim.vy -= 18 * dt;
  if (supports.length > 0) {
    sim.vy += ((BODY_HEIGHT - sim.y) * 90 - sim.vy * 16) * dt;
    sim.vx *= Math.pow(0.55, dt);
  } else {
    sim.vx *= Math.pow(0.7, dt);
  }

  if (supports.length === 0) sim.pitchVel += 2.4 * dt;
  else if (supports.length === 1) {
    const only = supports[0];
    const front = only === 'FL' || only === 'FR' ? 1 : -1;
    const left = only === 'FL' || only === 'BL' ? -1 : 1;
    sim.pitchVel += front * 1.1 * dt;
    sim.rollVel += left * 1.3 * dt;
  } else {
    sim.pitchVel += -sim.pitch * 6.5 * dt;
    sim.rollVel += -sim.roll * 7.5 * dt;
  }

  if (heldCount >= 3) sim.pitchVel += 2.8 * dt;

  sim.pitchVel *= Math.pow(0.28, dt);
  sim.rollVel *= Math.pow(0.3, dt);
  sim.pitch += sim.pitchVel * dt;
  sim.roll += sim.rollVel * dt;
  if (supports.length >= 3) {
    sim.pitch *= Math.pow(0.15, dt);
    sim.roll *= Math.pow(0.15, dt);
  }

  sim.x += sim.vx * dt;
  sim.y += sim.vy * dt;
  if (sim.y < BODY_HEIGHT * 0.5) {
    sim.y = BODY_HEIGHT * 0.5;
    sim.vy = Math.max(0, sim.vy);
  }
  if (sim.x < 0) {
    sim.x = 0;
    sim.vx = Math.max(0, sim.vx);
  }
  if (sim.vx > 3.6) sim.vx = 3.6;

  if (Math.abs(sim.pitch) > FALL_PITCH || Math.abs(sim.roll) > FALL_ROLL) {
    sim.fallen = true;
    return { reason: 'fall', elapsed: sim.elapsed, distance: sim.x };
  }
  if (sim.x >= TRACK_LENGTH) {
    sim.x = TRACK_LENGTH;
    sim.vx = 0;
    sim.finished = true;
    return { reason: 'finish', elapsed: sim.elapsed, distance: TRACK_LENGTH };
  }
  return null;
}

function setHeld(sim, ids, held) {
  for (const id of LEG_IDS) sim.legs[id].held = ids.includes(id) ? held : false;
}

// 1) Impulse grows with swing
assert.ok(estimateStepImpulse(0.9) > estimateStepImpulse(0.2));
assert.ok(estimateStepImpulse(0) >= 0.4);

// 2) Diagonal gait can finish 50m within the time limit (bot rhythm)
const sim = createSim();
const pairs = [
  ['FL', 'BR'],
  ['FR', 'BL'],
];
let pairIdx = 0;
let phase = 0; // 0 = hold, 1 = plant pause
let phaseT = 0;
let falls = 0;

while (!sim.finished && sim.elapsed < TIME_LIMIT) {
  if (sim.fallen) {
    falls += 1;
    sim.fallen = false;
    sim.pitch = 0;
    sim.roll = 0;
    sim.pitchVel = 0;
    sim.rollVel = 0;
    sim.y = BODY_HEIGHT;
    for (const id of LEG_IDS) {
      const leg = sim.legs[id];
      leg.held = false;
      leg.lift = 0;
      leg.swing = 0;
      leg.swingVel = 0;
      leg.pushT = 0;
      leg.wasHeld = false;
    }
    phase = 0;
    phaseT = 0;
  }

  phaseT += FIXED_DT;
  const pair = pairs[pairIdx % 2];
  if (phase === 0) {
    setHeld(sim, pair, true);
    if (phaseT >= 0.2) {
      phase = 1;
      phaseT = 0;
    }
  } else {
    setHeld(sim, pair, false);
    if (phaseT >= 0.14) {
      phase = 0;
      phaseT = 0;
      pairIdx += 1;
    }
  }
  stepPhysics(sim, FIXED_DT);
}

assert.ok(sim.finished, `diagonal gait should finish; x=${sim.x} t=${sim.elapsed} falls=${falls}`);
assert.ok(sim.elapsed < TIME_LIMIT, 'finish should beat the clock');
assert.ok(sim.elapsed > 12, `should not teleport finish instantly (t=${sim.elapsed})`);
assert.ok(sim.elapsed < 55, `practiced gait should earn at least 醒獅 pace (t=${sim.elapsed})`);
assert.ok(falls < 40, `too many falls for a practiced gait: ${falls}`);

// 3) Holding all four legs tips toward a fall quickly
const tip = createSim();
for (const id of LEG_IDS) tip.legs[id].held = true;
let tipped = false;
for (let i = 0; i < 180 * 3; i++) {
  const r = stepPhysics(tip, FIXED_DT);
  if (r?.reason === 'fall' || tip.fallen) {
    tipped = true;
    break;
  }
}
assert.ok(tipped, 'holding all legs should cause a fall');

// 4) Timestep band + thresholds
assert.ok(FIXED_DT <= 1 / 120 && FIXED_DT >= 1 / 240);
assert.equal(TRACK_LENGTH, 50);
assert.ok(FALL_PITCH < Math.PI / 2);

console.log(
  `check-physics: ok (finish ${sim.elapsed.toFixed(2)}s, steps ${sim.stepCount}, falls ${falls})`,
);
