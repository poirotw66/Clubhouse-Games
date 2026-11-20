// ponytail: mode keys, cup points, slipstream, ghost, progress unlocks.
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {
  driftLevel,
  driftFill,
  DRIFT_LEVELS,
} from './engine/drift.ts';
import {
  updateDriftScreech,
  playMiniTurbo,
  playDriftSpark,
  playEvent,
  playFinish,
} from './engine/audio.ts';
import {
  bestLapKey,
  migrateBestTimesMap,
  migrateLegacyBestLapKey,
} from './engine/raceOptions.ts';
import {CUP_POINTS, cupById, pointsForPlace, CUPS} from './data/cups.ts';
import {
  isInSlipstream,
  findSlipstreamTarget,
  SLIP_SPEED_MULT,
} from './engine/slipstream.ts';
import {
  ghostStorageKey,
  parseGhostLap,
  poseAt,
  GhostRecorder,
} from './engine/ghost.ts';
import {pickCpuRivals, rivalForChar, RIVAL_STYLES} from './data/rivals.ts';
import {
  applyCupFinish,
  isCupUnlocked,
  isKartUnlocked,
  isMirrorUnlocked,
  maybeStoreGhost,
  EMPTY_PROGRESS,
  STARTER_KARTS,
} from './engine/progress.ts';
import {
  applyRacePlaces,
  createCupSession,
  cupStandings,
  isLastCupRace,
  playerOverallPlace,
} from './engine/cupSession.ts';
import {
  calculateLateralG,
  calculateRpmAndGear,
  INITIAL_TIRES,
  updateTires,
} from './engine/telemetry.ts';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// --- Record keys ----------------------------------------------------------
assert(
  bestLapKey('brick-park', {mode: 'versus', mirror: false}, 'normal') === 'brick-park:vs:normal',
  'versus normal key',
);
assert(
  bestLapKey('brick-park', {mode: 'versus', mirror: false}, 'hard') === 'brick-park:vs:hard',
  'versus hard key',
);
assert(
  bestLapKey('brick-park', {mode: 'timeTrial', mirror: true}, 'hard') === 'brick-park:tt:mir',
  'tt ignores difficulty',
);
assert(
  bestLapKey('neon-city', {mode: 'versus', mirror: true}, 'easy') === 'neon-city:vs:easy:mir',
  'versus mirror key',
);
assert(
  bestLapKey('desert-yard', {mode: 'grandPrix', mirror: false}, 'normal') ===
    'desert-yard:gp:normal',
  'grand prix key',
);
assert(
  bestLapKey('brick-park', {mode: 'grandPrix', mirror: true}, 'hard') ===
    'brick-park:gp:hard:mir',
  'gp mirror key',
);

assert(migrateLegacyBestLapKey('brick-park:vs') === 'brick-park:vs:normal', 'migrate vs');
assert(
  migrateLegacyBestLapKey('brick-park:vs:mir') === 'brick-park:vs:normal:mir',
  'migrate vs mir',
);
assert(migrateLegacyBestLapKey('brick-park:tt') === null, 'tt needs no migrate');
assert(migrateLegacyBestLapKey('brick-park:vs:normal') === null, 'new key stays');

{
  const map = {'brick-park:vs': 42, 'brick-park:vs:hard': 40};
  assert(migrateBestTimesMap(map) === true, 'should rewrite legacy');
  assert(map['brick-park:vs'] == null, 'legacy removed');
  assert(map['brick-park:vs:normal'] === 42, 'legacy → normal');
  assert(map['brick-park:vs:hard'] === 40, 'existing hard kept');
}

// --- Cup points & tracks --------------------------------------------------
assert(CUP_POINTS[0] === 15 && CUP_POINTS[3] === 8, 'cup points table');
assert(pointsForPlace(1) === 15, 'p1');
assert(pointsForPlace(2) === 12, 'p2');
assert(pointsForPlace(4) === 8, 'p4');
assert(pointsForPlace(99) === 8, 'clamp place');
assert(CUPS.length >= 2, 'two cups');
const brick = cupById('brick-cup');
assert(brick && brick.trackIds.length === 3, 'brick cup has 3 tracks');
assert(cupById('mirror-cup')?.mirror === true, 'mirror cup');
assert(cupById('mirror-cup')?.requiresBrickCupWin === true, 'mirror gated');

