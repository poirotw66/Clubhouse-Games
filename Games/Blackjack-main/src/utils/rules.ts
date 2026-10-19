import type { Card } from '../types.ts';

export type DealerRule = 'H17' | 'S17';
export type BjPayout = '3:2' | '6:5';

export const calculateScore = (cards: Card[]): number => {
  let score = 0;
  let aces = 0;

  for (const card of cards) {
    if (card.isHidden) continue;
    if (card.rank === 'A') {
      aces += 1;
      score += 11;
    } else if (['J', 'Q', 'K'].includes(card.rank)) {
      score += 10;
    } else {
      score += parseInt(card.rank, 10);
    }
  }

  while (score > 21 && aces > 0) {
    score -= 10;
    aces -= 1;
  }

  return score;
};

export const isBlackjack = (cards: Card[]): boolean => {
  return cards.length === 2 && calculateScore(cards) === 21;
};

/** True when at least one Ace still counts as 11 in the best total. */
export const isSoftHand = (cards: Card[]): boolean => {
  let score = 0;
  let aces = 0;

  for (const card of cards) {
    if (card.isHidden) continue;
    if (card.rank === 'A') {
      aces += 1;
      score += 11;
    } else if (['J', 'Q', 'K'].includes(card.rank)) {
      score += 10;
    } else {
      score += parseInt(card.rank, 10);
    }
  }

  let softAces = aces;
  while (score > 21 && softAces > 0) {
    score -= 10;
    softAces -= 1;
  }

  return softAces > 0 && score <= 21;
};

/** Dealer hits soft 17 under H17; stands on all 17s under S17. */
export const dealerShouldHit = (cards: Card[], hitSoft17: boolean): boolean => {
  const score = calculateScore(cards);
  if (score < 17) return true;
  if (score > 17) return false;
  return hitSoft17 && isSoftHand(cards);
};

/** Chips returned after resolving insurance (stake already deducted). 2:1 → 3× stake. */
export const resolveInsurancePayout = (
  insuranceBet: number,
  dealerHasBlackjack: boolean,
): number => {
  if (insuranceBet <= 0) return 0;
  return dealerHasBlackjack ? insuranceBet * 3 : 0;
};

/** Early/late surrender: half the main bet returned. */
export const surrenderRefund = (bet: number): number => Math.floor(bet / 2);

/** Even money: take 1:1 on player blackjack vs dealer Ace (stake already deducted). */
export const evenMoneyPayout = (bet: number): number => bet * 2;

/**
 * Blackjack payout including returned stake (stake already deducted).
 * 3:2 → 2.5× bet; 6:5 → 2.2× bet.
 */
export const blackjackPayout = (bet: number, payout: BjPayout = '3:2'): number =>
  payout === '6:5' ? bet + (bet * 6) / 5 : bet + (bet * 3) / 2;

export const blackjackPayoutLabel = (payout: BjPayout): string =>
  payout === '6:5' ? '6:5' : '3:2';

/** Display total; soft hands show Traditional Chinese「軟」prefix. */
export const formatHandTotal = (cards: Card[]): string => {
  const score = calculateScore(cards);
  return isSoftHand(cards) ? `軟 ${score}` : String(score);
};

const TEN_RANKS = new Set(['10', 'J', 'Q', 'K']);

export function pairRankKey(rank: string): string {
  if (TEN_RANKS.has(rank)) return '10';
  return rank;
}

export function isPairHand(cards: Card[]): boolean {
  if (cards.length !== 2) return false;
  return pairRankKey(cards[0].rank) === pairRankKey(cards[1].rank);
}

export function isAcePair(cards: Card[]): boolean {
  return cards.length === 2 && cards[0].rank === 'A' && cards[1].rank === 'A';
}

export const DEFAULT_BALANCE = 1000;
