import type { Card, Rank, Suit } from '../types.ts';
import { shuffleArray } from '@clubhouse/shared/shuffle';
import { shuffleSeeded } from './rng.ts';

export {
  calculateScore,
  isBlackjack,
  isSoftHand,
  dealerShouldHit,
  resolveInsurancePayout,
  surrenderRefund,
} from './rules.ts';

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export const shuffle = (deck: Card[]): Card[] => shuffleArray(deck);

/** Unshuffled multi-deck stack (ordered by deck → suit → rank). */
export function buildOrderedDeck(numDecks: number = 6): Card[] {
  const deck: Card[] = [];
  for (let i = 0; i < numDecks; i++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({ suit, rank });
      }
    }
  }
  return deck;
}

export const createDeck = (numDecks: number = 6): Card[] => shuffle(buildOrderedDeck(numDecks));

/** Deterministic shoe order from a numeric seed. */
export function createSeededDeck(numDecks: number, seed: number): Card[] {
  return shuffleSeeded(buildOrderedDeck(numDecks), seed);
}