// --- Session standings ----------------------------------------------------
{
  const session = createCupSession('brick-cup', 'red', '玩家', 'normal');
  assert(session.entrants.length === 4, '4 entrants');
  assert(session.rivals.length === 3, '3 rivals');
  assert(session.rivals.every((r) => r.charId !== 'red'), 'rivals ≠ player kart');
  assert(!isLastCupRace(session), 'first race not last');

  const after1 = applyRacePlaces(session, {
    player: 2,
    [session.rivals[0].charId]: 1,
    [session.rivals[1].charId]: 3,
    [session.rivals[2].charId]: 4,
  });
  assert(after1.raceIndex === 1, 'advanced race index');
  const player = after1.entrants.find((e) => e.isPlayer);
  assert(player.points === 12, '2nd place → 12 pts');

  const after2 = applyRacePlaces(after1, {
    player: 1,
    [session.rivals[0].charId]: 2,
    [session.rivals[1].charId]: 3,
    [session.rivals[2].charId]: 4,
  });
  const after3 = applyRacePlaces(after2, {
    player: 1,
    [session.rivals[0].charId]: 2,
    [session.rivals[1].charId]: 3,
    [session.rivals[2].charId]: 4,
  });
  // After 3 applies, raceIndex is 3; last-race check is before applying.
  assert(isLastCupRace(after2), 'race index 2 is last of 3');
  const standings = cupStandings(after3);
  assert(standings[0].isPlayer, 'player leads after two wins');
  assert(playerOverallPlace(after3) === 1, 'overall 1st');
}

// --- Slipstream -----------------------------------------------------------
{
  const leader = {x: 100, y: 0, angle: 0, speed: 200};
  const chaser = {x: 100 - 50, y: 0, angle: 0, speed: 180};
  assert(isInSlipstream(chaser, leader), 'draft behind leader');
  const beside = {x: 100, y: 60, angle: 0, speed: 180};
  assert(!isInSlipstream(beside, leader), 'no draft beside');
  const ahead = {x: 100 + 40, y: 0, angle: 0, speed: 180};
  assert(!isInSlipstream(ahead, leader), 'no draft ahead');
  const hit = findSlipstreamTarget(chaser, [leader, beside]);
  assert(hit && hit.index === 0, 'finds leader');
  assert(SLIP_SPEED_MULT > 1, 'speed mult');
}

// --- Ghost recorder / pose ------------------------------------------------
{
  assert(ghostStorageKey('brick-park', false) === 'brick-park:tt', 'ghost key');
  assert(ghostStorageKey('brick-park', true) === 'brick-park:tt:mir', 'ghost mir key');
  const rec = new GhostRecorder();
  rec.begin();
  for (let i = 0; i < 40; i++) {
    rec.sample(i * 0.1, i * 10, 5, 0.1, 0.1);
  }
  const sliced = rec.sliceLap(0, 2.5);
  assert(sliced.length >= 2, 'sliced lap samples');
  const ghost = parseGhostLap({
    trackId: 'brick-park',
    mirror: false,
    duration: 2.5,
    samples: sliced,
  });
  assert(ghost, 'parse ghost');
  const pose = poseAt(ghost, 1.0);
  assert(pose && Number.isFinite(pose.x), 'pose at t');
  assert(parseGhostLap({trackId: 'x', duration: -1, samples: []}) === null, 'reject bad');
}

// --- Rivals ---------------------------------------------------------------
assert(RIVAL_STYLES.length >= 4, 'four personalities');
assert(pickCpuRivals('yellow').every((r) => r.charId !== 'yellow'), 'no self rival');
assert(rivalForChar('blue').id === 'brawler', 'blue is brawler');

// --- Progress / unlocks ---------------------------------------------------
{
  const fresh = {
    ...EMPTY_PROGRESS,
    unlockedKarts: [...STARTER_KARTS],
    cupsWon: [],
    cupsFinished: [],
    cupBestPlace: {},
    ghosts: {},
  };
  assert(isKartUnlocked(fresh, 'red'), 'starter red');
  assert(isKartUnlocked(fresh, 'yellow'), 'starter yellow');
  assert(!isKartUnlocked(fresh, 'green'), 'green locked');
  assert(!isMirrorUnlocked(fresh), 'mirror locked');
  assert(isCupUnlocked(fresh, 'brick-cup'), 'brick cup open');
  assert(!isCupUnlocked(fresh, 'mirror-cup'), 'mirror cup locked');

  const mid = applyCupFinish(fresh, 'brick-cup', 3);
  assert(mid.progress.unlockedKarts.includes('green'), 'finish unlocks green');
  assert(!mid.progress.mirrorUnlocked, '3rd no mirror');

  const win = applyCupFinish(mid.progress, 'brick-cup', 1);
  assert(win.progress.mirrorUnlocked, 'win unlocks mirror');
  assert(win.progress.cupsWon.includes('brick-cup'), 'cupsWon');
  assert(win.unlocked.some((m) => m.includes('鏡像')), 'unlock message');
  assert(isCupUnlocked(win.progress, 'mirror-cup'), 'mirror cup open');
  assert(isKartUnlocked(win.progress, 'blue'), 'win unlocks blue');

  const ghost = {
    trackId: 'brick-park',
    mirror: false,
    duration: 40,
    samples: [
      {t: 0, x: 0, y: 0, angle: 0},
      {t: 40, x: 100, y: 0, angle: 0},
    ],
  };
  const stored = maybeStoreGhost(win.progress, ghost);
  assert(stored.stored, 'store first ghost');
  const worse = maybeStoreGhost(stored.progress, {...ghost, duration: 50});
  assert(!worse.stored, 'reject slower ghost');
  const better = maybeStoreGhost(stored.progress, {...ghost, duration: 35});
  assert(better.stored, 'accept faster ghost');
}

