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
export const DROP_COOLDOWN_TICKS = 44; // ~0.73s: snappier drops while still blocking per-tick spam
export const MAX_COINS_ON_SHELF = 260;

/** Hex-grid spacing for the prefilled opening shelf (top-down plan view). */
export const INITIAL_SHELF_ROW_SPACING = COIN_R * 1.82;
export const INITIAL_SHELF_COL_SPACING = COIN_R * 1.88;
export const INITIAL_SHELF_Y0 = PUSHER_BACK_Y + PUSHER_THICK + COIN_R + 2;
export const INITIAL_SHELF_Y1 = SHELF_LEN - COIN_R - 6;
/** Idle physics ticks after grid placement so the pile settles before the player acts. */
export const INITIAL_SETTLE_TICKS = 200;

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
/**
 * The pot's trigger token is a slug, not a coin. It sits ahead of the plate's
 * reach, so it only moves on pressure from the pile behind it, and its weight
 * is what makes aiming at the pot cost throughput: drops spent shoving it
 * forward deliver fewer ordinary coins over the edge.
 *
 * At the original weight of 1, aiming at the pot was free — it fired reliably
 * AND returned as much as ignoring it, which is not a decision. Swept against
 * a pot-chasing pilot and a fixed-lane one over 16 seeds:
 *
 *   mass      1     2     4     7    11    16
 *   bursts  5.19  5.00  4.19  4.00  3.00  3.00
 *   cost   -0.6  +1.1  +3.8  +2.0  +7.3  +6.8  pp of RTP
 *
 * 11 still fires in every session while making the chase cost real work.
 */
export const TRIGGER_MASS = 11;

/** Coin value recovered when it falls off the front edge, independent of what it cost to buy. */
export const FALL_VALUE = 1;

// ── Cascade ────────────────────────────────────────────────────────────
export const CASCADE_MIN = 3;
/** Extra score per coin beyond CASCADE_MIN when a forward stroke finalises a cascade. */
export const CASCADE_BONUS_PER_EXTRA = 0.65;

/** Bonus score when a well-timed drop's coin falls off the edge. */
export const TIMING_BONUS = 1;
/** triangleWave must be at or below this for a drop to count as well-timed (plate at the back). */
export const TIMING_WAVE_MAX = 0.14;

/** Distance from a side wall shown as the high-risk edge lane in the UI. */
export const EDGE_MARGIN = 28;

// ── Jackpot ────────────────────────────────────────────────────────────
export const POT_BASE = 8;
/**
 * Fraction of every drop's cost that feeds the pot, and the counterweight to
 * TRIGGER_MASS: the mass sets what chasing the pot costs, this sets what it
 * pays. At the original 0.05 the whole session fed the pot 11 credits, far
 * less than the ~16 that chasing it costs — so the pot was a trap, dominated
 * rather than dominant, which is the same defect wearing the other sign.
 *
 * Swept at mass 11, as the RTP margin of chasing over ignoring:
 *
 *   cut     0.05   0.10   0.16   0.22   0.30
 *   margin  -7.3   -4.6   -1.4   +1.8   +6.1  pp
 *
 * 0.16 is the crossing point, where the two policies return the same on
 * average and differ only in shape. Across four independent 16-seed sets the
 * margin there ran -4.9 / -1.0 / +1.4 / +3.8 pp — noise around zero, which is
 * what parity looks like, and why the self-check asserts a two-sided band on
 * that margin rather than its sign.
 */
export const POT_CUT_RATE = 0.16;
/** Trigger-zone half-width; a new trigger token's x is drawn within this band of the shelf's usable width. */
export const TRIGGER_ZONE_MARGIN = 0.16;

// ── Vibrate / shake ────────────────────────────────────────────────────
export const SHAKE_JITTER = COIN_R * 0.9;

// ── Contact model ──────────────────────────────────────────────────────
//
// Two numbers, both of which exist because of the same measurement.
//
// Dropping every coin at one fixed x produced a *perfectly rigid column*:
// 50 seeds returned byte-identical results, lateral spread was sd 0.00, and
// 209 of 220 coins came back — a 97.73% return, at every lane, centre
// included. Coins sharing an x to the last bit have a separation vector of
// (0, dy), so the contact normal is exactly vertical and the pair is pushed
// apart purely along y, forever. The column becomes a one-dimensional
// conveyor where each coin in ejects exactly one coin out.
//
// It is a measure-zero coincidence that a player hits constantly, because
// not moving the chute is the easiest thing to do. Perturbing the drop by
// one thousandth of a unit collapsed the same run from 97.73% to 15.68%.
//
// SPAWN_JITTER breaks that symmetry the way a real chute's slop does, so a
// perfect column cannot form. It is applied from a hash of (tick, coin id),
// not an RNG stream, so replays stay bit-identical.
export const SPAWN_JITTER = COIN_R * 0.22;

// Symmetry-breaking alone overshoots. With contacts resolved as pure position
// separation, the horizontal correction is applied in full — coins slide
// sideways with no resistance at all — so one nudge propagates undamped and
// the pile fans out flat across the whole board, dropping the return to ~17%
// because the plate's push dissipates sideways instead of travelling forward.
// Real coins resist sliding on the shelf; nothing resists being shoved
// forward.
//
// This is the fraction of a contact's *horizontal* correction that actually
// moves the pair. 1 is the frictionless original; 0 means coins never slide
// sideways at all, which just rebuilds the rigid column by another route.
// Swept against the three fixed lanes (8 seeds, 95% intervals):
//
//   slide   left    centre  right   random   pile sd
//   0.00    88.1    90.8    88.1    44.6      1.1   <- still a column
//   0.06    74.6    72.2    75.2    12.3     28.2
//   0.12    65.3    57.1    65.5    10.9     38.3
//   0.24    55.5    41.4    54.6     5.8     49.0
//   0.50    42.3    23.7    42.3     3.1     64.1
//   1.00    32.5    12.4    32.5     0.3     75.6   <- frictionless, fans flat
//
// 0.06 is the only setting where the three deliberate lanes land within each
// other's confidence intervals rather than one of them dominating, and where
// the pile is a heap (sd 28-38) rather than a column or a flat fan.
export const LATERAL_SLIDE = 0.06;

// ── Run length ─────────────────────────────────────────────────────────
export const STARTING_CREDITS = 220;
/** How long (ticks) the run keeps simulating after the last credit is spent, so a final cascade can still land. */
export const SETTLE_GRACE_TICKS = 240; // 4s

/** Safety bound on a single step() call's internal work; the balance/self-check harnesses assert this is never approached. */
export const MAX_TICKS_PER_RUN = 60 * 60 * 20; // 20 minutes of ticks is far more than any real session
