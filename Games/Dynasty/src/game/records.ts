/**
 * Personal records wall — best tenure per club + milestone tallies.
 *
 * Lives outside the deterministic sim (same idea as challenge progress).
 * A finished tenure updates the wall; nothing here feeds back into how a
 * seed plays. Tap a row to free-play replay with `?seed=`.
 */
import { CLUBS } from './config';
import type { GameState } from './types';

export interface ClubBest {
  teamId: string;
  seedCode: string;
  gmName: string;
  score: number;
  titles: number;
  verdict: string;
}

/** Minimal archive row shape — avoids importing storage (circular). */
export interface ArchiveBestSource {
  seedCode: string;
  gmName: string;
  club: string;
  verdict: string;
  score: number;
  titles: number;
}

export interface MilestoneCounts {
  /** Finished tenures (any outcome). */
  tenures: number;
  /** Tenures that were not fired. */
  survived: number;
  /** Total 總冠軍 across all finished tenures. */
  titles: number;
  /** Runs that ended as 名總管 or better (score ≥ 1900). */
  namedGm: number;
  /** Runs that ended as 王朝締造者 (score ≥ 2800). */
  dynasty: number;
}

export interface PersonalRecords {
  bestByClub: Partial<Record<string, ClubBest>>;
  milestoneCounts: MilestoneCounts;
}

export const EMPTY_MILESTONE_COUNTS: MilestoneCounts = {
  tenures: 0,
  survived: 0,
  titles: 0,
  namedGm: 0,
  dynasty: 0,
};

export const EMPTY_RECORDS: PersonalRecords = {
  bestByClub: {},
  milestoneCounts: { ...EMPTY_MILESTONE_COUNTS },
};

/** Map an archive club display name back to a club id when possible. */
export function clubIdFromArchiveLabel(label: string): string | null {
  const byId = CLUBS.find((c) => c.id === label);
  if (byId) return byId.id;
  const byName = CLUBS.find((c) => c.name === label);
  return byName?.id ?? null;
}

/** Folds one finished tenure into the personal records wall. */
export function applyTenureToRecords(
  state: GameState,
  prior: PersonalRecords,
): PersonalRecords {
  const summary = state.summary;
  if (!summary) return prior;

  const bestByClub: PersonalRecords['bestByClub'] = { ...prior.bestByClub };
  const prev = bestByClub[state.teamId];
  if (!prev || summary.score > prev.score) {
    bestByClub[state.teamId] = {
      teamId: state.teamId,
      seedCode: state.seedCode,
      gmName: state.gmName,
      score: summary.score,
      titles: summary.titles,
      verdict: summary.verdict,
    };
  }

  return {
    bestByClub,
    milestoneCounts: {
      tenures: prior.milestoneCounts.tenures + 1,
      survived: prior.milestoneCounts.survived + (summary.fired ? 0 : 1),
      titles: prior.milestoneCounts.titles + summary.titles,
      namedGm: prior.milestoneCounts.namedGm + (summary.score >= 1900 ? 1 : 0),
      dynasty: prior.milestoneCounts.dynasty + (summary.score >= 2800 ? 1 : 0),
    },
  };
}

/**
 * Backfill club-best rows from a legacy archive that predates the records
 * key. Never lowers an existing best.
 */
export function mergeArchiveIntoRecords(
  archive: ArchiveBestSource[],
  prior: PersonalRecords,
): PersonalRecords {
  const bestByClub: PersonalRecords['bestByClub'] = { ...prior.bestByClub };
  for (const entry of archive) {
    const teamId = clubIdFromArchiveLabel(entry.club);
    if (!teamId) continue;
    const prev = bestByClub[teamId];
    if (!prev || entry.score > prev.score) {
      bestByClub[teamId] = {
        teamId,
        seedCode: entry.seedCode,
        gmName: entry.gmName,
        score: entry.score,
        titles: entry.titles,
        verdict: entry.verdict,
      };
    }
  }
  return { bestByClub, milestoneCounts: { ...prior.milestoneCounts } };
}

export function hasAnyRecords(
  records: PersonalRecords,
  archiveLength: number,
): boolean {
  if (archiveLength > 0) return true;
  if (records.milestoneCounts.tenures > 0) return true;
  return Object.keys(records.bestByClub).length > 0;
}

export function totalMilestoneHits(counts: MilestoneCounts): number {
  return counts.tenures + counts.survived + counts.titles + counts.namedGm + counts.dynasty;
}
