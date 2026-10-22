/**
 * Daily shoe challenge — Taipei calendar day seeds a fixed shoe.
 * Same date → same card order for everyone.
 */
import { hashString } from './rng.ts';
import { createSeededShoe, type ShoeState } from './shoe.ts';

export const DAILY_STORAGE_KEY = 'clubhouse-blackjack-daily:v1';
export const DAILY_HANDS = 20;
export const DAILY_START_BALANCE = 1000;
export const DAILY_DECK_COUNT = 6;
export const DAILY_PENETRATION = 0.75;
export const DAILY_MIN_BET = 25;
export const DAILY_MAX_BET = 200;
export const DAILY_CHIP_VALUES = [25, 50, 100, 200] as const;

const TZ_OFFSET_MS = 8 * 60 * 60 * 1000;

/** YYYY-MM-DD in Asia/Taipei (UTC+8 wall clock). */
export function todayKeyTaipei(now: Date = new Date()): string {
  const shifted = new Date(now.getTime() + TZ_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function previousDayKey(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() - 1);
  return todayKeyTaipei(new Date(utc.getTime() - TZ_OFFSET_MS));
}

export function dailySeed(dateKey: string): number {
  return hashString(`blackjack-daily-shoe:${dateKey}`);
}

export function createDailyShoe(dateKey: string = todayKeyTaipei()): ShoeState {
  return createSeededShoe(DAILY_DECK_COUNT, dailySeed(dateKey), DAILY_PENETRATION);
}

export interface DailyRunRecord {
  date: string;
  /** Best ending bankroll across attempts that day. */
  bestBalance: number;
  strategyCorrect: number;
  strategyTotal: number;
  /** Hands completed in the best run (or latest completing run). */
  handsPlayed: number;
  attempts: number;
  /** True when at least one full 20-hand run finished that day. */
  completed: boolean;
}

export interface DailyPersist {
  /** Per-day bests keyed by date. */
  days: Record<string, DailyRunRecord>;
  /** Last calendar day a full run was completed (for streak). */
  lastCompletedDate: string | null;
  streak: number;
  bestStreak: number;
}

export const EMPTY_DAILY: DailyPersist = {
  days: {},
  lastCompletedDate: null,
  streak: 0,
  bestStreak: 0,
};

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function loadDailyPersist(): DailyPersist {
  try {
    const raw = localStorage.getItem(DAILY_STORAGE_KEY);
    if (!raw) return { ...EMPTY_DAILY, days: {} };
    const parsed = JSON.parse(raw) as Partial<DailyPersist>;
    const days: Record<string, DailyRunRecord> = {};
    if (parsed.days && typeof parsed.days === 'object') {
      for (const [key, value] of Object.entries(parsed.days)) {
        if (!value || typeof value !== 'object') continue;
        const v = value as Partial<DailyRunRecord>;
        days[key] = {
          date: typeof v.date === 'string' ? v.date : key,
          bestBalance: Math.max(0, Math.floor(num(v.bestBalance, 0))),
          strategyCorrect: Math.max(0, Math.floor(num(v.strategyCorrect, 0))),
          strategyTotal: Math.max(0, Math.floor(num(v.strategyTotal, 0))),
          handsPlayed: Math.max(0, Math.floor(num(v.handsPlayed, 0))),
          attempts: Math.max(0, Math.floor(num(v.attempts, 0))),
          completed: Boolean(v.completed),
        };
      }
    }
    return {
      days,
      lastCompletedDate:
        typeof parsed.lastCompletedDate === 'string' ? parsed.lastCompletedDate : null,
      streak: Math.max(0, Math.floor(num(parsed.streak, 0))),
      bestStreak: Math.max(0, Math.floor(num(parsed.bestStreak, 0))),
    };
  } catch {
    return { ...EMPTY_DAILY, days: {} };
  }
}

export function saveDailyPersist(data: DailyPersist): void {
  try {
    localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore quota / private mode
  }
}

export function strategyAccuracyPercent(correct: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.round((correct / total) * 100);
}

/**
 * Merge a finished (or aborted) daily attempt into persisted bests.
 * `completed` means all DAILY_HANDS were played (bankrupt mid-run still counts as an attempt).
 */
export function mergeDailyAttempt(
  prev: DailyPersist,
  date: string,
  endingBalance: number,
  strategyCorrect: number,
  strategyTotal: number,
  handsPlayed: number,
  completed: boolean,
): DailyPersist {
  const existing = prev.days[date];
  const balance = Math.max(0, Math.floor(endingBalance));
  const better =
    !existing ||
    balance > existing.bestBalance ||
    (balance === existing.bestBalance && strategyCorrect > existing.strategyCorrect);

  const day: DailyRunRecord = {
    date,
    bestBalance: existing ? Math.max(existing.bestBalance, balance) : balance,
    strategyCorrect: better
      ? Math.max(0, Math.floor(strategyCorrect))
      : (existing?.strategyCorrect ?? Math.max(0, Math.floor(strategyCorrect))),
    strategyTotal: better
      ? Math.max(0, Math.floor(strategyTotal))
      : (existing?.strategyTotal ?? Math.max(0, Math.floor(strategyTotal))),
    handsPlayed: better
      ? Math.max(0, Math.floor(handsPlayed))
      : (existing?.handsPlayed ?? Math.max(0, Math.floor(handsPlayed))),
    attempts: (existing?.attempts ?? 0) + 1,
    completed: Boolean(existing?.completed) || completed,
  };

  let streak = prev.streak;
  let bestStreak = prev.bestStreak;
  let lastCompletedDate = prev.lastCompletedDate;

  if (completed) {
    if (lastCompletedDate === date) {
      // already counted today
    } else if (lastCompletedDate === previousDayKey(date)) {
      streak = streak + 1;
      lastCompletedDate = date;
    } else {
      streak = 1;
      lastCompletedDate = date;
    }
    bestStreak = Math.max(bestStreak, streak);
  }

  return {
    days: { ...prev.days, [date]: day },
    lastCompletedDate,
    streak,
    bestStreak,
  };
}

/** Live streak including today if already completed; else consecutive prior days. */
export function currentStreak(persist: DailyPersist, today: string = todayKeyTaipei()): number {
  const todayDone = persist.days[today]?.completed;
  if (todayDone) return persist.streak;
  // If yesterday completed, show that streak as "active"; else 0.
  if (persist.lastCompletedDate === previousDayKey(today)) return persist.streak;
  return 0;
}

export function formatDailyShareText(
  date: string,
  bestBalance: number,
  strategyCorrect: number,
  strategyTotal: number,
  streak: number,
): string {
  const acc = strategyAccuracyPercent(strategyCorrect, strategyTotal);
  const accPart = acc != null ? `策略 ${strategyCorrect}/${strategyTotal}（${acc}%）` : '策略 —';
  return [
    `【俱樂部二十一點 · 每日牌靴】`,
    `日期 ${date}（台北）`,
    `最佳結餘 $${bestBalance}／起手 $${DAILY_START_BALANCE} · ${DAILY_HANDS} 手`,
    accPart,
    `連續完成 ${streak} 天`,
    `#ClubhouseBlackjack #每日牌靴`,
  ].join('\n');
}
