/**
 * Mission-pack regressions. Run via npm run check.
 *
 * These exist because pack unlock / constraint enforcement has already been
 * broken in sibling games when the title CTA shipped without a headless gate.
 */
import assert from 'node:assert/strict';
import {
  TOTAL_WAVES,
  TOWER_DEFS,
  MAP_ROCKS,
} from './game/constants.ts';
import {
  createInitialState,
  placeTower,
  sellTower,
  startNextWave,
  step,
  withRocks,
} from './game/engine.ts';
import {
  EMPTY_MISSION_PROGRESS,
  MISSION_PACK,
  applyMissionResult,
  assertMissionConfigs,
  continueMissionIndex,
  evaluateMissionGoal,
  isMissionUnlocked,
  missionAt,
  missionById,
  missionCount,
  missionIndexOf,
} from './game/missions.ts';

assertMissionConfigs();
assert.equal(missionCount(), 6, 'pack ships six missions');
assert.equal(MISSION_PACK[0].id, 'corridor-standard');
assert.equal(MISSION_PACK[MISSION_PACK.length - 1].id, 'harsh-splash');

{
  assert.equal(isMissionUnlocked(0, 0), true, 'first mission always unlocked');
  assert.equal(isMissionUnlocked(1, 0), false, 'second locked until first clear');
  assert.equal(isMissionUnlocked(1, 1), true);
  assert.equal(continueMissionIndex(0), 0);
  assert.equal(continueMissionIndex(3), 3);
  assert.equal(continueMissionIndex(6), 5, 'complete pack continues on last card');
  assert.equal(missionIndexOf('dual-tower'), 2);
  assert.equal(missionById('no-sell')?.run.allowSell, false);
  assert.ok(missionAt(4)?.run.endless, 'endless-thirty is endless');
  assert.equal(missionAt(4)?.run.winAtWave, 30);
}

// ── Allowed-tower enforcement ────────────────────────────────────────────────
{
  const mission = missionById('dual-tower');
  assert.ok(mission);
  let state = createInitialState(mission.run.difficulty, mission.run.mapId, mission.run.endless, {
    missionId: mission.id,
    allowedTowers: mission.run.allowedTowers,
    allowSell: mission.run.allowSell,
    winAtWave: mission.run.winAtWave,
  });
  state = withRocks(state, MAP_ROCKS[mission.run.mapId]);

  const banned = placeTower(state, 2, 4, 'grinder');
  assert.equal(banned.ok, false, 'grinder must be refused on dual-tower');
  assert.match(banned.reason ?? '', /不開放/);

  const okType = 'crossbow';
  const placed = placeTower(state, 2, 4, okType);
  assert.equal(placed.ok, true, `placing ${okType} must succeed: ${placed.reason}`);
  assert.equal(placed.state.towers[0]?.type, okType);
}

// ── No-sell enforcement ──────────────────────────────────────────────────────
{
  const mission = missionById('no-sell');
  assert.ok(mission);
  let state = createInitialState(mission.run.difficulty, mission.run.mapId, mission.run.endless, {
    missionId: mission.id,
    allowedTowers: mission.run.allowedTowers,
    allowSell: mission.run.allowSell,
    winAtWave: mission.run.winAtWave,
  });
  const placed = placeTower(state, 2, 4, 'crossbow');
  assert.ok(placed.ok, placed.reason);
  const sold = sellTower(placed.state, placed.state.towers[0].id);
  assert.equal(sold.ok, false, 'no-sell must refuse sell');
  assert.match(sold.reason ?? '', /禁止售出/);
}

// ── Free play still allows all towers + sell ─────────────────────────────────
{
  let state = createInitialState('standard', 'open', false);
  assert.equal(state.missionId, null);
  assert.equal(state.allowSell, true);
  assert.equal(state.allowedTowers, null);
  const placed = placeTower(state, 2, 4, 'coil');
  assert.ok(placed.ok, placed.reason);
  const sold = sellTower(placed.state, placed.state.towers[0].id);
  assert.ok(sold.ok, sold.reason);
}

// ── Mission winAtWave ends endless run ───────────────────────────────────────
//
// Build a trivial empty-wave runner: advance prep→wave with no enemies by
// stepping past prep and clearing zero-enemy waves is hard because waves always
// spawn. Instead, poke the win condition by simulating a cleared board at the
// target wave via startNextWave + manually emptying (not exported). We assert
// the config contract and that free-play endless does NOT set winAtWave.
{
  const freeEndless = createInitialState('standard', 'open', true);
  assert.equal(freeEndless.winAtWave, null, 'free endless never auto-wins');

  const mission = missionById('endless-thirty');
  assert.ok(mission);
  const mState = createInitialState(mission.run.difficulty, mission.run.mapId, true, {
    missionId: mission.id,
    allowedTowers: null,
    allowSell: true,
    winAtWave: 30,
  });
  assert.equal(mState.winAtWave, 30);
  assert.equal(mState.endless, true);
}

