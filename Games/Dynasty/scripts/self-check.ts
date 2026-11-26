import * as assert from 'node:assert/strict';
import {
  CAREER_CHALLENGES,
  EMPTY_CHALLENGE_PROGRESS,
  applyChallengeResult,
  challengeById,
  challengeCount,
  continueChallengeIndex,
  isChallengeCleared,
  isChallengeUnlocked,
} from '../src/game/challenges.js';
import { acknowledge, buildDecision, createGame, resolve } from '../src/game/engine.js';
import {
  BANKRUPTCY,
  CLUBS,
  EXPECTATIONS,
  EXPECTATION_ORDER,
  GAMES,
  LEAGUE_BASELINE,
  LUXURY_RATE,
  SALARY_CAP,
  SCOUT_TIERS,
  TRUST_DANGER,
  formatMoney,
  grade,
  overall,
} from '../src/game/config.js';
import {
  ability,
  agePlayer,
  generatePlayer,
  isStar,
  marketSalary,
  tradeValue,
} from '../src/game/players.js';
import {
  EMPTY_RECORDS,
  applyTenureToRecords,
  clubIdFromArchiveLabel,
  mergeArchiveIntoRecords,
} from '../src/game/records.js';
import {
  finishOf,
  playBlock,
  playPostseason,
  standings,
  winRate,
} from '../src/game/season.js';
import {
  attendance,
  nextHeat,
  priceElasticity,
  settle,
} from '../src/game/finance.js';
import {
  bandMidpoint,
  bandWidthFor,
  buildDraftClass,
  scoutBand,
} from '../src/game/scouting.js';
import {
  NEGOTIATION_COST,
  NEGOTIATION_GAIN,
  applyTrust,
  defaultExpectation,
  negotiable,
  review,
  shouldFire,
} from '../src/game/board.js';
import { createRng, streamRng } from '../src/game/rng.js';
import {
  available,
  farm,
  leagueAverageStrength,
  lineupStrength,
  payroll,
  pitchingStrength,
  rebalance,
  starCount,
  teamStrength,
} from '../src/game/roster.js';
import { SITUATIONS, buildContext, pickSituation } from '../src/game/situations.js';
import {
  BUDGET_SCENARIOS,
  TRAINING_SCENARIOS,
  buildBudgetContext,
  buildTrainingContext,
} from '../src/game/plans.js';
import {
  buildHighlight,
  highlightForBlock,
  highlightForPostseason,
} from '../src/game/highlights.js';
import {
  findStorylineTrigger,
  openStoryline,
  storylineHasCost,
  storylineOptionDefs,
} from '../src/game/storylines.js';
import {
  loadLifeGraduates,
  playerFromLifeGraduate,
  ratingsFromHof,
} from '../src/game/lifeBridge.js';
import type { Decision, GameState, Player, Team } from '../src/game/types.js';

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

function expectChallengeDefsAreSound(): void {
  assert.ok(CAREER_CHALLENGES.length >= 4, 'challenge pack is too thin');
  assert.ok(CAREER_CHALLENGES.length <= 8, 'challenge pack grew without a plan');
  assert.equal(challengeCount(), CAREER_CHALLENGES.length);
  const ids = CAREER_CHALLENGES.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, 'two challenges share an id');
  const goalKinds = new Set(CAREER_CHALLENGES.map((c) => c.goal.kind));
  for (const required of ['survive', 'cash', 'trust', 'titles', 'score'] as const) {
    assert.ok(goalKinds.has(required), `missing goal kind ${required}`);
  }

  for (const challenge of CAREER_CHALLENGES) {
    assert.ok(challenge.name.length > 0 && challenge.blurb.length > 0, `${challenge.id} missing copy`);
    assert.ok(challenge.goalLabel.length > 0, `${challenge.id} missing goal label`);
    assert.ok(/^[a-z0-9]{6,12}$/i.test(challenge.seedCode), `${challenge.id} seed looks wrong`);
    assert.ok(
      CLUBS.some((c) => c.id === challenge.teamId),
      `${challenge.id} locks unknown club ${challenge.teamId}`,
    );
    assert.ok(challengeById(challenge.id)?.id === challenge.id, `${challenge.id} lookup failed`);
  }
}

/** Unlock cursor mirrors Baseball-Life / Liquid-Sort: stage i opens when i <= clearedCount. */
function expectChallengeUnlockMath(): void {
  const last = CAREER_CHALLENGES.length - 1;
  assert.equal(isChallengeUnlocked(0, 0), true);
  assert.equal(isChallengeUnlocked(1, 0), false);
  assert.equal(isChallengeUnlocked(1, 1), true);
  assert.equal(isChallengeUnlocked(last, last), true);
  assert.equal(isChallengeUnlocked(last, last - 1), false);
  assert.equal(isChallengeUnlocked(-1, 0), false);
  assert.equal(isChallengeUnlocked(99, CAREER_CHALLENGES.length), false);
  assert.equal(continueChallengeIndex(0), 0);
  assert.equal(continueChallengeIndex(3), 3);
  assert.equal(continueChallengeIndex(CAREER_CHALLENGES.length), CAREER_CHALLENGES.length - 1);
}

function challengeChooser(challengeId: string): Chooser {
  const cheapest: Chooser = (decision) =>
    [...decision.options.filter((o) => !o.disabled)].sort(
      (a, b) => (a.cost ?? 0) - (b.cost ?? 0),
    )[0].id;
  // Cash / survive cards clear under a thrifty policy; title / score / trust
  // cards clear under the default first-option path on their authored seeds.
  switch (challengeId) {
    case 'full-tenure':
    case 'cash-cushion':
    case 'farm-patience':
      return cheapest;
    default:
      return firstChoice;
  }
}

/**
 * Every challenge must clear under its documented policy, and frontier advance
 * only happens when clearing the current unlocked card.
 */
