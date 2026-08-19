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
  overlapCallBonus,
  purchaseCost,
  sellRefund,
  upgradeCost,
  waveClearBonus,
} from './game/economy.ts';
import {
  createInitialState,
  overlapOffer,
  placeTower,
  startNextWave,
  step,
  unresolvedCount,
  upgradeTower,
} from './game/engine.ts';
import { isBossWave, waveHpMultiplier } from './game/waves.ts';
import { ENEMY_DEFS, TOTAL_WAVES } from './game/constants.ts';

// ── Kill / wave rewards ──────────────────────────────────────────────────────
{
  assert.equal(waveClearBonus(1), 24, `wave 1 clear bonus, got ${waveClearBonus(1)}`);
  assert.equal(waveClearBonus(10), 60, `wave 10 clear bonus, got ${waveClearBonus(10)}`);
  assert.ok(waveClearBonus(10) > waveClearBonus(1), 'clear bonus should grow with wave number');
}

// ── Overlap-call bonus ───────────────────────────────────────────────────────
{
  assert.equal(overlapCallBonus(0), 0, 'calling with nothing unresolved must pay nothing');
  assert.equal(overlapCallBonus(-3), 0, 'a negative count must clamp to 0, never pay out');
  assert.ok(overlapCallBonus(10) > overlapCallBonus(3), 'a more dangerous board must pay more');
  assert.equal(Number.isInteger(overlapCallBonus(7)), true, 'the bonus must always be an integer');
}

// ── Starting a wave from prep must be free ───────────────────────────────────
//
// This is the invariant the old early-call bonus violated. Prep time has no
// opportunity cost — no income accrues during it and towers can be built
// mid-wave anyway — so paying for skipping the countdown made pressing the
// button strictly dominant on every wave of every run, worth 56% of a run's
// entire income for nothing. If starting a wave from prep ever pays again,
// this fails.
{
  let state = createInitialState('standard', 'open', false);
  for (let w = 0; w < 3; w++) {
    const goldBefore = state.gold;
    const r = startNextWave(state);
    assert.ok(r.ok, `starting wave ${w + 1} should succeed: ${r.reason}`);
    assert.equal(
      r.state.gold,
      goldBefore,
      `starting a wave from prep must not pay gold (wave ${w + 1}), got ${r.state.gold - goldBefore}`,
    );
    assert.equal(r.state.waveScoreMult, 1, 'an ordinary wave start must not bump the score multiplier');
    // Run the wave out so the next iteration starts from prep again.
    let guard = 0;
    while (r.state.phase === 'wave' && guard < 200000) {
      state = step(guard === 0 ? r.state : state, 1 / 60);
      if (state.phase !== 'wave') break;
      guard += 1;
    }
    if (state.phase !== 'prep') break;
  }
}

// ── 強行加壓 cannot be spammed ────────────────────────────────────────────────
//
// Without the "current wave must have finished spawning" gate, the call could
// be repeated every frame: each press stacked another wave and paid another
// bonus, so twenty presses reached wave 20 before a single enemy had spawned —
// measured at 32,828 points off 19 kills. Pressing repeatedly must not advance
// the wave counter more than once.
{
  let state = createInitialState('standard', 'open', false);
  state = startNextWave(state).state;
  const waveAtStart = state.wave;
  let accepted = 0;
  for (let i = 0; i < 50; i++) {
    const r = startNextWave(state);
    if (r.ok) {
      accepted += 1;
      state = r.state;
    }
  }
  assert.equal(accepted, 0, `spamming the call while the wave is still spawning must be refused, ${accepted} got through`);
  assert.equal(state.wave, waveAtStart, 'a refused call must not advance the wave counter');
}

// ── The button and the command must never disagree ───────────────────────────
//
// They did. The button enabled itself whenever anything was unresolved, which
// counts enemies that have not spawned yet; the command additionally required
// the wave to have finished spawning. So through every wave's opening seconds
// the button was live, advertised a bonus, and did nothing when pressed — the
// wave counter simply did not move, with no error and no feedback. Verified in
// the browser before this check existed: click at wave 1, and at +0/60/150/400/
// 1000ms the label still read 第 1 / 20 波 with the button still enabled.
//
// Walking a whole wave tick by tick, `overlapOffer` must agree with what
// `startNextWave` actually does, on every single tick.
{
  let state = createInitialState('standard', 'open', false);
  state = placeTower(state, 3, 4, 'crossbow').state;
  state = startNextWave(state).state;

  let ticks = 0;
  let sawUnavailable = false;
  let sawAvailable = false;
  while (state.phase === 'wave' && ticks < 200000) {
    const offer = overlapOffer(state);
    const attempt = startNextWave(state);
    assert.equal(
      offer.available,
      attempt.ok,
      `tick ${ticks}: button says ${offer.available ? 'enabled' : 'disabled'} but the command ` +
        `${attempt.ok ? 'accepted' : `refused (${attempt.reason})`}`,
    );
    if (offer.available) {
      sawAvailable = true;
      assert.equal(
        attempt.state.gold - state.gold,
        offer.bonus,
        `tick ${ticks}: the button advertised ${offer.bonus} gold but the call paid ` +
          `${attempt.state.gold - state.gold}`,
      );
    } else {
      sawUnavailable = true;
    }
    state = step(state, 1 / 60);
    ticks += 1;
  }
  // A run where the offer never flipped would pass the agreement test without
  // testing anything.
  assert.ok(sawUnavailable, 'the sweep must include ticks where the call is refused');
  assert.ok(sawAvailable, 'the sweep must include ticks where the call is allowed');
}

