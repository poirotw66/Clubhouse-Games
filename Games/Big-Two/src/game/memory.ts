import { buildDeck, power } from './cards';
import type { Card, CardId, GameState, Play, Seat } from './types';

/**
 * Cards still somewhere in someone's hand — the public knowledge a careful
 * player builds by watching the log.
 *
 * Big Two has no hidden draws: once a card hits the table it is gone. Counting
 * is just "deck minus everything in the log".
 */
export function remainingCards(state: GameState): Card[] {
  const played = new Set<CardId>();
  for (const entry of state.log) {
    if (!entry.play) continue;
    for (const card of entry.play.cards) played.add(card.id);
  }
  return buildDeck().filter((card) => !played.has(card.id));
}

/** Cards still out that are not in `seat`'s own hand. */
export function unseenBy(state: GameState, seat: Seat): Card[] {
  const mine = new Set(state.hands[seat].map((card) => card.id));
  return remainingCards(state).filter((card) => !mine.has(card.id));
}

/**
 * Whether any other seat could still beat `play` with a same-size combination
 * drawn from the unseen pool.
 *
 * Approximate on purpose: five-card combos among unseen cards are expensive to
 * enumerate every candidate move, so singles/pairs check exactly and five-card
 * plays only ask "is there an unseen card stronger than our top card?" which
 * overestimates danger — the safe bias for holding control.
 */
export function canAnyoneBeat(state: GameState, seat: Seat, play: Play): boolean {
  const pool = unseenBy(state, seat);
  if (play.cards.length === 1) {
    const top = power(play.cards[0]);
    return pool.some((card) => power(card) > top);
  }
  if (play.cards.length === 2) {
    const rank = play.cards[0].rank;
    const ourTop = Math.max(power(play.cards[0]), power(play.cards[1]));
    const byRank = new Map<number, Card[]>();
    for (const card of pool) {
      const list = byRank.get(card.rank) ?? [];
      list.push(card);
      byRank.set(card.rank, list);
    }
    for (const [otherRank, cards] of byRank) {
      if (cards.length < 2) continue;
      if (otherRank !== rank) {
        // Different rank pairs: higher rank always wins.
        const strength = (r: number) => (r >= 3 ? r - 3 : r + 10);
        if (strength(otherRank) > strength(rank)) return true;
        continue;
      }
      const best = [...cards].sort((a, b) => power(b) - power(a));
      if (power(best[0]) > ourTop) return true;
    }
    return false;
  }
  // Five-card: conservative — if any unseen card outranks our strongest card,
  // assume someone might assemble a beating combination.
  const ourTop = Math.max(...play.cards.map(power));
  return pool.some((card) => power(card) > ourTop);
}

/** Seats that look about to finish — the ones you must answer. */
export function finishingSeats(state: GameState, threshold = 3): Seat[] {
  return state.hands
    .map((hand, seat) => ({ seat, n: hand.length }))
    .filter((entry) => entry.n > 0 && entry.n <= threshold)
    .map((entry) => entry.seat);
}

/** True when this play empties the seat's hand. */
export function isFinisher(state: GameState, play: Play): boolean {
  return play.cards.length === state.hands[state.turn].length;
}
