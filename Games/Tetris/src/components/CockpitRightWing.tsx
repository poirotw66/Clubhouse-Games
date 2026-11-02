import { useState } from 'react';
import type { TetrominoType } from '../utils/tetrisLogic';
import type { CombatStats } from '../utils/telemetry';
import { PieceIcon } from './PieceIcon';
import { Flame, Target, BookOpen, ChevronDown, ChevronUp, Gauge } from 'lucide-react';

interface CockpitRightWingProps {
  queue: TetrominoType[];
  previewCount?: number;
  combatStats: CombatStats;
  className?: string;
}

const MASTER_TIPS = [
  {
    title: '側井留空術（9-0 Stacking）',
    tag: '四行大招',
    summary:
      '保留最右側（或最左側）第 10 列淨空，其餘 9 列緊密平整堆疊，等待「長條 I 塊」瞬間硬降連續觸發 4 行 Tetris 毀滅打擊。',
  },
  {
    title: 'T-Spin 旋轉架構（T-Slot）',
    tag: '高端爆分',
    summary:
      '預留 3 格底寬與 1 格懸空屋簷（Overhang），利用 SRS 旋轉與踢牆將 T 塊卡入窄縫，觸發 T-SPIN DOUBLE 高額得分與倍增垃圾行。',
  },
  {
    title: '全清 Perfect Clear 契機',
    tag: '滿貫全消',
    summary:
      '開局前 4 行利用特定方塊幾何組合完全清空場地，達成「全清滿貫」，觸發巨額開局加分與重砲攻擊。',
  },
  {
    title: '相殺反制術（Garbage Counter）',
    tag: '對戰必備',
    summary:
      '對戰中敵方垃圾進入右側佇列時，把握方塊生成前的間隙立即消行抵消（Offset），化解危機並將反擊彈道逆向壓制對方。',
  },
];

