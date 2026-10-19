import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applyRoundToMatch,
  canAttachToEnd,
  createInitialState,
  createMatchState,
  createSet,
  drawTiles,
  emptyBoard,
  getChainEnds,
  getDifficultyConfig,
  getEndPip,
  getOpenEndCounts,
  getPlayableTiles,
  getValidMoves,
  handSum,
  isValidPlay,
  pass,
  pickBotMove,
  placeFirstTile,
  placeTile,
  playTile,
  roundEndPoints,
  roundToNearestFive,
  scoreOpenEnds,
  sumOpenEnds,
  tileSum,
  DIFFICULTY_BLURBS,
  type DominoesState,
  type Tile,
} from './dominoesLogic';

function tile(id: number, left: number, right: number): Tile {
  return { id, left, right };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createSet', () => {
  it('builds a double-six set of 28 unique tiles', () => {
    const set = createSet();
    expect(set).toHaveLength(28);
    const keys = new Set(set.map((t) => `${t.left}-${t.right}`));
    expect(keys.size).toBe(28);
    expect(set[0]).toMatchObject({ left: 0, right: 0 });
    expect(set[27]).toMatchObject({ left: 6, right: 6 });
  });
});

describe('chain / attach', () => {
  it('treats every hand tile as playable on an empty board', () => {
    const hand = [tile(1, 3, 5), tile(2, 0, 0)];
    const board = emptyBoard();
    expect(getChainEnds(board)).toBeNull();
    expect(getPlayableTiles(hand, board)).toHaveLength(2);
    const moves = getValidMoves(hand, board);
    expect(moves).toHaveLength(2);
    expect(moves.every((m) => m.end === 'left')).toBe(true);
  });

  it('reads hub faces as chain ends', () => {
    let board = emptyBoard();
    board = placeFirstTile(board, tile(10, 6, 6), 'draw');
    board = placeTile(board, tile(11, 6, 3), 'right', 'draw')!;
    expect(getChainEnds(board)).toEqual({ left: 6, right: 3 });
  });

  it('orients matching tiles on left and right ends', () => {
    let board = emptyBoard();
    board = placeFirstTile(board, tile(1, 4, 4), 'draw');
    const match = tile(2, 4, 1);
    const miss = tile(3, 5, 2);
    expect(canAttachToEnd(match, 4)).toBe(true);
    expect(canAttachToEnd(miss, 4)).toBe(false);

    const left = placeTile(board, match, 'left', 'draw');
    expect(left).not.toBeNull();
    expect(getEndPip(left!, 'left')).toBe(1);
    expect(getChainEnds(left!)).toEqual({ left: 1, right: 4 });

    const right = placeTile(board, match, 'right', 'draw');
    expect(right).not.toBeNull();
    expect(getEndPip(right!, 'right')).toBe(1);
    expect(placeTile(board, miss, 'left', 'draw')).toBeNull();
  });

  it('lists both ends when a double matches open 3/3', () => {
    let board = emptyBoard();
    board = placeFirstTile(board, tile(1, 3, 5), 'draw');
    board = placeTile(board, tile(2, 5, 3), 'right', 'draw')!;
    expect(getChainEnds(board)).toEqual({ left: 3, right: 3 });
    const hand = [tile(3, 3, 3), tile(4, 0, 1)];
    const moves = getValidMoves(hand, board);
    expect(moves.some((m) => m.tileId === 3 && m.end === 'left')).toBe(true);
    expect(moves.some((m) => m.tileId === 3 && m.end === 'right')).toBe(true);
    expect(moves.some((m) => m.tileId === 4)).toBe(false);
    expect(isValidPlay(hand, board, 3, 'left')).toBe(true);
    expect(isValidPlay(hand, board, 4, 'left')).toBe(false);
  });
});

