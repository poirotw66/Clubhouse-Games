import assert from 'node:assert/strict';
import {
  BOARD_SIZES,
  canMultiSlide,
  cellCount,
  countInPlace,
  emptyIndex,
  goalIndex,
  harmonyPct,
  hintTileIndex,
  isSolvable,
  isSolved,
  manhattanSum,
  multiSlide,
  neighborsOfEmpty,
  PAR_LABEL,
  parGrade,
  scrambleBoard,
  scrambleFromSeed,
  scrambleSlideCount,
  shuffledBoard,
  slide,
  slideByDirection,
  solvedBoard,
  THEME_CONFIGS,
  tileManhattan,
} from './fifteenLogic.ts';
import { applyPath, heuristic, linearConflict, optimalMoves, solvePuzzle } from './solver.ts';
import {
  CAMPAIGN_STAGES,
  applyStageClear,
  continueStageIndex,
  isStageUnlocked,
  moveLimitFor,
  stageSeed,
} from './campaign.ts';
import { computeStreak, dailyConfig, dailySeedNumber, dateKey } from './daily.ts';
import { createRng, hashString } from './rng.ts';

// ============================================================================
// Section 1: Core Board Invariants & Geometry Across All Board Sizes (3, 4, 5, 6)
// ============================================================================

for (const size of BOARD_SIZES) {
  const totalCells = cellCount(size);
  assert.equal(totalCells, size * size);

  const solved = solvedBoard(size);
  assert.equal(solved.length, totalCells);
  assert.ok(isSolved(solved, size));
  assert.ok(isSolvable(solved, size));
  assert.equal(emptyIndex(solved), totalCells - 1);
  assert.equal(manhattanSum(solved, size), 0);
  assert.equal(linearConflict(solved, size), 0);
  assert.equal(heuristic(solved, size), 0);
  assert.equal(hintTileIndex(solved, size), null);

  // In-place tile count & harmony percentage
  assert.equal(countInPlace(solved, size), totalCells - 1);
  assert.equal(harmonyPct(solved, size), 100);

  // Solved goalIndex mapping verification
  for (let tile = 1; tile < totalCells; tile++) {
    assert.equal(goalIndex(tile), tile - 1);
    assert.equal(tileManhattan(tile, tile - 1, size), 0);
  }

  // Single step slide from bottom-right corner
  const leftNeighborIdx = totalCells - 2;
  const one = slide(solved, leftNeighborIdx, size);
  assert.ok(one);
  assert.equal(emptyIndex(one), leftNeighborIdx);
  assert.equal(one[totalCells - 1], totalCells - 1);
  assert.equal(one[leftNeighborIdx], null);
  assert.ok(manhattanSum(one, size) > 0);
  assert.equal(countInPlace(one, size), totalCells - 2);
  assert.equal(hintTileIndex(one, size), totalCells - 1);

  // Undo by direction swipe
  const back = slideByDirection(one, size, 'left');
  assert.ok(back);
  assert.ok(isSolved(back, size));

  // Neighbors of empty tile at corner vs interior
  const cornerNeighbors = neighborsOfEmpty(solved, size);
  assert.equal(cornerNeighbors.length, 2);
  assert.ok(cornerNeighbors.includes(totalCells - 2));
  assert.ok(cornerNeighbors.includes(totalCells - 1 - size));
}

// ============================================================================
// Section 2: Multi-Tile Slide Mechanics Across All Board Sizes (3, 4, 5, 6)
// ============================================================================

