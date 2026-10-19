/**
 * Pure counter resolution — timing windows, side check, early/late/feint.
 * Kept free of React / audio so check-instant-flash.mjs can mirror it.
 */

import {
  WINDOW_GOOD,
  WINDOW_PERFECT,
  getTimingWindows,
} from './constants';
import type { ParrySide } from './patterns';
import { CounterResult } from './types';

export interface ResolveInput {
  /** now - impactTime (negative = early). */
  timingDiffMs: number;
  playerSide: ParrySide;
  attackSide: ParrySide;
  isFeint: boolean;
  /** True when there was no active attack (idle early release). */
  noAttack: boolean;
  score: number;
  combo: number;
  baseTier: number;
}

export interface ResolveOutput {
  result: CounterResult;
  absTimingMs: number;
}

export function resolveCounter(input: ResolveInput): ResolveOutput {
  const {
    timingDiffMs,
    playerSide,
    attackSide,
    isFeint,
    noAttack,
    score,
    combo,
    baseTier,
  } = input;

  if (noAttack) {
    return { result: CounterResult.EARLY, absTimingMs: Math.abs(timingDiffMs) };
  }

  if (isFeint) {
    return { result: CounterResult.FEINT, absTimingMs: Math.abs(timingDiffMs) };
  }

  const windows = getTimingWindows(score, combo, baseTier);
  const abs = Math.abs(timingDiffMs);

  // Wrong side still counts as a committed slash — punish even on good timing.
  if (playerSide !== attackSide) {
    return { result: CounterResult.WRONG_SIDE, absTimingMs: abs };
  }

  if (timingDiffMs < -windows.good) {
    return { result: CounterResult.EARLY, absTimingMs: abs };
  }
  if (timingDiffMs > windows.good) {
    return { result: CounterResult.LATE, absTimingMs: abs };
  }
  if (abs <= windows.perfect) {
    return { result: CounterResult.PERFECT, absTimingMs: abs };
  }
  return { result: CounterResult.GOOD, absTimingMs: abs };
}

/** Baseline windows exported for check script drift detection. */
export const BASELINE_WINDOWS = {
  perfect: WINDOW_PERFECT,
  good: WINDOW_GOOD,
} as const;