// ── Kills pay gold, not only score ───────────────────────────────────────────
//
// The spec lists three gold sources (擊殺獎勵、波次結算、提前召喚加成) and the
// engine implemented two: every enemy carried a killReward that only ever
// reached killScore. Measured at 0% of a run's income.
{
  let state = createInitialState('standard', 'open', false);
  for (const [x, y] of [[3, 4], [3, 3], [5, 4], [5, 3]]) {
    state = placeTower(state, x, y, 'crossbow').state;
  }
  const goldAfterBuilding = state.gold;
  state = startNextWave(state).state;
  let guard = 0;
  while (state.kills === 0 && state.phase === 'wave' && guard < 200000) {
    state = step(state, 1 / 60);
    guard += 1;
  }
  assert.ok(state.kills > 0, 'the fixture should have killed something');
  assert.ok(
    state.gold > goldAfterBuilding,
    `killing enemies must pay gold; gold went ${goldAfterBuilding} -> ${state.gold} across ${state.kills} kills`,
  );
  assert.ok(
    state.gold - goldAfterBuilding >= ENEMY_DEFS.grunt.killReward,
    'the payout should be at least one grunt bounty',
  );
}

// ── Endless mode has to keep escalating ──────────────────────────────────────
//
// BOSS_WAVES was the literal Set([10, 20]), so endless mode had no bosses at
// all from wave 21 on — the only enemy with real HP and armor silently stopped
// appearing in the mode that never ends. Enemy HP never scaled either.
{
  assert.ok(isBossWave(10) && isBossWave(20), 'the challenge table keeps its two bosses');
  assert.ok(isBossWave(30) && isBossWave(40) && isBossWave(100), 'endless mode must keep producing bosses');
  assert.ok(!isBossWave(15) && !isBossWave(0), 'bosses only land on the interval');

  for (let w = 1; w <= TOTAL_WAVES; w++) {
    assert.equal(waveHpMultiplier(w), 1, `the 20-wave table must be untouched by endless scaling (wave ${w})`);
  }
  assert.ok(waveHpMultiplier(21) > 1, 'scaling must begin immediately past the table');
  assert.ok(
    waveHpMultiplier(40) > waveHpMultiplier(30),
    'scaling must keep compounding, or a defense that survives one wave survives them all',
  );
  assert.ok(waveHpMultiplier(60) > 5, `wave 60 should be far harder than wave 20, got ${waveHpMultiplier(60)}x`);
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
// fixed defense, run every wave start to finish through wave 5 on the
// fixed-timestep reducer, and assert the precise final numbers. Any change
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
      const r = startNextWave(state);
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
  assert.equal(outcome.lives, 13, `pinned outcome: lives, got ${outcome.lives}`);
  // Re-pinned again when standard's enemyHpMult moved 1.0 -> 1.1 to put it on
  // the part of the difficulty curve that responds at all. Tougher enemies mean
  // fewer die inside this five-wave fixture, so lives, kills and gold all fall.
  assert.equal(outcome.gold, 377, `pinned outcome: gold, got ${outcome.gold}`);
  assert.equal(outcome.kills, 47, `pinned outcome: kills, got ${outcome.kills}`);
  assert.ok(Math.abs(outcome.killScore - 197) < 1e-9, `pinned outcome: killScore, got ${outcome.killScore}`);
  assert.ok(Math.abs(outcome.score - 769) < 1e-9, `pinned outcome: score, got ${outcome.score}`);

  // Determinism: an identical command/timestep sequence must reproduce the
  // exact same final state, every time — this is what makes the simulation
  // usable as a balance tool as well as a regression test.
  const replay = simulateThroughWave(5);
  assert.equal(JSON.stringify(outcome), JSON.stringify(replay), 'identical input sequence must yield an identical outcome');
}

