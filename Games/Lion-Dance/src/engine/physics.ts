/**
 * Custom fixed-timestep QWOP-style 4-leg walker (v3).
 * Hard balance: same-side / airborne / mash → tip; diagonal timing required.
 */

import {
  ASSIST_FALL_SCALE,
  BODY_HEIGHT,
  FALL_PITCH,
  FALL_ROLL,
  FIXED_DT,
  LEG_ATTACH,
  LEG_IDS,
  LEG_LENGTH,
  SPEED_CAP_BASE,
  SPEED_CAP_COMBO,
  TRACK_LENGTH,
  type LegId,
} from './constants';

export interface LegState {
  id: LegId;
  held: boolean;
  lift: number;
  swing: number;
  swingVel: number;
  plantX: number;
  pushT: number;
  wasHeld: boolean;
}

export interface SimState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  pitch: number;
  roll: number;
  pitchVel: number;
  rollVel: number;
  fallen: boolean;
  fallSpin: number;
  fallStyle: number;
  /** −1 left / +1 right side collapse. */
  fallSide: number;
  fallBounce: number;
  finished: boolean;
  finishAnim: number;
  legs: Record<LegId, LegState>;
  elapsed: number;
  stepCount: number;
  fallCount: number;
  flowerFlung: boolean;
}

export interface HudSnapshot {
  distance: number;
  distanceToGoal: number;
  timeLeft: number;
  elapsed: number;
  fallen: boolean;
  finished: boolean;
  finishAnim: number;
  pitch: number;
  roll: number;
  legLift: Record<LegId, number>;
  legSwing: Record<LegId, number>;
  legHeld: Record<LegId, boolean>;
  beatPulse: number;
  combo: number;
  perfectFlash: number;
  onBeatRatio: number;
  speedBonus: number;
  fallCount: number;
  steps: number;
}

export type RunEndReason = 'finish' | 'timeout' | 'fall';

export interface RunResult {
  reason: RunEndReason;
  elapsed: number;
  distance: number;
  perfects: number;
  plants: number;
  onBeatRatio: number;
  maxCombo: number;
  mode: '1p' | '2p';
  fallCount: number;
}

export interface PlantEvent {
  leg: LegId;
  perfect: boolean;
  combo: number;
  bonusImpulse: number;
}

export interface StepContext {
  speedBonus: number;
  assist: boolean;
  onPlant: (leg: LegId, elapsed: number) => PlantEvent;
}

function makeLeg(id: LegId): LegState {
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

export function createSim(): SimState {
  const legs = {} as Record<LegId, LegState>;
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
    fallSide: 1,
    fallBounce: 0,
    finished: false,
    finishAnim: 0,
    legs,
    elapsed: 0,
    stepCount: 0,
    fallCount: 0,
    flowerFlung: false,
  };
}

export function setLegHeld(sim: SimState, id: LegId, held: boolean): void {
  if (sim.fallen || sim.finished) return;
  sim.legs[id].held = held;
}

