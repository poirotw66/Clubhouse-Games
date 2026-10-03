import React from 'react';
import { MIX_RECIPES } from '../services/gameLogic';

interface RecipeHudProps {
  /** Compact strip (default) vs slightly larger panel. */
  expanded?: boolean;
  /** Highlight irreversible warning on first adventure mix unlock. */
  showIrreversibleWarning?: boolean;
}

/** On-screen three-recipe strip for mix-enabled boards. */
export const RecipeHud: React.FC<RecipeHudProps> = ({
  expanded = false,
  showIrreversibleWarning = false,
}) => {
  return (
    <div
      className={`w-full max-w-lg mx-auto mb-2 md:mb-3 px-1 ${expanded ? '' : ''}`}
      role="region"
      aria-label="混色配方"
    >
      <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg px-3 py-2">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] md:text-xs font-bold tracking-wider text-amber-300/90">
            混色配方
          </span>
          {showIrreversibleWarning && (
            <span className="text-[10px] font-bold text-rose-300 animate-pulse">混色後無法還原</span>
          )}
        </div>
        <div className={`flex ${expanded ? 'flex-col gap-1.5' : 'flex-wrap justify-center gap-1.5 md:gap-2'}`}>
          {MIX_RECIPES.map((recipe) => (
            <div
              key={recipe.label}
              className="flex items-center gap-1.5 rounded-lg bg-black/25 border border-white/10 px-2 py-1"
            >
              <span
                className="w-3 h-3 rounded-full border border-white/30 shadow-inner"
                style={{ background: recipe.a }}
                aria-hidden
              />
              <span className="text-white/40 text-[10px]">+</span>
              <span
                className="w-3 h-3 rounded-full border border-white/30 shadow-inner"
                style={{ background: recipe.b }}
                aria-hidden
              />
              <span className="text-white/40 text-[10px]">→</span>
              <span
                className="w-3 h-3 rounded-full border border-white/30 shadow-inner"
                style={{ background: recipe.result }}
                aria-hidden
              />
              <span className="text-[10px] md:text-xs font-bold text-white/80 ml-0.5">
                {recipe.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
