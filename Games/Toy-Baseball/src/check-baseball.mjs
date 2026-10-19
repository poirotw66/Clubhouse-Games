// Assert pitching arsenal, fielding gaps, seeded RNG, difficulty order, and stats.
import {
  DIFFICULTY,
  DIFFICULTY_BLURBS,
  INNINGS_OPTIONS,
  cpuSwingTargetY,
  gradeContact,
} from './difficulty.ts';
import {
  EMPTY_BESTS,
  STORAGE_KEY,
  STORAGE_KEY_V2,
  loadBests,
  loadBestsMap,
  saveBests,
  updateDerbyBests,
  updateMatchBests,
} from './stats.ts';
import {
  PITCH_DEFS,
  PITCH_TYPES,
  STEER_WINDOW_SEC,
  applyPitchFlight,
  chooseCpuPitch,
  cpuReadsPitch,
  initialPitchVelocity,
} from './pitching.ts';
import {
  FENCE_DIST,
  gapScore,
  getFielders,
  isFoulTerritory,
  resolveFairBall,
} from './fielding.ts';
import { computeHitLaunch } from './hitting.ts';
import { createRng } from './rng.ts';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// --- Six distinct pitch types ---
assert(PITCH_TYPES.length === 6, 'expected 6 pitch types');
{
  const speeds = new Set(PITCH_TYPES.map((t) => PITCH_DEFS[t].speed));
  assert(speeds.size >= 5, 'pitch speeds should mostly differ');
  assert(PITCH_DEFS.fastball.speed > PITCH_DEFS.changeup.speed, 'fastball faster than changeup');
  assert(PITCH_DEFS.curve.steerScale > PITCH_DEFS.fastball.steerScale, 'curve steers more');
  assert(PITCH_DEFS.forkball.breakZ > PITCH_DEFS.fastball.breakZ, 'fork drops more');
  assert(STEER_WINDOW_SEC > 0.15 && STEER_WINDOW_SEC < 0.5, 'steer window in classic toy range');
}

// After-release steering bends velocity inside the window.
{
  const vel = initialPitchVelocity('curve', 'center');
  const before = vel.x;
  applyPitchFlight(vel, 'curve', 0.1, 0.05, 1);
  assert(vel.x > before, 'right steer should increase x velocity on curve');
  const vel2 = initialPitchVelocity('fastball', 'center');
  const x0 = vel2.x;
  applyPitchFlight(vel2, 'fastball', 0.1, 0.05, 1);
  const fastDelta = vel2.x - x0;
  const vel3 = initialPitchVelocity('curve', 'center');
  const x1 = vel3.x;
  applyPitchFlight(vel3, 'curve', 0.1, 0.05, 1);
  const curveDelta = vel3.x - x1;
  assert(curveDelta > fastDelta, 'curve should respond more to steer than fastball');
}

// CPU sequencing: two-strike favors put-away; 3-0 favors heat (seeded).
{
  const putAway = { fastball: 0, changeup: 0, forkball: 0, slider: 0, curve: 0, sinker: 0 };
  const challenge = { fastball: 0, changeup: 0, forkball: 0, slider: 0, curve: 0, sinker: 0 };
  for (let i = 0; i < 400; i++) {
    const a = chooseCpuPitch({ balls: 0, strikes: 2 }, 'normal', createRng(1000 + i));
    putAway[a.type] += 1;
    const b = chooseCpuPitch({ balls: 3, strikes: 0 }, 'normal', createRng(2000 + i));
    challenge[b.type] += 1;
  }
  const putAwayJunk = putAway.changeup + putAway.forkball + putAway.slider + putAway.curve;
  const challengeHeat = challenge.fastball + challenge.sinker;
  assert(putAwayJunk > putAway.fastball, 'two-strike should favor offspeed/breaking');
  assert(challengeHeat > challenge.changeup + challenge.forkball, '3-0 should favor heat');
}

// Seeded chooseCpuPitch is deterministic.
{
  const a = chooseCpuPitch({ balls: 1, strikes: 1 }, 'hard', createRng(42));
  const b = chooseCpuPitch({ balls: 1, strikes: 1 }, 'hard', createRng(42));
  assert(a.type === b.type && a.loc === b.loc, 'same seed → same CPU pitch');
}

