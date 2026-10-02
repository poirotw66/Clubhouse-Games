/**
 * Career challenge pack — fixed-seed GM scenarios with explicit clear goals.
 *
 * Progress is tracked separately from free-play saves and the archive so a
 * failed challenge never erases unrelated meta, and so the pack can grow
 * without invalidating old unlock cursors.
 *
 * Pattern mirrors Baseball-Life #132: sequential unlock, locked seed + club,
 * pure clear helpers, independent storage keys.
 */
import { CLUBS } from './config';
import type { GameState } from './types';

export type ChallengeGoal =
  /** Finish all ten seasons without being fired. */
  | { kind: 'survive' }
  /** End the tenure with at least `min` cash (萬). */
  | { kind: 'cash'; min: number }
  /** End the tenure with board trust at least `min`. */
  | { kind: 'trust'; min: number }
  /** Win at least `min` 總冠軍 during the tenure. */
  | { kind: 'titles'; min: number }
  /** Finish with dynasty score at least `min`. */
  | { kind: 'score'; min: number }
  /** Reach the playoffs at least `min` times. */
  | { kind: 'playoffs'; min: number };

export interface CareerChallenge {
  id: string;
  /** Traditional Chinese display name. */
  name: string;
  /** Short Traditional Chinese blurb for the challenge list. */
  blurb: string;
  /** One-line goal reminder shown on title / play / summary. */
  goalLabel: string;
  seedCode: string;
  /** Locked club — mirrors Baseball-Life locking position. */
  teamId: string;
  goal: ChallengeGoal;
}

/**
 * Hand-authored scenarios. Each seed + club pair is probed so a documented
 * policy can clear the card in self-check (firstChoice or cheapest).
 */
export const CAREER_CHALLENGES: readonly CareerChallenge[] = [
  {
    id: 'full-tenure',
    name: '撐滿十年',
    blurb: '固定種子・新北海豚・撐完任期不被董事會炒魷魚',
    goalLabel: '完整任期・未被解僱',
    seedCode: 'surv0001',
    teamId: 'dolphins',
    goal: { kind: 'survive' },
  },
  {
    id: 'cash-cushion',
    name: '金庫充實',
    blurb: '固定種子・桃園天使・任期末現金至少 3 億',
    goalLabel: '期末現金 ≥ 3 億',
    seedCode: 'cash0001',
    teamId: 'angels',
    goal: { kind: 'cash', min: 30000 },
  },
  {
    id: 'board-faith',
    name: '董事會信任',
    blurb: '固定種子・南方猛獅・任期末董事會信任至少 80',
    goalLabel: '期末信任 ≥ 80',
    seedCode: 'trust001',
    teamId: 'lions',
    goal: { kind: 'trust', min: 80 },
  },
  {
    id: 'first-crown',
    name: '首冠到手',
    blurb: '固定種子・南方猛獅・任期內至少拿下一座總冠軍',
    goalLabel: '總冠軍 ≥ 1',
    seedCode: 'title01',
    teamId: 'lions',
    goal: { kind: 'titles', min: 1 },
  },
  {
    id: 'farm-patience',
    name: '農場長跑',
    blurb: '固定種子・台南飛鷹・農場隊撐滿十年不被解僱',
    goalLabel: '飛鷹・完整任期',
    seedCode: 'rebuild1',
    teamId: 'eagles',
    goal: { kind: 'survive' },
  },
  {
    id: 'named-gm',
    name: '名總管門檻',
    blurb: '固定種子・南方猛獅・王朝分數達到「名總管」門檻',
    goalLabel: '王朝分數 ≥ 1900',
    seedCode: 'chlg0001',
    teamId: 'lions',
    goal: { kind: 'score', min: 1900 },
  },
];

export interface ChallengeProgress {
  /** Number of challenges cleared from the start (0 = none). Index i unlocks when i <= clearedCount. */
  clearedCount: number;
  /** Best dynasty score recorded per challenge id (higher is better). */
  bestScore: Record<string, number>;
  /** Challenge ids that have been cleared at least once (allows replaying cleared cards). */
  cleared: Record<string, true>;
}

export const EMPTY_CHALLENGE_PROGRESS: ChallengeProgress = {
  clearedCount: 0,
  bestScore: {},
  cleared: {},
};

export function challengeCount(): number {
  return CAREER_CHALLENGES.length;
}

export function getChallenge(index: number): CareerChallenge | undefined {
  return CAREER_CHALLENGES[index];
}

export function challengeById(id: string): CareerChallenge | undefined {
  return CAREER_CHALLENGES.find((c) => c.id === id);
}

export function challengeIndexById(id: string): number {
  return CAREER_CHALLENGES.findIndex((c) => c.id === id);
}

export function clubNameForChallenge(teamId: string): string {
  return CLUBS.find((c) => c.id === teamId)?.name ?? teamId;
}

/** Challenge `index` is playable when every prior challenge is cleared (0 always open). */
export function isChallengeUnlocked(index: number, clearedCount: number): boolean {
  if (index < 0 || index >= CAREER_CHALLENGES.length) return false;
  return index <= clearedCount;
}

/** Next challenge to continue from (first uncleared, or last if pack complete). */
export function continueChallengeIndex(clearedCount: number): number {
  if (clearedCount <= 0) return 0;
  if (clearedCount >= CAREER_CHALLENGES.length) return CAREER_CHALLENGES.length - 1;
  return clearedCount;
}

/** Pure goal check against a finished tenure. */
export function isChallengeCleared(challenge: CareerChallenge, state: GameState): boolean {
  if (!state.over || !state.summary) return false;
  if (state.teamId !== challenge.teamId) return false;
  if (state.seedCode !== challenge.seedCode) return false;

  const { goal } = challenge;
  const summary = state.summary;
  switch (goal.kind) {
    case 'survive':
      return !summary.fired && summary.seasonsServed >= 10;
    case 'cash':
      return !summary.fired && state.finance.cash >= goal.min;
    case 'trust':
      return !summary.fired && state.board.trust >= goal.min;
    case 'titles':
      return summary.titles >= goal.min;
    case 'score':
      return summary.score >= goal.min;
    case 'playoffs':
      return summary.playoffs >= goal.min;
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
  const challenge = CAREER_CHALLENGES[challengeIndex];
  if (!challenge || !state.summary) {
    return { progress, cleared: false };
  }

  const score = Math.max(0, Math.floor(state.summary.score));
  const bestScore = { ...progress.bestScore };
  const prevBest = bestScore[challenge.id];
  bestScore[challenge.id] = prevBest == null ? score : Math.max(prevBest, score);

  const cleared = isChallengeCleared(challenge, state);
  const clearedMap = { ...progress.cleared };
  let clearedCount = progress.clearedCount;

  if (cleared) {
    clearedMap[challenge.id] = true;
    if (challengeIndex === clearedCount && clearedCount < CAREER_CHALLENGES.length) {
      clearedCount = challengeIndex + 1;
    }
  }

  return {
    progress: { clearedCount, bestScore, cleared: clearedMap },
    cleared,
  };
}
