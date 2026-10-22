import React from 'react';
import { BottleData, type BottleSkinId, type LiquidSkinId } from '../types';

interface BottleProps {
  bottle: BottleData;
  isSelected: boolean;
  isValidTarget?: boolean;
  /** True when this target would trigger a colour mix (distinct from merge). */
  isMixTarget?: boolean;
  /** Brief mix-reaction flash after a mixing pour lands here. */
  isMixingFlash?: boolean;
  /** Next-step hint highlight (source or target). */
  isHinted?: boolean;
  isFlying?: boolean;
  /** Source bottle mid-pour: tilts toward target. */
  isPouringSource?: boolean;
  /** Target bottle receiving a stream. */
  isPouringTarget?: boolean;
  /** Tilt direction for the pouring source. */
  pourTilt?: 'left' | 'right' | null;
  /** Brief seal celebration when a bottle just completed. */
  isCelebrating?: boolean;
  /** Skip transform animations (prefers-reduced-motion). */
  reduceMotion?: boolean;
  bottleSkin?: BottleSkinId;
  liquidSkin?: LiquidSkinId;
  onClick: () => void;
}

function frameClass(skin: BottleSkinId | undefined, isValidTarget: boolean, isMixTarget: boolean): string {
  const border = isValidTarget && isMixTarget
    ? 'border-amber-400/60'
    : isValidTarget
      ? 'border-emerald-400/50'
      : 'border-white/20';
  switch (skin) {
    case 'amber':
      return `${border} bg-amber-900/25`;
    case 'frost':
      return `${border} bg-white/15`;
    case 'obsidian':
      return `${border} bg-black/40`;
    default:
      return `${border} bg-white/5`;
  }
}

function liquidBackground(color: string, skin: LiquidSkinId | undefined): string {
  if (skin === 'prism') {
    return `linear-gradient(115deg, ${color} 0%, ${color}ee 35%, #ffffff55 48%, ${color}ee 62%, ${color} 100%)`;
  }
  if (skin === 'shimmer') {
    return `linear-gradient(90deg, ${color} 0%, ${color}dd 20%, ${color} 50%, ${color}dd 80%, ${color} 100%)`;
  }
  return `linear-gradient(90deg, ${color} 0%, ${color}dd 20%, ${color} 50%, ${color}dd 80%, ${color} 100%)`;
}

