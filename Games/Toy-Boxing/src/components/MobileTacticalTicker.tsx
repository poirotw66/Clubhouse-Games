import React from 'react';
import { Flame, Lightbulb, Zap } from 'lucide-react';
import type { GForceTelemetry, MasterCoachHint } from '../telemetry';

interface MobileTacticalTickerProps {
  telemetry: GForceTelemetry;
  counterWindowActive: boolean;
  coachHint: MasterCoachHint;
}

export const MobileTacticalTicker: React.FC<MobileTacticalTickerProps> = ({
  telemetry,
  counterWindowActive,
  coachHint,
}) => {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-white/10 bg-neutral-950/90 p-2.5 backdrop-blur-md lg:hidden">
      {/* Top telemetry strip */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 font-mono">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[10px] text-neutral-400 font-sans">打擊衝擊力：</span>
          <strong className="text-white font-bold">{telemetry.currentGForce.toFixed(1)}G</strong>
          <span className="text-[9px] text-neutral-500 font-sans">
            (初速 {telemetry.strikeSpeedMs.toFixed(1)}m/s)
          </span>
        </div>

        {counterWindowActive && (
          <div className="flex items-center gap-1 rounded bg-amber-500/20 px-2 py-0.5 border border-amber-400/50 text-[10px] font-black text-amber-300 animate-pulse">
            <Flame className="w-3 h-3 text-amber-400" />
            <span>COUNTER 窗口</span>
          </div>
        )}
      </div>

      {/* Dynamic Mastermind Advice Marquee */}
      <div className="flex items-center gap-2 rounded-lg bg-neutral-900/80 px-2 py-1.5 border border-white/5 text-[11px]">
        <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span className="truncate text-neutral-300 font-medium">
          {coachHint.text}
        </span>
      </div>
    </div>
  );
};