for (const size of BOARD_SIZES) {
  const total = cellCount(size);
  const solved = solvedBoard(size);

  // --- Row Multi-Slide: Left-to-Right push toward empty at bottom-right corner ---
  // On solved board, empty is at (size - 1, size - 1).
  // Click far-left tile in the bottom row: (size - 1, 0)
  const farLeftBottomIdx = (size - 1) * size;
  assert.equal(canMultiSlide(solved, farLeftBottomIdx, size), true);

  const rowPushRes = multiSlide(solved, farLeftBottomIdx, size);
  assert.ok(rowPushRes);
  assert.equal(rowPushRes.movedCount, size - 1);
  assert.equal(rowPushRes.movedIndices.length, size - 1);

  // Verify chain translation order and shifted tile values
  const rowNext = rowPushRes.nextBoard;
  assert.equal(emptyIndex(rowNext), farLeftBottomIdx);
  for (let c = 0; c < size - 1; c++) {
    const originalTileValue = solved[(size - 1) * size + c];
    const newIdx = (size - 1) * size + (c + 1);
    assert.equal(rowNext[newIdx], originalTileValue);
  }
  // Untouched rows remain identical
  for (let i = 0; i < (size - 1) * size; i++) {
    assert.equal(rowNext[i], solved[i]);
  }
  assert.ok(isSolvable(rowNext, size));

  // Push back: Right-to-Left push restores the bottom row
  const farRightBottomIdx = total - 1;
  assert.equal(canMultiSlide(rowNext, farRightBottomIdx, size), true);
  const rowPushBackRes = multiSlide(rowNext, farRightBottomIdx, size);
  assert.ok(rowPushBackRes);
  assert.equal(rowPushBackRes.movedCount, size - 1);
  assert.ok(isSolved(rowPushBackRes.nextBoard, size));

  // --- Column Multi-Slide: Top-to-Bottom push toward empty at bottom-right corner ---
  // Click top tile in the rightmost column: (0, size - 1)
  const topFarRightIdx = size - 1;
  assert.equal(canMultiSlide(solved, topFarRightIdx, size), true);

  const colPushRes = multiSlide(solved, topFarRightIdx, size);
  assert.ok(colPushRes);
  assert.equal(colPushRes.movedCount, size - 1);
  assert.equal(colPushRes.movedIndices.length, size - 1);

  const colNext = colPushRes.nextBoard;
  assert.equal(emptyIndex(colNext), topFarRightIdx);
  for (let r = 0; r < size - 1; r++) {
    const originalTileValue = solved[r * size + (size - 1)];
    const newIdx = (r + 1) * size + (size - 1);
    assert.equal(colNext[newIdx], originalTileValue);
  }
  // Untouched columns remain identical
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size - 1; c++) {
      const idx = r * size + c;
      assert.equal(colNext[idx], solved[idx]);
    }
  }
  assert.ok(isSolvable(colNext, size));

  // Push back: Bottom-to-Top restores the column
  const colPushBackRes = multiSlide(colNext, total - 1, size);
  assert.ok(colPushBackRes);
  assert.equal(colPushBackRes.movedCount, size - 1);
  assert.ok(isSolved(colPushBackRes.nextBoard, size));

  // --- Partial Multi-Tile Slide (sizes 4, 5, 6) ---
  if (size >= 4) {
    // Empty at (size - 1, size - 1). Click tile 2 columns to the left: (size - 1, size - 3).
    // Exactly 2 tiles should move; tiles further to the left must remain untouched.
    const partialTileIdx = (size - 1) * size + (size - 3);
    const partialRes = multiSlide(solved, partialTileIdx, size);
    assert.ok(partialRes);
    assert.equal(partialRes.movedCount, 2);
    assert.equal(emptyIndex(partialRes.nextBoard), partialTileIdx);

    // Leftmost tile in the row was NOT in the sliding segment and must not move
    assert.equal(partialRes.nextBoard[farLeftBottomIdx], solved[farLeftBottomIdx]);
  }

  // --- Equivalence of 1-tile multiSlide with standard slide ---
  for (const neighborIdx of neighborsOfEmpty(solved, size)) {
    const standardSlide = slide(solved, neighborIdx, size);
    const singleMulti = multiSlide(solved, neighborIdx, size);
    assert.ok(standardSlide);
    assert.ok(singleMulti);
    assert.equal(singleMulti.movedCount, 1);
    assert.deepEqual(singleMulti.movedIndices, [neighborIdx]);
    assert.deepEqual(singleMulti.nextBoard, standardSlide);
  }

  // --- Non-Sliding Tiles: Tiles not sharing row or col with empty cannot slide ---
  // When empty is at bottom-right (size - 1, size - 1), any tile with row < size - 1 AND col < size - 1 cannot slide.
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const nonSlidingIdx = r * size + c;
      assert.equal(canMultiSlide(solved, nonSlidingIdx, size), false);
      assert.equal(multiSlide(solved, nonSlidingIdx, size), null);
    }
  }

  // --- Boundary Collisions & Invalid Coordinates ---
  assert.equal(canMultiSlide(solved, -1, size), false);
  assert.equal(canMultiSlide(solved, -99, size), false);
  assert.equal(canMultiSlide(solved, total, size), false);
  assert.equal(canMultiSlide(solved, total + 10, size), false);
  assert.equal(canMultiSlide(solved, emptyIndex(solved), size), false);

  assert.equal(multiSlide(solved, -1, size), null);
  assert.equal(multiSlide(solved, total, size), null);
  assert.equal(multiSlide(solved, emptyIndex(solved), size), null);

  // Tile set conservation invariant under repeated multi-slides
  let permBoard = solved;
  const samplePushes = [farLeftBottomIdx, total - 1, topFarRightIdx, total - 1];
  for (const pIdx of samplePushes) {
    const res = multiSlide(permBoard, pIdx, size);
    if (res) permBoard = res.nextBoard;
  }
  const tileSet = new Set(permBoard);
  assert.equal(tileSet.size, total);
  assert.ok(tileSet.has(null));
  for (let v = 1; v < total; v++) assert.ok(tileSet.has(v));
}

// ============================================================================
// Section 3: IDA* Solver, Heuristic Admissibility & Edge Cases
// ============================================================================

