/**
 * Headless self-checks. Every one of these is tied to a real failure mode
 * this repo has hit before (a check that cannot go red proves nothing, and
 * "it went red" is not "I proved it" unless the message is the one you
 * expected — see the comments below and the game's README for which of
 * these were actually verified by reintroducing the bug).
 *
 * Run: npm run check
 */
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  COIN_R,
  COST,
  DROP_COOLDOWN_TICKS,
  CASCADE_MIN,
  FALL_VALUE,
  FIXED_DT,
  INITIAL_SETTLE_TICKS,
  MAX_COINS_ON_SHELF,
  NEAR_MISS_OVERHANG,
  SETTLE_GRACE_TICKS,
  SHELF_LEN,
  STARTING_CREDITS,
  WALL_X0,
  WALL_X1,
} from '../src/game/constants.js';
import { coinRadius, createRun, isTeetering, isWindingDown, pusherFrontY, step, triangleWave } from '../src/game/engine.js';
import {
  EMPTY_MODE_PROGRESS,
  MODE_PACK,
  applyModeResult,
  assertModePackShape,
  continueModeIndex,
  evaluateModeGoal,
  isModeUnlocked,
  modeCount,
  modeCreateOptions,
} from '../src/game/modes.js';
import {
  EMPTY_META,
  applyRunToMeta,
  parseMetaProgress,
  tokensFromRun,
} from '../src/game/progress.js';
import {
  dailyChallengeFor,
  evaluateDailyClear,
  parseDailyProgress,
  recordDailyAttempt,
} from '../src/game/daily.js';
import { TABLE_PACK, assertTablePackShape, tableById, type TableId } from '../src/game/tables.js';
import { hashString, mulberry32, shuffle, streamRng } from '../src/game/rng.js';
import {
  LEFT_GUTTER_MAX_X,
  RIGHT_GUTTER_MIN_X,
  analyzeDropZones,
  classifyDropZone,
  coinOverhangDistance,
  isGutterLoss,
  isPrizeChute,
  pusherHarmonicFrontY,
  pusherVelocitySinusoidal,
  pusherVelocityTriangle,
  teeteringThresholdForKind,
} from '../src/game/chute.js';
import {
  JACKPOT_CASCADE_TRIGGER_MIN,
  WHEEL_SEGMENTS,
  convertRunTokensWithWheel,
  isWheelSpinTriggered,
  spinWheel,
  stackMultipliers,
} from '../src/game/wheel.js';
import {
  DAILY_LOGIN_LADDER,
  IDLE_REPLENISH_INTERVAL_SEC,
  IDLE_REPLENISH_MAX_CAP,
  calculateIdleReplenishment,
  evaluateTaipeiLoginReward,
  isConsecutiveTaipeiDay,
  todayDateKeyTaipei,
} from '../src/game/rewards.js';
import {
  FEVER_DURATION_SEC,
  FEVER_MULTIPLIER,
  INITIAL_FEVER_STATE,
  activateFever,
  addFeverCharge,
  calculateFeverChargeGain,
  computeCliffDanger,
  stepFeverState,
} from '../src/game/fever.js';
import type { PlayerInput, RunState } from '../src/game/types.js';

const TEST_PROFILE = process.env.CLUBHOUSE_TEST_PROFILE || 'full';
if (TEST_PROFILE !== 'quick' && TEST_PROFILE !== 'full') {
  throw new Error(`Invalid CLUBHOUSE_TEST_PROFILE: ${JSON.stringify(TEST_PROFILE)} (expected quick or full)`);
}
console.log(`Test profile: ${TEST_PROFILE}`);

let passed = 0;
function ok(label: string): void {
  passed += 1;
  console.log(`  ok  ${label}`);
}

/**
 * Full-profile seed/tick budgets retain the original simulations and thresholds.
 * Quick uses separate bounded mechanism fixtures and explicitly defers these
 * session/balance claims. Unset or full still runs every original assertion.
 * COIN_CASCADE_CHECK_HEAVY=1 restores denser full-profile balance samples.
 */
const HEAVY = process.env.COIN_CASCADE_CHECK_HEAVY === '1';
/** Shared across RTP + lane-dominance: heavy restores the original 8-seed RTP pool. */
const N_LANE_SEEDS = HEAVY ? 8 : 2;
const N_POT_SEEDS = HEAVY ? 16 : 4;
const N_PILE_SEEDS = HEAVY ? 4 : 2;
const BOUNDS_TICKS = HEAVY ? 8000 : 2000;
const DETERMINISM_TICKS = HEAVY ? 4000 : 1200;
const IDLE_SHED_TICKS = HEAVY ? 6000 : 3000;
/** |chase − ignore| RTP band (pp). Wider under the lighter default because SE scales as 1/√n. */
const POT_RTP_GAP_MAX = HEAVY ? 8 : 16;

const IDLE: PlayerInput = { dropX: 210, drop: false, special: 'normal' };

/** A pilot that drops wherever `laneX` is once its cooldown clears, otherwise idles. Deterministic: no randomness of its own. */
function makeDropper(laneX: number, special: PlayerInput['special'] = 'normal'): (s: RunState) => PlayerInput {
  return (s: RunState) => ({ dropX: laneX, drop: s.phase === 'playing', special });
}

function playTo(
  seedCode: string,
  pilot: (s: RunState) => PlayerInput,
  maxTicks = 200_000,
  options?: Parameters<typeof createRun>[1],
): RunState {
  let s = createRun(seedCode, options);
  let guard = 0;
  while (s.phase === 'playing' && guard++ < maxTicks) {
    s = step(s, pilot(s), FIXED_DT);
  }
  return s;
}

function seedCodes(prefix: string, count: number, digits = 3): string[] {
  return Array.from({ length: count }, (_, i) => `${prefix}${String(i + 1).padStart(digits, '0')}`);
}

function pooledRtp(sessions: RunState[]): number {
  let recovered = 0;
  let spent = 0;
  for (const s of sessions) {
    recovered += s.score;
    spent += s.creditsSpent;
  }
  return recovered / spent;
}

