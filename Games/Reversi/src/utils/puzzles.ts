/**
 * Fixed endgame puzzle pack — each position verified by the exact solver in tests.
 */

import { boardFromRows, moveToAlgebraic } from './boardCodec';
import { countEmpties, getLegalMoves, type Board, type Piece } from './reversiLogic';
import { isOptimalMove, solveExact } from './solver';

export type PuzzleGoal = 'win' | 'maximize' | 'draw';

export interface PuzzleDef {
  id: string;
  /** Traditional Chinese title. */
  title: string;
  /** Short brief shown under the title. */
  brief: string;
  goal: PuzzleGoal;
  /** Side the player controls. */
  side: Piece;
  /** Max player moves allowed (passes do not count). */
  maxPlies: number;
  rows: string[];
  /** Teaching tip shown before / after. */
  tip: string;
}

export interface PuzzleRuntime extends PuzzleDef {
  board: Board;
  index: number;
}

function rows(...lines: string[]): string[] {
  return lines;
}

/**
 * 14 hand-authored positions. Goals and maxPlies are pinned by
 * `puzzles.test.ts` against `solveExact`.
 */
export const PUZZLES: PuzzleDef[] = [
  {
    id: 'corner-a1',
    title: '角地到手',
    brief: '黑先・1 手內取勝',
    goal: 'win',
    side: 'black',
    maxPlies: 1,
    tip: '角永遠不會被翻——看到能佔角就先佔。',
    rows: rows(
      '.WWWWWWB',
      'BWWWWWWB',
      'BWWWWWWB',
      'BWWWWWWB',
      'BWWWWWWB',
      'BWWWWWWB',
      'BWWWWWWB',
      'BBBBBBBB',
    ),
  },
  {
    id: 'corner-h1',
    title: '右上角',
    brief: '黑先・1 手內取勝',
    goal: 'win',
    side: 'black',
    maxPlies: 1,
    tip: '同一條邊的角也一樣珍貴。',
    rows: rows(
      'BWWWWWW.',
      'BWWWWWWW',
      'BWWWWWWW',
      'BWWWWWWW',
      'BWWWWWWW',
      'BWWWWWWW',
      'BWWWWWWW',
      'BBBBBBBB',
    ),
  },
  {
    id: 'corner-h8',
    title: '右下角',
    brief: '黑先・1 手內取勝',
    goal: 'win',
    side: 'black',
    maxPlies: 1,
    tip: '殘局最後一角，往往決定勝負。',
    rows: rows(
      'BBBBBBBB',
      'BWWWWWWB',
      'BWWWWWWB',
      'BWWWWWWB',
      'BWWWWWWB',
      'BWWWWWWB',
      'BWWWWWWB',
      'BWWWWWW.',
    ),
  },
  {
    id: 'corner-a8',
    title: '左下角',
    brief: '黑先・1 手內取勝',
    goal: 'win',
    side: 'black',
    maxPlies: 1,
    tip: '四個角都要養成「掃一眼」的習慣。',
    rows: rows(
      'BBBBBBBB',
      'BWWWWWWB',
      'BWWWWWWB',
      'BWWWWWWB',
      'BWWWWWWB',
      'BWWWWWWB',
      'BWWWWWWB',
      '.WWWWWWB',
    ),
  },
  {
    id: 'fork-choice',
    title: '兩手抉擇',
    brief: '黑先・選對一手才能勝',
    goal: 'win',
    side: 'black',
    maxPlies: 2,
    tip: '能翻很多子的一手，未必是好手——先算對手能否回敬。',
    rows: rows(
      'BBBBBBBB',
      'BWWWWWWB',
      'BWWWWWWB',
      'BWWWWWWB',
      'BWWWWWWB',
      'BWWWWWWB',
      'BWWW.WWB',
      'BBBB.BBB',
    ),
  },
  {
    id: 'edge-run',
    title: '邊線貫通',
    brief: '黑先・1 手取勝並擴大勝差',
    goal: 'maximize',
    side: 'black',
    maxPlies: 2,
    tip: '穩固的邊能連成牆，限制對手的活動空間。',
    rows: rows(
      'BBBBBBBB',
      'BWWWWWWB',
      'BWWWWWWB',
      'BWW.WWWB',
      'BWWWWWWB',
      'BWWWWWWB',
      'BWWWWWWB',
      'BBBBBBB.',
    ),
  },
  {
    id: 'mid-choice',
    title: '三選一',
    brief: '黑先・2 手內把勝差拉到最大',
    goal: 'maximize',
    side: 'black',
    maxPlies: 2,
    tip: '同樣能勝，落點不同勝差差很多——練「最大化」。',
    rows: rows(
      'BBBBBBBB',
      'BWWWWW.B',
      'BWWWWWWB',
      'BWW.WWWB',
      'BWWWWWWB',
      'BWWWWWWB',
      'B.WWWWWB',
      'BBBBBBBB',
    ),
  },
  {
    id: 'three-empty',
    title: '三空殘局',
    brief: '黑先・選對線才能最大勝差',
    goal: 'maximize',
    side: 'black',
    maxPlies: 2,
    tip: '空格奇偶（parity）影響誰下最後一手。',
    rows: rows(
      'BBBBBBBB',
      'BWWWWWWB',
      'BWWWWWWB',
      'BWW.WWWB',
      'BWW.WWWB',
      'BWWWWWWB',
      'BWWWWWWB',
      'BBBB.BBB',
    ),
  },
  {
    id: 'sweep',
    title: '兩路皆通',
    brief: '黑先・任選一角路線取勝',
    goal: 'win',
    side: 'black',
    maxPlies: 2,
    tip: '有時兩手都對——先確認對手無法反將。',
    rows: rows(
      'BBBBBB.B',
      'BWWWWWWB',
      'BWWWWWWB',
      'BWWWWWWB',
      'BWWWWWWB',
      'BWWWWWWB',
      'BWWWWWWB',
      'B.BBBBBB',
    ),
  },
  {
    id: 'white-win',
    title: '白方制勝',
    brief: '白先・1 手內取勝',
    goal: 'win',
    side: 'white',
    maxPlies: 1,
    tip: '執白時同樣要盯角與邊，規則完全對稱。',
    rows: rows(
      'WWWWWWWW',
      'WBBBBBBW',
      'WBBBBBBW',
      'WBB.BBBW',
      'WBBBBBBW',
      'WBBBBBBW',
      'WBBBBBBW',
      'WWWWWWW.',
    ),
  },
  {
    id: 'gap-max',
    title: '細縫最大化',
    brief: '黑先・唯一最佳手',
    goal: 'maximize',
    side: 'black',
    maxPlies: 2,
    tip: '先手吃哪一側，會改變對手能回翻的範圍。',
    rows: rows(
      'BBBBBBBB',
      'BWWWWWWB',
      'BW.WWWWB',
      'BWWWWWWB',
      'BWWWW.WB',
      'BWWWWWWB',
      'BWWWWWWB',
      'BBBBBBBB',
    ),
  },
  {
    id: 'two-corners',
    title: '雙角可取',
    brief: '黑先・取任一角即勝',
    goal: 'win',
    side: 'black',
    maxPlies: 2,
    tip: '兩個角都合法時，先想對手下一手會不會佔另一角。',
    rows: rows(
      '.WWWWWW.',
      'BWWWWWWB',
      'BWWWWWWB',
      'BWWWWWWB',
      'BWWWWWWB',
      'BWWWWWWB',
      'BWWWWWWB',
      'BBBBBBBB',
    ),
  },
  {
    id: 'edge-only',
    title: '補邊定勝',
    brief: '黑先・1 手取勝',
    goal: 'win',
    side: 'black',
    maxPlies: 1,
    tip: '邊子穩了，對手很難從側面切入。',
    rows: rows(
      'BBBBBBBB',
      'BWWWWWW.',
      'BWWWWWWB',
      'BWWWWWWB',
      'BWWWWWWB',
      'BWWWWWWB',
      'BWWWWWWB',
      'BBBBBBBB',
    ),
  },
  {
    id: 'parity-room',
    title: '奇偶空間',
    brief: '黑先・把勝差拉到最大',
    goal: 'maximize',
    side: 'black',
    maxPlies: 3,
    tip: '區域空格數的奇偶，決定誰下最後一手。',
    rows: rows(
      'BBBBBBBB',
      'BWWWWWWB',
      'BWWWWWWB',
      'BW....WB',
      'BWWWWWWB',
      'BWWWWWWB',
      'BWWWWWWB',
      'BBBBBBBB',
    ),
  },
];

