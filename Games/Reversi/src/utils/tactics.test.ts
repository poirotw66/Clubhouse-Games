import { describe, expect, it } from 'vitest';
import { createInitialBoard } from './reversiLogic';
import {
  calculateCascadeWave,
  calculateCornerControl,
  calculateFlipsMap,
  calculateMobility,
  calculateStability,
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

  it('calculates stability telemetry (stable discs, frontier exposure, interior core)', () => {
    const board = createInitialBoard();
    const initialStability = calculateStability(board);
    expect(initialStability.blackStable).toBe(0);
    expect(initialStability.whiteStable).toBe(0);
    expect(initialStability.blackFrontier).toBe(2);
    expect(initialStability.whiteFrontier).toBe(2);
    expect(initialStability.blackInterior).toBe(0);
    expect(initialStability.whiteInterior).toBe(0);
    expect(initialStability.blackFrontierRate).toBe(100);

    // Give black corner (0,0) and a contiguous edge (0,1), (0,2)
    board[0][0] = 'black';
    board[0][1] = 'black';
    board[0][2] = 'black';
    const cornerStability = calculateStability(board);
    expect(cornerStability.blackStable).toBe(3);
    expect(cornerStability.stableSet.has('0,0')).toBe(true);
    expect(cornerStability.stableSet.has('0,1')).toBe(true);
    expect(cornerStability.stableSet.has('0,2')).toBe(true);
  });

  it('calculates domino cascade wave flip ordering and combo titles', () => {
    const board = createInitialBoard();
    // Move at (2, 3) flips (3, 3)
    const wave = calculateCascadeWave(board, 2, 3, 'black');
    expect(wave.totalFlips).toBe(1);
    expect(wave.items.length).toBe(1);
    expect(wave.items[0]).toEqual({
      r: 3,
      c: 3,
      key: '3,3',
      dist: 1,
      stepIndex: 0,
      delayMs: 0,
      dr: 1,
      dc: 0,
    });
    expect(wave.isCorner).toBe(false);
    expect(wave.comboTitle).toBeUndefined();
  });

  it('detects corner moves and multi-flip combo titles in cascade waves', () => {
    const board = createInitialBoard();
    // Simulate a corner capture setup: place white along col 0, and black at (7, 0)
    board[1][0] = 'white';
    board[2][0] = 'white';
    board[3][0] = 'white';
    board[4][0] = 'white';
    board[5][0] = 'white';
    board[6][0] = 'black';

    // Black placing at corner (0, 0)
    const cornerWave = calculateCascadeWave(board, 0, 0, 'black');
    expect(cornerWave.isCorner).toBe(true);
    expect(cornerWave.totalFlips).toBe(5);
    expect(cornerWave.comboTitle).toBe('🔥 5 連波大連鎖！');
    expect(cornerWave.maxStep).toBe(4);
    expect(cornerWave.itemsByStep.length).toBe(5);
  });
});
