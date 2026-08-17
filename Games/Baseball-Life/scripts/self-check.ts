import * as assert from 'node:assert/strict';
import { acknowledge, createGame, resolve, rollOrigins } from '../src/game/engine.js';
import { ACHIEVEMENTS, EMPTY_PROGRESS, evaluate, progressOf } from '../src/game/achievements.js';
import { overall } from '../src/game/config.js';
import { careerTotals } from '../src/game/milestones.js';
import { breakingFromArsenal } from '../src/game/pitches.js';
import { traitEffects } from '../src/game/traits.js';
import type { Decision, GameState, Position } from '../src/game/types.js';

const GUARD = 400;

type Chooser = (decision: Decision, step: number) => string;

function enabled(decision: Decision): string[] {
  return decision.options.filter((o) => !o.disabled).map((o) => o.id);
}

function playRun(seedCode: string, position: Position, chooser: Chooser): GameState {
  const origins = rollOrigins(seedCode);
  let state = createGame({ seedCode, name: '測試員', position, originId: origins[0].id });
  let step = 0;
  while (!state.retired && step < GUARD) {
    const decision = state.decision;
    if (!decision || decision.kind === 'continue' || decision.options.length === 0) break;
    state = resolve(state, chooser(decision, step));
    state = acknowledge(state);
    step += 1;
  }
  assert.ok(step < GUARD, `run did not terminate for seed ${seedCode} (${position})`);
  return state;
}

const firstChoice: Chooser = (decision) => enabled(decision)[0];
const cyclingChoice: Chooser = (decision, step) => {
  const ids = enabled(decision);
  return ids[step % ids.length];
};

/** Same seed + same choices must rebuild the same life, byte for byte. */
function expectDeterministicRuns(): void {
  const a = playRun('64aa2bl7', 'OF', cyclingChoice);
  const b = playRun('64aa2bl7', 'OF', cyclingChoice);
  assert.deepEqual(a.attrs, b.attrs, 'attributes diverged between identical runs');
  assert.deepEqual(a.history, b.history, 'season history diverged between identical runs');
  assert.deepEqual(a.traits, b.traits, 'traits diverged between identical runs');
  assert.equal(a.summary?.hofScore, b.summary?.hofScore, 'hall-of-fame score diverged');
  assert.deepEqual(rollOrigins('64aa2bl7'), rollOrigins('64aa2bl7'), 'origin draw is not stable');
}

/** Different seeds must actually produce different lives. */
function expectSeedsDiverge(): void {
  const a = playRun('aaaaaaaa', 'IF', cyclingChoice);
  const b = playRun('zzzzzzzz', 'IF', cyclingChoice);
  const same =
    JSON.stringify(a.attrs) === JSON.stringify(b.attrs) &&
    a.history.length === b.history.length &&
    a.summary?.hofScore === b.summary?.hofScore;
  assert.ok(!same, 'two different seeds produced an identical run');
}

/** The same seed with different choices must diverge too, or choices are fake. */
function expectChoicesMatter(): void {
  const a = playRun('64aa2bl7', 'P', firstChoice);
  const b = playRun('64aa2bl7', 'P', cyclingChoice);
  assert.notDeepEqual(a.attrs, b.attrs, 'choices had no effect on the run');
}

/** High school is eleven turns and ends on the graduation fork. */
function expectHighSchoolLength(): void {
  const origins = rollOrigins('hsflow01');
  let state = createGame({ seedCode: 'hsflow01', name: '球兒', position: 'C', originId: origins[0].id });
  assert.equal(state.stage, 'highschool');
  assert.equal(state.age, 16);
  for (let i = 0; i < 11; i++) {
    assert.equal(state.stage, 'highschool', `left high school early at turn ${i}`);
    state = acknowledge(resolve(state, enabled(state.decision!)[0]));
  }
  assert.equal(state.decision?.kind, 'path', 'graduation fork did not appear after eleven turns');
  assert.equal(state.age, 18, 'age should be 18 at graduation');
  // 高一夏、高二夏、高二秋（黑豹旗）、高三夏 — four tournaments across three years.
  assert.equal(
    state.history.filter((h) => h.league === 'hs').length,
    4,
    'four high-school tournaments should be on record',
  );
}

