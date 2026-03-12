/**
 * Double-six dominoes: Draw Game variant.
 * 28 tiles (0-0 to 6-6), 2 players, 7 tiles each, play to line ends, draw when cannot play.
 * Win: empty hand. Block: no one can play, lower pip sum wins.
 */

export interface Tile {
  id: number;
  left: number;
  right: number;
}

/** One tile placed on the board; displayLeft/Right are pips from left to right along the chain. */
export interface PlacedTile {
  tile: Tile;
  displayLeft: number;
  displayRight: number;
}

export type PlayerId = 0 | 1;

export interface DominoesState {
  /** Current player (0 or 1). */
  currentPlayer: PlayerId;
  /** Hands: hands[0] and hands[1], each array of tiles. */
  hands: [Tile[], Tile[]];
  /** Tiles on the table in order (left to right). */
  chain: PlacedTile[];
  /** Remaining tiles to draw from. Leave 2 in draw game. */
  boneyard: Tile[];
  /** 'playing' | 'won' | 'blocked' */
  phase: 'playing' | 'won' | 'blocked';
  /** Set when phase is 'won' (who emptied hand) or 'blocked' (who had lower pip sum). */
  winner: PlayerId | null;
}

const BONEYARD_LEAVE = 2;
const HAND_SIZE = 7;

/** Build double-six set: 28 tiles with unique ids. */
export function createSet(): Tile[] {
  const tiles: Tile[] = [];
  let id = 0;
  for (let a = 0; a <= 6; a++) {
    for (let b = a; b <= 6; b++) {
      tiles.push({ id: id++, left: a, right: b });
    }
  }
  return tiles;
}

/** Fisher–Yates shuffle. */
function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Pip sum of a tile. */
export function tileSum(t: Tile): number {
  return t.left + t.right;
}

/** Pip sum of all tiles in a hand. */
export function handSum(hand: Tile[]): number {
  return hand.reduce((s, t) => s + tileSum(t), 0);
}

/** Check if tile can attach to a given end (pip value). */
export function canAttachToEnd(tile: Tile, endPip: number): boolean {
  return tile.left === endPip || tile.right === endPip;
}

/** Get the pip that would face outward when attaching tile to endPip (the "other" pip). */
export function getOutwardPip(tile: Tile, endPip: number): number | null {
  if (tile.left === endPip) return tile.right;
  if (tile.right === endPip) return tile.left;
  return null;
}

/** Left and right end pips of the chain (undefined if chain empty). */
export function getChainEnds(chain: PlacedTile[]): { left: number; right: number } | null {
  if (chain.length === 0) return null;
  return {
    left: chain[0].displayLeft,
    right: chain[chain.length - 1].displayRight,
  };
}

/** Tiles in hand that can be played on at least one end. */
export function getPlayableTiles(
  hand: Tile[],
  chain: PlacedTile[]
): Tile[] {
  const ends = getChainEnds(chain);
  if (!ends) return hand;
  return hand.filter(
    (t) => canAttachToEnd(t, ends.left) || canAttachToEnd(t, ends.right)
  );
}

/** Can the current player play at least one tile? */
export function canPlay(hand: Tile[], chain: PlacedTile[]): boolean {
  return getPlayableTiles(hand, chain).length > 0;
}

/** Place tile on the given end; returns new chain or null if invalid. */
export function placeTile(
  chain: PlacedTile[],
  tile: Tile,
  end: 'left' | 'right'
): PlacedTile[] | null {
  const ends = getChainEnds(chain);
  const endPip = ends ? (end === 'left' ? ends.left : ends.right) : null;
  if (chain.length > 0 && endPip !== null) {
    const out = getOutwardPip(tile, endPip);
    if (out === null) return null;
    const placed: PlacedTile =
      end === 'left'
        ? { tile, displayLeft: out, displayRight: endPip }
        : { tile, displayLeft: endPip, displayRight: out };
    return end === 'left' ? [placed, ...chain] : [...chain, placed];
  }
  if (chain.length === 0) {
    return [{ tile, displayLeft: tile.left, displayRight: tile.right }];
  }
  return null;
}

/** Remove tile from hand by id. */
function removeFromHand(hand: Tile[], tileId: number): Tile[] {
  return hand.filter((t) => t.id !== tileId);
}

/** Draw one from boneyard; returns [newBoneyard, drawnTile or null]. */
function drawOne(boneyard: Tile[]): [Tile[], Tile | null] {
  if (boneyard.length === 0) return [[], null];
  const [drawn, ...rest] = boneyard;
  return [rest, drawn];
}

