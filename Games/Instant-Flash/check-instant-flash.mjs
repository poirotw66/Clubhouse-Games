/**
 * Runnable verification test suite for Instant Flash (Iai Training Grounds).
 * Directly imports production TypeScript modules via Node native strip-types support.
 * Covers:
 * - Constants and timing window scaling across difficulty tiers 0-6.
 * - Directional counter resolution (left vs right, hit-stop frames, correct damage).
 * - Feint patience detection and early release penalty calculations in resolveCounter.ts.
 * - Calibrated reaction rank evaluation (fair S-rank criteria).
 * - Dan rank status progression from 1-Dan through 9-Dan (皆傳・神速).
 * - Opponent roster ladder unlocking and duel resolution.
 * - Asia/Taipei daily seed determinism, opponent rotation, and win streak tracking.
 */
import assert from 'node:assert/strict';

import {
  WINDOW_PERFECT,
  WINDOW_GOOD,
  getDifficultyTier,
  getTimingWindows,
  getAttackDelayRange,
  getProjectileDurationScale,
  getEffectiveProjectileDurationMs,
  DURATION_KUNAI,
  MIN_KUNAI_FLIGHT_MS,
  SCENARIO_WEIGHTS,
  SCENARIO_DEFAULT_INTENSITY,
  pickProjectileType,
  SCORE_PERFECT,
  SCORE_GOOD,
  SCORE_GUARD,
  SCORE_FEINT_PATIENCE,
  SCORE_EARLY_PENALTY,
  DAMAGE_PLAYER_HIT,
  DAMAGE_PLAYER_BLOCK,
  DAMAGE_GUARD,
  HEAL_PERFECT,
  DAMAGE_ENEMY_PERFECT,
  DAMAGE_ENEMY_GOOD,
  DAMAGE_EARLY,
  DAMAGE_FEINT,
  DAMAGE_WRONG_SIDE,
  HIT_STOP_DURATION,
  SHAKE_DURATION,
  FEINT_VANISH_AT,
  SIDE_LABELS,
  SCENARIO_IDS,
} from './constants.ts';

import { DAN_RANKS, computeDanRankStatus } from './danRank.ts';
import { OPPONENTS, getOpponent, opponentCount, opponentByIndex, opponentById, opponentIndexOf } from './opponents.ts';
import { computeReactionRank, betterRank, RANK_LABELS, rankSortKey } from './ranks.ts';
import { resolveCounter, resolveVersusRelease, BASELINE_WINDOWS } from './resolveCounter.ts';
import { createPatternState, nextAttackEvent } from './patterns.ts';
import { dailySeedNumber, dailyOpponent, dailyOpponentIndex, dateKey, computeStreak } from './daily.ts';
import { CounterResult } from './types.ts';
import { isOpponentUnlocked, applyLadderResult, mergeLadder, EMPTY_LADDER } from './storage.ts';

console.log('--- 1. Real Constants & Timing Window Scaling Across Tiers 0-6 ---');

// Baseline constants verification
assert.equal(WINDOW_PERFECT, 120, 'Perfect timing window baseline must be 120ms');
assert.equal(WINDOW_GOOD, 300, 'Good timing window baseline must be 300ms');
assert.deepEqual(BASELINE_WINDOWS, { perfect: 120, good: 300 });

// Tier 0 baseline
assert.equal(getDifficultyTier(0, 0), 0);
assert.deepEqual(getTimingWindows(0, 0), { perfect: 120, good: 300 });
assert.deepEqual(getAttackDelayRange(0), { min: 1000, max: 2200 });
assert.equal(getProjectileDurationScale(0), 1);

// Tier progression by score and combo
assert.equal(getDifficultyTier(4000, 0), 1);
assert.equal(getDifficultyTier(8000, 0), 2);
assert.deepEqual(getTimingWindows(8000, 0), { perfect: 100, good: 264 });
assert.equal(getDifficultyTier(0, 8), 1);
assert.equal(getDifficultyTier(0, 16), 2);
assert.equal(getDifficultyTier(4000, 8), 2);