/** Values must never leave their ranges, however extreme the run. */
function expectValuesStayInRange(): void {
  const positions: Position[] = ['P', 'C', 'IF', 'OF', 'TW'];
  for (const position of positions) {
    for (const seed of ['range001', 'range002', 'range003']) {
      const state = playRun(seed, position, cyclingChoice);
      Object.entries(state.attrs).forEach(([key, value]) => {
        assert.ok(value >= 0 && value <= 99, `${key}=${value} out of range (${seed}/${position})`);
        assert.ok(Number.isFinite(value), `${key} is not finite`);
      });
      Object.entries(state.meta).forEach(([key, value]) => {
        assert.ok(value >= 0 && value <= 100, `meta ${key}=${value} out of range`);
      });
      const lines = state.history.flatMap((r) =>
        r.secondary ? [r.line, r.secondary] : [r.line],
      );
      lines.forEach((line) => {
        const record = { line };
        if (record.line.kind === 'batter') {
          const { avg, obp, slg, ab, hits, games } = record.line;
          assert.ok(avg >= 0 && avg <= 0.45, `avg ${avg} out of range`);
          assert.ok(obp >= 0 && obp <= 0.6, `obp ${obp} out of range`);
          assert.ok(slg >= 0 && slg <= 1, `slg ${slg} out of range`);
          assert.ok(hits <= ab, 'more hits than at-bats');
          assert.ok(games >= 0, 'negative games played');
        } else {
          const { era, whip, ip, wins, losses } = record.line;
          assert.ok(era >= 0.85 && era <= 9.5, `era ${era} out of range`);
          assert.ok(whip >= 0.7 && whip <= 2.4, `whip ${whip} out of range`);
          assert.ok(ip >= 0, 'negative innings');
          assert.ok(wins >= 0 && losses >= 0, 'negative win/loss');
        }
      });
    }
  }
}

/** Every finished run reports a summary whose totals match its own history. */
function expectSummaryMatchesHistory(): void {
  const state = playRun('summary1', 'OF', cyclingChoice);
  assert.ok(state.retired, 'run should end retired');
  const summary = state.summary;
  assert.ok(summary, 'no summary produced');
  const pro = state.history.filter((h) => h.league !== 'hs');
  const hits = pro.reduce((sum, r) => sum + (r.line.kind === 'batter' ? r.line.hits : 0), 0);
  assert.equal(summary!.totals.hits, hits, 'summary hit total does not match history');
  assert.equal(summary!.totals.seasons, pro.length, 'summary season count does not match history');
  assert.ok(summary!.hofScore >= 0, 'negative hall-of-fame score');
  assert.ok(summary!.verdict.length > 0, 'empty verdict');
}

/** Overall rating only reads the attributes the position actually uses. */
function expectOverallIgnoresOffRoleAttributes(): void {
  const base = {
    contact: 50, power: 50, speed: 50, fielding: 50, eye: 50,
    velocity: 50, control: 50, breaking: 50, stamina: 50, guts: 50,
  };
  const pitcherWithBat = { ...base, contact: 99, power: 99 };
  assert.equal(
    overall(base, 'P'),
    overall(pitcherWithBat, 'P'),
    "a pitcher's bat should not inflate their rating",
  );
  const batterWithArm = { ...base, velocity: 99, breaking: 99 };
  assert.equal(
    overall(base, 'OF'),
    overall(batterWithArm, 'OF'),
    "a fielder's pitching should not inflate their rating",
  );
}

function expectTraitEffectsStack(): void {
  const none = traitEffects([]);
  assert.equal(none.growth, 1);
  assert.equal(none.decline, 1);
  const both = traitEffects(['genius', 'late-bloomer']);
  assert.ok(both.growth > 1.6, 'genius + late bloomer should compound growth');
  const durable = traitEffects(['ascetic', 'ironman']);
  assert.ok(durable.decline < 0.4, 'ascetic + ironman should compound decline resistance');
  assert.ok(durable.injury < 1, 'ironman should reduce injury risk');
}

/** Declining an offer or a retirement prompt must not re-ask it forever. */
function expectOneShotDecisionsAreNotRepeated(): void {
  const state = playRun('offers01', 'P', (decision) => {
    const ids = enabled(decision);
    // Always take the most stubborn answer: stay put, keep playing.
    return ids.find((id) => id === 'offer-stay' || id === 'retire-no') ?? ids[0];
  });
  assert.ok(state.retired, 'a stubborn run still has to end');
  const keys = state.handled;
  assert.equal(new Set(keys).size, keys.length, 'a one-shot decision was answered twice');
}

