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
  CASCADE_MIN,
  FIXED_DT,
  MAX_COINS_ON_SHELF,
  SHELF_LEN,
  STARTING_CREDITS,
  WALL_X0,
  WALL_X1,
} from '../src/game/constants.js';
import { coinRadius, createRun, isTeetering, pusherFrontY, step, triangleWave } from '../src/game/engine.js';
import { hashString, mulberry32, shuffle, streamRng } from '../src/game/rng.js';
import type { PlayerInput, RunState } from '../src/game/types.js';

let passed = 0;
function ok(label: string): void {
  passed += 1;
  console.log(`  ok  ${label}`);
}

const IDLE: PlayerInput = { dropX: 210, drop: false, special: 'normal' };

/** A pilot that drops wherever `laneX` is once its cooldown clears, otherwise idles. Deterministic: no randomness of its own. */
function makeDropper(laneX: number, special: PlayerInput['special'] = 'normal'): (s: RunState) => PlayerInput {
  return (s: RunState) => ({ dropX: laneX, drop: s.phase === 'playing', special });
}

function playTo(
  seedCode: string,
  pilot: (s: RunState) => PlayerInput,
  maxTicks = 200_000,
): RunState {
  let s = createRun(seedCode);
  let guard = 0;
  while (s.phase === 'playing' && guard++ < maxTicks) {
    s = step(s, pilot(s), FIXED_DT);
  }
  return s;
}

// ── 1) Determinism — the entire premise ──────────────────────────────────
{
  const r = mulberry32(4242);
  const inputs: PlayerInput[] = [];
  for (let i = 0; i < 4000; i++) {
    const specials: PlayerInput['special'][] = ['normal', 'normal', 'normal', 'heavy', 'ball', 'vibrate'];
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
  ok('same seed + same inputs reproduce the run exactly (bit-identical JSON over 4000 mixed-action ticks)');

  const c = createRun('OTHER1');
  assert.notEqual(c.seed, a.seed, 'different seed codes must give different seeds');
  ok('different seed codes give different runs');
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

// ── 3) RTP sits inside the measured playable band, two-sided ────────────
//
// The band itself is derived and documented in scripts/balance.ts and the
// README, not invented here. This check only asserts the number stays where
// balance.ts measured it, using the SAME centre-lane pilot so the two numbers
// are comparable. It is two-sided on purpose: a ceiling alone would let RTP
// drift up to "you can never lose" without anything ever turning red.
{
  const SEEDS = ['RTPA01', 'RTPA02', 'RTPA03', 'RTPA04', 'RTPA05', 'RTPA06', 'RTPA07', 'RTPA08'];
  let recovered = 0;
  let spent = 0;
  for (const seed of SEEDS) {
    const s = playTo(seed, makeDropper(SHELF_LEN > 0 ? (WALL_X0 + WALL_X1) / 2 : 0));
    recovered += s.score;
    spent += s.creditsSpent;
  }
  const rtp = recovered / spent;
  // Band: see README "量測結果" for the full-precision measurement and CI;
  // this is deliberately a wide band so ordinary balance noise never trips it,
  // while a genuinely broken payout (e.g. an accidental 2x fall value, or a
  // solver change that stops coins ever reaching the edge) will.
  assert.ok(rtp > 0.35, `RTP measured at ${(rtp * 100).toFixed(1)}% — below the floor means the machine bankrupts in seconds with no payout ever, which is not a coin pusher, it is a coin sink`);
  assert.ok(rtp < 1.15, `RTP measured at ${(rtp * 100).toFixed(1)}% — above the ceiling means the machine pays out more than it takes, so play can never lose and there is no tension`);
  ok(`RTP for a centre-lane run stays inside the playable band (measured ${(rtp * 100).toFixed(1)}%)`);
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
  for (let i = 0; i < 6000; i++) s = step(s, { dropX: 210, drop: false, special: 'normal' }, FIXED_DT);
  const fallenAfter = s.coinsRecovered;
  assert.ok(
    fallenAfter > fallenBefore,
    `packed the shelf with ${packedCoins} coins, stopped dropping, and ran 6000 ticks (100s) with zero coins falling — the shelf locked up`,
  );
  ok(`a packed shelf with no further input still sheds coins on its own (${fallenAfter - fallenBefore} fell over 100s of idle time)`);
}

// ── 5) Coins cannot escape shelf bounds or tunnel through the pusher ─────
{
  let s = createRun('BOUND01');
  const r = mulberry32(77);
  for (let i = 0; i < 8000; i++) {
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
      const frontY = pusherFrontY(s.tick);
      const backY = frontY - 22;
      const insidePusher = c.y - rad > backY + 0.05 && c.y + rad < frontY - 0.05;
      assert.ok(!insidePusher, `coin ${c.id} is embedded inside the pusher plate at tick ${s.tick} — it tunnelled through`);
    }
  }
  ok('8000 ticks of randomised drops: every coin stayed in bounds and never tunnelled through the pusher');
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
// selection, including the ones that cannot land on zero by themselves.
{
  for (const special of ['normal', 'heavy', 'ball', 'vibrate'] as const) {
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
  ok('every coin selection spends down to zero and ends the run, including costs that do not divide the starting credits');
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

// ── 7) No drop lane strictly dominates ────────────────────────────────────
//
// The design's central claim: left / centre / right / random must not have
// one strategy that beats all the others everywhere. This does not assert
// exact equality (that would be a check that can never go red for the right
// reason) — it asserts none of the four wins by a landslide, using the same
// seeds and pilot shape balance.ts uses so the numbers agree.
{
  const SEEDS = ['LANE001', 'LANE002', 'LANE003', 'LANE004', 'LANE005', 'LANE006'];
  const laneX = { left: WALL_X0 + 20, centre: (WALL_X0 + WALL_X1) / 2, right: WALL_X1 - 20 };
  const rtpFor = (x: number): number => {
    let recovered = 0;
    let spent = 0;
    for (const seed of SEEDS) {
      const s = playTo(seed, makeDropper(x));
      recovered += s.score;
      spent += s.creditsSpent;
    }
    return recovered / spent;
  };
  const rtps = { left: rtpFor(laneX.left), centre: rtpFor(laneX.centre), right: rtpFor(laneX.right) };
  const values = Object.values(rtps);
  const best = Math.max(...values);
  const worst = Math.min(...values);
  assert.ok(
    best - worst < 0.4,
    `lanes spread ${(best * 100).toFixed(0)}% vs ${(worst * 100).toFixed(0)}% RTP — one lane dominates the others outright (left=${(rtps.left * 100).toFixed(0)}% centre=${(rtps.centre * 100).toFixed(0)}% right=${(rtps.right * 100).toFixed(0)}%)`,
  );
  ok(`no lane dominates: left=${(rtps.left * 100).toFixed(0)}% centre=${(rtps.centre * 100).toFixed(0)}% right=${(rtps.right * 100).toFixed(0)}% RTP`);
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
  for (const file of ['rng.ts', 'engine.ts', 'types.ts', 'constants.ts']) {
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

console.log(`\nself-check: ok (${passed} checks)`);
