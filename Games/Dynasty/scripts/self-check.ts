import * as assert from 'node:assert/strict';
import { acknowledge, createGame, resolve } from '../src/game/engine.js';
import { CLUBS, GAMES, LEAGUE_BASELINE, formatMoney, overall } from '../src/game/config.js';
import { marketSalary, tradeValue } from '../src/game/players.js';
import { winRate } from '../src/game/season.js';
import { priceElasticity } from '../src/game/finance.js';
import { scoutBand, bandWidthFor } from '../src/game/scouting.js';
import { negotiable } from '../src/game/board.js';
import { createRng } from '../src/game/rng.js';
import { SITUATIONS, buildContext, pickSituation } from '../src/game/situations.js';
import type { Decision, GameState } from '../src/game/types.js';

const GUARD = 400;

type Chooser = (decision: Decision, step: number) => string;

function enabled(decision: Decision): string[] {
  return decision.options.filter((o) => !o.disabled).map((o) => o.id);
}

function playTenure(seedCode: string, teamId: string, chooser: Chooser): GameState {
  let state = createGame({ seedCode, gmName: '測試', teamId });
  let step = 0;
  while (!state.over && step < GUARD) {
    const decision = state.decision;
    if (!decision || decision.phase === 'over' || decision.options.length === 0) break;
    state = acknowledge(resolve(state, chooser(decision, step)));
    step += 1;
  }
  assert.ok(step < GUARD, `tenure did not terminate for ${seedCode}/${teamId}`);
  return state;
}

const firstChoice: Chooser = (decision) => enabled(decision)[0];
const cyclingChoice: Chooser = (decision, step) => {
  const ids = enabled(decision);
  return ids[step % ids.length];
};

/** Same seed and same decisions must rebuild the same decade. */
function expectDeterministicTenures(): void {
  const a = playTenure('dyn00001', 'dolphins', cyclingChoice);
  const b = playTenure('dyn00001', 'dolphins', cyclingChoice);
  assert.deepEqual(a.history, b.history, 'season history diverged between identical runs');
  assert.equal(a.summary?.score, b.summary?.score, 'dynasty score diverged');
  assert.equal(a.finance.cash, b.finance.cash, 'cash diverged');
  assert.deepEqual(a.seenEvents, b.seenEvents, 'event order diverged');
}

function expectSeedsAndChoicesMatter(): void {
  const a = playTenure('dyn00001', 'dolphins', cyclingChoice);
  const b = playTenure('zzz99999', 'dolphins', cyclingChoice);
  assert.notDeepEqual(a.history, b.history, 'two different seeds produced identical decades');

  const c = playTenure('dyn00001', 'dolphins', firstChoice);
  assert.notDeepEqual(a.history, c.history, 'decisions had no effect on the tenure');
}

/** A completed tenure is exactly ten seasons unless the GM was fired. */
function expectTenureLength(): void {
  for (const club of CLUBS) {
    const state = playTenure('len00001', club.id, cyclingChoice);
    const summary = state.summary;
    assert.ok(summary, `${club.id} produced no summary`);
    if (summary!.fired) {
      assert.ok(state.history.length < 10, 'a fired GM should not have served ten seasons');
    } else {
      assert.equal(state.history.length, 10, `${club.id} served ${state.history.length} seasons`);
    }
    assert.equal(summary!.seasonsServed, state.history.length, 'summary season count mismatch');
  }
}

/** Every season must add up: 120 games, a real finish, a real ledger. */
function expectSeasonsAreCoherent(): void {
  for (const seed of ['coh00001', 'coh00002', 'coh00003']) {
    const state = playTenure(seed, 'cannons', cyclingChoice);
    state.history.forEach((record) => {
      assert.equal(record.wins + record.losses, GAMES, `${record.year} did not play ${GAMES} games`);
      assert.ok(record.finish >= 1 && record.finish <= CLUBS.length, `impossible finish ${record.finish}`);
      assert.ok(record.heat >= 0 && record.heat <= 100, `heat ${record.heat} out of range`);
      assert.ok(record.trust >= 0 && record.trust <= 100, `trust ${record.trust} out of range`);
      if (record.playoffResult === '未晉級') {
        assert.ok(record.finish >= 5 || !record.met || record.expectation !== 'playoffs',
          'missed the playoffs while finishing in a qualifying place');
      }
    });
    assert.equal(state.ledgers.length, state.history.length, 'a season went unsettled');
  }
}

