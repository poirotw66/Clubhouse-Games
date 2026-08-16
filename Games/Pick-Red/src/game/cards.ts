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
 * Red point value.
 *
 * The band is **9 and up**, not 10 and up: a red nine is worth ten, the same as
 * a red king. That one card is the difference between a deck totalling 208 and
 * one totalling 210, and 210 is why every account of this game quotes 105 as
 * the line — it is exactly half. A 208-point deck would have no such number.
 *
 * Black cards score nothing (unless the black-ace variant is on). They exist
 * purely as tools for capturing red ones, which is the shape of the game: half
 * the deck is currency with no value of its own.
 */
export function pointsOf(card: Card, blackAces = false): number {
  if (!isRed(card)) {
    if (!blackAces || card.rank !== 1) return 0;
    return card.suit === 'clubs' ? 40 : 30;
  }
  if (card.rank === 1) return 20;
  if (card.rank >= 9) return 10;
  return card.rank;
}

/** 40 + 100 + 70. Asserted in the self-checks rather than trusted. */
export const TOTAL_POINTS = 210;

/** 黑桃A 30 + 梅花A 40 on top, for the variant. */
export const BLACK_ACE_POINTS = 70;

/**
 * The 標準分: an even share of the deck. Two players split 210 at 105, three at
 * exactly 70. Beat it and you are 合格, fall short and you are not; the winner
 * is whoever holds the most.
 */
export function parScore(players: number, blackAces = false): number {
  return (TOTAL_POINTS + (blackAces ? BLACK_ACE_POINTS : 0)) / players;
}

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

export function sumPoints(cards: readonly Card[], blackAces = false): number {
  return cards.reduce((total, card) => total + pointsOf(card, blackAces), 0);
}

/** Every table card the given card could capture. */
export function capturableBy(card: Card, table: readonly Card[]): Card[] {
  return table.filter((other) => matches(card, other));
}
