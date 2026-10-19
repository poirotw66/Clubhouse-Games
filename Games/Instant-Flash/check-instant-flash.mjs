/**
 * Runnable check for Instant Flash difficulty tiers, practice scenarios,
 * duel ladder roster, directional resolve, ranks, and Taipei daily seed.
 * Mirrors Games/Instant-Flash sources — fail loudly if formulas drift.
 */
import assert from 'node:assert/strict';

const WINDOW_PERFECT = 120;
const WINDOW_GOOD = 300;
const WARNING_DURATION_MIN = 1000;
const WARNING_DURATION_MAX = 2200;

function getDifficultyTier(score, combo, baseTier = 0) {
  return Math.min(6, baseTier + Math.floor(score / 4000) + Math.floor(combo / 8));
}

function getTimingWindows(score, combo, baseTier = 0) {
  const tier = getDifficultyTier(score, combo, baseTier);
  return {
    perfect: Math.max(55, WINDOW_PERFECT - tier * 10),
    good: Math.max(160, WINDOW_GOOD - tier * 18),
  };
}

function getAttackDelayRange(score, baseTier = 0) {
  const tier = Math.min(5, baseTier + Math.floor(score / 6000));
  const cut = tier * 140;
  return {
    min: Math.max(550, WARNING_DURATION_MIN - cut),
    max: Math.max(1100, WARNING_DURATION_MAX - cut),
  };
}

function getProjectileDurationScale(score, baseTier = 0) {
  const tier = Math.min(4, baseTier + Math.floor(score / 8000));
  return Math.max(0.72, 1 - tier * 0.07);
}

const SCENARIO_WEIGHTS = {
  mixed: [
    { type: 'SHURIKEN', weight: 0.4 },
    { type: 'KUNAI', weight: 0.25 },
    { type: 'BOMB', weight: 0.2 },
    { type: 'SICKLE', weight: 0.15 },
  ],
  kunai: [
    { type: 'KUNAI', weight: 0.55 },
    { type: 'SHURIKEN', weight: 0.25 },
    { type: 'SICKLE', weight: 0.15 },
    { type: 'BOMB', weight: 0.05 },
  ],
  bomb: [
    { type: 'BOMB', weight: 0.5 },
    { type: 'SHURIKEN', weight: 0.25 },
    { type: 'SICKLE', weight: 0.15 },
    { type: 'KUNAI', weight: 0.1 },
  ],
  chaos: [
    { type: 'KUNAI', weight: 0.35 },
    { type: 'SICKLE', weight: 0.3 },
    { type: 'BOMB', weight: 0.2 },
    { type: 'SHURIKEN', weight: 0.15 },
  ],
};

const SCENARIO_DEFAULT_INTENSITY = {
  mixed: 2,
  kunai: 2,
  bomb: 0,
  chaos: 4,
};

const ALLOWED_TYPES = new Set(['SHURIKEN', 'KUNAI', 'BOMB', 'SICKLE']);

function pickProjectileType(scenario, rand = Math.random) {
  const table = SCENARIO_WEIGHTS[scenario];
  const roll = rand();
  let acc = 0;
  for (const row of table) {
    acc += row.weight;
    if (roll < acc) return row.type;
  }
  return table[table.length - 1].type;
}

// --- resolveCounter mirror ---
const CounterResult = {
  PERFECT: 'PERFECT',
  GOOD: 'GOOD',
  EARLY: 'EARLY',
  LATE: 'LATE',
  FEINT: 'FEINT',
  WRONG_SIDE: 'WRONG_SIDE',
};

function resolveCounter(input) {
  const {
    timingDiffMs,
    playerSide,
    attackSide,
    isFeint,
    noAttack,
    score,
    combo,
    baseTier,
  } = input;
  if (noAttack) return { result: CounterResult.EARLY, absTimingMs: Math.abs(timingDiffMs) };
  if (isFeint) return { result: CounterResult.FEINT, absTimingMs: Math.abs(timingDiffMs) };
  const windows = getTimingWindows(score, combo, baseTier);
  const abs = Math.abs(timingDiffMs);
  if (playerSide !== attackSide) return { result: CounterResult.WRONG_SIDE, absTimingMs: abs };
  if (timingDiffMs < -windows.good) return { result: CounterResult.EARLY, absTimingMs: abs };
  if (timingDiffMs > windows.good) return { result: CounterResult.LATE, absTimingMs: abs };
  if (abs <= windows.perfect) return { result: CounterResult.PERFECT, absTimingMs: abs };
  return { result: CounterResult.GOOD, absTimingMs: abs };
}

