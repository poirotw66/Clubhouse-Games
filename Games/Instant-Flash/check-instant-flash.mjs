/**
 * Runnable check for Instant Flash difficulty tier / timing window logic.
 * Mirrors Games/Instant-Flash/constants.ts — fail loudly if those formulas drift.
 */
import assert from 'node:assert/strict';

const WINDOW_PERFECT = 120;
const WINDOW_GOOD = 300;
const WARNING_DURATION_MIN = 1000;
const WARNING_DURATION_MAX = 2200;

function getDifficultyTier(score, combo) {
  return Math.min(6, Math.floor(score / 4000) + Math.floor(combo / 8));
}

function getTimingWindows(score, combo) {
  const tier = getDifficultyTier(score, combo);
  return {
    perfect: Math.max(55, WINDOW_PERFECT - tier * 10),
    good: Math.max(160, WINDOW_GOOD - tier * 18),
  };
}

function getAttackDelayRange(score) {
  const tier = Math.min(5, Math.floor(score / 6000));
  const cut = tier * 140;
  return {
    min: Math.max(550, WARNING_DURATION_MIN - cut),
    max: Math.max(1100, WARNING_DURATION_MAX - cut),
  };
}

function getProjectileDurationScale(score) {
  const tier = Math.min(4, Math.floor(score / 8000));
  return Math.max(0.72, 1 - tier * 0.07);
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

// Cap at tier 6 — floors (55 / 160) exist for further ramp; at max tier windows are still above floor
assert.equal(getDifficultyTier(999999, 999), 6);
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
    const w = getTimingWindows(score, combo);
    assert.ok(w.perfect < w.good, `perfect < good at score=${score} combo=${combo}`);
  }
}

console.log('check-instant-flash: ok');
