import { useRef, useCallback, useMemo } from 'react';
import type { Color } from '../types';
import { computeTelemetry } from '../utils/physics';

interface ChromaRadarProps {
  color: Color;
  targetColor?: Color | null;
  showTargetGhost?: boolean;
  onColorChange?: (color: Color) => void;
  interactive?: boolean;
  score?: number;
  streak?: number;
}

export function ChromaRadar({
  color,
  targetColor,
  showTargetGhost = false,
  onColorChange,
  interactive = true,
  score = 0,
  streak = 0,
}: ChromaRadarProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const telemetry = useMemo(() => computeTelemetry(color, score, streak), [color, score, streak]);

  // Center is (100, 100), radius is 80
  const center = 100;
  const maxRadius = 78;

  // Polar to Cartesian conversion
  // 0° is top (or right? Standard hue wheel: 0° is right / red, but let's make 0° right for math, or top for radar)
  // Let's use standard trigonometric: 0° at 3 o'clock (right) or 12 o'clock.
  // Standard CSS hue: 0° is Red (right in polar, or top). Let's use 0° = right (cos, sin).
  const polarToXY = useCallback(
    (deg: number, satPercent: number) => {
      const rad = (deg * Math.PI) / 180;
      const r = (satPercent / 100) * maxRadius;
      return {
        x: center + r * Math.cos(rad),
        y: center + r * Math.sin(rad),
      };
    },
    [center, maxRadius],
  );

  const currentPos = useMemo(() => polarToXY(color.h, color.s), [polarToXY, color.h, color.s]);
  const targetPos = useMemo(
    () => (targetColor ? polarToXY(targetColor.h, targetColor.s) : null),
    [polarToXY, targetColor],
  );

  // Harmony positions
  const compPos = useMemo(
    () => polarToXY((color.h + 180) % 360, color.s * 0.7),
    [polarToXY, color.h, color.s],
  );
  const tri1Pos = useMemo(
    () => polarToXY((color.h + 120) % 360, color.s * 0.6),
    [polarToXY, color.h, color.s],
  );
  const tri2Pos = useMemo(
    () => polarToXY((color.h + 240) % 360, color.s * 0.6),
    [polarToXY, color.h, color.s],
  );

  const handlePointer = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!interactive || !onColorChange || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const clientX = e.clientX;
      const clientY = e.clientY;
      const dx = clientX - (rect.left + rect.width / 2);
      const dy = clientY - (rect.top + rect.height / 2);

      // Angle in degrees [0, 360)
      let deg = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (deg < 0) deg += 360;

      // Distance as saturation [0, 100]
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxPixelR = rect.width * (maxRadius / 200);
      const sat = Math.max(5, Math.min(100, Math.round((dist / maxPixelR) * 100)));

      onColorChange({
        ...color,
        h: Math.round(deg),
        s: sat,
      });
    },
    [interactive, onColorChange, color, maxRadius],
  );

  return (
    <div className="panel p-4 flex flex-col gap-3.5 bg-black/40 border border-white/10 rounded-2xl relative overflow-hidden backdrop-blur-md">
      {/* HUD Header */}
      <div className="flex justify-between items-center border-b border-white/10 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="font-mono text-xs font-semibold tracking-wider text-cyan-300">
            光譜調色戰情雷達
          </span>
        </div>
        <span className="font-mono text-[10px] text-white/50 tracking-widest">
          VECTOR SCOPE 360°
        </span>
      </div>

      {/* Vector Radar Display */}
      <div className="relative flex items-center justify-center py-1">
        <svg
          ref={svgRef}
          viewBox="0 0 200 200"
          className={`w-full max-w-[210px] aspect-square select-none ${
            interactive ? 'cursor-crosshair' : 'cursor-default'
          }`}
          onPointerDown={handlePointer}
          onPointerMove={(e) => {
            if (e.buttons === 1) handlePointer(e);
          }}
        >
          <defs>
            {/* Ambient circular glow filter */}
            <filter id="radarGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            {/* Hue Ring Gradient */}
            <radialGradient id="radarCenterGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={`hsl(${color.h}, 90%, 60%)`} stopOpacity="0.25" />
              <stop offset="100%" stopColor="transparent" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Background grid circles */}
          <circle cx="100" cy="100" r={maxRadius} fill="#0d1117" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
          <circle cx="100" cy="100" r={maxRadius * 0.75} fill="none" stroke="rgba(255,255,255,0.08)" strokeDasharray="2 3" />
          <circle cx="100" cy="100" r={maxRadius * 0.5} fill="none" stroke="rgba(255,255,255,0.08)" strokeDasharray="2 3" />
          <circle cx="100" cy="100" r={maxRadius * 0.25} fill="none" stroke="rgba(255,255,255,0.08)" strokeDasharray="2 3" />

          {/* Central ambient color bloom */}
          <circle cx="100" cy="100" r={maxRadius * 0.8} fill="url(#radarCenterGlow)" />

          {/* Crosshair axes */}
          <line x1="100" y1={100 - maxRadius} x2="100" y2={100 + maxRadius} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
          <line x1={100 - maxRadius} y1="100" x2={100 + maxRadius} y2="100" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />

          {/* Outer Spectrum Ring */}
          {Array.from({ length: 36 }).map((_, i) => {
            const deg = i * 10;
            const rad = (deg * Math.PI) / 180;
            const r1 = maxRadius - 2;
            const r2 = maxRadius + 3;
            return (
              <line
                key={deg}
                x1={100 + r1 * Math.cos(rad)}
                y1={100 + r1 * Math.sin(rad)}
                x2={100 + r2 * Math.cos(rad)}
                y2={100 + r2 * Math.sin(rad)}
                stroke={`hsl(${deg}, 95%, 55%)`}
                strokeWidth={i % 3 === 0 ? '2' : '1'}
                opacity={i % 3 === 0 ? '0.9' : '0.4'}
              />
            );
          })}

          {/* Radar Sweep Line Animation */}
          <line
            x1="100"
            y1="100"
            x2={100 + maxRadius * Math.cos((color.h * Math.PI) / 180)}
            y2={100 + maxRadius * Math.sin((color.h * Math.PI) / 180)}
            stroke={`hsl(${color.h}, 100%, 70%)`}
            strokeWidth="1.5"
            strokeDasharray="3 2"
            opacity="0.6"
          />

          {/* Harmony Indicator Nodes */}
          {/* Complementary (180°) */}
          <circle cx={compPos.x} cy={compPos.y} r="2.5" fill="rgba(255,255,255,0.4)" stroke="rgba(0,0,0,0.5)" />
          {/* Triadic (120°, 240°) */}
          <circle cx={tri1Pos.x} cy={tri1Pos.y} r="2" fill="rgba(255,255,255,0.25)" />
          <circle cx={tri2Pos.x} cy={tri2Pos.y} r="2" fill="rgba(255,255,255,0.25)" />

          {/* Target Ghost Vector if active */}
          {showTargetGhost && targetPos && (
            <g className="animate-pulse">
              <line
                x1="100"
                y1="100"
                x2={targetPos.x}
                y2={targetPos.y}
                stroke="#10b981"
                strokeWidth="1.5"
                strokeDasharray="4 2"
              />
              <circle
                cx={targetPos.x}
                cy={targetPos.y}
                r="6"
                fill="none"
                stroke="#10b981"
                strokeWidth="2"
              />
              <circle
                cx={targetPos.x}
                cy={targetPos.y}
                r="3"
                fill="#10b981"
              />
            </g>
          )}

          {/* Current Dialed Vector Vector Line */}
          <line
            x1="100"
            y1="100"
            x2={currentPos.x}
            y2={currentPos.y}
            stroke={`hsl(${color.h}, ${color.s}%, ${Math.max(40, color.l)}%)`}
            strokeWidth="2.5"
          />

          {/* Current Dialed Vector Tip Node */}
          <circle
            cx={currentPos.x}
            cy={currentPos.y}
            r="7"
            fill={`hsl(${color.h}, ${color.s}%, ${color.l}%)`}
            stroke="#ffffff"
            strokeWidth="2"
            filter="url(#radarGlow)"
          />
          <circle cx={currentPos.x} cy={currentPos.y} r="2" fill="#ffffff" />
        </svg>

        {interactive && (
          <span className="absolute bottom-0 text-[10px] font-mono text-cyan-400/80 bg-black/60 px-2 py-0.5 rounded-full pointer-events-none border border-cyan-500/20">
            可點擊或拖曳雷達調色
          </span>
        )}
      </div>

      {/* Real-time Telemetry Stream */}
      <div className="grid grid-cols-2 gap-2 text-left font-mono text-xs">
        <div className="bg-white/5 rounded-lg p-2 border border-white/5">
          <div className="text-[10px] text-white/50">波長估算 (λ)</div>
          <div className="text-cyan-300 font-semibold tabular-nums">
            {telemetry.wavelengthNm} nm
          </div>
        </div>
        <div className="bg-white/5 rounded-lg p-2 border border-white/5">
          <div className="text-[10px] text-white/50">色溫 (TC)</div>
          <div className="text-amber-300 font-semibold tabular-nums">
            {telemetry.colorTempKelvin} K
          </div>
        </div>
        <div className="bg-white/5 rounded-lg p-2 border border-white/5">
          <div className="text-[10px] text-white/50">十六進位 (HEX)</div>
          <div className="text-emerald-300 font-semibold tabular-nums tracking-wider">
            {telemetry.hex}
          </div>
        </div>
        <div className="bg-white/5 rounded-lg p-2 border border-white/5">
          <div className="text-[10px] text-white/50">RGB 色光</div>
          <div className="text-purple-300 font-semibold tabular-nums text-[11px]">
            {telemetry.rgb.r}, {telemetry.rgb.g}, {telemetry.rgb.b}
          </div>
        </div>
      </div>

      {/* Rank & Tier Indicator */}
      <div className="flex items-center justify-between px-2 py-1.5 bg-cyan-950/30 rounded-lg border border-cyan-500/20 text-xs">
        <span className="text-white/60">當前色感階位</span>
        <div className="flex items-center gap-1.5 font-semibold text-cyan-300">
          <span>{telemetry.rank.badge}</span>
          <span>{telemetry.rank.title}</span>
        </div>
      </div>
    </div>
  );
}
