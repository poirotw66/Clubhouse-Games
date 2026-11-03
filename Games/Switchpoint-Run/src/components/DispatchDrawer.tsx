import React from 'react';
import type { RunState } from '../game/types';
import type { BlackboxLogEntry } from './DispatchRightWing';

interface Props {
  state: RunState | null;
  logs: BlackboxLogEntry[];
  onClose: () => void;
}

const LANE_NAMES = ['1 股道（左）', '2 股道（中）', '3 股道（右）'];

export const DispatchDrawer: React.FC<Props> = ({ state: s, logs, onClose }) => {
  if (!s) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-slate-950/80 backdrop-blur-sm lg:hidden animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sr-drawer-title"
      onClick={onClose}
    >
      <div
        className="w-full max-h-[80vh] bg-slate-900 border-t border-emerald-500/30 rounded-t-2xl p-4 flex flex-col gap-3 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <h3 id="sr-drawer-title" className="text-sm font-bold text-emerald-300">
              行動端中央調度速報
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 border border-slate-700 font-bold"
          >
            關閉
          </button>
        </div>

        {/* 3 Lane branch preview */}
        <div>
          <h4 className="text-xs font-bold text-slate-200 mb-1.5">
            前方道岔三線拓撲
          </h4>
          <div className="space-y-1.5">
            {[0, 1, 2].map((lane) => {
              const b = s.pendingJunction.branches.find((br) => br.lane === lane);
              const isCurrent = s.lane === lane;
              return (
                <div
                  key={lane}
                  className={`rounded-lg p-2 border text-xs ${
                    isCurrent
                      ? 'bg-emerald-950/50 border-emerald-400 text-white'
                      : b
                        ? 'bg-slate-950/60 border-white/10 text-slate-300'
                        : 'bg-rose-950/30 border-rose-500/20 text-slate-400 opacity-60'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold flex items-center gap-1.5">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isCurrent
                            ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]'
                            : b
                              ? 'bg-slate-500'
                              : 'bg-rose-500'
                        }`}
                      />
                      {LANE_NAMES[lane]}
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-500/40">
                        目前扳道對準
                      </span>
                    )}
                  </div>
                  {b ? (
                    <div className="mt-1 flex justify-between text-[11px] text-slate-400">
                      <span>{b.name}</span>
                      <div className="flex gap-2">
                        <span
                          className={
                            b.speedMult > 1.05
                              ? 'text-emerald-400 font-bold'
                              : b.speedMult < 0.95
                                ? 'text-rose-400 font-bold'
                                : 'text-slate-300'
                          }
                        >
                          {b.speedMult > 1.05
                            ? '▲ 加速'
                            : b.speedMult < 0.95
                              ? '▼ 減速'
                              : '▬ 維持'}
                        </span>
                        {b.reward === 'supply' && (
                          <span className="text-emerald-300 font-semibold">+補給</span>
                        )}
                        {b.reward === 'score' && (
                          <span className="text-amber-300 font-semibold">×倍率</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1 text-[11px] text-rose-400">
                      ✕ 軌道封閉，切勿進入
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Blackbox events */}
        <div>
          <h4 className="text-xs font-bold text-slate-200 mb-1.5">
            最近行車黑盒子日誌
          </h4>
          <div className="space-y-1 max-h-36 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-[11px] text-slate-500">暫無記錄事件</p>
            ) : (
              logs.slice(0, 5).map((l) => (
                <div
                  key={l.id}
                  className="bg-slate-950/50 rounded p-1.5 border border-white/5 text-[11px] flex items-center justify-between"
                >
                  <span className="text-slate-300">{l.text}</span>
                  <span className="font-mono text-[10px] text-slate-500">{l.time}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