// CPU pitch read rate rises with difficulty.
{
  let easy = 0;
  let hard = 0;
  for (let i = 0; i < 200; i++) {
    if (cpuReadsPitch('easy', 'changeup', createRng(i))) easy += 1;
    if (cpuReadsPitch('hard', 'changeup', createRng(i))) hard += 1;
  }
  assert(hard > easy, 'hard should read pitches more often than easy');
}

// --- Nine fielders + gap outcomes ---
{
  const fielders = getFielders('normal');
  assert(fielders.length === 9, 'expected 9 fielders');
  const ids = new Set(fielders.map((f) => f.id));
  for (const id of ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF']) {
    assert(ids.has(id), `missing fielder ${id}`);
  }
}

// At a fielder: catch. In a deep gap: hit.
{
  const cfg = DIFFICULTY.normal;
  const cf = getFielders('normal').find((f) => f.id === 'CF');
  const atCf = resolveFairBall({
    landingX: cf.x,
    landingY: cf.y,
    peakZ: 160,
    quality: 0.7,
    flightTime: 1.4,
    cfg,
  });
  assert(atCf.bases === 0, `ball at CF should be out, got ${atCf.result}`);
  assert(atCf.play === 'catch', 'expected catch play');

  // Gap between LF and CF — low liner that beats the outfield.
  const gapX = (195 + 400) / 2;
  const gapY = 70;
  const gap = gapScore(getFielders('normal'), gapX, gapY);
  assert(gap > 0.2, `expected measurable gap score, got ${gap}`);
  const throughGap = resolveFairBall({
    landingX: gapX,
    landingY: gapY,
    peakZ: 35,
    quality: 0.82,
    flightTime: 0.4,
    cfg,
  });
  assert(throughGap.bases >= 1, `gap ball should be a hit, got ${throughGap.result}`);
}

// Home run over the fence with authority.
{
  const hr = resolveFairBall({
    landingX: 400,
    landingY: 450 - FENCE_DIST,
    peakZ: 180,
    quality: 0.9,
    flightTime: 1.8,
    cfg: DIFFICULTY.normal,
  });
  assert(hr.bases === 4 && hr.play === 'homerun', `expected HR, got ${hr.result}`);
}

// Foul territory helper.
assert(isFoulTerritory(100, 400), 'wide left near plate should be foul-ish');
assert(!isFoulTerritory(400, 200), 'center field should be fair');

// Hitting: same seed → same launch; matching loc boosts quality.
{
  const matched = computeHitLaunch({
    swingTime: 0.05,
    swingDir: 'left',
    pitchLoc: 'left',
    rng: createRng(7),
  });
  const missed = computeHitLaunch({
    swingTime: 0.05,
    swingDir: 'left',
    pitchLoc: 'right',
    rng: createRng(7),
  });
  assert(matched.contactQuality > missed.contactQuality, 'loc match should raise quality');
  const a = computeHitLaunch({
    swingTime: 0.02,
    swingDir: 'center',
    pitchLoc: 'center',
    rng: createRng(99),
  });
  const b = computeHitLaunch({
    swingTime: 0.02,
    swingDir: 'center',
    pitchLoc: 'center',
    rng: createRng(99),
  });
  assert(a.contactQuality === b.contactQuality, 'seeded hit launch must match');
  assert(gradeContact(0.9) === 'perfect', 'high quality → perfect');
  assert(gradeContact(0.2) === 'weak', 'low quality → weak');
}

