/** Ascending: 梅花 < 方塊 < 紅心 < 黑桃. */
export type Suit = 'clubs' | 'diamonds' | 'hearts' | 'spades';

/** Face value. 1 = A, 11 = J, 12 = Q, 13 = K. Note 2 is the *highest* card. */
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

export type CardId = string;

export interface Card {
  id: CardId;
  suit: Suit;
  rank: Rank;
}

/** Seat 0 is always the human; 1-3 are CPUs, in turn order. */
export type Seat = number;

export const HUMAN: Seat = 0;
export const SEATS = 4;
export const HAND_SIZE = 13;

export type PlayType =
  | 'single'
  | 'pair'
  | 'straight'
  | 'flush'
  | 'fullHouse'
  | 'quads'
  | 'straightFlush';

/**
 * How straights are ranked — the one genuinely contested rule in this game.
 *
 * `topCard` is what Taiwanese sources describe: order by the highest card of
 * the *sequence*, so A2345 tops out at 5 and is the smallest, while 23456 tops
 * out at the 2 and is the largest of all. `sequence` is the convention most
 * online implementations use: runs simply ascend from A2345 to 10JQKA.
 */
export type StraightRule = 'topCard' | 'sequence';

export interface Play {
  type: PlayType;
  cards: Card[];
  /** Total order among plays of the same card count. Higher beats lower. */
  key: number;
}

export interface TrickEntry {
  seat: Seat;
  /** null means the seat passed. */
  play: Play | null;
}

export type Phase = 'playing' | 'over';

export interface Rules {
  straights: StraightRule;
}

export interface GameState {
  seedCode: string;
  rules: Rules;
  difficulty: DifficultyId;
  phase: Phase;
  turn: Seat;
  hands: Card[][];
  /** The play everyone is currently trying to beat, or null on a fresh trick. */
  table: Play | null;
  /** Who played `table`. They lead again once everyone else passes. */
  tableOwner: Seat | null;
  /** Seats that have passed in the current trick. */
  passed: Seat[];
  /** Every play and pass, in order. */
  log: TrickEntry[];
  /** Set once someone empties their hand. */
  winner: Seat | null;
}

export type DifficultyId = 'easy' | 'normal' | 'hard';

export interface SeatScore {
  seat: Seat;
  remaining: number;
  /** Remaining cards after the size multiplier, before the deuce doubling. */
  base: number;
  deuces: number;
  /** Final penalty: base × 2^deuces. The winner's is 0. */
  penalty: number;
}

export interface Outcome {
  winner: Seat;
  scores: SeatScore[];
  /** Winner's take: the sum of everyone else's penalties. */
  pot: number;
}
