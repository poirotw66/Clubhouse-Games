import { POSITIONS } from './config';
import type { GameState, Position } from './types';

/**
 * Personal records live outside the deterministic sim — same idea as
 * achievements. A finished career updates the wall; nothing here feeds back
 * into how a seed plays.
 */
export interface PositionBest {
  position: Position;
  seedCode: string;
  name: string;
  hofScore: number;
  verdict: string;
}

/** Minimal archive row shape — avoids importing storage (circular). */
export interface ArchiveBestSource {
  seedCode: string;
  name: string;
  position: string;
  positionId?: Position;
  verdict: string;
  hofScore: number;
}

export interface MilestoneCounts {
  /** Career counting-stat thresholds crossed across all finished runs. */
  career: number;
  /** Single-game feats (perfect game, cycle, …) across all finished runs. */
  feat: number;
  /** Runs that ended with any 名人堂 verdict. */
  hof: number;
  /** Runs that ended as 名人堂首輪高票入選. */
  firstBallot: number;
}

export interface PersonalRecords {
  bestByPosition: Partial<Record<Position, PositionBest>>;
  milestoneCounts: MilestoneCounts;
}

export const EMPTY_MILESTONE_COUNTS: MilestoneCounts = {
  career: 0,
  feat: 0,
  hof: 0,
  firstBallot: 0,
};

export const EMPTY_RECORDS: PersonalRecords = {
  bestByPosition: {},
  milestoneCounts: { ...EMPTY_MILESTONE_COUNTS },
};

/** Map an archive display label (or id) back to a Position when possible. */
export function positionFromArchiveLabel(label: string): Position | null {
  const byId = POSITIONS.find((p) => p.id === label);
  if (byId) return byId.id;
  const byLabel = POSITIONS.find((p) => p.label === label);
  return byLabel?.id ?? null;
}

/** Folds one finished career into the personal records wall. */
export function applyCareerToRecords(
  state: GameState,
  prior: PersonalRecords,
): PersonalRecords {
  const summary = state.summary;
  if (!summary) return prior;

  const bestByPosition: PersonalRecords['bestByPosition'] = { ...prior.bestByPosition };
  const prev = bestByPosition[state.position];
  if (!prev || summary.hofScore > prev.hofScore) {
    bestByPosition[state.position] = {
      position: state.position,
      seedCode: state.seedCode,
      name: state.name,
      hofScore: summary.hofScore,
      verdict: summary.verdict,
    };
  }

  const career = state.milestones.filter((m) => m.kind === 'career').length;
  const feat = state.milestones.filter((m) => m.kind === 'feat').length;
  const isHof = summary.verdict.startsWith('名人堂');
  const isFirstBallot = summary.verdict === '名人堂首輪高票入選';

  return {
    bestByPosition,
    milestoneCounts: {
      career: prior.milestoneCounts.career + career,
      feat: prior.milestoneCounts.feat + feat,
      hof: prior.milestoneCounts.hof + (isHof ? 1 : 0),
      firstBallot: prior.milestoneCounts.firstBallot + (isFirstBallot ? 1 : 0),
    },
  };
}

/**
 * Backfill position-best rows from a legacy archive that predates the records
 * key. Never lowers an existing best.
 */
export function mergeArchiveIntoRecords(
  archive: ArchiveBestSource[],
  prior: PersonalRecords,
): PersonalRecords {
  const bestByPosition: PersonalRecords['bestByPosition'] = { ...prior.bestByPosition };
  for (const entry of archive) {
    const position = entry.positionId ?? positionFromArchiveLabel(entry.position);
    if (!position) continue;
    const prev = bestByPosition[position];
    if (!prev || entry.hofScore > prev.hofScore) {
      bestByPosition[position] = {
        position,
        seedCode: entry.seedCode,
        name: entry.name,
        hofScore: entry.hofScore,
        verdict: entry.verdict,
      };
    }
  }
  return { ...prior, bestByPosition };
}

export function hasAnyRecords(
  records: PersonalRecords,
  archiveLength: number,
  careers: number,
): boolean {
  if (archiveLength > 0 || careers > 0) return true;
  return POSITIONS.some((p) => records.bestByPosition[p.id] !== undefined);
}

export function totalMilestoneHits(counts: MilestoneCounts): number {
  return counts.career + counts.feat;
}
