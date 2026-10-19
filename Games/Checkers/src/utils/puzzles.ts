/**
 * Puzzle pack: fixed "win in N" positions, solver-verified in check.
 */

import { placePieces, type Piece, type PieceColor, type RulesetId } from './checkersLogic';
import { canForceWin, shortestWinIn } from './solver';

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
    blurb: '跳吃最後一子',
    ruleset: 'american',
    sideToMove: 'black',
    winIn: 1,
    pieces: [p(5, 2, 'black'), p(4, 3, 'white')],
  },
  {
    id: 'p02-double',
    name: '雙跳清盤',
    blurb: '一連兩跳吃光',
    ruleset: 'american',
    sideToMove: 'black',
    winIn: 1,
    pieces: [p(5, 2, 'black'), p(4, 3, 'white'), p(2, 5, 'white')],
  },
  {
    id: 'p03-king-chase',
    name: '王的追擊',
    blurb: '用王跳吃殘兵',
    ruleset: 'american',
    sideToMove: 'black',
    winIn: 1,
    pieces: [p(4, 3, 'black', true), p(3, 4, 'white')],
  },
  {
    id: 'p04-blockade',
    name: '堵死殘局',
    blurb: '讓對手無棋可下',
    ruleset: 'american',
    sideToMove: 'black',
    winIn: 1,
    pieces: [p(5, 2, 'black', true), p(6, 1, 'black'), p(7, 0, 'white')],
  },
  {
    id: 'p05-two-kings',
    name: '雙王夾擊',
    blurb: '兩步內強制取勝',
    ruleset: 'american',
    sideToMove: 'black',
    winIn: 2,
    pieces: [p(5, 6, 'black', true), p(6, 5, 'black', true), p(4, 3, 'white')],
  },
  {
    id: 'p06-corner-hunt',
    name: '邊線狩獵',
    blurb: '兩步逼殺邊兵',
    ruleset: 'american',
    sideToMove: 'black',
    winIn: 2,
    pieces: [p(7, 4, 'black', true), p(6, 3, 'black', true), p(4, 1, 'white')],
  },
  {
    id: 'p07-file-squeeze',
    name: '直列擠壓',
    blurb: '兩步收網',
    ruleset: 'american',
    sideToMove: 'black',
    winIn: 2,
    pieces: [p(5, 0, 'black', true), p(7, 0, 'black', true), p(3, 0, 'white')],
  },
  {
    id: 'p08-three-ply',
    name: '三步殘局',
    blurb: '三步內必勝',
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
    blurb: '國際式兵向後跳吃',
    ruleset: 'international',
    sideToMove: 'black',
    winIn: 1,
    pieces: [p(3, 4, 'black'), p(4, 5, 'white')],
  },
  {
    id: 'p10-intl-fly',
    name: '飛王遠征',
    blurb: '國際式飛王遠距跳吃',
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
