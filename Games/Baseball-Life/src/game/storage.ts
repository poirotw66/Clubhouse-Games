import { EMPTY_PROGRESS } from './achievements';
import type { AchievementProgress } from './achievements';
import {
  CAREER_CHALLENGES,
  EMPTY_CHALLENGE_PROGRESS,
  challengeById,
} from './challenges';
import type { ChallengeProgress } from './challenges';
import { POSITIONS, STORAGE_KEY } from './config';
import {
  EMPTY_MILESTONE_COUNTS,
  EMPTY_RECORDS,
  mergeArchiveIntoRecords,
  positionFromArchiveLabel,
} from './records';
import type { PersonalRecords, PositionBest } from './records';
import type { GameState, Position } from './types';

const SAVE_KEY = `${STORAGE_KEY}:save`;
const ARCHIVE_KEY = `${STORAGE_KEY}:archive`;
const ACHIEVEMENTS_KEY = `${STORAGE_KEY}:achievements`;
const CHALLENGES_KEY = `${STORAGE_KEY}:challenges`;
const ACTIVE_CHALLENGE_KEY = `${STORAGE_KEY}:active-challenge`;
const RECORDS_KEY = `${STORAGE_KEY}:records`;

export interface ArchiveEntry {
  seedCode: string;
  name: string;
  /** Display label (投手／捕手／…). */
  position: string;
  /** Stable id when available; older archive rows may omit it. */
  positionId?: Position;
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

function sanitizeArchiveEntry(raw: Partial<ArchiveEntry>): ArchiveEntry | null {
  if (!raw || typeof raw.seedCode !== 'string' || typeof raw.name !== 'string') return null;
  const hofScore = Number(raw.hofScore);
  if (!Number.isFinite(hofScore) || hofScore < 0) return null;
  const position = typeof raw.position === 'string' ? raw.position : '';
  const positionId =
    raw.positionId && POSITIONS.some((p) => p.id === raw.positionId)
      ? raw.positionId
      : positionFromArchiveLabel(position) ?? undefined;
  return {
    seedCode: raw.seedCode,
    name: raw.name,
    position: position || (positionId ? (POSITIONS.find((p) => p.id === positionId)?.label ?? '') : ''),
    positionId,
    verdict: typeof raw.verdict === 'string' ? raw.verdict : '',
    hofScore: Math.floor(hofScore),
    traits: Array.isArray(raw.traits)
      ? raw.traits.filter((t): t is string => typeof t === 'string')
      : [],
  };
}

export function loadArchive(): ArchiveEntry[] {
  try {
    const raw = window.localStorage.getItem(ARCHIVE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<ArchiveEntry>[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(sanitizeArchiveEntry)
      .filter((entry): entry is ArchiveEntry => entry !== null)
      .slice(0, 20);
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

function sanitizePositionBest(raw: unknown, position: Position): PositionBest | null {
  if (!raw || typeof raw !== 'object') return null;
  const entry = raw as Partial<PositionBest>;
  const hofScore = Number(entry.hofScore);
  if (
    typeof entry.seedCode !== 'string' ||
    typeof entry.name !== 'string' ||
    typeof entry.verdict !== 'string' ||
    !Number.isFinite(hofScore) ||
    hofScore < 0
  ) {
    return null;
  }
  return {
    position,
    seedCode: entry.seedCode,
    name: entry.name,
    hofScore: Math.floor(hofScore),
    verdict: entry.verdict,
  };
}

export function loadRecords(): PersonalRecords {
  try {
    const raw = window.localStorage.getItem(RECORDS_KEY);
    const archive = loadArchive();
    if (!raw) {
      // First load after the records wall shipped: reconstruct position-best
      // from the existing archive so veterans do not start from a blank wall.
      return mergeArchiveIntoRecords(archive, EMPTY_RECORDS);
    }
    const parsed = JSON.parse(raw) as Partial<PersonalRecords>;
    const bestByPosition: PersonalRecords['bestByPosition'] = {};
    if (parsed.bestByPosition && typeof parsed.bestByPosition === 'object') {
      for (const pos of POSITIONS) {
        const best = sanitizePositionBest(parsed.bestByPosition[pos.id], pos.id);
        if (best) bestByPosition[pos.id] = best;
      }
    }
    const counts = parsed.milestoneCounts;
    const milestoneCounts = {
      career: Math.max(0, Math.floor(Number(counts?.career) || 0)),
      feat: Math.max(0, Math.floor(Number(counts?.feat) || 0)),
      hof: Math.max(0, Math.floor(Number(counts?.hof) || 0)),
      firstBallot: Math.max(0, Math.floor(Number(counts?.firstBallot) || 0)),
    };
    // Still merge archive in case a best row was never persisted (quota / older build).
    return mergeArchiveIntoRecords(archive, { bestByPosition, milestoneCounts });
  } catch {
    return { ...EMPTY_RECORDS, milestoneCounts: { ...EMPTY_MILESTONE_COUNTS } };
  }
}

export function saveRecords(records: PersonalRecords): void {
  try {
    window.localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
  } catch {
    // Best effort only.
  }
}
