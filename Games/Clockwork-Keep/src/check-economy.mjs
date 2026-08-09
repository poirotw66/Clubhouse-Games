/**
 * Headless checks for gold/scoring math, plus a full multi-wave headless
 * simulation that pins down an exact outcome — the regression test the
 * zero-DOM architecture exists for for. Run:
 *   node --experimental-strip-types src/check-economy.mjs
 */
import assert from 'node:assert/strict';
import {
  calculateScore,
  cumulativeCost,
  earlyCallBonus,
  purchaseCost,
  sellRefund,
  upgradeCost,
  waveClearBonus,
} from './game/economy.ts';
import { createInitialState, placeTower, startNextWave, step } from './game/engine.ts';

// ── Kill / wave rewards ──────────────────────────────────────────────────────
{
  assert.equal(waveClearBonus(1), 24, `wave 1 clear bonus, got ${waveClearBonus(1)}`);
  assert.equal(waveClearBonus(10), 60, `wave 10 clear bonus, got ${waveClearBonus(10)}`);
  assert.ok(waveClearBonus(10) > waveClearBonus(1), 'clear bonus should grow with wave number');
}

// ── Early-call bonus ─────────────────────────────────────────────────────────
{
  assert.equal(earlyCallBonus(15), 90, `15s remaining -> 90 gold, got ${earlyCallBonus(15)}`);
  assert.equal(earlyCallBonus(0), 0, 'no remaining time should give no bonus');
  assert.equal(earlyCallBonus(-3), 0, 'a negative remaining time must clamp to 0, never pay out');
  assert.equal(earlyCallBonus(7.6), Math.floor(7.6 * 6), 'bonus must floor to an integer gold amount');
  assert.equal(Number.isInteger(earlyCallBonus(7.6)), true, 'early-call bonus must always be an integer');
}

// ── Sell refund: 70%, floored to an integer ─────────────────────────────────
{
  assert.equal(sellRefund(100), 70, `sellRefund(100) should be 70, got ${sellRefund(100)}`);
  assert.equal(sellRefund(101), 70, `sellRefund(101) should floor to 70, got ${sellRefund(101)}`);
  assert.equal(sellRefund(99), 69, `sellRefund(99) should floor to 69, got ${sellRefund(99)}`);
  assert.equal(sellRefund(1), 0, 'a tiny investment should floor its refund down to 0, not round up');
  for (const invested of [10, 33, 40, 55, 130, 999]) {
    assert.equal(Number.isInteger(sellRefund(invested)), true, `refund must be an integer for invested=${invested}`);
    assert.ok(sellRefund(invested) <= invested * 0.7, `refund must never exceed 70% of ${invested}`);
  }
}

// ── Cumulative upgrade costs ─────────────────────────────────────────────────
{
  const base = purchaseCost('crossbow');
  const toLevel1 = upgradeCost('crossbow', 0);
  const toLevel2 = upgradeCost('crossbow', 1);
  assert.equal(upgradeCost('crossbow', 2), null, 'level 2 (the max, 3rd tier) has no further upgrade');

  assert.equal(cumulativeCost('crossbow', 0), base, 'cumulative cost at level 0 is just the purchase price');
  assert.equal(
    cumulativeCost('crossbow', 1),
    base + toLevel1,
    'cumulative cost at level 1 is purchase + first upgrade',
  );
  assert.equal(
    cumulativeCost('crossbow', 2),
    base + toLevel1 + toLevel2,
    'cumulative cost at level 2 is purchase + both upgrades',
  );

  // Selling a fully-upgraded tower should refund 70% of everything put into it.
  assert.equal(sellRefund(cumulativeCost('coil', 2)), Math.floor(cumulativeCost('coil', 2) * 0.7));
}

// ── Score formula ─────────────────────────────────────────────────────────────
{
  const s = calculateScore({ killScore: 100, lives: 10, unspentGold: 50 });
  // SCORE_PER_LIFE=15, SCORE_PER_UNSPENT_GOLD=1 (see constants.ts).
  assert.equal(s, 100 + 10 * 15 + 50 * 1, `score formula mismatch, got ${s}`);
}

// ── Full headless simulation: several waves, exact pinned outcome ──────────
//
// This is the regression test the pure-logic split exists for: build a small
// fixed defense, early-call every wave, run the fixed-timestep reducer start
// to finish through wave 5, and assert the precise final numbers. Any change
// to spawn timing, targeting, damage, or economy that shifts this outcome
// will fail here immediately, without a browser.
function simulateThroughWave(targetWave) {
  let state = createInitialState('standard', 'open', false);

  const setup = [
    [3, 4, 'crossbow'],
    [3, 3, 'crossbow'],
    [7, 4, 'grinder'],
    [7, 3, 'frost'],
  ];
  for (const [x, y, type] of setup) {
    const r = placeTower(state, x, y, type);
    assert.ok(r.ok, `fixture setup placement should succeed at (${x},${y}): ${r.reason}`);
    state = r.state;
  }

  const dt = 1 / 60;
  let guard = 0;
  while (!(state.wave >= targetWave && state.phase === 'prep') && state.phase !== 'lost' && guard < 200000) {
    if (state.phase === 'prep') {
      const r = startNextWave(state, { early: true });
      assert.ok(r.ok, `startNextWave should succeed: ${r.reason}`);
      state = r.state;
    } else {
      state = step(state, dt);
    }
    guard += 1;
  }
  assert.ok(guard < 200000, 'simulation should not run away without ever reaching the target wave');
  return state;
}

{
  const outcome = simulateThroughWave(5);

  assert.equal(outcome.phase, 'prep', 'sim should have cleared wave 5 and returned to prep for wave 6');
  assert.equal(outcome.wave, 5, `sim should have reached exactly wave 5, got ${outcome.wave}`);
  assert.equal(outcome.enemies.length, 0, 'no enemies should remain once a wave is cleared');
  assert.equal(outcome.lives, 16, `pinned outcome: lives, got ${outcome.lives}`);
  assert.equal(outcome.gold, 630, `pinned outcome: gold, got ${outcome.gold}`);
  assert.equal(outcome.kills, 50, `pinned outcome: kills, got ${outcome.kills}`);
  assert.ok(Math.abs(outcome.killScore - 313.5) < 1e-9, `pinned outcome: killScore, got ${outcome.killScore}`);
  assert.ok(Math.abs(outcome.score - 1183.5) < 1e-9, `pinned outcome: score, got ${outcome.score}`);

  // Determinism: an identical command/timestep sequence must reproduce the
  // exact same final state, every time — this is what makes the simulation
  // usable as a balance tool as well as a regression test.
  const replay = simulateThroughWave(5);
  assert.equal(JSON.stringify(outcome), JSON.stringify(replay), 'identical input sequence must yield an identical outcome');
}

console.log('check-economy: ok');
