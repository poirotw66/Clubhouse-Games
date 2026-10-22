/**
 * Block-the-smash depth checks: smash types, timing, 8-opponent ladder, counter, daily.
 */
import {
  PHASE_MIX,
  SMASH_DEFS,
  SMASH_TYPE_IDS,
  pickFakeTell,
  pickSmashType,
  resolveAimX,
} from './game/smashTypes.js';
import {
  combineContact,
  getTimingWindowsMs,
  gradePosition,
  gradeTiming,
  scoreForContact,
  versusReturnWinsPoint,
  WINDOW_GOOD_MS,
  WINDOW_PERFECT_MS,
} from './game/timing.js';
import {
  DIFFICULTY,
  OPPONENTS,
  chooseSmash,
  getOpponent,
  isOpponentUnlocked,
  seriesWinsNeeded,
  shouldStartBurst,
  biasMixForHabit,
} from './game/opponents.js';
import {
  STATS_KEY,
  applyDailyResult,
  applyDrillResult,
  applyScoreAttackResult,
  applyVersusResult,
  drillAccuracy,
  emptyStats,
  gradeFromAccuracy,
  gradeFromScore,
  loadStats,
  normalizeStats,
  phaseTierFromProgress,
  saveStats,
  scoreAttackWave,
} from './game/scoring.js';
import { createRng } from './game/rng.js';
import {
  COUNTER_WINDOW_SEC,
  counterScoreBonus,
  counterDisruptsRhythm,
  resolvePerfectCounter,
} from './game/counter.js';
import {
  DAILY_BALL_COUNT,
  buildDailyScript,
  buildDailyShareText,
  computeDailyStreak,
  dailySeedNumber,
  previousTaipeiDay,
  taipeiDateKey,
} from './game/daily.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// --- Grades (legacy + score-attack) ---
assert(gradeFromAccuracy(100).grade === 'S', 'perfect should be S');
assert(gradeFromAccuracy(85).grade === 'A', '85 should be A');
assert(gradeFromAccuracy(70).grade === 'B', '70 should be B');
assert(gradeFromAccuracy(50).grade === 'C', '50 should be C');
assert(gradeFromAccuracy(10).grade === 'D', 'low should be D');
assert(gradeFromScore(30000).grade === 'S', 'high score S');
assert(gradeFromScore(100).grade === 'D', 'low score D');

// --- Four distinct smash types ---
assert(SMASH_TYPE_IDS.length === 4, 'four smash types');
assert(SMASH_DEFS.straight.speedMul > SMASH_DEFS.drop.speedMul, 'straight faster than drop');
assert(SMASH_DEFS.cross.aimSpreadMul > SMASH_DEFS.straight.aimSpreadMul, 'cross wider aim');
assert(SMASH_DEFS.body.trackPlayer === true, 'body tracks player');
assert(SMASH_DEFS.drop.windupSec > SMASH_DEFS.straight.windupSec, 'drop longer tell');
assert(PHASE_MIX.length === 3, 'three phase mixes');
{
  for (const mix of PHASE_MIX) {
    const sum = SMASH_TYPE_IDS.reduce((a, id) => a + mix[id], 0);
    assert(Math.abs(sum - 1) < 0.02, 'phase mix ~1');
  }
}

// Fake tell never equals real when forced.
{
  const rng = createRng(42);
  for (let i = 0; i < 40; i++) {
    const real = pickSmashType(PHASE_MIX[2], rng);
    const tell = pickFakeTell(real, rng);
    assert(tell !== real, 'fake tell differs');
  }
}

// Aim profiles diverge.
{
  const rng = createRng(7);
  const cross = resolveAimX('cross', {
    handedness: 'right',
    playerX: 4,
    aimSpread: 12,
    sideSign: -1,
    rng,
  });
  const body = resolveAimX('body', {
    handedness: 'right',
    playerX: 2.5,
    aimSpread: 12,
    rng,
  });
  assert(cross < 0, 'cross sideSign -1 goes left of hand');
  assert(Math.abs(body - 2.5) < 3, 'body near player X');
}

// Timing windows tighten but stay ordered.
{
  const loose = getTimingWindowsMs(0, 0);
  const tight = getTimingWindowsMs(2, 16);
  assert(loose.perfect === WINDOW_PERFECT_MS, 'base perfect');
  assert(loose.good === WINDOW_GOOD_MS, 'base good');
  assert(tight.perfect < loose.perfect, 'windows tighten');
  assert(tight.perfect < tight.good, 'perfect stricter than good');
  assert(tight.perfect >= 50 && tight.good >= 140, 'floors');
}

assert(gradeTiming(0.07, 0.15, 0.07, getTimingWindowsMs(0)) === 'perfect', 'on-peak perfect');
assert(gradeTiming(0.07, 0.15, 0.35, getTimingWindowsMs(0)) === 'late', 'early swing late grade');
assert(gradePosition(1.0) === 'perfect', 'close pos');
assert(gradePosition(5) === 'out', 'far out');

