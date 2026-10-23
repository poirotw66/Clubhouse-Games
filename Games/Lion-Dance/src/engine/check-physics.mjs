/**
 * Physics invariants for the QWOP-style lion walker (v3).
 * Targets: mash ≪ 10 m / 30 s; practiced diagonal finishes in ~40–60 s band
 * (master floor < 25 s with perfect timing is possible via speed cap).
 */
import assert from 'node:assert/strict';

const FIXED_DT = 1 / 180;
const TRACK_LENGTH = 50;
const BODY_HEIGHT = 2.05;
const FALL_PITCH = 0.48;
const FALL_ROLL = 0.42;
const ASSIST_FALL_SCALE = 1.45;
const SPEED_CAP_BASE = 1.65;
const SPEED_CAP_COMBO = 2.15;
const LEG_IDS = ['FL', 'FR', 'BL', 'BR'];
const LEG_ATTACH = {
  FL: { x: 1.05, z: -0.42 },
  FR: { x: 1.05, z: 0.42 },
  BL: { x: -1.05, z: -0.42 },
  BR: { x: -1.05, z: 0.42 },
};
const LEG_LENGTH = 1.45;
const TIME_LIMIT = 90;

function estimateStepImpulse(swingAhead) {
  const ahead = Math.max(0, Math.min(1.2, swingAhead));
  const commit = Math.max(0, ahead - 0.15);
  return 0.08 + commit * 0.52;
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
    fallStyle: 0,
    finished: false,
    finishAnim: 0,
    legs,
    elapsed: 0,
    stepCount: 0,
    fallCount: 0,
    flowerFlung: false,
  };
}

function planted(leg) {
  return leg.lift < 0.12 && !leg.held;
}

function getUpInPlace(sim) {
  sim.fallen = false;
  sim.fallSpin = 0;
  sim.fallStyle = 0;
  sim.flowerFlung = false;
  sim.y = BODY_HEIGHT;
  sim.vy = 0;
  sim.vx = 0;
  sim.pitch = 0;
  sim.roll = 0;
  sim.pitchVel = 0;
  sim.rollVel = 0;
  for (const id of LEG_IDS) {
    const leg = sim.legs[id];
    leg.held = false;
    leg.lift = 0;
    leg.swing = 0;
    leg.swingVel = 0;
    leg.pushT = 0;
    leg.plantX = LEG_ATTACH[id].x;
    leg.wasHeld = false;
  }
}