// --- Heuristic Admissibility & Monotonicity ---
for (const size of [3, 4]) {
  const solved = solvedBoard(size);
  assert.equal(manhattanSum(solved, size), 0);
  assert.equal(linearConflict(solved, size), 0);
  assert.equal(heuristic(solved, size), 0);

  // Single legal moves change Manhattan distance by exactly 1
  for (const neighbor of neighborsOfEmpty(solved, size)) {
    const next = slide(solved, neighbor, size);
    assert.ok(next);
    const mDelta = Math.abs(manhattanSum(next, size) - manhattanSum(solved, size));
    assert.equal(mDelta, 1);
    assert.ok(linearConflict(next, size) >= 0);
    assert.equal(linearConflict(next, size) % 2, 0); // Linear conflict is always an even integer
    assert.ok(heuristic(next, size) >= manhattanSum(next, size));
  }
}

// --- Linear Conflict Corner & Permutation Configurations ---
{
  // 1. Row Linear Conflict on 3×3:
  // Row 0 has tiles 2 and 1 (both have goal row 0, but inverted order).
  // Board: [2, 1, 3, 4, 5, 6, 7, 8, null]
  const rowConflictBoard = [2, 1, 3, 4, 5, 6, 7, 8, null];
  assert.equal(linearConflict(rowConflictBoard, 3), 2);
  assert.equal(manhattanSum(rowConflictBoard, 3), 2);
  assert.equal(heuristic(rowConflictBoard, 3), 4);

  // 2. Column Linear Conflict on 3×3:
  // Col 0 has tile 4 at row 0 and tile 1 at row 1 (both have goal col 0, but inverted).
  // Board: [4, 2, 3, 1, 5, 6, 7, 8, null]
  const colConflictBoard = [4, 2, 3, 1, 5, 6, 7, 8, null];
  assert.equal(linearConflict(colConflictBoard, 3), 2);
  assert.equal(manhattanSum(colConflictBoard, 3), 2);
  assert.equal(heuristic(colConflictBoard, 3), 4);

  // 3. Simultaneous Row & Column Conflicts:
  // Row 0 has (2, 1, 3) -> conflict between 2 and 1 (+2)
  // Col 2 has (3, 6, 9-out-of-range) -> let's invert col 1 with tiles 5 and 2?
  // Row 0: tiles 2, 1, 3 (conflict 2-1 in row 0)
  // Col 2: tiles 3 at (0, 2), 6 at (1, 2) is solved order.
  // Invert Col 2: put 6 at (0, 2) and 3 at (1, 2) -> conflict between 6 and 3 in col 2!
  // Board: [2, 1, 6, 4, 5, 3, 7, 8, null]
  const dualConflictBoard = [2, 1, 6, 4, 5, 3, 7, 8, null];
  assert.equal(linearConflict(dualConflictBoard, 3), 4); // 2 from row 0 + 2 from col 2

  // 4. Multiple conflicts in a single row (3 inverted tiles: 3, 2, 1 in row 0)
  // Inversions in row 0: (3, 2), (3, 1), (2, 1) = 3 conflicts -> penalty = 6
  const tripleConflictBoard = [3, 2, 1, 4, 5, 6, 7, 8, null];
  assert.equal(linearConflict(tripleConflictBoard, 3), 6);

  // 5. Inverted tiles NOT in their goal row/col contribute 0 linear conflict
  // Row 0 contains tiles 4 and 5 swapped [5, 4, 3, 1, 2, 6, 7, 8, null].
  // Tiles 5 and 4 belong to row 1, not row 0!
  const offGoalBoard = [5, 4, 3, 1, 2, 6, 7, 8, null];
  // Row 0 has tile 3 in place, and tiles 5, 4 (not in goal row 0).
  // Row 1 has tiles 1, 2, 6 (tiles 1, 2 belong to row 0).
  // No tiles in row 0 belong to row 0 together in conflict.
  assert.equal(linearConflict(offGoalBoard, 3), 0);
}

// --- Unsolvable Board Detection & Parity Invariants ---
for (const size of BOARD_SIZES) {
  const solved = solvedBoard(size);
  assert.ok(isSolvable(solved, size));

  // Swap two adjacent numbered tiles (1 and 2 at indices 0 and 1)
  // This introduces exactly 1 inversion without changing the empty tile's row.
  const unsolvable = solved.slice();
  unsolvable[0] = solved[1];
  unsolvable[1] = solved[0];
  assert.equal(isSolvable(unsolvable, size), false, `Size ${size} with 1 swap must be unsolvable`);

  // Swap another pair of tiles (3 and 4 at indices 2 and 3) to restore even parity
  unsolvable[2] = solved[3];
  unsolvable[3] = solved[2];
  assert.equal(isSolvable(unsolvable, size), true, `Size ${size} with 2 swaps must be solvable`);

  // Legal slides must strictly preserve solvability invariant
  let testBoard = solved;
  let rngSeed = 42;
  for (let step = 0; step < 30; step++) {
    const opts = neighborsOfEmpty(testBoard, size);
    rngSeed = (rngSeed * 1664525 + 1013904223) >>> 0;
    const pick = opts[rngSeed % opts.length];
    testBoard = slide(testBoard, pick, size);
    assert.ok(testBoard);
    assert.equal(isSolvable(testBoard, size), true, `Step ${step} on size ${size} must remain solvable`);
  }
}