function expectChallengeSeedsAreClearable(): void {
  for (let index = 0; index < CAREER_CHALLENGES.length; index++) {
    const challenge = CAREER_CHALLENGES[index];
    const chooser = challengeChooser(challenge.id);
    const state = playTenure(challenge.seedCode, challenge.teamId, chooser);
    // Tag challengeId the way createGame would — playTenure is free-play shaped,
    // so stamp the id for clear checks that only care about seed/team/summary.
    state.challengeId = challenge.id;
    assert.ok(state.over && state.summary, `${challenge.id} did not finish`);
    assert.ok(
      isChallengeCleared(challenge, state),
      `${challenge.id} was not cleared by the expected policy (score=${state.summary?.score}, titles=${state.summary?.titles}, cash=${state.finance.cash}, trust=${state.board.trust}, fired=${state.summary?.fired}, seasons=${state.summary?.seasonsServed})`,
    );

    const applied = applyChallengeResult(EMPTY_CHALLENGE_PROGRESS, index, state);
    assert.equal(applied.cleared, true, `${challenge.id} applyChallengeResult missed a clear`);
    assert.ok(applied.progress.cleared[challenge.id], `${challenge.id} not marked cleared`);
    assert.ok(
      (applied.progress.bestScore[challenge.id] ?? 0) >= state.summary!.score,
      `${challenge.id} best score not recorded`,
    );
  }

  const first = CAREER_CHALLENGES[0];
  const firstRun = playTenure(first.seedCode, first.teamId, challengeChooser(first.id));
  firstRun.challengeId = first.id;
  const fromZero = applyChallengeResult(EMPTY_CHALLENGE_PROGRESS, 0, firstRun);
  assert.equal(fromZero.progress.clearedCount, 1, 'clearing challenge 0 should open challenge 1');

  const late = CAREER_CHALLENGES[3];
  const lateRun = playTenure(late.seedCode, late.teamId, challengeChooser(late.id));
  lateRun.challengeId = late.id;
  const outOfOrder = applyChallengeResult(EMPTY_CHALLENGE_PROGRESS, 3, lateRun);
  assert.equal(
    outOfOrder.progress.clearedCount,
    0,
    'clearing a locked challenge must not advance the cursor',
  );
  assert.equal(outOfOrder.cleared, true, 'goal can still be satisfied out of order');
  assert.ok(outOfOrder.progress.cleared[late.id], 'out-of-order clear still stamps cleared map');
}

function expectRecordsAccumulateByClub(): void {
  const a = playTenure('recwall1', 'lions', firstChoice);
  const b = playTenure('recwall2', 'lions', firstChoice);
  const c = playTenure('recwall3', 'dolphins', firstChoice);
  assert.ok(a.summary && b.summary && c.summary);

  let records = applyTenureToRecords(a, EMPTY_RECORDS);
  records = applyTenureToRecords(b, records);
  records = applyTenureToRecords(c, records);

  const lionsBest = records.bestByClub.lions;
  assert.ok(lionsBest, 'lions best missing');
  assert.equal(
    lionsBest.score,
    Math.max(a.summary!.score, b.summary!.score),
    'worse lions run overwrote the best',
  );
  assert.ok(records.bestByClub.dolphins, 'dolphins best missing');
  assert.equal(records.milestoneCounts.tenures, 3);
  assert.equal(
    records.milestoneCounts.titles,
    a.summary!.titles + b.summary!.titles + c.summary!.titles,
  );

  // A worse follow-up must not overwrite.
  const worse = structuredClone(a);
  worse.summary = { ...a.summary!, score: Math.max(0, a.summary!.score - 50) };
  const afterWorse = applyTenureToRecords(worse, records);
  assert.equal(afterWorse.bestByClub.lions?.score, lionsBest.score);
}

function expectArchiveBackfillsClubBest(): void {
  assert.equal(clubIdFromArchiveLabel('南方猛獅'), 'lions');
  assert.equal(clubIdFromArchiveLabel('lions'), 'lions');
  assert.equal(clubIdFromArchiveLabel('???'), null);

  const merged = mergeArchiveIntoRecords(
    [
      {
        seedCode: 'arch0001',
        gmName: '甲',
        club: '南方猛獅',
        verdict: '名總管',
        score: 2000,
        titles: 2,
      },
      {
        seedCode: 'arch0002',
        gmName: '乙',
        club: '南方猛獅',
        verdict: '稱職的經營者',
        score: 1200,
        titles: 0,
      },
      {
        seedCode: 'arch0003',
        gmName: '丙',
        club: '新北海豚',
        verdict: '平淡的十年',
        score: 600,
        titles: 0,
      },
    ],
    EMPTY_RECORDS,
  );
  assert.equal(merged.bestByClub.lions?.score, 2000);
  assert.equal(merged.bestByClub.lions?.seedCode, 'arch0001');
  assert.equal(merged.bestByClub.dolphins?.score, 600);
}

/** Highlight reels are deterministic and reserved for key games. */
function expectHighlightsAreDeterministic(): void {
  const human: Team = {
    id: 'dolphins',
    name: '新北海豚',
    aiMode: 'balanced',
    wins: 50,
    losses: 40,
    players: [
      {
        id: 'a',
        name: '陳志豪',
        position: 'OF',
        age: 27,
        attrs: {
          contact: 70, power: 68, speed: 60, fielding: 55, eye: 62,
          velocity: 20, control: 20, breaking: 20, stamina: 20, guts: 20,
        },
        potential: 75,
        band: { low: 70, high: 80 },
        salary: 500,
        years: 2,
        level: 'major',
        injuredSeasons: 0,
        homegrown: true,
        teamId: 'dolphins',
      },
    ],
  };
  const rival: Team = {
    ...human,
    id: 'lions',
    name: '南方猛獅',
    players: human.players.map((p) => ({ ...p, id: 'b', name: '林家瑋', teamId: 'lions' })),
  };

  const a = buildHighlight({
    kind: 'playoff',
    year: 2026,
    human,
    opponent: rival,
    humanWon: true,
    seriesLine: '總冠軍賽勝出',
    rng: streamRng(42, 'hl-test'),
  });
  const b = buildHighlight({
    kind: 'playoff',
    year: 2026,
    human,
    opponent: rival,
    humanWon: true,
    seriesLine: '總冠軍賽勝出',
    rng: streamRng(42, 'hl-test'),
  });
  assert.deepEqual(a, b, 'highlight reel diverged under the same stream');
  assert.ok(a.beats.length >= 3, 'highlight needs a setup and climax');
  assert.ok(a.finalScore.includes('猛獅') || a.finalScore.includes('海豚'), 'scoreline missing clubs');

  // Quiet blocks must stay quiet — only key games earn a reel.
  const quiet = highlightForBlock({
    year: 2026,
    block: 0,
    human: { ...human, wins: 45, losses: 45 },
    teams: [
      { ...human, wins: 45, losses: 45 },
      { ...rival, wins: 48, losses: 42 },
    ],
    blockWins: 15,
    blockGames: 30,
    finishBefore: 3,
    finishAfter: 3,
    priorTitles: 0,
    rng: streamRng(7, 'quiet-block'),
  });
  assert.equal(quiet, null, 'an ordinary .500 block should not open a highlight');

  const clinch = highlightForBlock({
    year: 2026,
    block: 3,
    human: { ...human, wins: 62, losses: 58 },
    teams: [
      { ...human, wins: 62, losses: 58 },
      { ...rival, wins: 70, losses: 50 },
      { ...rival, id: 'a2', name: '天使', wins: 55, losses: 65 },
      { ...rival, id: 'a3', name: '巨砲', wins: 54, losses: 66 },
      { ...rival, id: 'a4', name: '飛鷹', wins: 50, losses: 70 },
      { ...rival, id: 'a5', name: '火山', wins: 48, losses: 72 },
    ],
    blockWins: 22,
    blockGames: 30,
    finishBefore: 5,
    finishAfter: 2,
    priorTitles: 0,
    rng: streamRng(9, 'clinch-block'),
  });
  assert.ok(clinch, 'clinching a playoff race must earn a milestone highlight');
  assert.equal(clinch!.kind, 'milestone');

  const missed = highlightForPostseason({
    year: 2026,
    human,
    teams: [human, rival],
    humanResult: '未晉級',
    championId: rival.id,
    priorTitles: 0,
    rng: streamRng(3, 'miss-post'),
  });
  assert.equal(missed, null, 'missing the playoffs should not invent a playoff reel');

  const title = highlightForPostseason({
    year: 2026,
    human,
    teams: [human, rival],
    humanResult: '總冠軍',
    championId: human.id,
    priorTitles: 0,
    rng: streamRng(3, 'title-post'),
  });
  assert.ok(title, 'winning the title must produce a highlight');
  assert.equal(title!.kind, 'milestone');
}