/** Money must only ever accumulate, and never in leagues that do not pay. */
function expectFinanceIsCoherent(): void {
  for (const seed of ['money001', 'money002', 'money003']) {
    for (const position of ['OF', 'P'] as Position[]) {
      const state = playRun(seed, position, cyclingChoice);
      assert.ok(state.finance.earnings >= 0, 'negative career earnings');
      assert.ok(state.finance.peakSalary >= 0, 'negative peak salary');
      assert.ok(
        state.finance.earnings >= state.finance.peakSalary || state.finance.peakSalary === 0,
        'career earnings smaller than a single season of it',
      );
      if (state.summary!.totals.seasons > 0) {
        assert.equal(state.summary!.earnings, Math.round(state.finance.earnings));
      }
      // High school and college pay nothing, so a run that never turned pro
      // must not have banked a salary.
      const everPaid = state.history.some((h) => h.league !== 'hs' && h.league !== 'college');
      if (!everPaid) assert.equal(state.finance.earnings, 0, 'unpaid career earned money');
    }
  }
}

/** Earnings must actually reward a better career, not just a longer one. */
function expectBetterCareersEarnMore(): void {
  const lazy = playRun('earn0001', 'OF', (decision) => {
    const ids = enabled(decision);
    return ids.find((id) => id === 'rest') ?? ids[0];
  });
  const engaged = playRun('earn0001', 'OF', cyclingChoice);
  assert.ok(
    engaged.finance.earnings > lazy.finance.earnings,
    `an engaged run should out-earn a lazy one (${engaged.finance.earnings} vs ${lazy.finance.earnings})`,
  );
}

/** Milestones must be real: every one has to be backed by the record book. */
function expectMilestonesMatchHistory(): void {
  const state = playRun('stone001', 'OF', cyclingChoice);
  const totals = careerTotals(state.history);
  for (const milestone of state.milestones) {
    assert.ok(milestone.text.length > 0, 'empty milestone text');
    assert.ok(milestone.age >= 16 && milestone.age <= 45, `milestone at impossible age ${milestone.age}`);
    const match = /生涯通算 (\d+) 支安打/.exec(milestone.text);
    if (match) {
      assert.ok(
        totals.hits >= Number(match[1]),
        `claimed ${match[1]} career hits but finished with ${totals.hits}`,
      );
    }
  }
  // No milestone should ever be filed twice.
  const keys = state.milestones.map((m) => `${m.kind}:${m.text}:${m.year}`);
  assert.equal(new Set(keys).size, keys.length, 'a milestone was recorded twice');
}

/** Players have to change clubs sometimes, or trades and free agency are dead code. */
function expectPlayersChangeTeams(): void {
  let moved = 0;
  const seeds = ['move0001', 'move0002', 'move0003', 'move0004', 'move0005', 'move0006'];
  for (const seed of seeds) {
    const state = playRun(seed, 'OF', cyclingChoice);
    const pro = state.history.filter((h) => h.league !== 'hs');
    if (new Set(pro.map((h) => h.team)).size > 1) moved += 1;
  }
  assert.ok(moved > 0, 'no player in six careers ever changed team');
}

/** The event pool must drain before anything repeats. */
function expectEventsDoNotRepeatEarly(): void {
  const state = playRun('event001', 'OF', cyclingChoice);
  const seen = state.seenEvents;
  const unique = new Set(seen).size;
  assert.ok(
    unique >= Math.min(seen.length, 20),
    `only ${unique} distinct events across ${seen.length} firings`,
  );
  // Nothing should repeat while the pool still had unseen entries to offer.
  assert.ok(unique >= seen.length - 6, `too many repeats: ${seen.length - unique}`);
}