// --- Optimal Move Bounds & Solver Truncation ---
{
  const size = 3;
  const solved = solvedBoard(size);

  // Solved board
  const zeroRes = solvePuzzle(solved, size);
  assert.equal(zeroRes.moves, 0);
  assert.equal(zeroRes.exact, true);
  assert.deepEqual(zeroRes.path, []);

  // 1-move board: all neighbors
  for (const nIdx of neighborsOfEmpty(solved, size)) {
    const b = slide(solved, nIdx, size);
    assert.ok(b);
    const res = solvePuzzle(b, size);
    assert.equal(res.moves, 1);
    assert.equal(res.exact, true);
    assert.deepEqual(res.path, [emptyIndex(solved)]);
    assert.ok(isSolved(applyPath(b, size, res.path), size));
  }

  // 2-step solution
  let b2 = slideByDirection(solved, size, 'right');
  assert.ok(b2);
  b2 = slideByDirection(b2, size, 'right');
  assert.ok(b2);
  const res2 = solvePuzzle(b2, size, { upperBound: 5, maxNodes: 50_000, timeMs: 150 });
  assert.equal(res2.moves, 2);
  assert.equal(res2.exact, true);
  assert.ok(res2.path);
  assert.ok(isSolved(applyPath(b2, size, res2.path), size));

  // Solver bounds & budget exhaustion handling
  // Upper bound smaller than actual distance forces fallback
  const boundedRes = solvePuzzle(b2, size, { upperBound: 1, maxNodes: 1000, timeMs: 50 });
  assert.equal(boundedRes.exact, false);
  assert.equal(boundedRes.moves, 1); // Returns upperBound fallback

  // maxNodes budget exhaustion terminates gracefully
  const exhaustedRes = solvePuzzle(b2, size, { maxNodes: 1, timeMs: 50 });
  assert.equal(exhaustedRes.exact, false);

  // Deep board with tight budget terminates gracefully
  const hardBoard = scrambleFromSeed(4, 'hard', 42).board;
  const timeoutRes = solvePuzzle(hardBoard, 4, { maxNodes: 50, timeMs: 1 });
  assert.equal(timeoutRes.exact, false);

  // applyPath error on illegal slide
  assert.throws(() => {
    applyPath(solved, size, [0]); // 0 is top-left, empty is bottom-right -> illegal slide
  }, /illegal slide/);
}

// --- Seeded Scramble & Random Solvability Sample ---
{
  const a = scrambleFromSeed(4, 'normal', hashString('fp-seed-test'));
  const b = scrambleFromSeed(4, 'normal', hashString('fp-seed-test'));
  assert.deepEqual(a.board, b.board);
  assert.equal(a.scrambleMoves, scrambleSlideCount(4, 'normal'));
  assert.ok(isSolvable(a.board, 4));
  assert.ok(!isSolved(a.board, 4));

  let seed = 12345;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };

  for (const size of [3, 4]) {
    for (let i = 0; i < 8; i++) {
      const shuf = shuffledBoard(size, rand);
      assert.ok(isSolvable(shuf, size));
      assert.ok(!isSolved(shuf, size));
      const hint = hintTileIndex(shuf, size);
      assert.ok(hint !== null);
      assert.ok(neighborsOfEmpty(shuf, size).includes(hint));
    }
  }

  for (const size of BOARD_SIZES) {
    for (const tier of ['easy', 'normal', 'hard']) {
      for (let i = 0; i < 2; i++) {
        const { board } = scrambleBoard(size, /** @type {any} */ (tier), rand);
        assert.ok(isSolvable(board, size));
        assert.ok(!isSolved(board, size));
      }
    }
  }
}

// ============================================================================
// Section 4: Sound & Mechanical Audio Unit Tests
// ============================================================================

