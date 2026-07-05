import { Card, Suit } from "../types";
import { shuffleArray } from "@clubhouse/shared/shuffle";

export const SUITS: Suit[] = ["spades", "hearts", "diamonds", "clubs"];

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    const color = suit === "hearts" || suit === "diamonds" ? "red" : "black";
    for (let rank = 1; rank <= 13; rank++) {
      deck.push({
        id: `${suit}-${rank}`,
        suit,
        rank,
        color,
      });
    }
  }
  return deck;
}

export function shuffle(deck: Card[]): Card[] {
  return shuffleArray(deck);
}

export function dealGame(): { tableaus: Card[][] } {
  const deck = shuffleArray(createDeck());
  const tableaus: Card[][] = Array.from({ length: 8 }, () => []);

  for (let i = 0; i < 52; i++) {
    tableaus[i % 8].push(deck[i]);
  }

  return { tableaus };
}
