import React, { useEffect, useState } from 'react';

interface KeyboardHudProps {
  isVersus?: boolean;
  className?: string;
}

export const KeyboardHud: React.FC<KeyboardHudProps> = ({
  isVersus = false,
  className = '',
}) => {
  const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      setActiveKeys((prev) => {
        const next = new Set(prev);
        next.add(e.code);
        return next;
      });
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      setActiveKeys((prev) => {
        const next = new Set(prev);
        next.delete(e.code);
        return next;
      });
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const isLeftActive = activeKeys.has('KeyA') || activeKeys.has('ArrowLeft');
  const isRightActive = activeKeys.has('KeyD') || activeKeys.has('ArrowRight');
  const isQuickActive = activeKeys.has('Space') || activeKeys.has('KeyJ');
  const isRematchActive = activeKeys.has('KeyR');

  if (isVersus) {
    return (
      <div
        className={`flex items-center justify-center gap-3 px-3 py-1.5 rounded-full bg-slate-950/70 border border-slate-800 text-[11px] font-display backdrop-blur pointer-events-none select-none ${className}`}
      >
        <span className="flex items-center gap-1.5">
          <kbd
            className={`px-1.5 py-0.5 rounded border text-[10px] font-mono transition-colors ${
              activeKeys.has('KeyA') || activeKeys.has('KeyS')
                ? 'bg-cyan-400 text-slate-950 border-cyan-300 font-bold'
                : 'bg-slate-900 text-cyan-300 border-cyan-500/40'
            }`}
          >
            A
          </kbd>
          <span className="text-cyan-300 font-bold">P1 出刀</span>
        </span>
        <span className="text-slate-600">|</span>
        <span className="flex items-center gap-1.5">
          <kbd
            className={`px-1.5 py-0.5 rounded border text-[10px] font-mono transition-colors ${
              activeKeys.has('KeyL') || activeKeys.has('ArrowRight')
                ? 'bg-amber-400 text-slate-950 border-amber-300 font-bold'
                : 'bg-slate-900 text-amber-300 border-amber-500/40'
            }`}
          >
            L
          </kbd>
          <span className="text-amber-300 font-bold">P2 出刀</span>
        </span>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-2 md:gap-3 px-3 py-1.5 rounded-xl md:rounded-full bg-slate-950/75 border border-slate-800 text-[11px] font-display backdrop-blur pointer-events-none select-none shadow-lg ${className}`}
    >
      <span className="flex items-center gap-1">
        <kbd
          className={`px-1.5 py-0.5 rounded border text-[10px] font-mono transition-all ${
            isLeftActive
              ? 'bg-cyan-400 text-slate-950 border-cyan-300 font-bold shadow-[0_0_8px_#22d3ee]'
              : 'bg-slate-900 text-cyan-300 border-cyan-500/40'
          }`}
        >
          A / ←
        </kbd>
        <span className="text-cyan-300 font-semibold">左斬</span>
      </span>

      <span className="text-slate-700 hidden sm:inline">•</span>

      <span className="flex items-center gap-1">
        <kbd
          className={`px-1.5 py-0.5 rounded border text-[10px] font-mono transition-all ${
            isRightActive
              ? 'bg-amber-400 text-slate-950 border-amber-300 font-bold shadow-[0_0_8px_#fbbf24]'
              : 'bg-slate-900 text-amber-300 border-amber-500/40'
          }`}
        >
          D / →
        </kbd>
        <span className="text-amber-300 font-semibold">右斬</span>
      </span>

      <span className="text-slate-700 hidden sm:inline">•</span>

      <span className="flex items-center gap-1">
        <kbd
          className={`px-1.5 py-0.5 rounded border text-[10px] font-mono transition-all ${
            isQuickActive
              ? 'bg-emerald-400 text-slate-950 border-emerald-300 font-bold shadow-[0_0_8px_#34d399]'
              : 'bg-slate-900 text-emerald-300 border-emerald-500/40'
          }`}
        >
          Space / J
        </kbd>
        <span className="text-emerald-300 font-semibold">快速拔刀</span>
      </span>

      <span className="text-slate-700 hidden sm:inline">•</span>

      <span className="flex items-center gap-1">
        <kbd
          className={`px-1.5 py-0.5 rounded border text-[10px] font-mono transition-all ${
            isRematchActive
              ? 'bg-rose-400 text-slate-950 border-rose-300 font-bold'
              : 'bg-slate-900 text-slate-400 border-slate-700'
          }`}
        >
          R
        </kbd>
        <span className="text-slate-400">再戰</span>
      </span>
    </div>
  );
};