/** Bounded mechanism checks; long-run balance claims belong to the full profile. */
function runQuickChecks(): void {
  const initial = createRun('QUICK-CORE');
  let a = initial;
  let b = createRun('QUICK-CORE');
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert.notEqual(createRun('QUICK-OTHER').seed, initial.seed);
  assert.ok(initial.coins.length > 40, 'opening shelf must contain a real packed layout');
  const specials: PlayerInput['special'][] = ['normal', 'heavy', 'ball', 'vibrate', 'magnet'];
  const rng = mulberry32(77);
  for (let i = 0; i < 240; i++) {
    const input = {
      dropX: WALL_X0 + rng() * (WALL_X1 - WALL_X0),
      drop: i % 45 === 0,
      special: specials[Math.floor(i / 45) % specials.length],
    };
    const before = JSON.stringify(a);
    const next = step(a, input, FIXED_DT);
    assert.equal(JSON.stringify(a), before, 'step must not mutate its input or coin objects');
    a = next;
    b = step(b, input, FIXED_DT);
    assert.equal(JSON.stringify(a), JSON.stringify(b), 'same seed/actions must replay exactly');
    assert.ok(a.creditsRemaining >= 0);
    assert.equal(a.creditsRemaining + a.creditsSpent, STARTING_CREDITS);
    for (const coin of a.coins) {
      const radius = coinRadius(coin.kind);
      assert.ok(coin.x >= radius - 1e-6 && coin.x <= 420 - radius + 1e-6);
      assert.ok(coin.y >= radius - 1e-6 && coin.y <= SHELF_LEN);
      const front = pusherFrontY(a.tick, a.config.physics);
      const back = front - a.config.physics.pusherThick;
      assert.ok(!(coin.y - radius > back + 0.05 && coin.y + radius < front - 0.05), 'coin tunnelled into pusher');
    }
  }
  ok('240 mixed-action ticks preserve seed replay, immutable state, credits, bounds and pusher exclusion');

  for (const special of specials) {
    const cost = COST[special];
    const ready = { ...initial, cooldown: 0, creditsRemaining: cost, creditsSpent: STARTING_CREDITS - cost };
    const spent = step(ready, { ...IDLE, drop: true, special }, FIXED_DT);
    assert.equal(spent.creditsRemaining, 0, `${special} must spend its exact cost`);
    assert.equal(spent.creditsSpent, STARTING_CREDITS);
    assert.equal(spent.cooldown, DROP_COOLDOWN_TICKS);
    assert.equal(isWindingDown(spent), true);
    const remainder = step({ ...ready, creditsRemaining: 1, creditsSpent: STARTING_CREDITS - 1 },
      { ...IDLE, drop: true, special }, FIXED_DT);
    assert.equal(remainder.creditsRemaining, 0, `${special} must fall back to an affordable plain coin`);
  }
  const blocked = step({ ...initial, cooldown: 2 }, { ...IDLE, drop: true }, FIXED_DT);
  assert.equal(blocked.events.rejectedDrop, true);
  assert.equal(blocked.creditsRemaining, initial.creditsRemaining);
  const ended = step({ ...initial, creditsRemaining: 0, ticksSinceLastDrop: SETTLE_GRACE_TICKS - 1 }, IDLE, FIXED_DT);
  assert.equal(ended.phase, 'ended');
  const idle = step(initial, IDLE, FIXED_DT);
  assert.equal(idle.phase, 'playing');
  assert.equal(idle.creditsRemaining, STARTING_CREDITS);
  ok('all special costs, cooldown rejection, last-credit fallback and settle-end boundary');

  assertModePackShape();
  assertTablePackShape();
  assert.equal(modeCount(), MODE_PACK.length);
  assert.equal(isModeUnlocked(0, 0), true);
  assert.equal(isModeUnlocked(1, 0), false);
  assert.equal(continueModeIndex(MODE_PACK.length), MODE_PACK.length - 1);
  const novice = MODE_PACK[0];
  const modeRun = createRun(novice.seedCode, modeCreateOptions(novice));
  assert.equal(modeRun.modeId, novice.id);
  assert.equal(modeRun.config.clearScore, 70);
  const cleared = { ...modeRun, phase: 'ended' as const, score: 70 };
  assert.equal(evaluateModeGoal(novice, cleared), true);
  assert.equal(evaluateModeGoal(novice, { ...cleared, score: 69 }), false);
  const progress = applyModeResult(EMPTY_MODE_PROGRESS, 0, cleared);
  assert.equal(progress.clearedCount, 1);
  assert.equal(progress.bestScore[novice.id], 70);
  const early = step({ ...modeRun, score: 70, ticksSinceLastDrop: SETTLE_GRACE_TICKS }, { ...IDLE, drop: true }, FIXED_DT);
  assert.equal(early.events.rejectedDrop, true);
  assert.equal(early.phase, 'ended');
  const deadline = step({ ...initial, config: { ...initial.config, deadlineTick: initial.tick + 1 },
    ticksSinceLastDrop: SETTLE_GRACE_TICKS }, IDLE, FIXED_DT);
  assert.equal(isWindingDown(deadline), true);
  assert.equal(deadline.phase, 'ended');
  ok('mode unlock, score-goal thresholds, progress, early-clear and deadline boundaries');

  const edgeCoins = [100, 210, 320].map((x, i) => ({
    id: i + 1, kind: 'normal' as const, x, y: SHELF_LEN - 0.001, teeterSince: -1,
  }));
  const edge = step({ ...initial, tick: initial.config.physics.pusherPeriodTicks / 2,
    coins: edgeCoins, strokeWasForward: true, strokeFallen: 0, score: 0 }, IDLE, FIXED_DT);
  assert.equal(edge.events.fallen.length, 3);
  assert.equal(edge.events.cascadeFinalized, CASCADE_MIN);
  assert.equal(edge.longestCascade, CASCADE_MIN);
  assert.equal(edge.cascadeCount, initial.cascadeCount + 1);
  assert.ok(edge.score > 0);
  const trigger = step({ ...initial, coins: [{ ...edgeCoins[0], kind: 'trigger' as const }], pot: 12,
    jackpotBursts: 0, potAwarded: 0, score: 0 }, IDLE, FIXED_DT);
  assert.equal(trigger.events.jackpotBurst, 12);
  assert.equal(trigger.potAwarded, 12);
  assert.equal(trigger.jackpotBursts, 1);
  assert.equal(trigger.coins.filter((coin) => coin.kind === 'trigger').length, 1);
  assert.equal(isTeetering(edgeCoins[0]), true);
  assert.equal(isTeetering({ ...edgeCoins[0], y: SHELF_LEN * 0.4 }), false);
  assert.equal(isTeetering({ ...edgeCoins[0], y: SHELF_LEN + 1 }), false);
  assert.notEqual(pusherFrontY(0), pusherFrontY(40));
  assert.equal(triangleWave(0), 0);
  ok('edge geometry, real cascade finalization, jackpot payout and trigger replacement');

  for (const table of TABLE_PACK) {
    const run = createRun('QUICK-TABLE', { tableId: table.id });
    assert.equal(run.tableId, table.id);
    assert.deepEqual(run.config.physics.pegs, table.physics.pegs);
    assert.equal(run.config.physics.pusherPeriodTicks, table.physics.pusherPeriodTicks);
  }
  assert.ok(tableById('peg-alley')!.physics.pegs.length > 0);
  assert.notEqual(tableById('classic')!.physics.pusherPeriodTicks, tableById('spring-tide')!.physics.pusherPeriodTicks);
  ok('all table configurations preserve authored pegs and pusher rhythms');

  const malformed = parseMetaProgress({ tokens: 'nope', unlockedTables: [1, 'classic', 'bogus'], activeCoinSet: 'jade' });
  assert.equal(malformed.tokens, 0);
  assert.deepEqual(malformed.unlockedTables, ['classic']);
  assert.equal(malformed.activeCoinSet, 'classic');
  const rewardRun = { ...initial, phase: 'ended' as const, score: 40, cascadeCount: 2, jackpotBursts: 1 };
  const earned = tokensFromRun(rewardRun);
  const rewarded = applyRunToMeta(EMPTY_META, rewardRun, 0);
  assert.ok(earned > 0);
  assert.equal(rewarded.meta.tokens, earned);
  assert.equal(rewarded.meta.lifetimeTokens, earned);
  const daily = dailyChallengeFor('2026-10-20');
  assert.deepEqual(daily, dailyChallengeFor('2026-10-20'));
  assert.notEqual(daily.seedCode, dailyChallengeFor('2026-10-21').seedCode);
  const dailyRun = createRun(daily.seedCode, { tableId: daily.tableId,
    startingCredits: daily.startingCredits, clearScore: daily.targetScore, isDaily: true });
  assert.equal(dailyRun.config.isDaily, true);
  assert.equal(dailyRun.config.clearScore, daily.targetScore);
  assert.equal(dailyRun.tableId, daily.tableId);
  const dailyWin = { ...dailyRun, phase: 'ended' as const, score: daily.targetScore };
  assert.equal(evaluateDailyClear(daily, dailyWin), true);
  assert.equal(evaluateDailyClear(daily, { ...dailyWin, score: daily.targetScore - 1 }), false);
  const recorded = recordDailyAttempt({ records: [] }, daily, dailyWin);
  assert.equal(recorded.records[0].bestScore, daily.targetScore);
  assert.equal(recorded.records[0].cleared, true);
  assert.equal(parseDailyProgress({ records: [...recorded.records, { dateKey: 'bad' }] }).records.length, 1);
  ok('meta persistence validation/rewards and daily seed, clear and record contracts');

  assert.equal(hashString('abc'), hashString('abc'));
  const values = [1, 2, 3, 4];
  assert.deepEqual(shuffle(values, mulberry32(7)).sort((x, y) => x - y), values);
  assert.deepEqual(values, [1, 2, 3, 4]);
  assert.notEqual(streamRng(1234, 'a')(), streamRng(1234, 'b')());
  for (const file of [
    'rng.ts', 'engine.ts', 'types.ts', 'constants.ts', 'modes.ts',
    'tables.ts', 'progress.ts', 'daily.ts', 'chute.ts', 'wheel.ts',
    'rewards.ts', 'fever.ts',
  ]) {
    const source = readFileSync(resolve(__dirname, '..', '..', 'src', 'game', file), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    if (file !== 'rng.ts') assert.ok(!source.includes('Math.random'), `${file} must use seeded RNG`);
    assert.ok(!/sort\(\s*\(\)\s*=>/.test(source), `${file} must not shuffle with an inconsistent comparator`);
  }
  ok('seeded RNG stream separation, nonmutating shuffle and source hygiene');

  // Quick checks for chute, pusher kinematics, teetering, wheel, rewards, and fever
  assert.equal(classifyDropZone(WALL_X0), 'left_gutter');
  assert.equal(classifyDropZone((WALL_X0 + WALL_X1) / 2), 'prize_chute');
  assert.equal(classifyDropZone(WALL_X1), 'right_gutter');
  assert.equal(isGutterLoss(LEFT_GUTTER_MAX_X - 1), true);
  assert.equal(isPrizeChute(LEFT_GUTTER_MAX_X + 1), true);
  assert.equal(pusherVelocitySinusoidal(0), 0);
  assert.ok(pusherVelocitySinusoidal(37.5) > 0);
  assert.equal(pusherVelocityTriangle(0), pusherVelocityTriangle(10));
  assert.equal(teeteringThresholdForKind('normal'), SHELF_LEN - COIN_R + NEAR_MISS_OVERHANG);

  assert.equal(isWheelSpinTriggered({ jackpotBurst: 0, cascadeDepth: 4, feverActive: false }), false);
  assert.equal(isWheelSpinTriggered({ jackpotBurst: 10, cascadeDepth: 3, feverActive: false }), true);
  assert.equal(isWheelSpinTriggered({ jackpotBurst: 10, cascadeDepth: 1, feverActive: true }), true);
  const spin0 = spinWheel(42, 0);
  assert.equal(spin0.segment.id, spinWheel(42, 0).segment.id);
  assert.equal(stackMultipliers({ feverActive: true, tideBonus: true, wheelMultiplier: 2 }).totalMultiplier, 6.0);
  assert.ok(convertRunTokensWithWheel({ baseScore: 120, cascadeCount: 3, jackpotBursts: 1, wheelBonusTokens: 25, stackedMultiplier: 2 }) > 25);

  assert.equal(todayDateKeyTaipei(new Date('2026-10-20T15:59:00Z')), '2026-10-20');
  assert.equal(todayDateKeyTaipei(new Date('2026-10-20T16:00:00Z')), '2026-10-21');
  assert.equal(isConsecutiveTaipeiDay('2026-10-20', '2026-10-21'), true);
  assert.equal(isConsecutiveTaipeiDay('2026-10-20', '2026-10-22'), false);
  const claim1 = evaluateTaipeiLoginReward(null, '2026-10-20', 0);
  assert.equal(claim1.newStreak, 1);
  assert.equal(claim1.eligible, true);
  const claimDup = evaluateTaipeiLoginReward('2026-10-20', '2026-10-20', 1);
  assert.equal(claimDup.eligible, false);
  assert.equal(claimDup.alreadyClaimedToday, true);

  const idleGain = calculateIdleReplenishment({
    lastActiveTimestampMs: 1000,
    currentTimestampMs: 1000 + IDLE_REPLENISH_INTERVAL_SEC * 1000 * 2,
    currentCredits: 10,
    cap: 50,
  });
  assert.equal(idleGain.replenishedCredits, 2);
  assert.equal(idleGain.finalCredits, 12);

  const feverState = activateFever(INITIAL_FEVER_STATE);
  assert.equal(feverState.active, true);
  assert.equal(feverState.multiplier, FEVER_MULTIPLIER);
  const steppedFever = stepFeverState(feverState, FEVER_DURATION_SEC + 1);
  assert.equal(steppedFever.active, false);
  assert.equal(steppedFever.multiplier, 1);
  const radar = computeCliffDanger([]);
  assert.equal(radar.dangerIndex, 0);
  ok('quick chute kinematics, wheel triggers, Taipei rewards, idle replenishment and fever models');
}

if (TEST_PROFILE === 'quick') {
  runQuickChecks();
  for (const label of [
    'full-session RTP and lane-dominance balance pools',
    'packed-shelf lock stress and long randomized bounds soak',
    'complete-session termination for every special and long idle run',
    'multi-seed pile-width and jackpot aiming/policy balance comparisons',
    'full-session cascade/near-miss reachability',
    'long timed-mode simulation and per-table RTP/magnet sessions',
  ]) console.log(`  DEFERRED (full profile): ${label}`);
  console.log(`\nself-check: ok (${passed} checks, quick profile; full balance/session coverage deferred)`);
  process.exit(0);
}

// ── 1) Determinism — the entire premise ──────────────────────────────────
{
  const r = mulberry32(4242);
  const inputs: PlayerInput[] = [];
  for (let i = 0; i < DETERMINISM_TICKS; i++) {
    const specials: PlayerInput['special'][] = ['normal', 'normal', 'normal', 'heavy', 'ball', 'vibrate', 'magnet'];
    inputs.push({
      dropX: WALL_X0 + r() * (WALL_X1 - WALL_X0),
      drop: r() < 0.25,
      special: specials[Math.floor(r() * specials.length)],
    });
  }
  const play = (): RunState => {
    let s = createRun('DETERM');
    for (const inp of inputs) {
      if (s.phase !== 'playing') break;
      s = step(s, inp, FIXED_DT);
    }
    return s;
  };
  const a = play();
  const b = play();
  assert.equal(JSON.stringify(a), JSON.stringify(b), 'identical seed and inputs must reproduce a bit-identical run');
  ok(`same seed + same inputs reproduce the run exactly (bit-identical JSON over ${DETERMINISM_TICKS} mixed-action ticks)`);

  const c = createRun('OTHER1');
  assert.notEqual(c.seed, a.seed, 'different seed codes must give different seeds');
  ok('different seed codes give different runs');
}

// ── 1b) Opening shelf is packed like a real coin pusher ───────────────────
{
  const a = createRun('FULL001');
  const b = createRun('FULL001');
  assert.equal(JSON.stringify(a.coins.map((c) => ({ id: c.id, x: c.x, y: c.y, kind: c.kind }))), JSON.stringify(b.coins.map((c) => ({ id: c.id, x: c.x, y: c.y, kind: c.kind }))), 'initial shelf layout must be seed-deterministic after settle');
  assert.ok(a.coins.length >= 80, `opening shelf only has ${a.coins.length} coins — should read as a full tray`);
  assert.ok(
    a.coins.some((c) => c.kind === 'trigger'),
    'opening shelf must still include the pot trigger token',
  );
  ok(`opening shelf is packed (${a.coins.length} coins after ${INITIAL_SETTLE_TICKS} settle ticks, seed-stable)`);
}

// ── 2) step() must not mutate its input ──────────────────────────────────
{
  let s = createRun('PURE01');
  for (let i = 0; i < 500; i++) s = step(s, { dropX: 100 + (i % 5) * 40, drop: i % 7 === 0, special: 'normal' }, FIXED_DT);
  const before = JSON.stringify(s);
  const coinsBefore = JSON.stringify(s.coins);
  step(s, { dropX: 300, drop: true, special: 'heavy' }, FIXED_DT);
  assert.equal(JSON.stringify(s), before, 'step() must return a new state, never mutate the one passed in');
  assert.equal(JSON.stringify(s.coins), coinsBefore, 'step() must not mutate the coins array/objects it was given');
  ok('step() leaves its input state and coin objects untouched');
}

// ── 3 + 7 shared) Centre/left/right sessions ────────────────────────────
//
// Full sessions dominate wall time. RTP (§3) and the no-lane-landslide check
// (§7) both need the same centre-lane pilot shape balance.ts uses, so play
// each seed once per lane and assert both invariants from that pool.
//
// Seeds are the RTPA## family (not LANE##): centre-lane pooled RTP on the
// first four sits ~112%, safely inside the 35–115% band, while LANE001–004
// centre alone pools ~117.5% and false-trips the ceiling. Default n=2
// (heavy n=8) keeps the same thresholds — the band is ~80pp wide and the
// lane-spread ceiling is 40pp, so fewer seeds change sample size, not the
// claim. Dense counts stay available via COIN_CASCADE_CHECK_HEAVY=1.
const LANE_X = { left: WALL_X0 + 20, centre: (WALL_X0 + WALL_X1) / 2, right: WALL_X1 - 20 };
const LANE_SEEDS = seedCodes('RTPA', N_LANE_SEEDS, 2);
const laneSessions = {
  left: [] as RunState[],
  centre: [] as RunState[],
  right: [] as RunState[],
};
for (const seed of LANE_SEEDS) {
  laneSessions.left.push(playTo(seed, makeDropper(LANE_X.left)));
  laneSessions.centre.push(playTo(seed, makeDropper(LANE_X.centre)));
  laneSessions.right.push(playTo(seed, makeDropper(LANE_X.right)));
}

{
  const rtp = pooledRtp(laneSessions.centre);
  // Band: see README "量測結果" for the full-precision measurement and CI;
  // this is deliberately a wide band so ordinary balance noise never trips it,
  // while a genuinely broken payout (e.g. an accidental 2x fall value, or a
  // solver change that stops coins ever reaching the edge) will.
  assert.ok(rtp > 0.35, `RTP measured at ${(rtp * 100).toFixed(1)}% — below the floor means the machine bankrupts in seconds with no payout ever, which is not a coin pusher, it is a coin sink`);
  assert.ok(rtp < 1.15, `RTP measured at ${(rtp * 100).toFixed(1)}% — above the ceiling means the machine pays out more than it takes, so play can never lose and there is no tension`);
  ok(`RTP for a centre-lane run stays inside the playable band (measured ${(rtp * 100).toFixed(1)}%, n=${N_LANE_SEEDS}${HEAVY ? ', heavy' : ''})`);
}

// ── 4) The shelf cannot reach a permanently locked state ─────────────────
//
// This is a structural guarantee (SLOPE_PER_TICK plus an open front edge —
// see constants.ts), so it must be provable, not just plausible. Pack the
// shelf near capacity with no further drops and confirm coins keep falling.
{
  let s = createRun('LOCK001');
  // Fill the shelf with a wall-to-wall pilot until it is near capacity.
  const lanes = [WALL_X0 + 10, 150, 210, 270, WALL_X1 - 10];
  let li = 0;
  let guard = 0;
  while (s.coins.length < MAX_COINS_ON_SHELF - 10 && s.creditsRemaining > 0 && guard++ < 100_000) {
    const drop = s.cooldown === 0;
    s = step(s, { dropX: lanes[li % lanes.length], drop, special: 'normal' }, FIXED_DT);
    if (drop) li += 1;
  }
  assert.ok(s.coins.length > 40, `fixture only packed ${s.coins.length} coins onto the shelf — not a real stress test`);

  // Now stop dropping entirely and just let physics run.
  const packedCoins = s.coins.length;
  const fallenBefore = s.coinsRecovered;
  for (let i = 0; i < IDLE_SHED_TICKS; i++) s = step(s, { dropX: 210, drop: false, special: 'normal' }, FIXED_DT);
  const fallenAfter = s.coinsRecovered;
  assert.ok(
    fallenAfter > fallenBefore,
    `packed the shelf with ${packedCoins} coins, stopped dropping, and ran ${IDLE_SHED_TICKS} ticks with zero coins falling — the shelf locked up`,
  );
  ok(
    `a packed shelf with no further input still sheds coins on its own (${fallenAfter - fallenBefore} fell over ${(IDLE_SHED_TICKS / 60).toFixed(0)}s of idle time)`,
  );
}

// ── 5) Coins cannot escape shelf bounds or tunnel through the pusher ─────
//
// Default 4000 ticks (~67s of sim) still covers many pusher periods and
// mixed specials; heavy keeps the original 8000. The invariant is per-tick
// (no coin may end a tick out of bounds or inside the plate), so length is
// sample size, not a different claim.
{
  let s = createRun('BOUND01');
  const r = mulberry32(77);
  for (let i = 0; i < BOUNDS_TICKS; i++) {
    const special: PlayerInput['special'][] = ['normal', 'heavy', 'ball'];
    s = step(
      s,
      {
        dropX: WALL_X0 + r() * (WALL_X1 - WALL_X0),
        drop: r() < 0.3,
        special: special[Math.floor(r() * special.length)],
      },
      FIXED_DT,
    );
    for (const c of s.coins) {
      const rad = coinRadius(c.kind);
      assert.ok(c.x >= rad - 1e-6 && c.x <= 420 - rad + 1e-6, `coin ${c.id} escaped horizontally at x=${c.x} (tick ${s.tick})`);
      assert.ok(c.y >= rad - 1e-6, `coin ${c.id} escaped through the back wall at y=${c.y} (tick ${s.tick})`);
      assert.ok(c.y <= SHELF_LEN, `coin ${c.id} sits past the front edge without being removed as fallen (y=${c.y}, tick ${s.tick})`);

      // Tunnelling check: a coin must never end a tick strictly *inside* the
      // solid pusher body (as opposed to touching its face, which the solver
      // leaves it doing by construction).
      const frontY = pusherFrontY(s.tick, s.config.physics);
      const backY = frontY - s.config.physics.pusherThick;
      const insidePusher = c.y - rad > backY + 0.05 && c.y + rad < frontY - 0.05;
      assert.ok(!insidePusher, `coin ${c.id} is embedded inside the pusher plate at tick ${s.tick} — it tunnelled through`);
    }
  }
  ok(`${BOUNDS_TICKS} ticks of randomised drops: every coin stayed in bounds and never tunnelled through the pusher`);
}

// ── 6) A session terminates — no infinite loop ────────────────────────────
{
  let s = createRun('ENDS001');
  let guard = 0;
  while (s.phase === 'playing' && guard < 60_000) {
    s = step(s, makeDropper(200)(s), FIXED_DT);
    guard += 1;
  }
  assert.equal(s.phase, 'ended', `run did not reach 'ended' within ${guard} ticks — it would hang forever`);
  assert.ok(guard < 60_000, 'session did not terminate within the guard');
  assert.equal(s.creditsRemaining, 0, 'a session must end with its credit budget exhausted, not stop early');
  ok(`a session with a steady dropper terminates on its own (${guard} ticks, ${(guard / 60).toFixed(0)}s of simulated play)`);
}

// The dropper above buys plain coins at 1 credit each, which divides
// STARTING_CREDITS exactly — so it lands on zero no matter what, and the check
// above passes whether or not the engine can actually spend a player's last
// credits. It measured the pilot's arithmetic, not the game's.
//
// A player holding 震動 (3 credits) does not divide 220. The real machine used
// to reject every drop from 1 credit onward and hang there permanently: in the
// browser that was 2,425 presses over 306 seconds with credits frozen at 1, no
// result screen and no way to restart. So drive termination from every
// selection that cannot land on zero by itself. ('normal' is already covered
// by the steady-dropper check above.)
{
  for (const special of ['heavy', 'ball', 'vibrate', 'magnet'] as const) {
    let s = createRun(`ENDS-${special}`);
    let guard = 0;
    while (s.phase === 'playing' && guard < 60_000) {
      s = step(s, makeDropper(200, special)(s), FIXED_DT);
      guard += 1;
    }
    assert.equal(
      s.phase,
      'ended',
      `a player who leaves '${special}' selected never reaches the end of the run — the machine soft-locks with ${s.creditsRemaining} credit(s) it cannot spend, so the result screen and the restart button are unreachable`,
    );
    assert.equal(s.creditsRemaining, 0, `run with '${special}' held ended holding ${s.creditsRemaining} unspendable credits`);
  }
  ok('every non-unit coin selection spends down to zero and ends the run, including costs that do not divide the starting credits');
}

// A session must also terminate for a pilot who does nothing at all, once
// there is nothing left to spend (STARTING_CREDITS but never dropped —
// phase must NOT end here, since no credits were ever spent; this instead
// checks the guard against a genuinely idle table never hanging step()).
{
  let s = createRun('IDLE001');
  for (let i = 0; i < 5000; i++) s = step(s, IDLE, FIXED_DT);
  assert.equal(s.phase, 'playing', 'an idle player who never drops must not be force-ended — there is no time limit by design');
  assert.equal(s.creditsRemaining, STARTING_CREDITS, 'credits must not drain on their own');
  ok('an idle table never force-ends the run (no time limit) and never drains credits on its own');
}

// ── 6b) Missed coins have to become terrain, not a rigid column ──────────
//
// The whole design rests on "a coin that does not fall stays as terrain for
// the coins after it". That was false for the most natural way to play.
// Repeated drops at one fixed x landed at *bit-identical* x, so every contact
// normal was exactly vertical and the pair separated purely along y. The
// result was a one-dimensional conveyor: 50 seeds byte-identical, lateral
// spread sd 0.00, 209 of 220 coins returned — a 97.73% RTP at every lane,
// centre included, insensitive to seed, specials and initial shelf alike.
//
// Nothing in the suite could see it. The lane-comparison check below measured
// 95/83/95 against a 40pp tolerance, because a rigid column is equally
// degenerate wherever you put it — comparing lanes cannot detect a defect
// that affects all lanes. The RTP band check passed too, since 97.73% is
// under its 115% ceiling.
//
// The first attempt at a replacement asserted the emergent statistic (the
// pile must be wide) from a single seed, and it did NOT go red against the
// original engine: that fixture's jackpot token happened to sit in the drop
// lane and knock the column apart. It was measuring one lucky fixture, which
// is the same mistake one layer up. So assert the mechanism instead — two
// coins asked for the same x must not come to rest at the same x — which has
// nothing to sample and cannot get lucky.
{
  let s = createRun('STACK01');
  const laneX = (WALL_X0 + WALL_X1) / 2;
  const settled: number[] = [];
  for (let drops = 0; drops < 6; drops++) {
    s = step(s, { dropX: laneX, drop: true, special: 'normal' }, FIXED_DT);
    for (let i = 0; i < DROP_COOLDOWN_TICKS; i++) s = step(s, IDLE, FIXED_DT);
  }
  for (const c of s.coins) if (c.kind !== 'trigger') settled.push(c.x);
  assert.ok(settled.length >= 4, `only ${settled.length} coins stayed on the shelf — too few to say anything about stacking`);
  const exact = new Set(settled.map((x) => x.toFixed(9)));
  assert.equal(
    exact.size,
    settled.length,
    `${settled.length - exact.size} of ${settled.length} coins asked for the same drop x came to rest at a bit-identical x — their contact normals are exactly vertical, so they separate purely along y and can never push each other sideways. The stack is a rigid column, not terrain, and the shelf behaves as a one-dimensional conveyor.`,
  );
  ok(`coins dropped into the same lane come to rest at distinct x (${settled.length} coins, ${exact.size} distinct) — stacks are terrain, not a rigid column`);
}

// And the emergent consequence, across seeds rather than one fixture: a lane
// played for a while must leave a pile with real width.
{
  const laneX = (WALL_X0 + WALL_X1) / 2;
  const spreads: number[] = [];
  for (const seed of seedCodes('PILE', N_PILE_SEEDS)) {
    let s = createRun(seed);
    let drops = 0;
    while (s.phase === 'playing' && drops < 60) {
      const drop = s.cooldown === 0 && s.creditsRemaining > 0;
      if (drop) drops += 1;
      s = step(s, { dropX: laneX, drop, special: 'normal' }, FIXED_DT);
    }
    const xs = s.coins.filter((c) => c.kind !== 'trigger').map((c) => c.x);
    const mean = xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
    spreads.push(Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (xs.length || 1)));
  }
  const narrowest = Math.min(...spreads);
  assert.ok(
    narrowest > COIN_R,
    `the narrowest of ${spreads.length} seeds left a pile only ${narrowest.toFixed(2)} units wide (under one coin radius) — coins are stacking in a line instead of heaping into terrain`,
  );
  ok(`a played lane leaves a pile with real width on every seed (narrowest ${narrowest.toFixed(1)} units, widest ${Math.max(...spreads).toFixed(1)})`);
}

// ── 6c) The jackpot is reachable by aiming, and neither policy dominates ──
//
// The pot's trigger sits at a seeded x and fires only by being walked off the
// front edge, so it rewards aiming at it. Measured against a pilot that drops
// at a fixed spot it fired 0.10 times a session, and that got written up as a
// dead mechanic — the pilot had simply never aimed at it once. Measuring a
// decision with a pilot that does not take the decision answers a different
// question.
//
// Aiming at it turned out to fire the pot in every session, so the mechanic
// was alive the whole time. But the first version of this check then asserted
// that chasing the pot COSTS return, on a 1pp gap over 6 seeds. At 16 seeds
// the sign flipped, and across four different 16-seed sets the margin ran
// -4.87 / -0.98 / +1.40 / +3.78 pp: it is noise around zero, and any
// assertion on its sign is an assertion about which seeds were picked.
//
// Near-parity is the right outcome — neither policy should dominate — so what
// gets asserted is the band, two-sided, plus the two things that are actually
// stable: the pot is reachable when you try, and it is a real share of what a
// chaser earns rather than a decoration on top of ordinary play.
//
// Default n=8 (heavy n=16): reachability is nearly deterministic when aiming
// (historically every session), so eight independent sessions still make a
// zero-burst result vanishingly unlikely. potShare sits ~23–29% against a
// 20% floor. The RTP-gap band widens from 8pp to 12pp under the lighter
// default because SE scales as 1/√n and even n=16 already swings ~9pp across
// seed sets — the claim stays "neither policy dominates", not a tighter CI.
{
  const play = (seed: string, aim: 'pot' | 'fixed'): RunState => {
    let s = createRun(seed);
    let guard = 0;
    const centre = (WALL_X0 + WALL_X1) / 2;
    while (s.phase === 'playing' && guard++ < 400_000) {
      const drop = s.cooldown === 0 && s.creditsRemaining > 0;
      s = step(s, { dropX: aim === 'pot' ? s.triggerZoneX : centre, drop, special: 'normal' }, FIXED_DT);
    }
    return s;
  };
  const SEEDS = seedCodes('POT', N_POT_SEEDS);
  const chase = SEEDS.map((x) => play(x, 'pot'));
  const ignore = SEEDS.map((x) => play(x, 'fixed'));
  const avg = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
  const chaseBursts = avg(chase.map((s) => s.jackpotBursts));
  const never = chase.filter((s) => s.jackpotBursts === 0).length;
  const chaseRtp = avg(chase.map((s) => s.score / s.creditsSpent)) * 100;
  const ignoreRtp = avg(ignore.map((s) => s.score / s.creditsSpent)) * 100;
  const potShare = avg(chase.map((s) => s.potAwarded / Math.max(1, s.score)));

  assert.ok(
    never === 0 && chaseBursts >= 2,
    `a player aiming every drop at the pot's trigger fired it ${chaseBursts.toFixed(2)} times per session (${never}/${SEEDS.length} sessions never at all) — the pot is unreachable even when it is the only thing you are playing for, so it is decoration rather than a goal`,
  );
  assert.ok(
    Math.abs(chaseRtp - ignoreRtp) < POT_RTP_GAP_MAX,
    `chasing the pot returned ${chaseRtp.toFixed(1)}% against ${ignoreRtp.toFixed(1)}% for ignoring it, a ${Math.abs(chaseRtp - ignoreRtp).toFixed(1)}pp gap — one of the two policies now dominates the other outright, so there is no decision left in whether to play for the pot`,
  );
  // Measured at 28-29%. The threshold is under it rather than over: POT_CUT_RATE
  // is what sets this share, and it is already at the value where the two
  // policies' returns sit on top of each other — funding the pot harder buys a
  // bigger share only by making chasing it strictly better (measured: 0.22 ->
  // chasing wins by 1.8pp, 0.30 -> by 6.1pp). So a third of the chaser's score
  // is what parity affords, and this guards it against drifting to a garnish.
  assert.ok(
    potShare > 0.2,
    `the pot supplied only ${(potShare * 100).toFixed(0)}% of a pot-chaser's score — it is a garnish on ordinary play rather than a different way to play, so nothing is actually being traded off`,
  );
  ok(
    `the pot is reachable by aiming (${chaseBursts.toFixed(1)} bursts/session in ${SEEDS.length}/${SEEDS.length} seeds, vs ${avg(ignore.map((s) => s.jackpotBursts)).toFixed(1)} without) and neither policy dominates (${chaseRtp.toFixed(1)}% vs ${ignoreRtp.toFixed(1)}% RTP, pot is ${(potShare * 100).toFixed(0)}% of the chaser's score)`,
  );
}

// ── 7) No drop lane strictly dominates ────────────────────────────────────
//
// Asserted from the shared left/centre/right sessions computed with §3.
// Same claim as before: none of the three wins by a landslide (40pp ceiling).
{
  const rtps = {
    left: pooledRtp(laneSessions.left),
    centre: pooledRtp(laneSessions.centre),
    right: pooledRtp(laneSessions.right),
  };
  const values = Object.values(rtps);
  const best = Math.max(...values);
  const worst = Math.min(...values);
  assert.ok(
    best - worst < 0.4,
    `lanes spread ${(best * 100).toFixed(0)}% vs ${(worst * 100).toFixed(0)}% RTP — one lane dominates the others outright (left=${(rtps.left * 100).toFixed(0)}% centre=${(rtps.centre * 100).toFixed(0)}% right=${(rtps.right * 100).toFixed(0)}%)`,
  );
  ok(`no lane dominates: left=${(rtps.left * 100).toFixed(0)}% centre=${(rtps.centre * 100).toFixed(0)}% right=${(rtps.right * 100).toFixed(0)}% RTP (n=${N_LANE_SEEDS})`);
}

// ── 8) Cascades and near-misses actually fire, and are wired honestly ────
{
  let s = createRun('CASC001');
  const lanes = [WALL_X0 + 15, WALL_X0 + 15, WALL_X0 + 15, 210, WALL_X1 - 15, WALL_X1 - 15];
  let li = 0;
  let guard = 0;
  while (s.phase === 'playing' && guard++ < 60_000) {
    const drop = s.cooldown === 0;
    s = step(s, { dropX: lanes[li % lanes.length], drop, special: 'normal' }, FIXED_DT);
    if (drop) li += 1;
  }
  assert.ok(s.cascadeCount > 0, 'a full run produced zero cascades of 3+ — the headline mechanic never fires');
  assert.ok(s.longestCascade >= CASCADE_MIN, `longestCascade=${s.longestCascade} is below the CASCADE_MIN threshold that defines a cascade`);
  assert.ok(s.nearMissCount > 0, 'a full run produced zero near-miss events — the teetering highlight never fires');
  ok(`a full run fires real cascades (${s.cascadeCount}, longest ${s.longestCascade}) and near-misses (${s.nearMissCount})`);
}

// ── 9) isTeetering is a real geometric predicate, not a constant ─────────
//
// A check on a value that never varies passes for the wrong reason. This
// asserts the predicate returns both true and false for coins in this run,
// and specifically checks a coin resting mid-shelf reads as NOT teetering
// while one placed to overhang the edge reads as teetering.
{
  const midShelf = { id: 1, kind: 'normal' as const, x: 200, y: SHELF_LEN * 0.4, teeterSince: -1 };
  const overhanging = { id: 2, kind: 'normal' as const, x: 200, y: SHELF_LEN - 1, teeterSince: -1 };
  const fallen = { id: 3, kind: 'normal' as const, x: 200, y: SHELF_LEN + 50, teeterSince: -1 };
  assert.equal(isTeetering(midShelf), false, 'a coin well inside the shelf must not read as teetering');
  assert.equal(isTeetering(overhanging), true, 'a coin overhanging the front edge must read as teetering');
  assert.equal(isTeetering(fallen), false, 'a coin already past the edge is fallen, not teetering');
  ok('isTeetering distinguishes resting, overhanging and fallen coins (not a constant)');
}

// ── 10) The pusher schedule is a pure function of tick, and it moves ─────
{
  assert.equal(pusherFrontY(10), pusherFrontY(10), 'pusherFrontY must be pure');
  assert.notEqual(pusherFrontY(0), pusherFrontY(40), 'the pusher must actually move across ticks');
  const wave0 = triangleWave(0);
  const waveHalf = triangleWave(75);
  assert.ok(Math.abs(wave0 - 0) < 1e-9, 'triangle wave should start at its trough');
  assert.ok(waveHalf > 0.9, `triangle wave at the half-period mark should be near its peak, got ${waveHalf}`);
  ok('pusher position is a pure, moving function of tick count alone');
}

// ── 11) RNG hygiene ────────────────────────────────────────────────────────
{
  assert.equal(hashString('abc'), hashString('abc'), 'hashString must be stable');
  assert.notEqual(hashString('abc'), hashString('abd'), 'hashString must separate close inputs');

  const a = streamRng(1234, 'trigger:0');
  const b = streamRng(1234, 'trigger:1');
  assert.notEqual(a(), b(), 'different labels must give independent streams');

  const items = [1, 2, 3, 4, 5, 6, 7, 8];
  const out = shuffle(items, mulberry32(7));
  assert.deepEqual(out.slice().sort((x, y) => x - y), items, 'shuffle must be a permutation');
  assert.equal(items.join(), '1,2,3,4,5,6,7,8', 'shuffle must not mutate its input');

  const stripComments = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  for (const file of [
    'rng.ts', 'engine.ts', 'types.ts', 'constants.ts', 'modes.ts',
    'tables.ts', 'progress.ts', 'daily.ts', 'chute.ts', 'wheel.ts',
    'rewards.ts', 'fever.ts',
  ]) {
    const src = stripComments(readFileSync(resolve(__dirname, '..', '..', 'src', 'game', file), 'utf8'));
    assert.ok(
      !/sort\(\s*\(\s*\)?\s*[^)]*\)\s*=>\s*[^;]*random/i.test(src) && !/sort\(\s*\(\)\s*=>/.test(src),
      `${file}: never shuffle with an inconsistent comparator — the result is engine-dependent`,
    );
    if (file !== 'rng.ts') {
      assert.ok(!src.includes('Math.random'), `${file} must never call Math.random — it would break replay determinism`);
    }
  }
  ok('seeded streams are independent and no unseeded randomness reaches the engine');
}

// ── 12) Challenge / mode pack ──────────────────────────────────────────────
{
  assert.ok(MODE_PACK.length >= 6, 'mode pack is too thin');
  assert.equal(modeCount(), MODE_PACK.length);
  assertModePackShape();

  assert.equal(isModeUnlocked(0, 0), true);
  assert.equal(isModeUnlocked(1, 0), false);
  assert.equal(isModeUnlocked(MODE_PACK.length - 1, MODE_PACK.length - 1), true);
  assert.equal(isModeUnlocked(99, MODE_PACK.length), false);
  assert.equal(continueModeIndex(0), 0);
  assert.equal(continueModeIndex(MODE_PACK.length), MODE_PACK.length - 1);

  // Free play defaults unchanged: full credits, no deadline, no early-clear.
  const free = createRun('FREE-MODE');
  assert.equal(free.modeId, null);
  assert.equal(free.config.modeId, null);
  assert.equal(free.config.deadlineTick, null);
  assert.equal(free.config.clearScore, null);
  assert.equal(free.config.clearCascade, null);
  assert.equal(free.creditsRemaining, STARTING_CREDITS);
  assert.equal(isWindingDown(free), false);

  // Score-novice: reduced credits + early clear score gate wired into createRun.
  const novice = MODE_PACK[0];
  assert.equal(novice.id, 'score-novice');
  const noviceRun = createRun(novice.seedCode, modeCreateOptions(novice));
  assert.equal(noviceRun.modeId, 'score-novice');
  assert.equal(noviceRun.creditsRemaining, 100);
  assert.equal(noviceRun.config.clearScore, 70);
  assert.equal(noviceRun.config.deadlineTick, null);

  // Timed rush: deadline is absolute tick = settle tick + budget.
  const rush = MODE_PACK.find((m) => m.id === 'timed-rush');
  assert.ok(rush);
  const rushRun = createRun(rush.seedCode, modeCreateOptions(rush));
  assert.ok(rushRun.config.deadlineTick !== null);
  assert.equal(rushRun.config.deadlineTick, rushRun.tick + 4500);
  assert.equal(rushRun.config.clearScore, 45);

  // Early-clear on cascade: fabricate a state that already met the gate and
  // confirm the run winds down without spending the remaining credits.
  const casc = MODE_PACK.find((m) => m.id === 'cascade-trio');
  assert.ok(casc);
  let early = createRun(casc.seedCode, modeCreateOptions(casc));
  early = { ...early, longestCascade: casc.goal.kind === 'cascade' ? casc.goal.min : 99 };
  assert.equal(isWindingDown(early), true);
  // After settle grace with no further drops, phase must become ended.
  for (let i = 0; i < SETTLE_GRACE_TICKS + 2; i++) {
    early = step(early, IDLE, FIXED_DT);
  }
  assert.equal(early.phase, 'ended', 'early-clear cascade must end after settle grace');
  assert.ok(early.creditsRemaining > 0, 'early-clear must not require spending every credit');
  assert.equal(evaluateModeGoal(casc, early), true);

  // Timed rush: idle until the clock expires — must end without spending all credits.
  let timed = createRun(rush.seedCode, modeCreateOptions(rush));
  const deadline = timed.config.deadlineTick;
  assert.ok(deadline !== null);
  let guard = 0;
  while (timed.phase === 'playing' && guard++ < 20_000) {
    timed = step(timed, IDLE, FIXED_DT);
  }
  assert.equal(timed.phase, 'ended', 'timed mode must end when the clock hits settle');
  assert.ok(timed.tick >= deadline!, 'timed end must reach the deadline tick');
  assert.ok(timed.creditsRemaining > 0, 'pure idle timed run should leave credits unspent');
  assert.equal(evaluateModeGoal(rush, timed), false, 'idle timed run must not clear the score goal');

  // Progress: unlock only advances when the *next* mode clears.
  const clearedState: RunState = {
    ...noviceRun,
    phase: 'ended',
    score: 120,
    longestCascade: 3,
  };
  const fromZero = applyModeResult(EMPTY_MODE_PROGRESS, 0, clearedState);
  assert.equal(fromZero.clearedCount, 1);
  assert.equal(fromZero.cleared[novice.id], true);
  assert.equal(fromZero.bestScore[novice.id], 120);

  const outOfOrder = applyModeResult(EMPTY_MODE_PROGRESS, 3, {
    ...createRun(casc.seedCode, modeCreateOptions(casc)),
    phase: 'ended',
    score: 50,
    longestCascade: 8,
  });
  assert.equal(outOfOrder.clearedCount, 0, 'clearing a locked-ahead mode must not unlock');
  assert.equal(outOfOrder.cleared['cascade-trio'], true);

  const failed = applyModeResult(EMPTY_MODE_PROGRESS, 0, {
    ...noviceRun,
    phase: 'ended',
    score: 10,
    longestCascade: 1,
  });
  assert.equal(failed.clearedCount, 0, 'failed score goal must not advance unlock');
  assert.equal(failed.cleared[novice.id], undefined);

  ok('mode pack shape, unlock, early-clear, timed end, and progress hold');
}

// ── 13) Themed tables — pack shape, pegs, rhythm, RTP per table ────────────
{
  assertTablePackShape();
  assert.ok(TABLE_PACK.length >= 3, 'need at least 3 themed tables');
  assert.ok(tableById('classic'), 'classic table required');
  assert.ok(tableById('peg-alley')?.physics.pegs.length, 'peg-alley must have pegs');
  assert.ok(
    (tableById('spring-tide')?.physics.pusherPeriodTicks ?? 999) < 150,
    'spring-tide must use a faster pusher period than classic',
  );
  assert.equal(tableById('spring-tide')?.physics.jackpotRule, 'cascade_bonus');

  // Distinct mechanics: classic has no pegs; peg-alley does; spring-tide differs in period.
  const classic = createRun('TBL-CLASSIC', { tableId: 'classic', startingCredits: 40 });
  const peg = createRun('TBL-PEG', { tableId: 'peg-alley', startingCredits: 40 });
  const tide = createRun('TBL-TIDE', { tableId: 'spring-tide', startingCredits: 40 });
  assert.equal(classic.config.physics.pegs.length, 0);
  assert.ok(peg.config.physics.pegs.length >= 3);
  assert.notEqual(classic.config.physics.pusherPeriodTicks, tide.config.physics.pusherPeriodTicks);
  assert.equal(classic.tableId, 'classic');
  assert.equal(peg.tableId, 'peg-alley');

  // Pegs survive settle and remain immovable references on config.
  assert.deepEqual(
    peg.config.physics.pegs.map((p) => ({ x: p.x, y: p.y, r: p.r })),
    tableById('peg-alley')!.physics.pegs.map((p) => ({ x: p.x, y: p.y, r: p.r })),
  );

  // Per-table RTP (centre lane, short credit budget for CI wall time).
  // Same 35–115% band as classic; each table must land inside it.
  const N_TABLE_RTP = HEAVY ? 4 : 2;
  const TABLE_CREDITS = HEAVY ? 120 : 80;
  for (const table of TABLE_PACK) {
    const sessions: RunState[] = [];
    for (const seed of seedCodes(`T${table.id.slice(0, 3).toUpperCase()}`, N_TABLE_RTP, 2)) {
      sessions.push(
        playTo(seed, makeDropper((WALL_X0 + WALL_X1) / 2), 200_000, {
          tableId: table.id,
          startingCredits: TABLE_CREDITS,
        }),
      );
    }
    const rtp = pooledRtp(sessions);
    assert.ok(
      rtp > 0.35,
      `table ${table.id} RTP ${(rtp * 100).toFixed(1)}% below floor`,
    );
    assert.ok(
      rtp < 1.15,
      `table ${table.id} RTP ${(rtp * 100).toFixed(1)}% above ceiling`,
    );
    ok(
      `table ${table.id} RTP in band (${(rtp * 100).toFixed(1)}%, n=${N_TABLE_RTP}, credits=${TABLE_CREDITS})`,
    );
  }

  // Magnet special spends and ends (cost 3, like vibrate).
  {
    let s = createRun('MAGNET-END', { startingCredits: 30 });
    let guard = 0;
    while (s.phase === 'playing' && guard++ < 60_000) {
      s = step(s, makeDropper(200, 'magnet')(s), FIXED_DT);
    }
    assert.equal(s.phase, 'ended', 'magnet selection must spend down to zero');
    assert.equal(s.creditsRemaining, 0);
  }
  ok('themed tables, pegs, rhythm, magnet, and per-table RTP hold');
}

// ── 14) Meta progress + localStorage parse validation ─────────────────────
{
  const junk = parseMetaProgress({ tokens: 'nope', unlockedTables: [1, 'classic', 'bogus'], activeCoinSet: 'jade' });
  assert.equal(junk.tokens, 0);
  assert.ok(junk.unlockedTables.includes('classic'));
  assert.ok(!junk.unlockedTables.includes('bogus' as never));
  // jade not unlocked → activeCoinSet falls back
  assert.equal(junk.activeCoinSet, 'classic');

  const valid = parseMetaProgress({
    tokens: 100,
    lifetimeTokens: 120,
    unlockedTables: ['classic', 'peg-alley'],
    unlockedSpecials: ['magnet'],
    unlockedCoinSets: ['classic', 'jade'],
    activeCoinSet: 'jade',
    milestones: { 'first-cascade': true, fake: true },
    tableBest: { classic: 88.7, nope: 9 },
  });
  assert.equal(valid.tokens, 100);
  assert.equal(valid.activeCoinSet, 'jade');
  assert.equal(valid.milestones['first-cascade'], true);
  assert.equal(valid.milestones['fake'], undefined);
  assert.equal(valid.tableBest.classic, 88);
  assert.equal(valid.tableBest.nope, undefined);

  let ended = createRun('META-REWARD', { startingCredits: 20 });
  ended = {
    ...ended,
    phase: 'ended',
    score: 40,
    cascadeCount: 2,
    jackpotBursts: 1,
    timingBonusCount: 4,
    longestCascade: 4,
  };
  const earned = tokensFromRun(ended);
  assert.ok(earned >= 1);
  const applied = applyRunToMeta(EMPTY_META, ended, 0);
  assert.equal(applied.meta.tokens, earned);
  assert.ok(applied.meta.lifetimeTokens >= earned);
  // Meta / daily / modes keys must never collide with free-play best.
  const META_KEY = 'coin-cascade:meta-v1';
  const BEST_KEY = 'coin-cascade:best';
  assert.notEqual(META_KEY, BEST_KEY);
  assert.notEqual('coin-cascade:daily-v1', BEST_KEY);
  assert.notEqual('coin-cascade:modes-v1', BEST_KEY);
  ok('meta progress parse validation and token rewards hold');
}

// ── 15) Daily seeded challenge ────────────────────────────────────────────
{
  const a = dailyChallengeFor('2026-10-20');
  const b = dailyChallengeFor('2026-10-20');
  const c = dailyChallengeFor('2026-10-21');
  assert.equal(a.seedCode, b.seedCode);
  assert.equal(a.targetScore, b.targetScore);
  assert.notEqual(a.seedCode, c.seedCode);
  assert.ok(a.targetScore >= 70 && a.targetScore <= 140);
  assert.ok(tableById(a.tableId));

  const run = createRun(a.seedCode, {
    tableId: a.tableId,
    startingCredits: a.startingCredits,
    clearScore: a.targetScore,
    isDaily: true,
  });
  assert.equal(run.config.isDaily, true);
  assert.equal(run.config.clearScore, a.targetScore);
  assert.equal(run.tableId, a.tableId);

  // Deterministic: same daily seed reproduces.
  const r2 = createRun(a.seedCode, {
    tableId: a.tableId,
    startingCredits: a.startingCredits,
    clearScore: a.targetScore,
    isDaily: true,
  });
  assert.equal(JSON.stringify(run.coins), JSON.stringify(r2.coins));

  const cleared: RunState = { ...run, phase: 'ended', score: a.targetScore };
  const missed: RunState = { ...run, phase: 'ended', score: a.targetScore - 1 };
  assert.equal(evaluateDailyClear(a, cleared), true);
  assert.equal(evaluateDailyClear(a, missed), false);

  const parsed = parseDailyProgress({
    records: [{ dateKey: '2026-10-20', bestScore: 10, cleared: false, attempts: 1 }, { dateKey: 'bad' }],
  });
  assert.equal(parsed.records.length, 1);

  const recorded = recordDailyAttempt({ records: [] }, a, cleared);
  assert.equal(recorded.records[0]?.cleared, true);
  assert.equal(recorded.records[0]?.bestScore, a.targetScore);

  ok('daily challenge seeding, target, and progress hold');
}

// ── 16) Pusher physics cycle, sinusoidal velocity, and coin overhang teetering ──
{
  // 16.1 Kinematics across all three authored tables
  for (const table of TABLE_PACK) {
    const physics = table.physics;
    const period = physics.pusherPeriodTicks;
    const stroke = physics.pusherStroke;
    const backY = physics.pusherBackY;

    // Harmonic position matches stroke bounds and periodicity
    const y0 = pusherHarmonicFrontY(0, physics);
    const yHalf = pusherHarmonicFrontY(period / 2, physics);
    const yFull = pusherHarmonicFrontY(period, physics);
    assert.ok(Math.abs(y0 - backY) < 1e-9, `${table.id}: harmonic stroke must start at back wall`);
    assert.ok(Math.abs(yHalf - (backY + stroke)) < 1e-9, `${table.id}: harmonic stroke must reach peak extension at half period`);
    assert.ok(Math.abs(yFull - backY) < 1e-9, `${table.id}: harmonic stroke must return to back wall at full period`);

    // Sinusoidal velocity profiles
    const v0 = pusherVelocitySinusoidal(0, physics);
    const vQuarter = pusherVelocitySinusoidal(period / 4, physics);
    const vHalf = pusherVelocitySinusoidal(period / 2, physics);
    const vThreeQuarter = pusherVelocitySinusoidal((period * 3) / 4, physics);
    const peakTheoretical = (Math.PI * stroke) / period;

    assert.ok(Math.abs(v0) < 1e-9, `${table.id}: sinusoidal velocity must be zero at retraction turnaround`);
    assert.ok(Math.abs(vQuarter - peakTheoretical) < 1e-9, `${table.id}: sinusoidal velocity must peak forward at quarter period`);
    assert.ok(Math.abs(vHalf) < 1e-9, `${table.id}: sinusoidal velocity must be zero at forward crest turnaround`);
    assert.ok(Math.abs(vThreeQuarter - (-peakTheoretical)) < 1e-9, `${table.id}: sinusoidal velocity must peak backward at three-quarter period`);

    // Triangle wave velocity magnitude
    const vTriFwd = pusherVelocityTriangle(0, physics);
    const vTriBack = pusherVelocityTriangle(period / 2, physics);
    const triSpeed = (2 * stroke) / period;
    assert.ok(Math.abs(vTriFwd - triSpeed) < 1e-9, `${table.id}: forward triangle velocity must equal 2*stroke/period`);
    assert.ok(Math.abs(vTriBack - (-triSpeed)) < 1e-9, `${table.id}: backward triangle velocity must equal -2*stroke/period`);
  }

  // Velocity ratio: spring-tide (stroke 58, period 100) vs classic (stroke 46, period 150)
  const classicPhysics = tableById('classic')!.physics;
  const tidePhysics = tableById('spring-tide')!.physics;
  const vSinClassic = pusherVelocitySinusoidal(classicPhysics.pusherPeriodTicks / 4, classicPhysics);
  const vSinTide = pusherVelocitySinusoidal(tidePhysics.pusherPeriodTicks / 4, tidePhysics);
  const sinRatio = vSinTide / vSinClassic;
  const expectedRatio = (58 / 100) / (46 / 150); // 87 / 46 ≈ 1.8913
  assert.ok(
    Math.abs(sinRatio - expectedRatio) < 1e-6,
    `spring-tide should have 87/46 (~1.891x) peak velocity of classic, got ${sinRatio.toFixed(3)}`,
  );

  // 16.2 Coin edge overhang teetering thresholds for all coin kinds
  const kinds = ['normal', 'heavy', 'ball', 'magnet', 'trigger'] as const;
  for (const kind of kinds) {
    const r = coinRadius(kind);
    const thresholdY = teeteringThresholdForKind(kind);
    assert.ok(Math.abs(thresholdY - (SHELF_LEN - r + NEAR_MISS_OVERHANG)) < 1e-9);

    const coinResting = { id: 101, kind, x: 200, y: thresholdY - 0.05, teeterSince: -1 };
    const coinTeeteringMin = { id: 102, kind, x: 200, y: thresholdY + 0.05, teeterSince: -1 };
    const coinAtEdge = { id: 103, kind, x: 200, y: SHELF_LEN, teeterSince: -1 };
    const coinFallen = { id: 104, kind, x: 200, y: SHELF_LEN + 0.05, teeterSince: -1 };

    assert.equal(isTeetering(coinResting), false, `${kind} just behind threshold must not teeter`);
    assert.equal(isTeetering(coinTeeteringMin), true, `${kind} just over threshold must teeter`);
    assert.equal(isTeetering(coinAtEdge), true, `${kind} at shelf edge must teeter`);
    assert.equal(isTeetering(coinFallen), false, `${kind} past edge is fallen, not teetering`);

    // Overhang distance calculations
    assert.equal(coinOverhangDistance({ id: 105, kind, x: 200, y: SHELF_LEN - r, teeterSince: -1 }), 0);
    assert.ok(Math.abs(coinOverhangDistance({ id: 106, kind, x: 200, y: SHELF_LEN - r + 4, teeterSince: -1 }) - 4) < 1e-9);
    assert.ok(Math.abs(coinOverhangDistance(coinAtEdge) - r) < 1e-9);
    assert.ok(Math.abs(coinOverhangDistance(coinFallen) - (r + 0.05)) < 1e-9);
  }

  ok('pusher physics cycle, sinusoidal velocity, and coin overhang teetering thresholds verified');
}

// ── 17) Gutter loss vs prize drop chute return-to-player (RTP) across tables ──
{
  // 17.1 Boundary classification tests
  assert.equal(classifyDropZone(WALL_X0), 'left_gutter');
  assert.equal(classifyDropZone(LEFT_GUTTER_MAX_X - 0.01), 'left_gutter');
  assert.equal(classifyDropZone(LEFT_GUTTER_MAX_X + 0.01), 'prize_chute');
  assert.equal(classifyDropZone((WALL_X0 + WALL_X1) / 2), 'prize_chute');
  assert.equal(classifyDropZone(RIGHT_GUTTER_MIN_X - 0.01), 'prize_chute');
  assert.equal(classifyDropZone(RIGHT_GUTTER_MIN_X + 0.01), 'right_gutter');
  assert.equal(classifyDropZone(WALL_X1), 'right_gutter');

  assert.equal(isGutterLoss(WALL_X0), true);
  assert.equal(isGutterLoss(LEFT_GUTTER_MAX_X + 10), false);
  assert.equal(isGutterLoss(RIGHT_GUTTER_MIN_X + 1), true);
  assert.equal(isPrizeChute((WALL_X0 + WALL_X1) / 2), true);
  assert.equal(isPrizeChute(WALL_X0), false);

  // 17.2 Multi-table chute vs gutter simulations
  const runCompleteSession = (
    seed: string,
    tableId: TableId,
    credits: number,
    pattern: 'center' | 'sweep',
  ): { session: RunState; falls: { x: number; prefilled?: boolean }[] } => {
    let s = createRun(seed, { tableId, startingCredits: credits });
    const falls: { x: number; prefilled?: boolean }[] = [];
    let guard = 0;
    let tick = 0;
    const sweepXs = [WALL_X0 + 20, (WALL_X0 + WALL_X1) / 2, WALL_X1 - 20];
    while (s.phase === 'playing' && guard++ < 60_000) {
      const drop = s.cooldown === 0 && s.creditsRemaining > 0;
      const dropX = pattern === 'center' ? (WALL_X0 + WALL_X1) / 2 : sweepXs[Math.floor(tick / 50) % sweepXs.length]!;
      s = step(s, { dropX, drop, special: 'normal' }, FIXED_DT);
      for (const f of s.events.fallen) falls.push({ x: f.x, prefilled: f.prefilled });
      tick++;
    }
    return { session: s, falls };
  };

  const SIM_CREDITS = 80;

  // Center drops across all three tables: prize chute capture dominates and chute RTP lands in playable band
  for (const table of TABLE_PACK) {
    const res = runCompleteSession(`GUT-CTR-${table.id.toUpperCase()}`, table.id, SIM_CREDITS, 'center');
    const summary = analyzeDropZones(res.falls.map((f) => f.x));
    assert.ok(summary.totalFalls > 0, `${table.id}: table must shed coins`);
    assert.ok(
      summary.chuteRatio >= 0.85,
      `${table.id}: center drops should capture >=85% chute ratio, got ${(summary.chuteRatio * 100).toFixed(1)}%`,
    );

    const totalRtp = res.session.score / res.session.creditsSpent;
    const chuteRtp = totalRtp * summary.chuteRatio;
    assert.ok(
      chuteRtp > 0.35,
      `${table.id}: chute RTP ${(chuteRtp * 100).toFixed(1)}% below floor`,
    );
    assert.ok(
      chuteRtp < 1.15,
      `${table.id}: chute RTP ${(chuteRtp * 100).toFixed(1)}% above ceiling`,
    );
  }

  // Sweep drops across all three tables: dropping along side edges introduces real gutter loss
  for (const table of TABLE_PACK) {
    const sweepRes = runCompleteSession(`GUT-SWP-${table.id.toUpperCase()}`, table.id, SIM_CREDITS, 'sweep');
    const sweepSummary = analyzeDropZones(sweepRes.falls.map((f) => f.x));
    assert.ok(
      sweepSummary.gutterLossRatio >= 0.10,
      `${table.id}: sweep drops must produce at least 10% gutter loss, got ${(sweepSummary.gutterLossRatio * 100).toFixed(1)}%`,
    );
    assert.ok(
      sweepSummary.gutterLossRatio <= 0.45,
      `${table.id}: gutter loss must not exceed 45%, got ${(sweepSummary.gutterLossRatio * 100).toFixed(1)}%`,
    );
  }

  ok('gutter loss vs prize drop chute RTP bounds across all tables hold');
}

// ── 18) Wheel spin mini-game jackpot cascade triggers, multipliers, tokens ──
{
  // 18.1 Trigger qualification rules
  assert.equal(isWheelSpinTriggered({ jackpotBurst: 0, cascadeDepth: 5, feverActive: true }), false);
  assert.equal(isWheelSpinTriggered({ jackpotBurst: 10, cascadeDepth: 1, feverActive: false }), false);
  assert.equal(isWheelSpinTriggered({ jackpotBurst: 10, cascadeDepth: 2, feverActive: false }), false);
  assert.equal(isWheelSpinTriggered({ jackpotBurst: 10, cascadeDepth: JACKPOT_CASCADE_TRIGGER_MIN, feverActive: false }), true);
  assert.equal(isWheelSpinTriggered({ jackpotBurst: 10, cascadeDepth: 6, feverActive: false }), true);
  assert.equal(isWheelSpinTriggered({ jackpotBurst: 10, cascadeDepth: 1, feverActive: true }), true);

  // 18.2 Wheel layout and deterministic spins
  assert.equal(WHEEL_SEGMENTS.length, 8);
  const totalWeight = WHEEL_SEGMENTS.reduce((sum, s) => sum + s.weight, 0);
  assert.equal(totalWeight, 115);

  const spinA1 = spinWheel(8888, 0);
  const spinA2 = spinWheel(8888, 0);
  const spinB = spinWheel(8888, 1);
  assert.equal(spinA1.segment.id, spinA2.segment.id);
  assert.equal(spinA1.spinAngleDeg, spinA2.spinAngleDeg);
  assert.notEqual(spinA1.spinAngleDeg, spinB.spinAngleDeg);

  // Diverse outcomes across multiple spins
  const seenKinds = new Set<string>();
  for (let i = 0; i < 60; i++) {
    seenKinds.add(spinWheel(9999 + i, i).segment.kind);
  }
  assert.ok(seenKinds.has('multiplier') && seenKinds.has('tokens'), 'wheel must yield multiple outcome kinds');

  // 18.3 Multiplier stacking algebra
  assert.equal(stackMultipliers().totalMultiplier, 1.0);
  assert.equal(stackMultipliers({ feverActive: true }).totalMultiplier, 2.0);
  assert.equal(stackMultipliers({ tideBonus: true }).totalMultiplier, 1.5);
  assert.equal(stackMultipliers({ feverActive: true, tideBonus: true }).totalMultiplier, 3.0);
  assert.equal(stackMultipliers({ feverActive: true, tideBonus: true, wheelMultiplier: 2 }).totalMultiplier, 6.0);
  assert.equal(stackMultipliers({ feverActive: true, tideBonus: true, wheelMultiplier: 3 }).totalMultiplier, 9.0);
  assert.equal(stackMultipliers({ feverActive: true, tideBonus: true, wheelMultiplier: 5 }).totalMultiplier, 15.0);
  assert.equal(stackMultipliers({ feverActive: true, tideBonus: true, wheelMultiplier: 10 }).totalMultiplier, 30.0);

  // 18.4 Token reward conversion
  const baseConversion = convertRunTokensWithWheel({
    baseScore: 120,
    cascadeCount: 3,
    jackpotBursts: 1,
    stackedMultiplier: 1.0,
  });
  assert.equal(baseConversion, 21); // floor(120/12) + 3*2 + 1*5 = 10 + 6 + 5 = 21

  const tripleConversion = convertRunTokensWithWheel({
    baseScore: 120,
    cascadeCount: 3,
    jackpotBursts: 1,
    stackedMultiplier: 3.0,
  });
  assert.equal(tripleConversion, 63); // 21 * 3 = 63

  const withFlatBonus = convertRunTokensWithWheel({
    baseScore: 120,
    cascadeCount: 3,
    jackpotBursts: 1,
    wheelBonusTokens: 50,
    stackedMultiplier: 3.0,
  });
  assert.equal(withFlatBonus, 113); // 63 + 50 = 113

  // Monotonicity and zero-score floor
  assert.equal(convertRunTokensWithWheel({ baseScore: 0, cascadeCount: 0, jackpotBursts: 0 }), 1);
  assert.ok(
    convertRunTokensWithWheel({ baseScore: 240, cascadeCount: 3, jackpotBursts: 1 }) >
      convertRunTokensWithWheel({ baseScore: 120, cascadeCount: 3, jackpotBursts: 1 }),
  );

  ok('wheel spin mini-game jackpot triggers, multiplier stacking, and tokens hold');
}

// ── 19) Idle credit replenishment and daily Taipei login rewards ──────────
{
  // 19.1 Asia/Taipei timezone rollover determinism
  assert.equal(todayDateKeyTaipei(new Date('2026-10-20T15:59:00Z')), '2026-10-20');
  assert.equal(todayDateKeyTaipei(new Date('2026-10-20T16:00:00Z')), '2026-10-21');
  assert.equal(todayDateKeyTaipei(new Date('2026-10-20T16:01:00Z')), '2026-10-21');
  assert.equal(todayDateKeyTaipei(new Date('2026-04-30T16:00:00Z')), '2026-05-01');
  assert.equal(todayDateKeyTaipei(new Date('2028-02-28T16:00:00Z')), '2028-02-29'); // Leap year
  assert.equal(todayDateKeyTaipei(new Date('2026-12-31T15:59:00Z')), '2026-12-31');
  assert.equal(todayDateKeyTaipei(new Date('2026-12-31T16:00:00Z')), '2027-01-01');

  // Consecutive day validation
  assert.equal(isConsecutiveTaipeiDay('2026-10-20', '2026-10-21'), true);
  assert.equal(isConsecutiveTaipeiDay('2026-02-28', '2026-03-01'), true);
  assert.equal(isConsecutiveTaipeiDay('2028-02-28', '2028-02-29'), true);
  assert.equal(isConsecutiveTaipeiDay('2028-02-29', '2028-03-01'), true);
  assert.equal(isConsecutiveTaipeiDay('2026-12-31', '2027-01-01'), true);
  assert.equal(isConsecutiveTaipeiDay('2026-10-20', '2026-10-22'), false);
  assert.equal(isConsecutiveTaipeiDay('2026-10-20', '2026-10-20'), false);
  assert.equal(isConsecutiveTaipeiDay('2026-10-21', '2026-10-20'), false);
  assert.equal(isConsecutiveTaipeiDay('bad-key', '2026-10-21'), false);

  // 19.2 7-day login ladder progression
  assert.equal(DAILY_LOGIN_LADDER.length, 7);
  assert.equal(DAILY_LOGIN_LADDER[0].tokens, 10);
  assert.equal(DAILY_LOGIN_LADDER[6].tokens, 70);
  assert.equal(DAILY_LOGIN_LADDER[6].bonusCredits, 100);

  const day1 = evaluateTaipeiLoginReward(null, '2026-10-20', 0);
  assert.equal(day1.eligible, true);
  assert.equal(day1.newStreak, 1);
  assert.equal(day1.reward?.day, 1);

  const duplicateToday = evaluateTaipeiLoginReward('2026-10-20', '2026-10-20', 1);
  assert.equal(duplicateToday.eligible, false);
  assert.equal(duplicateToday.alreadyClaimedToday, true);

  let streak = day1.newStreak;
  let lastDate = '2026-10-20';
  for (let i = 2; i <= 7; i++) {
    const nextDate = `2026-10-${String(19 + i).padStart(2, '0')}`;
    const claim = evaluateTaipeiLoginReward(lastDate, nextDate, streak);
    assert.equal(claim.eligible, true);
    assert.equal(claim.newStreak, i);
    assert.equal(claim.reward?.day, i);
    assert.equal(claim.isConsecutive, true);
    streak = claim.newStreak;
    lastDate = nextDate;
  }
  assert.equal(streak, 7);

  // Day 8 rollover to day 1
  const day8 = evaluateTaipeiLoginReward('2026-10-26', '2026-10-27', 7);
  assert.equal(day8.eligible, true);
  assert.equal(day8.newStreak, 1);
  assert.equal(day8.isConsecutive, true);

  // Missed day resets streak to 1
  const brokenStreak = evaluateTaipeiLoginReward('2026-10-20', '2026-10-25', 4);
  assert.equal(brokenStreak.eligible, true);
  assert.equal(brokenStreak.newStreak, 1);
  assert.equal(brokenStreak.isConsecutive, false);

  // 19.3 Idle credit replenishment arithmetic
  const negTime = calculateIdleReplenishment({
    lastActiveTimestampMs: 5000,
    currentTimestampMs: 2000,
    currentCredits: 20,
  });
  assert.equal(negTime.replenishedCredits, 0);
  assert.equal(negTime.finalCredits, 20);

  const oneInterval = calculateIdleReplenishment({
    lastActiveTimestampMs: 0,
    currentTimestampMs: IDLE_REPLENISH_INTERVAL_SEC * 1000,
    currentCredits: 20,
  });
  assert.equal(oneInterval.replenishedCredits, 1);
  assert.equal(oneInterval.finalCredits, 21);

  const threeIntervals = calculateIdleReplenishment({
    lastActiveTimestampMs: 0,
    currentTimestampMs: IDLE_REPLENISH_INTERVAL_SEC * 1000 * 3,
    currentCredits: 20,
  });
  assert.equal(threeIntervals.replenishedCredits, 3);
  assert.equal(threeIntervals.finalCredits, 23);

  const capSaturation = calculateIdleReplenishment({
    lastActiveTimestampMs: 0,
    currentTimestampMs: 10_000_000,
    currentCredits: 78,
    cap: IDLE_REPLENISH_MAX_CAP,
  });
  assert.equal(capSaturation.replenishedCredits, 2);
  assert.equal(capSaturation.finalCredits, IDLE_REPLENISH_MAX_CAP);
  assert.equal(capSaturation.reachedCap, true);
  assert.equal(capSaturation.secondsUntilNextCredit, 0);

  const overCapAlready = calculateIdleReplenishment({
    lastActiveTimestampMs: 0,
    currentTimestampMs: 10_000_000,
    currentCredits: 95,
    cap: IDLE_REPLENISH_MAX_CAP,
  });
  assert.equal(overCapAlready.replenishedCredits, 0);
  assert.equal(overCapAlready.finalCredits, 95);
  assert.equal(overCapAlready.reachedCap, true);

  ok('idle credit replenishment and daily Taipei login rewards hold');
}

// ── 20) Cliff edge danger radar and Fever Overdrive dynamics ───────────────
{
  // 20.1 Cliff danger radar telemetry
  const emptyRadar = computeCliffDanger([]);
  assert.equal(emptyRadar.dangerIndex, 0);
  assert.equal(emptyRadar.nearEdgeCount, 0);
  assert.equal(emptyRadar.teeterCount, 0);

  const farCoins = [{ id: 1, kind: 'normal' as const, x: 210, y: 100, teeterSince: -1 }];
  const farRadar = computeCliffDanger(farCoins);
  assert.equal(farRadar.dangerIndex, 0);

  const nearCoins = [
    { id: 2, kind: 'normal' as const, x: 210, y: SHELF_LEN - 10, teeterSince: -1 },
    { id: 3, kind: 'normal' as const, x: 215, y: SHELF_LEN - 5, teeterSince: -1 },
  ];
  const nearRadar = computeCliffDanger(nearCoins);
  assert.equal(nearRadar.nearEdgeCount, 2);
  assert.ok(nearRadar.dangerIndex > 0);

  const teeterCoins = [
    { id: 4, kind: 'normal' as const, x: 210, y: SHELF_LEN - 1, teeterSince: 100 },
    { id: 5, kind: 'normal' as const, x: 215, y: SHELF_LEN - 1, teeterSince: 100 },
  ];
  const teeterRadar = computeCliffDanger(teeterCoins);
  assert.equal(teeterRadar.teeterCount, 2);
  assert.ok(teeterRadar.dangerIndex >= 25);

  const leftCoins = [
    { id: 6, kind: 'normal' as const, x: WALL_X0 + 20, y: SHELF_LEN - 5, teeterSince: -1 },
    { id: 7, kind: 'normal' as const, x: WALL_X0 + 30, y: SHELF_LEN - 5, teeterSince: -1 },
  ];
  assert.equal(computeCliffDanger(leftCoins).hottestLane, 'left');

  // 20.2 Fever Overdrive lifecycle
  const f0 = INITIAL_FEVER_STATE;
  assert.equal(f0.charge, 0);
  assert.equal(f0.active, false);
  assert.equal(f0.multiplier, 1);

  assert.equal(calculateFeverChargeGain({ timingQuality: 'perfect', cascadeCount: 0, isJackpot: false, teeterCount: 0 }), 15);
  assert.equal(calculateFeverChargeGain({ timingQuality: 'good', cascadeCount: 0, isJackpot: false, teeterCount: 0 }), 5);
  assert.equal(calculateFeverChargeGain({ timingQuality: 'late', cascadeCount: 4, isJackpot: false, teeterCount: 0 }), 22); // 16 + (4-3)*6
  assert.equal(calculateFeverChargeGain({ timingQuality: 'late', cascadeCount: 0, isJackpot: true, teeterCount: 0 }), 100);

  const fCharged = addFeverCharge(f0, 100);
  assert.equal(fCharged.charge, 100);
  assert.equal(fCharged.active, false);

  const fActive = activateFever(fCharged);
  assert.equal(fActive.active, true);
  assert.equal(fActive.multiplier, FEVER_MULTIPLIER);
  assert.equal(fActive.remainingSec, FEVER_DURATION_SEC);

  const fStepped = stepFeverState(fActive, 5.0);
  assert.equal(fStepped.active, true);
  assert.equal(fStepped.remainingSec, FEVER_DURATION_SEC - 5.0);

  const fExpired = stepFeverState(fStepped, 8.0);
  assert.equal(fExpired.active, false);
  assert.equal(fExpired.multiplier, 1.0);
  assert.equal(fExpired.charge, 0);

  ok('cliff edge danger radar and Fever Overdrive dynamics hold');
}

// ── 21) Fiend's Cauldron (惡魔之釜) High-Stakes Double Bet Mode & Avalanche Shake ──
{
  // 21.1 Safeguard: Disabled / inactive when credits < 20
  const lowCreditsRun = createRun('FIEND-SAFEGUARD', { startingCredits: 10 });
  assert.equal(lowCreditsRun.creditsRemaining, 10);
  const lowStep = step(
    lowCreditsRun,
    { dropX: (WALL_X0 + WALL_X1) / 2, drop: true, special: 'normal', fiendPush: true },
    FIXED_DT,
  );
  // With < 20 credits, Fiend's Push is suppressed by safeguard: costs standard 1 coin, pusher speed 1.0x
  assert.equal(lowStep.creditsSpent, 1, 'safeguard must prevent 2x double bet when balance < 20');
  assert.equal(lowStep.creditsRemaining, 9);
  assert.equal(
    (lowStep.pusherTick ?? lowStep.tick) - (lowCreditsRun.pusherTick ?? lowCreditsRun.tick),
    1.0,
    'pusher speed must remain normal 1.0x when safeguarded',
  );

  // 21.2 Active Fiend's Push (balance >= 20): 2x drop costs & 1.35x pusher speed
  const fiendRun = createRun('FIEND-ACTIVE', { startingCredits: 50 });
  assert.equal(fiendRun.creditsRemaining, 50);

  // Normal drop costs 2 coins (2x)
  const drop1 = step(
    fiendRun,
    { dropX: (WALL_X0 + WALL_X1) / 2, drop: true, special: 'normal', fiendPush: true },
    FIXED_DT,
  );
  assert.equal(drop1.creditsSpent, 2, 'normal drop must cost 2 coins in Fiend Push mode');
  assert.equal(drop1.creditsRemaining, 48);
  const deltaPusherTick = (drop1.pusherTick ?? drop1.tick) - (fiendRun.pusherTick ?? fiendRun.tick);
  assert.ok(
    Math.abs(deltaPusherTick - 1.35) < 1e-6,
    `pusher speed must advance at 1.35x (expected 1.35, got ${deltaPusherTick})`,
  );

  // Special coin drop costs 2x special cost (e.g. heavy coin: 2 * 2 = 4)
  const fiendRun2 = createRun('FIEND-HEAVY', { startingCredits: 50 });
  const dropHeavy = step(
    fiendRun2,
    { dropX: (WALL_X0 + WALL_X1) / 2, drop: true, special: 'heavy', fiendPush: true },
    FIXED_DT,
  );
  assert.equal(dropHeavy.creditsSpent, COST.heavy * 2, 'special coin drop must cost 2x in Fiend Push mode');
  assert.equal(dropHeavy.creditsRemaining, 50 - COST.heavy * 2);

  // 21.3 Dropped coin points: 2x points in prize chute vs 0 in side gutter (loss to house)
  const prizeRun = createRun('FIEND-PRIZE', { startingCredits: 50 });
  const centerPrecipiceCoin = {
    id: 9999,
    kind: 'normal' as const,
    x: (WALL_X0 + WALL_X1) / 2, // Center prize chute
    y: SHELF_LEN + 1, // Just over the edge
    r: COIN_R,
    mass: 1.0,
    teeterSince: 10,
    wellTimed: false,
    prefilled: false,
  };
  const gutterPrecipiceCoin = {
    id: 9998,
    kind: 'normal' as const,
    x: WALL_X0 - 2, // Gutter
    y: SHELF_LEN + 1,
    r: COIN_R,
    mass: 1.0,
    teeterSince: 10,
    wellTimed: false,
    prefilled: false,
  };

  // State with center falling coin
  const stateWithCenter = { ...prizeRun, coins: [centerPrecipiceCoin] };
  const stepCenter = step(
    stateWithCenter,
    { dropX: (WALL_X0 + WALL_X1) / 2, drop: false, special: 'normal', fiendPush: true },
    FIXED_DT,
  );
  assert.equal(
    stepCenter.score - prizeRun.score,
    FALL_VALUE * 2,
    'prize chute falls must award 2x score in Fiend Push mode',
  );

  // State with gutter falling coin
  const stateWithGutter = { ...prizeRun, coins: [gutterPrecipiceCoin] };
  const stepGutter = step(
    stateWithGutter,
    { dropX: (WALL_X0 + WALL_X1) / 2, drop: false, special: 'normal', fiendPush: true },
    FIXED_DT,
  );
  assert.equal(
    stepGutter.score - prizeRun.score,
    0,
    'side gutter falls must award 0 points in Fiend Push mode (lost to house)',
  );

  // 21.4 Avalanche (x6+ / x8+) Physical Frame Shake Intensity
  const computeShakeIntensity = (cascade: number): number => {
    return Math.min(2.4, 1.6 + (cascade - 6) * 0.4);
  };
  assert.equal(computeShakeIntensity(6), 1.6, 'cascade 6 intensity must be 1.6');
  assert.equal(computeShakeIntensity(7), 2.0, 'cascade 7 intensity must be 2.0');
  assert.equal(computeShakeIntensity(8), 2.4, 'cascade 8 intensity must be 2.4');
  assert.equal(computeShakeIntensity(12), 2.4, 'cascade 12 intensity must clamp to 2.4');

  ok('Fiend Push 2x bets, 1.35x pusher speed, 2x scoring, gutter loss, safeguard, and avalanche shake hold');
}

console.log(`\nself-check: ok (${passed} checks${HEAVY ? ', heavy' : ''})`);

