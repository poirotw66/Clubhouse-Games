/**
 * Headless checks for the maze pathfinding rules:
 *  - BFS shortest-path correctness (including a hand-verified fixture)
 *  - the "no sealing the exit" placement rule, and that it costs no gold
 *  - a legal placement is accepted and does change the path
 *  - flying enemies ignore the maze entirely and fly straight
 *
 * Run: node --experimental-strip-types src/check-pathing.mjs
 */
import assert from 'node:assert/strict';
import { ENTRANCE, EXIT, GRID_H, GRID_W } from './game/constants.ts';
import {
  computeFlowField,
  makeEmptyOccupancy,
  pathLength,
  reconstructPath,
  wouldSealExit,
} from './game/pathfinding.ts';
import { createInitialState, placeTower, step } from './game/engine.ts';

// ── 1) BFS shortest path on the real 12x8 board ─────────────────────────────
{
  const empty = makeEmptyOccupancy(GRID_W, GRID_H);
  const dist = pathLength(empty, GRID_W, GRID_H, ENTRANCE, EXIT);
  assert.equal(dist, GRID_W - 1, `empty board should be a straight ${GRID_W - 1}-step line, got ${dist}`);

  const path = reconstructPath(empty, GRID_W, GRID_H, ENTRANCE, EXIT);
  assert.ok(path, 'reconstructPath should find a path on an empty board');
  assert.equal(path.length, GRID_W, 'path should visit exactly GRID_W cells (11 steps = 12 cells)');
  assert.deepEqual(path[0], { x: ENTRANCE.x, y: ENTRANCE.y });
  assert.deepEqual(path[path.length - 1], { x: EXIT.x, y: EXIT.y });
}

// ── 2) Determinism: repeated BFS on the same grid gives the identical field ─
{
  const grid = makeEmptyOccupancy(GRID_W, GRID_H);
  grid[3][5] = true;
  grid[5][5] = true;
  const a = computeFlowField(grid, GRID_W, GRID_H, EXIT);
  const b = computeFlowField(grid, GRID_W, GRID_H, EXIT);
  assert.deepEqual(a.distance, b.distance, 'BFS distance field must be reproducible');
  const pathA = reconstructPath(grid, GRID_W, GRID_H, ENTRANCE, EXIT);
  const pathB = reconstructPath(grid, GRID_W, GRID_H, ENTRANCE, EXIT);
  assert.deepEqual(pathA, pathB, 'reconstructed path must be identical across runs (fixed direction priority)');
}

// ── 3) Known fixture: hand-verified path length change on a small grid ─────
{
  // 5x3 grid, entrance (0,1) -> exit (4,1). Empty: straight line, 4 steps.
  const w = 5;
  const h = 3;
  const entrance = { x: 0, y: 1 };
  const exit = { x: 4, y: 1 };
  const empty = makeEmptyOccupancy(w, h);
  const baseline = pathLength(empty, w, h, entrance, exit);
  assert.equal(baseline, 4, `5x3 empty fixture should be 4 steps, got ${baseline}`);

  // Block column x=2 at rows 1 and 2, leaving only row 0 open as a detour.
  // Shortest route must be 4 (horizontal span) + 2 (one up-and-down detour) = 6.
  const detour = makeEmptyOccupancy(w, h);
  detour[1][2] = true;
  detour[2][2] = true;
  const detourDist = pathLength(detour, w, h, entrance, exit);
  assert.equal(detourDist, 6, `fixture detour should add exactly 2 steps, got ${detourDist}`);
}

// ── 4) Sealing the exit is rejected, and costs no gold ──────────────────────
{
  let state = createInitialState('standard', 'open', false);
  state = { ...state, gold: 1000 }; // enough to build a full column of blockers for the test

  // Wall off the entire column x=5 except one gap, then try to close the gap.
  for (let y = 0; y < state.gridH; y++) {
    if (y === 3) continue; // leave a gap open for now
    const r = placeTower(state, 5, y, 'crossbow');
    assert.ok(r.ok, `setup placement at (5,${y}) should succeed`);
    state = r.state;
  }
  const goldBeforeSeal = state.gold;

  const sealAttempt = placeTower(state, 5, 3, 'crossbow'); // closes the only gap
  assert.equal(sealAttempt.ok, false, 'placing the last blocker to seal the exit must be rejected');
  assert.equal(sealAttempt.state, state, 'a rejected placement must return the exact same state object');
  assert.equal(sealAttempt.state.gold, goldBeforeSeal, 'a rejected placement must not spend gold');
  assert.equal(sealAttempt.state.towers.length, state.towers.length, 'a rejected placement must not add a tower');
}

