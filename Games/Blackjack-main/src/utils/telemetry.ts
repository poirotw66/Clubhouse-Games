import type { Card } from '../types.ts';
import { calculateScore, isSoftHand, type DealerRule } from './rules.ts';

const TEN_RANKS = new Set(['10', 'J', 'Q', 'K']);

/** Hard card point value when evaluating bust risk (Ace counts as 1). */
export function cardPointValue(card: Card): number {
  if (card.rank === 'A') return 1;
  if (TEN_RANKS.has(card.rank)) return 10;
  return parseInt(card.rank, 10);
}

/**
 * Exact bust probability for the player if they hit next.
 * Returns percentage [0, 100] rounded to 1 decimal place.
 */
export function calculateBustProbability(playerCards: Card[], shoeCards: Card[]): number {
  if (playerCards.length === 0) return 0;
  const score = calculateScore(playerCards);
  if (score <= 11 || isSoftHand(playerCards)) {
    return 0;
  }
  if (score >= 21) {
    return 100;
  }

  const threshold = 21 - score;

  if (shoeCards.length === 0) {
    // Fallback: standard 52-card distribution (4 of each 2-9, 16 tens, 4 aces)
    let bustCards = 0;
    for (let r = 2; r <= 9; r++) {
      if (r > threshold) bustCards += 4;
    }
    if (10 > threshold) bustCards += 16;
    return Math.round((bustCards / 52) * 1000) / 10;
  }

  let bustCount = 0;
  for (const c of shoeCards) {
    if (cardPointValue(c) > threshold) {
      bustCount += 1;
    }
  }

  return Math.round((bustCount / shoeCards.length) * 1000) / 10;
}

/** Dealer bust probability table based on upcard rank and dealer rules. */
const BASE_DEALER_BUST_RATES: Record<string, number> = {
  '2': 35.3,
  '3': 37.5,
  '4': 40.3,
  '5': 42.9,
  '6': 42.1,
  '7': 26.0,
  '8': 23.9,
  '9': 23.3,
  '10': 21.4,
  'J': 21.4,
  'Q': 21.4,
  'K': 21.4,
  'A': 11.6,
};

/**
 * Real-time estimated dealer bust rate based on upcard, True Count, and rule variant.
 */
export function getDealerBustProbability(
  upcard: Card | null | undefined,
  trueCountVal: number,
  dealerRule: DealerRule = 'H17',
): number {
  if (!upcard) return 0;
  let base = BASE_DEALER_BUST_RATES[upcard.rank] ?? 25;
  if (upcard.rank === 'A' && dealerRule === 'H17') {
    base = 16.7;
  }

  // TC shift: positive count increases bust rate on stiff cards (2-6), decreases on high cards (7-A)
  const isStiff = ['2', '3', '4', '5', '6'].includes(upcard.rank);
  const tcAdjust = isStiff ? trueCountVal * 0.75 : -trueCountVal * 0.4;
  const rate = Math.min(85, Math.max(5, base + tcAdjust));
  return Math.round(rate * 10) / 10;
}

export type PlayerEdgeTone = 'house' | 'neutral' | 'player';

export interface PlayerEdgeInfo {
  edge: number;
  label: string;
  tone: PlayerEdgeTone;
}

/**
 * Player edge calculation from Hi-Lo True Count.
 * Base house edge ≈ -0.5%. Each +1 TC shifts edge by ≈ +0.5%.
 */
export function calculatePlayerEdge(tc: number): PlayerEdgeInfo {
  const edge = Math.round((-0.5 + tc * 0.5) * 10) / 10;
  if (edge >= 1.0) {
    return { edge, label: '豪客優勢區間', tone: 'player' };
  }
  if (edge >= 0.0) {
    return { edge, label: '均勢起風區間', tone: 'player' };
  }
  if (edge >= -1.0) {
    return { edge, label: '常規賭場優勢', tone: 'neutral' };
  }
  return { edge, label: '莊家高度優勢', tone: 'house' };
}

export interface ShoeDensity {
  high: number;
  mid: number;
  low: number;
  total: number;
  highPct: number;
  lowPct: number;
}

/**
 * Breakdown of remaining shoe cards into Hi-Lo categories.
 */
export function calculateShoeDensity(shoeCards: Card[]): ShoeDensity {
  const total = shoeCards.length;
  if (total === 0) {
    return { high: 0, mid: 0, low: 0, total: 0, highPct: 38.5, lowPct: 38.5 };
  }

  let high = 0;
  let mid = 0;
  let low = 0;

  for (const c of shoeCards) {
    if (['10', 'J', 'Q', 'K', 'A'].includes(c.rank)) {
      high += 1;
    } else if (['7', '8', '9'].includes(c.rank)) {
      mid += 1;
    } else {
      low += 1;
    }
  }

  const highPct = Math.round((high / total) * 1000) / 10;
  const lowPct = Math.round((low / total) * 1000) / 10;

  return { high, mid, low, total, highPct, lowPct };
}

export interface StreakPrestige {
  title: string;
  multiplierLabel: string;
  tone: 'neutral' | 'emerald' | 'amber' | 'purple' | 'rose';
  level: number;
}

/**
 * Evaluates current win streak into VIP prestige titles and excitement multipliers.
 */
export function getStreakPrestige(streak: number): StreakPrestige {
  if (streak <= 0) {
    return { title: '平穩席位', multiplierLabel: '1.0x', tone: 'neutral', level: 0 };
  }
  if (streak === 1) {
    return { title: '首勝入局', multiplierLabel: '1.0x', tone: 'emerald', level: 1 };
  }
  if (streak === 2) {
    return { title: '手氣轉燙 🔥', multiplierLabel: '1.5x 氣勢', tone: 'amber', level: 2 };
  }
  if (streak === 3) {
    return { title: '三連勝勢 🔥🔥', multiplierLabel: '2.0x 氣焰', tone: 'amber', level: 3 };
  }
  if (streak === 4) {
    return { title: '豪客連勝 ⚡', multiplierLabel: '2.5x 爆棚', tone: 'purple', level: 4 };
  }
  if (streak === 5) {
    return { title: '賭神附體 ⚡⚡', multiplierLabel: '3.0x 巔峰', tone: 'purple', level: 5 };
  }
  return { title: '傳奇巨鯨 👑', multiplierLabel: '5.0x 神話', tone: 'rose', level: 6 };
}
