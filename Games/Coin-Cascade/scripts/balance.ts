/**
 * Balance measurement. Not pass/fail — it prints numbers.
 *
 * The four things the spec commits to measuring:
 *   1. RTP (return-to-player), guarded in both directions;
 *   2. no drop lane (left/centre/right/random) is strictly best;
 *   3. the shelf does not lock up over long play;
 *   4. cascade and near-miss rates, i.e. whether the dopamine mechanics
 *      actually fire often enough in a real session to matter.
 *
 * Every rate is reported with a 95% confidence interval, not just a point
 * estimate — this repo has twice mistaken a handful of seeds' noise for a
 * mechanism (see the interval note below), so the interval is printed
 * alongside every number here, not left as something to compute by hand.
 */
import { CASCADE_MIN, FIXED_DT, MAX_COINS_ON_SHELF, STARTING_CREDITS, WALL_X0, WALL_X1 } from '../src/game/constants.js';
import { createRun, step } from '../src/game/engine.js';
import { mulberry32 } from '../src/game/rng.js';
import type { PlayerInput, RunState } from '../src/game/types.js';

// ── Confidence intervals ───────────────────────────────────────────────────

/** Mean plus a rough 95% interval (1.96 standard errors), for continuous measures. */
function meanCI(xs: number[]): { mean: number; halfWidth: number; n: number } {
  const n = xs.length;
  const mean = xs.reduce((a, b) => a + b, 0) / Math.max(1, n);
  const variance = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, n - 1);
  const halfWidth = 1.96 * Math.sqrt(variance / Math.max(1, n));
  return { mean, halfWidth, n };
}

/** A rate (successes/n) plus its rough 95% Wald interval, in percentage points. */
function rateCI(successes: number, n: number): { pct: number; halfWidthPp: number; n: number } {
  const p = n > 0 ? successes / n : 0;
  const halfWidthPp = 1.96 * Math.sqrt((p * (1 - p)) / Math.max(1, n)) * 100;
  return { pct: p * 100, halfWidthPp, n };
}

function fmtRate(r: { pct: number; halfWidthPp: number; n: number }): string {
  return `${r.pct.toFixed(1).padStart(5)}% ± ${r.halfWidthPp.toFixed(1)}pp  (n=${r.n})`;
}

function fmtMean(m: { mean: number; halfWidth: number; n: number }, digits = 3): string {
  return `${m.mean.toFixed(digits)} ± ${m.halfWidth.toFixed(digits)}  (n=${m.n})`;
}

// ── Seeds ────────────────────────────────────────────────────────────────
//
// Eight seeds carries a roughly ±34pp interval on a rate near 50% — nowhere
// near enough to compare strategies or stages. RTP is measured over full
// sessions (hundreds of drops each) pooled across many seeds so the credit
// count backing each percentage is in the thousands, and the printed
// interval is the actual arbiter of "is this different" — not eyeballing
// two point estimates.
function seeds(prefix: string, count: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) out.push(`${prefix}${String(i).padStart(4, '0')}`);
  return out;
}

// ── Pilots ──────────────────────────────────────────────────────────────
//
// These are deliberately simple, mechanical policies — not an attempt at a
// skilled player. RTP measured against a dumb, fixed-lane pilot is a
// property of the machine; that is the entire point of measuring it this
// way instead of hand-waving a number.

type Lane = 'left' | 'centre' | 'right' | 'random';

function laneX(lane: Lane, r: () => number): number {
  const margin = 22;
  switch (lane) {
    case 'left':
      return WALL_X0 + margin;
    case 'right':
      return WALL_X1 - margin;
    case 'centre':
      return (WALL_X0 + WALL_X1) / 2;
    case 'random':
      return WALL_X0 + r() * (WALL_X1 - WALL_X0);
  }
}

interface SessionResult {
  score: number;
  creditsSpent: number;
  coinsRecovered: number;
  jackpotBursts: number;
  potAwarded: number;
  cascadeCount: number;
  longestCascade: number;
  nearMissCount: number;
  ticks: number;
  fallRateLastQuarter: number; // coins recovered per 1000 ticks, over the final quarter of the run
}

