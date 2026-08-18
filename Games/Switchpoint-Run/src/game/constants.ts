/**
 * Pure constants and shapes. No DOM anywhere under src/game/, so the headless
 * self-check and balance scripts can import all of it.
 */

/** Play field in abstract units; 1 unit == 1 canvas pixel at 1x scale. */
export const FIELD_W = 400;
export const FIELD_H = 600;

export const FIXED_DT = 1 / 60;

export const LANE_COUNT = 3;
export const LANE_WIDTH = FIELD_W / LANE_COUNT;
export function laneCenterX(lane: number): number {
  return LANE_WIDTH * (lane + 0.5);
}

/** The player's fixed screen row; world distance scrolls past this line. */
export const PLAYER_Y = FIELD_H - 100;

// ── Pace ─────────────────────────────────────────────────────────────────────
//
// Two independent curves, both rising with ELAPSED TIME, not distance: the
// player's own nominal pace (what a 'hold' branch gives you) and the train's
// pursuit pace. Their gap is the whole game. `逼近速度取決於你目前的速度` (the
// closing rate depends on your current speed) is realised as: the train
// follows its own relentless curve, and your ACTUAL speed — nominal pace
// times the branch multiplier times whatever a recent hit has cost you — is
// what gets compared against it every tick. Slow down (a bad branch, a missed
// jump) and the comparison flips negative; the train does not need to know
// why you slowed down.
//
// This used to ramp off DISTANCE instead, which reads as more natural from
// the spec's "隨距離推進，基礎速度上升" — but distance is itself produced by
// speed, so ramping speed off of it is a positive feedback loop: more speed
// makes more distance makes more speed. The balance harness caught it
// directly — an always-pick-fastest policy reached hundreds of thousands of
// distance units and a buffer that read 9,943 near the tail of a run, numbers
// with no relationship to anything a real few-minute run produces. Ramping
// off elapsed seconds instead keeps the exact same "continuous curve, not
// staged" feel while making pace a function of an input nothing here can
// accelerate.
// PLAYER_BASE_SPEED == TRAIN_BASE_SPEED on purpose: a 'hold' branch (mult 1.0)
// is then EXACTLY the train's own pace, so standing pat is neutral rather
// than safe. The first version set PLAYER_BASE_SPEED 22 units/sec above the
// train's, meaning simply never taking a risk was enough to win by default —
// the balance harness measured a "safest" (lowest-density) policy surviving
// past 1,100 seconds and 450,000 distance on an execution pilot that still
// makes mistakes 5% of the time. That is the opposite of "速度只能從危险的
// 分支拿": it made SAFETY free instead of making SPEED earned. With the gap
// closed, only 'accel' branches (density-taxed, per DENSITY_FLOOR) pay out a
// real surplus, and 'decel' branches are a real, compounding cost — matching
// "安全的支線速度會衰減" literally rather than approximately.
export const PLAYER_BASE_SPEED = 150; // units/sec at elapsed=0, on a 'hold' branch
export const TRAIN_BASE_SPEED = 150; // units/sec at elapsed=0
/** Both curves climb at the same rate, so the *shape* of the gap is set by
 * branch choice and execution, not by the difficulty ramp swallowing it. */
export const SPEED_RAMP_PER_SEC = 0.42;
/** The ramp stops climbing after this many seconds. A flawless 'accel'-only
 * pilot's surplus over the train is proportional to elapsed time (branch
 * multiplier times a growing base pace), so an uncapped ramp makes surplus
 * itself grow without bound the longer a run lasts — not exponential the way
 * the old distance-keyed ramp was, but still unbounded, and it is not a real
 * difficulty curve once the ramp has nothing left to compare against. Capping
 * it turns "gets harder forever" into "gets harder for the length of a real
 * run, then holds", which is what a few-minute session actually experiences. */
export const RAMP_CAP_SEC = 240;

function rampedElapsed(elapsed: number): number {
  return Math.min(elapsed, RAMP_CAP_SEC);
}
export function playerBasePace(elapsed: number): number {
  return PLAYER_BASE_SPEED + rampedElapsed(elapsed) * SPEED_RAMP_PER_SEC;
}
export function trainPace(elapsed: number): number {
  return TRAIN_BASE_SPEED + rampedElapsed(elapsed) * SPEED_RAMP_PER_SEC;
}

// ── Buffer ───────────────────────────────────────────────────────────────────

