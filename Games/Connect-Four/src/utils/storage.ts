/**
 * Namespaced Connect Four persistence with legacy streak migration.
 *
 * Keys:
 *   clubhouse:connect-four:stats:v1
 *   clubhouse:connect-four:match:v1
 *   clubhouse:connect-four:puzzles:v1
 *
 * Legacy (pre-depth):
 *   clubhouse-connect4-win-streak
 *   clubhouse-connect4-best-streak
 */

import {
  BOARD_PRESETS,
  DEFAULT_SERIES_TARGET,
  RULE_VARIANTS,
  SERIES_TARGETS,
  type BoardPresetId,
  type Difficulty,
  type PersonalityId,
  type RuleVariantId,
  type SeriesTarget,
} from './types';
import { PERSONALITY_IDS } from './connect4Logic';
import { isValidSeriesTarget } from './match';
import { PUZZLES } from './puzzles';

const STATS_KEY = 'clubhouse:connect-four:stats:v1';
const MATCH_KEY = 'clubhouse:connect-four:match:v1';
const PUZZLE_KEY = 'clubhouse:connect-four:puzzles:v1';
const LEGACY_STREAK_KEY = 'clubhouse-connect4-win-streak';
const LEGACY_BEST_KEY = 'clubhouse-connect4-best-streak';

export interface ConnectFourStats {
  games: number;
  wins: number;
  losses: number;
  draws: number;
  streak: number;
  bestStreak: number;
  seriesWins: number;
  seriesLosses: number;
  puzzlesSolved: number;
  lastDifficulty: Difficulty;
  lastPersonality: PersonalityId;
  lastVariant: RuleVariantId;
  lastPreset: BoardPresetId;
  lastSeriesTarget: SeriesTarget;
}

export const EMPTY_STATS: ConnectFourStats = {
  games: 0,
  wins: 0,
  losses: 0,
  draws: 0,
  streak: 0,
  bestStreak: 0,
  seriesWins: 0,
  seriesLosses: 0,
  puzzlesSolved: 0,
  lastDifficulty: 'normal',
  lastPersonality: 'architect',
  lastVariant: 'classic',
  lastPreset: '7x6',
  lastSeriesTarget: DEFAULT_SERIES_TARGET,
};

export interface PersistedSeries {
  scores: [number, number];
  target: SeriesTarget;
  gamesPlayed: number;
  variant: RuleVariantId;
  preset: BoardPresetId;
  difficulty: Difficulty;
  personality: PersonalityId;
  gameMode: 'two' | 'bot';
  playerSide: 'red' | 'yellow';
}

export type PuzzleProgress = Record<string, { solved: boolean; bestPlies?: number }>;

const DIFFS = new Set<string>(['easy', 'normal', 'hard']);
const PERSONALITIES = new Set<string>(PERSONALITY_IDS);
const VARIANTS = new Set<string>(Object.keys(RULE_VARIANTS));
const PRESETS = new Set<string>(Object.keys(BOARD_PRESETS));

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asDiff(value: unknown): Difficulty {
  return DIFFS.has(value as string) ? (value as Difficulty) : 'normal';
}

function asPersonality(value: unknown): PersonalityId {
  return PERSONALITIES.has(value as string)
    ? (value as PersonalityId)
    : 'architect';
}

function asVariant(value: unknown): RuleVariantId {
  return VARIANTS.has(value as string) ? (value as RuleVariantId) : 'classic';
}

function asPreset(value: unknown): BoardPresetId {
  return PRESETS.has(value as string) ? (value as BoardPresetId) : '7x6';
}

function asTarget(value: unknown): SeriesTarget {
  return isValidSeriesTarget(value) ? value : DEFAULT_SERIES_TARGET;
}

function migrateLegacyStreaks(): Pick<ConnectFourStats, 'streak' | 'bestStreak'> {
  try {
    const streak = Number(localStorage.getItem(LEGACY_STREAK_KEY));
    const best = Number(localStorage.getItem(LEGACY_BEST_KEY));
    const s = Number.isFinite(streak) && streak > 0 ? Math.floor(streak) : 0;
    const b = Number.isFinite(best) && best > 0 ? Math.floor(best) : 0;
    return { streak: s, bestStreak: Math.max(s, b) };
  } catch {
    return { streak: 0, bestStreak: 0 };
  }
}

export function loadStats(): ConnectFourStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) {
      const legacy = migrateLegacyStreaks();
      if (legacy.streak > 0 || legacy.bestStreak > 0) {
        const migrated = { ...EMPTY_STATS, ...legacy };
        saveStats(migrated);
        return migrated;
      }
      return { ...EMPTY_STATS };
    }
    const parsed = JSON.parse(raw) as Partial<Record<keyof ConnectFourStats, unknown>>;
    return {
      games: Math.max(0, Math.floor(num(parsed.games, 0))),
      wins: Math.max(0, Math.floor(num(parsed.wins, 0))),
      losses: Math.max(0, Math.floor(num(parsed.losses, 0))),
      draws: Math.max(0, Math.floor(num(parsed.draws, 0))),
      streak: Math.max(0, Math.floor(num(parsed.streak, 0))),
      bestStreak: Math.max(0, Math.floor(num(parsed.bestStreak, 0))),
      seriesWins: Math.max(0, Math.floor(num(parsed.seriesWins, 0))),
      seriesLosses: Math.max(0, Math.floor(num(parsed.seriesLosses, 0))),
      puzzlesSolved: Math.max(0, Math.floor(num(parsed.puzzlesSolved, 0))),
      lastDifficulty: asDiff(parsed.lastDifficulty),
      lastPersonality: asPersonality(parsed.lastPersonality),
      lastVariant: asVariant(parsed.lastVariant),
      lastPreset: asPreset(parsed.lastPreset),
      lastSeriesTarget: asTarget(parsed.lastSeriesTarget),
    };
  } catch {
    return { ...EMPTY_STATS };
  }
}

