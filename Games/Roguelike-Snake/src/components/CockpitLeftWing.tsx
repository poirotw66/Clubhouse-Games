import { Activity, AlertTriangle, Compass, Dna, Gauge, Shield, Zap } from 'lucide-react';
import type { DirectionClearance, RiskLevel } from '../game/radar';

interface CockpitLeftWingProps {
  length: number;
  growth: number;
  speedMs: number;
  stepsPerSecond: number;
  evolutionTier: string;
  evolutionColor: string;
  riskLevel: RiskLevel;
  reachableTiles: number;
  clearance: DirectionClearance;
  dashReady: boolean;
  pulseReady: boolean;
  energy: number;
  maxEnergy: number;
  onDash: () => void;
  onPulse: () => void;
}

export function CockpitLeftWing({
  length,
  growth,
  speedMs,
  stepsPerSecond,
  evolutionTier,
  evolutionColor,
  riskLevel,
  reachableTiles,
  clearance,
  dashReady,
  pulseReady,
  energy,
  maxEnergy,
  onDash,
  onPulse,
}: CockpitLeftWingProps) {
  const energyPercent = Math.min(100, Math.round((energy / maxEnergy) * 100));

  const riskLabel =
    riskLevel === 'safe'
      ? '安全暢通'
      : riskLevel === 'warning'
        ? '空間緊縮'
        : '致命死角！';

  const riskDesc =
    riskLevel === 'safe'
      ? '前方連通腹地充足，可自由盤蜷'
      : riskLevel === 'warning'
        ? '通道受限，請預留回旋脫出路線'
        : '前方封閉區域小於蛇身長度，請立即轉向！';

  const riskBorderColor =
    riskLevel === 'safe'
      ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-200'
      : riskLevel === 'warning'
        ? 'border-amber-500/50 bg-amber-950/40 text-amber-200 animate-pulse'
        : 'border-rose-500/80 bg-rose-950/60 text-rose-100 animate-pulse shadow-[0_0_20px_rgba(244,63,94,0.4)]';

  return (
    <aside className="w-full lg:w-72 flex flex-col gap-3 font-sans">
      {/* Bio-Telemetry Header Card */}
      <div className="rounded-2xl border border-cyan-900/40 bg-slate-900/80 p-3.5 backdrop-blur-md shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-cyan-300 uppercase">
            <Dna className="w-4 h-4 text-cyan-400" />
            <span>生體基因拓撲儀</span>
          </div>
          <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            在線
          </span>
        </div>

        {/* Evolution Tier & Spec */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">演化型態</span>
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full border border-current"
              style={{ color: evolutionColor }}
            >
              {evolutionTier}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-2">
              <span className="text-[11px] text-slate-400 block mb-0.5">蛇身長度</span>
              <div className="flex items-baseline gap-1">
                <span className="text-base font-bold font-mono text-slate-100">{length}</span>
                <span className="text-[10px] text-slate-400">節</span>
                {growth > 0 && <span className="text-[10px] text-emerald-400 font-mono">+{growth}</span>}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-2">
              <span className="text-[11px] text-slate-400 block mb-0.5">神經步頻</span>
              <div className="flex items-baseline gap-1">
                <span className="text-base font-bold font-mono text-cyan-300">{speedMs}</span>
                <span className="text-[10px] text-slate-400">ms/步</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Trap Risk Heatmap & Escape Radar */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3.5 backdrop-blur-md shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-amber-300 uppercase">
            <Compass className="w-4 h-4 text-amber-400" />
            <span>圍困死角雷達</span>
          </div>
          <span className="text-[11px] font-mono text-slate-400">腹地: {reachableTiles} 格</span>
        </div>

        {/* Hazard Risk Indicator Banner */}
        <div className={`rounded-xl border p-2.5 mb-3 transition-colors ${riskBorderColor}`}>
          <div className="flex items-center gap-2 font-bold text-xs mb-1">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{riskLabel}</span>
          </div>
          <p className="text-[11px] opacity-90 leading-relaxed">{riskDesc}</p>
        </div>

        {/* 3-Way Directional Clearance */}
        <div className="space-y-1.5 text-xs">
          <div className="text-[11px] text-slate-400 font-semibold mb-1">逃生三向淨空測距</div>

          {/* Ahead */}
          <div className="flex items-center justify-between gap-2">
            <span className="w-14 text-[11px] text-slate-300">⬆️ 直行</span>
            <div className="flex-1 h-2 rounded-full bg-slate-950 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  clearance.ahead === 0
                    ? 'bg-rose-500'
                    : clearance.ahead < 3
                      ? 'bg-amber-400'
                      : 'bg-emerald-400'
                }`}
                style={{ width: `${Math.min(100, (clearance.ahead / 10) * 100)}%` }}
              />
            </div>
            <span className="w-8 text-right font-mono text-[11px] text-slate-200">
              {clearance.ahead}格
            </span>
          </div>

          {/* Turn Left */}
          <div className="flex items-center justify-between gap-2">
            <span className="w-14 text-[11px] text-slate-300">⬅️ 左轉</span>
            <div className="flex-1 h-2 rounded-full bg-slate-950 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  clearance.left === 0
                    ? 'bg-rose-500'
                    : clearance.left < 3
                      ? 'bg-amber-400'
                      : 'bg-emerald-400'
                }`}
                style={{ width: `${Math.min(100, (clearance.left / 10) * 100)}%` }}
              />
            </div>
            <span className="w-8 text-right font-mono text-[11px] text-slate-200">
              {clearance.left}格
            </span>
          </div>

          {/* Turn Right */}
          <div className="flex items-center justify-between gap-2">
            <span className="w-14 text-[11px] text-slate-300">➡️ 右轉</span>
            <div className="flex-1 h-2 rounded-full bg-slate-950 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  clearance.right === 0
                    ? 'bg-rose-500'
                    : clearance.right < 3
                      ? 'bg-amber-400'
                      : 'bg-emerald-400'
                }`}
                style={{ width: `${Math.min(100, (clearance.right / 10) * 100)}%` }}
              />
            </div>
            <span className="w-8 text-right font-mono text-[11px] text-slate-200">
              {clearance.right}格
            </span>
          </div>
        </div>
      </div>

      {/* Bio-Energy Balancer */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3.5 backdrop-blur-md shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-emerald-300 uppercase">
            <Zap className="w-4 h-4 text-emerald-400" />
            <span>動能充能天秤</span>
          </div>
          <span className="font-mono text-xs text-slate-300">
            {Math.floor(energy)}/{maxEnergy}
          </span>
        </div>

        <div className="h-2 rounded-full bg-slate-950 overflow-hidden mb-3">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-emerald-400 to-amber-300 transition-all duration-150"
            style={{ width: `${energyPercent}%` }}
          />
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <button
            type="button"
            onClick={onDash}
            className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all ${
              dashReady
                ? 'border-cyan-500/70 bg-cyan-950/40 text-cyan-200 hover:bg-cyan-900/60 shadow-[0_0_10px_rgba(6,182,212,0.25)]'
                : 'border-slate-800 bg-slate-950 text-slate-500 opacity-60 cursor-not-allowed'
            }`}
          >
            <span className="font-bold text-[11px]">衝刺 (Space)</span>
            <span className="text-[10px] text-slate-400">消耗 30 · 突進</span>
          </button>

          <button
            type="button"
            onClick={onPulse}
            className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all ${
              pulseReady
                ? 'border-emerald-500/70 bg-emerald-950/40 text-emerald-200 hover:bg-emerald-900/60 shadow-[0_0_10px_rgba(16,185,129,0.25)]'
                : 'border-slate-800 bg-slate-950 text-slate-500 opacity-60 cursor-not-allowed'
            }`}
          >
            <span className="font-bold text-[11px]">猛毒脈衝 (E)</span>
            <span className="text-[10px] text-slate-400">消耗 40 · 震波</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
