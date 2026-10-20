import { dateKey } from './daily';
import { DIFFICULTIES } from './generate';
import type { DifficultyId, WeeklyDaySpec, WeeklyRecord } from './types';

/**
 * Weekly set: seven escalating boards, Monday → Sunday in the same UTC+8
 * calendar the daily challenge uses. Days 5–6 are the blocked-cell variant so
 * the week has a shape of its own, not just seven dailies.
 *
 * The daily seed algorithm is intentionally untouched; weekly seeds are a
 * separate namespace (`weekly-{weekKey}-d{n}`).
 */
export const WEEKLY_DAYS: readonly WeeklyDaySpec[] = [
  { dayIndex: 0, label: '週一・輕鬆', difficulty: 'easy', blockedCount: 0 },
  { dayIndex: 1, label: '週二・普通', difficulty: 'normal', blockedCount: 0 },
  { dayIndex: 2, label: '週三・困難', difficulty: 'hard', blockedCount: 0 },
  { dayIndex: 3, label: '週四・專家', difficulty: 'expert', blockedCount: 0 },
  { dayIndex: 4, label: '週五・專家加料', difficulty: 'expert', blockedCount: 0 },
  { dayIndex: 5, label: '週六・缺口盤', difficulty: 'normal', blockedCount: 3 },
  { dayIndex: 6, label: '週日・缺口盤困難', difficulty: 'hard', blockedCount: 4 },
];

/** Monday of the week containing `key`, as YYYY-MM-DD in UTC+8. */
export function weekKey(now: Date = new Date()): string {
  const key = dateKey(now);
  const [y, m, d] = key.split('-').map(Number);
  // Noon UTC avoids DST edge cases; we only care about the calendar day.
  const utc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  // getUTCDay: 0 = Sunday … 6 = Saturday. Shift so Monday = 0.
  const weekday = (utc.getUTCDay() + 6) % 7;
  utc.setUTCDate(utc.getUTCDate() - weekday);
  const year = utc.getUTCFullYear();
  const month = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const day = String(utc.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function weeklySeed(week: string, dayIndex: number): string {
  return `weekly-${week}-d${dayIndex}`;
}

export function weeklyDaySpec(dayIndex: number): WeeklyDaySpec {
  const spec = WEEKLY_DAYS.find((d) => d.dayIndex === dayIndex);
  if (!spec) throw new Error(`invalid weekly day ${dayIndex}`);
  return spec;
}

export function weeklyDayBlurb(spec: WeeklyDaySpec): string {
  const info = DIFFICULTIES[spec.difficulty];
  if (spec.blockedCount > 0) {
    return `${info.size.rows}×${info.size.cols}・缺口 ${spec.blockedCount} 格`;
  }
  return `${info.size.rows}×${info.size.cols}・${info.label}`;
}

/** Index of today's slot inside the current week (0 = Monday … 6 = Sunday). */
export function todayWeekDayIndex(now: Date = new Date()): number {
  const key = dateKey(now);
  const monday = weekKey(now);
  const [y1, m1, d1] = monday.split('-').map(Number);
  const [y2, m2, d2] = key.split('-').map(Number);
  const a = Date.UTC(y1, m1 - 1, d1);
  const b = Date.UTC(y2, m2 - 1, d2);
  return Math.max(0, Math.min(6, Math.round((b - a) / 86_400_000)));
}

export function emptyWeeklyRecord(week: string): WeeklyRecord {
  return { weekKey: week, days: [], completed: false };
}

export function isWeeklyComplete(record: WeeklyRecord): boolean {
  if (record.completed) return true;
  const cleared = new Set(record.days.map((d) => d.dayIndex));
  return WEEKLY_DAYS.every((d) => cleared.has(d.dayIndex));
}

export function weeklyProgressCount(record: WeeklyRecord): number {
  return new Set(record.days.map((d) => d.dayIndex)).size;
}

export function dayCleared(record: WeeklyRecord, dayIndex: number): boolean {
  return record.days.some((d) => d.dayIndex === dayIndex);
}

/** Soft label for the free-play blocked variant button. */
export function blockedVariantLabel(difficulty: DifficultyId): string {
  return `${DIFFICULTIES[difficulty].label}・缺口盤`;
}
