import type { TetrominoType } from '../utils/tetrisLogic';
import type { BagStatusItem, StackTelemetry } from '../utils/telemetry';
import { PieceIcon } from './PieceIcon';
import { ShieldAlert, Zap, Layers, Activity } from 'lucide-react';

interface CockpitLeftWingProps {
  statusText: string;
  score: number;
  lines: number;
  level: number;
  combo: number;
  backToBackReady: boolean;
  hold: TetrominoType | null;
  canHold: boolean;
  holdEnabled: boolean;
  isVersus: boolean;
  timeDisplay: string;
  timeLabel: string;
  remainingLines?: number;
  isDaily: boolean;
  dailyBar: { current: number; ghost: number | null } | null;
  dailyStreak: number;
  todayBestText?: string;
  practiceStarsText?: string;
  classicBestText?: string;
  versusStats?: { wins: number; losses: number; streak: number };
  versusMeta?: { bo3: boolean; seriesPlayer: number; seriesCpu: number };
  incomingGarbage: number;
  telemetry: StackTelemetry;
  bagStatus: BagStatusItem[];
  className?: string;
}

export function CockpitLeftWing({
  statusText,
  score,
  lines,
  level,
  combo,
  backToBackReady,
  hold,
  canHold,
  holdEnabled,
  isVersus,
  timeDisplay,
  timeLabel,
  remainingLines,
  isDaily,
  dailyBar,
  dailyStreak,
  todayBestText,
  practiceStarsText,
  classicBestText,
  versusStats,
  versusMeta,
  incomingGarbage,
  telemetry,
  bagStatus,
  className = '',
}: CockpitLeftWingProps) {
  const { peakHeight, holesCount, dangerZone, colHeights, wellColumn, wellDepth } =
    telemetry;

  const dangerBadge =
    dangerZone === 'critical'
      ? { text: '頂出危機', color: 'bg-rose-500/20 text-rose-300 border-rose-500/60' }
      : dangerZone === 'warning'
        ? { text: '高度警戒', color: 'bg-amber-500/20 text-amber-300 border-amber-500/60' }
        : { text: '陣地安全', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60' };

  return (
    <aside
      className={`flex flex-col gap-3 text-xs ${className}`}
      aria-label="左翼戰術遙測座艙"
    >
      {/* 核心狀態與積分 */}
      <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800 shadow-md backdrop-blur-sm space-y-1.5">
        <div className="border-b border-slate-800 pb-1.5 mb-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              座艙狀態
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <p className="text-slate-200 leading-snug mt-0.5 font-medium">{statusText}</p>
        </div>

        <div className="flex justify-between">
          <span className="text-slate-400">分數</span>
          <span className="font-mono font-bold text-slate-100">{score}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">行數</span>
          <span className="font-mono text-slate-200">{lines}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">等級</span>
          <span className="font-mono text-slate-200">{level}</span>
        </div>

        {!isVersus && (
          <>
            <div className="flex justify-between">
              <span className="text-slate-400">{timeLabel}</span>
              <span className="font-mono tabular-nums text-slate-200">{timeDisplay}</span>
            </div>
            {remainingLines !== undefined && (
              <div className="flex justify-between">
                <span className="text-slate-400">剩餘目標</span>
                <span className="font-mono tabular-nums text-amber-300">
                  {remainingLines} 行
                </span>
              </div>
            )}
            {classicBestText && (
              <div className="flex justify-between border-t border-slate-800 pt-1 text-slate-400">
                <span>個人最佳</span>
                <span className="font-mono tabular-nums">{classicBestText}</span>
              </div>
            )}
            {practiceStarsText && (
              <div className="flex justify-between border-t border-slate-800 pt-1 text-slate-400">
                <span>精通星級</span>
                <span className="font-mono">{practiceStarsText}</span>
              </div>
            )}
            {isDaily && dailyBar && (
              <div className="pt-1.5 space-y-1 border-t border-slate-800">
                <div className="flex justify-between text-emerald-200/90 text-[11px]">
                  <span>今日挑戰</span>
                  <span>連勝 {dailyStreak} 天</span>
                </div>
                <div
                  className="relative h-1.5 rounded-full bg-slate-800 overflow-hidden"
                  role="progressbar"
                  aria-valuenow={Math.round(dailyBar.current * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="absolute inset-y-0 left-0 bg-emerald-500/80 tetris-daily-fill"
                    style={{ width: `${dailyBar.current * 100}%` }}
                  />
                </div>
                {todayBestText && (
                  <div className="text-[10px] text-slate-400 flex justify-between">
                    <span>今日最佳</span>
                    <span>{todayBestText}</span>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {isVersus && (
          <div className="border-t border-slate-800 pt-1.5 space-y-1">
            {incomingGarbage > 0 && (
              <div className="flex justify-between text-rose-300 font-semibold">
                <span>垃圾佇列</span>
                <span className="font-mono">↓ {incomingGarbage}</span>
              </div>
            )}
            {versusStats && (
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>對戰戰績</span>
                <span className="font-mono">
                  {versusStats.wins}勝 {versusStats.losses}敗
                </span>
              </div>
            )}
            {versusMeta?.bo3 && (
              <div className="flex justify-between text-rose-300 text-[11px]">
                <span>BO3 系列賽</span>
                <span className="font-mono">
                  {versusMeta.seriesPlayer}–{versusMeta.seriesCpu}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Hold 模組 */}
      <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800 shadow-md backdrop-blur-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <h2 className="text-xs font-semibold text-slate-200 tracking-wider uppercase">
              暫存槽 (HOLD)
            </h2>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
            C / Shift
          </span>
        </div>
        <div
          className={`w-full aspect-[4/3] bg-slate-950/70 rounded-lg flex items-center justify-center border transition-all ${
            holdEnabled
              ? canHold
                ? 'border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.15)]'
                : 'border-slate-800 opacity-50'
              : 'border-slate-800 opacity-30'
          }`}
        >
          {hold ? (
            <div className="transform scale-110">
              <PieceIcon type={hold} cell={15} />
            </div>
          ) : (
            <span className="text-[11px] text-slate-500 font-mono">
              {holdEnabled ? '按 C 暫存' : '本模式鎖定'}
            </span>
          )}
        </div>
        {hold && (
          <div className="mt-1 text-center text-[10px] text-slate-400 font-mono">
            {canHold ? '✓ 隨時可交換' : '🔒 本步已鎖定'}
          </div>
        )}
      </div>

      {/* 戰備狀態 (B2B / Combo) */}
      <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800 shadow-md backdrop-blur-sm space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-slate-400 flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>戰備判定</span>
          </span>
          {backToBackReady ? (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-400/80 tetris-b2b-ready">
              B2B CHARGED 1.5x
            </span>
          ) : (
            <span className="text-[10px] text-slate-500 font-mono">B2B 未充能</span>
          )}
        </div>

        {combo > 0 && (
          <div className="flex items-center justify-between text-amber-300 text-xs font-semibold bg-amber-500/10 px-2 py-1 rounded border border-amber-500/30">
            <span>連鎖連擊 (Combo)</span>
            <span className="font-mono text-sm">x{combo}</span>
          </div>
        )}
      </div>

      {/* 戰術遙測雷達 (Tactical Telemetry Radar) */}
      <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800 shadow-md backdrop-blur-sm space-y-2.5">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
          <div className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <h3 className="text-xs font-semibold text-slate-200">陣地戰術遙測</h3>
          </div>
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded border ${dangerBadge.color}`}
          >
            {dangerBadge.text}
          </span>
        </div>

        {/* 堆疊等化柱狀圖 (10-column height equalizer) */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-slate-400 font-mono">
            <span>最高高度</span>
            <span
              className={
                dangerZone === 'critical'
                  ? 'text-rose-400 font-bold'
                  : dangerZone === 'warning'
                    ? 'text-amber-400 font-bold'
                    : 'text-slate-200'
              }
            >
              {peakHeight} / 20 行
            </span>
          </div>
          <div
            className="flex items-end justify-between gap-1 h-12 bg-slate-950/70 rounded p-1 border border-slate-800/80"
            title="10 列堆疊截面透視"
          >
            {colHeights.map((h, i) => {
              const pct = (h / 20) * 100;
              const isCritCol = h >= 16;
              const isWarnCol = h >= 12;
              const barColor = isCritCol
                ? 'bg-rose-500'
                : isWarnCol
                  ? 'bg-amber-400'
                  : 'bg-cyan-500';
              return (
                <div
                  key={i}
                  className="flex-1 flex flex-col justify-end items-center h-full group relative"
                >
                  <div
                    className={`w-full rounded-t-[1px] transition-all duration-200 ${barColor}`}
                    style={{ height: `${pct}%`, minHeight: h > 0 ? '2px' : '0' }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* 幾何地形特徵 (Holes & Wells) */}
        <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11px]">
          <div className="bg-slate-950/60 p-1.5 rounded border border-slate-800/80">
            <div className="text-slate-400 flex items-center gap-1">
              <ShieldAlert className="w-3 h-3 text-rose-400" />
              <span>覆蓋空洞</span>
            </div>
            <div
              className={`font-mono text-sm font-semibold mt-0.5 ${
                holesCount > 0 ? 'text-rose-300' : 'text-emerald-400'
              }`}
            >
              {holesCount === 0 ? '0 良好' : `${holesCount} 個空洞`}
            </div>
          </div>
          <div className="bg-slate-950/60 p-1.5 rounded border border-slate-800/80">
            <div className="text-slate-400 flex items-center gap-1">
              <Layers className="w-3 h-3 text-sky-400" />
              <span>側井蓄積</span>
            </div>
            <div className="font-mono text-sm font-semibold mt-0.5 text-slate-200">
              {wellDepth >= 2 && wellColumn !== null
                ? `C${wellColumn + 1} · ${wellDepth} 行`
                : '平整地貌'}
            </div>
          </div>
        </div>
      </div>

      {/* 7-Bag 方塊序列分佈透視 (7-Bag Distribution Radar) */}
      <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800 shadow-md backdrop-blur-sm space-y-2">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-1">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
            <h3 className="text-xs font-semibold text-slate-200">7-Bag 序列透視</h3>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">循環分佈</span>
        </div>
        <p className="text-[10px] text-slate-400 leading-tight">
          Guideline 規則保證每 7 塊必包含各形狀 1 枚：
        </p>
        <div className="grid grid-cols-7 gap-1 text-center">
          {bagStatus.map((item) => {
            const isAct = item.status === 'active';
            const isNxt = item.status === 'next';
            const isQue = item.status === 'queue';
            const ringColor = isAct
              ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200 shadow-[0_0_8px_rgba(6,182,212,0.5)]'
              : isNxt
                ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                : isQue
                  ? 'border-violet-400/60 bg-violet-500/10 text-violet-200'
                  : 'border-slate-800 bg-slate-950/50 text-slate-500 opacity-60';
            return (
              <div
                key={item.type}
                className={`flex flex-col items-center py-1 rounded border transition-all ${ringColor}`}
                title={`${item.type} 方塊：${item.label}`}
              >
                <span className="font-mono font-bold text-xs">{item.type}</span>
                <span className="text-[8px] scale-90">{item.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
