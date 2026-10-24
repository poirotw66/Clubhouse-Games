/**
 * Continuous-traction 4-leg walker (v6 feel).
 * Spring contacts + tip/righting torques; thrust from grounded legs sweeping back.
 * Independent implementation — numbers/mechanisms only from the tuning report.
 */

import {
  A_BACK,
  A_FWD,
  AIR_DRAG,
  ANG_DAMP,
  ASSIST_RIGHTING,
  BAL2,
  BAL4,
  BALANCE,
  BODY_HEIGHT,
  COM_X,
  FALL_PITCH,
  FALL_PITCH_CLAMP,
  FALL_ROLL,
  FALL_ROLL_CLAMP,
  FIXED_DT,
  GET_UP_DURATION,
  GRAVITY,
  I_PITCH,
  I_ROLL,
  LEG_ATTACH,
  LEG_I,
  LEG_IDS,
  LIFT_RATE,
  LIFT_SHORTEN,
  PUSH_RATE,
  REAR_COUPLE,
  RETURN_RATE,
  SLIDE,
  SPRING_C,
  SPRING_K,
  SWING_RATE,
  TIP_PITCH,
  TIP_ROLL,
  TRACK_LENGTH,
  TRACTION,
  WARN_PITCH,
  WARN_ROLL,
  legLength,
  restBodyHeight,
  type LegId,
} from './constants';

export interface LegState {
  id: LegId;
  held: boolean;
  /** 0..1 lift amount (shortens effective stick). */
  lift: number;
  /** Hip angle rad; + = swung forward. */
  swing: number;
  /** Previous angle for Δω recoil / sweep speed. */
  prevSwing: number;
  grounded: boolean;
  wasGrounded: boolean;
  plantX: number;
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
  yaw: number;
  yawVel: number;
  lateral: number;
  fallen: boolean;
  fallLanded: boolean;
  fallSpin: number;
  fallStyle: number;
  fallSide: number;
  fallBounce: number;
  /** 0..1 get-up blend; >0 means animating up. */
  getUpT: number;
  tipping: boolean;
  finished: boolean;
  finishAnim: number;
  legs: Record<LegId, LegState>;
  elapsed: number;
  stepCount: number;
  fallCount: number;
  flowerFlung: boolean;
  maxSpeed: number;
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
  tipping: boolean;
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
  maxSpeed: number;
}

export type RunEndReason = 'finish' | 'timeout';

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
  maxSpeed: number;
  steps: number;
}

export interface PlantEvent {
  leg: LegId;
  perfect: boolean;
  combo: number;
  impact: number;
}

export interface StepContext {
  /** Traction multiplier from Perfect combo (typically 1 + bonus). */
  tractionMul: number;
  assist: boolean;
  onPlant: (leg: LegId, elapsed: number, impact: number) => PlantEvent;
}

function makeLeg(id: LegId): LegState {
  return {
    id,
    held: false,
    lift: 0,
    swing: 0,
    prevSwing: 0,
    grounded: false,
    wasGrounded: false,
    plantX: LEG_ATTACH[id].x,
  };
}

export function createSim(): SimState {
  const legs = {} as Record<LegId, LegState>;
  for (const id of LEG_IDS) legs[id] = makeLeg(id);
  const y0 = restBodyHeight();
  return {
    x: 0,
    y: y0,
    vx: 0,
    vy: 0,
    pitch: 0,
    roll: 0,
    pitchVel: 0,
    rollVel: 0,
    yaw: 0,
    yawVel: 0,
    lateral: 0,
    fallen: false,
    fallLanded: false,
    fallSpin: 0,
    fallStyle: 0,
    fallSide: 1,
    fallBounce: 0,
    getUpT: 0,
    tipping: false,
    finished: false,
    finishAnim: 0,
    legs,
    elapsed: 0,
    stepCount: 0,
    fallCount: 0,
    flowerFlung: false,
    maxSpeed: 0,
  };
}

export function setLegHeld(sim: SimState, id: LegId, held: boolean): void {
  if (sim.finished || sim.getUpT > 0) return;
  sim.legs[id].held = held;
}