// ── 5) A legal placement is accepted and lengthens the path ────────────────
{
  let state = createInitialState('standard', 'open', false);
  const before = pathLength(
    (() => {
      const g = makeEmptyOccupancy(state.gridW, state.gridH);
      for (const r of state.rocks) g[r.y][r.x] = true;
      return g;
    })(),
    state.gridW,
    state.gridH,
    ENTRANCE,
    EXIT,
  );

  const r = placeTower(state, 5, 4, 'crossbow'); // sits on the straight baseline path, not sealing anything
  assert.ok(r.ok, 'a single blocker off to the side of an open board must be legal');
  state = r.state;
  assert.equal(state.towers.length, 1);
  assert.ok(state.gold < 200, 'gold must be spent on a legal placement');

  const occupancy = makeEmptyOccupancy(state.gridW, state.gridH);
  for (const t of state.towers) occupancy[t.y][t.x] = true;
  const after = pathLength(occupancy, state.gridW, state.gridH, ENTRANCE, EXIT);
  assert.ok(after > before, `blocking the straight line should force a detour: before=${before} after=${after}`);
}

// ── 6) Flyers ignore the maze and travel in a straight line ────────────────
{
  let state = createInitialState('standard', 'open', false);
  // Wall off nearly the whole board with a dense maze — flyers must not care.
  for (let x = 2; x < state.gridW - 2; x += 2) {
    for (let y = 0; y < state.gridH; y++) {
      if (y === 4) continue; // keep one ground gap so the state stays legal
      const r = placeTower(state, x, y, 'crossbow');
      if (r.ok) state = r.state;
    }
  }

  state = { ...state, phase: 'wave', pendingSpawns: [{ type: 'kite', delaySec: 0 }], waveElapsed: 0 };
  const dt = 1 / 60;
  let steps = 0;
  let everSawKite = false;
  let vanished = false; // the kite is removed from state.enemies the instant it reaches the exit
  while (steps < 600 && !vanished) {
    state = step(state, dt);
    const kite = state.enemies.find((e) => e.type === 'kite');
    if (kite) {
      everSawKite = true;
      // Must stay exactly on the straight entrance->exit line (constant y),
      // regardless of the dense maze of towers occupying that row's neighbors.
      assert.ok(
        Math.abs(kite.worldY - (ENTRANCE.y + 0.5)) < 1e-9,
        `flyer drifted off the straight line: y=${kite.worldY}`,
      );
    } else if (everSawKite) {
      vanished = true; // only disappears by reaching the exit — nothing else removes it here
    }
    steps += 1;
  }
  assert.ok(everSawKite, 'kite enemy should have spawned');
  assert.ok(vanished, 'kite should reach the exit (and be removed) well within the simulated window');
  assert.ok(steps < 600, 'kite should not need the full simulated window to cross');
}

