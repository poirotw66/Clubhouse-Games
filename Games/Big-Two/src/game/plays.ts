import { power, rankStrength, sortCards, suitStrength } from './cards';
import type { Card, Play, PlayType, Rank, StraightRule } from './types';

/**
 * Every legal straight, as face ranks, lowest sequence first.
 *
 * The ace may sit at either end but **never in the middle**, so `A2345` and
 * `10JQKA` are runs while `JQKA2`, `QKA23` and `KA234` are not. That leaves
 * exactly ten sequences.
 */
export const SEQUENCES: Rank[][] = [
  [1, 2, 3, 4, 5],
  [2, 3, 4, 5, 6],
  [3, 4, 5, 6, 7],
  [4, 5, 6, 7, 8],
  [5, 6, 7, 8, 9],
  [6, 7, 8, 9, 10],
  [7, 8, 9, 10, 11],
  [8, 9, 10, 11, 12],
  [9, 10, 11, 12, 13],
  [10, 11, 12, 13, 1],
];

/**
 * Straight strength under each convention, indexed to match `SEQUENCES`.
 *
 * `topCard` ranks a run by the strength of its own highest card: `A2345` tops
 * out at the five and is the weakest run of all, while `23456` tops out at the
 * deuce and is the strongest. `sequence` ignores that and simply walks the runs
 * upward from `A2345` to `10JQKA`. Both are played; neither is wrong.
 */
const STRAIGHT_ORDER: Record<StraightRule, number[]> = {
  // A2345 lowest, then 34567…10JQKA, with 23456 on top.
  topCard: [0, 9, 1, 2, 3, 4, 5, 6, 7, 8],
  sequence: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
};

const TYPE_RANK: Record<PlayType, number> = {
  single: 0,
  pair: 0,
  straight: 0,
  flush: 1,
  fullHouse: 2,
  quads: 3,
  straightFlush: 4,
};

/** Wide enough that the five-card type always dominates its own tie-break. */
const TYPE_SCALE = 10_000_000;

function counts(cards: readonly Card[]): Map<number, Card[]> {
  const map = new Map<number, Card[]>();
  for (const card of cards) {
    const list = map.get(card.rank) ?? [];
    list.push(card);
    map.set(card.rank, list);
  }
  return map;
}

/** Which of `SEQUENCES` these five ranks form, or -1. */
function sequenceIndex(cards: readonly Card[]): number {
  const ranks = new Set(cards.map((c) => c.rank));
  if (ranks.size !== 5) return -1;
  return SEQUENCES.findIndex((seq) => seq.every((rank) => ranks.has(rank)));
}

/**
 * Straights and straight flushes tie-break on the suit of the play's
 * highest-power card. Two plays of the same sequence must differ somewhere, and
 * their top-ranked cards are the same rank in different suits, so this always
 * separates them.
 */
function runKey(cards: readonly Card[], index: number, rule: StraightRule): number {
  const top = [...cards].sort((a, b) => power(b) - power(a))[0];
  return STRAIGHT_ORDER[rule][index] * 4 + suitStrength(top.suit);
}

/** Flushes compare by suit first, then by ranks from the top down. */
function flushKey(cards: readonly Card[]): number {
  const descending = [...cards].sort((a, b) => rankStrength(b.rank) - rankStrength(a.rank));
  let packed = 0;
  for (const card of descending) packed = packed * 13 + rankStrength(card.rank);
  return suitStrength(cards[0].suit) * 400_000 + packed;
}

/**
 * Read a set of cards as a play, or return null when they do not form one.
 *
 * Only one, two and five cards are legal. There is deliberately no standalone
 * three-of-a-kind and no standalone four — triples and quads only reach the
 * table wrapped in a full house or a four-plus-one.
 */
export function detectPlay(cards: readonly Card[], rule: StraightRule = 'topCard'): Play | null {
  const sorted = sortCards(cards);

  if (sorted.length === 1) {
    return { type: 'single', cards: sorted, key: power(sorted[0]) };
  }

  if (sorted.length === 2) {
    if (sorted[0].rank !== sorted[1].rank) return null;
    return { type: 'pair', cards: sorted, key: power(sorted[1]) };
  }

  if (sorted.length !== 5) return null;

  const grouped = counts(sorted);
  const sizes = [...grouped.values()].map((list) => list.length).sort((a, b) => b - a);
  const flush = sorted.every((card) => card.suit === sorted[0].suit);
  const index = sequenceIndex(sorted);

  if (index >= 0 && flush) {
    return {
      type: 'straightFlush',
      cards: sorted,
      key: TYPE_RANK.straightFlush * TYPE_SCALE + runKey(sorted, index, rule),
    };
  }

  if (sizes[0] === 4) {
    const quad = [...grouped.entries()].find(([, list]) => list.length === 4)!;
    return {
      type: 'quads',
      cards: sorted,
      key: TYPE_RANK.quads * TYPE_SCALE + rankStrength(quad[0] as Rank),
    };
  }

  if (sizes[0] === 3 && sizes[1] === 2) {
    const triple = [...grouped.entries()].find(([, list]) => list.length === 3)!;
    return {
      type: 'fullHouse',
      cards: sorted,
      key: TYPE_RANK.fullHouse * TYPE_SCALE + rankStrength(triple[0] as Rank),
    };
  }

  if (flush) {
    return { type: 'flush', cards: sorted, key: TYPE_RANK.flush * TYPE_SCALE + flushKey(sorted) };
  }

  if (index >= 0) {
    return {
      type: 'straight',
      cards: sorted,
      key: TYPE_RANK.straight * TYPE_SCALE + runKey(sorted, index, rule),
    };
  }

  return null;
}

/**
 * Whether `play` may be put on top of `table`.
 *
 * The card count has to match — a five-card hand cannot be dropped on a single
 * or a pair, however strong it is. That restriction is what makes the lead
 * worth having: whoever leads chooses which size everyone else has to answer in.
 */
export function beats(play: Play, table: Play | null): boolean {
  if (!table) return true;
  if (play.cards.length !== table.cards.length) return false;
  return play.key > table.key;
}

/** Every combination of `size` cards drawn from `hand`. */
function combinations(hand: readonly Card[], size: number): Card[][] {
  const out: Card[][] = [];
  const pick: Card[] = [];

  const walk = (start: number) => {
    if (pick.length === size) {
      out.push([...pick]);
      return;
    }
    for (let i = start; i < hand.length; i++) {
      pick.push(hand[i]);
      walk(i + 1);
      pick.pop();
    }
  };

  walk(0);
  return out;
}

/**
 * Every legal play available from a hand against the current table.
 *
 * Enumerating all C(13,5) = 1287 five-card subsets is fine here — it is a
 * millisecond, and being exhaustive means the CPU can never miss a legal answer
 * and the UI can never mark a legal play as illegal.
 */
export function legalPlays(
  hand: readonly Card[],
  table: Play | null,
  rule: StraightRule = 'topCard',
): Play[] {
  const sizes = table ? [table.cards.length] : [1, 2, 5];
  const out: Play[] = [];

  for (const size of sizes) {
    if (hand.length < size) continue;
    for (const combo of combinations(hand, size)) {
      const play = detectPlay(combo, rule);
      if (play && beats(play, table)) out.push(play);
    }
  }

  return out.sort((a, b) => a.cards.length - b.cards.length || a.key - b.key);
}

export const TYPE_LABEL: Record<PlayType, string> = {
  single: '單張',
  pair: '對子',
  straight: '順子',
  flush: '同花',
  fullHouse: '葫蘆',
  quads: '鐵支',
  straightFlush: '同花順',
};
