import React from 'react';
import { Keyboard, HelpCircle } from 'lucide-react';

interface Props {
  className?: string;
  isKoiKoiPhase?: boolean;
}

export const KeyboardHud: React.FC<Props> = ({ className = '', isKoiKoiPhase = false }) => {
  return (
    <div
      className={`flex items-center flex-wrap gap-2 text-[11px] text-cream/70 select-none ${className}`}
      aria-label="鍵盤快捷鍵指南"
    >
      <div className="flex items-center gap-1 text-gold/80 font-semibold mr-1">
        <Keyboard size={13} />
        <span>鍵盤快捷：</span>
      </div>

      {isKoiKoiPhase ? (
        <>
          <span className="inline-flex items-center gap-1 bg-black/30 border border-gold/30 rounded px-1.5 py-0.5">
            <kbd className="px-1 py-0.5 bg-vermillion/40 border border-vermillion rounded text-[10px] text-cream font-mono">
              K
            </kbd>
            <span>喊 Koi-Koi</span>
          </span>
          <span className="inline-flex items-center gap-1 bg-black/30 border border-gold/30 rounded px-1.5 py-0.5">
            <kbd className="px-1 py-0.5 bg-gold/40 border border-gold rounded text-[10px] text-cream font-mono">
              S
            </kbd>
            <span>勝負結算</span>
          </span>
          <span className="inline-flex items-center gap-1 bg-black/30 border border-gold/20 rounded px-1.5 py-0.5">
            <kbd className="px-1 py-0.5 bg-white/10 border border-white/20 rounded text-[10px] text-cream font-mono">
              U
            </kbd>
            <span>悔棋</span>
          </span>
        </>
      ) : (
        <>
          <span className="inline-flex items-center gap-1 bg-black/30 border border-gold/20 rounded px-1.5 py-0.5">
            <kbd className="px-1 py-0.5 bg-white/10 border border-white/20 rounded text-[10px] text-cream font-mono">
              A
            </kbd>
            <kbd className="px-1 py-0.5 bg-white/10 border border-white/20 rounded text-[10px] text-cream font-mono">
              D
            </kbd>
            <span>或 ← → 選牌</span>
          </span>
          <span className="inline-flex items-center gap-1 bg-black/30 border border-gold/20 rounded px-1.5 py-0.5">
            <kbd className="px-1 py-0.5 bg-white/10 border border-white/20 rounded text-[10px] text-cream font-mono">
              1-8
            </kbd>
            <span>數字選牌</span>
          </span>
          <span className="inline-flex items-center gap-1 bg-black/30 border border-gold/30 rounded px-1.5 py-0.5">
            <kbd className="px-1.5 py-0.5 bg-gold/20 border border-gold/50 rounded text-[10px] text-gold font-mono font-bold">
              Space
            </kbd>
            <span>出牌</span>
          </span>
          <span className="inline-flex items-center gap-1 bg-black/30 border border-gold/20 rounded px-1.5 py-0.5">
            <kbd className="px-1 py-0.5 bg-white/10 border border-white/20 rounded text-[10px] text-cream font-mono">
              H
            </kbd>
            <span>提示</span>
          </span>
          <span className="inline-flex items-center gap-1 bg-black/30 border border-gold/20 rounded px-1.5 py-0.5">
            <kbd className="px-1 py-0.5 bg-white/10 border border-white/20 rounded text-[10px] text-cream font-mono">
              U
            </kbd>
            <span>悔棋</span>
          </span>
        </>
      )}
    </div>
  );
};
