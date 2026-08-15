import * as assert from 'node:assert/strict';
import { acknowledge, createGame, resolve, rollOrigins } from '../src/game/engine.js';
import { overall } from '../src/game/config.js';
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
  const positions: Position[] = ['P', 'C', 'IF', 'OF'];
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
      state.history.forEach((record) => {
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