function computeReactionRank({ avgAbsTimingMs, accuracy, sampleSize }) {
  if (sampleSize < 3) return 'C';
  if (avgAbsTimingMs <= 55 && accuracy >= 0.85) return 'S';
  if (avgAbsTimingMs <= 95 && accuracy >= 0.7) return 'A';
  if (avgAbsTimingMs <= 160 && accuracy >= 0.5) return 'B';
  return 'C';
}

function hashString(input) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

const TZ_OFFSET_MINUTES = 8 * 60;
function dateKey(now = new Date()) {
  const shifted = new Date(now.getTime() + TZ_OFFSET_MINUTES * 60_000);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dailySeedCode(key) {
  return `instant-flash-daily-${key}`;
}

function computeStreak(records, today) {
  const days = new Set(records.filter((r) => r.won).map((r) => r.date));
  const previousDay = (key) => {
    const [y, m, d] = key.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    date.setUTCDate(date.getUTCDate() - 1);
    return dateKey(new Date(date.getTime() - TZ_OFFSET_MINUTES * 60_000));
  };
  let cursor = days.has(today) ? today : previousDay(today);
  if (!days.has(cursor)) return 0;
  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor = previousDay(cursor);
  }
  return streak;
}

const OPPONENT_IDS = [
  'ronin',
  'bait',
  'twin',
  'delay',
  'surge',
  'mirror',
  'chaos',
  'master',
];
const OPPONENT_TRAITS = [
  'basic',
  'feints',
  'double',
  'delay',
  'speedup',
  'sideswitch',
  'mixed',
  'boss',
];

function isOpponentUnlocked(index, clearedCount) {
  if (index < 0 || index >= OPPONENT_IDS.length) return false;
  return index <= clearedCount;
}

function applyLadderWin(clearedCount, opponentIndex) {
  if (opponentIndex === clearedCount) {
    return Math.min(OPPONENT_IDS.length, clearedCount + 1);
  }
  return clearedCount;
}

// ========== Assertions ==========

// Baseline (no ramp)
assert.equal(getDifficultyTier(0, 0), 0);
assert.deepEqual(getTimingWindows(0, 0), { perfect: 120, good: 300 });
assert.deepEqual(getAttackDelayRange(0), { min: 1000, max: 2200 });
assert.equal(getProjectileDurationScale(0), 1);

assert.equal(getDifficultyTier(8000, 0), 2);
assert.deepEqual(getTimingWindows(8000, 0), { perfect: 100, good: 264 });
assert.equal(getDifficultyTier(0, 16), 2);
assert.equal(getDifficultyTier(0, 0, 2), 2);
assert.equal(getDifficultyTier(0, 0, 4), 4);
assert.deepEqual(getTimingWindows(0, 0, 2), { perfect: 100, good: 264 });
assert.deepEqual(getAttackDelayRange(0, 2), { min: 720, max: 1920 });
assert.ok(Math.abs(getProjectileDurationScale(0, 2) - 0.86) < 1e-9);

assert.equal(getDifficultyTier(999999, 999), 6);
assert.equal(getDifficultyTier(8000, 0, 4), 6);
const capped = getTimingWindows(999999, 999);
assert.equal(capped.perfect, 60);
assert.equal(capped.good, 192);

assert.deepEqual(getAttackDelayRange(6000), { min: 860, max: 2060 });
assert.deepEqual(getAttackDelayRange(30000), { min: 550, max: 1500 });
assert.equal(getProjectileDurationScale(32000), 0.72);

for (let score = 0; score <= 40000; score += 4000) {
  for (let combo = 0; combo <= 48; combo += 8) {
    for (const baseTier of [0, 2, 4]) {
      const w = getTimingWindows(score, combo, baseTier);
      assert.ok(w.perfect < w.good);
    }
  }
}

for (const [id, table] of Object.entries(SCENARIO_WEIGHTS)) {
  assert.ok(table.length >= 2);
  let sum = 0;
  for (const row of table) {
    assert.ok(ALLOWED_TYPES.has(row.type));
    assert.ok(row.weight > 0);
    sum += row.weight;
  }
  assert.ok(Math.abs(sum - 1) < 1e-9);
  assert.ok([0, 2, 4].includes(SCENARIO_DEFAULT_INTENSITY[id]));
}

