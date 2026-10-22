/**
 * Perfect Pairs side bet — resolved on the player's first two cards.
 *
 * Odds (stake already deducted; return includes stake):
 * - Perfect pair (same rank + same suit): 25:1 → 26× stake
 * - Colored pair (same rank + same color, different suit): 12:1 → 13× stake
 * - Mixed pair (same rank, different color): 6:1 → 7× stake
 * - No pair: 0
 *
 * Ranks must match exactly (K+Q is not a pair).
 */
import type { Card, Suit } from '../types.ts';

export type PerfectPairKind = 'perfect' | 'colored' | 'mixed' | 'none';

export const PERFECT_PAIRS_ODDS = {
  perfect: 25,
  colored: 12,
  mixed: 6,
} as const;

export const PERFECT_PAIRS_RULES_ZH = [
  'Perfect Pairs（完美對子）為可選邊注，在發牌前與主注一併下注。',
  '只看玩家最初兩張牌是否為完全相同點數（J 與 Q 不算對子；兩張 K 才算）。',
  `完美對（同花色）：賠 ${PERFECT_PAIRS_ODDS.perfect}:1`,
  `同色對（同色異花）：賠 ${PERFECT_PAIRS_ODDS.colored}:1`,
  `混色對：賠 ${PERFECT_PAIRS_ODDS.mixed}:1`,
  '非對子：邊注輸掉。邊注不影響主注勝負。',
].join('\n');

function isRed(suit: Suit): boolean {
  return suit === 'hearts' || suit === 'diamonds';
}

export function classifyPerfectPair(cards: Card[]): PerfectPairKind {
  if (cards.length < 2) return 'none';
  const [a, b] = cards;
  if (a.rank !== b.rank) return 'none';
  if (a.suit === b.suit) return 'perfect';
  if (isRed(a.suit) === isRed(b.suit)) return 'colored';
  return 'mixed';
}

/** Chips returned after resolving the side bet (0 if lost). Stake already deducted. */
export function perfectPairsPayout(stake: number, kind: PerfectPairKind): number {
  if (stake <= 0 || kind === 'none') return 0;
  const odds = PERFECT_PAIRS_ODDS[kind];
  return stake + stake * odds;
}

export function perfectPairsLabel(kind: PerfectPairKind): string {
  switch (kind) {
    case 'perfect':
      return `完美對 ${PERFECT_PAIRS_ODDS.perfect}:1`;
    case 'colored':
      return `同色對 ${PERFECT_PAIRS_ODDS.colored}:1`;
    case 'mixed':
      return `混色對 ${PERFECT_PAIRS_ODDS.mixed}:1`;
    default:
      return '邊注未中';
  }
}

/** Cap side bet at half the main bet (common table rule). */
export function maxPerfectPairsBet(mainBet: number, balance: number): number {
  if (mainBet <= 0) return 0;
  return Math.min(Math.floor(mainBet / 2), Math.max(0, balance));
}
