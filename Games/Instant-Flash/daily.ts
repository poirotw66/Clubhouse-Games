/**
 * Daily duel — same challenger seed for everyone on the same Taipei calendar day.
 */

import { hashString } from './rng';
import { opponentCount } from './opponents';

const TZ_OFFSET_MINUTES = 8 * 60;

export function dateKey(now: Date = new Date()): string {
  const shifted = new Date(now.getTime() + TZ_OFFSET_MINUTES * 60_000);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function dailySeedCode(key: string): string {
  return `instant-flash-daily-${key}`;
}

export function dailySeedNumber(key: string): number {
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
  bestReactionMs: number;
  rank: string;
};

/** Consecutive wins ending today, or yesterday (streak survives until a day is missed). */
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

/** Pick a ladder opponent index (0..n-1) from the daily seed. Boss appears ~1/8. */
export function dailyOpponentIndex(key: string): number {
  const n = opponentCount();
  if (n <= 0) return 0;
  return dailySeedNumber(key) % n;
}