assert.equal(pickProjectileType('mixed', () => 0), 'SHURIKEN');
assert.equal(pickProjectileType('mixed', () => 0.4), 'KUNAI');
assert.equal(pickProjectileType('kunai', () => 0), 'KUNAI');
assert.equal(pickProjectileType('bomb', () => 0), 'BOMB');

// resolveCounter: perfect / good / early / late / feint / wrong side
assert.equal(
  resolveCounter({
    timingDiffMs: 40,
    playerSide: 'left',
    attackSide: 'left',
    isFeint: false,
    noAttack: false,
    score: 0,
    combo: 0,
    baseTier: 0,
  }).result,
  CounterResult.PERFECT,
);
assert.equal(
  resolveCounter({
    timingDiffMs: 200,
    playerSide: 'right',
    attackSide: 'right',
    isFeint: false,
    noAttack: false,
    score: 0,
    combo: 0,
    baseTier: 0,
  }).result,
  CounterResult.GOOD,
);
assert.equal(
  resolveCounter({
    timingDiffMs: -400,
    playerSide: 'left',
    attackSide: 'left',
    isFeint: false,
    noAttack: false,
    score: 0,
    combo: 0,
    baseTier: 0,
  }).result,
  CounterResult.EARLY,
);
assert.equal(
  resolveCounter({
    timingDiffMs: 400,
    playerSide: 'left',
    attackSide: 'left',
    isFeint: false,
    noAttack: false,
    score: 0,
    combo: 0,
    baseTier: 0,
  }).result,
  CounterResult.LATE,
);
assert.equal(
  resolveCounter({
    timingDiffMs: 10,
    playerSide: 'left',
    attackSide: 'right',
    isFeint: false,
    noAttack: false,
    score: 0,
    combo: 0,
    baseTier: 0,
  }).result,
  CounterResult.WRONG_SIDE,
);
assert.equal(
  resolveCounter({
    timingDiffMs: 10,
    playerSide: 'left',
    attackSide: 'left',
    isFeint: true,
    noAttack: false,
    score: 0,
    combo: 0,
    baseTier: 0,
  }).result,
  CounterResult.FEINT,
);
assert.equal(
  resolveCounter({
    timingDiffMs: -9999,
    playerSide: 'left',
    attackSide: 'left',
    isFeint: false,
    noAttack: true,
    score: 0,
    combo: 0,
    baseTier: 0,
  }).result,
  CounterResult.EARLY,
);

// Ranks
assert.equal(
  computeReactionRank({ avgAbsTimingMs: 40, accuracy: 0.9, sampleSize: 8 }),
  'S',
);
assert.equal(
  computeReactionRank({ avgAbsTimingMs: 80, accuracy: 0.75, sampleSize: 8 }),
  'A',
);
assert.equal(
  computeReactionRank({ avgAbsTimingMs: 140, accuracy: 0.6, sampleSize: 8 }),
  'B',
);
assert.equal(
  computeReactionRank({ avgAbsTimingMs: 40, accuracy: 0.9, sampleSize: 2 }),
  'C',
);

// Ladder: 8 opponents, sequential unlock, boss last
assert.equal(OPPONENT_IDS.length, 8);
assert.equal(OPPONENT_TRAITS.length, 8);
assert.equal(new Set(OPPONENT_TRAITS).size, 8, 'each trait unique');
assert.equal(OPPONENT_IDS[7], 'master');
assert.equal(OPPONENT_TRAITS[7], 'boss');
assert.ok(isOpponentUnlocked(0, 0));
assert.ok(!isOpponentUnlocked(1, 0));
assert.equal(applyLadderWin(0, 0), 1);
assert.ok(isOpponentUnlocked(1, 1));
assert.equal(applyLadderWin(7, 7), 8);

// Daily Taipei seed stability
const key = dateKey(new Date('2026-10-19T04:00:00Z')); // Taipei Oct 19 morning
assert.equal(key, '2026-10-19');
const seedA = hashString(dailySeedCode('2026-10-19'));
const seedB = hashString(dailySeedCode('2026-10-19'));
assert.equal(seedA, seedB);
assert.notEqual(seedA, hashString(dailySeedCode('2026-10-20')));
assert.equal(seedA % 8, seedA % OPPONENT_IDS.length);

assert.equal(
  computeStreak(
    [
      { date: '2026-10-17', won: true },
      { date: '2026-10-18', won: true },
      { date: '2026-10-19', won: true },
    ],
    '2026-10-19',
  ),
  3,
);
assert.equal(
  computeStreak([{ date: '2026-10-17', won: true }], '2026-10-19'),
  0,
);

console.log('check-instant-flash: ok');
