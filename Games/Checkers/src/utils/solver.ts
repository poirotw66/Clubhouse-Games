/**
 * Forced-win solver for puzzle verification / "win in N" checks.
 * Searches with alpha-beta; N is player plies (side-to-move first).
 */

import {
  applyMove,
  getLegalMoves,
  getWinner,
  type Board,
  type Move,
  type PieceColor,
  type RulesetId,
} from './checkersLogic';

function opponent(color: PieceColor): PieceColor {
  return color === 'black' ? 'white' : 'black';
}

export type SolveResult = {
  win: boolean;
  /** Principal variation for the side that was to move (player plies). */
  pv: Move[];
};

/**
 * Returns whether `side` can force a win within `maxPlayerPlies` of their own moves.
 * Opponent plays optimally to delay/avoid loss.
 */
export function canForceWin(
  board: Board,
  side: PieceColor,
  maxPlayerPlies: number,
  ruleset: RulesetId,
): SolveResult {
  const pv: Move[] = [];
  const win = search(board, side, side, maxPlayerPlies, true, pv, ruleset);
  return { win, pv };
}

function search(
  board: Board,
  turn: PieceColor,
  hero: PieceColor,
  heroPliesLeft: number,
  isHeroTurn: boolean,
  pvOut: Move[],
  ruleset: RulesetId,
): boolean {
  const winner = getWinner(board, turn, ruleset);
  if (winner === hero) return true;
  if (winner && winner !== hero) return false;
  if (isHeroTurn && heroPliesLeft <= 0) return false;

  const moves = getLegalMoves(board, turn, ruleset);
  if (moves.length === 0) {
    return turn !== hero;
  }

  if (isHeroTurn) {
    for (const move of moves) {
      const next = applyMove(board, move, ruleset);
      const childPv: Move[] = [];
      const ok = search(
        next,
        opponent(turn),
        hero,
        heroPliesLeft - 1,
        false,
        childPv,
        ruleset,
      );
      if (ok) {
        pvOut.length = 0;
        pvOut.push(move, ...childPv);
        return true;
      }
    }
    return false;
  }

  // Opponent: all replies must still allow hero win.
  for (const move of moves) {
    const next = applyMove(board, move, ruleset);
    const childPv: Move[] = [];
    const ok = search(next, opponent(turn), hero, heroPliesLeft, true, childPv, ruleset);
    if (!ok) return false;
    if (pvOut.length === 0) {
      pvOut.push(...childPv);
    }
  }
  return true;
}

/** Shortest forced win length in player plies, or null if none within max. */
export function shortestWinIn(
  board: Board,
  side: PieceColor,
  maxPlayerPlies: number,
  ruleset: RulesetId,
): number | null {
  for (let n = 1; n <= maxPlayerPlies; n++) {
    if (canForceWin(board, side, n, ruleset).win) return n;
  }
  return null;
}
