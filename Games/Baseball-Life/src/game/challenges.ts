/**
 * Career challenge pack — fixed-seed scenarios with explicit clear goals.
 *
 * Progress is tracked separately from free-play saves and achievements so a
 * failed challenge never erases unrelated meta, and so the pack can grow
 * without invalidating old unlock cursors.
 *
 * Wave 2 adds new `ChallengeGoal` kinds and optional fixed-turn situation
 * hooks so a few cards can script a mandatory high-risk choice.
 */
import type { GameState, LeagueId, Position, Stage } from './types';

export type ChallengeGoal =
  | { kind: 'pro-seasons'; min: number }
  | { kind: 'hof-score'; min: number }
  | { kind: 'hs-titles'; min: number }
  | { kind: 'mlb-seasons'; min: number }
  /** Finish with at least `min` pro seasons and zero career injuries. */
  | { kind: 'injury-free-pro'; min: number }
  /** Unlock a named hidden trait (e.g. `intl-demon`). */
  | { kind: 'trait'; id: string }
  /** Record at least `min` seasons in a specific league. */
  | { kind: 'league-seasons'; league: LeagueId; min: number };

/** When to force-queue a situation after a training turn's `advanceTime`. */
export type ChallengeHookMatch =
  | { stage: 'highschool'; turnIndex: number }
  | { stage: 'amateur'; age: number }
  | { stage: 'pro'; proSeasons: number; proTurn: number };

export interface ChallengeSituationHook {
  situationId: string;
  match: ChallengeHookMatch;
}

export interface ChallengeSituationPick {
  situationId: string;
  optionId: string;
}

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
  /**
   * Optional fixed-turn situation queue. Engine forces these ids into
   * `pendingSituation` when `match` hits — bypassing the random fire roll.
   * Prefer stable ids documented in the thin spec / delivery notes.
   */
  situationHooks?: readonly ChallengeSituationHook[];
  /**
   * Extra clear requirements: the run must have chosen these situation options
   * (recorded as `sit-pick:<id>:<option>` on `handled`).
   */
  requirePicks?: readonly ChallengeSituationPick[];
}

