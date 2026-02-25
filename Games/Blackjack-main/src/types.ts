export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  suit: Suit;
  rank: Rank;
  isHidden?: boolean;
}

export type HandStatus = 'playing' | 'busted' | 'stood' | 'won' | 'lost' | 'push' | 'blackjack' | 'surrendered';

export interface PlayerHand {
  id: string;
  cards: Card[];
  bet: number;
  status: HandStatus;
}

export type GameState = 'betting' | 'playing' | 'dealerTurn' | 'gameOver';