// Base tier floor offset (used in duels / hard drills)
assert.equal(getDifficultyTier(0, 0, 2), 2);
assert.equal(getDifficultyTier(0, 0, 4), 4);
assert.deepEqual(getTimingWindows(0, 0, 2), { perfect: 100, good: 264 });
assert.deepEqual(getAttackDelayRange(0, 2), { min: 720, max: 1920 });
assert.ok(Math.abs(getProjectileDurationScale(0, 2) - 0.86) < 1e-9);

// Upper bounds (Tier 6 cap)
assert.equal(getDifficultyTier(999999, 999), 6);
assert.equal(getDifficultyTier(8000, 0, 4), 6);
const tier6Windows = getTimingWindows(999999, 999);
assert.equal(tier6Windows.perfect, 60, 'Tier 6 perfect window tightens to 60ms');
assert.equal(tier6Windows.good, 192, 'Tier 6 good window tightens to 192ms');

// Attack delay range scaling
assert.deepEqual(getAttackDelayRange(6000), { min: 860, max: 2060 });
assert.deepEqual(getAttackDelayRange(30000), { min: 550, max: 1500 });
assert.equal(getProjectileDurationScale(32000), 0.72, 'Projectile scale caps at 0.72 minimum');

// Invariant checks across matrix of scores, combos, and base tiers
for (let score = 0; score <= 32000; score += 4000) {
  for (let combo = 0; combo <= 48; combo += 8) {
    for (const baseTier of [0, 2, 4]) {
      const tier = getDifficultyTier(score, combo, baseTier);
      assert.ok(tier >= 0 && tier <= 6, `Tier ${tier} must be between 0 and 6`);
      const w = getTimingWindows(score, combo, baseTier);
      assert.ok(w.perfect < w.good, 'Perfect window must always be strictly narrower than Good');
      assert.ok(w.perfect >= 55, 'Perfect window floor must be >= 55ms');
      assert.ok(w.good >= 160, 'Good window floor must be >= 160ms');
    }
  }
}

// Scenario weight distributions and RNG pick
const ALLOWED_PROJECTILES = new Set(['SHURIKEN', 'KUNAI', 'BOMB', 'SICKLE']);
for (const [id, table] of Object.entries(SCENARIO_WEIGHTS)) {
  assert.ok(SCENARIO_IDS.includes(id));
  assert.ok(table.length >= 2, `Scenario ${id} must contain multiple projectiles`);
  let sum = 0;
  for (const row of table) {
    assert.ok(ALLOWED_PROJECTILES.has(row.type), `Valid projectile type ${row.type}`);
    assert.ok(row.weight > 0, 'Weight must be positive');
    sum += row.weight;
  }
  assert.ok(Math.abs(sum - 1) < 1e-9, `Scenario ${id} weights must sum to 1.0`);
  assert.ok([0, 2, 4].includes(SCENARIO_DEFAULT_INTENSITY[id]));
}

assert.equal(pickProjectileType('mixed', () => 0), 'SHURIKEN');
assert.equal(pickProjectileType('mixed', () => 0.4), 'KUNAI');
assert.equal(pickProjectileType('kunai', () => 0), 'KUNAI');
assert.equal(pickProjectileType('bomb', () => 0), 'BOMB');


console.log('--- 2. Directional Counter Resolution & Hit-Stop Mechanics ---');

// Side label localization
assert.equal(SIDE_LABELS.left, '左斬');
assert.equal(SIDE_LABELS.right, '右斬');

// Directional parry matching
const baseResolve = {
  timingDiffMs: 0,
  playerSide: 'left',
  attackSide: 'left',
  isFeint: false,
  noAttack: false,
  score: 0,
  combo: 0,
  baseTier: 0,
};

// Left-side hit
const leftPerfect = resolveCounter({ ...baseResolve, timingDiffMs: 20, playerSide: 'left', attackSide: 'left' });
assert.equal(leftPerfect.result, CounterResult.PERFECT);
assert.equal(leftPerfect.absTimingMs, 20);

