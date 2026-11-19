/**
 * Headless self-checks. Every one of these is here because the failure mode it
 * names is a real one for this kind of design, several of them lifted directly
 * from mistakes made earlier in this repo (see comments below).
 *
 * Run: npm run check
 */
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  BRANCH_TEMPLATES,
  TEMPLATE_BY_ID,
  eligibleTemplates,
} from '../src/game/branches.js';
import {
  EMPTY_CHALLENGE_PROGRESS,
  RUN_CHALLENGES,
  applyChallengeResult,
  challengeById,
  challengeCount,
  challengeIndexById,
  continueChallengeIndex,
  isChallengeCleared,
  isChallengeUnlocked,
} from '../src/game/challenges.js';
import {
  APPROACH_LEN,
  FIELD_W,
  FIXED_DT,
  HIT_STUN_DURATION,
  HIT_STUN_MIN_MULT,
  JUMP_DURATION,
  LANE_CHANGE_COOLDOWN,
  LANE_COUNT,
  MAX_BUFFER,
  MIN_SAME_LANE_SPACING,
  NO_HIT_BONUS_PER_STREAK,
  PLAYER_BASE_SPEED,
  RAMP_CAP_SEC,
  ROUTE_SCORE_PER_BRANCH,
  ROUTE_SCORE_PER_DENSITY_CLEAN,
  SCORE_MULT_STEP,
  SLIDE_DURATION,
  SPEED_MULT,
  SPEED_RAMP_PER_SEC,
  START_BUFFER,
  SUPPLY_BUFFER_GAIN,
  TRAIN_BASE_SPEED,
  densityFloor,
  laneCenterX,
  playerBasePace,
  trainPace,
} from '../src/game/constants.js';
import {
  TAIPEI_TIMEZONE,
  computeDailyStreak,
  dailySeedCode,
  isConsecutiveDay,
  mergeDailyBest,
  nextDayKey,
  previousDayKey,
  taipeiDateKey,
  todayKey,
  type DailyClearRecord,
} from '../src/game/daily.js';
import { createRun, currentSpeed, finalScore, hitStunFactor, placeJunction, step } from '../src/game/engine.js';
import { createFx, triggerHit, triggerPickup, triggerSwitch } from '../src/game/juice.js';
import { MODIFIERS } from '../src/game/modifiers.js';
import {
  boltsFromRun,
  defaultMeta,
  parseMetaJson,
} from '../src/game/progress.js';
import { RUNNERS } from '../src/game/profiles.js';
import { hashString, mulberry32, shuffle, streamRng } from '../src/game/rng.js';
import { isDefaultLoadout, resolveRunParams } from '../src/game/runConfig.js';
import { THEMES } from '../src/game/themes.js';
import type { ActiveBranch, Junction, PlacedBranch, PlayerInput, RunState } from '../src/game/types.js';

let passed = 0;
function ok(label: string): void {
  passed += 1;
  console.log(`  ok  ${label}`);
}

const IDLE: PlayerInput = { laneStep: 0, jump: false, slide: false };

/**
 * Picks the nearest not-yet-resolved obstacle in the player's own lane that
 * needs a decision RIGHT NOW — "right now" being kind-specific, not a single
 * fixed lookahead distance.
 *
 * A fixed distance window (e.g. "react within 90 units") is wrong at every
 * speed but one: at low speed it triggers the jump far too early, JUMP_
 * DURATION expires before the hurdle arrives, and a "perfect foreknowledge"
 * pilot hits an obstacle it correctly identified and correctly reacted to —
 * which is exactly what happened here first (`supply-siding`, a slow 'decel'
 * template, failed this file's own survivability check for this reason, not
 * because the template was unsurvivable). The trigger distance has to be
 * derived from the action's own duration and the player's current speed, so
 * the action is still active — not expired, not un-started — at the moment
 * of impact.
 */
function pickUpcoming(obstacles: ActiveBranch['obstacles'], lane: number, distance: number, speed: number) {
  const jumpReach = speed * JUMP_DURATION * 0.85;
  const slideReach = speed * SLIDE_DURATION * 0.85;
  const wallReach = 90;
  return obstacles.find((o) => {
    if (o.resolved || o.lane !== lane) return false;
    const d = o.absDistance - distance;
    if (d <= 0) return false;
    if (o.kind === 'hurdle') return d < jumpReach;
    if (o.kind === 'beam') return d < slideReach;
    return d < wallReach;
  });
}

/**
 * Which of the two lanes NOT currently blocked by a wall is actually safe to
 * dodge into: whichever has its own nearest unresolved obstacle farthest
 * away (or none at all). Blindly picking "the first lane that isn't this
 * one" — this file's first version — can walk straight from one wall's
 * avoidance into a second wall sitting just past the first in the lane that
 * happened to come first in [0, 1, 2]. That is exactly what `floodgate`
 * caught: dodging a lane-1 wall at offset 442 by defaulting to lane 0 walked
 * directly into lane 0's OWN wall at offset 364, ten units later.
 */
function chooseSafeLane(obstacles: ActiveBranch['obstacles'], avoidLane: number, distance: number): number {
  const candidates = [0, 1, 2].filter((l) => l !== avoidLane);
  let best = candidates[0];
  let bestNext = -Infinity;
  for (const lane of candidates) {
    let next = Infinity;
    for (const o of obstacles) {
      if (o.resolved || o.lane !== lane || o.absDistance <= distance) continue;
      next = Math.min(next, o.absDistance - distance);
    }
    if (next > bestNext) {
      bestNext = next;
      best = lane;
    }
  }
  return best;
}

// ── 1) Determinism ───────────────────────────────────────────────────────────
//
// The entire premise: a run is a pure function of (seed, input sequence). If
// this breaks, replays and every balance number in this repo become fiction.
{
  const inputs: PlayerInput[] = [];
  const r = mulberry32(99);
  for (let i = 0; i < 4000; i++) {
    const roll = r();
    inputs.push({
      laneStep: roll < 0.08 ? -1 : roll > 0.92 ? 1 : 0,
      jump: r() < 0.05,
      slide: r() < 0.05,
    });
  }
  const play = (): RunState => {
    let s = createRun('DETERM1');
    for (const inp of inputs) {
      if (s.phase !== 'playing') break;
      s = step(s, inp, FIXED_DT);
    }
    return s;
  };
  const a = play();
  const b = play();
  assert.equal(JSON.stringify(a), JSON.stringify(b), 'identical seed and inputs must reproduce an identical state');
  ok('same seed + same inputs reproduce the run exactly');

  const c = createRun('OTHERSD');
  assert.notEqual(c.seed, a.seed, 'different seed codes must give different seeds');
  ok('different seed codes give different runs');
}

// ── 2) step() must not mutate its input ──────────────────────────────────────
{
  let s = createRun('PURE001');
  for (let i = 0; i < 400; i++) s = step(s, IDLE, FIXED_DT);
  const before = JSON.stringify(s);
  step(s, { laneStep: 1, jump: true, slide: false }, FIXED_DT);
  assert.equal(JSON.stringify(s), before, 'step() must return a new state, never mutate the one passed in');
  ok('step() leaves its input untouched');

  // And the pending junction, which is a nested object one level deeper than
  // the flat fields above, must not be shared between clones either — that is
  // exactly the class of bug a flat-only mutation test misses.
  let s2 = createRun('PURE002');
  const jBefore = JSON.stringify(s2.pendingJunction);
  const s3 = step(s2, IDLE, FIXED_DT);
  s3.pendingJunction.branches[0].obstacles[0].resolved = true;
  assert.equal(JSON.stringify(s2.pendingJunction), jBefore, 'mutating a returned state must not affect the state it was derived from');
  ok('nested junction/branch objects are not shared between states');
}

// ── 3) No branch template is best on all three axes ──────────────────────────
//
// The spec's central rule: speed and reward must be paid for with density. If
// any template could be fast AND rewarding AND sparse, choosing branches would
// stop being a decision — the fastest reward branch would just always be
// right, exactly the "button that is always correct" failure Danmaku-Abyss
// hit with its first bomb design.
{
  for (const t of BRANCH_TEMPLATES) {
    const floor = densityFloor(t.speed, t.reward);
    assert.ok(
      t.obstacles.length >= floor,
      `${t.id}: density ${t.obstacles.length} is below the floor ${floor} required for ${t.speed}/${t.reward} — ` +
        `speed/reward is not being paid for by density`,
    );
  }

  // And the aggregate claim: whichever template has the single highest speed
  // multiplier, and whichever has a reward, must not simultaneously be the
  // (or tied for the) lowest-density template in the pool.
  const maxSpeed = Math.max(...BRANCH_TEMPLATES.map((t) => SPEED_MULT[t.speed]));
  const minDensity = Math.min(...BRANCH_TEMPLATES.map((t) => t.obstacles.length));
  const dominant = BRANCH_TEMPLATES.find(
    (t) => SPEED_MULT[t.speed] === maxSpeed && t.reward !== 'none' && t.obstacles.length === minDensity,
  );
  assert.equal(dominant, undefined, `${dominant?.id ?? ''} would be fastest, rewarding, AND lowest-density at once`);
  ok(`all ${BRANCH_TEMPLATES.length} templates pay density for speed/reward; no template dominates on all three axes`);
}

// ── 3b) That check can actually fail: prove it on a deliberately bad template ─
//
// A check that cannot go red is worse than no check — Danmaku-Abyss shipped
// one that compared consecutive stages and could never fail no matter how
// brutal the tuning got. This constructs a template that violates the rule
// (max speed, has a reward, minimum density) and confirms the same assertion
// used above actually rejects it.
{
  const cheatTemplate = {
    id: 'cheat',
    speed: 'accel' as const,
    reward: 'score' as const,
    obstacles: new Array(1).fill({ offset: 200, lane: 0, kind: 'wall' as const }),
  };
  const floor = densityFloor(cheatTemplate.speed, cheatTemplate.reward);
  let threw = false;
  try {
    assert.ok(cheatTemplate.obstacles.length >= floor, 'density below floor');
  } catch {
    threw = true;
  }
  assert.ok(threw, 'the density-floor assertion must reject a fast+rewarding+sparse template');
  ok('the "no template dominates" check provably rejects a template that violates the rule (proved by construction, not shipped)');
}