/** Storyline options always cost something; triggers read real roster state. */
function expectStorylinesHaveCostsAndTriggers(): void {
  const state = createGame({ seedCode: 'story001', gmName: '測試', teamId: 'dolphins' });
  const team = state.teams.find((t) => t.id === state.teamId)!;

  // Force a farm breakout candidate into memory + ability.
  const prospect = team.players.find((p) => p.level === 'farm' && p.homegrown) ?? team.players[0];
  prospect.level = 'farm';
  prospect.homegrown = true;
  prospect.age = 20;
  prospect.position = 'OF';
  Object.assign(prospect.attrs, {
    contact: 58, power: 55, speed: 52, fielding: 50, eye: 54,
    velocity: 20, control: 20, breaking: 20, stamina: 20, guts: 20,
  });
  state.playerAbilityMemory[prospect.id] = 40;

  const trigger = findStorylineTrigger(state, team);
  assert.ok(
    trigger,
    `a farm breakout should open the rookie storyline (ability≈${Math.round(
      prospect.attrs.contact * 0.42 + prospect.attrs.power * 0.28,
    )})`,
  );
  assert.equal(trigger!.kind, 'rookie-breakout');

  const arc = openStoryline(state, trigger!);
  const options = storylineOptionDefs(arc, prospect);
  assert.ok(options.length >= 2, 'storyline needs a real choice');
  for (const option of options) {
    assert.ok(
      storylineHasCost(option.effects),
      `storyline ${arc.kind}/${option.id} is a free "do nothing"`,
    );
    assert.ok(option.outcome.length > 4, `${option.id} missing outcome`);
  }

  // Same kind must not re-open after it has been seen.
  state.pendingStorylineId = null;
  const again = findStorylineTrigger(state, team);
  assert.equal(
    again?.kind === 'rookie-breakout',
    false,
    'rookie-breakout must not fire twice in one tenure',
  );
}

/** Life-bridge is defensive and does not touch Dynasty RNG when absent. */
function expectLifeBridgeIsDefensive(): void {
  assert.deepEqual(loadLifeGraduates(null), [], 'missing storage must yield no graduates');
  assert.deepEqual(
    loadLifeGraduates({ getItem: () => 'not-json' }),
    [],
    'corrupt archive must not throw',
  );
  assert.deepEqual(
    loadLifeGraduates({ getItem: () => JSON.stringify([{ name: '缺種子' }]) }),
    [],
    'partial rows must be skipped',
  );

  const fakeStore = {
    getItem: () =>
      JSON.stringify([
        {
          seedCode: 'blife001',
          name: '測試畢業生',
          position: '投手',
          positionId: 'P',
          verdict: '名人堂門檻',
          hofScore: 2100,
          traits: ['領袖'],
        },
        { seedCode: 'bad', name: '壞資料' },
      ]),
  };
  const grads = loadLifeGraduates(fakeStore);
  assert.equal(grads.length, 1, 'only intact rows survive');
  assert.equal(grads[0].position, 'P');

  const ratings = ratingsFromHof(2100);
  assert.ok(ratings.potential > ratings.ability, 'graduates still have headroom');
  const player: Player = playerFromLifeGraduate(grads[0], 500);
  assert.equal(player.name, '測試畢業生');
  assert.equal(player.position, 'P');
  assert.ok(player.id.startsWith('life:'), 'life ids must be namespaced');

  // Two builds from the same graduate are identical — bridge is deterministic.
  const twin = playerFromLifeGraduate(grads[0], 500);
  assert.deepEqual(twin.attrs, player.attrs, 'life-bridge player attrs diverged');
  assert.deepEqual(twin.band, player.band, 'life-bridge scouting band diverged');
}

/** A full tenure still finishes with storyline cards in the mix. */
function expectStorylinesDoNotStallTenure(): void {
  const end = playTenure('storyrun1', 'dolphins', cyclingChoice);
  assert.ok(end.over, 'tenure with storylines must still finish');
  assert.ok(end.summary, 'summary missing after storyline tenure');
  // Storylines are optional; when they fire they must leave a trace.
  if (end.seenStorylineKinds.length > 0) {
    assert.ok(
      end.storylines.length >= end.seenStorylineKinds.length,
      'seen kinds without arc records',
    );
  }
}

/**
 * 10-year tenure board expectations, negotiation costs in trust,
 * and crisis resolution paths.
 */
