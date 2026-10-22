// Assert pitching arsenal, fielding gaps, seeded RNG, difficulty order, stats,
// season standings, named pitcher tendencies, park fence, and hit-feel grades.
import {
  DIFFICULTY,
  DIFFICULTY_BLURBS,
  INNINGS_OPTIONS,
  PLAY_MODE_LABELS,
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
import {
  PLAYER_TEAM_ID,
  TEAMS,
  fenceDistanceForPark,
  getTeam,
  opponentTeams,
  teamCount,
} from './teams.ts';
import {
  SEASON_KEY,
  applyPlayerResult,
  computeStandings,
  createSeason,
  loadSeason,
  mergeSeason,
  nextUnplayedPlayerGame,
  saveSeason,
} from './season.ts';
import { createHitFeelBurst, updateHitParticles } from './hitFeel.ts';

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
  assert(FENCE_DIST >= 480 && FENCE_DIST <= 560, `fence dist out of polish band: ${FENCE_DIST}`);
  const hr = resolveFairBall({
    landingX: 400,
    landingY: 450 - FENCE_DIST,
    peakZ: 180,
    quality: 0.9,
    flightTime: 1.8,
    cfg: DIFFICULTY.normal,
  });
  assert(hr.bases === 4 && hr.play === 'homerun', `expected HR, got ${hr.result}`);

  // Weak deep fly dies on the track — not an automatic triple.
  const warning = resolveFairBall({
    landingX: 400,
    landingY: 450 - FENCE_DIST,
    peakZ: 120,
    quality: 0.35,
    flightTime: 1.4,
    cfg: DIFFICULTY.normal,
  });
  assert(warning.bases === 0, `weak fence ball should be out, got ${warning.result}`);
}

// Gap hits should prefer singles over free doubles/triples.
{
  const cfg = DIFFICULTY.normal;
  const gapX = (195 + 400) / 2;
  const gapY = 90;
  let singles = 0;
  let extras = 0;
  let outs = 0;
  for (let i = 0; i < 40; i++) {
    const q = 0.45 + (i % 5) * 0.05;
    const r = resolveFairBall({
      landingX: gapX + (i % 3) * 4,
      landingY: gapY,
      peakZ: 40 + (i % 4) * 8,
      quality: q,
      flightTime: 0.45,
      cfg,
    });
    if (r.bases === 1) singles += 1;
    else if (r.bases >= 2) extras += 1;
    else outs += 1;
  }
  assert(singles + extras > outs, `gap should mostly be hits, got 1B=${singles} XBH=${extras} out=${outs}`);
  assert(singles >= extras, `gap polish: singles should dominate extras (1B=${singles} XBH=${extras})`);
}

