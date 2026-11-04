import React from 'react';
import type { MomentumMetrics } from '../game/tactics';

interface Props {
  metrics: MomentumMetrics;
  myScore: number;
  par: number;
  compact?: boolean;
}

export function ScoreOscilloscope({
  metrics,
  myScore,
  par,
  compact = false,
}: Props): React.ReactElement {
  const {
    trend,
    trendLabel,
    leadVelocity,
    winProbability,
    doubleScoreTarget,
    doubleScoreRemaining,
    hasDoubleScoreAchieved,
    zeroScoreAlert,
    points,
  } = metrics;

  // Build smooth SVG path
  const pathD = points.reduce((acc, pt, idx) => {
    if (idx === 0) return `M ${pt.x} ${pt.y}`;
    const prev = points[idx - 1];
    const cpX1 = prev.x + (pt.x - prev.x) / 2;
    const cpX2 = prev.x + (pt.x - prev.x) / 2;
    return `${acc} C ${cpX1} ${prev.y}, ${cpX2} ${pt.y}, ${pt.x} ${pt.y}`;
  }, '');

  const currentPoint = points[points.length - 1] ?? { x: 100, y: 50 };

  const strokeColor =
    trend === 'surging'
      ? '#34d399' // emerald-400
      : trend === 'steady'
        ? '#38bdf8' // sky-400
        : '#fbbf24'; // amber-400

  const glowClass =
    trend === 'surging'
      ? 'shadow-emerald-500/20'
      : trend === 'steady'
        ? 'shadow-sky-500/20'
        : 'shadow-amber-500/20';

  if (compact) {
    return (
      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-slate-950/70 border border-emerald-500/30 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="font-bold text-[11px] text-emerald-200">心電儀</span>
          <span className="text-[10px] text-emerald-300 font-mono">勝率 {winProbability}%</span>
        </div>
        <div className="text-[10px] text-amber-300 font-bold">
          {hasDoubleScoreAchieved ? '👑 雙倍壓制' : `倍額差 ${doubleScoreRemaining}分`}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border border-emerald-500/30 bg-slate-950/85 p-3 backdrop-blur-md shadow-lg ${glowClass} flex flex-col gap-2 relative overflow-hidden`}
      aria-label="紅點勝負心電儀"
    >
      {/* Background glow decoration */}
      <div
        className="absolute -right-8 -top-8 w-24 h-24 rounded-full blur-2xl pointer-events-none opacity-20"
        style={{ backgroundColor: strokeColor }}
      />

      {/* Header with Title and Trend Badge */}
      <div className="flex items-center justify-between pb-1.5 border-b border-emerald-500/15">
        <div className="flex items-center gap-1.5">
          <span className="text-sm" role="img" aria-label="心電圖">⚡</span>
          <span className="text-xs font-black tracking-wide text-emerald-100">勝負心電儀</span>
        </div>
        <span
          className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
            trend === 'surging'
              ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300'
              : trend === 'steady'
                ? 'bg-sky-950/80 border-sky-500/60 text-sky-300'
                : 'bg-amber-950/80 border-amber-500/60 text-amber-300'
          }`}
        >
          {trendLabel}
        </span>
      </div>

      {/* Oscilloscope Waveform Monitor */}
      <div className="relative w-full h-20 rounded-xl bg-slate-900/90 border border-emerald-500/20 overflow-hidden pr-oscilloscope-grid">
        {/* Par reference line */}
        <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-emerald-400/30 -translate-y-1/2 flex justify-between px-1.5 pointer-events-none">
          <span className="text-[8px] text-emerald-400/60 font-mono -mt-3.5">標準分線 ({par}分)</span>
          <span className="text-[8px] text-emerald-400/60 font-mono -mt-3.5">均勢</span>
        </div>

        {/* Dynamic SVG Waveform */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="w-full h-full relative z-10"
        >
          <defs>
            <linearGradient id="waveGlow" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={strokeColor} stopOpacity="0.45" />
              <stop offset="100%" stopColor={strokeColor} stopOpacity="0.02" />
            </linearGradient>
            <filter id="neonBlur" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Area fill under curve */}
          <path
            d={`${pathD} L 100 100 L 0 100 Z`}
            fill="url(#waveGlow)"
            className="transition-all duration-300"
          />

          {/* Wave line */}
          <path
            d={pathD}
            fill="none"
            stroke={strokeColor}
            strokeWidth="2.5"
            strokeLinecap="round"
            filter="url(#neonBlur)"
            className="transition-all duration-300"
          />

          {/* Head scanning pulse dot */}
          <circle
            cx={currentPoint.x}
            cy={currentPoint.y}
            r="3.5"
            fill="#ffffff"
            stroke={strokeColor}
            strokeWidth="2"
            className="animate-ping"
          />
          <circle
            cx={currentPoint.x}
            cy={currentPoint.y}
            r="3"
            fill="#ffffff"
            stroke={strokeColor}
            strokeWidth="1.5"
          />
        </svg>

        {/* Scanning beam overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-400/10 to-transparent pr-oscilloscope-scan pointer-events-none" />
      </div>

      {/* Real-time Leverage Projections */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl bg-slate-900/60 p-2 border border-slate-800">
          <div className="text-[10px] text-slate-400 font-medium">勝勢預估率</div>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span
              className={`text-lg font-black font-mono tabular-nums ${
                winProbability >= 70
                  ? 'text-emerald-300'
                  : winProbability >= 40
                    ? 'text-sky-300'
                    : 'text-amber-300'
              }`}
            >
              {winProbability}%
            </span>
            <span className="text-[10px] text-slate-400">
              {winProbability >= 70 ? '優勢' : winProbability >= 40 ? '拉鋸' : '苦戰'}
            </span>
          </div>
        </div>

        <div className="rounded-xl bg-slate-900/60 p-2 border border-slate-800">
          <div className="text-[10px] text-slate-400 font-medium">雙倍壓制線 ({doubleScoreTarget}分)</div>
          <div className="flex items-baseline gap-1 mt-0.5">
            {hasDoubleScoreAchieved ? (
              <span className="text-sm font-black text-amber-300">👑 已達成！</span>
            ) : (
              <>
                <span className="text-base font-black text-slate-200 tabular-nums">
                  差 {doubleScoreRemaining}
                </span>
                <span className="text-[10px] text-slate-400">分</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Special Warnings */}
      {zeroScoreAlert && (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-rose-950/80 border border-rose-500/40 text-[10px] text-rose-200 animate-pulse">
          <span>⚠️</span>
          <span>拼零分警戒：有對手尚未開胡，進入尾盤嚴防送分牌！</span>
        </div>
      )}
    </div>
  );
}
