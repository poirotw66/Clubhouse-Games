import { useEffect, useState } from 'react';
import { Crosshair, ShieldAlert, Sparkles, Zap } from 'lucide-react';
import type { Dir } from '../game/types';

interface KeyboardHudProps {
  currentDir: Dir;
  energy: number;
  maxEnergy: number;
  dashReady: boolean;
  pulseReady: boolean;
  onDash: () => void;
  onPulse: () => void;
}

export function KeyboardHud({
  currentDir,
  energy,
  maxEnergy,
  dashReady,
  pulseReady,
  onDash,
  onPulse,
}: KeyboardHudProps) {
  const [pressedKey, setPressedKey] = useState<string | null>(null);

  useEffect(() => {
    const handleDown = (e: KeyboardEvent) => {
      setPressedKey(e.key.toLowerCase());
    };
    const handleUp = () => {
      setPressedKey(null);
    };
    window.addEventListener('keydown', handleDown);
    window.addEventListener('keyup', handleUp);
    return () => {
      window.removeEventListener('keydown', handleDown);
      window.removeEventListener('keyup', handleUp);
    };
  }, []);

  const isUp = currentDir === 'up' || pressedKey === 'w' || pressedKey === 'arrowup';
  const isDown = currentDir === 'down' || pressedKey === 's' || pressedKey === 'arrowdown';
  const isLeft = currentDir === 'left' || pressedKey === 'a' || pressedKey === 'arrowleft';
  const isRight = currentDir === 'right' || pressedKey === 'd' || pressedKey === 'arrowright';

  return (
    <div className="w-full max-w-xl mx-auto mt-2 rounded-2xl border border-slate-800/90 bg-gradient-to-b from-slate-900/90 to-slate-950/90 p-3 shadow-xl backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Direction Indicator cluster */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono tracking-wider text-slate-400 uppercase">走位軸</span>
          <div className="grid grid-cols-3 gap-1">
            <div />
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-lg border font-mono font-bold transition-all ${
                isUp
                  ? 'border-emerald-400/80 bg-emerald-500/20 text-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.4)]'
                  : 'border-slate-800 bg-slate-950 text-slate-500'
              }`}
            >
              W
            </div>
            <div />
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-lg border font-mono font-bold transition-all ${
                isLeft
                  ? 'border-emerald-400/80 bg-emerald-500/20 text-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.4)]'
                  : 'border-slate-800 bg-slate-950 text-slate-500'
              }`}
            >
              A
            </div>
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-lg border font-mono font-bold transition-all ${
                isDown
                  ? 'border-emerald-400/80 bg-emerald-500/20 text-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.4)]'
                  : 'border-slate-800 bg-slate-950 text-slate-500'
              }`}
            >
              S
            </div>
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-lg border font-mono font-bold transition-all ${
                isRight
                  ? 'border-emerald-400/80 bg-emerald-500/20 text-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.4)]'
                  : 'border-slate-800 bg-slate-950 text-slate-500'
              }`}
            >
              D
            </div>
          </div>
        </div>

        {/* Action Keys */}
        <div className="flex flex-1 items-center justify-end gap-2 min-w-[240px]">
          {/* Space Dash Button */}
          <button
            type="button"
            onClick={onDash}
            className={`group relative flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-left font-mono transition-all ${
              dashReady
                ? 'border-cyan-500/70 bg-cyan-950/40 text-cyan-200 hover:bg-cyan-900/50 hover:shadow-[0_0_16px_rgba(6,182,212,0.35)]'
                : 'border-slate-800 bg-slate-950 text-slate-600 cursor-not-allowed opacity-60'
            }`}
          >
            <Zap className={`h-4 w-4 ${dashReady ? 'text-cyan-400 animate-pulse' : 'text-slate-600'}`} />
            <div>
              <div className="flex items-center gap-1 text-[11px] font-bold text-slate-300 group-hover:text-cyan-100">
                <kbd className="rounded border border-cyan-700/60 bg-cyan-950/80 px-1 py-0.5 text-[10px] text-cyan-300">
                  Space
                </kbd>
                <span>衝刺</span>
              </div>
              <span className="text-[10px] text-slate-400">消耗 30 · 輾殺</span>
            </div>
          </button>

          {/* E Venom Pulse Button */}
          <button
            type="button"
            onClick={onPulse}
            className={`group relative flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-left font-mono transition-all ${
              pulseReady
                ? 'border-emerald-500/80 bg-emerald-950/50 text-emerald-200 hover:bg-emerald-900/60 hover:shadow-[0_0_16px_rgba(16,185,129,0.35)]'
                : 'border-slate-800 bg-slate-950 text-slate-600 cursor-not-allowed opacity-60'
            }`}
          >
            <Sparkles className={`h-4 w-4 ${pulseReady ? 'text-emerald-400 animate-pulse' : 'text-slate-600'}`} />
            <div>
              <div className="flex items-center gap-1 text-[11px] font-bold text-slate-300 group-hover:text-emerald-100">
                <kbd className="rounded border border-emerald-700/60 bg-emerald-950/80 px-1 py-0.5 text-[10px] text-emerald-300">
                  E
                </kbd>
                <span>猛毒脈衝</span>
              </div>
              <span className="text-[10px] text-slate-400">消耗 40 · 震波</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
