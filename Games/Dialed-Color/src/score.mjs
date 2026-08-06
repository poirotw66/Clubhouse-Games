/**
 * Score from HSL distance: identical colors → 999; farther → lower.
 * dh is circular on the hue wheel (0–360), normalized by 180.
 */
export function calculateScore(c1, c2) {
  const dh = Math.min(Math.abs(c1.h - c2.h), 360 - Math.abs(c1.h - c2.h)) / 180;
  const ds = Math.abs(c1.s - c2.s) / 100;
  const dl = Math.abs(c1.l - c2.l) / 100;
  const distance = Math.sqrt(dh * dh + ds * ds + dl * dl);
  return Math.max(0, Math.floor(999 * (1 - distance)));
}
