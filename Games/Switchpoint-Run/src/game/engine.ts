/**
 * The whole simulation: a fixed-timestep pure reducer `step(state, input, dt)`.
 * Nothing here touches the DOM, and every function returns a new RunState
 * rather than mutating its input, so the renderer, the self-check and the
 * balance harness can all treat RunState as an immutable snapshot.
 *
 * Determinism is the point. A run is a pure function of (seed, input
 * sequence): no Math.random is called during play. The only randomness is
 * which branch templates get offered at each junction, and that draws from a
 * labelled stream keyed off the junction id, so it is exactly as replayable as
 * everything else.
 */
import {
  APPROACH_LEN,
  HIT_STUN_DURATION,
  HIT_STUN_MIN_MULT,
  JUMP_DURATION,
  LANE_COUNT,
  LANE_CHANGE_COOLDOWN,
  LEAD_IN_LEN,
  NO_HIT_BONUS_PER_STREAK,
  PLAYER_BASE_SPEED,
  ROUTE_SCORE_PER_BRANCH,
  ROUTE_SCORE_PER_DENSITY_CLEAN,
  SCORE_MULT_STEP,
  SLIDE_DURATION,
  SPEED_MULT,
  START_BUFFER,
  SUPPLY_BUFFER_GAIN,
  playerBasePace,
  trainPace,
  type BranchTemplate,
} from './constants';
import { eligibleTemplates } from './branches';
import { hashString, shuffle, streamRng } from './rng';
import type { ActiveBranch, Junction, PlacedBranch, PlayerInput, RunState } from './types';

// ── Junction generation ──────────────────────────────────────────────────────

function placedFromTemplate(t: BranchTemplate, lane: number, lockDistance: number): PlacedBranch {
  return {
    templateId: t.id,
    name: t.name,
    lane,
    speedMult: SPEED_MULT[t.speed],
    reward: t.reward,
    rewardAbsDistance: lockDistance + t.rewardOffset,
    length: t.length,
    obstacles: t.obstacles.map((o) => ({ ...o, absDistance: lockDistance + o.offset, resolved: false })),
    density: t.obstacles.length,
  };
}

/**
 * Builds one junction's worth of branches. 2 or 3 branches, drawn from
 * whatever the current distance has unlocked, so the pool "opens up
 * higher-order entries" as the run goes on without any engine-side notion of
 * which templates are "advanced" — that lives entirely in unlockDistance.
 */
export function placeJunction(seed: number, id: number, lockDistance: number): Junction {
  const pool = eligibleTemplates(lockDistance);
  const rCount = streamRng(seed, `junction:${id}:count`);
  const wantThree = pool.length >= 3 && rCount() < 0.72;
  const branchCount = Math.min(pool.length, wantThree ? 3 : 2);

  const rPick = streamRng(seed, `junction:${id}:pick`);
  const chosen = shuffle(pool, rPick).slice(0, branchCount);

  // Lanes are assigned by a second, independent shuffle so which physical lane
  // (left/mid/right) a given template lands on isn't correlated with the order
  // it was drawn in.
  const rLane = streamRng(seed, `junction:${id}:lane`);
  const lanes = shuffle(
    Array.from({ length: LANE_COUNT }, (_, i) => i).slice(0, branchCount),
    rLane,
  );

  return {
    id,
    lockDistance,
    branches: chosen.map((t, i) => placedFromTemplate(t, lanes[i], lockDistance)),
  };
}

// ── Construction ─────────────────────────────────────────────────────────────

/**
 * `startDistance` exists for measurement, mirroring Danmaku-Abyss's
 * `startStage`: the difficulty curve must be knowable without a harness pilot
 * first surviving everything before it, or every late-run number is
 * conditional on early-run luck. Pace is a function of elapsed TIME, not
 * distance (see the comment on SPEED_RAMP_PER_SEC), so jumping straight to a
 * high distance needs a matching `startElapsed` too, or the pace would read
 * as though the run had only just begun — it defaults to a plain estimate
 * (distance / base speed) rather than 0.
 */