/** Plays one full session with a fixed lane, occasionally spending on a heavy/ball coin to exercise the specials too. */
function playSession(seedCode: string, lane: Lane, specialRate = 0.12): SessionResult {
  let s = createRun(seedCode);
  const r = mulberry32((s.seed ^ 0x9e3779b9) >>> 0);
  let guard = 0;
  const recoveredByTick: Array<[number, number]> = [];
  while (s.phase === 'playing' && guard++ < 400_000) {
    const drop = s.cooldown === 0 && s.creditsRemaining > 0;
    let special: PlayerInput['special'] = 'normal';
    if (drop) {
      const roll = r();
      if (roll < specialRate * 0.5) special = 'heavy';
      else if (roll < specialRate) special = 'ball';
    }
    s = step(s, { dropX: laneX(lane, r), drop, special }, FIXED_DT);
    if (drop) recoveredByTick.push([s.tick, s.coinsRecovered]);
  }

  const quarterStart = s.tick * 0.75;
  const before = recoveredByTick.filter(([t]) => t <= quarterStart).at(-1)?.[1] ?? 0;
  const after = s.coinsRecovered;
  const span = s.tick - quarterStart;
  const fallRateLastQuarter = span > 0 ? ((after - before) / span) * 1000 : 0;

  return {
    score: s.score,
    creditsSpent: s.creditsSpent,
    coinsRecovered: s.coinsRecovered,
    jackpotBursts: s.jackpotBursts,
    potAwarded: s.potAwarded,
    cascadeCount: s.cascadeCount,
    longestCascade: s.longestCascade,
    nearMissCount: s.nearMissCount,
    ticks: s.tick,
    fallRateLastQuarter,
  };
}