export function puzzleCount(): number {
  return PUZZLES.length;
}

export function getPuzzle(index: number): PuzzleRuntime | null {
  if (index < 0 || index >= PUZZLES.length) return null;
  const def = PUZZLES[index];
  return { ...def, board: boardFromRows(def.rows), index };
}

export function getPuzzleById(id: string): PuzzleRuntime | null {
  const index = PUZZLES.findIndex((p) => p.id === id);
  return index >= 0 ? getPuzzle(index) : null;
}

export function puzzleGoalLabel(goal: PuzzleGoal): string {
  if (goal === 'win') return '取勝';
  if (goal === 'draw') return '逼和';
  return '最大化勝差';
}

export function describePuzzleObjective(puzzle: PuzzleDef): string {
  const side = puzzle.side === 'black' ? '黑' : '白';
  const goal = puzzleGoalLabel(puzzle.goal);
  return `${side}先，${puzzle.maxPlies} 手內${goal}`;
}

/**
 * Pinned acceptable first moves (algebraic). Unique when length === 1;
 * multi-entry lists are intentional alternate solutions verified by the solver.
 * Kept in sync by `puzzles.test.ts`.
 */
export const ACCEPTABLE_FIRST_MOVES: Readonly<Record<string, readonly string[]>> = {
  'corner-a1': ['a1'],
  'corner-h1': ['h1'],
  'corner-h8': ['h8'],
  'corner-a8': ['a8'],
  'fork-choice': ['e7'],
  'edge-run': ['d4'],
  'mid-choice': ['b7', 'g2'],
  'three-empty': ['d4', 'e8'],
  sweep: ['b8', 'g1'],
  'white-win': ['d4'],
  'gap-max': ['f5'],
  'two-corners': ['a1', 'h1'],
  'edge-only': ['h2'],
  'parity-room': ['c4', 'f4'],
};

