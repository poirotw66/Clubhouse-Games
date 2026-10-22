/** Track length in metres (world X). */
export const TRACK_LENGTH = 50;

/** Run time limit in seconds. */
export const TIME_LIMIT = 90;

/** Physics fixed timestep (180 Hz). */
export const FIXED_DT = 1 / 180;

/** Max accumulator catch-up per frame. */
export const MAX_FRAME_DT = 0.05;

export const BODY_HEIGHT = 1.15;
export const BODY_LENGTH = 1.9;
export const BODY_WIDTH = 0.72;
export const LEG_LENGTH = 0.95;

/** Tip past this pitch/roll (rad) → fall. */
export const FALL_PITCH = 0.72;
export const FALL_ROLL = 0.62;

/** Rank thresholds (finish time in seconds). */
export const RANK_THRESHOLDS = {
  legend: 25,
  king: 40,
  awakened: 60,
} as const;

export const STORAGE_BEST_KEY = 'lion-dance:best-time-v1';
export const STORAGE_LANG_KEY = 'lion-dance:lang-v1';

export const GAME_PATH = '/Clubhouse-Games/Games/Lion-Dance/';

export type LegId = 'FL' | 'FR' | 'BL' | 'BR';

export const LEG_IDS: readonly LegId[] = ['FL', 'FR', 'BL', 'BR'];

/** Hip attachment offsets in body-local space (x forward, y up, z right). */
export const LEG_ATTACH: Record<LegId, { x: number; z: number }> = {
  FL: { x: 0.72, z: -0.32 },
  FR: { x: 0.72, z: 0.32 },
  BL: { x: -0.72, z: -0.32 },
  BR: { x: -0.72, z: 0.32 },
};

export const KEY_TO_LEG: Record<string, LegId> = {
  q: 'FL',
  w: 'FR',
  o: 'BL',
  p: 'BR',
};