assert(
  combineContact({ swinging: true, timing: 'perfect', position: 'good' }) === 'perfect',
  'perfect combine',
);
assert(
  combineContact({ swinging: false, timing: 'perfect', position: 'perfect' }) === 'block',
  'passive is block',
);
assert(
  combineContact({ swinging: true, timing: 'late', position: 'reach' }) === 'block',
  'late reach block',
);

assert(scoreForContact('perfect', 3, 'left') > scoreForContact('good', 3, 'center'), 'perfect pays more');
assert(scoreForContact('perfect', 0, 'right') > scoreForContact('perfect', 0, 'center'), 'corner bonus');

// Versus: perfect usually wins vs weak cover; good rarely vs strong cover.
{
  const weak = { coverLeft: 0.2, coverCenter: 0.2, coverRight: 0.2, defense: 0.2 };
  const wall = { coverLeft: 0.9, coverCenter: 0.9, coverRight: 0.9, defense: 0.8 };
  let perfectWins = 0;
  let goodVsWall = 0;
  for (let i = 0; i < 200; i++) {
    const rng = createRng(1000 + i);
    if (versusReturnWinsPoint('perfect', 'left', weak, rng)) perfectWins += 1;
    if (versusReturnWinsPoint('good', 'center', wall, rng)) goodVsWall += 1;
  }
  assert(perfectWins > 150, 'perfect should usually win');
  assert(goodVsWall < 80, 'good vs wall should often fail');
}

// Opponents: eight styles with habits, BO3, ladder unlock.
assert(OPPONENTS.length === 8, 'eight opponents');
assert(OPPONENTS.every((o) => o.habit?.id && o.habit?.label && o.bestOf === 3), 'habits + BO3');
assert(seriesWinsNeeded(3) === 2, 'BO3 needs 2');
assert(getOpponent('gui')?.style.fakeRate > getOpponent('hao')?.style.fakeRate, 'gui faker');
assert(getOpponent('bao')?.habit.id === 'burst', 'bao burst habit');
assert(getOpponent('king')?.unlockWins === 7, 'final boss unlock');
assert(isOpponentUnlocked({}, OPPONENTS[0]), 'first unlocked');
assert(!isOpponentUnlocked({}, OPPONENTS[1]), 'second locked');
assert(isOpponentUnlocked({ hao: 1 }, OPPONENTS[1]), 'second after hao win');
assert(!isOpponentUnlocked({ hao: 1, mei: 1, gui: 1, coach: 1 }, OPPONENTS[5]), 'bao locked');
assert(
  isOpponentUnlocked({ hao: 1, mei: 1, gui: 1, coach: 1, lu: 1 }, OPPONENTS[5]),
  'bao after five',
);
assert(DIFFICULTY.hard.speedMul > DIFFICULTY.easy.speedMul, 'hard faster');

{
  const style = getOpponent('gui').style;
  let fakes = 0;
  for (let i = 0; i < 300; i++) {
    const pick = chooseSmash(style, PHASE_MIX[0], createRng(5000 + i), {
      habit: getOpponent('gui').habit,
    });
    if (pick.isFake) fakes += 1;
  }
  assert(fakes > 80 && fakes < 180, `gui fake rate ~42% got ${fakes}/300`);
}

{
  const burst = chooseSmash(getOpponent('bao').style, PHASE_MIX[0], createRng(1), {
    habit: getOpponent('bao').habit,
    forceBurst: true,
  });
  assert(!burst.isFake && (burst.real === 'straight' || burst.real === 'body'), 'forced burst heavy');
  assert(shouldStartBurst(getOpponent('bao').habit, 'straight', () => 0) === true, 'burst roll 0');
  assert(shouldStartBurst(getOpponent('bao').habit, 'drop', () => 0) === false, 'drop no burst');
  const biased = biasMixForHabit(
    { straight: 0.25, cross: 0.25, drop: 0.25, body: 0.25 },
    { id: 'x', label: 'x', heavyBias: 0.2 },
  );
  assert(biased.straight > 0.25 && biased.drop < 0.25, 'heavy bias');
}

assert(phaseTierFromProgress(0.1) === 0, 'warm');
assert(phaseTierFromProgress(0.5) === 1, 'pressure');
assert(phaseTierFromProgress(0.9) === 2, 'chaos');
assert(scoreAttackWave(0) === 0 && scoreAttackWave(8) === 1, 'wave step');
assert(
  drillAccuracy({ perfects: 5, goods: 3, blocks: 2, misses: 0, maxBalls: 10 }) === 100,
  'all contacts 100%',
);

