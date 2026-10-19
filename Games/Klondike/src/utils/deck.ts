import type { CardType, Suit, Rank, GameState } from '../types.ts';
import { shuffleWithSeed, parseSeed } from './rng.ts';
import {
  buildGuaranteedDeal,
  buildScriptedSolvable,
  isSolvable,
  type SolveOptions,
} from './solver.ts';
import type { DrawCount } from './gameLogic.ts';

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export const createDeck = (): CardType[] => {
  const deck: CardType[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        id: `${suit}-${rank}`,
        suit,
        rank,
        color: suit === 'hearts' || suit === 'diamonds' ? 'red' : 'black',
        faceUp: false,
      });
    }
  }
  return deck;
};

export const shuffleDeck = (deck: CardType[], seed?: number): CardType[] => {
  const usedSeed = seed ?? Math.floor(Math.random() * 0x7fffffff) + 1;
  return shuffleWithSeed(deck, usedSeed);
};

function layoutDeal(deckIn: CardType[], seed: number): GameState {
  const deck = deckIn.map((c) => ({ ...c, faceUp: false }));
  const tableau: CardType[][] = Array.from({ length: 7 }, () => []);

  for (let i = 0; i < 7; i++) {
    for (let j = i; j < 7; j++) {
      const card = deck.pop()!;
      if (i === j) {
        card.faceUp = true;
      }
      tableau[j].push(card);
    }
  }

  return {
    tableau,
    foundation: [[], [], [], []],
    stock: deck,
    waste: [],
    history: [],
    seed,
  };
}

function snapshotToGame(snapshot: {
  tableau: CardType[][];
  foundation: CardType[][];
  stock: CardType[];
  waste: CardType[];
}, seed: number): GameState {
  return {
    tableau: snapshot.tableau.map((col) => col.map((c) => ({ ...c }))),
    foundation: snapshot.foundation.map((pile) => pile.map((c) => ({ ...c }))),
    stock: snapshot.stock.map((c) => ({ ...c })),
    waste: snapshot.waste.map((c) => ({ ...c })),
    history: [],
    seed,
  };
}

/** Deal seven cascades + stock. Same seed always yields the same layout. */
export function dealGame(seed?: number | string): GameState {
  const usedSeed =
    seed === undefined
      ? Math.floor(Math.random() * 0x7fffffff) + 1
      : typeof seed === 'number'
        ? seed >>> 0
        : parseSeed(seed);
  const deck = shuffleWithSeed(createDeck(), usedSeed);
  return layoutDeal(deck, usedSeed);
}

export type SolvableDealOptions = {
  drawCount: DrawCount;
  maxAttempts?: number;
  solve?: SolveOptions;
};

/**
 * Prefer a naturally shuffled deal the thoughtful solver can clear; otherwise
 * reverse-build / script a guaranteed layout from the same seed.
 */
export function findSolvableSeed(
  startSeed: number,
  options: SolvableDealOptions,
): { seed: number; attempts: number; kind: 'filtered' | 'guaranteed' } {
  const maxAttempts = options.maxAttempts ?? 24;
  const base = startSeed >>> 0;
  for (let i = 0; i < maxAttempts; i++) {
    const seed = (base + i) >>> 0;
    const deal = dealGame(seed);
    if (isSolvable(deal, options.drawCount, options.solve ?? { maxNodes: 12_000 })) {
      return { seed, attempts: i + 1, kind: 'filtered' };
    }
  }
  return { seed: base, attempts: maxAttempts, kind: 'guaranteed' };
}

export function dealSolvableGame(
  drawCount: DrawCount,
  startSeed?: number,
  solve?: SolveOptions,
): GameState {
  const start = startSeed ?? Math.floor(Math.random() * 0x7fffffff) + 1;
  const found = findSolvableSeed(start, { drawCount, solve, maxAttempts: 16 });
  if (found.kind === 'filtered') return dealGame(found.seed);
  const built = buildGuaranteedDeal(found.seed);
  return snapshotToGame(built, found.seed);
}

/** Daily / challenge helper: always return a solvable layout for the seed. */
export function dealDailySolvable(seed: number, drawCount: DrawCount): GameState {
  const found = findSolvableSeed(seed, {
    drawCount,
    maxAttempts: 32,
    solve: { maxNodes: 14_000 },
  });
  if (found.kind === 'filtered') return dealGame(found.seed);
  return snapshotToGame(buildScriptedSolvable(seed), seed);
}
