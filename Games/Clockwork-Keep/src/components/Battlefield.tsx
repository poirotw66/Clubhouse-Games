import { useEffect, useRef, useState, type ReactElement } from 'react';
import { ENTRANCE, EXIT, GRID_H, GRID_W, TOWER_DEFS, type TowerType } from '../game/constants';
import { makeEmptyOccupancy, reconstructPath, wouldSealExit } from '../game/pathfinding';
import {
  drawCenteredSprite,
  boardFloorImage,
  enemySprite,
  preloadBattlefieldSprites,
  towerSprite,
} from '../game/sprites';
import type { Cell, Enemy, GameState } from '../game/types';

preloadBattlefieldSprites();

const CELL = 64;
const BOARD_W = GRID_W * CELL;
const BOARD_H = GRID_H * CELL;

const TOWER_COLORS: Record<TowerType, string> = {
  crossbow: '#d97706',
  grinder: '#94a3b8',
  frost: '#38bdf8',
  coil: '#a78bfa',
};

const ENEMY_COLORS: Record<Enemy['type'], string> = {
  grunt: '#f59e0b',
  runner: '#f472b6',
  ironclad: '#64748b',
  kite: '#5eead4',
  boss: '#ef4444',
};

interface BattlefieldProps {
  state: GameState;
  hoverCell: Cell | null;
  selectedTowerType: TowerType | null;
  selectedTowerId: number | null;
  onCellHover: (cell: Cell | null) => void;
  onCellClick: (x: number, y: number) => void;
}

function buildOccupancyFrom(state: GameState) {
  const grid = makeEmptyOccupancy(state.gridW, state.gridH);
  for (const r of state.rocks) grid[r.y][r.x] = true;
  for (const t of state.towers) grid[t.y][t.x] = true;
  return grid;
}