// ── 7) Dynamic serpentine maze construction without obstruction deadlock ───
{
  let state = createInitialState('standard', 'open', false);
  state = { ...state, gold: 9999 };

  // Sequentially build an alternating comb / serpentine labyrinth.
  // Each placed gear barricade must dynamically lengthen the BFS shortest path
  // without triggering a false exit seal or causing path obstruction deadlocks.
  const initialDist = pathLength(
    makeEmptyOccupancy(state.gridW, state.gridH),
    state.gridW,
    state.gridH,
    ENTRANCE,
    EXIT,
  );
  assert.equal(initialDist, 11);

  const barricades = [
    { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 2, y: 3 }, { x: 2, y: 4 }, { x: 2, y: 5 }, { x: 2, y: 6 },
    { x: 4, y: 1 }, { x: 4, y: 2 }, { x: 4, y: 3 }, { x: 4, y: 4 }, { x: 4, y: 5 }, { x: 4, y: 7 },
    { x: 6, y: 0 }, { x: 6, y: 2 }, { x: 6, y: 3 }, { x: 6, y: 4 }, { x: 6, y: 5 }, { x: 6, y: 6 },
    { x: 8, y: 1 }, { x: 8, y: 2 }, { x: 8, y: 3 }, { x: 8, y: 4 }, { x: 8, y: 5 }, { x: 8, y: 7 },
  ];

  let prevLength = initialDist;
  for (const b of barricades) {
    const r = placeTower(state, b.x, b.y, 'crossbow');
    assert.ok(r.ok, `placing barricade at (${b.x},${b.y}) should succeed: ${r.reason}`);
    state = r.state;

    const occ = makeEmptyOccupancy(state.gridW, state.gridH);
    for (const t of state.towers) occ[t.y][t.x] = true;
    const curLength = pathLength(occ, state.gridW, state.gridH, ENTRANCE, EXIT);
    assert.ok(curLength >= prevLength, `path length must never decrease during maze walling: was ${prevLength}, now ${curLength}`);
    assert.ok(curLength !== Infinity, 'maze must remain path-connected');
    prevLength = curLength;
  }
  assert.ok(prevLength >= 19, `serpentine maze should extend path from 11 to >= 19 steps, got ${prevLength}`);
  assert.ok(prevLength > initialDist, 'path must be significantly lengthened by labyrinth walls');
}

// ── 8) Dual-portal anti-deadlock invariant ──────────────────────────────────
{
  // On a dual-portal map, barricades must preserve valid routes for BOTH entrances.
  const occ = makeEmptyOccupancy(12, 8);
  const dualEntrances = [{ x: 0, y: 1 }, { x: 0, y: 6 }];
  const exit = { x: 11, y: 4 };

  // Close upper entrance corridor completely except at (1, 1)
  occ[0][0] = true;
  occ[2][0] = true;

  // Placing at (1, 1) would seal the upper portal while lower portal remains wide open.
  // The placement rule must reject this to prevent upper-entrance enemy deadlock!
  const sealsUpper = wouldSealExit(occ, 1, 1, 12, 8, dualEntrances, exit);
  assert.equal(sealsUpper, true, 'sealing the upper portal while lower portal is open must be detected as an exit seal');

  // Verify that an open placement is accepted
  const openPlacement = wouldSealExit(occ, 5, 4, 12, 8, dualEntrances, exit);
  assert.equal(openPlacement, false, 'central barricade leaving both lanes open must not seal');
}

// ── 9) Dynamic A* heuristic admissibility and consistency ──────────────────
{
  const occ = makeEmptyOccupancy(GRID_W, GRID_H);
  // Place sparse obstacles
  occ[2][3] = true;
  occ[3][3] = true;
  occ[4][3] = true;
  occ[4][7] = true;
  occ[5][7] = true;

  const field = computeFlowField(occ, GRID_W, GRID_H, EXIT);

  // Check every walkable cell: Manhattan distance to exit must be <= BFS true distance (admissible)
  // and for adjacent cells |h(u) - h(v)| <= 1 (consistent)
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      if (occ[y][x]) continue;
      const trueDist = field.distance[y][x];
      if (trueDist === Infinity) continue;

      const manhattanH = Math.abs(x - EXIT.x) + Math.abs(y - EXIT.y);
      assert.ok(
        manhattanH <= trueDist,
        `Manhattan heuristic must be admissible (h <= trueDist): at (${x},${y}) h=${manhattanH}, dist=${trueDist}`,
      );

      // Check consistency with neighbors
      for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H && !occ[ny][nx]) {
          const neighborH = Math.abs(nx - EXIT.x) + Math.abs(ny - EXIT.y);
          assert.ok(
            Math.abs(manhattanH - neighborH) <= 1,
            'Manhattan heuristic must be consistent (|h(u) - h(v)| <= 1)',
          );
        }
      }
    }
  }
}

console.log('check-pathing: ok');
