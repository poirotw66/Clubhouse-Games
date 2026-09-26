import type { Card } from '../types.ts';
import { calculateScore, isSoftHand } from './rules.ts';

/** Recommended player action from a simplified multi-deck basic chart. */
export type StrategyAction =
  | 'hit'
  | 'stand'
  | 'double'
  | 'split'
  | 'surrender'
  | 'takeEvenMoney'
  | 'declineEvenMoney'
  | 'takeInsurance'
  | 'declineInsurance';

export const STRATEGY_LABELS: Record<StrategyAction, string> = {
  hit: '要牌',
  stand: '停牌',
  double: '加倍',
  split: '分牌',
  surrender: '投降',
  takeEvenMoney: '均分 1:1',
  declineEvenMoney: '繼續比牌',
  takeInsurance: '買保險',
  declineInsurance: '不保險',
};

const TEN_RANKS = new Set(['10', 'J', 'Q', 'K']);

function rankValue(rank: string): number {
  if (rank === 'A') return 11;
  if (TEN_RANKS.has(rank)) return 10;
  return parseInt(rank, 10);
}

/** Dealer upcard value: Ace → 11, face → 10. */
export function dealerUpValue(upcard: Card): number {
  return rankValue(upcard.rank);
}

function isPair(cards: Card[]): boolean {
  if (cards.length !== 2) return false;
  return rankValue(cards[0].rank) === rankValue(cards[1].rank);
}

/** Pair chart; returns null when the hand is not a pair. */
function pairAction(pairRank: number, dealer: number): StrategyAction | null {
  if (pairRank === 11) return 'split'; // A,A
  if (pairRank === 10) return 'stand';
  if (pairRank === 9) {
    if (dealer === 7 || dealer >= 10) return 'stand';
    return 'split';
  }
  if (pairRank === 8) {
    // Early surrender charts often surrender 8,8 vs 10/A; keep split as default teachable line.
    return 'split';
  }
  if (pairRank === 7) return dealer <= 7 ? 'split' : 'hit';
  if (pairRank === 6) return dealer <= 6 ? 'split' : 'hit';
  if (pairRank === 5) return dealer <= 9 ? 'double' : 'hit';
  if (pairRank === 4) return dealer === 5 || dealer === 6 ? 'split' : 'hit';
  if (pairRank === 3 || pairRank === 2) return dealer <= 7 ? 'split' : 'hit';
  return null;
}

function softAction(total: number, dealer: number): StrategyAction {
  // Soft totals use Ace + other (A,9 = 20 … A,2 = 13).
  if (total >= 20) return 'stand';
  if (total === 19) return dealer === 6 ? 'double' : 'stand';
  if (total === 18) {
    if (dealer >= 3 && dealer <= 6) return 'double';
    if (dealer === 2 || dealer === 7 || dealer === 8) return 'stand';
    return 'hit';
  }
  if (total === 17) return dealer >= 3 && dealer <= 6 ? 'double' : 'hit';
  if (total === 16 || total === 15) return dealer >= 4 && dealer <= 6 ? 'double' : 'hit';
  if (total === 14 || total === 13) return dealer >= 5 && dealer <= 6 ? 'double' : 'hit';
  return 'hit';
}

function hardAction(total: number, dealer: number): StrategyAction {
  if (total >= 17) return 'stand';
  if (total === 16) {
    if (dealer >= 9) return 'surrender';
    if (dealer <= 6) return 'stand';
    return 'hit';
  }
  if (total === 15) {
    if (dealer === 10) return 'surrender';
    if (dealer <= 6) return 'stand';
    return 'hit';
  }
  if (total === 14 || total === 13) return dealer <= 6 ? 'stand' : 'hit';
  if (total === 12) return dealer >= 4 && dealer <= 6 ? 'stand' : 'hit';
  if (total === 11) return 'double';
  if (total === 10) return dealer <= 9 ? 'double' : 'hit';
  if (total === 9) return dealer >= 3 && dealer <= 6 ? 'double' : 'hit';
  return 'hit';
}

export interface StrategyContext {
  phase: 'playing' | 'insurance' | 'evenMoney';
  playerCards: Card[];
  dealerUpcard: Card;
  canDouble: boolean;
  canSplit: boolean;
  canSurrender: boolean;
}

/**
 * Basic-strategy recommendation for the active decision.
 * Falls back when double/split/surrender are unavailable in the current UI state.
 */
export function recommendAction(ctx: StrategyContext): StrategyAction {
  if (ctx.phase === 'evenMoney') return 'declineEvenMoney';
  if (ctx.phase === 'insurance') return 'declineInsurance';

  const dealer = dealerUpValue(ctx.dealerUpcard);
  const cards = ctx.playerCards;
  let raw: StrategyAction;

  if (isPair(cards)) {
    raw = pairAction(rankValue(cards[0].rank), dealer) ?? hardAction(calculateScore(cards), dealer);
  } else if (isSoftHand(cards)) {
    raw = softAction(calculateScore(cards), dealer);
  } else {
    raw = hardAction(calculateScore(cards), dealer);
  }

  if (raw === 'split' && !ctx.canSplit) {
    // Re-evaluate as a single hard/soft hand when split is unavailable.
    raw = isSoftHand(cards)
      ? softAction(calculateScore(cards), dealer)
      : hardAction(calculateScore(cards), dealer);
  }
  if (raw === 'double' && !ctx.canDouble) {
    // Soft 18+ prefers stand when double is blocked; otherwise hit.
    if (isSoftHand(cards) && calculateScore(cards) >= 18) return 'stand';
    if (!isSoftHand(cards) && calculateScore(cards) >= 17) return 'stand';
    return 'hit';
  }
  if (raw === 'surrender' && !ctx.canSurrender) {
    return dealer <= 6 ? 'stand' : 'hit';
  }
  return raw;
}
