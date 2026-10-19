/**
 * Branching upgrades + new maps + unlock gates.
 * Run via npm run check.
 */
import assert from 'node:assert/strict';
import {
  BRANCH_B_UNLOCK_CLEARS,
  MAP_ROCKS,
  MAP_UNLOCK_CLEARS,
  TOWER_DEFS,
} from './game/constants.ts';
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
import { ENTRANCE, EXIT } from './game/constants.ts';
import { computeFlowField, wouldSealExit, makeEmptyOccupancy } from './game/pathfinding.ts';

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

// New maps exist, unlock gates, and stay path-connected.
for (const mapId of ['fork', 'islands']) {
  assert.ok(MAP_ROCKS[mapId].length > 0, `${mapId} has rocks`);
  assert.ok(MAP_UNLOCK_CLEARS[mapId] > 0, `${mapId} is gated`);
  const occ = makeEmptyOccupancy(12, 8);
  for (const r of MAP_ROCKS[mapId]) occ[r.y][r.x] = true;
  const field = computeFlowField(occ, 12, 8, EXIT);
  assert.notEqual(
    field.distance[ENTRANCE.y][ENTRANCE.x],
    Infinity,
    `${mapId} entrance reaches exit`,
  );
  // Placing on a free mid cell must not always seal (sanity).
  assert.equal(wouldSealExit(occ, 1, 4, 12, 8, ENTRANCE, EXIT), false);
}

console.log('check-branches: ok');
