import { OPPONENTS, type OpponentId } from './opponents';
import { betterRank, type ReactionRank } from './ranks';
import type { DailyRecord } from './daily';
import { computeStreak, dateKey } from './daily';

export interface BestRecord {
  highScore: number;
  maxCombo: number;
}

export interface OpponentBest {
  bestReactionMs: number | null;
  rank: ReactionRank | null;
  wins: number;
  losses: number;
}

export interface LadderProgress {
  /** Frontier: opponents with index < clearedCount are cleared; index === clearedCount is unlocked. */
  clearedCount: number;
  cleared: Record<string, true>;
  lastIndex: number;
  opponentBests: Partial<Record<OpponentId, OpponentBest>>;
  dailyRecords: DailyRecord[];
}

export const STORAGE_KEY = 'clubhouse-instant-flash-best';
export const LADDER_KEY = 'clubhouse-instant-flash-ladder';

const EMPTY_BEST: BestRecord = { highScore: 0, maxCombo: 0 };

export const EMPTY_LADDER: LadderProgress = {
  clearedCount: 0,
  cleared: {},
  lastIndex: 0,
  opponentBests: {},
  dailyRecords: [],
};

function asNonNegInt(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

export function loadBest(): BestRecord {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_BEST;
    const parsed = JSON.parse(raw) as Partial<BestRecord>;
    return {
      highScore: Number(parsed.highScore) || 0,
      maxCombo: Number(parsed.maxCombo) || 0,
    };
  } catch {
    return EMPTY_BEST;
  }
}

/** Merge run stats into personal bests (challenge mode only). */
export function saveBest(score: number, maxCombo: number): BestRecord {
  const previous = loadBest();
  const merged: BestRecord = {
    highScore: Math.max(previous.highScore, score),
    maxCombo: Math.max(previous.maxCombo, maxCombo),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    /* private mode / quota — bests are nice-to-have */
  }
  return merged;
}

function mergeOpponentBest(
  prev: OpponentBest | undefined,
  next: { bestReactionMs: number | null; rank: ReactionRank | null; won: boolean },
): OpponentBest {
  const wins = (prev?.wins ?? 0) + (next.won ? 1 : 0);
  const losses = (prev?.losses ?? 0) + (next.won ? 0 : 1);
  let bestReactionMs = prev?.bestReactionMs ?? null;
  if (next.bestReactionMs != null) {
    bestReactionMs =
      bestReactionMs == null
        ? next.bestReactionMs
        : Math.min(bestReactionMs, next.bestReactionMs);
  }
  const rank = next.rank ? betterRank(prev?.rank ?? null, next.rank) : (prev?.rank ?? null);
  return { bestReactionMs, rank, wins, losses };
}

