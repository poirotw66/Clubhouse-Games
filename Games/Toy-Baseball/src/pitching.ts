/**
 * Pitch arsenal, after-release steering, and CPU sequencing.
 * Classic toy-baseball feel: release, then nudge the break with left/right.
 */

import type { Difficulty } from './difficulty.ts';
import { pick, type Rng } from './rng.ts';

export type PitchType =
  | 'fastball'
  | 'curve'
  | 'slider'
  | 'changeup'
  | 'sinker'
  | 'forkball';

export type PitchLoc = 'left' | 'center' | 'right';

export const PITCH_TYPES: readonly PitchType[] = [
  'fastball',
  'curve',
  'slider',
  'changeup',
  'sinker',
  'forkball',
] as const;

export interface PitchDef {
  id: PitchType;
  /** Traditional Chinese label for UI. */
  label: string;
  /** Short tag shown on pitch buttons. */
  shortLabel: string;
  /** Initial pitch speed (screen units / s). */
  speed: number;
  /** Lateral break toward catcher's right (positive x) over the flight. */
  breakX: number;
  /** Extra downward pull on z over the flight (positive = more drop). */
  breakZ: number;
  /** How strongly after-release left/right steering bends the pitch. */
  steerScale: number;
  /** Trail RGB for juice. */
  trailRgb: [number, number, number];
  /** Readable release tell: early speed feel (higher = looks like heat). */
  releaseTell: number;
}

export const PITCH_DEFS: Record<PitchType, PitchDef> = {
  fastball: {
    id: 'fastball',
    label: '速球',
    shortLabel: '速',
    speed: 520,
    breakX: 0,
    breakZ: 8,
    steerScale: 0.35,
    trailRgb: [147, 197, 253],
    releaseTell: 1,
  },
  curve: {
    id: 'curve',
    label: '曲球',
    shortLabel: '曲',
    speed: 310,
    breakX: -55,
    breakZ: 95,
    steerScale: 1.35,
    trailRgb: [196, 181, 253],
    releaseTell: 0.35,
  },
  slider: {
    id: 'slider',
    label: '滑球',
    shortLabel: '滑',
    speed: 420,
    breakX: 70,
    breakZ: 35,
    steerScale: 1.05,
    trailRgb: [252, 211, 77],
    releaseTell: 0.7,
  },
  changeup: {
    id: 'changeup',
    label: '變速球',
    shortLabel: '變',
    speed: 280,
    breakX: 12,
    breakZ: 40,
    steerScale: 0.7,
    trailRgb: [110, 231, 183],
    releaseTell: 0.85,
  },
  sinker: {
    id: 'sinker',
    label: '伸卡球',
    shortLabel: '伸',
    speed: 460,
    breakX: 28,
    breakZ: 110,
    steerScale: 0.55,
    trailRgb: [253, 186, 116],
    releaseTell: 0.9,
  },
  forkball: {
    id: 'forkball',
    label: '叉球',
    shortLabel: '叉',
    speed: 340,
    breakX: 0,
    breakZ: 140,
    steerScale: 0.9,
    trailRgb: [248, 113, 113],
    releaseTell: 0.55,
  },
};

/** Seconds after release when the pitcher can still steer. */
export const STEER_WINDOW_SEC = 0.28;

export const MOUND = { x: 400, y: 150, z: 20 };
export const PLATE_Y = 450;

export function locTargetX(loc: PitchLoc): number {
  if (loc === 'left') return 368;
  if (loc === 'right') return 432;
  return 400;
}

export function initialPitchVelocity(
  type: PitchType,
  loc: PitchLoc,
): { x: number; y: number; z: number } {
  const def = PITCH_DEFS[type];
  const targetX = locTargetX(loc);
  const dx = targetX - MOUND.x;
  const dy = PLATE_Y - MOUND.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  return {
    x: (dx / dist) * def.speed,
    y: (dy / dist) * def.speed,
    z: -4 - def.breakZ * 0.02,
  };
}

/**
 * Apply late break + optional player steering while the ball is en route.
 * `steerDir` is -1 / 0 / +1 from left/right input during the steer window.
 */
