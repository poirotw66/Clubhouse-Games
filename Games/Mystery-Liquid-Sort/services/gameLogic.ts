import { BottleData, Color, Layer, Order } from '../types';
import { getCapacityForLevel, LEVEL_COLORS } from '../constants';

// Helper to create a unique ID
const uid = () => Math.random().toString(36).substr(2, 9);

export const createLayer = (color: Color, isHidden: boolean = false): Layer => ({
  color,
  isHidden,
  id: uid(),
});

/**
 * Checks if a move is valid.
 */
export const canPour = (source: BottleData, target: BottleData): boolean => {
  if (source.id === target.id) return false;
  if (source.layers.length === 0) return false; // Source empty
  if (target.isCompleted) return false; // Cannot pour into a completed/capped bottle
  if (target.layers.length >= target.capacity) return false; // Target full
  if (target.layers.length === 0) return true; // Target empty

  const sourceTop = source.layers[source.layers.length - 1];
  const targetTop = target.layers[target.layers.length - 1];

  // Cannot pour hidden layers
  if (sourceTop.isHidden) return false;

  // Must match color
  return sourceTop.color === targetTop.color;
};

/**
 * Executes a pour operation.
 * Returns new state of source and target bottles.
 */
export const pourLiquid = (
  source: BottleData,
  target: BottleData
): { newSource: BottleData; newTarget: BottleData; movedCount: number } => {

  const sourceLayers = [...source.layers];
  const targetLayers = [...target.layers];

  const sourceTop = sourceLayers[sourceLayers.length - 1];
  const colorToMove = sourceTop.color;

  let movedCount = 0;

  // Move as many matching layers as possible
  while (
    sourceLayers.length > 0 &&
    targetLayers.length < target.capacity &&
    sourceLayers[sourceLayers.length - 1].color === colorToMove &&
    !sourceLayers[sourceLayers.length - 1].isHidden
  ) {
    const layer = sourceLayers.pop();
    if (layer) {
      targetLayers.push(layer);
      movedCount++;
    }
  }

  // Reveal the new top layer of the source if it was hidden
  if (sourceLayers.length > 0) {
    const newTopIndex = sourceLayers.length - 1;
    if (sourceLayers[newTopIndex].isHidden) {
      sourceLayers[newTopIndex] = { ...sourceLayers[newTopIndex], isHidden: false };
    }
  }

  // Check if target is completed (Full and Uniform)
  const isTargetCompleted =
    targetLayers.length === target.capacity &&
    targetLayers.every(l => l.color === targetLayers[0].color && !l.isHidden);

  return {
    newSource: { ...source, layers: sourceLayers },
    newTarget: { ...target, layers: targetLayers, isCompleted: isTargetCompleted },
    movedCount
  };
};

/**
 * Reveals all hidden layers in all bottles and recalculates completion status
 */
export const revealHiddenLayers = (bottles: BottleData[]): BottleData[] => {
  return bottles.map(bottle => {
    const newLayers = bottle.layers.map(layer => ({
      ...layer,
      isHidden: false
    }));

    const isCompleted =
      newLayers.length === bottle.capacity &&
      newLayers.length > 0 &&
      newLayers.every(l => l.color === newLayers[0].color);

    return {
      ...bottle,
      layers: newLayers,
      isCompleted
    };
  });
};

/**
 * Shuffles the liquids in incomplete bottles with fragmentation-aware placement.
 * Avoids creating consecutive same-color layers to make puzzles harder.
 */
/**
 * Shuffles the liquids in incomplete bottles with fragmentation-aware placement.
 * Deprecated: Use generateLevel for fresh levels. This is only for mid-game shuffle items.
 */
