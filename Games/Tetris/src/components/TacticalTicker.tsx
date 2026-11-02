import { useState } from 'react';
import type { BagStatusItem, CombatStats, StackTelemetry } from '../utils/telemetry';
import { Flame, Activity, Target, Zap, ChevronDown, ChevronUp } from 'lucide-react';

interface TacticalTickerProps {
  telemetry: StackTelemetry;
  combatStats: CombatStats;
  bagStatus: BagStatusItem[];
  backToBackReady: boolean;
  combo: number;
  className?: string;
}

export function TacticalTicker({
  telemetry,
  combatStats,
  bagStatus,
  backToBackReady,
  combo,
  className = '',
}: TacticalTickerProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { peakHeight, dangerZone, holesCount, wellColumn, wellDepth } = telemetry;
  const { tetrisRate, feverLabel, feverTier } = combatStats;

  const dangerColor =
    dangerZone === 'critical'
      ? 'text-rose-400 bg-rose-500/10 border-rose-500/40'
      : dangerZone === 'warning'
        ? 'text-amber-400 bg-amber-500/10 border-amber-500/40'
        : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/40';

  return (
    <div className={`w-full flex flex-col gap-1.5 md:hidden text-xs ${className}`}>
      {/* 頂部速報條 */}
      <div className="flex items-center justify-between gap-1 p-1.5 rounded-lg bg-slate-900/90 border border-slate-800 backdrop-blur-sm">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* 高度警戒 */}
          <span
            className={`px-1.5 py-0.5 rounded border text-[10px] font-mono font-semibold flex items-center gap-1 ${dangerColor}`}
          >
            <Activity className="w-3 h-3" />
            <span>H:{peakHeight}/20</span>
          </span>

          {/* 連擊狂熱 */}
          <span
            className={`px-1.5 py-0.5 rounded border text-[10px] font-mono flex items-center gap-1 ${
              feverTier === 'max'
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/60 font-bold animate-pulse'
                : feverTier === 'overdrive'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
            }`}
          >
            <Flame className="w-3 h-3" />
            <span>{combo > 0 ? `Combo x${combo}` : feverLabel}</span>
          </span>

          {/* 四行消率 */}
          <span className="px-1.5 py-0.5 rounded bg-slate-800/80 text-amber-300 border border-slate-700 text-[10px] font-mono flex items-center gap-1">
            <Target className="w-3 h-3" />
            <span>Tetris {tetrisRate}%</span>
          </span>

          {/* B2B Ready */}
          {backToBackReady && (
            <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-400 text-[10px] font-mono font-semibold tetris-b2b-ready flex items-center gap-0.5">
              <Zap className="w-3 h-3 text-sky-400" />
              <span>B2B</span>
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setDrawerOpen((prev) => !prev)}
          className="min-h-[32px] px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] flex items-center gap-0.5 border border-slate-700 touch-manipulation"
          aria-expanded={drawerOpen}
        >
          <span>戰術數據</span>
          {drawerOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* 展開抽屜：完整遙測與 7-Bag */}
      {drawerOpen && (
        <div className="bg-slate-950/95 p-3 rounded-lg border border-sky-600/50 shadow-xl space-y-2.5">
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
              <span className="text-slate-400">覆蓋空洞：</span>
              <span className="font-mono font-semibold ml-1 text-slate-100">
                {holesCount === 0 ? '無空洞' : `${holesCount} 個`}
              </span>
            </div>
            <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
              <span className="text-slate-400">側井蓄積：</span>
              <span className="font-mono font-semibold ml-1 text-slate-100">
                {wellDepth >= 2 && wellColumn !== null
                  ? `C${wellColumn + 1} (${wellDepth}行)`
                  : '平整'}
              </span>
            </div>
          </div>

          {/* 7-Bag 循環 */}
          <div>
            <div className="text-[10px] text-slate-400 mb-1">7-Bag 當前循環透視：</div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {bagStatus.map((item) => (
                <div
                  key={item.type}
                  className={`py-1 rounded border text-[10px] font-mono ${
                    item.status === 'active'
                      ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200 font-bold'
                      : item.status === 'next'
                        ? 'border-amber-400 bg-amber-500/20 text-amber-200 font-semibold'
                        : item.status === 'queue'
                          ? 'border-violet-400 bg-violet-500/10 text-violet-200'
                          : 'border-slate-800 bg-slate-900 text-slate-500 opacity-60'
                  }`}
                >
                  <div>{item.type}</div>
                  <div className="text-[8px] scale-90">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