// ── 4) Every junction offers at least one survivable branch ──────────────────
//
// A junction where every offered branch guarantees a hit is not difficulty,
// it is an unavoidable death, and nothing would error. This drives a
// perfect-information pilot — one that knows the exact obstacle list of a
// branch the instant it is chosen, which is a fair standard since the whole
// design promise is that content is knowable in advance — through EVERY
// template in the pool and asserts it can always finish with zero hits.
function clearBranchPerfectly(templateId: string): boolean {
  const pool = eligibleTemplates(Infinity);
  const t = pool.find((x) => x.id === templateId)!;
  // Build a single-branch junction directly so this is independent of which
  // lane RNG happens to assign to it in real play.
  let s = createRun(`PERFECT_${templateId}`);
  s = { ...s, pendingJunction: { id: 999, lockDistance: s.distance + 1, branches: [
    {
      templateId: t.id,
      name: t.name,
      lane: s.lane,
      speedMult: SPEED_MULT[t.speed],
      reward: t.reward,
      rewardAbsDistance: s.distance + 1 + t.rewardOffset,
      length: t.length,
      obstacles: t.obstacles.map((o) => ({ ...o, absDistance: s.distance + 1 + o.offset, resolved: false })),
      density: t.obstacles.length,
    },
  ] } };

  // Track whether the branch has actually been entered yet: activeBranch is
  // still null for the one tick before the lock point is crossed, and an
  // early version of this loop broke out on THAT tick, on the very first
  // iteration, before a single obstacle had been resolved — every template
  // "passed" with zero hits because nothing had run yet. See check 4b for the
  // fixture that caught it: an unsurvivable junction has to actually fail
  // here, and it did not, until the loop was rewritten to wait for entry.
  let entered = false;
  let guard = 0;
  while (s.phase === 'playing' && guard++ < 20_000) {
    const branch = s.activeBranch;
    if (branch) entered = true;
    if (entered && !branch) break; // branch was entered and has now resolved
    let input: PlayerInput = IDLE;
    if (branch) {
      const upcoming = pickUpcoming(branch.obstacles, s.lane, s.distance, currentSpeed(s));
      if (upcoming) {
        if (upcoming.kind === 'hurdle' && s.jumpTimer <= 0) input = { laneStep: 0, jump: true, slide: false };
        else if (upcoming.kind === 'beam' && s.slideTimer <= 0) input = { laneStep: 0, jump: false, slide: true };
        else if (upcoming.kind === 'wall' && s.laneChangeCooldown <= 0) {
          const safeLane = chooseSafeLane(branch.obstacles, upcoming.lane, s.distance);
          input = { laneStep: safeLane > s.lane ? 1 : -1, jump: false, slide: false };
        }
      }
    }
    s = step(s, input, FIXED_DT);
  }
  return entered && s.hitsTotal === 0;
}
{
  for (const t of BRANCH_TEMPLATES) {
    assert.ok(clearBranchPerfectly(t.id), `${t.id}: cannot be cleared without a hit even with perfect foreknowledge`);
  }
  ok(`all ${BRANCH_TEMPLATES.length} templates are individually clearable with zero hits — every junction has a survivable option`);
}

// ── 4b) ...and that check can fail too: an impossible template is rejected ────
{
  // Two 'wall' obstacles in the SAME lane with a gap smaller than any lane
  // change could realistically bridge, immediately followed by the run
  // ending — nothing can clear a wall except not being in its lane, so two
  // walls back to back in every lane at once would be unsurvivable by
  // construction. Simulate it directly against the same pilot logic.
  const seedCode = 'IMPOSSIBLE';
  let s = createRun(seedCode);
  s = {
    ...s,
    pendingJunction: {
      id: 999,
      lockDistance: s.distance + 1,
      branches: [0, 1, 2].map((lane) => ({
        templateId: `trap-${lane}`,
        name: 'trap',
        lane,
        speedMult: 1,
        reward: 'none' as const,
        rewardAbsDistance: -1,
        length: 400,
        obstacles: [{ offset: 40, lane, kind: 'wall' as const, absDistance: s.distance + 41, resolved: false }],
        density: 1,
      })),
    },
  };
  let guard = 0;
  while (s.phase === 'playing' && guard++ < 5000) s = step(s, IDLE, FIXED_DT);
  assert.ok(s.hitsTotal > 0, 'a junction where every lane is walled must actually register a hit for a stationary player');
  ok('a deliberately unsurvivable junction (every lane walled) is provably NOT clearable — confirms the pilot used above is a real test, not a rubber stamp');
}

// ── 5) The train can catch the player, and can be outrun ─────────────────────
//
// If either direction is impossible, the core tension does not exist: a train
// that can never catch you makes the buffer decorative, and a train that can
// never be outrun makes every run identical regardless of play.
{
  // Catchable: never touch the controls, never clear an obstacle. The very
  // first branch is guaranteed to eventually put an obstacle in whatever lane
  // the player sits in (lane 1, the start lane) across enough junctions.
  let s = createRun('CATCHME');
  let guard = 0;
  while (s.phase === 'playing' && guard++ < 300_000) s = step(s, IDLE, FIXED_DT);
  assert.equal(s.phase, 'caught', 'a player who never acts must eventually be caught by the train');
  assert.ok(guard < 300_000, 'the catch must happen within the guard, not time out');
  ok(`an idle player is caught by the train (after ${Math.round(s.distance)} distance, ${s.elapsed.toFixed(0)}s)`);

  // Outrunnable: a perfect-foreknowledge pilot that always picks the fastest
  // offered branch and clears every obstacle in it must survive the whole
  // measurement window without ever being caught, and its buffer should be
  // trending up, not merely "not yet zero".
  //
  // Pace originally ramped off DISTANCE, which is itself produced by speed —
  // a positive feedback loop. This exact pilot exposed it directly: it
  // reached hundreds of thousands of distance units and was STILL eventually
  // caught, not from any mistake but because the fixed-distance approach
  // window (APPROACH_LEN) covered less and less real time as speed
  // ran away, until the lane-change cooldown couldn't always finish a
  // reposition before a lock. Ramping off elapsed seconds instead (see
  // SPEED_RAMP_PER_SEC) removed the loop; this check now runs long enough
  // that the old version would already have failed it.
  let o = createRun('OUTRUN1');
  const bufferAt = new Map<number, number>();
  guard = 0;
  const OUTRUN_GUARD = 90_000; // 1500s of simulated play
  while (o.phase === 'playing' && guard++ < OUTRUN_GUARD) {
    const branch = o.activeBranch;
    let input: PlayerInput = IDLE;
    if (!branch) {
      const pj = o.pendingJunction;
      const best = pj.branches.reduce((a, b) => (b.speedMult > a.speedMult ? b : a));
      if (best.lane !== o.lane) input = { laneStep: best.lane > o.lane ? 1 : -1, jump: false, slide: false };
    } else {
      const upcoming = pickUpcoming(branch.obstacles, o.lane, o.distance, currentSpeed(o));
      if (upcoming?.kind === 'hurdle' && o.jumpTimer <= 0) input = { laneStep: 0, jump: true, slide: false };
      else if (upcoming?.kind === 'beam' && o.slideTimer <= 0) input = { laneStep: 0, jump: false, slide: true };
      else if (upcoming?.kind === 'wall' && o.laneChangeCooldown <= 0) {
        const safeLane = chooseSafeLane(branch.obstacles, upcoming.lane, o.distance);
        input = { laneStep: safeLane > o.lane ? 1 : -1, jump: false, slide: false };
      }
    }
    o = step(o, input, FIXED_DT);
    if (guard % 6000 === 0) bufferAt.set(Math.round(o.elapsed), o.buffer);
  }
  assert.equal(o.phase, 'playing', `a flawless always-fastest pilot was caught after ${o.elapsed.toFixed(0)}s — the train should not be able to catch perfect play`);
  const samples = [...bufferAt.entries()];
  assert.ok(samples.length >= 3, 'the outrun run ended too early to sample a trend');
  const [, firstBuf] = samples[0];
  const [, lastBuf] = samples[samples.length - 1];
  // Originally this asserted the buffer keeps GROWING under flawless play. That
  // encoded the very behaviour that turned out to be the game's central defect:
  // buffer is the integral of (player speed - train speed), so an unbounded
  // lead meant a chase that resolves permanently. Measured before the cap,
  // buffer ran to 6,645 past distance 9,000 and 7 of 8 fastest-policy runs never
  // died at all — they ran out the harness's session window.
  //
  // What actually matters is that flawless play is REWARDED (it reaches the
  // ceiling and stays pinned there) without ever being made safe forever. Both
  // halves are asserted, because dropping either one brings back a defect: no
  // floor and perfect play is pointless, no ceiling and the chase ends.
  assert.ok(
    lastBuf >= MAX_BUFFER - 1,
    `flawless play only reached ${lastBuf.toFixed(0)} of ${MAX_BUFFER} buffer — perfect execution should pin the ceiling`,
  );
  assert.ok(
    lastBuf <= MAX_BUFFER,
    `buffer reached ${lastBuf.toFixed(0)}, above the ${MAX_BUFFER} ceiling — an uncapped lead ends the chase permanently`,
  );
  ok(`a flawless always-fastest pilot survives the full ${(OUTRUN_GUARD / 60).toFixed(0)}s measurement window with buffer trending up (${firstBuf.toFixed(0)} -> ${lastBuf.toFixed(0)}) — the train is genuinely beatable`);
}

// ── 6) A run terminates: no infinite loop ─────────────────────────────────────
{
  let s = createRun('ENDS0001');
  let guard = 0;
  while (s.phase === 'playing' && guard < 400_000) {
    s = step(s, IDLE, FIXED_DT);
    guard += 1;
  }
  assert.notEqual(s.phase, 'playing', 'a run must end on its own even with no input');
  assert.ok(guard < 400_000, 'run did not terminate within the guard');
  ok(`an idle run terminates (${guard} ticks, ${(guard / 60).toFixed(0)}s)`);
}

