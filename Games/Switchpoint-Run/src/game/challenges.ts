/**
 * Challenge seed pack — fixed seeds with explicit distance / score goals.
 *
 * Progress is stored separately from free-play best-distance / best-score so a
 * failed challenge never erases unrelated meta, and so the pack can grow
 * without invalidating old unlock cursors.
 *
 * Pattern mirrors Dynasty / Baseball-Life career challenges: sequential unlock,
 * locked seed, pure clear helpers, independent storage keys.
 */
import { finalScore } from './engine';
import type { RunState } from './types';

export type ChallengeGoal =
  | { kind: 'distance'; min: number }
  | { kind: 'score'; min: number };

export interface RunChallenge {
  id: string;
  /** Traditional Chinese display name. */
  name: string;
  /** Short Traditional Chinese blurb for the challenge list. */
  blurb: string;
  /** One-line goal reminder shown on title / HUD / result. */
  goalLabel: string;
  seedCode: string;
  goal: ChallengeGoal;
}

/**
 * Hand-authored scenarios. Each seed is probed so a documented choice policy
 * (see self-check) can clear the card with a near-perfect execution pilot.
 */
export const RUN_CHALLENGES: readonly RunChallenge[] = [
  {
    id: 'first-switch',
    name: '初試扳道',
    blurb: '固定種子・先跑過兩千距離，熟悉預覽與扳道節奏',
    goalLabel: '距離 ≥ 2,000',
    seedCode: 'SPRUN001',
    goal: { kind: 'distance', min: 2000 },
  },
  {
    id: 'five-thousand',
    name: '五千里路',
    blurb: '固定種子・衝過五千距離——安全支線撐不久，得敢加速',
    goalLabel: '距離 ≥ 5,000',
    seedCode: 'SPRUN002',
    goal: { kind: 'distance', min: 5000 },
  },
  {
    id: 'score-eight',
    name: '評分八千',
    blurb: '固定種子・分數達八千——距離之外還要顧路線評價與倍率',
    goalLabel: '分數 ≥ 8,000',
    seedCode: 'SPRUN003',
    goal: { kind: 'score', min: 8000 },
  },
  {
    id: 'ten-thousand',
    name: '萬里長征',
    blurb: '固定種子・撐過一萬距離——緩衝滿了再敢踩安全支線',
    goalLabel: '距離 ≥ 10,000',
    seedCode: 'SPRUN005',
    goal: { kind: 'distance', min: 10000 },
  },
  {
    id: 'high-score',
    name: '高分列車',
    blurb: '固定種子・分數衝到一萬四——倍率與無傷連續都要吃到',
    goalLabel: '分數 ≥ 14,000',
    seedCode: 'CHARL3',
    goal: { kind: 'score', min: 14000 },
  },
  {
    id: 'chase-limit',
    name: '追趕極限',
    blurb: '固定種子・一萬八距離——後期緩衝上限下仍得選對路線',
    goalLabel: '距離 ≥ 18,000',
    seedCode: 'SPRUN006',
    goal: { kind: 'distance', min: 18000 },
  },
];

export interface ChallengeProgress {
  /** Number of challenges cleared from the start (0 = none). Index i unlocks when i <= clearedCount. */
  clearedCount: number;
  /** Best metric recorded per challenge id (distance for distance goals, score for score goals). */
  bestMetric: Record<string, number>;
  /** Challenge ids that have been cleared at least once (allows replaying cleared cards). */
  cleared: Record<string, true>;
}

export const EMPTY_CHALLENGE_PROGRESS: ChallengeProgress = {
  clearedCount: 0,
  bestMetric: {},
  cleared: {},
};

export const CHALLENGES_STORAGE_KEY = 'switchpoint-run:challenges';

export function challengeCount(): number {
  return RUN_CHALLENGES.length;
}

export function getChallenge(index: number): RunChallenge | undefined {
  return RUN_CHALLENGES[index];
}

export function challengeById(id: string): RunChallenge | undefined {
  return RUN_CHALLENGES.find((c) => c.id === id);
}

export function challengeIndexById(id: string): number {
  return RUN_CHALLENGES.findIndex((c) => c.id === id);
}

