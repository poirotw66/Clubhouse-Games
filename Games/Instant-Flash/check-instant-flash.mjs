/**
 * Runnable check for Instant Flash difficulty tier / timing window logic
 * and practice scenario projectile weights.
 * Mirrors Games/Instant-Flash/constants.ts — fail loudly if those formulas drift.
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

// Baseline (no ramp)
assert.equal(getDifficultyTier(0, 0), 0);
assert.deepEqual(getTimingWindows(0, 0), { perfect: 120, good: 300 });
assert.deepEqual(getAttackDelayRange(0), { min: 1000, max: 2200 });
assert.equal(getProjectileDurationScale(0), 1);

// Score ramp: 8000 → floor(8000/4000)=2
assert.equal(getDifficultyTier(8000, 0), 2);
assert.deepEqual(getTimingWindows(8000, 0), { perfect: 100, good: 264 });

// Combo ramp: combo 16 → floor(16/8)=2
assert.equal(getDifficultyTier(0, 16), 2);

// Practice intensity floor
assert.equal(getDifficultyTier(0, 0, 2), 2);
assert.equal(getDifficultyTier(0, 0, 4), 4);
assert.deepEqual(getTimingWindows(0, 0, 2), { perfect: 100, good: 264 });
assert.deepEqual(getAttackDelayRange(0, 2), { min: 720, max: 1920 });
assert.ok(Math.abs(getProjectileDurationScale(0, 2) - 0.86) < 1e-9);

// Cap at tier 6 — floors (55 / 160) exist for further ramp; at max tier windows are still above floor
assert.equal(getDifficultyTier(999999, 999), 6);
assert.equal(getDifficultyTier(8000, 0, 4), 6);
const capped = getTimingWindows(999999, 999);
assert.equal(capped.perfect, 60, 'tier-6 perfect = 120 - 60');
assert.equal(capped.good, 192, 'tier-6 good = 300 - 108');
assert.ok(capped.perfect >= 55 && capped.good >= 160, 'floors must hold');

// Attack delay compresses with score; min hits floor 550, max stays above 1100 at tier cap
assert.deepEqual(getAttackDelayRange(6000), { min: 860, max: 2060 });
assert.deepEqual(getAttackDelayRange(30000), { min: 550, max: 1500 });
assert.deepEqual(getAttackDelayRange(999999), { min: 550, max: 1500 });
assert.ok(getAttackDelayRange(999999).min >= 550);
assert.ok(getAttackDelayRange(999999).max >= 1100);

// Projectile scale floors at 0.72
assert.ok(Math.abs(getProjectileDurationScale(8000) - 0.93) < 1e-9);
assert.equal(getProjectileDurationScale(32000), 0.72);
assert.equal(getProjectileDurationScale(999999), 0.72);

// Perfect must stay stricter than good at every tier
for (let score = 0; score <= 40000; score += 4000) {
  for (let combo = 0; combo <= 48; combo += 8) {
    for (const baseTier of [0, 2, 4]) {
      const w = getTimingWindows(score, combo, baseTier);
      assert.ok(
        w.perfect < w.good,
        `perfect < good at score=${score} combo=${combo} base=${baseTier}`,
      );
    }
  }
}

// Practice scenarios — weight tables must be complete and sum to 1
for (const [id, table] of Object.entries(SCENARIO_WEIGHTS)) {
  assert.ok(table.length >= 2, `${id} needs ≥2 projectile rows`);
  let sum = 0;
  for (const row of table) {
    assert.ok(ALLOWED_TYPES.has(row.type), `${id} unknown type ${row.type}`);
    assert.ok(row.weight > 0, `${id} weight must be > 0`);
    sum += row.weight;
  }
  assert.ok(Math.abs(sum - 1) < 1e-9, `${id} weights must sum to 1 (got ${sum})`);
  assert.ok(
    [0, 2, 4].includes(SCENARIO_DEFAULT_INTENSITY[id]),
    `${id} default intensity must be 0|2|4`,
  );
}

// Deterministic pick at bucket edges
assert.equal(pickProjectileType('mixed', () => 0), 'SHURIKEN');
assert.equal(pickProjectileType('mixed', () => 0.39), 'SHURIKEN');
assert.equal(pickProjectileType('mixed', () => 0.4), 'KUNAI');
assert.equal(pickProjectileType('kunai', () => 0), 'KUNAI');
assert.equal(pickProjectileType('bomb', () => 0), 'BOMB');
assert.equal(pickProjectileType('chaos', () => 0.34), 'KUNAI');
assert.equal(pickProjectileType('chaos', () => 0.35), 'SICKLE');

// Dominant type must differ across themed drills (play changes, not chrome)
assert.equal(SCENARIO_WEIGHTS.kunai[0].type, 'KUNAI');
assert.equal(SCENARIO_WEIGHTS.bomb[0].type, 'BOMB');
assert.ok(
  SCENARIO_WEIGHTS.kunai[0].weight >
    SCENARIO_WEIGHTS.mixed.find((r) => r.type === 'KUNAI').weight,
);
assert.ok(
  SCENARIO_WEIGHTS.bomb[0].weight >
    SCENARIO_WEIGHTS.mixed.find((r) => r.type === 'BOMB').weight,
);

console.log('check-instant-flash: ok');
