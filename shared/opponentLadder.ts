/**
 * Shared opponent-unlock ladder primitives.
 *
 * Two unlock styles appear in the catalogue:
 *   1. Frontier (clearedCount): indices < clearedCount are cleared;
 *      index === clearedCount is the playable frontier (Big-Two, Pick-Red, Reversi).
 *   2. Chain (unlockAfter): each opponent names a prerequisite id (Checkers).
 *
 * Games keep their own roster definitions, storage keys, and extra fields
 * (puzzle stars, catchphrases…). This module only owns the unlock math.
 */

export interface FrontierLadderProgress {
  /** Opponents with index < clearedCount are cleared; index === clearedCount is unlocked. */
  clearedCount: number;
  /** Cleared opponent ids (string keys so games can use branded id unions). */
  cleared: Record<string, true | boolean>;
  lastIndex: number;
}

export const EMPTY_FRONTIER_LADDER: FrontierLadderProgress = {
  clearedCount: 0,
  cleared: {},
  lastIndex: 0,
};

/** Frontier: index is playable when index <= clearedCount (and in range). */
export function isFrontierUnlocked(
  index: number,
  clearedCount: number,
  opponentCount: number,
): boolean {
  if (index < 0 || index >= opponentCount) return false;
  return index <= clearedCount;
}

export interface ApplyFrontierResultOptions {
  opponentIndex: number;
  opponentId: string;
  won: boolean;
  opponentCount: number;
}

/**
 * Apply a finished frontier duel.
 * Winning the current frontier opponent advances clearedCount by one.
 * Winning a non-frontier foe only marks that id cleared (no skip-ahead).
 * Losing updates lastIndex only.
 */
export function applyFrontierResult(
  progress: FrontierLadderProgress,
  opts: ApplyFrontierResultOptions,
): FrontierLadderProgress {
  const { opponentIndex, opponentId, won, opponentCount } = opts;
  const cleared = { ...progress.cleared };
  let clearedCount = progress.clearedCount;

  if (won) {
    cleared[opponentId] = true;
    if (opponentIndex === clearedCount && clearedCount < opponentCount) {
      clearedCount = opponentIndex + 1;
    }
  }

  return {
    clearedCount,
    cleared,
    lastIndex: opponentIndex,
  };
}

/**
 * Reversi-style frontier win: always mark cleared; advance frontier only when
 * beating the current frontier index. Returns whether this was a new clear.
 */
export function applyFrontierWin(
  progress: FrontierLadderProgress,
  opts: {
    opponentIndex: number;
    opponentId: string;
    opponentCount: number;
  },
): { progress: FrontierLadderProgress; newlyCleared: boolean } {
  const { opponentIndex, opponentId, opponentCount } = opts;
  const already = Boolean(progress.cleared[opponentId]);
  const cleared = { ...progress.cleared, [opponentId]: true as const };
  let clearedCount = progress.clearedCount;
  let newlyCleared = false;

  if (opponentIndex === clearedCount) {
    clearedCount = Math.min(opponentCount, clearedCount + 1);
    newlyCleared = true;
  } else if (!already) {
    newlyCleared = true;
  }

  return {
    progress: {
      ...progress,
      clearedCount,
      cleared,
      lastIndex: opponentIndex,
    },
    newlyCleared,
  };
}

export function applyFrontierLoss(
  progress: FrontierLadderProgress,
  opponentIndex: number,
): FrontierLadderProgress {
  return { ...progress, lastIndex: opponentIndex };
}

export function isFrontierComplete(
  progress: FrontierLadderProgress,
  opponentCount: number,
): boolean {
  return progress.clearedCount >= opponentCount;
}

/** Chain unlock: playable when unlockAfter is null or that id is in beaten. */
export function isChainUnlocked(
  unlockAfter: string | null | undefined,
  beaten: ReadonlySet<string> | readonly string[],
): boolean {
  if (!unlockAfter) return true;
  const set = beaten instanceof Set ? beaten : new Set(beaten);
  return set.has(unlockAfter);
}

/**
 * Normalize a raw frontier save blob. Games pass `validIds` so unknown ids
 * from older builds are dropped without wiping the whole save.
 */
export function mergeFrontierProgress(
  raw: unknown,
  opts: { opponentCount: number; validIds?: ReadonlySet<string> | readonly string[] },
): FrontierLadderProgress {
  if (!raw || typeof raw !== 'object') {
    return { ...EMPTY_FRONTIER_LADDER, cleared: {} };
  }
  const o = raw as Record<string, unknown>;
  const opponentCount = Math.max(0, opts.opponentCount);
  const clearedCount = Math.min(
    opponentCount,
    Math.max(0, Math.floor(Number(o.clearedCount) || 0)),
  );
  const lastIndex = Math.min(
    Math.max(0, opponentCount - 1),
    Math.max(0, Math.floor(Number(o.lastIndex) || 0)),
  );

  const valid =
    opts.validIds == null
      ? null
      : opts.validIds instanceof Set
        ? opts.validIds
        : new Set(opts.validIds);

  const cleared: Record<string, true> = {};
  if (o.cleared && typeof o.cleared === 'object') {
    for (const [id, val] of Object.entries(o.cleared as Record<string, unknown>)) {
      if (!val) continue;
      if (valid && !valid.has(id)) continue;
      cleared[id] = true;
    }
  }

  return { clearedCount, cleared, lastIndex };
}
