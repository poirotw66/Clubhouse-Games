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
 *
 * Table themes supply a frozen TablePhysics snapshot on the run config so
 * pegs / pusher rhythm / jackpot rules stay deterministic per run.
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
  MAGNET_MASS,
  MAGNET_PULL_RADIUS,
  MAGNET_PULL_STRENGTH,
  MAGNET_RADIUS_MULT,
  MAX_COINS_ON_SHELF,
  NEAR_MISS_OVERHANG,
  NORMAL_MASS,
  PUSHER_PERIOD_TICKS,
  PUSHER_STROKE,
  PUSHER_BACK_Y,
  PUSHER_X0,
  PUSHER_X1,
  SETTLE_GRACE_TICKS,
  SHAKE_JITTER,
  SHELF_LEN,
  SOLVER_ITERATIONS,
  SPAWN_Y,
  STARTING_CREDITS,
  TIMING_BONUS,
  TIMING_WAVE_MAX,
  TRIGGER_MASS,
  TRIGGER_ZONE_MARGIN,
  WALL_X0,
  WALL_X1,
  FIXED_DT,
  INITIAL_SETTLE_TICKS,
  INITIAL_SHELF_COL_SPACING,
  INITIAL_SHELF_ROW_SPACING,
  INITIAL_SHELF_Y0,
  INITIAL_SHELF_Y1,
} from './constants';
import { hashString, streamRng } from './rng';
import { defaultTableId, tablePhysics, type TableId, type TablePhysics } from './tables';
import type {
  Coin,
  CoinKind,
  FallEvent,
  PlayerInput,
  RunConfig,
  RunState,
  TickEvents,
} from './types';

/** Options accepted by createRun for free play, tables, daily, and challenge modes. */
export interface CreateRunOptions {
  startingCredits?: number;
  /**
   * Playable tick budget after the opening settle. Converted into an absolute
   * `config.deadlineTick` once settle finishes. Null / omitted = unlimited.
   */
  timeLimitTicks?: number | null;
  modeId?: string | null;
  clearScore?: number | null;
  clearCascade?: number | null;
  tableId?: TableId;
  isDaily?: boolean;
}

const NO_EVENTS: TickEvents = {
  fallen: [],
  cascadeFinalized: 0,
  jackpotBurst: 0,
  shook: false,
  rejectedDrop: false,
  timingBonuses: 0,
  jackpotTideBonus: false,
};

// ── Pure geometry helpers (also used by rendering) ─────────────────────────

export function coinRadius(kind: CoinKind): number {
  if (kind === 'heavy') return COIN_R * HEAVY_RADIUS_MULT;
  if (kind === 'ball') return COIN_R * BALL_RADIUS_MULT;
  if (kind === 'magnet') return COIN_R * MAGNET_RADIUS_MULT;
  return COIN_R;
}

export function coinMass(kind: CoinKind, physics?: TablePhysics): number {
  if (kind === 'heavy') return HEAVY_MASS;
  if (kind === 'ball') return BALL_MASS;
  if (kind === 'magnet') return MAGNET_MASS;
  if (kind === 'trigger') return physics?.triggerMass ?? TRIGGER_MASS;
  return NORMAL_MASS;
}

/** Triangle wave in [0, 1] with the given period (defaults to classic). */
export function triangleWave(tick: number, periodTicks: number = PUSHER_PERIOD_TICKS): number {
  const period = Math.max(2, periodTicks);
  const t = ((tick % period) + period) % period;
  const half = period / 2;
  return t < half ? t / half : 2 - t / half;
}

/** The pusher's front-face y for a given tick — pure in tick + physics. */
export function pusherFrontY(tick: number, physics?: TablePhysics): number {
  const back = physics?.pusherBackY ?? PUSHER_BACK_Y;
  const stroke = physics?.pusherStroke ?? PUSHER_STROKE;
  const period = physics?.pusherPeriodTicks ?? PUSHER_PERIOD_TICKS;
  return back + stroke * triangleWave(tick, period);
}

