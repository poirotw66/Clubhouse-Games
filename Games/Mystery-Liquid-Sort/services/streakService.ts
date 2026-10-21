/**
 * Consecutive-day play streak and daily share copy for Mystery Liquid Sort.
 */
import type { DailyMission } from '../types.ts';

const STREAK_STORAGE_KEY = 'mls-streak-v1';

export type StreakState = {
  /** YYYY-MM-DD of last day that counted toward the streak. */
  lastPlayDate: string;
  currentStreak: number;
  bestStreak: number;
};

export const EMPTY_STREAK: StreakState = {
  lastPlayDate: '',
  currentStreak: 0,
  bestStreak: 0,
};

/** Local calendar date as YYYY-MM-DD. */
export function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDateKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function dayDiff(a: string, b: string): number | null {
  const da = parseDateKey(a);
  const db = parseDateKey(b);
  if (!da || !db) return null;
  const ms = db.getTime() - da.getTime();
  return Math.round(ms / 86_400_000);
}

export function loadStreak(): StreakState {
  try {
    const raw = localStorage.getItem(STREAK_STORAGE_KEY);
    if (!raw) return { ...EMPTY_STREAK };
    const parsed = JSON.parse(raw) as Partial<StreakState>;
    const lastPlayDate = typeof parsed.lastPlayDate === 'string' ? parsed.lastPlayDate : '';
    const currentStreak = Math.max(0, Math.floor(Number(parsed.currentStreak) || 0));
    const bestStreak = Math.max(0, Math.floor(Number(parsed.bestStreak) || 0));
    return { lastPlayDate, currentStreak, bestStreak };
  } catch {
    return { ...EMPTY_STREAK };
  }
}

export function saveStreak(state: StreakState): void {
  try {
    localStorage.setItem(STREAK_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* private mode */
  }
}

/**
 * Pure streak update when the player records a qualifying play on `todayKey`.
 * Same-day repeats are no-ops; yesterday continues; gaps reset to 1.
 */
export function applyPlayDay(state: StreakState, todayKey: string): StreakState {
  if (!todayKey) return state;
  if (state.lastPlayDate === todayKey) return state;

  let currentStreak = 1;
  if (state.lastPlayDate) {
    const diff = dayDiff(state.lastPlayDate, todayKey);
    if (diff === 1) currentStreak = state.currentStreak + 1;
    else if (diff === 0) return state;
  }

  const bestStreak = Math.max(state.bestStreak, currentStreak);
  return { lastPlayDate: todayKey, currentStreak, bestStreak };
}

/** Record a win (or daily clear) toward the streak; returns the new state. */
export function recordPlayDay(today: Date = new Date()): StreakState {
  const next = applyPlayDay(loadStreak(), localDateKey(today));
  saveStreak(next);
  return next;
}

/** Display streak: if last play was before yesterday, show 0 until today counts. */
export function displayStreak(state: StreakState = loadStreak(), today: Date = new Date()): number {
  if (!state.lastPlayDate || state.currentStreak <= 0) return 0;
  const todayKey = localDateKey(today);
  if (state.lastPlayDate === todayKey) return state.currentStreak;
  const diff = dayDiff(state.lastPlayDate, todayKey);
  if (diff === 1) return state.currentStreak; // still alive until end of today
  return 0;
}

/**
 * Traditional Chinese share blurb for today's missions / streak / optional
 * daily board label.
 */
export function buildDailyShareText(opts: {
  missions?: DailyMission[];
  streak?: StreakState;
  dailyLabel?: string;
  date?: Date;
}): string {
  const date = opts.date ?? new Date();
  const dateKey = localDateKey(date);
  const streak = opts.streak ?? loadStreak();
  const shown = displayStreak(streak, date);
  const lines: string[] = [
    `神秘液體排序｜每日一題 ${dateKey}`,
    `連續挑戰 ${shown} 天（最佳 ${streak.bestStreak}）`,
  ];
  if (opts.dailyLabel) {
    lines.push(`今日盤面：${opts.dailyLabel}`);
  }
  if (opts.missions && opts.missions.length > 0) {
    const bits = opts.missions.map((m) => {
      const done = m.progress >= m.target ? '✓' : `${m.progress}/${m.target}`;
      return `${m.descriptionKey === 'mission.pour' ? '傾倒' : m.descriptionKey === 'mission.win_level' ? '過關' : '道具'} ${done}`;
    });
    lines.push(`任務：${bits.join('・')}`);
  }
  lines.push('來挑戰看看？');
  return lines.join('\n');
}
