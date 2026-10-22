/**
 * Daily seeded board — same shuffle for everyone on the same Taipei calendar day.
 */

import type { PairCount, ThemeId } from './memoryLogic.ts';
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
  return `memory-daily-${key}`;
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
  pairCount: PairCount;
  themeId: ThemeId;
};

/** Rotate size / theme by day so the daily stays fresh without being brutal. */
export function dailyConfig(key: string): DailyConfig {
  const seed = hashString(key);
  const sizes: PairCount[] = [6, 12, 12, 18];
  const themes: ThemeId[] = ['classic', 'night', 'orchard', 'jewel', 'classic'];
  const pairCount = sizes[seed % sizes.length];
  let themeId = themes[seed % themes.length];
  // Large boards only exist on classic theme.
  if (pairCount > 12) themeId = 'classic';
  return { pairCount, themeId };
}

export type DailyShareInput = {
  date: string;
  moves: number;
  elapsedSec: number;
  streak: number;
  pairCount: number;
  themeLabel: string;
};

export function buildDailyShareText(input: DailyShareInput): string {
  return [
    `記憶配對 每日 ${input.date}`,
    `✓ ${input.themeLabel} · ${input.pairCount} 對`,
    `翻牌 ${input.moves} · 用時 ${input.elapsedSec}s`,
    `連續 ${input.streak} 天`,
  ].join('\n');
}

/** Copy text to clipboard; falls back to execCommand when Clipboard API is blocked. */
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
