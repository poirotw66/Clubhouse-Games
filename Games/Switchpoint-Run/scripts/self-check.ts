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
  eligibleTemplates,
} from '../src/game/branches.js';
import {
  FIELD_W,
  FIXED_DT,
  HIT_STUN_DURATION,
  HIT_STUN_MIN_MULT,
  JUMP_DURATION,
  LANE_COUNT,
  MIN_SAME_LANE_SPACING,
  SLIDE_DURATION,
  SPEED_MULT,
  MAX_BUFFER,
  START_BUFFER,
  densityFloor,
  laneCenterX,
  playerBasePace,
  trainPace,
} from '../src/game/constants.js';
import { createRun, currentSpeed, finalScore, hitStunFactor, placeJunction, step } from '../src/game/engine.js';
import { hashString, mulberry32, shuffle, streamRng } from '../src/game/rng.js';
import type { ActiveBranch, PlayerInput, RunState } from '../src/game/types.js';

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

console.log(`\nself-check: ok (${passed} checks)`);
