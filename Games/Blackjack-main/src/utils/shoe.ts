import type { Card } from '../types.ts';
import { createDeck } from './deck.ts';

/** Fraction of the shoe dealt before the cut card triggers a reshuffle after the hand. */
export const DEFAULT_PENETRATION = 0.75;

export interface ShoeState {
  cards: Card[];
  /** Total cards when shoe was last shuffled. */
  capacity: number;
  /** Cards remaining when reshuffle is armed (cut card). */
  cutAt: number;
  /** True after crossing the cut card; reshuffle before the next deal. */
  needsReshuffle: boolean;
  deckCount: number;
  penetration: number;
}

export function createShoe(
  deckCount: number,
  penetration: number = DEFAULT_PENETRATION,
): ShoeState {
  const cards = createDeck(deckCount);
  const capacity = cards.length;
  const cutAt = Math.max(1, Math.floor(capacity * (1 - penetration)));
  return {
    cards,
    capacity,
    cutAt,
    needsReshuffle: false,
    deckCount,
    penetration,
  };
}

export function cardsRemaining(shoe: ShoeState): number {
  return shoe.cards.length;
}

/** 0 = empty, 1 = full. */
export function penetrationRatio(shoe: ShoeState): number {
  if (shoe.capacity <= 0) return 0;
  return shoe.cards.length / shoe.capacity;
}

/** How far through the shoe (0 at start, 1 at empty). */
export function dealtRatio(shoe: ShoeState): number {
  return 1 - penetrationRatio(shoe);
}

export function drawCard(shoe: ShoeState): { card: Card; shoe: ShoeState } {
  if (shoe.cards.length === 0) {
    const fresh = createShoe(shoe.deckCount, shoe.penetration);
    return drawCard(fresh);
  }
  const cards = shoe.cards.slice();
  const card = cards.pop()!;
  const needsReshuffle = cards.length <= shoe.cutAt;
  return {
    card,
    shoe: { ...shoe, cards, needsReshuffle: shoe.needsReshuffle || needsReshuffle },
  };
}

export function drawCards(
  shoe: ShoeState,
  count: number,
): { cards: Card[]; shoe: ShoeState } {
  let current = shoe;
  const drawn: Card[] = [];
  for (let i = 0; i < count; i++) {
    const result = drawCard(current);
    drawn.push(result.card);
    current = result.shoe;
  }
  return { cards: drawn, shoe: current };
}

/** Reshuffle when armed (or force). Returns a fresh shoe. */
export function maybeReshuffle(shoe: ShoeState, force = false): ShoeState {
  if (!force && !shoe.needsReshuffle) return shoe;
  return createShoe(shoe.deckCount, shoe.penetration);
}
