import { EMPTY_PROGRESS } from './achievements';
import type { AchievementProgress } from './achievements';
import {
  CAREER_CHALLENGES,
  EMPTY_CHALLENGE_PROGRESS,
  challengeById,
} from './challenges';
import type { ChallengeProgress } from './challenges';
import { STORAGE_KEY } from './config';
import type { GameState } from './types';

const SAVE_KEY = `${STORAGE_KEY}:save`;
const ARCHIVE_KEY = `${STORAGE_KEY}:archive`;
const ACHIEVEMENTS_KEY = `${STORAGE_KEY}:achievements`;
const CHALLENGES_KEY = `${STORAGE_KEY}:challenges`;
const ACTIVE_CHALLENGE_KEY = `${STORAGE_KEY}:active-challenge`;

export interface ArchiveEntry {
  seedCode: string;
  name: string;
  position: string;
  verdict: string;
  hofScore: number;
  traits: string[];
}

export function saveGame(state: GameState): void {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // Private mode or a full quota: the run simply is not resumable.
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GameState;
    // 天命 was added after some saves were written; default it rather than
    // discarding an in-progress career that predates the mechanic.
    if (parsed?.meta && typeof parsed.meta.destiny !== 'number') {
      parsed.meta.destiny = 20;
    }
    // Guard against a save written by an older build. Every field added since
    // the first release is checked, because the engine reads them unguarded —
    // a stale save missing `finance` would crash on the first turn instead of
    // simply starting over.
    const intact =
      parsed &&
      typeof parsed.seedCode === 'string' &&
      !!parsed.attrs &&
      !!parsed.finance &&
      Array.isArray(parsed.handled) &&
      Array.isArray(parsed.milestones) &&
      Array.isArray(parsed.seenEvents) &&
      // Added when the pro stage became three turns a year — a save from
      // before that would misread `proTurn` as `undefined` and desync the
      // 春訓/球季/球季後 cycle, so a save missing it starts over instead.
      typeof parsed.proTurn === 'number';
    if (!intact) return null;
    // Choice-card fields arrived with the risk-event pack; default them so
    // mid-career saves from before that build keep playing.
    if (!Array.isArray(parsed.seenSituations)) parsed.seenSituations = [];
    if (typeof parsed.pendingSituation !== 'string') parsed.pendingSituation = null;
    if (typeof parsed.challengeId !== 'string') parsed.challengeId = null;
    else if (parsed.challengeId && !challengeById(parsed.challengeId)) parsed.challengeId = null;
    // Career flags arrived with the deepen pack; default so older saves resume.
    if (!parsed.flags || typeof parsed.flags !== 'object') {
      parsed.flags = { preferBullpen: false, tradeCooldown: 0, surgeryMiss: 0 };
    } else {
      parsed.flags.preferBullpen = !!parsed.flags.preferBullpen;
      parsed.flags.tradeCooldown = Math.max(0, Math.floor(Number(parsed.flags.tradeCooldown) || 0));
      parsed.flags.surgeryMiss = Math.max(0, Math.floor(Number(parsed.flags.surgeryMiss) || 0));
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearGame(): void {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to do.
  }
}

export function loadArchive(): ArchiveEntry[] {
  try {
    const raw = window.localStorage.getItem(ARCHIVE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ArchiveEntry[];
    return Array.isArray(parsed) ? parsed.slice(0, 20) : [];
  } catch {
    return [];
  }
}

export function loadAchievements(): AchievementProgress {
  try {
    const raw = window.localStorage.getItem(ACHIEVEMENTS_KEY);
    if (!raw) return EMPTY_PROGRESS;
    const parsed = JSON.parse(raw) as Partial<AchievementProgress>;
    // Merged field by field so a save written before a new collection existed
    // still loads, rather than throwing away everything the player earned.
    return {
      unlocked: parsed.unlocked ?? {},
      traitsSeen: parsed.traitsSeen ?? [],
      pitchesMastered: parsed.pitchesMastered ?? [],
      positionsPlayed: parsed.positionsPlayed ?? [],
      leaguesPlayed: parsed.leaguesPlayed ?? [],
      careers: Number(parsed.careers) || 0,
      bestHof: Number(parsed.bestHof) || 0,
    };
  } catch {
    return EMPTY_PROGRESS;
  }
}

export function saveAchievements(progress: AchievementProgress): void {
  try {
    window.localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(progress));
  } catch {
    // Best effort only.
  }
}

export function pushArchive(entry: ArchiveEntry): ArchiveEntry[] {
  const next = [entry, ...loadArchive()].slice(0, 20);
  try {
    window.localStorage.setItem(ARCHIVE_KEY, JSON.stringify(next));
  } catch {
    // Best effort only.
  }
  return next;
}

export function loadChallengeProgress(): ChallengeProgress {
  try {
    const raw = window.localStorage.getItem(CHALLENGES_KEY);
    if (!raw) return { ...EMPTY_CHALLENGE_PROGRESS, bestHof: {}, cleared: {} };
    const parsed = JSON.parse(raw) as Partial<ChallengeProgress>;
    const clearedCount = Math.max(
      0,
      Math.min(CAREER_CHALLENGES.length, Math.floor(Number(parsed.clearedCount) || 0)),
    );
    const bestHof: Record<string, number> = {};
    if (parsed.bestHof && typeof parsed.bestHof === 'object') {
      for (const [id, value] of Object.entries(parsed.bestHof)) {
        const n = Number(value);
        if (Number.isFinite(n) && n >= 0) bestHof[id] = Math.floor(n);
      }
    }
    const cleared: Record<string, true> = {};
    if (parsed.cleared && typeof parsed.cleared === 'object') {
      for (const id of Object.keys(parsed.cleared)) {
        if (challengeById(id)) cleared[id] = true;
      }
    }
    return { clearedCount, bestHof, cleared };
  } catch {
    return { ...EMPTY_CHALLENGE_PROGRESS, bestHof: {}, cleared: {} };
  }
}

export function saveChallengeProgress(progress: ChallengeProgress): void {
  try {
    window.localStorage.setItem(CHALLENGES_KEY, JSON.stringify(progress));
  } catch {
    // Best effort only.
  }
}

/** Companion to the mid-run save so Continue restores challenge context. */
export function loadActiveChallengeId(): string | null {
  try {
    const raw = window.localStorage.getItem(ACTIVE_CHALLENGE_KEY);
    if (!raw) return null;
    return challengeById(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function saveActiveChallengeId(id: string | null): void {
  try {
    if (id && challengeById(id)) {
      window.localStorage.setItem(ACTIVE_CHALLENGE_KEY, id);
    } else {
      window.localStorage.removeItem(ACTIVE_CHALLENGE_KEY);
    }
  } catch {
    // Best effort only.
  }
}