export function applyPitchFlight(
  vel: { x: number; y: number; z: number },
  type: PitchType,
  pitchAge: number,
  dt: number,
  steerDir: -1 | 0 | 1,
): void {
  const def = PITCH_DEFS[type];
  // Break ramps up late so batters get a readable early path.
  const late = Math.min(1, pitchAge / 0.55);
  const breakEase = late * late;
  vel.x += def.breakX * breakEase * dt * 1.8;
  vel.z -= def.breakZ * breakEase * dt * 0.55;

  if (steerDir !== 0 && pitchAge <= STEER_WINDOW_SEC) {
    const fade = 1 - pitchAge / STEER_WINDOW_SEC;
    vel.x += steerDir * def.steerScale * 220 * fade * dt;
  }
}

export interface CountState {
  balls: number;
  strikes: number;
}

/**
 * CPU pitcher tendencies: count-aware mix so reading sequences is a skill.
 * Weights are relative; harder difficulties tighten the zone and favor heat.
 */
export function chooseCpuPitch(
  count: CountState,
  difficulty: Difficulty,
  rng: Rng,
): { type: PitchType; loc: PitchLoc } {
  const weights = baseWeights(count, difficulty);
  const type = weightedPick(weights, rng);
  const loc = chooseLoc(count, difficulty, type, rng);
  return { type, loc };
}

function baseWeights(
  count: CountState,
  difficulty: Difficulty,
): Record<PitchType, number> {
  const w: Record<PitchType, number> = {
    fastball: 28,
    curve: 14,
    slider: 16,
    changeup: 14,
    sinker: 14,
    forkball: 10,
  };

  // Two-strike: put-away junk / offspeed.
  if (count.strikes >= 2) {
    w.changeup += 18;
    w.forkball += 16;
    w.slider += 10;
    w.curve += 8;
    w.fastball -= 12;
  }

  // 3-0 / 3-1: challenge with heat.
  if (count.balls >= 3 && count.strikes <= 1) {
    w.fastball += 30;
    w.sinker += 10;
    w.curve -= 8;
    w.forkball -= 6;
    w.changeup -= 6;
  }

  // First pitch: often get ahead with fastball / sinker.
  if (count.balls === 0 && count.strikes === 0) {
    w.fastball += 12;
    w.sinker += 8;
  }

  // Hard leans heat; easy sprays more junk for readability practice.
  if (difficulty === 'hard') {
    w.fastball += 10;
    w.slider += 6;
    w.changeup -= 4;
  } else if (difficulty === 'easy') {
    w.curve += 8;
    w.changeup += 6;
    w.fastball -= 6;
  }

  for (const k of PITCH_TYPES) {
    w[k] = Math.max(1, w[k]);
  }
  return w;
}

function weightedPick(weights: Record<PitchType, number>, rng: Rng): PitchType {
  let total = 0;
  for (const t of PITCH_TYPES) total += weights[t];
  let roll = rng() * total;
  for (const t of PITCH_TYPES) {
    roll -= weights[t];
    if (roll <= 0) return t;
  }
  return 'fastball';
}

function chooseLoc(
  count: CountState,
  difficulty: Difficulty,
  type: PitchType,
  rng: Rng,
): PitchLoc {
  const locs: PitchLoc[] = ['left', 'center', 'right'];

  // Put-away pitches live on the corners.
  if (count.strikes >= 2) {
    if (type === 'slider') return rng() < 0.7 ? 'right' : pick(rng, locs);
    if (type === 'curve') return rng() < 0.7 ? 'left' : pick(rng, locs);
    if (type === 'forkball' || type === 'changeup') {
      return rng() < 0.45 ? 'center' : pick(rng, ['left', 'right'] as const);
    }
  }

  // Behind in count: more strikes through the middle.
  if (count.balls >= 3) {
    return rng() < 0.7 ? 'center' : pick(rng, locs);
  }

  if (difficulty === 'easy') {
    return pick(rng, locs);
  }
  if (difficulty === 'hard') {
    // Paint corners more often.
    return rng() < 0.35 ? 'center' : pick(rng, ['left', 'right'] as const);
  }
  return rng() < 0.45 ? 'center' : pick(rng, locs);
}

/** CPU batter recognition: true = they "read" the pitch type for aim. */
export function cpuReadsPitch(
  difficulty: Difficulty,
  pitchType: PitchType,
  rng: Rng,
): boolean {
  const base =
    difficulty === 'easy' ? 0.22 : difficulty === 'normal' ? 0.55 : 0.88;
  // Changeup / fork look like heat early — harder to read.
  const tell = PITCH_DEFS[pitchType].releaseTell;
  const chance = base * (0.55 + tell * 0.45);
  return rng() < chance;
}