{
  // Setup Mock Web Audio and Web Storage environment before importing mechanicalAudio
  const createdOscs = [];
  const createdGains = [];
  const vibrateCalls = [];

  class MockAudioParam {
    constructor() {
      this.value = 0;
      this.events = [];
    }
    setValueAtTime(v, t) {
      this.events.push({ type: 'set', val: v, time: t });
      this.value = v;
    }
    linearRampToValueAtTime(v, t) {
      this.events.push({ type: 'linear', val: v, time: t });
      this.value = v;
    }
    exponentialRampToValueAtTime(v, t) {
      this.events.push({ type: 'expo', val: v, time: t });
      this.value = v;
    }
  }

  class MockOscillator {
    constructor() {
      this.type = 'sine';
      this.frequency = new MockAudioParam();
      createdOscs.push(this);
    }
    connect(dest) {
      this.dest = dest;
    }
    start(t) {
      this.startTime = t;
    }
    stop(t) {
      this.stopTime = t;
    }
  }

  class MockGain {
    constructor() {
      this.gain = new MockAudioParam();
      createdGains.push(this);
    }
    connect(dest) {
      this.dest = dest;
    }
  }

  class MockAudioContext {
    constructor() {
      this.currentTime = 1.0;
      this.state = 'running';
      this.destination = {};
    }
    createOscillator() {
      return new MockOscillator();
    }
    createGain() {
      return new MockGain();
    }
    resume() {
      return Promise.resolve();
    }
  }

  const memoryStore = new Map();
  const mockStorage = {
    getItem(k) {
      return memoryStore.get(k) ?? null;
    },
    setItem(k, v) {
      memoryStore.set(k, String(v));
    },
    removeItem(k) {
      memoryStore.delete(k);
    },
    clear() {
      memoryStore.clear();
    },
  };

  globalThis.window = {
    AudioContext: MockAudioContext,
  };
  globalThis.localStorage = mockStorage;

  try {
    Object.defineProperty(globalThis.navigator, 'vibrate', {
      value: (pattern) => {
        vibrateCalls.push(pattern);
        return true;
      },
      configurable: true,
      writable: true,
    });
  } catch {
    /* ignore navigator defineProperty issues in non-configurable environments */
  }

  const audio = await import('./mechanicalAudio.ts');

  // 1. Initial State & Preference Toggles
  assert.equal(audio.isSoundEnabled(), true);
  assert.equal(audio.isHapticsEnabled(), true);

  audio.setSoundEnabled(false);
  assert.equal(audio.isSoundEnabled(), false);
  assert.equal(mockStorage.getItem('clubhouse:fifteen:sound_enabled'), 'false');

  audio.setHapticsEnabled(false);
  assert.equal(audio.isHapticsEnabled(), false);
  assert.equal(mockStorage.getItem('clubhouse:fifteen:haptic_enabled'), 'false');

  // 2. Mute Contract: No audio nodes or haptics triggered when disabled
  createdOscs.length = 0;
  createdGains.length = 0;
  vibrateCalls.length = 0;
  audio.playMechanicalSlide(3);
  audio.playGearLatchLock();
  audio.playSpeedCombo(4);
  audio.triggerHaptic(50);
  assert.equal(createdOscs.length, 0);
  assert.equal(createdGains.length, 0);
  assert.equal(vibrateCalls.length, 0);

  // 3. Re-enable sound & haptics
  audio.setSoundEnabled(true);
  audio.setHapticsEnabled(true);
  assert.equal(audio.isSoundEnabled(), true);
  assert.equal(audio.isHapticsEnabled(), true);

  // 4. Mechanical Slide Synthesizer
  // Single-tile slide: movedCount = 1 -> 1 oscillator, triangle wave
  createdOscs.length = 0;
  createdGains.length = 0;
  vibrateCalls.length = 0;
  audio.playMechanicalSlide(1);
  assert.equal(createdOscs.length, 1);
  assert.equal(createdGains.length, 1);
  assert.equal(createdOscs[0].type, 'triangle');
  // Initial frequency: 220 + (1 - 0) * 30 = 250 Hz
  assert.equal(createdOscs[0].frequency.events[0].val, 250);
  // Ramped down to 140 Hz
  assert.equal(createdOscs[0].frequency.events[1].val, 140);
  // Haptic pattern for single tile
  assert.deepEqual(vibrateCalls[0], 10);

  // Multi-tile slide: movedCount = 3 -> 3 oscillators chained with 0.035s offset
  createdOscs.length = 0;
  createdGains.length = 0;
  vibrateCalls.length = 0;
  audio.playMechanicalSlide(3);
  assert.equal(createdOscs.length, 3);
  assert.equal(createdGains.length, 3);
  // Frequencies: 220 + (3 - i) * 30 -> 310, 280, 250
  assert.equal(createdOscs[0].frequency.events[0].val, 310);
  assert.equal(createdOscs[1].frequency.events[0].val, 280);
  assert.equal(createdOscs[2].frequency.events[0].val, 250);
  // Start offsets
  assert.equal(createdOscs[0].startTime, 1.0);
  assert.ok(Math.abs(createdOscs[1].startTime - 1.035) < 1e-6);
  assert.ok(Math.abs(createdOscs[2].startTime - 1.070) < 1e-6);
  // Multi-tile haptic pattern
  assert.deepEqual(vibrateCalls[0], [10, 20, 15]);

  // Clamping: count 0 clamps to 1; count 8 clamps to 4
  createdOscs.length = 0;
  audio.playMechanicalSlide(0);
  assert.equal(createdOscs.length, 1);

  createdOscs.length = 0;
  audio.playMechanicalSlide(8);
  assert.equal(createdOscs.length, 4);

  // 5. Gear Latch Lock Synthesizer
  // Dual-tone snap: high metallic sine (1860Hz -> 840Hz) + resonant triangle thud (320Hz -> 110Hz)
  createdOscs.length = 0;
  createdGains.length = 0;
  vibrateCalls.length = 0;
  audio.playGearLatchLock();
  assert.equal(createdOscs.length, 2);
  assert.equal(createdGains.length, 2);

  const metallicOsc = createdOscs[0];
  assert.equal(metallicOsc.type, 'sine');
  assert.equal(metallicOsc.frequency.events[0].val, 1860);
  assert.equal(metallicOsc.frequency.events[1].val, 840);

  const bodyOsc = createdOscs[1];
  assert.equal(bodyOsc.type, 'triangle');
  assert.equal(bodyOsc.frequency.events[0].val, 320);
  assert.equal(bodyOsc.frequency.events[1].val, 110);
  assert.ok(Math.abs(bodyOsc.startTime - 1.01) < 1e-6);
  assert.deepEqual(vibrateCalls[0], [15, 25, 20]);

  // 6. Speed Combo Pentatonic Synthesizer
  const PENTATONIC_FREQS = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
  for (let step = 1; step <= 6; step++) {
    createdOscs.length = 0;
    audio.playSpeedCombo(step);
    assert.equal(createdOscs.length, 1);
    assert.equal(createdOscs[0].type, 'sine');
    assert.equal(createdOscs[0].frequency.events[0].val, PENTATONIC_FREQS[step - 1]);
  }

  // Pitch shift clamp test: step <= 0 clamps to lowest, step >= 10 clamps to highest
  createdOscs.length = 0;
  audio.playSpeedCombo(0);
  assert.equal(createdOscs[0].frequency.events[0].val, PENTATONIC_FREQS[0]);

  createdOscs.length = 0;
  audio.playSpeedCombo(12);
  assert.equal(createdOscs[0].frequency.events[0].val, PENTATONIC_FREQS[PENTATONIC_FREQS.length - 1]);
}