/** Every club plays the same 120 games, so league wins and losses must match. */
function expectLeagueBooksBalance(): void {
  const state = playTenure('bal00001', 'lions', cyclingChoice);
  const wins = state.teams.reduce((sum, t) => sum + t.wins, 0);
  const losses = state.teams.reduce((sum, t) => sum + t.losses, 0);
  assert.equal(wins, losses, `league recorded ${wins} wins against ${losses} losses`);
}

/** Rosters must stay legal and populated across a decade of churn. */
function expectRostersStayLegal(): void {
  const state = playTenure('ros00001', 'eagles', cyclingChoice);
  for (const team of state.teams) {
    const majors = team.players.filter((p) => p.level === 'major');
    assert.ok(majors.length > 0, `${team.name} finished with an empty active roster`);
    assert.ok(majors.length <= 26, `${team.name} carried ${majors.length} on a 26-man roster`);
    const ids = team.players.map((p) => p.id);
    assert.equal(new Set(ids).size, ids.length, `${team.name} has a duplicated player`);
    team.players.forEach((p) => {
      assert.equal(p.teamId, team.id, `${p.name} thinks he plays for ${p.teamId}`);
      assert.ok(p.age >= 18 && p.age <= 41, `${p.name} is ${p.age} years old`);
      assert.ok(p.salary > 0, `${p.name} is playing for nothing`);
    });
  }
  // Nobody may appear on two clubs at once.
  const all = state.teams.flatMap((t) => t.players.map((p) => p.id));
  assert.equal(new Set(all).size, all.length, 'a player is on two rosters');
}

/** The win-rate curve has to be monotonic and bounded. */
function expectWinRateCurve(): void {
  assert.ok(winRate(52, 52) > 0.49 && winRate(52, 52) < 0.51, 'an average club should be near .500');
  assert.ok(winRate(20, 52) >= 0.25, 'floor breached');
  assert.ok(winRate(99, 52) <= 0.75, 'ceiling breached');

  // Monotonic across the whole sweep, and genuinely varying inside the band
  // real rosters occupy — a curve that saturates at +8 makes strength moot.
  let previous = 0;
  for (let strength = 20; strength <= 99; strength += 1) {
    const rate = winRate(strength, 52);
    assert.ok(rate >= previous, `win rate fell from ${previous} to ${rate} at ${strength}`);
    previous = rate;
  }
  assert.ok(winRate(60, 52) > winRate(56, 52) + 0.01, 'strength must matter in the usual range');
  assert.ok(winRate(64, 52) > winRate(60, 52), 'strength must still matter for a strong club');
}

/** Raising the price must genuinely trade volume for margin. */
function expectPriceElasticity(): void {
  assert.ok(priceElasticity(250) > priceElasticity(500), 'a dearer ticket must thin the crowd');
  assert.ok(priceElasticity(200) <= 1.15 && priceElasticity(600) >= 0.45, 'elasticity left its clamp');
}

/** The scouting band must contain a plausible read and narrow with spend. */
function expectScoutingBands(): void {
  assert.ok(bandWidthFor(1000) < bandWidthFor(0), 'paying for scouting must narrow the band');
  assert.ok(bandWidthFor(1000) > 0, 'the band must never close completely');

  const r = createRng(7);
  let contained = 0;
  const trials = 400;
  for (let i = 0; i < trials; i++) {
    const potential = 30 + Math.floor(r() * 60);
    const band = scoutBand(potential, bandWidthFor(500), r);
    assert.ok(band.low <= band.high, 'band is inverted');
    assert.ok(band.low >= 20 && band.high <= 99, 'band left the legal range');
    if (potential >= band.low && potential <= band.high) contained += 1;
  }
  // Reports are biased, not merely noisy, so they must usually — but not
  // always — contain the truth. A band that always contained it would make
  // scouting a solved problem.
  const rate = contained / trials;
  assert.ok(rate > 0.55, `bands contained the truth only ${(rate * 100).toFixed(0)}% of the time`);
  assert.ok(rate < 0.999, 'bands always contain the truth, so the draft carries no risk');
}

/** Valuation must price age and contract, not just raw ability. */
function expectValuationRespectsAgeAndContract(): void {
  const base = {
    id: 'x', name: 'A', position: 'OF' as const, age: 25,
    attrs: {
      contact: 70, power: 70, speed: 70, fielding: 70, eye: 70,
      velocity: 20, control: 20, breaking: 20, stamina: 20, guts: 20,
    },
    potential: 75, band: { low: 70, high: 80 }, salary: 500, years: 2,
    level: 'major' as const, injuredSeasons: 0, homegrown: false, teamId: 't',
  };
  const young = { ...base, age: 23 };
  const old = { ...base, age: 35 };
  assert.ok(tradeValue(young) > tradeValue(old), 'age must matter to trade value');

  const cheap = { ...base, salary: 200 };
  const pricey = { ...base, salary: 1400 };
  assert.ok(tradeValue(cheap) > tradeValue(pricey), 'a bargain contract must be worth more');

  assert.ok(
    marketSalary(75, 28) > marketSalary(50, 28),
    'a better player must command a bigger salary',
  );
}

