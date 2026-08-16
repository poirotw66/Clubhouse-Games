import type { DailyRecord, DailyStats, DifficultyId } from './types';

/** Taipei time, so "today's puzzle" changes at local midnight. */
const TZ_OFFSET_MINUTES = 8 * 60;

export function dateKey(now: Date = new Date()): string {
  const shifted = new Date(now.getTime() + TZ_OFFSET_MINUTES * 60_000);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Everyone gets the same board on the same day, without a server. */
export function dailySeed(key: string): string {
  return `daily-${key}`;
}

export const DAILY_DIFFICULTY: DifficultyId = 'normal';

function previousDay(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - 1);
  return dateKey(new Date(date.getTime() - TZ_OFFSET_MINUTES * 60_000));
}

/**
 * Consecutive days ending today, or ending yesterday — a streak is not broken
 * until a day is actually missed, so it survives right up to midnight.
 */
export function computeStreak(records: DailyRecord[], today: string): number {
  const days = new Set(records.map((r) => r.date));
  let cursor = days.has(today) ? today : previousDay(today);
  if (!days.has(cursor)) return 0;

  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor = previousDay(cursor);
  }
  return streak;
}

export function summarise(records: DailyRecord[], today: string): DailyStats {
  const times = records.map((r) => r.elapsedMs).filter((ms) => ms > 0);
  return {
    records,
    streak: computeStreak(records, today),
    bestMs: times.length > 0 ? Math.min(...times) : 0,
  };
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
