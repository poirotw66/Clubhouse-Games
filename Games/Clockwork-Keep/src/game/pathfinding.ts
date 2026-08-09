/**
 * Flow-field pathfinding: a single BFS from the exit gives every walkable
 * cell its shortest distance to the exit and the direction to step in to
 * decrease that distance. Ground enemies simply follow the field from
 * wherever they currently stand, which is what makes them "always walk the
 * current shortest path" even while a tower is placed mid-transit — the
 * field is recomputed on every placement/sell and enemies re-read it as
 * soon as they finish crossing to their next cell.
 *
 * Reusing the same field for "closest enemy to the exit" targeting keeps
 * targeting and pathing consistent with each other for free.
 */
import { DIRECTIONS, ENTRANCE, EXIT, GRID_H, GRID_W } from './constants.ts';
import type { Cell, OccupancyGrid } from './types.ts';

export interface FlowField {
  /** distance[y][x] = steps to the exit, Infinity if unreachable. */
  distance: number[][];
  /** step[y][x] = direction to move from (x,y) toward the exit, or null at the exit / unreachable cells. */
  step: (({ dx: number; dy: number }) | null)[][];
}

export function makeEmptyOccupancy(
  gridW: number = GRID_W,
  gridH: number = GRID_H,
): OccupancyGrid {
  return Array.from({ length: gridH }, () => Array.from({ length: gridW }, () => false));
}

export function cloneOccupancy(grid: OccupancyGrid): OccupancyGrid {
  return grid.map((row) => row.slice());
}

export function inBounds(x: number, y: number, gridW: number, gridH: number): boolean {
  return x >= 0 && x < gridW && y >= 0 && y < gridH;
}

/**
 * BFS outward from the exit. Neighbors are always tried in the fixed
 * DIRECTIONS order, and a cell's distance/step is written only the first
 * time it's reached — so equal-length alternatives always resolve to the
 * same field, every run.
 */
export function computeFlowField(
  occupancy: OccupancyGrid,
  gridW: number = GRID_W,
  gridH: number = GRID_H,
  exit: Cell = EXIT,
): FlowField {
  const distance: number[][] = Array.from({ length: gridH }, () => Array(gridW).fill(Infinity));
  const step: FlowField['step'] = Array.from({ length: gridH }, () => Array(gridW).fill(null));

  if (occupancy[exit.y]?.[exit.x]) {
    // Exit itself is blocked — nothing is reachable.
    return { distance, step };
  }

  distance[exit.y][exit.x] = 0;
  const queue: Cell[] = [{ x: exit.x, y: exit.y }];
  let head = 0;

  while (head < queue.length) {
    const cur = queue[head++];
    const curDist = distance[cur.y][cur.x];
    for (const dir of DIRECTIONS) {
      const nx = cur.x + dir.dx;
      const ny = cur.y + dir.dy;
      if (!inBounds(nx, ny, gridW, gridH)) continue;
      if (occupancy[ny][nx]) continue;
      if (distance[ny][nx] !== Infinity) continue;
      distance[ny][nx] = curDist + 1;
      // Moving from (nx,ny) toward (cur.x,cur.y) is the reverse of `dir`.
      step[ny][nx] = { dx: -dir.dx, dy: -dir.dy };
      queue.push({ x: nx, y: ny });
    }
  }

  return { distance, step };
}

export function distanceToExit(field: FlowField, x: number, y: number): number {
  return field.distance[y]?.[x] ?? Infinity;
}

/** Shortest ground path length from the entrance, or Infinity if sealed. */
export function pathLength(
  occupancy: OccupancyGrid,
  gridW: number = GRID_W,
  gridH: number = GRID_H,
  entrance: Cell = ENTRANCE,
  exit: Cell = EXIT,
): number {
  const field = computeFlowField(occupancy, gridW, gridH, exit);
  return distanceToExit(field, entrance.x, entrance.y);
}

/**
 * Would placing a blocker at (x,y) still leave a route from entrance to
 * exit? This is the hard "no sealing the exit" rule — legality is decided
 * before gold changes hands.
 */
export function wouldSealExit(
  occupancy: OccupancyGrid,
  x: number,
  y: number,
  gridW: number = GRID_W,
  gridH: number = GRID_H,
  entrance: Cell = ENTRANCE,
  exit: Cell = EXIT,
): boolean {
  const trial = cloneOccupancy(occupancy);
  trial[y][x] = true;
  return pathLength(trial, gridW, gridH, entrance, exit) === Infinity;
}

/** Full entrance -> exit cell path, following the flow field. Null if sealed. */
export function reconstructPath(
  occupancy: OccupancyGrid,
  gridW: number = GRID_W,
  gridH: number = GRID_H,
  entrance: Cell = ENTRANCE,
  exit: Cell = EXIT,
): Cell[] | null {
  const field = computeFlowField(occupancy, gridW, gridH, exit);
  if (distanceToExit(field, entrance.x, entrance.y) === Infinity) return null;

  const path: Cell[] = [{ x: entrance.x, y: entrance.y }];
  let cur = { x: entrance.x, y: entrance.y };
  let guard = gridW * gridH + 1; // BFS distance bounds the true path length; this only stops runaway loops on a bad field.
  while (!(cur.x === exit.x && cur.y === exit.y) && guard-- > 0) {
    const dir = field.step[cur.y][cur.x];
    if (!dir) return null;
    cur = { x: cur.x + dir.dx, y: cur.y + dir.dy };
    path.push({ x: cur.x, y: cur.y });
  }
  return cur.x === exit.x && cur.y === exit.y ? path : null;
}
