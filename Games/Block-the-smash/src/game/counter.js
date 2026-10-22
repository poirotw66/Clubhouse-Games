/**
 * Counter-attack phase after a Perfect block: brief placement choice.
 */

/** @typedef {'left' | 'center' | 'right'} AimZone */
/** @typedef {'perfect' | 'good' | 'block' | 'miss'} ContactGrade */

/** Seconds the player has to tap a return lane (instant auto if reduced motion). */
export const COUNTER_WINDOW_SEC = 1.15;

/**
 * Score bonus for a successful counter placement (score-attack / daily).
 * @param {AimZone} zone
 * @param {number} combo
 */
export function counterScoreBonus(zone, combo) {
  const corner = zone === 'center' ? 1 : 1.4;
  return Math.round((420 + combo * 55) * corner);
}

/**
 * Extra versus win chance from an intentional counter (vs passive aim-at-contact).
 * @param {AimZone} zone
 * @param {{ coverLeft: number, coverCenter: number, coverRight: number }} cover
 */
export function counterVersusBonus(zone, cover) {
  const weak =
    zone === 'left' ? 1 - cover.coverLeft : zone === 'right' ? 1 - cover.coverRight : 1 - cover.coverCenter;
  return 0.08 + weak * 0.18;
}

/**
 * Whether the counter "breaks rhythm" (delays next smash / softens next fake).
 * Corner placements that find a weak side always disrupt; center only sometimes.
 * @param {AimZone} zone
 * @param {{ coverLeft: number, coverCenter: number, coverRight: number }} cover
 * @param {() => number} rng
 */
export function counterDisruptsRhythm(zone, cover, rng) {
  if (zone === 'center') return rng() < 0.35;
  const covered =
    zone === 'left' ? cover.coverLeft : zone === 'right' ? cover.coverRight : cover.coverCenter;
  return rng() < Math.min(0.92, 0.55 + (1 - covered) * 0.4);
}

/**
 * Resolve a Perfect counter into score / versus outcomes.
 * @param {{
 *   mode: string,
 *   zone: AimZone,
 *   combo: number,
 *   cover: { coverLeft: number, coverCenter: number, coverRight: number, defense: number } | null,
 *   versusWinsPoint: (grade: ContactGrade, zone: AimZone, cover: object, rng: () => number) => boolean,
 *   rng: () => number,
 * }} input
 */
export function resolvePerfectCounter(input) {
  const { mode, zone, combo, cover, versusWinsPoint, rng } = input;
  /** @type {{ scoreDelta: number, wonPoint: boolean, disrupted: boolean, toast: string }} */
  const out = { scoreDelta: 0, wonPoint: false, disrupted: false, toast: '完美回殺!' };

  if (mode === 'scoreAttack' || mode === 'daily') {
    out.scoreDelta = counterScoreBonus(zone, combo);
    out.toast =
      zone === 'center' ? '完美回殺・中路!' : `完美回殺・${zone === 'left' ? '左' : '右'}路!`;
    return out;
  }

  if (mode === 'versus' && cover) {
    const base = versusWinsPoint('perfect', zone, cover, rng);
    const bonusRoll = rng() < counterVersusBonus(zone, cover);
    out.wonPoint = base || bonusRoll;
    out.disrupted = counterDisruptsRhythm(zone, cover, rng);
    if (out.wonPoint) {
      out.toast = out.disrupted ? '得分・打亂節奏!' : '回殺得分!';
    } else {
      out.toast = out.disrupted ? '對手接住・節奏亂了' : '對手接住!';
    }
    return out;
  }

  // drill
  out.toast =
    zone === 'center' ? '完美回殺!' : `完美・${zone === 'left' ? '左' : '右'}路回殺`;
  out.disrupted = zone !== 'center';
  return out;
}
