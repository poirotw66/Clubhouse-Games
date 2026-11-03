import React from 'react';
import { Activity, Radar, Droplet, Layers, ShieldCheck, HelpCircle } from 'lucide-react';
import type { LabPuritySummary, StepRatingResult } from '../utils/cockpitMetrics.ts';

interface TacticalStripProps {
  purity: LabPuritySummary;
  legalMovesCount: number;
  bufferTubesCount: number;
  moves: number;
  parSteps: number;
  rating: StepRatingResult;
  onOpenLeftWing: () => void;
  onOpenRightWing: () => void;
  onOpenKeypadGuide: () => void;
}

export const TacticalStrip: React.FC<TacticalStripProps> = ({
  purity,
  legalMovesCount,
  bufferTubesCount,
  moves,
  parSteps,
  rating,
  onOpenLeftWing,
  onOpenRightWing,
  onOpenKeypadGuide,
}) => {
  const isDeadlock = legalMovesCount === 0;

  return (
    <div className="w-full flex items-center justify-between gap-1.5 px-2 py-1.5 rounded-xl bg-slate-900/80 backdrop-blur-md border border-white/15 shadow-lg text-white mb-2 max-w-lg mx-auto">
      {/* Purity Badge & Modal Trigger */}
      <button
        type="button"
        onClick={onOpenLeftWing}
        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/30 text-[10px] font-bold text-indigo-200 transition-all active:scale-95"
        title="開啟化學純度光譜儀"
      >
        <Droplet className="w-3 h-3 text-cyan-400 flex-shrink-0" />
        <span>純度 {purity.overallPurityPct}%</span>
      </button>

      {/* Legal Moves & Deadlock Radar Trigger */}
      <button
        type="button"
        onClick={onOpenRightWing}
        className={`
          flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-bold transition-all active:scale-95
          ${
            isDeadlock
              ? 'bg-red-500/30 border-red-400 text-red-200 animate-pulse'
              : legalMovesCount <= 2
                ? 'bg-amber-500/20 border-amber-400/40 text-amber-200'
                : 'bg-emerald-500/20 border-emerald-400/30 text-emerald-200'
          }
        `}
        title="開啟態勢雷達與通關錦囊"
      >
        <Radar className="w-3 h-3 flex-shrink-0" />
        <span>航道 {legalMovesCount}組</span>
      </button>

      {/* Buffer Tubes indicator */}
      <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 text-[10px] font-bold text-white/80">
        <Layers className="w-3 h-3 text-yellow-300" />
        <span>空管 {bufferTubesCount}</span>
      </div>

      {/* Steps rating pill */}
      <div className="flex items-center gap-1 px-1.5 py-1 rounded-lg bg-white/10 text-[10px] font-mono">
        <span className="text-white/60">{moves}步</span>
        <span className={`px-1 py-0.2 rounded font-black text-[9px] ${rating.badgeClass}`}>
          {rating.rating}
        </span>
      </div>

      {/* Keypad Guide Button */}
      <button
        type="button"
        onClick={onOpenKeypadGuide}
        className="touch-target w-7 h-7 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white/70 active:scale-95 transition-all"
        title="鍵盤直選倒水說明"
        aria-label="鍵盤直選倒水說明"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
