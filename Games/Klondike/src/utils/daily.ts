/**
 * Daily seeded deal — same board for everyone on the same Taipei calendar day.
 */

import { hashString } from './rng.ts';

const TZ_OFFSET_MINUTES = 8 * 60;

export function dateKey(now: Date = new Date()): string {
  const shifted = new Date(now.getTime() + TZ_OFFSET_MINUTES * 60_000);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function dailySeedCode(key: string): string {
  return `klondike-daily-${key}`;
}

/** Base seed before solvable-offset search. */
export function dailyBaseSeed(key: string): number {
  return hashString(dailySeedCode(key));
}

function previousDay(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - 1);
  return dateKey(new Date(date.getTime() - TZ_OFFSET_MINUTES * 60_000));
}

export type DailyRecord = {
  date: string;
  won: boolean;
  score: number;
  elapsedSec: number;
  moves: number;
  drawCount: 1 | 3;
  scoreMode: 'standard' | 'vegas';
};

/** Consecutive days ending today, or yesterday (streak survives until a day is missed). */
export function computeStreak(records: DailyRecord[], today: string): number {
  const days = new Set(records.filter((r) => r.won).map((r) => r.date));
  let cursor = days.has(today) ? today : previousDay(today);
  if (!days.has(cursor)) return 0;
  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor = previousDay(cursor);
  }
  return streak;
}
