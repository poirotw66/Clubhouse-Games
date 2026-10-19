/**
 * Daily seeded puzzle — same board for everyone on the same Taipei calendar day.
 */

import { BOARD_SIZES, type BoardSize, type ScrambleTier, type VisualStyle } from './fifteenLogic.ts';
import { hashString } from './rng.ts';
import type { DailyRecord } from './storage.ts';

const TZ_OFFSET_MINUTES = 8 * 60;

export function dateKey(now: Date = new Date()): string {
  const shifted = new Date(now.getTime() + TZ_OFFSET_MINUTES * 60_000);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function dailySeedCode(key: string): string {
  return `fifteen-daily-${key}`;
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

/** Consecutive days ending today, or yesterday (streak survives until a day is missed). */
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

export type DailyConfig = {
  size: BoardSize;
  tier: ScrambleTier;
  style: VisualStyle;
};

/** Rotate size / style by day-of-year so the daily stays fresh without being brutal. */
export function dailyConfig(key: string): DailyConfig {
  const seed = hashString(key);
  const size = BOARD_SIZES[seed % 3]; // 3 / 4 / 5 — 6×6 stays campaign-only
  const tiers: ScrambleTier[] = ['easy', 'normal', 'normal', 'hard'];
  const tier = tiers[seed % tiers.length];
  const style: VisualStyle = seed % 5 === 0 ? 'picture' : 'number';
  return { size, tier, style };
}
