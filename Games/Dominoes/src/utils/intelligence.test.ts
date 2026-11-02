import { describe, expect, it } from 'vitest';
import { emptyBoard, placeFirstTile, placeTile } from './board';
import { createInitialState } from './dominoesLogic';
import {
  analyzeBlockadeThreat,
  getOpponentDossiers,
  getPipSuitAnalysis,
  getTileMatrix,
  isTileOnBoard,
  simulateAllFivesScores,
} from './intelligence';
import type { Tile } from './types';

function makeTile(id: number, left: number, right: number): Tile {
  return { id, left, right };
}

describe('intelligence utilities', () => {
  describe('isTileOnBoard and getTileMatrix', () => {
    it('accurately identifies tiles on hub and arms', () => {
      let board = emptyBoard();
      const t1 = makeTile(0, 3, 3);
      const t2 = makeTile(1, 3, 5);
      board = placeFirstTile(board, t1, 'fives');
      expect(isTileOnBoard(board, 0)).toBe(true);
      expect(isTileOnBoard(board, 1)).toBe(false);

      const nextBoard = placeTile(board, t2, 'right', 'fives');
      expect(nextBoard).not.toBeNull();
      if (nextBoard) {
        expect(isTileOnBoard(nextBoard, 1)).toBe(true);
      }
    });

    it('builds a 28-tile matrix partitioning tiles into board, hand, and unseen', () => {
      const state = createInitialState('draw', { playerCount: 2 });
      const matrix = getTileMatrix(state, 0);

      expect(matrix).toHaveLength(28);
      const boardCount = matrix.filter((m) => m.status === 'board').length;
      const handCount = matrix.filter((m) => m.status === 'hand').length;
      const unseenCount = matrix.filter((m) => m.status === 'unseen').length;

      // Board has the opening tile (1)
      expect(boardCount).toBe(1);
      // Hand has remaining hand tiles
      expect(handCount).toBe(state.hands[0].length);
      // Unseen includes opponent's hand and boneyard
      expect(unseenCount).toBe(28 - 1 - handCount);
    });
  });

  describe('getPipSuitAnalysis', () => {
    it('summarizes 7 tiles for every pip 0 through 6', () => {
      const state = createInitialState('fives', { playerCount: 2 });
      const matrix = getTileMatrix(state, 0);
      const suitAnalysis = getPipSuitAnalysis(matrix);

      expect(suitAnalysis).toHaveLength(7);
      for (let pip = 0; pip <= 6; pip++) {
        const item = suitAnalysis[pip];
        expect(item.pip).toBe(pip);
        expect(item.total).toBe(7);
        expect(item.onBoard + item.inHand + item.unseen).toBe(7);
        expect(item.isDead).toBe(item.unseen === 0 && item.inHand === 0);
      }
    });
  });

  describe('simulateAllFivesScores', () => {
    it('returns empty array when board has no hub', () => {
      const board = emptyBoard();
      const hand = [makeTile(0, 5, 5)];
      expect(simulateAllFivesScores(hand, board)).toEqual([]);
    });

    it('simulates score of legal plays correctly and sorts by score desc', () => {
      let board = emptyBoard();
      // Hub is [5|5] (spinner active in fives).
      board = placeFirstTile(board, makeTile(0, 5, 5), 'fives');

      // Hand has [5|0] which would make ends [0] and [5|5] -> sum 10 -> score 10!
      // And [5|3] which would make ends [3] and [5|5] -> sum 13 -> score 0.
      const hand = [makeTile(1, 5, 0), makeTile(2, 5, 3)];

      const sims = simulateAllFivesScores(hand, board);
      expect(sims.length).toBeGreaterThan(0);
      const topMove = sims[0];
      expect(topMove.tileId).toBe(1);
      expect(topMove.score).toBe(10);
      expect(topMove.isScoring).toBe(true);
    });
  });

  describe('analyzeBlockadeThreat', () => {
    it('calculates open end deadness and hand sum comparisons', () => {
      const state = createInitialState('block', { playerCount: 2 });
      const threat = analyzeBlockadeThreat(state, 0);

      expect(threat.openEnds.length).toBeGreaterThan(0);
      expect(threat.playerHandSum).toBeGreaterThanOrEqual(0);
      expect(threat.estimatedOppHandSum).toBeGreaterThanOrEqual(0);
      expect(typeof threat.isLocked).toBe('boolean');
      expect(typeof threat.favorableBlock).toBe('boolean');
    });
  });

  describe('getOpponentDossiers', () => {
    it('creates dossiers for opponent seats with tactical tips', () => {
      const state = createInitialState('fives', { playerCount: 2 });
      // Simulate opponent having a suspected lack
      state.suspectedLack[1] = [4, 6];

      const dossiers = getOpponentDossiers(state, 0, 'bot');
      expect(dossiers).toHaveLength(1);
      const dossier = dossiers[0];
      expect(dossier.seat).toBe(1);
      expect(dossier.suspectedLacks).toEqual([4, 6]);
      expect(dossier.lackExplanations[0]).toContain('4、6');
      expect(dossier.tacticalTip).toContain('4 或 6');
    });

    it('creates multiple dossiers in 4-seat partners mode', () => {
      const state = createInitialState('fives', { playerCount: 4 });
      const dossiers = getOpponentDossiers(state, 0, 'partners');
      // Seat 0 opponents are seats 1 and 3
      expect(dossiers).toHaveLength(2);
      expect(dossiers[0].seat).toBe(1);
      expect(dossiers[1].seat).toBe(3);
    });
  });
});
