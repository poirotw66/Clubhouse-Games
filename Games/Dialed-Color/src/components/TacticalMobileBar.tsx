import type { Color } from '../types';
import { colorToCss } from '../colors.mjs';
import { Sliders, Radio, Sparkles, Grid } from 'lucide-react';

export type MobileTab = 'cockpit' | 'radar' | 'starmap' | 'matrix';

interface TacticalMobileBarProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  currentColor: Color;
  hasMatrixMode?: boolean;
}

export function TacticalMobileBar({
  activeTab,
  onTabChange,
  currentColor,
  hasMatrixMode = true,
}: TacticalMobileBarProps) {
  return (
    <div className="lg:hidden w-full max-w-md mx-auto mb-4 bg-black/60 border border-white/10 rounded-2xl p-1.5 backdrop-blur-md flex items-center justify-between text-xs font-mono">
      {/* Tab Switchers */}
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => onTabChange('cockpit')}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl transition-all ${
            activeTab === 'cockpit'
              ? 'bg-white/15 text-white font-semibold shadow-sm'
              : 'text-white/60 hover:text-white'
          }`}
        >
          <Sliders size={13} />
          <span>調色艙</span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange('radar')}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl transition-all ${
            activeTab === 'radar'
              ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-400/30'
              : 'text-white/60 hover:text-white'
          }`}
        >
          <Radio size={13} />
          <span>雷達</span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange('starmap')}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl transition-all ${
            activeTab === 'starmap'
              ? 'bg-fuchsia-500/20 text-fuchsia-300 font-semibold border border-fuchsia-400/30'
              : 'text-white/60 hover:text-white'
          }`}
        >
          <Sparkles size={13} />
          <span>星圖</span>
        </button>

        {hasMatrixMode && (
          <button
            type="button"
            onClick={() => onTabChange('matrix')}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl transition-all ${
              activeTab === 'matrix'
                ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-400/30'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <Grid size={13} />
            <span>光矩陣</span>
          </button>
        )}
      </div>

      {/* Mini Color Telemetry Chip */}
      <div className="flex items-center gap-1.5 pr-2">
        <span
          className="w-3.5 h-3.5 rounded-full border border-white/30 shadow-sm shrink-0"
          style={{ backgroundColor: colorToCss(currentColor) }}
        />
        <span className="text-[10px] text-white/70 tabular-nums">
          H{currentColor.h}
        </span>
      </div>
    </div>
  );
}
