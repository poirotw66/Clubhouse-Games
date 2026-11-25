/**
 * Pure counter resolution — timing windows, side check, early/late/feint.
 * Kept free of React / audio so check-instant-flash.mjs can mirror it.
 */

import {
  WINDOW_GOOD,
  WINDOW_PERFECT,
  getTimingWindows,
} from './constants.ts';
import type { ParryInput, ParrySide } from './patterns.ts';
import { CounterResult } from './types.ts';

export interface ResolveInput {
  /** now - impactTime (negative = early). */
  timingDiffMs: number;
  playerSide: ParryInput;
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

  if (timingDiffMs < -windows.good) {
    return { result: CounterResult.EARLY, absTimingMs: abs };
  }
  if (timingDiffMs > windows.good) {
    return { result: CounterResult.LATE, absTimingMs: abs };
  }

  // Neutral guard (Space/J) blocks partially without directional parry rewards.
  if (playerSide === 'guard') {
    return { result: CounterResult.GUARD, absTimingMs: abs };
  }

  // Wrong side still counts as a committed slash — punish even on good timing.
  if (playerSide !== attackSide) {
    return { result: CounterResult.WRONG_SIDE, absTimingMs: abs };
  }

  if (abs <= windows.perfect) {
    return { result: CounterResult.PERFECT, absTimingMs: abs };
  }
  return { result: CounterResult.GOOD, absTimingMs: abs };
}

export interface VersusReleaseInput {
  attacking: boolean;
  isFeint: boolean;
  timingDiffMs: number;
  goodWindowMs: number;
  alreadyFouled: boolean;
}

export type VersusReleaseOutput =
  | { outcome: 'ignore' }
  | { outcome: 'foul'; reason: 'early' | 'late' | 'feint' }
  | { outcome: 'point' };

/**
 * Pure versus-mode release validator:
 * idle releases, feint releases, early releases, and late releases (diff > goodWindowMs)
 * all count as fouls rather than scoring a point.
 */
export function resolveVersusRelease(input: VersusReleaseInput): VersusReleaseOutput {
  const { attacking, isFeint, timingDiffMs, goodWindowMs, alreadyFouled } = input;
  if (alreadyFouled) {
    return { outcome: 'ignore' };
  }
  if (!attacking) {
    return { outcome: 'foul', reason: 'early' };
  }
  if (isFeint) {
    return { outcome: 'foul', reason: 'feint' };
  }
  if (timingDiffMs < -goodWindowMs) {
    return { outcome: 'foul', reason: 'early' };
  }
  if (timingDiffMs > goodWindowMs) {
    return { outcome: 'foul', reason: 'late' };
  }
  return { outcome: 'point' };
}

/** Baseline windows exported for check script drift detection. */
export const BASELINE_WINDOWS = {
  perfect: WINDOW_PERFECT,
  good: WINDOW_GOOD,
} as const;
