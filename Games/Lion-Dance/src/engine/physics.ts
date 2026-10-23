/**
 * Custom fixed-timestep QWOP-style 4-leg walker (v2).
 * Beat bonuses and combo speed arrive from LionWorld via PlantContext.
 */

import {
  BODY_HEIGHT,
  BODY_LENGTH,
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
  finished: boolean;
  finishAnim: number;
  legs: Record<LegId, LegState>;
  elapsed: number;
  stepCount: number;
}

export interface HudSnapshot {
  distance: number;
  timeLeft: number;
  elapsed: number;
  fallen: boolean;
  finished: boolean;
  finishAnim: number;
  pitch: number;
  roll: number;
  legLift: Record<LegId, number>;
  legSwing: Record<LegId, number>;
  beatPulse: number;
  combo: number;
  perfectFlash: number;
  onBeatRatio: number;
  speedBonus: number;
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
}

export interface PlantEvent {
  leg: LegId;
  perfect: boolean;
  combo: number;
  bonusImpulse: number;
}

export interface StepContext {
  speedBonus: number;
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
    finished: false,
    finishAnim: 0,
    legs,
    elapsed: 0,
    stepCount: 0,
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
  sim.y = BODY_HEIGHT;
  sim.vy = 0;
  sim.vx *= 0.12;
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
  return leg.lift < 0.15 && !leg.held;
}

const DEFAULT_CTX: StepContext = {
  speedBonus: 0,
  onPlant: () => ({ leg: 'FL', perfect: false, combo: 0, bonusImpulse: 0 }),
};

export function stepPhysics(
  sim: SimState,
  dt: number = FIXED_DT,
  ctx: StepContext = DEFAULT_CTX,
): { end: RunEndReason | null; plantEvents: PlantEvent[] } {
  const plantEvents: PlantEvent[] = [];

  if (sim.finished) {
    sim.finishAnim = Math.min(1, sim.finishAnim + dt * 0.75);
    return { end: null, plantEvents };
  }
  if (sim.fallen) {
    sim.fallSpin += dt * (3.6 + sim.fallStyle * 0.8);
    sim.y = Math.max(0.32, sim.y + sim.vy * dt);
    sim.vy -= 11 * dt;
    if (sim.y <= 0.32) {
      sim.y = 0.32;
      sim.vy *= -0.22;
    }
    // Funnier but readable: exaggerate spin, clamp pitch so the silhouette stays clear
    sim.pitch = Math.max(-1.1, Math.min(1.1, sim.pitch + sim.pitchVel * dt));
    sim.roll += sim.rollVel * dt;
    sim.pitchVel *= 0.985;
    sim.rollVel *= 0.985;
    return { end: null, plantEvents };
  }

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
        const impulse = estimateStepImpulse(ahead);
        const plant = ctx.onPlant(id, sim.elapsed);
        plant.leg = id;
        plantEvents.push(plant);
        sim.vx += impulse + plant.bonusImpulse;
        const front = id === 'FL' || id === 'FR' ? 1 : -1;
        sim.pitchVel += front * ahead * -0.48;
        const left = id === 'FL' || id === 'BL' ? -1 : 1;
        sim.rollVel += left * ahead * 0.24;
        leg.pushT = 0.2 + ahead * 0.08;
        leg.plantX = LEG_ATTACH[id].x + Math.sin(leg.swing) * LEG_LENGTH * 0.5;
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

  const supports: LegId[] = [];
  for (const id of LEG_IDS) {
    if (planted(sim.legs[id])) supports.push(id);
  }

  sim.vy -= 18 * dt;

  if (supports.length > 0) {
    sim.vy += ((BODY_HEIGHT - sim.y) * 90 - sim.vy * 16) * dt;
    sim.vx *= Math.pow(0.52, dt);
  } else {
    sim.vx *= Math.pow(0.7, dt);
  }

  // Tip rates — slightly gentler than v1 so first 10s show forward progress
  if (supports.length === 0) {
    sim.pitchVel += 2.1 * dt;
  } else if (supports.length === 1) {
    const only = supports[0]!;
    const front = only === 'FL' || only === 'FR' ? 1 : -1;
    const left = only === 'FL' || only === 'BL' ? -1 : 1;
    sim.pitchVel += front * 0.95 * dt;
    sim.rollVel += left * 1.15 * dt;
  } else {
    sim.pitchVel += -sim.pitch * 7.2 * dt;
    sim.rollVel += -sim.roll * 8.0 * dt;
  }

  if (heldCount >= 3) {
    sim.pitchVel += 2.5 * dt;
    sim.rollVel += (heldCount === 4 ? 1 : -1) * 1.1 * dt;
  }

  const leftHeld = (sim.legs.FL.held ? 1 : 0) + (sim.legs.BL.held ? 1 : 0);
  const rightHeld = (sim.legs.FR.held ? 1 : 0) + (sim.legs.BR.held ? 1 : 0);
  if (Math.abs(leftHeld - rightHeld) === 2) {
    sim.rollVel += (rightHeld - leftHeld) * 0.85 * dt;
  }

  const frontHeld = (sim.legs.FL.held ? 1 : 0) + (sim.legs.FR.held ? 1 : 0);
  const backHeld = (sim.legs.BL.held ? 1 : 0) + (sim.legs.BR.held ? 1 : 0);
  if (frontHeld === 2 && backHeld === 0) sim.pitchVel -= 1.45 * dt;
  if (backHeld === 2 && frontHeld === 0) sim.pitchVel += 1.45 * dt;

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

  const cap = SPEED_CAP_BASE + (SPEED_CAP_COMBO - SPEED_CAP_BASE) * Math.min(1, ctx.speedBonus / 0.16);
  if (sim.vx > cap) sim.vx = cap;
  // Apply gentle continuous combo bonus as residual accel while moving
  if (ctx.speedBonus > 0 && sim.vx > 0.2) {
    sim.vx += ctx.speedBonus * 0.55 * dt;
    if (sim.vx > cap) sim.vx = cap;
  }

  if (Math.abs(sim.pitch) > FALL_PITCH || Math.abs(sim.roll) > FALL_ROLL) {
    sim.fallen = true;
    sim.fallStyle = Math.random();
    sim.pitchVel += (Math.random() - 0.5) * 4.5;
    sim.rollVel += (0.8 + Math.random() * 1.4) * (Math.random() < 0.5 ? -1 : 1) * 5;
    sim.vy = 2.4;
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
  for (const id of LEG_IDS) {
    legLift[id] = sim.legs[id].lift;
    legSwing[id] = sim.legs[id].swing;
  }
  return {
    distance: Math.min(TRACK_LENGTH, Math.max(0, sim.x)),
    timeLeft: Math.max(0, timeLimit - sim.elapsed),
    elapsed: sim.elapsed,
    fallen: sim.fallen,
    finished: sim.finished,
    finishAnim: sim.finishAnim,
    pitch: sim.pitch,
    roll: sim.roll,
    legLift,
    legSwing,
  };
}

/** Plant impulse — tuned so messy first steps still crawl forward. */
export function estimateStepImpulse(swingAhead: number): number {
  const ahead = Math.max(0, swingAhead);
  return 0.52 + ahead * 1.25;
}

export { BODY_LENGTH };
