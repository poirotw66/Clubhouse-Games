import React, { useEffect, useState } from 'react';
import type { GameState } from '../game/types';
import { GMDossier } from './GMDossier';
import { StrategicWarRoom } from './StrategicWarRoom';

interface Props {
  state: GameState;
  isOpen: boolean;
  onClose: () => void;
}

export function WarRoomModal({ state, isOpen, onClose }: Props): React.ReactElement | null {
  const [activeTab, setActiveTab] = useState<'strategy' | 'dossier'>('strategy');

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="warroom-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-2 sm:p-4 backdrop-blur-md overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-5xl rounded-2xl border border-emerald-500/30 bg-slate-900 shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-700/80 bg-slate-950/80 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">🧭</span>
            <div>
              <h2 id="warroom-modal-title" className="text-sm font-black text-slate-100">
                球團戰略作戰中心（Operations War Room）
              </h2>
              <p className="text-[11px] text-slate-400">
                十年王朝沙盤、董事會信任天秤、薪資豪華稅雷達與總管大師檔案
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab switchers on small/medium screens */}
            <div className="flex lg:hidden rounded-lg bg-slate-800 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('strategy')}
                className={`rounded-md px-2.5 py-1 font-bold ${
                  activeTab === 'strategy'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                戰略沙盤
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('dossier')}
                className={`rounded-md px-2.5 py-1 font-bold ${
                  activeTab === 'dossier'
                    ? 'bg-sky-500 text-slate-950'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                總管檔案
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 px-3 py-1 text-xs font-bold text-slate-300"
              aria-label="關閉戰略作戰中心"
            >
              關閉 ✕
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* On lg screens: show both wings side by side! On smaller: show activeTab */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className={`space-y-4 ${activeTab === 'strategy' ? 'block' : 'hidden lg:block'}`}>
              <StrategicWarRoom state={state} />
            </div>
            <div className={`space-y-4 ${activeTab === 'dossier' ? 'block' : 'hidden lg:block'}`}>
              <GMDossier state={state} />
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950/60 px-4 py-2.5 text-[11px] text-slate-500">
          <span>按 ESC 或點擊外部可隨時關閉</span>
          <span className="font-mono text-emerald-300">種子碼 {state.seedCode}</span>
        </div>
      </div>
    </div>
  );
}
