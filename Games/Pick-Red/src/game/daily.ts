/**
 * Daily table — Taipei calendar day seeds the deal so everyone on the same
 * day plays the same fixed-length series.
 */

import type { DailyRecord, HouseRules, MatchConfig } from './types';

/** Fixed length for the shared daily table（四圈）. */
export const DAILY_HANDS = 4;

const DAILY_RULES: HouseRules = {
  players: 2,
  blackAces: false,
  doubleRedFive: true,
  zeroScoreBonus: true,
  rotateLeader: true,
};

/** Taipei (UTC+8) so "today" flips at local midnight. */
const TZ_OFFSET_MINUTES = 8 * 60;

export function taipeiDateKey(now: Date = new Date()): string {
  const shifted = new Date(now.getTime() + TZ_OFFSET_MINUTES * 60_000);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Everyone gets the same seed string on the same Taipei day. */
export function dailySeedCode(dateKey: string = taipeiDateKey()): string {
  return `pr-daily-${dateKey}`;
}

export function dailyMatchConfig(dateKey: string = taipeiDateKey()): MatchConfig {
  return {
    mode: 'daily',
    hands: 4,
    target: 100,
    difficulty: 'normal',
    rules: { ...DAILY_RULES },
    seedCode: dailySeedCode(dateKey),
    ladderOpponentId: null,
  };
}

function previousDay(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - 1);
  return taipeiDateKey(new Date(date.getTime() - TZ_OFFSET_MINUTES * 60_000));
}

/**
 * Consecutive completed daily tables ending today, or ending yesterday —
 * a streak survives until a full day is missed.
 */
export function computeDailyStreak(records: readonly DailyRecord[], today: string): number {
  const days = new Set(records.filter((r) => r.completed).map((r) => r.date));
  let cursor = days.has(today) ? today : previousDay(today);
  if (!days.has(cursor)) return 0;

  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor = previousDay(cursor);
  }
  return streak;
}

export function todayDailyRecord(
  records: readonly DailyRecord[],
  today: string = taipeiDateKey(),
): DailyRecord | null {
  return records.find((r) => r.date === today) ?? null;
}

export interface DailyShareInput {
  date: string;
  seedCode: string;
  chips: number;
  bestChips: number;
  streak: number;
  completed: boolean;
}

/** Clipboard text so friends can compare the same Taipei-day table. */
export function buildDailyShareText(input: DailyShareInput): string {
  const result = input.completed
    ? `成績 ${input.chips >= 0 ? '+' : ''}${input.chips}（今日最佳 ${input.bestChips >= 0 ? '+' : ''}${input.bestChips}）`
    : `尚未打完 · 目前最佳 ${input.bestChips >= 0 ? '+' : ''}${input.bestChips}`;
  return [
    `撿紅點 每日牌桌 ${input.date}`,
    `種子 ${input.seedCode}`,
    result,
    `連續 ${input.streak} 天`,
  ].join('\n');
}

/** Copy text; falls back when Clipboard API is blocked (common on HTTP). */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    if (typeof document === 'undefined') return false;
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.left = '-9999px';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}