export function createRun(
  seedCode: string,
  startDistance = 0,
  startElapsed = startDistance / PLAYER_BASE_SPEED,
): RunState {
  const seed = hashString(seedCode);
  const firstLock = startDistance + LEAD_IN_LEN;
  const pending = placeJunction(seed, 1, firstLock);
  return {
    seed,
    seedCode,
    tick: 0,
    phase: 'playing',
    elapsed: startElapsed,
    distance: startDistance,
    buffer: START_BUFFER,
    playerSpeed: playerBasePace(startElapsed),
    lane: 1,
    jumpTimer: 0,
    slideTimer: 0,
    laneChangeCooldown: 0,
    hitStunTimer: 0,
    activeBranch: null,
    pendingJunction: pending,
    nextJunctionId: 2,
    noHitStreak: 0,
    maxNoHitStreak: 0,
    routeScore: 0,
    scoreMult: 1,
    branchesCleared: 0,
    hitsTotal: 0,
    offeredTemplateIds: pending.branches.map((b) => b.templateId),
  };
}

function cloneBranch<T extends PlacedBranch>(b: T): T {
  return { ...b, obstacles: b.obstacles.map((o) => ({ ...o })) };
}

function cloneJunction(j: Junction): Junction {
  return { ...j, branches: j.branches.map(cloneBranch) };
}

function clone(s: RunState): RunState {
  return {
    ...s,
    activeBranch: s.activeBranch ? cloneBranch(s.activeBranch) : null,
    pendingJunction: cloneJunction(s.pendingJunction),
    offeredTemplateIds: s.offeredTemplateIds.slice(),
  };
}

// ── Derived stats (exported so the self-check and balance harness read the
// same formulas the renderer does, rather than re-deriving them) ────────────

/** Speed multiplier while recovering from a hit: HIT_STUN_MIN_MULT right at
 * the moment of impact, climbing back to 1 as hitStunTimer counts down to 0. */
export function hitStunFactor(hitStunTimer: number): number {
  if (hitStunTimer <= 0) return 1;
  const frac = Math.min(1, hitStunTimer / HIT_STUN_DURATION);
  return HIT_STUN_MIN_MULT + (1 - HIT_STUN_MIN_MULT) * (1 - frac);
}

export function currentSpeed(s: RunState): number {
  const branchMult = s.activeBranch ? s.activeBranch.speedMult : 1;
  return playerBasePace(s.elapsed) * branchMult * hitStunFactor(s.hitStunTimer);
}

/** Score is a pure function of the final state rather than an incrementally
 * stored field, so it always matches the spec's formula exactly — including
 * for reward branches taken before the multiplier they contribute to had
 * grown, which the formula intentionally does not special-case. */
export function finalScore(s: RunState): number {
  return Math.round(s.distance + s.routeScore * s.scoreMult + s.maxNoHitStreak * NO_HIT_BONUS_PER_STREAK);
}

// ── The step ─────────────────────────────────────────────────────────────────

