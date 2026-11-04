import React from 'react';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Compass,
  Layers,
  Radio,
  ShieldAlert,
  Sparkles,
  Zap,
} from 'lucide-react';
import type { GameState, Suit } from '../types.ts';
import type { FreeCellSlots } from '../utils/storage.ts';
import type { WorkshopTheme } from '../utils/theme.ts';
import {
  getSolutionRouteTelemetry,
} from '../utils/tactics.ts';

interface TacticalLeftWingProps {
  gameState: GameState;
  freeCellSlots: FreeCellSlots;
  theme?: WorkshopTheme;
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
  theme = 'royal-velvet',
  onSafeAutoMove,
  disabled = false,
}) => {
  const telemetry = getSolutionRouteTelemetry(gameState, freeCellSlots);
  const { supermove, assessment, safeCards, trappedKeyCards, riskIndex, riskLevel, riskLabel, recommendedRoute } = telemetry;

  const isSlotLocked = (idx: number) => freeCellSlots === 2 && idx >= 2;
  const emptyFreeCells = gameState.freeCells.filter(
    (c, idx) => c === null && !isSlotLocked(idx),
  ).length;
  const unlockedTotal = freeCellSlots === 2 ? 2 : 4;
  const emptyTableaus = gameState.tableaus.filter((col) => col.length === 0).length;

  const totalReclaimed =
    gameState.foundations.spades +
    gameState.foundations.hearts +
    gameState.foundations.diamonds +
    gameState.foundations.clubs;
  const foundationPct = Math.round((totalReclaimed / 52) * 100);

  const containerTheme = {
    'royal-velvet': 'bg-emerald-950/80 border-emerald-700/40 text-emerald-100 shadow-[0_8px_32px_rgba(0,0,0,0.5)]',
    'obsidian-gold': 'bg-neutral-950/85 border-amber-500/35 text-amber-100 shadow-[0_8px_32px_rgba(0,0,0,0.65)]',
    'cyber-neon': 'bg-slate-950/85 border-cyan-500/40 text-cyan-100 shadow-[0_8px_32px_rgba(6,182,212,0.25)]',
  }[theme];

  const cardPanelTheme = {
    'royal-velvet': 'bg-emerald-900/60 border-emerald-700/40 text-emerald-100',
    'obsidian-gold': 'bg-neutral-900/80 border-amber-600/30 text-amber-100',
    'cyber-neon': 'bg-slate-900/75 border-cyan-600/35 text-cyan-100',
  }[theme];

  const subBoxTheme = {
    'royal-velvet': 'bg-emerald-950/60 border-emerald-800/40 text-emerald-200',
    'obsidian-gold': 'bg-neutral-950/70 border-amber-700/30 text-amber-200',
    'cyber-neon': 'bg-slate-950/70 border-cyan-700/40 text-cyan-200',
  }[theme];

  const riskColor = {
    low: 'text-emerald-400 bg-emerald-950/80 border-emerald-500/40',
    medium: 'text-amber-400 bg-amber-950/80 border-amber-500/40',
    high: 'text-orange-400 bg-orange-950/80 border-orange-500/40',
    critical: 'text-rose-400 bg-rose-950/80 border-rose-500/40 animate-pulse',
  }[riskLevel];

  return (
    <aside
      aria-label="戰術動能儀表板"
      className={`flex flex-col gap-3.5 w-full rounded-2xl border backdrop-blur-md p-4 transition-all select-none ${containerTheme}`}
    >
      {/* Cockpit Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
            <Zap size={18} className="animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight">戰術動能儀</h2>
            <p className="text-[11px] opacity-70">Supermove 即時計算法則</p>
          </div>
        </div>
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border bg-white/10 border-white/20">
          {supermove.statusLabel}
        </span>
      </div>

      {/* Supermove Capacity Engine */}
      <div className={`rounded-xl border p-3 flex flex-col gap-2 ${cardPanelTheme}`}>
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-medium opacity-80">連鎖移牌上限</span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black tabular-nums text-amber-400">
              {supermove.capacityToTableau}
            </span>
            <span className="text-xs font-semibold opacity-80">張一串</span>
          </div>
        </div>

        {/* Dynamic Formula Display */}
        <div className={`rounded-lg px-2.5 py-1.5 border text-center font-mono text-[11px] tabular-nums ${subBoxTheme}`}>
          <span className="opacity-70 mr-1.5">(1 + 空格) × 2^空列:</span>
          <span className="font-bold text-amber-400">
            (1 + {emptyFreeCells}) × 2^{emptyTableaus} = {supermove.capacityToTableau}
          </span>
        </div>

        {/* Tactical Sub-metrics */}
        <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11px]">
          <div className={`rounded-md p-1.5 border flex flex-col ${subBoxTheme}`}>
            <span className="opacity-70">移至空列上限</span>
            <span className="font-semibold tabular-nums">
              {supermove.capacityToEmptyTableau} 張
            </span>
          </div>
          <div className={`rounded-md p-1.5 border flex flex-col ${subBoxTheme}`}>
            <span className="opacity-70">空置暫存格</span>
            <span className="font-semibold tabular-nums">
              {emptyFreeCells} / {unlockedTotal} 格
            </span>
          </div>
          <div className={`rounded-md p-1.5 border flex flex-col col-span-2 ${subBoxTheme}`}>
            <div className="flex justify-between items-center">
              <span className="opacity-70">可用空牌列</span>
              <span className="font-semibold tabular-nums">
                {emptyTableaus} / 8 列（{emptyTableaus > 0 ? `動能放大 ${Math.pow(2, emptyTableaus)} 倍` : '無倍增'}）
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Solution Route & Dead-End Risk Telemetry */}
      <div className={`rounded-xl border p-3 flex flex-col gap-2 ${cardPanelTheme}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <Radio size={15} className="text-sky-400 animate-pulse" />
            <span>局勢遙測與死局預警</span>
          </div>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${riskColor}`}>
            {riskLabel} ({riskIndex}%)
          </span>
        </div>

        {/* Risk meter bar */}
        <div className="w-full h-1.5 rounded-full bg-black/40 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              riskIndex >= 80 ? 'bg-rose-500' : riskIndex >= 50 ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${riskIndex}%` }}
          />
        </div>

        {/* Tactical Route Guidance */}
        <div className={`rounded-lg p-2 border text-xs leading-relaxed flex items-start gap-1.5 ${subBoxTheme}`}>
          <Compass size={14} className="shrink-0 mt-0.5 text-amber-400" />
          <span>{recommendedRoute}</span>
        </div>

        {/* Trapped Key Cards Tracker */}
        {trappedKeyCards.length > 0 && (
          <div className="flex flex-col gap-1 pt-1 text-[11px]">
            <span className="text-[10px] opacity-70">深埋關鍵牌預警（A 與 2）：</span>
            <div className="flex flex-wrap gap-1">
              {trappedKeyCards.slice(0, 3).map((item, idx) => (
                <span
                  key={idx}
                  className="px-1.5 py-0.5 rounded bg-black/30 border border-white/10 text-[10px] tabular-nums"
                >
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Foundation Balance Scale */}
      <div className={`rounded-xl border p-3 flex flex-col gap-2.5 ${cardPanelTheme}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <Award size={15} className="text-amber-400" />
            <span>回收進度天秤</span>
          </div>
          <span className="text-xs font-bold tabular-nums">
            {totalReclaimed} / 52 <span className="opacity-70 text-[11px]">({foundationPct}%)</span>
          </span>
        </div>

        {/* Global Progress Bar */}
        <div className="w-full h-2 rounded-full bg-black/40 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-500 via-rose-500 to-emerald-500 transition-all duration-300"
            style={{ width: `${foundationPct}%` }}
          />
        </div>

        {/* 4 Suits Breakdown */}
        <div className="grid grid-cols-2 gap-1.5">
          {SUIT_DATA.map(({ suit, symbol, label, barClass }) => {
            const rank = gameState.foundations[suit];
            const pct = Math.round((rank / 13) * 100);
            const isRed = suit === 'hearts' || suit === 'diamonds';
            return (
              <div
                key={suit}
                className={`rounded-lg p-1.5 border flex flex-col gap-1 ${subBoxTheme}`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className={`font-serif font-bold ${isRed ? 'text-rose-400' : 'text-stone-200'}`}>
                    {symbol} {label}
                  </span>
                  <span className="text-[11px] font-semibold tabular-nums opacity-85">
                    {rank} / 13
                  </span>
                </div>
                <div className="w-full h-1 rounded-full bg-black/30 overflow-hidden">
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

      {/* Safe Auto-Move Radar Action */}
      <div className={`rounded-xl border p-3 flex flex-col gap-2 ${cardPanelTheme}`}>
        <div className="flex items-start gap-2">
          {assessment.mobilityLevel === 'deadlock' ? (
            <AlertTriangle size={16} className="text-rose-400 shrink-0 mt-0.5" />
          ) : safeCards.length > 0 ? (
            <Sparkles size={16} className="text-emerald-400 shrink-0 mt-0.5 animate-pulse" />
          ) : (
            <CheckCircle2 size={16} className="text-sky-400 shrink-0 mt-0.5" />
          )}
          <div className="text-xs leading-relaxed font-medium">
            {safeCards.length > 0
              ? `安全雷達鎖定：偵測到 ${safeCards.length} 張牌可絕對安全收牌`
              : assessment.message}
          </div>
        </div>

        {/* Safe Auto-Move Quick Action */}
        <button
          type="button"
          onClick={onSafeAutoMove}
          disabled={disabled || safeCards.length === 0}
          className={`mt-1 w-full min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm touch-manipulation ${
            safeCards.length > 0 && !disabled
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer ring-2 ring-emerald-400/50 animate-pulse shadow-[0_0_16px_rgba(16,185,129,0.4)]'
              : 'bg-white/10 text-white/30 cursor-not-allowed border border-white/5'
          }`}
          title="自動將所有符合安全條件的卡牌移至回收區（快捷鍵 A）"
        >
          <Layers size={14} />
          <span>一鍵安全收牌 {safeCards.length > 0 ? `(${safeCards.length})` : ''}</span>
          <kbd className="ml-1 px-1 py-0.2 rounded bg-black/30 text-[10px] font-mono">A</kbd>
        </button>
      </div>

      {/* Quick Keyboard Cue Footer */}
      <div className="pt-1 text-[11px] opacity-70 flex flex-wrap items-center justify-between gap-1 border-t border-white/10">
        <span>實體快捷</span>
        <div className="flex gap-1.5 font-mono text-[10px]">
          <span className="bg-white/10 px-1 rounded border border-white/15">1~8</span>
          <span className="bg-white/10 px-1 rounded border border-white/15">QWER</span>
          <span className="bg-white/10 px-1 rounded border border-white/15">A</span>
          <span className="bg-white/10 px-1 rounded border border-white/15">T</span>
          <span className="bg-white/10 px-1 rounded border border-white/15">M</span>
          <span className="bg-white/10 px-1 rounded border border-white/15">Z</span>
        </div>
      </div>
    </aside>
  );
};
