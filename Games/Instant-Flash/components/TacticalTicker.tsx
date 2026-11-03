import React from 'react';
import type { DanRankStatus } from '../danRank';
import { Activity, BookOpen, Zap } from 'lucide-react';

interface TacticalTickerProps {
  danRank: DanRankStatus;
  bestReactionMs: number | null;
  combo: number;
  onToggleLeftWing?: () => void;
  onToggleRightWing?: () => void;
  className?: string;
}

export const TacticalTicker: React.FC<TacticalTickerProps> = ({
  danRank,
  bestReactionMs,
  combo,
  onToggleLeftWing,
  onToggleRightWing,
  className = '',
}) => {
  return (
    <div
      className={`w-full bg-slate-950/90 border-b border-slate-800/80 px-3 py-1.5 flex items-center justify-between text-xs font-display backdrop-blur-md z-30 select-none ${className}`}
    >
      <div className="flex items-center gap-3 overflow-hidden">
        {/* Dan Rank */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: danRank.currentRank.accent }}
          />
          <span className="font-bold text-slate-200">
            {danRank.currentRank.name}
          </span>
        </div>

        {/* Reaction speed metric */}
        <div className="hidden sm:flex items-center gap-1 text-slate-400 shrink-0">
          <Zap size={13} className="text-cyan-400" />
          <span>最速:</span>
          <span className="text-cyan-300 font-bold tabular-nums">
            {bestReactionMs != null ? `${bestReactionMs}ms` : '—'}
          </span>
        </div>

        {/* Combo */}
        {combo > 0 && (
          <div className="hidden md:flex items-center gap-1 text-amber-400 shrink-0">
            <span>連段:</span>
            <span className="font-bold tabular-nums">{combo}</span>
          </div>
        )}
      </div>

      {/* Drawer Toggle buttons for Mobile/Tablet */}
      <div className="flex items-center gap-1.5 shrink-0">
        {onToggleLeftWing && (
          <button
            type="button"
            onClick={onToggleLeftWing}
            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-900 border border-cyan-500/40 text-cyan-300 hover:bg-slate-800 text-[11px] font-display transition-colors"
          >
            <Activity size={12} />
            <span className="hidden xs:inline">神經</span>光譜
          </button>
        )}
        {onToggleRightWing && (
          <button
            type="button"
            onClick={onToggleRightWing}
            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-900 border border-emerald-500/40 text-emerald-300 hover:bg-slate-800 text-[11px] font-display transition-colors"
          >
            <BookOpen size={12} />
            <span className="hidden xs:inline">劍豪</span>心法
          </button>
        )}
      </div>
    </div>
  );
};
