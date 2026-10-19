/**
 * Lightweight local achievements tied to the same meta progress as builds /
 * Ironsnake / daily clears. Display names are Traditional Chinese.
 */
import type { DailyClearRecord } from './daily';

export interface AchievementDef {
  id: string;
  name: string;
  blurb: string;
}

/** Minimal meta shape so achievements stay free of a storage import cycle. */
export interface AchievementProgress {
  floor: number;
  escapes: number;
  ironsnakeClears: number;
  unlockedBuilds: string[];
  achievements: string[];
  dailyRecords: DailyClearRecord[];
}

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  {
    id: 'depth-5',
    name: '初探深淵',
    blurb: '抵達第 5 層。',
  },
  {
    id: 'depth-10',
    name: '十層迴廊',
    blurb: '抵達第 10 層。',
  },
  {
    id: 'escape',
    name: '逃出蛇窟',
    blurb: '擊敗第 15 層首領並逃出。',
  },
  {
    id: 'ironsnake-escape',
    name: '鐵蛇脫殼',
    blurb: '以 Ironsnake 硬派模式逃出蛇窟。',
  },
  {
    id: 'daily-clear',
    name: '今日倖存',
    blurb: '完成一次今日挑戰通關。',
  },
  {
    id: 'daily-streak-3',
    name: '三日連勝',
    blurb: '每日挑戰連勝達到 3 天。',
  },
  {
    id: 'all-builds',
    name: '四蛇齊備',
    blurb: '解鎖全部起始身分。',
  },
];

export function achievementById(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

/** Evaluate which achievement ids should be unlocked for this meta snapshot. */
export function evaluateAchievements(
  meta: AchievementProgress,
  dailyStreak: number,
): string[] {
  const unlocked = new Set(meta.achievements);
  if (meta.floor >= 5) unlocked.add('depth-5');
  if (meta.floor >= 10) unlocked.add('depth-10');
  if (meta.escapes >= 1) unlocked.add('escape');
  if (meta.ironsnakeClears >= 1) unlocked.add('ironsnake-escape');
  if (meta.dailyRecords.some((r) => r.cleared)) unlocked.add('daily-clear');
  if (dailyStreak >= 3) unlocked.add('daily-streak-3');
  if (meta.unlockedBuilds.length >= 4) unlocked.add('all-builds');
  return [...unlocked];
}