export const shuffleBottles = (bottles: BottleData[]): BottleData[] => {
  const incompleteBottles = bottles.filter(b => !b.isCompleted);
  let allLayers: Layer[] = [];
  incompleteBottles.forEach(b => {
    allLayers.push(...b.layers);
  });

  for (let i = allLayers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allLayers[i], allLayers[j]] = [allLayers[j], allLayers[i]];
  }

  const newBottleStates = incompleteBottles.map(b => ({
    ...b,
    layers: [] as Layer[]
  }));

  for (const layer of allLayers) {
    const validBottles = newBottleStates.filter(b => b.layers.length < b.capacity);
    if (validBottles.length > 0) {
      let bestBottle = validBottles[0];
      let bestScore = -Infinity;
      for (const bottle of validBottles) {
        let score = 0;
        if (bottle.layers.length === 0) {
          score = 5;
        } else {
          const topColor = bottle.layers[bottle.layers.length - 1].color;
          if (topColor !== layer.color) {
            score = 20;
          } else {
            score = -25;
          }
        }
        score += Math.random() * 4;
        if (score > bestScore) {
          bestScore = score;
          bestBottle = bottle;
        }
      }
      bestBottle.layers.push(layer);
    }
  }

  newBottleStates.forEach(b => {
    b.layers.forEach((l, idx) => {
      if (idx === b.layers.length - 1) {
        l.isHidden = false;
      } else {
        const layerAbove = b.layers[idx + 1];
        const isAtBoundary = l.color !== layerAbove.color;
        l.isHidden = isAtBoundary && Math.random() < 0.3;
      }
    });
  });

  return bottles.map(b => {
    if (b.isCompleted) return b;
    const updated = newBottleStates.find(nb => nb.id === b.id);
    if (updated) {
      const isCompleted =
        updated.layers.length === updated.capacity &&
        updated.layers.every(l => l.color === updated.layers[0].color && !l.isHidden);
      return { ...updated, isCompleted };
    }
    return b;
  });
};

/**
 * Generates a string hash representing the current bottle configuration.
 * Used to detect loops (repeated states).
 */
/**
 * Generates a string hash representing the current bottle configuration efficiently.
 * Used for BFS solver and loop detection.
 */
export const getGameStateHash = (bottles: BottleData[]): string => {
  let res = '';
  // We generally keep bottles in a stable order, but for state equality, 
  // sorting ensures that [A, B] is the same as [B, A].
  const sorted = [...bottles].sort((a, b) => a.id < b.id ? -1 : 1);

  for (let i = 0; i < sorted.length; i++) {
    const b = sorted[i];
    res += b.id + ':';
    for (let j = 0; j < b.layers.length; j++) {
      const l = b.layers[j];
      res += l.color + (l.isHidden ? 'h' : 'v') + ',';
    }
    res += '|';
  }
  return res;
};

/**
 * Get all theoretically valid moves from a specific state
 */
const getValidMoves = (bottles: BottleData[]) => {
  const moves: { source: BottleData, target: BottleData }[] = [];
  const active = bottles.filter(b => !b.isCompleted);
  const nonEmpty = active.filter(b => b.layers.length > 0);

  for (const s of nonEmpty) {
    // Cannot pour if top is hidden
    if (s.layers[s.layers.length - 1].isHidden) continue;

    for (const t of active) {
      if (s.id === t.id) continue;
      if (canPour(s, t)) moves.push({ source: s, target: t });
    }
  }
  return moves;
};

// --- Difficulty depth: local BFS to estimate "decision depth" ---

const BFS_MAX_DEPTH = 8;
const DEPTH_CHECK_INTERVAL = 6;
const MIN_SCRAMBLE_STEPS = 15;

/** Unique key for (bottles, orders) for BFS visited set. */
function getStateKey(bottles: BottleData[], orders: Order[]): string {
  const bottlesHash = getGameStateHash(bottles);
  const orderSig = orders.map(o => `${o.isCompleted ? '1' : '0'}${o.isLocked ? 'L' : 'U'}`).join(',');
  return bottlesHash + '|' + orderSig;
}

/** Build orders from current bottles and activeColors (same structure as final). */
function buildOrdersFromBottles(bottles: BottleData[], activeColors: Color[]): Order[] {
  return activeColors.map((color, index) => ({
    id: uid(),
    color,
    isCompleted: bottles.some(b => b.isCompleted && b.layers.length > 0 && b.layers[0].color === color),
    isLocked: index >= 2,
  }));
}