/** +1 while the plate advances toward the front edge, -1 while it retreats. */
export function pusherDirection(tick: number, physics?: TablePhysics): 1 | -1 {
  const period = physics?.pusherPeriodTicks ?? PUSHER_PERIOD_TICKS;
  return triangleWave(tick + 1, period) >= triangleWave(tick, period) ? 1 : -1;
}

/** Whether a drop at this tick lands while the plate sits at the back. */
export function isWellTimedDrop(tick: number, physics?: TablePhysics): boolean {
  const period = physics?.pusherPeriodTicks ?? PUSHER_PERIOD_TICKS;
  return triangleWave(tick, period) <= TIMING_WAVE_MAX;
}

/** UI hint tier for the current point in the pusher cycle. */
export function dropTimingQuality(tick: number, physics?: TablePhysics): 'perfect' | 'good' | 'late' {
  const period = physics?.pusherPeriodTicks ?? PUSHER_PERIOD_TICKS;
  const wave = triangleWave(tick, period);
  if (wave <= TIMING_WAVE_MAX) return 'perfect';
  if (wave <= 0.42) return 'good';
  return 'late';
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

const IDLE_INPUT: PlayerInput = { dropX: (WALL_X0 + WALL_X1) / 2, drop: false, special: 'normal' };

/** Deterministic hex grid that fills the shelf like a real coin-pusher tray. */
function buildInitialShelf(
  seed: number,
  triggerZoneX: number,
  physics: TablePhysics,
): Coin[] {
  const r = streamRng(seed, 'initial-shelf');
  const coins: Coin[] = [];
  let id = 1;
  const triggerY = SHELF_LEN * 0.52;

  coins.push({
    id: id++,
    kind: 'trigger',
    x: triggerZoneX,
    y: triggerY,
    teeterSince: -1,
  });

  let row = 0;
  for (let y = INITIAL_SHELF_Y0; y <= INITIAL_SHELF_Y1; y += INITIAL_SHELF_ROW_SPACING) {
    const stagger = (row % 2) * (INITIAL_SHELF_COL_SPACING * 0.5);
    for (let x = WALL_X0 + COIN_R + stagger; x <= WALL_X1 - COIN_R; x += INITIAL_SHELF_COL_SPACING) {
      const jx = (r() - 0.5) * physics.spawnJitter * 1.6;
      const jy = (r() - 0.5) * physics.spawnJitter * 0.8;
      const cx = x + jx;
      const cy = y + jy;
      const dx = cx - triggerZoneX;
      const dy = cy - triggerY;
      if (dx * dx + dy * dy < (COIN_R * 3.2) ** 2) continue;
      // Keep opening coins clear of pegs so the tray does not spawn overlapping nails.
      let onPeg = false;
      for (const peg of physics.pegs) {
        const pdx = cx - peg.x;
        const pdy = cy - peg.y;
        if (pdx * pdx + pdy * pdy < (peg.r + COIN_R * 1.2) ** 2) {
          onPeg = true;
          break;
        }
      }
      if (onPeg) continue;
      coins.push({ id: id++, kind: 'normal', x: cx, y: cy, teeterSince: -1, prefilled: true });
    }
    row += 1;
  }
  return coins;
}

function emptyRunState(
  seedCode: string,
  seed: number,
  triggerZoneX: number,
  coins: Coin[],
  config: RunConfig,
): RunState {
  const nextCoinId = coins.reduce((max, c) => Math.max(max, c.id), 0) + 1;
  return {
    seed,
    seedCode,
    tick: 0,
    phase: 'playing',
    config,
    modeId: config.modeId,
    tableId: config.tableId,
    coins,
    nextCoinId,
    cooldown: 0,
    ticksSinceLastDrop: 0,
    creditsRemaining: config.startingCredits,
    creditsSpent: 0,
    coinsRecovered: 0,
    score: 0,
    pot: config.physics.potBase,
    triggerZoneX,
    jackpotBursts: 0,
    potAwarded: 0,
    cascadeCount: 0,
    longestCascade: 0,
    nearMissCount: 0,
    shakesUsed: 0,
    timingBonusCount: 0,
    strokeFallen: 0,
    strokeWasForward: true,
    events: NO_EVENTS,
  };
}

export function createRun(seedCode: string, options: CreateRunOptions = {}): RunState {
  const seed = hashString(seedCode);
  const tableId = options.tableId ?? defaultTableId();
  const physics = tablePhysics(tableId);
  const triggerZoneX = triggerZoneXFor(seed, 0);
  const initialCoins = buildInitialShelf(seed, triggerZoneX, physics);
  const startingCredits = options.startingCredits ?? STARTING_CREDITS;
  const provisional: RunConfig = {
    startingCredits,
    deadlineTick: null,
    modeId: options.modeId ?? null,
    clearScore: options.clearScore ?? null,
    clearCascade: options.clearCascade ?? null,
    tableId,
    physics,
    isDaily: options.isDaily ?? false,
  };
  let state = emptyRunState(seedCode, seed, triggerZoneX, initialCoins, provisional);

  for (let i = 0; i < INITIAL_SETTLE_TICKS; i++) {
    state = step(state, IDLE_INPUT, FIXED_DT);
  }

  const timeBudget = options.timeLimitTicks;
  const deadlineTick =
    timeBudget != null && timeBudget > 0 ? state.tick + timeBudget : null;
  const config: RunConfig = { ...provisional, deadlineTick };
  return { ...state, config, modeId: config.modeId, tableId: config.tableId, events: NO_EVENTS };
}

/** True when the run should stop accepting drops and begin settling out. */
export function isWindingDown(state: RunState): boolean {
  if (state.creditsRemaining <= 0) return true;
  if (state.config.deadlineTick !== null && state.tick >= state.config.deadlineTick) return true;
  if (state.config.clearScore !== null && state.score >= state.config.clearScore) return true;
  if (state.config.clearCascade !== null && state.longestCascade >= state.config.clearCascade) {
    return true;
  }
  return false;
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
  wellTimed: boolean;
  prefilled: boolean;
}

function clampWalls(w: Working): void {
  const lo = WALL_X0 - (COIN_R - w.r);
  const hi = WALL_X1 + (COIN_R - w.r);
  if (w.x < lo) w.x = lo;
  if (w.x > hi) w.x = hi;
  if (w.y < w.r) w.y = w.r;
}

function resolvePusher(w: Working, frontY: number, thick: number): void {
  const backY = frontY - thick;
  const overlapsX = w.x + w.r > PUSHER_X0 && w.x - w.r < PUSHER_X1;
  const overlapsY = w.y + w.r > backY && w.y - w.r < frontY;
  if (!overlapsX || !overlapsY) return;
  w.y = frontY + w.r;
}

/** Separate every overlapping coin pair, walked in ascending-id order. */
function resolvePairs(list: Working[], lateralSlide: number): void {
  for (let i = 0; i < list.length; i++) {
    const a = list[i]!;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j]!;
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
      const fx = nx * lateralSlide;
      a.x -= fx * aShare;
      a.y -= ny * aShare;
      b.x += fx * bShare;
      b.y += ny * bShare;
    }
  }
}