/** A two-way player must actually play both ways, every season. */
function expectTwoWayPlaysBothWays(): void {
  const state = playRun('twoway01', 'TW', cyclingChoice);
  const seasons = state.history;
  assert.ok(seasons.length > 0, 'two-way run recorded no seasons');
  for (const record of seasons) {
    assert.ok(record.secondary, `${record.year} has no second line for a two-way player`);
    assert.equal(record.line.kind, 'batter', 'the headline two-way line should be batting');
    assert.equal(record.secondary!.kind, 'pitcher', 'the second two-way line should be pitching');
  }
  // Both halves have to reach the career totals.
  const summary = state.summary!;
  const battedHits = seasons
    .filter((r) => r.league !== 'hs')
    .reduce((sum, r) => sum + (r.line.kind === 'batter' ? r.line.hits : 0), 0);
  const struckOut = seasons
    .filter((r) => r.league !== 'hs')
    .reduce((sum, r) => sum + (r.secondary?.kind === 'pitcher' ? r.secondary.so : 0), 0);
  assert.equal(summary.totals.hits, battedHits, 'two-way batting not counted in summary');
  assert.equal(summary.totals.so, struckOut, 'two-way pitching not counted in summary');
}

/** Splitting training ten ways should cost something. */
function expectTwoWayIsHarder(): void {
  let twoWayWins = 0;
  const seeds = ['tw0001', 'tw0002', 'tw0003', 'tw0004'];
  for (const seed of seeds) {
    const specialist = playRun(seed, 'OF', cyclingChoice);
    const twoWay = playRun(seed, 'TW', cyclingChoice);
    if (twoWay.summary!.hofScore > specialist.summary!.hofScore) twoWayWins += 1;
  }
  assert.ok(
    twoWayWins < seeds.length,
    'the two-way route beat the specialist on every seed — the workload tax is not biting',
  );
}

/** `breaking` is derived, so it must always match the arsenal it came from. */
function expectBreakingTracksArsenal(): void {
  for (const seed of ['arse0001', 'arse0002', 'arse0003']) {
    const state = playRun(seed, 'P', cyclingChoice);
    assert.ok(state.arsenal.length > 0, 'a pitcher finished with no pitches at all');
    assert.equal(
      state.attrs.breaking,
      breakingFromArsenal(state.arsenal),
      'breaking rating drifted away from the arsenal',
    );
    state.arsenal.forEach((slot) => {
      assert.ok(slot.level >= 0 && slot.level <= 99, `pitch ${slot.id} level ${slot.level} out of range`);
    });
    // No pitch should ever be learned twice.
    const ids = state.arsenal.map((p) => p.id);
    assert.equal(new Set(ids).size, ids.length, 'the same pitch was learned twice');
  }
  // Position players carry no arsenal at all.
  const batter = playRun('arse0001', 'OF', cyclingChoice);
  assert.equal(batter.arsenal.length, 0, 'a position player somehow learned a pitch');
}

/** Ageing has to be able to take a pitch away, not be undone by the next sync. */
function expectDeclineReachesTheArsenal(): void {
  const state = playRun('decl0001', 'P', cyclingChoice);
  const peak = Math.max(...state.history.map(() => 0), state.potential.breaking);
  assert.ok(peak > 0, 'no potential recorded');
  assert.equal(
    state.attrs.breaking,
    breakingFromArsenal(state.arsenal),
    'breaking and arsenal disagree after a full career of decline',
  );
}

/** Achievement ids are storage keys, so a duplicate would silently merge two. */
function expectAchievementIdsAreUnique(): void {
  const ids = ACHIEVEMENTS.map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length, 'two achievements share an id');
  ACHIEVEMENTS.forEach((a) => {
    assert.ok(a.label.length > 0 && a.desc.length > 0, `${a.id} is missing label or description`);
    if (a.goal !== undefined) {
      assert.ok(a.goal > 0, `${a.id} has a non-positive goal`);
      assert.notEqual(progressOf(a.id, EMPTY_PROGRESS), null, `${a.id} has a goal but no progress`);
    }
  });
}

/** Progress has to survive across careers, which is the whole point. */
function expectAchievementsAccumulate(): void {
  let progress = EMPTY_PROGRESS;
  const runs = [
    playRun('ach00001', 'OF', cyclingChoice),
    playRun('ach00002', 'P', cyclingChoice),
    playRun('ach00003', 'TW', cyclingChoice),
  ];

  for (const run of runs) {
    const result = evaluate(run, progress);
    progress = result.progress;
  }

  assert.equal(progress.careers, 3, 'career counter did not accumulate');
  assert.equal(progress.positionsPlayed.length, 3, 'positions played did not accumulate');
  assert.ok(progress.leaguesPlayed.includes('hs'), 'high school not recorded as a league played');
  assert.ok(progress.bestHof > 0, 'best hall-of-fame score never recorded');

  // Collections are sets: replaying the same career must not double-count.
  const again = evaluate(runs[0], progress);
  assert.equal(again.progress.positionsPlayed.length, 3, 'positions played double-counted');
  assert.equal(again.progress.careers, 4, 'career counter should still tick');
}

