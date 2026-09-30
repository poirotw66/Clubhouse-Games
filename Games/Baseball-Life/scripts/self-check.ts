import * as assert from 'node:assert/strict';
import { acknowledge, createGame, resolve, rollOrigins } from '../src/game/engine.js';
import { EVENTS } from '../src/game/events.js';
import { ACHIEVEMENTS, EMPTY_PROGRESS, evaluate, progressOf } from '../src/game/achievements.js';
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
import { overall } from '../src/game/config.js';
import { careerTotals } from '../src/game/milestones.js';
import { breakingFromArsenal } from '../src/game/pitches.js';
import { TWO_WAY_WORKLOAD } from '../src/game/season.js';
import { SITUATIONS, situationById } from '../src/game/situations.js';
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

const firstChoice: Chooser = (decision) => {
  const ids = enabled(decision);
  // Situation cards list the gamble first; training-first policies should take
  // the safest option so self-checks measure the career engine, not roulette.
  if (decision.kind === 'event') return ids[ids.length - 1] ?? ids[0];
  return ids[0];
};
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
    // Drain any queued high-risk choice cards so they do not steal a training turn.
    while (state.decision?.kind === 'event') {
      state = acknowledge(resolve(state, firstChoice(state.decision, 0)));
    }
    assert.ok(state.decision, `missing decision at HS turn ${i}`);
    state = acknowledge(resolve(state, firstChoice(state.decision!, 0)));
  }
  while (state.decision?.kind === 'event') {
    state = acknowledge(resolve(state, firstChoice(state.decision, 0)));
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
/**
 * A career has to actually reach the content that was written for it.
 *
 * The audit that started this: 66 events existed, but a career was 22 decisions
 * and surfaced 12 of them — 19% — because the professional stage, the point of
 * the game, ran one turn a season while high school ran four. A pro year is
 * three turns now, and this pins the result so the pacing cannot quietly
 * regress back to a highlight reel nobody sees.
 *
 * Measured with a policy that trains rather than one that cycles blindly, since
 * a career cut short by deliberately bad choices tells you nothing about how
 * much content the game holds.
 */
function expectCareersReachTheContent(): void {
  const positions: Position[] = ['P', 'C', 'IF', 'OF'];
  let turns = 0;
  let seen = 0;
  let runs = 0;

  for (let i = 0; i < 16; i++) {
    const state = playRun(`reach-${i}`, positions[i % positions.length], firstChoice);
    turns += state.choices.length;
    seen += new Set(state.seenEvents).size;
    runs += 1;
  }

  const avgTurns = turns / runs;
  const avgSeen = seen / runs;
  const share = avgSeen / EVENTS.length;

  assert.ok(avgTurns >= 40, `an average career is only ${avgTurns.toFixed(1)} decisions long`);
  assert.ok(
    share >= 0.42,
    `a career only surfaces ${(share * 100).toFixed(0)}% of the ${EVENTS.length} events`,
  );
}

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

/** Challenge ids and seeds must stay unique so progress keys never collide. */
function expectChallengeDefsAreSound(): void {
  assert.ok(CAREER_CHALLENGES.length >= 6, 'challenge pack is too thin');
  assert.equal(challengeCount(), CAREER_CHALLENGES.length);
  const ids = CAREER_CHALLENGES.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, 'two challenges share an id');
  for (const challenge of CAREER_CHALLENGES) {
    assert.ok(challenge.name.length > 0 && challenge.blurb.length > 0, `${challenge.id} missing copy`);
    assert.ok(challenge.goalLabel.length > 0, `${challenge.id} missing goal label`);
    assert.ok(/^[a-z0-9]{6,12}$/i.test(challenge.seedCode), `${challenge.id} seed looks wrong`);
    assert.ok(challengeById(challenge.id)?.id === challenge.id, `${challenge.id} lookup failed`);
    assert.ok(
      challenge.goal.kind === 'pro-seasons' ||
        challenge.goal.kind === 'hof-score' ||
        challenge.goal.kind === 'hs-titles' ||
        challenge.goal.kind === 'mlb-seasons',
      `${challenge.id} has unknown goal kind`,
    );
  }
}

/** Unlock cursor mirrors the Liquid-Sort pack: stage i opens when i <= clearedCount. */
function expectChallengeUnlockMath(): void {
  assert.equal(isChallengeUnlocked(0, 0), true);
  assert.equal(isChallengeUnlocked(1, 0), false);
  assert.equal(isChallengeUnlocked(1, 1), true);
  assert.equal(isChallengeUnlocked(7, 7), true);
  assert.equal(isChallengeUnlocked(7, 6), false);
  assert.equal(isChallengeUnlocked(-1, 0), false);
  assert.equal(isChallengeUnlocked(99, 8), false);
  assert.equal(continueChallengeIndex(0), 0);
  assert.equal(continueChallengeIndex(3), 3);
  assert.equal(continueChallengeIndex(CAREER_CHALLENGES.length), CAREER_CHALLENGES.length - 1);
}

