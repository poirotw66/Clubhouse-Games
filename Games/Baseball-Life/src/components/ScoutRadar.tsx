import React, { useMemo, useState } from 'react';
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

const ATTR_IMPACTS: Record<AttrKey, string> = {
  contact: '提升擊球命中率與賽季打擊率 (AVG)',
  power: '強化擊球初速與全壘打產量 (HR/SLG)',
  speed: '增加壘包侵略性與盜壘成功率 (SB)',
  fielding: '擴大防守覆蓋範圍並降低致命失誤',
  eye: '提高選球上壘率 (OBP) 與關鍵保送',
  velocity: '剛速火球壓制打者，提高奪三振率 (K/9)',
  control: '精準落點削球，大幅壓低四死保送 (BB/9)',
  breaking: '誘發打者揮空，關鍵時刻製造雙殺',
  stamina: '確保投球局數 (IP) 與比賽後段續航',
  guts: '得點圈大心臟，強化關鍵滿壘對決勝率',
};

function getPlayerArchetype(attrs: Record<AttrKey, number>, position: Position): string {
  if (position === 'TW') return '⚡ 投打雙棲奇才';
  if (position === 'P') {
    const vel = attrs.velocity ?? 30;
    const ctl = attrs.control ?? 30;
    const brk = attrs.breaking ?? 30;
    const sta = attrs.stamina ?? 30;
    const gut = attrs.guts ?? 30;

    if (vel >= 75) return '🔥 狂暴火球男';
    if (ctl >= 75) return '🎯 控球手術刀';
    if (brk >= 75) return '🌀 鬼魅魔球派';
    if (gut >= 75) return '🧊 冷面大心臟';
    if (sta >= 75) return '🦾 完投大鐵人';
    if (vel >= 60 && ctl >= 60) return '⭐ 王牌先發身手';
    return '⚾ 均衡型投手';
  }

  // Batter
  const con = attrs.contact ?? 30;
  const pow = attrs.power ?? 30;
  const spd = attrs.speed ?? 30;
  const fld = attrs.fielding ?? 30;
  const eye = attrs.eye ?? 30;

  if (con >= 65 && pow >= 65 && spd >= 65 && fld >= 65 && eye >= 65) {
    return '🌟 五拍子全能球星 (5-Tool)';
  }
  if (pow >= 75) return '💣 核彈級怪力巨砲';
  if (con >= 75) return '⚔️ 安打製造機';
  if (spd >= 75) return '⚡ 壘包音速神偷';
  if (fld >= 75) return '🛡️ 中線防守鐵壁';
  if (eye >= 75) return '👁️ 選球眼宗師';
  if (con >= 60 && pow >= 60) return '💥 強打中心棒次';
  return '⚾ 均衡型野手';
}

/**
 * 5-point scouting radar chart for baseball player attributes with
 * dynamic archetype badges, glowing vertices, and interactive stat tooltips.
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
  const [hoveredKey, setHoveredKey] = useState<AttrKey | null>(null);

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

  // Archetype title
  const archetype = useMemo(
    () => getPlayerArchetype(attrs, isTwoWay ? (activeRole === 'pitcher' ? 'P' : 'OF') : position),
    [attrs, isTwoWay, activeRole, position]
  );

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
      {/* Archetype Badge */}
      <div className="mb-2">
        <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 font-mono text-xs font-black tracking-wide text-amber-300 shadow-sm">
          {archetype}
        </span>
      </div>

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
            const isHovered = hoveredKey === key;

            return (
              <g
                key={`vertex-${key}`}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredKey(key)}
                onMouseLeave={() => setHoveredKey(null)}
              >
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
                  r={isHovered ? '6' : isHighlighted ? '5' : '3.5'}
                  fill={isHovered ? '#38bdf8' : isHighlighted ? '#34d399' : '#fbbf24'}
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
                    isHovered
                      ? 'fill-sky-300 font-black'
                      : isHighlighted
                        ? 'fill-emerald-300 font-black'
                        : 'fill-slate-300'
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

      {/* Interactive Vertex Tooltip */}
      {hoveredKey && (
        <div className="mt-2 rounded-lg border border-sky-500/40 bg-slate-900/90 px-3 py-1.5 text-center text-xs shadow-md">
          <p className="font-bold text-sky-200">
            {ATTR_LABELS[hoveredKey]} · 數值 {attrs[hoveredKey] ?? 30} (評級 {grade(attrs[hoveredKey] ?? 30)})
          </p>
          <p className="mt-0.5 text-[11px] text-slate-300">{ATTR_IMPACTS[hoveredKey]}</p>
        </div>
      )}
    </div>
  );
}