// Hard is stricter on the player and sharper for the CPU (ordered tiers).
assert(
  DIFFICULTY.hard.hitRadius < DIFFICULTY.normal.hitRadius
    && DIFFICULTY.normal.hitRadius < DIFFICULTY.easy.hitRadius,
  'hitRadius should shrink with difficulty',
);
assert(
  DIFFICULTY.hard.cpuAimSkill > DIFFICULTY.normal.cpuAimSkill
    && DIFFICULTY.normal.cpuAimSkill > DIFFICULTY.easy.cpuAimSkill,
  'cpuAimSkill should rise with difficulty',
);
assert(
  DIFFICULTY.hard.cpuSwingRate > DIFFICULTY.normal.cpuSwingRate
    && DIFFICULTY.normal.cpuSwingRate > DIFFICULTY.easy.cpuSwingRate,
  'cpuSwingRate should rise with difficulty',
);
assert(
  DIFFICULTY.hard.cpuTakeBall > DIFFICULTY.normal.cpuTakeBall
    && DIFFICULTY.normal.cpuTakeBall > DIFFICULTY.easy.cpuTakeBall,
  'cpuTakeBall should rise with difficulty',
);
assert(
  DIFFICULTY.hard.cpuAimDir > DIFFICULTY.normal.cpuAimDir
    && DIFFICULTY.normal.cpuAimDir > DIFFICULTY.easy.cpuAimDir,
  'cpuAimDir should rise with difficulty',
);
assert(DIFFICULTY.hard.cpuPitchDelayMax < DIFFICULTY.easy.cpuPitchDelayMin, 'hard pitches sooner');
assert(
  DIFFICULTY.hard.weakQuality > DIFFICULTY.easy.weakQuality,
  'hard should grade weak contact more harshly',
);
assert(
  DIFFICULTY.easy.hitRadius - DIFFICULTY.hard.hitRadius >= 30,
  `easy vs hard hitRadius gap too small`,
);
assert(
  DIFFICULTY.hard.cpuAimSkill - DIFFICULTY.easy.cpuAimSkill >= 0.5,
  `easy vs hard aim skill gap too small`,
);

// Innings options for full-game modes.
assert(
  INNINGS_OPTIONS.includes(3) && INNINGS_OPTIONS.includes(6) && INNINGS_OPTIONS.includes(9),
  'innings options must include 3/6/9',
);

{
  const blurbs = Object.values(DIFFICULTY_BLURBS);
  assert(blurbs.length === 3, 'expected three difficulty blurbs');
  assert(new Set(blurbs).size === 3, 'difficulty blurbs must be unique');
}

{
  const y = cpuSwingTargetY(1, () => 0.5);
  assert(Math.abs(y - 448) < 1, `perfect skill should aim ~448, got ${y}`);
}

// Match / derby stats + innings tracking.
{
  const afterWin = updateMatchBests(EMPTY_BESTS, 5, 2, 9);
  assert(afterWin.matchWins === 1, 'win should count');
  assert(afterWin.matchBestInnings === 9, 'win should record innings length');
  const afterLoss = updateMatchBests(afterWin, 1, 3, 3);
  assert(afterLoss.matchWinStreak === 0, 'loss should clear streak');
  assert(afterLoss.matchBestInnings === 9, 'loss should keep best innings');
}

{
  const a = updateDerbyBests(EMPTY_BESTS, 2, 400);
  const b = updateDerbyBests(a, 1, 500);
  assert(b.derbyBestHrs === 2, 'derby should keep max HRs');
  assert(b.derbyBestDist === 500, 'derby should keep max distance');
}

{
  const mem = new Map();
  const storage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => {
      mem.set(k, v);
    },
  };
  assert(loadBests('normal', storage).matchWins === 0, 'empty storage should yield empty bests');
  const written = updateMatchBests(EMPTY_BESTS, 4, 0, 6);
  saveBests('hard', written, storage);
  assert(mem.has(STORAGE_KEY_V2), 'save should write v2 key');
  assert(loadBests('hard', storage).matchWins === 1, 'hard slot restored');
  assert(loadBests('hard', storage).matchBestInnings === 6, 'innings restored');

  mem.clear();
  mem.set(STORAGE_KEY, JSON.stringify({ matchWins: 2, matchWinStreak: 2, matchBestRuns: 7 }));
  const migrated = loadBestsMap(storage);
  assert(migrated.normal.matchWins === 2, 'legacy → normal');
  assert(mem.has(STORAGE_KEY_V2), 'migration writes v2');
}

console.log('check-baseball: ok');