export function step(state: RunState, input: PlayerInput, dt: number): RunState {
  if (state.phase !== 'playing') return state;
  const s = clone(state);
  s.tick += 1;
  s.elapsed += dt;

  s.laneChangeCooldown = Math.max(0, s.laneChangeCooldown - dt);
  s.jumpTimer = Math.max(0, s.jumpTimer - dt);
  s.slideTimer = Math.max(0, s.slideTimer - dt);
  s.hitStunTimer = Math.max(0, s.hitStunTimer - dt);

  // 1) Lane change. Locked out while jumping or sliding, per spec.
  const locked = s.jumpTimer > 0 || s.slideTimer > 0;
  if (input.laneStep !== 0 && !locked && s.laneChangeCooldown <= 0) {
    const next = Math.min(LANE_COUNT - 1, Math.max(0, s.lane + input.laneStep));
    if (next !== s.lane) {
      s.lane = next;
      s.laneChangeCooldown = LANE_CHANGE_COOLDOWN;
    }
  }

  // 2) Jump / slide. Mutually exclusive; each blocks the other and blocks
  // lane changes for its own duration.
  if (input.jump && !locked) {
    s.jumpTimer = JUMP_DURATION;
  } else if (input.slide && !locked) {
    s.slideTimer = SLIDE_DURATION;
  }

  // 3) Move. The only two things that can make you faster than the plain
  // course pace are the branch you are on and nothing else — no upgrade path,
  // no permanent speed stat, so a "fast" run is a run of good branch picks.
  const speed = currentSpeed(s);
  s.playerSpeed = speed;
  const prevDistance = s.distance;
  s.distance += speed * dt;

  // 4) Buffer: the entire core tension in one line. Positive when you are
  // outrunning the train's own relentless pace, negative when you are not.
  // Both playerBasePace and trainPace are functions of s.elapsed (the same
  // value, read once already this tick), so there is no discretization gap
  // between the two sides of this comparison the way there was when the ramp
  // was keyed off distance and one side raced ahead of the other.
  s.buffer += (speed - trainPace(s.elapsed)) * dt;

  // 5) Resolve the active branch: obstacles crossed this tick, the reward
  // point if any, and completion.
  if (s.activeBranch) {
    const branch = s.activeBranch;
    for (const o of branch.obstacles) {
      if (o.resolved) continue;
      if (o.absDistance <= prevDistance || o.absDistance > s.distance) continue;
      o.resolved = true;
      const inLane = o.lane === s.lane;
      const cleared = !inLane || (o.kind === 'hurdle' && s.jumpTimer > 0) || (o.kind === 'beam' && s.slideTimer > 0);
      // A 'wall' obstacle in your lane has no timed action — the only way past
      // it is to not be there, which is a positioning decision made during the
      // approach, not a reflex.
      if (cleared) {
        s.noHitStreak += 1;
        s.maxNoHitStreak = Math.max(s.maxNoHitStreak, s.noHitStreak);
      } else {
        s.noHitStreak = 0;
        s.hitStunTimer = Math.max(s.hitStunTimer, HIT_STUN_DURATION);
        branch.hitCount += 1;
        s.hitsTotal += 1;
      }
    }

    if (
      !branch.rewardCollected &&
      branch.reward !== 'none' &&
      branch.rewardAbsDistance > prevDistance &&
      branch.rewardAbsDistance <= s.distance
    ) {
      branch.rewardCollected = true;
      if (branch.reward === 'supply') s.buffer += SUPPLY_BUFFER_GAIN;
      else if (branch.reward === 'score') s.scoreMult += SCORE_MULT_STEP;
    }

    if (s.distance >= branch.endDistance) {
      s.routeScore += ROUTE_SCORE_PER_BRANCH;
      if (branch.hitCount === 0) {
        s.routeScore += branch.density * ROUTE_SCORE_PER_DENSITY_CLEAN;
      }
      s.branchesCleared += 1;
      s.activeBranch = null;
    }
  }

  // 6) Junction lock: whichever lane you are physically standing in when you
  // cross the lock point is the branch you take. If that lane has no branch
  // (a 2-branch junction leaves one lane closed), it is treated exactly like
  // hitting a wall — a hit, then a deterministic reassignment to the nearest
  // real branch so the run keeps going.
  if (!s.activeBranch) {
    const pj = s.pendingJunction;
    if (pj.lockDistance > prevDistance && pj.lockDistance <= s.distance) {
      let chosen = pj.branches.find((b) => b.lane === s.lane);
      if (!chosen) {
        s.hitStunTimer = Math.max(s.hitStunTimer, HIT_STUN_DURATION);
        s.hitsTotal += 1;
        s.noHitStreak = 0;
        chosen = pj.branches.reduce((best, b) =>
          Math.abs(b.lane - s.lane) < Math.abs(best.lane - s.lane) ? b : best,
        );
        s.lane = chosen.lane;
      }
      s.activeBranch = {
        ...chosen,
        obstacles: chosen.obstacles.map((o) => ({ ...o })),
        startDistance: pj.lockDistance,
        endDistance: pj.lockDistance + chosen.length,
        rewardCollected: false,
        hitCount: 0,
      };

      const nextLock = s.activeBranch.endDistance + APPROACH_LEN;
      const nextJunction = placeJunction(s.seed, s.nextJunctionId, nextLock);
      s.nextJunctionId += 1;
      for (const b of nextJunction.branches) {
        if (!s.offeredTemplateIds.includes(b.templateId)) s.offeredTemplateIds.push(b.templateId);
      }
      s.pendingJunction = nextJunction;
    }
  }

  // 7) End condition: caught by the train.
  if (s.buffer <= 0) {
    s.buffer = 0;
    s.phase = 'caught';
  }

  return s;
}

export type { ActiveBranch };
