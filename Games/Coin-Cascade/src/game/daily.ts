/**
 * Daily seeded challenge — calendar day → fixed seed + score target.
 * Uses the same determinism as free play / mode pack.
 */
import { hashString } from './rng';
import type { RunState } from './types';
import type { TableId } from './tables';
import { TABLE_PACK } from './tables';

export const DAILY_STORAGE_KEY = 'coin-cascade:daily-v1';

export interface DailyChallenge {
  /** YYYY-MM-DD in local calendar. */
  readonly dateKey: string;
  readonly seedCode: string;
  readonly targetScore: number;
  readonly startingCredits: number;
  readonly tableId: TableId;
  readonly goalLabel: string;
}

export interface DailyRecord {
  readonly dateKey: string;
  readonly bestScore: number;
  readonly cleared: boolean;
  readonly attempts: number;
}

export interface DailyProgress {
  readonly records: readonly DailyRecord[];
}

export function todayDateKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Build today's challenge from the calendar date (deterministic). */
export function dailyChallengeFor(dateKey: string): DailyChallenge {
  const seedCode = `cc-daily-${dateKey}`;
  const h = hashString(seedCode);
  // Target in a playable band for ~160 credits on classic / rotating tables.
  const targetScore = 70 + (h % 71); // 70–140
  const startingCredits = 160;
  const tableId = TABLE_PACK[h % TABLE_PACK.length]!.id;
  return {
    dateKey,
    seedCode,
    targetScore,
    startingCredits,
    tableId,
    goalLabel: `分數達到 ${targetScore}`,
  };
}

export function evaluateDailyClear(challenge: DailyChallenge, state: RunState): boolean {
  if (state.phase !== 'ended') return false;
  return state.score >= challenge.targetScore;
}

function asFiniteInt(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n));
}

export function parseDailyProgress(raw: unknown): DailyProgress {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const records: DailyRecord[] = [];
  if (Array.isArray(obj.records)) {
    for (const item of obj.records) {
      if (!item || typeof item !== 'object') continue;
      const r = item as Record<string, unknown>;
      if (typeof r.dateKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.dateKey)) continue;
      records.push({
        dateKey: r.dateKey,
        bestScore: asFiniteInt(r.bestScore, 0),
        cleared: Boolean(r.cleared),
        attempts: asFiniteInt(r.attempts, 0),
      });
    }
  }
  records.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  return { records: records.slice(-60) };
}

export function loadDailyProgress(): DailyProgress {
  try {
    const raw = localStorage.getItem(DAILY_STORAGE_KEY);
    if (!raw) return { records: [] };
    return parseDailyProgress(JSON.parse(raw));
  } catch {
    return { records: [] };
  }
}

export function saveDailyProgress(progress: DailyProgress): void {
  try {
    localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    /* ignore */
  }
}

export function recordDailyAttempt(
  progress: DailyProgress,
  challenge: DailyChallenge,
  state: RunState,
): DailyProgress {
  if (state.phase !== 'ended') return progress;
  const cleared = evaluateDailyClear(challenge, state);
  const existing = progress.records.find((r) => r.dateKey === challenge.dateKey);
  const next: DailyRecord = existing
    ? {
        dateKey: challenge.dateKey,
        bestScore: Math.max(existing.bestScore, state.score),
        cleared: existing.cleared || cleared,
        attempts: existing.attempts + 1,
      }
    : {
        dateKey: challenge.dateKey,
        bestScore: state.score,
        cleared,
        attempts: 1,
      };
  const others = progress.records.filter((r) => r.dateKey !== challenge.dateKey);
  others.push(next);
  others.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  return { records: others.slice(-60) };
}

export function dailyStreak(progress: DailyProgress, today: string): number {
  const cleared = new Set(progress.records.filter((r) => r.cleared).map((r) => r.dateKey));
  const prev = (key: string): string => {
    const [y, m, d] = key.split('-').map(Number);
    const dt = new Date(y!, m! - 1, d!);
    dt.setDate(dt.getDate() - 1);
    return todayDateKey(dt);
  };
  let cursor = cleared.has(today) ? today : prev(today);
  if (!cleared.has(cursor)) return 0;
  let streak = 0;
  while (cleared.has(cursor)) {
    streak += 1;
    cursor = prev(cursor);
  }
  return streak;
}
