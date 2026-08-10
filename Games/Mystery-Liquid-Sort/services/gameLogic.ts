import { Color, type BottleData, type Layer, type Order } from '../types.ts';
import { getCapacityForLevel, LEVEL_COLORS } from '../constants.ts';

// Helper to create a unique ID
const uid = () => Math.random().toString(36).substr(2, 9);

export const createLayer = (color: Color, isHidden: boolean = false): Layer => ({
  color,
  isHidden,
  id: uid(),
});

// --- MIXING ---
//
// Three 1:1, volume-preserving mixing pairs. Mixing is deliberately
// irreversible: there is no "unmix" move — pourLiquid only ever turns two
// distinct colours into one new one, never the other way round.
//
// Rule for a colour that is BOTH a mix product AND an ordinary LEVEL_COLORS
// entry (GREEN, PURPLE and ORANGE all are, at their respective tiers): a
// unit produced by mixing is the exact same Color value as a unit placed
// directly on the board — there is no separate "mixed orange" vs "real
// orange". It satisfies orders and bottle-completion identically either
// way. What generateLevel controls is only *how much* of that colour starts
// pre-made on the board vs. must be produced by mixing (see
// MIXING_MIN_LEVEL below).
const MIX_RESULTS: Record<string, Color> = {};
const MIX_COMPONENTS = new Map<Color, [Color, Color]>();
function registerMix(a: Color, b: Color, result: Color) {
  MIX_RESULTS[[a, b].sort().join('|')] = result;
  MIX_COMPONENTS.set(result, [a, b]);
}
registerMix(Color.RED, Color.YELLOW, Color.ORANGE);
registerMix(Color.BLUE, Color.YELLOW, Color.GREEN);
registerMix(Color.RED, Color.BLUE, Color.PURPLE);

function getMixResult(a: Color, b: Color): Color | undefined {
  return MIX_RESULTS[[a, b].sort().join('|')];
}

/**
 * Level tier at which mixing unlocks. Deliberately not the level>=10
 * capacity bump to 6 itself (see getCapacityForLevel in constants.ts):
 * levels 10-11 still run on a single spare bottle (extraBottles==1), which
 * was already this generator's hardest band pre-mixing, and combined with
 * the mix-only colour reservation below it made a solvable random layout
 * rare enough that generation routinely blew the 100ms budget. Level 12 is
 * where extraBottles jumps to 2 *and* capacity is still a flat 6 (even, so
 * a mix-only colour's full capacity-worth is always evenly reachable as
 * capacity/2 + capacity/2 of its two primary components — e.g. 3 red + 3
 * yellow -> 6 orange). Below this tier the game stays a pure sorting game:
 * no bottle ever carries mixingEnabled, so canPour never takes the mixing
 * branch.
 */
