import type { Difficulty, MatchTarget, PlayerCount, RuleVariant } from './types';
import { DEFAULT_MATCH_TARGET, MATCH_TARGETS } from './types';

const STATS_KEY = 'clubhouse-dominoes-stats';
const MATCH_KEY = 'clubhouse-dominoes-match';
const STREAK_KEY = 'clubhouse-dominoes-win-streak';

export type GameMode = 'two' | 'bot' | 'partners' | 'daily';

export interface DominoesStats {
  matches: number;
  wins: number;
  losses: number;
  streak: number;
  bestStreak: number;
  lastRule: RuleVariant;
  lastDifficulty: Difficulty;
  lastTarget: MatchTarget;
  lastMode: GameMode;
}

export const EMPTY_STATS: DominoesStats = {
  matches: 0,
  wins: 0,
  losses: 0,
  streak: 0,
  bestStreak: 0,
  lastRule: 'fives',
  lastDifficulty: 'normal',
  lastTarget: DEFAULT_MATCH_TARGET,
  lastMode: 'bot',
};

export interface PersistedMatch {
  scores: [number, number];
  target: MatchTarget;
  round: number;
  ruleVariant: RuleVariant;
  difficulty: Difficulty;
  gameMode: GameMode;
  playerCount: PlayerCount;
}

const RULES = new Set<string>(['draw', 'block', 'fives']);
const DIFFS = new Set<string>(['easy', 'normal', 'hard']);
const TARGETS = new Set<number>(MATCH_TARGETS);
const MODES = new Set<string>(['two', 'bot', 'partners', 'daily']);

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asRule(value: unknown): RuleVariant {
  return RULES.has(value as string) ? (value as RuleVariant) : 'fives';
}

function asDiff(value: unknown): Difficulty {
  return DIFFS.has(value as string) ? (value as Difficulty) : 'normal';
}

function asTarget(value: unknown): MatchTarget {
  const n = num(value, DEFAULT_MATCH_TARGET);
  return TARGETS.has(n) ? (n as MatchTarget) : DEFAULT_MATCH_TARGET;
}

function asMode(value: unknown): GameMode {
  return MODES.has(value as string) ? (value as GameMode) : 'bot';
}

function asPlayerCount(value: unknown, mode: GameMode): PlayerCount {
  if (mode === 'partners') return 4;
  if (value === 4) return 4;
  return 2;
}

export function loadStats(): DominoesStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) {
      const legacy = Number(localStorage.getItem(STREAK_KEY));
      if (Number.isFinite(legacy) && legacy > 0) {
        return {
          ...EMPTY_STATS,
          streak: Math.floor(legacy),
          bestStreak: Math.floor(legacy),
        };
      }
      return { ...EMPTY_STATS };
    }
    const parsed = JSON.parse(raw) as Partial<Record<keyof DominoesStats, unknown>>;
    return {
      matches: Math.max(0, Math.floor(num(parsed.matches, 0))),
      wins: Math.max(0, Math.floor(num(parsed.wins, 0))),
      losses: Math.max(0, Math.floor(num(parsed.losses, 0))),
      streak: Math.max(0, Math.floor(num(parsed.streak, 0))),
      bestStreak: Math.max(0, Math.floor(num(parsed.bestStreak, 0))),
      lastRule: asRule(parsed.lastRule),
      lastDifficulty: asDiff(parsed.lastDifficulty),
      lastTarget: asTarget(parsed.lastTarget),
      lastMode: asMode(parsed.lastMode),
    };
  } catch {
    return { ...EMPTY_STATS };
  }
}

export function saveStats(stats: DominoesStats): void {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    localStorage.setItem(STREAK_KEY, String(stats.streak));
  } catch {
    /* quota / private mode */
  }
}

export function recordMatchResult(
  stats: DominoesStats,
  won: boolean,
  meta: {
    rule: RuleVariant;
    difficulty: Difficulty;
    target: MatchTarget;
    mode: GameMode;
  },
): DominoesStats {
  const streak = won ? stats.streak + 1 : 0;
  return {
    matches: stats.matches + 1,
    wins: stats.wins + (won ? 1 : 0),
    losses: stats.losses + (won ? 0 : 1),
    streak,
    bestStreak: Math.max(stats.bestStreak, streak),
    lastRule: meta.rule,
    lastDifficulty: meta.difficulty,
    lastTarget: meta.target,
    lastMode: meta.mode,
  };
}

export function loadMatch(): PersistedMatch | null {
  try {
    const raw = localStorage.getItem(MATCH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedMatch>;
    const s0 = num(parsed.scores?.[0], -1);
    const s1 = num(parsed.scores?.[1], -1);
    if (s0 < 0 || s1 < 0) return null;
    const gameMode = asMode(parsed.gameMode);
    // Daily matches are not resumed — always start fresh for the day.
    if (gameMode === 'daily') return null;
    return {
      scores: [Math.floor(s0), Math.floor(s1)],
      target: asTarget(parsed.target),
      round: Math.max(1, Math.floor(num(parsed.round, 1))),
      ruleVariant: asRule(parsed.ruleVariant),
      difficulty: asDiff(parsed.difficulty),
      gameMode,
      playerCount: asPlayerCount(parsed.playerCount, gameMode),
    };
  } catch {
    return null;
  }
}

export function saveMatch(match: PersistedMatch): void {
  try {
    localStorage.setItem(MATCH_KEY, JSON.stringify(match));
  } catch {
    /* ignore */
  }
}

export function clearMatch(): void {
  try {
    localStorage.removeItem(MATCH_KEY);
  } catch {
    /* ignore */
  }
}