export function mergeLadder(raw: unknown): LadderProgress {
  if (!raw || typeof raw !== 'object') {
    return {
      ...EMPTY_LADDER,
      cleared: {},
      opponentBests: {},
      dailyRecords: [],
    };
  }
  const o = raw as Record<string, unknown>;
  const clearedCount = Math.min(OPPONENTS.length, asNonNegInt(o.clearedCount));
  const lastIndex = Math.min(
    OPPONENTS.length - 1,
    Math.max(0, asNonNegInt(o.lastIndex)),
  );

  const cleared: Record<string, true> = {};
  if (o.cleared && typeof o.cleared === 'object') {
    for (const k of Object.keys(o.cleared as Record<string, unknown>)) {
      if (OPPONENTS.some((op) => op.id === k)) cleared[k] = true;
    }
  }

  const opponentBests: Partial<Record<OpponentId, OpponentBest>> = {};
  if (o.opponentBests && typeof o.opponentBests === 'object') {
    for (const [id, val] of Object.entries(o.opponentBests as Record<string, unknown>)) {
      if (!OPPONENTS.some((op) => op.id === id)) continue;
      if (!val || typeof val !== 'object') continue;
      const v = val as Record<string, unknown>;
      const rankRaw = v.rank;
      const rank: ReactionRank | null =
        rankRaw === 'S' || rankRaw === 'A' || rankRaw === 'B' || rankRaw === 'C'
          ? rankRaw
          : null;
      const bestMs = Number(v.bestReactionMs);
      opponentBests[id as OpponentId] = {
        bestReactionMs: Number.isFinite(bestMs) ? bestMs : null,
        rank,
        wins: asNonNegInt(v.wins),
        losses: asNonNegInt(v.losses),
      };
    }
  }

  const dailyRecords: DailyRecord[] = [];
  if (Array.isArray(o.dailyRecords)) {
    for (const row of o.dailyRecords) {
      if (!row || typeof row !== 'object') continue;
      const r = row as Record<string, unknown>;
      if (typeof r.date !== 'string') continue;
      dailyRecords.push({
        date: r.date,
        won: Boolean(r.won),
        bestReactionMs: Number(r.bestReactionMs) || 0,
        rank: typeof r.rank === 'string' ? r.rank : 'C',
      });
    }
  }

  return { clearedCount, cleared, lastIndex, opponentBests, dailyRecords };
}

export function isOpponentUnlocked(index: number, clearedCount: number): boolean {
  if (index < 0 || index >= OPPONENTS.length) return false;
  return index <= clearedCount;
}

export function applyLadderResult(
  progress: LadderProgress,
  opponentIndex: number,
  result: {
    won: boolean;
    bestReactionMs: number | null;
    rank: ReactionRank | null;
  },
): { progress: LadderProgress; newlyCleared: boolean } {
  const opp = OPPONENTS[opponentIndex];
  if (!opp) return { progress, newlyCleared: false };

  const opponentBests = {
    ...progress.opponentBests,
    [opp.id]: mergeOpponentBest(progress.opponentBests[opp.id], {
      bestReactionMs: result.bestReactionMs,
      rank: result.rank,
      won: result.won,
    }),
  };

  let clearedCount = progress.clearedCount;
  let newlyCleared = false;
  const cleared = { ...progress.cleared };

  if (result.won) {
    cleared[opp.id] = true;
    if (opponentIndex === clearedCount) {
      clearedCount = Math.min(OPPONENTS.length, clearedCount + 1);
      newlyCleared = true;
    } else if (!progress.cleared[opp.id]) {
      newlyCleared = true;
    }
  }

  return {
    progress: {
      ...progress,
      clearedCount,
      cleared,
      lastIndex: opponentIndex,
      opponentBests,
    },
    newlyCleared,
  };
}

export function applyDailyResult(
  progress: LadderProgress,
  record: DailyRecord,
): LadderProgress {
  const dailyRecords = progress.dailyRecords.filter((r) => r.date !== record.date);
  dailyRecords.push(record);
  // Keep last ~60 days
  dailyRecords.sort((a, b) => a.date.localeCompare(b.date));
  const trimmed = dailyRecords.slice(-60);
  return { ...progress, dailyRecords: trimmed };
}

export function loadLadder(): LadderProgress {
  try {
    const raw = localStorage.getItem(LADDER_KEY);
    if (!raw) return mergeLadder(null);
    return mergeLadder(JSON.parse(raw));
  } catch {
    return mergeLadder(null);
  }
}

export function saveLadder(progress: LadderProgress): LadderProgress {
  const merged = mergeLadder(progress);
  try {
    localStorage.setItem(LADDER_KEY, JSON.stringify(merged));
  } catch {
    /* quota / private mode */
  }
  return merged;
}

export function dailyStreakFrom(progress: LadderProgress, today: string = dateKey()): number {
  return computeStreak(progress.dailyRecords, today);
}

export function isLadderComplete(progress: LadderProgress): boolean {
  return progress.clearedCount >= OPPONENTS.length;
}
