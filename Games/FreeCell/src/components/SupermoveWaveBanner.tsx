import React, { useEffect, useState } from 'react';
import { Layers, Sparkles, Wind } from 'lucide-react';
import type { WorkshopTheme } from '../utils/theme.ts';

interface SupermoveWaveBannerProps {
  waveCount: number;
  theme: WorkshopTheme;
  onDismiss: () => void;
}

export const SupermoveWaveBanner: React.FC<SupermoveWaveBannerProps> = ({
  waveCount,
  theme,
  onDismiss,
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 300);
    }, 1500);

    return () => clearTimeout(timer);
  }, [waveCount, onDismiss]);

  const themeGlow = {
    'royal-velvet': 'border-amber-400/50 bg-emerald-950/90 text-amber-200 shadow-[0_0_25px_rgba(212,175,55,0.35)]',
    'obsidian-gold': 'border-amber-400/60 bg-neutral-950/95 text-amber-300 shadow-[0_0_30px_rgba(245,158,11,0.45)]',
    'cyber-neon': 'border-cyan-400/60 bg-slate-950/90 text-cyan-200 shadow-[0_0_30px_rgba(6,182,212,0.5)]',
  }[theme];

  return (
    <div
      className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all duration-300 transform ${
        visible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-90 -translate-y-4'
      }`}
    >
      <div
        className={`px-5 py-2.5 rounded-full border backdrop-blur-md flex items-center gap-3 font-mono ${themeGlow}`}
      >
        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-white/10 animate-spin-slow">
          <Wind className="w-4 h-4" />
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm tracking-wide">連鎖巨浪</span>
            <span className="px-2 py-0.5 rounded-md text-xs font-black bg-white/20">
              ×{waveCount}
            </span>
          </div>
          <span className="text-[10px] opacity-80">3D 動態阻尼波浪調度</span>
        </div>
        <Sparkles className="w-4 h-4 text-amber-300 animate-pulse ml-1" />
      </div>
    </div>
  );
};
