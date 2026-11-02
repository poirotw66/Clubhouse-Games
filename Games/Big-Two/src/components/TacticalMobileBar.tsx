import React, { useState } from 'react';
import { SUIT_SYMBOL } from '../game/cards';
import type { TacticalRadar } from '../game/tactics';
import type { MatchState } from '../game/types';
import { TacticalRadarPanel } from './TacticalRadarPanel';
import { OpponentDossierPanel } from './OpponentDossierPanel';

interface Props {
  radar: TacticalRadar;
  match: MatchState | null;
  seatLabel: (seat: number) => string;
}

export function TacticalMobileBar({
  radar,
  match,
  seatLabel,
}: Props): React.ReactElement {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'radar' | 'dossier'>('radar');

  const {
    spadesTwoStatus,
    unseenDeuceCount,
    humanTurns,
    isNextSeatCritical,
    criticalSeats,
  } = radar;

  return (
    <>
      {/* Compact Quick-Strip (Mobile / Tablet) */}
      <div
        className="w-full flex items-center justify-between gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-500/20 bg-slate-900/80 backdrop-blur-sm text-xs"
        role="region"
        aria-label="戰情速報條"
      >
        <div className="flex items-center gap-2 overflow-x-auto py-0.5 no-scrollbar">
          {/* Spades 2 indicator */}
          <div className="flex items-center gap-1 font-bold shrink-0">
            <span className="text-amber-300">♠2:</span>
            {spadesTwoStatus.status === 'inHand' && (
              <span className="text-emerald-300">我方</span>
            )}
            {spadesTwoStatus.status === 'played' && (
              <span className="text-slate-400">已出</span>
            )}
            {spadesTwoStatus.status === 'unseen' && (
              <span className="text-rose-400 font-black animate-pulse">未現</span>
            )}
          </div>

          <span className="text-slate-600">·</span>

          {/* Unseen 2s */}
          <div className="shrink-0 text-indigo-200/80">
            剩 2: <strong className="text-indigo-100">{unseenDeuceCount}</strong> 張
          </div>

          <span className="text-slate-600">·</span>

          {/* Turns to empty */}
          <div className="shrink-0 text-indigo-200/80">
            預估 <strong className="text-emerald-300">{humanTurns}</strong> 輪
          </div>

          {/* Taiwanese Red Alert Line Banner */}
          {isNextSeatCritical && (
            <>
              <span className="text-slate-600">·</span>
              <span className="shrink-0 font-black text-rose-300 bg-rose-500/20 px-1.5 py-0.5 rounded border border-rose-500/40 animate-pulse">
                🚨 下家頂大！
              </span>
            </>
          )}

          {!isNextSeatCritical && criticalSeats.length > 0 && (
            <>
              <span className="text-slate-600">·</span>
              <span className="shrink-0 font-bold text-amber-300 bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/40">
                ⚠️ 剩 1 張戒備
              </span>
            </>
          )}
        </div>

        {/* Modal Trigger */}
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="shrink-0 px-2.5 py-1 rounded-lg border border-indigo-400/40 bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-200 font-bold text-[11px] touch-manipulation transition-colors"
        >
          戰情情報
        </button>
      </div>

      {/* Slide-over Drawer / Modal for Mobile */}
      {drawerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="戰情儀表板抽屜"
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/75 backdrop-blur-sm sm:items-center sm:justify-center p-0 sm:p-4"
        >
          <div className="w-full max-w-lg max-h-[85vh] bg-slate-900 border border-indigo-500/30 rounded-t-3xl sm:rounded-3xl p-4 flex flex-col gap-3 shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200">
            <header className="flex items-center justify-between border-b border-indigo-500/20 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">⚡</span>
                <span className="font-black text-indigo-100 text-sm">
                  尊榮牌廳雙翼戰情儀表板
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center font-bold text-sm touch-manipulation"
                aria-label="關閉戰情儀表板"
              >
                ✕
              </button>
            </header>

            {/* Tab switch for mobile */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('radar')}
                className={`flex-1 py-1.5 rounded-xl border text-xs font-bold transition-colors ${
                  activeTab === 'radar'
                    ? 'border-indigo-400 bg-indigo-500/20 text-indigo-100'
                    : 'border-slate-800 bg-slate-800/40 text-slate-400'
                }`}
              >
                ⚡ 戰情情報雷達
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('dossier')}
                className={`flex-1 py-1.5 rounded-xl border text-xs font-bold transition-colors ${
                  activeTab === 'dossier'
                    ? 'border-indigo-400 bg-indigo-500/20 text-indigo-100'
                    : 'border-slate-800 bg-slate-800/40 text-slate-400'
                }`}
              >
                🗂️ 對手檔案與錦囊
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="overflow-y-auto flex-1 pr-1 flex flex-col gap-3">
              {activeTab === 'radar' ? (
                <TacticalRadarPanel radar={radar} seatLabel={seatLabel} />
              ) : (
                <OpponentDossierPanel
                  radar={radar}
                  match={match}
                  seatLabel={seatLabel}
                />
              )}
            </div>

            <footer className="pt-2 border-t border-slate-800 text-center">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-xs text-white touch-manipulation"
              >
                返回牌桌
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