export function CockpitRightWing({
  queue,
  previewCount = 5,
  combatStats,
  className = '',
}: CockpitRightWingProps) {
  const [tacticsOpen, setTacticsOpen] = useState(false);
  const [selectedTip, setSelectedTip] = useState(0);

  const { tetrisRate, linesPerMinute, piecesPerSecond, feverRatio, feverTier, feverLabel } =
    combatStats;

  const feverBarColor =
    feverTier === 'max'
      ? 'bg-gradient-to-r from-amber-400 via-rose-500 to-fuchsia-500 tetris-fever-pulse'
      : feverTier === 'overdrive'
        ? 'bg-gradient-to-r from-amber-400 to-orange-500'
        : feverTier === 'ignited'
          ? 'bg-gradient-to-r from-cyan-400 to-emerald-400'
          : 'bg-slate-700';

  return (
    <aside
      className={`flex flex-col gap-3 text-xs ${className}`}
      aria-label="右翼戰鬥與表現座艙"
    >
      {/* 次手預覽佇列 (Next Queue Station) */}
      <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800 shadow-md backdrop-blur-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <h2 className="text-xs font-semibold text-slate-200 tracking-wider uppercase">
              次手佇列 (NEXT)
            </h2>
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            預覽 {previewCount} 步
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          {queue.slice(0, previewCount).map((type, idx) => {
            const isFirst = idx === 0;
            return (
              <div
                key={`${type}-${idx}`}
                className={`relative flex items-center justify-between p-1.5 rounded-lg border transition-all ${
                  isFirst
                    ? 'bg-slate-950/80 border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.18)]'
                    : 'bg-slate-950/50 border-slate-800/80 opacity-85'
                }`}
              >
                <span className="text-[9px] font-mono px-1 rounded bg-slate-800 text-slate-300">
                  {isFirst ? 'NEXT 1' : `+${idx + 1}`}
                </span>
                <div className="flex items-center justify-center w-14 h-8">
                  <PieceIcon type={type} cell={isFirst ? 11 : 9} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 連擊狂熱連鎖計 (Combo Fever Meter) */}
      <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800 shadow-md backdrop-blur-sm space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Flame
              className={`w-4 h-4 ${
                feverTier === 'max'
                  ? 'text-rose-400 animate-bounce'
                  : feverTier === 'overdrive'
                    ? 'text-amber-400'
                    : 'text-cyan-400'
              }`}
            />
            <h3 className="text-xs font-semibold text-slate-200">連擊狂熱連鎖計</h3>
          </div>
          <span
            className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${
              feverTier === 'max'
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/60'
                : feverTier === 'overdrive'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/60'
                  : feverTier === 'ignited'
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/60'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            {feverLabel}
          </span>
        </div>

        <div className="relative h-2.5 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
          <div
            className={`h-full rounded-full transition-all duration-300 ${feverBarColor}`}
            style={{ width: `${Math.max(4, feverRatio * 100)}%` }}
          />
        </div>
      </div>

      {/* 競技表現遙測 (Combat Telemetry & Tetris Rate) */}
      <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800 shadow-md backdrop-blur-sm space-y-2.5">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
          <div className="flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-amber-400" />
            <h3 className="text-xs font-semibold text-slate-200">競技消行效率</h3>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">即時數據</span>
        </div>

        {/* 四行消率 Tetris Rate Gauge */}
        <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-800/80 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-slate-400 flex items-center gap-1">
              <span>四行消率 (Tetris Rate)</span>
            </div>
            <div className="text-lg font-mono font-bold text-amber-300">
              {tetrisRate}%
            </div>
          </div>
          <div className="w-16 bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-amber-400 h-full transition-all duration-300"
              style={{ width: `${tetrisRate}%` }}
            />
          </div>
        </div>

        {/* 速度 LPM & 落塊 PPS */}
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="bg-slate-950/60 p-2 rounded border border-slate-800/80">
            <div className="text-slate-400 flex items-center gap-1">
              <Gauge className="w-3 h-3 text-cyan-400" />
              <span>消行速度</span>
            </div>
            <div className="font-mono text-sm font-semibold text-slate-200 mt-0.5">
              {linesPerMinute}{' '}
              <span className="text-[10px] text-slate-400 font-normal">LPM</span>
            </div>
          </div>
          <div className="bg-slate-950/60 p-2 rounded border border-slate-800/80">
            <div className="text-slate-400 flex items-center gap-1">
              <Gauge className="w-3 h-3 text-emerald-400" />
              <span>手速落塊</span>
            </div>
            <div className="font-mono text-sm font-semibold text-slate-200 mt-0.5">
              {piecesPerSecond}{' '}
              <span className="text-[10px] text-slate-400 font-normal">PPS</span>
            </div>
          </div>
        </div>
      </div>

      {/* 經典大師錦囊 (Master Tactician Pocket Book) */}
      <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800 shadow-md backdrop-blur-sm">
        <button
          type="button"
          onClick={() => setTacticsOpen((prev) => !prev)}
          className="w-full flex items-center justify-between text-left text-xs font-semibold text-sky-200 hover:text-sky-100 touch-manipulation"
          aria-expanded={tacticsOpen}
        >
          <span className="flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-sky-400" />
            <span>大師戰術錦囊</span>
          </span>
          {tacticsOpen ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {tacticsOpen && (
          <div className="mt-2.5 space-y-2 border-t border-slate-800/80 pt-2 text-[11px]">
            <div className="flex gap-1 overflow-x-auto pb-1" role="tablist">
              {MASTER_TIPS.map((tip, idx) => (
                <button
                  key={tip.title}
                  type="button"
                  onClick={() => setSelectedTip(idx)}
                  className={`px-2 py-1 rounded text-[10px] whitespace-nowrap transition-colors ${
                    selectedTip === idx
                      ? 'bg-sky-500/20 text-sky-200 border border-sky-400/60 font-semibold'
                      : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
                  }`}
                  role="tab"
                  aria-selected={selectedTip === idx}
                >
                  {tip.tag}
                </button>
              ))}
            </div>

            <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800/80 space-y-1">
              <div className="font-semibold text-slate-100 flex items-center justify-between">
                <span>{MASTER_TIPS[selectedTip]?.title}</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/30">
                  {MASTER_TIPS[selectedTip]?.tag}
                </span>
              </div>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                {MASTER_TIPS[selectedTip]?.summary}
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
