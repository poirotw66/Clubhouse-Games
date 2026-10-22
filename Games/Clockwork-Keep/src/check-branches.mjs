/**
 * Branching upgrades + new maps + unlock gates + new towers/enemies + daily.
 * Run via npm run check.
 */
import assert from 'node:assert/strict';
import {
  BRANCH_B_UNLOCK_CLEARS,
  ENEMY_DEFS,
  EXIT,
  MAP_ENTRANCES,
  MAP_ROCKS,
  MAP_UNLOCK_CLEARS,
  TOWER_DEFS,
} from './game/constants.ts';
import { dailyChallengeFor, hashString, todayKeyUTC8 } from './game/daily.ts';
import {
  branchUpgradeCost,
  cumulativeCost,
  isBranchUnlocked,
  purchaseCost,
  resolveTowerStats,
  sharedUpgradeCost,
} from './game/economy.ts';
import {
  createInitialState,
  placeTower,
  upgradeTower,
  withRocks,
} from './game/engine.ts';
import {
  allEntrancesReachExit,
  computeFlowField,
  wouldSealExit,
  makeEmptyOccupancy,
} from './game/pathfinding.ts';

assert.ok(TOWER_DEFS.hammer, 'hammer tower exists');
assert.ok(TOWER_DEFS.mortar, 'mortar tower exists');
assert.equal(TOWER_DEFS.hammer.targetsAir, false);
assert.equal(TOWER_DEFS.mortar.targetsAir, true);
assert.ok((TOWER_DEFS.hammer.levels[0].armorPierce ?? 0) > 0, 'hammer starts with pierce');
assert.ok((TOWER_DEFS.mortar.levels[0].splashRadius ?? TOWER_DEFS.mortar.splashRadius) > 0);

assert.ok(ENEMY_DEFS.bloater, 'bloater enemy exists');
assert.ok(ENEMY_DEFS.shellbug, 'shellbug enemy exists');
assert.equal(ENEMY_DEFS.bloater.armor, 0);
assert.ok(ENEMY_DEFS.bloater.hp > ENEMY_DEFS.grunt.hp);
assert.equal(ENEMY_DEFS.shellbug.flying, true);
assert.ok(ENEMY_DEFS.shellbug.armor > 0);

// Every tower has exactly two exclusive branches with distinct names/blurbs.
for (const type of Object.keys(TOWER_DEFS)) {
  const def = TOWER_DEFS[type];
  assert.equal(def.levels.length, 2, `${type} has shared L0+L1 only`);
  assert.equal(def.branches.length, 2, `${type} has two branches`);
  assert.equal(def.branches[0].id, 'a');
  assert.equal(def.branches[1].id, 'b');
  assert.ok(def.branches[0].name.length > 0 && def.branches[1].name.length > 0);
  assert.notEqual(def.branches[0].name, def.branches[1].name);
  assert.ok(def.branches[0].blurb.includes('——') || def.branches[0].blurb.length > 4);
  // Measurable tradeoff: branch stats differ on at least one combat axis.
  const a = def.branches[0].stats;
  const b = def.branches[1].stats;
  assert.ok(
    a.damage !== b.damage ||
      a.fireRate !== b.fireRate ||
      a.range !== b.range ||
      (a.splashRadius ?? def.splashRadius) !== (b.splashRadius ?? def.splashRadius) ||
      (a.chainTargets ?? def.chainTargets) !== (b.chainTargets ?? def.chainTargets) ||
      (a.slowPercent ?? def.slowPercent) !== (b.slowPercent ?? def.slowPercent) ||
      (a.armorPierce ?? 0) !== (b.armorPierce ?? 0),
    `${type} branches must differ in combat stats`,
  );
}

assert.equal(isBranchUnlocked('a', 0), true);
assert.equal(isBranchUnlocked('b', BRANCH_B_UNLOCK_CLEARS - 1), false);
assert.equal(isBranchUnlocked('b', BRANCH_B_UNLOCK_CLEARS), true);

