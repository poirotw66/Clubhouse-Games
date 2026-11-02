import React from 'react';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Layers,
  Sparkles,
  Zap,
} from 'lucide-react';
import type { GameState, Suit } from '../types.ts';
import type { FreeCellSlots } from '../utils/storage.ts';
import {
  evaluateTactics,
  getSupermoveCapacity,
} from '../utils/tactics.ts';

interface TacticalLeftWingProps {
  gameState: GameState;
  freeCellSlots: FreeCellSlots;
  onSafeAutoMove: () => void;
  disabled?: boolean;
}

const SUIT_DATA: { suit: Suit; symbol: string; label: string; colorClass: string; barClass: string }[] = [
  { suit: 'spades', symbol: '♠', label: '黑桃', colorClass: 'text-stone-900', barClass: 'bg-stone-800' },
  { suit: 'hearts', symbol: '♥', label: '紅心', colorClass: 'text-rose-600', barClass: 'bg-rose-500' },
  { suit: 'diamonds', symbol: '♦', label: '方塊', colorClass: 'text-amber-600', barClass: 'bg-amber-500' },
  { suit: 'clubs', symbol: '♣', label: '梅花', colorClass: 'text-emerald-700', barClass: 'bg-emerald-600' },
];

export const TacticalLeftWing: React.FC<TacticalLeftWingProps> = ({
  gameState,
  freeCellSlots,
  onSafeAutoMove,
  disabled = false,
}) => {
  const isSlotLocked = (idx: number) => freeCellSlots === 2 && idx >= 2;
  const emptyFreeCells = gameState.freeCells.filter(
    (c, idx) => c === null && !isSlotLocked(idx),
  ).length;
  const unlockedTotal = freeCellSlots === 2 ? 2 : 4;
  const emptyTableaus = gameState.tableaus.filter((col) => col.length === 0).length;

  const supermove = getSupermoveCapacity(emptyFreeCells, emptyTableaus);
  const tactics = evaluateTactics(gameState, freeCellSlots);

  const totalReclaimed =
    gameState.foundations.spades +
    gameState.foundations.hearts +
    gameState.foundations.diamonds +
    gameState.foundations.clubs;
  const foundationPct = Math.round((totalReclaimed / 52) * 100);

  const statusBadgeTheme = {
    ultra: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    high: 'bg-sky-100 text-sky-800 border-sky-200',
    dual: 'bg-amber-100 text-amber-800 border-amber-200',
    single: 'bg-rose-100 text-rose-800 border-rose-200',
  }[supermove.statusLevel];

  const radarBg = {
    deadlock: 'bg-rose-50 border-rose-200 text-rose-800',
    critical: 'bg-amber-50 border-amber-200 text-amber-800',
    safe_ready: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    fluid: 'bg-sky-50 border-sky-200 text-sky-800',
  }[tactics.mobilityLevel];

  return (
    <aside
      aria-label="戰術動能儀表板"
      className="flex flex-col gap-3.5 w-full bg-white/90 backdrop-blur-md rounded-2xl border border-stone-200/90 shadow-sm p-4 text-stone-800 transition-all select-none"
    >
      {/* Cockpit Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-stone-100">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600">
            <Zap size={18} className="animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight text-stone-900">戰術動能儀</h2>
            <p className="text-[11px] text-stone-400">Supermove 即時計算法則</p>
          </div>
        </div>
        <span
          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${statusBadgeTheme}`}
        >
          {supermove.statusLabel}
        </span>
      </div>

      {/* Supermove Capacity Engine */}
      <div className="rounded-xl bg-stone-50/90 border border-stone-200/80 p-3 flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-medium text-stone-500">連鎖移牌上限</span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black tabular-nums text-stone-900">
              {supermove.capacityToTableau}
            </span>
            <span className="text-xs font-semibold text-stone-500">張一串</span>
          </div>
        </div>

        {/* Dynamic Formula Display */}
        <div className="bg-white rounded-lg px-2.5 py-1.5 border border-stone-200 text-center font-mono text-[11px] text-stone-700 tabular-nums">
          <span className="text-stone-400 mr-1.5">(1 + 空格) × 2^空列:</span>
          <span className="font-bold text-amber-700">
            (1 + {emptyFreeCells}) × 2^{emptyTableaus} = {supermove.capacityToTableau}
          </span>
        </div>

        {/* Tactical Sub-metrics */}
        <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11px]">
          <div className="bg-white rounded-md p-1.5 border border-stone-150 flex flex-col">
            <span className="text-stone-400">移至空列上限</span>
            <span className="font-semibold text-stone-800 tabular-nums">
              {supermove.capacityToEmptyTableau} 張
            </span>
          </div>
          <div className="bg-white rounded-md p-1.5 border border-stone-150 flex flex-col">
            <span className="text-stone-400">空置暫存格</span>
            <span className="font-semibold text-stone-800 tabular-nums">
              {emptyFreeCells} / {unlockedTotal} 格
            </span>
          </div>
          <div className="bg-white rounded-md p-1.5 border border-stone-150 flex flex-col col-span-2">
            <div className="flex justify-between items-center">
              <span className="text-stone-400">可用空牌列</span>
              <span className="font-semibold text-stone-800 tabular-nums">
                {emptyTableaus} / 8 列（{emptyTableaus > 0 ? `動能放大 ${Math.pow(2, emptyTableaus)} 倍` : '無倍增'}）
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Foundation Balance Scale */}
      <div className="rounded-xl bg-stone-50/90 border border-stone-200/80 p-3 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-medium text-stone-700">
            <Award size={15} className="text-stone-500" />
            <span>回收進度天秤</span>
          </div>
          <span className="text-xs font-bold tabular-nums text-stone-900">
            {totalReclaimed} / 52 <span className="text-stone-400 text-[11px]">({foundationPct}%)</span>
          </span>
        </div>

        {/* Global Progress Bar */}
        <div className="w-full h-2 rounded-full bg-stone-200 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-500 via-rose-500 to-emerald-600 transition-all duration-300"
            style={{ width: `${foundationPct}%` }}
          />
        </div>

        {/* 4 Suits Breakdown */}
        <div className="grid grid-cols-2 gap-1.5">
          {SUIT_DATA.map(({ suit, symbol, label, colorClass, barClass }) => {
            const rank = gameState.foundations[suit];
            const pct = Math.round((rank / 13) * 100);
            return (
              <div
                key={suit}
                className="bg-white rounded-lg p-1.5 border border-stone-200 flex flex-col gap-1"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className={`font-serif font-bold ${colorClass}`}>
                    {symbol} {label}
                  </span>
                  <span className="text-[11px] font-semibold tabular-nums text-stone-700">
                    {rank} / 13
                  </span>
                </div>
                <div className="w-full h-1 rounded-full bg-stone-100 overflow-hidden">
                  <div
                    className={`h-full ${barClass} transition-all duration-300`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tactical Radar & Situational Alert */}
      <div className={`rounded-xl border p-3 flex flex-col gap-2 ${radarBg}`}>
        <div className="flex items-start gap-2">
          {tactics.mobilityLevel === 'deadlock' ? (
            <AlertTriangle size={16} className="text-rose-600 shrink-0 mt-0.5" />
          ) : tactics.mobilityLevel === 'safe_ready' ? (
            <Sparkles size={16} className="text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 size={16} className="text-sky-600 shrink-0 mt-0.5" />
          )}
          <div className="text-xs leading-relaxed font-medium">
            {tactics.message}
          </div>
        </div>

        {/* Safe Auto-Move Quick Action */}
        <button
          type="button"
          onClick={onSafeAutoMove}
          disabled={disabled || !tactics.hasSafeFoundationMove}
          className={`mt-1 w-full min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm touch-manipulation ${
            tactics.hasSafeFoundationMove && !disabled
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer ring-2 ring-emerald-400/40 animate-pulse'
              : 'bg-stone-200/70 text-stone-400 cursor-not-allowed'
          }`}
          title="自動將所有符合安全條件的卡牌移至回收區（快捷鍵 A）"
        >
          <Layers size={14} />
          <span>一鍵安全收牌</span>
          <kbd className="ml-1 px-1 py-0.2 rounded bg-black/20 text-[10px] font-mono">A</kbd>
        </button>
      </div>

      {/* Quick Keyboard Cue Footer */}
      <div className="pt-1 text-[11px] text-stone-500 flex flex-wrap items-center justify-between gap-1 border-t border-stone-100">
        <span>實體快捷</span>
        <div className="flex gap-1.5 font-mono text-[10px]">
          <span className="bg-stone-100 px-1 rounded border border-stone-200">1~8</span>
          <span className="bg-stone-100 px-1 rounded border border-stone-200">QWER</span>
          <span className="bg-stone-100 px-1 rounded border border-stone-200">A</span>
          <span className="bg-stone-100 px-1 rounded border border-stone-200">H</span>
          <span className="bg-stone-100 px-1 rounded border border-stone-200">Z</span>
        </div>
      </div>
    </aside>
  );
};
