/**
 * Custom fixed-timestep QWOP-style 4-leg walker.
 * No external physics engine — spring supports, swing impulses, tip-to-fall.
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
  TRACK_LENGTH,
  type LegId,
} from './constants';

export interface LegState {
  id: LegId;
  held: boolean;
  /** 0 = planted, 1 = fully lifted. */
  lift: number;
  /** Swing angle (rad); +forward. */
  swing: number;
  swingVel: number;
  /** Forward plant offset relative to hip when last planted. */
  plantX: number;
  /** Seconds remaining of plant-push thrust. */
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
}

export type RunEndReason = 'finish' | 'timeout' | 'fall';

export interface RunResult {
  reason: RunEndReason;
  elapsed: number;
  distance: number;
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

export function resetAfterFall(sim: SimState): void {
  const x = Math.max(0, sim.x - 0.4);
  const next = createSim();
  next.x = x;
  next.elapsed = sim.elapsed;
  Object.assign(sim, next);
}

/** Soft get-up used by R when fallen mid-run before overlay settles. */
export function getUpInPlace(sim: SimState): void {
  if (!sim.fallen) return;
  sim.fallen = false;
  sim.fallSpin = 0;
  sim.y = BODY_HEIGHT;
  sim.vy = 0;
  sim.vx *= 0.15;
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

export function stepPhysics(sim: SimState, dt: number = FIXED_DT): RunResult | null {
  if (sim.finished) {
    sim.finishAnim = Math.min(1, sim.finishAnim + dt * 0.85);
    return null;
  }
  if (sim.fallen) {
    sim.fallSpin += dt * 4.2;
    sim.y = Math.max(0.35, sim.y + sim.vy * dt);
    sim.vy -= 12 * dt;
    if (sim.y <= 0.35) {
      sim.y = 0.35;
      sim.vy *= -0.25;
    }
    sim.pitch += sim.pitchVel * dt;
    sim.roll += sim.rollVel * dt;
    sim.pitchVel *= 0.98;
    sim.rollVel *= 0.98;
    return null;
  }

  sim.elapsed += dt;

  let heldCount = 0;
  for (const id of LEG_IDS) {
    const leg = sim.legs[id];
    if (leg.held) heldCount += 1;

    if (leg.held) {
      leg.lift += (1 - leg.lift) * Math.min(1, 16 * dt);
      const swingTarget = 1.05;
      const swingForce = (swingTarget - leg.swing) * 22 - leg.swingVel * 5;
      leg.swingVel += swingForce * dt;
      leg.swing += leg.swingVel * dt;
      leg.pushT = 0;
    } else {
      if (leg.wasHeld && leg.lift > 0.18) {
        const ahead = Math.max(0, leg.swing);
        // Arcade push — practiced diagonal gait finishes well under 90s
        const impulse = estimateStepImpulse(ahead);
        sim.vx += impulse;
        const front = id === 'FL' || id === 'FR' ? 1 : -1;
        sim.pitchVel += front * ahead * -0.55;
        const left = id === 'FL' || id === 'BL' ? -1 : 1;
        sim.rollVel += left * ahead * 0.28;
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
        sim.vx += 1.8 * dt;
      }
    }
    leg.wasHeld = leg.held;
  }

  const supports: LegId[] = [];
  for (const id of LEG_IDS) {
    if (planted(sim.legs[id])) supports.push(id);
  }

  const g = 18;
  sim.vy -= g * dt;

  if (supports.length > 0) {
    const spring = 90;
    const damp = 16;
    sim.vy += ((BODY_HEIGHT - sim.y) * spring - sim.vy * damp) * dt;
    // Mild ground drag — keep momentum between steps
    sim.vx *= Math.pow(0.55, dt);
  } else {
    sim.vx *= Math.pow(0.7, dt);
  }

  // Tip from asymmetric / airborne support
  if (supports.length === 0) {
    sim.pitchVel += 2.4 * dt;
  } else if (supports.length === 1) {
    const only = supports[0]!;
    const front = only === 'FL' || only === 'FR' ? 1 : -1;
    const left = only === 'FL' || only === 'BL' ? -1 : 1;
    sim.pitchVel += front * 1.1 * dt;
    sim.rollVel += left * 1.3 * dt;
  } else {
    // Restoring when 2+ planted
    sim.pitchVel += -sim.pitch * 6.5 * dt;
    sim.rollVel += -sim.roll * 7.5 * dt;
  }

  if (heldCount >= 3) {
    sim.pitchVel += 2.8 * dt;
    sim.rollVel += (heldCount === 4 ? 1 : -1) * 1.2 * dt;
  }

  const leftHeld = (sim.legs.FL.held ? 1 : 0) + (sim.legs.BL.held ? 1 : 0);
  const rightHeld = (sim.legs.FR.held ? 1 : 0) + (sim.legs.BR.held ? 1 : 0);
  if (Math.abs(leftHeld - rightHeld) === 2) {
    sim.rollVel += (rightHeld - leftHeld) * 0.9 * dt;
  }

  // Holding both front or both back tips pitch
  const frontHeld = (sim.legs.FL.held ? 1 : 0) + (sim.legs.FR.held ? 1 : 0);
  const backHeld = (sim.legs.BL.held ? 1 : 0) + (sim.legs.BR.held ? 1 : 0);
  if (frontHeld === 2 && backHeld === 0) sim.pitchVel -= 1.6 * dt;
  if (backHeld === 2 && frontHeld === 0) sim.pitchVel += 1.6 * dt;

  sim.pitchVel *= Math.pow(0.28, dt);
  sim.rollVel *= Math.pow(0.3, dt);
  sim.pitch += sim.pitchVel * dt;
  sim.roll += sim.rollVel * dt;

  // Clamp gentle lean while well supported
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
  // Soft speed cap — theoretical floor ~14s at perfect cadence
  if (sim.vx > 3.6) sim.vx = 3.6;

  if (Math.abs(sim.pitch) > FALL_PITCH || Math.abs(sim.roll) > FALL_ROLL) {
    sim.fallen = true;
    sim.pitchVel += (Math.random() - 0.5) * 5;
    sim.rollVel += (Math.random() - 0.5) * 7;
    sim.vy = 2.2;
    return { reason: 'fall', elapsed: sim.elapsed, distance: sim.x };
  }

  if (sim.x >= TRACK_LENGTH) {
    sim.x = TRACK_LENGTH;
    sim.vx = 0;
    sim.finished = true;
    sim.finishAnim = 0;
    return { reason: 'finish', elapsed: sim.elapsed, distance: TRACK_LENGTH };
  }

  return null;
}

export function snapshotHud(sim: SimState, timeLimit: number): HudSnapshot {
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

/** Plant impulse magnitude — shared with check-physics. */
export function estimateStepImpulse(swingAhead: number): number {
  const ahead = Math.max(0, swingAhead);
  return 0.45 + ahead * 1.35;
}

export { BODY_LENGTH };
