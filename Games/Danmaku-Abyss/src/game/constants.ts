/**
 * Pure constants and shapes. No DOM anywhere under src/game/, so the headless
 * self-check and balance scripts can import all of it.
 */

/** Play field in abstract units. The renderer scales this to the canvas. */
export const FIELD_W = 400;
export const FIELD_H = 600;

export const FIXED_DT = 1 / 60;

/**
 * The player's hitbox is far smaller than the ship graphic. This is the single
 * number that makes dense patterns fair rather than cruel, and focus mode
 * exists to show it.
 */
export const BASE_HITBOX_R = 3.2;

export const FAST_SPEED = 260; // units/sec
export const FOCUS_SPEED = 105;

/** Radius within which a passing bullet counts as a graze. */
export const BASE_GRAZE_R = 26;

export const STAGE_COUNT = 5;

/**
 * Seconds of midway pressure before each stage's boss arrives.
 *
 * Sized against the target run length rather than by feel: at 42s the harness
 * measured a full five-stage run at 566s (9.4 min), well under the 15-20 minute
 * shape this game is meant to have.
 */
export const MIDWAY_SEC = 68;
export const START_LIVES = 3;
export const START_BOMBS = 3;
export const MAX_POWER_TIER = 4;

/**
 * Seconds a scattered power fragment spends inert before it can be picked up.
 *
 * Without this, dying costs no power at all: the fragments spawn at the spot
 * you died, you respawn at the bottom centre, and if you happened to die
 * anywhere near there you re-absorb them on the very same tick. The self-check
 * caught exactly that — a death from the starting position left the power tier
 * unchanged. The arming delay is what turns "your power scattered" into the
 * decision the design is built on: the fragments drift up and away, and going
 * back into the pattern for them is a real risk.
 */
export const FRAGMENT_ARM_SEC = 0.9;

/** Seconds of invulnerability after a death, and after a bomb goes off. */
export const RESPAWN_INVULN_SEC = 2.2;
export const BOMB_INVULN_SEC = 1.6;

/**
 * Damage falls off with range and graze builds faster up close, so the best
 * place to stand is the most dangerous one. These two curves are the game.
 */
export const DAMAGE_NEAR_MULT = 2.2;
export const DAMAGE_FAR_MULT = 0.55;
/** Distance (units) at which damage has fallen all the way to DAMAGE_FAR_MULT. */
export const DAMAGE_FALLOFF_RANGE = 380;

/**
 * A bomb clears the screen and buys mercy time — and that is ALL it does.
 *
 * The first version paid 12 points per cleared bullet, which sounds modest
 * until you notice a late card puts 240 bullets on screen: a bomb was worth
 * ~2,900 points on its own. The balance harness caught it immediately —
 * panicking beat never bombing by +0.75 stages AND +8,748 score, better on
 * both axes at once, which is the definition of a button that is always
 * correct rather than a decision.
 *
 * Now a bomb pays nothing and additionally zeroes the graze multiplier, so it
 * costs you the scoring engine you spent the whole stage building. It should
 * still beat dying — that is what it is for — but it can no longer be free.
 */
export const BOMB_CLEARS_GRAZE = true;
export const KILL_SCORE = 100;
export const CAPTURE_BONUS = 3000;
export const SCORE_PER_LIFE = 5000;
export const SCORE_PER_BOMB = 1500;

/** Graze multiplier: starts at 1, each graze adds this, decays toward 1 when you play safe. */
export const GRAZE_STEP = 0.004;
export const GRAZE_MAX_MULT = 4;
export const GRAZE_DECAY_PER_SEC = 0.12;

export type AimMode = 'fixed' | 'aimed' | 'rotating';
export type Waveform = 'linear' | 'spiral' | 'accel' | 'reverse';

/**
 * An emitter is parameters only — no per-pattern code. A spell card is a list
 * of these. Authoring a new pattern must never mean editing the engine, which
 * is the mistake that kept Roguelike-Snake's relic pool at 18 entries against
 * 15 picks per run: every relic was a bespoke engine branch, so nobody added
 * any, and two runs shared 72% of what they carried.
 */
export interface Emitter {
  /** Bullets per volley. */
  count: number;
  /** Total spread in radians across the volley. */
  spread: number;
  speed: number;
  /** Radians/sec added to the emitter's base angle between volleys. */
  angularVel: number;
  aim: AimMode;
  waveform: Waveform;
  /** Seconds between volleys. */
  interval: number;
  /** Seconds before this emitter starts firing, from the card's start. */
  delay: number;
  /** Bullet lifetime in seconds; bullets also die when they leave the field. */
  lifetime: number;
  bulletR: number;
  hue: number;
}

export interface SpellCard {
  id: string;
  name: string;
  /** Seconds the card runs before it times out on its own. */
  timeLimit: number;
  hp: number;
  emitters: Emitter[];
  /**
   * Extra emitters that switch on once the card's HP drops below a fraction.
   *
   * Without these a card is a loop: whatever it opens with is what it does for
   * thirty seconds, and the only thing that changes is your patience. A phase
   * turns the card into an arc — the pattern you solved stops being the whole
   * problem, and pushing damage becomes a decision rather than a formality,
   * because breaking a threshold is what makes it worse.
   */
  phases?: Array<{ belowHpFrac: number; emitters: Emitter[] }>;
}