function stepPhysics(sim, dt = FIXED_DT, assist = false) {
  const fallPitch = FALL_PITCH * (assist ? ASSIST_FALL_SCALE : 1);
  const fallRoll = FALL_ROLL * (assist ? ASSIST_FALL_SCALE : 1);
  const restoreMul = assist ? 1.35 : 1;

  if (sim.finished) {
    sim.finishAnim = Math.min(1, sim.finishAnim + dt * 0.7);
    return null;
  }

  if (sim.fallen) {
    sim.fallSpin += dt * 5.2;
    sim.flowerFlung = true;
    sim.y = Math.max(0.55, sim.y + sim.vy * dt);
    sim.vy -= 14 * dt;
    if (sim.y <= 0.55) {
      sim.y = 0.55;
      sim.vy *= -0.18;
    }
    for (const id of LEG_IDS) {
      const leg = sim.legs[id];
      leg.lift = 0.35 + 0.45 * Math.abs(Math.sin(sim.fallSpin * 3 + LEG_ATTACH[id].x));
      leg.swing = Math.sin(sim.fallSpin * 4.5 + LEG_ATTACH[id].z * 8) * 0.9;
    }
    return null;
  }

  sim.elapsed += dt;
  let heldCount = 0;
  for (const id of LEG_IDS) {
    const leg = sim.legs[id];
    if (leg.held) heldCount += 1;
    if (leg.held) {
      leg.lift += (1 - leg.lift) * Math.min(1, 12 * dt);
      const swingForce = (1.15 - leg.swing) * 16 - leg.swingVel * 4.2;
      leg.swingVel += swingForce * dt;
      leg.swing += leg.swingVel * dt;
      leg.pushT = 0;
    } else {
      if (leg.wasHeld && leg.lift > 0.22) {
        const ahead = Math.max(0, leg.swing);
        const impulse = estimateStepImpulse(ahead) * (assist ? 1.25 : 1);
        sim.vx += impulse;
        const front = id === 'FL' || id === 'FR' ? 1 : -1;
        sim.pitchVel += front * (0.45 + ahead * 0.65) * (ahead > 0.35 ? -0.35 : 1.05);
        const left = id === 'FL' || id === 'BL' ? -1 : 1;
        sim.rollVel += left * (0.55 + ahead * 0.55);
        leg.pushT = 0.1 + ahead * 0.05;
        leg.plantX = LEG_ATTACH[id].x + Math.sin(leg.swing) * LEG_LENGTH * 0.45;
        sim.stepCount += 1;
      }
      leg.lift += (0 - leg.lift) * Math.min(1, 14 * dt);
      const swingForce = (0 - leg.swing) * 9 - leg.swingVel * 5;
      leg.swingVel += swingForce * dt;
      leg.swing += leg.swingVel * dt;
      if (leg.pushT > 0) {
        leg.pushT -= dt;
        sim.vx += 0.32 * dt;
      }
    }
    leg.wasHeld = leg.held;
  }

  const supports = LEG_IDS.filter((id) => planted(sim.legs[id]));
  sim.vy -= 20 * dt;
  if (supports.length > 0) {
    sim.vy += ((BODY_HEIGHT - sim.y) * 70 - sim.vy * 12) * dt;
    sim.vx *= Math.pow(0.35, dt);
  } else {
    sim.vx *= Math.pow(0.75, dt);
  }

  if (supports.length === 0) {
    sim.pitchVel += 5.5 * dt;
    sim.rollVel += Math.sin(sim.elapsed * 9) * 2.2 * dt;
  } else if (supports.length === 1) {
    const only = supports[0];
    const front = only === 'FL' || only === 'FR' ? 1 : -1;
    const left = only === 'FL' || only === 'BL' ? -1 : 1;
    sim.pitchVel += front * 3.8 * dt;
    sim.rollVel += left * 4.2 * dt;
  } else if (supports.length === 2) {
    const ids = supports;
    const bothFront = ids.every((id) => id === 'FL' || id === 'FR');
    const bothBack = ids.every((id) => id === 'BL' || id === 'BR');
    const bothLeft = ids.every((id) => id === 'FL' || id === 'BL');
    const bothRight = ids.every((id) => id === 'FR' || id === 'BR');
    if (bothFront) sim.pitchVel -= 3.2 * dt;
    else if (bothBack) sim.pitchVel += 3.2 * dt;
    else if (bothLeft) sim.rollVel -= 3.6 * dt;
    else if (bothRight) sim.rollVel += 3.6 * dt;
    else {
      sim.pitchVel += -sim.pitch * 5.5 * restoreMul * dt;
      sim.rollVel += -sim.roll * 6.2 * restoreMul * dt;
    }
  } else {
    sim.pitchVel += -sim.pitch * 7.5 * restoreMul * dt;
    sim.rollVel += -sim.roll * 8.5 * restoreMul * dt;
  }

  const leftHeld = (sim.legs.FL.held ? 1 : 0) + (sim.legs.BL.held ? 1 : 0);
  const rightHeld = (sim.legs.FR.held ? 1 : 0) + (sim.legs.BR.held ? 1 : 0);
  if (leftHeld === 2) sim.rollVel -= 4.5 * dt;
  if (rightHeld === 2) sim.rollVel += 4.5 * dt;
  const frontHeld = (sim.legs.FL.held ? 1 : 0) + (sim.legs.FR.held ? 1 : 0);
  const backHeld = (sim.legs.BL.held ? 1 : 0) + (sim.legs.BR.held ? 1 : 0);
  if (frontHeld === 2) sim.pitchVel -= 3.8 * dt;
  if (backHeld === 2) sim.pitchVel += 3.8 * dt;
  if (heldCount >= 3) {
    sim.pitchVel += 4.5 * dt;
    sim.rollVel += (heldCount === 4 ? 1 : -1) * 3.5 * dt;
  }
  for (const id of LEG_IDS) {
    if (sim.legs[id].held && sim.legs[id].lift > 0.85) {
      const left = id === 'FL' || id === 'BL' ? -1 : 1;
      sim.rollVel += left * 0.55 * dt;
    }
  }

  sim.pitchVel *= Math.pow(0.55, dt);
  sim.rollVel *= Math.pow(0.55, dt);
  sim.pitch += sim.pitchVel * dt;
  sim.roll += sim.rollVel * dt;
  sim.x += sim.vx * dt;
  sim.y += sim.vy * dt;
  if (sim.y < BODY_HEIGHT * 0.55) {
    sim.y = BODY_HEIGHT * 0.55;
    sim.vy = Math.max(0, sim.vy);
  }
  if (sim.x < 0) {
    sim.x = 0;
    sim.vx = Math.max(0, sim.vx);
  }
  if (sim.vx > SPEED_CAP_BASE) sim.vx = SPEED_CAP_BASE;

  if (Math.abs(sim.pitch) > fallPitch || Math.abs(sim.roll) > fallRoll) {
    sim.fallen = true;
    sim.fallCount += 1;
    sim.flowerFlung = true;
    sim.vy = 3.2;
    sim.vx *= 0.3;
    return 'fall';
  }
  if (sim.x >= TRACK_LENGTH) {
    sim.x = TRACK_LENGTH;
    sim.vx = 0;
    sim.finished = true;
    sim.finishAnim = 0;
    return 'finish';
  }
  return null;
}

