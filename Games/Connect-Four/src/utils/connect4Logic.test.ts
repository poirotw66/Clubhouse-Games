import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  COLS,
  ROWS,
  createInitialBoard,
  dropPiece,
  getDropRow,
  getLegalColumns,
  getWinningCells,
  hasWonAt,
  isBoardFull,
  pickBotColumn,
  getDifficultyConfig,
  DIFFICULTY_BLURBS,
  type Board,
  type PieceColor,
} from './connect4Logic';

function fillColumn(board: Board, col: number, colors: PieceColor[]): Board {
  let next = board;
  for (const color of colors) {
    const dropped = dropPiece(next, col, color);
    if (!dropped) throw new Error(`column ${col} full while filling`);
    next = dropped;
  }
  return next;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('board setup / gravity', () => {
  it('starts empty with every column legal and drops to the bottom row', () => {
    const board = createInitialBoard();
    expect(board).toHaveLength(ROWS);
    expect(board[0]).toHaveLength(COLS);
    expect(getLegalColumns(board)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    for (let c = 0; c < COLS; c++) {
      expect(getDropRow(board, c)).toBe(ROWS - 1);
    }
  });

  it('stacks upward and rejects a full column', () => {
    let board = createInitialBoard();
    for (let i = 0; i < ROWS; i++) {
      expect(getDropRow(board, 0)).toBe(ROWS - 1 - i);
      const next = dropPiece(board, 0, i % 2 === 0 ? 'red' : 'yellow');
      expect(next).not.toBeNull();
      board = next!;
    }
    expect(getDropRow(board, 0)).toBeNull();
    expect(getLegalColumns(board)).not.toContain(0);
    expect(dropPiece(board, 0, 'red')).toBeNull();
  });
});

describe('win detection', () => {
  it('detects a horizontal four-in-a-row through the last piece', () => {
    let board = createInitialBoard();
    for (const c of [0, 1, 2, 3]) {
      board = dropPiece(board, c, 'red')!;
    }
    const row = ROWS - 1;
    expect(hasWonAt(board, row, 3, 'red')).toBe(true);
    expect(hasWonAt(board, row, 3, 'yellow')).toBe(false);
    expect(getWinningCells(board)).toEqual(
      new Set(['5,0', '5,1', '5,2', '5,3']),
    );
  });

  it('detects a vertical four-in-a-row', () => {
    let board = createInitialBoard();
    for (let i = 0; i < 4; i++) {
      board = dropPiece(board, 2, 'yellow')!;
    }
    expect(hasWonAt(board, ROWS - 4, 2, 'yellow')).toBe(true);
    expect(getWinningCells(board)).toEqual(
      new Set(['5,2', '4,2', '3,2', '2,2']),
    );
  });

  it('detects an ascending diagonal four-in-a-row', () => {
    let board = createInitialBoard();
    // Stairs so yellow lands on (5,0)(4,1)(3,2)(2,3).
    board = dropPiece(board, 0, 'yellow')!;
    board = fillColumn(board, 1, ['red', 'yellow']);
    board = fillColumn(board, 2, ['red', 'red', 'yellow']);
    board = fillColumn(board, 3, ['red', 'red', 'red', 'yellow']);
    expect(hasWonAt(board, 2, 3, 'yellow')).toBe(true);
  });

  it('reports a filled board with no legal columns', () => {
    const board = createInitialBoard().map((row, r) =>
      row.map((_, c) => ((r + c) % 2 === 0 ? 'red' : 'yellow')),
    );
    expect(isBoardFull(board)).toBe(true);
    expect(getLegalColumns(board)).toEqual([]);
  });
});

describe('pickBotColumn (adversarial bot)', () => {
  it('returns null on a full board', () => {
    const board = createInitialBoard().map((row, r) =>
      row.map((_, c) => ((r + c) % 2 === 0 ? 'red' : 'yellow')),
    );
    expect(pickBotColumn(board, 'red', 'hard')).toBeNull();
  });

  it('returns the only remaining legal column', () => {
    let board = createInitialBoard();
    for (let c = 0; c < COLS; c++) {
      if (c === 4) continue;
      board = fillColumn(board, c, ['red', 'yellow', 'red', 'yellow', 'red', 'yellow']);
    }
    expect(getLegalColumns(board)).toEqual([4]);
    expect(pickBotColumn(board, 'red', 'easy')).toBe(4);
  });

  it('hard takes an immediate winning drop', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    let board = createInitialBoard();
    // Red has three on the bottom; column 3 completes the win.
    for (const c of [0, 1, 2]) {
      board = dropPiece(board, c, 'red')!;
    }
    // Pad so yellow is not about to win elsewhere and red to move.
    board = dropPiece(board, 6, 'yellow')!;
    board = dropPiece(board, 6, 'yellow')!;
    board = dropPiece(board, 5, 'yellow')!;
    expect(pickBotColumn(board, 'red', 'hard')).toBe(3);
  });

  it('hard blocks an opponent one-move win', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    let board = createInitialBoard();
    // Yellow threatens columns 0-2 on the bottom; red must plug column 3.
    for (const c of [0, 1, 2]) {
      board = dropPiece(board, c, 'yellow')!;
    }
    board = dropPiece(board, 5, 'red')!;
    board = dropPiece(board, 5, 'red')!;
    expect(pickBotColumn(board, 'red', 'hard')).toBe(3);
  });
});

describe('difficulty tiers', () => {
  it('spreads depth and blunderRate across easy < normal < hard discipline', () => {
    const easy = getDifficultyConfig('easy');
    const normal = getDifficultyConfig('normal');
    const hard = getDifficultyConfig('hard');
    expect(easy.depth).toBeLessThan(normal.depth);
    expect(normal.depth).toBeLessThan(hard.depth);
    expect(easy.blunderRate).toBeGreaterThan(normal.blunderRate);
    expect(normal.blunderRate).toBeGreaterThan(hard.blunderRate);
    expect(hard.blunderRate).toBe(0);
  });

  it('keeps three distinct blurbs', () => {
    const blurbs = (['easy', 'normal', 'hard'] as const).map((id) => DIFFICULTY_BLURBS[id]);
    expect(new Set(blurbs).size).toBe(3);
    for (const blurb of blurbs) expect(blurb.trim().length).toBeGreaterThan(0);
  });

  it('easy can blunder past a winning drop; hard never does', () => {
    let board = createInitialBoard();
    for (const c of [0, 1, 2]) {
      board = dropPiece(board, c, 'red')!;
    }
    board = dropPiece(board, 6, 'yellow')!;
    board = dropPiece(board, 6, 'yellow')!;
    board = dropPiece(board, 5, 'yellow')!;

    // Force a blunder, then pick the first legal column (0) — not the win at 3.
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(pickBotColumn(board, 'red', 'easy')).toBe(0);

    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(pickBotColumn(board, 'red', 'hard')).toBe(3);
  });

  it('easy still takes an immediate win when it does not blunder', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    let board = createInitialBoard();
    for (const c of [0, 1, 2]) {
      board = dropPiece(board, c, 'red')!;
    }
    board = dropPiece(board, 6, 'yellow')!;
    board = dropPiece(board, 6, 'yellow')!;
    board = dropPiece(board, 5, 'yellow')!;
    expect(pickBotColumn(board, 'red', 'easy')).toBe(3);
  });
});
