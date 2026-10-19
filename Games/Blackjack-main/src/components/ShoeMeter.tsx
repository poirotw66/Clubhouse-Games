import React from 'react';
import type { ShoeState } from '../utils/shoe';
import { cardsRemaining, dealtRatio } from '../utils/shoe';

interface ShoeMeterProps {
  shoe: ShoeState;
}

export const ShoeMeter: React.FC<ShoeMeterProps> = ({ shoe }) => {
  const dealt = Math.min(1, Math.max(0, dealtRatio(shoe)));
  const remaining = cardsRemaining(shoe);
  const cutPct = Math.round((1 - shoe.cutAt / Math.max(shoe.capacity, 1)) * 100);

  return (
    <div
      className="w-full max-w-[9rem] text-left"
      title={`牌靴 ${shoe.deckCount} 副｜切牌約 ${cutPct}%｜剩餘 ${remaining}`}
    >
      <div className="flex justify-between text-[9px] sm:text-[10px] text-white/45 font-bold tracking-wider mb-0.5">
        <span>牌靴</span>
        <span>
          {remaining}/{shoe.capacity}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-black/50 border border-white/10 overflow-hidden relative">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 to-amber-400 transition-[width] duration-300"
          style={{ width: `${dealt * 100}%` }}
        />
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-rose-400/90"
          style={{ left: `${cutPct}%` }}
          aria-hidden
        />
      </div>
      <div className="text-[9px] text-white/40 mt-0.5">
        {shoe.needsReshuffle ? '下局洗牌' : `穿透 ${Math.round(shoe.penetration * 100)}%`}
      </div>
    </div>
  );
};