export function getUpInPlace(sim: SimState): void {
  if (!sim.fallen) return;
  sim.fallen = false;
  sim.fallSpin = 0;
  sim.fallStyle = 0;
  sim.fallSide = 1;
  sim.fallBounce = 0;
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

function planted(leg: LegState): boolean {
  return leg.lift < 0.12 && !leg.held;
}

const DEFAULT_CTX: StepContext = {
  speedBonus: 0,
  assist: false,
  onPlant: () => ({ leg: 'FL', perfect: false, combo: 0, bonusImpulse: 0 }),
};

export function stepPhysics(
  sim: SimState,
  dt: number = FIXED_DT,
  ctx: StepContext = DEFAULT_CTX,
): { end: RunEndReason | null; plantEvents: PlantEvent[] } {
  const plantEvents: PlantEvent[] = [];
  const fallPitch = FALL_PITCH * (ctx.assist ? ASSIST_FALL_SCALE : 1);
  const fallRoll = FALL_ROLL * (ctx.assist ? ASSIST_FALL_SCALE : 1);
  const restoreMul = ctx.assist ? 1.35 : 1;

  if (sim.finished) {
    sim.finishAnim = Math.min(1, sim.finishAnim + dt * 0.7);
    return { end: null, plantEvents };
  }

  if (sim.fallen) {
    sim.fallSpin += dt * 4.8;
    sim.flowerFlung = true;
    sim.fallBounce = Math.min(1, sim.fallBounce + dt * 1.8);
    // Squash-and-bounce onto the side
    sim.y = Math.max(0.42, sim.y + sim.vy * dt);
    sim.vy -= 16 * dt;
    if (sim.y <= 0.42) {
      sim.y = 0.42;
      if (Math.abs(sim.vy) > 1.2) sim.vy *= -0.35;
      else sim.vy = 0;
    }
    for (const id of LEG_IDS) {
      const leg = sim.legs[id];
      const phase = sim.fallSpin * 3.4 + LEG_ATTACH[id].x * 2 + LEG_ATTACH[id].z * 5;
      leg.lift = 0.4 + 0.55 * Math.abs(Math.sin(phase));
      leg.swing = Math.sin(phase * 1.3) * 1.1;
    }
    sim.pitch = Math.max(-0.9, Math.min(0.4, sim.pitch + sim.pitchVel * dt));
    sim.rollVel *= 0.985;
    sim.pitchVel *= 0.99;
    return { end: null, plantEvents };
  }

  sim.elapsed += dt;

  let heldCount = 0;
  for (const id of LEG_IDS) {
    const leg = sim.legs[id];
    if (leg.held) heldCount += 1;

    if (leg.held) {
      // High visible lift + forward swing
      leg.lift += (1 - leg.lift) * Math.min(1, 12 * dt);
      const swingForce = (1.15 - leg.swing) * 16 - leg.swingVel * 4.2;
      leg.swingVel += swingForce * dt;
      leg.swing += leg.swingVel * dt;
      leg.pushT = 0;
    } else {
      if (leg.wasHeld && leg.lift > 0.22) {
        const ahead = Math.max(0, leg.swing);
        // Weak push — need many well-timed diagonal steps
        const impulse = estimateStepImpulse(ahead) * (ctx.assist ? 1.25 : 1);
        const plant = ctx.onPlant(id, sim.elapsed);
        plant.leg = id;
        plantEvents.push(plant);
        sim.vx += impulse + plant.bonusImpulse;
        const front = id === 'FL' || id === 'FR' ? 1 : -1;
        // Planting a forward-swung leg pitches the body over that hip
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

  const supports: LegId[] = [];
  for (const id of LEG_IDS) {
    if (planted(sim.legs[id])) supports.push(id);
  }

  sim.vy -= 20 * dt;
  if (supports.length > 0) {
    sim.vy += ((BODY_HEIGHT - sim.y) * 70 - sim.vy * 12) * dt;
    sim.vx *= Math.pow(0.35, dt);
  } else {
    sim.vx *= Math.pow(0.75, dt);
  }

  // ── Balance from support polygon ──────────────────────────────────
  if (supports.length === 0) {
    sim.pitchVel += 5.5 * dt;
    sim.rollVel += (Math.sin(sim.elapsed * 9) * 2.2) * dt;
  } else if (supports.length === 1) {
    const only = supports[0]!;
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
      // Diagonal support — only stable case
      sim.pitchVel += -sim.pitch * 5.5 * restoreMul * dt;
      sim.rollVel += -sim.roll * 6.2 * restoreMul * dt;
    }
  } else {
    sim.pitchVel += -sim.pitch * 7.5 * restoreMul * dt;
    sim.rollVel += -sim.roll * 8.5 * restoreMul * dt;
  }

  // Holding same-side legs up is lethal
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

  // Holding a leg too long without planting builds tip
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

  const cap =
    SPEED_CAP_BASE + (SPEED_CAP_COMBO - SPEED_CAP_BASE) * Math.min(1, ctx.speedBonus / 0.08);
  if (sim.vx > cap) sim.vx = cap;
  if (ctx.speedBonus > 0 && sim.vx > 0.15) {
    sim.vx += ctx.speedBonus * 0.35 * dt;
    if (sim.vx > cap) sim.vx = cap;
  }

  if (Math.abs(sim.pitch) > fallPitch || Math.abs(sim.roll) > fallRoll) {
    sim.fallen = true;
    sim.fallCount += 1;
    sim.flowerFlung = true;
    sim.fallStyle = Math.random();
    sim.fallBounce = 0;
    const side = Math.sign(sim.roll) || (Math.random() < 0.5 ? -1 : 1);
    sim.fallSide = side;
    sim.rollVel = side * (5.2 + Math.random() * 2.5);
    sim.pitchVel += (Math.random() - 0.5) * 2.5;
    sim.vy = 4.0;
    sim.vx *= 0.25;
    return { end: 'fall', plantEvents };
  }

  if (sim.x >= TRACK_LENGTH) {
    sim.x = TRACK_LENGTH;
    sim.vx = 0;
    sim.finished = true;
    sim.finishAnim = 0;
    return { end: 'finish', plantEvents };
  }

  return { end: null, plantEvents };
}

export function snapshotHudBase(sim: SimState, timeLimit: number): Omit<
  HudSnapshot,
  'beatPulse' | 'combo' | 'perfectFlash' | 'onBeatRatio' | 'speedBonus'
> {
  const legLift = {} as Record<LegId, number>;
  const legSwing = {} as Record<LegId, number>;
  const legHeld = {} as Record<LegId, boolean>;
  for (const id of LEG_IDS) {
    legLift[id] = sim.legs[id].lift;
    legSwing[id] = sim.legs[id].swing;
    legHeld[id] = sim.legs[id].held;
  }
  const distance = Math.min(TRACK_LENGTH, Math.max(0, sim.x));
  return {
    distance,
    distanceToGoal: Math.max(0, TRACK_LENGTH - distance),
    timeLeft: Math.max(0, timeLimit - sim.elapsed),
    elapsed: sim.elapsed,
    fallen: sim.fallen,
    finished: sim.finished,
    finishAnim: sim.finishAnim,
    pitch: sim.pitch,
    roll: sim.roll,
    legLift,
    legSwing,
    legHeld,
    fallCount: sim.fallCount,
    steps: sim.stepCount,
  };
}

/** Weak plant impulse — many diagonal steps needed for 50m. */
export function estimateStepImpulse(swingAhead: number): number {
  const ahead = Math.max(0, Math.min(1.2, swingAhead));
  // Require a committed forward swing; button-mash micro-plants barely move.
  const commit = Math.max(0, ahead - 0.15);
  return 0.08 + commit * 0.52;
}