// Right-side hit
const rightPerfect = resolveCounter({ ...baseResolve, timingDiffMs: -30, playerSide: 'right', attackSide: 'right' });
assert.equal(rightPerfect.result, CounterResult.PERFECT);
assert.equal(rightPerfect.absTimingMs, 30);

// Wrong side resolution (punished even with frame-perfect timing)
const wrongSideLeft = resolveCounter({ ...baseResolve, timingDiffMs: 0, playerSide: 'left', attackSide: 'right' });
assert.equal(wrongSideLeft.result, CounterResult.WRONG_SIDE);
assert.equal(wrongSideLeft.absTimingMs, 0);

const wrongSideRight = resolveCounter({ ...baseResolve, timingDiffMs: 15, playerSide: 'right', attackSide: 'left' });
assert.equal(wrongSideRight.result, CounterResult.WRONG_SIDE);

// Good window resolution
const goodEarly = resolveCounter({ ...baseResolve, timingDiffMs: -150 });
assert.equal(goodEarly.result, CounterResult.GOOD);

const goodLate = resolveCounter({ ...baseResolve, timingDiffMs: 250 });
assert.equal(goodLate.result, CounterResult.GOOD);

// Out of bounds (Early / Late)
const tooEarly = resolveCounter({ ...baseResolve, timingDiffMs: -350 });
assert.equal(tooEarly.result, CounterResult.EARLY);

const tooLate = resolveCounter({ ...baseResolve, timingDiffMs: 350 });
assert.equal(tooLate.result, CounterResult.LATE);

// Neutral guard (Space/J): partial block only — never PERFECT, no wrong-side, still punished by feint/early/late
const guardExact = resolveCounter({ ...baseResolve, timingDiffMs: 0, playerSide: 'guard', attackSide: 'right' });
assert.equal(guardExact.result, CounterResult.GUARD, 'Neutral guard must not award PERFECT');
const guardFeint = resolveCounter({ ...baseResolve, timingDiffMs: 0, playerSide: 'guard', isFeint: true });
assert.equal(guardFeint.result, CounterResult.FEINT, 'Neutral guard still punished on feints');
const guardLate = resolveCounter({ ...baseResolve, timingDiffMs: 350, playerSide: 'guard' });
assert.equal(guardLate.result, CounterResult.LATE, 'Neutral guard still punished when late');
assert.equal(SCORE_GUARD, 100);
assert.equal(DAMAGE_GUARD, 8);

// Versus release validation: late releases & feints must foul rather than scoring
assert.deepEqual(
  resolveVersusRelease({ attacking: true, isFeint: false, timingDiffMs: 40, goodWindowMs: 300, alreadyFouled: false }),
  { outcome: 'point' },
);
assert.deepEqual(
  resolveVersusRelease({ attacking: true, isFeint: false, timingDiffMs: 320, goodWindowMs: 300, alreadyFouled: false }),
  { outcome: 'foul', reason: 'late' },
  'Versus late release must be a foul, not a point',
);
assert.deepEqual(
  resolveVersusRelease({ attacking: true, isFeint: true, timingDiffMs: 0, goodWindowMs: 300, alreadyFouled: false }),
  { outcome: 'foul', reason: 'feint' },
  'Versus release on feint must be a foul, not a point',
);
assert.deepEqual(
  resolveVersusRelease({ attacking: false, isFeint: false, timingDiffMs: -9999, goodWindowMs: 300, alreadyFouled: false }),
  { outcome: 'foul', reason: 'early' },
);
assert.deepEqual(
  resolveVersusRelease({ attacking: true, isFeint: false, timingDiffMs: 0, goodWindowMs: 300, alreadyFouled: true }),
  { outcome: 'ignore' },
);

