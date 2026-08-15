export const LANE_COUNT = 3;
export const LANE_WIDTH = 2.4;
export const ROAD_HALF_WIDTH = (LANE_COUNT * LANE_WIDTH) / 2;

export const BASE_SPEED = 28;
export const MAX_SPEED = 68;
export const SPEED_RAMP_PER_METER = 0.04;
export const BOOST_SPEED = 18;
export const BOOST_DURATION = 1.35;

export type RushDifficulty = 'chill' | 'normal' | 'rush';

export const RUSH_DIFFICULTIES: RushDifficulty[] = ['chill', 'normal', 'rush'];

export const RUSH_DIFFICULTY_LABELS: Record<RushDifficulty, string> = {
  chill: '悠閒',
  normal: '標準',
  rush: '狂飆',
};

/** Speed / spawn tuning relative to the normal baseline. */
export const RUSH_TUNING: Record<
  RushDifficulty,
  { speedMul: number; gapMul: number; maxSpeedMul: number }
> = {
  chill: { speedMul: 0.78, gapMul: 1.28, maxSpeedMul: 0.85 },
  normal: { speedMul: 1, gapMul: 1, maxSpeedMul: 1 },
  rush: { speedMul: 1.22, gapMul: 0.78, maxSpeedMul: 1.12 },
};

export const BESTS_KEY = 'cyber-neon-rush:bests-v2';
/** Legacy single-best keys (migrated into `normal`). */
export const BEST_SCORE_KEY = 'cyber-neon-rush:best-score';
export const BEST_DISTANCE_KEY = 'cyber-neon-rush:best-distance';
/** First-run tip dismissed — do not show again. */
export const TIP_SEEN_KEY = 'cyber-neon-rush:tip-seen';

/** High-stiffness spring for snappy lane changes. */
export const LANE_SPRING = 160;
export const LANE_DAMPING = 18;

export const TRACK_SEGMENT_LENGTH = 8;
export const TRACK_AHEAD = 220;
export const TRACK_BEHIND = 40;

export const OBSTACLE_SPAWN_AHEAD = 180;
export const OBSTACLE_DESPAWN_BEHIND = 12;
export const OBSTACLE_MIN_GAP = 12;
export const OBSTACLE_MAX_GAP = 26;

/** Adjacent-lane pass counts as near-miss (lane spacing is LANE_WIDTH). */
export const NEAR_MISS_WINDOW = 2.85;
export const PERFECT_MISS_WINDOW = 1.55;
export const NEAR_MISS_SCORE = 100;
export const PERFECT_MISS_SCORE = 220;
export const BOOST_SCORE = 180;
export const DISTANCE_SCORE_PER_M = 2.5;

/** Combo fades if no near-miss / pickup within this many seconds. */
export const COMBO_DECAY_SEC = 3.2;
export const FEVER_COMBO = 5;

export const CAMERA_FOLLOW = 10;
export const CAMERA_LOOK_AHEAD = 16;
/** Higher chase cam so the road clearly fills the lower frame. */
export const CAMERA_HEIGHT = 7.2;
export const CAMERA_BACK = 11;
export const CAMERA_LOOK_Y = 0.6;
export const CAMERA_SWAY_GAIN = 0.45;
export const CAMERA_ROLL_GAIN = 0.12;

/** Opening stretch uses single-lane obstacles only (meters along track). */
export const EARLY_SAFE_Z = 130;
/** First obstacle appears after this many meters. */
export const FIRST_OBSTACLE_Z = 72;

/**
 * Lane 0 = screen-left, lane 2 = screen-right.
 * +Z chase cams in Three.js map world +X to screen-left (local +X = world -X),
 * so left lanes must use positive X.
 */
export function laneToX(lane: number): number {
  return (1 - lane) * LANE_WIDTH;
}

export function clampLane(lane: number): number {
  return Math.max(0, Math.min(LANE_COUNT - 1, lane));
}