function expectBoardExpectationsNegotiationAndCrisisResolution(): void {
  // 1. Default board expectation logic based on roster strength and prior finish.
  const createMockTeam = (strengthOffset: number, starCount: number): Team => {
    const players: Player[] = [];
    for (let i = 0; i < 26; i++) {
      const isAStar = i < starCount;
      const targetAbility = isAStar ? 74 : 52 + strengthOffset;
      players.push({
        id: `t_p_${i}`,
        name: `球員${i}`,
        position: i < 11 ? 'P' : 'IF',
        age: 26,
        attrs: {
          contact: targetAbility, power: targetAbility, speed: targetAbility,
          fielding: targetAbility, eye: targetAbility, velocity: targetAbility,
          control: targetAbility, breaking: targetAbility, stamina: targetAbility,
          guts: targetAbility,
        },
        potential: 75,
        band: { low: 70, high: 80 },
        salary: 400,
        years: 2,
        level: 'major',
        injuredSeasons: 0,
        homegrown: i < 5,
        teamId: 'lions',
      });
    }
    return {
      id: 'lions',
      name: '南方猛獅',
      aiMode: 'contend',
      wins: 60,
      losses: 60,
      players,
    };
  };

  const createMockState = (finish: number): GameState => {
    const state = createGame({ seedCode: 'exp00001', gmName: '測試', teamId: 'lions' });
    if (finish > 0) {
      state.history = [{
        year: 1,
        finish,
        wins: finish <= 2 ? 75 : 55,
        losses: finish <= 2 ? 45 : 65,
        playoffResult: finish <= 4 ? (finish === 1 ? '總冠軍' : '準決賽敗') : '未晉級',
        expectation: 'hold',
        met: true,
        net: 1000,
        heat: 50,
        trust: 60,
      }];
    }
    return state;
  };

  // Contender: finish <= 2 with >= 3 stars expects 'title'.
  assert.equal(
    defaultExpectation(createMockState(2), createMockTeam(3, 4)),
    'title',
    'championship contender must default to title mandate',
  );
  // Strong finish (3rd) or fewer stars expects 'playoffs'.
  assert.equal(
    defaultExpectation(createMockState(3), createMockTeam(1, 2)),
    'playoffs',
    'top-half playoff contender must default to playoffs mandate',
  );
  // Mid-table with >= 2 stars expects 'hold'.
  assert.equal(
    defaultExpectation(createMockState(5), createMockTeam(0, 2)),
    'hold',
    'mid-table roster with veterans must default to hold mandate',
  );
  // Rebuilding team (poor finish, < 2 stars) defaults to 'rebuild'.
  assert.equal(
    defaultExpectation(createMockState(6), createMockTeam(-3, 0)),
    'rebuild',
    'depleted roster must default to rebuild mandate',
  );

  // 2. Negotiation costs and gains across all 4 expectation tiers.
  assert.deepEqual(
    EXPECTATION_ORDER,
    ['rebuild', 'hold', 'playoffs', 'title'],
    'expectation tier ordering violated',
  );
  assert.equal(NEGOTIATION_COST, -6, 'talking board down must cost 6 trust');
  assert.equal(NEGOTIATION_GAIN, 4, 'raising target must reward 4 trust');

  // Rebuild has no lower tier; only same (0) and up to hold (+4).
  const rebuildOptions = negotiable('rebuild');
  assert.equal(rebuildOptions.length, 2, 'rebuild must have exactly 2 negotiation choices');
  assert.equal(rebuildOptions[0].expectation, 'rebuild');
  assert.equal(rebuildOptions[0].trustDelta, 0);
  assert.equal(rebuildOptions[1].expectation, 'hold');
  assert.equal(rebuildOptions[1].trustDelta, NEGOTIATION_GAIN);

  // Hold has down to rebuild (-6), same (0), and up to playoffs (+4).
  const holdOptions = negotiable('hold');
  assert.equal(holdOptions.length, 3);
  assert.equal(holdOptions[0].expectation, 'rebuild');
  assert.equal(holdOptions[0].trustDelta, NEGOTIATION_COST);
  assert.equal(holdOptions[1].expectation, 'hold');
  assert.equal(holdOptions[1].trustDelta, 0);
  assert.equal(holdOptions[2].expectation, 'playoffs');
  assert.equal(holdOptions[2].trustDelta, NEGOTIATION_GAIN);

  // Title has down to playoffs (-6) and same (0); cannot negotiate higher.
  const titleOptions = negotiable('title');
  assert.equal(titleOptions.length, 2);
  assert.equal(titleOptions[0].expectation, 'playoffs');
  assert.equal(titleOptions[0].trustDelta, NEGOTIATION_COST);
  assert.equal(titleOptions[1].expectation, 'title');
  assert.equal(titleOptions[1].trustDelta, 0);

  // 3. Review scoring and crisis paths.
  // Rebuild mandate: requires homegrown regulars >= 3.
  const metRebuild = review({
    expectation: 'rebuild',
    wins: 50, games: 120,
    madePlayoffs: false, wonTitle: false,
    homegrownRegulars: 3,
    net: 1000, heat: 50,
  });
  assert.equal(metRebuild.met, true);
  // reward: +12, net >= 0: +4, heat normal: 0 => trustDelta = +16.
  assert.equal(metRebuild.trustDelta, 12 + 4);

  const failedRebuild = review({
    expectation: 'rebuild',
    wins: 50, games: 120,
    madePlayoffs: false, wonTitle: false,
    homegrownRegulars: 2,
    net: -500, heat: 18,
  });
  assert.equal(failedRebuild.met, false);
  // penalty: -6, net < 0: -6, heat <= 20: -4 => trustDelta = -16.
  assert.equal(failedRebuild.trustDelta, -6 - 6 - 4);

  // Title mandate: reward 28, bonus 6000萬 when met.
  const titleWon = review({
    expectation: 'title',
    wins: 78, games: 120,
    madePlayoffs: true, wonTitle: true,
    homegrownRegulars: 2,
    net: 2500, heat: 85,
  });
  assert.equal(titleWon.met, true);
  assert.equal(titleWon.bonus, 6000);
  // 28 (title reward) + 4 (profit) + 3 (heat >= 70) = +35 trust.
  assert.equal(titleWon.trustDelta, 28 + 4 + 3);

  // 4. Crisis state machine: danger years, crisis resolution paths, and firing.
  const crisisState = createGame({ seedCode: 'crs00001', gmName: '測試', teamId: 'lions' });
  crisisState.board.trust = 50;
  crisisState.board.dangerYears = 0;
  assert.equal(shouldFire(crisisState), false);

  // Plunge into crisis: trust drops below TRUST_DANGER (20).
  applyTrust(crisisState, -35); // 50 - 35 = 15
  assert.equal(crisisState.board.trust, 15);
  assert.equal(crisisState.board.dangerYears, 1, 'trust below 20 must mark danger year 1');
  assert.equal(shouldFire(crisisState), false, 'first year in danger must give GM one crisis season');

  // Crisis Resolution Path A: Successful turnaround clears danger.
  applyTrust(crisisState, 15); // 15 + 15 = 30 >= 20
  assert.equal(crisisState.board.trust, 30);
  assert.equal(crisisState.board.dangerYears, 0, 'recovering above 20 must clear danger counter');
  assert.equal(shouldFire(crisisState), false);

  // Crisis Resolution Path B: Edge boundary at exactly 20 trust.
  crisisState.board.trust = 15;
  crisisState.board.dangerYears = 1;
  applyTrust(crisisState, 5); // 15 + 5 = 20
  assert.equal(crisisState.board.trust, 20);
  assert.equal(crisisState.board.dangerYears, 0, 'trust exactly at 20 is safe');

  // Crisis Resolution Path C: Terminal crisis (consecutive danger years).
  applyTrust(crisisState, -5); // 20 - 5 = 15
  assert.equal(crisisState.board.dangerYears, 1);
  applyTrust(crisisState, -2); // 15 - 2 = 13 (second consecutive danger year)
  assert.equal(crisisState.board.trust, 13);
  assert.equal(crisisState.board.dangerYears, 2, 'second consecutive danger year tracked');
  assert.equal(shouldFire(crisisState), true, 'two consecutive danger years must trigger firing');

  // Clamping: trust is bounded [0, 100].
  applyTrust(crisisState, -200);
  assert.equal(crisisState.board.trust, 0, 'trust must not drop below 0');
  applyTrust(crisisState, 200);
  assert.equal(crisisState.board.trust, 100, 'trust must not exceed 100');
}

