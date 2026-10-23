/** Track length in metres (world X). */
export const TRACK_LENGTH = 50;

/** Run time limit in seconds. */
export const TIME_LIMIT = 90;

/** Physics fixed timestep (180 Hz). */
export const FIXED_DT = 1 / 180;
export const MAX_FRAME_DT = 0.05;

/** Hip height — raised so slender jointed legs stay fully visible under the cloth. */
export const BODY_HEIGHT = 2.9;
/** Draped cloth length (~2.55× head width) — two-performer 醒獅 silhouette. */
export const BODY_LENGTH = 6.5;
export const BODY_WIDTH = 1.2;
export const LEG_LENGTH = 2.4;

/**
 * Fall thresholds — much stricter than v2 so button-mashing fails.
 * Beginner assist multiplies these by ASSIST_FALL_SCALE.
 */
export const FALL_PITCH = 0.48;
export const FALL_ROLL = 0.42;
export const ASSIST_FALL_SCALE = 1.45;

export const RANK_THRESHOLDS = {
  legend: 25,
  king: 40,
  awakened: 60,
} as const;

/** Drum tempo (BPM). */
export const DRUM_BPM = 108;
export const PERFECT_WINDOW = 0.1;

/** Modest beat bonus — must not trivialise hard physics. */
export const BEAT_BONUS_IMPULSE = 0.12;
export const COMBO_SPEED_PER = 0.012;
export const COMBO_SPEED_MAX = 0.08;
export const COMBO_CAP = 8;

/** Soft speed caps (m/s) — master floor ~50/2.2 ≈ 23s with clean gait. */
export const SPEED_CAP_BASE = 1.65;
export const SPEED_CAP_COMBO = 2.15;

export const PIXEL_RATIO_CAP = 1.5;
export const PIXEL_RATIO_REDUCED = 1.2;
export const GHOST_SAMPLE_DT = 0.1;

/** Seconds of flop / flail before run ends if player does not get up. */
export const FALL_GRACE = 4.0;

export const STORAGE_BEST_1P = 'lion-dance:best-time-1p-v2';
export const STORAGE_BEST_2P = 'lion-dance:best-time-2p-v2';
export const STORAGE_BEST_LEGACY = 'lion-dance:best-time-v1';
export const STORAGE_GHOST_1P = 'lion-dance:ghost-1p-v2';
export const STORAGE_GHOST_2P = 'lion-dance:ghost-2p-v2';
export const STORAGE_LANG_KEY = 'lion-dance:lang-v1';
export const STORAGE_MUTE_KEY = 'lion-dance:mute-v1';
export const STORAGE_MODE_KEY = 'lion-dance:mode-v2';
export const STORAGE_ASSIST_KEY = 'lion-dance:assist-v3';

export const GAME_PATH = '/Clubhouse-Games/Games/Lion-Dance/';

export type PlayMode = '1p' | '2p';
export type LegId = 'FL' | 'FR' | 'BL' | 'BR';

export const LEG_IDS: readonly LegId[] = ['FL', 'FR', 'BL', 'BR'];
export const FRONT_LEGS: readonly LegId[] = ['FL', 'FR'];
export const BACK_LEGS: readonly LegId[] = ['BL', 'BR'];

/** Distinct anklet colours matching on-screen buttons. */
export const LEG_COLOR: Record<LegId, number> = {
  FL: 0xf97316, // orange — Q
  FR: 0x22c55e, // green — W
  BL: 0x3b82f6, // blue — O
  BR: 0xec4899, // pink — P
};

export const LEG_COLOR_CSS: Record<LegId, string> = {
  FL: '#f97316',
  FR: '#22c55e',
  BL: '#3b82f6',
  BR: '#ec4899',
};

export const LEG_KEY_LABEL: Record<LegId, string> = {
  FL: 'Q',
  FR: 'W',
  BL: 'O',
  BR: 'P',
};

/** Hip attachment in body-local space (x forward, y up, z right / toward camera). */
export const LEG_ATTACH: Record<LegId, { x: number; z: number }> = {
  // Under the front / rear cloth humps — classic 2-person lion silhouette.
  FL: { x: 2.15, z: -0.6 },
  FR: { x: 2.15, z: 0.64 },
  BL: { x: -2.15, z: -0.6 },
  BR: { x: -2.15, z: 0.64 },
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
