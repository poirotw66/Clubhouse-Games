import { useState, type ReactElement } from 'react';
import { getWaveThreatSummary, type WaveThreatSummary } from '../game/waves';

interface WaveThreatRadarProps {
  currentWave: number;
  totalWaves: number | null;
  phase: 'prep' | 'wave' | 'won' | 'lost';
  onOpenCodex: () => void;
  onOpenHotkeys: () => void;
}

export function WaveThreatRadar({
  currentWave,
  totalWaves,
  phase,
  onOpenCodex,
  onOpenHotkeys,
}: WaveThreatRadarProps): ReactElement {
  const [collapsed, setCollapsed] = useState(false);

  // Target wave to preview: next wave during prep, or current wave during combat
  const targetWave = phase === 'prep' ? currentWave + 1 : Math.max(1, currentWave);
  const summary: WaveThreatSummary = getWaveThreatSummary(targetWave);

  return (
    <div className="w-full max-w-3xl mb-2 rounded-xl border border-amber-900/50 bg-[#1c1409]/90 text-xs shadow-lg backdrop-blur-sm overflow-hidden">
      {/* Header bar */}
      <div className="px-3 py-2 flex items-center justify-between gap-2 border-b border-amber-900/40 bg-black/30">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-amber-400 font-bold text-sm">📡</span>
          <span className="font-bold text-amber-100 truncate">
            {phase === 'prep' ? `第 ${targetWave} 波戰情預警` : `第 ${targetWave} 波作戰雷達`}
            {totalWaves ? ` / ${totalWaves} 波` : ''}
          </span>
          <span className="text-[11px] font-mono text-amber-300/80 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/40">
            共 {summary.totalEnemies} 敵機
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onOpenCodex}
            className="px-2 py-1 rounded-lg bg-amber-900/40 hover:bg-amber-800/50 border border-amber-700/40 text-amber-200 text-[11px] font-medium transition-colors touch-manipulation flex items-center gap-1"
            title="開啟敵軍機關圖鑑"
          >
            <span>📖</span>
            <span className="hidden sm:inline">圖鑑</span>
          </button>
          <button
            type="button"
            onClick={onOpenHotkeys}
            className="px-2 py-1 rounded-lg bg-amber-900/40 hover:bg-amber-800/50 border border-amber-700/40 text-amber-200 text-[11px] font-medium transition-colors touch-manipulation flex items-center gap-1"
            title="查看完整快捷鍵小抄"
          >
            <span>⌨️</span>
            <span className="hidden sm:inline">熱鍵</span>
          </button>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="p-1 rounded text-amber-200/70 hover:text-amber-100 hover:bg-white/10 transition-colors"
            aria-label={collapsed ? '展開雷達' : '收合雷達'}
          >
            {collapsed ? '▼' : '▲'}
          </button>
        </div>
      </div>

      {/* Body contents */}
      {!collapsed && (
        <div className="p-2.5 flex flex-col gap-2">
          {/* Enemy composition row */}
          <div className="flex flex-wrap items-center gap-1.5">
            {summary.entries.map((entry) => (
              <div
                key={entry.type}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-medium ${
                  entry.flying
                    ? 'border-sky-500/40 bg-sky-950/40 text-sky-200'
                    : entry.armor >= 4
                      ? 'border-amber-500/40 bg-amber-950/40 text-amber-200'
                      : entry.type === 'boss'
                        ? 'border-rose-500/60 bg-rose-950/50 text-rose-200 font-bold'
                        : 'border-amber-900/40 bg-black/25 text-amber-100/90'
                }`}
                title={`${entry.name}：生命 ${entry.hp}、護甲 ${entry.armor}、移速 ${entry.speed}${entry.flying ? '、飛行' : ''}`}
              >
                <img
                  src={`${import.meta.env.BASE_URL}enemies/${entry.type}.jpg`}
                  alt=""
                  className="w-4 h-4 rounded object-cover border border-amber-900/40"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <span>{entry.name}</span>
                <span className="font-mono text-amber-400 font-bold">×{entry.count}</span>
                {entry.flying && <span title="飛行單位，無視地面迷宮">🚀</span>}
                {entry.armor > 0 && <span title={`護甲值 ${entry.armor}，平減傷害`}>🛡️{entry.armor}</span>}
              </div>
            ))}
          </div>

          {/* Tactical Advisory Banner */}
          <div
            className={`py-1.5 px-2.5 rounded-lg border text-[11px] leading-relaxed flex items-center gap-2 ${
              summary.isBoss
                ? 'border-rose-500/50 bg-rose-950/35 text-rose-200 font-semibold'
                : summary.hasFlyers
                  ? 'border-sky-500/40 bg-sky-950/30 text-sky-100'
                  : summary.hasHeavyArmor
                    ? 'border-amber-500/40 bg-amber-950/30 text-amber-200'
                    : 'border-amber-900/30 bg-black/20 text-amber-200/80'
            }`}
          >
            <span>{summary.tacticalTip}</span>
          </div>
        </div>
      )}
    </div>
  );
}
