import { describe, expect, it } from 'vitest';
import {
  emptyBoard,
  getChainEnds,
  getEndPip,
  getOpenEndCounts,
  getPlayableEnds,
  isDouble,
  placeFirstTile,
  placeTile,
  scoreOpenEnds,
  sumOpenEnds,
} from '../utils/board';
import {
  advanceMatchRound,
  applyRoundToMatch,
  canPlay,
  createInitialState,
  createMatchState,
  createSet,
  drawTiles,
  getPlayableTiles,
  getValidMoves,
  handSum,
  pass,
  pickBotMove,
  playTile,
  remainingPipCounts,
  roundEndPoints,
  roundToNearestFive,
  teamHandScores,
  teamHandSum,
  teamOf,
  tileSum,
  type DominoesState,
  type Tile,
} from '../utils/dominoesLogic';
import {
  analyzeBlockadeThreat,
  calculateOpponentLackProbabilities,
  simulateAllFivesScores,
} from '../utils/intelligence';

function makeTile(id: number, left: number, right: number): Tile {
  return { id, left, right };
}

function makeState(
  overrides: Partial<DominoesState> &
    Pick<DominoesState, 'hands' | 'board' | 'ruleVariant'>,
): DominoesState {
  return {
    currentPlayer: 0,
    playerCount: 2,
    boneyard: [],
    phase: 'playing',
    winner: null,
    winningTeam: null,
    roundEndReason: null,
    handScores: [0, 0],
    lastPlayScore: 0,
    lastOpenSum: 0,
    suspectedLack: [[], []],
    ...overrides,
  };
}