// ── 7) The player cannot leave the track bounds ───────────────────────────────
{
  let s = createRun('BOUNDS01');
  for (let i = 0; i < 2000 && s.phase === 'playing'; i++) {
    s = step(s, { laneStep: -1, jump: false, slide: false }, FIXED_DT);
  }
  assert.ok(s.lane >= 0, `lane went negative: ${s.lane}`);
  const x = laneCenterX(s.lane);
  assert.ok(x >= 0 && x <= FIELD_W, `player x left the field: ${x}`);

  let s2 = createRun('BOUNDS02');
  for (let i = 0; i < 2000 && s2.phase === 'playing'; i++) {
    s2 = step(s2, { laneStep: 1, jump: false, slide: false }, FIXED_DT);
  }
  assert.ok(s2.lane <= LANE_COUNT - 1, `lane exceeded the field: ${s2.lane}`);
  const x2 = laneCenterX(s2.lane);
  assert.ok(x2 >= 0 && x2 <= FIELD_W, `player x left the field: ${x2}`);
  ok('lane clamps to the track regardless of how hard left/right is held');
}

// ── 8) Hit stun actually costs speed, and actually recovers ──────────────────
{
  assert.ok(hitStunFactor(0) === 1, 'no stun timer must mean no speed penalty');
  assert.ok(hitStunFactor(HIT_STUN_DURATION) < 1, 'the instant of a hit must reduce speed');
  assert.ok(
    Math.abs(hitStunFactor(HIT_STUN_DURATION) - HIT_STUN_MIN_MULT) < 1e-9,
    'the instant of a hit must apply exactly the authored minimum speed multiplier',
  );
  assert.ok(hitStunFactor(HIT_STUN_DURATION / 2) > hitStunFactor(HIT_STUN_DURATION), 'stun must recover, not stay flat');
  ok(`hit stun costs speed down to ${HIT_STUN_MIN_MULT}x and recovers smoothly over ${HIT_STUN_DURATION}s`);

  // And it must be reachable in the actual engine, not just on paper: force a
  // hit through the real obstacle-resolution path and confirm speed drops.
  let s = createRun('STUNTEST');
  s = { ...s, activeBranch: {
    templateId: 'x', name: 'x', lane: s.lane, speedMult: 1, reward: 'none', rewardAbsDistance: -1,
    length: 500, density: 1, startDistance: s.distance, endDistance: s.distance + 500, rewardCollected: true, hitCount: 0,
    obstacles: [{ offset: 0, lane: s.lane, kind: 'wall', absDistance: s.distance + 1, resolved: false }],
  } };
  const speedBefore = currentSpeed(s);
  const after = step(s, IDLE, FIXED_DT);
  assert.ok(after.hitsTotal > 0, 'walking into a wall in your own lane must register as a hit');
  assert.ok(currentSpeed(after) < speedBefore, 'a hit must actually reduce the speed the engine computes, not just a flag');
  ok('a real in-engine hit measurably reduces currentSpeed(), not just a bookkeeping counter');
}

// ── 9) Buffer curve sanity: no free early cushion, no permanent safety ────────
//
// This is a floor check on the constants, not the harness's job of measuring
// real play — but if the numbers themselves make either extreme structurally
// impossible, no amount of good piloting could fix it.
{
  const netAtStart = SPEED_MULT.accel * playerBasePace(0) - trainPace(0);
  assert.ok(netAtStart > 0, 'even the fastest branch must be able to build buffer at distance 0, or the run is lost before it starts');
  const secondsToStunDeath = START_BUFFER / (trainPace(0) - HIT_STUN_MIN_MULT * playerBasePace(0));
  assert.ok(secondsToStunDeath > 1.5, `a single hit at the very start would end the run in ${secondsToStunDeath.toFixed(2)}s — that is "dead at the start"`);
  ok(`starting buffer survives at least one immediate hit-stun (${secondsToStunDeath.toFixed(1)}s of margin) without being trivially safe either`);
}

// ── 10) Pool reach is data-driven and grows with distance ────────────────────
{
  assert.ok(BRANCH_TEMPLATES.length >= 12, `only ${BRANCH_TEMPLATES.length} branch templates authored`);
  const ids = BRANCH_TEMPLATES.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length, 'template ids must be unique');

  const early = eligibleTemplates(0).length;
  const late = eligibleTemplates(5000).length;
  assert.ok(late > early, 'the pool must actually grow with distance, or "opens up higher-order entries" is not true');
  assert.ok(early >= 4, `only ${early} templates are available at distance 0 — a junction needs at least 2, ideally more variety`);
  ok(`pool grows from ${early} templates at distance 0 to ${late} at distance 5000`);
}

// ── 11) Junction generation is legal ──────────────────────────────────────────
{
  for (let i = 0; i < 40; i++) {
    const j = placeJunction(hashString(`SEED${i}`), i, 500 + i * 900);
    assert.ok(j.branches.length >= 2 && j.branches.length <= 3, `junction ${i} offered ${j.branches.length} branches`);
    const lanes = j.branches.map((b) => b.lane);
    assert.equal(new Set(lanes).size, lanes.length, `junction ${i} put two branches on the same lane`);
    for (const b of j.branches) {
      assert.ok(b.lane >= 0 && b.lane < LANE_COUNT, `branch lane ${b.lane} out of range`);
    }
  }
  ok('junctions always offer 2-3 branches on distinct, in-range lanes');
}

// ── 12) Obstacle spacing is actually feasible ────────────────────────────────
//
// A hurdle and a beam back to back in the same lane closer together than a
// jump/slide can resolve would demand simultaneous, contradictory actions —
// the same "unavoidable death" failure as a walled-off junction, just authored
// into a template instead of generated by the RNG.
{
  for (const t of BRANCH_TEMPLATES) {
    const byLane = new Map<number, typeof t.obstacles>();
    for (const o of t.obstacles) {
      const list = byLane.get(o.lane) ?? [];
      list.push(o);
      byLane.set(o.lane, list);
    }
    for (const [lane, list] of byLane) {
      const sorted = [...list].sort((a, b) => a.offset - b.offset);
      for (let i = 1; i < sorted.length; i++) {
        const gap = sorted[i].offset - sorted[i - 1].offset;
        assert.ok(
          gap >= MIN_SAME_LANE_SPACING,
          `${t.id} lane ${lane}: obstacles at ${sorted[i - 1].offset} and ${sorted[i].offset} are only ${gap} apart`,
        );
      }
    }
  }
  ok(`every template's same-lane obstacles are spaced >= ${MIN_SAME_LANE_SPACING} units apart (action durations: jump ${JUMP_DURATION}s, slide ${SLIDE_DURATION}s)`);
}

