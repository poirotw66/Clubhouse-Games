import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applyMove,
  countPieces,
  createInitialBoard,
  DIFFICULTY_BLURBS,
  getBestMove,
  getDifficultyConfig,
  getFlips,
  getLegalMoves,
  getWinner,
  isLegalMove,
  type Board,
  type Cell,
  type Piece,
} from './reversiLogic';

function emptyBoard(): Board {
  return Array.from({ length: 8 }, () => Array<Cell>(8).fill(null));
}

function place(board: Board, cells: Array<[number, number, Piece]>): Board {
  const next = board.map((row) => [...row]);
  for (const [r, c, color] of cells) next[r][c] = color;
  return next;
}

function sameCells(a: [number, number][], b: [number, number][]): boolean {
  if (a.length !== b.length) return false;
  const keys = new Set(a.map(([r, c]) => `${r},${c}`));
  return b.every(([r, c]) => keys.has(`${r},${c}`));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createInitialBoard', () => {
  it('starts with the classic 2/2 center diamond', () => {
    const board = createInitialBoard();
    expect(countPieces(board)).toEqual({ black: 2, white: 2 });
    expect(board[3][3]).toBe('white');
    expect(board[3][4]).toBe('black');
    expect(board[4][3]).toBe('black');
    expect(board[4][4]).toBe('white');
  });
});

describe('opening legality', () => {
  it('gives black the four classic opening squares', () => {
    const board = createInitialBoard();
    expect(
      sameCells(getLegalMoves(board, 'black'), [
        [2, 3],
        [3, 2],
        [4, 5],
        [5, 4],
      ]),
    ).toBe(true);
  });

  it('gives white the four symmetric replies on the opening board', () => {
    const board = createInitialBoard();
    expect(
      sameCells(getLegalMoves(board, 'white'), [
        [2, 4],
        [3, 5],
        [4, 2],
        [5, 3],
      ]),
    ).toBe(true);
  });

  it('rejects empty corners and occupied cells on move 1', () => {
    const board = createInitialBoard();
    expect(isLegalMove(board, 0, 0, 'black')).toBe(false);
    expect(getFlips(board, 0, 0, 'black')).toEqual([]);
    expect(isLegalMove(board, 3, 4, 'white')).toBe(false);
  });
});

describe('applyMove / flips', () => {
  it('flips the single bridging disc on the opening (2,3) play', () => {
    const board = createInitialBoard();
    expect(getFlips(board, 2, 3, 'black')).toEqual([[3, 3]]);

    const after = applyMove(board, 2, 3, 'black');
    expect(after[2][3]).toBe('black');
    expect(after[3][3]).toBe('black');
    expect(after[3][4]).toBe('black');
    expect(after[4][3]).toBe('black');
    expect(after[4][4]).toBe('white');
    expect(countPieces(after)).toEqual({ black: 4, white: 1 });
  });

  it('flips through multiple directions from one placement', () => {
    const board = place(emptyBoard(), [
      [2, 4, 'black'],
      [3, 4, 'white'],
      [4, 2, 'black'],
      [4, 3, 'white'],
    ]);
    expect(isLegalMove(board, 4, 4, 'black')).toBe(true);
    expect(
      sameCells(getFlips(board, 4, 4, 'black'), [
        [3, 4],
        [4, 3],
      ]),
    ).toBe(true);

    const after = applyMove(board, 4, 4, 'black');
    expect(after[4][4]).toBe('black');
    expect(after[3][4]).toBe('black');
    expect(after[4][3]).toBe('black');
  });
});

describe('pass / terminal phase', () => {
  it('reports no legal moves when a side cannot flip anything', () => {
    const board = place(emptyBoard(), [
      [3, 3, 'white'],
      [3, 4, 'white'],
      [4, 3, 'white'],
      [4, 4, 'white'],
    ]);
    expect(getLegalMoves(board, 'black')).toEqual([]);
    expect(getLegalMoves(board, 'white')).toEqual([]);
  });

  it('declares the majority side the winner', () => {
    const board = place(emptyBoard(), [
      [0, 0, 'black'],
      [0, 1, 'black'],
      [0, 2, 'white'],
    ]);
    expect(getWinner(board)).toBe('black');
  });

  it('declares a draw on equal disc counts', () => {
    const board = place(emptyBoard(), [
      [0, 0, 'black'],
      [0, 1, 'white'],
    ]);
    expect(getWinner(board)).toBe('draw');
  });
});

