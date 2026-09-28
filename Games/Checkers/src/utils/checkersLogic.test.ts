import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applyMove,
  countPieces,
  createInitialBoard,
  getLegalMoves,
  getLegalMovesFrom,
  getWinner,
  isDarkSquare,
  pickBotMove,
  type Board,
  type Move,
  type Piece,
} from './checkersLogic';

function emptyBoard(): Board {
  return Array.from({ length: 8 }, () => Array(8).fill(null));
}

function place(board: Board, cells: Array<[number, number, Piece]>): Board {
  const next = board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
  for (const [r, c, piece] of cells) next[r][c] = piece;
  return next;
}

function moveKey(m: Move): string {
  return `${m.from[0]},${m.from[1]}→${m.path.map(([r, c]) => `${r},${c}`).join('|')}`;
}

function sameMoveSet(a: Move[], b: Move[]): boolean {
  if (a.length !== b.length) return false;
  const keys = new Set(a.map(moveKey));
  return b.every((m) => keys.has(moveKey(m)));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createInitialBoard', () => {
  it('starts 12/12 on dark squares only', () => {
    const board = createInitialBoard();
    expect(countPieces(board)).toEqual({ black: 12, white: 12 });
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (board[r][c]) expect(isDarkSquare(r, c)).toBe(true);
      }
    }
  });
});

describe('opening legality', () => {
  it('gives black seven quiet forward steps from row 5', () => {
    const board = createInitialBoard();
    const moves = getLegalMoves(board, 'black');
    expect(moves).toHaveLength(7);
    expect(moves.every((m) => m.path.length === 2)).toBe(true);
    for (const m of moves) {
      expect(m.from[0]).toBe(5);
      expect(m.path[1][0]).toBe(4);
    }
  });

  it('returns a stable opening move set', () => {
    const a = getLegalMoves(createInitialBoard(), 'black');
    const b = getLegalMoves(createInitialBoard(), 'black');
    expect(sameMoveSet(a, b)).toBe(true);
  });
});

describe('forced capture / multi-jump', () => {
  it('forces the only available single jump and clears the jumped piece', () => {
    const board = place(emptyBoard(), [
      [5, 2, { color: 'black', king: false }],
      [4, 3, { color: 'white', king: false }],
    ]);
    const moves = getLegalMoves(board, 'black');
    expect(moves).toHaveLength(1);
    expect(moves[0].from).toEqual([5, 2]);
    expect(moves[0].path).toEqual([
      [5, 2],
      [3, 4],
    ]);

    const after = applyMove(board, moves[0]);
    expect(after[5][2]).toBeNull();
    expect(after[4][3]).toBeNull();
    expect(after[3][4]).toEqual({ color: 'black', king: false });
    expect(countPieces(after)).toEqual({ black: 1, white: 0 });
  });

  it('finds a double-jump sequence and continuation hops after a partial apply', () => {
    const board = place(emptyBoard(), [
      [5, 2, { color: 'black', king: false }],
      [4, 3, { color: 'white', king: false }],
      [2, 5, { color: 'white', king: false }],
    ]);
    const first = getLegalMoves(board, 'black');
    expect(first.length).toBeGreaterThanOrEqual(1);
    const long = first.reduce((a, b) => (a.path.length >= b.path.length ? a : b));
    expect(long.path).toHaveLength(3);

    const midBoard = applyMove(board, {
      from: long.from,
      path: long.path.slice(0, 2),
    });
    const [midR, midC] = long.path[1];
    const cont = getLegalMovesFrom(midBoard, 'black', midR, midC);
    expect(cont.length).toBeGreaterThanOrEqual(1);
    expect(
      cont.every((m) => m.path.length >= 2 && Math.abs(m.path[1][0] - m.from[0]) === 2),
    ).toBe(true);
  });

  it('crowns a man that lands on the last rank', () => {
    const board = place(emptyBoard(), [[1, 2, { color: 'black', king: false }]]);
    const move: Move = { from: [1, 2], path: [[1, 2], [0, 3]] };
    const after = applyMove(board, move);
    expect(after[0][3]).toEqual({ color: 'black', king: true });
  });
});

describe('terminal phase', () => {
  it('awards the win when the opponent has no pieces', () => {
    const board = place(emptyBoard(), [[7, 0, { color: 'black', king: false }]]);
    expect(getWinner(board, 'white')).toBe('black');
  });

  it('awards the win when the side to move has pieces but no legal moves', () => {
    const board = place(emptyBoard(), [
      [7, 0, { color: 'white', king: false }],
      [5, 2, { color: 'black', king: false }],
    ]);
    expect(getLegalMoves(board, 'white')).toEqual([]);
    expect(getWinner(board, 'white')).toBe('black');
    expect(getWinner(board, 'black')).toBeNull();
  });
});

describe('pickBotMove (adversarial bot)', () => {
  it('returns null when the side to move has no legal plays', () => {
    const board = place(emptyBoard(), [[7, 0, { color: 'white', king: false }]]);
    expect(pickBotMove(board, 'white', null, 'hard')).toBeNull();
  });

  it('returns the only legal move without searching', () => {
    const board = place(emptyBoard(), [
      [5, 2, { color: 'black', king: false }],
      [4, 3, { color: 'white', king: false }],
    ]);
    const only = getLegalMoves(board, 'black');
    expect(only).toHaveLength(1);
    expect(pickBotMove(board, 'black', null, 'easy')).toEqual(only[0]);
  });

  it('prefers the longest capture chain when captures are forced', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const board = place(emptyBoard(), [
      [5, 2, { color: 'black', king: false }],
      [4, 3, { color: 'white', king: false }],
      [2, 5, { color: 'white', king: false }],
      // Alternate single-jump target that is shorter if chosen alone.
      [4, 1, { color: 'white', king: false }],
    ]);
    const picked = pickBotMove(board, 'black', null, 'hard');
    expect(picked).not.toBeNull();
    expect(picked!.path.length).toBe(3);
  });
});
