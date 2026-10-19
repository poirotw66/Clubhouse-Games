// ponytail: mode keys, cup points, slipstream, ghost, progress unlocks.
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

console.log('check-kart-modes: ok');
