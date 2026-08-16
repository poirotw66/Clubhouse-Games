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

export interface Rules {
  players: PlayerCount;
  /** 黑桃A 30 分、梅花A 40 分 — a common house rule, off by default. */
  blackAces: boolean;
}

export interface GameState {
  seedCode: string;
  rules: Rules;
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
}