export const MIXING_MIN_LEVEL = 12;

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

  // Same colour: always allowed (ordinary merge).
  if (sourceTop.color === targetTop.color) return true;

  // Different colours: allowed only as a mixing pour, and only on a board
  // where mixing is unlocked (either bottle carries mixingEnabled — see the
  // BottleData doc comment) and this exact pair is one of the 3 known
  // mixing recipes.
  if (!source.mixingEnabled && !target.mixingEnabled) return false;
  return getMixResult(sourceTop.color, targetTop.color) !== undefined;
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

  // Mixing pour: source and target tops are different colours that form a
  // known mixing pair (canPour already confirmed this is legal). The
  // reaction is always 1:1 by volume (1 unit of each becomes 2 units of the
  // mixed colour) — but, exactly like an ordinary same-colour pour moves a
  // whole contiguous run in one action rather than one unit at a time, a
  // single mixing pour reacts as many 1:1 pairs as fit in one go: as much of
  // source's top run as target's top run can match, capped by target's free
  // space (each reacted pair nets +1 layer in target). This keeps mixing a
  // single deliberate, irreversible player decision per pour rather than a
  // long forced sequence of 1-unit taps.
  if (targetLayers.length > 0) {
    const targetTop = targetLayers[targetLayers.length - 1];
    if (targetTop.color !== colorToMove) {
      const mixedColor = getMixResult(colorToMove, targetTop.color);
      if (mixedColor) {
        let sourceRun = 0;
        for (let i = sourceLayers.length - 1; i >= 0 && sourceLayers[i].color === colorToMove && !sourceLayers[i].isHidden; i--) sourceRun++;
        let targetRun = 0;
        for (let i = targetLayers.length - 1; i >= 0 && targetLayers[i].color === targetTop.color; i--) targetRun++;
        const freeSpace = target.capacity - targetLayers.length;
        const pairs = Math.max(1, Math.min(sourceRun, targetRun, freeSpace));

        for (let i = 0; i < pairs; i++) sourceLayers.pop();
        for (let i = 0; i < pairs; i++) targetLayers.pop();
        for (let i = 0; i < pairs * 2; i++) targetLayers.push(createLayer(mixedColor, false));

        if (sourceLayers.length > 0) {
          const newTopIndex = sourceLayers.length - 1;
          if (sourceLayers[newTopIndex].isHidden) {
            sourceLayers[newTopIndex] = { ...sourceLayers[newTopIndex], isHidden: false };
          }
        }

        const isTargetCompleted =
          targetLayers.length === target.capacity &&
          targetLayers.every(l => l.color === targetLayers[0].color && !l.isHidden);

        return {
          newSource: { ...source, layers: sourceLayers },
          newTarget: { ...target, layers: targetLayers, isCompleted: isTargetCompleted },
          movedCount: pairs,
        };
      }
    }
  }

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
 * Shuffles the liquids in incomplete bottles for the mid-game shuffle power-up.
 * Same generate-and-verify pipeline as generateLevel (see the GENERATION
 * section below for how difficulty is calibrated against actual solution
 * length, not just how scrambled the layout looks): a fresh random,
 * adjacency-constrained distribution of the colours still in play, solved by
 * a fast heuristic search, and shipped only once that solution replays
 * cleanly. Completed (but undelivered) bottles are left untouched, matching
 * the caller in Game.tsx, which only replaces `bottles`, not `orders`.
 */
export const shuffleBottles = (bottles: BottleData[]): BottleData[] => {
  const incomplete = bottles.filter(b => !b.isCompleted);
  if (incomplete.length === 0) return bottles;

  const capacity = incomplete[0].capacity;
  // All bottles on one board share the same mixing tier; `.some` is just a
  // lenient way to read that shared flag back off the incoming bottles.
  const mixingEnabled = incomplete.some(b => b.mixingEnabled);

  const colorCounts = new Map<Color, number>();
  incomplete.forEach(b => b.layers.forEach(l => {
    colorCounts.set(l.color, (colorCounts.get(l.color) ?? 0) + 1);
  }));
  const colors = [...colorCounts.keys()];

  const colorPool: Color[] = [];
  colors.forEach(color => {
    for (let i = 0; i < colorCounts.get(color)!; i++) colorPool.push(color);
  });
  const requiredColors = new Set(colors);

  // Borrow ids from the incomplete bottles (shuffled) so the merge-back below
  // can match by id; the first `colors.length` get the redistributed pool,
  // the rest are spares.
  const slotIds = shuffleArray(incomplete.map(b => b.id));

  const deadline = Date.now() + GENERATE_TIME_BUDGET_MS;
  for (let attempt = 0; attempt < GENERATE_MAX_ATTEMPTS && Date.now() < deadline; attempt++) {
    const distribution = distributeWithoutAdjacency(colorPool, colors.length, capacity);
    if (!distribution) continue;

    const working: BottleData[] = slotIds.map((id, idx) => {
      if (idx < colors.length) {
        return { id, layers: distribution[idx].map(c => createLayer(c, false)), capacity, isCompleted: false, mixingEnabled };
      }
      return { id, layers: [], capacity, isCompleted: false, mixingEnabled };
    });

    const solution = findSolutionGreedy(working, requiredColors);
    if (!solution) continue;
    if (!verifySolutionByReplay(working, solution, requiredColors)) continue;

    const withHidden = applyHiddenLayers(working, SHUFFLE_HIDDEN_PROBABILITY);
    const byId = new Map(withHidden.map(b => [b.id, b]));
    return bottles.map(b => (b.isCompleted ? b : byId.get(b.id) ?? b));
  }

  // Should be unreachable (see generateLevel's fallback for why); keep the
  // board unchanged rather than risk shipping an unverified shuffle.
  return bottles;
};