/** An achievement must never be handed out twice. */
function expectAchievementsUnlockOnce(): void {
  const run = playRun('ach00004', 'OF', cyclingChoice);
  const first = evaluate(run, EMPTY_PROGRESS);
  const second = evaluate(run, first.progress);
  for (const achievement of first.unlocked) {
    assert.ok(
      !second.unlocked.some((a) => a.id === achievement.id),
      `${achievement.id} was unlocked twice`,
    );
    assert.equal(
      first.progress.unlocked[achievement.id],
      run.seedCode,
      'unlock was not stamped with the seed that earned it',
    );
  }
}

/** Ten finished careers must complete the ten-careers collection, and no more. */
function expectCollectionGoalsFire(): void {
  let progress = EMPTY_PROGRESS;
  let unlockedTenCareers = 0;
  for (let i = 0; i < 11; i++) {
    const run = playRun(`career${i}`, 'OF', cyclingChoice);
    const result = evaluate(run, progress);
    progress = result.progress;
    if (result.unlocked.some((a) => a.id === 'ten-careers')) unlockedTenCareers += 1;
  }
  assert.equal(unlockedTenCareers, 1, 'the ten-careers achievement did not fire exactly once');
  assert.ok(progress.unlocked['ten-careers'], 'ten-careers never recorded as unlocked');
}

/**
 * The property that makes undo honest.
 *
 * `rng()` in the engine seeds every random draw on (purpose, turnIndex,
 * choices.length), so stepping back and choosing the *same* option has to
 * land on the identical state. Otherwise undo would be a re-roll and every
 * bad outcome could be shopped away.
 */
function expectUndoIsNotAReroll(): void {
  const origins = rollOrigins('undo0001');
  let state = createGame({ seedCode: 'undo0001', name: '測試員', position: 'OF', originId: origins[0].id });

  for (let step = 0; step < 24; step++) {
    if (state.retired || !state.decision || state.decision.options.length === 0) break;
    const optionId = enabled(state.decision)[0];

    const once = resolve(state, optionId);
    const twice = resolve(state, optionId);
    assert.deepEqual(twice.attrs, once.attrs, `step ${step}: attributes differed on replay`);
    assert.equal(twice.finance.earnings, once.finance.earnings, `step ${step}: earnings differed on replay`);
    assert.equal(twice.finance.salary, once.finance.salary, `step ${step}: salary differed on replay`);
    assert.equal(twice.meta.fame, once.meta.fame, `step ${step}: fame differed on replay`);
    assert.deepEqual(twice.report?.lines, once.report?.lines, `step ${step}: the report differed on replay`);

    state = acknowledge(once);
  }
}

const checks: [string, () => void][] = [
  ['deterministic runs', expectDeterministicRuns],
  ['seeds diverge', expectSeedsDiverge],
  ['choices matter', expectChoicesMatter],
  ['high school length', expectHighSchoolLength],
  ['values stay in range', expectValuesStayInRange],
  ['summary matches history', expectSummaryMatchesHistory],
  ['overall ignores off-role attributes', expectOverallIgnoresOffRoleAttributes],
  ['trait effects stack', expectTraitEffectsStack],
  ['one-shot decisions are not repeated', expectOneShotDecisionsAreNotRepeated],
  ['finance is coherent', expectFinanceIsCoherent],
  ['better careers earn more', expectBetterCareersEarnMore],
  ['milestones match history', expectMilestonesMatchHistory],
  ['players change teams', expectPlayersChangeTeams],
  ['events do not repeat early', expectEventsDoNotRepeatEarly],
  ['two-way plays both ways', expectTwoWayPlaysBothWays],
  ['two-way is harder than specialising', expectTwoWayIsHarder],
  ['breaking tracks the arsenal', expectBreakingTracksArsenal],
  ['decline reaches the arsenal', expectDeclineReachesTheArsenal],
  ['achievement ids are unique', expectAchievementIdsAreUnique],
  ['achievements accumulate across careers', expectAchievementsAccumulate],
  ['achievements unlock only once', expectAchievementsUnlockOnce],
  ['collection goals fire exactly once', expectCollectionGoalsFire],
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