export function saveStats(stats: ConnectFourStats): void {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    // Keep legacy keys in sync so older builds still see the streak.
    localStorage.setItem(LEGACY_STREAK_KEY, String(stats.streak));
    localStorage.setItem(LEGACY_BEST_KEY, String(stats.bestStreak));
  } catch {
    /* quota / private mode */
  }
}

export function recordGameResult(
  stats: ConnectFourStats,
  outcome: 'win' | 'lose' | 'draw',
  meta: {
    difficulty: Difficulty;
    personality: PersonalityId;
    variant: RuleVariantId;
    preset: BoardPresetId;
    seriesTarget: SeriesTarget;
  },
): ConnectFourStats {
  const streak = outcome === 'win' ? stats.streak + 1 : 0;
  return {
    ...stats,
    games: stats.games + 1,
    wins: stats.wins + (outcome === 'win' ? 1 : 0),
    losses: stats.losses + (outcome === 'lose' ? 1 : 0),
    draws: stats.draws + (outcome === 'draw' ? 1 : 0),
    streak,
    bestStreak: Math.max(stats.bestStreak, streak),
    lastDifficulty: meta.difficulty,
    lastPersonality: meta.personality,
    lastVariant: meta.variant,
    lastPreset: meta.preset,
    lastSeriesTarget: meta.seriesTarget,
  };
}

export function recordSeriesResult(
  stats: ConnectFourStats,
  won: boolean,
): ConnectFourStats {
  return {
    ...stats,
    seriesWins: stats.seriesWins + (won ? 1 : 0),
    seriesLosses: stats.seriesLosses + (won ? 0 : 1),
  };
}

export function loadSeries(): PersistedSeries | null {
  try {
    const raw = localStorage.getItem(MATCH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedSeries>;
    const s0 = num(parsed.scores?.[0], -1);
    const s1 = num(parsed.scores?.[1], -1);
    if (s0 < 0 || s1 < 0) return null;
    const gameMode = parsed.gameMode === 'two' ? 'two' : 'bot';
    const playerSide = parsed.playerSide === 'yellow' ? 'yellow' : 'red';
    return {
      scores: [Math.floor(s0), Math.floor(s1)],
      target: asTarget(parsed.target),
      gamesPlayed: Math.max(0, Math.floor(num(parsed.gamesPlayed, 0))),
      variant: asVariant(parsed.variant),
      preset: asPreset(parsed.preset),
      difficulty: asDiff(parsed.difficulty),
      personality: asPersonality(parsed.personality),
      gameMode,
      playerSide,
    };
  } catch {
    return null;
  }
}

export function saveSeries(series: PersistedSeries): void {
  try {
    localStorage.setItem(MATCH_KEY, JSON.stringify(series));
  } catch {
    /* ignore */
  }
}

export function clearSeries(): void {
  try {
    localStorage.removeItem(MATCH_KEY);
  } catch {
    /* ignore */
  }
}

export function loadPuzzleProgress(): PuzzleProgress {
  try {
    const raw = localStorage.getItem(PUZZLE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PuzzleProgress;
    if (!parsed || typeof parsed !== 'object') return {};
    const out: PuzzleProgress = {};
    for (const puzzle of PUZZLES) {
      const entry = parsed[puzzle.id];
      if (entry && typeof entry === 'object' && entry.solved === true) {
        out[puzzle.id] = {
          solved: true,
          bestPlies:
            typeof entry.bestPlies === 'number' && entry.bestPlies > 0
              ? Math.floor(entry.bestPlies)
              : undefined,
        };
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function savePuzzleProgress(progress: PuzzleProgress): void {
  try {
    localStorage.setItem(PUZZLE_KEY, JSON.stringify(progress));
  } catch {
    /* ignore */
  }
}

export function markPuzzleSolved(
  progress: PuzzleProgress,
  puzzleId: string,
  plies: number,
): PuzzleProgress {
  const prev = progress[puzzleId];
  const bestPlies =
    prev?.bestPlies !== undefined
      ? Math.min(prev.bestPlies, plies)
      : plies;
  return {
    ...progress,
    [puzzleId]: { solved: true, bestPlies },
  };
}

export function countSolvedPuzzles(progress: PuzzleProgress): number {
  return PUZZLES.filter((p) => progress[p.id]?.solved).length;
}

/** Exported for checks — confirms series target list is non-empty. */
export function storageMeta(): { seriesTargets: SeriesTarget[]; statsKey: string } {
  return { seriesTargets: SERIES_TARGETS, statsKey: STATS_KEY };
}