/** Challenge `index` is playable when every prior challenge is cleared (0 always open). */
export function isChallengeUnlocked(index: number, clearedCount: number): boolean {
  if (index < 0 || index >= RUN_CHALLENGES.length) return false;
  return index <= clearedCount;
}

/** Next challenge to continue from (first uncleared, or last if pack complete). */
export function continueChallengeIndex(clearedCount: number): number {
  if (clearedCount <= 0) return 0;
  if (clearedCount >= RUN_CHALLENGES.length) return RUN_CHALLENGES.length - 1;
  return clearedCount;
}

/** Metric the pack tracks as "best" for a challenge (matches the goal axis). */
export function challengeMetric(challenge: RunChallenge, state: RunState): number {
  if (challenge.goal.kind === 'distance') return Math.round(state.distance);
  return finalScore(state);
}

/** Pure goal check against a live or finished run on the challenge seed. */
export function isChallengeCleared(challenge: RunChallenge, state: RunState): boolean {
  if (state.seedCode !== challenge.seedCode) return false;
  const { goal } = challenge;
  switch (goal.kind) {
    case 'distance':
      return state.distance >= goal.min;
    case 'score':
      return finalScore(state) >= goal.min;
    default:
      return false;
  }
}

/**
 * Pure progress update after a challenge run ends (win or lose). Does not touch
 * localStorage. Advancing the unlock cursor only happens when clearing the
 * current frontier.
 */
export function applyChallengeResult(
  progress: ChallengeProgress,
  challengeIndex: number,
  state: RunState,
): { progress: ChallengeProgress; cleared: boolean } {
  const challenge = RUN_CHALLENGES[challengeIndex];
  if (!challenge) {
    return { progress, cleared: false };
  }

  const metric = challengeMetric(challenge, state);
  const bestMetric = { ...progress.bestMetric };
  const prevBest = bestMetric[challenge.id];
  bestMetric[challenge.id] = prevBest == null ? metric : Math.max(prevBest, metric);

  const cleared = isChallengeCleared(challenge, state);
  const clearedMap = { ...progress.cleared };
  let clearedCount = progress.clearedCount;

  if (cleared) {
    clearedMap[challenge.id] = true;
    if (challengeIndex === clearedCount && clearedCount < RUN_CHALLENGES.length) {
      clearedCount = challengeIndex + 1;
    }
  }

  return {
    progress: { clearedCount, bestMetric, cleared: clearedMap },
    cleared,
  };
}

export function loadChallengeProgress(): ChallengeProgress {
  try {
    const raw = window.localStorage.getItem(CHALLENGES_STORAGE_KEY);
    if (!raw) return { ...EMPTY_CHALLENGE_PROGRESS, bestMetric: {}, cleared: {} };
    const parsed = JSON.parse(raw) as Partial<ChallengeProgress>;
    const clearedCount =
      typeof parsed.clearedCount === 'number' && Number.isFinite(parsed.clearedCount)
        ? Math.max(0, Math.min(RUN_CHALLENGES.length, Math.floor(parsed.clearedCount)))
        : 0;
    const bestMetric: Record<string, number> = {};
    if (parsed.bestMetric && typeof parsed.bestMetric === 'object') {
      for (const [id, value] of Object.entries(parsed.bestMetric)) {
        if (typeof value === 'number' && Number.isFinite(value)) {
          bestMetric[id] = Math.max(0, Math.floor(value));
        }
      }
    }
    const cleared: Record<string, true> = {};
    if (parsed.cleared && typeof parsed.cleared === 'object') {
      for (const id of Object.keys(parsed.cleared)) {
        if (challengeById(id)) cleared[id] = true;
      }
    }
    return { clearedCount, bestMetric, cleared };
  } catch {
    return { ...EMPTY_CHALLENGE_PROGRESS, bestMetric: {}, cleared: {} };
  }
}

export function saveChallengeProgress(progress: ChallengeProgress): void {
  try {
    window.localStorage.setItem(CHALLENGES_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Private mode or full quota: progress simply is not persisted.
  }
}
