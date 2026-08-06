import type { Card, Suit } from "../types";

export const SUITS: Suit[] = ["spades", "hearts", "diamonds", "clubs"];

/** mulberry32 — deterministic enough for numbered FreeCell deals. */
function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWithSeed<T>(items: readonly T[], seed: number): T[] {
  const rng = createRng(seed);
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

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

/** Deal 8 cascades. Same seed always yields the same layout. */
export function dealGame(seed?: number): { tableaus: Card[][]; seed: number } {
  const usedSeed = seed ?? Math.floor(Math.random() * 0x7fffffff) + 1;
  const deck = shuffleWithSeed(createDeck(), usedSeed);
  const tableaus: Card[][] = Array.from({ length: 8 }, () => []);

  for (let i = 0; i < 52; i++) {
    tableaus[i % 8].push(deck[i]);
  }

  return { tableaus, seed: usedSeed };
}