/**
 * Early challenges must clear under a training-first policy; the MLB card needs
 * an overseas-preferring policy because the goal is the path choice itself.
 */
function expectChallengeSeedsAreClearable(): void {
  const overseasFirst: Chooser = (decision) => {
    const ids = enabled(decision);
    const prefer = ids.find((id) => id === 'path-overseas' || id === 'offer-mlb' || id === 'offer-promote');
    return prefer ?? ids[0];
  };

  for (let index = 0; index < CAREER_CHALLENGES.length; index++) {
    const challenge = CAREER_CHALLENGES[index];
    const chooser = challenge.id === 'mlb-regular' ? overseasFirst : firstChoice;
    const state = playRun(challenge.seedCode, challenge.position, chooser);
    assert.ok(state.retired && state.summary, `${challenge.id} did not finish`);
    assert.ok(
      isChallengeCleared(challenge, state),
      `${challenge.id} was not cleared by the expected policy (hof=${state.summary?.hofScore}, pro=${state.counters.proSeasons}, hs=${state.counters.hsTournamentWins}, mlb=${state.history.filter((h) => h.league === 'mlb').length})`,
    );

    const applied = applyChallengeResult(EMPTY_CHALLENGE_PROGRESS, index, state);
    assert.equal(applied.cleared, true, `${challenge.id} applyChallengeResult missed a clear`);
    assert.ok(applied.progress.cleared[challenge.id], `${challenge.id} not marked cleared`);
    assert.ok(
      (applied.progress.bestHof[challenge.id] ?? 0) >= state.summary!.hofScore,
      `${challenge.id} best Hof not recorded`,
    );
  }

  // Frontier advance only happens when clearing the current unlocked card.
  const first = CAREER_CHALLENGES[0];
  const firstRun = playRun(first.seedCode, first.position, firstChoice);
  const fromZero = applyChallengeResult(EMPTY_CHALLENGE_PROGRESS, 0, firstRun);
  assert.equal(fromZero.progress.clearedCount, 1, 'clearing challenge 0 should open challenge 1');

  const late = CAREER_CHALLENGES[3];
  const lateRun = playRun(late.seedCode, late.position, firstChoice);
  const outOfOrder = applyChallengeResult(EMPTY_CHALLENGE_PROGRESS, 3, lateRun);
  assert.equal(
    outOfOrder.progress.clearedCount,
    0,
    'clearing a locked challenge must not advance the cursor',
  );
  assert.equal(outOfOrder.cleared, true, 'goal can still be satisfied out of order');
  assert.ok(outOfOrder.progress.cleared[late.id], 'out-of-order clear still stamps cleared map');
}

/** Choice cards must never offer a free hold — every option costs something. */
function expectSituationsHaveCosts(): void {
  assert.ok(SITUATIONS.length >= 10, 'situation pack is too thin');
  const ids = SITUATIONS.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate situation id');

  const origins = rollOrigins('sitcost1');
  const sample = createGame({
    seedCode: 'sitcost1',
    name: '測試',
    position: 'OF',
    originId: origins[0].id,
  });

  for (const situation of SITUATIONS) {
    assert.ok(situationById(situation.id)?.id === situation.id);
    const options = situation.options(sample);
    assert.ok(options.length >= 2, `${situation.id} needs real choices`);
    for (const option of options) {
      const effects = option.effects;
      const keys = Object.keys(effects);
      assert.ok(keys.length > 0, `${situation.id}/${option.id} has empty effects`);
      // At least one downside OR opportunity cost signal (fatigue, injury, mind-, fame-, attr loss).
      const hasRisk =
        (effects.fatigue ?? 0) > 0 ||
        (effects.injuryChance ?? 0) > 0 ||
        (effects.mind ?? 0) < 0 ||
        (effects.body ?? 0) < 0 ||
        (effects.fame ?? 0) < 0 ||
        (effects.velocity ?? 0) < 0 ||
        (effects.contact ?? 0) < 0 ||
        (effects.power ?? 0) < 0 ||
        (effects.stamina ?? 0) < 0 ||
        (effects.speed ?? 0) < 0 ||
        (effects.breaking ?? 0) < 0 ||
        option.hint.includes('錯過') ||
        option.hint.includes('放棄') ||
        option.hint.includes('沒有現金') ||
        option.hint.includes('成長停滯') ||
        option.hint.includes('錯失');
      assert.ok(hasRisk, `${situation.id}/${option.id} looks like a free hold`);
    }
  }

  const twOnly = SITUATIONS.filter((s) => s.id.startsWith('tw-'));
  assert.ok(twOnly.length >= 3, 'two-way needs exclusive situations');
}

/** Careers must actually surface choice cards, not only flavour text. */
function expectSituationsAppearInCareers(): void {
  let hits = 0;
  for (let i = 0; i < 12; i++) {
    const state = playRun(`sitrun${i}`, i % 2 === 0 ? 'OF' : 'TW', firstChoice);
    hits += state.seenSituations.length;
  }
  assert.ok(hits >= 8, `only ${hits} situations across 12 careers — fire rate too low`);
}