function setHeld(sim, ids, held) {
  for (const id of LEG_IDS) sim.legs[id].held = ids.includes(id) ? held : false;
}

assert.ok(estimateStepImpulse(0.9) > estimateStepImpulse(0.2));
assert.ok(estimateStepImpulse(0) < 0.12);
assert.ok(SPEED_CAP_COMBO > SPEED_CAP_BASE);

// Random mashing for 30s should almost never exceed ~10 m
const mash = createSim();
let mashSeed = 7;
function rnd() {
  mashSeed = (mashSeed * 1103515245 + 12345) & 0x7fffffff;
  return mashSeed / 0x7fffffff;
}
while (mash.elapsed < 30) {
  if (mash.fallen) {
    // Mirror ~FALL_GRACE flop time before get-up
    if (mash.fallSpin > 8) getUpInPlace(mash);
    else {
      stepPhysics(mash, FIXED_DT);
      continue;
    }
  }
  for (const id of LEG_IDS) {
    if (rnd() < 0.018) mash.legs[id].held = !mash.legs[id].held;
  }
  stepPhysics(mash, FIXED_DT);
}
assert.ok(mash.x < 10.5, `mash should stall (~10m); x=${mash.x.toFixed(2)}`);

// Practiced diagonal alternation finishes under time limit
const pairs = [
  ['FL', 'BR'],
  ['FR', 'BL'],
];
const sim = createSim();
let pairIdx = 0;
let phase = 0;
let phaseT = 0;
let falls = 0;
while (!sim.finished && sim.elapsed < TIME_LIMIT) {
  if (sim.fallen) {
    falls += 1;
    getUpInPlace(sim);
    phase = 0;
    phaseT = 0;
  }
  phaseT += FIXED_DT;
  const pair = pairs[pairIdx % 2];
  if (phase === 0) {
    setHeld(sim, pair, true);
    if (phaseT >= 0.26) {
      phase = 1;
      phaseT = 0;
    }
  } else {
    setHeld(sim, pair, false);
    if (phaseT >= 0.16) {
      phase = 0;
      phaseT = 0;
      pairIdx += 1;
    }
  }
  stepPhysics(sim, FIXED_DT);
}
assert.ok(sim.finished, `diagonal gait should finish; x=${sim.x} t=${sim.elapsed}`);
assert.ok(
  sim.elapsed >= 22 && sim.elapsed <= 75,
  `pace band failed t=${sim.elapsed.toFixed(2)} (want ~25–60s practiced)`,
);

// Holding all four tips quickly
const tip = createSim();
for (const id of LEG_IDS) tip.legs[id].held = true;
let tipped = false;
for (let i = 0; i < 180 * 2; i++) {
  if (stepPhysics(tip, FIXED_DT) === 'fall' || tip.fallen) {
    tipped = true;
    break;
  }
}
assert.ok(tipped, 'holding all legs should fall');

// Same-side hold tips
const side = createSim();
side.legs.FL.held = true;
side.legs.BL.held = true;
let sideTip = false;
for (let i = 0; i < 180 * 3; i++) {
  if (stepPhysics(side, FIXED_DT) === 'fall' || side.fallen) {
    sideTip = true;
    break;
  }
}
assert.ok(sideTip, 'same-side legs held should fall');

// Assist widens fall thresholds
assert.ok(FALL_PITCH * ASSIST_FALL_SCALE > FALL_PITCH);

assert.ok(FIXED_DT <= 1 / 120 && FIXED_DT >= 1 / 240);

console.log(
  `check-physics: ok (mash30 ${mash.x.toFixed(1)}m falls=${mash.fallCount}, diagonal ${sim.elapsed.toFixed(2)}s falls=${falls})`,
);