describe('Dominoes Advanced Test Suite', () => {
  describe('Tile arithmetic, team mappings, & deal invariants', () => {
    it('verifies tile sum, hand sum, and double predicate', () => {
      const t1 = makeTile(1, 6, 6);
      const t2 = makeTile(2, 5, 0);
      const t3 = makeTile(3, 4, 3);

      expect(isDouble(t1)).toBe(true);
      expect(isDouble(t2)).toBe(false);
      expect(isDouble(t3)).toBe(false);

      expect(tileSum(t1)).toBe(12);
      expect(tileSum(t2)).toBe(5);
      expect(tileSum(t3)).toBe(7);

      expect(handSum([t1, t2, t3])).toBe(24);
      expect(handSum([])).toBe(0);
    });

    it('maps seats to teams correctly for 2-player and 4-player games', () => {
      // 2 players: seat equals team
      expect(teamOf(0, 2)).toBe(0);
      expect(teamOf(1, 2)).toBe(1);

      // 4 players (partners): even seats team 0, odd seats team 1
      expect(teamOf(0, 4)).toBe(0);
      expect(teamOf(1, 4)).toBe(1);
      expect(teamOf(2, 4)).toBe(0);
      expect(teamOf(3, 4)).toBe(1);

      // Aggregates team hand scores
      const scores4 = [10, 15, 20, 5];
      expect(teamHandScores(scores4, 4)).toEqual([30, 20]);
      const scores2 = [25, 40];
      expect(teamHandScores(scores2, 2)).toEqual([25, 40]);
    });

    it('creates initial state dealing correct hand sizes and opening tile', () => {
      // 2 players: 7 tiles each, 28 - 14 = 14 tiles minus 1 opening tile = 13 boneyard
      const state2p = createInitialState('draw', { playerCount: 2 });
      expect(state2p.playerCount).toBe(2);
      expect(state2p.board.hub).not.toBeNull();
      const totalTiles2p =
        state2p.hands[0].length +
        state2p.hands[1].length +
        state2p.boneyard.length +
        1; // hub
      expect(totalTiles2p).toBe(28);

      // 4 players: 5 tiles each, 28 - 20 = 8 tiles minus 1 opening tile = 7 boneyard
      const state4p = createInitialState('draw', { playerCount: 4 });
      expect(state4p.playerCount).toBe(4);
      expect(state4p.board.hub).not.toBeNull();
      const totalTiles4p =
        state4p.hands[0].length +
        state4p.hands[1].length +
        state4p.hands[2].length +
        state4p.hands[3].length +
        state4p.boneyard.length +
        1; // hub
      expect(totalTiles4p).toBe(28);

      // Deterministic deal with seed
      const seeded1 = createInitialState('fives', { seed: 'test-seed-2026' });
      const seeded2 = createInitialState('fives', { seed: 'test-seed-2026' });
      expect(seeded1.hands[0]).toEqual(seeded2.hands[0]);
      expect(seeded1.board.hub!.tile).toEqual(seeded2.board.hub!.tile);
      expect(seeded1.currentPlayer).toBe(seeded2.currentPlayer);
    });

    it('evaluates playable tiles and valid moves accurately across board states', () => {
      let board = emptyBoard();
      expect(getChainEnds(board)).toBeNull();

      board = placeFirstTile(board, makeTile(0, 3, 3), 'fives');
      expect(getChainEnds(board)).toEqual({ left: 3, right: 3 });

      const hand = [makeTile(1, 3, 5), makeTile(2, 1, 2)];
      const playable = getPlayableTiles(hand, board);
      expect(playable).toHaveLength(1);
      expect(playable[0].id).toBe(1);

      const moves = getValidMoves(hand, board, 'fives');
      // Left and right are both valid ends accepting 3
      expect(moves).toHaveLength(2);
      expect(moves.map((m) => m.end).sort()).toEqual(['left', 'right']);
    });
  });

  describe('All-Fives scoring & transverse doubles on open ends', () => {
    it('scores opening non-double when open ends sum to multiple of 5', () => {
      let board = emptyBoard();
      board = placeFirstTile(board, makeTile(1, 3, 2), 'fives');
      // Hub has inward=3, outward=2. Sum = 5, multiple of 5 -> score is 5.
      expect(sumOpenEnds(board)).toBe(5);
      expect(scoreOpenEnds(board)).toBe(5);

      let board2 = emptyBoard();
      board2 = placeFirstTile(board2, makeTile(2, 6, 4), 'fives');
      // Sum = 10 -> score is 10.
      expect(sumOpenEnds(board2)).toBe(10);
      expect(scoreOpenEnds(board2)).toBe(10);

      let board3 = emptyBoard();
      board3 = placeFirstTile(board3, makeTile(3, 4, 3), 'fives');
      // Sum = 7 -> not multiple of 5 -> score is 0.
      expect(sumOpenEnds(board3)).toBe(7);
      expect(scoreOpenEnds(board3)).toBe(0);
    });

    it('scores opening double as transverse double with 2x pip value', () => {
      let board = emptyBoard();
      // First tile is [5|5], spinnerActive is immediately set true in All Fives.
      board = placeFirstTile(board, makeTile(0, 5, 5), 'fives');
      expect(board.spinnerActive).toBe(true);
      // Double 5 counts both ends: 5 * 2 = 10. Multiple of 5 -> score 10.
      expect(sumOpenEnds(board)).toBe(10);
      expect(scoreOpenEnds(board)).toBe(10);

      let board6 = emptyBoard();
      board6 = placeFirstTile(board6, makeTile(1, 6, 6), 'fives');
      // 6 * 2 = 12 -> score 0.
      expect(sumOpenEnds(board6)).toBe(12);
      expect(scoreOpenEnds(board6)).toBe(0);

      let board0 = emptyBoard();
      board0 = placeFirstTile(board0, makeTile(2, 0, 0), 'fives');
      // 0 * 2 = 0 -> not positive multiple -> score 0.
      expect(sumOpenEnds(board0)).toBe(0);
      expect(scoreOpenEnds(board0)).toBe(0);
    });

    it('computes spinner open ends when one arm is placed vs both arms filled', () => {
      let board = emptyBoard();
      board = placeFirstTile(board, makeTile(0, 5, 5), 'fives');

      // Attach [5|0] to left arm. Left arm tip is 0.
      // Right arm is empty, so right side of spinner still counts as 2x5 = 10.
      board = placeTile(board, makeTile(1, 5, 0), 'left', 'fives')!;
      expect(board).not.toBeNull();
      const openCounts1 = getOpenEndCounts(board);
      expect(openCounts1).toEqual([
        { end: 'right', value: 10 },
        { end: 'left', value: 0 },
      ]);
      expect(sumOpenEnds(board)).toBe(10);
      expect(scoreOpenEnds(board)).toBe(10);

      // Now attach [5|4] to right arm.
      // Left arm tip is 0, right arm tip is 4.
      // Both sides are filled: spinner hub drops out of scoring!
      board = placeTile(board, makeTile(2, 5, 4), 'right', 'fives')!;
      expect(board).not.toBeNull();
      const openCounts2 = getOpenEndCounts(board);
      expect(openCounts2).toEqual([
        { end: 'left', value: 0 },
        { end: 'right', value: 4 },
      ]);
      expect(sumOpenEnds(board)).toBe(4);
      expect(scoreOpenEnds(board)).toBe(0);

      // Attach [4|6] to right arm. Right tip is now 6. Left tip is 0. Sum = 6.
      board = placeTile(board, makeTile(3, 4, 6), 'right', 'fives')!;
      expect(sumOpenEnds(board)).toBe(6);

      // Attach [6|6] (double on right arm tip).
      // A double on an arm tip counts transverse (both ends: 6*2 = 12).
      board = placeTile(board, makeTile(4, 6, 6), 'right', 'fives')!;
      // Left arm tip is 0, right arm tip is 12. Sum = 12.
      expect(sumOpenEnds(board)).toBe(12);

      // Attach [0|3] to left arm. Left tip is now 3.
      // Total sum: left(3) + right(12) = 15! Multiple of 5 -> score is 15!
      board = placeTile(board, makeTile(5, 0, 3), 'left', 'fives')!;
      expect(sumOpenEnds(board)).toBe(15);
      expect(scoreOpenEnds(board)).toBe(15);
    });

    it('handles 4-arm cross-tile scoring with transverse doubles on all branches', () => {
      let board = emptyBoard();
      board = placeFirstTile(board, makeTile(0, 5, 5), 'fives');
      // Fill left with [5|0] and right with [5|5] (another double 5 for testing).
      board = placeTile(board, makeTile(1, 5, 0), 'left', 'fives')!;
      board = placeTile(board, makeTile(2, 5, 5), 'right', 'fives')!;
      // Left tip is 0, right tip is double 5 (10). Sum = 10, score = 10.
      expect(sumOpenEnds(board)).toBe(10);
      expect(scoreOpenEnds(board)).toBe(10);

      // Attach [5|5] on up arm (attaching to spinner 5):
      // Up arm tip is double 5 (10).
      board = placeTile(board, makeTile(3, 5, 5), 'up', 'fives')!;
      // Left(0) + Right(10) + Up(10) = 20 -> score is 20!
      expect(sumOpenEnds(board)).toBe(20);
      expect(scoreOpenEnds(board)).toBe(20);

      // Attach [5|2] on down arm (attaching to spinner 5):
      board = placeTile(board, makeTile(4, 5, 2), 'down', 'fives')!;
      // Left(0) + Right(10) + Up(10) + Down(2) = 22 -> score is 0.
      expect(sumOpenEnds(board)).toBe(22);
      expect(scoreOpenEnds(board)).toBe(0);

      // Attach [2|3] on down arm: down tip becomes 3.
      board = placeTile(board, makeTile(5, 2, 3), 'down', 'fives')!;
      // Left(0) + Right(10) + Up(10) + Down(3) = 23 -> score is 0.
      expect(sumOpenEnds(board)).toBe(23);

      // Attach [3|5] on down arm: down tip becomes 5.
      board = placeTile(board, makeTile(6, 3, 5), 'down', 'fives')!;
      // Left(0) + Right(10) + Up(10) + Down(5) = 25! Score is 25!
      expect(sumOpenEnds(board)).toBe(25);
      expect(scoreOpenEnds(board)).toBe(25);
    });

    it('correctly scores linear non-spinner chain with transverse doubles', () => {
      let board = emptyBoard();
      // Non-double opening in draw mode
      board = placeFirstTile(board, makeTile(1, 4, 2), 'draw');
      // Attach [2|6] to right
      board = placeTile(board, makeTile(2, 2, 6), 'right', 'draw')!;
      // Attach [6|6] double to right tip
      board = placeTile(board, makeTile(3, 6, 6), 'right', 'draw')!;
      // Left end is 4 (non-double). Right end is [6|6] (double tip = 12).
      const counts = getOpenEndCounts(board);
      expect(counts).toEqual([
        { end: 'left', value: 4 },
        { end: 'right', value: 12 },
      ]);
      expect(sumOpenEnds(board)).toBe(16);
    });
  });

  describe('Spinner rivet activation and branch gating logic', () => {
    it('restricts playable ends to left/right until both sides are covered', () => {
      let board = emptyBoard();
      // Empty board: only left
      expect(getPlayableEnds(board)).toEqual(['left']);

      // Double hub in All Fives
      board = placeFirstTile(board, makeTile(0, 4, 4), 'fives');
      expect(board.spinnerActive).toBe(true);
      // Both arms empty: only left and right
      expect(getPlayableEnds(board)).toEqual(['left', 'right']);

      // Attempt to play on 'up' or 'down' prematurely returns null
      expect(placeTile(board, makeTile(1, 4, 1), 'up', 'fives')).toBeNull();
      expect(placeTile(board, makeTile(2, 4, 2), 'down', 'fives')).toBeNull();

      // Play on left arm
      board = placeTile(board, makeTile(3, 4, 1), 'left', 'fives')!;
      expect(board.arms.left).toHaveLength(1);
      // Right arm still empty: only left and right
      expect(getPlayableEnds(board)).toEqual(['left', 'right']);
      expect(placeTile(board, makeTile(4, 4, 3), 'up', 'fives')).toBeNull();

      // Play on right arm
      board = placeTile(board, makeTile(5, 4, 2), 'right', 'fives')!;
      expect(board.arms.right).toHaveLength(1);

      // Now both sides are filled: up and down branches unlock!
      expect(getPlayableEnds(board)).toEqual(['left', 'right', 'up', 'down']);

      // Now playing on up and down succeeds
      const boardWithUp = placeTile(board, makeTile(6, 4, 0), 'up', 'fives');
      expect(boardWithUp).not.toBeNull();
      expect(boardWithUp!.arms.up).toHaveLength(1);

      const boardWithDown = placeTile(boardWithUp!, makeTile(7, 4, 6), 'down', 'fives');
      expect(boardWithDown).not.toBeNull();
      expect(boardWithDown!.arms.down).toHaveLength(1);
    });

    it('promotes first double played during the game to the spinner hub', () => {
      let board = emptyBoard();
      // Opening tile is non-double [3|1] in Fives
      board = placeFirstTile(board, makeTile(1, 3, 1), 'fives');
      expect(board.spinnerActive).toBe(false);
      expect(getPlayableEnds(board)).toEqual(['left', 'right']);

      // Play [1|4] on right end
      board = placeTile(board, makeTile(2, 1, 4), 'right', 'fives')!;
      expect(board.spinnerActive).toBe(false);

      // Now play [3|3] on left end: this is the first double played!
      // promoteDoubleToSpinner converts [3|3] to the spinner hub!
      board = placeTile(board, makeTile(3, 3, 3), 'left', 'fives')!;
      expect(board.spinnerActive).toBe(true);
      expect(board.hub!.tile.id).toBe(3);
      expect(board.hub!.tile.left).toBe(3);
      expect(board.hub!.tile.right).toBe(3);

      // The previous chain [3|1]-[1|4] is now on the right arm of the spinner
      expect(board.arms.right).toHaveLength(2);
      expect(board.arms.left).toHaveLength(0);
      expect(getEndPip(board, 'right')).toBe(4);
      expect(getEndPip(board, 'left')).toBe(3);

      // Up and down ends are still gated because left arm is empty
      expect(getPlayableEnds(board)).toEqual(['left', 'right']);

      // Playing [3|2] on left fills the other side
      board = placeTile(board, makeTile(4, 3, 2), 'left', 'fives')!;
      expect(board.arms.left).toHaveLength(1);
      expect(board.arms.right).toHaveLength(2);

      // Spinner branching is now fully unlocked on all 4 ends!
      expect(getPlayableEnds(board)).toEqual(['left', 'right', 'up', 'down']);
    });

    it('promotes double when attached to right end correctly reversing sequence', () => {
      let board = emptyBoard();
      board = placeFirstTile(board, makeTile(1, 2, 4), 'fives');
      // Play [4|4] on right end
      board = placeTile(board, makeTile(2, 4, 4), 'right', 'fives')!;
      expect(board.spinnerActive).toBe(true);
      expect(board.hub!.tile.id).toBe(2);
      // Previous tile hangs off left arm
      expect(board.arms.left).toHaveLength(1);
      expect(board.arms.left[0].outward).toBe(2);
      expect(getEndPip(board, 'left')).toBe(2);
      expect(getEndPip(board, 'right')).toBe(4);
    });

    it('does not activate spinner in draw or block variants', () => {
      let drawBoard = emptyBoard();
      drawBoard = placeFirstTile(drawBoard, makeTile(1, 5, 5), 'draw');
      expect(drawBoard.spinnerActive).toBe(false);
      expect(getPlayableEnds(drawBoard)).toEqual(['left', 'right']);

      drawBoard = placeTile(drawBoard, makeTile(2, 5, 2), 'left', 'draw')!;
      drawBoard = placeTile(drawBoard, makeTile(3, 5, 4), 'right', 'draw')!;
      // In draw mode, up and down are NEVER unlocked
      expect(getPlayableEnds(drawBoard)).toEqual(['left', 'right']);

      let blockBoard = emptyBoard();
      blockBoard = placeFirstTile(blockBoard, makeTile(4, 6, 6), 'block');
      expect(blockBoard.spinnerActive).toBe(false);
      expect(getPlayableEnds(blockBoard)).toEqual(['left', 'right']);
    });
  });

  describe('Boneyard draw pool exhaustion, pass logic, & round-end counting', () => {
    it('enforces draw pool leave threshold of 2 tiles before allowing pass', () => {
      let board = emptyBoard();
      board = placeFirstTile(board, makeTile(1, 6, 6), 'draw');

      // Hand has no matching tiles for 6
      const hand = [makeTile(10, 1, 2), makeTile(11, 3, 4)];
      // Boneyard has 5 tiles: tile 22 (matching 6) is drawn on 3rd draw when boneyard length is 3 (> 2)
      const boneyard = [
        makeTile(20, 0, 1),
        makeTile(21, 2, 3),
        makeTile(22, 6, 2), // matching tile at index 2
        makeTile(23, 4, 5),
        makeTile(24, 5, 5),
      ];

      const state = makeState({
        hands: [hand, [makeTile(30, 6, 1)]],
        board,
        ruleVariant: 'draw',
        boneyard,
      });

      // Player cannot pass because boneyard > 2
      expect(pass(state, 0)).toBeNull();

      // drawTiles draws until playable tile is acquired
      const drawnState = drawTiles(state, 0);
      // Player drew tiles 20, 21, and 22 (the matching tile) -> hand size 2 + 3 = 5
      expect(drawnState.hands[0]).toHaveLength(5);
      expect(drawnState.boneyard).toHaveLength(2);
      // Since a playable tile was found, currentPlayer remains player 0
      expect(drawnState.currentPlayer).toBe(0);
      expect(canPlay(drawnState.hands[0], drawnState.board)).toBe(true);
    });

    it('draws until boneyard leave of 2, then auto-passes turn if still unplayable', () => {
      let board = emptyBoard();
      board = placeFirstTile(board, makeTile(1, 6, 6), 'draw');

      // Hand has no 6
      const hand = [makeTile(10, 1, 2)];
      // Boneyard has 5 tiles, none containing 6
      const boneyard = [
        makeTile(20, 0, 1),
        makeTile(21, 2, 3),
        makeTile(22, 3, 5),
        makeTile(23, 0, 0),
        makeTile(24, 1, 1),
      ];

      const state = makeState({
        hands: [hand, [makeTile(30, 6, 1)]],
        board,
        ruleVariant: 'draw',
        boneyard,
      });

      const nextState = drawTiles(state, 0);
      // Drew 3 tiles, leaving exactly 2 in boneyard (BONEYARD_LEAVE)
      expect(nextState.boneyard).toHaveLength(2);
      expect(nextState.hands[0]).toHaveLength(4);
      // Cannot play, so turn auto-passes to player 1
      expect(nextState.currentPlayer).toBe(1);
      // Suspected lack of 6 recorded
      expect(nextState.suspectedLack[0]).toContain(6);
    });

    it('clears suspected lack when player later plays a tile with that pip', () => {
      let board = emptyBoard();
      board = placeFirstTile(board, makeTile(1, 6, 4), 'draw');

      const state = makeState({
        currentPlayer: 0,
        hands: [[makeTile(10, 6, 2)], [makeTile(20, 4, 1)]],
        board,
        ruleVariant: 'draw',
        suspectedLack: [[6, 3], []],
      });

      // Player 0 plays [6|2] on left end
      const next = playTile(state, 0, 10, 'left')!;
      expect(next).not.toBeNull();
      // 6 is cleared from suspectedLack because tile had 6; 3 remains
      expect(next.suspectedLack[0]).toEqual([3]);
    });

    it('calculates round-end points correctly for Draw (exact) vs Fives (nearest 5)', () => {
      const loserHand = [
        makeTile(1, 6, 5), // 11
        makeTile(2, 4, 3), // 7
      ]; // Total raw = 18

      // Draw variant: exact raw points
      expect(roundEndPoints(loserHand, 'draw')).toBe(18);
      // Block variant: exact raw points
      expect(roundEndPoints(loserHand, 'block')).toBe(18);
      // Fives variant: rounded to nearest 5 (18 -> 20)
      expect(roundEndPoints(loserHand, 'fives')).toBe(20);

      // Test rounding boundaries for Fives
      expect(roundToNearestFive(7)).toBe(5);
      expect(roundToNearestFive(8)).toBe(10);
      expect(roundToNearestFive(11)).toBe(10);
      expect(roundToNearestFive(12)).toBe(10);
      expect(roundToNearestFive(13)).toBe(15);
      expect(roundToNearestFive(14)).toBe(15);
      expect(roundToNearestFive(17)).toBe(15);
      expect(roundToNearestFive(18)).toBe(20);
    });

    it('finishes round with domino when a player plays their last tile', () => {
      let board = emptyBoard();
      board = placeFirstTile(board, makeTile(1, 6, 2), 'draw');

      const state = makeState({
        currentPlayer: 0,
        hands: [[makeTile(10, 2, 5)], [makeTile(20, 6, 6), makeTile(21, 3, 3)]],
        board,
        ruleVariant: 'draw',
      });

      // Player 0 plays their last tile
      const next = playTile(state, 0, 10, 'right')!;
      expect(next.phase).toBe('roundOver');
      expect(next.winner).toBe(0);
      expect(next.winningTeam).toBe(0);
      expect(next.roundEndReason).toBe('domino');
      // Opponent tiles: [6|6] (12) + [3|3] (6) = 18
      expect(next.lastPlayScore).toBe(18);
      expect(next.handScores[0]).toBe(18);
    });
  });

  describe('Block game tiebreaker & blocked board resolution', () => {
    it('prohibits drawing in block game and routes drawTiles to pass', () => {
      let board = emptyBoard();
      board = placeFirstTile(board, makeTile(1, 6, 6), 'block');

      const state = makeState({
        currentPlayer: 0,
        hands: [[makeTile(10, 1, 2)], [makeTile(20, 6, 1)]],
        board,
        ruleVariant: 'block',
        boneyard: [makeTile(30, 6, 3)],
      });

      // Calling drawTiles in block mode passes the turn directly
      const next = drawTiles(state, 0);
      expect(next.currentPlayer).toBe(1);
      expect(next.boneyard).toHaveLength(1); // did not draw
      expect(next.suspectedLack[0]).toContain(6);
    });

    it('resolves blocked game awarding victory to lowest pip count', () => {
      let board = emptyBoard();
      board = placeFirstTile(board, makeTile(1, 5, 5), 'block');

      // Both players are blocked (no 5s)
      const hand0 = [makeTile(10, 1, 1)]; // 2 pips
      const hand1 = [makeTile(20, 4, 3)]; // 7 pips

      const state = makeState({
        currentPlayer: 0,
        hands: [hand0, hand1],
        board,
        ruleVariant: 'block',
      });

      // When player 0 passes and all players are blocked, allBlocked resolves immediately!
      const passState = pass(state, 0)!;
      expect(passState).not.toBeNull();
      expect(passState.phase).toBe('roundOver');
      expect(passState.roundEndReason).toBe('blocked');
      // Player 0 has 2 pips vs Player 1's 7 pips -> Player 0 wins!
      expect(passState.winner).toBe(0);
      expect(passState.winningTeam).toBe(0);
      // Winner receives opponent's pips (7)
      expect(passState.handScores[0]).toBe(7);
    });

    it('handles exact pip count tie in blocked game by favoring seat 0 / team 0', () => {
      let board = emptyBoard();
      board = placeFirstTile(board, makeTile(1, 4, 4), 'block');

      // Equal pip counts: both have 6 pips
      const hand0 = [makeTile(10, 3, 3)]; // 6 pips
      const hand1 = [makeTile(20, 6, 0)]; // 6 pips

      const state = makeState({
        currentPlayer: 0,
        hands: [hand0, hand1],
        board,
        ruleVariant: 'block',
      });

      const p0 = pass(state, 0)!;
      expect(p0).not.toBeNull();
      expect(p0.phase).toBe('roundOver');
      expect(p0.roundEndReason).toBe('blocked');
      // sum0 <= sum1 ? 0 : 1 -> team 0 wins tiebreaker
      expect(p0.winningTeam).toBe(0);
      expect(p0.handScores[0]).toBe(6);
    });

    it('calculates 4-player partners team hand sums and blocks accurately', () => {
      let board = emptyBoard();
      board = placeFirstTile(board, makeTile(1, 6, 6), 'block');

      // 4 seats: Team 0 = seats 0 & 2; Team 1 = seats 1 & 3
      const hands = [
        [makeTile(10, 1, 1)], // Seat 0: 2 pips
        [makeTile(20, 4, 4)], // Seat 1: 8 pips
        [makeTile(30, 2, 2)], // Seat 2: 4 pips (Team 0 sum = 6)
        [makeTile(40, 5, 5)], // Seat 3: 10 pips (Team 1 sum = 18)
      ];

      expect(teamHandSum(hands, 0, 4)).toBe(6);
      expect(teamHandSum(hands, 1, 4)).toBe(18);

      const state: DominoesState = {
        currentPlayer: 0,
        playerCount: 4,
        hands,
        board,
        boneyard: [],
        phase: 'playing',
        winner: null,
        winningTeam: null,
        roundEndReason: null,
        ruleVariant: 'block',
        handScores: [0, 0, 0, 0],
        lastPlayScore: 0,
        lastOpenSum: 0,
        suspectedLack: [[], [], [], []],
      };

      // Since all 4 players cannot play (no 6s), passing on seat 0 immediately triggers allBlocked
      const s0 = pass(state, 0)!;
      expect(s0).not.toBeNull();
      expect(s0.phase).toBe('roundOver');
      expect(s0.roundEndReason).toBe('blocked');
      expect(s0.winningTeam).toBe(0);
      // Opponents are seat 1 (8) and seat 3 (10) -> total 18 points
      expect(s0.handScores[s0.winner!]).toBe(18);
    });

    it('analyzes blockade threat and favorable block disposition', () => {
      let board = emptyBoard();
      board = placeFirstTile(board, makeTile(0, 6, 6), 'block');

      const hand0 = [makeTile(1, 1, 1)]; // 2 pips
      const hand1 = [makeTile(2, 6, 5), makeTile(3, 6, 4)]; // 21 pips

      const state = makeState({
        hands: [hand0, hand1],
        board,
        ruleVariant: 'block',
      });

      const threat = analyzeBlockadeThreat(state, 0);
      expect(threat.playerHandSum).toBe(2);
      expect(threat.oppHandTileCount).toBe(2);
      expect(threat.favorableBlock).toBe(true);
    });
  });

  describe('Hypergeometric opponent hand estimation & imperfect information AI', () => {
    it('computes exact hypergeometric probability under imperfect information', () => {
      let board = emptyBoard();
      board = placeFirstTile(board, makeTile(0, 5, 5), 'draw');

      // Hand has 6 tiles
      const playerHand = [
        makeTile(1, 0, 0),
        makeTile(2, 1, 1),
        makeTile(3, 2, 2),
        makeTile(4, 3, 3),
        makeTile(5, 4, 4),
        makeTile(6, 6, 6),
      ];
      // Opponent hand has 7 tiles
      const oppHand = [
        makeTile(7, 5, 0),
        makeTile(8, 5, 1),
        makeTile(9, 5, 2),
        makeTile(10, 0, 1),
        makeTile(11, 0, 2),
        makeTile(12, 0, 3),
        makeTile(13, 0, 4),
      ];

      const state = makeState({
        hands: [playerHand, oppHand],
        board,
        ruleVariant: 'draw',
      });

      const probs = calculateOpponentLackProbabilities(state, 0);
      expect(probs).toHaveLength(7);

      // Verify confirmed lack sets probability to 0 and threat to 'void'
      state.suspectedLack[1] = [5];
      const probsWithLack = calculateOpponentLackProbabilities(state, 0);
      const pip5 = probsWithLack.find((p) => p.pip === 5)!;
      expect(pip5.probability).toBe(0);
      expect(pip5.isConfirmedLack).toBe(true);
      expect(pip5.threatLevel).toBe('void');
    });

    it('guarantees 100% probability via pigeonhole principle when non-suit unseen < hand size', () => {
      let board = emptyBoard();
      board = placeFirstTile(board, makeTile(0, 0, 0), 'draw');

      // Full set is 28 tiles.
      // Place 24 tiles on board / player hand, leaving only 4 unseen tiles.
      // Suppose 2 of those 4 contain pip 6, and opponent hand size is 3.
      // Non-suit unseen tiles = 4 - 2 = 2.
      // Since opponent holds 3 tiles out of 4, opponent MUST hold at least 3 - 2 = 1 tile of pip 6!
      const playerHand = createSet().slice(1, 25); // 24 tiles
      const oppHand = createSet().slice(25, 28); // 3 tiles

      const state = makeState({
        hands: [playerHand, oppHand],
        board,
        ruleVariant: 'draw',
      });

      const probs = calculateOpponentLackProbabilities(state, 0);
      for (const p of probs) {
        if (p.unseenSuitCount > 0 && 4 - p.unseenSuitCount < 3) {
          expect(p.probability).toBe(100);
          expect(p.threatLevel).toBe('high');
        }
      }
    });

    it('remainingPipCounts tallies unseen copies across 28 tiles', () => {
      let board = emptyBoard();
      board = placeFirstTile(board, makeTile(0, 6, 6), 'draw');
      // [6|6] has two 6s placed on board.
      const hand = [makeTile(1, 6, 5), makeTile(2, 6, 4)];
      // Hand has two more 6s.
      // Total 6s in set = 8 (6 non-doubles + double counting twice).
      // Seen 6s = 2 (on board) + 2 (in hand) = 4.
      // Remaining 6s should be 8 - 4 = 4.
      const counts = remainingPipCounts(board, hand);
      expect(counts[6]).toBe(4);
      // For pip 0 (none seen yet): 8 remaining
      expect(counts[0]).toBe(8);
    });

    it('simulates All Fives score opportunities and assigns tactical grades', () => {
      let board = emptyBoard();
      board = placeFirstTile(board, makeTile(0, 5, 5), 'fives');

      const hand = [makeTile(1, 5, 0), makeTile(2, 5, 3)];
      const sims = simulateAllFivesScores(hand, board);

      expect(sims.length).toBeGreaterThan(0);
      // [5|0] produces sum 10, scoring 10 points -> tactical grade S or A
      const top = sims[0];
      expect(top.tileId).toBe(1);
      expect(top.score).toBe(10);
      expect(['S', 'A']).toContain(top.tacticalGrade);
    });

    it('hard bot capitalizes on All-Fives scoring opportunities deterministically', () => {
      let board = emptyBoard();
      // Hub is [5|5], spinner active.
      board = placeFirstTile(board, makeTile(0, 5, 5), 'fives');

      // Hand has [5|0] which scores 10 points (ends 0 and 10), and [5|2] which scores 0 points.
      const hand = [makeTile(1, 5, 2), makeTile(2, 5, 0)];

      const move = pickBotMove(hand, board, 5, 'hard', {
        ruleVariant: 'fives',
        deterministic: true,
      });

      expect(move).not.toBeNull();
      // Hard bot must select [5|0] (tileId 2) to score 10 points!
      expect(move!.tileId).toBe(2);
    });

    it('hard bot exploits opponent suspected lacks to force passes', () => {
      let board = emptyBoard();
      // Hub has ends 3 and 4
      board = placeFirstTile(board, makeTile(0, 3, 4), 'draw');

      // Hand can play [4|1] (leaving 1) or [4|6] (leaving 6)
      const hand = [makeTile(1, 4, 1), makeTile(2, 4, 6)];

      // Opponent is known to lack pip 1
      const move = pickBotMove(hand, board, 3, 'hard', {
        ruleVariant: 'draw',
        opponentLack: [1],
        deterministic: true,
      });

      expect(move).not.toBeNull();
      // Hard bot prioritizes leaving pip 1 to trap the opponent!
      expect(move!.tileId).toBe(1);
    });

    it('easy bot dumps light tiles first due to dumpLightFirst heuristic', () => {
      let board = emptyBoard();
      board = placeFirstTile(board, makeTile(0, 2, 2), 'draw');

      // Hand has [2|6] (sum 8) and [2|0] (sum 2)
      const hand = [makeTile(1, 2, 6), makeTile(2, 2, 0)];

      const move = pickBotMove(hand, board, 5, 'easy', {
        ruleVariant: 'draw',
        deterministic: true,
      });

      expect(move).not.toBeNull();
      // Easy bot dumps light tile [2|0] (tileId 2)
      expect(move!.tileId).toBe(2);
    });
  });

  describe('Match series points target & game completion invariants', () => {
    it('tracks race to 100 points across multiple rounds', () => {
      let match = createMatchState(100, 2);
      expect(match.target).toBe(100);
      expect(match.scores).toEqual([0, 0]);
      expect(match.round).toBe(1);
      expect(match.matchOver).toBe(false);

      // Round 1: Team 0 scores 45, Team 1 scores 20
      match = applyRoundToMatch(match, [45, 20]);
      expect(match.scores).toEqual([45, 20]);
      expect(match.matchOver).toBe(false);
      match = advanceMatchRound(match);
      expect(match.round).toBe(2);

      // Round 2: Team 0 scores 40, Team 1 scores 30
      match = applyRoundToMatch(match, [40, 30]);
      expect(match.scores).toEqual([85, 50]);
      expect(match.matchOver).toBe(false);
      match = advanceMatchRound(match);
      expect(match.round).toBe(3);

      // Round 3: Team 0 scores 25 (total 110), reaching target 100!
      match = applyRoundToMatch(match, [25, 10]);
      expect(match.scores).toEqual([110, 60]);
      expect(match.matchOver).toBe(true);
      expect(match.matchWinner).toBe(0);

      // Once match is over, advanceMatchRound does not increment round
      const finalMatch = advanceMatchRound(match);
      expect(finalMatch.round).toBe(3);
      // And applyRoundToMatch is a no-op
      expect(applyRoundToMatch(finalMatch, [10, 10])).toBe(finalMatch);
    });

    it('requires tiebreak when both teams reach target simultaneously with equal score', () => {
      let match = createMatchState(100, 2);
      match = applyRoundToMatch(match, [90, 90]);
      expect(match.matchOver).toBe(false);

      // Both score 15, reaching 105 each (tied above target)
      match = applyRoundToMatch(match, [15, 15]);
      expect(match.scores).toEqual([105, 105]);
      // Match does NOT end on tie!
      expect(match.matchOver).toBe(false);
      expect(match.matchWinner).toBeNull();

      // Next round: Team 1 scores 10, Team 0 scores 0
      match = advanceMatchRound(match);
      match = applyRoundToMatch(match, [0, 10]);
      expect(match.scores).toEqual([105, 115]);
      expect(match.matchOver).toBe(true);
      expect(match.matchWinner).toBe(1);
    });

    it('supports 150 and 200 points series targets', () => {
      let match150 = createMatchState(150, 2);
      match150 = applyRoundToMatch(match150, [140, 100]);
      expect(match150.matchOver).toBe(false);
      match150 = applyRoundToMatch(match150, [15, 0]);
      expect(match150.scores[0]).toBe(155);
      expect(match150.matchOver).toBe(true);
      expect(match150.matchWinner).toBe(0);

      let match200 = createMatchState(200, 2);
      match200 = applyRoundToMatch(match200, [180, 195]);
      expect(match200.matchOver).toBe(false);
      match200 = applyRoundToMatch(match200, [10, 15]);
      expect(match200.scores).toEqual([190, 210]);
      expect(match200.matchOver).toBe(true);
      expect(match200.matchWinner).toBe(1);
    });

    it('single-round target of 1 terminates immediately after 1 hand', () => {
      let match = createMatchState(1, 2);
      match = applyRoundToMatch(match, [14, 0]);
      expect(match.matchOver).toBe(true);
      expect(match.matchWinner).toBe(0);
    });
  });
});
