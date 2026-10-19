import type { Card, Suit } from '../types.ts';
import type { Difficulty } from './storage.ts';
import { classifyDifficulty, estimateParMoves, type SolveOptions } from './solver.ts';
import { parseSeed, shuffleWithSeed } from './rng.ts';

export const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    const color = suit === 'hearts' || suit === 'diamonds' ? 'red' : 'black';
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
export function dealGame(seed?: number | string): { tableaus: Card[][]; seed: number } {
  const usedSeed =
    seed === undefined
      ? Math.floor(Math.random() * 0x7fffffff) + 1
      : typeof seed === 'number'
        ? seed >>> 0 || 1
        : parseSeed(String(seed)) || 1;
  const deck = shuffleWithSeed(createDeck(), usedSeed);
  const tableaus: Card[][] = Array.from({ length: 8 }, () => []);

  for (let i = 0; i < 52; i++) {
    tableaus[i % 8]!.push(deck[i]!);
  }

  return { tableaus, seed: usedSeed };
}

export type DealWithMeta = {
  tableaus: Card[][];
  seed: number;
  parMoves: number | null;
  difficulty: Difficulty;
};

const DEFAULT_SOLVE: SolveOptions = { maxNodes: 10_000 };

/**
 * Search nearby seeds until solver par matches the requested difficulty band.
 * Falls back to the start seed (with its measured or null par) if none match.
 */
export function dealForDifficulty(
  difficulty: Difficulty,
  startSeed?: number,
  solve: SolveOptions = DEFAULT_SOLVE,
  maxAttempts = 24,
): DealWithMeta {
  const base = (startSeed ?? Math.floor(Math.random() * 0x7fffffff) + 1) >>> 0 || 1;
  if (difficulty === 'any') {
    const deal = dealGame(base);
    const par = estimateParMoves(deal.tableaus, solve);
    return {
      ...deal,
      parMoves: par,
      difficulty: classifyDifficulty(par),
    };
  }

  let fallback: DealWithMeta | null = null;
  for (let i = 0; i < maxAttempts; i++) {
    const seed = (base + i) >>> 0 || 1;
    const deal = dealGame(seed);
    const par = estimateParMoves(deal.tableaus, solve);
    const rated = classifyDifficulty(par);
    const meta: DealWithMeta = { ...deal, parMoves: par, difficulty: rated };
    if (!fallback) fallback = meta;
    if (rated === difficulty) return meta;
  }
  return fallback ?? { ...dealGame(base), parMoves: null, difficulty: 'any' };
}

export function dealDaily(
  baseSeed: number,
  solve: SolveOptions = DEFAULT_SOLVE,
): DealWithMeta {
  // Daily always uses the exact Taipei-derived seed (no difficulty offset).
  const deal = dealGame(baseSeed);
  const par = estimateParMoves(deal.tableaus, { ...solve, maxNodes: 12_000 });
  return {
    ...deal,
    parMoves: par,
    difficulty: classifyDifficulty(par),
  };
}
