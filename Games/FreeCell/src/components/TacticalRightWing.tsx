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

interface TacticalRightWingProps {
  currentSeed: number;
  onSelectDeal: (seed: number) => void;
  disabled?: boolean;
}

export const TacticalRightWing: React.FC<TacticalRightWingProps> = ({
  currentSeed,
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
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'expert':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'hard':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'classic':
      default:
        return 'bg-sky-100 text-sky-800 border-sky-200';
    }
  };

  return (
    <aside
      aria-label="世界盤號工坊與大師錦囊"
      className="flex flex-col gap-3.5 w-full bg-white/90 backdrop-blur-md rounded-2xl border border-stone-200/90 shadow-sm p-4 text-stone-800 transition-all select-none"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-stone-100">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-600">
            <Compass size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight text-stone-900">世界盤號工坊</h2>
            <p className="text-[11px] text-stone-400">微軟經典 1～32,000 局譜</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleRandomClassic}
          disabled={disabled}
          className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 transition-colors disabled:opacity-40 touch-manipulation"
          title="隨機生成 1～32000 微軟經典盤號"
        >
          <Dices size={13} />
          <span>經典隨機</span>
        </button>
      </div>

      {/* Curated Legendary Deals */}
      <div className="rounded-xl bg-stone-50/90 border border-stone-200/80 p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs font-medium text-stone-700">
          <span className="flex items-center gap-1.5">
            <Sparkles size={14} className="text-amber-500" />
            <span>經典微軟名局精選</span>
          </span>
          <span className="text-[11px] text-stone-400">共 5 盤精選</span>
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
                className={`w-full p-2 rounded-lg border text-left transition-all touch-manipulation flex flex-col gap-0.5 ${
                  isCurrent
                    ? 'bg-amber-50/90 border-amber-300 ring-2 ring-amber-400/40'
                    : 'bg-white border-stone-200/80 hover:bg-stone-50 hover:border-stone-300'
                } disabled:opacity-40`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-900 tabular-nums">
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
                <div className="text-[11px] text-stone-500 truncate">
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
            className="flex-1 min-w-0 px-2.5 py-1 text-xs rounded-lg border border-stone-200 bg-white tabular-nums text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400"
          />
          <button
            type="submit"
            disabled={disabled || !inputSeed.trim()}
            className="px-3 py-1 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-40 touch-manipulation shrink-0"
          >
            跳轉
          </button>
        </form>
      </div>

      {/* Master Strategist Dossier */}
      <div className="rounded-xl bg-stone-50/90 border border-stone-200/80 p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs font-medium text-stone-700">
          <span className="flex items-center gap-1.5">
            <BookOpen size={14} className="text-stone-500" />
            <span>解局大師錦囊</span>
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handlePrevTip}
              className="p-1 rounded hover:bg-stone-200 text-stone-600 transition-colors touch-manipulation"
              aria-label="上一錦囊"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-[11px] font-mono tabular-nums text-stone-500">
              {tipIndex + 1}/{MASTER_TIPS.length}
            </span>
            <button
              type="button"
              onClick={handleNextTip}
              className="p-1 rounded hover:bg-stone-200 text-stone-600 transition-colors touch-manipulation"
              aria-label="下一錦囊"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Current Tip Content Card */}
        <div className="bg-white rounded-lg p-2.5 border border-stone-200/80 flex flex-col gap-1.5 min-h-[96px]">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-stone-900">
              {currentTip.title}
            </h3>
            <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 px-1.5 py-0.5 rounded">
              錦囊 {currentTip.id}
            </span>
          </div>
          <p className="text-[11px] font-medium text-stone-700 leading-snug">
            {currentTip.core}
          </p>
          <p className="text-[11px] text-stone-500 leading-relaxed">
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
              className={`h-1.5 rounded-full transition-all touch-manipulation ${
                idx === tipIndex ? 'w-4 bg-stone-800' : 'w-1.5 bg-stone-300'
              }`}
              aria-label={`前往錦囊 ${idx + 1}`}
            />
          ))}
        </div>
      </div>
    </aside>
  );
};
