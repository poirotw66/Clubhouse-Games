/**
 * Puzzle pack: fixed "win in N" positions, solver-verified in check.
 */

import { placePieces, type Piece, type PieceColor, type RulesetId } from './checkersLogic';
import { canForceWin, shortestWinIn } from './solver';
import type { PuzzleStar } from './storage';

export type PuzzleDef = {
  id: string;
  name: string;
  blurb: string;
  ruleset: RulesetId;
  sideToMove: PieceColor;
  /** Player plies to force a win. */
  winIn: number;
  pieces: Array<[number, number, Piece]>;
};

function p(
  r: number,
  c: number,
  color: PieceColor,
  king = false,
): [number, number, Piece] {
  return [r, c, { color, king }];
}

/**
 * Ten endgames. Each claims `winIn` player plies;
 * `verifyAllPuzzles()` confirms with the solver (exact shortest length).
 */
export const PUZZLES: readonly PuzzleDef[] = [
  {
    id: 'p01-snap',
    name: '一擊必殺',
    blurb: '黑先，跳吃最後一子',
    ruleset: 'american',
    sideToMove: 'black',
    winIn: 1,
    pieces: [p(5, 2, 'black'), p(4, 3, 'white')],
  },
  {
    id: 'p02-double',
    name: '雙跳清盤',
    blurb: '黑先，一連兩跳吃光',
    ruleset: 'american',
    sideToMove: 'black',
    winIn: 1,
    pieces: [p(5, 2, 'black'), p(4, 3, 'white'), p(2, 5, 'white')],
  },
  {
    id: 'p03-king-chase',
    name: '王的追擊',
    blurb: '黑先，用王跳吃殘兵',
    ruleset: 'american',
    sideToMove: 'black',
    winIn: 1,
    pieces: [p(4, 3, 'black', true), p(3, 4, 'white')],
  },
  {
    id: 'p04-blockade',
    name: '堵死殘局',
    blurb: '黑先，讓對手無棋可下',
    ruleset: 'american',
    sideToMove: 'black',
    winIn: 1,
    pieces: [p(5, 2, 'black', true), p(6, 1, 'black'), p(7, 0, 'white')],
  },
  {
    id: 'p05-two-kings',
    name: '雙王夾擊',
    blurb: '黑先，兩步內強制取勝',
    ruleset: 'american',
    sideToMove: 'black',
    winIn: 2,
    pieces: [p(5, 6, 'black', true), p(6, 5, 'black', true), p(4, 3, 'white')],
  },
  {
    id: 'p06-white-snap',
    name: '白方一擊',
    blurb: '白先，跳吃取勝',
    ruleset: 'american',
    sideToMove: 'white',
    winIn: 1,
    pieces: [p(2, 3, 'white'), p(3, 4, 'black')],
  },
  {
    id: 'p07-file-squeeze',
    name: '直列擠壓',
    blurb: '黑先，兩步收網',
    ruleset: 'american',
    sideToMove: 'black',
    winIn: 2,
    pieces: [p(5, 0, 'black', true), p(7, 0, 'black', true), p(3, 0, 'white')],
  },
  {
    id: 'p08-three-ply',
    name: '三步殘局',
    blurb: '黑先，三步內必勝',
    ruleset: 'american',
    sideToMove: 'black',
    winIn: 3,
    pieces: [
      p(2, 5, 'black', true),
      p(5, 4, 'black', true),
      p(2, 1, 'white'),
      p(7, 4, 'white'),
    ],
  },
  {
    id: 'p09-intl-back',
    name: '兵也能後跳',
    blurb: '國際式・黑先，兵向後跳吃',
    ruleset: 'international',
    sideToMove: 'black',
    winIn: 1,
    pieces: [p(3, 4, 'black'), p(4, 5, 'white')],
  },
  {
    id: 'p10-intl-fly',
    name: '飛王遠征',
    blurb: '國際式・黑先，飛王遠距跳吃',
    ruleset: 'international',
    sideToMove: 'black',
    winIn: 1,
    pieces: [p(5, 4, 'black', true), p(8, 1, 'white')],
  },
];

export function puzzleBoard(puzzle: PuzzleDef) {
  const size = puzzle.ruleset === 'international' ? 10 : 8;
  return placePieces(size, puzzle.pieces);
}

export type PuzzleVerifyIssue = {
  id: string;
  reason: string;
};

/** Used by vitest / check to lock the pack. */
export function verifyAllPuzzles(): PuzzleVerifyIssue[] {
  const issues: PuzzleVerifyIssue[] = [];
  for (const puzzle of PUZZLES) {
    const board = puzzleBoard(puzzle);
    const forced = canForceWin(board, puzzle.sideToMove, puzzle.winIn, puzzle.ruleset);
    if (!forced.win) {
      issues.push({ id: puzzle.id, reason: `not a forced win in ${puzzle.winIn}` });
      continue;
    }
    const shortest = shortestWinIn(board, puzzle.sideToMove, puzzle.winIn, puzzle.ruleset);
    if (shortest !== puzzle.winIn) {
      issues.push({
        id: puzzle.id,
        reason: `shortest win is ${shortest}, claimed ${puzzle.winIn}`,
      });
    }
  }
  return issues;
}

/** Puzzle index unlocks after the previous one is cleared (first always open). */
export function isPuzzleUnlocked(
  index: number,
  clearedIds: ReadonlyArray<string>,
): boolean {
  if (index <= 0) return true;
  if (index >= PUZZLES.length) return false;
  const prev = PUZZLES[index - 1];
  return clearedIds.includes(prev.id);
}

/**
 * Star rating for a cleared win-in-N puzzle.
 * 3★ clean (no hint/undo), 2★ one assist, 1★ more assists.
 */
export function ratePuzzleStars(hintsUsed: number, undosUsed: number): PuzzleStar {
  const assists = Math.max(0, hintsUsed) + Math.max(0, undosUsed);
  if (assists <= 0) return 3;
  if (assists === 1) return 2;
  return 1;
}

export function formatStars(stars: number): string {
  const n = Math.max(0, Math.min(3, Math.floor(stars)));
  return `${'★'.repeat(n)}${'☆'.repeat(3 - n)}`;
}

export function sideToMoveLabel(color: PieceColor): string {
  return color === 'black' ? '黑先' : '白先';
}