// Kunai minimum duration scale stays fair for directional reading
assert.ok(
  getEffectiveProjectileDurationMs(DURATION_KUNAI, 0.55, 32000, 4, 'KUNAI') >= MIN_KUNAI_FLIGHT_MS,
  'Effective kunai duration must respect MIN_KUNAI_FLIGHT_MS floor',
);
const surgeOpp = getOpponent('surge');
assert.ok(surgeOpp != null);
const patState = createPatternState();
patState.strikeIndex = 20;
const surgeEvt = nextAttackEvent(surgeOpp, patState, () => 0.1, 'kunai');
assert.equal(surgeEvt.projectile, 'KUNAI');
assert.ok(surgeEvt.durationScale >= 0.85, `Kunai pattern durationScale must stay >= 0.85, got ${surgeEvt.durationScale}`);

// Visual and feedback constants
assert.equal(HIT_STOP_DURATION, 150, 'Hit stop duration must be 150ms');
assert.equal(SHAKE_DURATION, 300, 'Screen shake duration must be 300ms');
assert.equal(FEINT_VANISH_AT, 0.42, 'Feint projectile disappears at 42% flight');

// Duel damage and scoring contracts
assert.equal(DAMAGE_ENEMY_PERFECT, 28, 'Perfect counter deals 28 enemy damage');
assert.equal(DAMAGE_ENEMY_GOOD, 16, 'Good counter deals 16 enemy damage');
assert.equal(DAMAGE_PLAYER_HIT, 25, 'Unblocked attack deals 25 player damage');
assert.equal(DAMAGE_PLAYER_BLOCK, 5, 'Blocked / late counter chip damage is 5');
assert.equal(HEAL_PERFECT, 15, 'Perfect counter heals 15 HP');
assert.equal(SCORE_PERFECT, 1000);
assert.equal(SCORE_GOOD, 300);


console.log('--- 3. Feint Patience Detection & Early Release Penalties ---');

// Idle slash with no incoming attack
const idleSlash = resolveCounter({
  ...baseResolve,
  timingDiffMs: -9999,
  noAttack: true,
});
assert.equal(idleSlash.result, CounterResult.EARLY, 'Idle slash triggers EARLY penalty');

// Feint slash punishment
const feintSlash = resolveCounter({
  ...baseResolve,
  timingDiffMs: 10,
  isFeint: true,
});
assert.equal(feintSlash.result, CounterResult.FEINT, 'Slashing a feint triggers FEINT penalty');

// Penalties and reward balances
assert.equal(SCORE_FEINT_PATIENCE, 400, 'Holding during feint rewards 400 patience points');
assert.equal(SCORE_EARLY_PENALTY, 0, 'Early penalty yields 0 score');
assert.equal(DAMAGE_EARLY, 20, 'Early slash penalty inflicts 20 damage');
assert.equal(DAMAGE_FEINT, 22, 'Feint misread penalty inflicts 22 damage');
assert.equal(DAMAGE_WRONG_SIDE, 20, 'Wrong side parry penalty inflicts 20 damage');


console.log('--- 4. Calibrated Reaction Rank Evaluation (Fairness) ---');

// Labels
assert.equal(RANK_LABELS.S, 'S 宗師');
assert.equal(RANK_LABELS.A, 'A 上級');
assert.equal(RANK_LABELS.B, 'B 中堅');
assert.equal(RANK_LABELS.C, 'C 見習');

// Sample size < 3 returns C
assert.equal(computeReactionRank({ avgAbsTimingMs: 20, accuracy: 1.0, sampleSize: 2 }), 'C');

// Calibrated S-Rank criteria:
// Path 1: avgAbsTimingMs <= 60 && accuracy >= 0.80
assert.equal(
  computeReactionRank({ avgAbsTimingMs: 58, accuracy: 0.82, sampleSize: 10 }),
  'S',
  'avgAbsTimingMs <= 60 with accuracy >= 0.80 earns S-Rank',
);
assert.equal(
  computeReactionRank({ avgAbsTimingMs: 60, accuracy: 0.80, sampleSize: 5 }),
  'S',
  'Boundary 60ms / 80% accuracy earns S-Rank',
);

