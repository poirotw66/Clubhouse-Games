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
import {
  BUDGET_SCENARIOS,
  TRAINING_SCENARIOS,
  buildBudgetContext,
  buildTrainingContext,
} from '../src/game/plans.js';
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

/**
 * Choices must change the OUTCOME, not merely the transcript.
 *
 * expectSeedsAndChoicesMatter above asserts that two choice policies produce
 * different histories. That is guaranteed the instant any single choice
 * differs — it separates "these are not the same inputs" from nothing, and
 * says nothing about whether the decade ends anywhere different. The same
 * shape of check has now been found guarding three games in this repo, and in
 * two of them the thing it was supposed to defend had quietly stopped being
 * true.
 *
 * So compare two policies on the score they actually finish with, over enough
 * seeds to say it, with the interval on the DIFFERENCE. (Two overlapping
 * per-policy intervals can still have a difference that excludes zero; testing
 * them for overlap is strictly more conservative and reports real gaps as
 * absent.)
 *
 * Measured over 60 seeds, spending the most against spending the least is
 * +787 [379, 1195] — comfortably clear. The two weaker policies are NOT
 * separable from each other (+37 [-371, 445]), which is why the pair chosen
 * here is the extremes rather than any two policies: a check pinned on the
 * middle pair would be asserting noise.
 */
function expectChoicesChangeTheOutcome(): void {
  const SEEDS = Array.from({ length: 40 }, (_, i) => `outcome-${i}`);
  const spendMost: Chooser = (decision) =>
    [...decision.options.filter((o) => !o.disabled)].sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0))[0].id;
  const spendLeast: Chooser = (decision) =>
    [...decision.options.filter((o) => !o.disabled)].sort((a, b) => (a.cost ?? 0) - (b.cost ?? 0))[0].id;

  const scores = (chooser: Chooser): number[] =>
    SEEDS.map((seed) => playTenure(seed, 'dolphins', chooser).summary?.score ?? 0);

  const a = scores(spendMost);
  const b = scores(spendLeast);
  const mean = (xs: number[]): number => xs.reduce((x, y) => x + y, 0) / xs.length;
  const varOf = (xs: number[]): number => {
    const m = mean(xs);
    return xs.reduce((acc, x) => acc + (x - m) ** 2, 0) / xs.length;
  };
  const diff = mean(a) - mean(b);
  const halfWidth = 1.96 * Math.sqrt(varOf(a) / a.length + varOf(b) / b.length);

  assert.ok(
    Math.abs(diff) - halfWidth > 0,
    `spending the most finished on ${mean(a).toFixed(0)} against ${mean(b).toFixed(0)} for spending the least — a difference of ${diff.toFixed(0)} with a 95% interval of [${(diff - halfWidth).toFixed(0)}, ${(diff + halfWidth).toFixed(0)}], which contains zero. Two opposite spending policies end a decade in the same place, so the budget decisions are transcript and not outcome.`,
  );
}

