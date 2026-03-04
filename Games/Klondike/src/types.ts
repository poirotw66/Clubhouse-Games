export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface CardType {
  id: string;
  suit: Suit;
  rank: Rank;
  color: 'red' | 'black';
  faceUp: boolean;
}

export interface GameState {
  tableau: CardType[][];
  foundation: CardType[][];
  stock: CardType[];
  waste: CardType[];
  history: Omit<GameState, 'history'>[];
}

export type DragSource = 
  | { type: 'tableau'; colIndex: number; cardIndex: number }
  | { type: 'waste' }
  | { type: 'foundation'; pileIndex: number };
