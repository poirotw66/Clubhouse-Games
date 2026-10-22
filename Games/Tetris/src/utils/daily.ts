/**
 * Daily challenge meta: date-seeded piece bags, today best, streak, share text.
 * Sprint (40 lines) and Ultra (2 min) share one calendar day and streak.
 */

import { hashString, mulberry32 } from './rng.ts';
import type { TetrominoType } from './tetrisLogic.ts';
import { shuffleBagWith } from './tetrisLogic.ts';

export const DAILY_STORAGE_KEY = 'clubhouse:tetris-daily-v1';

export type DailyKind = 'sprint' | 'ultra';

export interface DailyKindBest {
  /** Sprint: elapsed ms (lower better). Ultra: score (higher better). */
  value: number;
  /** Lines cleared on the best run (ghost progress). */
  lines: number;
  cleared: boolean;
  attempts: number;
}

export interface DailyDayRecord {
  /** YYYY-MM-DD in UTC+8. */
  date: string;
  sprint: DailyKindBest | null;
  ultra: DailyKindBest | null;
}

export interface DailyMeta {
  /** Per-day records (newest last); trimmed. */
  days: DailyDayRecord[];
}

export function emptyDailyMeta(): DailyMeta {
  return { days: [] };
}

/** Today's date key in UTC+8 (Asia/Taipei wall clock). */
export function todayKeyUTC8(now: Date = new Date()): string {
  const shifted = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function previousDayKey(key: string): string {
  const [ys, ms, ds] = key.split('-');
  const date = new Date(Date.UTC(Number(ys), Number(ms) - 1, Number(ds)));
  date.setUTCDate(date.getUTCDate() - 1);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function dailySeed(date: string, kind: DailyKind): number {
  return hashString(`tetris-daily-${date}-${kind}`);
}

const BAG: TetrominoType[] = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];

/** Enough pieces for a full sprint/ultra without falling back to Math.random. */
export const DAILY_PIECE_COUNT = 280;

export function generateSeededPieces(
  seed: number,
  count: number = DAILY_PIECE_COUNT,
): TetrominoType[] {
  const rand = mulberry32(seed);
  const out: TetrominoType[] = [];
  while (out.length < count) {
    out.push(...shuffleBagWith(rand, [...BAG]));
  }
  return out.slice(0, count);
}

export function loadDailyMeta(): DailyMeta {
  try {
    const parsed = JSON.parse(localStorage.getItem(DAILY_STORAGE_KEY) || 'null');
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.days)) {
      return emptyDailyMeta();
    }
    const days: DailyDayRecord[] = [];
    for (const raw of parsed.days) {
      if (!raw || typeof raw.date !== 'string') continue;
      days.push({
        date: raw.date,
        sprint: normalizeKindBest(raw.sprint),
        ultra: normalizeKindBest(raw.ultra),
      });
    }
    return { days };
  } catch {
    return emptyDailyMeta();
  }
}

function normalizeKindBest(raw: unknown): DailyKindBest | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  return {
    value: Number(o.value) || 0,
    lines: Number(o.lines) || 0,
    cleared: Boolean(o.cleared),
    attempts: Math.max(0, Number(o.attempts) || 0),
  };
}

export function saveDailyMeta(meta: DailyMeta): void {
  try {
    localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify(meta));
  } catch {
    /* storage unavailable */
  }
}

export function getDayRecord(meta: DailyMeta, date: string): DailyDayRecord {
  return (
    meta.days.find((d) => d.date === date) ?? {
      date,
      sprint: null,
      ultra: null,
    }
  );
}

function dayCleared(day: DailyDayRecord): boolean {
  return Boolean(day.sprint?.cleared || day.ultra?.cleared);
}

/**
 * Consecutive days with at least one daily clear, ending today or yesterday
 * (streak survives one open day without a clear).
 */
export function computeDailyStreak(meta: DailyMeta, today: string): number {
  const byDate = new Map(meta.days.map((d) => [d.date, d]));
  let cursor = today;
  const todayDay = byDate.get(today);
  if (!todayDay || !dayCleared(todayDay)) {
    cursor = previousDayKey(today);
  }
  let streak = 0;
  while (true) {
    const day = byDate.get(cursor);
    if (!day || !dayCleared(day)) break;
    streak += 1;
    cursor = previousDayKey(cursor);
  }
  return streak;
}

export function mergeDailyResult(
  meta: DailyMeta,
  date: string,
  kind: DailyKind,
  value: number,
  lines: number,
  cleared: boolean,
): DailyMeta {
  const days = [...meta.days];
  let idx = days.findIndex((d) => d.date === date);
  if (idx < 0) {
    days.push({ date, sprint: null, ultra: null });
    idx = days.length - 1;
  }
  const day = { ...days[idx] };
  const prev = day[kind];
  const attempts = (prev?.attempts ?? 0) + 1;

  let next: DailyKindBest;
  if (kind === 'sprint') {
    const prevTime = prev?.cleared ? prev.value : Number.POSITIVE_INFINITY;
    const beat = cleared && value < prevTime;
    next = {
      value: beat ? value : prev?.cleared ? prev.value : 0,
      lines: beat ? lines : Math.max(prev?.lines ?? 0, lines),
      cleared: Boolean(prev?.cleared || cleared),
      attempts,
    };
    if (cleared && !prev?.cleared) {
      next = { value, lines, cleared: true, attempts };
    }
  } else {
    const beat = !prev || value > prev.value;
    next = {
      value: beat ? value : prev.value,
      lines: beat ? lines : prev.lines,
      cleared: Boolean(prev?.cleared || cleared),
      attempts,
    };
  }

  day[kind] = next;
  days[idx] = day;
  days.sort((a, b) => a.date.localeCompare(b.date));
  return { days: days.slice(-60) };
}

export function buildDailyShareText(input: {
  date: string;
  kind: DailyKind;
  value: number;
  lines: number;
  cleared: boolean;
  streak: number;
}): string {
  const label = input.kind === 'sprint' ? '每日 40 行' : '每日 Ultra';
  const result =
    input.kind === 'sprint'
      ? input.cleared
        ? `✓ ${formatShareTime(input.value)} · ${input.lines} 行`
        : `✗ ${input.lines} 行（未完成）`
      : `${input.cleared ? '✓' : '·'} ${input.value} 分 · ${input.lines} 行`;
  return [`俄羅斯方塊 ${label} ${input.date}`, result, `連續 ${input.streak} 天`].join('\n');
}

export function formatShareTime(ms: number): string {
  const totalSeconds = Math.max(0, ms) / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  return `${minutes}:${seconds.toFixed(1).padStart(4, '0')}`;
}

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

/** Progress 0..1 for ghost / bar; sprint uses lines/40, ultra uses score vs today best. */
export function dailyProgressRatio(
  kind: DailyKind,
  lines: number,
  score: number,
  todayBest: DailyKindBest | null,
): { current: number; ghost: number | null } {
  if (kind === 'sprint') {
    const current = Math.min(1, lines / 40);
    const ghost = todayBest
      ? todayBest.cleared
        ? 1
        : Math.min(1, todayBest.lines / 40)
      : null;
    return { current, ghost };
  }
  const best = todayBest?.value ?? 0;
  const current = best > 0 ? Math.min(1, score / Math.max(best, 1)) : score > 0 ? 0.5 : 0;
  const ghost = todayBest && todayBest.value > 0 ? 1 : null;
  return { current, ghost };
}
