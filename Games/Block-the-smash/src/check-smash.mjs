/**
 * Block-the-smash depth checks: smash types, timing windows, opponents, storage.
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
} from './game/opponents.js';
import {
  STATS_KEY,
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

// Opponents: four styles, distinct fake rates, ladder unlock.
assert(OPPONENTS.length === 4, 'four opponents');
assert(getOpponent('gui')?.style.fakeRate > getOpponent('hao')?.style.fakeRate, 'gui faker');
assert(isOpponentUnlocked({}, OPPONENTS[0]), 'first unlocked');
assert(!isOpponentUnlocked({}, OPPONENTS[1]), 'second locked');
assert(isOpponentUnlocked({ hao: 1 }, OPPONENTS[1]), 'second after hao win');
assert(DIFFICULTY.hard.speedMul > DIFFICULTY.easy.speedMul, 'hard faster');

{
  const style = getOpponent('gui').style;
  let fakes = 0;
  for (let i = 0; i < 300; i++) {
    const pick = chooseSmash(style, PHASE_MIX[0], createRng(5000 + i));
    if (pick.isFake) fakes += 1;
  }
  assert(fakes > 80 && fakes < 180, `gui fake rate ~42% got ${fakes}/300`);
}

assert(phaseTierFromProgress(0.1) === 0, 'warm');
assert(phaseTierFromProgress(0.5) === 1, 'pressure');
assert(phaseTierFromProgress(0.9) === 2, 'chaos');
assert(scoreAttackWave(0) === 0 && scoreAttackWave(8) === 1, 'wave step');
assert(
  drillAccuracy({ perfects: 5, goods: 3, blocks: 2, misses: 0, maxBalls: 10 }) === 100,
  'all contacts 100%',
);

// Storage sanitize + migrate-style roundtrip.
{
  const mem = new Map();
  const storage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, v),
  };
  const bad = normalizeStats({ careerPerfects: -3, drillBestAcc: { 'normal:25': 'nope', 'easy:10': 88 } });
  assert(bad.careerPerfects === 0, 'clamp perfects');
  assert(bad.drillBestAcc['easy:10'] === 88, 'keep good acc');
  assert(bad.drillBestAcc['normal:25'] == null, 'drop bad acc');

  let stats = emptyStats();
  assert(applyDrillResult(stats, { difficulty: 'normal', balls: 25, accuracy: 80, perfects: 4, maxCombo: 5 }));
  assert(!applyDrillResult(stats, { difficulty: 'normal', balls: 25, accuracy: 70, perfects: 1, maxCombo: 2 }));
  assert(stats.drillBestAcc['normal:25'] === 80, 'best kept');

  assert(applyScoreAttackResult(stats, { difficulty: 'hard', score: 9000, perfects: 2, maxCombo: 6 }));
  applyVersusResult(stats, { opponentId: 'hao', won: true, perfects: 1, maxCombo: 3, streak: 2 });
  saveStats(stats, storage);
  assert(mem.has(STATS_KEY), 'wrote v3 key');
  const loaded = loadStats(storage);
  assert(loaded.versusWins.hao === 1, 'versus win persisted');
  assert(loaded.scoreAttackBest.hard === 9000, 'score attack persisted');
}

console.log('check-smash: ok');
