/**
 * Challenge seed pack — authored fixed seeds with explicit clear goals.
 *
 * Progress is tracked separately from the free-play best score so a failed
 * challenge never erases unrelated meta. Pattern mirrors Dynasty / Baseball-Life
 * and Liquid-Sort: sequential unlock, locked seed, pure clear helpers.
 */
import { parseSeed } from './rng';
import type { GameState, Phase } from './types';

export type ChallengeGoal =
  /** Reach at least floor `min` (die or win on/after that floor). */
  | { kind: 'floor'; min: number }
  /** End the run with score at least `min`. */
  | { kind: 'score'; min: number }
  /** Defeat the boss on the given boss floor (5 / 10 / 15). */
  | { kind: 'boss'; floor: 5 | 10 | 15 }
  /** Escape the lair (phase won on floor 15). */
  | { kind: 'escape' }
  /** End the run with at least `min` kills. */
  | { kind: 'kills'; min: number };

export interface SeedChallenge {
  id: string;
  /** Traditional Chinese display name. */
  name: string;
  /** Short Traditional Chinese blurb for the challenge list. */
  blurb: string;
  /** One-line goal reminder shown on title / HUD / result. */
  goalLabel: string;
  /** Locked seed string passed to parseSeed / createRun. */
  seedInput: string;
  goal: ChallengeGoal;
}

/**
 * Hand-authored scenarios. Seeds are fixed words so the delve is reproducible;
 * clear goals escalate from a short floor reach to a full escape.
 */
export const SEED_CHALLENGES: readonly SeedChallenge[] = [
  {
    id: 'first-depths',
    name: '初探三層',
    blurb: '固定種子・抵達第 3 層即可通關（死亡或逃出皆可結算）',
    goalLabel: '抵達第 3 層',
    seedInput: 'snake01',
    goal: { kind: 'floor', min: 3 },
  },
  {
    id: 'score-gate',
    name: '分數門檻',
    blurb: '固定種子・單局分數至少 800',
    goalLabel: '分數 ≥ 800',
    seedInput: 'score800',
    goal: { kind: 'score', min: 800 },
  },
  {
    id: 'first-boss',
    name: '首殺首領',
    blurb: '固定種子・擊敗第 5 層腐化核心',
    goalLabel: '擊敗第 5 層首領',
    seedInput: 'bossfive',
    goal: { kind: 'boss', floor: 5 },
  },
  {
    id: 'deep-ten',
    name: '十層深淵',
    blurb: '固定種子・深入第 10 層',
    goalLabel: '抵達第 10 層',
    seedInput: 'deepten1',
    goal: { kind: 'floor', min: 10 },
  },
  {
    id: 'twin-cores',
    name: '雙核連斬',
    blurb: '固定種子・擊敗第 10 層首領（必先過第 5 層）',
    goalLabel: '擊敗第 10 層首領',
    seedInput: 'twinboss',
    goal: { kind: 'boss', floor: 10 },
  },
  {
    id: 'escape-lair',
    name: '逃出蛇窟',
    blurb: '固定種子・通過第 15 層並逃出蛇窟',
    goalLabel: '逃出蛇窟（通關）',
    seedInput: 'escape15',
    goal: { kind: 'escape' },
  },
];

export interface ChallengeProgress {
  /** Number of challenges cleared from the start (0 = none). Index i unlocks when i <= clearedCount. */
  clearedCount: number;
  /** Best score recorded per challenge id (higher is better). */
  bestScore: Record<string, number>;
  /** Challenge ids that have been cleared at least once. */
  cleared: Record<string, true>;
}

export const EMPTY_CHALLENGE_PROGRESS: ChallengeProgress = {
  clearedCount: 0,
  bestScore: {},
  cleared: {},
};

export function challengeCount(): number {
  return SEED_CHALLENGES.length;
}

export function getChallenge(index: number): SeedChallenge | undefined {
  return SEED_CHALLENGES[index];
}

export function challengeById(id: string): SeedChallenge | undefined {
  return SEED_CHALLENGES.find((c) => c.id === id);
}

export function challengeIndexById(id: string): number {
  return SEED_CHALLENGES.findIndex((c) => c.id === id);
}

/** Challenge `index` is playable when every prior challenge is cleared (0 always open). */
export function isChallengeUnlocked(index: number, clearedCount: number): boolean {
  if (index < 0 || index >= SEED_CHALLENGES.length) return false;
  return index <= clearedCount;
}

/** Next challenge to continue from (first uncleared, or last if pack complete). */
export function continueChallengeIndex(clearedCount: number): number {
  if (clearedCount <= 0) return 0;
  if (clearedCount >= SEED_CHALLENGES.length) return SEED_CHALLENGES.length - 1;
  return clearedCount;
}

function isFinished(phase: Phase): boolean {
  return phase === 'dead' || phase === 'won';
}

/** Pure goal check against a finished challenge run. */
export function isChallengeCleared(challenge: SeedChallenge, state: GameState): boolean {
  if (!isFinished(state.phase)) return false;
  if (state.challengeId !== challenge.id) return false;
  if (state.seed !== parseSeed(challenge.seedInput)) return false;

  const { goal } = challenge;
  switch (goal.kind) {
    case 'floor':
      return state.floor >= goal.min;
    case 'score':
      return state.score >= goal.min;
    case 'boss':
      return state.bossesDefeated.includes(goal.floor);
    case 'escape':
      return state.phase === 'won' && !state.endless;
    case 'kills':
      return state.kills >= goal.min;
    default:
      return false;
  }
}

/**
 * Pure progress update after a finished challenge run. Does not touch localStorage.
 * Advancing the unlock cursor only happens when clearing the current frontier.
 */
export function applyChallengeResult(
  progress: ChallengeProgress,
  challengeIndex: number,
  state: GameState,
): { progress: ChallengeProgress; cleared: boolean } {
  const challenge = SEED_CHALLENGES[challengeIndex];
  if (!challenge || !isFinished(state.phase)) {
    return { progress, cleared: false };
  }

  const score = Math.max(0, Math.floor(state.score));
  const bestScore = { ...progress.bestScore };
  const prevBest = bestScore[challenge.id];
  bestScore[challenge.id] = prevBest == null ? score : Math.max(prevBest, score);

  const cleared = isChallengeCleared(challenge, state);
  const clearedMap = { ...progress.cleared };
  let clearedCount = progress.clearedCount;

  if (cleared) {
    clearedMap[challenge.id] = true;
    if (challengeIndex === clearedCount && clearedCount < SEED_CHALLENGES.length) {
      clearedCount = challengeIndex + 1;
    }
  }

  return {
    progress: { clearedCount, bestScore, cleared: clearedMap },
    cleared,
  };
}
