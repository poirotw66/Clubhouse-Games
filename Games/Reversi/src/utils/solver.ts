/**
 * Exact endgame solver for Reversi puzzles.
 * Scores by final disc difference from the side-to-move's point of view.
 */

import {
  applyMove,
  countEmpties,
  countPieces,
  getLegalMoves,
  opponent,
  orderMoves,
  type Board,
  type Piece,
} from './reversiLogic';

function terminalDiff(board: Board, me: Piece): number {
  const { black, white } = countPieces(board);
  return me === 'black' ? black - white : white - black;
}

/** Exact search scoring by disc diff from `turn`'s point of view. */
function exactSearch(board: Board, alpha: number, beta: number, turn: Piece): number {
  const moves = getLegalMoves(board, turn);
  const opp = opponent(turn);

  if (moves.length === 0) {
    if (getLegalMoves(board, opp).length === 0) {
      return terminalDiff(board, turn);
    }
    return -exactSearch(board, -beta, -alpha, opp);
  }

  let value = -Infinity;
  for (const [r, c] of orderMoves(moves)) {
    const next = applyMove(board, r, c, turn);
    const score = -exactSearch(next, -beta, -alpha, opp);
    if (score > value) value = score;
    if (value > alpha) alpha = value;
    if (alpha >= beta) break;
  }
  return value;
}

export interface SolveResult {
  /** Best disc difference for `side` if both play perfectly to the end. */
  score: number;
  /** One best move (null if pass / no moves). */
  bestMove: [number, number] | null;
  /** All moves that achieve `score`. */
  winningMoves: [number, number][];
  /** Whether `side` can force a win (score > 0). */
  canForceWin: boolean;
  /** Whether `side` can force at least a draw (score >= 0). */
  canForceDraw: boolean;
}

/**
 * Solve a position exactly. Prefer empties ≤ 12 for interactive use.
 */
export function solveExact(board: Board, side: Piece): SolveResult {
  const moves = getLegalMoves(board, side);
  if (moves.length === 0) {
    const oppMoves = getLegalMoves(board, opponent(side));
    if (oppMoves.length === 0) {
      const score = terminalDiff(board, side);
      return {
        score,
        bestMove: null,
        winningMoves: [],
        canForceWin: score > 0,
        canForceDraw: score >= 0,
      };
    }
    const passed = solveExact(board, opponent(side));
    const score = -passed.score;
    return {
      score,
      bestMove: null,
      winningMoves: [],
      canForceWin: score > 0,
      canForceDraw: score >= 0,
    };
  }

  let bestScore = -Infinity;
  const scored: Array<{ move: [number, number]; score: number }> = [];
  for (const [r, c] of orderMoves(moves)) {
    const next = applyMove(board, r, c, side);
    const score = -exactSearch(next, -Infinity, Infinity, opponent(side));
    scored.push({ move: [r, c], score });
    if (score > bestScore) bestScore = score;
  }

  const winningMoves = scored.filter((s) => s.score === bestScore).map((s) => s.move);
  return {
    score: bestScore,
    bestMove: winningMoves[0] ?? null,
    winningMoves,
    canForceWin: bestScore > 0,
    canForceDraw: bestScore >= 0,
  };
}

/** True when empties are few enough for a full exact solve in the browser. */
export function isExactSolvable(board: Board, maxEmpties = 12): boolean {
  return countEmpties(board) <= maxEmpties;
}

/**
 * Check whether a specific move preserves the puzzle goal.
 * - maximize: must be a max-score move
 * - win: must keep a forced win (score > 0 after reply)
 * - draw: must keep score ≥ 0
 */
export function isOptimalMove(
  board: Board,
  side: Piece,
  move: [number, number],
  goal: 'win' | 'maximize' | 'draw',
): boolean {
  const solved = solveExact(board, side);
  const key = `${move[0]},${move[1]}`;
  const inBest = solved.winningMoves.some(([r, c]) => `${r},${c}` === key);
  if (goal === 'maximize') return inBest;
  if (!getLegalMoves(board, side).some(([r, c]) => r === move[0] && c === move[1])) {
    return false;
  }
  const next = applyMove(board, move[0], move[1], side);
  const after = solveExact(next, opponent(side));
  const kept = -after.score;
  if (goal === 'win') {
    if (!solved.canForceWin) return inBest;
    return kept > 0;
  }
  return kept >= 0;
}

/** Play the opponent's best exact reply (or null if they must pass). */
export function bestExactReply(board: Board, side: Piece): [number, number] | null {
  return solveExact(board, side).bestMove;
}
