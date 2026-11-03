import React from 'react';
import { Shield, Sparkles, Swords, Zap } from 'lucide-react';

interface EsportsKeypadHudProps {
  activeKeys: Set<string>;
}

interface KeycapProps {
  code: string;
  label: string;
  sublabel: string;
  isPressed: boolean;
  accent?: 'blue' | 'rose' | 'amber' | 'cyan' | 'purple';
}

const Keycap: React.FC<KeycapProps> = ({
  code,
  label,
  sublabel,
  isPressed,
  accent = 'cyan',
}) => {
  const getAccentClass = () => {
    if (isPressed) {
      switch (accent) {
        case 'rose':
          return 'bg-rose-500 text-white border-rose-300 shadow-[0_0_16px_rgba(244,63,94,0.8)] translate-y-0.5 scale-95';
        case 'amber':
          return 'bg-amber-400 text-black border-amber-200 shadow-[0_0_16px_rgba(251,191,36,0.8)] translate-y-0.5 scale-95';
        case 'purple':
          return 'bg-fuchsia-500 text-white border-fuchsia-200 shadow-[0_0_16px_rgba(217,70,239,0.8)] translate-y-0.5 scale-95';
        case 'blue':
          return 'bg-blue-500 text-white border-blue-200 shadow-[0_0_16px_rgba(59,130,246,0.8)] translate-y-0.5 scale-95';
        case 'cyan':
        default:
          return 'bg-cyan-500 text-black border-cyan-200 shadow-[0_0_16px_rgba(6,182,212,0.8)] translate-y-0.5 scale-95';
      }
    }

    switch (accent) {
      case 'rose':
        return 'bg-neutral-900 border-rose-500/30 text-rose-300 hover:border-rose-400/60 shadow-[0_3px_0_rgba(159,18,57,0.8)]';
      case 'amber':
        return 'bg-neutral-900 border-amber-500/30 text-amber-300 hover:border-amber-400/60 shadow-[0_3px_0_rgba(180,83,9,0.8)]';
      case 'purple':
        return 'bg-neutral-900 border-fuchsia-500/30 text-fuchsia-300 hover:border-fuchsia-400/60 shadow-[0_3px_0_rgba(162,28,175,0.8)]';
      case 'blue':
        return 'bg-neutral-900 border-blue-500/30 text-blue-300 hover:border-blue-400/60 shadow-[0_3px_0_rgba(29,78,216,0.8)]';
      case 'cyan':
      default:
        return 'bg-neutral-900 border-neutral-700 text-neutral-200 hover:border-neutral-500 shadow-[0_3px_0_rgba(23,23,23,0.9)]';
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div
        className={`flex h-11 min-w-11 items-center justify-center rounded-xl border px-2.5 font-mono text-sm font-black transition-all duration-75 select-none ${getAccentClass()}`}
        aria-label={`${label} - ${sublabel}`}
      >
        {label}
      </div>
      <span className="mt-1 text-[10px] font-medium text-neutral-400">{sublabel}</span>
    </div>
  );
};

export const EsportsKeypadHud: React.FC<EsportsKeypadHudProps> = ({ activeKeys }) => {
  const isA = activeKeys.has('KeyA') || activeKeys.has('ArrowLeft');
  const isD = activeKeys.has('KeyD') || activeKeys.has('ArrowRight');
  const isW = activeKeys.has('KeyW') || activeKeys.has('ArrowUp');
  const isS = activeKeys.has('KeyS');
  const isLow = activeKeys.has('ArrowDown') || activeKeys.has('KeyC') || activeKeys.has('ShiftLeft') || activeKeys.has('ShiftRight');
  const isJ = activeKeys.has('KeyJ');
  const isK = activeKeys.has('KeyK');
  const isI = activeKeys.has('KeyI');
  const isL = activeKeys.has('KeyL');

  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-950/80 p-4 shadow-2xl backdrop-blur-md">
      <div className="flex flex-col sm:flex-row items-center justify-between border-b border-white/10 pb-3 gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-black uppercase tracking-widest text-cyan-300">
            電競級雙手實體操控 HUD (Esports Cockpit Keypad)
          </h3>
        </div>
        <div className="text-[11px] text-neutral-400 flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            左手步法防禦
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            右手重砲打擊
          </span>
          <span className="hidden md:inline text-neutral-500">| 即時鍵位回饋發光</span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
        {/* Left Hand Cluster */}
        <div className="rounded-xl border border-blue-500/20 bg-blue-950/15 p-3">
          <div className="flex items-center justify-between mb-3">
            <span className="flex items-center gap-1.5 text-xs font-bold text-blue-300">
              <Shield className="w-3.5 h-3.5" />
              左手：步法走位與抱架防禦
            </span>
            <span className="text-[10px] text-blue-400/80 font-mono">LEFT HAND</span>
          </div>
          <div className="flex items-center justify-center gap-3">
            <Keycap code="KeyA" label="A" sublabel="左閃步" isPressed={isA} accent="blue" />
            <Keycap code="KeyD" label="D" sublabel="右壓迫" isPressed={isD} accent="blue" />
            <Keycap code="KeyS" label="S" sublabel="抱架格擋" isPressed={isS} accent="blue" />
            <Keycap code="KeyW" label="W" sublabel="俯身閃避" isPressed={isW} accent="cyan" />
            <Keycap code="ArrowDown" label="↓ / C" sublabel="下段沉身" isPressed={isLow} accent="amber" />
          </div>
        </div>

        {/* Right Hand Cluster */}
        <div className="rounded-xl border border-amber-500/20 bg-amber-950/15 p-3">
          <div className="flex items-center justify-between mb-3">
            <span className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
              <Swords className="w-3.5 h-3.5" />
              右手：打擊重砲與破招
            </span>
            <span className="text-[10px] text-amber-400/80 font-mono">RIGHT HAND</span>
          </div>
          <div className="flex items-center justify-center gap-3">
            <Keycap code="KeyJ" label="J" sublabel="刺拳(速)" isPressed={isJ} accent="cyan" />
            <Keycap code="KeyK" label="K" sublabel="勾拳(重)" isPressed={isK} accent="rose" />
            <Keycap code="KeyI" label="I" sublabel="撥招反制" isPressed={isI} accent="blue" />
            <Keycap code="KeyL" label="L" sublabel="招牌必殺" isPressed={isL} accent="purple" />
          </div>
        </div>
      </div>
    </div>
  );
};
