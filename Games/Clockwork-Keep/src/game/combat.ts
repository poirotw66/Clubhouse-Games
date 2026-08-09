/**
 * Damage, armor, slow-stacking and targeting rules. Kept free of tower/enemy
 * *state mutation* concerns beyond the numbers themselves — engine.ts drives
 * when these run, this module only computes what should happen.
 */
import { MIN_SPEED_FACTOR } from './constants.ts';
import type { Enemy, SlowEffect } from './types.ts';

export function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

/** Enemies a tower could legally hit right now: alive, in range, right air/ground match. */
export function enemiesInRange(
  enemies: Enemy[],
  cx: number,
  cy: number,
  range: number,
  targetsAir: boolean,
): Enemy[] {
  return enemies.filter((e) => {
    if (e.dead || e.reachedExit) return false;
    if (e.flying && !targetsAir) return false;
    return distance(e.worldX, e.worldY, cx, cy) <= range;
  });
}

/**
 * Fixed targeting priority: whichever in-range enemy is closest to the exit.
 * Ties (identical distanceToExit) break on spawnOrder so the result never
 * depends on array/object iteration order — same inputs, same target, always.
 */
export function selectPrimaryTarget(candidates: Enemy[]): Enemy | null {
  if (candidates.length === 0) return null;
  let best = candidates[0];
  for (let i = 1; i < candidates.length; i++) {
    const c = candidates[i];
    if (
      c.distanceToExit < best.distanceToExit ||
      (c.distanceToExit === best.distanceToExit && c.spawnOrder < best.spawnOrder)
    ) {
      best = c;
    }
  }
  return best;
}

/**
 * Flat-reduction armor: subtract armor before applying to HP, floored at
 * zero (never heals). Returns the actual damage dealt.
 */
export function applyDamage(enemy: Enemy, rawDamage: number): number {
  const effective = Math.max(0, rawDamage - enemy.armor);
  enemy.hp = Math.max(0, enemy.hp - effective);
  if (enemy.hp === 0) enemy.dead = true;
  return effective;
}

/** Adds a timed slow effect. Stacking is resolved lazily by currentSpeedFactor. */
export function applySlow(enemy: Enemy, percent: number, durationSec: number): void {
  enemy.slowEffects.push({ percent, remaining: durationSec });
}

/** Ages slow effects by dt and drops expired ones. */
export function tickSlowEffects(enemy: Enemy, dt: number): void {
  if (enemy.slowEffects.length === 0) return;
  const kept: SlowEffect[] = [];
  for (const eff of enemy.slowEffects) {
    const remaining = eff.remaining - dt;
    if (remaining > 0) kept.push({ percent: eff.percent, remaining });
  }
  enemy.slowEffects = kept;
}

/**
 * Strongest-effect-wins, never multiplicative: only the single largest slow
 * percent currently active applies, floored so speed cannot drop below
 * MIN_SPEED_FACTOR of base. Stacking three 35% frost pulses still yields one
 * 35% slow, not a near-stop.
 */
export function currentSpeedFactor(enemy: Enemy): number {
  if (enemy.slowEffects.length === 0) return 1;
  let strongest = 0;
  for (const eff of enemy.slowEffects) strongest = Math.max(strongest, eff.percent);
  return Math.max(MIN_SPEED_FACTOR, 1 - strongest);
}

/**
 * Chain lightning: starting at the primary target, repeatedly jump to the
 * nearest not-yet-hit candidate within chainRadius, up to maxTargets total.
 * Deterministic nearest-with-spawnOrder-tiebreak, same as primary targeting.
 */
export function chainTargets(
  primary: Enemy,
  candidates: Enemy[],
  maxTargets: number,
  chainRadius: number,
): Enemy[] {
  const hit: Enemy[] = [primary];
  const hitIds = new Set([primary.id]);
  let fromX = primary.worldX;
  let fromY = primary.worldY;

  while (hit.length < maxTargets) {
    let next: Enemy | null = null;
    let bestDist = Infinity;
    for (const c of candidates) {
      if (hitIds.has(c.id)) continue;
      const d = distance(c.worldX, c.worldY, fromX, fromY);
      if (d > chainRadius) continue;
      if (d < bestDist || (d === bestDist && next && c.spawnOrder < next.spawnOrder)) {
        bestDist = d;
        next = c;
      }
    }
    if (!next) break;
    hit.push(next);
    hitIds.add(next.id);
    fromX = next.worldX;
    fromY = next.worldY;
  }

  return hit;
}

/** All alive candidates (matching the tower's air/ground reach) within splashRadius of a point. */
export function splashTargets(
  candidates: Enemy[],
  cx: number,
  cy: number,
  splashRadius: number,
): Enemy[] {
  return candidates.filter((e) => distance(e.worldX, e.worldY, cx, cy) <= splashRadius);
}
