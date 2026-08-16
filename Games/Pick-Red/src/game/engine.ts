import { SUITS, buildDeck, capturableBy, pointsOf, shuffle, sumPoints } from './cards';
import { seedFromCode, streamRng } from './rng';
import type { Card, CardId, DifficultyId, GameState, Outcome, Side } from './types';

export const HAND_SIZE = 12;
export const TABLE_SIZE = 4;

/**
 * 12 + 12 + 4 + 24 = 52, and each player plays twelve cards while flipping one
 * each time, so the pile is consumed exactly. That the deal balances to the
 * card is not a coincidence to rely on silently — the self-checks assert it.
 */
export const PILE_SIZE = 52 - HAND_SIZE * 2 - TABLE_SIZE;

export function deal(seedCode: string, difficulty: DifficultyId, leader: Side = 'player'): GameState {
  const r = streamRng(seedFromCode(seedCode), 'deal');
  const deck = shuffle(buildDeck(), r);

  return {
    seedCode,
    difficulty,
    leader,
    phase: leader === 'player' ? 'player_play' : 'cpu_play',
    turn: leader,
    hands: {
      player: deck.slice(0, HAND_SIZE),
      cpu: deck.slice(HAND_SIZE, HAND_SIZE * 2),
    },
    captured: { player: [], cpu: [] },
    table: deck.slice(HAND_SIZE * 2, HAND_SIZE * 2 + TABLE_SIZE),
    pile: deck.slice(HAND_SIZE * 2 + TABLE_SIZE),
    pending: null,
    log: [],
    spotlight: [],
  };
}

function clone(state: GameState): GameState {
  return {
    ...state,
    hands: { player: [...state.hands.player], cpu: [...state.hands.cpu] },
    captured: { player: [...state.captured.player], cpu: [...state.captured.cpu] },
    table: [...state.table],
    pile: [...state.pile],
    log: [...state.log],
  };
}

const SUIT_ORDER = new Map(SUITS.map((suit, index) => [suit, index]));

/**
 * Which table card to take when several match and nobody is choosing — the
 * flip, and the easy CPU. Highest points first; the rank and suit tie-breaks
 * exist only so the result is reproducible from the seed rather than depending
 * on array order.
 */
export function bestCapture(card: Card, table: readonly Card[]): Card | null {
  const options = capturableBy(card, table);
  if (options.length === 0) return null;
  return [...options].sort(
    (a, b) =>
      pointsOf(b) - pointsOf(a) ||
      b.rank - a.rank ||
      (SUIT_ORDER.get(a.suit) ?? 0) - (SUIT_ORDER.get(b.suit) ?? 0),
  )[0];
}

/**
 * Put `played` against the table: take `taken` with it, or leave it there when
 * nothing matched. The single place where cards move, so the 52-card invariant
 * has one place to be violated rather than four.
 */
function resolve(
  state: GameState,
  side: Side,
  played: Card,
  taken: Card | null,
  source: 'hand' | 'pile',
): void {
  const tableBefore = [...state.table];

  if (taken) {
    state.table = state.table.filter((card) => card.id !== taken.id);
    state.captured[side].push(played, taken);
    state.spotlight = [played.id, taken.id];
  } else {
    state.table.push(played);
    state.spotlight = [played.id];
  }
  state.log.push({
    by: side,
    played,
    taken,
    source,
    points: pointsOf(played) + (taken ? pointsOf(taken) : 0),
    tableBefore,
  });
}

function isFinished(state: GameState): boolean {
  return state.hands.player.length === 0 && state.hands.cpu.length === 0 && state.pile.length === 0;
}

/** After a flip, hand play passes to the other side. */
function advanceTurn(state: GameState): void {
  if (isFinished(state)) {
    state.phase = 'over';
    state.turn = 'player';
    return;
  }
  state.turn = state.turn === 'player' ? 'cpu' : 'player';
  state.phase = state.turn === 'player' ? 'player_play' : 'cpu_play';
}

/**
 * The player commits a hand card. When it matches more than one table card the
 * state parks in 'player_pick' instead of choosing for them — which of two
 * equal-ranked cards you take is a real decision, because the one you leave
 * behind stays available to the opponent.
 */
export function playCard(state: GameState, cardId: CardId): GameState {
  if (state.phase !== 'player_play') return state;
  const card = state.hands.player.find((c) => c.id === cardId);
  if (!card) return state;

  const next = clone(state);
  next.hands.player = next.hands.player.filter((c) => c.id !== cardId);

  const options = capturableBy(card, next.table);
  if (options.length > 1) {
    next.pending = card;
    next.phase = 'player_pick';
    next.spotlight = options.map((c) => c.id);
    return next;
  }

  resolve(next, 'player', card, options[0] ?? null, 'hand');
  next.phase = 'flip';
  return next;
}

/** Resolve a parked 'player_pick' against the chosen table card. */
export function choosePick(state: GameState, tableCardId: CardId): GameState {
  if (state.phase !== 'player_pick' || !state.pending) return state;
  const taken = state.table.find((c) => c.id === tableCardId);
  if (!taken || !capturableBy(state.pending, [taken]).length) return state;

  const next = clone(state);
  resolve(next, 'player', next.pending!, taken, 'hand');
  next.pending = null;
  next.phase = 'flip';
  return next;
}

/**
 * The half of the turn nobody controls. Kept as its own step so the UI can show
 * it landing rather than folding it into the play and making the game look like
 * it captured two cards at once.
 */
export function flip(state: GameState): GameState {
  if (state.phase !== 'flip') return state;
  const next = clone(state);
  const card = next.pile.shift();

  if (card) {
    resolve(next, next.turn, card, bestCapture(card, next.table), 'pile');
  }
  advanceTurn(next);
  return next;
}

/** Apply a CPU hand card that some strategy already picked. */
export function applyCpuPlay(state: GameState, card: Card, taken: Card | null): GameState {
  const next = clone(state);
  next.hands.cpu = next.hands.cpu.filter((c) => c.id !== card.id);
  resolve(next, 'cpu', card, taken, 'hand');
  next.phase = 'flip';
  return next;
}

export function score(state: GameState, side: Side): number {
  return sumPoints(state.captured[side]);
}

export function outcome(state: GameState): Outcome {
  const playerPoints = score(state, 'player');
  const cpuPoints = score(state, 'cpu');
  return {
    playerPoints,
    cpuPoints,
    // Cards abandoned on the table belong to nobody, so the two scores do not
    // have to add up to 208 and both players can finish under the winning line.
    wastedPoints: sumPoints(state.table),
    result: playerPoints > cpuPoints ? 'win' : playerPoints < cpuPoints ? 'loss' : 'draw',
  };
}

/** Every card in the game, wherever it currently sits. Used by the invariants. */
export function allCards(state: GameState): Card[] {
  return [
    ...state.hands.player,
    ...state.hands.cpu,
    ...state.captured.player,
    ...state.captured.cpu,
    ...state.table,
    ...state.pile,
    ...(state.pending ? [state.pending] : []),
  ];
}
