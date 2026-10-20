import { emptyPlayerStats } from './achievements';
import type {
  DailyRecord,
  DifficultyId,
  PlayerStats,
  Progress,
  WeeklyDayRecord,
  WeeklyRecord,
} from './types';

const KEY = 'clubhouse:every-corner';
const SAVE_KEY = `${KEY}:save`;
const DAILY_KEY = `${KEY}:daily`;
const WEEKLY_KEY = `${KEY}:weekly`;
const STATS_KEY = `${KEY}:stats`;

const DIFFICULTIES: DifficultyId[] = ['easy', 'normal', 'hard', 'expert'];

export interface SavedGame {
  seedCode: string;
  difficulty: DifficultyId;
  isDaily: boolean;
  isWeekly: boolean;
  weeklyDayIndex: number | null;
  blockedCount: number;
  progress: Progress;
}

function isDifficulty(value: unknown): value is DifficultyId {
  return typeof value === 'string' && (DIFFICULTIES as string[]).includes(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parseProgress(raw: unknown): Progress | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  if (!Array.isArray(p.path) || !p.path.every((c) => isFiniteNumber(c))) return null;
  if (!isFiniteNumber(p.hintsUsed) || !isFiniteNumber(p.elapsedMs)) return null;
  return {
    path: p.path.map(Number),
    hintsUsed: Math.max(0, Math.floor(p.hintsUsed)),
    elapsedMs: Math.max(0, p.elapsedMs),
    solved: Boolean(p.solved),
  };
}

export function saveGame(save: SavedGame): void {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Private mode or a full quota: the puzzle simply is not resumable.
  }
}

export function loadGame(): SavedGame | null {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const progress = parseProgress(parsed.progress);
    if (!progress) return null;
    if (typeof parsed.seedCode !== 'string' || !isDifficulty(parsed.difficulty)) return null;
    return {
      seedCode: parsed.seedCode,
      difficulty: parsed.difficulty,
      isDaily: Boolean(parsed.isDaily),
      isWeekly: Boolean(parsed.isWeekly),
      weeklyDayIndex:
        parsed.weeklyDayIndex === null || parsed.weeklyDayIndex === undefined
          ? null
          : isFiniteNumber(parsed.weeklyDayIndex)
            ? Math.max(0, Math.min(6, Math.floor(parsed.weeklyDayIndex)))
            : null,
      blockedCount: isFiniteNumber(parsed.blockedCount)
        ? Math.max(0, Math.floor(parsed.blockedCount))
        : 0,
      progress,
    };
  } catch {
    return null;
  }
}

export function clearGame(): void {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to do.
  }
}

export function loadDaily(): DailyRecord[] {
  try {
    const raw = window.localStorage.getItem(DAILY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row): DailyRecord | null => {
        if (!row || typeof row !== 'object') return null;
        const r = row as Record<string, unknown>;
        if (typeof r.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) return null;
        if (!isFiniteNumber(r.elapsedMs) || !isFiniteNumber(r.hintsUsed)) return null;
        return {
          date: r.date,
          elapsedMs: Math.max(0, r.elapsedMs),
          hintsUsed: Math.max(0, Math.floor(r.hintsUsed)),
        };
      })
      .filter((r): r is DailyRecord => r !== null);
  } catch {
    return [];
  }
}

/** One record per day; a repeat solve keeps the better time. */
export function recordDaily(record: DailyRecord): DailyRecord[] {
  const existing = loadDaily();
  const previous = existing.find((r) => r.date === record.date);
  const merged = previous
    ? existing.map((r) =>
        r.date === record.date
          ? {
              ...r,
              elapsedMs: Math.min(r.elapsedMs, record.elapsedMs),
              hintsUsed: Math.min(r.hintsUsed, record.hintsUsed),
            }
          : r,
      )
    : [...existing, record];

  const trimmed = merged.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 400);
  try {
    window.localStorage.setItem(DAILY_KEY, JSON.stringify(trimmed));
  } catch {
    // Best effort only.
  }
  return trimmed;
}

function parseWeeklyDay(raw: unknown): WeeklyDayRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!isFiniteNumber(r.dayIndex) || !isFiniteNumber(r.elapsedMs) || !isFiniteNumber(r.hintsUsed)) {
    return null;
  }
  const dayIndex = Math.floor(r.dayIndex);
  if (dayIndex < 0 || dayIndex > 6) return null;
  return {
    dayIndex,
    elapsedMs: Math.max(0, r.elapsedMs),
    hintsUsed: Math.max(0, Math.floor(r.hintsUsed)),
  };
}

