/**
 * Daily seeded run helpers. The calendar day string is anchored to Asia/Taipei
 * (UTC+8) so all players globally share the exact same daily seed and rollover
 * time. hashString maps any string to a stable 32-bit seed, so the existing
 * deterministic junction stream needs no special path.
 */

export const TAIPEI_TIMEZONE = 'Asia/Taipei';

/** Calendar day in Asia/Taipei (UTC+8) as YYYYMMDD. */
export function taipeiDateKey(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TAIPEI_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const y = parts.find((p) => p.type === 'year')?.value ?? '';
  const m = parts.find((p) => p.type === 'month')?.value ?? '';
  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  return `${y}${m}${day}`;
}

/** Local calendar day as YYYYMMDD (anchored to Asia/Taipei for daily seed stability). */
export function todayKey(now: Date = new Date()): string {
  return taipeiDateKey(now);
}

/** Seed code for today's daily run (same string the engine hashes). */
export function dailySeedCode(now: Date = new Date()): string {
  return `D${todayKey(now)}`;
}

/** Preceding calendar day in YYYYMMDD (UTC date arithmetic). */
export function previousDayKey(key: string): string {
  const year = Number(key.slice(0, 4));
  const month = Number(key.slice(4, 6));
  const day = Number(key.slice(6, 8));
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - 1);
  const prevY = date.getUTCFullYear();
  const prevM = String(date.getUTCMonth() + 1).padStart(2, '0');
  const prevD = String(date.getUTCDate()).padStart(2, '0');
  return `${prevY}${prevM}${prevD}`;
}

/** Succeeding calendar day in YYYYMMDD (UTC date arithmetic). */
export function nextDayKey(key: string): string {
  const year = Number(key.slice(0, 4));
  const month = Number(key.slice(4, 6));
  const day = Number(key.slice(6, 8));
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + 1);
  const nextY = date.getUTCFullYear();
  const nextM = String(date.getUTCMonth() + 1).padStart(2, '0');
  const nextD = String(date.getUTCDate()).padStart(2, '0');
  return `${nextY}${nextM}${nextD}`;
}

/** Whether two date strings represent consecutive days. */
export function isConsecutiveDay(prevKey: string, nextKey: string): boolean {
  return nextDayKey(prevKey) === nextKey;
}

export interface DailyClearRecord {
  date: string;
  cleared: boolean;
  distance: number;
  score: number;
}

/** Consecutive daily clears ending today, or yesterday (streak survives one open day). */
export function computeDailyStreak(records: DailyClearRecord[], today: string): number {
  const days = new Set(records.filter((r) => r.cleared).map((r) => r.date));
  let cursor = days.has(today) ? today : previousDayKey(today);
  if (!days.has(cursor)) return 0;
  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor = previousDayKey(cursor);
  }
  return streak;
}

export interface DailyBestRecord {
  date: string;
  bestDistance: number;
  bestScore: number;
  attempts: number;
  streak?: number;
}

export const EMPTY_DAILY_BEST: DailyBestRecord = {
  date: '',
  bestDistance: 0,
  bestScore: 0,
  attempts: 0,
  streak: 0,
};

/** Merge a finished daily attempt into the best-of-day record. */
export function mergeDailyBest(
  previous: DailyBestRecord,
  date: string,
  distance: number,
  score: number,
  targetDistance = 1500,
): DailyBestRecord {
  const clearedThisRun = distance >= targetDistance;
  if (previous.date !== date) {
    const isNextDay = previous.date !== '' && isConsecutiveDay(previous.date, date);
    const prevStreak = previous.streak ?? (previous.bestDistance >= targetDistance ? 1 : 0);
    const nextStreak = isNextDay ? (clearedThisRun ? prevStreak + 1 : prevStreak) : clearedThisRun ? 1 : 0;
    return {
      date,
      bestDistance: Math.max(0, Math.floor(distance)),
      bestScore: Math.max(0, Math.floor(score)),
      attempts: 1,
      streak: nextStreak,
    };
  }
  const wasCleared = previous.bestDistance >= targetDistance;
  const currentStreak = previous.streak ?? (wasCleared ? 1 : 0);
  const updatedStreak = !wasCleared && clearedThisRun ? Math.max(1, currentStreak + 1) : currentStreak;
  return {
    date,
    bestDistance: Math.max(previous.bestDistance, Math.floor(distance)),
    bestScore: Math.max(previous.bestScore, Math.floor(score)),
    attempts: previous.attempts + 1,
    streak: updatedStreak,
  };
}