/** After a bottle is completed and delivered: remove it and update orders. */
function applyOrderCompletion(
  bottles: BottleData[],
  orders: Order[],
  completedBottleId: string,
  completedColor: Color
): { newBottles: BottleData[]; newOrders: Order[] } {
  const firstOpenIndex = orders.findIndex(o => !o.isCompleted && !o.isLocked);
  if (firstOpenIndex === -1 || orders[firstOpenIndex].color !== completedColor) {
    return {
      newBottles: bottles.filter(b => b.id !== completedBottleId),
      newOrders: orders.map(o => ({ ...o })),
    };
  }
  const newOrders = orders.map((o, i) => {
    if (i === firstOpenIndex) return { ...o, isCompleted: true };
    if (i === firstOpenIndex + 1) return { ...o, isLocked: false };
    return { ...o };
  });
  const newBottles = bottles.filter(b => b.id !== completedBottleId);
  return { newBottles, newOrders };
}

/** Deep clone bottles for BFS (no shared references). */
function cloneBottles(bottles: BottleData[]): BottleData[] {
  return bottles.map(b => ({
    ...b,
    layers: b.layers.map(l => ({ ...l })),
  }));
}

/** Clone orders. */
function cloneOrders(orders: Order[]): Order[] {
  return orders.map(o => ({ ...o }));
}

// --- AI SOLVER: Dijkstra/BFS to find the shortest path to victory ---

/**
 * Finds the shortest solve path using BFS.
 * Used for difficulty estimation and level validation.
 */
export function findShortestPath(
  bottles: BottleData[],
  orders: Order[],
  maxNodes: number = 20000
): { steps: number; isSolvable: boolean } {
  const initialCompleted = orders.filter(o => o.isCompleted).length;
  const targetCompleted = orders.length;

  if (initialCompleted === targetCompleted) return { steps: 0, isSolvable: true };

  const visited = new Set<string>();
  const queue: { bottles: BottleData[]; orders: Order[]; steps: number }[] = [
    {
      bottles: bottles, // Removed redundant clone on first push
      orders: orders,
      steps: 0
    }
  ];

  let nodesExplored = 0;

  while (queue.length > 0 && nodesExplored < maxNodes) {
    const { bottles: currentBottles, orders: currentOrders, steps } = queue.shift()!;
    nodesExplored++;

    const key = getStateKey(currentBottles, currentOrders);
    if (visited.has(key)) continue;
    visited.add(key);

    const moves = getValidMoves(currentBottles);
    for (const move of moves) {
      const src = currentBottles.find(b => b.id === move.source.id)!;
      const tgt = currentBottles.find(b => b.id === move.target.id)!;
      const { newSource, newTarget } = pourLiquid(src, tgt);

      let nextBottles = currentBottles.map(b => {
        if (b.id === newSource.id) return newSource;
        if (b.id === newTarget.id) return newTarget;
        return b;
      });
      let nextOrders = cloneOrders(currentOrders);

      if (newTarget.isCompleted) {
        const firstOpen = nextOrders.findIndex(o => !o.isCompleted && !o.isLocked);
        if (firstOpen !== -1 && nextOrders[firstOpen].color === newTarget.layers[0].color) {
          const result = applyOrderCompletion(nextBottles, nextOrders, newTarget.id, newTarget.layers[0].color);
          nextBottles = result.newBottles;
          nextOrders = result.newOrders;
        }
      }

      if (nextOrders.every(o => o.isCompleted)) {
        return { steps: steps + 1, isSolvable: true };
      }

      queue.push({
        bottles: nextBottles,
        orders: nextOrders,
        steps: steps + 1
      });
    }
  }

  return { steps: -1, isSolvable: false };
}

/** Max orders allowed to be completable in BFS window for this level (higher level = stricter = harder). */
function getMaxOrdersTargetForLevel(level: number): number {
  if (level <= 3) return 2;
  if (level <= 6) return 1;
  return 0;
}

