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

/** Tip past this pitch/roll (rad) → fall. Slightly forgiving vs v1 for beginners. */
export const FALL_PITCH = 0.78;
export const FALL_ROLL = 0.68;

/** Rank thresholds (finish time in seconds). */
export const RANK_THRESHOLDS = {
  legend: 25,
  king: 40,
  awakened: 60,
} as const;

/** 花花 drum tempo (BPM). */
export const DRUM_BPM = 108;

/** Half-window for Perfect plant timing (seconds). */
export const PERFECT_WINDOW = 0.1;

/** Extra forward impulse on a Perfect plant. */
export const BEAT_BONUS_IMPULSE = 0.28;

/** Combo speed bonus per stack; capped. */
export const COMBO_SPEED_PER = 0.022;
export const COMBO_SPEED_MAX = 0.16;
export const COMBO_CAP = 8;

/** Soft speed caps (m/s). */
export const SPEED_CAP_BASE = 3.15;
export const SPEED_CAP_COMBO = 3.75;

/** Renderer pixel-ratio caps for mid phones. */
export const PIXEL_RATIO_CAP = 1.5;
export const PIXEL_RATIO_REDUCED = 1.2;

/** Ghost path sample interval (seconds). */
export const GHOST_SAMPLE_DT = 0.1;

export const STORAGE_BEST_1P = 'lion-dance:best-time-1p-v2';
export const STORAGE_BEST_2P = 'lion-dance:best-time-2p-v2';
/** Legacy v1 key — migrated into 1P on read. */
export const STORAGE_BEST_LEGACY = 'lion-dance:best-time-v1';
export const STORAGE_GHOST_1P = 'lion-dance:ghost-1p-v2';
export const STORAGE_GHOST_2P = 'lion-dance:ghost-2p-v2';
export const STORAGE_LANG_KEY = 'lion-dance:lang-v1';
export const STORAGE_MUTE_KEY = 'lion-dance:mute-v1';
export const STORAGE_MODE_KEY = 'lion-dance:mode-v2';

export const GAME_PATH = '/Clubhouse-Games/Games/Lion-Dance/';

export type PlayMode = '1p' | '2p';
export type LegId = 'FL' | 'FR' | 'BL' | 'BR';

export const LEG_IDS: readonly LegId[] = ['FL', 'FR', 'BL', 'BR'];

export const FRONT_LEGS: readonly LegId[] = ['FL', 'FR'];
export const BACK_LEGS: readonly LegId[] = ['BL', 'BR'];

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

export function drumPeriod(): number {
  return 60 / DRUM_BPM;
}