export function loadWeekly(weekKey: string): WeeklyRecord {
  try {
    const raw = window.localStorage.getItem(WEEKLY_KEY);
    if (!raw) return { weekKey, days: [], completed: false };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed.weekKey !== 'string' || parsed.weekKey !== weekKey) {
      return { weekKey, days: [], completed: false };
    }
    const days = Array.isArray(parsed.days)
      ? parsed.days.map(parseWeeklyDay).filter((d): d is WeeklyDayRecord => d !== null)
      : [];
    const cleared = new Set(days.map((d) => d.dayIndex));
    const completed = Boolean(parsed.completed) || [0, 1, 2, 3, 4, 5, 6].every((i) => cleared.has(i));
    return { weekKey, days, completed };
  } catch {
    return { weekKey, days: [], completed: false };
  }
}

export function saveWeekly(record: WeeklyRecord): void {
  try {
    window.localStorage.setItem(WEEKLY_KEY, JSON.stringify(record));
  } catch {
    // Best effort only.
  }
}

/** Merge one weekly day clear; keeps the better time on repeats. */
export function recordWeeklyDay(
  weekKey: string,
  day: WeeklyDayRecord,
): WeeklyRecord {
  const existing = loadWeekly(weekKey);
  const previous = existing.days.find((d) => d.dayIndex === day.dayIndex);
  const days = previous
    ? existing.days.map((d) =>
        d.dayIndex === day.dayIndex
          ? {
              ...d,
              elapsedMs: Math.min(d.elapsedMs, day.elapsedMs),
              hintsUsed: Math.min(d.hintsUsed, day.hintsUsed),
            }
          : d,
      )
    : [...existing.days, day];

  const cleared = new Set(days.map((d) => d.dayIndex));
  const completed = [0, 1, 2, 3, 4, 5, 6].every((i) => cleared.has(i));
  const next: WeeklyRecord = { weekKey, days, completed };
  saveWeekly(next);
  return next;
}

function parseCountMap(raw: unknown): Record<DifficultyId, number> {
  const base: Record<DifficultyId, number> = { easy: 0, normal: 0, hard: 0, expert: 0 };
  if (!raw || typeof raw !== 'object') return base;
  const obj = raw as Record<string, unknown>;
  for (const id of DIFFICULTIES) {
    if (isFiniteNumber(obj[id]) && obj[id] >= 0) base[id] = Math.floor(obj[id]);
  }
  return base;
}

/** Validate localStorage payload; corrupt data falls back to empty stats. */
export function loadStats(): PlayerStats {
  try {
    const raw = window.localStorage.getItem(STATS_KEY);
    if (!raw) return emptyPlayerStats();
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return emptyPlayerStats();

    const bestMsBySize: Record<string, number> = {};
    if (parsed.bestMsBySize && typeof parsed.bestMsBySize === 'object') {
      for (const [key, value] of Object.entries(parsed.bestMsBySize as Record<string, unknown>)) {
        if (/^\d+x\d+$/.test(key) && isFiniteNumber(value) && value > 0) {
          bestMsBySize[key] = value;
        }
      }
    }

    const achievements = Array.isArray(parsed.achievements)
      ? parsed.achievements.filter((id): id is string => typeof id === 'string' && id.length > 0)
      : [];

    return {
      totalSolved: isFiniteNumber(parsed.totalSolved) ? Math.max(0, Math.floor(parsed.totalSolved)) : 0,
      noHintClears: isFiniteNumber(parsed.noHintClears)
        ? Math.max(0, Math.floor(parsed.noHintClears))
        : 0,
      clearsByDifficulty: parseCountMap(parsed.clearsByDifficulty),
      noHintByDifficulty: parseCountMap(parsed.noHintByDifficulty),
      bestMsBySize,
      achievements,
      weeklyCompletions: isFiniteNumber(parsed.weeklyCompletions)
        ? Math.max(0, Math.floor(parsed.weeklyCompletions))
        : 0,
    };
  } catch {
    return emptyPlayerStats();
  }
}

export function saveStats(stats: PlayerStats): void {
  try {
    window.localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    // Best effort only.
  }
}
