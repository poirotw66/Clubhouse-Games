/**
 * Coin Cascade physics + rules. A run is a pure function of (seed, input
 * sequence): step() never touches Math.random, never mutates its arguments,
 * and always walks coins/contacts in the same order (ascending id), so the
 * same seed and the same inputs reproduce a bit-identical run. See
 * scripts/self-check.ts §1 for the check that actually proves this.
 *
 * Model: top-down plan view of the shelf. y=0 is the back wall behind the
 * chute; y=SHELF_LEN is the front edge — an open exit, not a wall, which is
 * what makes the "shelf cannot lock up forever" guarantee structural rather
 * than tuned (see SLOPE_PER_TICK's doc comment in constants.ts). The pusher
 * is a solid rectangle whose front face is a pure function of tick count. All
 * collision resolution is position-based (no velocities): each tick applies
 * a small forward creep, then runs a fixed number of solver iterations that
 * push overlapping coins apart, push coins out of the pusher and off the
 * walls, in a fixed order.
 */
import {
  BALL_MASS,
  BALL_RADIUS_MULT,
  CASCADE_BONUS_PER_EXTRA,
  CASCADE_MIN,
  COIN_R,
  COST,
  DROP_COOLDOWN_TICKS,
  FALL_VALUE,
  HEAVY_MASS,
  HEAVY_RADIUS_MULT,
  MAX_COINS_ON_SHELF,
  NEAR_MISS_OVERHANG,
  NORMAL_MASS,
  POT_BASE,
  POT_CUT_RATE,
  PUSHER_BACK_Y,
  PUSHER_PERIOD_TICKS,
  PUSHER_STROKE,
  PUSHER_THICK,
  PUSHER_X0,
  PUSHER_X1,
  SETTLE_GRACE_TICKS,
  SHAKE_JITTER,
  SHELF_LEN,
  SLOPE_PER_TICK,
  SOLVER_ITERATIONS,
  SPAWN_Y,
  STARTING_CREDITS,
  TRIGGER_MASS,
  TRIGGER_ZONE_MARGIN,
  WALL_X0,
  WALL_X1,
} from './constants';
import { hashString, streamRng } from './rng';
import type { Coin, CoinKind, FallEvent, PlayerInput, RunState, TickEvents } from './types';

const NO_EVENTS: TickEvents = { fallen: [], cascadeFinalized: 0, jackpotBurst: 0, shook: false, rejectedDrop: false };

// ── Pure geometry helpers (also used by rendering) ─────────────────────────

export function coinRadius(kind: CoinKind): number {
  if (kind === 'heavy') return COIN_R * HEAVY_RADIUS_MULT;
  if (kind === 'ball') return COIN_R * BALL_RADIUS_MULT;
  return COIN_R;
}

export function coinMass(kind: CoinKind): number {
  if (kind === 'heavy') return HEAVY_MASS;
  if (kind === 'ball') return BALL_MASS;
  if (kind === 'trigger') return TRIGGER_MASS;
  return NORMAL_MASS;
}

/** Triangle wave in [0, 1] with period `PUSHER_PERIOD_TICKS`, pure in tick count. */
export function triangleWave(tick: number): number {
  const t = ((tick % PUSHER_PERIOD_TICKS) + PUSHER_PERIOD_TICKS) % PUSHER_PERIOD_TICKS;
  const half = PUSHER_PERIOD_TICKS / 2;
  return t < half ? t / half : 2 - t / half;
}

/** The pusher's front-face y for a given tick — a pure function of tick count, never of wall-clock time. */
export function pusherFrontY(tick: number): number {
  return PUSHER_BACK_Y + PUSHER_STROKE * triangleWave(tick);
}

/** +1 while the plate advances toward the front edge, -1 while it retreats. */
export function pusherDirection(tick: number): 1 | -1 {
  return triangleWave(tick + 1) >= triangleWave(tick) ? 1 : -1;
}

export function isTeetering(coin: Coin): boolean {
  const r = coinRadius(coin.kind);
  return coin.y <= SHELF_LEN && coin.y + r - SHELF_LEN >= NEAR_MISS_OVERHANG;
}

// ── Run setup ────────────────────────────────────────────────────────────

