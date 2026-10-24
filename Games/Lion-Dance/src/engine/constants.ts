/** Track length in metres (world X). */
export const TRACK_LENGTH = 50;

/** Run time limit in seconds. */
export const TIME_LIMIT = 90;

/**
 * Uniform world scale for the vermilion lion mesh + physics.
 * Art proportions stay identical; world units shrink so 50 m ≈ 10 lion lengths.
 */
export const LION_SCALE = 0.5;

/** Physics fixed timestep (240 Hz). */
export const FIXED_DT = 1 / 240;
export const MAX_FRAME_DT = 0.1;

/** Gravity (m/s²). */
export const GRAVITY = 9.8;

/**
 * Physics hip height (world). Equal stick legs so 4 springs balance gravity at rest:
 * 4·K·(L − y0) = g  ⇒  y0 = L − g/(4K).
 * Mesh still uses design proportions via root.scale = LION_SCALE.
 */
export const LEG_LEN_FRONT = 1.2;
export const LEG_LEN_HIND = 1.2;
export const LEG_LENGTH = 1.2;
export const BODY_HEIGHT = LEG_LENGTH;
/** Draped cloth length — two-performer 醒獅 silhouette (design × scale). */
export const BODY_LENGTH = 6.5 * LION_SCALE;
export const BODY_WIDTH = 1.2 * LION_SCALE;

/** Hip swing targets / rates (rad, rad/s). */
export const A_FWD = 0.62;
export const A_BACK = 0;
export const SWING_RATE = 6.5;
export const PUSH_RATE = 4.2;
export const RETURN_RATE = 5.0;
export const LIFT_SHORTEN = 0.34;
export const LIFT_RATE = 10;

/** Ground spring-damper (per unit mass). */
export const SPRING_K = 70;
export const SPRING_C = 9;
export const TRACTION = 9;
export const SLIDE = 2.4;
export const AIR_DRAG = 0.12;

/** Attitude inertias (scaled for longer lion body / wider track). */
export const I_PITCH = 1.1;
export const I_ROLL = 0.75;
export const TIP_ROLL = 12;
export const TIP_PITCH = 4;
/**
 * Diagonal 2-support righting — strong enough that a clean swap rhythm
 * almost never tips (same-side still has no righting and falls fast).
 */
export const BAL2 = 72;
export const BALANCE = 90;
export const BAL4 = 70;
export const ANG_DAMP = 2.6;
export const REAR_COUPLE = 0.6;
export const LEG_I = 0.02;
/** COM offset behind body origin (lever uses hip.x − COM_X). */
export const COM_X = 0.1;

/** Fall / tipping thresholds (rad). Assist boosts righting, not these. */
export const FALL_ROLL = 0.6;
export const FALL_PITCH = 0.62;
export const WARN_ROLL = 0.32;
export const WARN_PITCH = 0.4;
export const ASSIST_RIGHTING = 1.25;
export const FALL_ROLL_CLAMP = 1.45;
export const FALL_PITCH_CLAMP = 0.55;
export const GET_UP_DURATION = 0.35;

/** Rank thresholds after continuous-traction retune (≈ 3 diagonal swaps/s). */
export const RANK_THRESHOLDS = {
  legend: 22,
  king: 32,
  awakened: 50,
} as const;

/** Drum tempo (BPM). */
export const DRUM_BPM = 108;
export const PERFECT_WINDOW = 0.1;

/**
 * Perfect combo strengthens traction (not a velocity impulse).
 * Mul = 1 + min(TRACTION_COMBO_MAX, combo * TRACTION_COMBO_PER).
 */
export const TRACTION_COMBO_PER = 0.05;
export const TRACTION_COMBO_MAX = 0.4;
export const COMBO_CAP = 8;

/** Legacy aliases kept for beat.ts / check-beat twin values. */
export const BEAT_BONUS_IMPULSE = 0;
export const COMBO_SPEED_PER = TRACTION_COMBO_PER;
export const COMBO_SPEED_MAX = TRACTION_COMBO_MAX;

export const PIXEL_RATIO_CAP = 1.5;
export const PIXEL_RATIO_REDUCED = 1.2;
export const GHOST_SAMPLE_DT = 0.1;

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

/**
 * Anklet / button colours follow the key letter (Q orange, W green, O blue, P pink).
 * Key map (lion faces +X, camera on +Z): Q/W = rear (screen-left), O/P = front (screen-right).
 */
export const LEG_COLOR: Record<LegId, number> = {
  BL: 0xe66900, // Q orange — rear far
  BR: 0x00b04d, // W green — rear near
  FL: 0xe356a2, // O pink — front far
  FR: 0x2e91ff, // P blue — front near
};

export const LEG_COLOR_CSS: Record<LegId, string> = {
  BL: '#e66900',
  BR: '#00b04d',
  FL: '#e356a2',
  FR: '#2e91ff',
};

export const LEG_KEY_LABEL: Record<LegId, string> = {
  BL: 'Q',
  BR: 'W',
  FL: 'O',
  FR: 'P',
};

/** Hip attachment in body-local metres (physics / world after LION_SCALE). */
export const LEG_ATTACH: Record<LegId, { x: number; z: number }> = {
  FL: { x: 2.15 * LION_SCALE, z: -0.62 * LION_SCALE },
  FR: { x: 2.15 * LION_SCALE, z: 0.62 * LION_SCALE },
  BL: { x: -2.15 * LION_SCALE, z: -0.62 * LION_SCALE },
  BR: { x: -2.15 * LION_SCALE, z: 0.62 * LION_SCALE },
};

/** Mesh-local hip attach (design units before root.scale = LION_SCALE). */
export const LEG_ATTACH_MESH: Record<LegId, { x: number; z: number }> = {
  FL: { x: 2.15, z: -0.6 },
  FR: { x: 2.15, z: 0.64 },
  BL: { x: -2.15, z: -0.6 },
  BR: { x: -2.15, z: 0.64 },
};

export function legLength(id: LegId): number {
  return id === 'FL' || id === 'FR' ? LEG_LEN_FRONT : LEG_LEN_HIND;
}

/** Q/W = hind, O/P = front (matches on-screen left→right pad). */
export const KEY_TO_LEG: Record<string, LegId> = {
  q: 'BL',
  w: 'BR',
  o: 'FL',
  p: 'FR',
};

/** Touch-pad order left→right: Q W O P. */
export const PAD_ORDER_1P: readonly LegId[] = ['BL', 'BR', 'FL', 'FR'];
export const PAD_ORDER_HEAD: readonly LegId[] = ['FL', 'FR']; // O P — front
export const PAD_ORDER_TAIL: readonly LegId[] = ['BL', 'BR']; // Q W — rear

export function drumPeriod(): number {
  return 60 / DRUM_BPM;
}

export function restBodyHeight(): number {
  return BODY_HEIGHT - GRAVITY / (4 * SPRING_K);
}
