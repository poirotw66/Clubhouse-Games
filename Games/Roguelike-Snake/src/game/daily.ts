/**
 * Daily seed helpers — calendar day string matches the title-screen seed,
 * and clear records drive streak / unlock meta / share text.
 */

export type DailyClearRecord = {
  /** YYYYMMDD — same shape as the title "今日種子" button. */
  date: string;
  cleared: boolean;
  score: number;
  floor: number;
};

export type DailyShareInput = {
  date: string;
  cleared: boolean;
  score: number;
  floor: number;
  streak: number;
  /** Traditional Chinese build name, optional. */
  buildName?: string;
};

/** Calendar day in Asia/Taipei (UTC+8) as YYYYMMDD. */
export function taipeiDateKey(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const y = parts.find((p) => p.type === 'year')?.value ?? '';
  const m = parts.find((p) => p.type === 'month')?.value ?? '';
  const d = parts.find((p) => p.type === 'day')?.value ?? '';
  return `${y}${m}${d}`;
}

/** Local calendar day as YYYYMMDD (anchored to Asia/Taipei for daily seed stability). */
export function todaySeedKey(now: Date = new Date()): string {
  return taipeiDateKey(now);
}

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

export function mergeDailyRecord(
  records: DailyClearRecord[],
  next: DailyClearRecord,
): DailyClearRecord[] {
  const without = records.filter((r) => r.date !== next.date);
  const previous = records.find((r) => r.date === next.date);
  const merged: DailyClearRecord = previous
    ? {
        date: next.date,
        cleared: previous.cleared || next.cleared,
        score: Math.max(previous.score, next.score),
        floor: Math.max(previous.floor, next.floor),
      }
    : next;
  without.push(merged);
  without.sort((a, b) => a.date.localeCompare(b.date));
  return without.slice(-60);
}

/** Wordle-style clipboard text for comparing the same daily seed. */
export function buildDailyShareText(input: DailyShareInput): string {
  const resultLine = input.cleared
    ? `✓ 逃出 · ${input.score} 分 · 第 ${input.floor} 層`
    : `✗ 第 ${input.floor} 層 · ${input.score} 分`;
  const metaParts = [`連勝 ${input.streak} 天`];
  if (input.buildName) metaParts.push(`身分 ${input.buildName}`);
  return [`蛇窟迴廊 每日 ${input.date}`, resultLine, metaParts.join(' · ')].join('\n');
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
