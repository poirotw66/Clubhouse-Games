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

/** Interactive deals keep the solver off the main thread; difficulty search uses a modest budget. */
const RATE_SOLVE: SolveOptions = { maxNodes: 6_000 };
const SEARCH_SOLVE: SolveOptions = { maxNodes: 4_000 };

/** Rate an already-dealt layout (call from idle / useEffect, not during click handlers). */
export function rateDeal(
  tableaus: Card[][],
  solve: SolveOptions = RATE_SOLVE,
): { parMoves: number | null; difficulty: Difficulty } {
  const par = estimateParMoves(tableaus, solve);
  return { parMoves: par, difficulty: classifyDifficulty(par) };
}

/**
 * Search nearby seeds until solver par matches the requested difficulty band.
 * `any` returns immediately without blocking on the solver (rate later via `rateDeal`).
 */
export function dealForDifficulty(
  difficulty: Difficulty,
  startSeed?: number,
  solve: SolveOptions = SEARCH_SOLVE,
  maxAttempts = 16,
): DealWithMeta {
  const base = (startSeed ?? Math.floor(Math.random() * 0x7fffffff) + 1) >>> 0 || 1;
  if (difficulty === 'any') {
    const deal = dealGame(base);
    return { ...deal, parMoves: null, difficulty: 'any' };
  }

  let fallback: DealWithMeta | null = null;
  for (let i = 0; i < maxAttempts; i++) {
    const seed = (base + i) >>> 0 || 1;
    const deal = dealGame(seed);
    const rated = rateDeal(deal.tableaus, solve);
    const meta: DealWithMeta = { ...deal, ...rated };
    if (!fallback) fallback = meta;
    if (rated.difficulty === difficulty) return meta;
  }
  return fallback ?? { ...dealGame(base), parMoves: null, difficulty: 'any' };
}

/** Daily uses the exact Taipei-derived seed; par is rated asynchronously by the UI. */
export function dealDaily(baseSeed: number): DealWithMeta {
  const deal = dealGame(baseSeed);
  return { ...deal, parMoves: null, difficulty: 'any' };
}
