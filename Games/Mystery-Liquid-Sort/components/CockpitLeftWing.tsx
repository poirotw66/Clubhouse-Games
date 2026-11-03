import React from 'react';
import { Activity, Compass, Droplet, Sparkles, CheckCircle2 } from 'lucide-react';
import type { LabPuritySummary, StepRatingResult } from '../utils/cockpitMetrics.ts';

interface CockpitLeftWingProps {
  purity: LabPuritySummary;
  moves: number;
  parSteps: number;
  rating: StepRatingResult;
  isCompact?: boolean;
}

export const CockpitLeftWing: React.FC<CockpitLeftWingProps> = ({
  purity,
  moves,
  parSteps,
  rating,
  isCompact = false,
}) => {
  // Compass needle rotation (-70deg to +70deg based on ratio moves / par)
  const clampedRatio = Math.max(0.5, Math.min(2.0, rating.ratio));
  // ratio 1.0 -> 0deg (vertical). ratio 0.5 -> -60deg (efficient). ratio 2.0 -> +60deg (exceeded).
  const needleRotation = Math.round((clampedRatio - 1.0) * 120);

  return (
    <div
      className={`
        flex flex-col gap-3 rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-white/15 p-3.5 shadow-2xl text-white select-none
        ${isCompact ? 'w-full' : 'w-72 xl:w-80 flex-shrink-0'}
      `}
    >
      {/* Wing Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-xs font-black tracking-wider text-indigo-300">
              化學純度光譜儀
            </h3>
            <p className="text-[10px] text-white/50">即時分層與純化監控</p>
          </div>
        </div>
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-[10px] font-bold text-indigo-200">
          <Sparkles className="w-3 h-3 text-indigo-300" />
          <span>{purity.overallPurityPct}%</span>
        </div>
      </div>

      {/* Overall Purity Gauge */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-2.5 flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[11px] font-bold">
          <span className="text-white/70 flex items-center gap-1">
            <Droplet className="w-3.5 h-3.5 text-cyan-400" /> 全場純化率
          </span>
          <span className="text-white font-mono text-xs font-black">
            {purity.overallPurityPct}%
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden relative border border-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-indigo-500 to-emerald-400 transition-all duration-500 ease-out shadow-[0_0_8px_rgba(56,189,248,0.6)]"
            style={{ width: `${purity.overallPurityPct}%` }}
          />
        </div>
        <div className="flex justify-between text-[9px] text-white/50 font-medium">
          <span>純色管：{purity.totalPureBottles} 支</span>
          <span>有效液體：{purity.totalVisibleLayers} 格</span>
        </div>
      </div>

      {/* Color Purity Spectrum Breakdown */}
      <div className="flex flex-col gap-2">
        <div className="text-[10px] font-bold text-white/60 tracking-wider">
          各色純度進度條
        </div>
        <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1 no-scrollbar">
          {purity.metrics.map((m) => {
            const isFullyPure = m.purityPct >= 100 && m.totalUnits > 0;
            return (
              <div
                key={m.color}
                className="rounded-lg bg-white/5 border border-white/10 p-1.5 flex flex-col gap-1 hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm border border-white/30"
                      style={{ backgroundColor: m.color }}
                    />
                    <span className="font-bold text-white/90 truncate">{m.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-[9px]">
                    <span className="text-white/70">
                      {m.pureUnits}/{m.totalUnits}
                    </span>
                    {isFullyPure ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <span className="text-white/50">{m.purityPct}%</span>
                    )}
                  </div>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-800/80 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${m.purityPct}%`,
                      backgroundColor: m.color,
                      boxShadow: `0 0 6px ${m.color}`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Par Steps Compass & Efficiency Rating */}
      <div className="mt-auto border-t border-white/10 pt-2.5 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
            <Compass className="w-4 h-4 text-amber-400" />
            <span>最優步數導航</span>
          </div>
          <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${rating.badgeClass}`}>
            {rating.label}
          </span>
        </div>

        <div className="flex items-center justify-between bg-white/5 rounded-xl p-2 border border-white/10">
          {/* Compass Dial Needle Simulation */}
          <div className="relative w-12 h-12 flex items-center justify-center flex-shrink-0">
            <div className="absolute inset-0 rounded-full border-2 border-white/20 border-dashed" />
            <div className="absolute inset-1 rounded-full border border-amber-400/30" />
            <div
              className="w-0.5 h-5 bg-gradient-to-t from-amber-400 to-rose-400 origin-bottom rounded-full transition-transform duration-500 ease-out shadow-[0_0_6px_#fbbf24]"
              style={{
                transform: `rotate(${needleRotation}deg)`,
                marginBottom: '10px',
              }}
            />
            <div className="w-2 h-2 rounded-full bg-amber-300 shadow-md z-10" />
          </div>

          {/* Steps readout */}
          <div className="flex flex-col items-end">
            <div className="text-[10px] text-white/50">步數效率指標</div>
            <div className="flex items-baseline gap-1 font-mono">
              <span className="text-base font-black text-white">{moves}</span>
              <span className="text-xs text-white/40">/ 基準 {parSteps}</span>
            </div>
            <div className={`text-[9px] font-medium ${rating.textColor}`}>
              {rating.subLabel}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
