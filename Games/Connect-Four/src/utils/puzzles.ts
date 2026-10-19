/**
 * Puzzle pack: fixed boards, "win in N moves" (player moves as sideToMove).
 */

import {
  applyMove,
  buildRules,
  createInitialBoard,
  getDropRow,
  getLegalMoves,
  hasWonAt,
  resolveWinnerAfterMove,
  type Board,
  type Move,
  type PieceColor,
  type RulesConfig,
} from './connect4Logic';
import type { BoardPresetId, RuleVariantId } from './types';

export interface PuzzleDef {
  id: string;
  name: string;
  blurb: string;
  /** Max player plies to force the win. */
  maxMoves: number;
  variant: RuleVariantId;
  preset: BoardPresetId;
  sideToMove: PieceColor;
  /**
   * Rows top→bottom, cells `.` / `R` / `Y`, rows joined by `/`.
   * Must match preset dimensions.
   */
  board: string;
  /** Principal winning line (player moves only). */
  solution: Move[];
}

function parseBoard(encoded: string, rules: RulesConfig): Board {
  const rows = encoded.split('/');
  if (rows.length !== rules.rows) {
    throw new Error(`puzzle rows ${rows.length} != ${rules.rows}`);
  }
  const board = createInitialBoard(rules);
  for (let r = 0; r < rules.rows; r++) {
    const line = rows[r];
    if (line.length !== rules.cols) {
      throw new Error(`puzzle cols ${line.length} != ${rules.cols} at row ${r}`);
    }
    for (let c = 0; c < rules.cols; c++) {
      const ch = line[c];
      if (ch === 'R') board[r][c] = 'red';
      else if (ch === 'Y') board[r][c] = 'yellow';
    }
  }
  return board;
}

export function puzzleRules(puzzle: PuzzleDef): RulesConfig {
  return buildRules(puzzle.variant, puzzle.preset);
}

export function loadPuzzleBoard(puzzle: PuzzleDef): Board {
  return parseBoard(puzzle.board, puzzleRules(puzzle));
}

/**
 * Classic layout helper — `columns` lists bottom→top pieces per column.
 * Characters: R / Y.
 */
function stacksToEncoded(
  columns: string[],
  rows: number,
  cols: number,
): string {
  const grid: string[][] = Array.from({ length: rows }, () =>
    Array(cols).fill('.'),
  );
  for (let c = 0; c < cols; c++) {
    const stack = columns[c] ?? '';
    for (let i = 0; i < stack.length; i++) {
      const r = rows - 1 - i;
      grid[r][c] = stack[i];
    }
  }
  return grid.map((row) => row.join('')).join('/');
}