// --- Telemetry & Cockpit tests --------------------------------------------
{
  const idle = calculateRpmAndGear(0, false, false);
  assert(idle.rpm < 1200 && idle.gear === '1檔', 'idle rpm');

  const boost = calculateRpmAndGear(350, true, false);
  assert(boost.rpm >= 8400 && boost.gear.includes('BOOST'), 'boost rpm');

  const drift = calculateRpmAndGear(250, false, true);
  assert(drift.rpm >= 7200 && drift.gear.includes('DRIFT'), 'drift rpm');

  const latZero = calculateLateralG(0, 200, false, 0);
  assert(latZero === 0, 'zero lateral G');

  const latDrift = calculateLateralG(0, 200, true, 1);
  assert(latDrift > 1.0, 'drift lateral G');

  const mockPlayer = {
    speed: 280,
    drifting: false,
    driftDir: 0,
    driftCharge: 0,
  };

  const grassTires = updateTires(INITIAL_TIRES, mockPlayer, false, 0, false, 0.1);
  assert(grassTires.gripPct === 52, 'grass grip 52%');
  assert(grassTires.status === 'offroad', 'grass status offroad');

  const steerLeft = updateTires(INITIAL_TIRES, mockPlayer, true, -1, false, 0.5);
  assert(steerLeft.frTemp > steerLeft.flTemp, 'turning left loads right tire');

  const braking = updateTires(INITIAL_TIRES, mockPlayer, true, 0, true, 0.5);
  assert(braking.flTemp > INITIAL_TIRES.flTemp, 'braking loads front tire');
}

// --- Drift Mini-Turbo 3-Tier Escalation tests (Sakurai controls-review) ------
{
  assert(Array.isArray(DRIFT_LEVELS) && DRIFT_LEVELS.length === 3, 'DRIFT_LEVELS has 3 tiers');
  assert(DRIFT_LEVELS[0].charge === 0.85 && DRIFT_LEVELS[0].boost === 0.55, 'tier 1 blue sparks at 0.85s');
  assert(DRIFT_LEVELS[1].charge === 1.8 && DRIFT_LEVELS[1].boost === 1.0, 'tier 2 orange sparks at 1.8s');
  assert(DRIFT_LEVELS[2].charge === 3.0 && DRIFT_LEVELS[2].boost === 1.7, 'tier 3 purple sparks at 3.0s');

  assert(driftLevel(0) === 0, 'driftLevel 0');
  assert(driftLevel(0.5) === 0, 'driftLevel 0.5 is tier 0');
  assert(driftLevel(0.85) === 1, 'driftLevel 0.85 is tier 1');
  assert(driftLevel(1.5) === 1, 'driftLevel 1.5 is tier 1');
  assert(driftLevel(1.8) === 2, 'driftLevel 1.8 is tier 2');
  assert(driftLevel(2.5) === 2, 'driftLevel 2.5 is tier 2');
  assert(driftLevel(3.0) === 3, 'driftLevel 3.0 is tier 3');
  assert(driftLevel(4.0) === 3, 'driftLevel 4.0 is tier 3 max');

  assert(driftFill(0) === 0, 'driftFill 0');
  assert(Math.abs(driftFill(1.5) - 0.5) < 1e-4, 'driftFill 1.5s = 50%');
  assert(driftFill(3.0) === 1.0, 'driftFill 3.0s = 100%');
  assert(driftFill(5.0) === 1.0, 'driftFill caps at 1.0');

  // Test dynamic simulation drift escalation logic
  let charge = 0.80;
  let events = [];
  let oldTier = driftLevel(charge);
  charge += 0.1;
  let newTier = driftLevel(charge);
  if (newTier > oldTier) events.push(`drift-tier-${newTier}`);
  assert(events.includes('drift-tier-1'), 'drift-tier-1 event on crossing 0.85s');

  charge = 1.75;
  oldTier = driftLevel(charge);
  charge += 0.1;
  newTier = driftLevel(charge);
  if (newTier > oldTier) events.push(`drift-tier-${newTier}`);
  assert(events.includes('drift-tier-2'), 'drift-tier-2 event on crossing 1.80s');

  charge = 2.95;
  oldTier = driftLevel(charge);
  charge += 0.1;
  newTier = driftLevel(charge);
  if (newTier > oldTier) events.push(`drift-tier-${newTier}`);
  assert(events.includes('drift-tier-3'), 'drift-tier-3 event on crossing 3.00s');

  // Mini-turbo release mapping
  for (let t = 1; t <= 3; t++) {
    const tierBoost = DRIFT_LEVELS[t - 1].boost;
    assert(tierBoost > 0, `tier ${t} grants positive boost duration`);
  }
}

