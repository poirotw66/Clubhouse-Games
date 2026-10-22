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

/**
 * Selectable house rules. Taiwanese club play almost always keeps both penalty
 * toggles on; turning them off is for teaching or soft tables.
 */
export interface HouseRules {
  straights: StraightRule;
  /** Remaining-card ladder: 8+ ×2, 10+ ×3, 13 ×4. */
  sizeLadder: boolean;
  /** Each unplayed deuce doubles that seat's penalty. */
  deuceDouble: boolean;
}

/** @deprecated Prefer HouseRules; kept as an alias so older call sites still type-check. */
export type Rules = HouseRules;

export interface GameState {
  seedCode: string;
  rules: HouseRules;
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
  /** Ladder / special tables can recolour CPU seats. */
  seatPersonalities?: SeatPersonalityMap;
}

export type DifficultyId = 'easy' | 'normal' | 'hard';

/**
 * Session shape:
 * - `single` — one hand, settle immediately
 * - `hands` — fixed N hands（打 N 局）
 * - `target` — first to N chips（先達目標分）
 * - `daily` — Taipei-seeded 5-hand table shared by everyone that day
 */
export type MatchMode = 'single' | 'hands' | 'target' | 'daily';
export type MatchLength = 4 | 8 | 12;
export type TargetScore = 50 | 100 | 200;

/** Stable key for per-format win/loss records（賽制戰績）. */
export type FormatKey =
  | 'single'
  | 'hands-4'
  | 'hands-8'
  | 'hands-12'
  | 'target-50'
  | 'target-100'
  | 'target-200'
  | 'daily';

export interface FormatRecord {
  played: number;
  wins: number;
}

export interface MatchConfig {
  mode: MatchMode;
  hands: MatchLength;
  target: TargetScore;
  difficulty: DifficultyId;
  rules: HouseRules;
  seedCode: string;
  /**
   * Named-ladder duel: seat 1 wears this opponent's memory style.
   * Null/undefined = ordinary table personalities.
   */
  ladderOpponentId?: NamedOpponentId | null;
}

export interface HandRecord {
  handIndex: number;
  seedCode: string;
  winner: Seat;
  scores: SeatScore[];
  pot: number;
  /** Per-seat chip change this hand. Winner gets +pot; losers pay −penalty. */
  deltas: number[];
  /** Quads + straight-flush count per seat this hand. */
  bombs: number[];
  /** How many real plays the winner needed to empty their hand. */
  winnerPlayCount: number;
}

export type MatchPhase = 'playing' | 'handOver' | 'matchOver';

export interface MatchState {
  config: MatchConfig;
  /** Zero-based index of the hand currently being played (or just finished). */
  handIndex: number;
  balances: number[];
  history: HandRecord[];
  phase: MatchPhase;
  /** Set when the series ends. */
  winner: Seat | null;
}

export interface SeatScore {
  seat: Seat;
  remaining: number;
  /** Remaining cards after the size multiplier, before the deuce doubling. */
  base: number;
  deuces: number;
  /** Final penalty: base × 2^deuces (or flat remaining when house rules mute them). The winner's is 0. */
  penalty: number;
}

export interface Outcome {
  winner: Seat;
  scores: SeatScore[];
  /** Winner's take: the sum of everyone else's penalties. */
  pot: number;
}

/** Named CPU style — same difficulty tier, different decision weights. */
export type PersonalityId = 'rusher' | 'controller' | 'counter';

export interface Personality {
  id: PersonalityId;
  name: string;
  blurb: string;
}

/**
 * Memory / discard style for the named-opponent unlock ladder.
 * Maps onto PersonalityId weights, with a readable blurb for the UI.
 */
export type MemoryStyle = 'split' | 'hoard' | 'count' | 'pressure' | 'chaos';

export type NamedOpponentId =
  | 'ming'
  | 'mei'
  | 'qiang'
  | 'zhen'
  | 'king';

export interface NamedOpponent {
  id: NamedOpponentId;
  name: string;
  tagline: string;
  blurb: string;
  style: MemoryStyle;
  /** Personality weights this opponent leans on. */
  personality: PersonalityId;
  difficulty: DifficultyId;
}

/** One completed (or in-progress best) daily table attempt. */
export interface DailyRecord {
  date: string;
  /** Best end-of-table chip total for the human that day. */
  bestChips: number;
  /** True once a full 5-hand daily table has been finished at least once. */
  completed: boolean;
  attempts: number;
}

/**
 * End-of-match MVP — fastest empty, most bombs, biggest comeback.
 * Ties break toward the lowest seat so the result is deterministic.
 */
export interface MatchMvp {
  fastestSeat: Seat;
  fastestPlays: number;
  mostBombsSeat: Seat;
  mostBombsCount: number;
  biggestComebackSeat: Seat;
  biggestComebackDelta: number;
  chipLeaderSeat: Seat;
  chipLeaderTotal: number;
}

export interface HintAdvice {
  /** null means the teachable line is to pass. */
  play: Play | null;
  reason: string;
}

/** Optional per-seat personality overrides (ladder / daily flavour). */
export type SeatPersonalityMap = Partial<Record<1 | 2 | 3, PersonalityId>>;