export const PUZZLES: PuzzleDef[] = [
  {
    id: 'p01-horiz-1',
    name: '橫線一擊',
    blurb: '底列已有三連，一子定音',
    maxMoves: 1,
    variant: 'classic',
    preset: '7x6',
    sideToMove: 'red',
    board: stacksToEncoded(['R', 'R', 'R', '', 'Y', 'Y', 'Y'], 6, 7),
    solution: [{ kind: 'drop', col: 3 }],
  },
  {
    id: 'p02-vert-1',
    name: '直落連珠',
    blurb: '同欄三子，再投即勝',
    maxMoves: 1,
    variant: 'classic',
    preset: '7x6',
    sideToMove: 'red',
    board: stacksToEncoded(['Y', 'Y', '', 'RRR', 'Y', '', ''], 6, 7),
    solution: [{ kind: 'drop', col: 3 }],
  },
  {
    id: 'p03-diag-1',
    name: '斜線收官',
    blurb: '階梯斜線差一格',
    maxMoves: 1,
    variant: 'classic',
    preset: '7x6',
    sideToMove: 'red',
    board: stacksToEncoded(['R', 'YR', 'YYR', 'YYY', '', '', ''], 6, 7),
    solution: [{ kind: 'drop', col: 3 }],
  },
  {
    id: 'p04-fork-2',
    name: '雙殺兩步',
    blurb: '一子做出雙威脅，對手擋不住',
    maxMoves: 2,
    variant: 'classic',
    preset: '7x6',
    sideToMove: 'red',
    board: '......./......./......./......./..RR.Y./YRRYRYY',
    solution: [
      { kind: 'drop', col: 1 },
      { kind: 'drop', col: 4 },
    ],
  },
  {
    id: 'p05-center-1',
    name: '中路決勝',
    blurb: '中央空位一擊連四',
    maxMoves: 1,
    variant: 'classic',
    preset: '7x6',
    sideToMove: 'red',
    board: stacksToEncoded(['Y', 'R', 'R', '', 'R', 'Y', 'Y'], 6, 7),
    solution: [{ kind: 'drop', col: 3 }],
  },
  {
    id: 'p06-popout-1',
    name: 'PopOut 一擊',
    blurb: '取出底格己子，讓上方橫線連四',
    maxMoves: 1,
    variant: 'popout',
    preset: '7x6',
    sideToMove: 'red',
    board: '...R.../...Y.../...Y..Y/.R.RY.Y/RYRRRYY/RRRYRRR',
    solution: [{ kind: 'pop', col: 1 }],
  },
  {
    id: 'p07-wide-1',
    name: '大盤一擊',
    blurb: '8×7 盤上的橫線收官',
    maxMoves: 1,
    variant: 'classic',
    preset: '8x7',
    sideToMove: 'red',
    board: stacksToEncoded(['R', 'R', 'R', '', 'Y', 'Y', 'Y', 'Y'], 7, 8),
    solution: [{ kind: 'drop', col: 3 }],
  },
  {
    id: 'p08-five-1',
    name: '五子臨門',
    blurb: '9×7 五子勝：補上正中',
    maxMoves: 1,
    variant: 'five',
    preset: '9x7',
    sideToMove: 'red',
    board: stacksToEncoded(
      ['R', 'R', 'R', 'R', '', 'Y', 'Y', 'Y', 'Y'],
      7,
      9,
    ),
    solution: [{ kind: 'drop', col: 4 }],
  },
  {
    id: 'p09-fork-wide',
    name: '大盤雙殺',
    blurb: '8×7：一子雙威脅',
    maxMoves: 2,
    variant: 'classic',
    preset: '8x7',
    sideToMove: 'red',
    // Mirror the 7×6 fork with an extra empty column on the left (+1 row for 8×7).
    board: '......../......../......../......../......../...RR.Y./.YRRYRYY',
    solution: [
      { kind: 'drop', col: 2 },
      { kind: 'drop', col: 5 },
    ],
  },
  {
    id: 'p10-diag-fork',
    name: '斜線雙殺',
    blurb: '兩步內斜線破局',
    maxMoves: 2,
    variant: 'classic',
    preset: '7x6',
    sideToMove: 'red',
    board: '......./......./......./..R..../.YRYR../.YYRYR.',
    solution: [
      { kind: 'drop', col: 2 },
      { kind: 'drop', col: 3 },
    ],
  },
];

export function getPuzzleById(id: string): PuzzleDef | undefined {
  return PUZZLES.find((p) => p.id === id);
}

function pickDefense(
  board: Board,
  defender: PieceColor,
  attacker: PieceColor,
  rules: RulesConfig,
): Move | null {
  const moves = getLegalMoves(board, defender, rules);
  for (const move of moves) {
    if (move.kind !== 'drop') continue;
    const row = getDropRow(board, move.col, rules);
    if (row === null) continue;
    const probe = applyMove(board, { kind: 'drop', col: move.col }, attacker, rules);
    if (probe && hasWonAt(probe, row, move.col, attacker, rules)) {
      return move;
    }
  }
  return moves.find((m) => m.kind === 'drop') ?? moves[0] ?? null;
}

/**
 * Replay the principal solution with a simple blocking opponent.
 * Returns true when the puzzle side wins within maxMoves.
 */
export function verifyPuzzleSolution(puzzle: PuzzleDef): boolean {
  const rules = puzzleRules(puzzle);
  let board = loadPuzzleBoard(puzzle);
  let turn: PieceColor = puzzle.sideToMove;
  let playerPlies = 0;

  for (const move of puzzle.solution) {
    if (turn !== puzzle.sideToMove) return false;
    const dropRow =
      move.kind === 'drop' ? getDropRow(board, move.col, rules) : null;
    const next = applyMove(board, move, turn, rules);
    if (!next) return false;
    playerPlies++;
    const winner = resolveWinnerAfterMove(next, turn, move, dropRow, rules);
    board = next;
    if (winner === puzzle.sideToMove) {
      return playerPlies <= puzzle.maxMoves;
    }
    if (winner) return false;

    if (playerPlies >= puzzle.solution.length) break;
    turn = turn === 'red' ? 'yellow' : 'red';
    const reply = pickDefense(board, turn, puzzle.sideToMove, rules);
    if (!reply) return false;
    const replyRow =
      reply.kind === 'drop' ? getDropRow(board, reply.col, rules) : null;
    const after = applyMove(board, reply, turn, rules);
    if (!after) return false;
    const w2 = resolveWinnerAfterMove(after, turn, reply, replyRow, rules);
    if (w2) return false;
    board = after;
    turn = turn === 'red' ? 'yellow' : 'red';
  }
  return false;
}
