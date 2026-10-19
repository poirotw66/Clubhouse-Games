/**
 * Timing + positioning windows for block quality.
 * Impact is when the shuttle crosses the racket plane (impactZ).
 */

/** @typedef {'perfect' | 'good' | 'block' | 'miss'} ContactGrade */

export const IMPACT_Z = 4;
export const WINDOW_PERFECT_MS = 100;
export const WINDOW_GOOD_MS = 260;

/** Position radii (world units) at contact. */
export const POS_PERFECT = 1.6;
export const POS_GOOD = 3.2;
export const POS_REACH = 4.2;

export const HIT_STOP_PERFECT = 0.14;
export const HIT_STOP_GOOD = 0.07;

/**
 * @param {number} waveTier  0–2 drill phase or score-attack wave floor
 * @param {number} [combo]
 */
export function getTimingWindowsMs(waveTier = 0, combo = 0) {
  const tier = Math.min(6, Math.max(0, waveTier) + Math.floor(combo / 8));
  return {
    perfect: Math.max(50, WINDOW_PERFECT_MS - tier * 8),
    good: Math.max(140, WINDOW_GOOD_MS - tier * 16),
  };
}

/**
 * Estimate when a shuttle at `pos` with `vel` will cross impactZ (seconds).
 * Returns null if not approaching the plane.
 * @param {{ z: number }} pos
 * @param {{ z: number }} vel
 * @param {number} [impactZ]
 */
export function etaToImpact(pos, vel, impactZ = IMPACT_Z) {
  if (vel.z <= 0.01) return null;
  const dz = impactZ - pos.z;
  if (dz <= 0) return 0;
  return dz / vel.z;
}

/**
 * Grade a swing against impact timing (seconds).
 * @param {number} swingAgeSec  seconds since swing started when contact/impact happens
 * @param {number} swingDurationSec
 * @param {number} etaAtSwingStart  estimated seconds to impact when swing began (null → treat as late)
 * @param {{ perfect: number, good: number }} windowsMs
 * @returns {'perfect' | 'good' | 'late'}
 */
export function gradeTiming(swingAgeSec, swingDurationSec, etaAtSwingStart, windowsMs) {
  // Ideal: swing peak (~half duration) lands on impact.
  const peak = swingDurationSec * 0.45;
  let errMs;
  if (etaAtSwingStart == null || !Number.isFinite(etaAtSwingStart)) {
    errMs = 400;
  } else {
    // At swing start, eta was T. Contact happens at swingAge. Error = |T - peak|.
    errMs = Math.abs(etaAtSwingStart - peak) * 1000;
  }
  if (errMs <= windowsMs.perfect) return 'perfect';
  if (errMs <= windowsMs.good) return 'good';
  return 'late';
}

/**
 * @param {number} distance
 * @returns {'perfect' | 'good' | 'reach' | 'out'}
 */
export function gradePosition(distance) {
  if (distance <= POS_PERFECT) return 'perfect';
  if (distance <= POS_GOOD) return 'good';
  if (distance <= POS_REACH) return 'reach';
  return 'out';
}

/**
 * Combine timing + position into a contact grade when the racket touches the shuttle.
 * @param {{
 *   swinging: boolean,
 *   timing: 'perfect'|'good'|'late',
 *   position: 'perfect'|'good'|'reach'|'out',
 * }} input
 * @returns {ContactGrade}
 */
export function combineContact(input) {
  if (input.position === 'out') return 'miss';
  if (!input.swinging) return 'block';
  if (input.timing === 'perfect' && (input.position === 'perfect' || input.position === 'good')) {
    return 'perfect';
  }
  if (input.timing === 'good' || input.position === 'perfect') {
    return 'good';
  }
  if (input.timing === 'late' && input.position === 'reach') {
    return 'block';
  }
  if (input.timing === 'late') return 'block';
  return 'good';
}

/**
 * Aim zone from normalised pointer X (−1…1) for counterattack direction.
 * @param {number} mouseX
 * @returns {'left' | 'center' | 'right'}
 */
export function aimZoneFromMouse(mouseX) {
  if (mouseX < -0.28) return 'left';
  if (mouseX > 0.28) return 'right';
  return 'center';
}

/**
 * Score-attack points for a graded contact.
 * @param {ContactGrade} grade
 * @param {number} combo  combo before this hit
 * @param {'left'|'center'|'right'} aimZone
 */
export function scoreForContact(grade, combo, aimZone) {
  if (grade === 'miss') return 0;
  if (grade === 'block') return 40;
  const corner = aimZone === 'center' ? 1 : 1.35;
  if (grade === 'perfect') {
    return Math.round((1000 + combo * 120) * corner);
  }
  if (grade === 'good') {
    return Math.round((320 + combo * 40) * corner);
  }
  return 0;
}

/**
 * Whether a perfect/good return wins the versus point against CPU cover style.
 * @param {ContactGrade} grade
 * @param {'left'|'center'|'right'} aimZone
 * @param {{ coverLeft: number, coverCenter: number, coverRight: number, defense: number }} cover
 * @param {() => number} rng
 */
export function versusReturnWinsPoint(grade, aimZone, cover, rng) {
  if (grade === 'perfect') {
    const weak =
      aimZone === 'left'
        ? 1 - cover.coverLeft
        : aimZone === 'right'
          ? 1 - cover.coverRight
          : 1 - cover.coverCenter;
    return rng() < Math.min(0.97, 0.72 + weak * 0.35);
  }
  if (grade === 'good') {
    const covered =
      aimZone === 'left'
        ? cover.coverLeft
        : aimZone === 'right'
          ? cover.coverRight
          : cover.coverCenter;
    const chance = Math.max(0.12, 0.55 - covered * 0.35 - cover.defense * 0.15);
    return rng() < chance;
  }
  return false;
}
