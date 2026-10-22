/**
 * Mastery drills: cheese race (dig garbage) and fixed T-Spin puzzles with stars.
 */

import { hashString, mulberry32 } from './rng.ts';
import type { Cell, TetrominoType, TSpinKind } from './tetrisLogic.ts';
import { BOARD_SIZE, createEmptyBoard, makeGarbageRow } from './tetrisLogic.ts';

export const PRACTICE_STORAGE_KEY = 'clubhouse:tetris-practice-v1';

export type PracticeKind = 'cheese' | 'tspin';

export interface CheeseConfig {
  /** Garbage rows stacked from the bottom. */
  garbageRows: number;
  /** Line clears required to finish. */
  lineGoal: number;
  /** Star thresholds by elapsed ms (3★ / 2★ / 1★). */
  starTimesMs: [number, number, number];
}

export const CHEESE_DEFAULT: CheeseConfig = {
  garbageRows: 10,
  lineGoal: 10,
  starTimesMs: [45_000, 75_000, 120_000],
};

/** Build a cheese board: `rows` garbage lines with one hole each (stable holes via seed). */
export function createCheeseBoard(rows: number, seed: number = 1): Cell[][] {
  const board = createEmptyBoard();
  const rand = mulberry32(seed);
  const start = BOARD_SIZE.rows - Math.min(rows, BOARD_SIZE.rows - 2);
  for (let r = start; r < BOARD_SIZE.rows; r++) {
    const hole = Math.floor(rand() * BOARD_SIZE.cols);
    board[r] = makeGarbageRow(hole);
  }
  return board;
}

export function cheeseStars(elapsedMs: number, cleared: boolean, config: CheeseConfig = CHEESE_DEFAULT): number {
  if (!cleared) return 0;
  const [s3, s2, s1] = config.starTimesMs;
  if (elapsedMs <= s3) return 3;
  if (elapsedMs <= s2) return 2;
  if (elapsedMs <= s1) return 1;
  return 1;
}

export interface TSpinPuzzle {
  id: string;
  name: string;
  blurb: string;
  /** Row strings: `.` empty, `G` garbage, or tetromino letter. Length = cols. */
  rows: string[];
  /** First piece is active; rest is queue. */
  queue: TetrominoType[];
  require: {
    tSpin: TSpinKind | 'full-or-mini';
    minLines: number;
  };
  /** Max locks for 3★ / 2★ (1★ = any clear). */
  starLocks: [number, number];
}

/**
 * Compact T-Spin setups. Boards are bottom-aligned; only the listed bottom rows
 * are filled — the rest of the well stays empty.
 */
export const TSPIN_PUZZLES: TSpinPuzzle[] = [
  {
    id: 'ts-double-1',
    name: 'T-Spin Double',
    blurb: '經典 TSD 井：旋轉卡入消兩行',
    // Legal T slot at (rows-4, 3) rot 2: fills mid cavity then clears 2.
    rows: [
      'GGGG.GGGGG',
      'GGG...GGGG',
      'GGGG.GGGGG',
      'GGGGGGGGGG',
    ],
    queue: ['T', 'L', 'J', 'I'],
    require: { tSpin: 'full', minLines: 2 },
    starLocks: [1, 3],
  },
  {
    id: 'ts-single-1',
    name: 'T-Spin Single',
    blurb: '側邊 T 槽，消一行即可',
    rows: [
      'GGGGGGG.GG',
      'GGGGGG...G',
      'GGGGGGG.GG',
      'GGGGGGGGGG',
    ],
    queue: ['T', 'O', 'S', 'Z'],
    require: { tSpin: 'full-or-mini', minLines: 1 },
    starLocks: [1, 4],
  },
  {
    id: 'ts-mini-1',
    name: 'T-Spin Mini',
    blurb: '淺槽 Mini：旋轉消一行',
    rows: [
      'GGG.G.GGGG',
      'GG.....GGG',
      'GGG.G.GGGG',
    ],
    queue: ['T', 'I', 'J', 'L'],
    require: { tSpin: 'full-or-mini', minLines: 1 },
    starLocks: [1, 3],
  },
];

