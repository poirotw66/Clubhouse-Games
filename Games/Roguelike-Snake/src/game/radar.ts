import { GRID } from './config';
import { isWall, samePos } from './level';
import type { Dir, GameState, RelicId, Vec } from './types';

export type RiskLevel = 'safe' | 'warning' | 'critical';

export interface DirectionClearance {
  ahead: number;
  left: number;
  right: number;
}

export interface RadarTelemetry {
  riskLevel: RiskLevel;
  reachableTiles: number;
  clearance: DirectionClearance;
  evolutionTier: string;
  evolutionColor: string;
  speedMs: number;
  stepsPerSecond: number;
  archetypeName: string;
  archetypeBadge: string;
}

const TURN_LEFT: Record<Dir, Dir> = {
  up: 'left',
  left: 'down',
  down: 'right',
  right: 'up',
};

const TURN_RIGHT: Record<Dir, Dir> = {
  up: 'right',
  right: 'down',
  down: 'left',
  left: 'up',
};

const DELTA: Record<Dir, Vec> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

function isCellBlocked(state: GameState, x: number, y: number, ignoreTail: boolean): boolean {
  if (x < 0 || y < 0 || x >= GRID || y >= GRID) return true;
  if (isWall(state.tiles, x, y)) return true;

  const len = state.snake.length;
  const limit = ignoreTail && len > 1 ? len - 1 : len;
  for (let i = 0; i < limit; i++) {
    const s = state.snake[i];
    if (s.x === x && s.y === y) return true;
  }
  return false;
}

function raycastClearance(state: GameState, origin: Vec, dir: Dir): number {
  const d = DELTA[dir];
  let cx = origin.x + d.x;
  let cy = origin.y + d.y;
  let steps = 0;

  while (cx >= 0 && cy >= 0 && cx < GRID && cy < GRID) {
    if (isCellBlocked(state, cx, cy, true)) break;
    steps += 1;
    cx += d.x;
    cy += d.y;
    if (steps >= GRID) break;
  }
  return steps;
}

function floodFillCount(state: GameState, start: Vec, maxTarget: number): number {
  if (isCellBlocked(state, start.x, start.y, true)) return 0;

  const visited = new Uint8Array(GRID * GRID);
  const queueX: number[] = [start.x];
  const queueY: number[] = [start.y];
  visited[start.y * GRID + start.x] = 1;

  let count = 0;
  const dx = [0, 0, -1, 1];
  const dy = [-1, 1, 0, 0];

  while (queueX.length > 0 && count < maxTarget) {
    const cx = queueX.shift()!;
    const cy = queueY.shift()!;
    count += 1;

    for (let i = 0; i < 4; i++) {
      const nx = cx + dx[i];
      const ny = cy + dy[i];
      if (nx >= 0 && ny >= 0 && nx < GRID && ny < GRID) {
        const idx = ny * GRID + nx;
        if (!visited[idx] && !isCellBlocked(state, nx, ny, true)) {
          visited[idx] = 1;
          queueX.push(nx);
          queueY.push(ny);
        }
      }
    }
  }

  return count;
}

export function computeEvolutionTier(length: number): { tier: string; color: string } {
  if (length < 6) return { tier: '幼生體 (Hatchling)', color: '#38bdf8' };
  if (length < 10) return { tier: '巡行蟒 (Serpent)', color: '#34d399' };
  if (length < 16) return { tier: '毒棘巨蟒 (Viper Titan)', color: '#a78bfa' };
  if (length < 24) return { tier: '淵喉霸蛇 (Apex Leviathan)', color: '#fbbf24' };
  return { tier: '噬宙巨蛇 (Ouroboros)', color: '#f43f5e' };
}

export function analyzeBuildArchetype(relics: RelicId[]): { name: string; badge: string } {
  const attackSet = new Set(['venom', 'fang', 'thorn', 'echo', 'blood', 'whetstone']);
  const defenseSet = new Set(['scales', 'shed', 'ghost', 'heart', 'hourglass', 'dust', 'moulting']);
  const speedSet = new Set(['swift', 'tide', 'kite', 'tremor', 'burrow', 'core']);
  const econSet = new Set(['coil', 'hunger', 'gluttony', 'alchemy', 'mirror', 'lantern', 'bag', 'gilded']);
  const mysticSet = new Set(['torpor', 'patience', 'frost', 'anchor', 'warp', 'ascetic', 'magnet', 'husk', 'saltline']);

  let attack = 0;
  let defense = 0;
  let speed = 0;
  let econ = 0;
  let mystic = 0;

  for (const r of relics) {
    if (attackSet.has(r)) attack++;
    if (defenseSet.has(r)) defense++;
    if (speedSet.has(r)) speed++;
    if (econSet.has(r)) econ++;
    if (mysticSet.has(r)) mystic++;
  }

  if (speed >= 2 && speed >= attack && speed >= defense) {
    return { name: '疾風衝刺流', badge: '⚡ 機動突入' };
  }
  if (defense >= 2 && defense >= attack && defense >= econ) {
    return { name: '鐵壁守護流', badge: '🛡️ 重裝裝甲' };
  }
  if (attack >= 2 && attack >= econ) {
    return { name: '毒牙輾殺流', badge: '⚔️ 狂暴殲滅' };
  }
  if (econ >= 2) {
    return { name: '貪金暴食流', badge: '💰 財富蛻變' };
  }
  if (mystic >= 2) {
    return { name: '深淵苦修流', badge: '🔮 空間異能' };
  }
  return { name: '均衡演化流', badge: '🧬 基因拓撲' };
}

export function getRadarTelemetry(state: GameState): RadarTelemetry {
  const head = state.snake[0] ?? { x: 10, y: 10 };
  const dir = state.dir;
  const leftDir = TURN_LEFT[dir];
  const rightDir = TURN_RIGHT[dir];

  const aheadClearance = raycastClearance(state, head, dir);
  const leftClearance = raycastClearance(state, head, leftDir);
  const rightClearance = raycastClearance(state, head, rightDir);

  const delta = DELTA[dir];
  const nextHead: Vec = { x: head.x + delta.x, y: head.y + delta.y };
  const targetArea = Math.max(state.snake.length * 2 + 8, 50);
  const reachable = floodFillCount(state, nextHead, targetArea);

  let riskLevel: RiskLevel = 'safe';
  if (aheadClearance === 0 || reachable < state.snake.length) {
    riskLevel = 'critical';
  } else if (reachable < Math.round(state.snake.length * 1.5)) {
    riskLevel = 'warning';
  }

  const evo = computeEvolutionTier(state.snake.length);
  const archetype = analyzeBuildArchetype(state.relics);
  const speedMs = Math.round(state.moveInterval);
  const stepsPerSecond = Math.round((1000 / state.moveInterval) * 10) / 10;

  return {
    riskLevel,
    reachableTiles: reachable,
    clearance: {
      ahead: aheadClearance,
      left: leftClearance,
      right: rightClearance,
    },
    evolutionTier: evo.tier,
    evolutionColor: evo.color,
    speedMs,
    stepsPerSecond,
    archetypeName: archetype.name,
    archetypeBadge: archetype.badge,
  };
}
