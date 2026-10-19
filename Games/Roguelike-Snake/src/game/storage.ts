import { evaluateAchievements } from './achievements';
import { DEFAULT_BUILD_ID, STARTING_BUILDS, isBuildUnlocked } from './builds';
import type { BuildUnlockContext } from './builds';
import { CHALLENGES_STORAGE_KEY, STORAGE_KEY } from './config';
import {
  EMPTY_CHALLENGE_PROGRESS,
  SEED_CHALLENGES,
  challengeById,
} from './challenges';
import type { ChallengeProgress } from './challenges';
import {
  computeDailyStreak,
  mergeDailyRecord,
  todaySeedKey,
  type DailyClearRecord,
} from './daily';

export interface BestRecord {
  score: number;
  floor: number;
}

/** Persistent meta: bests, builds, Ironsnake, daily, achievements. */
export interface MetaProgress extends BestRecord {
  escapes: number;
  ironsnakeClears: number;
  ironsnakeBestScore: number;
  ironsnakeBestFloor: number;
  unlockedBuilds: string[];
  achievements: string[];
  dailyRecords: DailyClearRecord[];
  selectedBuildId: string;
}

const EMPTY_BEST: BestRecord = { score: 0, floor: 0 };

export const EMPTY_META: MetaProgress = {
  score: 0,
  floor: 0,
  escapes: 0,
  ironsnakeClears: 0,
  ironsnakeBestScore: 0,
  ironsnakeBestFloor: 0,
  unlockedBuilds: [DEFAULT_BUILD_ID],
  achievements: [],
  dailyRecords: [],
  selectedBuildId: DEFAULT_BUILD_ID,
};

function buildUnlockContext(meta: MetaProgress): BuildUnlockContext {
  return {
    bestFloor: meta.floor,
    escapes: meta.escapes,
    dailyClears: meta.dailyRecords.filter((r) => r.cleared).length,
  };
}

function syncUnlockedBuilds(meta: MetaProgress): MetaProgress {
  const ctx = buildUnlockContext(meta);
  const unlocked = new Set(meta.unlockedBuilds);
  unlocked.add(DEFAULT_BUILD_ID);
  for (const build of STARTING_BUILDS) {
    if (isBuildUnlocked(build, ctx)) unlocked.add(build.id);
  }
  const unlockedBuilds = STARTING_BUILDS.map((b) => b.id).filter((id) => unlocked.has(id));
  const selectedBuildId = unlockedBuilds.includes(meta.selectedBuildId)
    ? meta.selectedBuildId
    : DEFAULT_BUILD_ID;
  const streak = computeDailyStreak(meta.dailyRecords, todaySeedKey());
  const withBuilds = { ...meta, unlockedBuilds, selectedBuildId };
  return {
    ...withBuilds,
    achievements: evaluateAchievements(withBuilds, streak),
  };
}

function normalizeDailyRecords(raw: unknown): DailyClearRecord[] {
  if (!Array.isArray(raw)) return [];
  const out: DailyClearRecord[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Partial<DailyClearRecord>;
    const date = typeof r.date === 'string' && /^\d{8}$/.test(r.date) ? r.date : '';
    if (!date) continue;
    out.push({
      date,
      cleared: Boolean(r.cleared),
      score: Math.max(0, Math.floor(Number(r.score) || 0)),
      floor: Math.max(0, Math.floor(Number(r.floor) || 0)),
    });
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out.slice(-60);
}

function parseMeta(raw: string): MetaProgress {
  const parsed = JSON.parse(raw) as Partial<MetaProgress>;
  const base: MetaProgress = {
    score: Math.max(0, Math.floor(Number(parsed.score) || 0)),
    floor: Math.max(0, Math.floor(Number(parsed.floor) || 0)),
    escapes: Math.max(0, Math.floor(Number(parsed.escapes) || 0)),
    ironsnakeClears: Math.max(0, Math.floor(Number(parsed.ironsnakeClears) || 0)),
    ironsnakeBestScore: Math.max(0, Math.floor(Number(parsed.ironsnakeBestScore) || 0)),
    ironsnakeBestFloor: Math.max(0, Math.floor(Number(parsed.ironsnakeBestFloor) || 0)),
    unlockedBuilds: Array.isArray(parsed.unlockedBuilds)
      ? parsed.unlockedBuilds.filter((id): id is string => typeof id === 'string')
      : [DEFAULT_BUILD_ID],
    achievements: Array.isArray(parsed.achievements)
      ? parsed.achievements.filter((id): id is string => typeof id === 'string')
      : [],
    dailyRecords: normalizeDailyRecords(parsed.dailyRecords),
    selectedBuildId:
      typeof parsed.selectedBuildId === 'string' ? parsed.selectedBuildId : DEFAULT_BUILD_ID,
  };
  return syncUnlockedBuilds(base);
}

export function loadMeta(): MetaProgress {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY_META };
    return parseMeta(raw);
  } catch {
    return { ...EMPTY_META };
  }
}