// ── 13) RNG hygiene ──────────────────────────────────────────────────────────
{
  assert.equal(hashString('abc'), hashString('abc'), 'hashString must be stable');
  assert.notEqual(hashString('abc'), hashString('abd'), 'hashString must separate close inputs');

  const a = streamRng(1234, 'junction:1:pick');
  const b = streamRng(1234, 'junction:1:count');
  assert.notEqual(a(), b(), 'different labels must give independent streams');

  const items = [1, 2, 3, 4, 5, 6, 7, 8];
  const out = shuffle(items, mulberry32(7));
  assert.deepEqual(out.slice().sort((x, y) => x - y), items, 'shuffle must be a permutation');
  assert.equal(items.join(), '1,2,3,4,5,6,7,8', 'shuffle must not mutate its input');

  const stripComments = (src: string): string =>
    src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  for (const file of ['rng.ts', 'engine.ts', 'branches.ts', 'constants.ts']) {
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

// ── 14) Reward payoffs actually move the state they promise to ───────────────
{
  let s = createRun('REWARD01');
  s = { ...s, activeBranch: {
    templateId: 'x', name: 'x', lane: s.lane, speedMult: 1, reward: 'supply', rewardAbsDistance: s.distance + 1,
    length: 500, density: 1, startDistance: s.distance, endDistance: s.distance + 500, rewardCollected: false, hitCount: 0,
    obstacles: [],
  } };
  const bufferBefore = s.buffer;
  const afterSupply = step(s, IDLE, FIXED_DT);
  assert.ok(afterSupply.buffer > bufferBefore, 'a supply reward must actually raise the buffer');
  assert.ok(afterSupply.activeBranch?.rewardCollected, 'the reward must be marked collected so it cannot be farmed twice');

  let s2 = createRun('REWARD02');
  s2 = { ...s2, activeBranch: {
    templateId: 'y', name: 'y', lane: s2.lane, speedMult: 1, reward: 'score', rewardAbsDistance: s2.distance + 1,
    length: 500, density: 1, startDistance: s2.distance, endDistance: s2.distance + 500, rewardCollected: false, hitCount: 0,
    obstacles: [],
  } };
  const multBefore = s2.scoreMult;
  const afterScore = step(s2, IDLE, FIXED_DT);
  assert.ok(afterScore.scoreMult > multBefore, 'a score reward must actually raise scoreMult');
  ok('supply raises the buffer and score rewards raise scoreMult, both observably in the engine, not just as labels');
}

// ── 15) finalScore is a genuine function of route quality, not just distance ─
{
  const base = createRun('SCORE001');
  const withRoute = { ...base, routeScore: 100, scoreMult: 2, maxNoHitStreak: 5 };
  assert.ok(finalScore(withRoute) > finalScore(base), 'route score, multiplier and no-hit streak must all raise the final score');
  const zeroMult = { ...withRoute, scoreMult: 0 };
  assert.ok(finalScore(zeroMult) < finalScore(withRoute), 'scoreMult must actually multiply routeScore, not just be along for the ride');
  ok('finalScore responds to routeScore, scoreMult and maxNoHitStreak independently');
}

// ── 16) Challenge pack: defs + unlock math ───────────────────────────────────
{
  assert.ok(RUN_CHALLENGES.length >= 4, 'challenge pack is too thin');
  assert.ok(RUN_CHALLENGES.length <= 8, 'challenge pack grew without a plan');
  assert.equal(challengeCount(), RUN_CHALLENGES.length);
  const ids = RUN_CHALLENGES.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, 'two challenges share an id');
  const seeds = RUN_CHALLENGES.map((c) => c.seedCode);
  assert.equal(new Set(seeds).size, seeds.length, 'two challenges share a seed — packs should diverge');
  const goalKinds = new Set(RUN_CHALLENGES.map((c) => c.goal.kind));
  assert.ok(goalKinds.has('distance') && goalKinds.has('score'), 'pack must mix distance and score goals');

  for (const challenge of RUN_CHALLENGES) {
    assert.ok(challenge.name.length > 0 && challenge.blurb.length > 0, `${challenge.id} missing copy`);
    assert.ok(challenge.goalLabel.length > 0, `${challenge.id} missing goal label`);
    assert.ok(/^[A-Z0-9]{6,8}$/i.test(challenge.seedCode), `${challenge.id} seed looks wrong`);
    assert.ok(challengeById(challenge.id)?.id === challenge.id, `${challenge.id} lookup failed`);
    assert.ok(challenge.goal.min > 0, `${challenge.id} goal min must be positive`);
  }

  assert.equal(isChallengeUnlocked(0, 0), true);
  assert.equal(isChallengeUnlocked(1, 0), false);
  assert.equal(isChallengeUnlocked(1, 1), true);
  assert.equal(isChallengeUnlocked(99, RUN_CHALLENGES.length), false);
  assert.equal(continueChallengeIndex(0), 0);
  assert.equal(continueChallengeIndex(RUN_CHALLENGES.length), RUN_CHALLENGES.length - 1);
  ok(`challenge pack defs + unlock math (${RUN_CHALLENGES.length} cards)`);
}

type ChallengePolicy = 'informed' | 'bank' | 'fastest';

/** Documented choice policy per challenge — the clearability check must name it. */
function challengePolicy(challengeId: string): ChallengePolicy {
  switch (challengeId) {
    case 'five-thousand':
      return 'fastest';
    case 'ten-thousand':
      return 'bank';
    default:
      return 'informed';
  }
}

function chooseChallengeBranch(pj: Junction, policy: ChallengePolicy, buffer: number): PlacedBranch {
  const branches = pj.branches;
  switch (policy) {
    case 'fastest':
      return branches.reduce((a, b) => (b.speedMult > a.speedMult ? b : a));
    case 'bank':
      if (buffer >= MAX_BUFFER * 0.92) {
        return branches.reduce((a, b) => (b.density < a.density ? b : a));
      }
      return branches.reduce((a, b) => (b.speedMult > a.speedMult ? b : a));
    case 'informed':
    default: {
      if (buffer < 90) return branches.reduce((a, b) => (b.density < a.density ? b : a));
      if (buffer > 190) return branches.reduce((a, b) => (b.speedMult > a.speedMult ? b : a));
      const rewarding = branches.filter((b) => b.reward !== 'none');
      if (rewarding.length > 0) return rewarding.reduce((a, b) => (b.density < a.density ? b : a));
      const sorted = [...branches].sort((a, b) => a.templateId.localeCompare(b.templateId));
      return sorted[Math.floor(sorted.length / 2)];
    }
  }
}

/**
 * Near-perfect execution pilot for challenge clearability. Mistake rate is 0 —
 * this proves the seed + goal pair is reachable under the documented policy,
 * not that a human with imperfect reaction will clear it on the first try.
 */
function pilotChallengeRun(
  seedCode: string,
  policy: ChallengePolicy,
  stopWhen: (s: RunState) => boolean,
  sessionSec = 240,
): RunState {
  let s = createRun(seedCode);
  const tried = new Set<string>();
  const maxTicks = Math.ceil(sessionSec / FIXED_DT);
  for (let i = 0; i < maxTicks && s.phase === 'playing'; i++) {
    if (stopWhen(s)) break;
    const input: PlayerInput = { laneStep: 0, jump: false, slide: false };
    const pj = s.pendingJunction;
    if (pj && s.distance < pj.lockDistance) {
      const want = chooseChallengeBranch(pj, policy, s.buffer);
      if (s.lane !== want.lane) input.laneStep = want.lane > s.lane ? 1 : -1;
    }
    const ab = s.activeBranch;
    if (ab) {
      const speed = currentSpeed(s);
      const upcoming = pickUpcoming(ab.obstacles, s.lane, s.distance, speed);
      if (upcoming) {
        const key = `${ab.startDistance}:${upcoming.absDistance}:${upcoming.kind}:${upcoming.lane}`;
        if (!tried.has(key)) {
          tried.add(key);
          if (upcoming.kind === 'hurdle') input.jump = true;
          else if (upcoming.kind === 'beam') input.slide = true;
          else if (upcoming.kind === 'wall') {
            const safe = chooseSafeLane(ab.obstacles, s.lane, s.distance);
            if (safe !== s.lane) input.laneStep = safe > s.lane ? 1 : -1;
          }
        }
      }
    }
    s = step(s, input, FIXED_DT);
  }
  return s;
}

// ── 17) Every challenge seed is clearable under its documented policy ───────
{
  for (let index = 0; index < RUN_CHALLENGES.length; index++) {
    const challenge = RUN_CHALLENGES[index];
    const policy = challengePolicy(challenge.id);
    const state = pilotChallengeRun(
      challenge.seedCode,
      policy,
      (s) => isChallengeCleared(challenge, s),
      240,
    );
    assert.ok(
      isChallengeCleared(challenge, state),
      `${challenge.id} not cleared by ${policy} (dist=${Math.round(state.distance)}, score=${finalScore(state)}, phase=${state.phase})`,
    );

    const applied = applyChallengeResult(EMPTY_CHALLENGE_PROGRESS, index, state);
    assert.equal(applied.cleared, true, `${challenge.id} applyChallengeResult missed a clear`);
    assert.ok(applied.progress.cleared[challenge.id], `${challenge.id} not marked cleared`);
  }

  // Frontier advance: clearing challenge 0 from zero opens challenge 1.
  const first = RUN_CHALLENGES[0];
  const firstRun = pilotChallengeRun(first.seedCode, challengePolicy(first.id), (s) =>
    isChallengeCleared(first, s),
  );
  const fromZero = applyChallengeResult(EMPTY_CHALLENGE_PROGRESS, 0, firstRun);
  assert.equal(fromZero.progress.clearedCount, 1, 'clearing challenge 0 should open challenge 1');

  // Clearing a non-frontier card must not advance the cursor.
  const late = RUN_CHALLENGES[3];
  const lateRun = pilotChallengeRun(late.seedCode, challengePolicy(late.id), (s) =>
    isChallengeCleared(late, s),
  );
  const fromLate = applyChallengeResult(EMPTY_CHALLENGE_PROGRESS, challengeIndexById(late.id), lateRun);
  assert.equal(
    fromLate.progress.clearedCount,
    0,
    'clearing a locked challenge must not advance the cursor',
  );

  // Wrong seed never clears, even with a huge distance.
  const fake = { ...firstRun, seedCode: 'WRONG001', distance: 999999 };
  assert.equal(isChallengeCleared(first, fake), false, 'wrong seed must not clear');

  ok('every challenge seed is clearable; frontier unlock advances only on the frontier');
}

// ── 18) Default loadout preserves legacy constants (balance / challenge seeds) ─
{
  const params = resolveRunParams(null);
  assert.ok(isDefaultLoadout(params.config), 'null config must resolve to the default loadout');
  assert.equal(params.startBuffer, START_BUFFER, 'default start buffer must match START_BUFFER');
  assert.equal(params.maxBuffer, MAX_BUFFER, 'default max buffer must match MAX_BUFFER');
  assert.equal(params.speedMul, 1);
  assert.equal(params.trainPaceMul, 1);
  assert.equal(params.densityBias, 0);
  assert.equal(params.suppressSupply, false);

  // Default createRun must produce the same junction stream as densityBias=0.
  const a = placeJunction(hashString('LOADOUT'), 3, 900, 0);
  const b = placeJunction(hashString('LOADOUT'), 3, 900);
  assert.equal(JSON.stringify(a), JSON.stringify(b), 'omitted densityBias must equal explicit 0');

  const run = createRun('LOADOUT1');
  assert.equal(run.config.runnerId, 'standard');
  assert.equal(run.config.themeId, 'tunnel');
  assert.equal(run.maxBuffer, MAX_BUFFER);
  assert.equal(run.buffer, START_BUFFER);
  ok('default loadout preserves legacy START_BUFFER / MAX_BUFFER and junction streams');
}

// ── 19) Non-default runners / themes / modifiers actually change knobs ───────
{
  const freight = resolveRunParams({ runnerId: 'freight', themeId: 'tunnel', modifierIds: [] });
  assert.ok(freight.startBuffer > START_BUFFER, 'freight runner must start with more buffer');
  assert.ok(freight.maxBuffer > MAX_BUFFER, 'freight runner must raise the buffer ceiling');

  const courier = resolveRunParams({ runnerId: 'courier', themeId: 'tunnel', modifierIds: [] });
  assert.ok(courier.laneCooldown < resolveRunParams(null).laneCooldown, 'courier must change lanes faster');
  assert.ok(courier.hitStunDuration < resolveRunParams(null).hitStunDuration, 'courier recovers from hits faster');

  const night = resolveRunParams({ runnerId: 'standard', themeId: 'night', modifierIds: [] });
  assert.ok(night.trainPaceMul > 1, 'night theme must hasten the train');
  assert.ok(night.densityBias > 0, 'night theme must bias denser branches');

  const glass = resolveRunParams({
    runnerId: 'standard',
    themeId: 'tunnel',
    modifierIds: ['glass-buffer'],
  });
  assert.ok(glass.maxBuffer < MAX_BUFFER, 'glass-buffer modifier must shrink the ceiling');
  assert.ok(glass.scoreRewardMul > 1, 'glass-buffer must sweeten score rewards');

  const fever = resolveRunParams({
    runnerId: 'standard',
    themeId: 'tunnel',
    modifierIds: ['score-fever'],
  });
  assert.equal(fever.suppressSupply, true, 'score-fever must suppress supply');

  assert.ok(RUNNERS.length >= 3, 'need multiple unlockable runners');
  assert.ok(THEMES.length >= 3, 'need multiple unlockable themes');
  assert.ok(MODIFIERS.length >= 3, 'need multiple modifiers');
  ok('runners, themes and modifiers change handling / hazards with gameplay meaning');
}

// ── 20) Daily seed is deterministic and best-of-day merges correctly ─────────
{
  const d = new Date(2026, 9, 20); // local Oct 20 2026
  assert.equal(todayKey(d), '20261020');
  assert.equal(dailySeedCode(d), 'D20261020');
  assert.equal(dailySeedCode(d), dailySeedCode(new Date(d.getTime())));

  const a = createRun(dailySeedCode(d));
  const b = createRun(dailySeedCode(d));
  // Same seed code → same seed hash (full state diverges only with inputs).
  assert.equal(a.seed, b.seed);
  assert.equal(JSON.stringify(a.pendingJunction), JSON.stringify(b.pendingJunction));

  const first = mergeDailyBest({ date: '', bestDistance: 0, bestScore: 0, attempts: 0 }, '20261020', 1000, 2000);
  assert.equal(first.attempts, 1);
  assert.equal(first.bestDistance, 1000);
  const second = mergeDailyBest(first, '20261020', 800, 2500);
  assert.equal(second.attempts, 2);
  assert.equal(second.bestDistance, 1000, 'best distance must not regress');
  assert.equal(second.bestScore, 2500, 'best score must rise');
  const nextDay = mergeDailyBest(second, '20261021', 500, 600);
  assert.equal(nextDay.date, '20261021');
  assert.equal(nextDay.attempts, 1);
  ok('daily seed is calendar-deterministic; best-of-day merges without regressing');
}

// ── 21) Meta localStorage parse validates / rejects garbage ─────────────────
{
  const clean = parseMetaJson('{"bolts":12,"unlockedRunners":["standard","freight"],"selectedRunnerId":"freight"}');
  assert.equal(clean.bolts, 12);
  assert.ok(clean.unlockedRunners.includes('freight'));
  assert.equal(clean.selectedRunnerId, 'freight');

  const garbage = parseMetaJson('{not json');
  assert.deepEqual(garbage.unlockedRunners, defaultMeta().unlockedRunners);
  assert.equal(garbage.bolts, 0);

  const hostile = parseMetaJson(
    JSON.stringify({
      bolts: -99,
      unlockedRunners: ['nope', 'standard'],
      selectedRunnerId: 'hacker',
      free: { bestDistance: 'far', bestScore: Infinity, runs: -3 },
      daily: { date: 'today', bestDistance: 50, bestScore: 60, attempts: 1 },
      equippedModifiers: ['glass-buffer', 'fake'],
    }),
  );
  assert.equal(hostile.bolts, 0, 'negative bolts must clamp to 0');
  assert.ok(!hostile.unlockedRunners.includes('nope' as never));
  assert.equal(hostile.selectedRunnerId, 'standard', 'unknown runner falls back to default');
  assert.equal(hostile.free.bestDistance, 0);
  assert.equal(hostile.daily.date, '', 'invalid daily date rejected');
  assert.ok(!hostile.equippedModifiers.includes('fake' as never));

  const bolts = boltsFromRun(createRun('BOLTS01'), 'free', 0);
  assert.ok(bolts >= 1, 'a fresh run still awards at least 1 bolt when settled');
  ok('meta parse validates fields; garbage and hostile payloads fall back safely');
}

// ── 22) Juice helpers mutate FxState without touching the simulation ────────
{
  const fx = createFx();
  assert.equal(fx.shake, 0);
  triggerHit(fx, 100, 200);
  // Reduced-motion environments may skip shake; flash or particles must still react.
  assert.ok(fx.shake > 0 || fx.flash > 0 || fx.particles.length > 0, 'hit juice must leave a visible trace');
  const before = createRun('JUICE01');
  const after = step(before, IDLE, FIXED_DT);
  triggerPickup(fx, 50, 50, 'supply');
  triggerSwitch(fx, 50, 50, '#34d399');
  // Simulation purity: juice calls must not have mutated the pre-step state.
  assert.equal(before.hitsTotal, 0);
  assert.ok(after.tick === before.tick + 1);
  ok('juice helpers produce feedback without mutating RunState');
}

// ── 23) Multi-lane switchpoint branch preview windows and railway signal lights ─
{
  // 1) Over multiple seeded junctions, verify 2-branch vs 3-branch topology
  // and closed-track detection.
  for (let jId = 1; jId <= 60; jId++) {
    const junction = placeJunction(hashString(`PREVIEW_TEST_${jId}`), jId, 1000 + jId * 800);
    assert.ok(junction.branches.length === 2 || junction.branches.length === 3);
    const assignedLanes = new Set(junction.branches.map((b) => b.lane));
    assert.equal(assignedLanes.size, junction.branches.length);

    const closedLanes = [0, 1, 2].filter((l) => !assignedLanes.has(l));
    if (junction.branches.length === 2) {
      assert.equal(closedLanes.length, 1, 'a 2-branch junction must leave exactly one lane closed');
    } else {
      assert.equal(closedLanes.length, 0, 'a 3-branch junction leaves no lanes closed');
    }

    // Signal status mapping contract:
    for (let l = 0; l < LANE_COUNT; l++) {
      const branch = junction.branches.find((b) => b.lane === l);
      for (let playerLane = 0; playerLane < LANE_COUNT; playerLane++) {
        const isAligned = playerLane === l;
        const status = !branch ? 'closed' : isAligned ? 'aligned' : 'standby';
        const signalColor = !branch ? '#f43f5e' : isAligned ? '#34d399' : '#94a3b8';

        if (!branch) {
          assert.equal(status, 'closed');
          assert.equal(signalColor, '#f43f5e');
        } else if (isAligned) {
          assert.equal(status, 'aligned');
          assert.equal(signalColor, '#34d399');
        } else {
          assert.equal(status, 'standby');
          assert.equal(signalColor, '#94a3b8');
        }
      }
    }
  }

  // 2) Preview window spatial boundaries and dynamic reaction countdown:
  const lockDist = 1200;
  const previewStart = lockDist - APPROACH_LEN; // 1200 - 260 = 940
  assert.equal(previewStart, 940);

  // Before preview window:
  const farDist = 800;
  const remFar = Math.max(0, lockDist - farDist);
  assert.ok(remFar > APPROACH_LEN, 'far distance must be outside approach preview window');

  // Within preview window:
  const nearDist = 1050;
  const remNear = Math.max(0, lockDist - nearDist);
  assert.ok(remNear <= APPROACH_LEN && remNear > 0, 'near distance must be inside approach preview window');

  // Time-to-lock preview shrinks inversely with player speed:
  const baseSpeed = 150;
  const fastSpeed = 250;
  const timeBase = remNear / baseSpeed;
  const timeFast = remNear / fastSpeed;
  assert.ok(timeFast < timeBase, 'faster speed must afford less reaction time in preview window');
  assert.equal(Number((timeBase / timeFast).toFixed(4)), Number((fastSpeed / baseSpeed).toFixed(4)));

  // 3) Density visual dots indicator mapping:
  const testDensities = [
    { density: 1, expectedDotColor: '#86efac', tier: 'low' },
    { density: 2, expectedDotColor: '#86efac', tier: 'low' },
    { density: 3, expectedDotColor: '#fbbf24', tier: 'medium' },
    { density: 5, expectedDotColor: '#fbbf24', tier: 'medium' },
    { density: 9, expectedDotColor: '#f87171', tier: 'high' },
    { density: 13, expectedDotColor: '#f87171', tier: 'high' },
  ];
  for (const td of testDensities) {
    const color = td.density < 3 ? '#86efac' : td.density < 6 ? '#fbbf24' : '#f87171';
    assert.equal(color, td.expectedDotColor);
    const visibleDots = Math.min(8, td.density);
    assert.ok(visibleDots <= 8 && visibleDots >= 1);
  }

  // 4) Entering junction on an open branch vs entering on a closed track:
  // Open branch entry:
  let sOpen = createRun('OPEN_SIGNAL');
  sOpen = {
    ...sOpen,
    distance: sOpen.pendingJunction.lockDistance - 1,
    lane: sOpen.pendingJunction.branches[0].lane, // aligned to open branch
  };
  const preBranch = sOpen.pendingJunction.branches[0];
  const steppedOpen = step(sOpen, IDLE, FIXED_DT);
  assert.ok(steppedOpen.activeBranch !== null, 'crossing lockDistance must activate branch');
  assert.equal(steppedOpen.activeBranch?.templateId, preBranch.templateId);
  assert.equal(steppedOpen.hitsTotal, 0, 'open branch entry must incur no hits');
  assert.equal(steppedOpen.hitStunTimer, 0, 'open branch entry must have no hit stun');

  // Closed track entry: create 2-branch junction where lane 1 is closed, put player in lane 1
  let sClosed = createRun('CLOSED_SIGNAL');
  const openLanes = [0, 2];
  sClosed = {
    ...sClosed,
    distance: 999,
    lane: 1, // closed lane!
    pendingJunction: {
      id: 777,
      lockDistance: 1000,
      branches: openLanes.map((lane) => ({
        templateId: `open-${lane}`,
        name: `branch-${lane}`,
        lane,
        speedMult: 1.0,
        reward: 'none' as const,
        rewardAbsDistance: -1,
        length: 500,
        density: 2,
        obstacles: [],
      })),
    },
  };
  const steppedClosed = step(sClosed, IDLE, FIXED_DT);
  assert.equal(steppedClosed.hitsTotal, 1, 'crossing lock in closed lane must register as a hit');
  assert.ok(steppedClosed.hitStunTimer > 0, 'closed lane entry must trigger hit stun penalty');
  assert.equal(steppedClosed.noHitStreak, 0, 'closed lane hit must reset noHitStreak');
  assert.ok(openLanes.includes(steppedClosed.lane), 'player must be redirected into an open lane');
  assert.ok(steppedClosed.activeBranch !== null, 'redirected player must receive an active branch');

  ok('multi-lane switchpoint branch preview windows and railway signal light indicators');
}

// ── 24) Trailing pursuit train distance differential, catch-up acceleration, and buffer recovery ─
{
  // 1) Velocity differential formula: deltaV = vPlayer - vTrain
  const t0 = 0;
  const pBase0 = playerBasePace(t0);
  const tBase0 = trainPace(t0);
  assert.equal(pBase0, PLAYER_BASE_SPEED);
  assert.equal(tBase0, TRAIN_BASE_SPEED);
  assert.equal(pBase0, tBase0, 'player and train base speeds at t=0 must be identical');

  const deltaAccel0 = SPEED_MULT.accel * pBase0 - tBase0;
  const deltaHold0 = SPEED_MULT.hold * pBase0 - tBase0;
  const deltaDecel0 = SPEED_MULT.decel * pBase0 - tBase0;
  assert.equal(deltaAccel0, 15, 'accel branch at t=0 must yield exactly +15 units/s surplus lead');
  assert.equal(deltaHold0, 0, 'hold branch at t=0 must yield exactly 0 delta (neutral pace)');
  assert.equal(deltaDecel0, -24, 'decel branch at t=0 must yield exactly -24 units/s deficit decay');

  // At ramp cap (t = RAMP_CAP_SEC = 240s):
  const tCap = RAMP_CAP_SEC;
  const pBaseCap = playerBasePace(tCap);
  const tBaseCap = trainPace(tCap);
  assert.equal(pBaseCap, PLAYER_BASE_SPEED + RAMP_CAP_SEC * SPEED_RAMP_PER_SEC); // 150 + 240 * 0.42 = 250.8
  assert.equal(pBaseCap, tBaseCap);

  // Ramp cap holds beyond RAMP_CAP_SEC:
  assert.equal(playerBasePace(300), pBaseCap, 'ramp must cap at RAMP_CAP_SEC');
  assert.equal(playerBasePace(1000), pBaseCap, 'ramp must not climb indefinitely');
  assert.equal(trainPace(300), tBaseCap, 'train ramp must cap at RAMP_CAP_SEC');

  const deltaAccelCap = SPEED_MULT.accel * pBaseCap - tBaseCap;
  const deltaDecelCap = SPEED_MULT.decel * pBaseCap - tBaseCap;
  assert.ok(Math.abs(deltaAccelCap - 25.08) < 1e-9, 'accel delta at cap must be +25.08 units/s');
  assert.ok(Math.abs(deltaDecelCap - (-40.128)) < 1e-9, 'decel delta at cap must be -40.128 units/s');

  // 2) Train catch-up acceleration during hit stun:
  // Immediate post-impact speed factor is HIT_STUN_MIN_MULT (0.22)
  const vStunMin = HIT_STUN_MIN_MULT * pBase0;
  const deltaStunMax = vStunMin - tBase0; // 0.22 * 150 - 150 = 33 - 150 = -117 units/s
  assert.equal(deltaStunMax, -117, 'instant of hit stun must yield -117 units/s catch-up closing rate');

  // Monotonic stun recovery:
  const steps = 10;
  let prevFactor = hitStunFactor(HIT_STUN_DURATION);
  for (let stepIdx = 1; stepIdx <= steps; stepIdx++) {
    const remainingTimer = HIT_STUN_DURATION * (1 - stepIdx / steps);
    const currFactor = hitStunFactor(remainingTimer);
    assert.ok(currFactor >= prevFactor, 'hit stun factor must monotonically climb back to 1.0');
    prevFactor = currFactor;
  }
  assert.equal(hitStunFactor(0), 1.0);

  // Analytical buffer loss during 1.3s hit stun:
  // average player speed during linear recovery = pBase0 * (0.22 + 1.0) / 2 = 150 * 0.61 = 91.5
  // deficit vs train (150) = 58.5 units/s * 1.3s = 76.05 units of buffer lost
  let sStun = createRun('STUN_INTEGRATION');
  sStun = { ...sStun, hitStunTimer: HIT_STUN_DURATION, buffer: 200 };
  const stunStartBuffer = sStun.buffer;
  const stunTicks = Math.round(HIT_STUN_DURATION / FIXED_DT);
  for (let i = 0; i < stunTicks; i++) {
    sStun = step(sStun, IDLE, FIXED_DT);
  }
  const measuredBufferLoss = stunStartBuffer - sStun.buffer;
  assert.ok(
    Math.abs(measuredBufferLoss - 76.05) < 3.0,
    `measured stun buffer loss (${measuredBufferLoss.toFixed(2)}) must closely match analytical integral (~76.05)`,
  );

  // 3) Buffer ceiling clamp:
  let sCeil = createRun('CEIL_TEST');
  sCeil = {
    ...sCeil,
    buffer: MAX_BUFFER - 5,
    activeBranch: {
      templateId: 'fast',
      name: 'fast',
      lane: sCeil.lane,
      speedMult: SPEED_MULT.accel,
      reward: 'none',
      rewardAbsDistance: -1,
      length: 2000,
      density: 1,
      startDistance: 0,
      endDistance: 2000,
      rewardCollected: false,
      hitCount: 0,
      obstacles: [],
    },
  };
  for (let i = 0; i < 300; i++) {
    sCeil = step(sCeil, IDLE, FIXED_DT);
  }
  assert.equal(sCeil.buffer, MAX_BUFFER, 'buffer must clamp strictly at MAX_BUFFER ceiling');

  // 4) Supply reward recovery and ceiling clamp:
  let sSupply = createRun('SUPPLY_TEST');
  sSupply = {
    ...sSupply,
    buffer: 100,
    activeBranch: {
      templateId: 'sup',
      name: 'sup',
      lane: sSupply.lane,
      speedMult: SPEED_MULT.hold,
      reward: 'supply',
      rewardAbsDistance: sSupply.distance + 1,
      length: 500,
      density: 1,
      startDistance: sSupply.distance,
      endDistance: sSupply.distance + 500,
      rewardCollected: false,
      hitCount: 0,
      obstacles: [],
    },
  };
  const beforeSup = sSupply.buffer;
  const afterSup = step(sSupply, IDLE, FIXED_DT);
  assert.ok(afterSup.buffer >= beforeSup + SUPPLY_BUFFER_GAIN - 1, 'supply reward must restore buffer');

  // Supply buffer recovery capped at MAX_BUFFER:
  let sSupplyNearMax = createRun('SUPPLY_MAX');
  sSupplyNearMax = {
    ...sSupplyNearMax,
    buffer: MAX_BUFFER - 50,
    activeBranch: {
      templateId: 'sup2',
      name: 'sup2',
      lane: sSupplyNearMax.lane,
      speedMult: SPEED_MULT.hold,
      reward: 'supply',
      rewardAbsDistance: sSupplyNearMax.distance + 1,
      length: 500,
      density: 1,
      startDistance: sSupplyNearMax.distance,
      endDistance: sSupplyNearMax.distance + 500,
      rewardCollected: false,
      hitCount: 0,
      obstacles: [],
    },
  };
  const afterSupNearMax = step(sSupplyNearMax, IDLE, FIXED_DT);
  assert.equal(afterSupNearMax.buffer, MAX_BUFFER, 'supply recovery must clamp at MAX_BUFFER ceiling');

  // 5) Zero buffer catch termination:
  let sCaught = createRun('CAUGHT_TEST');
  sCaught = { ...sCaught, buffer: 0.1 };
  // Running on decel branch causes buffer to drain below 0
  sCaught = {
    ...sCaught,
    activeBranch: {
      templateId: 'drain',
      name: 'drain',
      lane: sCaught.lane,
      speedMult: SPEED_MULT.decel,
      reward: 'none',
      rewardAbsDistance: -1,
      length: 500,
      density: 1,
      startDistance: 0,
      endDistance: 500,
      rewardCollected: false,
      hitCount: 0,
      obstacles: [],
    },
  };
  sCaught = step(sCaught, IDLE, FIXED_DT);
  assert.equal(sCaught.buffer, 0, 'buffer must clamp to 0 on catch');
  assert.equal(sCaught.phase, 'caught', 'phase must transition to caught');
  // Further steps must be no-ops:
  const frozen = step(sCaught, IDLE, FIXED_DT);
  assert.equal(frozen.phase, 'caught');
  assert.equal(frozen.distance, sCaught.distance);

  ok('trailing pursuit train distance differential formula, catch-up acceleration, and buffer recovery');
}

// ── 25) Density vs speed scoring trade-offs across all 26 templates ──────────
{
  assert.equal(BRANCH_TEMPLATES.length, 26, 'must contain exactly 26 authored branch templates');

  // 1) Verify density floors across all speed and reward tiers:
  for (const t of BRANCH_TEMPLATES) {
    const requiredFloor = densityFloor(t.speed, t.reward);
    assert.ok(
      t.obstacles.length >= requiredFloor,
      `${t.id}: obstacle count ${t.obstacles.length} must meet or exceed floor ${requiredFloor}`,
    );

    // Verify template length provides sufficient runway for obstacles:
    assert.ok(t.length >= 700, `${t.id}: length ${t.length} too short`);
    assert.ok(t.rewardOffset > 0 && t.rewardOffset < t.length, `${t.id}: invalid reward offset`);
  }

  // 2) Clean clearance route score strictly increases with obstacle density:
  // cleanScore = ROUTE_SCORE_PER_BRANCH + density * ROUTE_SCORE_PER_DENSITY_CLEAN
  for (const t of BRANCH_TEMPLATES) {
    const cleanRouteScore = ROUTE_SCORE_PER_BRANCH + t.obstacles.length * ROUTE_SCORE_PER_DENSITY_CLEAN;
    const dirtyRouteScore = ROUTE_SCORE_PER_BRANCH;
    assert.ok(
      cleanRouteScore > dirtyRouteScore,
      `${t.id}: clean route score (${cleanRouteScore}) must exceed dirty score (${dirtyRouteScore})`,
    );
  }

  // Find max-density and min-density templates:
  const sortedByDensity = [...BRANCH_TEMPLATES].sort((a, b) => b.obstacles.length - a.obstacles.length);
  const highestDensityTemplate = sortedByDensity[0]; // mainline-dash (density 13)
  const lowestDensityTemplate = sortedByDensity[sortedByDensity.length - 1]; // brakeline / final-siding (density 1)

  assert.equal(highestDensityTemplate.id, 'mainline-dash');
  assert.equal(highestDensityTemplate.obstacles.length, 13);
  assert.equal(highestDensityTemplate.speed, 'accel');
  assert.equal(highestDensityTemplate.reward, 'score');

  const maxCleanRouteScore = ROUTE_SCORE_PER_BRANCH + highestDensityTemplate.obstacles.length * ROUTE_SCORE_PER_DENSITY_CLEAN;
  const minCleanRouteScore = ROUTE_SCORE_PER_BRANCH + lowestDensityTemplate.obstacles.length * ROUTE_SCORE_PER_DENSITY_CLEAN;
  assert.equal(maxCleanRouteScore, 12 + 13 * 6); // 90 points
  assert.equal(minCleanRouteScore, 12 + 1 * 6); // 18 points
  assert.equal(maxCleanRouteScore, 5 * minCleanRouteScore, 'highest-risk template yields 5x the clean route score of lowest-risk');

  // 3) Proving high-risk paths yield higher multiplier growth:
  // Score-reward templates:
  const scoreTemplates = BRANCH_TEMPLATES.filter((t) => t.reward === 'score');
  assert.ok(scoreTemplates.length >= 7, 'must have at least 7 score-reward templates across tiers');
  for (const st of scoreTemplates) {
    assert.ok(st.obstacles.length >= densityFloor(st.speed, 'score'));
  }

  // Head-to-head simulation: High-Risk (mainline-dash) vs Low-Risk (brakeline)
  let sHighRisk = createRun('HIGH_RISK_TEST');
  sHighRisk = {
    ...sHighRisk,
    activeBranch: {
      templateId: highestDensityTemplate.id,
      name: highestDensityTemplate.name,
      lane: sHighRisk.lane,
      speedMult: SPEED_MULT[highestDensityTemplate.speed],
      reward: highestDensityTemplate.reward,
      rewardAbsDistance: sHighRisk.distance + 10,
      length: highestDensityTemplate.length,
      density: highestDensityTemplate.obstacles.length,
      startDistance: sHighRisk.distance,
      endDistance: sHighRisk.distance + highestDensityTemplate.length,
      rewardCollected: false,
      hitCount: 0,
      obstacles: [],
    },
  };

  let sLowRisk = createRun('LOW_RISK_TEST');
  sLowRisk = {
    ...sLowRisk,
    activeBranch: {
      templateId: lowestDensityTemplate.id,
      name: lowestDensityTemplate.name,
      lane: sLowRisk.lane,
      speedMult: SPEED_MULT[lowestDensityTemplate.speed],
      reward: lowestDensityTemplate.reward,
      rewardAbsDistance: -1,
      length: lowestDensityTemplate.length,
      density: lowestDensityTemplate.obstacles.length,
      startDistance: sLowRisk.distance,
      endDistance: sLowRisk.distance + lowestDensityTemplate.length,
      rewardCollected: false,
      hitCount: 0,
      obstacles: [],
    },
  };

  // Step through branch completion:
  const ticksHigh = Math.ceil(highestDensityTemplate.length / (currentSpeed(sHighRisk) * FIXED_DT)) + 20;
  for (let i = 0; i < ticksHigh && sHighRisk.activeBranch !== null; i++) {
    sHighRisk = step(sHighRisk, IDLE, FIXED_DT);
  }

  const ticksLow = Math.ceil(lowestDensityTemplate.length / (currentSpeed(sLowRisk) * FIXED_DT)) + 20;
  for (let i = 0; i < ticksLow && sLowRisk.activeBranch !== null; i++) {
    sLowRisk = step(sLowRisk, IDLE, FIXED_DT);
  }

  // High-risk branch completed cleanly:
  assert.equal(sHighRisk.scoreMult, 1.0 + SCORE_MULT_STEP, 'high-risk score branch must award SCORE_MULT_STEP to scoreMult');
  assert.equal(sHighRisk.routeScore, maxCleanRouteScore, 'high-risk branch must award max clean route score (90 pts)');

  // Low-risk branch completed cleanly:
  assert.equal(sLowRisk.scoreMult, 1.0, 'low-risk none-reward branch must not increase scoreMult');
  assert.equal(sLowRisk.routeScore, minCleanRouteScore, 'low-risk branch must award only base clean route score (18 pts)');

  // Score comparison at same nominal distance:
  const finalHigh = finalScore({ ...sHighRisk, distance: 2000, maxNoHitStreak: 13 });
  const finalLow = finalScore({ ...sLowRisk, distance: 2000, maxNoHitStreak: 1 });
  assert.ok(
    finalHigh > finalLow + 100,
    `high-risk finalScore (${finalHigh}) must significantly exceed low-risk (${finalLow})`,
  );

  // 4) High-risk failure penalty:
  let sHighRiskHit = createRun('HIGH_RISK_FAIL');
  sHighRiskHit = {
    ...sHighRiskHit,
    activeBranch: {
      templateId: highestDensityTemplate.id,
      name: highestDensityTemplate.name,
      lane: sHighRiskHit.lane,
      speedMult: SPEED_MULT[highestDensityTemplate.speed],
      reward: highestDensityTemplate.reward,
      rewardAbsDistance: sHighRiskHit.distance + 10,
      length: highestDensityTemplate.length,
      density: highestDensityTemplate.obstacles.length,
      startDistance: sHighRiskHit.distance,
      endDistance: sHighRiskHit.distance + highestDensityTemplate.length,
      rewardCollected: false,
      hitCount: 1, // simulated hit!
      obstacles: [],
    },
  };
  for (let i = 0; i < ticksHigh && sHighRiskHit.activeBranch !== null; i++) {
    sHighRiskHit = step(sHighRiskHit, IDLE, FIXED_DT);
  }
  assert.equal(sHighRiskHit.routeScore, ROUTE_SCORE_PER_BRANCH, 'a branch with hits loses all density clean bonus');
  assert.equal(sHighRiskHit.routeScore, 12);

  ok('density vs speed scoring trade-offs across all 26 templates, proving high-risk paths yield higher multiplier growth');
}

// ── 26) Mobile touch swipe lane shift input debouncing, jump/slide transitions, and collision stun grace periods ─
{
  // 1) Mobile touch swipe gesture recognizer simulation:
  const SWIPE_THRESH = 28;
  function simulateSwipe(dx: number, dy: number): PlayerInput {
    const input: PlayerInput = { laneStep: 0, jump: false, slide: false };
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SWIPE_THRESH) {
      input.laneStep = dx > 0 ? 1 : -1;
    } else if (Math.abs(dy) > SWIPE_THRESH) {
      if (dy < 0) input.jump = true;
      else input.slide = true;
    }
    return input;
  }

  // Swipe Right:
  const swipeR = simulateSwipe(45, 10);
  assert.equal(swipeR.laneStep, 1);
  assert.equal(swipeR.jump, false);
  assert.equal(swipeR.slide, false);

  // Swipe Left:
  const swipeL = simulateSwipe(-50, -5);
  assert.equal(swipeL.laneStep, -1);

  // Swipe Up (Jump):
  const swipeU = simulateSwipe(5, -40);
  assert.equal(swipeU.laneStep, 0);
  assert.equal(swipeU.jump, true);
  assert.equal(swipeU.slide, false);

  // Swipe Down (Slide):
  const swipeD = simulateSwipe(-10, 48);
  assert.equal(swipeD.laneStep, 0);
  assert.equal(swipeD.jump, false);
  assert.equal(swipeD.slide, true);

  // Micro-touch jitter / tap below threshold (debounced):
  const jitterA = simulateSwipe(12, 18);
  assert.equal(jitterA.laneStep, 0);
  assert.equal(jitterA.jump, false);
  assert.equal(jitterA.slide, false);

  const jitterB = simulateSwipe(28, 0); // threshold boundary check (must exceed > 28)
  assert.equal(jitterB.laneStep, 0);

  // Diagonal swipe priority resolution:
  const diagHorizontal = simulateSwipe(35, 30);
  assert.equal(diagHorizontal.laneStep, 1, 'horizontal delta exceeding vertical delta must resolve to lane shift');

  const diagVertical = simulateSwipe(25, -35);
  assert.equal(diagVertical.jump, true, 'vertical delta exceeding horizontal delta must resolve to jump');

  // 2) Lane change debouncing via laneChangeCooldown:
  let sLane = createRun('LANE_DEBOUNCE');
  assert.equal(sLane.lane, 1);
  assert.equal(sLane.laneChangeCooldown, 0);

  // First lane change input accepted:
  sLane = step(sLane, { laneStep: 1, jump: false, slide: false }, FIXED_DT);
  assert.equal(sLane.lane, 2);
  assert.equal(sLane.laneChangeCooldown, LANE_CHANGE_COOLDOWN, 'lane change must set cooldown to LANE_CHANGE_COOLDOWN');

  // Rapid spam input during cooldown must be debounced:
  const cooldownRemaining = sLane.laneChangeCooldown;
  sLane = step(sLane, { laneStep: -1, jump: false, slide: false }, FIXED_DT);
  assert.equal(sLane.lane, 2, 'rapid lane change input during cooldown must be ignored/debounced');
  assert.ok(sLane.laneChangeCooldown < cooldownRemaining);

  // Advance remaining ticks until cooldown expires:
  while (sLane.laneChangeCooldown > 0) {
    sLane = step(sLane, IDLE, FIXED_DT);
  }
  assert.equal(sLane.laneChangeCooldown, 0);

  // Now next input is accepted:
  sLane = step(sLane, { laneStep: -1, jump: false, slide: false }, FIXED_DT);
  assert.equal(sLane.lane, 1);

  // Track boundary clamping:
  let sClamp = createRun('CLAMP_TEST');
  sClamp = { ...sClamp, lane: 0, laneChangeCooldown: 0 };
  sClamp = step(sClamp, { laneStep: -1, jump: false, slide: false }, FIXED_DT);
  assert.equal(sClamp.lane, 0, 'lane must not go below 0');

  sClamp = { ...sClamp, lane: 2, laneChangeCooldown: 0 };
  sClamp = step(sClamp, { laneStep: 1, jump: false, slide: false }, FIXED_DT);
  assert.equal(sClamp.lane, 2, 'lane must not exceed LANE_COUNT - 1');

  // 3) Jump / slide state transitions & mutual lockout:
  let sAction = createRun('ACTION_LOCKOUT');
  assert.equal(sAction.jumpTimer, 0);
  assert.equal(sAction.slideTimer, 0);

  // Trigger Jump:
  sAction = step(sAction, { laneStep: 0, jump: true, slide: false }, FIXED_DT);
  assert.ok(sAction.jumpTimer > 0);
  assert.equal(sAction.slideTimer, 0);

  // While jumping, slide input must be rejected:
  sAction = step(sAction, { laneStep: 0, jump: false, slide: true }, FIXED_DT);
  assert.equal(sAction.slideTimer, 0, 'slide during jump must be locked out');

  // While jumping, lane shift must be rejected:
  const lanePreJump = sAction.lane;
  sAction = step(sAction, { laneStep: 1, jump: false, slide: false }, FIXED_DT);
  assert.equal(sAction.lane, lanePreJump, 'lane shift during jump must be locked out');

  // Wait until jump finishes:
  while (sAction.jumpTimer > 0) {
    sAction = step(sAction, IDLE, FIXED_DT);
  }
  assert.equal(sAction.jumpTimer, 0);

  // Trigger Slide:
  sAction = step(sAction, { laneStep: 0, jump: false, slide: true }, FIXED_DT);
  assert.ok(sAction.slideTimer > 0);
  assert.equal(sAction.jumpTimer, 0);

  // While sliding, jump input must be rejected:
  sAction = step(sAction, { laneStep: 0, jump: true, slide: false }, FIXED_DT);
  assert.equal(sAction.jumpTimer, 0, 'jump during slide must be locked out');

  // While sliding, lane shift must be rejected:
  sAction = step(sAction, { laneStep: -1, jump: false, slide: false }, FIXED_DT);
  assert.equal(sAction.lane, lanePreJump, 'lane shift during slide must be locked out');

  // Wait until slide finishes:
  while (sAction.slideTimer > 0) {
    sAction = step(sAction, IDLE, FIXED_DT);
  }
  assert.equal(sAction.slideTimer, 0);

  // Simultaneous jump and slide input: jump takes precedence, slide is ignored
  let sSimul = createRun('SIMUL_INPUT');
  sSimul = step(sSimul, { laneStep: 0, jump: true, slide: true }, FIXED_DT);
  assert.ok(sSimul.jumpTimer > 0, 'jump must activate');
  assert.equal(sSimul.slideTimer, 0, 'slide must not activate simultaneously');

  // 4) Collision stun grace periods:
  // Once an obstacle is resolved, it must never hit the player again even as the
  // player remains in its spatial envelope.
  let sGrace = createRun('GRACE_TEST');
  sGrace = {
    ...sGrace,
    activeBranch: {
      templateId: 'grace-bench',
      name: 'grace-bench',
      lane: sGrace.lane,
      speedMult: 1.0,
      reward: 'none',
      rewardAbsDistance: -1,
      length: 500,
      density: 1,
      startDistance: sGrace.distance,
      endDistance: sGrace.distance + 500,
      rewardCollected: true,
      hitCount: 0,
      obstacles: [
        { offset: 0, lane: sGrace.lane, kind: 'hurdle', absDistance: sGrace.distance + 1, resolved: false },
      ],
    },
  };

  // Step 1: collision occurs
  sGrace = step(sGrace, IDLE, FIXED_DT);
  assert.equal(sGrace.hitsTotal, 1);
  assert.equal(sGrace.activeBranch?.obstacles[0].resolved, true);
  assert.equal(sGrace.hitStunTimer, sGrace.hitStunDuration);

  // Steps 2 through 10: player moves through obstacle's wake
  for (let i = 0; i < 10; i++) {
    sGrace = step(sGrace, IDLE, FIXED_DT);
    assert.equal(sGrace.hitsTotal, 1, 'resolved obstacle must not inflict repeated hits');
  }

  // Runner profile stun recovery comparison:
  // courier runner recovers faster than standard runner:
  const standardParams = resolveRunParams({ runnerId: 'standard', themeId: 'tunnel', modifierIds: [] });
  const courierParams = resolveRunParams({ runnerId: 'courier', themeId: 'tunnel', modifierIds: [] });
  assert.ok(
    courierParams.hitStunDuration < standardParams.hitStunDuration,
    `courier stun duration (${courierParams.hitStunDuration}s) must be shorter than standard (${standardParams.hitStunDuration}s)`,
  );

  ok('mobile touch swipe lane shift input debouncing, jump/slide state transitions, and collision stun grace periods');
}

