import type { Card } from '../types.ts';

/**
 * Hi-Lo card counting (practice aid).
 * Low 2–6 = +1, neutral 7–9 = 0, high 10–A = −1.
 */
export function hiLoValue(rank: string): number {
  if (['2', '3', '4', '5', '6'].includes(rank)) return 1;
  if (['7', '8', '9'].includes(rank)) return 0;
  return -1;
}

export function runningCountDelta(cards: Card[]): number {
  let delta = 0;
  for (const card of cards) {
    if (card.isHidden) continue;
    delta += hiLoValue(card.rank);
  }
  return delta;
}

/** True count ≈ running / decks remaining (floored toward zero). */
export function trueCount(running: number, cardsRemaining: number): number {
  const decksLeft = Math.max(cardsRemaining / 52, 0.25);
  return Math.trunc(running / decksLeft);
}
