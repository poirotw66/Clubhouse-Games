import { type MemoryCard, type FaceId } from './memoryLogic.ts';

export type PhosphorLevel = 0 | 1 | 2 | 3;

export interface PhosphorCell {
  index: number;
  level: PhosphorLevel;
  turnsAgo: number;
  coordinate: string;
  isReady: boolean;
  matched: boolean;
  face?: FaceId;
}

export interface ReactionStats {
  averageMs: number;
  latestMs: number;
  sampleCount: number;
  speedRating: string;
}

export type CognitiveRankGrade = 'S' | 'A' | 'B' | 'C' | 'D';

export interface CognitiveRank {
  grade: CognitiveRankGrade;
  title: string;
  color: string;
}

export interface BrainTelemetrySnapshot {
  retentionPct: number;
  phosphorCells: PhosphorCell[];
  reactionStats: ReactionStats;
  cognitiveRank: CognitiveRank;
  feverTier: number;
  feverMultiplier: number;
  feverLabel: string;
  readyPairsCount: number;
}

/** Computes ideal grid columns for matrix coordinates based on board card count. */
export function getBoardCols(totalCards: number): number {
  if (totalCards <= 12) return 4;
  if (totalCards <= 24) return 6;
  if (totalCards <= 36) return 6;
  return 8;
}

/** Converts a 0-based card index into standard matrix coordinates (e.g., A1, B3). */
export function getGridCoordinate(index: number, cols: number): string {
  const safeCols = Math.max(1, cols);
  const row = Math.floor(index / safeCols);
  const col = (index % safeCols) + 1;
  const rowLetter = String.fromCharCode(65 + Math.min(25, row));
  return `${rowLetter}${col}`;
}

/**
 * Computes memory palace phosphor decay levels for each card:
 * - Level 0: Unexplored (never turned)
 * - Level 1: Ghost ember (seen 4+ turns ago, memory trace fading)
 * - Level 2: Warm trace (seen 2-3 turns ago, active working memory)
 * - Level 3: Fresh synaptic (seen 0-1 turns ago, peak clarity)
 */
export function computePhosphorCells(
  cards: readonly MemoryCard[],
  sightings: ReadonlyMap<number, number>,
  currentTurn: number,
  knownReadyIndices: readonly number[],
  cols: number,
): PhosphorCell[] {
  const readySet = new Set(knownReadyIndices);

  return cards.map((card, idx) => {
    const seenTurn = sightings.get(idx);
    const coordinate = getGridCoordinate(idx, cols);
    const isReady = readySet.has(idx);

    if (card.matched) {
      return {
        index: idx,
        level: 0,
        turnsAgo: -1,
        coordinate,
        isReady: false,
        matched: true,
        face: card.face,
      };
    }

    if (seenTurn === undefined) {
      return {
        index: idx,
        level: 0,
        turnsAgo: -1,
        coordinate,
        isReady: false,
        matched: false,
        face: card.face,
      };
    }

    const turnsAgo = Math.max(0, currentTurn - seenTurn);
    let level: PhosphorLevel;
    if (turnsAgo <= 1) {
      level = 3;
    } else if (turnsAgo <= 3) {
      level = 2;
    } else {
      level = 1;
    }

    return {
      index: idx,
      level,
      turnsAgo,
      coordinate,
      isReady,
      matched: false,
      face: card.face,
    };
  });
}

/**
 * Computes instantaneous working memory retention percentage:
 * Estimates how firmly explored, unmatched cards remain held in working memory
 * before cognitive decay.
 */
export function computeWorkingMemoryRetention(phosphorCells: readonly PhosphorCell[]): number {
  const activeUnmatched = phosphorCells.filter((c) => !c.matched && c.level > 0);
  if (activeUnmatched.length === 0) return 100;

  let totalWeight = 0;
  for (const cell of activeUnmatched) {
    if (cell.isReady) {
      // Anchored twin pair enjoys heightened neurological reinforcement
      totalWeight += 1.0;
    } else if (cell.level === 3) {
      totalWeight += 0.95;
    } else if (cell.level === 2) {
      totalWeight += 0.72;
    } else {
      totalWeight += 0.42;
    }
  }

  const score = Math.round((totalWeight / activeUnmatched.length) * 100);
  return Math.max(10, Math.min(100, score));
}

/** Computes average reaction time and qualitative cognitive speed rating. */
export function computeReactionStats(samples: readonly number[]): ReactionStats {
  if (samples.length === 0) {
    return {
      averageMs: 0,
      latestMs: 0,
      sampleCount: 0,
      speedRating: '測量中',
    };
  }

  const recent = samples.slice(-8);
  const sum = recent.reduce((acc, v) => acc + v, 0);
  const avg = Math.round(sum / recent.length);
  const latest = samples[samples.length - 1];

  let speedRating = '沉著檢索';
  if (avg < 850) {
    speedRating = '閃電神經';
  } else if (avg < 1500) {
    speedRating = '敏捷專注';
  } else if (avg < 2400) {
    speedRating = '沉著檢索';
  } else {
    speedRating = '深度回溯';
  }

  return {
    averageMs: avg,
    latestMs: latest,
    sampleCount: samples.length,
    speedRating,
  };
}

/** Evaluates overall cognitive rank based on accuracy, combo fever, and retention. */
export function computeCognitiveRank(
  accuracyPct: number,
  comboLevel: number,
  retentionPct: number,
  explorationPct: number,
): CognitiveRank {
  if (comboLevel >= 3 && accuracyPct >= 75 && retentionPct >= 70) {
    return { grade: 'S', title: '神經先知', color: '#f43f5e' };
  }
  if ((comboLevel >= 2 || accuracyPct >= 65) && retentionPct >= 55) {
    return { grade: 'A', title: '超感知者', color: '#fbbf24' };
  }
  if (explorationPct >= 40 && accuracyPct >= 45) {
    return { grade: 'B', title: '記憶宮殿', color: '#2dd4bf' };
  }
  if (explorationPct >= 15) {
    return { grade: 'C', title: '突觸連結', color: '#38bdf8' };
  }
  return { grade: 'D', title: '矩陣探索', color: '#94a3b8' };
}

/** Computes fever overdrive tier, multiplier, and display label. */
export function computeFeverState(combo: number): {
  tier: number;
  multiplier: number;
  label: string;
} {
  if (combo <= 1) {
    return { tier: 0, multiplier: 1, label: '冷卻蓄能' };
  }
  if (combo === 2) {
    return { tier: 1, multiplier: 2, label: '突觸共振 ×2' };
  }
  if (combo <= 4) {
    return { tier: 2, multiplier: combo, label: `狂熱超頻 ×${combo}` };
  }
  return { tier: 3, multiplier: Math.min(5, combo), label: `思維極限 ×${Math.min(5, combo)}` };
}