describe('getBestMove (adversarial bot)', () => {
  it('returns null when the side to move has no legal plays', () => {
    const board = place(emptyBoard(), [
      [3, 3, 'white'],
      [3, 4, 'white'],
      [4, 3, 'white'],
      [4, 4, 'white'],
    ]);
    expect(getBestMove(board, 'black', 'hard')).toBeNull();
  });

  it('returns the only legal move without searching', () => {
    const board = place(emptyBoard(), [
      [0, 0, 'black'],
      [0, 1, 'white'],
    ]);
    expect(getLegalMoves(board, 'black')).toEqual([[0, 2]]);
    expect(getBestMove(board, 'black', 'easy')).toEqual([0, 2]);
  });

  it('hard prefers taking an available corner over an interior square', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const board = place(emptyBoard(), [
      [0, 1, 'black'],
      [0, 2, 'black'],
      [0, 3, 'white'],
      [1, 1, 'black'],
      [2, 2, 'white'],
    ]);
    expect(isLegalMove(board, 0, 0, 'white')).toBe(true);
    expect(getBestMove(board, 'white', 'hard')).toEqual([0, 0]);
  });
});

describe('difficulty tiers', () => {
  it('spreads depth, blunderRate, exactEmpties, and mobility across easy < normal < hard', () => {
    const easy = getDifficultyConfig('easy');
    const normal = getDifficultyConfig('normal');
    const hard = getDifficultyConfig('hard');
    expect(easy.depth).toBeLessThan(normal.depth);
    expect(normal.depth).toBeLessThan(hard.depth);
    expect(easy.blunderRate).toBeGreaterThan(normal.blunderRate);
    expect(normal.blunderRate).toBeGreaterThan(hard.blunderRate);
    expect(hard.blunderRate).toBe(0);
    expect(easy.exactEmpties).toBeLessThan(normal.exactEmpties);
    expect(normal.exactEmpties).toBeLessThan(hard.exactEmpties);
    expect(easy.mobilityWeight).toBeLessThan(normal.mobilityWeight);
    expect(normal.mobilityWeight).toBeLessThan(hard.mobilityWeight);
  });

  it('keeps three distinct blurbs', () => {
    const blurbs = (['easy', 'normal', 'hard'] as const).map((id) => DIFFICULTY_BLURBS[id]);
    expect(new Set(blurbs).size).toBe(3);
    for (const blurb of blurbs) expect(blurb.trim().length).toBeGreaterThan(0);
  });

  it('easy can blunder past a free corner; hard never does', () => {
    // Corner is legal and best, but not the only move — and board-scan order
    // lists (0,0) first, so the blunder roll must land on a later index.
    const board = place(emptyBoard(), [
      [0, 1, 'black'],
      [0, 2, 'black'],
      [0, 3, 'white'],
      [1, 0, 'black'],
      [1, 1, 'black'],
      [2, 0, 'white'],
      [2, 1, 'white'],
      [3, 3, 'black'],
      [3, 4, 'white'],
      [4, 4, 'black'],
    ]);
    const legal = getLegalMoves(board, 'white');
    expect(legal.length).toBeGreaterThan(1);
    expect(legal[0]).toEqual([0, 0]);

    // 0.34 < easy.blunderRate (0.45) and floor(0.34 * 3) === 1 → not the corner.
    vi.spyOn(Math, 'random').mockReturnValue(0.34);
    expect(getBestMove(board, 'white', 'easy')).toEqual(legal[1]);
    expect(getBestMove(board, 'white', 'easy')).not.toEqual([0, 0]);

    vi.spyOn(Math, 'random').mockReturnValue(0.34);
    expect(getBestMove(board, 'white', 'hard')).toEqual([0, 0]);
  });

  it('easy still takes a free corner when it does not blunder', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const board = place(emptyBoard(), [
      [0, 1, 'black'],
      [0, 2, 'black'],
      [0, 3, 'white'],
      [1, 0, 'black'],
      [1, 1, 'black'],
      [2, 0, 'white'],
      [2, 1, 'white'],
      [3, 3, 'black'],
      [3, 4, 'white'],
      [4, 4, 'black'],
    ]);
    expect(getBestMove(board, 'white', 'easy')).toEqual([0, 0]);
  });
});