// Engine: shared upgrade then exclusive branch choice.
{
  let state = createInitialState('standard', 'open', false);
  state = withRocks(state, MAP_ROCKS.open);
  state = { ...state, gold: 9999 };
  const placed = placeTower(state, 3, 4, 'crossbow');
  assert.equal(placed.ok, true, placed.reason);
  state = placed.state;
  const t0 = state.towers[0];
  assert.equal(t0.level, 0);
  assert.equal(t0.branch, null);

  const shared = upgradeTower(state, t0.id);
  assert.equal(shared.ok, true, shared.reason);
  state = shared.state;
  assert.equal(state.towers[0].level, 1);

  const needBranch = upgradeTower(state, t0.id);
  assert.equal(needBranch.ok, false, 'L1→L2 without branch must fail');

  const branched = upgradeTower(state, t0.id, 'a');
  assert.equal(branched.ok, true, branched.reason);
  assert.equal(branched.state.towers[0].level, 2);
  assert.equal(branched.state.towers[0].branch, 'a');
  const stats = resolveTowerStats(branched.state.towers[0]);
  assert.equal(stats.damage, TOWER_DEFS.crossbow.branches[0].stats.damage);
}

assert.equal(sharedUpgradeCost('grinder', 0), TOWER_DEFS.grinder.levels[1].cost);
assert.equal(branchUpgradeCost('frost', 'b'), TOWER_DEFS.frost.branches[1].stats.cost);
assert.equal(
  cumulativeCost('coil', 2, 'b'),
  purchaseCost('coil') + TOWER_DEFS.coil.levels[1].cost + branchUpgradeCost('coil', 'b'),
);

// Gated maps exist, unlock, and stay path-connected from every entrance.
for (const mapId of ['fork', 'islands', 'dual', 'gauntlet']) {
  assert.ok(MAP_ROCKS[mapId].length > 0, `${mapId} has rocks`);
  assert.ok(MAP_UNLOCK_CLEARS[mapId] > 0, `${mapId} is gated`);
  const entrances = MAP_ENTRANCES[mapId];
  assert.ok(entrances.length >= 1, `${mapId} has entrances`);
  const occ = makeEmptyOccupancy(12, 8);
  for (const r of MAP_ROCKS[mapId]) occ[r.y][r.x] = true;
  assert.equal(
    allEntrancesReachExit(occ, entrances, 12, 8, EXIT),
    true,
    `${mapId} all entrances reach exit`,
  );
  assert.equal(wouldSealExit(occ, 1, 4, 12, 8, entrances, EXIT), false);
}

// Dual map: two entrances; sealing one lane is illegal.
{
  const entrances = MAP_ENTRANCES.dual;
  assert.equal(entrances.length, 2, 'dual has two entrances');
  const occ = makeEmptyOccupancy(12, 8);
  for (const r of MAP_ROCKS.dual) occ[r.y][r.x] = true;
  let state = createInitialState('standard', 'dual', false);
  state = withRocks(state, MAP_ROCKS.dual);
  state = { ...state, gold: 9999 };
  // Must not place on an entrance cell.
  const onPortal = placeTower(state, entrances[0].x, entrances[0].y, 'crossbow');
  assert.equal(onPortal.ok, false, 'cannot place on entrance');
}

// Daily challenge is deterministic per date.
{
  const a = dailyChallengeFor('2026-10-21');
  const b = dailyChallengeFor('2026-10-21');
  assert.deepEqual(a, b, 'same date → identical daily challenge');
  const c = dailyChallengeFor('2026-10-22');
  assert.notEqual(JSON.stringify(a), JSON.stringify(c), 'different dates usually differ');
  assert.ok(MAP_ROCKS[a.mapId], 'daily map is valid');
  assert.ok(a.affixIds.length >= 1 && a.affixIds.length <= 2);
  assert.equal(hashString('x'), hashString('x'));
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(todayKeyUTC8(new Date('2026-10-21T12:00:00Z'))));
}

console.log('check-branches: ok');
