// Sequential league ladder — unlock next opponent on win; persist like other games.

import {
  OPPONENTS,
  opponentByIndex,
  opponentCount,
  type OpponentId,
} from './opponents.ts';

export const LEAGUE_KEY = 'clubhouse-toy-boxing-league';

export interface LeagueProgress {
  /** Number of opponents beaten from the start (0 = only first unlocked). */
  clearedCount: number;
  /** Best score recorded per opponent id. */
  bestScore: Record<string, number>;
  /** Opponent ids cleared at least once. */
  cleared: Record<string, true>;
  /** Last selected rung index. */
  lastIndex: number;
}

export const EMPTY_LEAGUE: LeagueProgress = {
  clearedCount: 0,
  bestScore: {},
  cleared: {},
  lastIndex: 0,
};

function asNonNegInt(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

export function mergeLeague(raw: unknown): LeagueProgress {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_LEAGUE, bestScore: {}, cleared: {} };
  const o = raw as Record<string, unknown>;
  const clearedCount = Math.min(opponentCount(), asNonNegInt(o.clearedCount));
  const lastIndex = Math.min(
    opponentCount() - 1,
    Math.max(0, asNonNegInt(o.lastIndex)),
  );

  const bestScore: Record<string, number> = {};
  if (o.bestScore && typeof o.bestScore === 'object') {
    for (const [k, v] of Object.entries(o.bestScore as Record<string, unknown>)) {
      bestScore[k] = asNonNegInt(v);
    }
  }

  const cleared: Record<string, true> = {};
  if (o.cleared && typeof o.cleared === 'object') {
    for (const k of Object.keys(o.cleared as Record<string, unknown>)) {
      if (OPPONENTS.some((op) => op.id === k)) cleared[k] = true;
    }
  }

  return { clearedCount, bestScore, cleared, lastIndex };
}

export function isOpponentUnlocked(index: number, clearedCount: number): boolean {
  if (index < 0 || index >= opponentCount()) return false;
  return index <= clearedCount;
}

export function continueLeagueIndex(clearedCount: number): number {
  if (clearedCount <= 0) return 0;
  if (clearedCount >= opponentCount()) return opponentCount() - 1;
  return clearedCount;
}

export function applyLeagueWin(
  progress: LeagueProgress,
  opponentIndex: number,
  playerScore: number,
): { progress: LeagueProgress; newlyCleared: boolean } {
  const opp = opponentByIndex(opponentIndex);
  if (!opp) return { progress, newlyCleared: false };

  const score = Math.max(0, Math.floor(playerScore));
  const bestScore = { ...progress.bestScore };
  const prev = bestScore[opp.id];
  bestScore[opp.id] = prev == null ? score : Math.max(prev, score);

  const cleared = { ...progress.cleared, [opp.id]: true as const };
  let clearedCount = progress.clearedCount;
  let newlyCleared = false;

  // Advance unlock cursor only when beating the frontier opponent.
  if (opponentIndex === clearedCount) {
    clearedCount = Math.min(opponentCount(), clearedCount + 1);
    newlyCleared = true;
  } else if (!progress.cleared[opp.id]) {
    newlyCleared = true;
  }

  return {
    progress: {
      clearedCount,
      bestScore,
      cleared,
      lastIndex: opponentIndex,
    },
    newlyCleared,
  };
}

export function applyLeagueLoss(
  progress: LeagueProgress,
  opponentIndex: number,
): LeagueProgress {
  return { ...progress, lastIndex: opponentIndex };
}

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function defaultStorage(): StorageLike | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function loadLeague(storage: StorageLike | null = defaultStorage()): LeagueProgress {
  if (!storage) return mergeLeague(null);
  try {
    const raw = storage.getItem(LEAGUE_KEY);
    if (!raw) return mergeLeague(null);
    return mergeLeague(JSON.parse(raw));
  } catch {
    return mergeLeague(null);
  }
}

export function saveLeague(
  progress: LeagueProgress,
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(LEAGUE_KEY, JSON.stringify(mergeLeague(progress)));
  } catch {
    /* quota / private mode */
  }
}

export function leagueTitle(): string {
  return '玩具拳擊聯賽';
}

export function isLeagueComplete(progress: LeagueProgress): boolean {
  return progress.clearedCount >= opponentCount();
}

export type { OpponentId };