/**
 * Scouting accuracy bands (A/B/C/D), fog-of-war draft talent estimation,
 * and development ceilings.
 */
function expectScoutingAccuracyFogOfWarAndDevelopmentCeilings(): void {
  // 1. Scouting tier spend vs band half-widths.
  assert.equal(SCOUT_TIERS.length, 4, 'four scouting investment tiers expected');
  assert.equal(bandWidthFor(0), 25);
  assert.equal(bandWidthFor(150), 25);
  assert.equal(bandWidthFor(200), 16);
  assert.equal(bandWidthFor(450), 16);
  assert.equal(bandWidthFor(500), 10);
  assert.equal(bandWidthFor(950), 10);
  assert.equal(bandWidthFor(1000), 5);
  assert.equal(bandWidthFor(5000), 5);

  // 2. Scouting letter grades (A/B/C/D) and fog-of-war band ambiguity.
  // grade(v): S >= 92, A >= 82, B >= 70, C >= 56, D >= 42, E >= 28, F < 28.
  assert.equal(grade(85), 'A');
  assert.equal(grade(72), 'B');
  assert.equal(grade(60), 'C');
  assert.equal(grade(48), 'D');

  const rngForScout = createRng(42);
  // For a prospect with true potential 60 (Grade C):
  // At spend 0 (width 25), the fog-of-war reported band spans widely across letter grades.
  const wideBand = scoutBand(60, bandWidthFor(0), rngForScout);
  const wideSpan = wideBand.high - wideBand.low;
  assert.ok(wideSpan >= 30, `spend 0 band span ${wideSpan} must reflect wide uncertainty`);

  // At spend 1000 (width 5), the reported band is tightly focused near Grade C.
  const narrowBand = scoutBand(60, bandWidthFor(1000), rngForScout);
  const narrowSpan = narrowBand.high - narrowBand.low;
  assert.ok(narrowSpan <= 12, `spend 1000 band span ${narrowSpan} must be tightly focused`);
  assert.ok(wideSpan > narrowSpan * 2.5, 'unscouted band span must be at least 2.5x wider than fully scouted band');

  // 3. Fog-of-war draft talent estimation: Mean Absolute Error (MAE) drops with investment.
  const draftState = createGame({ seedCode: 'scout999', gmName: '測試', teamId: 'lions' });
  const evalDraftClass = (spend: number): { mae: number; gems: number; busts: number } => {
    let totalError = 0;
    let gems = 0;
    let busts = 0;
    const trials = 60;
    for (let yr = 1; yr <= trials; yr++) {
      draftState.year = yr;
      const dClass = buildDraftClass(draftState, spend);
      assert.equal(dClass.length, 8, 'draft class must have 8 prospects');
      dClass.forEach((p) => {
        const mid = bandMidpoint(p);
        const err = Math.abs(mid - p.potential);
        totalError += err;
        if (p.potential - mid >= 8) gems += 1;
        if (mid - p.potential >= 8) busts += 1;
      });
    }
    return {
      mae: totalError / (trials * 8),
      gems,
      busts,
    };
  };

  const scout0 = evalDraftClass(0);
  const scout200 = evalDraftClass(200);
  const scout500 = evalDraftClass(500);
  const scout1000 = evalDraftClass(1000);

  // Fog-of-war error must decrease strictly with higher scouting tier.
  assert.ok(
    scout1000.mae < scout500.mae && scout500.mae < scout200.mae && scout200.mae < scout0.mae,
    `scouting error did not decrease monotonically: 0:${scout0.mae.toFixed(1)}, 200:${scout200.mae.toFixed(1)}, 500:${scout500.mae.toFixed(1)}, 1000:${scout1000.mae.toFixed(1)}`,
  );
  assert.ok(scout1000.mae < 4.5, `spend 1000 MAE ${scout1000.mae.toFixed(2)} should be below 4.5`);
  assert.ok(scout0.mae > 10.0, `spend 0 MAE ${scout0.mae.toFixed(2)} should be above 10.0`);

  // Under un-scouted conditions (spend 0), there are both hidden gems and draft busts.
  assert.ok(scout0.gems > 10, 'spend 0 draft class should produce hidden gems (true > report)');
  assert.ok(scout0.busts > 10, 'spend 0 draft class should produce draft busts (report > true)');

  // 4. Player development ceilings.
  const devRng = createRng(101);
  const prospectWithHeadroom: Player = {
    id: 'p_dev_1', name: '新秀A', position: 'OF', age: 19,
    attrs: { contact: 38, power: 38, speed: 38, fielding: 38, eye: 38, velocity: 20, control: 20, breaking: 20, stamina: 20, guts: 20 },
    potential: 78, band: { low: 70, high: 86 }, salary: 60, years: 4,
    level: 'farm', injuredSeasons: 0, homegrown: true, teamId: 'lions',
  };
  const initAbility = ability(prospectWithHeadroom);
  agePlayer(prospectWithHeadroom, devRng, 1.8);
  const grownAbility = ability(prospectWithHeadroom);
  assert.ok(grownAbility > initAbility + 2.5, 'prospect with large headroom must develop significantly');

  // Player at development ceiling does not grow.
  const cappedPlayer: Player = {
    id: 'p_dev_2', name: '飽和新秀', position: 'OF', age: 24,
    attrs: { contact: 76, power: 76, speed: 76, fielding: 76, eye: 76, velocity: 20, control: 20, breaking: 20, stamina: 20, guts: 20 },
    potential: 72, band: { low: 70, high: 74 }, salary: 200, years: 3,
    level: 'farm', injuredSeasons: 0, homegrown: true, teamId: 'lions',
  };
  const cappedInit = ability(cappedPlayer);
  agePlayer(cappedPlayer, devRng, 1.8);
  const cappedAfter = ability(cappedPlayer);
  assert.equal(
    cappedAfter,
    cappedInit,
    'player whose current ability exceeds potential ceiling must not receive development gains',
  );

  // Farm boost accelerates growth compared to major league for young players.
  const farmProspect: Player = {
    id: 'p_farm', name: '二軍新秀', position: 'OF', age: 20,
    attrs: { contact: 45, power: 45, speed: 45, fielding: 45, eye: 45, velocity: 20, control: 20, breaking: 20, stamina: 20, guts: 20 },
    potential: 80, band: { low: 75, high: 85 }, salary: 60, years: 4,
    level: 'farm', injuredSeasons: 0, homegrown: true, teamId: 'lions',
  };
  const majorProspect: Player = {
    id: 'p_maj', name: '一軍新秀', position: 'OF', age: 20,
    attrs: { contact: 45, power: 45, speed: 45, fielding: 45, eye: 45, velocity: 20, control: 20, breaking: 20, stamina: 20, guts: 20 },
    potential: 80, band: { low: 75, high: 85 }, salary: 60, years: 4,
    level: 'major', injuredSeasons: 0, homegrown: true, teamId: 'lions',
  };
  agePlayer(farmProspect, () => 0.5, 1.8);
  agePlayer(majorProspect, () => 0.5, 1.0);
  assert.ok(
    ability(farmProspect) > ability(majorProspect),
    'farm level development boost must outpace major league development for prospects',
  );
}

