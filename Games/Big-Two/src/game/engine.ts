import { LOWEST_CARD_ID, buildDeck, isDeuce, shuffle, sortCards } from './cards';
import { beats, detectPlay, legalPlays } from './plays';
import { seedFromCode, streamRng } from './rng';
import { HAND_SIZE, SEATS } from './types';
import type {
  Card,
  CardId,
  DifficultyId,
  GameState,
  Outcome,
  Play,
  Rules,
  Seat,
  SeatScore,
} from './types';

export function deal(seedCode: string, difficulty: DifficultyId, rules: Rules): GameState {
  const r = streamRng(seedFromCode(seedCode), 'deal');
  const deck = shuffle(buildDeck(), r);

  const hands: Card[][] = [];
  for (let seat = 0; seat < SEATS; seat++) {
    hands.push(sortCards(deck.slice(seat * HAND_SIZE, (seat + 1) * HAND_SIZE)));
  }

  return {
    seedCode,
    rules,
    difficulty,
    phase: 'playing',
    // Whoever was dealt the ♣3 opens, and their first play must contain it.
    turn: hands.findIndex((hand) => hand.some((card) => card.id === LOWEST_CARD_ID)),
    hands,
    table: null,
    tableOwner: null,
    passed: [],
    log: [],
    winner: null,
  };
}

function clone(state: GameState): GameState {
  return {
    ...state,
    hands: state.hands.map((hand) => [...hand]),
    passed: [...state.passed],
    log: [...state.log],
  };
}

/** True until the ♣3 has been played, which is only ever on the opening play. */
export function isOpeningPlay(state: GameState): boolean {
  return state.log.length === 0;
}

/**
 * Move to the next seat that is still live in this trick.
 *
 * A seat that has passed is out until the trick resets, so the turn skips it
 * rather than asking it again.
 */
function nextSeat(state: GameState): Seat {
  let seat = state.turn;
  for (let step = 0; step < SEATS; step++) {
    seat = (seat + 1) % SEATS;
    if (!state.passed.includes(seat)) return seat;
  }
  return state.turn;
}

/**
 * Whether `play` is legal right now, including the opening ♣3 requirement.
 *
 * Kept as one predicate used by both the CPU and the UI, so the two can never
 * disagree about what is allowed.
 */
export function isLegal(state: GameState, play: Play): boolean {
  if (state.phase !== 'playing') return false;

  const hand = state.hands[state.turn];
  if (!play.cards.every((card) => hand.some((held) => held.id === card.id))) return false;
  if (isOpeningPlay(state) && !play.cards.some((card) => card.id === LOWEST_CARD_ID)) return false;

  return beats(play, state.table);
}

export function playsFor(state: GameState): Play[] {
  const all = legalPlays(state.hands[state.turn], state.table, state.rules.straights);
  if (!isOpeningPlay(state)) return all;
  return all.filter((play) => play.cards.some((card) => card.id === LOWEST_CARD_ID));
}

/** Whether the seat on turn is allowed to pass — never on the opening play. */
export function canPass(state: GameState): boolean {
  return state.phase === 'playing' && state.table !== null;
}

export function play(state: GameState, cards: readonly Card[]): GameState {
  if (state.phase !== 'playing') return state;
  const candidate = detectPlay(cards, state.rules.straights);
  if (!candidate || !isLegal(state, candidate)) return state;

  const next = clone(state);
  const seat = next.turn;
  const ids = new Set(candidate.cards.map((card) => card.id));
  next.hands[seat] = next.hands[seat].filter((card) => !ids.has(card.id));
  next.table = candidate;
  next.tableOwner = seat;
  next.log.push({ seat, play: candidate });

  if (next.hands[seat].length === 0) {
    next.phase = 'over';
    next.winner = seat;
    return next;
  }

  next.turn = nextSeat(next);
  return next;
}

export function pass(state: GameState): GameState {
  if (!canPass(state)) return state;

  const next = clone(state);
  next.passed.push(next.turn);
  next.log.push({ seat: next.turn, play: null });

  // Everyone else has passed, so the last player to put cards down takes the
  // lead and may open with any size they like.
  if (next.passed.length >= SEATS - 1) {
    next.turn = next.tableOwner ?? next.turn;
    next.table = null;
    next.tableOwner = null;
    next.passed = [];
    return next;
  }

  next.turn = nextSeat(next);
  return next;
}

/**
 * Penalty multiplier for being left holding `remaining` cards.
 *
 * The steps are steep on purpose: eight cards is not twice as bad as four, it
 * is four times as bad, and never getting a card down at all is 52.
 */
export function sizeMultiplier(remaining: number): number {
  if (remaining >= HAND_SIZE) return 4;
  if (remaining >= 10) return 3;
  if (remaining >= 8) return 2;
  return 1;
}

export function scoreSeat(hand: readonly Card[], seat: Seat): SeatScore {
  const remaining = hand.length;
  const base = remaining * sizeMultiplier(remaining);
  const deuces = hand.filter(isDeuce).length;
  return { seat, remaining, base, deuces, penalty: base * 2 ** deuces };
}

export function outcome(state: GameState): Outcome | null {
  if (state.phase !== 'over' || state.winner === null) return null;
  const scores = state.hands.map((hand, seat) => scoreSeat(hand, seat));
  return {
    winner: state.winner,
    scores,
    pot: scores.reduce((total, entry) => total + entry.penalty, 0),
  };
}

export function allCards(state: GameState): Card[] {
  return state.hands.flat();
}

export function findCard(state: GameState, id: CardId): Card | undefined {
  return state.hands.flat().find((card) => card.id === id);
}
