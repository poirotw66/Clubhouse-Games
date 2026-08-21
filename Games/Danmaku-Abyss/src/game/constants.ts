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

/**
 * Graze multiplier: starts at 1, each graze adds GRAZE_STEP, and it bleeds back
 * toward 1 at GRAZE_DECAY_PER_SEC while you play safe.
 *
 * The break-even graze rate is DECAY / STEP. The first numbers here were
 * 0.004 and 0.12, which puts break-even at THIRTY GRAZES PER SECOND — the
 * harness measures real play at 0.74/sec, so the multiplier was pinned at 1.00
 * for the entire length of every run that has ever been played.
 *
 * That silently deleted half the game. The whole design rests on two curves
 * pushing you forward — damage rises as you close, and the graze multiplier
 * rises as you close — and the second one never moved. Score was never
 * multiplied, and the two upgrades keyed to a high multiplier could never
 * activate under any circumstances.
 *
 * These put break-even at 0.8 grazes/sec, just above the 0.74 a careful pilot
 * manages, so hanging back bleeds the multiplier and pushing in builds it.
 */
export const GRAZE_STEP = 0.05;
export const GRAZE_MAX_MULT = 4;
export const GRAZE_DECAY_PER_SEC = 0.04;

export type AimMode = 'fixed' | 'aimed' | 'rotating';

/**
 * How a volley is laid out.
 *
 * 'radial' fires from the emitter outward — every pattern in the first version
 * was one of these, and they all fill space without denying it. The balance
 * harness showed why that matters: raising density stopped working as a
 * difficulty lever entirely, because the build scales with the danger. More
 * bullets means more grazes, a higher multiplier, the graze-keyed upgrades
 * firing, and cards dying sooner — so extra danger partly cancels itself.
 *
 * 'wall' spans the field with a single gap. You cannot out-damage a wall that
 * is already on screen and no amount of fire rate widens the gap, so it applies
 * pressure the feedback loop cannot absorb. It also asks a different question:
 * not "can you react" but "are you already in the right place".
 */
export type VolleyPattern = 'radial' | 'wall';
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
  /**
   * How far a 'fixed' volley's base angle is rotated from straight-down toward
   * the ship, 0..1. Never authored — scaleEmitter() derives it from the run's
   * intensity. See FIXED_HOMING_AT_MAX.
   */
  homing?: number;
  /** Defaults to 'radial' when omitted. */
  pattern?: VolleyPattern;
  /** Wall only: how many bullet slots are left open. Wider is kinder. */
  gap?: number;
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

/**
 * How far a plain 'fixed' volley leans toward the ship at the very top of the
 * intensity range. Emitters authored as 'aimed' are unaffected; this is only
 * about what happens to the straight-down sprays as a run escalates.
 *
 * This replaces a boolean:
 *
 *   aim: e.aim === 'fixed' && k > 2.4 && e.count % 2 === 1 ? 'aimed' : e.aim
 *
 * which had two problems, both of which showed up as a difficulty anomaly at
 * stage 3 that took a while to name.
 *
 * First, `k > 2.4` is a step, inside a function whose whole job is to produce a
 * slope. Intensity runs 1.00 / 1.85 / 2.70 / 3.55 / 4.40 by stage (plus 0.35
 * for a boss), so the switch lands *between stage 2 and stage 3* and nowhere
 * else. Every fixed spray in the game went from ignoring the player to homing
 * on them, all at once, at exactly one stage boundary.
 *
 * Second, `e.count % 2 === 1` selects on the parity of the authored bullet
 * count — 8 of the 21 fixed emitters are odd and convert, 13 are even and never
 * do. Whether a ring chases you depends on whether it was written with 13
 * bullets or 14, which is not a difficulty dimension; it means adding one
 * bullet to a pattern silently removes its homing.
 *
 * Swept against per-stage survival (24 seeds; the intervals are ±11-20pp, so
 * these are shapes, not precise values):
 *
 *   lean     s1   s2   s3   s4   s5
 *   boolean  92   92   46   79   54   <- the old switch
 *   0.15     92   92   58   92   46
 *   0.28     92   83   75   88   50   <- this
 *   0.40     92   96   92   83   67
 *   0.46      -    -    -   67    -
 *   0.52      -    -    -   17    -
 *   0.55      -    -   92    8   54
 *
 * Stage 4 is smooth from 0.15 to 0.46 and then falls off a cliff, entirely
 * onto ember-1 (60% -> 94% -> 93% of that stage's deaths). I could not explain
 * that cliff: ember-1's only fixed emitter is a full 2*PI ring, whose coverage
 * should be invariant under exactly this rotation. 0.28 sits well inside the
 * smooth region, but the cliff is real and unexplained rather than absent.
 */
export const FIXED_HOMING_AT_MAX = 0.28;

/** Intensity at which FIXED_HOMING_AT_MAX is reached; the ramp is linear from 1. */
export const FIXED_HOMING_FULL_K = 4.75;

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
