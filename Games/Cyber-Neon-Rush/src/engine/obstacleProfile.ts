/**
 * Collision profile for obstacles — drives jump / dash reading.
 * - solid: must lane-change, shield, or dash i-frames
 * - jumpable: cleared while airborne
 * - slideable: cleared while dashing (low profile)
 */

export type ObstacleKind = 'barrier' | 'cone' | 'drone' | 'lowBarrier' | 'highGate' | 'slideBar';

export type CollisionProfile = 'solid' | 'jumpable' | 'slideable';

export function collisionProfile(kind: ObstacleKind): CollisionProfile {
  switch (kind) {
    case 'cone':
    case 'lowBarrier':
      return 'jumpable';
    case 'slideBar':
      return 'slideable';
    case 'barrier':
    case 'highGate':
    case 'drone':
    default:
      return 'solid';
  }
}

export function pickObstacleKind(rng: () => number, progress: number): ObstacleKind {
  const roll = rng();
  // Later distance introduces more profile variety so players must read ahead.
  if (progress < 0.2) {
    if (roll < 0.4) return 'cone';
    if (roll < 0.7) return 'barrier';
    return 'drone';
  }
  if (progress < 0.45) {
    if (roll < 0.22) return 'cone';
    if (roll < 0.4) return 'lowBarrier';
    if (roll < 0.55) return 'slideBar';
    if (roll < 0.78) return 'barrier';
    return 'drone';
  }
  if (roll < 0.14) return 'cone';
  if (roll < 0.28) return 'lowBarrier';
  if (roll < 0.42) return 'slideBar';
  if (roll < 0.55) return 'highGate';
  if (roll < 0.78) return 'barrier';
  return 'drone';
}