/**
 * Generates a string hash representing the current bottle configuration.
 * Used for deadlock/loop detection.
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

/** Deep clone bottles (no shared references) — used by generation/scrambling. */
function cloneBottles(bottles: BottleData[]): BottleData[] {
  return bottles.map(b => ({
    ...b,
    layers: b.layers.map(l => ({ ...l })),
  }));
}

/** Build orders from a level's active colours. Sequential unlock: first 2 open, rest locked. */
function buildOrders(activeColors: Color[]): Order[] {
  return activeColors.map((color, index) => ({
    id: uid(),
    color,
    isCompleted: false,
    isLocked: index >= 2,
  }));
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

// --- GENERATION ---
//
// Calibrating against SCRAMBLE STEPS (however a board got mixed up) is not
// the same as calibrating against SOLUTION LENGTH (how many moves it takes
// to unmix it) — a board can be shuffled forty ways and still fold up in
// half that many merges. So generation here works the other way round:
// build a genuinely random, adjacency-constrained layout (the same
// distribution the very first version of this generator used, and the
// direct source of its difficulty), hand it to a fast heuristic solver, and
// only ship the layout once that solver has actually produced — and replay
// has verified — a working solution. No solution found within budget just
// means try a different random layout; nothing is ever shipped unverified.

/**
 * Creates the initial solved state: one full, single-colour bottle per
 * active colour, plus `extraBottles` empty spares. Only used for the
 * (practically unreachable) fallback below, and as the base case for the
 * empty-pool edge in shuffleBottles.
 */
const createSolvedState = (numColors: number, extraBottles: number, capacity: number, mixingEnabled: boolean = false) => {
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
      isCompleted: true,
      mixingEnabled
    });
  });

  for (let i = 0; i < extraBottles; i++) {
    bottles.push({
      id: uid(),
      layers: [],
      capacity,
      isCompleted: false,
      mixingEnabled
    });
  }

  return { bottles, activeColors };
};

/**
 * Shuffle an array (Fisher-Yates). Does not mutate the input.
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
 * Distributes `colors` into `numBottles` bottles of `capacity`, subject to
 * the hard constraint that no two adjacent layers in any bottle share a
 * colour (so no board starts with a "free" merge sitting there already).
 * Returns null if a legal placement couldn't be found for every colour unit
 * (the caller retries with a fresh shuffle).
 */
