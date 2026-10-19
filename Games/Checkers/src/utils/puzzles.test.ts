import { describe, expect, it } from 'vitest';
import { PUZZLES, verifyAllPuzzles } from './puzzles';
import { RULESETS } from './rules';
import {
  createInitialBoard,
  countPieces,
  getLegalMoves,
  isCaptureMove,
  placePieces,
} from './checkersLogic';
import { OPPONENTS, isOpponentUnlocked } from './opponents';
import { createMatch, applyGameResult } from './match';
import { getHint } from './hints';
import { buildReview } from './review';

describe('puzzle pack', () => {
  it('has ten solver-verified win-in-N positions', () => {
    expect(PUZZLES).toHaveLength(10);
    expect(verifyAllPuzzles()).toEqual([]);
  });
});

describe('international rules', () => {
  it('starts 20/20 on a 10×10 board', () => {
    const board = createInitialBoard('international');
    expect(board.length).toBe(10);
    expect(countPieces(board)).toEqual({ black: 20, white: 20 });
  });

  it('allows men to capture backward', () => {
    const board = placePieces(10, [
      [3, 4, { color: 'black', king: false }],
      [4, 5, { color: 'white', king: false }],
    ]);
    const moves = getLegalMoves(board, 'black', 'international');
    expect(moves.some(isCaptureMove)).toBe(true);
  });

  it('flying kings can long-capture', () => {
    const board = placePieces(10, [
      [5, 4, { color: 'black', king: true }],
      [8, 1, { color: 'white', king: false }],
    ]);
    const moves = getLegalMoves(board, 'black', 'international');
    const fly = moves.filter(isCaptureMove);
    expect(fly.length).toBeGreaterThan(0);
    expect(fly.some((m) => Math.abs(m.path[1][0] - m.path[0][0]) > 2)).toBe(true);
  });

  it('majority capture keeps only max-length sequences', () => {
    const board = placePieces(10, [
      [5, 2, { color: 'black', king: false }],
      [4, 3, { color: 'white', king: false }],
      [2, 5, { color: 'white', king: false }],
    ]);
    const moves = getLegalMoves(board, 'black', 'international');
    const caps = moves.filter(isCaptureMove);
    expect(caps.length).toBeGreaterThan(0);
    const max = Math.max(...caps.map((m) => m.path.length));
    expect(caps.every((m) => m.path.length === max)).toBe(true);
    expect(RULESETS.international.majorityCapture).toBe(true);
  });
});

describe('roster ladder', () => {
  it('unlocks in chain order', () => {
    expect(isOpponentUnlocked('rookie', [])).toBe(true);
    expect(isOpponentUnlocked('rusher', [])).toBe(false);
    expect(isOpponentUnlocked('rusher', ['rookie'])).toBe(true);
    expect(OPPONENTS).toHaveLength(5);
    const styles = OPPONENTS.map((o) => JSON.stringify(o.style));
    expect(new Set(styles).size).toBe(5);
  });
});

describe('series match', () => {
  it('ends at target wins', () => {
    let m = createMatch(2);
    m = applyGameResult(m, 'a');
    expect(m.matchOver).toBe(false);
    m = applyGameResult(m, 'a');
    expect(m.matchOver).toBe(true);
    expect(m.matchWinner).toBe('a');
  });
});

describe('hints and review', () => {
  it('returns a reason with the hint move', () => {
    const board = createInitialBoard('american');
    const hint = getHint(board, 'black', null, 'american');
    expect(hint).not.toBeNull();
    expect(hint!.reason.trim().length).toBeGreaterThan(0);
  });

  it('builds review tags for a capture ply', () => {
    const board = placePieces(8, [
      [5, 2, { color: 'black', king: false }],
      [4, 3, { color: 'white', king: false }],
    ]);
    const move = getLegalMoves(board, 'black', 'american')[0];
    const review = buildReview([{ color: 'black', move, boardBefore: board }], 'american');
    expect(review).toHaveLength(1);
    expect(review[0].note.length).toBeGreaterThan(0);
  });
});
