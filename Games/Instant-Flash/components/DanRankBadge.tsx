import React from 'react';
import type { DanRankStatus } from '../danRank';
import { Award, ChevronRight } from 'lucide-react';

interface DanRankBadgeProps {
  status: DanRankStatus;
  compact?: boolean;
  onOpenLadder?: () => void;
  className?: string;
}

export const DanRankBadge: React.FC<DanRankBadgeProps> = ({
  status,
  compact = false,
  onOpenLadder,
  className = '',
}) => {
  const { currentRank, nextRank, progressPercent } = status;

  if (compact) {
    return (
      <div
        className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-slate-700 bg-slate-900/90 text-xs font-display shadow-md ${className}`}
        style={{ borderColor: `${currentRank.accent}66` }}
      >
        <span
          className="w-2 h-2 rounded-full animate-pulse"
          style={{ backgroundColor: currentRank.accent }}
        />
        <span className="font-bold text-white tracking-wider">
          {currentRank.name}
        </span>
        <span className="text-[10px] text-slate-400 hidden sm:inline">
          {currentRank.title}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border bg-slate-950/80 p-3.5 backdrop-blur-md shadow-lg transition-all ${className}`}
      style={{
        borderColor: `${currentRank.accent}44`,
        boxShadow: `0 4px 20px -2px ${currentRank.glowColor}`,
      }}
    >
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
        <div className="flex items-center gap-1.5">
          <Award size={15} style={{ color: currentRank.accent }} />
          <span
            className="font-display text-xs font-bold tracking-widest uppercase"
            style={{ color: currentRank.accent }}
          >
            九段拔刀段位
          </span>
        </div>
        <span
          className="text-[10px] font-display font-black px-1.5 py-0.5 rounded border"
          style={{
            borderColor: `${currentRank.accent}77`,
            backgroundColor: `${currentRank.accent}22`,
            color: currentRank.accent,
          }}
        >
          {currentRank.badge}
        </span>
      </div>

      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <div className="text-lg font-black font-display text-white tracking-wider">
            {currentRank.name}
          </div>
          <div className="text-xs text-slate-400 mt-0.5 font-display">
            心法境界：<span className="text-slate-200">{currentRank.title}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-slate-400 font-display">段位晉階</div>
          <div className="text-sm font-bold font-display text-cyan-300">
            {currentRank.level} / 9
          </div>
        </div>
      </div>

      {/* Progress bar to next rank */}
      <div className="space-y-1 mb-2">
        <div className="flex justify-between text-[10px] text-slate-400 font-display">
          <span>{currentRank.name}</span>
          <span>{nextRank ? nextRank.name : '皆傳極意'}</span>
        </div>
        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${progressPercent}%`,
              backgroundColor: currentRank.accent,
            }}
          />
        </div>
      </div>

      {/* Next rank requirement hint */}
      {nextRank ? (
        <div className="text-[11px] text-slate-400 leading-snug bg-slate-900/60 p-2 rounded border border-slate-800/80">
          <span className="text-amber-400 font-bold font-display">下段試煉：</span>
          {nextRank.requirement}
        </div>
      ) : (
        <div className="text-[11px] text-amber-300/90 leading-snug bg-amber-950/20 p-2 rounded border border-amber-500/30 font-display">
          已晉陞至皆傳最高境界！剎那一閃，人刀合一。
        </div>
      )}

      {onOpenLadder && (
        <button
          type="button"
          onClick={onOpenLadder}
          className="mt-2.5 w-full flex items-center justify-center gap-1 py-1.5 px-3 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 text-xs font-display transition-colors"
        >
          <span>查看天下劍豪對決錄</span>
          <ChevronRight size={13} />
        </button>
      )}
    </div>
  );
};