/**
 * Salary cap elasticity, luxury tax calculations,
 * and fan enthusiasm vs ticket pricing models.
 */
function expectSalaryCapLuxuryTaxAndFanPricingModels(): void {
  // 1. Salary cap elasticity and luxury tax math.
  assert.equal(SALARY_CAP, 18000, 'soft salary cap is 18,000 萬 (1.8 億)');
  assert.equal(LUXURY_RATE, 0.5, 'luxury tax rate is 50% on overage');
  assert.equal(BANKRUPTCY, -5000, 'bankruptcy threshold is -5,000 萬');

  const buildTeamWithPayroll = (pay: number): Team => {
    const players: Player[] = [];
    const salaryPerPlayer = Math.round(pay / 26);
    for (let i = 0; i < 26; i++) {
      players.push({
        id: `sal_${i}`, name: `球員${i}`, position: i < 11 ? 'P' : 'OF', age: 27,
        attrs: { contact: 55, power: 55, speed: 55, fielding: 55, eye: 55, velocity: 55, control: 55, breaking: 55, stamina: 55, guts: 55 },
        potential: 60, band: { low: 55, high: 65 }, salary: salaryPerPlayer, years: 2,
        level: 'major', injuredSeasons: 0, homegrown: false, teamId: 'angels',
      });
    }
    return {
      id: 'angels', name: '桃園天使', aiMode: 'balanced', wins: 60, losses: 60, players,
    };
  };

  const state = createGame({ seedCode: 'fin00001', gmName: '測試', teamId: 'angels' });
  state.finance.ticketPrice = 350;

  // Below cap: 16,000 萬 payroll incurs 0 luxury tax.
  const teamUnder = buildTeamWithPayroll(16000);
  const ledgerUnder = settle({
    state, team: teamUnder, wins: 60, madePlayoffs: false, wonTitle: false, boardBonus: 0,
  });
  assert.equal(ledgerUnder.luxuryTax, 0, 'payroll below cap must owe 0 luxury tax');

  // Exactly at cap: 18,000 萬 incurs 0 luxury tax.
  const teamAtCap = buildTeamWithPayroll(18000);
  const ledgerAtCap = settle({
    state, team: teamAtCap, wins: 60, madePlayoffs: false, wonTitle: false, boardBonus: 0,
  });
  assert.equal(ledgerAtCap.luxuryTax, 0, 'payroll exactly at cap must owe 0 luxury tax');

  // Above cap: 22,000 萬 payroll => over 4,000 萬 => 2,000 萬 luxury tax.
  const teamOver = buildTeamWithPayroll(22000);
  const ledgerOver = settle({
    state, team: teamOver, wins: 60, madePlayoffs: false, wonTitle: false, boardBonus: 0,
  });
  const expectedOver = Math.round((payroll(teamOver) - SALARY_CAP) * LUXURY_RATE);
  assert.equal(ledgerOver.luxuryTax, expectedOver);
  assert.ok(ledgerOver.luxuryTax >= 1900 && ledgerOver.luxuryTax <= 2100);

  // Marginal tax elasticity: each extra 1,000 萬 payroll adds 500 萬 luxury tax.
  const teamOver2 = buildTeamWithPayroll(23000);
  const ledgerOver2 = settle({
    state, team: teamOver2, wins: 60, madePlayoffs: false, wonTitle: false, boardBonus: 0,
  });
  const payrollDiff = payroll(teamOver2) - payroll(teamOver);
  const taxDiff = ledgerOver2.luxuryTax - ledgerOver.luxuryTax;
  assert.equal(taxDiff, Math.round(payrollDiff * 0.5), 'marginal luxury tax must scale at 50%');

  // Progressive luxury tax tier 2 (5,100 to 8,000 萬 over cap): 26,000 萬 payroll => over 8,000 萬.
  // 5,100 * 0.5 + 2,900 * 1.25 = 2,550 + 3,625 = 6,175 萬.
  const teamOverTier2 = buildTeamWithPayroll(26000);
  const ledgerTier2 = settle({
    state, team: teamOverTier2, wins: 60, madePlayoffs: false, wonTitle: false, boardBonus: 0,
  });
  assert.equal(ledgerTier2.luxuryTax, 6175, 'tier 2 luxury tax must scale progressively at 125%');

  // Progressive luxury tax tier 3 (over 8,000 萬 over cap): 28,000 萬 payroll => over 10,000 萬.
  // 6,175 + 2,000 * 2.0 = 10,175 萬 (with 28,002 payroll = 10,179).
  const teamOverTier3 = buildTeamWithPayroll(28000);
  const ledgerTier3 = settle({
    state, team: teamOverTier3, wins: 60, madePlayoffs: false, wonTitle: false, boardBonus: 0,
  });
  assert.equal(ledgerTier3.luxuryTax, 10179, 'tier 3 luxury tax must scale progressively at 200%');

  // 2. Attendance vs Price Elasticity.
  // Formula: priceElasticity = clamp(1.5 - price / 650, 0.35, 1.15).
  // At 200元 -> clamped to 1.15.
  assert.equal(priceElasticity(200), 1.15);
  // At 350元 -> 1.5 - 350/650 ~ 0.9615.
  assert.ok(Math.abs(priceElasticity(350) - (1.5 - 350 / 650)) < 1e-4);
  // At 650元 -> 1.5 - 650/650 = 0.5.
  assert.equal(priceElasticity(650), 0.5);
  // At 800元 -> clamped to 0.35.
  assert.equal(priceElasticity(800), 0.35);

  // Fan heat & attendance correlation:
  state.finance.ticketPrice = 350;
  state.heat = 80;
  const crowdHighHeat = attendance(state, 70);
  state.heat = 20;
  const crowdLowHeat = attendance(state, 70);
  assert.ok(
    crowdHighHeat > crowdLowHeat * 1.5,
    `high fan heat must drive much larger gate (${crowdHighHeat} vs ${crowdLowHeat})`,
  );

  // Minimum attendance floor is 800:
  state.heat = 0;
  state.finance.ticketPrice = 900;
  assert.equal(attendance(state, 0), 800, 'attendance must not breach 800 minimum gate floor');

  // 3. Fan enthusiasm evolution (nextHeat):
  // Price anger starts above 350: Math.floor((price - 350) / 50) * 2.
  const baseHeat = 50;
  const heatFairPrice = nextHeat(baseHeat, 60, 120, false, false, 350);
  const heatPricey = nextHeat(baseHeat, 60, 120, false, false, 450); // anger = 4
  const heatGouging = nextHeat(baseHeat, 60, 120, false, false, 600); // anger = 10
  assert.equal(heatFairPrice - heatPricey, 4, '450 ticket price must cost 4 heat in fan anger');
  assert.equal(heatFairPrice - heatGouging, 10, '600 ticket price must cost 10 heat in fan anger');

  // Title and playoff boosts:
  const heatTitle = nextHeat(baseHeat, 75, 120, true, true, 350);
  const heatRegular = nextHeat(baseHeat, 75, 120, false, false, 350);
  // Title gives +20, playoffs give +8 => total +28 heat advantage.
  assert.equal(heatTitle - heatRegular, 28, 'playoff berth and title must boost heat by 28 points');

  // Multi-season decay and floor of 12:
  let dyingHeat = 30;
  for (let yr = 0; yr < 20; yr++) {
    dyingHeat = nextHeat(dyingHeat, 30, 120, false, false, 600);
  }
  assert.equal(dyingHeat, 12, 'fan heat must never collapse below the die-hard floor of 12');

  let boomingHeat = 70;
  for (let yr = 0; yr < 10; yr++) {
    boomingHeat = nextHeat(boomingHeat, 90, 120, true, true, 350);
  }
  assert.equal(boomingHeat, 100, 'fan heat must be capped at 100');
}