function triggerZoneXFor(seed: number, burstIndex: number): number {
  const r = streamRng(seed, `trigger:${burstIndex}`);
  const lo = WALL_X0 + (WALL_X1 - WALL_X0) * TRIGGER_ZONE_MARGIN;
  const hi = WALL_X1 - (WALL_X1 - WALL_X0) * TRIGGER_ZONE_MARGIN;
  return lo + r() * (hi - lo);
}

export function createRun(seedCode: string): RunState {
  const seed = hashString(seedCode);
  const triggerZoneX = triggerZoneXFor(seed, 0);
  const trigger: Coin = {
    id: 1,
    kind: 'trigger',
    x: triggerZoneX,
    y: SHELF_LEN * 0.3,
    teeterSince: -1,
  };

  return {
    seed,
    seedCode,
    tick: 0,
    phase: 'playing',
    coins: [trigger],
    nextCoinId: 2,
    cooldown: 0,
    ticksSinceLastDrop: 0,
    creditsRemaining: STARTING_CREDITS,
    creditsSpent: 0,
    coinsRecovered: 0,
    score: 0,
    pot: POT_BASE,
    triggerZoneX,
    jackpotBursts: 0,
    potAwarded: 0,
    cascadeCount: 0,
    longestCascade: 0,
    nearMissCount: 0,
    shakesUsed: 0,
    strokeFallen: 0,
    strokeWasForward: true, // the run starts at the trough, about to move forward
    events: NO_EVENTS,
  };
}

// ── Solver internals ────────────────────────────────────────────────────

interface Working {
  id: number;
  kind: CoinKind;
  x: number;
  y: number;
  r: number;
  mass: number;
  teeterSince: number;
}

function clampWalls(w: Working): void {
  const lo = WALL_X0 - (COIN_R - w.r); // keep each kind's own edge flush with the same physical wall
  const hi = WALL_X1 + (COIN_R - w.r);
  if (w.x < lo) w.x = lo;
  if (w.x > hi) w.x = hi;
  if (w.y < w.r) w.y = w.r;
}

/**
 * Push `w` out through the pusher's FRONT face whenever it overlaps the
 * plate. The plate spans the full shelf width wall-to-wall, so there is never
 * a left/right exit in practice, and it deliberately never ejects a coin out
 * the *back* either: a plate is a one-way mechanism (it shoves forward; it
 * has no way to eject something behind itself), and an earlier version of
 * this function that did resolve to whichever face was nearer let the
 * vibrate action's jitter shove a coin a hair behind the plate — at which
 * point, since the plate spans the full width at every phase of its stroke,
 * that coin could never pass it again. Always resolving to the front makes
 * that failure mode structurally impossible instead of merely unlikely.
 */
function resolvePusher(w: Working, frontY: number): void {
  const backY = frontY - PUSHER_THICK;
  const overlapsX = w.x + w.r > PUSHER_X0 && w.x - w.r < PUSHER_X1;
  const overlapsY = w.y + w.r > backY && w.y - w.r < frontY;
  if (!overlapsX || !overlapsY) return;
  w.y = frontY + w.r;
}

/** Separate every overlapping coin pair, walked in a fixed ascending-id order so resolution never depends on array layout. */
function resolvePairs(list: Working[]): void {
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const minDist = a.r + b.r;
      const distSq = dx * dx + dy * dy;
      if (distSq >= minDist * minDist || distSq < 1e-12) continue;
      const dist = Math.sqrt(distSq);
      const overlap = minDist - dist;
      const nx = dx / dist;
      const ny = dy / dist;
      const totalMass = a.mass + b.mass;
      const aShare = (b.mass / totalMass) * overlap;
      const bShare = (a.mass / totalMass) * overlap;
      a.x -= nx * aShare;
      a.y -= ny * aShare;
      b.x += nx * bShare;
      b.y += ny * bShare;
    }
  }
}

// ── Step ─────────────────────────────────────────────────────────────────

