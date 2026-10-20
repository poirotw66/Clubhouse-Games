/**
 * Data-driven achievements. Display names are Traditional Chinese; ids are
 * stable English keys so localStorage stays readable across renames of copy.
 */
import type { ClearEvent, DifficultyId, PlayerStats } from './types';

export interface AchievementDef {
  id: string;
  name: string;
  blurb: string;
}

/** Speed thresholds (ms) per board size for the "lightning" family. */
export const SPEED_LIMITS_MS: Record<string, number> = {
  '5x5': 45_000,
  '6x6': 90_000,
  '7x7': 150_000,
  '8x8': 240_000,
};

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  {
    id: 'first-clear',
    name: '初次走透',
    blurb: '完成任意一題。',
  },
  {
    id: 'no-hint-any',
    name: '自力更生',
    blurb: '不使用提示完成一題。',
  },
  {
    id: 'no-hint-easy',
    name: '輕鬆無提示',
    blurb: '不使用提示完成一題輕鬆難度。',
  },
  {
    id: 'no-hint-normal',
    name: '普通無提示',
    blurb: '不使用提示完成一題普通難度。',
  },
  {
    id: 'no-hint-hard',
    name: '困難無提示',
    blurb: '不使用提示完成一題困難難度。',
  },
  {
    id: 'no-hint-expert',
    name: '專家無提示',
    blurb: '不使用提示完成一題專家難度。',
  },
  {
    id: 'speed-5x5',
    name: '五格疾走',
    blurb: '在 45 秒內完成一題 5×5。',
  },
  {
    id: 'speed-6x6',
    name: '六格疾走',
    blurb: '在 90 秒內完成一題 6×6。',
  },
  {
    id: 'speed-7x7',
    name: '七格疾走',
    blurb: '在 150 秒內完成一題 7×7。',
  },
  {
    id: 'speed-8x8',
    name: '八格疾走',
    blurb: '在 240 秒內完成一題 8×8。',
  },
  {
    id: 'streak-3',
    name: '三日連透',
    blurb: '每日挑戰連續完成 3 天。',
  },
  {
    id: 'streak-7',
    name: '一週連透',
    blurb: '每日挑戰連續完成 7 天。',
  },
  {
    id: 'streak-14',
    name: '兩週連透',
    blurb: '每日挑戰連續完成 14 天。',
  },
  {
    id: 'solved-10',
    name: '十題達人',
    blurb: '累計完成 10 題。',
  },
  {
    id: 'solved-50',
    name: '五十題旅人',
    blurb: '累計完成 50 題。',
  },
  {
    id: 'weekly-complete',
    name: '週挑戰通關',
    blurb: '在同一週內完成全部七題週挑戰。',
  },
  {
    id: 'blocked-clear',
    name: '缺口穿越',
    blurb: '完成一題缺口盤（有空洞的變體）。',
  },
];

export function achievementById(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

export function sizeKeyOf(rows: number, cols: number): string {
  return `${rows}x${cols}`;
}

function emptyClears(): Record<DifficultyId, number> {
  return { easy: 0, normal: 0, hard: 0, expert: 0 };
}

export function emptyPlayerStats(): PlayerStats {
  return {
    totalSolved: 0,
    noHintClears: 0,
    clearsByDifficulty: emptyClears(),
    noHintByDifficulty: emptyClears(),
    bestMsBySize: {},
    achievements: [],
    weeklyCompletions: 0,
  };
}

/**
 * Pure evaluation against a stats snapshot and the current daily streak.
 * Never removes an already-unlocked id.
 */
export function evaluateAchievements(stats: PlayerStats, dailyStreak: number): string[] {
  const unlocked = new Set(stats.achievements);

  if (stats.totalSolved >= 1) unlocked.add('first-clear');
  if (stats.noHintClears >= 1) unlocked.add('no-hint-any');

  const noHintDiff: Array<[DifficultyId, string]> = [
    ['easy', 'no-hint-easy'],
    ['normal', 'no-hint-normal'],
    ['hard', 'no-hint-hard'],
    ['expert', 'no-hint-expert'],
  ];
  for (const [diff, id] of noHintDiff) {
    if (stats.noHintByDifficulty[diff] >= 1) unlocked.add(id);
  }

  for (const [size, limit] of Object.entries(SPEED_LIMITS_MS)) {
    const best = stats.bestMsBySize[size] ?? 0;
    if (best > 0 && best <= limit) unlocked.add(`speed-${size}`);
  }

  if (dailyStreak >= 3) unlocked.add('streak-3');
  if (dailyStreak >= 7) unlocked.add('streak-7');
  if (dailyStreak >= 14) unlocked.add('streak-14');

  if (stats.totalSolved >= 10) unlocked.add('solved-10');
  if (stats.totalSolved >= 50) unlocked.add('solved-50');

  if (stats.weeklyCompletions >= 1) unlocked.add('weekly-complete');

  // blocked-clear is awarded when recording a blocked clear event.
  if (stats.achievements.includes('blocked-clear')) unlocked.add('blocked-clear');

  return [...unlocked];
}

/** Apply one successful clear to stats; returns the next snapshot and new unlocks. */
export function applyClear(
  previous: PlayerStats,
  event: ClearEvent,
  dailyStreak: number,
): { stats: PlayerStats; newAchievements: string[] } {
  if (event.gaveUp) {
    return { stats: previous, newAchievements: [] };
  }

  const next: PlayerStats = {
    ...previous,
    totalSolved: previous.totalSolved + 1,
    noHintClears: previous.noHintClears + (event.hintsUsed === 0 ? 1 : 0),
    clearsByDifficulty: {
      ...previous.clearsByDifficulty,
      [event.difficulty]: previous.clearsByDifficulty[event.difficulty] + 1,
    },
    noHintByDifficulty: {
      ...previous.noHintByDifficulty,
      [event.difficulty]:
        previous.noHintByDifficulty[event.difficulty] + (event.hintsUsed === 0 ? 1 : 0),
    },
    bestMsBySize: { ...previous.bestMsBySize },
    achievements: [...previous.achievements],
    weeklyCompletions: previous.weeklyCompletions,
  };

  const priorBest = next.bestMsBySize[event.sizeKey] ?? 0;
  if (priorBest === 0 || event.elapsedMs < priorBest) {
    next.bestMsBySize[event.sizeKey] = event.elapsedMs;
  }

  if (event.variant === 'blocked' && !next.achievements.includes('blocked-clear')) {
    next.achievements.push('blocked-clear');
  }

  const before = new Set(previous.achievements);
  next.achievements = evaluateAchievements(next, dailyStreak);
  const newAchievements = next.achievements.filter((id) => !before.has(id));
  return { stats: next, newAchievements };
}

export function markWeeklyCompletion(
  previous: PlayerStats,
  dailyStreak: number,
): { stats: PlayerStats; newAchievements: string[] } {
  const next: PlayerStats = {
    ...previous,
    weeklyCompletions: previous.weeklyCompletions + 1,
    achievements: [...previous.achievements],
  };
  const before = new Set(previous.achievements);
  next.achievements = evaluateAchievements(next, dailyStreak);
  return {
    stats: next,
    newAchievements: next.achievements.filter((id) => !before.has(id)),
  };
}