/** Create initial state: shuffled set, 7 each, first tile played by player with highest double (or 6-6, 5-5, ...). */
export function createInitialState(): DominoesState {
  const shuffled = shuffle(createSet());
  const hand0: Tile[] = shuffled.slice(0, HAND_SIZE);
  const hand1: Tile[] = shuffled.slice(HAND_SIZE, HAND_SIZE * 2);
  const boneyard = shuffled.slice(HAND_SIZE * 2);

  // First play: who has the highest double (6-6, 5-5, ...) plays it. Else random.
  const highestDouble = (hand: Tile[]): Tile | null => {
    for (let d = 6; d >= 0; d--) {
      const t = hand.find((x) => x.left === d && x.right === d);
      if (t) return t;
    }
    return null;
  };
  const d0 = highestDouble(hand0);
  const d1 = highestDouble(hand1);
  let currentPlayer: PlayerId = 0;
  let chain: PlacedTile[] = [];
  let hands: [Tile[], Tile[]] = [
    [...hand0],
    [...hand1],
  ];

  let firstPlayer: PlayerId;
  if (d0 && d1) {
    firstPlayer = d0.left >= d1.left ? 0 : 1;
    const first = firstPlayer === 0 ? d0 : d1;
    chain = [{ tile: first, displayLeft: first.left, displayRight: first.right }];
    hands[firstPlayer] = removeFromHand(hands[firstPlayer], first.id);
  } else if (d0) {
    firstPlayer = 0;
    chain = [{ tile: d0, displayLeft: d0.left, displayRight: d0.right }];
    hands[0] = removeFromHand(hands[0], d0.id);
  } else if (d1) {
    firstPlayer = 1;
    chain = [{ tile: d1, displayLeft: d1.left, displayRight: d1.right }];
    hands[1] = removeFromHand(hands[1], d1.id);
  } else {
    firstPlayer = 0;
    const first = hands[0][0];
    chain = [{ tile: first, displayLeft: first.left, displayRight: first.right }];
    hands[0] = removeFromHand(hands[0], first.id);
  }
  currentPlayer = firstPlayer === 0 ? 1 : 0;

  return {
    currentPlayer,
    hands,
    chain,
    boneyard,
    phase: 'playing',
    winner: null,
  };
}

/** Play a tile at an end. Returns new state or null if invalid. */
export function playTile(
  state: DominoesState,
  player: PlayerId,
  tileId: number,
  end: 'left' | 'right'
): DominoesState | null {
  if (state.phase !== 'playing' || state.currentPlayer !== player) return null;
  const hand = state.hands[player];
  const tile = hand.find((t) => t.id === tileId);
  if (!tile) return null;
  const newChain = placeTile(state.chain, tile, end);
  if (!newChain) return null;
  const newHands: [Tile[], Tile[]] = [...state.hands];
  newHands[player] = removeFromHand(hand, tileId);
  const nextPlayer: PlayerId = player === 0 ? 1 : 0;
  const won = newHands[player].length === 0;
  return {
    ...state,
    chain: newChain,
    hands: newHands,
    currentPlayer: won ? state.currentPlayer : nextPlayer,
    phase: won ? 'won' : 'playing',
    winner: won ? player : null,
  };
}

/** Draw from boneyard (until can play or boneyard has <= BONEYARD_LEAVE). Returns new state. */
export function drawTiles(state: DominoesState, player: PlayerId): DominoesState {
  if (state.phase !== 'playing' || state.currentPlayer !== player) return state;
  let s = state;
  while (s.boneyard.length > BONEYARD_LEAVE && !canPlay(s.hands[player], s.chain)) {
    const [newBoneyard, drawn] = drawOne(s.boneyard);
    if (!drawn) break;
    const newHands: [Tile[], Tile[]] = [...s.hands];
    newHands[player] = [...newHands[player], drawn];
    s = {
      ...s,
      boneyard: newBoneyard,
      hands: newHands,
    };
  }
  if (!canPlay(s.hands[player], s.chain) && s.boneyard.length <= BONEYARD_LEAVE) {
    return passTurn(s);
  }
  return s;
}

/** Pass turn to other player. If next cannot play and boneyard <= 2, declare block. */
function passTurn(state: DominoesState): DominoesState {
  const next: PlayerId = state.currentPlayer === 0 ? 1 : 0;
  const nextCanPlay = canPlay(state.hands[next], state.chain);
  const boneyardExhausted = state.boneyard.length <= BONEYARD_LEAVE;
  if (!nextCanPlay && boneyardExhausted) {
    const sum0 = handSum(state.hands[0]);
    const sum1 = handSum(state.hands[1]);
    const winner: PlayerId = sum0 <= sum1 ? 0 : 1;
    return {
      ...state,
      currentPlayer: next,
      phase: 'blocked',
      winner,
    };
  }
  return { ...state, currentPlayer: next };
}

/** After current player draws and still cannot play, call pass (or we do it inside drawTiles). */
export function pass(state: DominoesState, player: PlayerId): DominoesState | null {
  if (state.phase !== 'playing' || state.currentPlayer !== player) return null;
  if (canPlay(state.hands[player], state.chain)) return null;
  return passTurn(state);
}

/** Check if playing this tile at this end is valid. */
export function isValidPlay(
  hand: Tile[],
  chain: PlacedTile[],
  tileId: number,
  end: 'left' | 'right'
): boolean {
  const tile = hand.find((t) => t.id === tileId);
  if (!tile) return false;
  const newChain = placeTile(chain, tile, end);
  return newChain !== null;
}

/** All valid moves: [tileId, end]. */
export function getValidMoves(
  hand: Tile[],
  chain: PlacedTile[]
): Array<{ tileId: number; end: 'left' | 'right' }> {
  const ends = getChainEnds(chain);
  if (!ends) return hand.map((t) => ({ tileId: t.id, end: 'left' as const }));
  const moves: Array<{ tileId: number; end: 'left' | 'right' }> = [];
  for (const t of hand) {
    if (canAttachToEnd(t, ends.left)) moves.push({ tileId: t.id, end: 'left' });
    if (canAttachToEnd(t, ends.right)) moves.push({ tileId: t.id, end: 'right' });
  }
  return moves;
}

/** Pick a random valid move for bot. */
export function pickBotMove(
  hand: Tile[],
  chain: PlacedTile[]
): { tileId: number; end: 'left' | 'right' } | null {
  const moves = getValidMoves(hand, chain);
  if (moves.length === 0) return null;
  return moves[Math.floor(Math.random() * moves.length)];
}
