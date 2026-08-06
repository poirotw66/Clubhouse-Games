import type { Card } from '../types';

export type DealerRule = 'H17' | 'S17';

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

/** Early surrender: half the main bet returned. */
export const surrenderRefund = (bet: number): number => Math.floor(bet / 2);

export const BALANCE_STORAGE_KEY = 'clubhouse-blackjack-balance';
export const DEALER_RULE_STORAGE_KEY = 'clubhouse-blackjack-dealer-rule';
export const DEFAULT_BALANCE = 1000;

export const loadBalance = (): number => {
  try {
    const raw = localStorage.getItem(BALANCE_STORAGE_KEY);
    if (raw == null) return DEFAULT_BALANCE;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : DEFAULT_BALANCE;
  } catch {
    return DEFAULT_BALANCE;
  }
};

export const saveBalance = (balance: number): void => {
  try {
    localStorage.setItem(BALANCE_STORAGE_KEY, String(Math.floor(balance)));
  } catch {
    // ignore quota / private mode
  }
};

export const loadDealerRule = (): DealerRule => {
  try {
    const raw = localStorage.getItem(DEALER_RULE_STORAGE_KEY);
    return raw === 'S17' ? 'S17' : 'H17';
  } catch {
    return 'H17';
  }
};

export const saveDealerRule = (rule: DealerRule): void => {
  try {
    localStorage.setItem(DEALER_RULE_STORAGE_KEY, rule);
  } catch {
    // ignore
  }
};
