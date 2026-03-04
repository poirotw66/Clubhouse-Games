export type Suit = "spades" | "hearts" | "diamonds" | "clubs";
export type Color = "red" | "black";

export interface Card {
  id: string;
  suit: Suit;
  rank: number; // 1 (A) to 13 (K)
  color: Color;
}

export interface GameState {
  freeCells: (Card | null)[]; // length 4
  foundations: Record<Suit, number>; // highest rank in foundation
  tableaus: Card[][]; // length 8
  history: GameState[]; // for undo
}

export interface Position {
  zone: "freeCell" | "foundation" | "tableau";
  index: number; // 0-3 for freeCell/foundation, 0-7 for tableau
  cardIndex?: number; // for tableau, the index of the card in the column
}
