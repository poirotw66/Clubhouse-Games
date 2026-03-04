import { Color } from './types';

/** Default capacity for UI/fallback (e.g. new bottle in quick play level 1). */
export const DEFAULT_CAPACITY = 4;
/** Maximum bottle capacity at highest difficulty. */
export const MAX_CAPACITY = 6;

export const INITIAL_COINS = 1200;

/** Capacity by difficulty: 4 (easy) -> 5 (mid) -> 6 (hard). */
export function getCapacityForLevel(level: number): number {
  if (level < 5) return 4;
  if (level < 10) return 5;
  return 6;
}

export const LEVEL_COLORS = [
  Color.RED,
  Color.BLUE,
  Color.GREEN,
  Color.YELLOW,
  Color.PURPLE,
  Color.ORANGE,
  Color.CYAN,
];

// Costs for powerups
export const COST_SHUFFLE = 100;
export const COST_UNDO = 50;
export const COST_ADD_BOTTLE = 200;
export const COST_REVEAL = 150; // Cost to reveal hidden layers
export const COST_CLEAR = 300;