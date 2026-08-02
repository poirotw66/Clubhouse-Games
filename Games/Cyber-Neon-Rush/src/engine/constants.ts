export const LANE_COUNT = 3;
export const LANE_WIDTH = 2.4;
export const ROAD_HALF_WIDTH = (LANE_COUNT * LANE_WIDTH) / 2;

export const BASE_SPEED = 28;
export const MAX_SPEED = 62;
export const SPEED_RAMP_PER_METER = 0.035;

/** High-stiffness spring for snappy lane changes. */
export const LANE_SPRING = 140;
export const LANE_DAMPING = 18;

export const TRACK_SEGMENT_LENGTH = 8;
export const TRACK_AHEAD = 220;
export const TRACK_BEHIND = 40;

export const OBSTACLE_SPAWN_AHEAD = 180;
export const OBSTACLE_DESPAWN_BEHIND = 12;
export const OBSTACLE_MIN_GAP = 14;
export const OBSTACLE_MAX_GAP = 28;

/** Adjacent-lane pass counts as near-miss (lane spacing is LANE_WIDTH). */
export const NEAR_MISS_WINDOW = 2.85;
export const NEAR_MISS_SCORE = 120;
export const DISTANCE_SCORE_PER_M = 2.5;

export const CAMERA_FOLLOW = 10;
export const CAMERA_LOOK_AHEAD = 18;
export const CAMERA_HEIGHT = 4.2;
export const CAMERA_BACK = 9.5;
export const CAMERA_SWAY_GAIN = 0.55;
export const CAMERA_ROLL_GAIN = 0.22;

export const BEST_SCORE_KEY = 'cyber-neon-rush:best-score';
export const BEST_DISTANCE_KEY = 'cyber-neon-rush:best-distance';

export function laneToX(lane: number): number {
  return (lane - 1) * LANE_WIDTH;
}

export function clampLane(lane: number): number {
  return Math.max(0, Math.min(LANE_COUNT - 1, lane));
}
