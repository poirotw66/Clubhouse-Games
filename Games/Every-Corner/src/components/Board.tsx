import React, { useCallback, useEffect, useRef } from 'react';
import { buildNeighbours, colOf, rowOf, routeTo, wallKey } from '../game/grid';
import type { CellId, Puzzle } from '../game/types';

interface Props {
  puzzle: Puzzle;
  path: CellId[];
  revealed: CellId | null;
  onPathChange: (path: CellId[]) => void;
  solved: boolean;
}

const GAP = 4;

/**
 * The board is one SVG rather than a grid of DOM nodes: the path is a single
 * polyline, so it stays continuous through corners instead of being reassembled
 * from per-cell borders.
 */
export function Board({ puzzle, path, revealed, onPathChange, solved }: Props): React.ReactElement {
  const { size } = puzzle;
  const svgRef = useRef<SVGSVGElement>(null);
  const drawing = useRef(false);
  /** Last pointer position, so a fast drag can be walked cell by cell. */
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const pathRef = useRef(path);
  pathRef.current = path;

  const cellSize = 100;
  const width = size.cols * cellSize;
  const height = size.rows * cellSize;
  const neighbourSet = useRef(new Set(puzzle.walls));
  neighbourSet.current = new Set(puzzle.walls);
  const neighbours = useRef(buildNeighbours(size, puzzle.walls));
  neighbours.current = buildNeighbours(size, puzzle.walls);

  const centre = (cell: CellId) => ({
    x: colOf(size, cell) * cellSize + cellSize / 2,
    y: rowOf(size, cell) * cellSize + cellSize / 2,
  });

  /** Which cell a client point falls in, or null when outside the board. */
  const cellAt = useCallback(
    (clientX: number, clientY: number): CellId | null => {
      const svg = svgRef.current;
      if (!svg) return null;
      const box = svg.getBoundingClientRect();
      const col = Math.floor(((clientX - box.left) / box.width) * size.cols);
      const row = Math.floor(((clientY - box.top) / box.height) * size.rows);
      if (row < 0 || col < 0 || row >= size.rows || col >= size.cols) return null;
      return row * size.cols + col;
    },
    [size],
  );

  const extend = useCallback(
    (cell: CellId) => {
      const current = pathRef.current;

      if (current.length === 0) {
        // Only the cell marked 1 may open the path.
        if (puzzle.checkpoints[cell] === 1) onPathChange([cell]);
        return;
      }
      if (cell === current[current.length - 1]) return;

      // Dragging back onto the previous cell rubs the last step out. This is
      // the whole undo mechanism on touch — no button needed.
      if (current.length >= 2 && cell === current[current.length - 2]) {
        onPathChange(current.slice(0, -1));
        return;
      }
      if (current.includes(cell)) return;

      const last = current[current.length - 1];
      const dr = Math.abs(rowOf(size, cell) - rowOf(size, last));
      const dc = Math.abs(colOf(size, cell) - colOf(size, last));
      if (dr + dc === 1) {
        if (neighbourSet.current.has(wallKey(last, cell))) return;
        onPathChange([...current, cell]);
        return;
      }

      // Not next to the end of the line — which is the ordinary case at any
      // real drag speed, not an error. routeTo() decides what the gesture meant;
      // see its note in grid.ts for what it refuses to guess at.
      const route = routeTo(size, neighbours.current, current, cell);
      if (route.length > 0) onPathChange([...current, ...route]);
    },
    [onPathChange, puzzle.checkpoints, size],
  );

  /**
   * Feeds every cell the pointer swept over since the last event, not just the
   * one it happens to be sitting on now.
   *
   * extend() only accepts a cell orthogonally adjacent to the end of the path,
   * which is correct — but a pointermove arrives roughly every 16ms, and a
   * finger crossing a 6x6 board in half a second moves about two cells between
   * events. Feeding it only the current cell meant every one of those events
   * was silently rejected and the line stopped following the finger. Measured
   * against a puzzle's own verified solution: sampling once per cell drew all
   * 36 of 36, sampling every two cells drew 1. Not "harder to draw" — the board
   * simply did not respond unless you crawled.
   *
   * Walking the straight segment between the two pointer positions at a third
   * of a cell at a time hands extend() an adjacent cell each step, so it keeps
   * all its own rules (walls, no crossing, no revisiting) and just stops
   * missing the cells in between. Backtracking over several cells at once falls
   * out of the same loop, since each intermediate cell is in turn the one
   * before the path's end.
   */
  const sweepTo = useCallback(
    (x: number, y: number) => {
      const from = lastPoint.current;
      lastPoint.current = { x, y };
      if (!from) {
        const cell = cellAt(x, y);
        if (cell !== null) extend(cell);
        return;
      }
      const svg = svgRef.current;
      const box = svg?.getBoundingClientRect();
      const cellPx = box ? box.width / size.cols : 40;
      const dx = x - from.x;
      const dy = y - from.y;
      const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (cellPx / 3)));
      for (let i = 1; i <= steps; i++) {
        const cell = cellAt(from.x + (dx * i) / steps, from.y + (dy * i) / steps);
        if (cell !== null) extend(cell);
      }
    },
    [cellAt, extend, size.cols],
  );

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (!drawing.current) return;
      sweepTo(event.clientX, event.clientY);
    };
    const onUp = () => {
      drawing.current = false;
      lastPoint.current = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [sweepTo]);

  const points = path.map(centre);
  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${width} ${height}`}
      className="ec-board w-full touch-none select-none"
      role="img"
      aria-label={`${size.rows} 乘 ${size.cols} 的盤面，已走 ${path.length} 格，共 ${size.rows * size.cols} 格`}
      onPointerDown={(event) => {
        event.preventDefault();
        drawing.current = true;
        lastPoint.current = { x: event.clientX, y: event.clientY };
        const cell = cellAt(event.clientX, event.clientY);
        if (cell !== null) extend(cell);
      }}
    >
      {Array.from({ length: size.rows * size.cols }, (_, cell) => {
        const x = colOf(size, cell) * cellSize;
        const y = rowOf(size, cell) * cellSize;
        const onPath = path.includes(cell);
        return (
          <rect
            key={cell}
            x={x + GAP / 2}
            y={y + GAP / 2}
            width={cellSize - GAP}
            height={cellSize - GAP}
            rx={12}
            fill={onPath ? 'rgba(167,139,250,0.14)' : 'rgba(148,163,184,0.08)'}
            stroke={cell === revealed ? '#fbbf24' : 'transparent'}
            strokeWidth={cell === revealed ? 5 : 0}
          />
        );
      })}

      {points.length > 1 && (
        <polyline
          points={polyline}
          fill="none"
          stroke={solved ? '#4ade80' : '#a78bfa'}
          strokeWidth={cellSize * 0.3}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.85}
        />
      )}
      {points.length > 0 && (
        <circle
          cx={points[points.length - 1].x}
          cy={points[points.length - 1].y}
          r={cellSize * 0.17}
          fill={solved ? '#4ade80' : '#c4b5fd'}
        />
      )}

      {/* Walls sit on the seam between two cells. */}
      {puzzle.walls.map((wall) => {
        const [a, b] = wall.split(':').map(Number);
        const ca = centre(a);
        const cb = centre(b);
        const mx = (ca.x + cb.x) / 2;
        const my = (ca.y + cb.y) / 2;
        // Cells side by side are separated by a *vertical* wall, and vice
        // versa — so the flag describes the cells, not the line.
        const sideBySide = rowOf(size, a) === rowOf(size, b);
        return (
          <line
            key={wall}
            x1={sideBySide ? mx : mx - cellSize / 2 + GAP / 2}
            y1={sideBySide ? my - cellSize / 2 + GAP / 2 : my}
            x2={sideBySide ? mx : mx + cellSize / 2 - GAP / 2}
            y2={sideBySide ? my + cellSize / 2 - GAP / 2 : my}
            stroke="#f472b6"
            strokeWidth={7}
            strokeLinecap="round"
          />
        );
      })}

      {Object.entries(puzzle.checkpoints).map(([cellKey, number]) => {
        const cell = Number(cellKey);
        const { x, y } = centre(cell);
        const reached = path.includes(cell);
        return (
          <g key={cell}>
            <circle
              cx={x}
              cy={y}
              r={cellSize * 0.3}
              fill={reached ? '#a78bfa' : '#1e1b34'}
              stroke={reached ? '#ddd6fe' : '#a78bfa'}
              strokeWidth={4}
            />
            <text
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={cellSize * 0.36}
              fontWeight="800"
              fill={reached ? '#1e1b34' : '#ddd6fe'}
            >
              {number}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
