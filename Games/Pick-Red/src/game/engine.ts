import { SUITS, buildDeck, capturableBy, parScore, pointsOf, shuffle, sumPoints } from './cards';
import { seedFromCode, streamRng } from './rng';
import { HUMAN } from './types';
import type { Card, CardId, DifficultyId, GameState, Outcome, Rules, Seat } from './types';

/**
 * The hands always total 24 cards however many are playing, which is what makes
 * every deal balance: 24 in hands + 4 on the table + 24 in the pile = 52, and
 * since every hand card is followed by one flip, the pile is consumed exactly.
 */
export const DEALT_TOTAL = 24;
export const TABLE_SIZE = 4;
export const PILE_SIZE = 52 - DEALT_TOTAL - TABLE_SIZE;

export function handSize(players: number): number {
  return DEALT_TOTAL / players;
}

export function deal(
  seedCode: string,
  difficulty: DifficultyId,
  rules: Rules,
  leader: Seat = HUMAN,
): GameState {
  const r = streamRng(seedFromCode(seedCode), 'deal');
  const deck = shuffle(buildDeck(), r);
  const size = handSize(rules.players);

  const hands: Card[][] = [];
  for (let seat = 0; seat < rules.players; seat++) {
    hands.push(deck.slice(seat * size, (seat + 1) * size));
  }

  return {
    seedCode,
    rules,
    difficulty,
    leader,
    phase: 'play',
    turn: leader,
    hands,
    captured: hands.map(() => []),
    table: deck.slice(DEALT_TOTAL, DEALT_TOTAL + TABLE_SIZE),
    pile: deck.slice(DEALT_TOTAL + TABLE_SIZE),
    pending: null,
    log: [],
    spotlight: [],
  };
}

function clone(state: GameState): GameState {
  return {
    ...state,
    hands: state.hands.map((hand) => [...hand]),
    captured: state.captured.map((pile) => [...pile]),
    table: [...state.table],
    pile: [...state.pile],
    log: [...state.log],
  };
}

const SUIT_ORDER = new Map(SUITS.map((suit, index) => [suit, index]));

/**
 * The default capture when nobody is choosing. Highest points first; the rank
 * and suit tie-breaks exist only so the result is reproducible from the seed
 * rather than depending on array order.
 */
export function bestCapture(card: Card, table: readonly Card[], blackAces = false): Card | null {
  const options = capturableBy(card, table);
  if (options.length === 0) return null;
  return [...options].sort(
    (a, b) =>
      pointsOf(b, blackAces) - pointsOf(a, blackAces) ||
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
  seat: Seat,
  played: Card,
  taken: Card | null,
  source: 'hand' | 'pile',
): void {
  const tableBefore = [...state.table];

  if (taken) {
    state.table = state.table.filter((card) => card.id !== taken.id);
    state.captured[seat].push(played, taken);
    state.spotlight = [played.id, taken.id];
  } else {
    state.table.push(played);
    state.spotlight = [played.id];
  }

  state.log.push({
    by: seat,
    played,
    taken,
    source,
    points:
      pointsOf(played, state.rules.blackAces) +
      (taken ? pointsOf(taken, state.rules.blackAces) : 0),
    tableBefore,
  });
}

function isFinished(state: GameState): boolean {
  return state.hands.every((hand) => hand.length === 0) && state.pile.length === 0;
}

/** After a flip, play passes to the next seat in order. */
function advanceTurn(state: GameState): void {
  if (isFinished(state)) {
    state.phase = 'over';
    return;
  }
  state.turn = (state.turn + 1) % state.rules.players;
  state.phase = 'play';
}

/**
 * The seat on turn commits a hand card. When it matches more than one table
 * card the state parks in 'pick_play' instead of choosing for them — which of
 * two equal-ranked cards you take is a real decision, because the one you leave
 * behind stays available to everyone else.
 */
export function playCard(state: GameState, cardId: CardId): GameState {
  if (state.phase !== 'play') return state;
  const seat = state.turn;
  const card = state.hands[seat].find((c) => c.id === cardId);
  if (!card) return state;

  const next = clone(state);
  next.hands[seat] = next.hands[seat].filter((c) => c.id !== cardId);

  const options = capturableBy(card, next.table);
  if (options.length > 1) {
    next.pending = card;
    next.phase = 'pick_play';
    next.spotlight = options.map((c) => c.id);
    return next;
  }

  resolve(next, seat, card, options[0] ?? null, 'hand');
  next.phase = 'flip';
  return next;
}

/**
 * Reveal the pile card. It parks in 'pick_flip' on a multi-way match for the
 * same reason a hand card does: in the real game the person who turned the card
 * over decides what it takes.
 */
export function flip(state: GameState): GameState {
  if (state.phase !== 'flip') return state;
  const next = clone(state);
  const card = next.pile.shift();

  if (!card) {
    advanceTurn(next);
    return next;
  }

  const options = capturableBy(card, next.table);
  if (options.length > 1) {
    next.pending = card;
    next.phase = 'pick_flip';
    next.spotlight = options.map((c) => c.id);
    return next;
  }

  resolve(next, next.turn, card, options[0] ?? null, 'pile');
  advanceTurn(next);
  return next;
}

/** Resolve an outstanding pick against the chosen table card. */
export function choosePick(state: GameState, tableCardId: CardId): GameState {
  if (state.phase !== 'pick_play' && state.phase !== 'pick_flip') return state;
  if (!state.pending) return state;

  const taken = state.table.find((c) => c.id === tableCardId);
  if (!taken || !capturableBy(state.pending, [taken]).length) return state;

  const fromPile = state.phase === 'pick_flip';
  const next = clone(state);
  resolve(next, next.turn, next.pending!, taken, fromPile ? 'pile' : 'hand');
  next.pending = null;

  if (fromPile) advanceTurn(next);
  else next.phase = 'flip';
  return next;
}

/** Apply a hand card that some CPU strategy already picked. */
export function applyPlay(state: GameState, card: Card, taken: Card | null): GameState {
  const next = clone(state);
  next.hands[next.turn] = next.hands[next.turn].filter((c) => c.id !== card.id);
  resolve(next, next.turn, card, taken, 'hand');
  next.phase = 'flip';
  return next;
}

export function score(state: GameState, seat: Seat): number {
  return sumPoints(state.captured[seat], state.rules.blackAces);
}

export function outcome(state: GameState): Outcome {
  const scores = state.captured.map((pile) => sumPoints(pile, state.rules.blackAces));
  const best = Math.max(...scores);
  const winners = scores.flatMap((points, seat) => (points === best ? [seat] : []));

  return {
    scores,
    par: parScore(state.rules.players, state.rules.blackAces),
    // Cards abandoned on the table belong to nobody, so the scores do not have
    // to add up to the deck total.
    wastedPoints: sumPoints(state.table, state.rules.blackAces),
    winners,
    result: !winners.includes(HUMAN) ? 'loss' : winners.length > 1 ? 'draw' : 'win',
  };
}

/** Every card in the game, wherever it currently sits. Used by the invariants. */
export function allCards(state: GameState): Card[] {
  return [
    ...state.hands.flat(),
    ...state.captured.flat(),
    ...state.table,
    ...state.pile,
    ...(state.pending ? [state.pending] : []),
  ];
}
