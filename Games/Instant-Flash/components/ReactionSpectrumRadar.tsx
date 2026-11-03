import React from 'react';
import { CounterResult, type ReactionRecord } from '../types';

interface ReactionSpectrumRadarProps {
  history: ReactionRecord[];
  perfectWindowMs: number;
  goodWindowMs: number;
  bestReactionMs: number | null;
  avgReactionMs: number | null;
  latestRecord?: ReactionRecord | null;
  className?: string;
}

export const ReactionSpectrumRadar: React.FC<ReactionSpectrumRadarProps> = ({
  history,
  perfectWindowMs,
  goodWindowMs,
  bestReactionMs,
  avgReactionMs,
  latestRecord,
  className = '',
}) => {
  // We plot relative timing: -250ms (early) to +250ms (late). Impact frame is 0ms.
  const span = 250;
  const recentRecords = history.slice(-12);

  const getRecordX = (timing: number) => {
    const clamped = Math.max(-span, Math.min(span, timing));
    return ((clamped + span) / (span * 2)) * 100;
  };

  const perfectLeft = ((span - perfectWindowMs) / (span * 2)) * 100;
  const perfectWidth = ((perfectWindowMs * 2) / (span * 2)) * 100;

  const goodLeft = ((span - goodWindowMs) / (span * 2)) * 100;
  const goodWidth = ((goodWindowMs * 2) / (span * 2)) * 100;

  return (
    <div
      className={`rounded-xl border border-cyan-500/25 bg-slate-950/80 p-3.5 backdrop-blur-md shadow-lg shadow-cyan-950/20 ${className}`}
    >
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          <span className="font-display text-xs font-bold tracking-widest text-cyan-300">
            反應神經光譜
          </span>
        </div>
        <span className="text-[10px] text-slate-400 font-display">
          樣本 {history.length}
        </span>
      </div>

      {/* Hero display of latest reaction */}
      <div className="flex items-baseline justify-between mb-3 bg-slate-900/60 rounded-lg p-2.5 border border-slate-800/80">
        <div>
          <div className="text-[10px] text-slate-400 font-display">最近拔刀反應</div>
          <div className="flex items-baseline gap-1">
            <span
              className={`font-display text-2xl font-black ${
                !latestRecord
                  ? 'text-slate-500'
                  : latestRecord.result === CounterResult.PERFECT
                    ? 'text-cyan-300 drop-shadow-[0_0_8px_#22d3ee]'
                    : latestRecord.result === CounterResult.GOOD
                      ? 'text-amber-300'
                      : 'text-rose-400'
              }`}
            >
              {latestRecord ? Math.abs(latestRecord.timing) : '—'}
            </span>
            <span className="text-xs text-slate-400 font-display">ms</span>
          </div>
        </div>

        <div className="text-right">
          <div className="text-[10px] text-slate-400 font-display">判定結果</div>
          <div
            className={`text-xs font-display font-bold px-2 py-0.5 rounded border inline-block ${
              !latestRecord
                ? 'text-slate-500 border-slate-800'
                : latestRecord.result === CounterResult.PERFECT
                  ? 'text-cyan-300 border-cyan-500/50 bg-cyan-950/50'
                  : latestRecord.result === CounterResult.GOOD
                    ? 'text-amber-300 border-amber-500/50 bg-amber-950/50'
                    : 'text-rose-300 border-rose-500/50 bg-rose-950/50'
            }`}
          >
            {latestRecord
              ? latestRecord.result === CounterResult.PERFECT
                ? '完美斬擊'
                : latestRecord.result === CounterResult.GOOD
                  ? '極速格擋'
                  : latestRecord.result === CounterResult.FEINT
                    ? '看破佯攻'
                    : latestRecord.result === CounterResult.WRONG_SIDE
                      ? '斬向錯側'
                      : latestRecord.timing < 0
                        ? '早出鞘'
                        : '遲滯受傷'
              : '待命中'}
          </div>
        </div>
      </div>

      {/* Visual Timeline / Bell-Curve Window */}
      <div className="relative mb-3 pt-3">
        <div className="flex justify-between text-[9px] text-slate-400 font-display mb-1">
          <span>-250ms (過早)</span>
          <span className="text-cyan-400 font-bold">0ms (命中點)</span>
          <span>+250ms (遲滯)</span>
        </div>

        {/* Timeline bar */}
        <div className="relative h-7 w-full bg-slate-900 rounded-md border border-slate-800 overflow-hidden">
          {/* Good window */}
          <div
            className="absolute top-0 bottom-0 bg-amber-500/15 border-x border-amber-500/30"
            style={{ left: `${goodLeft}%`, width: `${goodWidth}%` }}
          />
          {/* Perfect window */}
          <div
            className="absolute top-0 bottom-0 bg-cyan-400/25 border-x border-cyan-400/70 shadow-[0_0_8px_rgba(6,182,212,0.3)]"
            style={{ left: `${perfectLeft}%`, width: `${perfectWidth}%` }}
          />
          {/* Zero impact center line */}
          <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-white/70 -translate-x-1/2 shadow-[0_0_4px_#ffffff]" />

          {/* Scatter dots of recent slashes */}
          {recentRecords.map((r, i) => {
            const x = getRecordX(r.timing);
            const isLatest = i === recentRecords.length - 1;
            const isPerf = r.result === CounterResult.PERFECT;
            const isGood = r.result === CounterResult.GOOD;
            return (
              <div
                key={r.id}
                className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full transition-all duration-300 ${
                  isLatest
                    ? 'w-3 h-3 ring-2 ring-white shadow-lg animate-pulse'
                    : 'w-2 h-2 opacity-75'
                } ${
                  isPerf
                    ? 'bg-cyan-300 shadow-[0_0_8px_#22d3ee]'
                    : isGood
                      ? 'bg-amber-400 shadow-[0_0_6px_#fbbf24]'
                      : 'bg-rose-400'
                }`}
                style={{ left: `${x}%` }}
                title={`${r.timing > 0 ? '+' : ''}${r.timing}ms`}
              />
            );
          })}
        </div>

        <div className="flex justify-between items-center text-[9px] text-slate-400 mt-1">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-sm bg-cyan-400 inline-block" />
            完美窗: ±{perfectWindowMs}ms
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-sm bg-amber-400 inline-block" />
            有效窗: ±{goodWindowMs}ms
          </span>
        </div>
      </div>

      {/* Aggregate stats summary */}
      <div className="grid grid-cols-2 gap-2 text-center text-xs font-display">
        <div className="bg-slate-900/40 rounded p-1.5 border border-slate-800/60">
          <div className="text-[10px] text-slate-400">最速斬擊</div>
          <div className="text-cyan-400 font-bold tabular-nums">
            {bestReactionMs != null ? `${bestReactionMs} ms` : '—'}
          </div>
        </div>
        <div className="bg-slate-900/40 rounded p-1.5 border border-slate-800/60">
          <div className="text-[10px] text-slate-400">平均秒差</div>
          <div className="text-emerald-400 font-bold tabular-nums">
            {avgReactionMs != null ? `${avgReactionMs} ms` : '—'}
          </div>
        </div>
      </div>
    </div>
  );
};
