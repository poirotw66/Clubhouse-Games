/**
 * All the numbers the physics and the balance harness share. Nothing here may
 * read Math.random — see rng.ts and self-check.ts's RNG-hygiene check.
 */

export const FIXED_DT = 1 / 60;

// ── Shelf geometry (top-down plan view) ───────────────────────────────────
// y=0 is the back wall the chute drops behind; y=SHELF_LEN is the front edge.
// A coin whose centre crosses SHELF_LEN has tipped past the point of no
// return and is removed as "fallen" the same tick.
export const SHELF_W = 420;
export const SHELF_LEN = 320;
export const COIN_R = 11;
export const WALL_X0 = COIN_R;
export const WALL_X1 = SHELF_W - COIN_R;


/** A coin overhanging by more than this fraction of its radius is flagged as teetering (the near-miss highlight). */
export const NEAR_MISS_OVERHANG = COIN_R * 0.35;

// ── Pusher ──────────────────────────────────────────────────────────────
// The plate is a solid rectangle spanning the full interior width. Its front
// face oscillates between PUSHER_BACK_Y and PUSHER_BACK_Y + PUSHER_STROKE on
// a triangle wave with period PUSHER_PERIOD_TICKS, so its position is a pure
// function of tick count alone — never of elapsed wall-clock time.
// The stroke is deliberately short relative to SHELF_LEN: the plate's direct
// reach only covers the back of the shelf (56 to 56+STROKE). A coin resting
// beyond that can only advance by chain contact from coins piling in behind
// it, or by SLOPE_PER_TICK's slow creep — which is what makes "coins that
// don't fall become terrain" a real property of the physics and not just
// flavour text. An earlier tuning pass used a stroke long enough to carry a
// single dropped coin most of the way to the edge in two or three strokes
// regardless of what else was on the shelf, which measured RTP over 100%
// (nothing was ever really at risk of staying unrecovered) — see the README.
export const PUSHER_BACK_Y = 40;
export const PUSHER_STROKE = 46;
export const PUSHER_THICK = 16;
export const PUSHER_PERIOD_TICKS = 150; // 2.5s at 60fps
export const PUSHER_X0 = 0;
export const PUSHER_X1 = SHELF_W;

/**
 * Per-tick forward creep applied to every resting coin, representing the
 * shelf's slight forward tilt. This is what stops a jam-packed back row from
 * becoming truly permanent: a coin with nothing ahead of it always has an
 * open exit (the front edge is not a wall), so it will eventually cross
 * SHELF_LEN on its own even if the pusher never reaches it again. Kept small
 * so the pusher — not gravity — remains the primary way coins move.
 */
export const SLOPE_PER_TICK = 0.01;

// ── Solver ──────────────────────────────────────────────────────────────
// Fixed iteration count, fixed order (coins are always walked in ascending
// id — see resolvePairs in engine.ts) so the same seed and inputs converge on
// the same resting positions bit-for-bit every time.
export const SOLVER_ITERATIONS = 8;

// ── Spawn / drop economy ───────────────────────────────────────────────
//
// A dropped coin lands right at the pusher's retracted front face, not back
// near the chute wall — this is the landing tray a real coin pusher's plate
// sweeps through. An earlier version spawned coins near the back wall (y=0)
// instead, which sat 20+ units behind the plate's entire reachable range: a
// lone coin there was never touched by the plate at all and crawled forward
// only via SLOPE_PER_TICK, taking the better part of a minute to so much as
// make contact. Landing here means a coin dropped just as the plate starts a
// forward stroke rides the *entire* stroke — the "推板後退時投＝吃滿整個推程"
// timing decision the spec calls out only exists because of this placement.
export const SPAWN_Y = PUSHER_BACK_Y;
export const DROP_COOLDOWN_TICKS = 50; // ~0.83s: enough that spamming drops every tick is not possible
export const MAX_COINS_ON_SHELF = 260;

export const COST: Record<'normal' | 'heavy' | 'ball' | 'vibrate', number> = {
  normal: 1,
  heavy: 2,
  ball: 2,
  vibrate: 3,
};

/**
 * The cheapest thing a credit can buy. A plain coin costs exactly this, which
 * is what lets the run's only exit condition (credits reaching zero) always be
 * reachable: see the affordability fallback in step().
 */
export const MIN_COST = Math.min(...Object.values(COST));

export const HEAVY_RADIUS_MULT = 1.16;
export const HEAVY_MASS = 2.4;
export const BALL_RADIUS_MULT = 0.82;
export const BALL_MASS = 0.55;
export const NORMAL_MASS = 1;
export const TRIGGER_MASS = 1;

/** Coin value recovered when it falls off the front edge, independent of what it cost to buy. */
export const FALL_VALUE = 1;

// ── Cascade ────────────────────────────────────────────────────────────
export const CASCADE_MIN = 3;
export const CASCADE_BONUS_PER_EXTRA = 0.5;

// ── Jackpot ────────────────────────────────────────────────────────────
export const POT_BASE = 8;
export const POT_CUT_RATE = 0.05;
/** Trigger-zone half-width; a new trigger token's x is drawn within this band of the shelf's usable width. */
export const TRIGGER_ZONE_MARGIN = 0.16;

// ── Vibrate / shake ────────────────────────────────────────────────────
export const SHAKE_JITTER = COIN_R * 0.9;

// ── Run length ─────────────────────────────────────────────────────────
export const STARTING_CREDITS = 220;
/** How long (ticks) the run keeps simulating after the last credit is spent, so a final cascade can still land. */
export const SETTLE_GRACE_TICKS = 240; // 4s

/** Safety bound on a single step() call's internal work; the balance/self-check harnesses assert this is never approached. */
export const MAX_TICKS_PER_RUN = 60 * 60 * 20; // 20 minutes of ticks is far more than any real session