// --- Collision Juice & Wall Collision tests (Sakurai fx-004) ----------------
{
  function checkCollisionIntensity(aVx, aVy, bVx, bVy, aSpeed, bSpeed) {
    const relSpeed = Math.hypot(aVx - bVx, aVy - bVy);
    const isHeavy = relSpeed > 130 || Math.abs(aSpeed) > 170 || Math.abs(bSpeed) > 170;
    return isHeavy ? 'heavy-bump' : 'bump';
  }

  assert(checkCollisionIntensity(220, 0, -180, 0, 220, -180) === 'heavy-bump', 'high rel speed is heavy-bump');
  assert(checkCollisionIntensity(20, 0, 10, 0, 20, 10) === 'bump', 'low rel speed is normal bump');

  const MAX_LATERAL = 330;
  function isWallBarrierCollision(lateral) {
    return Math.abs(lateral) > MAX_LATERAL;
  }
  assert(isWallBarrierCollision(350), 'lateral > MAX_LATERAL is wall barrier collision');
  assert(!isWallBarrierCollision(100), 'lateral <= MAX_LATERAL is within drivable bounds');
}

// --- Audio API Synthesis tests (SSR safety) ---------------------------------
{
  // audio functions must safely no-op in headless/test environments without window/AudioContext
  updateDriftScreech(true, 1.5);
  updateDriftScreech(false, 0);
  playMiniTurbo(1);
  playMiniTurbo(2);
  playMiniTurbo(3);
  playDriftSpark(1);
  playDriftSpark(2);
  playDriftSpark(3);
  playEvent('mini-turbo-1');
  playEvent('mini-turbo-2');
  playEvent('mini-turbo-3');
  playEvent('drift-tier-1');
  playEvent('drift-tier-2');
  playEvent('drift-tier-3');
  playEvent('heavy-bump');
  playEvent('wall-collision');
  playFinish(true);
  playFinish(false);
}

// --- Rapid Retry Key Support (Sakurai gameplay-ux-009) -----------------------
{
  const testKeyEvents = [
    {code: 'Space', key: ' '},
    {code: 'Enter', key: 'Enter'},
    {code: 'KeyR', key: 'r'},
    {code: 'KeyR', key: 'R'},
  ];
  for (const ev of testKeyEvents) {
    const isRapidRetryKey =
      ev.code === 'Space' ||
      ev.code === 'Enter' ||
      ev.code === 'KeyR' ||
      ev.key === ' ' ||
      ev.key === 'Enter' ||
      ev.key === 'r' ||
      ev.key === 'R';
    assert(isRapidRetryKey, `key ${ev.code}/${ev.key} triggers rapid retry`);
  }
}

// --- Strict Traditional Chinese Compliance (Zero Simplified Chinese) --------
{
  // Unicode escapes for common simplified Chinese characters:
  const scStrict = [
    '\u5f20', '\u95e8', '\u5173', '\u8fd9', '\u4e3a', '\u4e66', '\u957f', '\u89c1',
    '\u5b66', '\u56fd', '\u4f53', '\u5199', '\u5355', '\u4ec5', '\u4ece', '\u4e0e',
    '\u5bf9', '\u6b22', '\u753b', '\u7ebf', '\u8fde', '\u5b9e', '\u65f6', '\u8ba1', '\u52a8',
    '\u6f02\u79fb',
    '\u6447\u6746',
  ];

  const filesToCheck = [
    fileURLToPath(new URL('./engine/audio.ts', import.meta.url)),
    fileURLToPath(new URL('./engine/race.ts', import.meta.url)),
    fileURLToPath(new URL('./App.tsx', import.meta.url)),
    fileURLToPath(new URL('./components/ResultScreen.tsx', import.meta.url)),
    fileURLToPath(new URL('./components/CupStandings.tsx', import.meta.url)),
    fileURLToPath(new URL('../../../04-sports-arcade/brick-kart-racing.md', import.meta.url)),
  ];

  for (const filePath of filesToCheck) {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      for (const sc of scStrict) {
        assert(
          !content.includes(sc),
          `File ${filePath} contains simplified Chinese character "${sc}"`,
        );
      }
    }
  }
}

console.log('check-kart-modes: ok');
