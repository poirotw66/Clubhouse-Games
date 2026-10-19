import type { Card, GameState, Position } from '../types.ts';
import {
  canMove,
  checkWin,
  executeMove,
  getSafeFoundationMoves,
  isValidSequence,
} from './gameLogic.ts';
import type { Difficulty } from './storage.ts';

export type SolveOptions = {
  maxNodes?: number;
};

export type SolveResult = {
  path: { source: Position; dest: Position }[];
  nodes: number;
};

function emptyState(tableaus: Card[][]): GameState {
  return {
    freeCells: [null, null, null, null],
    foundations: { spades: 0, hearts: 0, diamonds: 0, clubs: 0 },
    tableaus: tableaus.map((col) => col.map((c) => ({ ...c }))),
    history: [],
  };
}

function hashState(state: GameState): string {
  const fc = state.freeCells.map((c) => (c ? c.id : '')).join(',');
  const fd = `${state.foundations.spades},${state.foundations.hearts},${state.foundations.diamonds},${state.foundations.clubs}`;
  const tab = state.tableaus.map((col) => col.map((c) => c.id).join(',')).join('|');
  return `${fc}#${fd}#${tab}`;
}

function getAllValidMoves(state: GameState): { source: Position; dest: Position }[] {
  const sources: Position[] = [];
  for (let i = 0; i < 4; i++) {
    if (state.freeCells[i] !== null) sources.push({ zone: 'freeCell', index: i });
  }
  for (let i = 0; i < 8; i++) {
    const col = state.tableaus[i]!;
    if (col.length > 0) {
      for (let j = col.length - 1; j >= 0; j--) {
        if (isValidSequence(col.slice(j))) {
          sources.push({ zone: 'tableau', index: i, cardIndex: j });
        } else {
          break;
        }
      }
    }
  }

  const destinations: Position[] = [
    ...[0, 1, 2, 3].map((i) => ({ zone: 'foundation' as const, index: i })),
    ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ zone: 'tableau' as const, index: i })),
    ...[0, 1, 2, 3].map((i) => ({ zone: 'freeCell' as const, index: i })),
  ];

  const validMoves: { source: Position; dest: Position }[] = [];
  for (const source of sources) {
    for (const dest of destinations) {
      if (source.zone === dest.zone && source.index === dest.index) continue;
      if (canMove(state, source, dest)) {
        if (source.zone === 'freeCell' && dest.zone === 'freeCell') continue;
        if (
          source.zone === 'tableau' &&
          dest.zone === 'tableau' &&
          source.cardIndex === 0 &&
          state.tableaus[dest.index]!.length === 0
        ) {
          continue;
        }
        validMoves.push({ source, dest });
      }
    }
  }
  return validMoves;
}

function getHeuristic(state: GameState): number {
  let score = 0;
  score += Object.values(state.foundations).reduce((a, b) => a + b, 0) * 100;
  score += state.freeCells.filter((c) => c === null).length * 20;
  score += state.tableaus.filter((t) => t.length === 0).length * 50;
  return score;
}

/**
 * Best-first search for a solution path. Sync; used for par / difficulty.
 */
export function solveSync(
  initialState: GameState,
  options: SolveOptions = {},
): SolveResult | null {
  const maxNodes = options.maxNodes ?? 8_000;
  const visited = new Set<string>();

  interface Node {
    state: GameState;
    path: { source: Position; dest: Position }[];
    score: number;
  }

  const queue: Node[] = [
    {
      state: initialState,
      path: [],
      score: getHeuristic(initialState),
    },
  ];

  let nodesExplored = 0;

  while (queue.length > 0) {
    let bestIdx = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < queue.length; i++) {
      if (queue[i]!.score > bestScore) {
        bestScore = queue[i]!.score;
        bestIdx = i;
      }
    }

    const current = queue[bestIdx]!;
    queue.splice(bestIdx, 1);

    nodesExplored += 1;
    if (nodesExplored > maxNodes) return null;

    if (checkWin(current.state)) {
      return { path: current.path, nodes: nodesExplored };
    }

    const hash = hashState(current.state);
    if (visited.has(hash)) continue;
    visited.add(hash);

    const safeMove = getSafeFoundationMoves(current.state);
    if (safeMove) {
      const nextState = executeMove(current.state, safeMove.source, safeMove.dest);
      queue.push({
        state: nextState,
        path: [...current.path, safeMove],
        score: getHeuristic(nextState),
      });
      continue;
    }

    const moves = getAllValidMoves(current.state);
    for (const move of moves) {
      const nextState = executeMove(current.state, move.source, move.dest);
      const nextHash = hashState(nextState);
      if (!visited.has(nextHash)) {
        queue.push({
          state: nextState,
          path: [...current.path, move],
          score: getHeuristic(nextState),
        });
      }
    }
  }
  return null;
}

/** Async wrapper for the in-game auto-solver (yields periodically). */
export async function solveGame(
  initialState: GameState,
  onProgress: (nodes: number) => void,
): Promise<{ source: Position; dest: Position }[] | null> {
  const maxNodes = 15_000;
  const visited = new Set<string>();

  interface Node {
    state: GameState;
    path: { source: Position; dest: Position }[];
    score: number;
  }

  const queue: Node[] = [
    {
      state: initialState,
      path: [],
      score: getHeuristic(initialState),
    },
  ];

  let nodesExplored = 0;

  while (queue.length > 0) {
    let bestIdx = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < queue.length; i++) {
      if (queue[i]!.score > bestScore) {
        bestScore = queue[i]!.score;
        bestIdx = i;
      }
    }

    const current = queue[bestIdx]!;
    queue.splice(bestIdx, 1);

    nodesExplored += 1;
    if (nodesExplored % 200 === 0) {
      onProgress(nodesExplored);
      await new Promise((r) => setTimeout(r, 0));
    }

    if (nodesExplored > maxNodes) return null;

    if (checkWin(current.state)) return current.path;

    const hash = hashState(current.state);
    if (visited.has(hash)) continue;
    visited.add(hash);

    const safeMove = getSafeFoundationMoves(current.state);
    if (safeMove) {
      const nextState = executeMove(current.state, safeMove.source, safeMove.dest);
      queue.push({
        state: nextState,
        path: [...current.path, safeMove],
        score: getHeuristic(nextState),
      });
      continue;
    }

    const moves = getAllValidMoves(current.state);
    for (const move of moves) {
      const nextState = executeMove(current.state, move.source, move.dest);
      const nextHash = hashState(nextState);
      if (!visited.has(nextHash)) {
        queue.push({
          state: nextState,
          path: [...current.path, move],
          score: getHeuristic(nextState),
        });
      }
    }
  }
  return null;
}

/**
 * Estimate solver "par" (path length). Null when unsolved within the node budget.
 */
export function estimateParMoves(
  tableaus: Card[][],
  options: SolveOptions = {},
): number | null {
  const result = solveSync(emptyState(tableaus), options);
  return result ? result.path.length : null;
}

/**
 * Banding by solver path length. Unsolved → hard (treat as deep).
 * Typical FreeCell solutions cluster ~40–100 moves for this heuristic search.
 */
export function classifyDifficulty(parMoves: number | null): Difficulty {
  if (parMoves == null) return 'hard';
  if (parMoves <= 52) return 'easy';
  if (parMoves <= 78) return 'medium';
  return 'hard';
}

export function difficultyLabel(d: Difficulty): string {
  switch (d) {
    case 'easy':
      return '簡單';
    case 'medium':
      return '中等';
    case 'hard':
      return '困難';
    default:
      return '任意';
  }
}