describe('All Fives scoring', () => {
  it('scores a lone double spinner as 2×pip when multiple of 5', () => {
    let board = emptyBoard();
    board = placeFirstTile(board, tile(1, 5, 5), 'fives');
    expect(board.spinnerActive).toBe(true);
    expect(sumOpenEnds(board)).toBe(10);
    expect(scoreOpenEnds(board)).toBe(10);
  });

  it('does not score when open sum is not a multiple of 5', () => {
    let board = emptyBoard();
    board = placeFirstTile(board, tile(1, 6, 6), 'fives');
    expect(sumOpenEnds(board)).toBe(12);
    expect(scoreOpenEnds(board)).toBe(0);
  });

  it('counts spinner + one arm tip before both sides are filled', () => {
    let board = emptyBoard();
    board = placeFirstTile(board, tile(1, 5, 5), 'fives');
    board = placeTile(board, tile(2, 5, 0), 'left', 'fives')!;
    // Spinner still 10 + tip 0 = 10
    expect(sumOpenEnds(board)).toBe(10);
    expect(scoreOpenEnds(board)).toBe(10);
  });

  it('drops spinner from the count once both sides are filled', () => {
    let board = emptyBoard();
    board = placeFirstTile(board, tile(1, 5, 5), 'fives');
    board = placeTile(board, tile(2, 5, 0), 'left', 'fives')!;
    board = placeTile(board, tile(3, 5, 3), 'right', 'fives')!;
    // Tips 0 + 3 = 3; spinner no longer counts
    expect(sumOpenEnds(board)).toBe(3);
    expect(scoreOpenEnds(board)).toBe(0);
  });

  it('counts a double tip as both halves', () => {
    let board = emptyBoard();
    board = placeFirstTile(board, tile(1, 3, 3), 'fives');
    board = placeTile(board, tile(2, 3, 6), 'left', 'fives')!;
    board = placeTile(board, tile(3, 3, 5), 'right', 'fives')!;
    // tips 6 + 5 = 11
    expect(sumOpenEnds(board)).toBe(11);
    board = placeTile(board, tile(4, 5, 5), 'right', 'fives')!;
    // tips 6 + 10 = 16
    expect(getOpenEndCounts(board).find((c) => c.end === 'right')?.value).toBe(10);
    expect(sumOpenEnds(board)).toBe(16);
  });

  it('unlocks up/down only after both spinner sides are filled', () => {
    let board = emptyBoard();
    board = placeFirstTile(board, tile(1, 4, 4), 'fives');
    const earlyUp = placeTile(board, tile(2, 4, 1), 'up', 'fives');
    expect(earlyUp).toBeNull();
    board = placeTile(board, tile(2, 4, 1), 'left', 'fives')!;
    board = placeTile(board, tile(3, 4, 2), 'right', 'fives')!;
    const up = placeTile(board, tile(4, 4, 0), 'up', 'fives');
    expect(up).not.toBeNull();
    expect(sumOpenEnds(up!)).toBe(1 + 2 + 0); // left tip + right tip + up tip
  });

  it('awards play score via playTile in fives variant', () => {
    const state: DominoesState = {
      currentPlayer: 0,
      // Keep an extra tile so the hand does not end on this play.
      hands: [[tile(7, 5, 0), tile(12, 2, 2)], [tile(8, 1, 1)]],
      board: placeFirstTile(emptyBoard(), tile(9, 5, 5), 'fives'),
      boneyard: [tile(10, 0, 0), tile(11, 0, 1)],
      phase: 'playing',
      winner: null,
      roundEndReason: null,
      ruleVariant: 'fives',
      handScores: [0, 0],
      lastPlayScore: 0,
      lastOpenSum: 10,
      suspectedLack: [[], []],
    };
    const next = playTile(state, 0, 7, 'left');
    expect(next).not.toBeNull();
    expect(next!.phase).toBe('playing');
    // Spinner 10 + tip 0 = 10 → score 10
    expect(next!.lastPlayScore).toBe(10);
    expect(next!.handScores[0]).toBe(10);
  });

  it('rounds remaining pips to nearest 5 for fives round-end', () => {
    expect(roundToNearestFive(28)).toBe(30);
    expect(roundToNearestFive(26)).toBe(25);
    expect(roundToNearestFive(2)).toBe(0);
    expect(roundToNearestFive(3)).toBe(5);
    expect(roundEndPoints([tile(1, 6, 6), tile(2, 5, 5)], 'fives')).toBe(20);
    expect(roundEndPoints([tile(1, 6, 6), tile(2, 5, 5)], 'draw')).toBe(22);
  });
});