export const Bottle: React.FC<BottleProps> = ({
  bottle,
  isSelected,
  isValidTarget = false,
  isMixTarget = false,
  isMixingFlash = false,
  isHinted = false,
  isFlying = false,
  isPouringSource = false,
  isPouringTarget = false,
  pourTilt = null,
  isCelebrating = false,
  reduceMotion = false,
  bottleSkin = 'classic',
  liquidSkin = 'plain',
  onClick,
}) => {
  const layerHeight = 100 / bottle.capacity;
  const isCapped = bottle.isCompleted;
  const isBlocked = Boolean(bottle.isBlocked);

  const tiltTransform = (() => {
    if (reduceMotion || !isPouringSource || !pourTilt) return undefined;
    return pourTilt === 'left'
      ? 'rotate(-28deg) translateY(-8px)'
      : 'rotate(28deg) translateY(-8px)';
  })();

  return (
    <div
      onClick={isCapped || isBlocked ? undefined : onClick}
      className={`
        relative flex flex-col items-center justify-end touch-target
        ${reduceMotion ? '' : 'transition-all duration-300 ease-in-out'} touch-active
        ${isFlying ? 'z-50 pointer-events-none' : ''}
        ${isCapped && !isFlying ? 'cursor-not-allowed opacity-90' : isBlocked ? 'cursor-not-allowed' : 'cursor-pointer'}
        ${isSelected && !isCapped && !isFlying && !isBlocked ? '-translate-y-4 md:-translate-y-6 scale-105 drop-shadow-[0_20px_20px_rgba(0,0,0,0.5)]' : ''}
        ${isValidTarget && !isSelected && isMixTarget ? 'ring-2 md:ring-4 ring-amber-400/70 ring-offset-2 md:ring-offset-4 ring-offset-[#1a1a2e] scale-[1.02]' : ''}
        ${isValidTarget && !isSelected && !isMixTarget ? 'ring-2 md:ring-4 ring-emerald-400/60 ring-offset-2 md:ring-offset-4 ring-offset-[#1a1a2e] scale-[1.02]' : ''}
        ${isHinted && !isSelected ? 'ring-2 md:ring-4 ring-sky-400/80 ring-offset-2 md:ring-offset-4 ring-offset-[#1a1a2e]' : ''}
        ${isMixingFlash && !reduceMotion ? 'animate-mix-flash' : ''}
        ${isCelebrating && !reduceMotion ? 'animate-bottle-celebrate' : ''}
        ${!isSelected && !isCapped && !isFlying && !isValidTarget && !isBlocked ? 'active:scale-95 active:-translate-y-1' : ''}
        ${isPouringSource ? 'z-40' : ''}
      `}
      style={{
        width: '72px',
        height: '200px',
        minWidth: '72px',
        minHeight: '200px',
        transform: isFlying
          ? 'translateY(-60vh) scale(0.3)'
          : tiltTransform,
        opacity: isFlying ? 0 : isBlocked ? 0.72 : 1,
        transition: reduceMotion ? undefined : 'transform 0.35s ease, opacity 0.35s ease',
      }}
      aria-disabled={isBlocked || isCapped}
    >
      {isSelected && !isCapped && !isFlying && !isBlocked && (
        <div className={`absolute -top-12 flex flex-col items-center z-50 ${reduceMotion ? '' : 'animate-bounce'}`}>
          <div className="w-4 h-4 bg-yellow-400 rounded-full shadow-[0_0_10px_#facc15]"></div>
          <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[10px] border-t-yellow-400 mt-1"></div>
        </div>
      )}

      {isValidTarget && (
        <div className={`absolute -top-10 flex flex-col items-center z-50 opacity-80 ${reduceMotion ? '' : 'animate-bounce'}`}>
           <div className={`w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[10px] ${isMixTarget ? 'border-t-amber-400' : 'border-t-emerald-400'}`}></div>
        </div>
      )}
      {isMixingFlash && !reduceMotion && (
        <div className="absolute inset-0 z-30 pointer-events-none mix-spark" aria-hidden />
      )}
      {isCelebrating && !reduceMotion && (
        <div className="absolute inset-0 z-30 pointer-events-none bottle-celebrate-burst" aria-hidden />
      )}

      {/* Pour stream into target */}
      {isPouringTarget && !reduceMotion && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-40 pointer-events-none" aria-hidden>
          <div className="pour-stream" />
        </div>
      )}

      {isBlocked && (
        <div className="absolute -top-6 z-40 w-full flex justify-center" aria-hidden>
          <div className="px-2 py-0.5 rounded-md bg-slate-800/90 border border-white/20 text-[10px] font-black text-amber-200 tracking-wider shadow-lg">
            封鎖
          </div>
        </div>
      )}

      {isCapped && (
        <div className={`absolute -top-5 z-40 w-full flex justify-center ${reduceMotion ? '' : 'animate-drop-in'}`}>
           <div className="w-14 h-8 bg-gradient-to-r from-[#5c4a35] via-[#796248] to-[#5c4a35] rounded-t-sm rounded-b-lg shadow-xl border-t border-white/20 flex items-center justify-center relative">
              <div className="absolute top-2 w-10 h-[1px] bg-black/20"></div>
              <div className="absolute bottom-2 w-8 h-[1px] bg-white/10"></div>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#d4c5a9] drop-shadow-md" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
           </div>
        </div>
      )}

      <div
        className={`
          relative w-full h-full overflow-hidden flex flex-col-reverse shadow-2xl backdrop-blur-sm z-10
          rounded-b-[2.5rem] rounded-t-lg border-[3px]
          ${reduceMotion ? '' : 'transition-colors duration-300'}
          ${frameClass(bottleSkin, isValidTarget, isMixTarget)}
        `}
      >
        {bottle.layers.map((layer) => (
          <div
            key={layer.id}
            className={`w-full relative border-b border-black/5 ${reduceMotion ? '' : 'transition-all duration-500 ease-in-out'} ${liquidSkin === 'shimmer' && !layer.isHidden && !reduceMotion ? 'liquid-shimmer' : ''}`}
            style={{
              height: `${layerHeight}%`,
              background: layer.isHidden
                ? '#374151'
                : liquidBackground(layer.color, liquidSkin),
            }}
          >
            {!layer.isHidden && (
              <div className="absolute top-0 w-full h-[3px] bg-white/40 blur-[1px]"></div>
            )}

            {!layer.isHidden && (
                <div className="absolute inset-0 opacity-20 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8Y2lyY2xlIGN4PSIyIiBjeT0iMiIgcj0iMSIgZmlsbD0id2hpdGUiIC8+Cjwvc3ZnPg==')]"></div>
            )}

            {layer.isHidden && (
              <div className="w-full h-full relative overflow-hidden bg-gray-700">
                <div className="absolute inset-0 opacity-10"
                     style={{backgroundImage: 'repeating-linear-gradient(45deg, #000 0, #000 10px, transparent 10px, transparent 20px)'}}>
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-gray-400 font-bold text-2xl opacity-40 select-none font-mono">?</span>
                </div>
              </div>
            )}
          </div>
        ))}

        <div className="absolute inset-0 rounded-b-[2.5rem] shadow-[inset_0_-10px_20px_rgba(0,0,0,0.2)] pointer-events-none"></div>

        {isCapped && (
            <div className="absolute inset-0 bg-black/20 pointer-events-none z-20"></div>
        )}
        {isBlocked && (
            <div className="absolute inset-0 z-25 pointer-events-none bg-[repeating-linear-gradient(-45deg,rgba(0,0,0,0.35)_0,rgba(0,0,0,0.35)_6px,transparent_6px,transparent_12px)]" />
        )}
      </div>

      <div className="absolute top-2 left-2 w-2 h-[92%] bg-gradient-to-b from-white/40 via-white/10 to-transparent rounded-full pointer-events-none z-20 blur-[2px]"></div>
      <div className="absolute top-2 right-1.5 w-1 h-[92%] bg-gradient-to-b from-white/20 to-transparent rounded-full pointer-events-none z-20 blur-[1px]"></div>
      <div className="absolute bottom-2 left-4 right-4 h-4 bg-gradient-to-t from-white/20 to-transparent rounded-full pointer-events-none z-20 blur-md"></div>
    </div>
  );
};
