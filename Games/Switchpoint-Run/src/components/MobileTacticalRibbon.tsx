import React from 'react';
import { currentSpeed } from '../game/engine';
import { trainPace } from '../game/constants';
import type { RunState } from '../game/types';

interface Props {
  state: RunState | null;
  onOpenDrawer: () => void;
}

export const MobileTacticalRibbon: React.FC<Props> = ({ state: s, onOpenDrawer }) => {
  if (!s) return null;

  const vPlayer = currentSpeed(s);
  const vTrain = trainPace(s.elapsed) * s.trainPaceMul;
  const deltaV = vPlayer - vTrain;

  const maxBuf = s.maxBuffer || 430;
  const bufferPct = Math.max(0, Math.min(100, (s.buffer / maxBuf) * 100));
  const isEmergency = bufferPct < 22;

  const activeOrTargetBranch =
    s.activeBranch ??
    s.pendingJunction.branches.find((b) => b.lane === s.lane);

  return (
    <div className="lg:hidden shrink-0 px-3 py-1.5 bg-slate-950/85 backdrop-blur-md border-b border-emerald-500/20 flex items-center justify-between text-xs text-slate-300">
      {/* Buffer & Chase rate */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              isEmergency ? 'bg-rose-500 animate-ping' : 'bg-emerald-400'
            }`}
          />
          <span className="font-semibold text-slate-400 text-[11px]">列車間隔</span>
          <span
            className={`font-mono font-bold ${
              isEmergency
                ? 'text-rose-400'
                : bufferPct < 50
                  ? 'text-amber-300'
                  : 'text-emerald-400'
            }`}
          >
            {Math.round(bufferPct)}%
          </span>
        </div>

        <span
          className={`font-mono text-[10px] px-1.5 py-0.2 rounded border ${
            deltaV >= 0
              ? 'border-emerald-500/30 bg-emerald-950/50 text-emerald-300'
              : 'border-rose-500/30 bg-rose-950/50 text-rose-300 animate-pulse'
          }`}
        >
          {deltaV >= 0 ? `+${deltaV.toFixed(1)}` : deltaV.toFixed(1)} m/s
        </span>
      </div>

      {/* Target Branch Preview & Drawer CTA */}
      <div className="flex items-center gap-2">
        {activeOrTargetBranch && (
          <div className="flex items-center gap-1 text-[11px]">
            <span className="text-slate-400">
              {s.activeBranch ? '現道' : '目標'}:
            </span>
            <span
              className={`font-bold ${
                activeOrTargetBranch.speedMult > 1.05
                  ? 'text-emerald-400'
                  : activeOrTargetBranch.speedMult < 0.95
                    ? 'text-rose-400'
                    : 'text-slate-200'
              }`}
            >
              {activeOrTargetBranch.speedMult > 1.05
                ? '▲加速'
                : activeOrTargetBranch.speedMult < 0.95
                  ? '▼減速'
                  : '▬維持'}
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={onOpenDrawer}
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-sky-500/40 bg-sky-500/10 text-sky-200 active:scale-95"
        >
          調度情報 ▾
        </button>
      </div>
    </div>
  );
};