// ============================================================================
// Section 5: Storage & State Serialization Tests
// ============================================================================

{
  const memoryStore = new Map();
  const mockStorage = {
    getItem(k) {
      return memoryStore.get(k) ?? null;
    },
    setItem(k, v) {
      memoryStore.set(k, String(v));
    },
    removeItem(k) {
      memoryStore.delete(k);
    },
    clear() {
      memoryStore.clear();
    },
  };
  globalThis.localStorage = mockStorage;

  // Pre-seed legacy storage format from older 4×4 fixed build
  const legacyData = {
    'moves-easy': 15,
    'moves-normal': 28,
    'sprint-easy': 32,
    'sprint-hard': 65,
    'invalid-key': 'corrupted',
    'negative-val': -10,
  };
  mockStorage.setItem('clubhouse-fifteen-best', JSON.stringify(legacyData));

  const storage = await import('./storage.ts');

  // 1. Legacy Migration Contract
  // First read automatically migrates legacy keys into clubhouse:fifteen-puzzle:best
  assert.equal(storage.loadBestMoves(4, 'easy'), 15);
  assert.equal(storage.loadBestMoves(4, 'normal'), 28);
  assert.equal(storage.loadBestSprintSec(4, 'easy'), 32);
  assert.equal(storage.loadBestSprintSec(4, 'hard'), 65);
  assert.equal(storage.loadBestMoves(3, 'easy'), null); // Unplayed sizes remain null

  // Verify migrated JSON contents
  const migratedRaw = mockStorage.getItem('clubhouse:fifteen-puzzle:best');
  assert.ok(migratedRaw);
  const parsedBest = JSON.parse(migratedRaw);
  assert.equal(parsedBest['moves-4-easy'], 15);
  assert.equal(parsedBest['moves-4-normal'], 28);
  assert.equal(parsedBest['sprint-4-easy'], 32);
  assert.equal(parsedBest['sprint-4-hard'], 65);
  assert.equal(parsedBest['negative-val'], undefined);

  // 2. Best Score Serialization & Monotonicity
  // Lower moves improve record; higher moves do not overwrite
  const improvedMoves = storage.saveBestMoves(4, 'easy', 12);
  assert.equal(improvedMoves, 12);
  assert.equal(storage.loadBestMoves(4, 'easy'), 12);

  const worseMoves = storage.saveBestMoves(4, 'easy', 18);
  assert.equal(worseMoves, 12);
  assert.equal(storage.loadBestMoves(4, 'easy'), 12);

  // Lower seconds improve sprint record; higher seconds do not overwrite
  const improvedSprint = storage.saveBestSprintSec(4, 'hard', 55);
  assert.equal(improvedSprint, 55);
  assert.equal(storage.loadBestSprintSec(4, 'hard'), 55);

  const worseSprint = storage.saveBestSprintSec(4, 'hard', 70);
  assert.equal(worseSprint, 55);
  assert.equal(storage.loadBestSprintSec(4, 'hard'), 55);

  // 3. Daily History & Streak Computation
  const today = '2026-10-19';
  const yesterday = '2026-10-18';
  const twoDaysAgo = '2026-10-17';

  // Empty daily records
  assert.equal(computeStreak([], today), 0);

  // Single completed day (today)
  const streak1 = [{ date: today, moves: 20, elapsedSec: 45, optimal: 15, grade: 'S' }];
  assert.equal(computeStreak(streak1, today), 1);

  // Consecutive days: 2-day streak
  const streak2 = [
    { date: today, moves: 20, elapsedSec: 45, optimal: 15, grade: 'S' },
    { date: yesterday, moves: 22, elapsedSec: 50, optimal: 15, grade: 'A' },
  ];
  assert.equal(computeStreak(streak2, today), 2);

  // Consecutive days: 3-day streak
  const streak3 = [
    { date: today, moves: 20, elapsedSec: 45, optimal: 15, grade: 'S' },
    { date: yesterday, moves: 22, elapsedSec: 50, optimal: 15, grade: 'A' },
    { date: twoDaysAgo, moves: 25, elapsedSec: 60, optimal: 15, grade: 'B' },
  ];
  assert.equal(computeStreak(streak3, today), 3);

  // Gap in daily history: missing yesterday resets streak to 1 (only today counts)
  const streakGap = [
    { date: today, moves: 20, elapsedSec: 45, optimal: 15, grade: 'S' },
    { date: twoDaysAgo, moves: 25, elapsedSec: 60, optimal: 15, grade: 'B' },
  ];
  assert.equal(computeStreak(streakGap, today), 1);

  // Streak survives if yesterday was played (pending today's play)
  assert.equal(computeStreak([{ date: yesterday, moves: 20, elapsedSec: 45, optimal: 15, grade: 'S' }], today), 1);

  // Missing both today and yesterday: streak is broken (0)
  assert.equal(computeStreak([{ date: twoDaysAgo, moves: 20, elapsedSec: 45, optimal: 15, grade: 'S' }], today), 0);

  // recordDaily: multiple attempts on the same date keep the best record
  mockStorage.removeItem('clubhouse:fifteen-puzzle:daily');
  storage.recordDaily({ date: today, moves: 30, elapsedSec: 50, optimal: 20, grade: 'B' });
  let dailyList = storage.loadDaily();
  assert.equal(dailyList.length, 1);
  assert.equal(dailyList[0].moves, 30);

  // Better moves on same date overrides
  storage.recordDaily({ date: today, moves: 22, elapsedSec: 40, optimal: 20, grade: 'S' });
  dailyList = storage.loadDaily();
  assert.equal(dailyList.length, 1);
  assert.equal(dailyList[0].moves, 22);

  // Worse moves on same date does not override
  storage.recordDaily({ date: today, moves: 35, elapsedSec: 30, optimal: 20, grade: 'C' });
  dailyList = storage.loadDaily();
  assert.equal(dailyList.length, 1);
  assert.equal(dailyList[0].moves, 22);

  // 4. Campaign Progress & Fairness Calibration
  assert.ok(CAMPAIGN_STAGES.length >= 8);
  assert.equal(continueStageIndex(0), 0);
  assert.equal(continueStageIndex(3), 3);
  assert.equal(continueStageIndex(99), CAMPAIGN_STAGES.length - 1);

  // Verify calibrated time limits for touchscreen / CSS animation latency
  const stage5 = CAMPAIGN_STAGES.find((s) => s.id === 'sprint-4');
  assert.ok(stage5, 'Stage sprint-4 must exist');
  assert.equal(stage5.limit.kind, 'time');
  if (stage5.limit.kind === 'time') {
    assert.equal(stage5.limit.seconds, 95, 'Stage 5 sprint-4 must be calibrated to 95 seconds');
  }
  assert.ok(stage5.blurb.includes('95 秒'), 'Stage 5 blurb must state 95 seconds');

  const stage7 = CAMPAIGN_STAGES.find((s) => s.id === 'mosaic-5');
  assert.ok(stage7, 'Stage mosaic-5 must exist');
  assert.equal(stage7.limit.kind, 'time');
  if (stage7.limit.kind === 'time') {
    assert.equal(stage7.limit.seconds, 120, 'Stage 7 mosaic-5 must be calibrated to 120 seconds');
  }
  assert.ok(stage7.blurb.includes('120 秒'), 'Stage 7 blurb must state 120 seconds');

  // Stage unlocks
  assert.ok(isStageUnlocked(0, 0));
  assert.equal(isStageUnlocked(1, 0), false);
  assert.ok(isStageUnlocked(1, 1));
  assert.equal(isStageUnlocked(-1, 0), false);
  assert.equal(isStageUnlocked(100, 0), false);

  // Clear progression
  let campProg = storage.EMPTY_CAMPAIGN;
  campProg = applyStageClear(campProg, 0, 14, 25);
  assert.equal(campProg.clearedCount, 1);
  assert.equal(campProg.bestMoves[CAMPAIGN_STAGES[0].id], 14);
  assert.equal(campProg.bestTimeSec[CAMPAIGN_STAGES[0].id], 25);

  // Clearing same stage with better stats
  campProg = applyStageClear(campProg, 0, 10, 18);
  assert.equal(campProg.clearedCount, 1);
  assert.equal(campProg.bestMoves[CAMPAIGN_STAGES[0].id], 10);
  assert.equal(campProg.bestTimeSec[CAMPAIGN_STAGES[0].id], 18);

  // Save & load roundtrip
  storage.saveCampaignProgress(campProg);
  const loadedCamp = storage.loadCampaignProgress();
  assert.equal(loadedCamp.clearedCount, 1);
  assert.equal(loadedCamp.bestMoves[CAMPAIGN_STAGES[0].id], 10);

  // Move limits with slack calculation
  assert.equal(moveLimitFor(10, 1.5), 15);
  assert.equal(moveLimitFor(2, 1.1), 4); // At least optimal + 2

  // 5. User Theme & SPS Telemetry
  assert.equal(storage.loadUserTheme(), 'walnut');
  storage.saveUserTheme('cyber');
  assert.equal(storage.loadUserTheme(), 'cyber');
  mockStorage.setItem('clubhouse:fifteen-puzzle:theme', 'unknown-theme');
  assert.equal(storage.loadUserTheme(), 'walnut'); // Invalid fallback

  assert.equal(storage.loadHeatmapEnabled(), false);
  storage.saveHeatmapEnabled(true);
  assert.equal(storage.loadHeatmapEnabled(), true);

  assert.equal(storage.loadMaxSps(), 0);
  assert.equal(storage.saveMaxSps(4.2), 4.2);
  assert.equal(storage.loadMaxSps(), 4.2);
  // Lower SPS does not overwrite max SPS
  assert.equal(storage.saveMaxSps(3.1), 4.2);
  assert.equal(storage.loadMaxSps(), 4.2);
  // Higher SPS updates
  assert.equal(storage.saveMaxSps(5.8), 5.8);
  assert.equal(storage.loadMaxSps(), 5.8);

  // 6. Par Grade Distribution
  // Test across all grade boundaries for optimal = 10:
  // S: extra <= 0 (moves <= 10)
  // A: extra <= ceil(10 * 0.15) = 2 (moves 11, 12)
  // B: extra <= ceil(10 * 0.35) = 4 (moves 13, 14)
  // C: extra <= ceil(10 * 0.60) = 6 (moves 15, 16)
  // D: extra > 6 (moves >= 17)
  assert.equal(parGrade(8, 10), 'S');
  assert.equal(parGrade(10, 10), 'S');
  assert.equal(parGrade(11, 10), 'A');
  assert.equal(parGrade(12, 10), 'A');
  assert.equal(parGrade(13, 10), 'B');
  assert.equal(parGrade(14, 10), 'B');
  assert.equal(parGrade(15, 10), 'C');
  assert.equal(parGrade(16, 10), 'C');
  assert.equal(parGrade(17, 10), 'D');
  assert.equal(parGrade(50, 10), 'D');

  // Optimal <= 0 boundary
  assert.equal(parGrade(0, 0), 'S');
  assert.equal(parGrade(5, 0), 'B');

  // Traditional Chinese par label verification
  assert.equal(PAR_LABEL.S, '完美');
  assert.equal(PAR_LABEL.A, '優秀');
  assert.equal(PAR_LABEL.B, '達標');
  assert.equal(PAR_LABEL.C, '尚可');
  assert.equal(PAR_LABEL.D, '再接再厲');

  // Theme Configs
  assert.equal(THEME_CONFIGS.walnut.id, 'walnut');
  assert.equal(THEME_CONFIGS.obsidian.id, 'obsidian');
  assert.equal(THEME_CONFIGS.cyber.id, 'cyber');
}

