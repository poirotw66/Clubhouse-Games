import { LOWEST_CARD_ID, buildDeck, isDeuce, power, shuffle, sortCards } from './cards';
import { beats, detectPlay, legalPlays } from './plays';
import { seedFromCode, streamRng } from './rng';
import { HAND_SIZE, SEATS } from './types';
import type {
  Card,
  CardId,
  DifficultyId,
  GameState,
  HouseRules,
  Outcome,
  Play,
  Seat,
  SeatScore,
} from './types';

export const DEFAULT_RULES: HouseRules = {
  straights: 'topCard',
  sizeLadder: true,
  deuceDouble: true,
};

export function deal(
  seedCode: string,
  difficulty: DifficultyId,
  rules: HouseRules = DEFAULT_RULES,
): GameState {
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
    pendingDingDaViolator: null,
    dingDaViolator: null,
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
  const handBefore = state.hands[seat];
  const nextInOrder = ((seat + 1) % SEATS) as Seat;
  const nextCount = state.hands[nextInOrder]?.length ?? 0;
  const nextCanActImmediately = !next.passed.includes(nextInOrder);

  const ids = new Set(candidate.cards.map((card) => card.id));
  next.hands[seat] = next.hands[seat].filter((card) => !ids.has(card.id));
  next.table = candidate;
  next.tableOwner = seat;
  next.log.push({ seat, play: candidate });

  if (next.hands[seat].length === 0) {
    next.phase = 'over';
    next.winner = seat;
    const pending = state.pendingDingDaViolator;
    next.dingDaViolator =
      pending !== undefined && pending !== null && (pending + 1) % SEATS === seat
        ? pending
        : null;
    next.pendingDingDaViolator = null;
    return next;
  }

  next.dingDaViolator = null;
  next.pendingDingDaViolator =
    nextCanActImmediately && isDingDaViolation(handBefore, candidate, nextCount)
      ? seat
      : null;
  next.turn = nextSeat(next);
  return next;
}

export function pass(state: GameState): GameState {
  if (!canPass(state)) return state;

  const next = clone(state);
  next.passed.push(next.turn);
  next.log.push({ seat: next.turn, play: null });
  next.pendingDingDaViolator = null;

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
 * Check whether a played single violates the Taiwanese "頂大" (Ding Da) anti-collusion rule.
 *
 * When the next player holds only 1 card and the current player plays a single card,
 * the current player MUST play their highest single card. Failing to do so is a
 * violation that triggers the full penalty buyout ("包賠") if the next player finishes.
 */
export function isDingDaViolation(
  hand: readonly Card[],
  played: Play,
  nextPlayerCount: number,
): boolean {
  if (nextPlayerCount !== 1) return false;
  if (played.type !== 'single') return false;
  const playedPower = power(played.cards[0]);
  return hand.some((c) => power(c) > playedPower);
}

export interface DingDaPenaltyResult {
  deltas: number[];
  violator: Seat;
  totalPaid: number;
}

/**
 * Enforce the Taiwanese "包賠" (full penalty buyout) rule for a 頂大 violation.
 *
 * When a player commits a Ding Da violation and the next seat wins on their final card,
 * all innocent non-winning seats pay 0 chips, and the violator is liable for the entire
 * pot owed to the winner. Zero-sum balance across all seats is strictly preserved.
 */
export function enforceDingDaPenalty(
  result: Outcome,
  violatorSeat: Seat,
): DingDaPenaltyResult {
  const deltas = result.scores.map(() => 0);
  deltas[result.winner] = result.pot;
  deltas[violatorSeat] = -result.pot;
  return {
    deltas,
    violator: violatorSeat,
    totalPaid: result.pot,
  };
}

/**
 * Penalty multiplier for being left holding `remaining` cards.
 *
 * The steps are steep on purpose: eight cards is not twice as bad as four, it
 * is four times as bad, and never getting a card down at all is 52.
 */
export function sizeMultiplier(remaining: number, enabled = true): number {
  if (!enabled) return 1;
  if (remaining >= HAND_SIZE) return 4;
  if (remaining >= 10) return 3;
  if (remaining >= 8) return 2;
  return 1;
}

export function scoreSeat(
  hand: readonly Card[],
  seat: Seat,
  rules: Pick<HouseRules, 'sizeLadder' | 'deuceDouble'> = DEFAULT_RULES,
): SeatScore {
  const remaining = hand.length;
  const deuces = hand.filter(isDeuce).length;
  const base = remaining * sizeMultiplier(remaining, rules.sizeLadder);
  const factor = rules.deuceDouble ? 2 ** deuces : 1;
  return { seat, remaining, base, deuces, penalty: base * factor };
}

export function outcome(state: GameState): Outcome | null {
  if (state.phase !== 'over' || state.winner === null) return null;
  const scores = state.hands.map((hand, seat) =>
    scoreSeat(hand, seat, state.rules),
  );
  // Winner pays nothing — wipe their penalty so the pot is only losers' debt.
  scores[state.winner] = {
    ...scores[state.winner],
    base: 0,
    deuces: scores[state.winner].deuces,
    penalty: 0,
  };
  const pot = scores.reduce((total, entry) => total + entry.penalty, 0);
  return {
    winner: state.winner,
    scores,
    pot,
    ...(state.dingDaViolator != null ? { dingDaViolator: state.dingDaViolator } : {}),
  };
}

export function allCards(state: GameState): Card[] {
  return state.hands.flat();
}

export function findCard(state: GameState, id: CardId): Card | undefined {
  return state.hands.flat().find((card) => card.id === id);
}