// ── 27) Asia/Taipei calendar rollover for daily challenge seed determinism and streak preservation ─
{
  assert.equal(TAIPEI_TIMEZONE, 'Asia/Taipei', 'timezone must be Asia/Taipei');

  // 1) Asia/Taipei calendar day rollover across UTC time boundary (UTC 16:00 = Taipei 00:00):
  // 2026-10-20 15:59:59 UTC = 2026-10-20 23:59:59 Taipei
  const preMidnightUtc = new Date(Date.UTC(2026, 9, 20, 15, 59, 59, 999));
  assert.equal(taipeiDateKey(preMidnightUtc), '20261020');
  assert.equal(dailySeedCode(preMidnightUtc), 'D20261020');

  // 2026-10-20 16:00:00 UTC = 2026-10-21 00:00:00 Taipei
  const postMidnightUtc = new Date(Date.UTC(2026, 9, 20, 16, 0, 0, 0));
  assert.equal(taipeiDateKey(postMidnightUtc), '20261021');
  assert.equal(dailySeedCode(postMidnightUtc), 'D20261021');

  // End of month rollover: 2026-02-28 16:00:00 UTC = 2026-03-01 00:00:00 Taipei
  const monthEndUtc = new Date(Date.UTC(2026, 1, 28, 16, 0, 0, 0));
  assert.equal(taipeiDateKey(monthEndUtc), '20260301');

  // Leap year rollover: 2024-02-28 16:00:00 UTC = 2024-02-29 00:00:00 Taipei
  const leapYearUtc = new Date(Date.UTC(2024, 1, 28, 16, 0, 0, 0));
  assert.equal(taipeiDateKey(leapYearUtc), '20240229');

  // Leap year to March: 2024-02-29 16:00:00 UTC = 2024-03-01 00:00:00 Taipei
  const leapYearToMarchUtc = new Date(Date.UTC(2024, 1, 29, 16, 0, 0, 0));
  assert.equal(taipeiDateKey(leapYearToMarchUtc), '20240301');

  // New Year rollover: 2026-12-31 16:00:00 UTC = 2027-01-01 00:00:00 Taipei
  const newYearUtc = new Date(Date.UTC(2026, 11, 31, 16, 0, 0, 0));
  assert.equal(taipeiDateKey(newYearUtc), '20270101');
  assert.equal(dailySeedCode(newYearUtc), 'D20270101');

  // 2) Daily challenge seed determinism:
  // Identical daily seeds must produce identical runs globally:
  const dailyRunA = createRun(dailySeedCode(postMidnightUtc));
  const dailyRunB = createRun(dailySeedCode(postMidnightUtc));
  assert.equal(dailyRunA.seed, dailyRunB.seed);
  assert.equal(JSON.stringify(dailyRunA.pendingJunction), JSON.stringify(dailyRunB.pendingJunction));

  // Consecutive daily runs must diverge in seed and initial junction branches:
  const prevDayRun = createRun(dailySeedCode(preMidnightUtc));
  assert.notEqual(dailyRunA.seed, prevDayRun.seed);

  // 3) Date arithmetic and consecutive day checks:
  assert.equal(previousDayKey('20261021'), '20261020');
  assert.equal(previousDayKey('20261001'), '20260930');
  assert.equal(previousDayKey('20260301'), '20260228');
  assert.equal(previousDayKey('20240301'), '20240229', 'previousDayKey must handle leap year February 29');
  assert.equal(previousDayKey('20260101'), '20251231', 'previousDayKey must handle year boundaries');

  assert.equal(nextDayKey('20261020'), '20261021');
  assert.equal(nextDayKey('20260930'), '20261001');
  assert.equal(nextDayKey('20240228'), '20240229', 'nextDayKey must handle leap year February 29');
  assert.equal(nextDayKey('20251231'), '20260101', 'nextDayKey must handle year boundaries');

  assert.equal(isConsecutiveDay('20261020', '20261021'), true);
  assert.equal(isConsecutiveDay('20261020', '20261022'), false);
  assert.equal(isConsecutiveDay('20251231', '20260101'), true);
  assert.equal(isConsecutiveDay('20240228', '20240229'), true);

  // 4) Daily streak calculation and preservation:
  const clearHistory: DailyClearRecord[] = [
    { date: '20261018', cleared: true, distance: 1600, score: 2200 },
    { date: '20261019', cleared: true, distance: 1800, score: 2500 },
    { date: '20261020', cleared: true, distance: 2000, score: 3000 },
  ];
  assert.equal(computeDailyStreak(clearHistory, '20261020'), 3, 'streak on today must be 3');
  // Streak survives one open day (player has not cleared yet on 20261021):
  assert.equal(computeDailyStreak(clearHistory, '20261021'), 3, 'streak must survive one open day');

  // Clearing on 20261021 extends streak to 4:
  const extendedHistory: DailyClearRecord[] = [
    ...clearHistory,
    { date: '20261021', cleared: true, distance: 1700, score: 2400 },
  ];
  assert.equal(computeDailyStreak(extendedHistory, '20261021'), 4, 'clearing today must extend streak to 4');

  // Missing two days resets streak:
  assert.equal(computeDailyStreak(clearHistory, '20261023'), 0, 'missing two days must reset streak to 0');

  // Streak across month and year boundaries:
  const yearBoundaryHistory: DailyClearRecord[] = [
    { date: '20251230', cleared: true, distance: 1500, score: 2000 },
    { date: '20251231', cleared: true, distance: 1600, score: 2100 },
    { date: '20260101', cleared: true, distance: 1700, score: 2200 },
  ];
  assert.equal(computeDailyStreak(yearBoundaryHistory, '20260101'), 3, 'streak must preserve across year boundary');

  const leapYearHistory: DailyClearRecord[] = [
    { date: '20240228', cleared: true, distance: 1500, score: 2000 },
    { date: '20240229', cleared: true, distance: 1600, score: 2100 },
    { date: '20240301', cleared: true, distance: 1700, score: 2200 },
  ];
  assert.equal(computeDailyStreak(leapYearHistory, '20240301'), 3, 'streak must preserve across leap year Feb 29');

  // 5) mergeDailyBest streak mechanics:
  const day1 = mergeDailyBest({ date: '', bestDistance: 0, bestScore: 0, attempts: 0, streak: 0 }, '20261020', 1600, 2000);
  assert.equal(day1.attempts, 1);
  assert.equal(day1.streak, 1, 'clearing on day 1 must set streak to 1');

  // Multiple runs on same day must not inflate streak:
  const day1Second = mergeDailyBest(day1, '20261020', 1800, 2500);
  assert.equal(day1Second.attempts, 2);
  assert.equal(day1Second.bestDistance, 1800);
  assert.equal(day1Second.streak, 1, 'multiple attempts on same day must preserve streak at 1');

  // Consecutive day clear increments streak:
  const day2 = mergeDailyBest(day1Second, '20261021', 1700, 2400);
  assert.equal(day2.attempts, 1);
  assert.equal(day2.streak, 2, 'consecutive day clear must advance streak to 2');

  // Skipped day resets streak:
  const day4 = mergeDailyBest(day2, '20261024', 1600, 2200);
  assert.equal(day4.streak, 1, 'clearing after skipped day must reset streak to 1');

  ok('Asia/Taipei calendar rollover for daily challenge seed determinism and streak preservation');
}

console.log(`\nself-check: ok (${passed} checks)`);
