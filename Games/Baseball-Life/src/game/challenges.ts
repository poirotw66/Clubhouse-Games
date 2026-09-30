/**
 * Career challenge pack — fixed-seed scenarios with explicit clear goals.
 *
 * Progress is tracked separately from free-play saves and achievements so a
 * failed challenge never erases unrelated meta, and so the pack can grow
 * without invalidating old unlock cursors.
 */
import type { GameState, Position } from './types';

export type ChallengeGoal =
  | { kind: 'pro-seasons'; min: number }
  | { kind: 'hof-score'; min: number }
  | { kind: 'hs-titles'; min: number }
  | { kind: 'mlb-seasons'; min: number };

export interface CareerChallenge {
  id: string;
  /** Traditional Chinese display name. */
  name: string;
  /** Short Traditional Chinese blurb for the challenge list. */
  blurb: string;
  /** One-line goal reminder shown on create / play / summary. */
  goalLabel: string;
  seedCode: string;
  position: Position;
  goal: ChallengeGoal;
}

/**
 * Eight hand-authored scenarios. Each seed + position pair was probed so a
 * simple training-first (or overseas-preferring) policy can clear early cards;
 * later cards still need the player to make real path choices.
 */
export const CAREER_CHALLENGES: readonly CareerChallenge[] = [
  {
    id: 'pro-debut',
    name: '踏上職業路',
    blurb: '固定種子・外野手・至少打滿一個職業球季',
    goalLabel: '職業球季 ≥ 1',
    seedCode: 'chlg0001',
    position: 'OF',
    goal: { kind: 'pro-seasons', min: 1 },
  },
  {
    id: 'solid-pro',
    name: '稱職十年',
    blurb: '固定種子・外野手・名人堂積分達稱職門檻',
    goalLabel: '名人堂積分 ≥ 380',
    seedCode: 'chlg0001',
    position: 'OF',
    goal: { kind: 'hof-score', min: 380 },
  },
  {
    id: 'hs-glory',
    name: '高中榮光',
    blurb: '固定種子・外野手・高中全國賽至少兩冠',
    goalLabel: '高中全國冠軍 ≥ 2',
    seedCode: 'mlbseed1',
    position: 'OF',
    goal: { kind: 'hs-titles', min: 2 },
  },
  {
    id: 'hof-edge',
    name: '票選邊緣',
    blurb: '固定種子・內野手・擠進名人堂票選邊緣',
    goalLabel: '名人堂積分 ≥ 850',
    seedCode: 'edge0001',
    position: 'IF',
    goal: { kind: 'hof-score', min: 850 },
  },
  {
    id: 'pitcher-hof',
    name: '投手入殿',
    blurb: '固定種子・投手・打進名人堂',
    goalLabel: '名人堂積分 ≥ 1450',
    seedCode: 'sp000001',
    position: 'P',
    goal: { kind: 'hof-score', min: 1450 },
  },
  {
    id: 'two-way-path',
    name: '二刀流之路',
    blurb: '固定種子・二刀流・積分達票選邊緣',
    goalLabel: '二刀流・積分 ≥ 850',
    seedCode: 'pitch03b',
    position: 'TW',
    goal: { kind: 'hof-score', min: 850 },
  },
  {
    id: 'mlb-regular',
    name: '大聯盟夢',
    blurb: '固定種子・外野手・大聯盟打滿五季（需選擇旅美）',
    goalLabel: '大聯盟球季 ≥ 5',
    seedCode: 'pitch03b',
    position: 'OF',
    goal: { kind: 'mlb-seasons', min: 5 },
  },
  {
    id: 'first-ballot',
    name: '一票入魂',
    blurb: '固定種子・外野手・首輪高票入選名人堂',
    goalLabel: '名人堂積分 ≥ 2200',
    seedCode: 'hofprobe1',
    position: 'OF',
    goal: { kind: 'hof-score', min: 2200 },
  },
];

export interface ChallengeProgress {
  /** Number of challenges cleared from the start (0 = none). Index i unlocks when i <= clearedCount. */
  clearedCount: number;
  /** Best hall-of-fame score recorded per challenge id (higher is better). */
  bestHof: Record<string, number>;
  /** Challenge ids that have been cleared at least once (allows replaying cleared cards). */
  cleared: Record<string, true>;
}

export const EMPTY_CHALLENGE_PROGRESS: ChallengeProgress = {
  clearedCount: 0,
  bestHof: {},
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

/** Pure goal check against a finished career. */
export function isChallengeCleared(challenge: CareerChallenge, state: GameState): boolean {
  if (!state.retired || !state.summary) return false;
  if (state.position !== challenge.position) return false;
  if (state.seedCode !== challenge.seedCode) return false;

  const { goal } = challenge;
  const summary = state.summary;
  switch (goal.kind) {
    case 'pro-seasons':
      return state.counters.proSeasons >= goal.min || summary.totals.seasons >= goal.min;
    case 'hof-score':
      return summary.hofScore >= goal.min;
    case 'hs-titles':
      return state.counters.hsTournamentWins >= goal.min;
    case 'mlb-seasons':
      return state.history.filter((h) => h.league === 'mlb').length >= goal.min;
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

  const hof = Math.max(0, Math.floor(state.summary.hofScore));
  const bestHof = { ...progress.bestHof };
  const prevBest = bestHof[challenge.id];
  bestHof[challenge.id] = prevBest == null ? hof : Math.max(prevBest, hof);

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
    progress: { clearedCount, bestHof, cleared: clearedMap },
    cleared,
  };
}