function drawPathLine(ctx: CanvasRenderingContext2D, path: Cell[], color: string, dashed: boolean): void {
  if (path.length < 2) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (dashed) ctx.setLineDash([10, 8]);
  ctx.beginPath();
  path.forEach((c, i) => {
    const px = c.x * CELL + CELL / 2;
    const py = c.y * CELL + CELL / 2;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();
  ctx.restore();
}

function draw(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  hoverCell: Cell | null,
  selectedTowerType: TowerType | null,
  selectedTowerId: number | null,
): void {
  ctx.clearRect(0, 0, BOARD_W, BOARD_H);

  // Panel background — soft wooden floor plate under the grid.
  ctx.fillStyle = '#1c1409';
  ctx.fillRect(0, 0, BOARD_W, BOARD_H);
  const floor = boardFloorImage();
  if (floor.complete && floor.naturalWidth > 0) {
    ctx.save();
    ctx.globalAlpha = 0.82;
    ctx.drawImage(floor, 0, 0, BOARD_W, BOARD_H);
    ctx.restore();
    ctx.fillStyle = 'rgba(28, 20, 9, 0.35)';
    ctx.fillRect(0, 0, BOARD_W, BOARD_H);
  }

  // Grid cells
  for (let y = 0; y < state.gridH; y++) {
    for (let x = 0; x < state.gridW; x++) {
      const isRock = state.rocks.some((r) => r.x === x && r.y === y);
      const isEntrance = x === ENTRANCE.x && y === ENTRANCE.y;
      const isExit = x === EXIT.x && y === EXIT.y;
      // Soft checker wash so pathfinding cells stay readable over the plate.
      ctx.fillStyle = isRock
        ? 'rgba(63, 47, 24, 0.72)'
        : (x + y) % 2 === 0
          ? 'rgba(42, 32, 19, 0.28)'
          : 'rgba(37, 28, 16, 0.38)';
      ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.strokeRect(x * CELL + 0.5, y * CELL + 0.5, CELL - 1, CELL - 1);

      if (isRock) {
        ctx.fillStyle = '#5c4526';
        ctx.beginPath();
        ctx.arc(x * CELL + CELL / 2, y * CELL + CELL / 2, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      if (isEntrance) {
        ctx.fillStyle = 'rgba(74, 222, 128, 0.35)';
        ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
        ctx.fillStyle = '#4ade80';
        ctx.font = 'bold 13px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('入口', x * CELL + CELL / 2, y * CELL + CELL / 2 + 5);
      }
      if (isExit) {
        ctx.fillStyle = 'rgba(248, 113, 113, 0.3)';
        ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
        ctx.fillStyle = '#f87171';
        ctx.font = 'bold 13px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('出口', x * CELL + CELL / 2, y * CELL + CELL / 2 + 5);
      }
    }
  }

  // Current shortest path guide line
  const occupancy = buildOccupancyFrom(state);
  const currentPath = reconstructPath(occupancy, state.gridW, state.gridH, ENTRANCE, EXIT);
  if (currentPath) drawPathLine(ctx, currentPath, 'rgba(250, 204, 21, 0.55)', true);

  // Hover preview (placement hint)
  let previewLegal: boolean | null = null;
  if (hoverCell && selectedTowerType) {
    const { x, y } = hoverCell;
    const inBounds = x >= 0 && x < state.gridW && y >= 0 && y < state.gridH;
    const occupied =
      inBounds &&
      (state.rocks.some((r) => r.x === x && r.y === y) ||
        state.towers.some((t) => t.x === x && t.y === y) ||
        (x === ENTRANCE.x && y === ENTRANCE.y) ||
        (x === EXIT.x && y === EXIT.y));
    if (inBounds && !occupied) {
      const seals = wouldSealExit(occupancy, x, y, state.gridW, state.gridH, ENTRANCE, EXIT);
      previewLegal = !seals;
      if (!seals) {
        const trial = occupancy.map((row) => row.slice());
        trial[y][x] = true;
        const newPath = reconstructPath(trial, state.gridW, state.gridH, ENTRANCE, EXIT);
        if (newPath) drawPathLine(ctx, newPath, 'rgba(74, 222, 128, 0.85)', false);
      }
      const def = TOWER_DEFS[selectedTowerType];
      const range = def.levels[0].range;
      ctx.beginPath();
      ctx.arc(x * CELL + CELL / 2, y * CELL + CELL / 2, range * CELL, 0, Math.PI * 2);
      ctx.fillStyle = seals ? 'rgba(248,113,113,0.12)' : 'rgba(74,222,128,0.12)';
      ctx.fill();
      ctx.strokeStyle = seals ? 'rgba(248,113,113,0.6)' : 'rgba(74,222,128,0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      previewLegal = false;
    }
    ctx.fillStyle = previewLegal ? 'rgba(74,222,128,0.25)' : 'rgba(248,113,113,0.25)';
    if (inBounds) ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
  }

  // Towers
  for (const t of state.towers) {
    const cx = t.x * CELL + CELL / 2;
    const cy = t.y * CELL + CELL / 2;
    const isSelected = t.id === selectedTowerId;
    if (isSelected) {
      const def = TOWER_DEFS[t.type];
      const range = def.levels[t.level].range;
      ctx.beginPath();
      ctx.arc(cx, cy, range * CELL, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.save();
    ctx.strokeStyle = isSelected ? '#fff' : 'rgba(0,0,0,0.5)';
    ctx.lineWidth = isSelected ? 3 : 2;
    const size = CELL * 0.7;
    const img = towerSprite(t.type);
    if (!drawCenteredSprite(ctx, img, cx, cy, size)) {
      ctx.fillStyle = TOWER_COLORS[t.type];
      ctx.beginPath();
      ctx.roundRect(cx - size / 2, cy - size / 2, size, size, 8);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.roundRect(cx - size / 2, cy - size / 2, size, size, 8);
    ctx.stroke();
    ctx.restore();

    // Level pips
    for (let i = 0; i <= t.level; i++) {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(cx - 12 + i * 12, cy + size / 2 - 4, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Enemies
  for (const e of state.enemies) {
    const cx = e.worldX * CELL;
    const cy = e.worldY * CELL;
    const r = e.type === 'boss' ? 18 : e.type === 'ironclad' ? 14 : 10;
    const img = enemySprite(e.type);
    const size = r * 2.4;
    if (!drawCenteredSprite(ctx, img, cx, cy, size)) {
      ctx.beginPath();
      ctx.fillStyle = ENEMY_COLORS[e.type];
      ctx.strokeStyle = e.flying ? '#ffffff' : 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 2;
      if (e.flying) {
        ctx.moveTo(cx, cy - r);
        ctx.lineTo(cx + r, cy);
        ctx.lineTo(cx, cy + r);
        ctx.lineTo(cx - r, cy);
        ctx.closePath();
      } else {
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.stroke();
    }

    // HP bar
    const barW = r * 2.2;
    const pct = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(cx - barW / 2, cy - r - 9, barW, 4);
    ctx.fillStyle = pct > 0.4 ? '#4ade80' : '#f87171';
    ctx.fillRect(cx - barW / 2, cy - r - 9, barW * pct, 4);
  }
}

export function Battlefield({
  state,
  hoverCell,
  selectedTowerType,
  selectedTowerId,
  onCellHover,
  onCellClick,
}: BattlefieldProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [spritesTick, setSpritesTick] = useState(0);

  useEffect(() => {
    preloadBattlefieldSprites();
    const imgs = [
      ...(['crossbow', 'grinder', 'frost', 'coil'] as const).map(towerSprite),
      ...(['grunt', 'runner', 'ironclad', 'kite', 'boss'] as const).map(enemySprite),
    ];
    const bump = () => setSpritesTick((n) => n + 1);
    for (const img of imgs) {
      if (!img.complete) img.addEventListener('load', bump);
    }
    return () => {
      for (const img of imgs) img.removeEventListener('load', bump);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== BOARD_W * dpr || canvas.height !== BOARD_H * dpr) {
      canvas.width = BOARD_W * dpr;
      canvas.height = BOARD_H * dpr;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(ctx, state, hoverCell, selectedTowerType, selectedTowerId);
  }, [state, hoverCell, selectedTowerType, selectedTowerId, spritesTick]);

  function cellFromEvent(e: { clientX: number; clientY: number }): Cell | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const scaleX = BOARD_W / rect.width;
    const scaleY = BOARD_H / rect.height;
    const lx = (e.clientX - rect.left) * scaleX;
    const ly = (e.clientY - rect.top) * scaleY;
    const gx = Math.floor(lx / CELL);
    const gy = Math.floor(ly / CELL);
    if (gx < 0 || gx >= GRID_W || gy < 0 || gy >= GRID_H) return null;
    return { x: gx, y: gy };
  }

  return (
    <div className="w-full max-w-3xl mx-auto" style={{ aspectRatio: `${GRID_W} / ${GRID_H}` }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block', borderRadius: 12, touchAction: 'none' }}
        className="border border-amber-900/50 shadow-2xl"
        onPointerMove={(e) => onCellHover(cellFromEvent(e))}
        onPointerLeave={() => onCellHover(null)}
        onPointerDown={(e) => {
          const cell = cellFromEvent(e);
          if (cell) onCellClick(cell.x, cell.y);
        }}
        role="img"
        aria-label="發條守城戰場"
      />
    </div>
  );
}
