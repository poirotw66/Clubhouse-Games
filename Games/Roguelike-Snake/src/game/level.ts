import { GRID } from './config';
import { randInt } from './rng';
import type { Vec } from './types';

export const WALL = 1;
export const FLOOR = 0;

export const CENTER = Math.floor(GRID / 2);

export type LayoutId =
  | 'open'
  | 'pillars'
  | 'cross'
  | 'rings'
  | 'corridors'
  | 'diamond'
  | 'scatter';

export const LAYOUT_NAME: Record<LayoutId, string> = {
  open: '開闊廳堂',
  pillars: '列柱大殿',
  cross: '十字迴廊',
  rings: '環形祭壇',
  corridors: '狹長甬道',
  diamond: '菱形墓室',
  scatter: '亂石崩雲',
};

const LAYOUT_POOL: LayoutId[] = [
  'pillars',
  'cross',
  'rings',
  'corridors',
  'diamond',
  'scatter',
];

export function index(x: number, y: number): number {
  return y * GRID + x;
}

export function inBounds(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < GRID && y < GRID;
}

export function isWall(tiles: Uint8Array, x: number, y: number): boolean {
  if (!inBounds(x, y)) return true;
  return tiles[index(x, y)] === WALL;
}

function setWall(tiles: Uint8Array, x: number, y: number): void {
  if (inBounds(x, y)) tiles[index(x, y)] = WALL;
}

function clearRect(tiles: Uint8Array, x0: number, y0: number, x1: number, y1: number): void {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (inBounds(x, y)) tiles[index(x, y)] = FLOOR;
    }
  }
}

function applyLayout(tiles: Uint8Array, layout: LayoutId, rng: () => number): void {
  switch (layout) {
    case 'pillars': {
      for (let y = 3; y < GRID - 3; y += 4) {
        for (let x = 3; x < GRID - 3; x += 4) {
          setWall(tiles, x, y);
          setWall(tiles, x + 1, y);
          setWall(tiles, x, y + 1);
          setWall(tiles, x + 1, y + 1);
        }
      }
      break;
    }
    case 'cross': {
      for (let i = 2; i < GRID - 2; i++) {
        if (Math.abs(i - CENTER) > 2) {
          setWall(tiles, i, CENTER);
          setWall(tiles, CENTER, i);
        }
      }
      break;
    }
    case 'rings': {
      for (const radius of [4, 8]) {
        for (let y = CENTER - radius; y <= CENTER + radius; y++) {
          for (let x = CENTER - radius; x <= CENTER + radius; x++) {
            const ring = Math.max(Math.abs(x - CENTER), Math.abs(y - CENTER)) === radius;
            const gate = x === CENTER || y === CENTER;
            if (ring && !gate) setWall(tiles, x, y);
          }
        }
      }
      break;
    }
    case 'corridors': {
      for (let x = 4; x < GRID - 2; x += 4) {
        const gap = randInt(rng, 2, GRID - 5);
        for (let y = 1; y < GRID - 1; y++) {
          if (y < gap || y > gap + 2) setWall(tiles, x, y);
        }
      }
      break;
    }
    case 'diamond': {
      for (let y = 1; y < GRID - 1; y++) {
        for (let x = 1; x < GRID - 1; x++) {
          const dist = Math.abs(x - CENTER) + Math.abs(y - CENTER);
          if ((dist === 6 || dist === 10) && x !== CENTER && y !== CENTER) {
            setWall(tiles, x, y);
          }
        }
      }
      break;
    }
    case 'scatter': {
      const blobs = randInt(rng, 10, 16);
      for (let i = 0; i < blobs; i++) {
        const x = randInt(rng, 2, GRID - 3);
        const y = randInt(rng, 2, GRID - 3);
        const horizontal = rng() < 0.5;
        const length = randInt(rng, 1, 3);
        for (let n = 0; n < length; n++) {
          setWall(tiles, horizontal ? x + n : x, horizontal ? y : y + n);
        }
      }
      break;
    }
    case 'open':
    default:
      break;
  }
}

/** Any floor pocket the snake could never reach becomes wall, so spawns stay legal. */
function sealUnreachable(tiles: Uint8Array, start: Vec): void {
  const seen = new Uint8Array(GRID * GRID);
  const queue: number[] = [index(start.x, start.y)];
  seen[queue[0]] = 1;

  while (queue.length > 0) {
    const current = queue.pop()!;
    const x = current % GRID;
    const y = Math.floor(current / GRID);
    const neighbours = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ];
    for (const [nx, ny] of neighbours) {
      if (!inBounds(nx, ny)) continue;
      const id = index(nx, ny);
      if (seen[id] || tiles[id] === WALL) continue;
      seen[id] = 1;
      queue.push(id);
    }
  }

  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] === FLOOR && !seen[i]) tiles[i] = WALL;
  }
}

export interface Terrain {
  tiles: Uint8Array;
  layout: LayoutId;
}

export function generateTerrain(rng: () => number, floor: number, isBoss: boolean): Terrain {
  const tiles = new Uint8Array(GRID * GRID);

  for (let i = 0; i < GRID; i++) {
    setWall(tiles, i, 0);
    setWall(tiles, i, GRID - 1);
    setWall(tiles, 0, i);
    setWall(tiles, GRID - 1, i);
  }

  const layout: LayoutId = floor === 1 ? 'open' : isBoss ? 'pillars' : LAYOUT_POOL[Math.floor(rng() * LAYOUT_POOL.length)];
  applyLayout(tiles, layout, rng);

  // Spawn corridor for the snake, plus breathing room around the boss pedestal.
  clearRect(tiles, CENTER - 5, CENTER - 1, CENTER + 5, CENTER + 1);
  if (isBoss) clearRect(tiles, CENTER - 3, CENTER - 8, CENTER + 3, CENTER + 3);

  sealUnreachable(tiles, { x: CENTER, y: CENTER });

  return { tiles, layout };
}

export function collectFloorCells(tiles: Uint8Array): Vec[] {
  const cells: Vec[] = [];
  for (let y = 1; y < GRID - 1; y++) {
    for (let x = 1; x < GRID - 1; x++) {
      if (tiles[index(x, y)] === FLOOR) cells.push({ x, y });
    }
  }
  return cells;
}

export function chebyshev(a: Vec, b: Vec): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export function samePos(a: Vec, b: Vec): boolean {
  return a.x === b.x && a.y === b.y;
}
