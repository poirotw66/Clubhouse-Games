/** Pure helpers for drafting / slipstream detection (unit-tested via check script). */

export interface SlipPose {
  x: number;
  y: number;
  angle: number;
  speed: number;
}

/** Max distance (world units) to hitch a draft. */
export const SLIP_MAX_DIST = 95;
/** Half-angle of the draft cone behind the leader (radians). */
export const SLIP_HALF_ANGLE = 0.42;
/** Minimum leader speed before drafting pays off. */
export const SLIP_MIN_LEADER_SPEED = 140;
/** Top-speed multiplier while drafting. */
export const SLIP_SPEED_MULT = 1.085;
/** Extra accel multiplier while drafting. */
export const SLIP_ACCEL_MULT = 1.22;

/**
 * Returns true when `chaser` sits in the draft cone behind `leader`.
 * The chaser must be behind the leader's facing direction.
 */
export function isInSlipstream(chaser: SlipPose, leader: SlipPose): boolean {
  if (leader.speed < SLIP_MIN_LEADER_SPEED) return false;
  if (chaser.speed < 80) return false;
  const dx = chaser.x - leader.x;
  const dy = chaser.y - leader.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 18 || dist > SLIP_MAX_DIST) return false;

  // Vector from leader to chaser should point roughly opposite the leader's nose.
  const backX = -Math.cos(leader.angle);
  const backY = -Math.sin(leader.angle);
  const nx = dx / dist;
  const ny = dy / dist;
  const align = nx * backX + ny * backY;
  if (align < Math.cos(SLIP_HALF_ANGLE)) return false;

  // Chaser should also be pointed roughly the same way (not sideways grinding).
  let yawDelta = chaser.angle - leader.angle;
  while (yawDelta > Math.PI) yawDelta -= Math.PI * 2;
  while (yawDelta < -Math.PI) yawDelta += Math.PI * 2;
  return Math.abs(yawDelta) < 0.85;
}

/** Find the strongest draft target ahead of `self` among `others`. */
export function findSlipstreamTarget(
  self: SlipPose,
  others: SlipPose[],
): {index: number; strength: number} | null {
  let best: {index: number; strength: number} | null = null;
  for (let i = 0; i < others.length; i++) {
    const leader = others[i];
    if (!isInSlipstream(self, leader)) continue;
    const dist = Math.hypot(self.x - leader.x, self.y - leader.y);
    const strength = 1 - (dist - 18) / (SLIP_MAX_DIST - 18);
    if (!best || strength > best.strength) best = {index: i, strength};
  }
  return best;
}

/** Calculate boosted top speed under slipstream draft. */
export function calculateDraftTopSpeed(baseTopSpeed: number, strength: number): number {
  if (strength <= 0) return baseTopSpeed;
  return baseTopSpeed * (1 + (SLIP_SPEED_MULT - 1) * Math.min(1, Math.max(0, strength)));
}

/** Calculate acceleration multiplier under slipstream draft. */
export function calculateDraftAccelMult(strength: number): number {
  if (strength <= 0) return 1;
  return 1 + (SLIP_ACCEL_MULT - 1) * Math.min(1, Math.max(0, strength));
}

/**
 * Step forward speed with draft accumulation or post-draft bleed-off.
 * When drafting, speed accumulates up towards draftTopSpeed using boosted accel.
 * When draft expires (current speed > baseTopSpeed and no longer drafting),
 * speed bleeds back down to baseTopSpeed at bleedRate.
 */
export function stepDraftSpeed(
  currentSpeed: number,
  baseTopSpeed: number,
  accelRate: number,
  draftStrength: number,
  dt: number,
  bleedRate = 260,
): number {
  const targetTop = calculateDraftTopSpeed(baseTopSpeed, draftStrength);
  const effectiveAccel = accelRate * calculateDraftAccelMult(draftStrength);

  let speed = currentSpeed;
  if (draftStrength > 0 && effectiveAccel > 0) {
    speed = Math.min(speed + effectiveAccel * dt, targetTop);
  } else if (speed > baseTopSpeed) {
    speed = Math.max(baseTopSpeed, speed - bleedRate * dt);
  }
  return speed;
}

