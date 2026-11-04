import { memo } from 'react';
import {
  type CognitiveRank,
  type PhosphorCell,
  type ReactionStats,
} from './brainTelemetry';

export interface BrainTelemetryWingProps {
  accuracyPct: number;
  explorationPct: number;
  retentionPct: number;
  reactionStats: ReactionStats;
  cognitiveRank: CognitiveRank;
  phosphorCells: readonly PhosphorCell[];
  cols: number;
  comboLevel: number;
  feverMultiplier: number;
  feverLabel: string;
  knownReadyPairs: number;
  focusedIndex: number | null;
  onSelectCell?: (index: number) => void;
}

export const BrainTelemetryWing = memo(function BrainTelemetryWing({
  accuracyPct,
  explorationPct,
  retentionPct,
  reactionStats,
  cognitiveRank,
  phosphorCells,
  cols,
  comboLevel,
  feverMultiplier,
  feverLabel,
  knownReadyPairs,
  focusedIndex,
  onSelectCell,
}: BrainTelemetryWingProps) {
  const isFever = comboLevel >= 2;

  return (
    <aside className="mm-wing mm-wing--left" aria-label="大腦神經遙測與記憶殿堂">
      <div className="mm-wing__title">
        <span className="text-teal-400">🧠</span>
        <span>大腦神經遙測與殿堂</span>
      </div>

      {/* Cognitive Rank & Retention Gauge */}
      <div className="mm-wing__card">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-teal-300">神經突觸評級</span>
          <span
            className="px-2 py-0.5 rounded text-xs font-black tracking-wider shadow-[0_0_10px_rgba(45,212,191,0.35)]"
            style={{ backgroundColor: `${cognitiveRank.color}22`, color: cognitiveRank.color }}
          >
            {cognitiveRank.grade} 級 · {cognitiveRank.title}
          </span>
        </div>

        <div className="mt-2 flex flex-col gap-1.5">
          <div className="mm-wing__row">
            <span className="mm-wing__label">瞬時記憶留存率</span>
            <span className="mm-wing__value text-teal-300">{retentionPct}%</span>
          </div>
          <div className="mm-bar-track">
            <div
              className="mm-bar-fill bg-gradient-to-r from-teal-500 via-cyan-400 to-emerald-400"
              style={{ width: `${retentionPct}%` }}
            />
          </div>

          <div className="mm-wing__row mt-1">
            <span className="mm-wing__label">配對精準率</span>
            <span className="mm-wing__value text-cyan-300">{accuracyPct}%</span>
          </div>
          <div className="mm-bar-track">
            <div
              className="mm-bar-fill bg-gradient-to-r from-sky-500 to-teal-400"
              style={{ width: `${accuracyPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Decision Reaction Latency */}
      <div className="mm-wing__card">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-sky-300">翻牌決策反應</span>
          <span className="text-xs font-bold text-sky-400">
            {reactionStats.speedRating}
          </span>
        </div>
        <div className="mt-1 flex items-baseline justify-between">
          <span className="text-2xl font-black font-mono text-slate-100">
            {reactionStats.averageMs > 0 ? `${reactionStats.averageMs}` : '--'}
            <span className="text-xs font-normal text-slate-400 ml-1">ms</span>
          </span>
          <span className="text-xs text-slate-400">
            最新 {reactionStats.latestMs > 0 ? `${reactionStats.latestMs}ms` : '--'}
          </span>
        </div>
      </div>

      {/* Memory Palace Heatmap Grid */}
      <div className="mm-wing__card">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-amber-300">全場記憶殿堂矩陣</span>
          <span className="text-[11px] text-slate-400">
            探勘 {explorationPct}%
          </span>
        </div>

        <div
          className="mm-heatmap-grid mt-2"
          style={{ gridTemplateColumns: `repeat(${Math.max(1, cols)}, minmax(0, 1fr))` }}
        >
          {phosphorCells.map((cell) => {
            const isFocused = focusedIndex === cell.index;
            let cellStyleClass = 'is-unexplored';

            if (cell.matched) {
              cellStyleClass = 'is-matched';
            } else if (cell.isReady) {
              cellStyleClass = 'is-ready';
            } else if (cell.level === 3) {
              cellStyleClass = 'is-fresh';
            } else if (cell.level === 2) {
              cellStyleClass = 'is-warm';
            } else if (cell.level === 1) {
              cellStyleClass = 'is-ember';
            }

            return (
              <button
                key={cell.index}
                type="button"
                onClick={() => onSelectCell?.(cell.index)}
                className={`mm-heatmap-cell ${cellStyleClass} ${isFocused ? 'is-focused' : ''}`}
                title={`${cell.coordinate}: ${
                  cell.matched
                    ? '已消除'
                    : cell.isReady
                      ? '雙牌已鎖定！'
                      : cell.level === 3
                        ? '鮮活記憶'
                        : cell.level === 2
                          ? '溫熱記憶'
                          : cell.level === 1
                            ? '微弱餘燼'
                            : '未探索'
                }`}
                aria-label={`矩陣 ${cell.coordinate}`}
              >
                <span className="mm-heatmap-coord">{cell.coordinate}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 px-1">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_#fbbf24]" />
            鎖定待收
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-teal-400" />
            鮮活
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-sky-400" />
            溫熱
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-purple-400" />
            餘燼
          </span>
        </div>
      </div>

      {/* Combo Fever Overdrive Gauge */}
      <div className={`mm-wing__card ${isFever ? 'mm-fever-card-active' : ''}`}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-rose-300">狂熱超頻儀</span>
          <span
            className={`text-xs font-extrabold ${
              feverMultiplier >= 3 ? 'text-amber-300 animate-pulse' : 'text-rose-400'
            }`}
          >
            {feverLabel}
          </span>
        </div>

        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-2xl font-black text-rose-400 font-mono tracking-tight">
            ×{feverMultiplier}
          </span>
          <span className="text-xs text-slate-300">倍率加成</span>
        </div>

        <div className="mm-bar-track mt-1">
          <div
            className="mm-bar-fill bg-gradient-to-r from-rose-500 via-amber-400 to-pink-400 transition-all duration-300"
            style={{ width: `${Math.min(100, (comboLevel / 5) * 100)}%` }}
          />
        </div>

        {knownReadyPairs > 0 && (
          <div className="mt-2 p-1.5 rounded bg-amber-500/15 border border-amber-400/40 text-[11px] text-amber-200 font-bold text-center animate-pulse">
            ⚡ 腦中已鎖定 {knownReadyPairs} 組已知配對！
          </div>
        )}
      </div>
    </aside>
  );
});
