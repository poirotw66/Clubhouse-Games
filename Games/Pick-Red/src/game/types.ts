export type Suit = 'spades' | 'hearts' | 'clubs' | 'diamonds';

/** 1 = A, 11 = J, 12 = Q, 13 = K. */
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

export type CardId = string;

export interface Card {
  id: CardId;
  suit: Suit;
  rank: Rank;
}

export type Side = 'player' | 'cpu';

export type DifficultyId = 'easy' | 'normal' | 'hard';

/** Only two of these exist, because a third measured no better. See cpu.ts. */
export type CpuBrain = 'careless' | 'sharp';

/**
 * A turn is two phases and the player only acts in the first. Keeping them as
 * explicit states rather than resolving both at once is what lets the UI show
 * the flip as a separate beat — otherwise the half of the game nobody controls
 * would be invisible.
 */
export type Phase =
  | 'player_play' // waiting for the player to choose a hand card
  | 'player_pick' // that card matched several table cards; waiting for the choice
  | 'flip' // a card has been flipped and is being resolved
  | 'cpu_play'
  | 'over';

export interface CaptureEvent {
  by: Side;
  /** The card that was played or flipped. */
  played: Card;
  /** The table card it took, or null when nothing matched. */
  taken: Card | null;
  source: 'hand' | 'pile';
  points: number;
  /** The table as it stood before this card landed. What the CPU reasons from. */
  tableBefore: Card[];
}

export interface GameState {
  seedCode: string;
  difficulty: DifficultyId;
  /** Who played the first hand card. Moving second is worth about seven points. */
  leader: Side;
  phase: Phase;
  turn: Side;
  hands: Record<Side, Card[]>;
  captured: Record<Side, Card[]>;
  table: Card[];
  pile: Card[];
  /** Set while phase is 'player_pick': the card awaiting a capture choice. */
  pending: Card | null;
  log: CaptureEvent[];
  /** Cards highlighted by the last resolution, for the UI to animate. */
  spotlight: CardId[];
}

export interface Outcome {
  playerPoints: number;
  cpuPoints: number;
  /** Points on cards abandoned on the table — they belong to nobody. */
  wastedPoints: number;
  result: 'win' | 'loss' | 'draw';
}