// Path 2: avgAbsTimingMs <= 45 && accuracy >= 0.75
assert.equal(
  computeReactionRank({ avgAbsTimingMs: 40, accuracy: 0.76, sampleSize: 8 }),
  'S',
  'Exceptional timing <= 45ms with accuracy >= 0.75 earns S-Rank even with a missed feint',
);
assert.equal(
  computeReactionRank({ avgAbsTimingMs: 45, accuracy: 0.75, sampleSize: 8 }),
  'S',
  'Boundary 45ms / 75% accuracy earns S-Rank',
);

// High speed but accuracy below 0.75 drops from S
assert.equal(
  computeReactionRank({ avgAbsTimingMs: 40, accuracy: 0.74, sampleSize: 8 }),
  'A',
  'Accuracy below 0.75 cannot earn S-Rank',
);

// Standard A, B, C tiers
assert.equal(computeReactionRank({ avgAbsTimingMs: 85, accuracy: 0.72, sampleSize: 8 }), 'A');
assert.equal(computeReactionRank({ avgAbsTimingMs: 140, accuracy: 0.55, sampleSize: 8 }), 'B');
assert.equal(computeReactionRank({ avgAbsTimingMs: 220, accuracy: 0.40, sampleSize: 8 }), 'C');

// Better rank comparator
assert.equal(betterRank('C', 'B'), 'B');
assert.equal(betterRank('B', 'A'), 'A');
assert.equal(betterRank('A', 'S'), 'S');
assert.equal(betterRank('S', 'A'), 'S');
assert.equal(betterRank(null, 'A'), 'A');
assert.ok(rankSortKey('S') > rankSortKey('A'));
assert.ok(rankSortKey('A') > rankSortKey('B'));
assert.ok(rankSortKey('B') > rankSortKey('C'));


console.log('--- 5. Dan Rank Status Progression (1-Dan to 9-Dan 皆傳・神速) ---');

assert.equal(DAN_RANKS.length, 9, 'Must have exactly 9 Dan ranks');
assert.equal(DAN_RANKS[0].badge, '1D');
assert.equal(DAN_RANKS[8].badge, '皆傳');
assert.equal(DAN_RANKS[8].name, '皆傳・神速');
assert.ok(DAN_RANKS[8].requirement.includes('70ms'), 'Level 9 requirement notes 70ms threshold');

// New player status
const emptyBest = { highScore: 0, maxCombo: 0 };
const initLadder = {
  clearedCount: 0,
  cleared: {},
  lastIndex: 0,
  opponentBests: {},
  dailyRecords: [],
};

const status1 = computeDanRankStatus(emptyBest, initLadder, null);
assert.equal(status1.currentRank.level, 1, 'Novice starts at 1-Dan');
assert.equal(status1.nextRank?.level, 2, 'Next rank is 2-Dan');
assert.ok(status1.progressPercent > 0 && status1.progressPercent < 100);

// Progressive unlock checks
// Level 2 (2D): clearedCount >= 1 OR highScore >= 2000
const status2 = computeDanRankStatus({ highScore: 2500, maxCombo: 3 }, initLadder, null);
assert.equal(status2.currentRank.level, 2, 'High score 2500 unlocks 2-Dan');

// Level 3 (3D): clearedCount >= 2 OR (highScore >= 5000 && bestReactionMs <= 220)
const status3 = computeDanRankStatus(
  { highScore: 5500, maxCombo: 4 },
  initLadder,
  { ...status1.currentRank, bestReactionMs: 200, score: 5500, maxCombo: 4, rank: 'B' },
);
assert.equal(status3.currentRank.level, 3, '5000+ score and <=220ms unlocks 3-Dan');

// Level 8 (8D): clearedCount >= 7 && maxCombo >= 16 && bestReactionMs <= 75
const ladder7 = {
  ...initLadder,
  clearedCount: 7,
  opponentBests: {
    ronin: { bestReactionMs: 80, rank: 'A', wins: 1, losses: 0 },
    bait: { bestReactionMs: 72, rank: 'A', wins: 1, losses: 0 },
  },
};
const status8 = computeDanRankStatus({ highScore: 20000, maxCombo: 18 }, ladder7, {
  score: 0,
  maxCombo: 18,
  bestReactionMs: 74,
  rank: 'A',
});
assert.equal(status8.currentRank.level, 8, '7 cleared, combo >= 16, best <= 75ms unlocks 8-Dan');