/**
 * Hand-authored scenarios. Wave 1 = indices 0–7; wave 2 appends new goal kinds
 * and a few scripted situation hooks. Each seed + position pair is probed so a
 * documented policy can clear the card in self-check.
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

  // ---- Wave 2 ----
  {
    id: 'iron-body',
    name: '零傷鐵人',
    blurb: '固定種子・外野手・至少八個職業球季且生涯零傷病',
    goalLabel: '職業 ≥ 8 季・傷病 = 0',
    seedCode: 'safe0001',
    position: 'OF',
    goal: { kind: 'injury-free-pro', min: 8 },
  },
  {
    id: 'catcher-scout',
    name: '本壘後方',
    blurb: '固定種子・捕手・高中必遇球探日並全力演出，積分達門檻',
    goalLabel: '球探日全力演出・積分 ≥ 500',
    seedCode: 'cch00000',
    position: 'C',
    goal: { kind: 'hof-score', min: 500 },
    situationHooks: [
      // After 高二 春・開季 resolves → turnIndex 6 (age 17, scout day lands).
      { situationId: 'hs-scout-showcase', match: { stage: 'highschool', turnIndex: 6 } },
    ],
    requirePicks: [{ situationId: 'hs-scout-showcase', optionId: 'show' }],
  },
  {
    id: 'infield-cpbl',
    name: '中職長跑',
    blurb: '固定種子・內野手・在中華職棒打滿八季',
    goalLabel: '中職球季 ≥ 8',
    seedCode: 'cpbl0001',
    position: 'IF',
    goal: { kind: 'league-seasons', league: 'cpbl', min: 8 },
  },
  {
    id: 'two-way-enshrine',
    name: '二刀流入殿',
    blurb: '固定種子・二刀流・打進名人堂；職業初期必遇專屬壓力卡',
    goalLabel: '二刀流・積分 ≥ 1450',
    seedCode: 'twe00075',
    position: 'TW',
    goal: { kind: 'hof-score', min: 1450 },
    situationHooks: [
      {
        situationId: 'tw-specialty-pressure',
        match: { stage: 'pro', proSeasons: 1, proTurn: 2 },
      },
    ],
  },
  {
    id: 'intl-ghost',
    name: '國際賽之鬼',
    blurb: '固定種子・外野手・覺醒特質「國際賽之鬼」（挑戰關必遇徵召節點）',
    goalLabel: '覺醒・國際賽之鬼',
    seedCode: 'itl00000',
    position: 'OF',
    goal: { kind: 'trait', id: 'intl-demon' },
    situationHooks: [
      { situationId: 'chlg-intl-summons', match: { stage: 'pro', proSeasons: 1, proTurn: 0 } },
      { situationId: 'chlg-intl-summons', match: { stage: 'pro', proSeasons: 2, proTurn: 0 } },
      { situationId: 'chlg-intl-summons', match: { stage: 'pro', proSeasons: 3, proTurn: 0 } },
    ],
    requirePicks: [{ situationId: 'chlg-intl-summons', optionId: 'accept' }],
  },
  {
    id: 'mlb-gate',
    name: '旅美關口',
    blurb: '固定種子・外野手・必遇旅美攤牌卡並答應挑戰，大聯盟至少三季',
    goalLabel: '答應旅美關口・大聯盟 ≥ 3 季',
    seedCode: 'gate0002',
    position: 'OF',
    goal: { kind: 'mlb-seasons', min: 3 },
    situationHooks: [
      { situationId: 'chlg-mlb-dream-call', match: { stage: 'amateur', age: 19 } },
      {
        situationId: 'chlg-mlb-dream-call',
        match: { stage: 'pro', proSeasons: 0, proTurn: 1 },
      },
    ],
    requirePicks: [{ situationId: 'chlg-mlb-dream-call', optionId: 'commit' }],
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

/** Stable handled-key for a situation option pick (clear conditions + audits). */
export function situationPickKey(situationId: string, optionId: string): string {
  return `sit-pick:${situationId}:${optionId}`;
}

/** Handled-key marking that a challenge hook index already fired this run. */
export function challengeHookKey(challengeId: string, hookIndex: number): string {
  return `chlg-hook:${challengeId}:${hookIndex}`;
}

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

export function hookMatchesState(match: ChallengeHookMatch, state: GameState): boolean {
  if (state.stage !== match.stage) return false;
  if (match.stage === 'highschool') return state.turnIndex === match.turnIndex;
  if (match.stage === 'amateur') return state.age === match.age;
  return state.counters.proSeasons === match.proSeasons && state.proTurn === match.proTurn;
}

function hasRequiredPicks(challenge: CareerChallenge, state: GameState): boolean {
  if (!challenge.requirePicks || challenge.requirePicks.length === 0) return true;
  return challenge.requirePicks.every((pick) =>
    state.handled.includes(situationPickKey(pick.situationId, pick.optionId)),
  );
}

function leagueSeasonCount(state: GameState, league: LeagueId): number {
  return state.history.filter((h) => h.league === league).length;
}

/** Pure goal check against a finished career. */
export function isChallengeCleared(challenge: CareerChallenge, state: GameState): boolean {
  if (!state.retired || !state.summary) return false;
  if (state.position !== challenge.position) return false;
  if (state.seedCode !== challenge.seedCode) return false;
  if (!hasRequiredPicks(challenge, state)) return false;

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
      return leagueSeasonCount(state, 'mlb') >= goal.min;
    case 'injury-free-pro':
      return state.counters.injuries === 0 && state.counters.proSeasons >= goal.min;
    case 'trait':
      return state.traits.includes(goal.id);
    case 'league-seasons':
      return leagueSeasonCount(state, goal.league) >= goal.min;
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

/** Stages referenced by challenge hooks — kept for docs / self-check. */
export type ChallengeHookStage = Stage;
