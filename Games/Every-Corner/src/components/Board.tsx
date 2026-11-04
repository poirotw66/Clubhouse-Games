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
  isolatedCells?: Set<CellId>;
  targetCheckpointCell?: CellId | null;
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
  isolatedCells,
  targetCheckpointCell,
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
      className={`ec-board w-full touch-none select-none transition-all duration-300${
        solved ? ' ec-board-solved ec-board-overdrive' : ''
      }`}
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
      <defs>
        {/* Glow filter for conducting lines */}
        <filter id="ec-neon-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Stronger discharge glow filter on completion */}
        <filter id="ec-discharge-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Hazard pattern for isolated dead-end cells */}
        <pattern id="ec-hazard-pattern" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="8" height="16" fill="rgba(239, 68, 68, 0.38)" />
          <rect x="8" width="8" height="16" fill="rgba(30, 27, 75, 0.85)" />
        </pattern>

        {/* Target checkpoint beacon radial glow */}
        <radialGradient id="ec-target-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fef08a" stopOpacity="0.88" />
          <stop offset="55%" stopColor="#eab308" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#ca8a04" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Grid Cells: PCB substrate & via anchors */}
      {Array.from({ length: size.rows * size.cols }, (_, cell) => {
        const x = colOf(size, cell) * cellSize;
        const y = rowOf(size, cell) * cellSize;
        if (holeSet.has(cell)) {
          return (
            <g key={cell}>
              <rect
                x={x + GAP / 2}
                y={y + GAP / 2}
                width={cellSize - GAP}
                height={cellSize - GAP}
                rx={12}
                fill="rgba(10, 8, 20, 0.95)"
                stroke="rgba(244, 63, 94, 0.45)"
                strokeWidth={2}
                strokeDasharray="5 5"
              />
              <circle cx={x + cellSize / 2} cy={y + cellSize / 2} r={3.5} fill="rgba(244, 63, 94, 0.65)" />
            </g>
          );
        }

        const onPath = path.includes(cell);
        const isIsolated = isolatedCells?.has(cell);
        const isRevealed = revealed.includes(cell);

        if (isIsolated) {
          return (
            <g key={cell}>
              <rect
                x={x + GAP / 2}
                y={y + GAP / 2}
                width={cellSize - GAP}
                height={cellSize - GAP}
                rx={12}
                fill="url(#ec-hazard-pattern)"
                stroke="#ef4444"
                strokeWidth={3}
                className="ec-hazard-cell"
              />
              <circle cx={x + cellSize / 2} cy={y + cellSize / 2} r={cellSize * 0.28} fill="rgba(239, 68, 68, 0.2)" />
              <text
                x={x + cellSize / 2}
                y={y + cellSize / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={cellSize * 0.28}
                fill="#fca5a5"
                opacity={0.95}
              >
                ⚠️
              </text>
            </g>
          );
        }

        return (
          <g key={cell}>
            <rect
              x={x + GAP / 2}
              y={y + GAP / 2}
              width={cellSize - GAP}
              height={cellSize - GAP}
              rx={12}
              fill={
                onPath
                  ? solved
                    ? 'rgba(16, 185, 129, 0.26)'
                    : 'rgba(147, 51, 234, 0.24)'
                  : 'rgba(15, 23, 42, 0.6)'
              }
              stroke={
                isRevealed
                  ? '#fbbf24'
                  : onPath
                  ? solved
                    ? 'rgba(52, 211, 153, 0.75)'
                    : 'rgba(168, 85, 247, 0.55)'
                  : 'rgba(71, 85, 105, 0.35)'
              }
              strokeWidth={isRevealed ? 4 : onPath ? 1.5 : 1}
            />
            {/* PCB via corner solder points */}
            <circle
              cx={x + 10}
              cy={y + 10}
              r={1.8}
              fill={onPath ? (solved ? '#34d399' : 'rgba(192, 132, 252, 0.8)') : 'rgba(100, 116, 139, 0.35)'}
            />
            <circle
              cx={x + cellSize - 10}
              cy={y + 10}
              r={1.8}
              fill={onPath ? (solved ? '#34d399' : 'rgba(192, 132, 252, 0.8)') : 'rgba(100, 116, 139, 0.35)'}
            />
            <circle
              cx={x + 10}
              cy={y + cellSize - 10}
              r={1.8}
              fill={onPath ? (solved ? '#34d399' : 'rgba(192, 132, 252, 0.8)') : 'rgba(100, 116, 139, 0.35)'}
            />
            <circle
              cx={x + cellSize - 10}
              cy={y + cellSize - 10}
              r={1.8}
              fill={onPath ? (solved ? '#34d399' : 'rgba(192, 132, 252, 0.8)') : 'rgba(100, 116, 139, 0.35)'}
            />
          </g>
        );
      })}

      {/* Full Grid Overdrive Shockwaves on Completion */}
      {solved && points.length > 0 && (
        <g pointerEvents="none">
          <circle
            cx={points[points.length - 1].x}
            cy={points[points.length - 1].y}
            fill="none"
            stroke="#34d399"
            className="ec-discharge-shockwave-1"
          />
          <circle
            cx={points[points.length - 1].x}
            cy={points[points.length - 1].y}
            fill="none"
            stroke="#38bdf8"
            className="ec-discharge-shockwave-2"
          />
        </g>
      )}

      {/* Conducting Polyline: 4-Layer High-Voltage Cyber Circuit */}
      {points.length > 1 && (
        <>
          {/* Layer 1: Ambient Neon Glow */}
          <polyline
            points={polyline}
            fill="none"
            stroke={solved ? '#10b981' : '#c084fc'}
            strokeWidth={cellSize * 0.42}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={solved ? 0.55 : 0.35}
            filter={solved ? 'url(#ec-discharge-glow)' : 'url(#ec-neon-glow)'}
          />
          {/* Layer 2: Core Superconductor */}
          <polyline
            points={polyline}
            fill="none"
            stroke={solved ? '#34d399' : '#a855f7'}
            strokeWidth={cellSize * 0.24}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.92}
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
          {/* Layer 3: Central High-Voltage Core Spine */}
          <polyline
            points={polyline}
            fill="none"
            stroke={solved ? '#ecfdf5' : '#f5d0fe'}
            strokeWidth={cellSize * 0.08}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.92}
          />
          {/* Layer 4: High-Velocity Moving Energy Stream */}
          <polyline
            points={polyline}
            fill="none"
            stroke={solved ? '#a7f3d0' : '#e0e7ff'}
            strokeWidth={cellSize * 0.12}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="14 24"
            className="ec-energy-pulse"
            opacity={solved ? 0.95 : 0.8}
          />
        </>
      )}

      {/* Quantum Energy Probe (Path Head with Rotating Sensor Rings) */}
      {points.length > 0 && (
        <g pointerEvents="none">
          <circle
            cx={points[points.length - 1].x}
            cy={points[points.length - 1].y}
            r={cellSize * 0.28}
            fill="none"
            stroke={solved ? '#34d399' : '#38bdf8'}
            strokeWidth={1.5}
            strokeDasharray="4 6"
            className="ec-radar-spin-slow"
            opacity={0.75}
          />
          <circle
            cx={points[points.length - 1].x}
            cy={points[points.length - 1].y}
            r={cellSize * 0.2}
            fill="none"
            stroke={solved ? '#6ee7b7' : '#0284c7'}
            strokeWidth={2}
            opacity={0.7}
          />
          <circle
            cx={points[points.length - 1].x}
            cy={points[points.length - 1].y}
            r={cellSize * 0.15}
            fill={solved ? '#34d399' : '#0284c7'}
            className={solved ? 'ec-path-head' : undefined}
          />
          <circle
            cx={points[points.length - 1].x}
            cy={points[points.length - 1].y}
            r={cellSize * 0.065}
            fill="#ffffff"
          />
        </g>
      )}

      {/* Walls (High-Energy Laser Barriers with Anchor Studs) */}
      {puzzle.walls.map((wall) => {
        const [a, b] = wall.split(':').map(Number);
        const ca = centre(a);
        const cb = centre(b);
        const mx = (ca.x + cb.x) / 2;
        const my = (ca.y + cb.y) / 2;
        const sideBySide = rowOf(size, a) === rowOf(size, b);
        const x1 = sideBySide ? mx : mx - cellSize / 2 + GAP / 2;
        const y1 = sideBySide ? my - cellSize / 2 + GAP / 2 : my;
        const x2 = sideBySide ? mx : mx + cellSize / 2 - GAP / 2;
        const y2 = sideBySide ? my + cellSize / 2 - GAP / 2 : my;

        return (
          <g key={wall}>
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#f43f5e"
              strokeWidth={7}
              strokeLinecap="round"
            />
            <circle cx={x1} cy={y1} r={4.5} fill="#fda4af" stroke="#e11d48" strokeWidth={1.5} />
            <circle cx={x2} cy={y2} r={4.5} fill="#fda4af" stroke="#e11d48" strokeWidth={1.5} />
          </g>
        );
      })}

      {/* Checkpoints (Relay Cores with Target Beacons) */}
      {Object.entries(puzzle.checkpoints).map(([cellKey, number]) => {
        const cell = Number(cellKey);
        const { x, y } = centre(cell);
        const reached = path.includes(cell);
        const isTarget = targetCheckpointCell === cell;

        return (
          <g key={cell}>
            {/* Target Beacon Pulse */}
            {isTarget && !reached && (
              <>
                <circle cx={x} cy={y} r={cellSize * 0.44} fill="url(#ec-target-glow)" className="ec-beacon-pulse" />
                <circle
                  cx={x}
                  cy={y}
                  r={cellSize * 0.38}
                  fill="none"
                  stroke="#facc15"
                  strokeWidth={2}
                  strokeDasharray="6 6"
                  className="ec-radar-spin-slow"
                />
              </>
            )}

            {/* Checkpoint Outer Alloy Rim & Core Reactor Ring */}
            {reached && (
              <circle
                cx={x}
                cy={y}
                r={cellSize * 0.34}
                fill="none"
                stroke={solved ? '#34d399' : '#c084fc'}
                strokeWidth={1.5}
                opacity={0.65}
              />
            )}

            <circle
              cx={x}
              cy={y}
              r={cellSize * 0.3}
              fill={reached ? (solved ? '#065f46' : '#581c87') : '#0f172a'}
              stroke={reached ? (solved ? '#34d399' : '#c084fc') : isTarget ? '#facc15' : '#64748b'}
              strokeWidth={isTarget ? 3.5 : 2.5}
            />

            {/* Checkpoint Number */}
            <text
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={cellSize * 0.34}
              fontWeight="900"
              fontFamily="system-ui, sans-serif"
              fill={reached ? '#f5d0fe' : isTarget ? '#fef08a' : '#cbd5e1'}
            >
              {number}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