/** Starting gap to the train. 'hold' branches no longer carry a passive
 * surplus (see PLAYER_BASE_SPEED), so this cushion exists purely to absorb
 * the very first hit or two while the player is still reading the first
 * preview — see README for the measured buffer curve. */
export const START_BUFFER = 240;

// ── Obstacles & execution ───────────────────────────────────────────────────

export type ObstacleKind = 'hurdle' | 'beam' | 'wall';

export interface Obstacle {
  /** Offset from the branch's own start, in distance units. */
  offset: number;
  lane: number;
  kind: ObstacleKind;
}

export const JUMP_DURATION = 0.32; // sec; blocks lane changes and sliding
export const SLIDE_DURATION = 0.36; // sec; blocks lane changes and jumping
export const LANE_CHANGE_COOLDOWN = 0.1; // sec; keys can't be spammed into a stutter

/** A hit costs speed, not a life — the penalty routes entirely through the
 * buffer, per spec: no separate health bar. Sized to actually matter now that
 * 'hold' branches carry no passive surplus: a hit needs to visibly set a run
 * back, or density stops being a real cost and is just a cosmetic label on
 * the fast/rewarding branches. */
export const HIT_STUN_DURATION = 1.3;
export const HIT_STUN_MIN_MULT = 0.22; // speed multiplier at the instant of the hit
/** How obstacle offsets in the same lane must be spaced apart, so one hurdle's
 * jump has finished (or one wall's dodge has landed) before the next obstacle
 * in that lane needs a different answer. Enforced by a self-check. */
export const MIN_SAME_LANE_SPACING = 110;
/** Minimum offset before a branch's first obstacle, and margin before its end. */
export const MIN_LEAD_IN = 130;
export const MIN_TRAIL_OUT = 70;

// ── The junction / preview loop ─────────────────────────────────────────────

/** Distance from one junction's lock point to the next branch's own choice
 * point that follows it. Kept inside the template itself (BranchTemplate.length). */
export const APPROACH_LEN = 260; // preview-and-reposition distance before a lock
export const LEAD_IN_LEN = 360; // plain runway before the very first junction

// ── Reward payoffs ──────────────────────────────────────────────────────────

export const SUPPLY_BUFFER_GAIN = 190;
export const SCORE_MULT_STEP = 0.35;

// ── Scoring ──────────────────────────────────────────────────────────────────

export const ROUTE_SCORE_PER_BRANCH = 12;
/** Extra route score for finishing a branch with zero hits in it, scaled by
 * how much density it actually asked you to clear. This is what makes a risky
 * branch worth more than a safe one WHEN you pull it off — the density axis
 * pays for the speed/reward axes, and clean execution is what cashes it in. */
export const ROUTE_SCORE_PER_DENSITY_CLEAN = 6;
export const NO_HIT_BONUS_PER_STREAK = 4;

// ── Branch templates: the data-driven content ───────────────────────────────

export type SpeedTier = 'decel' | 'hold' | 'accel';
export type RewardKind = 'none' | 'supply' | 'score';

export const SPEED_MULT: Record<SpeedTier, number> = {
  decel: 0.84,
  hold: 1.0,
  accel: 1.1,
};

/**
 * The minimum obstacle count ("density") a template of a given speed tier must
 * carry, and the extra density a reward on top of that must additionally pay
 * for. This is the numeric form of the spec's central rule — "任何提高速度或
 * 給予收益的支線，密度必須同步提高" — and it is what the self-check enforces
 * per template, rather than trusting authors to eyeball it.
 */
export const DENSITY_FLOOR: Record<SpeedTier, number> = {
  decel: 1,
  hold: 3,
  accel: 9,
};
export const REWARD_DENSITY_TAX: Record<RewardKind, number> = {
  none: 0,
  supply: 2,
  score: 3,
};

export function densityFloor(speed: SpeedTier, reward: RewardKind): number {
  return DENSITY_FLOOR[speed] + REWARD_DENSITY_TAX[reward];
}

export interface BranchTemplate {
  id: string;
  name: string;
  speed: SpeedTier;
  reward: RewardKind;
  /** Where along the branch the reward is collected, if any (ignored for 'none'). */
  rewardOffset: number;
  /** Distance units this branch spans, from its lock point to its own end. */
  length: number;
  obstacles: Obstacle[];
  /** Distance the run must reach before this template can be offered. Higher
   * unlock tiers are how the pool "opens up higher-order entries" as the spec
   * asks for, without touching engine code. */
  unlockDistance: number;
}
