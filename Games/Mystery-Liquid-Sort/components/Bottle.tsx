import React from 'react';
import { BottleData } from '../types';

interface BottleProps {
  bottle: BottleData;
  isSelected: boolean;
  isValidTarget?: boolean; // New prop for smart highlighting
  isFlying?: boolean;
  onClick: () => void;
}

export const Bottle: React.FC<BottleProps> = ({ bottle, isSelected, isValidTarget = false, isFlying = false, onClick }) => {
  const layerHeight = 100 / bottle.capacity;
  
  const isCapped = bottle.isCompleted;

  return (
    <div 
      onClick={isCapped ? undefined : onClick}
      className={`
        relative flex flex-col items-center justify-end touch-target
        transition-all duration-300 ease-in-out touch-active
        ${isFlying ? 'z-50 pointer-events-none' : ''}
        ${isCapped && !isFlying ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'}
        
        /* Selected State - Mobile optimized */
        ${isSelected && !isCapped && !isFlying ? '-translate-y-4 md:-translate-y-6 scale-105 drop-shadow-[0_20px_20px_rgba(0,0,0,0.5)]' : ''}
        
        /* Valid Target Hint (Pulsing Green Glow) - Mobile optimized */
        ${isValidTarget && !isSelected ? 'ring-2 md:ring-4 ring-emerald-400/60 ring-offset-2 md:ring-offset-4 ring-offset-[#1a1a2e] scale-[1.02]' : ''}

        /* Active State for mobile touch */
        ${!isSelected && !isCapped && !isFlying && !isValidTarget ? 'active:scale-95 active:-translate-y-1' : ''}
      `}
      style={{ 
        width: '72px', // Increased from 64px for better touch target
        height: '200px',
        minWidth: '72px', // Ensure minimum touch target
        minHeight: '200px',
        // Flying Animation: Move up significantly and fade out/scale down
        transform: isFlying ? 'translateY(-60vh) scale(0.3)' : undefined,
        opacity: isFlying ? 0 : 1
      }}
    >
      {/* Selection Indicator */}
      {isSelected && !isCapped && !isFlying && (
        <div className="absolute -top-12 animate-bounce flex flex-col items-center z-50">
          <div className="w-4 h-4 bg-yellow-400 rounded-full shadow-[0_0_10px_#facc15]"></div>
          <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[10px] border-t-yellow-400 mt-1"></div>
        </div>
      )}

      {/* Valid Target Indicator (Arrow) */}
      {isValidTarget && (
        <div className="absolute -top-10 animate-bounce flex flex-col items-center z-50 opacity-80">
           <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[10px] border-t-emerald-400"></div>
        </div>
      )}

      {/* Capped / Sealed Visual */}
      {isCapped && (
        <div className="absolute -top-5 z-40 animate-drop-in w-full flex justify-center">
           {/* Cork Design */}
           <div className="w-14 h-8 bg-gradient-to-r from-[#5c4a35] via-[#796248] to-[#5c4a35] rounded-t-sm rounded-b-lg shadow-xl border-t border-white/20 flex items-center justify-center relative">
              {/* Texture lines */}
              <div className="absolute top-2 w-10 h-[1px] bg-black/20"></div>
              <div className="absolute bottom-2 w-8 h-[1px] bg-white/10"></div>
              {/* Lock Icon */}
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#d4c5a9] drop-shadow-md" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
           </div>
        </div>
      )}

      {/* --- GLASS BOTTLE CONTAINER --- */}
      <div 
        className={`
          relative w-full h-full overflow-hidden flex flex-col-reverse shadow-2xl backdrop-blur-sm z-10
          rounded-b-[2.5rem] rounded-t-lg border-[3px] bg-white/5 
          transition-colors duration-300
          ${isValidTarget ? 'border-emerald-400/50' : 'border-white/20'}
        `}
      >
        {/* LAYERS */}
        {bottle.layers.map((layer) => (
          <div
            key={layer.id}
            className="w-full transition-all duration-500 ease-in-out relative border-b border-black/5"
            style={{
              height: `${layerHeight}%`,
              // 3D Liquid Gradient
              background: layer.isHidden 
                ? '#374151' 
                : `linear-gradient(90deg, ${layer.color} 0%, ${layer.color}dd 20%, ${layer.color} 50%, ${layer.color}dd 80%, ${layer.color} 100%)`,
            }}
          >
            {/* Liquid Surface highlight (Meniscus) */}
            {!layer.isHidden && (
              <div className="absolute top-0 w-full h-[3px] bg-white/40 blur-[1px]"></div>
            )}
            
            {/* Bubbles / Texture for visible liquid */}
            {!layer.isHidden && (
                <div className="absolute inset-0 opacity-20 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8Y2lyY2xlIGN4PSIyIiBjeT0iMiIgcj0iMSIgZmlsbD0id2hpdGUiIC8+Cjwvc3ZnPg==')]"></div>
            )}

            {/* Hidden Pattern */}
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
        
        {/* Empty Space Highlight (Inner Shadow) */}
        <div className="absolute inset-0 rounded-b-[2.5rem] shadow-[inset_0_-10px_20px_rgba(0,0,0,0.2)] pointer-events-none"></div>

        {/* If capped, add a dark overlay inside to show it's "stored" */}
        {isCapped && (
            <div className="absolute inset-0 bg-black/20 pointer-events-none z-20"></div>
        )}
      </div>

      {/* --- GLASS REFLECTIONS (Skeuomorphic touches) --- */}
      {/* Main left reflection */}
      <div className="absolute top-2 left-2 w-2 h-[92%] bg-gradient-to-b from-white/40 via-white/10 to-transparent rounded-full pointer-events-none z-20 blur-[2px]"></div>
      
      {/* Right rim highlight */}
      <div className="absolute top-2 right-1.5 w-1 h-[92%] bg-gradient-to-b from-white/20 to-transparent rounded-full pointer-events-none z-20 blur-[1px]"></div>
      
      {/* Bottom curve highlight */}
      <div className="absolute bottom-2 left-4 right-4 h-4 bg-gradient-to-t from-white/20 to-transparent rounded-full pointer-events-none z-20 blur-md"></div>

    </div>
  );
};