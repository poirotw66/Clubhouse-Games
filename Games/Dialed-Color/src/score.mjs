/**
 * Score from HSL distance: identical colors → 999; farther → lower.
 * dh is circular on the hue wheel (0–360), normalized by 180.
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
 * @param {Color} c1
 * @param {Color} c2
 */
export function distanceComponents(c1, c2) {
  const dh = hueDelta(c1, c2) / 180;
  const ds = Math.abs(c1.s - c2.s) / 100;
  const dl = Math.abs(c1.l - c2.l) / 100;
  const distance = Math.sqrt(dh * dh + ds * ds + dl * dl);
  return {
    hueNorm: dh,
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
  return Math.max(0, Math.floor(999 * (1 - distance)));
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
