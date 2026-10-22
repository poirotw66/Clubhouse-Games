/**
 * Daily All Fives challenge — Taipei (UTC+8) calendar day seeds the deal.
 */
import { hashString } from './rng';

export const DAILY_STORAGE_KEY = 'clubhouse-dominoes-daily-v1';
export const DAILY_MATCH_TARGET = 61;

export interface DailyRecord {
  dateKey: string;
  /** Best match score the human team / player reached that day. */
  bestScore: number;
  /** True once a match was finished (win or lose). */
  completed: boolean;
  /** True when the human side won the match. */
  won: boolean;
  attempts: number;
}

export interface DailyProgress {
  records: DailyRecord[];
}

/** Today's YYYY-MM-DD in Asia/Taipei wall clock. */
export function todayKeyTaipei(now: Date = new Date()): string {
  const shifted = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function dailySeedFor(dateKey: string): string {
  return `dominoes-daily-fives:${dateKey}`;
}

export function dailyDealSeed(dateKey: string): string {
  // Fold hash into the seed string so reshuffles stay deterministic per day.
  return `${dailySeedFor(dateKey)}#${hashString(dailySeedFor(dateKey)).toString(16)}`;
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
      if (typeof r.dateKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.dateKey)) {
        continue;
      }
      records.push({
        dateKey: r.dateKey,
        bestScore: asFiniteInt(r.bestScore, 0),
        completed: Boolean(r.completed),
        won: Boolean(r.won),
        attempts: asFiniteInt(r.attempts, 0),
      });
    }
  }
  records.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  return { records: records.slice(-90) };
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
    /* quota / private mode */
  }
}

export function recordDailyMatch(
  progress: DailyProgress,
  dateKey: string,
  humanScore: number,
  won: boolean,
): DailyProgress {
  const existing = progress.records.find((r) => r.dateKey === dateKey);
  const next: DailyRecord = existing
    ? {
        dateKey,
        bestScore: Math.max(existing.bestScore, humanScore),
        completed: true,
        won: existing.won || won,
        attempts: existing.attempts + 1,
      }
    : {
        dateKey,
        bestScore: humanScore,
        completed: true,
        won,
        attempts: 1,
      };
  const others = progress.records.filter((r) => r.dateKey !== dateKey);
  others.push(next);
  others.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  return { records: others.slice(-90) };
}

function prevDayKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() - 1);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/** Consecutive days (Taipei) with a completed daily, counting back from today. */
export function dailyStreak(progress: DailyProgress, today: string): number {
  const done = new Set(
    progress.records.filter((r) => r.completed).map((r) => r.dateKey),
  );
  let cursor = done.has(today) ? today : prevDayKey(today);
  if (!done.has(cursor)) return 0;
  let streak = 0;
  while (done.has(cursor)) {
    streak += 1;
    cursor = prevDayKey(cursor);
  }
  return streak;
}

export function todayRecord(
  progress: DailyProgress,
  today: string,
): DailyRecord | null {
  return progress.records.find((r) => r.dateKey === today) ?? null;
}

/** Shareable Traditional Chinese summary for clipboard. */
export function formatDailyShareText(opts: {
  dateKey: string;
  bestScore: number;
  streak: number;
  won: boolean;
  target?: number;
}): string {
  const target = opts.target ?? DAILY_MATCH_TARGET;
  const result = opts.won ? '勝' : opts.bestScore > 0 ? '完賽' : '未完賽';
  return [
    `西洋骨牌 · 每日五倍數`,
    `${opts.dateKey}（台北）`,
    `最佳 ${opts.bestScore} 分（目標 ${target}）· ${result}`,
    `連續 ${opts.streak} 天`,
    `#ClubhouseGames #西洋骨牌`,
  ].join('\n');
}
