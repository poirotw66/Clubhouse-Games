/**
 * Contact resolution: timing + swing direction → launch vector + quality.
 * Uses injected RNG so checks stay deterministic.
 */

import type { PitchLoc } from './pitching.ts';
import type { Rng } from './rng.ts';

export type SwingDir = 'left' | 'center' | 'right';

export interface HitLaunch {
  vel: { x: number; y: number; z: number };
  contactQuality: number;
  /** Peak height hint for flight-time estimate. */
  peakZ: number;
}

/**
 * Convert plate contact into a batted-ball launch.
 * `swingTime` is plate-relative timing error: 0 = ball at the plate,
 * negative = early, positive = late. Matching swingDir to pitchLoc
 * rewards gap aiming; timing drives power and launch angle.
 */
export function computeHitLaunch(opts: {
  swingTime: number;
  swingDir: SwingDir;
  pitchLoc: PitchLoc | null;
  rng: Rng;
}): HitLaunch {
  const { swingTime, swingDir, pitchLoc, rng } = opts;

  let dirBias = 0;
  if (swingDir === 'left') dirBias = -0.48;
  if (swingDir === 'right') dirBias = 0.48;

  const locMatch = pitchLoc && swingDir === pitchLoc ? 0.12 : 0;
  // Slight early bias feels better than late (classic arcade bat sweet spot).
  const timing = swingTime + 0.03;
  const angleOffset = timing * 4.2 + dirBias + (rng() - 0.5) * 0.07;
  // Wider sweet spot (~±0.18) so "swing when it's near" still plays.
  const powerFactor = Math.max(0.12, 1 - Math.abs(timing) * 3.2);
  const jitter = rng() * 0.1;
  const hitScore = Math.min(1, powerFactor * 0.8 + jitter + locMatch);

  // Enough carry that perfect contact can clear ~FENCE_DIST; weak stays short.
  const speed = 360 + hitScore * 520;
  const baseAngle = -Math.PI / 2;
  const finalAngle = baseAngle + angleOffset;
  const vz = 110 + hitScore * 310;

  return {
    vel: {
      x: Math.cos(finalAngle) * speed,
      y: Math.sin(finalAngle) * speed,
      z: vz,
    },
    contactQuality: hitScore,
    peakZ: vz * 0.55,
  };
}
