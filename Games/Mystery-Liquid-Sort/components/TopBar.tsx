import React from 'react';
import { Settings, Heart } from 'lucide-react';
import { GameMode } from '../types';

interface TopBarProps {
  level: number;
  mode: GameMode;
  difficultyLabel?: string;
  coins: number;
  onSettings: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ level, mode, difficultyLabel, coins, onSettings }) => {
  return (
    <div className="w-full flex items-center justify-between gap-2 md:gap-3">
      {/* Left: Level/Difficulty Card - Unified Design */}
      <div className="flex-1 min-w-0 flex items-center">
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl px-3 md:px-4 py-2 md:py-2.5 border border-white/20 shadow-lg flex flex-col items-start min-w-0 w-full">
          <div className="text-yellow-400/90 text-[10px] md:text-xs font-bold tracking-wider uppercase mb-0.5 drop-shadow-md">
            {mode === 'adventure' ? 'LEVEL' : 'DIFFICULTY'}
          </div>
          <h1 className="text-white text-base md:text-2xl font-black drop-shadow-md font-mono truncate max-w-full">
            {mode === 'adventure' ? level : difficultyLabel}
          </h1>
        </div>
      </div>

      {/* Right: Settings + Coins - Unified Card Design */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {onSettings && (
          <button
            onClick={onSettings}
            className="touch-target w-10 h-10 md:w-11 md:h-11 rounded-xl bg-white/10 backdrop-blur-xl flex items-center justify-center text-white/70 active:bg-white/20 transition-all border border-white/20 shadow-lg touch-active"
            aria-label="Settings"
          >
            <Settings size={18} className="md:w-5 md:h-5" />
          </button>
        )}
        <div className="flex items-center gap-2 bg-white/10 backdrop-blur-xl rounded-2xl px-3 md:px-4 py-2 border border-white/20 shadow-lg">
          <div className="w-6 h-6 md:w-7 md:h-7 bg-gradient-to-br from-yellow-300 to-yellow-600 rounded-lg flex items-center justify-center shadow-inner border border-yellow-200/50">
            <Heart className="w-3 h-3 md:w-4 md:h-4 text-white fill-white drop-shadow-sm" />
          </div>
          <span className="text-white font-bold text-sm md:text-lg tabular-nums tracking-wide">{coins}</span>
        </div>
      </div>
    </div>
  );
};