/** Push coins out of static pegs (table obstacles). Pegs are immovable. */
function resolvePegs(list: Working[], physics: TablePhysics): void {
  if (physics.pegs.length === 0) return;
  for (const w of list) {
    for (const peg of physics.pegs) {
      const dx = w.x - peg.x;
      const dy = w.y - peg.y;
      const minDist = w.r + peg.r;
      const distSq = dx * dx + dy * dy;
      if (distSq >= minDist * minDist) continue;
      if (distSq < 1e-12) {
        // Degenerate: shove forward along +y so resolution stays deterministic.
        w.y = peg.y + minDist;
        continue;
      }
      const dist = Math.sqrt(distSq);
      const overlap = minDist - dist;
      const nx = dx / dist;
      const ny = dy / dist;
      w.x += nx * overlap;
      w.y += ny * overlap;
    }
  }
}

/** Magnet pull: tug nearby coins toward each magnet coin (once per drop tick). */
function applyMagnetPull(list: Working[], magnetId: number): void {
  const magnet = list.find((w) => w.id === magnetId);
  if (!magnet) return;
  for (const w of list) {
    if (w.id === magnetId) continue;
    const dx = magnet.x - w.x;
    const dy = magnet.y - w.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1e-6 || dist > MAGNET_PULL_RADIUS) continue;
    const pull = MAGNET_PULL_STRENGTH * (1 - dist / MAGNET_PULL_RADIUS);
    const invMass = 1 / (w.mass + magnet.mass);
    w.x += dx * pull * (magnet.mass * invMass);
    w.y += dy * pull * (magnet.mass * invMass);
  }
}

