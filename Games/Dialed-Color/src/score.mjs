/**
 * Score from HSL distance: identical colors → 999; farther → lower.
 * dh is circular on the hue wheel (0–360), normalized by 180.
 * Euclidean distance across 3D normalized HSL (dh, ds, dl) is divided by Math.sqrt(3)
 * so distance stays bounded within [0, 1] and smoothly approaches 0 at opposite extremes.
 */

/** @typedef {{ h: number, s: number, l: number }} Color */

/**
 * @param {Color} c1
 * @param {Color} c2
 */
export function hueDelta(c1, c2) {
  return Math.min(Math.abs(c1.h - c2.h), 360 - Math.abs(c1.h - c2.h));
}

/**
 * Perceptual hue weighting factor in [0, 1].
 * Smoothly tapers when saturation is very low (near-gray) or lightness is near 0% (black) or 100% (white),
 * avoiding unfair hue penalties on swatches where hue difference is visually imperceptible.
 *
 * @param {Color} c1
 * @param {Color} c2
 * @returns {number}
 */
export function perceptualHueWeight(c1, c2) {
  const sMax = Math.max(c1.s, c2.s);
  const lMax = Math.max(c1.l, c2.l);
  const lMin = Math.min(c1.l, c2.l);

  // Saturation taper: below 20%, hue visibility tapers smoothly to 0
  const satRatio = Math.min(1, Math.max(0, sMax / 20));
  const satWeight = Math.pow(satRatio, 1.5);

  // Lightness taper: near black (lMax < 10%) or near white (lMin > 90%), hue visibility tapers to 0
  const blackRatio = Math.min(1, Math.max(0, lMax / 10));
  const whiteRatio = Math.min(1, Math.max(0, (100 - lMin) / 10));
  const lightWeight = Math.pow(Math.min(blackRatio, whiteRatio), 1.5);

  return satWeight * lightWeight;
}

/**
 * @param {Color} c1
 * @param {Color} c2
 */
export function distanceComponents(c1, c2) {
  const dh = hueDelta(c1, c2) / 180;
  const ds = Math.abs(c1.s - c2.s) / 100;
  const dl = Math.abs(c1.l - c2.l) / 100;
  const hueWeight = perceptualHueWeight(c1, c2);
  const effectiveDh = dh * hueWeight;
  const distance = Math.min(1, Math.sqrt((effectiveDh * effectiveDh + ds * ds + dl * dl) / 3));
  return {
    hueNorm: dh,
    effectiveHueNorm: effectiveDh,
    hueWeight,
    satNorm: ds,
    lightNorm: dl,
    hueDeg: hueDelta(c1, c2),
    satPct: Math.abs(c1.s - c2.s),
    lightPct: Math.abs(c1.l - c2.l),
    distance,
  };
}

/**
 * @param {Color} c1
 * @param {Color} c2
 */
export function calculateScore(c1, c2) {
  const { distance } = distanceComponents(c1, c2);
  return Math.max(0, Math.min(999, Math.floor(999 * (1 - distance))));
}

/** Wordle-style emoji band for a 0–999 score. */
export function scoreEmoji(score) {
  if (score >= 900) return '🟩';
  if (score >= 750) return '🟨';
  if (score >= 550) return '🟧';
  return '⬛';
}

export function scoreBandLabel(score) {
  if (score >= 900) return '精準';
  if (score >= 750) return '不錯';
  if (score >= 550) return '尚可';
  return '偏離';
}

/** Accuracy percent from average score (0–999 → 0–100). */
export function scoreToAccuracy(score) {
  return Math.round((score / 999) * 100);
}

export const MAX_PEEKS_PER_RUN = 1;
export const PEEK_PENALTY = 150;

/** Apply score penalty when the player used a peek hint on this round. */
export function applyPeekPenalty(score, usedPeek) {
  if (!usedPeek) return score;
  return Math.max(0, score - PEEK_PENALTY);
}
