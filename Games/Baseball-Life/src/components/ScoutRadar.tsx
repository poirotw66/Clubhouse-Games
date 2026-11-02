import React, { useState } from 'react';
import {
  ATTR_LABELS,
  BATTER_ATTRS,
  PITCHER_ATTRS,
  grade,
  gradeColor,
} from '../game/config';
import type { AttrKey, Position } from '../game/types';

interface ScoutRadarProps {
  attrs: Record<AttrKey, number>;
  position: Position;
  highlightKeys?: AttrKey[];
  size?: number;
}

const PENTAGON_ANGLES = [
  -Math.PI / 2, // 0: Top
  -Math.PI / 2 + (2 * Math.PI) / 5, // 1: Top-Right
  -Math.PI / 2 + (4 * Math.PI) / 5, // 2: Bottom-Right
  -Math.PI / 2 + (6 * Math.PI) / 5, // 3: Bottom-Left
  -Math.PI / 2 + (8 * Math.PI) / 5, // 4: Top-Left
];

function getPoint(cx: number, cy: number, radius: number, angle: number): [number, number] {
  return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
}

function polygonPath(points: [number, number][]): string {
  return points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ') + 'Z';
}

/**
 * 5-point scouting radar chart for baseball player attributes.
 * Visualizes contact, power, speed, fielding, and eye for batters,
 * or velocity, control, breaking, stamina, and guts for pitchers.
 */
export function ScoutRadar({
  attrs,
  position,
  highlightKeys = [],
  size = 240,
}: ScoutRadarProps): React.ReactElement {
  const isTwoWay = position === 'TW';
  const isDefaultPitcher = position === 'P';
  const [activeRole, setActiveRole] = useState<'batter' | 'pitcher'>(
    isDefaultPitcher ? 'pitcher' : 'batter'
  );

  const keys =
    isTwoWay
      ? activeRole === 'pitcher'
        ? PITCHER_ATTRS
        : BATTER_ATTRS
      : isDefaultPitcher
        ? PITCHER_ATTRS
        : BATTER_ATTRS;

  const cx = size / 2;
  const cy = size / 2;
  const maxRadius = size * 0.36;

  // Concentric reference levels: 25 (F), 60 (Pro Average B), 100 (S Cap)
  const refLevels = [25, 60, 100];
  const refPaths = refLevels.map((lvl) => {
    const r = (lvl / 100) * maxRadius;
    const pts = PENTAGON_ANGLES.map((ang) => getPoint(cx, cy, r, ang));
    return { level: lvl, path: polygonPath(pts) };
  });

  // Current player polygon
  const playerPoints: [number, number][] = keys.map((key, i) => {
    const val = Math.max(10, Math.min(100, attrs[key] ?? 30));
    const r = (val / 100) * maxRadius;
    return getPoint(cx, cy, r, PENTAGON_ANGLES[i]);
  });
  const playerPolygon = polygonPath(playerPoints);

  return (
    <div className="flex flex-col items-center">
      {isTwoWay && (
        <div className="mb-1 flex rounded-lg bg-slate-900/80 p-0.5 border border-slate-700/60 text-xs">
          <button
            type="button"
            onClick={() => setActiveRole('batter')}
            className={`rounded-md px-2.5 py-1 font-bold transition ${
              activeRole === 'batter'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            打擊五角
          </button>
          <button
            type="button"
            onClick={() => setActiveRole('pitcher')}
            className={`rounded-md px-2.5 py-1 font-bold transition ${
              activeRole === 'pitcher'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            投球五角
          </button>
        </div>
      )}

      <div className="relative" style={{ width: size, height: size }}>
        <svg
          viewBox={`0 0 ${size} ${size}`}
          width={size}
          height={size}
          className="overflow-visible select-none"
        >
          {/* Subtle home-plate / diamond backdrop glow */}
          <circle
            cx={cx}
            cy={cy}
            r={maxRadius}
            fill="none"
            stroke="rgba(148, 163, 184, 0.08)"
            strokeWidth="1"
          />

          {/* Reference polygons */}
          {refPaths.map(({ level, path }) => (
            <path
              key={level}
              d={path}
              fill="none"
              stroke={level === 60 ? 'rgba(56, 189, 248, 0.35)' : 'rgba(148, 163, 184, 0.15)'}
              strokeWidth={level === 60 ? '1.5' : '1'}
              strokeDasharray={level === 60 ? '3 3' : undefined}
            />
          ))}

          {/* Spoke lines from center to outer vertices */}
          {PENTAGON_ANGLES.map((ang, i) => {
            const [ox, oy] = getPoint(cx, cy, maxRadius, ang);
            return (
              <line
                key={`spoke-${i}`}
                x1={cx}
                y1={cy}
                x2={ox}
                y2={oy}
                stroke="rgba(148, 163, 184, 0.2)"
                strokeWidth="1"
              />
            );
          })}

          {/* Filled player ability polygon */}
          <path
            d={playerPolygon}
            fill="rgba(251, 191, 36, 0.25)"
            stroke="#fbbf24"
            strokeWidth="2.5"
            className="transition-all duration-300"
            filter="drop-shadow(0 0 8px rgba(251, 191, 36, 0.45))"
          />

          {/* Vertex nodes & labels */}
          {keys.map((key, i) => {
            const val = attrs[key] ?? 30;
            const [px, py] = playerPoints[i];
            const [lx, ly] = getPoint(cx, cy, maxRadius + 20, PENTAGON_ANGLES[i]);
            const isHighlighted = highlightKeys.includes(key);

            return (
              <g key={`vertex-${key}`}>
                {/* Highlight beacon ripple */}
                {isHighlighted && (
                  <circle
                    cx={px}
                    cy={py}
                    r="8"
                    fill="none"
                    stroke="#34d399"
                    strokeWidth="2"
                    className="animate-ping"
                  />
                )}

                {/* Vertex node dot */}
                <circle
                  cx={px}
                  cy={py}
                  r={isHighlighted ? '5' : '3.5'}
                  fill={isHighlighted ? '#34d399' : '#fbbf24'}
                  stroke="#1e293b"
                  strokeWidth="1.5"
                  className="transition-all duration-300"
                />

                {/* Stat label & grade */}
                <text
                  x={lx}
                  y={ly}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className={`text-[10px] font-bold ${
                    isHighlighted ? 'fill-emerald-300 font-black' : 'fill-slate-300'
                  }`}
                >
                  {ATTR_LABELS[key]}{' '}
                  <tspan fill={gradeColor(val)} fontWeight="900">
                    {grade(val)}
                  </tspan>
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
