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
 * Matching swingDir to pitchLoc rewards gap aiming; timing drives power.
 */
export function computeHitLaunch(opts: {
  swingTime: number;
  swingDir: SwingDir;
  pitchLoc: PitchLoc | null;
  rng: Rng;
}): HitLaunch {
  const { swingTime, swingDir, pitchLoc, rng } = opts;

  let dirBias = 0;
  if (swingDir === 'left') dirBias = -0.55;
  if (swingDir === 'right') dirBias = 0.55;

  const locMatch = pitchLoc && swingDir === pitchLoc ? 0.14 : 0;
  const timing = swingTime;
  const angleOffset = timing * 5 + dirBias + (rng() - 0.5) * 0.08;
  const powerFactor = Math.max(0.15, 1 - Math.abs(timing) * 4);
  const jitter = rng() * 0.12;
  const hitScore = Math.min(1, powerFactor * 0.78 + jitter + locMatch);

  const speed = 380 + hitScore * 420;
  const baseAngle = -Math.PI / 2;
  const finalAngle = baseAngle + angleOffset;
  const vz = 130 + hitScore * 270;

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
