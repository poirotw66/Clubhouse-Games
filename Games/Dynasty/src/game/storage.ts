import {
  CAREER_CHALLENGES,
  EMPTY_CHALLENGE_PROGRESS,
  challengeById,
} from './challenges';
import type { ChallengeProgress } from './challenges';
import { STORAGE_KEY } from './config';
import {
  EMPTY_RECORDS,
  mergeArchiveIntoRecords,
} from './records';
import type { ClubBest, PersonalRecords } from './records';
import type { GameState } from './types';

const SAVE_KEY = `${STORAGE_KEY}:save`;
const ARCHIVE_KEY = `${STORAGE_KEY}:archive`;
const CHALLENGES_KEY = `${STORAGE_KEY}:challenges`;
const ACTIVE_CHALLENGE_KEY = `${STORAGE_KEY}:active-challenge`;
const RECORDS_KEY = `${STORAGE_KEY}:records`;

export interface ArchiveEntry {
  seedCode: string;
  gmName: string;
  club: string;
  verdict: string;
  score: number;
  titles: number;
}

export function saveGame(state: GameState): void {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // Private mode or a full quota: the tenure simply is not resumable.
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GameState;
    // Every field the engine reads unguarded is checked, so a save from an
    // older build starts over instead of crashing on the first decision.
    const intact =
      parsed &&
      typeof parsed.seedCode === 'string' &&
      Array.isArray(parsed.teams) &&
      Array.isArray(parsed.history) &&
      Array.isArray(parsed.ledgers) &&
      Array.isArray(parsed.seenEvents) &&
      Array.isArray(parsed.seenSituations) &&
      typeof parsed.deadlineShops === 'number' &&
      Array.isArray(parsed.seenTrainingScenarios) &&
      Array.isArray(parsed.seenBudgetScenarios) &&
      !!parsed.board &&
      !!parsed.finance;
    if (!intact) return null;
    // Older saves predate challengeId — treat missing as free play.
    if (parsed.challengeId === undefined) {
      parsed.challengeId = null;
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
    if (!raw) return { ...EMPTY_CHALLENGE_PROGRESS, bestScore: {}, cleared: {} };
    const parsed = JSON.parse(raw) as Partial<ChallengeProgress>;
    const clearedCount = Math.max(
      0,
      Math.min(CAREER_CHALLENGES.length, Math.floor(Number(parsed.clearedCount) || 0)),
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

function sanitizeClubBest(raw: unknown, teamId: string): ClubBest | null {
  if (!raw || typeof raw !== 'object') return null;
  const entry = raw as Partial<ClubBest>;
  const score = Number(entry.score);
  if (!Number.isFinite(score) || score < 0) return null;
  if (typeof entry.seedCode !== 'string' || !entry.seedCode) return null;
  return {
    teamId,
    seedCode: entry.seedCode,
    gmName: typeof entry.gmName === 'string' && entry.gmName ? entry.gmName : '無名總管',
    score: Math.floor(score),
    titles: Math.max(0, Math.floor(Number(entry.titles) || 0)),
    verdict: typeof entry.verdict === 'string' ? entry.verdict : '',
  };
}

export function loadRecords(archive: ArchiveEntry[] = loadArchive()): PersonalRecords {
  try {
    const raw = window.localStorage.getItem(RECORDS_KEY);
    if (!raw) {
      // First load after the records wall shipped: reconstruct club-best
      // from the existing archive so veterans do not start from a blank wall.
      return mergeArchiveIntoRecords(archive, EMPTY_RECORDS);
    }
    const parsed = JSON.parse(raw) as Partial<PersonalRecords>;
    const bestByClub: PersonalRecords['bestByClub'] = {};
    if (parsed.bestByClub && typeof parsed.bestByClub === 'object') {
      for (const club of Object.keys(parsed.bestByClub)) {
        const best = sanitizeClubBest(parsed.bestByClub[club], club);
        if (best) bestByClub[club] = best;
      }
    }
    const counts = parsed.milestoneCounts;
    const milestoneCounts = {
      tenures: Math.max(0, Math.floor(Number(counts?.tenures) || 0)),
      survived: Math.max(0, Math.floor(Number(counts?.survived) || 0)),
      titles: Math.max(0, Math.floor(Number(counts?.titles) || 0)),
      namedGm: Math.max(0, Math.floor(Number(counts?.namedGm) || 0)),
      dynasty: Math.max(0, Math.floor(Number(counts?.dynasty) || 0)),
    };
    return { bestByClub, milestoneCounts };
  } catch {
    return { ...EMPTY_RECORDS, bestByClub: {}, milestoneCounts: { ...EMPTY_RECORDS.milestoneCounts } };
  }
}

export function saveRecords(records: PersonalRecords): void {
  try {
    window.localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
  } catch {
    // Best effort only.
  }
}
