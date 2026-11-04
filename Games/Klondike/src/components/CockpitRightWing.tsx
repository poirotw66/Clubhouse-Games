import React from 'react';
import type {
  VegasYieldTelemetry,
  StepEfficiencyTelemetry,
} from '../utils/cockpitAnalysis.ts';
import type { ScoreMode } from '../utils/scoring.ts';
import {
  Coins,
  Compass,
  Flame,
  Keyboard,
  TrendingUp,
  Timer,
  Trophy,
  Activity,
  Award,
} from 'lucide-react';

interface CockpitRightWingProps {
  scoreMode: ScoreMode;
  vegasTel: VegasYieldTelemetry;
  stepEfficiency?: StepEfficiencyTelemetry;
  score: number;
  elapsedSec: number;
  masterAdvice: {
    title: string;
    detail: string;
    badge: string;
    tone: 'gold' | 'emerald' | 'amber' | 'blue';
  };
  lastKeyPressed?: string | null;
  className?: string;
}

export const CockpitRightWing: React.FC<CockpitRightWingProps> = ({
  scoreMode,
  vegasTel,
  stepEfficiency,
  score,
  elapsedSec,
  masterAdvice,
  lastKeyPressed,
  className = '',
}) => {
  const projectedBonus =
    elapsedSec < 30 ? 0 : Math.floor(700000 / Math.max(30, elapsedSec));
  const timeUntilPenalty = 10 - (elapsedSec % 10);

  const adviceToneClasses = {
    gold: 'border-amber-400/50 bg-amber-950/30 text-amber-200',
    emerald: 'border-emerald-400/50 bg-emerald-950/30 text-emerald-200',
    amber: 'border-orange-400/50 bg-orange-950/30 text-orange-200',
    blue: 'border-sky-400/50 bg-sky-950/30 text-sky-200',
  }[masterAdvice.tone];

  return (
    <aside
      className={`flex flex-col gap-3 p-4 rounded-2xl bg-black/45 backdrop-blur-md border border-emerald-500/30 shadow-2xl text-white select-none ${className}`}
      aria-label="右翼破局大師與收益儀"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Coins size={16} className="text-amber-400" />
          <span className="text-sm font-bold tracking-wide text-amber-200">
            {scoreMode === 'vegas' ? '維加斯賭局收益儀' : '標準積分與通關預計'}
          </span>
        </div>
        <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-950/80 border border-amber-500/40 text-amber-300">
          {scoreMode === 'vegas' ? 'VEGAS' : 'STANDARD'}
        </span>
      </div>

      {/* 1. Mode Yield HUD */}
      {scoreMode === 'vegas' ? (
        <div className="p-3 rounded-xl bg-black/25 border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-amber-300 flex items-center gap-1">
              <TrendingUp size={14} />
              <span>賭局收支實況</span>
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/50 border border-white/10 text-white/70">
              底注 -$52
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-center mb-2">
            <div className="p-2 rounded-lg bg-black/30 border border-white/5">
              <div className="text-[10px] text-white/60">收牌回饋 (+$5/張)</div>
              <div className="text-base font-bold font-mono text-emerald-300">
                +${vegasTel.payout}
              </div>
            </div>
            <div
              className={`p-2 rounded-lg border ${
                vegasTel.netProfit >= 0
                  ? 'bg-emerald-950/40 border-emerald-500/40'
                  : 'bg-red-950/40 border-red-500/30'
              }`}
            >
              <div className="text-[10px] text-white/60">本局淨盈虧</div>
              <div
                className={`text-base font-bold font-mono ${
                  vegasTel.netProfit >= 0 ? 'text-emerald-300' : 'text-red-300'
                }`}
              >
                {vegasTel.netProfit >= 0 ? `+$${vegasTel.netProfit}` : `-$${Math.abs(vegasTel.netProfit)}`}
              </div>
            </div>
          </div>

          {/* Break-even status */}
          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-white/5">
            <span className="text-white/60">回本線狀態:</span>
            {vegasTel.breakEvenCardsNeeded > 0 ? (
              <span className="font-mono text-amber-300">
                距回本還需 {vegasTel.breakEvenCardsNeeded} 張
              </span>
            ) : (
              <span className="font-semibold text-emerald-300 flex items-center gap-1">
                <span>✓ 已回本盈利中</span>
              </span>
            )}
          </div>

          {/* Streak Fever */}
          {vegasTel.streakFeverMultiplier > 1.0 && (
            <div className="mt-2 py-1 px-2 rounded-lg bg-gradient-to-r from-amber-950/80 to-yellow-900/50 border border-amber-400/50 text-[10px] text-amber-200 flex items-center justify-between">
              <span className="flex items-center gap-1 font-semibold">
                <Flame size={12} className="text-amber-400 animate-pulse" />
                <span>{vegasTel.streakFeverTitle}</span>
              </span>
              <span className="font-mono font-bold">連勝氣勢加持</span>
            </div>
          )}
        </div>
      ) : (
        <div className="p-3 rounded-xl bg-black/25 border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-emerald-300 flex items-center gap-1">
              <Trophy size={14} />
              <span>積分與時限折損</span>
            </span>
            <span className="text-[10px] font-mono text-white/50">
              當前得分 {score}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-center mb-2">
            <div className="p-2 rounded-lg bg-black/30 border border-white/5">
              <div className="text-[10px] text-white/60">距離下次扣分</div>
              <div className="text-base font-bold font-mono text-amber-300 flex items-center justify-center gap-1">
                <Timer size={14} />
                <span>{timeUntilPenalty} 秒</span>
              </div>
            </div>
            <div className="p-2 rounded-lg bg-black/30 border border-white/5">
              <div className="text-[10px] text-white/60">通關預估加分</div>
              <div className="text-base font-bold font-mono text-emerald-300">
                +{projectedBonus}
              </div>
            </div>
          </div>
          <div className="text-[10px] text-white/50 text-center">
            每滿 10 秒 −2 分 · 通關獎勵 ⌊700,000 / 秒數⌋
          </div>
        </div>
      )}

      {/* 2. 可解步數效率儀 (Step Efficiency Gauge) */}
      {stepEfficiency && (
        <div className="p-3 rounded-xl bg-black/25 border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-sky-300 flex items-center gap-1">
              <Activity size={14} />
              <span>解局步數效率儀</span>
            </span>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                stepEfficiency.rating === 'S'
                  ? 'bg-amber-950/80 border-amber-400/60 text-amber-200'
                  : stepEfficiency.rating === 'A'
                    ? 'bg-emerald-950/80 border-emerald-400/60 text-emerald-200'
                    : 'bg-blue-950/80 border-blue-400/60 text-blue-200'
              }`}
            >
              {stepEfficiency.ratingTitle}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="text-white/60">步數效率指標</span>
            <span className="font-mono font-bold text-sky-200">
              {stepEfficiency.efficiencyPercent}%
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-black/50 overflow-hidden mb-1.5">
            <div
              className="h-full bg-gradient-to-r from-sky-400 to-indigo-400 transition-all duration-300"
              style={{ width: `${stepEfficiency.efficiencyPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-white/50">
            <span>累計步數: {stepEfficiency.moveCount}</span>
            <span>基準參考: ~{stepEfficiency.parMoves} 步</span>
          </div>
        </div>
      )}

      {/* 3. 破局大師動態錦囊 */}
      <div className={`p-3 rounded-xl border ${adviceToneClasses}`}>
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5 text-xs font-bold">
            <Compass size={14} />
            <span>破局錦囊</span>
          </div>
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-black/40 border border-white/20">
            {masterAdvice.badge}
          </span>
        </div>
        <div className="text-xs font-semibold mb-1 text-white">
          {masterAdvice.title}
        </div>
        <p className="text-[11px] leading-relaxed text-white/80">
          {masterAdvice.detail}
        </p>
      </div>

      {/* 4. 鍵盤指揮官快捷鍵系統 */}
      <div className="p-3 rounded-xl bg-black/25 border border-white/10 mt-auto">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-white/80">
            <Keyboard size={14} />
            <span>鍵盤指揮官</span>
          </div>
          {lastKeyPressed && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 animate-pulse">
              觸發: {lastKeyPressed}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[10px] text-white/70">
          <div className="flex items-center justify-between bg-black/20 px-1.5 py-1 rounded">
            <span>翻牌 / 循環</span>
            <kbd className="px-1 py-0.2 rounded bg-black/50 border border-white/20 font-mono text-[9px]">
              Space
            </kbd>
          </div>
          <div className="flex items-center justify-between bg-black/20 px-1.5 py-1 rounded">
            <span>選取牌列</span>
            <kbd className="px-1 py-0.2 rounded bg-black/50 border border-white/20 font-mono text-[9px]">
              1 ~ 7
            </kbd>
          </div>
          <div className="flex items-center justify-between bg-black/20 px-1.5 py-1 rounded">
            <span>選取廢牌</span>
            <kbd className="px-1 py-0.2 rounded bg-black/50 border border-white/20 font-mono text-[9px]">
              0 / W
            </kbd>
          </div>
          <div className="flex items-center justify-between bg-black/20 px-1.5 py-1 rounded">
            <span>自動收牌</span>
            <kbd className="px-1 py-0.2 rounded bg-black/50 border border-white/20 font-mono text-[9px]">
              A
            </kbd>
          </div>
          <div className="flex items-center justify-between bg-black/20 px-1.5 py-1 rounded">
            <span>破局提示</span>
            <kbd className="px-1 py-0.2 rounded bg-black/50 border border-white/20 font-mono text-[9px]">
              H
            </kbd>
          </div>
          <div className="flex items-center justify-between bg-black/20 px-1.5 py-1 rounded">
            <span>悔棋復原</span>
            <kbd className="px-1 py-0.2 rounded bg-black/50 border border-white/20 font-mono text-[9px]">
              Z
            </kbd>
          </div>
          <div className="flex items-center justify-between bg-black/20 px-1.5 py-1 rounded">
            <span>戰術高亮</span>
            <kbd className="px-1 py-0.2 rounded bg-black/50 border border-white/20 font-mono text-[9px]">
              V
            </kbd>
          </div>
          <div className="flex items-center justify-between bg-black/20 px-1.5 py-1 rounded">
            <span>開新局</span>
            <kbd className="px-1 py-0.2 rounded bg-black/50 border border-white/20 font-mono text-[9px]">
              N
            </kbd>
          </div>
        </div>
      </div>
    </aside>
  );
};
