import type { Card, CardId, Rank, Suit } from './types';

/** Ascending, and the array index *is* the suit's strength. */
export const SUITS: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades'];

export const RANKS: Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

export const SUIT_SYMBOL: Record<Suit, string> = {
  clubs: '♣',
  diamonds: '♦',
  hearts: '♥',
  spades: '♠',
};

const RANK_LABEL: Record<number, string> = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };

export function rankLabel(rank: Rank): string {
  return RANK_LABEL[rank] ?? String(rank);
}

export function cardLabel(card: Card): string {
  return `${SUIT_SYMBOL[card.suit]}${rankLabel(card.rank)}`;
}

/**
 * Playing strength of a rank, 0 (three) to 12 (deuce).
 *
 * The whole game is named after this line: 3 is the weakest card and **2 is the
 * strongest**, above the ace. Sorting by face value anywhere would silently
 * make the two lowest cards the two highest.
 */
export function rankStrength(rank: Rank): number {
  return rank >= 3 ? rank - 3 : rank + 10;
}

export function suitStrength(suit: Suit): number {
  return SUITS.indexOf(suit);
}

/**
 * A single number ordering every card in the deck, 0 (♣3) to 51 (♠2).
 *
 * Rank dominates and suit breaks the tie, and because rank+suit is unique
 * across the deck no two cards ever share a power — every comparison in the
 * game resolves, so there are no tied plays to write a rule for.
 */
export function power(card: Card): number {
  return rankStrength(card.rank) * 4 + suitStrength(card.suit);
}

export const LOWEST_CARD_ID: CardId = 'clubs-3';

export function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ id: `${suit}-${rank}` as CardId, suit, rank });
    }
  }
  return deck;
}

/**
 * Fisher-Yates. Never `sort(() => r() - 0.5)`: that is engine-dependent and not
 * even uniform, so seeded deals would stop being reproducible across browsers.
 */
export function shuffle(cards: readonly Card[], r: () => number): Card[] {
  const out = [...cards];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function byPower(a: Card, b: Card): number {
  return power(a) - power(b);
}

export function sortCards(cards: readonly Card[]): Card[] {
  return [...cards].sort(byPower);
}

export function isDeuce(card: Card): boolean {
  return card.rank === 2;
}