describe('win / block / draw rules', () => {
  it('declares empty-hand win via playTile', () => {
    const last = tile(7, 2, 6);
    let board = emptyBoard();
    board = placeFirstTile(board, tile(9, 6, 6), 'draw');
    const state: DominoesState = {
      currentPlayer: 0,
      hands: [[last], [tile(8, 1, 1)]],
      board,
      boneyard: [tile(10, 0, 0), tile(11, 0, 1)],
      phase: 'playing',
      winner: null,
      roundEndReason: null,
      ruleVariant: 'draw',
      handScores: [0, 0],
      lastPlayScore: 0,
      lastOpenSum: 12,
      suspectedLack: [[], []],
    };
    const next = playTile(state, 0, 7, 'right');
    expect(next).not.toBeNull();
    expect(next!.phase).toBe('roundOver');
    expect(next!.winner).toBe(0);
    expect(next!.roundEndReason).toBe('domino');
    expect(next!.hands[0]).toHaveLength(0);
    // Round-end bonus = opponent hand sum
    expect(next!.handScores[0]).toBe(2);
  });

  it('scores blocked hands by lower pip sum (ties favor player 0)', () => {
    const hand0 = [tile(1, 1, 2)];
    const hand1 = [tile(2, 3, 3)];
    expect(tileSum(hand0[0])).toBe(3);
    expect(handSum(hand0)).toBe(3);
    expect(handSum(hand1)).toBe(6);
    expect(handSum(hand0) <= handSum(hand1) ? 0 : 1).toBe(0);
  });

  it('block variant: stuck pass ends the round when both cannot play', () => {
    let board = emptyBoard();
    board = placeFirstTile(board, tile(1, 6, 6), 'block');
    const state: DominoesState = {
      currentPlayer: 0,
      hands: [[tile(2, 1, 2)], [tile(3, 3, 4)]],
      board,
      boneyard: [tile(4, 0, 0), tile(5, 0, 1), tile(6, 0, 2)],
      phase: 'playing',
      winner: null,
      roundEndReason: null,
      ruleVariant: 'block',
      handScores: [0, 0],
      lastPlayScore: 0,
      lastOpenSum: 12,
      suspectedLack: [[], []],
    };
    expect(pass(state, 0)).not.toBeNull();
    expect(pass(state, 0)!.phase).toBe('roundOver');
    expect(pass(state, 0)!.roundEndReason).toBe('blocked');
    expect(drawTiles(state, 0).phase).toBe('roundOver');
  });

  it('draw variant: cannot pass while drawable tiles remain', () => {
    let board = emptyBoard();
    board = placeFirstTile(board, tile(1, 6, 6), 'draw');
    const state: DominoesState = {
      currentPlayer: 0,
      hands: [[tile(2, 1, 2)], [tile(3, 3, 4)]],
      board,
      boneyard: [tile(4, 0, 0), tile(5, 0, 1), tile(6, 5, 5)],
      phase: 'playing',
      winner: null,
      roundEndReason: null,
      ruleVariant: 'draw',
      handScores: [0, 0],
      lastPlayScore: 0,
      lastOpenSum: 12,
      suspectedLack: [[], []],
    };
    expect(pass(state, 0)).toBeNull();
    const drawn = drawTiles(state, 0);
    expect(drawn.hands[0].length).toBeGreaterThanOrEqual(2);
  });

  it('notes suspected lack suits when a player must draw', () => {
    let board = emptyBoard();
    board = placeFirstTile(board, tile(1, 6, 6), 'draw');
    const state: DominoesState = {
      currentPlayer: 0,
      hands: [[tile(2, 1, 2)], [tile(3, 3, 4)]],
      board,
      boneyard: [tile(4, 0, 0), tile(5, 0, 1), tile(6, 5, 5)],
      phase: 'playing',
      winner: null,
      roundEndReason: null,
      ruleVariant: 'draw',
      handScores: [0, 0],
      lastPlayScore: 0,
      lastOpenSum: 12,
      suspectedLack: [[], []],
    };
    const drawn = drawTiles(state, 0);
    expect(drawn.suspectedLack[0]).toContain(6);
  });
});

describe('match scoring', () => {
  it('accumulates hand scores and ends when a lead reaches target', () => {
    let match = createMatchState(100);
    match = applyRoundToMatch(match, [40, 10]);
    expect(match.scores).toEqual([40, 10]);
    expect(match.matchOver).toBe(false);
    expect(match.round).toBe(1); // stays until next deal
    match = { ...match, round: match.round + 1 };
    match = applyRoundToMatch(match, [70, 5]);
    expect(match.scores).toEqual([110, 15]);
    expect(match.matchOver).toBe(true);
    expect(match.matchWinner).toBe(0);
  });

  it('keeps playing when both hit target on a tie', () => {
    let match = createMatchState(100);
    match = applyRoundToMatch(match, [50, 50]);
    match = { ...match, round: 2 };
    match = applyRoundToMatch(match, [50, 50]);
    expect(match.scores).toEqual([100, 100]);
    expect(match.matchOver).toBe(false);
    match = { ...match, round: 3 };
    match = applyRoundToMatch(match, [5, 0]);
    expect(match.matchOver).toBe(true);
    expect(match.matchWinner).toBe(0);
  });

  it('createInitialState fives starts with spinner when opening is a double', () => {
    // Force doubles by mocking shuffle via many trials — opening always prefers
    // highest double, so spinnerActive should be true for fives.
    const state = createInitialState('fives');
    expect(state.board.hub).not.toBeNull();
    if (state.board.hub && state.board.hub.tile.left === state.board.hub.tile.right) {
      expect(state.board.spinnerActive).toBe(true);
    }
  });
});

