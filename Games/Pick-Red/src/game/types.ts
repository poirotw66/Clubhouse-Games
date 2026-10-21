export type Suit = 'spades' | 'hearts' | 'clubs' | 'diamonds';

/** 1 = A, 11 = J, 12 = Q, 13 = K. */
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

export type CardId = string;

export interface Card {
  id: CardId;
  suit: Suit;
  rank: Rank;
}

/** Seat 0 is always the human; 1 and up are CPUs, in turn order. */
export type Seat = number;

export const HUMAN: Seat = 0;

/** 2, 3 or 4. Hands always total 24 cards, so all three deals balance. */
export type PlayerCount = 2 | 3 | 4;

export type DifficultyId = 'easy' | 'normal' | 'hard';

/** Only two of these exist, because a third measured no better. See cpu.ts. */
export type CpuBrain = 'careless' | 'sharp';

/**
 * Named CPU style — same difficulty tier, different visible preferences.
 * Seat 1/2/3 wear fixed personalities so rematches stay readable.
 */
export type PersonalityId = 'feeder' | 'miser' | 'aceChaser';

export interface Personality {
  id: PersonalityId;
  name: string;
  blurb: string;
}

/**
 * A turn is two halves and both can present a choice, because the real game
 * lets whoever flipped a card decide which table card it takes — same as when
 * they played one from hand.
 */
export type Phase =
  | 'play' // the seat on turn must play a hand card
  | 'pick_play' // that card matched several table cards
  | 'flip' // the pile card is being revealed
  | 'pick_flip' // the flipped card matched several table cards
  | 'over';

export interface CaptureEvent {
  by: Seat;
  /** The card that was played or flipped. */
  played: Card;
  /** The table card it took, or null when nothing matched. */
  taken: Card | null;
  source: 'hand' | 'pile';
  points: number;
  /** The table as it stood before this card landed. */
  tableBefore: Card[];
}

/**
 * Selectable house rules. Taiwanese club play almost always keeps black aces
 * on at four players; the special bonuses are the "high stakes" table options.
 */
export interface HouseRules {
  players: PlayerCount;
  /** 黑桃A 30 分、梅花A 40 分 — common house rule, off by default for 2p. */
  blackAces: boolean;
  /**
   * 過紅五：同一回合（出牌＋翻牌）吃到兩張紅 5，其餘各家各付紅五獎金。
   * Default on — it is the most cited Taiwanese special.
   */
  doubleRedFive: boolean;
  /**
   * 拼零分：整局一分未得者向其餘各家各收「標準分」籌碼。
   * Default on for the same reason.
   */
  zeroScoreBonus: boolean;
  /** 每局輪莊：系列賽內頭家依座位輪轉，讓座位優勢不完全綁死難度。 */
  rotateLeader: boolean;
}

/** @deprecated Prefer HouseRules; kept so older call sites still type-check. */
export type Rules = HouseRules;

export interface GameState {
  seedCode: string;
  rules: HouseRules;
  difficulty: DifficultyId;
  /** Who played the first hand card. Playing later in the order is an edge. */
  leader: Seat;
  phase: Phase;
  turn: Seat;
  hands: Card[][];
  captured: Card[][];
  table: Card[];
  pile: Card[];
  /** Set while a pick is outstanding: the card awaiting a capture choice. */
  pending: Card | null;
  log: CaptureEvent[];
  /** Cards highlighted by the last resolution, for the UI to animate. */
  spotlight: CardId[];
}

export interface Outcome {
  /** Points by seat. */
  scores: number[];
  /** An even share of the deck: 105 at two players, exactly 70 at three. */
  par: number;
  /** Points on cards abandoned on the table — they belong to nobody. */
  wastedPoints: number;
  /** Seats holding the highest score; more than one means a tie. */
  winners: Seat[];
  result: 'win' | 'loss' | 'draw';
  /** Seats that beat par（合格）. */
  qualified: Seat[];
  /**
   * Chip deltas for this hand (zero-ish sum). Built from (score − par) plus
   * optional 過紅五／拼零分 bonuses so the qualifying line has cash meaning.
   */
  deltas: number[];
  /** Who triggered 過紅五 this hand, if any and the house rule is on. */
  doubleRedFiveSeat: Seat | null;
  /** Who scored exactly zero and claimed 拼零分, if any and the rule is on. */
  zeroScoreSeat: Seat | null;
}

/**
 * Session shape:
 * - `single` — one hand, no series board or format record
 * - `hands` — fixed N hands（打 N 圈／輪莊）
 * - `target` — first to N chips（打到 N 分）
 */
export type MatchMode = 'single' | 'hands' | 'target';
export type MatchLength = 4 | 8 | 12;
export type TargetScore = 50 | 100 | 200;

/** Stable key for per-format win/loss records（賽制戰績）. */
export type FormatKey =
  | 'hands-4'
  | 'hands-8'
  | 'hands-12'
  | 'target-50'
  | 'target-100'
  | 'target-200';

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
}

export interface HandRecord {
  handIndex: number;
  seedCode: string;
  winner: Seat | null;
  scores: number[];
  deltas: number[];
  qualified: Seat[];
  doubleRedFiveSeat: Seat | null;
  zeroScoreSeat: Seat | null;
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

/** End-of-series MVP — who led red points and who posted the best single hand. */
export interface MatchMvp {
  /** Seat with the highest sum of hand scores（最多紅點）. */
  mostPointsSeat: Seat;
  mostPointsTotal: number;
  /** Seat with the highest single-hand score（單局最高）. */
  bestHandSeat: Seat;
  bestHandScore: number;
  bestHandIndex: number;
  /** Seat with the most chips at the end（籌碼王）. */
  chipLeaderSeat: Seat;
  chipLeaderTotal: number;
}

export interface HintAdvice {
  card: Card | null;
  taken: Card | null;
  reason: string;
}
