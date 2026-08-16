import type { Card, CardId, Rank, Suit } from './types';

export const SUITS: Suit[] = ['spades', 'hearts', 'clubs', 'diamonds'];
export const RANKS: Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

export const SUIT_SYMBOL: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  clubs: '♣',
  diamonds: '♦',
};

const RANK_LABEL: Record<number, string> = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };

export function rankLabel(rank: Rank): string {
  return RANK_LABEL[rank] ?? String(rank);
}

export function cardLabel(card: Card): string {
  return `${SUIT_SYMBOL[card.suit]}${rankLabel(card.rank)}`;
}

/** Hearts and diamonds are the only cards worth anything. */
export function isRed(card: Card): boolean {
  return card.suit === 'hearts' || card.suit === 'diamonds';
}

/**
 * Red point value. Black cards score zero — they exist purely as tools for
 * capturing red ones, which is the whole shape of the game: half the deck is
 * currency with no value of its own.
 */
export function pointsOf(card: Card): number {
  if (!isRed(card)) return 0;
  if (card.rank === 1) return 20;
  if (card.rank >= 10) return 10;
  return card.rank;
}

/** 40 + 88 + 80. Asserted in the self-checks rather than trusted. */
export const TOTAL_POINTS = 208;

/** Above this and the rest of the deck cannot catch you. */
export const WINNING_POINTS = 105;

/**
 * The 湊十 rule, and the one place a port of this game can quietly go wrong.
 *
 * Below ten, two cards pair when they *sum* to ten; from ten up, they pair when
 * they are the *same* rank. The boundary is exactly at 10, and 10 belongs to the
 * second rule — two tens pair with each other even though they sum to twenty.
 * Five is the only number that pairs with itself under the first rule.
 *
 * Suit is irrelevant to matching. It only decides whether the capture was worth
 * making.
 */
export function matches(a: Card, b: Card): boolean {
  if (a.rank >= 10 || b.rank >= 10) return a.rank === b.rank;
  return a.rank + b.rank === 10;
}

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

export function sumPoints(cards: readonly Card[]): number {
  return cards.reduce((total, card) => total + pointsOf(card), 0);
}

/** Every table card the given card could capture. */
export function capturableBy(card: Card, table: readonly Card[]): Card[] {
  return table.filter((other) => matches(card, other));
}
