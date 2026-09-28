import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  canAttachToEnd,
  createSet,
  drawTiles,
  getChainEnds,
  getPlayableTiles,
  getValidMoves,
  handSum,
  isValidPlay,
  pass,
  pickBotMove,
  placeTile,
  playTile,
  tileSum,
  type DominoesState,
  type PlacedTile,
  type Tile,
} from './dominoesLogic';

function tile(id: number, left: number, right: number): Tile {
  return { id, left, right };
}

function placed(t: Tile, displayLeft: number, displayRight: number): PlacedTile {
  return { tile: t, displayLeft, displayRight };
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
  it('treats every hand tile as playable on an empty chain', () => {
    const hand = [tile(1, 3, 5), tile(2, 0, 0)];
    expect(getChainEnds([])).toBeNull();
    expect(getPlayableTiles(hand, [])).toHaveLength(2);
    const moves = getValidMoves(hand, []);
    expect(moves).toHaveLength(2);
    expect(moves.every((m) => m.end === 'left')).toBe(true);
  });

  it('reads displayLeft / displayRight as chain ends', () => {
    const chain = [
      placed(tile(10, 6, 6), 6, 6),
      placed(tile(11, 6, 3), 6, 3),
    ];
    expect(getChainEnds(chain)).toEqual({ left: 6, right: 3 });
  });

  it('orients matching tiles on left and right ends', () => {
    const chain = [placed(tile(1, 4, 4), 4, 4)];
    const match = tile(2, 4, 1);
    const miss = tile(3, 5, 2);
    expect(canAttachToEnd(match, 4)).toBe(true);
    expect(canAttachToEnd(miss, 4)).toBe(false);

    const left = placeTile(chain, match, 'left');
    expect(left).not.toBeNull();
    expect(left![0]).toMatchObject({ displayLeft: 1, displayRight: 4 });
    expect(getChainEnds(left!)).toEqual({ left: 1, right: 4 });

    const right = placeTile(chain, match, 'right');
    expect(right).not.toBeNull();
    expect(right![1]).toMatchObject({ displayLeft: 4, displayRight: 1 });
    expect(placeTile(chain, miss, 'left')).toBeNull();
  });

  it('lists both ends when a double matches open 3/3', () => {
    const chain = [
      placed(tile(1, 3, 5), 3, 5),
      placed(tile(2, 5, 3), 5, 3),
    ];
    expect(getChainEnds(chain)).toEqual({ left: 3, right: 3 });
    const hand = [tile(3, 3, 3), tile(4, 0, 1)];
    const moves = getValidMoves(hand, chain);
    expect(moves.some((m) => m.tileId === 3 && m.end === 'left')).toBe(true);
    expect(moves.some((m) => m.tileId === 3 && m.end === 'right')).toBe(true);
    expect(moves.some((m) => m.tileId === 4)).toBe(false);
    expect(isValidPlay(hand, chain, 3, 'left')).toBe(true);
    expect(isValidPlay(hand, chain, 4, 'left')).toBe(false);
  });
});

describe('win / block / draw rules', () => {
  it('declares empty-hand win via playTile', () => {
    const last = tile(7, 2, 6);
    const state: DominoesState = {
      currentPlayer: 0,
      hands: [[last], [tile(8, 1, 1)]],
      chain: [placed(tile(9, 6, 6), 6, 6)],
      boneyard: [tile(10, 0, 0), tile(11, 0, 1)],
      phase: 'playing',
      winner: null,
      ruleVariant: 'draw',
    };
    const next = playTile(state, 0, 7, 'right');
    expect(next).not.toBeNull();
    expect(next!.phase).toBe('won');
    expect(next!.winner).toBe(0);
    expect(next!.hands[0]).toHaveLength(0);
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
    const chain = [placed(tile(1, 6, 6), 6, 6)];
    const state: DominoesState = {
      currentPlayer: 0,
      hands: [[tile(2, 1, 2)], [tile(3, 3, 4)]],
      chain,
      boneyard: [tile(4, 0, 0), tile(5, 0, 1), tile(6, 0, 2)],
      phase: 'playing',
      winner: null,
      ruleVariant: 'block',
    };
    expect(pass(state, 0)).not.toBeNull();
    expect(pass(state, 0)!.phase).toBe('blocked');
    expect(drawTiles(state, 0).phase).toBe('blocked');
  });

  it('draw variant: cannot pass while drawable tiles remain', () => {
    const chain = [placed(tile(1, 6, 6), 6, 6)];
    const state: DominoesState = {
      currentPlayer: 0,
      hands: [[tile(2, 1, 2)], [tile(3, 3, 4)]],
      chain,
      boneyard: [tile(4, 0, 0), tile(5, 0, 1), tile(6, 5, 5)],
      phase: 'playing',
      winner: null,
      ruleVariant: 'draw',
    };
    expect(pass(state, 0)).toBeNull();
    const drawn = drawTiles(state, 0);
    expect(drawn.hands[0].length).toBeGreaterThanOrEqual(2);
  });
});

describe('pickBotMove (adversarial bot)', () => {
  it('returns null when the hand has no legal attaches', () => {
    const chain = [placed(tile(1, 6, 6), 6, 6)];
    const hand = [tile(2, 1, 2), tile(3, 3, 4)];
    expect(pickBotMove(hand, chain, 7, 'hard')).toBeNull();
  });

  it('returns the only legal move without scoring', () => {
    const chain = [
      placed(tile(1, 4, 5), 4, 5),
    ];
    const hand = [tile(2, 4, 1), tile(3, 0, 0)];
    expect(getValidMoves(hand, chain)).toEqual([{ tileId: 2, end: 'left' }]);
    expect(pickBotMove(hand, chain, 7, 'easy')).toEqual({ tileId: 2, end: 'left' });
  });

  it('hard prefers shedding a high double when both plays are legal', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const chain = [placed(tile(1, 6, 3), 6, 3)];
    const hand = [
      tile(2, 6, 6), // double-6: high score under hard (tileSum + double bonus)
      tile(3, 3, 1), // light match on the right end
    ];
    const picked = pickBotMove(hand, chain, 7, 'hard');
    expect(picked).toEqual({ tileId: 2, end: 'left' });
  });
});
