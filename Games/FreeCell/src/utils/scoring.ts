/**
 * Move-count FreeCell scoring with solver par and undo tax.
 *
 * Score rises with foundation progress, then compares finish moves to par.
 * Each undo costs points; finishing under par earns a bonus.
 */

export type PlayMode = 'classic' | 'timed';

export const FOUNDATION_POINTS = 10;
export const UNDO_PENALTY = 5;
export const OVER_PAR_PENALTY = 2;
export const UNDER_PAR_BONUS = 5;

export function initialScore(): number {
  return 0;
}

export function pointsToFoundation(): number {
  return FOUNDATION_POINTS;
}

export function pointsUndo(): number {
  return -UNDO_PENALTY;
}

/** End-of-hand adjustment vs solver par (null par → no move bonus/penalty). */
export function finishMoveDelta(moves: number, parMoves: number | null): number {
  if (parMoves == null || parMoves <= 0) return 0;
  if (moves < parMoves) return (parMoves - moves) * UNDER_PAR_BONUS;
  if (moves > parMoves) return -(moves - parMoves) * OVER_PAR_PENALTY;
  return 0;
}

/** Small classic-mode time bonus when the clock ran (≥30s). */
export function classicTimeBonus(elapsedSec: number): number {
  if (elapsedSec < 30) return 0;
  return Math.floor(100_000 / elapsedSec);
}

export function scoreSummaryLabel(parMoves: number | null, moves: number): string {
  if (parMoves == null) return `${moves} 步 · 標準 —`;
  return `${moves} / 標準 ${parMoves}`;
}