function distributeWithoutAdjacency(
  colors: Color[],
  numBottles: number,
  capacity: number
): Color[][] | null {
  const shuffled = shuffleArray(colors);
  const bottles: Color[][] = Array.from({ length: numBottles }, () => []);

  for (const color of shuffled) {
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

/** A move as the real player would make it: pour `sourceId`'s top run into `targetId`. */
interface SolutionMove {
  sourceId: string;
  targetId: string;
}

/**
 * True once every bottle is empty, or full and single-colour, AND the set
 * of full bottles' colours exactly matches `requiredColors`. The colour
 * check matters once mixing is in play: the three mixing recipes share
 * primaries (RED+YELLOW, BLUE+YELLOW, RED+BLUE all draw from the same 3
 * primaries), so a board can reach a fully mono-coloured state via the
 * "wrong" recipe — e.g. mixing RED+YELLOW into ORANGE when ORANGE isn't
 * one of this level's active colours — which is sorted but not actually a
 * win (that liquid can never be un-mixed back into the RED or YELLOW an
 * order still needs). Without this check, "every bottle mono" alone would
 * accept that as solved, which is wrong once more than one mixing recipe
 * is available on the same board.
 */
function boardMatchesColors(bottles: BottleData[], requiredColors: Set<Color>): boolean {
  if (!bottles.every(b => b.layers.length === 0 || (b.layers.length === b.capacity && b.isCompleted))) {
    return false;
  }
  const fullColors = bottles.filter(b => b.isCompleted).map(b => b.layers[0].color).sort();
  const need = [...requiredColors].sort();
  return fullColors.length === need.length && fullColors.every((c, i) => c === need[i]);
}

/**
 * Fast heuristic solver: depth-first search ordered by a simple "make
 * progress" heuristic (finish a bottle > merge into a matching run > pour
 * into empty), with a memoised visited set to avoid revisiting states and a
 * node/time budget so a genuinely hard-to-search board fails fast rather
 * than stalling generation. This is not exhaustive — on a solvable board it
 * usually finds a solution in well under a millisecond by mostly making
 * "obviously good" moves, but it can also fail on a solvable board (rare)
 * and it never claims a board is UNsolvable, only "didn't find one in
 * budget". Both cases just mean the caller tries a different random layout;
 * this function is never the thing that decides a board ships.
 *
 * `requiredColors` is the exact set of colours this board must end up
 * sorted into (see boardMatchesColors) — on a non-mixing board this is
 * always automatically satisfied by "every bottle mono" alone (colours
 * can't transmute), but once mixing is possible it's load-bearing.
 */
function findSolutionGreedy(
  bottles: BottleData[],
  requiredColors: Set<Color>,
  maxNodes: number = SOLVE_MAX_NODES,
  maxMs: number = SOLVE_MAX_MS
): SolutionMove[] | null {
  const start = Date.now();
  const visited = new Set<string>();
  const path: SolutionMove[] = [];
  let nodes = 0;

  const stateKey = (state: BottleData[]) =>
    state.map(b => b.layers.map(l => l.color).join(',')).sort().join('|');

  // Total units of `color` anywhere on the board right now (mixed or native).
  function colorTotal(state: BottleData[], color: Color): number {
    let total = 0;
    for (const b of state) for (const l of b.layers) if (l.color === color) total++;
    return total;
  }

  function scoreMove(state: BottleData[], source: BottleData, target: BottleData): number {
    const topColor = source.layers[source.layers.length - 1].color;

    // Mixing pour: net growth on target is always exactly +1 (1 unit in,
    // target's existing top 1 unit becomes 2), unlike a same-colour pour
    // which can move a whole run at once.
    if (target.layers.length > 0 && target.layers[target.layers.length - 1].color !== topColor) {
      const mixedColor = getMixResult(topColor, target.layers[target.layers.length - 1].color);
      if (mixedColor) {
        // Off-target entirely (not needed anywhere), OR this colour's full
        // capacity-worth already exists on the board (from direct placement
        // and/or earlier mixing) — either way, producing more of it can
        // never contribute to a win: every required colour needs exactly
        // one bottle's worth, no more, and mixing never destroys liquid.
        if (!requiredColors.has(mixedColor) || colorTotal(state, mixedColor) >= target.capacity) return -1;
      }
      if (target.layers.length + 1 === target.capacity) return 2; // finishes the target bottle
      return 1; // produces 2 units of a colour that's otherwise unobtainable
    }

    let run = 0;
    for (let i = source.layers.length - 1; i >= 0 && source.layers[i].color === topColor; i--) run++;
    if (target.layers.length + run === target.capacity) return 2; // finishes the target bottle
    if (target.layers.length > 0) return 1; // merges into an existing run
    return 0; // pours into an empty bottle — least urgent
  }

  function dfs(state: BottleData[]): boolean {
    if (nodes++ > maxNodes || Date.now() - start > maxMs) return false;
    if (boardMatchesColors(state, requiredColors)) return true;
    const key = stateKey(state);
    if (visited.has(key)) return false;
    visited.add(key);

    const moves: { source: BottleData; target: BottleData; score: number }[] = [];
    for (const source of state) {
      if (source.isCompleted || source.layers.length === 0) continue;
      for (const target of state) {
        if (source.id === target.id) continue;
        if (canPour(source, target)) moves.push({ source, target, score: scoreMove(state, source, target) });
      }
    }
    moves.sort((a, b) => b.score - a.score);

    for (const move of moves) {
      const { newSource, newTarget } = pourLiquid(move.source, move.target);
      const next = state.map(b => (b.id === newSource.id ? newSource : b.id === newTarget.id ? newTarget : b));
      path.push({ sourceId: move.source.id, targetId: move.target.id });
      if (dfs(next)) return true;
      path.pop();
      if (nodes > maxNodes || Date.now() - start > maxMs) return false;
    }
    return false;
  }

  return dfs(cloneBottles(bottles)) ? path.slice() : null;
}

/**
 * Replays a claimed solution through the real `canPour`/`pourLiquid`, exactly
 * as a player would execute it, and checks it actually reaches a board sorted
 * into exactly `requiredColors` (see boardMatchesColors — not just "every
 * bottle mono", which mixing can satisfy via the wrong recipe). This is the
 * cheap, exact verification step: `findSolutionGreedy` already only takes
 * legal steps, so this should always pass, but a board only ships once this
 * has independently confirmed it — nothing ships on the solver's word alone.
 */
function verifySolutionByReplay(bottles: BottleData[], moves: SolutionMove[], requiredColors: Set<Color>): boolean {
  const state = cloneBottles(bottles);

  for (const move of moves) {
    const sourceIdx = state.findIndex(b => b.id === move.sourceId);
    const targetIdx = state.findIndex(b => b.id === move.targetId);
    if (sourceIdx === -1 || targetIdx === -1) return false;

    const source = state[sourceIdx];
    const target = state[targetIdx];
    // Mirrors the UI rule (Game.tsx handleBottleClick): a completed bottle can't be selected as a source.
    if (source.isCompleted) return false;
    if (!canPour(source, target)) return false;

    const { newSource, newTarget } = pourLiquid(source, target);
    state[sourceIdx] = newSource;
    state[targetIdx] = newTarget;
  }

  return boardMatchesColors(state, requiredColors);
}

/**
 * Applies hidden layers cosmetically after a layout is verified solvable.
 * Only non-top layers at a colour boundary are ever hidden, and the top
 * layer is always visible — so this can never change which moves are legal:
 * `pourLiquid`'s greedy multi-layer move already stops at a colour change
 * before it would ever need to inspect a hidden layer, and `canPour` only
 * ever reads bottle tops, which are never hidden.
 */
function applyHiddenLayers(bottles: BottleData[], hiddenProbability: number): BottleData[] {
  return bottles.map(b => ({
    ...b,
    layers: b.layers.map((l, idx) => {
      if (idx === b.layers.length - 1) return { ...l, isHidden: false };
      const layerAbove = b.layers[idx + 1];
      const isAtBoundary = l.color !== layerAbove.color;
      return { ...l, isHidden: isAtBoundary && Math.random() < hiddenProbability };
    }),
  }));
}

// Per-attempt solver budget: generous relative to how fast the heuristic
// actually finds solutions (sub-millisecond in the common case), but capped
// so a single stubborn layout can't eat the whole generation budget.
const SOLVE_MAX_NODES = 4000;
const SOLVE_MAX_MS = 10;
// Overall retry budget: bounds both attempt count and wall-clock time, so
// generation always stays well inside the 100ms target even on the
// hardest, lowest-spare-capacity tiers (levels 5-11), where a solvable
// random layout is rarer and more attempts are typically needed.
const GENERATE_MAX_ATTEMPTS = 150;
const GENERATE_TIME_BUDGET_MS = 65;
// generateLevel's second (extraBottles+1) attempt gets this smaller,
// separate window rather than a fresh GENERATE_TIME_BUDGET_MS — see the
// comment at its call site for why.
const RETRY_TIME_BUDGET_MS = 25;
const SHUFFLE_HIDDEN_PROBABILITY = 0.15;

/**
 * Builds one verified layout, or null if the attempt budget runs out.
 * A layout only leaves this function once a real solution has been found
 * for it and replayed successfully — nothing unverified escapes.
 */
function tryGenerateLayout(
  numColors: number,
  extraBottles: number,
  capacity: number,
  colorPool: Color[],
  hiddenProbability: number,
  requiredColors: Set<Color>,
  mixingEnabled: boolean = false,
  deadline: number = Date.now() + GENERATE_TIME_BUDGET_MS
): BottleData[] | null {
  for (let attempt = 0; attempt < GENERATE_MAX_ATTEMPTS && Date.now() < deadline; attempt++) {
    const distribution = distributeWithoutAdjacency(colorPool, numColors, capacity);
    if (!distribution) continue;

    const bottles: BottleData[] = [];
    for (let i = 0; i < numColors; i++) {
      bottles.push({ id: uid(), layers: distribution[i].map(c => createLayer(c, false)), capacity, isCompleted: false, mixingEnabled });
    }
    for (let i = 0; i < extraBottles; i++) {
      bottles.push({ id: uid(), layers: [], capacity, isCompleted: false, mixingEnabled });
    }

    const solution = findSolutionGreedy(bottles, requiredColors);
    if (!solution) continue;
    if (!verifySolutionByReplay(bottles, solution, requiredColors)) continue;

    return applyHiddenLayers(bottles, hiddenProbability);
  }

  return null;
}

/**
 * Generates a new level: a fresh random (adjacency-constrained) layout,
 * solved by a fast heuristic search and verified by replay before it ships.
 * Difficulty is calibrated by the layout itself (colour count, capacity,
 * spare bottles) rather than by a target move count — see the module
 * comment above for why solution length isn't controllable that way.
 */
export const generateLevel = (level: number): { bottles: BottleData[], orders: Order[] } => {
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

  // Mixing unlocks at MIXING_MIN_LEVEL. When it's on, withhold ONE
  // mix-producible secondary colour's units from the direct pour pool
  // entirely, replacing them with capacity/2 units of each of its two
  // primary components. That colour then literally does not exist on the
  // board at deal time — the only way to get a full bottle of it is to
  // mix — which is what creates the "order asks for orange, no orange
  // exists yet, mixing costs red another order needs" tension. Every other
  // active colour (including any other secondary that happens to be in
  // play) is placed directly exactly as before: it's simultaneously
  // ordinary sortable liquid AND still legal to mix if the player chooses
  // to, per the mixing rule documented on canPour/pourLiquid.
  const mixingEnabled = level >= MIXING_MIN_LEVEL;
  let mixOnlyColor: Color | null = null;
  if (mixingEnabled) {
    const candidates = activeColors.filter(c => {
      const components = MIX_COMPONENTS.get(c);
      return components !== undefined && components.every(p => activeColors.includes(p));
    });
    if (candidates.length > 0) {
      mixOnlyColor = candidates[Math.floor(Math.random() * candidates.length)];
    }
  }

  const colorPool: Color[] = [];
  for (const color of activeColors) {
    if (color === mixOnlyColor) {
      const [a, b] = MIX_COMPONENTS.get(color)!;
      // capacity is guaranteed even here: MIXING_MIN_LEVEL is chosen to
      // coincide with getCapacityForLevel's jump to a flat 6.
      for (let i = 0; i < capacity / 2; i++) {
        colorPool.push(a);
        colorPool.push(b);
      }
    } else {
      for (let i = 0; i < capacity; i++) colorPool.push(color);
    }
  }

  const requiredColors = new Set(activeColors);

  // Levels 5-11 run on a single spare bottle, so a solvable random layout is
  // scarce enough there that the budget genuinely does run out: measured at
  // roughly 1 generation in 1500 on those tiers. Retry with one extra spare
  // before giving up — that is still a real puzzle, just roomier. The first
  // attempt gets the bulk of the budget; the retry gets its own smaller,
  // *guaranteed* window rather than a fresh full GENERATE_TIME_BUDGET_MS
  // (which would let two unlucky attempts in a row double the worst-case
  // wall-clock time) or a window shared with the first (which would starve
  // the retry to ~0ms whenever the first attempt used its whole budget,
  // falling back to a trivial board far more often than necessary).
  const firstDeadline = Date.now() + GENERATE_TIME_BUDGET_MS;
  const layout =
    tryGenerateLayout(numColors, extraBottles, capacity, colorPool, hiddenProbability, requiredColors, mixingEnabled, firstDeadline) ??
    tryGenerateLayout(numColors, extraBottles + 1, capacity, colorPool, hiddenProbability, requiredColors, mixingEnabled, Date.now() + RETRY_TIME_BUDGET_MS);

  if (layout) return { bottles: layout, orders: buildOrders(activeColors) };

  // Both budgets exhausted. Nothing unverified ever ships, so the last resort
  // is the solved board itself: trivially solvable, and an instant win rather
  // than an impossible one.
  const { bottles, activeColors: fallbackColors } = createSolvedState(numColors, extraBottles, capacity, mixingEnabled);
  return { bottles, orders: buildOrders(fallbackColors) };
};

export const checkLevelComplete = (bottles: BottleData[], orders: Order[]) => {
  return orders.every(o => o.isCompleted);
};