// Level 9 (皆傳・神速): clearedCount >= 8 && hasSRank && bestReactionMs <= 70
// Case A: Cleared 8, has S-Rank, bestReactionMs 68ms -> Unlocks 9-Dan!
const ladder8Master = {
  ...initLadder,
  clearedCount: 8,
  opponentBests: {
    master: { bestReactionMs: 68, rank: 'S', wins: 1, losses: 0 },
  },
};
const status9 = computeDanRankStatus({ highScore: 35000, maxCombo: 25 }, ladder8Master, {
  score: 10000,
  maxCombo: 25,
  bestReactionMs: 68,
  rank: 'S',
});
assert.equal(status9.currentRank.level, 9, 'Level 9皆傳・神速 unlocks when requirements met');
assert.equal(status9.nextRank, null, 'No rank beyond Level 9');
assert.equal(status9.progressPercent, 100, 'Max rank has 100% progress');

// Case B: Best reaction 72ms (exceeds 70ms) -> Held at 8-Dan
const status9FailSpeed = computeDanRankStatus(
  { highScore: 35000, maxCombo: 25 },
  {
    ...initLadder,
    clearedCount: 8,
    opponentBests: { master: { bestReactionMs: 72, rank: 'S', wins: 1, losses: 0 } },
  },
  { score: 10000, maxCombo: 25, bestReactionMs: 72, rank: 'S' },
);
assert.equal(status9FailSpeed.currentRank.level, 8, 'Reaction time > 70ms held at 8-Dan');

// Case C: No S-rank -> Held at 8-Dan
const status9FailSRank = computeDanRankStatus(
  { highScore: 35000, maxCombo: 25 },
  {
    ...initLadder,
    clearedCount: 8,
    opponentBests: { master: { bestReactionMs: 65, rank: 'A', wins: 1, losses: 0 } },
  },
  { score: 10000, maxCombo: 25, bestReactionMs: 65, rank: 'A' },
);
assert.equal(status9FailSRank.currentRank.level, 8, 'Missing S-Rank held at 8-Dan');


console.log('--- 6. Opponents Roster & Duel Ladder Mechanics ---');

assert.equal(opponentCount(), 8, 'Roster must contain 8 opponents');
assert.equal(OPPONENTS.length, 8);

// getOpponent helper resolution by id and index
const firstOpp = getOpponent(0);
assert.ok(firstOpp && firstOpp.id === 'ronin');
assert.equal(getOpponent('ronin')?.name, '見習浪人');

const masterOpp = getOpponent(7);
assert.ok(masterOpp && masterOpp.id === 'master');
assert.equal(masterOpp.isBoss, true, 'Master opponent is marked as boss');
assert.equal(getOpponent('master')?.trait, 'boss');
assert.equal(opponentIndexOf('master'), 7);

// Ladder unlocking
assert.ok(isOpponentUnlocked(0, 0), 'First opponent is always unlocked');
assert.ok(!isOpponentUnlocked(1, 0), 'Second opponent locked at clearedCount 0');
assert.ok(isOpponentUnlocked(1, 1), 'Second opponent unlocked at clearedCount 1');
assert.ok(isOpponentUnlocked(7, 7), 'Master unlocked at clearedCount 7');

// applyLadderResult state transitions
const { progress: step1, newlyCleared: nc1 } = applyLadderResult(EMPTY_LADDER, 0, {
  won: true,
  bestReactionMs: 85,
  rank: 'A',
});
assert.equal(nc1, true, 'First win triggers newlyCleared');
assert.equal(step1.clearedCount, 1, 'clearedCount advances to 1');
assert.equal(step1.cleared.ronin, true);
assert.equal(step1.opponentBests.ronin?.wins, 1);
assert.equal(step1.opponentBests.ronin?.rank, 'A');

