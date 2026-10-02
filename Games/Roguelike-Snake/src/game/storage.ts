import { CHALLENGES_STORAGE_KEY, STORAGE_KEY } from './config';
import {
  EMPTY_CHALLENGE_PROGRESS,
  SEED_CHALLENGES,
  challengeById,
} from './challenges';
import type { ChallengeProgress } from './challenges';

export interface BestRecord {
  score: number;
  floor: number;
}

const EMPTY: BestRecord = { score: 0, floor: 0 };

export function loadBest(): BestRecord {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<BestRecord>;
    return {
      score: Number(parsed.score) || 0,
      floor: Number(parsed.floor) || 0,
    };
  } catch {
    return EMPTY;
  }
}

export function saveBest(record: BestRecord): BestRecord {
  const previous = loadBest();
  const merged: BestRecord = {
    score: Math.max(previous.score, record.score),
    floor: Math.max(previous.floor, record.floor),
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // Private mode or storage disabled: best-effort only.
  }
  return merged;
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