/**
 * Player aging / degradation curves, injury risks,
 * and postseason win expectancy formulas.
 */
function expectPlayerAgingInjuriesAndPostseasonWinExpectancy(): void {
  // 1. Player aging and degradation curves.
  // Growth occurs up to age 29 towards potential ceiling.
  // Decline onset is 30: severity = (age - DECLINE_ONSET + 1) * 0.75.
  // At 30: severity = 0.75; at 35: severity = 4.5; at 40: severity = 8.25.
  const createTestPlayer = (age: number, ab: number, pot: number): Player => ({
    id: `p_age_${age}`, name: `球員_${age}`, position: 'P', age,
    attrs: { contact: 20, power: 20, speed: 20, fielding: 20, eye: 20, velocity: ab, control: ab, breaking: ab, stamina: ab, guts: ab },
    potential: pot, band: { low: pot - 5, high: pot + 5 }, salary: 500, years: 3,
    level: 'major', injuredSeasons: 0, homegrown: false, teamId: 'lions',
  });

  // Degradation acceleration: older players lose attributes strictly faster.
  const p30 = createTestPlayer(30, 75, 75);
  const p35 = createTestPlayer(35, 75, 75);
  const p40 = createTestPlayer(40, 75, 75);
  const fixedRng = () => 0.5; // neutral roll

  const pre30 = ability(p30);
  agePlayer(p30, fixedRng, 1.0);
  const drop30 = pre30 - ability(p30);

  const pre35 = ability(p35);
  agePlayer(p35, fixedRng, 1.0);
  const drop35 = pre35 - ability(p35);

  const pre40 = ability(p40);
  agePlayer(p40, fixedRng, 1.0);
  const drop40 = pre40 - ability(p40);

  assert.ok(drop35 > drop30 * 2.0, `drop at 35 (${drop35.toFixed(1)}) must outpace drop at 30 (${drop30.toFixed(1)})`);
  assert.ok(drop40 > drop35 * 1.3, `drop at 40 (${drop40.toFixed(1)}) must outpace drop at 35 (${drop35.toFixed(1)})`);

  // Full 18-year career trajectory of a 19yo prospect developed through farm:
  const starCareer: Player = {
    id: 'p_star_career', name: '王牌新星', position: 'P', age: 19,
    attrs: { contact: 20, power: 20, speed: 20, fielding: 20, eye: 20, velocity: 52, control: 52, breaking: 52, stamina: 52, guts: 52 },
    potential: 85, band: { low: 80, high: 90 }, salary: 60, years: 5,
    level: 'farm', injuredSeasons: 0, homegrown: true, teamId: 'lions',
  };
  let peakAbility = ability(starCareer);
  let peakAge = 19;
  for (let yr = 0; yr < 18; yr++) {
    // Promote to major league once established
    if (starCareer.age >= 23) starCareer.level = 'major';
    const curAb = ability(starCareer);
    if (curAb > peakAbility) {
      peakAbility = curAb;
      peakAge = starCareer.age;
    }
    agePlayer(starCareer, createRng(yr + 50), 1.8);
  }
  assert.ok(peakAge >= 25 && peakAge <= 29, `peak age ${peakAge} must fall in the prime window 25-29`);
  assert.ok(peakAbility >= 72, `star peak ability ${peakAbility.toFixed(1)} must reach star tier (>=70)`);
  assert.ok(ability(starCareer) < peakAbility - 18, 'veteran at age 37 must have degraded significantly from prime peak');

  // 2. Injury mechanics and impact on roster strength.
  const lionsState = createGame({ seedCode: 'inj00001', gmName: '測試', teamId: 'lions' });
  const lionsTeam = lionsState.teams.find((t) => t.id === 'lions')!;
  rebalance(lionsTeam);

  const initialMajors = available(lionsTeam);
  assert.equal(initialMajors.length, 26, 'healthy major roster has 26 players');

  // Find ace pitcher and simulate season-ending injury:
  const ace = initialMajors.find((p) => p.position === 'P' && ability(p) >= 65)!;
  assert.ok(ace, 'lions must have an ace pitcher');
  const healthyTeamStrength = teamStrength(lionsTeam);
  const healthyWinRate = winRate(healthyTeamStrength, 52);

  // Sidelined on injured list:
  ace.injuredSeasons = 1;
  const availableWhileInjured = available(lionsTeam);
  assert.equal(availableWhileInjured.length, 25, 'injured player excluded from available roster');
  assert.ok(!availableWhileInjured.some((p) => p.id === ace.id));

  const injuredTeamStrength = teamStrength(lionsTeam);
  const injuredWinRate = winRate(injuredTeamStrength, 52);

  assert.ok(
    injuredTeamStrength < healthyTeamStrength - 0.5,
    `losing ace must reduce team strength (healthy: ${healthyTeamStrength.toFixed(2)}, injured: ${injuredTeamStrength.toFixed(2)})`,
  );
  assert.ok(
    injuredWinRate < healthyWinRate,
    'injured ace must reduce regular season expected win rate',
  );

  // Offseason healing:
  agePlayer(ace, fixedRng, 1.0);
  assert.equal(ace.injuredSeasons, 0, 'injured player must recover after one offseason of aging');
  assert.equal(available(lionsTeam).length, 26, 'recovered player returns to available active roster');

  // 3. Postseason win expectancy formulas:
  // In season.ts: series odds are compressed towards .500:
  // rawA = winRate(teamStrength(a), average)
  // gameOdds = clamp(0.5 + (rawA - 0.5) * 0.55, 0.3, 0.7)
  const calcPostseasonGameOdds = (strA: number, avg: number): number => {
    const raw = winRate(strA, avg);
    return Math.min(0.7, Math.max(0.3, 0.5 + (raw - 0.5) * 0.55));
  };

  // Superior club with 0.70 regular season win rate:
  // Edge is +0.20 => compressed to +0.20 * 0.55 = +0.11 => game odds = 0.61.
  const strongOdds = calcPostseasonGameOdds(63, 52);
  const rawStrongWinRate = winRate(63, 52);
  assert.ok(strongOdds < rawStrongWinRate, 'postseason compression must dampen regular season edge');
  assert.ok(Math.abs((strongOdds - 0.5) - (rawStrongWinRate - 0.5) * 0.55) < 1e-4);

  // Short series underdog variance:
  // Simulate 600 postseason tournaments with fixed strong vs weak teams.
  const simTeams: Team[] = lionsState.teams.map((t, idx) => ({
    ...t,
    wins: 90 - idx * 10,
    losses: 30 + idx * 10,
  }));
  const postRng = createRng(777);
  let underdogCrowns = 0;
  const numTourneys = 600;
  for (let t = 0; t < numTourneys; t++) {
    const outcome = playPostseason(simTeams, 'lions', postRng);
    // simTeams[3] is the 4th seed (weakest playoff qualifier).
    if (outcome.champion === simTeams[3].id) {
      underdogCrowns += 1;
    }
  }
  const underdogRate = underdogCrowns / numTourneys;
  // Underdog must win sometimes (between 8% and 32%), confirming non-deterministic tournament upsets.
  assert.ok(
    underdogRate > 0.08 && underdogRate < 0.32,
    `underdog championship rate ${(underdogRate * 100).toFixed(1)}% outside realistic variance band [8%, 32%]`,
  );
}