/**
 * Checks if there are any valid moves remaining.
 * Now includes a lookahead to detect forced loops (Back-and-Forth deadlocks).
 */
export const checkDeadlock = (bottles: BottleData[], history: { bottles: BottleData[] }[] = [], orders: Order[] = []): boolean => {
  // 0. If win, no deadlock
  if (orders.length > 0 && orders.every(o => o.isCompleted)) return false;

  // 1. Get immediate valid moves
  const currentMoves = getValidMoves(bottles);
  if (currentMoves.length === 0) return true; // Strict deadlock (no moves physically possible)

  // 2. Prepare History Hashes (including current state)
  const currentHash = getGameStateHash(bottles);
  const historyHashes = new Set(history.map(h => getGameStateHash(h.bottles)));
  historyHashes.add(currentHash);

  // 3. Lookahead Simulation (Is there at least ONE move that leads to a viable future?)
  const hasViablePath = currentMoves.some(move => {
    // A. Simulate the immediate move (Current -> Next)
    const { newSource, newTarget } = pourLiquid(move.source, move.target);

    const nextStateBottles = bottles.map(b => {
      if (b.id === newSource.id) return newSource;
      if (b.id === newTarget.id) return newTarget;
      return b;
    });

    // B. Check if Next State is a known past state (Immediate Loop)
    const nextHash = getGameStateHash(nextStateBottles);
    if (historyHashes.has(nextHash)) return false; // This move creates a loop, not viable

    // C. Check if Next State is a Dead End
    const nextMoves = getValidMoves(nextStateBottles);
    if (nextMoves.length === 0) {
      // Only exception: If the next state wins the game, it's valid!
      const isWin = nextStateBottles.every(b => b.isCompleted || b.layers.length === 0);
      return isWin;
    }

    // D. Deep Check: Do ALL moves from Next State lead back to history? (The "Back and Forth" trap)
    // We check if "Next State" only allows moves that return to "Current State" (or other past states)
    const movesFromNextAreAllLoops = nextMoves.every(nextMove => {
      const { newSource: deepSource, newTarget: deepTarget } = pourLiquid(nextMove.source, nextMove.target);
      const deepStateBottles = nextStateBottles.map(b => {
        if (b.id === deepSource.id) return deepSource;
        if (b.id === deepTarget.id) return deepTarget;
        return b;
      });
      const deepHash = getGameStateHash(deepStateBottles);
      return historyHashes.has(deepHash);
    });

    if (movesFromNextAreAllLoops) return false; // Next state is a trap (forced loop)

    // If we passed all checks, this move is viable
    return true;
  });

  return !hasViablePath;
};

/**
 * Checks if the current bottle state exists in the history stack.
 */
export const checkStateRepetition = (currentBottles: BottleData[], history: { bottles: BottleData[] }[]): boolean => {
  if (history.length === 0) return false;

  const currentHash = getGameStateHash(currentBottles);

  // Check if this hash exists in history
  for (let i = history.length - 1; i >= 0; i--) {
    if (getGameStateHash(history[i].bottles) === currentHash) {
      return true;
    }
  }
  return false;
};

// --- NEW GENERATION LOGIC ---

/**
 * Creates the initial solved state for generation.
 */
const createSolvedState = (numColors: number, extraBottles: number, capacity: number) => {
  const activeColors = LEVEL_COLORS.slice(0, numColors);
  const bottles: BottleData[] = [];

  activeColors.forEach(color => {
    const layers: Layer[] = [];
    for (let i = 0; i < capacity; i++) {
      layers.push(createLayer(color, false));
    }
    bottles.push({
      id: uid(),
      layers,
      capacity,
      isCompleted: true
    });
  });

  for (let i = 0; i < extraBottles; i++) {
    bottles.push({
      id: uid(),
      layers: [],
      capacity,
      isCompleted: false
    });
  }

  return { bottles, activeColors };
};

/**
 * Calculate the fragmentation score for a bottle configuration.
 * Higher score = more interleaved/fragmented = harder.
 * Penalizes consecutive same-color layers.
 */
