import type { Card } from '../types.ts';
import { createDeck, createSeededDeck } from './deck.ts';

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
  /** When set, reshuffles stay deterministic (seed + reshuffle index). */
  seed?: number;
  reshuffleIndex?: number;
}

function shoeFromCards(
  cards: Card[],
  deckCount: number,
  penetration: number,
  extras?: Pick<ShoeState, 'seed' | 'reshuffleIndex'>,
): ShoeState {
  const capacity = cards.length;
  const cutAt = Math.max(1, Math.floor(capacity * (1 - penetration)));
  return {
    cards,
    capacity,
    cutAt,
    needsReshuffle: false,
    deckCount,
    penetration,
    ...extras,
  };
}

export function createShoe(
  deckCount: number,
  penetration: number = DEFAULT_PENETRATION,
): ShoeState {
  return shoeFromCards(createDeck(deckCount), deckCount, penetration);
}

/** Fixed-order shoe for daily / tournament modes. */
export function createSeededShoe(
  deckCount: number,
  seed: number,
  penetration: number = DEFAULT_PENETRATION,
): ShoeState {
  return shoeFromCards(createSeededDeck(deckCount, seed), deckCount, penetration, {
    seed,
    reshuffleIndex: 0,
  });
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
  if (shoe.seed != null) {
    const nextIndex = (shoe.reshuffleIndex ?? 0) + 1;
    // Mix original seed with reshuffle count so cut-card reshuffles stay reproducible.
    const nextSeed = (shoe.seed ^ Math.imul(nextIndex + 1, 0x9e3779b9)) >>> 0;
    return shoeFromCards(
      createSeededDeck(shoe.deckCount, nextSeed),
      shoe.deckCount,
      shoe.penetration,
      { seed: shoe.seed, reshuffleIndex: nextIndex },
    );
  }
  return createShoe(shoe.deckCount, shoe.penetration);
}
