/**
 * Coin Cascade — Fever Overdrive and Cliff Edge Danger Radar models.
 * Manages the high-intensity casino arcade frenzy gauge, score multipliers,
 * and edge proximity calculations without mutating physical engine runs.
 */

import { SHELF_LEN, SHELF_W, WALL_X0, WALL_X1 } from './constants';
import type { Coin } from './types';

export interface FeverState {
  /** Energy charge percentage from 0 to 100. */
  readonly charge: number;
  /** Whether Fever Overdrive is currently firing. */
  readonly active: boolean;
  /** Remaining duration of the active Fever in seconds. */
  readonly remainingSec: number;
  /** Current active score and token multiplier. */
  readonly multiplier: number;
  /** Number of cascades completed during this Fever window. */
  readonly feverCascades: number;
  /** Highest combo reached in this run. */
  readonly maxCombo: number;
}

export interface CliffCoinInfo {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly isTeeter: boolean;
  /** Distance to the edge in units (smaller = closer to falling). */
  readonly distToCliff: number;
}

export interface CliffDangerRadar {
  /** Estimated probability of imminent cliff collapse (0 to 100%). */
  readonly dangerIndex: number;
  /** Number of coins within warning distance (y >= SHELF_LEN - 35). */
  readonly nearEdgeCount: number;
  /** Number of coins currently teetering over the cliff. */
  readonly teeterCount: number;
  /** Which of the 3 lanes has the most unstable load. */
  readonly hottestLane: 'left' | 'mid' | 'right';
  /** Coins currently within the cliff danger perimeter. */
  readonly cliffCoins: readonly CliffCoinInfo[];
}

export const INITIAL_FEVER_STATE: FeverState = {
  charge: 0,
  active: false,
  remainingSec: 0,
  multiplier: 1,
  feverCascades: 0,
  maxCombo: 0,
};

export const FEVER_DURATION_SEC = 12.0;
export const FEVER_MULTIPLIER = 2.0;

/**
 * Calculates energy gained for the Fever gauge based on tick events.
 */
export function calculateFeverChargeGain(params: {
  timingQuality: 'perfect' | 'good' | 'late';
  cascadeCount: number;
  isJackpot: boolean;
  teeterCount: number;
}): number {
  if (params.isJackpot) {
    return 100; // Instant fill on jackpot burst!
  }

  let gain = 0;
  if (params.timingQuality === 'perfect') {
    gain += 15;
  } else if (params.timingQuality === 'good') {
    gain += 5;
  }

  if (params.cascadeCount >= 3) {
    gain += 16 + (params.cascadeCount - 3) * 6;
  }

  if (params.teeterCount > 0) {
    gain += Math.min(10, params.teeterCount * 2.5);
  }

  return gain;
}

/**
 * Adds charge to FeverState, clamping between 0 and 100.
 */
export function addFeverCharge(state: FeverState, amount: number): FeverState {
  if (state.active) return state; // Do not charge while active
  const nextCharge = Math.min(100, Math.max(0, state.charge + amount));
  return {
    ...state,
    charge: nextCharge,
  };
}

/**
 * Activates Fever Overdrive mode for the configured duration.
 */
export function activateFever(state: FeverState): FeverState {
  return {
    ...state,
    charge: 100,
    active: true,
    remainingSec: FEVER_DURATION_SEC,
    multiplier: FEVER_MULTIPLIER,
    feverCascades: 0,
  };
}

/**
 * Steps the Fever countdown timer forward in real time.
 */
export function stepFeverState(state: FeverState, dtReal: number): FeverState {
  if (!state.active) return state;

  const nextSec = state.remainingSec - dtReal;
  if (nextSec <= 0) {
    return {
      ...state,
      active: false,
      charge: 0,
      remainingSec: 0,
      multiplier: 1,
    };
  }

  return {
    ...state,
    remainingSec: nextSec,
  };
}

/**
 * Analyzes shelf coins to produce cliff danger radar telemetry.
 */
export function computeCliffDanger(coins: readonly Coin[]): CliffDangerRadar {
  const cliffPerimeterY = SHELF_LEN - 35;
  const cliffCoins: CliffCoinInfo[] = [];
  let teeterCount = 0;
  let leftCount = 0;
  let midCount = 0;
  let rightCount = 0;

  const laneW = (WALL_X1 - WALL_X0) / 3;
  const lane1 = WALL_X0 + laneW;
  const lane2 = WALL_X0 + laneW * 2;

  for (const c of coins) {
    if (c.y >= cliffPerimeterY) {
      const isTeeter = c.teeterSince >= 0;
      if (isTeeter) teeterCount++;

      cliffCoins.push({
        id: c.id,
        x: c.x,
        y: c.y,
        isTeeter,
        distToCliff: Math.max(0, SHELF_LEN - c.y),
      });

      if (c.x < lane1) leftCount++;
      else if (c.x < lane2) midCount++;
      else rightCount++;
    }
  }

  let hottestLane: 'left' | 'mid' | 'right' = 'mid';
  if (leftCount > midCount && leftCount > rightCount) hottestLane = 'left';
  else if (rightCount > midCount && rightCount >= leftCount) hottestLane = 'right';

  // Compute 0-100% danger index
  const baseDanger = Math.min(50, cliffCoins.length * 4);
  const teeterDanger = Math.min(50, teeterCount * 12.5);
  const dangerIndex = Math.min(100, Math.round(baseDanger + teeterDanger));

  return {
    dangerIndex,
    nearEdgeCount: cliffCoins.length,
    teeterCount,
    hottestLane,
    cliffCoins,
  };
}
