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
  /** Direction from path head to next checkpoint (e.g. '東北 ↗', '南 ↓', or '已抵達 ⚡'). */
  directionToNext: string;
  /** Total count of playable cells. */
  totalPlayable: number;
  /** Number of cells conducted so far (path.length). */
  conductedCount: number;
  /** Percentage conducted (0 to 100). */
  conductedPct: number;
  /** Number of 90-degree corner turns in current path. */
  turnsCount: number;
  /** Line impedance in Ohms (Ω) based on path length and inductive turns. */
  impedanceOhms: number;
  /** Whether the circuit is currently in a fatal dead-end (isolatedCells.size > 0). */
  hasDeadEnd: boolean;
  /** The prefix length to rollback to for clearing dead-end isolation (or null if safe). */
  safeRollbackLength: number | null;
  /** Ordered list of all checkpoints with their status. */
  checkpointStatus: {
    number: number;
    cell: CellId;
    reached: boolean;
    isCurrentTarget: boolean;
  }[];
}

function findIsolatedCells(
  neighbours: CellId[][],
  subpath: CellId[],
  blockedSet: Set<CellId>,
  totalCells: number,
): Set<CellId> {
  const isolated = new Set<CellId>();
  if (subpath.length === 0) return isolated;

  const visited = new Set(subpath);
  const head = subpath[subpath.length - 1];
  const reachable = new Set<CellId>([head]);
  const queue: CellId[] = [head];

  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const n of neighbours[cur] ?? []) {
      if (!visited.has(n) && !blockedSet.has(n) && !reachable.has(n)) {
        reachable.add(n);
        queue.push(n);
      }
    }
  }

  for (let c = 0; c < totalCells; c++) {
    if (!blockedSet.has(c) && !visited.has(c) && !reachable.has(c)) {
      isolated.add(c);
    }
  }
  return isolated;
}

/**
 * Pure analysis of current path on the circuit board:
 * Detects unreachable isolated cells (dead-end traps), target checkpoints,
 * distance, direction, conductivity percentage, impedance, and safe rollback length.
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
  const isolatedCells = findIsolatedCells(neighbours, path, blockedSet, totalCells);
  const hasDeadEnd = isolatedCells.size > 0;

  // 3. Calculate safe rollback length if in a dead-end
  let safeRollbackLength: number | null = null;
  if (hasDeadEnd && path.length > 1) {
    for (let len = path.length - 1; len >= 1; len--) {
      const prefix = path.slice(0, len);
      const prefixIsolated = findIsolatedCells(neighbours, prefix, blockedSet, totalCells);
      if (prefixIsolated.size === 0) {
        safeRollbackLength = len;
        break;
      }
    }
    if (safeRollbackLength === null) {
      safeRollbackLength = 1;
    }
  }

  // 4. Distance and Direction to next checkpoint
  let distanceToNext = 0;
  let directionToNext = '待定';

  if (nextCheckpointCell !== null) {
    if (path.length > 0) {
      const head = path[path.length - 1];
      const dr = rowOf(size, nextCheckpointCell) - rowOf(size, head);
      const dc = colOf(size, nextCheckpointCell) - colOf(size, head);
      distanceToNext = Math.abs(dr) + Math.abs(dc);

      if (dr === 0 && dc === 0) directionToNext = '已抵達 ⚡';
      else if (dr < 0 && dc === 0) directionToNext = '北 ↑';
      else if (dr > 0 && dc === 0) directionToNext = '南 ↓';
      else if (dr === 0 && dc > 0) directionToNext = '東 →';
      else if (dr === 0 && dc < 0) directionToNext = '西 ←';
      else if (dr < 0 && dc > 0) directionToNext = '東北 ↗';
      else if (dr < 0 && dc < 0) directionToNext = '西北 ↖';
      else if (dr > 0 && dc > 0) directionToNext = '東南 ↘';
      else if (dr > 0 && dc < 0) directionToNext = '西南 ↙';
    } else {
      distanceToNext = 0;
      directionToNext = '起點 1';
    }
  }

  // 5. Turns count & Line Impedance
  let turnsCount = 0;
  if (path.length >= 3) {
    for (let i = 1; i < path.length - 1; i++) {
      const prev = path[i - 1];
      const cur = path[i];
      const next = path[i + 1];
      const dr1 = rowOf(size, cur) - rowOf(size, prev);
      const dc1 = colOf(size, cur) - colOf(size, prev);
      const dr2 = rowOf(size, next) - rowOf(size, cur);
      const dc2 = colOf(size, next) - colOf(size, cur);
      if (dr1 !== dr2 || dc1 !== dc2) {
        turnsCount++;
      }
    }
  }

  const conductedCount = path.length;
  const conductedPct = totalPlayable > 0 ? Math.round((conductedCount / totalPlayable) * 100) : 0;
  // 48Ω baseline + 6Ω per conducted node + 14Ω inductive resistance per 90-degree corner
  const impedanceOhms = 48 + conductedCount * 6 + turnsCount * 14;

  return {
    isolatedCells,
    nextCheckpointNumber,
    nextCheckpointCell,
    distanceToNext,
    directionToNext,
    totalPlayable,
    conductedCount,
    conductedPct,
    turnsCount,
    impedanceOhms,
    hasDeadEnd,
    safeRollbackLength,
    checkpointStatus,
  };
}