export function step(state: RunState, input: PlayerInput, _dt: number): RunState {
  const tick = state.tick + 1;

  // Fresh working copies — step() must never mutate the coins it was given.
  const work: Working[] = state.coins.map((c) => ({
    id: c.id,
    kind: c.kind,
    x: c.x,
    y: c.y,
    r: coinRadius(c.kind),
    mass: coinMass(c.kind),
    teeterSince: c.teeterSince,
  }));

  let cooldown = Math.max(0, state.cooldown - 1);
  let creditsRemaining = state.creditsRemaining;
  let creditsSpent = state.creditsSpent;
  let nextCoinId = state.nextCoinId;
  let pot = state.pot;
  let triggerZoneX = state.triggerZoneX;
  let jackpotBursts = state.jackpotBursts;
  let potAwarded = state.potAwarded;
  let shakesUsed = state.shakesUsed;
  let ticksSinceLastDrop = state.ticksSinceLastDrop + 1;
  let rejectedDrop = false;
  let shook = false;
  let potGrewBy = 0;
  let pendingTrigger: Working | null = null;

  if (state.phase === 'playing' && input.drop) {
    // A run's only exit is credits reaching zero, so every affordable drop has
    // to be able to *spend*. Left as a plain rejection, a special selected with
    // too few credits left to buy it soft-locks the machine: 1 credit remaining
    // with 震動 (3) held down rejects forever, credits never reach zero, and the
    // run can never end — no result screen, no restart. Observed in the browser:
    // 2,425 drops over 306s all rejected, stuck at 1 credit.
    //
    // So an unaffordable selection falls back to the cheapest coin instead of
    // being refused. Your last credit always buys something, which makes
    // termination a property of the engine rather than of the pilot driving it.
    // The UI mirrors this by reverting the selection as soon as it stops being
    // affordable, so the fallback is visible before you press drop, never a
    // silent substitution.
    const special = COST[input.special] > creditsRemaining ? 'normal' : input.special;
    const cost = COST[special];
    if (cooldown > 0 || cost > creditsRemaining || work.length >= MAX_COINS_ON_SHELF) {
      rejectedDrop = true;
    } else if (special === 'vibrate') {
      // Shake: a deterministic hash of (tick, coin id) stands in for randomness,
      // so the jolt is reproducible without any RNG stream needing to be
      // threaded through state. Side jitter is symmetric — it can knock down a
      // wall you built — while the forward component is one-sided, nudging
      // everything a little closer to the open edge.
      for (const w of work) {
        const hx = hashString(`shake:${tick}:${w.id}:x`);
        const hy = hashString(`shake:${tick}:${w.id}:y`);
        w.x += ((hx % 2001) / 1000 - 1) * SHAKE_JITTER;
        w.y += ((hy % 1000) / 1000) * SHAKE_JITTER;
      }
      creditsSpent += cost;
      creditsRemaining -= cost;
      shakesUsed += 1;
      shook = true;
      cooldown = DROP_COOLDOWN_TICKS;
      ticksSinceLastDrop = 0;
    } else {
      const kind: CoinKind = special;
      const r = coinRadius(kind);
      const x = Math.min(WALL_X1 - (COIN_R - r), Math.max(WALL_X0 - (COIN_R - r), input.dropX));
      work.push({ id: nextCoinId, kind, x, y: SPAWN_Y, r, mass: coinMass(kind), teeterSince: -1 });
      nextCoinId += 1;
      creditsSpent += cost;
      creditsRemaining -= cost;
      potGrewBy += cost * POT_CUT_RATE;
      cooldown = DROP_COOLDOWN_TICKS;
      ticksSinceLastDrop = 0;
    }
  }

  const frontY = pusherFrontY(tick);

  // Forward creep, applied before the solver so it participates in this
  // tick's overlap resolution rather than silently displacing coins into
  // each other with nothing to catch it.
  for (const w of work) w.y += SLOPE_PER_TICK;

  const sorted = work.slice().sort((a, b) => a.id - b.id);
  // Each iteration ends by re-resolving the pusher: resolvePairs or
  // clampWalls can shove a coin back into the plate's footprint after an
  // earlier resolvePusher pass in the same iteration, and without a pusher
  // pass at the very end of the very last iteration that overlap survives
  // into the returned state — which is exactly the "tunnelled through the
  // pusher" bug the self-check caught here during development.
  for (let iter = 0; iter < SOLVER_ITERATIONS; iter++) {
    resolvePairs(sorted);
    for (const w of sorted) clampWalls(w);
    for (const w of sorted) resolvePusher(w, frontY);
  }

  // Fallen: centre past the open front edge. Walked in id order for a
  // deterministic FallEvent list regardless of solver internals.
  const remaining: Working[] = [];
  const fallen: FallEvent[] = [];
  for (const w of sorted) {
    if (w.y > SHELF_LEN) fallen.push({ coinId: w.id, kind: w.kind, x: w.x });
    else remaining.push(w);
  }

  let score = state.score;
  let coinsRecovered = state.coinsRecovered;
  let jackpotBurst = 0;
  for (const f of fallen) {
    if (f.kind === 'trigger') {
      jackpotBurst += pot;
      score += pot;
      potAwarded += pot;
      jackpotBursts += 1;
      pot = POT_BASE;
      potGrewBy = 0;
      triggerZoneX = triggerZoneXFor(state.seed, jackpotBursts);
      pendingTrigger = {
        id: nextCoinId,
        kind: 'trigger',
        x: triggerZoneX,
        y: SHELF_LEN * 0.3,
        r: coinRadius('trigger'),
        mass: coinMass('trigger'),
        teeterSince: -1,
      };
      nextCoinId += 1;
    } else {
      score += FALL_VALUE;
      coinsRecovered += 1;
    }
  }

  // A cascade is scored per push-stroke, not per tick — see the field doc on
  // RunState.strokeFallen. `state.tick` is the motion that produced this
  // tick's pusher position, so its direction says whether THIS tick's falls
  // belong to a forward stroke.
  const tickWasForward = pusherDirection(state.tick) === 1;
  let cascadeCount = state.cascadeCount;
  let longestCascade = state.longestCascade;
  let cascadeFinalized = 0;
  let strokeFallen: number;
  let strokeWasForward = tickWasForward;

  if (tickWasForward) {
    strokeFallen = (state.strokeWasForward ? state.strokeFallen : 0) + fallen.length;
  } else {
    if (state.strokeWasForward) {
      const total = state.strokeFallen + fallen.length;
      if (total >= CASCADE_MIN) {
        score += (total - (CASCADE_MIN - 1)) * CASCADE_BONUS_PER_EXTRA;
        cascadeCount += 1;
        longestCascade = Math.max(longestCascade, total);
        cascadeFinalized = total;
      }
    }
    strokeFallen = 0;
  }

  pot += potGrewBy;

  if (pendingTrigger) remaining.push(pendingTrigger);

  // Near-miss: count only the transition into teetering, not every tick it
  // holds, or a coin sitting on the lip for two seconds would inflate the
  // stat far past what "near-miss events" should mean.
  let nearMissCount = state.nearMissCount;
  const coins: Coin[] = remaining.map((w) => {
    const teetering = isTeetering({ id: w.id, kind: w.kind, x: w.x, y: w.y, teeterSince: w.teeterSince });
    let teeterSince = w.teeterSince;
    if (teetering && teeterSince < 0) {
      teeterSince = tick;
      nearMissCount += 1;
    } else if (!teetering) {
      teeterSince = -1;
    }
    return { id: w.id, kind: w.kind, x: w.x, y: w.y, teeterSince };
  });

  const events: TickEvents = { fallen, cascadeFinalized, jackpotBurst, shook, rejectedDrop };

  const phase: RunState['phase'] =
    state.phase === 'ended' || (creditsRemaining <= 0 && ticksSinceLastDrop >= SETTLE_GRACE_TICKS)
      ? 'ended'
      : 'playing';

  return {
    seed: state.seed,
    seedCode: state.seedCode,
    tick,
    phase,
    coins,
    nextCoinId,
    cooldown,
    ticksSinceLastDrop,
    creditsRemaining,
    creditsSpent,
    coinsRecovered,
    score,
    pot,
    triggerZoneX,
    jackpotBursts,
    potAwarded,
    cascadeCount,
    longestCascade,
    nearMissCount,
    shakesUsed,
    strokeFallen,
    strokeWasForward,
    events,
  };
}