// ── The three difficulties must actually be three different games ───────────
//
// This game had no difficulty guard of any kind. Everything asserted rules or
// pinned a regression value; nothing asked whether the settings produced
// different experiences. They did not: relaxed and standard were both flawless
// clears, losing zero lives, because enemyHpMult does nothing below about 1.05
// and both sat under it.
//
// The check is TWO-SIDED on purpose. A guard that only catches "too hard" is
// what let three identical difficulties ship — the failure mode was excess
// ease, and nothing was watching for it. Measured lives lost, on a fully
// deterministic run so these are exact values rather than estimates:
//
//   relaxed 0 of 24   standard 5 of 20   harsh 12 of 14
{
  // The pilot has to keep spending, the way the balance harness's does. The
  // first version of this check built eight towers up front and then never
  // banked another coin; every difficulty lost every life, so all three
  // saturated at total defeat and the check could not tell them apart. A
  // check's model of the player decides what it is able to measure at all.
  const SLOTS = [[4, 3], [4, 5], [6, 3], [6, 5], [2, 3], [2, 5], [8, 3], [8, 5],
                 [3, 3], [3, 5], [5, 3], [5, 5], [7, 3], [7, 5], [9, 3], [9, 5]];
  const MIX = ['crossbow', 'grinder', 'frost', 'coil'];
  const spendAll = (start) => {
    let s = start;
    for (let again = true; again;) {
      again = false;
      const i = s.towers.length;
      if (i < SLOTS.length) {
        const type = MIX[i % MIX.length];
        if (s.gold >= purchaseCost(type)) {
          const r = placeTower(s, SLOTS[i][0], SLOTS[i][1], type);
          if (r.ok) { s = r.state; again = true; continue; }
        }
      }
      const up = s.towers
        .filter((t) => t.level < 2)
        .map((t) => ({ t, cost: upgradeCost(t.type, t.level) }))
        .filter((c) => c.cost !== null && c.cost <= s.gold)
        .sort((a, b) => a.cost - b.cost || a.t.id - b.t.id);
      if (up.length > 0) {
        const r = upgradeTower(s, up[0].t.id);
        if (r.ok) { s = r.state; again = true; }
      }
    }
    return s;
  };

  const outcomes = ['relaxed', 'standard', 'harsh'].map((difficulty) => {
    let state = createInitialState(difficulty, 'open', false);
    const startLives = state.lives;
    let guard = 0;
    while (state.phase !== 'lost' && state.phase !== 'won' && guard < 400000) {
      state = spendAll(state);
      if (state.phase === 'prep') {
        const r = startNextWave(state);
        if (!r.ok) break;
        state = r.state;
      } else {
        // Uses 強行加壓 as well, matching the balance harness's policy. Without
        // it this pilot lost all fourteen lives on harsh — and the first version
        // of this check PASSED that, because the too-hard guard was only
        // applied to relaxed. A guard that allows the hardest setting to be
        // unwinnable is half a guard.
        if (state.pendingSpawns.length === 0 && unresolvedCount(state) > 0 && state.wave < TOTAL_WAVES) {
          const r = startNextWave(state);
          if (r.ok) state = r.state;
        }
        state = step(state, 1 / 60);
      }
      guard += 1;
    }
    return { difficulty, lost: startLives - state.lives, startLives, won: state.phase === 'won' };
  });

  const [relaxed, standard, harsh] = outcomes;

  // Ordering: each step up must cost strictly more than the one below it.
  assert.ok(
    standard.lost > relaxed.lost,
    `standard cost ${standard.lost} lives and relaxed cost ${relaxed.lost} — they are the same game`,
  );
  assert.ok(
    harsh.lost > standard.lost,
    `harsh cost ${harsh.lost} lives and standard cost ${standard.lost} — they are the same game`,
  );

  // The too-easy side: the hardest setting must genuinely threaten the player.
  assert.ok(
    harsh.lost >= harsh.startLives * 0.4,
    `harsh only cost ${harsh.lost} of ${harsh.startLives} lives — the hardest setting is not a threat`,
  );

  // The too-hard side, and it has to cover the HARDEST setting, not just the
  // gentlest. Every difficulty must still be winnable by a competent pilot.
  for (const o of outcomes) {
    assert.ok(
      o.won,
      `${o.difficulty} was not cleared at all (lost ${o.lost} of ${o.startLives} lives) — ` +
        `a difficulty setting that cannot be won is not a difficulty setting`,
    );
  }
  assert.ok(
    relaxed.lost <= relaxed.startLives * 0.5,
    `relaxed cost ${relaxed.lost} of ${relaxed.startLives} lives — that is not a gentle setting`,
  );
  console.log(
    `check-economy: difficulties cost ${relaxed.lost}/${relaxed.startLives}, ` +
      `${standard.lost}/${standard.startLives}, ${harsh.lost}/${harsh.startLives} lives`,
  );
}

console.log('check-economy: ok');