// Replaying won opponent doesn't advance clearedCount beyond frontier
const { progress: step1Repeat, newlyCleared: ncRepeat } = applyLadderResult(step1, 0, {
  won: true,
  bestReactionMs: 60,
  rank: 'S',
});
assert.equal(ncRepeat, false);
assert.equal(step1Repeat.clearedCount, 1);
assert.equal(step1Repeat.opponentBests.ronin?.rank, 'S', 'Better rank merges');
assert.equal(step1Repeat.opponentBests.ronin?.bestReactionMs, 60, 'Faster time merges');
assert.equal(step1Repeat.opponentBests.ronin?.wins, 2);

// Defeat records loss
const { progress: stepDefeat } = applyLadderResult(step1, 1, {
  won: false,
  bestReactionMs: null,
  rank: null,
});
assert.equal(stepDefeat.clearedCount, 1, 'Loss does not advance clearedCount');
assert.equal(stepDefeat.opponentBests.bait?.losses, 1);


console.log('--- 7. Asia/Taipei Daily Seed Determinism & Win Streaks ---');

// UTC+8 calendar day shift
const taipeiMorning = new Date('2026-11-19T02:00:00Z'); // 10:00 Taipei
assert.equal(dateKey(taipeiMorning), '2026-11-19');

const taipeiLateNight = new Date('2026-11-19T15:30:00Z'); // 23:30 Taipei
assert.equal(dateKey(taipeiLateNight), '2026-11-19');

const taipeiNextDay = new Date('2026-11-19T16:01:00Z'); // 00:01 Nov 20 Taipei
assert.equal(dateKey(taipeiNextDay), '2026-11-20');

// Seed determinism
const seedA = dailySeedNumber('2026-11-19');
const seedB = dailySeedNumber('2026-11-19');
assert.equal(seedA, seedB, 'Daily seed must be deterministic for identical date');
assert.notEqual(seedA, dailySeedNumber('2026-11-20'), 'Different dates generate different seeds');

// Daily opponent rotation
const oppNov19 = dailyOpponent('2026-11-19');
assert.ok(oppNov19 && OPPONENTS.some((o) => o.id === oppNov19.id));

// Deterministic rotation test over a month of daily challenges
const seenOpponents = new Set();
for (let d = 1; d <= 30; d++) {
  const dayStr = `2026-11-${String(d).padStart(2, '0')}`;
  const opp = dailyOpponent(dayStr);
  assert.ok(opp != null);
  seenOpponents.add(opp.id);
}
assert.ok(seenOpponents.size >= 4, 'Daily challenge must rotate through multiple opponents');

// Streak calculation logic
assert.equal(
  computeStreak(
    [
      { date: '2026-11-17', won: true, bestReactionMs: 80, rank: 'A' },
      { date: '2026-11-18', won: true, bestReactionMs: 70, rank: 'S' },
      { date: '2026-11-19', won: true, bestReactionMs: 65, rank: 'S' },
    ],
    '2026-11-19',
  ),
  3,
  'Three consecutive wins ending today has streak 3',
);

// Streak survives yesterday's win before today's match has been played
assert.equal(
  computeStreak(
    [
      { date: '2026-11-17', won: true, bestReactionMs: 80, rank: 'A' },
      { date: '2026-11-18', won: true, bestReactionMs: 70, rank: 'S' },
    ],
    '2026-11-19',
  ),
  2,
  'Streak persists if yesterday was won and today has not yet been played',
);

// Broken streak due to missed calendar day
assert.equal(
  computeStreak(
    [
      { date: '2026-11-16', won: true, bestReactionMs: 80, rank: 'A' },
      { date: '2026-11-18', won: true, bestReactionMs: 70, rank: 'S' },
    ],
    '2026-11-19',
  ),
  1,
  'Missed Nov 17 breaks earlier streak',
);

console.log('All Instant-Flash tests passed successfully!');
