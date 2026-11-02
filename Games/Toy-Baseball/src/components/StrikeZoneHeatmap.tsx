/**
 * Strike Zone 3x3 Heatmap & Pitch Sequence Tracker.
 */

import React from 'react';
import type { StrikeZonePitch } from '../telemetry.ts';

interface StrikeZoneHeatmapProps {
  pitches: StrikeZonePitch[];
  currentPitch?: StrikeZonePitch | null;
}

export function StrikeZoneHeatmap({ pitches, currentPitch }: StrikeZoneHeatmapProps): React.ReactElement {
  return (
    <div className="flex flex-col items-center bg-zinc-950/70 p-3 rounded-2xl border border-white/10 shadow-inner">
      <div className="flex items-center justify-between w-full mb-1.5 px-1">
        <span className="text-[11px] font-bold text-zinc-400">九宮格好球帶落點</span>
        <span className="text-[10px] text-amber-300 font-mono">
          {pitches.length > 0 ? `第 ${pitches.length} 球` : '待投出'}
        </span>
      </div>

      <div className="relative w-44 h-48 bg-zinc-900/90 rounded-xl border border-dashed border-zinc-700/80 p-3 flex items-center justify-center overflow-hidden">
        {/* Out-of-zone label watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5">
          <span className="text-4xl font-black text-white">ZONE</span>
        </div>

        {/* 3x3 Strike Zone Box */}
        <div className="relative w-32 h-36 border-2 border-amber-400/80 rounded bg-amber-500/5 shadow-[0_0_12px_rgba(251,191,36,0.15)]">
          {/* Inner 3x3 grid lines */}
          <div className="absolute inset-x-0 top-1/3 h-px bg-amber-400/30" />
          <div className="absolute inset-x-0 top-2/3 h-px bg-amber-400/30" />
          <div className="absolute inset-y-0 left-1/3 w-px bg-amber-400/30" />
          <div className="absolute inset-y-0 left-2/3 w-px bg-amber-400/30" />

          {/* Home Plate Icon at bottom */}
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-8 h-2 bg-zinc-600/80 rounded-b-sm border border-zinc-500/50" />
        </div>

        {/* Historical Pitches in this At-Bat */}
        {pitches.map((p, index) => {
          const isLatest = currentPitch?.id === p.id || index === pitches.length - 1;
          const isHit = p.result.includes('安打') || p.result.includes('全壘打');
          const isStrike = p.isStrike;

          return (
            <div
              key={p.id}
              className={`absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center rounded-full font-mono font-bold text-[9px] transition-transform ${
                isHit
                  ? 'w-5 h-5 bg-amber-400 text-zinc-950 border border-amber-200 shadow-[0_0_8px_rgba(251,191,36,0.9)] z-20 scale-110'
                  : isStrike
                    ? 'w-4 h-4 bg-red-500 text-white border border-red-300 shadow-[0_0_6px_rgba(239,68,68,0.7)] z-10'
                    : 'w-4 h-4 bg-emerald-500 text-white border border-emerald-300 shadow-[0_0_6px_rgba(16,185,129,0.7)] z-10'
              } ${isLatest ? 'ring-2 ring-white animate-pulse' : ''}`}
              style={{
                left: `${p.xPercent}%`,
                top: `${p.yPercent}%`,
              }}
              title={`#${p.id}: ${p.result}`}
            >
              {p.id}
            </div>
          );
        })}

        {/* Empty state hint */}
        {pitches.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-[10px] text-zinc-500 font-medium">尚無投球數據</span>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-3 mt-2 text-[10px] text-zinc-400">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          <span>好球</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>壞球</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span>擊球</span>
        </div>
      </div>
    </div>
  );
}