function calculateFragmentationScore(bottles: BottleData[]): number {
  let score = 0;
  let penalty = 0;

  for (const bottle of bottles) {
    if (bottle.layers.length <= 1) continue;

    let transitions = 0;
    let maxRun = 1;
    let currentRun = 1;

    for (let i = 1; i < bottle.layers.length; i++) {
      if (bottle.layers[i].color !== bottle.layers[i - 1].color) {
        transitions++;
        currentRun = 1;
      } else {
        currentRun++;
        maxRun = Math.max(maxRun, currentRun);
      }
    }

    // Reward transitions (color changes)
    score += transitions * 10;

    // Heavy penalty for runs of 2 or more consecutive same color
    if (maxRun >= 2) {
      penalty += (maxRun - 1) * 25;
    }

    // Extra penalty for "2+1" pattern detection: 2 same on top + 1 or more same at bottom
    if (bottle.layers.length >= 3) {
      const topTwo = bottle.layers.slice(-2);
      const bottomPart = bottle.layers.slice(0, -2);

      if (topTwo[0].color === topTwo[1].color) {
        const topColor = topTwo[0].color;
        const bottomSameCount = bottomPart.filter(l => l.color === topColor).length;
        if (bottomSameCount >= 1) {
          penalty += 30; // Heavy penalty for 2+1 pattern
        }
      }
    }
  }

  return score - penalty;
}

/**
 * Count total consecutive same-color runs of length >= 2 across all bottles.
 */
function countBadRuns(bottles: BottleData[], maxAllowedRun: number = 1): number {
  let badRuns = 0;

  for (const bottle of bottles) {
    if (bottle.layers.length <= 1) continue;

    let currentRun = 1;
    for (let i = 1; i < bottle.layers.length; i++) {
      if (bottle.layers[i].color === bottle.layers[i - 1].color) {
        currentRun++;
        if (currentRun > maxAllowedRun) {
          badRuns++;
        }
      } else {
        currentRun = 1;
      }
    }
  }

  return badRuns;
}

/**
 * Shuffle an array in place (Fisher-Yates).
 */
function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Distribute color layers into bottles with the HARD CONSTRAINT:
 * no two adjacent layers in any bottle may share the same color.
 * Returns null if distribution failed (caller should retry with a new shuffle).
 */
function distributeWithoutAdjacency(
  allColors: Color[],
  numActiveBottles: number,
  capacity: number
): Color[][] | null {
  const shuffled = shuffleArray(allColors);
  const bottles: Color[][] = Array.from({ length: numActiveBottles }, () => []);

  for (const color of shuffled) {
    // Find all bottles where this color can be legally placed
    const candidates: number[] = [];
    for (let i = 0; i < bottles.length; i++) {
      if (bottles[i].length >= capacity) continue;
      if (bottles[i].length > 0 && bottles[i][bottles[i].length - 1] === color) continue;
      candidates.push(i);
    }

    if (candidates.length === 0) return null;

    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    bottles[chosen].push(color);
  }

  return bottles;
}

function getDifficultyBand(level: number): { min: number; max: number } {
  if (level <= 2) return { min: 4, max: 10 };
  if (level <= 5) return { min: 8, max: 15 };
  if (level <= 10) return { min: 14, max: 25 };
  if (level <= 20) return { min: 20, max: 35 };
  return { min: 30, max: 50 };
}

/**
 * Generates a new level using direct distribution.
 * Guarantees: no same-color adjacency in any bottle.
 */
