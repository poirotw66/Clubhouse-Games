import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildNeighbours, colOf, playableCount, rowOf, routeTo, wallKey } from '../game/grid';
import type { CellId, Puzzle } from '../game/types';

interface Props {
  puzzle: Puzzle;
  path: CellId[];
  revealed: CellId[];
  onPathChange: (path: CellId[]) => void;
  solved: boolean;
  /** Fires once the completion path-trace finishes (or immediately if reduced motion). */
  onTraceComplete?: () => void;
}

const GAP = 4;

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * The board is one SVG rather than a grid of DOM nodes: the path is a single
 * polyline, so it stays continuous through corners instead of being reassembled
 * from per-cell borders.
 */
export function Board({
  puzzle,
  path,
  revealed,
  onPathChange,
  solved,
  onTraceComplete,
}: Props): React.ReactElement {
  const { size } = puzzle;
  const svgRef = useRef<SVGSVGElement>(null);
  const drawing = useRef(false);
  /** Last pointer position, so a fast drag can be walked cell by cell. */
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const pathRef = useRef(path);
  pathRef.current = path;
  const holeSet = useMemo(() => new Set(puzzle.blocked), [puzzle.blocked]);
  const [traceProgress, setTraceProgress] = useState(1);
  const tracedFor = useRef<string | null>(null);

  const cellSize = 100;
  const width = size.cols * cellSize;
  const height = size.rows * cellSize;
  const neighbourSet = useRef(new Set(puzzle.walls));
  neighbourSet.current = new Set(puzzle.walls);
  const neighbours = useRef(buildNeighbours(size, puzzle.walls, puzzle.blocked));
  neighbours.current = buildNeighbours(size, puzzle.walls, puzzle.blocked);

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
      const cell = row * size.cols + col;
      if (holeSet.has(cell)) return null;
      return cell;
    },
    [size, holeSet],
  );

  const extend = useCallback(
    (cell: CellId) => {
      if (holeSet.has(cell)) return;
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
    [onPathChange, puzzle.checkpoints, size, holeSet],
  );

  /**
   * Feeds every cell the pointer swept over since the last event, not just the
   * one it happens to be sitting on now.
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

  // Path-trace completion: draw the green line from start to finish once.
  useEffect(() => {
    if (!solved) {
      setTraceProgress(1);
      tracedFor.current = null;
      return;
    }
    const key = `${puzzle.seedCode}:${path.length}`;
    if (tracedFor.current === key) return;
    tracedFor.current = key;

    if (prefersReducedMotion() || path.length < 2) {
      setTraceProgress(1);
      onTraceComplete?.();
      return;
    }

    setTraceProgress(0);
    const duration = Math.min(1800, 280 + path.length * 28);
    const started = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / duration);
      // Ease-out so the finish lands rather than racing.
      const eased = 1 - (1 - t) * (1 - t);
      setTraceProgress(eased);
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        onTraceComplete?.();
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [solved, puzzle.seedCode, path.length, onTraceComplete]);

  const points = path.map(centre);
  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ');
  const pathLength = useMemo(() => {
    let length = 0;
    for (let i = 1; i < points.length; i++) {
      length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    }
    return length;
  }, [points]);

  const totalPlayable = playableCount(size, puzzle.blocked);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${width} ${height}`}
      className={`ec-board w-full touch-none select-none${solved ? ' ec-board-solved' : ''}`}
      role="img"
      aria-label={`${size.rows} 乘 ${size.cols} 的盤面，已走 ${path.length} 格，共 ${totalPlayable} 格${
        puzzle.blocked.length > 0 ? `，缺口 ${puzzle.blocked.length} 格` : ''
      }`}
      onPointerDown={(event) => {
        if (solved) return;
        event.preventDefault();
        drawing.current = true;
        lastPoint.current = { x: event.clientX, y: event.clientY };
        const cell = cellAt(event.clientX, event.clientY);
        if (cell === null) return;

        // Tapping a number the line already passes through winds back to it and
        // leaves you drawing from there.
        const index = pathRef.current.indexOf(cell);
        if (index !== -1 && puzzle.checkpoints[cell] !== undefined) {
          if (index < pathRef.current.length - 1) {
            onPathChange(pathRef.current.slice(0, index + 1));
          }
          return;
        }
        extend(cell);
      }}
    >
      {Array.from({ length: size.rows * size.cols }, (_, cell) => {
        const x = colOf(size, cell) * cellSize;
        const y = rowOf(size, cell) * cellSize;
        if (holeSet.has(cell)) {
          return (
            <rect
              key={cell}
              x={x + GAP / 2}
              y={y + GAP / 2}
              width={cellSize - GAP}
              height={cellSize - GAP}
              rx={12}
              fill="rgba(15, 11, 28, 0.95)"
              stroke="rgba(244, 114, 182, 0.35)"
              strokeWidth={3}
              strokeDasharray="6 6"
            />
          );
        }
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
            stroke={revealed.includes(cell) ? '#fbbf24' : 'transparent'}
            strokeWidth={revealed.includes(cell) ? 5 : 0}
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
          className={solved ? 'ec-path-trace' : undefined}
          style={
            solved && pathLength > 0
              ? {
                  strokeDasharray: pathLength,
                  strokeDashoffset: pathLength * (1 - traceProgress),
                }
              : undefined
          }
        />
      )}
      {points.length > 0 && (
        <circle
          cx={points[points.length - 1].x}
          cy={points[points.length - 1].y}
          r={cellSize * 0.17}
          fill={solved ? '#4ade80' : '#c4b5fd'}
          className={solved ? 'ec-path-head' : undefined}
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