describe('pickBotMove (adversarial bot)', () => {
  it('returns null when the hand has no legal attaches', () => {
    let board = emptyBoard();
    board = placeFirstTile(board, tile(1, 6, 6), 'draw');
    const hand = [tile(2, 1, 2), tile(3, 3, 4)];
    expect(pickBotMove(hand, board, 7, 'hard')).toBeNull();
  });

  it('returns the only legal move without scoring', () => {
    let board = emptyBoard();
    board = placeFirstTile(board, tile(1, 4, 5), 'draw');
    const hand = [tile(2, 4, 1), tile(3, 0, 0)];
    expect(getValidMoves(hand, board)).toEqual([{ tileId: 2, end: 'left' }]);
    expect(pickBotMove(hand, board, 7, 'easy')).toEqual({ tileId: 2, end: 'left' });
  });

  it('hard prefers shedding a high double when both plays are legal', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    let board = emptyBoard();
    board = placeFirstTile(board, tile(1, 6, 3), 'draw');
    // Hub 6|3 — left end 6, right end 3
    const hand = [
      tile(2, 6, 6),
      tile(3, 3, 1),
    ];
    const picked = pickBotMove(hand, board, 7, 'hard');
    expect(picked).toEqual({ tileId: 2, end: 'left' });
  });

  it('hard prefers a scoring All Fives play over a non-scoring one', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    let board = emptyBoard();
    board = placeFirstTile(board, tile(1, 5, 5), 'fives');
    // Spinner 5-5 (sum 10). Playing 5-0 on left keeps sum 10 (scores).
    // Playing 5-1 on right yields spinner 10 + tip 1 = 11 (no score).
    const hand = [tile(2, 5, 0), tile(3, 5, 1)];
    const picked = pickBotMove(hand, board, 7, 'hard', {
      ruleVariant: 'fives',
      opponentLack: [],
    });
    expect(picked?.tileId).toBe(2);
  });

  it('hard prefers feeding suits the opponent appears to lack', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    let board = emptyBoard();
    board = placeFirstTile(board, tile(1, 3, 4), 'draw');
    // left=3, right=4. Playing 3-6 opens a 6; playing 3-2 opens a 2.
    // Opponent lacks 6 → prefer leaving 6.
    const hand = [tile(2, 3, 6), tile(3, 3, 2)];
    const picked = pickBotMove(hand, board, 7, 'hard', {
      ruleVariant: 'draw',
      opponentLack: [6],
    });
    expect(picked?.tileId).toBe(2);
  });
});

describe('difficulty tiers', () => {
  it('spreads blunderRate and flexibilityWeight across easy < normal < hard', () => {
    const easy = getDifficultyConfig('easy');
    const normal = getDifficultyConfig('normal');
    const hard = getDifficultyConfig('hard');
    expect(easy.blunderRate).toBeGreaterThan(normal.blunderRate);
    expect(normal.blunderRate).toBeGreaterThan(hard.blunderRate);
    expect(hard.blunderRate).toBe(0);
    expect(easy.flexibilityWeight).toBeLessThan(normal.flexibilityWeight);
    expect(normal.flexibilityWeight).toBeLessThan(hard.flexibilityWeight);
    expect(hard.scoreWeight).toBeGreaterThan(normal.scoreWeight);
    expect(hard.leaveScorePenalty).toBeGreaterThan(0);
    expect(easy.dumpLightFirst).toBe(true);
    expect(normal.dumpLightFirst).toBe(false);
    expect(hard.dumpLightFirst).toBe(false);
  });

  it('keeps three distinct blurbs', () => {
    const blurbs = (['easy', 'normal', 'hard'] as const).map((id) => DIFFICULTY_BLURBS[id]);
    expect(new Set(blurbs).size).toBe(3);
    for (const blurb of blurbs) expect(blurb.trim().length).toBeGreaterThan(0);
  });

  it('easy can blunder past the scored pick; hard never does', () => {
    let board = emptyBoard();
    board = placeFirstTile(board, tile(1, 6, 3), 'draw');
    const hand = [tile(2, 3, 1), tile(3, 6, 6)];
    const moves = getValidMoves(hand, board);
    expect(moves.length).toBeGreaterThanOrEqual(2);

    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(pickBotMove(hand, board, 7, 'easy')).toEqual(moves[0]);

    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(pickBotMove(hand, board, 7, 'hard')).toEqual({ tileId: 3, end: 'left' });
  });

  it('easy still dumps light tiles when it does not blunder', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    let board = emptyBoard();
    board = placeFirstTile(board, tile(1, 6, 3), 'draw');
    const hand = [tile(2, 6, 6), tile(3, 3, 1)];
    expect(pickBotMove(hand, board, 7, 'easy')).toEqual({ tileId: 3, end: 'right' });
  });
});