/** Negotiating the mandate must always cost trust downwards. */
function expectNegotiationCosts(): void {
  const down = negotiable('playoffs').find((e) => e.expectation === 'hold');
  const up = negotiable('playoffs').find((e) => e.expectation === 'title');
  const same = negotiable('playoffs').find((e) => e.expectation === 'playoffs');
  assert.ok(down && down.trustDelta < 0, 'talking the board down must cost trust');
  assert.ok(up && up.trustDelta > 0, 'raising the target should be rewarded');
  assert.ok(same && same.trustDelta === 0, 'accepting the mandate is free');
  assert.equal(negotiable('rebuild').some((e) => e.expectation === 'rebuild'), true);
  assert.equal(negotiable('title').length, 2, 'the top tier has nowhere higher to go');
}

/** Overall must match 棒球人生 so a player is worth the same in both games. */
function expectOverallMatchesBaseballLife(): void {
  const attrs = {
    contact: 60, power: 55, speed: 50, fielding: 45, eye: 65,
    velocity: 70, control: 62, breaking: 58, stamina: 54, guts: 66,
  };
  const pitcher = 70 * 0.28 + 62 * 0.28 + 58 * 0.24 + 54 * 0.12 + 66 * 0.08;
  assert.ok(Math.abs(overall(attrs, 'P') - pitcher) < 1e-9, 'pitcher weighting drifted');
  const outfield = (60 * 0.42 + 55 * 0.28 + 65 * 0.18 + 50 * 0.12) * 0.85 + 45 * 0.15;
  assert.ok(Math.abs(overall(attrs, 'OF') - outfield) < 1e-9, 'batter weighting drifted');
  assert.equal(LEAGUE_BASELINE, 52, 'league baseline must match 棒球人生');
}

function expectMoneyFormatting(): void {
  assert.equal(formatMoney(0), '0 萬');
  assert.equal(formatMoney(9999), '9,999 萬');
  assert.equal(formatMoney(10000), '1 億');
  assert.equal(formatMoney(12345), '1 億 2,345 萬');
  assert.ok(formatMoney(-2500).startsWith('−'), 'a deficit must read as negative');
}


/**
 * The rule that fixed the regular season: **no option is free.**
 *
 * The first version put the same four choices in front of the player forty
 * times a tenure, and one of them was literally "維持現狀：不做調整". A decision
 * whose safe answer is "do nothing", asked forty times, is a next button in a
 * costume. Every option now has to move at least one number, and this check is
 * what keeps that true as situations get added.
 */
function expectNoFreeOptions(): void {
  assert.ok(SITUATIONS.length >= 25, `only ${SITUATIONS.length} situations; a tenure has 40 blocks`);
  assert.equal(
    new Set(SITUATIONS.map((s) => s.id)).size,
    SITUATIONS.length,
    'two situations share an id',
  );

  const state = createGame({ seedCode: 'sit00001', gmName: '測試', teamId: 'dolphins' });
  const team = state.teams.find((t) => t.id === state.teamId)!;

  for (const standing of [1, 3, 6]) {
    for (const blocksLeft of [3, 0]) {
      const ctx = buildContext(state, team, standing, blocksLeft);
      for (const situation of SITUATIONS) {
        const built = situation.build(ctx);
        assert.ok(built.prompt.length > 10, `${situation.id}: prompt is too thin`);
        assert.ok(built.options.length >= 2, `${situation.id}: needs at least two options`);
        assert.equal(
          new Set(built.options.map((o) => o.id)).size,
          built.options.length,
          `${situation.id}: duplicate option ids`,
        );

        for (const option of built.options) {
          const fx = option.effects;
          const moves =
            (fx.cash ?? 0) !== 0 ||
            (fx.heat ?? 0) !== 0 ||
            (fx.trust ?? 0) !== 0 ||
            (fx.morale ?? 0) !== 0 ||
            (fx.farmLevel ?? 0) !== 0 ||
            (fx.blockBonus ?? 0) !== 0 ||
            (fx.farmBoost ?? 1) !== 1 ||
            option.playerEffect !== undefined;
          assert.ok(moves, `${situation.id}/${option.id} changes nothing — a free "do nothing"`);
          assert.ok(option.outcome.length > 4, `${situation.id}/${option.id}: no outcome line`);
        }

        // At least one option has to hurt somewhere, or it is not a trade-off.
        const hasDownside = built.options.some((o) => {
          const fx = o.effects;
          return (
            (fx.cash ?? 0) < 0 ||
            (fx.heat ?? 0) < 0 ||
            (fx.trust ?? 0) < 0 ||
            (fx.morale ?? 0) < 0 ||
            (fx.blockBonus ?? 0) < 0 ||
            (fx.farmBoost ?? 1) < 1
          );
        });
        assert.ok(hasDownside, `${situation.id}: every option is upside only`);
      }
    }
  }
}

