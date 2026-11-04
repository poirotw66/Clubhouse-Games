import React, { useState } from 'react';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Compass,
  Dices,
  Sparkles,
} from 'lucide-react';
import {
  LEGENDARY_DEALS,
  MASTER_TIPS,
  type LegendaryDeal,
} from '../utils/tactics.ts';
import type { WorkshopTheme } from '../utils/theme.ts';

interface TacticalRightWingProps {
  currentSeed: number;
  theme?: WorkshopTheme;
  onSelectDeal: (seed: number) => void;
  disabled?: boolean;
}

export const TacticalRightWing: React.FC<TacticalRightWingProps> = ({
  currentSeed,
  theme = 'royal-velvet',
  onSelectDeal,
  disabled = false,
}) => {
  const [tipIndex, setTipIndex] = useState(0);
  const [inputSeed, setInputSeed] = useState('');

  const currentTip = MASTER_TIPS[tipIndex] ?? MASTER_TIPS[0]!;

  const handleNextTip = () => {
    setTipIndex((prev) => (prev + 1) % MASTER_TIPS.length);
  };

  const handlePrevTip = () => {
    setTipIndex((prev) => (prev - 1 + MASTER_TIPS.length) % MASTER_TIPS.length);
  };

  const handleRandomClassic = () => {
    if (disabled) return;
    const randomSeed = Math.floor(Math.random() * 32000) + 1;
    onSelectDeal(randomSeed);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled) return;
    const n = Number(inputSeed.trim());
    if (Number.isInteger(n) && n >= 1) {
      onSelectDeal(n);
      setInputSeed('');
    }
  };

  const difficultyBadgeTheme = (diff: LegendaryDeal['difficulty']) => {
    switch (diff) {
      case 'impossible':
        return 'bg-rose-950/80 text-rose-300 border-rose-500/50';
      case 'expert':
        return 'bg-amber-950/80 text-amber-300 border-amber-500/50';
      case 'hard':
        return 'bg-purple-950/80 text-purple-300 border-purple-500/50';
      case 'classic':
      default:
        return 'bg-sky-950/80 text-sky-300 border-sky-500/50';
    }
  };

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

  return (
    <aside
      aria-label="世界盤號工坊與大師錦囊"
      className={`flex flex-col gap-3.5 w-full rounded-2xl border backdrop-blur-md p-4 transition-all select-none ${containerTheme}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-sky-500/20 text-sky-400">
            <Compass size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight">世界盤號工坊</h2>
            <p className="text-[11px] opacity-70">微軟經典 1～32,000 局譜</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleRandomClassic}
          disabled={disabled}
          className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-sky-400/50 bg-sky-950/60 text-sky-300 hover:bg-sky-900/80 transition-colors disabled:opacity-40 touch-manipulation cursor-pointer"
          title="隨機生成 1～32000 微軟經典盤號"
        >
          <Dices size={13} />
          <span>經典隨機</span>
        </button>
      </div>

      {/* Curated Legendary Deals */}
      <div className={`rounded-xl border p-3 flex flex-col gap-2 ${cardPanelTheme}`}>
        <div className="flex items-center justify-between text-xs font-medium">
          <span className="flex items-center gap-1.5">
            <Sparkles size={14} className="text-amber-400" />
            <span>經典微軟名局精選</span>
          </span>
          <span className="text-[11px] opacity-70">共 5 盤精選</span>
        </div>

        <div className="flex flex-col gap-1.5">
          {LEGENDARY_DEALS.map((deal) => {
            const isCurrent = currentSeed === deal.seed;
            return (
              <button
                key={deal.seed}
                type="button"
                onClick={() => onSelectDeal(deal.seed)}
                disabled={disabled}
                className={`w-full p-2 rounded-lg border text-left transition-all touch-manipulation flex flex-col gap-0.5 cursor-pointer ${
                  isCurrent
                    ? 'bg-amber-500/20 border-amber-400 ring-2 ring-amber-400/50 text-amber-200'
                    : 'bg-black/25 border-white/10 hover:bg-white/10'
                } disabled:opacity-40`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold tabular-nums">
                    {deal.title}
                  </span>
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border ${difficultyBadgeTheme(
                      deal.difficulty,
                    )}`}
                  >
                    {deal.tag}
                  </span>
                </div>
                <div className="text-[11px] opacity-75 truncate">
                  {deal.subtitle}
                </div>
              </button>
            );
          })}
        </div>

        {/* Quick Custom Seed Jumper */}
        <form onSubmit={handleCustomSubmit} className="flex gap-1.5 pt-1">
          <input
            type="text"
            inputMode="numeric"
            placeholder="自訂局號 (如 11982)"
            value={inputSeed}
            onChange={(e) => setInputSeed(e.target.value)}
            disabled={disabled}
            className="flex-1 min-w-0 px-2.5 py-1 text-xs rounded-lg border border-white/20 bg-black/40 tabular-nums text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-amber-400"
          />
          <button
            type="submit"
            disabled={disabled || !inputSeed.trim()}
            className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-lg text-xs transition-colors disabled:opacity-40 touch-manipulation shrink-0 cursor-pointer shadow-sm"
          >
            跳轉
          </button>
        </form>
      </div>

      {/* Master Strategist Dossier */}
      <div className={`rounded-xl border p-3 flex flex-col gap-2 ${cardPanelTheme}`}>
        <div className="flex items-center justify-between text-xs font-medium">
          <span className="flex items-center gap-1.5">
            <BookOpen size={14} className="text-amber-400" />
            <span>解局大師錦囊</span>
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handlePrevTip}
              className="p-1 rounded hover:bg-white/10 text-white/70 transition-colors touch-manipulation cursor-pointer"
              aria-label="上一錦囊"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-[11px] font-mono tabular-nums opacity-75">
              {tipIndex + 1}/{MASTER_TIPS.length}
            </span>
            <button
              type="button"
              onClick={handleNextTip}
              className="p-1 rounded hover:bg-white/10 text-white/70 transition-colors touch-manipulation cursor-pointer"
              aria-label="下一錦囊"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Current Tip Content Card */}
        <div className={`rounded-lg p-2.5 border flex flex-col gap-1.5 min-h-[96px] ${subBoxTheme}`}>
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-amber-300">
              {currentTip.title}
            </h3>
            <span className="text-[10px] text-amber-300 font-semibold bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-500/40">
              錦囊 {currentTip.id}
            </span>
          </div>
          <p className="text-[11px] font-medium leading-snug">
            {currentTip.core}
          </p>
          <p className="text-[11px] opacity-75 leading-relaxed">
            {currentTip.detail}
          </p>
        </div>

        {/* Tip Indicators */}
        <div className="flex justify-center gap-1 pt-0.5">
          {MASTER_TIPS.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setTipIndex(idx)}
              className={`h-1.5 rounded-full transition-all touch-manipulation cursor-pointer ${
                idx === tipIndex ? 'w-4 bg-amber-400' : 'w-1.5 bg-white/30'
              }`}
              aria-label={`前往錦囊 ${idx + 1}`}
            />
          ))}
        </div>
      </div>
    </aside>
  );
};