/** A completed tenure is exactly ten seasons unless the GM was fired. */
function expectTenureLength(): void {
  // This check used to assert that a fired GM served *fewer* than ten seasons.
  // That is not an invariant, it was an accident of the old balance: `endSeason`
  // tests for a sacking before `advanceYear` closes out the term, so losing the
  // board in your tenth year fires you at the finish line — which is a better
  // ending than a bland "term expired", not a bug. What the check should defend
  // is that a tenure never exceeds ten seasons and that mid-term sackings still
  // happen at all.
  let firedEarly = 0;

  for (const club of CLUBS) {
    const state = playTenure('len00001', club.id, cyclingChoice);
    const summary = state.summary;
    assert.ok(summary, `${club.id} produced no summary`);
    assert.ok(
      state.history.length <= 10,
      `${club.id} served ${state.history.length} seasons, more than the ten-year term`,
    );
    if (!summary!.fired) {
      assert.equal(state.history.length, 10, `${club.id} survived but only served ${state.history.length}`);
    } else if (state.history.length < 10) {
      firedEarly += 1;
    }
    assert.equal(summary!.seasonsServed, state.history.length, 'summary season count mismatch');
  }

  // If nobody is ever sacked mid-term the board has stopped being a threat.
  const anyFiredEarly = CLUBS.some((club) => {
    const state = playTenure('len00002', club.id, firstChoice);
    return state.summary?.fired && state.history.length < 10;
  });
  assert.ok(firedEarly > 0 || anyFiredEarly, 'no club ever sacked its GM mid-term');
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
 * The same "no free option" discipline `expectNoFreeOptions` holds the block
 * situations to, extended to the spring-training and post-season-budget
 * scenarios in `plans.ts`. Training options must move at least one number and
 * at least one option per scenario has to hurt somewhere; budget options must
 * always spend real money on marketing and scouting — there is no zero-cost
 * operating plan — and the offers inside one scenario must be a genuine
 * trade-off rather than four labels wrapped around identical numbers.
 */
function expectNoFreePlans(): void {
  assert.ok(TRAINING_SCENARIOS.length >= 5, `only ${TRAINING_SCENARIOS.length} spring-training scenarios`);
  assert.equal(
    new Set(TRAINING_SCENARIOS.map((s) => s.id)).size,
    TRAINING_SCENARIOS.length,
    'two training scenarios share an id',
  );
  assert.ok(BUDGET_SCENARIOS.length >= 5, `only ${BUDGET_SCENARIOS.length} budget scenarios`);
  assert.equal(
    new Set(BUDGET_SCENARIOS.map((s) => s.id)).size,
    BUDGET_SCENARIOS.length,
    'two budget scenarios share an id',
  );

  const state = createGame({ seedCode: 'pln00001', gmName: '測試', teamId: 'dolphins' });
  const team = state.teams.find((t) => t.id === state.teamId)!;
  const baseTraining = buildTrainingContext(state, team);
  const baseBudget = buildBudgetContext(state, team);

  const dummyRecord = {
    year: 2026, wins: 40, losses: 80, finish: 5, playoffResult: '未晉級' as const,
    expectation: 'hold' as const, met: false, net: 0, heat: 50, trust: 50,
  };

  // Enough club situations to trip every scenario's condition at least once.
  const trainingFlagSets: Partial<typeof baseTraining>[] = [
    {},
    { wonTitle: true, lastRecord: { ...dummyRecord, finish: 1, playoffResult: '總冠軍' } },
    { sank: true, lastRecord: { ...dummyRecord, finish: 5 } },
    { broke: true, cash: 200 },
    { starHeavy: true },
    { farmHeavy: true },
    { aging: true },
  ];

  for (const flags of trainingFlagSets) {
    const ctx = { ...baseTraining, ...flags };
    for (const scenario of TRAINING_SCENARIOS) {
      const built = scenario.build(ctx);
      assert.ok(built.prompt.length > 8, `${scenario.id}: prompt is too thin`);
      assert.ok(built.options.length >= 2, `${scenario.id}: needs at least two options`);
      assert.equal(
        new Set(built.options.map((o) => o.id)).size,
        built.options.length,
        `${scenario.id}: duplicate option ids`,
      );

      for (const option of built.options) {
        const fx = option.effects;
        const moves = fx.cost !== 0 || fx.bonus !== 0 || fx.farmBoost !== 1 || fx.morale !== 0;
        assert.ok(moves, `${scenario.id}/${option.id} changes nothing — a free "do nothing"`);
      }

      const hasDownside = built.options.some((o) => {
        const fx = o.effects;
        return fx.cost > 0 || fx.bonus < 0 || fx.farmBoost < 1 || fx.morale < 0;
      });
      assert.ok(hasDownside, `${scenario.id}: every option is upside only`);
    }
  }

  const budgetFlagSets: Partial<typeof baseBudget>[] = [
    {},
    { wonTitle: true },
    { sank: true },
    { broke: true, cash: 200 },
    { boomingFans: true, heat: 80 },
    { rebuildMandate: true },
    { contending: true },
  ];

  for (const flags of budgetFlagSets) {
    const ctx = { ...baseBudget, ...flags };
    for (const scenario of BUDGET_SCENARIOS) {
      const built = scenario.build(ctx);
      assert.ok(built.prompt.length > 8, `${scenario.id}: prompt is too thin`);
      assert.ok(built.options.length >= 2, `${scenario.id}: needs at least two options`);
      assert.equal(
        new Set(built.options.map((o) => o.id)).size,
        built.options.length,
        `${scenario.id}: duplicate option ids`,
      );

      const offers = built.options.map(
        (o) => `${o.effects.ticketPrice}|${o.effects.marketing}|${o.effects.scouting}`,
      );
      assert.equal(
        new Set(offers).size,
        offers.length,
        `${scenario.id}: two options offer identical numbers`,
      );

      for (const option of built.options) {
        const fx = option.effects;
        assert.ok(fx.marketing > 0, `${scenario.id}/${option.id}: a free marketing budget`);
        assert.ok(fx.scouting > 0, `${scenario.id}/${option.id}: a free scouting budget`);
        assert.ok(fx.ticketPrice > 0, `${scenario.id}/${option.id}: a free ticket`);
      }

      // A real trade-off, not four cosmetically different labels wrapped
      // around the same numbers — something in the offer has to vary.
      const prices = new Set(built.options.map((o) => o.effects.ticketPrice));
      const spends = new Set(built.options.map((o) => o.effects.marketing + o.effects.scouting));
      assert.ok(prices.size > 1 || spends.size > 1, `${scenario.id}: every option spends the same way`);
    }
  }
}

/**
 * The measured problem this rewrite fixes: `spring` and `budget` used to show
 * the exact same four options ten years running. A tenure now has to show at
 * least 6 distinct option sets in each phase — measured directly off the
 * label sets the player actually sees, not assumed from the scenario count.
 */
/**
 * Difficulty must not drift.
 *
 * Replacing the two fixed plan menus with a scenario pool silently made the
 * game noticeably easier — end-of-tenure cash rose about 46% and the firing rate
 * fell from 37% to 23% — because several new options were cheap *and* helpful,
 * and several let a club charge a premium ticket price without paying for the
 * marketing to fill the seats. Nothing else in this file noticed: the books
 * still balanced, the curves were still monotonic, every roster stayed legal.
 *
 * So the band is pinned here. It is deliberately wide enough not to be flaky
 * and narrow enough that a change of that size fails.
 */
/**
 * No phase may loop for ever.
 *
 * "再詢價一輪" at the trade deadline deliberately stays on the same phase so a
 * fresh batch of offers can be built, and it had no cap. A player who kept
 * choosing it paid 300 萬 a click while the game never advanced, and because
 * bankruptcy is only tested at season end — which was never reached — cash ran
 * arbitrarily negative. A policy of always taking the most expensive option
 * reached −113,450 inside the first year and never finished a single season.
 *
 * Nothing else here noticed, because every other check drives the game with a
 * policy that happens to move it forward. This one deliberately picks the most
 * expensive option every time, which is exactly the policy that gets stuck.
 */
function expectEveryPhaseTerminates(): void {
  // Ten years, seven phases a year, four blocks, plus the capped re-shops:
  // comfortably under 200 decisions. A stuck phase blows past this instantly.
  const CEILING = 200;

  for (const club of CLUBS) {
    let state = createGame({ seedCode: 'loop0001', gmName: '測試', teamId: club.id });
    let step = 0;
    while (!state.over && step < CEILING) {
      const decision = state.decision;
      if (!decision || decision.phase === 'over') break;
      const options = decision.options.filter((o) => !o.disabled);
      assert.ok(options.length > 0, `${club.id}: no legal option at ${decision.phase}`);
      const priciest = [...options].sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0))[0];
      state = acknowledge(resolve(state, priciest.id));
      step += 1;
    }
    assert.ok(
      state.over,
      `${club.id}: a max-spend policy never finished the tenure — stuck after ${step} decisions`,
    );
    assert.ok(state.history.length > 0, `${club.id}: not a single season completed`);
  }
}

