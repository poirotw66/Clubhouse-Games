import React, { useState } from 'react';
import type {
  StockTelemetry,
  HiddenCardsTelemetry,
  FoundationTelemetry,
  VegasYieldTelemetry,
} from '../utils/cockpitAnalysis.ts';
import type { ScoreMode } from '../utils/scoring.ts';
import { CockpitLeftWing } from './CockpitLeftWing.tsx';
import { CockpitRightWing } from './CockpitRightWing.tsx';
import {
  Layers,
  Scale,
  Zap,
  Target,
  Coins,
  ChevronDown,
  X,
  Eye,
  Lightbulb,
} from 'lucide-react';

interface MobileTacticalStripProps {
  stockTel: StockTelemetry;
  hiddenTel: HiddenCardsTelemetry;
  foundationTel: FoundationTelemetry;
  vegasTel: VegasYieldTelemetry;
  scoreMode: ScoreMode;
  score: number;
  elapsedSec: number;
  tacticalHighlight: boolean;
  onToggleTacticalHighlight: () => void;
  onAutoCollect: () => void;
  canAutoCollect: boolean;
  movableCount: number;
  onShowHint: () => void;
  isBusy: boolean;
  isGameWon: boolean;
  masterAdvice: {
    title: string;
    detail: string;
    badge: string;
    tone: 'gold' | 'emerald' | 'amber' | 'blue';
  };
  lastKeyPressed?: string | null;
  className?: string;
}

export const MobileTacticalStrip: React.FC<MobileTacticalStripProps> = ({
  stockTel,
  hiddenTel,
  foundationTel,
  vegasTel,
  scoreMode,
  score,
  elapsedSec,
  tacticalHighlight,
  onToggleTacticalHighlight,
  onAutoCollect,
  canAutoCollect,
  movableCount,
  onShowHint,
  isBusy,
  isGameWon,
  masterAdvice,
  lastKeyPressed,
  className = '',
}) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'radar' | 'yield'>('radar');

  return (
    <div className={`w-full ${className}`}>
      {/* Compact strip */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 p-2 rounded-xl bg-black/40 backdrop-blur-md border border-emerald-500/30 text-xs shadow-md">
        {/* Quick status chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
          {/* Hidden cards */}
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-950/60 border border-emerald-500/20 text-emerald-200"
            title="剩餘未翻暗牌"
          >
            <Target size={12} className="text-emerald-400" />
            <span className="font-mono text-[11px] font-semibold">
              暗牌 {hiddenTel.totalHidden}
            </span>
          </div>

          {/* Stock count */}
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-950/60 border border-emerald-500/20 text-emerald-200"
            title="未翻牌庫張數"
          >
            <Layers size={12} className="text-emerald-400" />
            <span className="font-mono text-[11px] font-semibold">
              牌庫 {stockTel.stockCount}
            </span>
          </div>

          {/* Mode Yield / Score */}
          {scoreMode === 'vegas' ? (
            <div
              className={`flex items-center gap-1 px-2 py-1 rounded-lg border font-mono text-[11px] font-semibold ${
                vegasTel.netProfit >= 0
                  ? 'bg-emerald-950/70 border-emerald-400/50 text-emerald-300'
                  : 'bg-red-950/70 border-red-400/50 text-red-300'
              }`}
              title="維加斯淨盈虧"
            >
              <Coins size={12} />
              <span>{vegasTel.netProfit >= 0 ? `+$${vegasTel.netProfit}` : `-$${Math.abs(vegasTel.netProfit)}`}</span>
            </div>
          ) : (
            <div
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-950/60 border border-emerald-500/20 text-emerald-200"
              title="收牌總數"
            >
              <Scale size={12} className="text-emerald-400" />
              <span className="font-mono text-[11px] font-semibold">
                基座 {foundationTel.totalCards}/52
              </span>
            </div>
          )}
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center gap-1.5 ml-auto">
          <button
            type="button"
            onClick={onToggleTacticalHighlight}
            className={`min-h-[36px] px-2.5 py-1 rounded-lg border text-[11px] font-medium flex items-center gap-1 touch-manipulation transition-colors ${
              tacticalHighlight
                ? 'bg-amber-500/30 border-amber-400 text-amber-200'
                : 'bg-black/30 border-white/10 text-white/70 hover:bg-white/10'
            }`}
            title="切換可動牌高亮"
          >
            <Eye size={12} />
            <span className="hidden xs:inline">高亮</span>
            <span className="font-mono">({movableCount})</span>
          </button>

          <button
            type="button"
            onClick={onAutoCollect}
            disabled={!canAutoCollect}
            className={`min-h-[36px] px-2.5 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1 touch-manipulation transition-colors ${
              canAutoCollect
                ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-400 text-white'
                : 'bg-black/20 border-white/10 text-white/30 cursor-not-allowed'
            }`}
            title="一鍵收牌"
          >
            <Zap size={12} className={canAutoCollect ? 'text-amber-300 animate-bounce' : ''} />
            <span>收牌</span>
          </button>

          <button
            type="button"
            onClick={onShowHint}
            disabled={isBusy || isGameWon}
            className="min-h-[36px] px-2 py-1 rounded-lg bg-black/30 border border-white/10 text-[11px] text-white/80 flex items-center gap-1 touch-manipulation hover:bg-white/10"
            title="提示"
          >
            <Lightbulb size={12} />
          </button>

          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            className="min-h-[36px] px-2.5 py-1 rounded-lg bg-emerald-900/60 border border-emerald-500/40 text-[11px] text-emerald-200 font-medium flex items-center gap-1 touch-manipulation"
          >
            <span>儀表</span>
            <ChevronDown size={12} />
          </button>
        </div>
      </div>

      {/* Expandable full tactical drawer */}
      {isDrawerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col justify-end sm:justify-center p-2 sm:p-4 animate-in fade-in duration-200"
          onClick={() => setIsDrawerOpen(false)}
        >
          <div
            className="bg-emerald-950/95 border border-emerald-500/40 rounded-2xl max-h-[85vh] w-full max-w-lg mx-auto flex flex-col overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between p-3.5 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-emerald-200">
                  皇家戰術情報全艙
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="p-1.5 rounded-lg bg-black/30 text-white/70 hover:text-white"
                aria-label="關閉戰術抽屜"
              >
                <X size={18} />
              </button>
            </div>

            {/* Tab switch */}
            <div className="flex border-b border-white/10 bg-black/20 p-1 gap-1">
              <button
                type="button"
                onClick={() => setActiveTab('radar')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  activeTab === 'radar'
                    ? 'bg-emerald-600 text-white'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                戰術情報雷達 (Radar)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('yield')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  activeTab === 'yield'
                    ? 'bg-amber-600 text-white'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                破局與收益儀 (Yield & Advice)
              </button>
            </div>

            {/* Content body */}
            <div className="overflow-y-auto p-3.5 space-y-3">
              {activeTab === 'radar' ? (
                <CockpitLeftWing
                  stockTel={stockTel}
                  hiddenTel={hiddenTel}
                  foundationTel={foundationTel}
                  scoreMode={scoreMode}
                  tacticalHighlight={tacticalHighlight}
                  onToggleTacticalHighlight={onToggleTacticalHighlight}
                  onAutoCollect={onAutoCollect}
                  canAutoCollect={canAutoCollect}
                  movableCount={movableCount}
                />
              ) : (
                <CockpitRightWing
                  scoreMode={scoreMode}
                  vegasTel={vegasTel}
                  score={score}
                  elapsedSec={elapsedSec}
                  masterAdvice={masterAdvice}
                  lastKeyPressed={lastKeyPressed}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
