/**
 * Tactical baseball actions: Bunt (觸擊短打) and Steal (戰術盜壘).
 */

import type { Difficulty } from './difficulty.ts';
import type { PitchLoc, PitchType } from './pitching.ts';
import { PITCH_DEFS } from './pitching.ts';
import type { Rng } from './rng.ts';

export interface BuntLaunch {
  vel: { x: number; y: number; z: number };
  contactQuality: number;
  peakZ: number;
}

export function computeBuntLaunch(opts: {
  swingDir: 'left' | 'center' | 'right';
  pitchLoc: PitchLoc | null;
  rng: Rng;
}): BuntLaunch {
  const { swingDir, rng } = opts;

  let xVel = 0;
  if (swingDir === 'left') xVel = -85 + (rng() - 0.5) * 30; // Toward 3B line
  else if (swingDir === 'right') xVel = 85 + (rng() - 0.5) * 30; // Toward 1B line
  else xVel = (rng() - 0.5) * 40; // Soft rolling in front of mound

  const yVel = -190 - rng() * 60; // Rolling out into infield
  const zVel = 22 + rng() * 15; // Low pop / damp bounce

  return {
    vel: { x: xVel, y: yVel, z: zVel },
    contactQuality: 0.6 + rng() * 0.25,
    peakZ: 15,
  };
}

export interface StealResolution {
  success: boolean;
  leadBaseIndex: number; // 0 for 1st base runner, 1 for 2nd base runner
  targetBaseIndex: number; // 1 for 2nd base, 2 for 3rd base
  blurb: string;
}

/**
 * Resolves a stolen base attempt based on pitch speed, location, and difficulty.
 */
export function resolveStealAttempt(opts: {
  bases: [boolean, boolean, boolean];
  pitchType: PitchType;
  pitchLoc: PitchLoc | null;
  difficulty: Difficulty;
  rng: Rng;
}): StealResolution | null {
  const { bases, pitchType, pitchLoc, difficulty, rng } = opts;

  // Find lead runner who can steal (prioritize 2nd stealing 3rd, then 1st stealing 2nd)
  let leadBase = -1;
  let targetBase = -1;

  if (bases[1] && !bases[2]) {
    leadBase = 1;
    targetBase = 2; // 2nd base runner steals 3rd
  } else if (bases[0] && !bases[1]) {
    leadBase = 0;
    targetBase = 1; // 1st base runner steals 2nd
  } else if (bases[0] && bases[1] && !bases[2]) {
    leadBase = 1;
    targetBase = 2; // Lead runner on 2nd steals 3rd (double steal possibility)
  }

  if (leadBase === -1) return null;

  // Base success chance ~ 62%
  let chance = 0.62;

  // Pitch speed factor: fast pitch allows catcher quick throw; slow breaking pitch grants head start
  const speed = PITCH_DEFS[pitchType].speed;
  if (speed >= 480) chance -= 0.18; // Fastball / Sinker: tough to steal on
  else if (speed <= 330) chance += 0.2; // Curve / Changeup: slow to plate, big advantage

  // Location factor: balls or wide locations delay catcher pop-time
  if (pitchLoc === 'left' || pitchLoc === 'right') chance += 0.08;

  // Difficulty adjustment
  if (difficulty === 'easy') chance += 0.15;
  if (difficulty === 'hard') chance -= 0.12;

  const roll = rng();
  const success = roll < Math.max(0.2, Math.min(0.92, chance));

  const baseName = targetBase === 1 ? '二壘' : '三壘';
  const blurb = success
    ? `盜壘成功！攻佔${baseName}！`
    : `阻殺出局！在${baseName}前遭觸殺！`;

  return {
    success,
    leadBaseIndex: leadBase,
    targetBaseIndex: targetBase,
    blurb,
  };
}