/** A ten-year run has to actually show variety rather than one situation. */
function expectSituationVariety(): void {
  const state = playTenure('var00001', 'dolphins', cyclingChoice);
  assert.ok(
    state.seenSituations.length >= 18,
    `a tenure only showed ${state.seenSituations.length} distinct situations`,
  );
  assert.equal(
    new Set(state.seenSituations).size,
    state.seenSituations.length,
    'a situation was recorded twice as seen',
  );

  // Unseen-first has to hold: no repeat until the eligible pool is exhausted.
  const fresh = createGame({ seedCode: 'var00002', gmName: '測試', teamId: 'dolphins' });
  const team = fresh.teams.find((t) => t.id === fresh.teamId)!;
  const ctx = buildContext(fresh, team, 3, 2);
  // Pick the target from the situations that are actually eligible in this
  // context — a conditional one that does not apply is not a candidate at all.
  const eligible = SITUATIONS.filter((s) => !s.condition || s.condition(ctx));
  assert.ok(eligible.length > 1, 'not enough situations are eligible on a fresh league');
  const target = eligible[eligible.length - 1];
  const seen = SITUATIONS.filter((s) => s.id !== target.id).map((s) => s.id);
  assert.equal(
    pickSituation(ctx, seen, createRng(5)).id,
    target.id,
    'pickSituation did not prefer the one unseen situation',
  );
}

/**
 * The property that makes undo honest.
 *
 * Randomness is seeded on (purpose, year, phase, block, decisions.length), so
 * stepping back and choosing the *same* option has to land on the identical
 * state. Otherwise undo would be a re-roll and every bad outcome could be
 * shopped away.
 */
function expectUndoIsNotAReroll(): void {
  let state = createGame({ seedCode: 'undo0001', gmName: '測試', teamId: 'dolphins' });

  for (let step = 0; step < 24; step++) {
    if (state.over || !state.decision || state.decision.options.length === 0) break;
    const optionId = enabled(state.decision)[0];

    const once = resolve(state, optionId);
    const twice = resolve(state, optionId);
    assert.equal(twice.finance.cash, once.finance.cash, `step ${step}: cash differed on replay`);
    assert.equal(twice.heat, once.heat, `step ${step}: heat differed on replay`);
    assert.equal(twice.morale, once.morale, `step ${step}: morale differed on replay`);
    assert.deepEqual(
      twice.report?.lines,
      once.report?.lines,
      `step ${step}: the report differed on replay`,
    );
    assert.deepEqual(
      twice.teams.map((t) => `${t.wins}-${t.losses}`),
      once.teams.map((t) => `${t.wins}-${t.losses}`),
      `step ${step}: standings differed on replay`,
    );

    state = acknowledge(once);
  }
}

const checks: [string, () => void][] = [
  ['deterministic tenures', expectDeterministicTenures],
  ['seeds and choices matter', expectSeedsAndChoicesMatter],
  ['tenure length', expectTenureLength],
  ['seasons are coherent', expectSeasonsAreCoherent],
  ['league books balance', expectLeagueBooksBalance],
  ['rosters stay legal', expectRostersStayLegal],
  ['win rate curve', expectWinRateCurve],
  ['price elasticity', expectPriceElasticity],
  ['scouting bands', expectScoutingBands],
  ['valuation respects age and contract', expectValuationRespectsAgeAndContract],
  ['negotiation costs trust', expectNegotiationCosts],
  ['overall matches 棒球人生', expectOverallMatchesBaseballLife],
  ['money formatting', expectMoneyFormatting],
  ['no free options', expectNoFreeOptions],
  ['situation variety', expectSituationVariety],
  ['undo is not a re-roll', expectUndoIsNotAReroll],
];

let failed = 0;
for (const [name, check] of checks) {
  try {
    check();
    console.log(`ok  - ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL - ${name}`);
    console.error(error instanceof Error ? error.message : error);
  }
}

if (failed > 0) {
  console.error(`\n${failed} check(s) failed.`);
  process.exit(1);
}
console.log('\nAll self-checks passed.');