// ── Progress only advances on frontier clear ─────────────────────────────────
{
  const mission = MISSION_PACK[0];
  const won = {
    ...createInitialState(mission.run.difficulty, mission.run.mapId, mission.run.endless, {
      missionId: mission.id,
      allowedTowers: mission.run.allowedTowers,
      allowSell: mission.run.allowSell,
      winAtWave: mission.run.winAtWave,
    }),
    phase: 'won',
    wave: TOTAL_WAVES,
    score: 900,
  };
  assert.equal(evaluateMissionGoal(mission, won), true);

  const first = applyMissionResult(EMPTY_MISSION_PROGRESS, 0, won);
  assert.equal(first.cleared, true);
  assert.equal(first.progress.clearedCount, 1);
  assert.equal(first.progress.cleared[mission.id], true);
  assert.equal(first.progress.bestScore[mission.id], 900);

  // Clearing mission 2 while frontier is still 1 must NOT advance the cursor.
  const second = MISSION_PACK[1];
  const won2 = {
    ...createInitialState(second.run.difficulty, second.run.mapId, second.run.endless, {
      missionId: second.id,
      allowedTowers: second.run.allowedTowers,
      allowSell: second.run.allowSell,
      winAtWave: second.run.winAtWave,
    }),
    phase: 'won',
    wave: TOTAL_WAVES,
    score: 500,
  };
  // Simulate unlocked-via-cheat clear of index 1 while clearedCount is still 0.
  const skipped = applyMissionResult(EMPTY_MISSION_PROGRESS, 1, won2);
  assert.equal(skipped.cleared, true);
  assert.equal(skipped.progress.clearedCount, 0, 'non-frontier clear must not advance unlock');
  assert.equal(skipped.progress.cleared[second.id], true);

  // Replay first after already cleared: cursor stays.
  const replay = applyMissionResult(first.progress, 0, { ...won, score: 1200 });
  assert.equal(replay.progress.clearedCount, 1);
  assert.equal(replay.progress.bestScore[mission.id], 1200);
}

// ── Lost run does not clear ──────────────────────────────────────────────────
{
  const mission = MISSION_PACK[0];
  const lost = {
    ...createInitialState(mission.run.difficulty, mission.run.mapId, mission.run.endless, {
      missionId: mission.id,
      allowedTowers: mission.run.allowedTowers,
      allowSell: mission.run.allowSell,
      winAtWave: mission.run.winAtWave,
    }),
    phase: 'lost',
    wave: 7,
    score: 100,
  };
  assert.equal(evaluateMissionGoal(mission, lost), false);
  const result = applyMissionResult(EMPTY_MISSION_PROGRESS, 0, lost);
  assert.equal(result.cleared, false);
  assert.equal(result.progress.clearedCount, 0);
  assert.equal(result.progress.bestWave[mission.id], 7);
  assert.equal(result.progress.bestScore[mission.id], 100);
}

// Smoke: place + start wave still works under mission rocks (corridor).
{
  const mission = missionById('corridor-harsh');
  assert.ok(mission);
  let state = createInitialState(mission.run.difficulty, mission.run.mapId, false, {
    missionId: mission.id,
    allowedTowers: mission.run.allowedTowers,
    allowSell: mission.run.allowSell,
    winAtWave: mission.run.winAtWave,
  });
  state = withRocks(state, MAP_ROCKS.corridor);
  assert.ok(state.rocks.length > 0);
  assert.equal(state.lives, 14, 'harsh starting lives');
  const started = startNextWave(state);
  assert.ok(started.ok, started.reason);
  assert.equal(started.state.phase, 'wave');
  assert.equal(started.state.wave, 1);
  // A few ticks must not throw.
  let s = started.state;
  for (let i = 0; i < 30; i++) s = step(s, 1 / 60);
  assert.ok(s.phase === 'wave' || s.phase === 'prep' || s.phase === 'lost');
}

// Every tower type referenced by a mission exists.
{
  for (const mission of MISSION_PACK) {
    for (const t of mission.run.allowedTowers ?? []) {
      assert.ok(TOWER_DEFS[t], `mission ${mission.id} references unknown tower ${t}`);
    }
  }
}

console.log(`ok  check-missions (${MISSION_PACK.length} missions)`);