function expectMultiContractTriage(): void {
  const state = createGame({ seedCode: 'triage_chk', gmName: '測試', teamId: 'dolphins' });
  const team = state.teams.find((t) => t.id === state.teamId)!;

  // Set all players to long-term contracts first so only our designated candidates expire
  for (const p of team.players) p.years = 3;

  // Designate 3 expiring major league players
  const majors = team.players.filter((p) => p.level === 'major');
  majors[0].years = 1;
  majors[1].years = 1;
  majors[2].years = 1;
  const sortedExpiring = [majors[0], majors[1], majors[2]].sort((a, b) => tradeValue(b) - tradeValue(a));
  const p1Id = sortedExpiring[0].id;
  const p2Id = sortedExpiring[1].id;
  const p3Id = sortedExpiring[2].id;

  state.phase = 'contracts';
  state.contractsTriagedCount = 0;
  state.contractsTriageTotal = 3;

  // Step 1: Decision for player 1 of 3
  const d1 = buildDecision(state);
  assert.equal(d1.phase, 'contracts');
  assert.ok(d1.title.includes('1/3'), 'first triage decision should indicate step 1 of 3');
  assert.ok(d1.options.some((o) => o.id === 'con-market'));
  assert.ok(d1.options.some((o) => o.id === 'con-lowball'));
  assert.ok(d1.options.some((o) => o.id === 'con-let-go'));

  // Settle player 1 with market renewal
  state.decision = d1;
  const s1 = resolve(state, 'con-market');
  assert.equal(s1.phase, 'contracts', 'phase should stay in contracts for multi-player triage');
  assert.equal(s1.contractsTriagedCount, 1);
  const team1 = s1.teams.find((t) => t.id === s1.teamId)!;
  const target1 = team1.players.find((p) => p.id === p1Id);
  assert.equal(target1?.years, 3, 'player 1 should be renewed for 3 years');

  // Step 2: Decision for player 2 of 3
  const d2 = buildDecision(s1);
  assert.equal(d2.phase, 'contracts');
  assert.ok(d2.title.includes('2/3'), 'second triage decision should indicate step 2 of 3');

  // Settle player 2 with release
  s1.decision = d2;
  const s2 = resolve(s1, 'con-let-go');
  assert.equal(s2.phase, 'contracts', 'phase should stay in contracts for third player');
  assert.equal(s2.contractsTriagedCount, 2);
  const team2 = s2.teams.find((t) => t.id === s2.teamId)!;
  const target2 = team2.players.find((p) => p.id === p2Id);
  assert.equal(target2, undefined, 'player 2 should be released from team');

  // Step 3: Decision for player 3 of 3
  const d3 = buildDecision(s2);
  assert.equal(d3.phase, 'contracts');
  assert.ok(d3.title.includes('3/3'), 'third triage decision should indicate step 3 of 3');

  // Settle player 3 with market renewal
  s2.decision = d3;
  const s3 = resolve(s2, 'con-market');
  const targetPhase = s3.phase === 'storyline' ? s3.resumePhase : s3.phase;
  assert.equal(targetPhase, 'budget', 'after top 3 key players are triaged, phase should advance to budget');
  assert.equal(s3.contractsTriagedCount, 0);
  assert.equal(s3.contractsTriageTotal, 0);
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
  ['challenge defs are sound', expectChallengeDefsAreSound],
  ['challenge unlock math', expectChallengeUnlockMath],
  ['challenge seeds are clearable', expectChallengeSeedsAreClearable],
  ['records accumulate by club', expectRecordsAccumulateByClub],
  ['archive backfills club best', expectArchiveBackfillsClubBest],
  ['highlights are deterministic', expectHighlightsAreDeterministic],
  ['storylines have costs and triggers', expectStorylinesHaveCostsAndTriggers],
  ['life bridge is defensive', expectLifeBridgeIsDefensive],
  ['storylines do not stall tenure', expectStorylinesDoNotStallTenure],
  ['tenure expectations and crisis resolution', expectBoardExpectationsNegotiationAndCrisisResolution],
  ['scouting accuracy and fog-of-war estimation', expectScoutingAccuracyFogOfWarAndDevelopmentCeilings],
  ['salary cap elasticity and fan pricing', expectSalaryCapLuxuryTaxAndFanPricingModels],
  ['multi-player contract triage', expectMultiContractTriage],
  ['player aging, injuries and postseason formulas', expectPlayerAgingInjuriesAndPostseasonWinExpectancy],
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
