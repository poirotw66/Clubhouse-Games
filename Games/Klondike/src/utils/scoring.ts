/**
 * Standard (Windows Solitaire–style) and Vegas scoring.
 * Standard rewards reveals / foundation plays and taxes recycle + time.
 * Vegas is a bankroll game: −52 to deal, +5 per foundation card.
 */

import type { DrawCount } from './gameLogic.ts';

export type ScoreMode = 'standard' | 'vegas';

export const VEGAS_DEAL_COST = 52;
export const VEGAS_FOUNDATION_PAYOUT = 5;

export function scoreLabel(mode: ScoreMode): string {
  return mode === 'vegas' ? '維加斯' : '標準';
}

/** Opening score for a fresh deal. */
export function initialScore(mode: ScoreMode): number {
  return mode === 'vegas' ? -VEGAS_DEAL_COST : 0;
}

export function pointsToFoundation(mode: ScoreMode): number {
  return mode === 'vegas' ? VEGAS_FOUNDATION_PAYOUT : 10;
}

export function pointsWasteToTableau(mode: ScoreMode): number {
  return mode === 'vegas' ? 0 : 5;
}

export function pointsReveal(mode: ScoreMode): number {
  return mode === 'vegas' ? 0 : 5;
}

export function pointsFromFoundation(mode: ScoreMode): number {
  return mode === 'vegas' ? 0 : -15;
}

/** Recycle penalty (Standard only). Vegas forbids or limits recycle elsewhere. */
export function pointsRecycle(mode: ScoreMode, drawCount: DrawCount): number {
  if (mode === 'vegas') return 0;
  return drawCount === 1 ? -100 : -20;
}

/** −2 every 10 seconds in Standard timed scoring. */
export function standardTimePenaltyTicks(elapsedSec: number, appliedThroughSec: number): {
  penalty: number;
  appliedThroughSec: number;
} {
  const nextThrough = Math.floor(elapsedSec / 10) * 10;
  if (nextThrough <= appliedThroughSec) {
    return { penalty: 0, appliedThroughSec };
  }
  const ticks = (nextThrough - appliedThroughSec) / 10;
  return { penalty: -2 * ticks, appliedThroughSec: nextThrough };
}

/** Windows-style finish bonus when the clock ran. */
export function standardWinBonus(elapsedSec: number): number {
  if (elapsedSec <= 0) return 0;
  if (elapsedSec < 30) return 0;
  return Math.floor(700_000 / elapsedSec);
}

/**
 * Vegas: Draw-1 may not recycle; Draw-3 allows two recycles (three passes).
 * Standard: unlimited recycles (penalized).
 */
export function maxRecycles(mode: ScoreMode, drawCount: DrawCount): number | null {
  if (mode === 'standard') return null;
  return drawCount === 1 ? 0 : 2;
}

export function canRecycle(
  mode: ScoreMode,
  drawCount: DrawCount,
  recycleCount: number,
): boolean {
  const max = maxRecycles(mode, drawCount);
  if (max === null) return true;
  return recycleCount < max;
}
