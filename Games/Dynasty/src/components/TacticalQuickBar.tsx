import React from 'react';
import { TRUST_DANGER, formatMoney } from '../game/config';
import { humanTeam } from '../game/engine';
import type { GameState } from '../game/types';
import { getSeasonPhaseLabel } from '../game/warRoomStats';

interface Props {
  state: GameState;
  onOpenWarRoom: () => void;
  onToggleRoster: () => void;
  isRosterOpen: boolean;
  viewMode: 'dual' | 'standard';
  onToggleViewMode: () => void;
}

export function TacticalQuickBar({
  state,
  onOpenWarRoom,
  onToggleRoster,
  isRosterOpen,
  viewMode,
  onToggleViewMode,
}: Props): React.ReactElement {
  const team = humanTeam(state);
  const phaseLabel = getSeasonPhaseLabel(state.phase, state.block);
  const isTrustDanger = state.board.trust < TRUST_DANGER;

  return (
    <header className="sticky top-0 z-30 mb-4 w-full rounded-2xl border border-slate-700/80 bg-slate-950/90 backdrop-blur-md shadow-xl px-3 py-2 sm:px-4 sm:py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {/* Left: Club & Year status */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-extrabold text-sm sm:text-base text-slate-100">
              {team.name}
            </span>
          </div>

          <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-300">
            第 {Math.min(state.seasonIndex + 1, 10)}/10 年・{state.year}
          </span>

          <span className="hidden sm:inline-block rounded bg-emerald-950/80 border border-emerald-500/40 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
            {phaseLabel}
          </span>

          <span className="font-mono text-xs text-slate-400">
            {team.wins}勝 {team.losses}敗
          </span>
        </div>

        {/* Center: Live Vital Indicators */}
        <div className="flex items-center gap-3 font-mono text-xs">
          {/* Cash */}
          <div className="flex items-center gap-1">
            <span className="text-slate-500 text-[10px]">資金</span>
            <span
              className={`font-bold ${
                state.finance.cash < 0 ? 'text-rose-400' : 'text-emerald-300'
              }`}
            >
              {formatMoney(state.finance.cash)}
            </span>
          </div>

          {/* Trust */}
          <div className="flex items-center gap-1">
            <span className="text-slate-500 text-[10px]">信任</span>
            <span
              className={`font-bold ${
                isTrustDanger ? 'text-rose-400 animate-pulse' : 'text-slate-200'
              }`}
            >
              {state.board.trust}
            </span>
          </div>

          {/* Heat */}
          <div className="flex items-center gap-1">
            <span className="text-slate-500 text-[10px]">熱度</span>
            <span className="font-bold text-amber-300">{state.heat}</span>
          </div>
        </div>

        {/* Right: Quick Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Mobile War Room Drawer Trigger */}
          <button
            type="button"
            onClick={onOpenWarRoom}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-500/50 bg-emerald-950/60 hover:bg-emerald-900/60 px-2.5 py-1 text-xs font-bold text-emerald-300 transition-colors"
            title="開啟十年間球團戰略沙盤 (快捷鍵 W)"
          >
            <span>🧭</span>
            <span>戰略沙盤</span>
            <kbd className="hidden md:inline rounded bg-emerald-900/80 px-1 py-0.2 font-mono text-[9px] text-emerald-200">
              W
            </kbd>
          </button>

          {/* Roster Drawer Trigger */}
          <button
            type="button"
            onClick={onToggleRoster}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold transition-colors ${
              isRosterOpen
                ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                : 'border-slate-700 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300'
            }`}
            title="開關一二軍名單面板 (快捷鍵 R)"
          >
            <span>⚾</span>
            <span>球員名單</span>
            <kbd className="hidden md:inline rounded bg-slate-900/80 px-1 py-0.2 font-mono text-[9px] text-slate-400">
              R
            </kbd>
          </button>

          {/* Desktop Dual-Wing View Switcher */}
          <button
            type="button"
            onClick={onToggleViewMode}
            className="hidden xl:flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] font-semibold text-slate-400 hover:text-slate-200"
            title="切換雙翼作戰中心 / 標準視野"
          >
            <span>{viewMode === 'dual' ? '雙翼佈局' : '標準雙欄'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