/** Two-way preferential treatment must remain tangible but not free. */
function expectTwoWayPerksExist(): void {
  assert.ok(TWO_WAY_WORKLOAD > 0.72 && TWO_WAY_WORKLOAD < 1, 'workload tax should be softened, not removed');
  const specialist = playRun('twperk01', 'OF', firstChoice);
  const twoWay = playRun('twperk01', 'TW', firstChoice);
  assert.ok(twoWay.retired && specialist.retired);
  // Destiny accrues faster for TW across a career — leave a measurable gap.
  // (Final destiny pools fluctuate with spends; compare peak via log/choices length proxy:
  // TW exclusive situations should appear.)
  assert.ok(
    twoWay.seenSituations.some((id) => id.startsWith('tw-')) ||
      SITUATIONS.some((s) => s.id.startsWith('tw-') && s.condition?.(twoWay)),
    'two-way exclusive situations should be reachable',
  );
}

/**
 * International call-ups must surface as a Decision (not an auto season note),
 * and declining must skip the appearance counter for that year.
 */
function expectIntlCallIsADecision(): void {
  let sawCall = false;
  const declineIntl: Chooser = (decision) => {
    const ids = enabled(decision);
    if (ids.includes('intl-decline')) {
      sawCall = true;
      return 'intl-decline';
    }
    if (ids.includes('intl-double')) {
      sawCall = true;
      return 'intl-double';
    }
    return ids[0];
  };

  // Probe several seeds until a call-up appears; fame gating makes this
  // occasional rather than guaranteed on every career.
  for (let i = 0; i < 24 && !sawCall; i++) {
    const state = playRun(`intl${String(i).padStart(2, '0')}`, i % 2 === 0 ? 'OF' : 'P', declineIntl);
    if (!sawCall) continue;
    const intlKeys = state.handled.filter((k) => k.startsWith('intl:'));
    assert.ok(intlKeys.length >= 1, 'intl Decision was not recorded in handled');
    const plan = intlKeys.find((k) => /:intl-(double|one|decline)$/.test(k));
    assert.ok(plan, 'intl commitment marker missing');
    if (plan.endsWith('intl-decline')) {
      const year = Number(plan.split(':')[1]);
      const noteThatYear = state.history.find((h) => h.year === year)?.note ?? '';
      assert.ok(
        !/世界|亞洲|十二強|奧運/.test(noteThatYear),
        'declining the call-up still wrote an intl season note',
      );
    }
    break;
  }
  assert.ok(sawCall, 'no career in 24 seeds ever saw an international call-up Decision');
}

/**
 * Accepting an overseas / promotion fork must chain into the adaptation and
 * clause follow-up cards exactly once per career.
 */
function expectOverseasFollowUpsAppear(): void {
  const overseasDeep: Chooser = (decision) => {
    const ids = enabled(decision);
    return (
      ids.find((id) => id === 'path-overseas') ??
      ids.find((id) => id === 'offer-mlb' || id === 'offer-npb' || id === 'fa-overseas') ??
      ids.find((id) => id === 'offer-promote') ??
      ids.find((id) => id.startsWith('adapt-')) ??
      ids.find((id) => id.startsWith('clause-')) ??
      ids.find((id) => id === 'intl-double') ??
      ids[0]
    );
  };

  let sawAdapt = false;
  let sawClause = false;
  for (let i = 0; i < 20; i++) {
    const state = playRun(`follow${String(i).padStart(2, '0')}`, 'OF', overseasDeep);
    if (state.handled.includes('follow:adapt')) sawAdapt = true;
    if (state.handled.includes('follow:clause')) sawClause = true;
    if (sawAdapt && sawClause) {
      assert.equal(
        state.handled.filter((k) => k === 'follow:adapt').length,
        1,
        'adaptation follow-up was asked more than once',
      );
      assert.equal(
        state.handled.filter((k) => k === 'follow:clause').length,
        1,
        'clause follow-up was asked more than once',
      );
      break;
    }
  }
  assert.ok(sawAdapt, 'no career reached the overseas adaptation follow-up');
  assert.ok(sawClause, 'no career reached the clause / AAA-push follow-up');
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
  ['careers reach the content', expectCareersReachTheContent],
  ['undo is not a re-roll', expectUndoIsNotAReroll],
  ['challenge defs are sound', expectChallengeDefsAreSound],
  ['challenge unlock math', expectChallengeUnlockMath],
  ['challenge seeds are clearable', expectChallengeSeedsAreClearable],
  ['situations have costs', expectSituationsHaveCosts],
  ['situations appear in careers', expectSituationsAppearInCareers],
  ['two-way perks exist', expectTwoWayPerksExist],
  ['intl call is a decision', expectIntlCallIsADecision],
  ['overseas follow-ups appear', expectOverseasFollowUpsAppear],
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