function smoothstep(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

/** Begin get-up (R / button). Only once fallen & landed. */
export function beginGetUp(sim: SimState): boolean {
  if (!sim.fallen || !sim.fallLanded || sim.getUpT > 0 || sim.finished) return false;
  sim.getUpT = 1e-6;
  return true;
}

/** Instant reset used after get-up blend finishes (and by tests). */
export function getUpInPlace(sim: SimState): void {
  sim.fallen = false;
  sim.fallLanded = false;
  sim.fallSpin = 0;
  sim.fallStyle = 0;
  sim.fallSide = 1;
  sim.fallBounce = 0;
  sim.getUpT = 0;
  sim.flowerFlung = false;
  sim.tipping = false;
  sim.y = restBodyHeight();
  sim.vy = 0;
  sim.vx = 0;
  sim.pitch = 0;
  sim.roll = 0;
  sim.pitchVel = 0;
  sim.rollVel = 0;
  sim.yaw = 0;
  sim.yawVel = 0;
  sim.lateral = 0;
  for (const id of LEG_IDS) {
    const leg = sim.legs[id];
    leg.held = false;
    leg.lift = 0;
    leg.swing = 0;
    leg.prevSwing = 0;
    leg.grounded = false;
    leg.wasGrounded = false;
    leg.plantX = LEG_ATTACH[id].x;
  }
}

function hipWorldY(sim: SimState, id: LegId): number {
  const a = LEG_ATTACH[id];
  // +pitch (nose up) raises the front hip; +roll raises the +Z (near) hip.
  return sim.y + a.x * Math.sin(sim.pitch) + a.z * Math.sin(sim.roll);
}

function hipWorldVy(sim: SimState, id: LegId): number {
  const a = LEG_ATTACH[id];
  return (
    sim.vy +
    a.x * Math.cos(sim.pitch) * sim.pitchVel +
    a.z * Math.cos(sim.roll) * sim.rollVel
  );
}

function approachAngle(current: number, target: number, maxRate: number, dt: number): number {
  const d = target - current;
  const step = Math.max(-maxRate * dt, Math.min(maxRate * dt, d));
  return current + step;
}

function approachLift(current: number, target: number, dt: number): number {
  const d = target - current;
  const step = Math.max(-LIFT_RATE * dt, Math.min(LIFT_RATE * dt, d));
  return Math.max(0, Math.min(1, current + step));
}

const DEFAULT_CTX: StepContext = {
  tractionMul: 1,
  assist: false,
  onPlant: (leg, _e, impact) => ({ leg, perfect: false, combo: 0, impact }),
};

function stepFallen(sim: SimState, dt: number, plantEvents: PlantEvent[]): void {
  sim.fallSpin += dt;
  sim.flowerFlung = true;
  sim.elapsed += dt;

  // Keep tipping under gravity-like torque toward side clamp
  const rollSign = Math.sign(sim.roll) || sim.fallSide || 1;
  sim.rollVel += rollSign * 9 * Math.sin(Math.min(Math.PI / 2, Math.abs(sim.roll) + 0.2)) * dt;
  sim.pitchVel += 4.5 * Math.sin(sim.pitch) * dt * 0.5;
  const damp = Math.exp(-0.8 * dt);
  sim.rollVel *= damp;
  sim.pitchVel *= damp;
  sim.roll += sim.rollVel * dt;
  sim.pitch += sim.pitchVel * dt;

  // Clamp with bounce
  if (Math.abs(sim.roll) > FALL_ROLL_CLAMP) {
    const impact = Math.abs(sim.rollVel);
    sim.roll = rollSign * FALL_ROLL_CLAMP;
    if (impact > 0.2) sim.rollVel *= -0.2;
    else sim.rollVel = 0;
    if (impact > 1.5) sim.fallBounce = Math.min(1, impact / 5);
  }
  if (Math.abs(sim.pitch) > FALL_PITCH_CLAMP) {
    sim.pitch = Math.sign(sim.pitch) * FALL_PITCH_CLAMP;
    sim.pitchVel *= -0.2;
  }

  const absR = Math.abs(sim.roll);
  const absP = Math.abs(sim.pitch);
  const height =
    Math.max(0.42, BODY_HEIGHT * Math.cos(sim.roll) * Math.cos(sim.pitch) + 0.17 * Math.sin(absR));
  sim.y = height;
  sim.vy = 0;

  if (!sim.fallLanded) {
    if (absR >= FALL_ROLL_CLAMP * 0.95 || absP >= FALL_PITCH_CLAMP * 0.95 || sim.fallSpin > 1.2) {
      sim.fallLanded = true;
    }
  }

  // Player still controls legs while down
  let scoot = 0;
  let spin = 0;
  for (const id of LEG_IDS) {
    const leg = sim.legs[id];
    const targetA = leg.held ? 0.9 : -0.4;
    const prev = leg.swing;
    const maxUp = 7;
    const maxDown = 5;
    const d = targetA - leg.swing;
    const rate = d > 0 ? maxUp : maxDown;
    leg.swing = approachAngle(leg.swing, targetA, rate, dt);
    leg.lift = approachLift(leg.lift, leg.held ? 1 : 0, dt);
    const dA = (leg.swing - prev) / Math.max(1e-6, dt);
    leg.prevSwing = prev;

    // Ground-side legs that aren't lifted scoot / yaw the body
    const onGroundSide =
      (sim.roll > 0.6 && (id === 'FR' || id === 'BR')) ||
      (sim.roll < -0.6 && (id === 'FL' || id === 'BL'));
    if (absR > 1.0 && onGroundSide && leg.lift < 0.35) {
      scoot -= dA * 0.45;
      spin += (id === 'FL' || id === 'BL' ? -1 : 1) * dA * 0.9;
    }
  }
  sim.vx += scoot * dt;
  sim.yawVel += spin * dt;
  const velDamp = Math.exp(-2.5 * dt);
  sim.vx *= velDamp;
  sim.yawVel *= velDamp;
  sim.yaw += sim.yawVel * dt;
  sim.lateral += sim.vx * 0.15 * dt;
  sim.lateral = Math.max(-1.5, Math.min(1.5, sim.lateral));
  sim.x += sim.vx * dt;
  if (sim.x < 0) {
    sim.x = 0;
    sim.vx = Math.max(0, sim.vx);
  }
  if (sim.x > TRACK_LENGTH) sim.x = TRACK_LENGTH;
  void plantEvents;
}

function stepGetUp(sim: SimState, dt: number): void {
  sim.getUpT += dt;
  const u = smoothstep(sim.getUpT / GET_UP_DURATION);
  sim.roll *= 1 - u;
  sim.pitch *= 1 - u;
  sim.yaw *= 1 - u;
  sim.lateral *= 1 - u;
  sim.y = restBodyHeight() * u + sim.y * (1 - u);
  if (sim.getUpT >= GET_UP_DURATION) {
    getUpInPlace(sim);
  }
}

export function stepPhysics(
  sim: SimState,
  dt: number = FIXED_DT,
  ctx: StepContext = DEFAULT_CTX,
): { end: RunEndReason | null; plantEvents: PlantEvent[] } {
  const plantEvents: PlantEvent[] = [];
  const rightingMul = ctx.assist ? ASSIST_RIGHTING : 1;

  if (sim.finished) {
    sim.finishAnim = Math.min(1, sim.finishAnim + dt * 0.7);
    return { end: null, plantEvents };
  }

  if (sim.getUpT > 0) {
    sim.elapsed += dt;
    stepGetUp(sim, dt);
    return { end: null, plantEvents };
  }

  if (sim.fallen) {
    stepFallen(sim, dt, plantEvents);
    return { end: null, plantEvents };
  }

  sim.elapsed += dt;

  let fx = 0;
  let fy = 0;
  let torquePitch = 0;
  let torqueRoll = 0;
  let groundedN = 0;
  let hasLeft = false;
  let hasRight = false;
  let legRecoil = 0;

  let gripDamp = 0;

  for (const id of LEG_IDS) {
    const leg = sim.legs[id];
    const L0 = legLength(id);
    leg.prevSwing = leg.swing;

    // Lift lag toward held/released
    leg.lift = approachLift(leg.lift, leg.held ? 1 : 0, dt);

    // Predict contact with current angle, then drive angle
    const hipY0 = hipWorldY(sim, id);
    const reach0 = (L0 - LIFT_SHORTEN * leg.lift) * Math.cos(leg.swing);
    const willPlant = reach0 >= hipY0 - 0.002;

    if (leg.held) {
      leg.swing = approachAngle(leg.swing, A_FWD, SWING_RATE, dt);
    } else {
      const rate = willPlant ? PUSH_RATE : RETURN_RATE;
      leg.swing = approachAngle(leg.swing, A_BACK, rate, dt);
    }

    const omega = (leg.swing - leg.prevSwing) / Math.max(1e-8, dt);
    legRecoil += -LEG_I * omega;

    const reach = (L0 - LIFT_SHORTEN * leg.lift) * Math.cos(leg.swing);
    const hipY = hipWorldY(sim, id);
    const hipVy = hipWorldVy(sim, id);
    const grounded = reach >= hipY - 0.002;
    leg.wasGrounded = leg.grounded;
    leg.grounded = grounded;

    if (grounded) {
      groundedN += 1;
      const z = LEG_ATTACH[id].z;
      if (z < 0) hasLeft = true;
      else hasRight = true;

      const pen = Math.max(0, reach - hipY);
      const N = Math.max(0, SPRING_K * pen - SPRING_C * hipVy);
      const load = Math.min(1.5, N / GRAVITY);
      fy += N;

      const lever = LEG_ATTACH[id].x - COM_X;
      torquePitch += N * lever;
      torqueRoll += N * (-z);

      const sweepBack = Math.max(0, -omega);
      if (!leg.held && sweepBack > 0) {
        const footSpeed = L0 * Math.cos(leg.swing) * sweepBack;
        fx += TRACTION * load * footSpeed * ctx.tractionMul;
      }

      gripDamp += (leg.held ? SLIDE : TRACTION) * load;

      if (!leg.wasGrounded) {
        const impact = Math.max(0, -hipVy);
        const plant = ctx.onPlant(id, sim.elapsed, impact);
        plant.leg = id;
        plantEvents.push(plant);
        sim.stepCount += 1;
        leg.plantX = LEG_ATTACH[id].x + Math.sin(leg.swing) * L0 * 0.45;
      }
    }
  }

  // Horizontal: thrust, grip damping, quadratic air drag
  sim.vx += fx * dt;
  sim.vx -= gripDamp * sim.vx * dt;
  sim.vx -= AIR_DRAG * sim.vx * Math.abs(sim.vx) * dt;

  fy += -GRAVITY;
  sim.vy += fy * dt;
  sim.y += sim.vy * dt;
  sim.x += sim.vx * dt;
  if (sim.x < 0) {
    sim.x = 0;
    sim.vx = Math.max(0, sim.vx);
  }

  // Contact pitch torque + accelerate-rears-up + leg recoil (÷ I)
  let alphaPitch = torquePitch / I_PITCH + (REAR_COUPLE * fx * sim.y) / I_PITCH + legRecoil / I_PITCH;
  let alphaRoll = torqueRoll / I_ROLL;

  // Passive tip (angular accel) + roll righting when both sides have a plant
  alphaPitch += TIP_PITCH * Math.sin(sim.pitch);
  alphaRoll += TIP_ROLL * Math.sin(sim.roll);
  if (hasLeft && hasRight) {
    let k = BAL2;
    if (groundedN >= 4) k = BAL4;
    else if (groundedN === 3) k = BALANCE;
    k *= rightingMul;
    alphaRoll += -k * (sim.roll + 0.25 * sim.rollVel);
  }

  sim.pitchVel += alphaPitch * dt;
  sim.rollVel += alphaRoll * dt;
  sim.pitchVel *= Math.exp(-ANG_DAMP * dt);
  sim.rollVel *= Math.exp(-ANG_DAMP * dt);
  sim.pitch += sim.pitchVel * dt;
  sim.roll += sim.rollVel * dt;

  sim.maxSpeed = Math.max(sim.maxSpeed, Math.abs(sim.vx));

  sim.tipping = Math.abs(sim.roll) > WARN_ROLL || Math.abs(sim.pitch) > WARN_PITCH;

  if (Math.abs(sim.roll) > FALL_ROLL || Math.abs(sim.pitch) > FALL_PITCH) {
    sim.fallen = true;
    sim.fallLanded = false;
    sim.fallCount += 1;
    sim.flowerFlung = true;
    sim.fallStyle = Math.random();
    sim.fallBounce = 0;
    sim.fallSpin = 0;
    const side = Math.sign(sim.roll) || (Math.random() < 0.5 ? -1 : 1);
    sim.fallSide = side;
    // Keep angular velocity so the flop continues naturally
    return { end: null, plantEvents };
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
    tipping: sim.tipping,
    legLift,
    legSwing,
    legHeld,
    fallCount: sim.fallCount,
    steps: sim.stepCount,
    maxSpeed: sim.maxSpeed,
  };
}