export function saveMeta(meta: MetaProgress): MetaProgress {
  const synced = syncUnlockedBuilds(meta);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(synced));
  } catch {
    // Private mode or storage disabled: best-effort only.
  }
  return synced;
}

/** @deprecated Prefer loadMeta — kept for call sites that only need score/floor. */
export function loadBest(): BestRecord {
  const meta = loadMeta();
  return { score: meta.score, floor: meta.floor };
}

export function saveBest(record: BestRecord): BestRecord {
  const previous = loadMeta();
  const merged = saveMeta({
    ...previous,
    score: Math.max(previous.score, record.score),
    floor: Math.max(previous.floor, record.floor),
  });
  return { score: merged.score, floor: merged.floor };
}

export interface RunSettlement {
  score: number;
  floor: number;
  escaped: boolean;
  ironsnake: boolean;
  daily: boolean;
  dailyDate?: string;
}

export interface SettlementResult {
  meta: MetaProgress;
  newAchievements: string[];
  newBuilds: string[];
}

/** Merge a finished run into local meta (bests, Ironsnake, daily, unlocks). */
export function settleRun(run: RunSettlement): SettlementResult {
  const previous = loadMeta();
  const prevAchievements = new Set(previous.achievements);
  const prevBuilds = new Set(previous.unlockedBuilds);

  let next: MetaProgress = {
    ...previous,
    score: Math.max(previous.score, run.score),
    floor: Math.max(previous.floor, run.floor),
    escapes: previous.escapes + (run.escaped ? 1 : 0),
  };

  if (run.ironsnake) {
    next = {
      ...next,
      ironsnakeBestScore: Math.max(previous.ironsnakeBestScore, run.score),
      ironsnakeBestFloor: Math.max(previous.ironsnakeBestFloor, run.floor),
      ironsnakeClears: previous.ironsnakeClears + (run.escaped ? 1 : 0),
    };
  }

  if (run.daily && run.dailyDate) {
    next = {
      ...next,
      dailyRecords: mergeDailyRecord(previous.dailyRecords, {
        date: run.dailyDate,
        cleared: run.escaped,
        score: run.score,
        floor: run.floor,
      }),
    };
  }

  const meta = saveMeta(next);
  return {
    meta,
    newAchievements: meta.achievements.filter((id) => !prevAchievements.has(id)),
    newBuilds: meta.unlockedBuilds.filter((id) => !prevBuilds.has(id)),
  };
}

export function selectBuild(buildId: string): MetaProgress {
  const meta = loadMeta();
  if (!meta.unlockedBuilds.includes(buildId)) return meta;
  return saveMeta({ ...meta, selectedBuildId: buildId });
}

export function loadChallengeProgress(): ChallengeProgress {
  try {
    const raw = window.localStorage.getItem(CHALLENGES_STORAGE_KEY);
    if (!raw) return { ...EMPTY_CHALLENGE_PROGRESS, bestScore: {}, cleared: {} };
    const parsed = JSON.parse(raw) as Partial<ChallengeProgress>;
    const clearedCount = Math.max(
      0,
      Math.min(SEED_CHALLENGES.length, Math.floor(Number(parsed.clearedCount) || 0)),
    );
    const bestScore: Record<string, number> = {};
    if (parsed.bestScore && typeof parsed.bestScore === 'object') {
      for (const [id, value] of Object.entries(parsed.bestScore)) {
        const n = Number(value);
        if (Number.isFinite(n) && n >= 0) bestScore[id] = Math.floor(n);
      }
    }
    const cleared: Record<string, true> = {};
    if (parsed.cleared && typeof parsed.cleared === 'object') {
      for (const id of Object.keys(parsed.cleared)) {
        if (challengeById(id)) cleared[id] = true;
      }
    }
    return { clearedCount, bestScore, cleared };
  } catch {
    return { ...EMPTY_CHALLENGE_PROGRESS, bestScore: {}, cleared: {} };
  }
}

export function saveChallengeProgress(progress: ChallengeProgress): void {
  try {
    window.localStorage.setItem(CHALLENGES_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Best effort only.
  }
}

export { EMPTY_BEST };