function main(): void {
  console.log('Coin Cascade — balance measurement\n' + '='.repeat(60));

  // ── 1) RTP ────────────────────────────────────────────────────────────
  console.log('\n--- 1) Return-to-player (RTP) ---\n');
  const rtpSeeds = seeds('RTP', 100);
  let totalScore = 0;
  let totalSpent = 0;
  let totalDrops = 0;
  const perSessionRtp: number[] = [];
  for (const seed of rtpSeeds) {
    const res = playSession(seed, 'centre');
    totalScore += res.score;
    totalSpent += res.creditsSpent;
    totalDrops += res.coinsRecovered;
    perSessionRtp.push(res.score / res.creditsSpent);
  }
  const rtp = totalScore / totalSpent;
  const rtpStats = meanCI(perSessionRtp);
  console.log(`  sessions: ${rtpSeeds.length}, total credits spent: ${totalSpent.toLocaleString()}`);
  console.log(`  pooled RTP (score / credits spent): ${(rtp * 100).toFixed(2)}%`);
  console.log(`  per-session RTP: ${fmtMean({ ...rtpStats, mean: rtpStats.mean * 100, halfWidth: rtpStats.halfWidth * 100 }, 2)}%`);
  console.log(
    rtp < 0.5
      ? '  -> WARNING: this reads as thirty-seconds-to-bankruptcy territory'
      : rtp > 1.05
        ? '  -> WARNING: this reads as "you basically cannot lose"'
        : '  -> inside a plausible playable band (see README for the committed band)',
  );

  // ── 2) No drop lane dominates ───────────────────────────────────────────
  console.log('\n--- 2) Lane comparison (left / centre / right / random) ---\n');
  const laneSeeds = seeds('LANE', 50);
  const lanes: Lane[] = ['left', 'centre', 'right', 'random'];
  const laneRtp: Record<Lane, number[]> = { left: [], centre: [], right: [], random: [] };
  const laneCoinsPerCredit: Record<Lane, number[]> = { left: [], centre: [], right: [], random: [] };
  for (const lane of lanes) {
    for (const seed of laneSeeds) {
      const res = playSession(seed, lane, 0); // no specials here — isolate the lane's own effect
      laneRtp[lane].push(res.score / res.creditsSpent);
      laneCoinsPerCredit[lane].push(res.coinsRecovered / res.creditsSpent);
    }
  }
  const laneStats = lanes.map((l) => ({ lane: l, rtp: meanCI(laneRtp[l]), coins: meanCI(laneCoinsPerCredit[l]) }));
  for (const { lane, rtp: r, coins } of laneStats) {
    console.log(`  ${lane.padEnd(7)} RTP ${fmtMean({ ...r, mean: r.mean * 100, halfWidth: r.halfWidth * 100 }, 2)}%   coins/credit ${fmtMean(coins, 3)}`);
  }
  const rtpValues = laneStats.map((x) => x.rtp.mean);
  const bestLane = laneStats[rtpValues.indexOf(Math.max(...rtpValues))];
  const worstLane = laneStats[rtpValues.indexOf(Math.min(...rtpValues))];
  const overlap = bestLane.rtp.mean - bestLane.rtp.halfWidth <= worstLane.rtp.mean + worstLane.rtp.halfWidth;
  console.log(
    `  spread: best=${bestLane.lane} (${(bestLane.rtp.mean * 100).toFixed(1)}%) worst=${worstLane.lane} (${(worstLane.rtp.mean * 100).toFixed(1)}%)` +
      (overlap ? '  -> intervals overlap: no lane is provably best' : '  -> intervals do NOT overlap: a real gap exists, check it is not a landslide'),
  );

  // ── 3) Shelf lockup ──────────────────────────────────────────────────────
  console.log('\n--- 3) Shelf lockup over long play ---\n');
  const lockSeeds = seeds('LOCK', 20);
  const lastQuarterRates: number[] = [];
  const peakOccupancy: number[] = [];
  for (const seed of lockSeeds) {
    let s = createRun(seed);
    const r = mulberry32((s.seed ^ 0x1234) >>> 0);
    let guard = 0;
    let peak = 0;
    let fallenAtQuarterStart = 0;
    const quarterCredits = STARTING_CREDITS * 0.25;
    let markedQuarter = false;
    while (s.phase === 'playing' && guard++ < 400_000) {
      const drop = s.cooldown === 0 && s.creditsRemaining > 0;
      s = step(s, { dropX: WALL_X0 + r() * (WALL_X1 - WALL_X0), drop, special: 'normal' }, FIXED_DT);
      peak = Math.max(peak, s.coins.length);
      if (!markedQuarter && s.creditsRemaining <= quarterCredits) {
        fallenAtQuarterStart = s.coinsRecovered;
        markedQuarter = true;
      }
    }
    peakOccupancy.push(peak);
    const spanTicks = s.tick; // whole run; the last-quarter figure below narrows it
    lastQuarterRates.push(((s.coinsRecovered - fallenAtQuarterStart) / Math.max(1, spanTicks)) * 1000);
  }
  console.log(`  peak shelf occupancy: ${fmtMean(meanCI(peakOccupancy), 1)} coins  (cap ${MAX_COINS_ON_SHELF})`);
  console.log(`  fall rate over the final quarter of credits: ${fmtMean(meanCI(lastQuarterRates), 2)} coins / 1000 ticks`);
  const zeroRateSessions = lastQuarterRates.filter((x) => x <= 0.001).length;
  console.log(`  sessions with an effectively zero late-game fall rate: ${zeroRateSessions} / ${lockSeeds.length}`);

  // ── 4) Cascade and near-miss rates ──────────────────────────────────────
  //
  // Deliberately measured against 'centre' — a real player concentrating
  // drops to build a pushable pile — not 'random'. Section 2 shows why:
  // per-drop scatter almost never lands two coins close enough to touch, so
  // it almost never produces a cascade either. Measuring the "how often does
  // the dopamine mechanic fire in a real session" question against a pilot
  // that structurally cannot cluster coins would answer a different
  // question (this was caught during development: the first pass measured
  // this section against 'random' and printed a flat 0.00 cascades/session,
  // which read as "cascades are dead content" when the actual defect was
  // measuring cascades against a pilot that never builds a pile).
  console.log('\n--- 4) Cascade and near-miss rates ---\n');
  const dopSeeds = seeds('DOP', 70);
  const cascadesPerSession: number[] = [];
  const nearMissPerSession: number[] = [];
  const longestCascadePerSession: number[] = [];
  let sessionsWithAnyCascade = 0;
  let sessionsWithAnyNearMiss = 0;
  for (const seed of dopSeeds) {
    const res = playSession(seed, 'centre', 0.15);
    cascadesPerSession.push(res.cascadeCount);
    nearMissPerSession.push(res.nearMissCount);
    longestCascadePerSession.push(res.longestCascade);
    if (res.cascadeCount > 0) sessionsWithAnyCascade += 1;
    if (res.nearMissCount > 0) sessionsWithAnyNearMiss += 1;
  }
  console.log(`  cascades (>=${CASCADE_MIN} coins) per session: ${fmtMean(meanCI(cascadesPerSession), 2)}`);
  console.log(`  longest cascade per session: ${fmtMean(meanCI(longestCascadePerSession), 2)} coins`);
  console.log(`  near-miss events per session: ${fmtMean(meanCI(nearMissPerSession), 2)}`);
  console.log(`  sessions with >=1 cascade: ${fmtRate(rateCI(sessionsWithAnyCascade, dopSeeds.length))}`);
  console.log(`  sessions with >=1 near-miss: ${fmtRate(rateCI(sessionsWithAnyNearMiss, dopSeeds.length))}`);

  // ── 5) Jackpot ────────────────────────────────────────────────────────
  // Same reasoning as §4: the trigger coin only reaches the edge by being
  // walked forward with everything else, which needs a pile to push against.
  console.log('\n--- 5) Jackpot ---\n');
  const jpSeeds = seeds('JP', 70);
  const burstsPerSession: number[] = [];
  const potAwardedPerSession: number[] = [];
  for (const seed of jpSeeds) {
    const res = playSession(seed, 'centre', 0.1);
    burstsPerSession.push(res.jackpotBursts);
    potAwardedPerSession.push(res.potAwarded);
  }
  console.log(`  jackpot bursts per session: ${fmtMean(meanCI(burstsPerSession), 2)}`);
  console.log(`  pot credits awarded per session: ${fmtMean(meanCI(potAwardedPerSession), 2)}`);

  console.log('\n' + '='.repeat(60));
  console.log('Reminder: this script prints numbers. It does not pass or fail — see npm run check for that.');
}

main();