// Perfect plate timing launches farther than late weak timing.
{
  const sweet = computeHitLaunch({
    swingTime: 0,
    swingDir: 'center',
    pitchLoc: 'center',
    rng: createRng(3),
  });
  const late = computeHitLaunch({
    swingTime: 0.22,
    swingDir: 'center',
    pitchLoc: 'center',
    rng: createRng(3),
  });
  assert(sweet.contactQuality > late.contactQuality, 'sweet timing should beat late');
  const sweetSpeed = Math.hypot(sweet.vel.x, sweet.vel.y);
  const lateSpeed = Math.hypot(late.vel.x, late.vel.y);
  assert(sweetSpeed > lateSpeed * 1.15, 'sweet contact should carry more');
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
  DIFFICULTY.easy.fielderSpeedMul < DIFFICULTY.normal.fielderSpeedMul
    && DIFFICULTY.normal.fielderSpeedMul < DIFFICULTY.hard.fielderSpeedMul,
  'fielder chase speed should rise with difficulty',
);
assert(
  DIFFICULTY.hard.tripleMin > DIFFICULTY.easy.tripleMin,
  'hard should require more carry for triples',
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

// Play modes include season.
assert(PLAY_MODE_LABELS.season, 'season play mode label');
assert(PLAY_MODE_LABELS.match && PLAY_MODE_LABELS.derby, 'match/derby labels');

// --- Teams / parks / named pitchers ---
assert(teamCount() === 4, 'expected 4 league teams');
assert(opponentTeams().length === 3, 'three CPU opponents');
assert(getTeam(PLAYER_TEAM_ID).id === 'tigers', 'player team is tigers');
{
  const styles = new Set(TEAMS.map((t) => t.pitcher.style));
  assert(styles.has('power') && styles.has('finesse') && styles.has('trickster'), 'pitcher styles');
  const fences = TEAMS.map((t) => fenceDistanceForPark(t.park, FENCE_DIST));
  assert(new Set(fences).size >= 3, 'parks should differ in fence depth');
  assert(Math.min(...fences) < FENCE_DIST && Math.max(...fences) > FENCE_DIST, 'bandbox + deep park');
}

// Named power pitcher throws more heat than finesse pitcher (seeded batch).
{
  const power = getTeam('bears').pitcher;
  const finesse = getTeam('lizards').pitcher;
  let powerHeat = 0;
  let finesseHeat = 0;
  let powerSoft = 0;
  let finesseSoft = 0;
  for (let i = 0; i < 300; i++) {
    const a = chooseCpuPitch({ balls: 0, strikes: 0 }, 'normal', createRng(3000 + i), power);
    const b = chooseCpuPitch({ balls: 0, strikes: 0 }, 'normal', createRng(3000 + i), finesse);
    if (a.type === 'fastball' || a.type === 'sinker') powerHeat += 1;
    if (b.type === 'fastball' || b.type === 'sinker') finesseHeat += 1;
    if (a.type === 'changeup' || a.type === 'curve' || a.type === 'forkball') powerSoft += 1;
    if (b.type === 'changeup' || b.type === 'curve' || b.type === 'forkball') finesseSoft += 1;
  }
  assert(powerHeat > finesseHeat, `power should throw more heat (${powerHeat} vs ${finesseHeat})`);
  assert(finesseSoft > powerSoft, `finesse should throw more soft (${finesseSoft} vs ${powerSoft})`);
}

// Trickster paints corners more often than balanced first pitch.
{
  const trick = getTeam('hares').pitcher;
  let trickCorners = 0;
  let baseCorners = 0;
  for (let i = 0; i < 250; i++) {
    const a = chooseCpuPitch({ balls: 0, strikes: 1 }, 'normal', createRng(5000 + i), trick);
    const b = chooseCpuPitch({ balls: 0, strikes: 1 }, 'normal', createRng(5000 + i), null);
    if (a.loc !== 'center') trickCorners += 1;
    if (b.loc !== 'center') baseCorners += 1;
  }
  assert(trickCorners > baseCorners, `trickster corners ${trickCorners} vs ${baseCorners}`);
}

// Shallow park: same landing clears fence where standard does not.
{
  const landingY = 450 - Math.round(FENCE_DIST * 0.96);
  const deep = resolveFairBall({
    landingX: 400,
    landingY,
    peakZ: 160,
    quality: 0.7,
    flightTime: 1.5,
    cfg: DIFFICULTY.normal,
    fenceDist: Math.round(FENCE_DIST * 1.08),
  });
  const short = resolveFairBall({
    landingX: 400,
    landingY,
    peakZ: 160,
    quality: 0.7,
    flightTime: 1.5,
    cfg: DIFFICULTY.normal,
    fenceDist: Math.round(FENCE_DIST * 0.94),
  });
  assert(short.bases === 4, `bandbox should be HR, got ${short.result}`);
  assert(deep.bases < 4, `deep park should not be auto-HR, got ${deep.result}`);
}

// Season: schedule, standings, save, finals.
{
  const s0 = createSeason({ seed: 42, difficulty: 'normal', inningsLength: 3 });
  assert(s0.schedule.length === 6, `round-robin should be 6 games, got ${s0.schedule.length}`);
  const playerGames = s0.schedule.filter(
    (g) => g.homeId === PLAYER_TEAM_ID || g.awayId === PLAYER_TEAM_ID,
  );
  assert(playerGames.length === 3, 'player plays 3 regular games');
  assert(nextUnplayedPlayerGame(s0)?.id === playerGames[0].id, 'first unplayed is first player game');

  let s = s0;
  for (const g of playerGames) {
    s = applyPlayerResult(s, g.id, 4, 2);
  }
  // CPU games should auto-sim as we advance.
  assert(s.schedule.every((g) => g.played), 'all regular games played after player slate');
  assert(s.phase === 'finals' || s.phase === 'complete', `expected finals/complete, got ${s.phase}`);
  const standings = computeStandings(s.schedule);
  assert(standings.length === 4, 'four standing rows');
  assert(standings[0].wins + standings[0].losses + standings[0].ties > 0, 'leader has games');

  if (s.phase === 'finals' && s.finals) {
    const finals = nextUnplayedPlayerGame(s);
    assert(finals?.slot === 'finals', 'next game is finals');
    s = applyPlayerResult(s, s.finals.id, 3, 1);
    assert(s.phase === 'complete', 'finals result completes season');
    assert(s.championId === PLAYER_TEAM_ID, 'player champion on win');
  }

  const mem = new Map();
  const storage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, v),
    removeItem: (k) => mem.delete(k),
  };
  saveSeason(s, storage);
  assert(mem.has(SEASON_KEY), 'season key written');
  const loaded = loadSeason(storage);
  assert(loaded?.phase === 'complete', 'season round-trip');
  assert(mergeSeason({ version: 1, schedule: [] }) === null, 'empty schedule rejected');
  assert(mergeSeason('nope') === null, 'junk season → null');
}

// Hit feel: grade intensity + reduced motion clears FX; particles decay.
{
  const perfect = createHitFeelBurst('perfect', 400, 400, createRng(1), false);
  const weak = createHitFeelBurst('weak', 400, 400, createRng(1), false);
  assert(perfect.screenShake > weak.screenShake, 'perfect shakes more');
  assert(perfect.hitStop > weak.hitStop, 'perfect hit-stop longer');
  assert(perfect.particles.length > weak.particles.length, 'perfect more particles');
  const quiet = createHitFeelBurst('perfect', 400, 400, createRng(1), true);
  assert(quiet.screenShake === 0 && quiet.particles.length === 0, 'reduced motion silences FX');
  const stepped = updateHitParticles(perfect.particles, 0.05);
  assert(stepped.length <= perfect.particles.length, 'particles only shrink');
  const drained = updateHitParticles(perfect.particles, 10);
  assert(drained.length === 0, 'long dt clears particles');
}

console.log('check-baseball: ok');