// Counter phase helpers.
assert(COUNTER_WINDOW_SEC > 0.5 && COUNTER_WINDOW_SEC < 2, 'counter window');
assert(counterScoreBonus('left', 2) > counterScoreBonus('center', 2), 'corner counter pays more');
{
  const cover = { coverLeft: 0.2, coverCenter: 0.8, coverRight: 0.2, defense: 0.3 };
  const scored = resolvePerfectCounter({
    mode: 'scoreAttack',
    zone: 'left',
    combo: 3,
    cover,
    versusWinsPoint: versusReturnWinsPoint,
    rng: createRng(9),
  });
  assert(scored.scoreDelta > 0, 'score counter bonus');
  let disrupt = 0;
  for (let i = 0; i < 100; i++) {
    if (counterDisruptsRhythm('left', cover, createRng(2000 + i))) disrupt += 1;
  }
  assert(disrupt > 50, 'weak-side counter often disrupts');
  const vs = resolvePerfectCounter({
    mode: 'versus',
    zone: 'left',
    combo: 1,
    cover,
    versusWinsPoint: versusReturnWinsPoint,
    rng: createRng(3),
  });
  assert(typeof vs.wonPoint === 'boolean' && typeof vs.disrupted === 'boolean', 'versus counter shape');
}

// Daily: Taipei key, deterministic script, streak, share.
{
  const key = taipeiDateKey(new Date('2026-10-21T16:00:00Z')); // UTC+8 → 2026-10-22
  assert(key === '2026-10-22', `taipei date got ${key}`);
  assert(previousTaipeiDay('2026-10-01') === '2026-09-30', 'prev day month');
  const a = buildDailyScript('2026-10-22');
  const b = buildDailyScript('2026-10-22');
  assert(a.length === DAILY_BALL_COUNT, 'daily length');
  assert(JSON.stringify(a) === JSON.stringify(b), 'daily deterministic');
  assert(dailySeedNumber('2026-10-22') !== dailySeedNumber('2026-10-23'), 'seed differs by day');
  const fakes = a.filter((s) => s.isFake).length;
  assert(fakes >= 1, 'daily has some fakes');
  assert(computeDailyStreak({}, '2026-10-22') === 0, 'empty streak');
  assert(
    computeDailyStreak({ '2026-10-22': 100, '2026-10-21': 80 }, '2026-10-22') === 2,
    'two-day streak',
  );
  assert(
    computeDailyStreak({ '2026-10-22': 100, '2026-10-20': 80 }, '2026-10-22') === 1,
    'gap resets',
  );
  const share = buildDailyShareText({
    dateKey: '2026-10-22',
    score: 9000,
    perfects: 8,
    accuracy: 72,
    streak: 3,
  });
  assert(share.includes('羽毛球接殺 每日 2026-10-22'), 'share header');
  assert(share.includes('連續 3 天'), 'share streak');
}

// Storage sanitize + migrate-style roundtrip.
{
  const mem = new Map();
  const storage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, v),
  };
  const bad = normalizeStats({
    careerPerfects: -3,
    drillBestAcc: { 'normal:25': 'nope', 'easy:10': 88 },
    dailyBest: { '2026-10-22': 12.5 },
  });
  assert(bad.careerPerfects === 0, 'clamp perfects');
  assert(bad.drillBestAcc['easy:10'] === 88, 'keep good acc');
  assert(bad.drillBestAcc['normal:25'] == null, 'drop bad acc');
  assert(bad.dailyBest['2026-10-22'] === 12, 'floor daily');
  assert(bad.careerCounters === 0, 'default counters');

  let stats = emptyStats();
  assert(applyDrillResult(stats, { difficulty: 'normal', balls: 25, accuracy: 80, perfects: 4, maxCombo: 5 }));
  assert(!applyDrillResult(stats, { difficulty: 'normal', balls: 25, accuracy: 70, perfects: 1, maxCombo: 2 }));
  assert(stats.drillBestAcc['normal:25'] === 80, 'best kept');

  assert(applyScoreAttackResult(stats, { difficulty: 'hard', score: 9000, perfects: 2, maxCombo: 6 }));
  applyVersusResult(stats, {
    opponentId: 'hao',
    won: true,
    perfects: 1,
    maxCombo: 3,
    streak: 2,
    counters: 4,
  });
  assert(stats.careerCounters === 4, 'versus counters');
  assert(applyDailyResult(stats, { dateKey: '2026-10-22', score: 5000, perfects: 3, maxCombo: 4, counters: 2 }));
  assert(stats.dailyBest['2026-10-22'] === 5000, 'daily best');
  assert(stats.careerCounters === 6, 'daily counters stacked');
  saveStats(stats, storage);
  assert(mem.has(STATS_KEY), 'wrote v3 key');
  const loaded = loadStats(storage);
  assert(loaded.versusWins.hao === 1, 'versus win persisted');
  assert(loaded.scoreAttackBest.hard === 9000, 'score attack persisted');
  assert(loaded.dailyBest['2026-10-22'] === 5000, 'daily persisted');
}

console.log('check-smash: ok');