// ============================================================================
// Section 6: Campaign Solvability & Seed Determinism
// ============================================================================

for (const stage of CAMPAIGN_STAGES) {
  const seedNum = stageSeed(stage);
  assert.equal(typeof seedNum, 'number');
  const { board, scrambleMoves } = scrambleFromSeed(stage.size, stage.tier, seedNum);
  assert.ok(isSolvable(board, stage.size), stage.id);
  assert.ok(!isSolved(board, stage.size), stage.id);
  if (scrambleMoves != null) {
    const opt = solvePuzzle(board, stage.size, {
      upperBound: scrambleMoves,
      maxNodes: 40_000,
      timeMs: 40,
    });
    assert.ok(opt.moves <= scrambleMoves, stage.id);
  }
}

// Daily config stability for a given date string
{
  const testDate = '2026-10-19';
  const cfg1 = dailyConfig(testDate);
  const cfg2 = dailyConfig(testDate);
  assert.deepEqual(cfg1, cfg2);
  assert.ok(BOARD_SIZES.includes(cfg1.size));
  assert.equal(typeof dailySeedNumber(testDate), 'number');
  assert.equal(dateKey(new Date('2026-10-19T04:00:00+08:00')), '2026-10-19');
}

console.log('fifteen-puzzle check ok');