function expectDifficultyBand(): void {
  const seeds = Array.from({ length: 40 }, (_, i) => `band-${i}`);
  let fired = 0;
  let cash = 0;

  for (const seedCode of seeds) {
    // Cheapest-option policy: the most forgiving way to play, so if even this
    // is being fired too rarely the club economy has gone slack.
    const end = playTenure(seedCode, 'dolphins', (decision) => {
      const options = decision.options.filter((o) => !o.disabled);
      return [...options].sort((a, b) => (a.cost ?? 0) - (b.cost ?? 0))[0].id;
    });
    if (end.summary?.fired) fired += 1;
    cash += end.finance.cash;
  }

  const firedPct = (fired / seeds.length) * 100;
  const avgCash = cash / seeds.length;

  assert.ok(
    firedPct >= 20 && firedPct <= 55,
    `hoarding cash got fired ${firedPct.toFixed(0)}% of the time — outside the 20-55% band`,
  );
  assert.ok(
    avgCash > 8000 && avgCash < 45000,
    `average end-of-tenure cash ${avgCash.toFixed(0)} is outside the 8,000-45,000 band`,
  );
}

function expectPlanVariety(): void {
  const runs: [string, string][] = [
    ['pv-00001', 'dolphins'],
    ['pv-00002', 'lions'],
    ['pv-00003', 'eagles'],
    ['pv-00004', 'volcano'],
    ['pv-00005', 'cannons'],
  ];

  for (const [seedCode, teamId] of runs) {
    let state = createGame({ seedCode, gmName: '測試', teamId });
    const springSets = new Set<string>();
    const budgetSets = new Set<string>();
    let springTurns = 0;
    let budgetTurns = 0;
    let step = 0;
    while (!state.over && step < GUARD) {
      const decision = state.decision;
      if (!decision || decision.phase === 'over' || decision.options.length === 0) break;
      const fingerprint = [...decision.options.map((o) => o.label)].sort().join('|');
      if (decision.phase === 'spring') {
        springSets.add(fingerprint);
        springTurns += 1;
      }
      if (decision.phase === 'budget') {
        budgetSets.add(fingerprint);
        budgetTurns += 1;
      }
      state = acknowledge(resolve(state, cyclingChoice(decision, step)));
      step += 1;
    }

    // Measured against how many times the phase actually came up, not against a
    // flat six. A GM fired after four seasons only gets four springs, and the
    // first version of this check failed on exactly that — reporting a variety
    // problem when the real story was a short tenure. Full ten-year runs come
    // in at 8-10 distinct sets out of 10.
    for (const [label, sets, turns] of [
      ['spring', springSets, springTurns],
      ['budget', budgetSets, budgetTurns],
    ] as [string, Set<string>, number][]) {
      assert.ok(turns > 0, `${teamId}/${seedCode}: ${label} never came up at all`);
      const target = Math.min(6, turns);
      assert.ok(
        sets.size >= target,
        `${teamId}/${seedCode}: ${label} showed ${sets.size} distinct option sets in ${turns} turns (needed ${target})`,
      );
      // Near-total freshness is the real bar: repeats should be rare.
      assert.ok(
        sets.size >= Math.ceil(turns * 0.7),
        `${teamId}/${seedCode}: ${label} repeated too often — ${sets.size} distinct in ${turns} turns`,
      );
    }
  }
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
  ['choices change the outcome, not just the transcript', expectChoicesChangeTheOutcome],
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
  ['no free training/budget plans', expectNoFreePlans],
  ['spring/budget plan variety', expectPlanVariety],
  ['every phase terminates', expectEveryPhaseTerminates],
  ['difficulty band holds', expectDifficultyBand],
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
