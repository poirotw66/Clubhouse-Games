import { cellCount, colOf, playableCount, rowOf } from './grid';
import type { CellId, Size } from './types';

export interface CircuitTelemetry {
  /** Unvisited playable cells that cannot be reached from the path head. */
  isolatedCells: Set<CellId>;
  /** Next checkpoint number required (e.g. 1 if empty, or next ascending number). */
  nextCheckpointNumber: number;
  /** CellId of the next required checkpoint, or null if all reached or none set. */
  nextCheckpointCell: CellId | null;
  /** Manhattan distance from path head to next checkpoint (or 0 if at it or empty). */
  distanceToNext: number;
  /** Total count of playable cells. */
  totalPlayable: number;
  /** Number of cells conducted so far (path.length). */
  conductedCount: number;
  /** Percentage conducted (0 to 100). */
  conductedPct: number;
  /** Whether the circuit is currently in a fatal dead-end (isolatedCells.size > 0). */
  hasDeadEnd: boolean;
  /** Ordered list of all checkpoints with their status. */
  checkpointStatus: {
    number: number;
    cell: CellId;
    reached: boolean;
    isCurrentTarget: boolean;
  }[];
}

/**
 * Pure analysis of current path on the circuit board:
 * Detects unreachable isolated cells (dead-end traps), target checkpoints,
 * distance, and conductivity percentage.
 */
export function analyzeCircuit(
  size: Size,
  neighbours: CellId[][],
  path: CellId[],
  checkpoints: Record<CellId, number>,
  blocked: CellId[] = [],
): CircuitTelemetry {
  const totalCells = cellCount(size);
  const blockedSet = new Set(blocked);
  const totalPlayable = playableCount(size, blocked);
  const visitedSet = new Set(path);

  // 1. Identify checkpoint requirements & target
  const allCheckpoints = Object.entries(checkpoints)
    .map(([cellStr, num]) => ({ cell: Number(cellStr), number: num }))
    .sort((a, b) => a.number - b.number);

  let nextCheckpointNumber = 1;
  let nextCheckpointCell: CellId | null = null;

  for (const cp of allCheckpoints) {
    if (!visitedSet.has(cp.cell)) {
      nextCheckpointNumber = cp.number;
      nextCheckpointCell = cp.cell;
      break;
    }
  }

  const checkpointStatus = allCheckpoints.map((cp) => ({
    number: cp.number,
    cell: cp.cell,
    reached: visitedSet.has(cp.cell),
    isCurrentTarget: cp.number === nextCheckpointNumber,
  }));

  // 2. Dead-end island detection
  const isolatedCells = new Set<CellId>();

  if (path.length > 0) {
    const head = path[path.length - 1];
    const reachable = new Set<CellId>([head]);
    const queue: CellId[] = [head];

    while (queue.length > 0) {
      const cur = queue.shift()!;
      for (const n of neighbours[cur] ?? []) {
        if (!visitedSet.has(n) && !blockedSet.has(n) && !reachable.has(n)) {
          reachable.add(n);
          queue.push(n);
        }
      }
    }

    for (let c = 0; c < totalCells; c++) {
      if (!blockedSet.has(c) && !visitedSet.has(c) && !reachable.has(c)) {
        isolatedCells.add(c);
      }
    }
  }

  // 3. Distance to next checkpoint
  let distanceToNext = 0;
  if (path.length > 0 && nextCheckpointCell !== null) {
    const head = path[path.length - 1];
    distanceToNext =
      Math.abs(rowOf(size, head) - rowOf(size, nextCheckpointCell)) +
      Math.abs(colOf(size, head) - colOf(size, nextCheckpointCell));
  } else if (path.length === 0 && nextCheckpointCell !== null) {
    distanceToNext = 0;
  }

  const conductedCount = path.length;
  const conductedPct = totalPlayable > 0 ? Math.round((conductedCount / totalPlayable) * 100) : 0;

  return {
    isolatedCells,
    nextCheckpointNumber,
    nextCheckpointCell,
    distanceToNext,
    totalPlayable,
    conductedCount,
    conductedPct,
    hasDeadEnd: isolatedCells.size > 0,
    checkpointStatus,
  };
}