// ── Step ─────────────────────────────────────────────────────────────────

export function step(state: RunState, input: PlayerInput, _dt: number): RunState {
  const tick = state.tick + 1;
  const physics = state.config.physics;

  const work: Working[] = state.coins.map((c) => ({
    id: c.id,
    kind: c.kind,
    x: c.x,
    y: c.y,
    r: coinRadius(c.kind),
    mass: coinMass(c.kind, physics),
    teeterSince: c.teeterSince,
    wellTimed: c.wellTimed ?? false,
    prefilled: c.prefilled ?? false,
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
  let magnetJustDroppedId = -1;

  if (state.phase === 'playing' && input.drop) {
    const closedForDrops =
      (state.config.deadlineTick !== null && state.tick >= state.config.deadlineTick) ||
      (state.config.clearScore !== null && state.score >= state.config.clearScore) ||
      (state.config.clearCascade !== null && state.longestCascade >= state.config.clearCascade);

    if (closedForDrops) {
      rejectedDrop = true;
    } else {
      const special = COST[input.special] > creditsRemaining ? 'normal' : input.special;
      const cost = COST[special];
      if (cooldown > 0 || cost > creditsRemaining || work.length >= MAX_COINS_ON_SHELF) {
        rejectedDrop = true;
      } else if (special === 'vibrate') {
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
        const slop =
          ((hashString(`slop:${tick}:${nextCoinId}`) % 2001) / 1000 - 1) * physics.spawnJitter;
        const x = Math.min(
          WALL_X1 - (COIN_R - r),
          Math.max(WALL_X0 - (COIN_R - r), input.dropX + slop),
        );
        const newId = nextCoinId;
        work.push({
          id: newId,
          kind,
          x,
          y: SPAWN_Y,
          r,
          mass: coinMass(kind, physics),
          teeterSince: -1,
          wellTimed: isWellTimedDrop(state.tick, physics),
          prefilled: false,
        });
        nextCoinId += 1;
        creditsSpent += cost;
        creditsRemaining -= cost;
        potGrewBy += cost * physics.potCutRate;
        cooldown = DROP_COOLDOWN_TICKS;
        ticksSinceLastDrop = 0;
        if (kind === 'magnet') magnetJustDroppedId = newId;
      }
    }
  }

  if (magnetJustDroppedId >= 0) {
    applyMagnetPull(work, magnetJustDroppedId);
  }

  const frontY = pusherFrontY(tick, physics);
  const thick = physics.pusherThick;

  for (const w of work) w.y += physics.slopePerTick;

  const sorted = work.slice().sort((a, b) => a.id - b.id);
  for (let iter = 0; iter < SOLVER_ITERATIONS; iter++) {
    resolvePairs(sorted, physics.lateralSlide);
    resolvePegs(sorted, physics);
    for (const w of sorted) clampWalls(w);
    for (const w of sorted) resolvePusher(w, frontY, thick);
  }

  const remaining: Working[] = [];
  const fallen: FallEvent[] = [];
  for (const w of sorted) {
    if (w.y > SHELF_LEN) {
      fallen.push({
        coinId: w.id,
        kind: w.kind,
        x: w.x,
        timingBonus: w.wellTimed,
        prefilled: w.prefilled,
      });
    } else remaining.push(w);
  }

  let score = state.score;
  let coinsRecovered = state.coinsRecovered;
  let jackpotBurst = 0;
  let jackpotTideBonus = false;
  let timingBonuses = 0;

  // Count non-trigger falls this tick for cascade_bonus jackpot rule.
  const companionFalls = fallen.filter((f) => f.kind !== 'trigger').length;
  // Stroke companions already fallen this forward stroke (before this tick's tally).
  const strokeCompanionsSoFar = state.strokeWasForward ? state.strokeFallen : 0;

  for (const f of fallen) {
    if (f.kind === 'trigger') {
      let payout = pot;
      if (
        physics.jackpotRule === 'cascade_bonus' &&
        companionFalls + strokeCompanionsSoFar >= 2
      ) {
        payout = pot * 1.5;
        jackpotTideBonus = true;
      }
      jackpotBurst += payout;
      score += payout;
      potAwarded += payout;
      jackpotBursts += 1;
      pot = physics.potBase;
      potGrewBy = 0;
      triggerZoneX = triggerZoneXFor(state.seed, jackpotBursts);
      pendingTrigger = {
        id: nextCoinId,
        kind: 'trigger',
        x: triggerZoneX,
        y: SHELF_LEN * 0.3,
        r: coinRadius('trigger'),
        mass: coinMass('trigger', physics),
        teeterSince: -1,
        wellTimed: false,
        prefilled: false,
      };
      nextCoinId += 1;
    } else {
      coinsRecovered += 1;
      if (!f.prefilled) {
        score += FALL_VALUE;
        if (f.timingBonus) {
          score += TIMING_BONUS;
          timingBonuses += 1;
        }
      }
    }
  }

  const tickWasForward = pusherDirection(state.tick, physics) === 1;
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

  let nearMissCount = state.nearMissCount;
  let timingBonusCount = state.timingBonusCount + timingBonuses;
  const coins: Coin[] = remaining.map((w) => {
    const teetering = isTeetering({
      id: w.id,
      kind: w.kind,
      x: w.x,
      y: w.y,
      teeterSince: w.teeterSince,
    });
    let teeterSince = w.teeterSince;
    if (teetering && teeterSince < 0) {
      teeterSince = tick;
      nearMissCount += 1;
    } else if (!teetering) {
      teeterSince = -1;
    }
    return {
      id: w.id,
      kind: w.kind,
      x: w.x,
      y: w.y,
      teeterSince,
      ...(w.wellTimed ? { wellTimed: true } : {}),
      ...(w.prefilled ? { prefilled: true } : {}),
    };
  });

  const events: TickEvents = {
    fallen,
    cascadeFinalized,
    jackpotBurst,
    shook,
    rejectedDrop,
    timingBonuses,
    jackpotTideBonus,
  };

  const goalMet =
    (state.config.clearScore !== null && score >= state.config.clearScore) ||
    (state.config.clearCascade !== null && longestCascade >= state.config.clearCascade);
  const timeUp = state.config.deadlineTick !== null && tick >= state.config.deadlineTick;
  const windDown = creditsRemaining <= 0 || goalMet || timeUp;

  const phase: RunState['phase'] =
    state.phase === 'ended' || (windDown && ticksSinceLastDrop >= SETTLE_GRACE_TICKS)
      ? 'ended'
      : 'playing';

  return {
    seed: state.seed,
    seedCode: state.seedCode,
    tick,
    phase,
    config: state.config,
    modeId: state.modeId,
    tableId: state.tableId,
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
    timingBonusCount,
    strokeFallen,
    strokeWasForward,
    events,
  };
}
