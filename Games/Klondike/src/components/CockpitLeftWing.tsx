import React from 'react';
import type {
  StockTelemetry,
  HiddenCardsTelemetry,
  FoundationTelemetry,
} from '../utils/cockpitAnalysis.ts';
import type { ScoreMode } from '../utils/scoring.ts';
import {
  Layers,
  Eye,
  Scale,
  Sparkles,
  Zap,
  Target,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

interface CockpitLeftWingProps {
  stockTel: StockTelemetry;
  hiddenTel: HiddenCardsTelemetry;
  foundationTel: FoundationTelemetry;
  scoreMode: ScoreMode;
  tacticalHighlight: boolean;
  onToggleTacticalHighlight: () => void;
  onAutoCollect: () => void;
  canAutoCollect: boolean;
  movableCount: number;
  className?: string;
}

export const CockpitLeftWing: React.FC<CockpitLeftWingProps> = ({
  stockTel,
  hiddenTel,
  foundationTel,
  scoreMode,
  tacticalHighlight,
  onToggleTacticalHighlight,
  onAutoCollect,
  canAutoCollect,
  movableCount,
  className = '',
}) => {
  return (
    <aside
      className={`flex flex-col gap-3 p-4 rounded-2xl bg-black/40 backdrop-blur-md border border-emerald-500/30 shadow-2xl text-white select-none ${className}`}
      aria-label="左翼戰術情報雷達"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <span className="text-sm font-bold tracking-wide text-emerald-200">戰術情報雷達</span>
        </div>
        <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300">
          RADAR
        </span>
      </div>

      {/* 1. 牌庫與廢牌透視 */}
      <div className="p-3 rounded-xl bg-black/25 border border-white/10">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
            <Layers size={14} />
            <span>牌庫循環透視</span>
          </div>
          {scoreMode === 'vegas' ? (
            <span
              className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                stockTel.passesRemaining === 0
                  ? 'bg-red-950/80 text-red-300 border border-red-500/40'
                  : 'bg-amber-950/80 text-amber-300 border border-amber-500/40'
              }`}
            >
              剩餘輪次: {stockTel.passesRemaining}
            </span>
          ) : (
            <span className="text-[10px] text-white/50">
              {stockTel.recycleCount > 0 ? `已循環 ${stockTel.recycleCount} 次` : '首輪發牌'}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/20">
            <div className="text-[10px] text-white/60">未翻牌庫</div>
            <div className="text-lg font-bold font-mono text-emerald-200">
              {stockTel.stockCount}
              <span className="text-xs text-white/40 ml-0.5">張</span>
            </div>
          </div>
          <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/20">
            <div className="text-[10px] text-white/60">廢牌堆</div>
            <div className="text-lg font-bold font-mono text-emerald-200">
              {stockTel.wasteCount}
              <span className="text-xs text-white/40 ml-0.5">張</span>
            </div>
          </div>
        </div>

        {scoreMode === 'standard' && stockTel.recycleCount > 0 && (
          <div className="mt-2 text-[10px] text-amber-300/80 flex items-center justify-between">
            <span>下次循環牌庫扣分:</span>
            <span className="font-mono">{stockTel.recyclePenaltyNext} 分</span>
          </div>
        )}
      </div>

      {/* 2. 牌列暗牌深層分佈熱圖 */}
      <div className="p-3 rounded-xl bg-black/25 border border-white/10">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
            <Target size={14} />
            <span>暗牌深層分佈</span>
          </div>
          <span className="text-[11px] font-mono text-emerald-200">
            剩餘 {hiddenTel.totalHidden} / 21
          </span>
        </div>

        {/* 7 Columns equalizer */}
        <div className="grid grid-cols-7 gap-1 items-end h-14 py-1 px-1 bg-black/30 rounded-lg border border-white/5">
          {hiddenTel.hiddenByColumn.map((cnt, idx) => {
            const isDeepest = cnt > 0 && cnt === hiddenTel.deepestColCount;
            const heightPercent = Math.max(12, Math.round((cnt / 6) * 100));
            return (
              <div key={`col-${idx}`} className="flex flex-col items-center h-full justify-end">
                <div
                  className={`w-full rounded-sm transition-all duration-300 ${
                    cnt === 0
                      ? 'bg-emerald-400/30'
                      : isDeepest
                        ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]'
                        : 'bg-emerald-500/80'
                  }`}
                  style={{ height: cnt === 0 ? '4px' : `${heightPercent}%` }}
                />
                <span
                  className={`text-[9px] mt-1 font-mono ${
                    isDeepest ? 'text-amber-300 font-bold' : 'text-white/60'
                  }`}
                >
                  {cnt}
                </span>
              </div>
            );
          })}
        </div>

        {/* Progress Bar */}
        <div className="mt-2.5">
          <div className="flex justify-between text-[10px] text-white/60 mb-1">
            <span>解牌進度</span>
            <span className="font-mono text-emerald-300">{hiddenTel.revealedPercent}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-black/50 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-300 transition-all duration-300"
              style={{ width: `${hiddenTel.revealedPercent}%` }}
            />
          </div>
        </div>

        {hiddenTel.isAllRevealed && (
          <div className="mt-2 py-1 px-2 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] flex items-center gap-1 font-semibold">
            <CheckCircle2 size={12} />
            <span>所有暗牌已全部翻開！</span>
          </div>
        )}
      </div>

      {/* 3. 四色回收天秤 */}
      <div className="p-3 rounded-xl bg-black/25 border border-white/10">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
            <Scale size={14} />
            <span>四色收牌天秤</span>
          </div>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 ${
              foundationTel.isBalanced
                ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-500/30'
                : 'bg-amber-950/70 text-amber-300 border border-amber-500/30'
            }`}
          >
            {foundationTel.isBalanced ? (
              <>
                <CheckCircle2 size={10} />
                <span>天秤平衡</span>
              </>
            ) : (
              <>
                <AlertTriangle size={10} />
                <span>留意失衡</span>
              </>
            )}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {foundationTel.suits.map((suitItem) => (
            <div
              key={suitItem.suit}
              className="p-1.5 rounded-lg bg-black/30 border border-white/5 flex items-center justify-between"
            >
              <div className="flex items-center gap-1.5">
                <span
                  className={`text-sm leading-none ${
                    suitItem.color === 'red' ? 'text-red-400' : 'text-slate-200'
                  }`}
                >
                  {suitItem.symbol}
                </span>
                <span className="text-xs text-white/80">{suitItem.name}</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-xs font-bold font-mono text-emerald-200">
                  {suitItem.topRank}
                </span>
                <span className="text-[10px] font-mono text-white/40">
                  {suitItem.count}/13
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. 戰術視野與捷徑按鈕 */}
      <div className="flex flex-col gap-2 mt-auto pt-1">
        <button
          type="button"
          onClick={onToggleTacticalHighlight}
          className={`flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-medium border transition-all duration-150 touch-manipulation ${
            tacticalHighlight
              ? 'bg-amber-500/25 border-amber-400/60 text-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.25)]'
              : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
          }`}
          title="切換可動牌高亮顯示"
        >
          <div className="flex items-center gap-2">
            <Eye size={14} className={tacticalHighlight ? 'text-amber-300' : 'text-white/60'} />
            <span>高亮所有可動牌</span>
          </div>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-black/40 border border-white/10">
            {movableCount} 張
          </span>
        </button>

        <button
          type="button"
          onClick={onAutoCollect}
          disabled={!canAutoCollect}
          className={`flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all duration-150 touch-manipulation ${
            canAutoCollect
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 border-emerald-400/60 text-white shadow-lg cursor-pointer'
              : 'bg-white/5 border-white/10 text-white/30 cursor-not-allowed'
          }`}
          title="一鍵將符合條件的牌推進回收基座 (快捷鍵: A)"
        >
          <Zap size={14} className={canAutoCollect ? 'text-amber-300 animate-bounce' : ''} />
          <span>一鍵自動收牌</span>
          <kbd className="px-1 rounded text-[10px] font-mono bg-black/40 border border-white/20">
            A
          </kbd>
        </button>
      </div>
    </aside>
  );
};
