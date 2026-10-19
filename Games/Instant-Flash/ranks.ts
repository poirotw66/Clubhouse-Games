/**
 * Per-duel reaction rank from average absolute timing (ms) and accuracy.
 * Thresholds mirror the Perfect/Good windows so S stays rare and earned.
 */

export type ReactionRank = 'S' | 'A' | 'B' | 'C';

export const RANK_LABELS: Record<ReactionRank, string> = {
  S: 'S 宗師',
  A: 'A 上級',
  B: 'B 中堅',
  C: 'C 見習',
};

export interface RankInput {
  /** Mean |timingDiffMs| over successful counters (Perfect/Good). */
  avgAbsTimingMs: number;
  /** Successful counters / (successes + misses + early + feint). */
  accuracy: number;
  /** Count of scored counters used for avgAbsTimingMs. */
  sampleSize: number;
}

export function computeReactionRank(input: RankInput): ReactionRank {
  const { avgAbsTimingMs, accuracy, sampleSize } = input;
  if (sampleSize < 3) return 'C';
  if (avgAbsTimingMs <= 55 && accuracy >= 0.85) return 'S';
  if (avgAbsTimingMs <= 95 && accuracy >= 0.7) return 'A';
  if (avgAbsTimingMs <= 160 && accuracy >= 0.5) return 'B';
  return 'C';
}

export function rankSortKey(rank: ReactionRank): number {
  switch (rank) {
    case 'S':
      return 4;
    case 'A':
      return 3;
    case 'B':
      return 2;
    default:
      return 1;
  }
}

/** Keep the better (higher) rank. */
export function betterRank(a: ReactionRank | null, b: ReactionRank): ReactionRank {
  if (!a) return b;
  return rankSortKey(b) > rankSortKey(a) ? b : a;
}