export function puzzleBoardFromRows(rows: string[]): Cell[][] {
  const board = createEmptyBoard();
  const start = BOARD_SIZE.rows - rows.length;
  for (let i = 0; i < rows.length; i++) {
    const line = rows[i];
    if (line.length !== BOARD_SIZE.cols) {
      throw new Error(`Puzzle row length ${line.length} !== ${BOARD_SIZE.cols}`);
    }
    const r = start + i;
    for (let c = 0; c < BOARD_SIZE.cols; c++) {
      const ch = line[c];
      if (ch === '.' || ch === ' ') {
        board[r][c] = null;
      } else if (ch === 'G') {
        board[r][c] = 'G';
      } else if ('IJLOSTZ'.includes(ch)) {
        board[r][c] = ch as TetrominoType;
      } else {
        throw new Error(`Unknown cell '${ch}' in puzzle row`);
      }
    }
  }
  return board;
}

export function puzzleMatchesClear(
  puzzle: TSpinPuzzle,
  tSpin: TSpinKind,
  linesCleared: number,
): boolean {
  if (linesCleared < puzzle.require.minLines) return false;
  if (puzzle.require.tSpin === 'full-or-mini') {
    return tSpin === 'full' || tSpin === 'mini';
  }
  return tSpin === puzzle.require.tSpin;
}

export function tspinStars(locks: number, cleared: boolean, puzzle: TSpinPuzzle): number {
  if (!cleared) return 0;
  const [s3, s2] = puzzle.starLocks;
  if (locks <= s3) return 3;
  if (locks <= s2) return 2;
  return 1;
}

export interface PracticeMeta {
  cheeseBestStars: number;
  cheeseClears: number;
  /** puzzleId → best stars */
  tspinStars: Record<string, number>;
}

export function emptyPracticeMeta(): PracticeMeta {
  return { cheeseBestStars: 0, cheeseClears: 0, tspinStars: {} };
}

export function loadPracticeMeta(): PracticeMeta {
  try {
    const parsed = JSON.parse(localStorage.getItem(PRACTICE_STORAGE_KEY) || 'null');
    if (!parsed || typeof parsed !== 'object') return emptyPracticeMeta();
    const tspinStars: Record<string, number> = {};
    if (parsed.tspinStars && typeof parsed.tspinStars === 'object') {
      for (const [id, stars] of Object.entries(parsed.tspinStars)) {
        const n = Number(stars);
        if (n >= 1 && n <= 3) tspinStars[id] = n;
      }
    }
    return {
      cheeseBestStars: Math.min(3, Math.max(0, Number(parsed.cheeseBestStars) || 0)),
      cheeseClears: Math.max(0, Number(parsed.cheeseClears) || 0),
      tspinStars,
    };
  } catch {
    return emptyPracticeMeta();
  }
}

export function savePracticeMeta(meta: PracticeMeta): void {
  try {
    localStorage.setItem(PRACTICE_STORAGE_KEY, JSON.stringify(meta));
  } catch {
    /* storage unavailable */
  }
}

export function mergeCheeseResult(meta: PracticeMeta, stars: number, cleared: boolean): PracticeMeta {
  return {
    ...meta,
    cheeseBestStars: Math.max(meta.cheeseBestStars, stars),
    cheeseClears: meta.cheeseClears + (cleared ? 1 : 0),
  };
}

export function mergeTspinResult(meta: PracticeMeta, puzzleId: string, stars: number): PracticeMeta {
  const prev = meta.tspinStars[puzzleId] ?? 0;
  return {
    ...meta,
    tspinStars: { ...meta.tspinStars, [puzzleId]: Math.max(prev, stars) },
  };
}

/** Stable cheese seed for a free practice run (not daily). */
export function cheesePracticeSeed(attempt: number = 0): number {
  return hashString(`tetris-cheese-${attempt}`);
}