export const generateLevel = (level: number): { bottles: BottleData[], orders: Order[] } => {
  // 1. Configuration
  let numColors = 3;
  if (level >= 3) numColors = 4;
  if (level >= 7) numColors = 5;
  if (level >= 12) numColors = 6;
  if (level >= 18) numColors = 7;
  numColors = Math.min(numColors, LEVEL_COLORS.length);

  let extraBottles = 2;
  if (level >= 5 && level < 12) extraBottles = 1;
  else if (level >= 12) extraBottles = 2;

  const capacity = getCapacityForLevel(level);
  const activeColors = LEVEL_COLORS.slice(0, numColors);

  let hiddenProbability = 0;
  if (level > 2) {
    hiddenProbability = Math.min(0.8, 0.2 + (level - 2) * 0.05);
  }

  const band = getDifficultyBand(level);
  const maxAttempts = level >= 15 ? 10 : 40; // Fewer attempts for Expert to stay fast

  let bestBottles: BottleData[] | null = null;
  let bestOrders: Order[] | null = null;
  let bestScore = -Infinity;

  // Build color pool
  const colorPool: Color[] = [];
  for (const color of activeColors) {
    for (let i = 0; i < capacity; i++) {
      colorPool.push(color);
    }
  }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const distribution = distributeWithoutAdjacency(colorPool, numColors, capacity);
    if (!distribution) continue;

    const bottles: BottleData[] = [];
    for (let i = 0; i < numColors; i++) {
      const layers = distribution[i].map(c => createLayer(c, false));
      bottles.push({ id: uid(), layers, capacity, isCompleted: false });
    }
    for (let i = 0; i < extraBottles; i++) {
      bottles.push({ id: uid(), layers: [], capacity, isCompleted: false });
    }

    const isSolved = bottles.every(b => {
      if (b.layers.length === 0) return true;
      return b.layers.length === capacity && b.layers.every(l => l.color === b.layers[0].color);
    });
    if (isSolved) continue;

    bottles.forEach(b => {
      b.layers.forEach((l, idx) => {
        if (idx === b.layers.length - 1) {
          l.isHidden = false;
        } else {
          const layerAbove = b.layers[idx + 1];
          const isAtBoundary = l.color !== layerAbove.color;
          l.isHidden = isAtBoundary && Math.random() < hiddenProbability;
        }
      });
    });

    const orders = buildOrdersFromBottles(bottles, activeColors);

    // For Expert, we use a smaller node limit to verify solvability quickly
    const verifyLimit = level >= 15 ? 5000 : 20000;
    const solveResult = findShortestPath(bottles, orders, verifyLimit);

    if (solveResult.isSolvable) {
      const steps = solveResult.steps;
      // If we found a complex enough level or enough attempts failed, take it.
      if (steps >= band.min || (level >= 15 && attempt > 3)) {
        return { bottles, orders };
      }
      if (steps > bestScore) {
        bestScore = steps;
        bestBottles = cloneBottles(bottles);
        bestOrders = cloneOrders(orders);
      }
    } else if (solveResult.steps === -1) {
      // Solver timeout is actually good for Expert — it means it's likely hard.
      if (level >= 15) return { bottles, orders };

      const fragScore = calculateFragmentationScore(bottles);
      if (fragScore > bestScore || !bestBottles) {
        bestScore = fragScore;
        bestBottles = cloneBottles(bottles);
        bestOrders = cloneOrders(orders);
      }
    }
  }

  // Return the best candidate found
  if (bestBottles && bestOrders) {
    return { bottles: bestBottles, orders: bestOrders };
  }

  // Absolute fallback: simple random shuffle
  const fallbackBottles: BottleData[] = [];
  const shuffledPool = shuffleArray(colorPool);
  let poolIdx = 0;
  for (let b = 0; b < numColors; b++) {
    const layers: Layer[] = [];
    for (let l = 0; l < capacity; l++) {
      layers.push(createLayer(shuffledPool[poolIdx++]));
    }
    fallbackBottles.push({ id: uid(), layers, capacity, isCompleted: false });
  }
  for (let i = 0; i < extraBottles; i++) {
    fallbackBottles.push({ id: uid(), layers: [], capacity, isCompleted: false });
  }
  return { bottles: fallbackBottles, orders: buildOrdersFromBottles(fallbackBottles, activeColors) };
};


export const checkLevelComplete = (bottles: BottleData[], orders: Order[]) => {
  return orders.every(o => o.isCompleted);
};