/**
 * Physics invariants for the QWOP-style lion walker (v2).
 */
import assert from 'node:assert/strict';

const FIXED_DT = 1 / 180;
const TRACK_LENGTH = 50;
const BODY_HEIGHT = 1.15;
const FALL_PITCH = 0.78;
const FALL_ROLL = 0.68;
const SPEED_CAP_BASE = 3.15;
const LEG_IDS = ['FL', 'FR', 'BL', 'BR'];
const TIME_LIMIT = 90;

function estimateStepImpulse(swingAhead) {
  const ahead = Math.max(0, swingAhead);
  return 0.52 + ahead * 1.25;
}

function makeLeg(id) {
  return {
    id,
    held: false,
    lift: 0,
    swing: 0,
    swingVel: 0,
    plantX: 0,
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
    fallStyle: 0,
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

function stepPhysics(sim, dt = FIXED_DT, speedBonus = 0) {
  if (sim.finished || sim.fallen) return null;
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
        sim.pitchVel += front * ahead * -0.48;
        const left = id === 'FL' || id === 'BL' ? -1 : 1;
        sim.rollVel += left * ahead * 0.24;
        leg.pushT = 0.2 + ahead * 0.08;
        sim.stepCount += 1;
      }
      leg.lift += (0 - leg.lift) * Math.min(1, 18 * dt);
      const swingForce = (0 - leg.swing) * 12 - leg.swingVel * 6;
      leg.swingVel += swingForce * dt;
      leg.swing += leg.swingVel * dt;
      if (leg.pushT > 0) {
        leg.pushT -= dt;
        sim.vx += 1.65 * dt;
      }
    }
    leg.wasHeld = leg.held;
  }

  const supports = LEG_IDS.filter((id) => planted(sim.legs[id]));
  sim.vy -= 18 * dt;
  if (supports.length > 0) {
    sim.vy += ((BODY_HEIGHT - sim.y) * 90 - sim.vy * 16) * dt;
    sim.vx *= Math.pow(0.52, dt);
  } else sim.vx *= Math.pow(0.7, dt);

  if (supports.length === 0) sim.pitchVel += 2.1 * dt;
  else if (supports.length === 1) {
    const only = supports[0];
    const front = only === 'FL' || only === 'FR' ? 1 : -1;
    const left = only === 'FL' || only === 'BL' ? -1 : 1;
    sim.pitchVel += front * 0.95 * dt;
    sim.rollVel += left * 1.15 * dt;
  } else {
    sim.pitchVel += -sim.pitch * 7.2 * dt;
    sim.rollVel += -sim.roll * 8.0 * dt;
  }
  if (heldCount >= 3) sim.pitchVel += 2.5 * dt;

  sim.pitchVel *= Math.pow(0.26, dt);
  sim.rollVel *= Math.pow(0.28, dt);
  sim.pitch += sim.pitchVel * dt;
  sim.roll += sim.rollVel * dt;
  if (supports.length >= 3) {
    sim.pitch *= Math.pow(0.12, dt);
    sim.roll *= Math.pow(0.12, dt);
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
  if (sim.vx > SPEED_CAP_BASE) sim.vx = SPEED_CAP_BASE;
  if (speedBonus > 0 && sim.vx > 0.2) sim.vx += speedBonus * 0.55 * dt;

  if (Math.abs(sim.pitch) > FALL_PITCH || Math.abs(sim.roll) > FALL_ROLL) {
    sim.fallen = true;
    return 'fall';
  }
  if (sim.x >= TRACK_LENGTH) {
    sim.x = TRACK_LENGTH;
    sim.vx = 0;
    sim.finished = true;
    return 'finish';
  }
  return null;
}

function setHeld(sim, ids, held) {
  for (const id of LEG_IDS) sim.legs[id].held = ids.includes(id) ? held : false;
}

assert.ok(estimateStepImpulse(0.9) > estimateStepImpulse(0.2));
assert.ok(estimateStepImpulse(0) >= 0.5);

// Beginner crawl: random-ish messy steps should still move in 10s
const crawl = createSim();
let phase = 0;
let phaseT = 0;
let pairIdx = 0;
const pairs = [
  ['FL', 'BR'],
  ['FR', 'BL'],
];
while (crawl.elapsed < 10 && !crawl.fallen) {
  phaseT += FIXED_DT;
  // Messy: slightly irregular hold times
  const hold = 0.16 + (pairIdx % 3) * 0.03;
  const gap = 0.12;
  const pair = pairs[pairIdx % 2];
  if (phase === 0) {
    setHeld(crawl, pair, true);
    if (phaseT >= hold) {
      phase = 1;
      phaseT = 0;
    }
  } else {
    setHeld(crawl, pair, false);
    if (phaseT >= gap) {
      phase = 0;
      phaseT = 0;
      pairIdx += 1;
    }
  }
  stepPhysics(crawl, FIXED_DT);
}
assert.ok(crawl.x > 4, `beginner should see progress in 10s, x=${crawl.x}`);

// Practiced diagonal finishes under time limit
const sim = createSim();
pairIdx = 0;
phase = 0;
phaseT = 0;
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
assert.ok(sim.finished, `diagonal gait should finish; x=${sim.x} t=${sim.elapsed}`);
assert.ok(sim.elapsed > 11 && sim.elapsed < 55, `pace band failed t=${sim.elapsed}`);

// Holding all four tips
const tip = createSim();
for (const id of LEG_IDS) tip.legs[id].held = true;
let tipped = false;
for (let i = 0; i < 180 * 3; i++) {
  if (stepPhysics(tip, FIXED_DT) === 'fall' || tip.fallen) {
    tipped = true;
    break;
  }
}
assert.ok(tipped, 'holding all legs should fall');
assert.ok(FIXED_DT <= 1 / 120 && FIXED_DT >= 1 / 240);

console.log(
  `check-physics: ok (10s crawl ${crawl.x.toFixed(1)}m, finish ${sim.elapsed.toFixed(2)}s, falls ${falls})`,
);
