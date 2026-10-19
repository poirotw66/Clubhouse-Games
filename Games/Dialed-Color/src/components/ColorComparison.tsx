import { useState } from 'react';
import { colorToCss } from '../colors.mjs';
import type { Color } from '../types';

export function ColorComparison({
  target,
  guess,
  colorBlind,
}: {
  target: Color;
  guess: Color;
  colorBlind?: boolean;
}) {
  const [sliderPos, setSliderPos] = useState(50);

  return (
    <div className="relative aspect-square rounded-xl overflow-hidden border border-[var(--color-line)] group cursor-ew-resize touch-manipulation">
      <div className="absolute inset-0" style={{ backgroundColor: colorToCss(target) }} />
      <div
        className="absolute inset-0 z-10 border-r border-white/50"
        style={{ backgroundColor: colorToCss(guess), width: `${sliderPos}%` }}
      />
      <div
        className="absolute inset-y-0 w-0.5 bg-white/90 z-20 pointer-events-none"
        style={{ left: `${sliderPos}%` }}
      />
      <input
        type="range"
        min="0"
        max="100"
        value={sliderPos}
        onChange={(e) => setSliderPos(parseInt(e.target.value, 10))}
        className="absolute inset-0 opacity-0 cursor-ew-resize z-30"
        aria-label="比較猜測與目標"
      />
      <div className="absolute bottom-2 left-2 right-2 flex justify-between text-[10px] font-medium tracking-wide pointer-events-none z-20">
        <span className="px-1.5 py-0.5 rounded bg-black/45">
          猜測{colorBlind ? ` H${guess.h}` : ''}
        </span>
        <span className="px-1.5 py-0.5 rounded bg-black/45">
          目標{colorBlind ? ` H${target.h}` : ''}
        </span>
      </div>
    </div>
  );
}
