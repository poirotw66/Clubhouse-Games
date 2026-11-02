import { describe, expect, it } from 'vitest';
import { createInitialBoard } from './reversiLogic';
import {
  calculateCornerControl,
  calculateFlipsMap,
  calculateMobility,
  getAssociatedCorner,
  getCellRiskType,
  getGameStage,
  toAlgebraic,
} from './tactics';

describe('tactics utility', () => {
  it('converts row/col indices to algebraic notation correctly', () => {
    expect(toAlgebraic(0, 0)).toBe('A1');
    expect(toAlgebraic(0, 7)).toBe('H1');
    expect(toAlgebraic(7, 0)).toBe('A8');
    expect(toAlgebraic(7, 7)).toBe('H8');
    expect(toAlgebraic(3, 4)).toBe('E4');
    expect(toAlgebraic(4, 3)).toBe('D5');
  });

  it('associates X-squares and C-squares with their corresponding corners', () => {
    expect(getAssociatedCorner(1, 1)).toEqual([0, 0]);
    expect(getAssociatedCorner(0, 1)).toEqual([0, 0]);
    expect(getAssociatedCorner(1, 0)).toEqual([0, 0]);

    expect(getAssociatedCorner(1, 6)).toEqual([0, 7]);
    expect(getAssociatedCorner(0, 6)).toEqual([0, 7]);
    expect(getAssociatedCorner(1, 7)).toEqual([0, 7]);

    expect(getAssociatedCorner(6, 1)).toEqual([7, 0]);
    expect(getAssociatedCorner(6, 6)).toEqual([7, 7]);
    expect(getAssociatedCorner(3, 3)).toBeNull();
  });

  it('identifies danger zones and recognizes neutralized squares when corner is taken', () => {
    const board = createInitialBoard();
    // Initially corners are empty
    expect(getCellRiskType(board, 0, 0)).toBe('corner');
    expect(getCellRiskType(board, 1, 1)).toBe('x-square');
    expect(getCellRiskType(board, 0, 1)).toBe('c-square');
    expect(getCellRiskType(board, 3, 3)).toBe('safe');

    // If corner (0,0) is claimed by black, (1,1) is no longer a risk
    board[0][0] = 'black';
    expect(getCellRiskType(board, 1, 1)).toBe('safe');
    expect(getCellRiskType(board, 0, 1)).toBe('safe');
  });

  it('evaluates corner control stats accurately', () => {
    const board = createInitialBoard();
    const initialCorners = calculateCornerControl(board);
    expect(initialCorners.black).toBe(0);
    expect(initialCorners.white).toBe(0);
    expect(initialCorners.empty).toBe(4);

    board[0][0] = 'black';
    board[7][7] = 'white';
    board[0][7] = 'black';

    const updatedCorners = calculateCornerControl(board);
    expect(updatedCorners.black).toBe(2);
    expect(updatedCorners.white).toBe(1);
    expect(updatedCorners.empty).toBe(1);
    expect(updatedCorners.tl).toBe('black');
    expect(updatedCorners.br).toBe('white');
  });

  it('computes mobility metrics and detects squeeze and advantage', () => {
    const board = createInitialBoard();
    const mob = calculateMobility(board, 'black');
    expect(mob.currentLegalCount).toBe(4);
    expect(mob.opponentLegalCount).toBe(4);
    expect(mob.pressure).toBe('balanced');
  });

  it('calculates flips map for initial legal moves', () => {
    const board = createInitialBoard();
    const flips = calculateFlipsMap(board, 'black');
    expect(flips.size).toBe(4);
    // In initial position, every black move flips exactly 1 piece
    for (const count of flips.values()) {
      expect(count).toBe(1);
    }
  });

  it('determines the game stage correctly based on empty squares', () => {
    const board = createInitialBoard();
    expect(getGameStage(board)).toBe('opening');
  });
});