/** Sorted algebraic first moves that satisfy the puzzle goal under perfect replies. */
export function acceptableFirstMoves(puzzle: PuzzleDef): string[] {
  const board = boardFromRows(puzzle.rows);
  return getLegalMoves(board, puzzle.side)
    .filter((m) => isOptimalMove(board, puzzle.side, m, puzzle.goal))
    .map(moveToAlgebraic)
    .sort();
}

/** Runtime sanity: empties small enough for exact solve. */
export function assertPuzzleSolvable(puzzle: PuzzleDef): void {
  const board = boardFromRows(puzzle.rows);
  if (countEmpties(board) > 12) {
    throw new Error(`Puzzle ${puzzle.id} has too many empties for exact solve`);
  }
  const solved = solveExact(board, puzzle.side);
  if (puzzle.goal === 'win' && !solved.canForceWin) {
    throw new Error(`Puzzle ${puzzle.id} cannot force a win`);
  }
  if (puzzle.goal === 'draw' && !solved.canForceDraw) {
    throw new Error(`Puzzle ${puzzle.id} cannot force a draw`);
  }
  if (puzzle.goal === 'maximize' && solved.winningMoves.length === 0) {
    throw new Error(`Puzzle ${puzzle.id} has no legal moves`);
  }
  const live = acceptableFirstMoves(puzzle);
  const pinned = ACCEPTABLE_FIRST_MOVES[puzzle.id];
  if (!pinned) {
    throw new Error(`Puzzle ${puzzle.id} missing ACCEPTABLE_FIRST_MOVES entry`);
  }
  if (live.join('|') !== [...pinned].sort().join('|')) {
    throw new Error(
      `Puzzle ${puzzle.id} acceptable moves drifted: live=[${live.join(',')}] pinned=[${pinned.join(',')}]`,
    );
  }
}
