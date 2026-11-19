/**
 * Prize drop chute vs side gutter geometry, pusher velocity profiles,
 * and coin edge overhang teetering calculations.
 */
import {
  COIN_R,
  EDGE_MARGIN,
  NEAR_MISS_OVERHANG,
  PUSHER_BACK_Y,
  PUSHER_PERIOD_TICKS,
  PUSHER_STROKE,
  SHELF_LEN,
  WALL_X0,
  WALL_X1,
} from './constants';
import { coinRadius, triangleWave } from './engine';
import type { TablePhysics } from './tables';
import type { Coin, CoinKind } from './types';

/** Left gutter boundary: drops strictly below this x fall into the house gutter. */
export const LEFT_GUTTER_MAX_X = WALL_X0 + EDGE_MARGIN;

/** Right gutter boundary: drops strictly above this x fall into the house gutter. */
export const RIGHT_GUTTER_MIN_X = WALL_X1 - EDGE_MARGIN;

export type DropZone = 'left_gutter' | 'prize_chute' | 'right_gutter';

/**
 * Classifies an x position along the shelf edge as left gutter, central prize chute, or right gutter.
 */
export function classifyDropZone(x: number): DropZone {
  if (x < LEFT_GUTTER_MAX_X) return 'left_gutter';
  if (x > RIGHT_GUTTER_MIN_X) return 'right_gutter';
  return 'prize_chute';
}

/** Whether a fall at the given x coordinate lands in the side gutters (lost to house). */
export function isGutterLoss(x: number): boolean {
  return x < LEFT_GUTTER_MAX_X || x > RIGHT_GUTTER_MIN_X;
}

/** Whether a fall at the given x coordinate lands in the player prize drop chute. */
export function isPrizeChute(x: number): boolean {
  return x >= LEFT_GUTTER_MAX_X && x <= RIGHT_GUTTER_MIN_X;
}

/**
 * Theoretical sinusoidal pusher front y position for harmonic motion:
 * y(t) = y_back + (stroke / 2) * (1 - cos(2 * pi * t / period))
 */
export function pusherHarmonicFrontY(tick: number, physics?: TablePhysics): number {
  const back = physics?.pusherBackY ?? PUSHER_BACK_Y;
  const stroke = physics?.pusherStroke ?? PUSHER_STROKE;
  const period = physics?.pusherPeriodTicks ?? PUSHER_PERIOD_TICKS;
  const phase = ((tick % period) + period) % period;
  return back + (stroke / 2) * (1 - Math.cos((2 * Math.PI * phase) / period));
}

/**
 * Instantaneous sinusoidal velocity of the pusher plate in units / tick:
 * v(t) = dy/dt = (pi * stroke / period) * sin(2 * pi * t / period)
 */
export function pusherVelocitySinusoidal(tick: number, physics?: TablePhysics): number {
  const stroke = physics?.pusherStroke ?? PUSHER_STROKE;
  const period = physics?.pusherPeriodTicks ?? PUSHER_PERIOD_TICKS;
  const phase = ((tick % period) + period) % period;
  return ((Math.PI * stroke) / period) * Math.sin((2 * Math.PI * phase) / period);
}

/**
 * Piecewise constant velocity of the triangle wave pusher in units / tick:
 * + (2 * stroke / period) during forward sweep, - (2 * stroke / period) during retraction.
 */
export function pusherVelocityTriangle(tick: number, physics?: TablePhysics): number {
  const stroke = physics?.pusherStroke ?? PUSHER_STROKE;
  const period = physics?.pusherPeriodTicks ?? PUSHER_PERIOD_TICKS;
  const t = ((tick % period) + period) % period;
  const half = period / 2;
  const speed = (2 * stroke) / period;
  return t < half ? speed : -speed;
}

/**
 * Distance in shelf units that a coin's front rim protrudes past the front edge (y = SHELF_LEN).
 * Returns 0 if the coin is entirely on the shelf.
 */
export function coinOverhangDistance(coin: Coin): number {
  const r = coinRadius(coin.kind);
  return Math.max(0, coin.y + r - SHELF_LEN);
}

/**
 * The critical y position at which a coin of a given kind begins teetering:
 * y = SHELF_LEN - radius + NEAR_MISS_OVERHANG.
 */
export function teeteringThresholdForKind(kind: CoinKind): number {
  const r = coinRadius(kind);
  return SHELF_LEN - r + NEAR_MISS_OVERHANG;
}

export interface DropZoneSummary {
  readonly totalFalls: number;
  readonly chuteFalls: number;
  readonly gutterFalls: number;
  readonly leftGutterFalls: number;
  readonly rightGutterFalls: number;
  readonly gutterLossRatio: number;
  readonly chuteRatio: number;
}

/**
 * Aggregates a series of fallen coin x-coordinates into chute vs gutter ratios.
 */
export function analyzeDropZones(fallCoordinates: readonly number[]): DropZoneSummary {
  const total = fallCoordinates.length;
  if (total === 0) {
    return {
      totalFalls: 0,
      chuteFalls: 0,
      gutterFalls: 0,
      leftGutterFalls: 0,
      rightGutterFalls: 0,
      gutterLossRatio: 0,
      chuteRatio: 1,
    };
  }

  let leftGutter = 0;
  let rightGutter = 0;
  let chute = 0;

  for (const x of fallCoordinates) {
    const zone = classifyDropZone(x);
    if (zone === 'left_gutter') leftGutter++;
    else if (zone === 'right_gutter') rightGutter++;
    else chute++;
  }

  const gutter = leftGutter + rightGutter;
  return {
    totalFalls: total,
    chuteFalls: chute,
    gutterFalls: gutter,
    leftGutterFalls: leftGutter,
    rightGutterFalls: rightGutter,
    gutterLossRatio: gutter / total,
    chuteRatio: chute / total,
  };
}
