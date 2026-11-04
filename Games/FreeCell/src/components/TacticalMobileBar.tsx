import React, { useState } from 'react';
import {
  Compass,
  Keyboard,
  Layers,
  Palette,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import type { GameState } from '../types.ts';
import type { FreeCellSlots } from '../utils/storage.ts';
import type { WorkshopTheme } from '../utils/theme.ts';
import {
  getSolutionRouteTelemetry,
} from '../utils/tactics.ts';
import { TacticalLeftWing } from './TacticalLeftWing.tsx';
import { TacticalRightWing } from './TacticalRightWing.tsx';

interface TacticalMobileBarProps {
  gameState: GameState;
  freeCellSlots: FreeCellSlots;
  theme?: WorkshopTheme;
  soundEnabled?: boolean;
  onToggleTheme?: () => void;
  onToggleSound?: () => void;
  currentSeed: number;
  onSelectDeal: (seed: number) => void;
  onSafeAutoMove: () => void;
  onOpenKeyboardGuide: () => void;
  disabled?: boolean;
}

export const TacticalMobileBar: React.FC<TacticalMobileBarProps> = ({
  gameState,
  freeCellSlots,
  theme = 'royal-velvet',
  soundEnabled = true,
  onToggleTheme,
  onToggleSound,
  currentSeed,
  onSelectDeal,
  onSafeAutoMove,
  onOpenKeyboardGuide,
  disabled = false,
}) => {
  const [activeModal, setActiveModal] = useState<'none' | 'left' | 'right'>('none');

  const telemetry = getSolutionRouteTelemetry(gameState, freeCellSlots);
  const { supermove, safeCards } = telemetry;

  const totalReclaimed =
    gameState.foundations.spades +
    gameState.foundations.hearts +
    gameState.foundations.diamonds +
    gameState.foundations.clubs;

  const barTheme = {
    'royal-velvet': 'bg-emerald-950/85 border-emerald-700/40 text-emerald-100 shadow-[0_4px_20px_rgba(0,0,0,0.4)]',
    'obsidian-gold': 'bg-neutral-950/90 border-amber-500/35 text-amber-100 shadow-[0_4px_20px_rgba(0,0,0,0.6)]',
    'cyber-neon': 'bg-slate-950/90 border-cyan-500/40 text-cyan-100 shadow-[0_4px_20px_rgba(6,182,212,0.25)]',
  }[theme];

  return (
    <>
      {/* Compact Briefing Bar on Small Screens */}
      <div className={`xl:hidden w-full mb-3 rounded-2xl border backdrop-blur-md p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs select-none ${barTheme}`}>
        {/* Left indicators */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center gap-1 font-semibold px-2 py-1 rounded-lg bg-white/10 border border-white/15">
            <Zap size={14} className="text-amber-400" />
            <span>連鎖上限:</span>
            <span className="font-bold tabular-nums text-amber-300">{supermove.capacityToTableau}</span>
            <span className="text-[10px] opacity-70">張</span>
          </div>

          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 border border-white/15">
            <span className="font-serif">♠♥♦♣</span>
            <span className="font-bold tabular-nums">{totalReclaimed}</span>
            <span className="text-[10px] opacity-70">/52</span>
          </div>

          {safeCards.length > 0 && (
            <button
              type="button"
              onClick={onSafeAutoMove}
              disabled={disabled}
              className="flex items-center gap-1 font-semibold px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-sm animate-pulse touch-manipulation cursor-pointer"
              title="自動送入回收區（快捷鍵 A）"
            >
              <Layers size={13} />
              <span>安全收牌 ({safeCards.length})</span>
            </button>
          )}
        </div>

        {/* Right drawer buttons */}
        <div className="flex items-center gap-1">
          {onToggleTheme && (
            <button
              type="button"
              onClick={onToggleTheme}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors border border-white/15 touch-manipulation cursor-pointer"
              aria-label="切換主題 (快捷鍵 T)"
              title="切換主題 (T)"
            >
              <Palette size={14} />
            </button>
          )}

          {onToggleSound && (
            <button
              type="button"
              onClick={onToggleSound}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors border border-white/15 touch-manipulation cursor-pointer"
              aria-label={soundEnabled ? '靜音 (快捷鍵 M)' : '開啟音效 (快捷鍵 M)'}
              title={soundEnabled ? '靜音 (M)' : '開啟音效 (M)'}
            >
              {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} className="opacity-50" />}
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveModal('left')}
            className="flex items-center gap-1 px-2 py-1 rounded-lg font-medium bg-white/10 hover:bg-white/20 transition-colors border border-white/15 touch-manipulation cursor-pointer"
          >
            <Zap size={13} className="text-amber-400" />
            <span>戰術儀表</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveModal('right')}
            className="flex items-center gap-1 px-2 py-1 rounded-lg font-medium bg-white/10 hover:bg-white/20 transition-colors border border-white/15 touch-manipulation cursor-pointer"
          >
            <Compass size={13} className="text-sky-400" />
            <span>盤號工坊</span>
          </button>

          <button
            type="button"
            onClick={onOpenKeyboardGuide}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors border border-white/15 touch-manipulation cursor-pointer"
            aria-label="快捷鍵指南 (?)"
            title="快捷鍵指南 (?)"
          >
            <Keyboard size={14} />
          </button>
        </div>
      </div>

      {/* Drawer / Modal for Left Wing on Small Screens */}
      {activeModal === 'left' && (
        <div
          className="xl:hidden fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setActiveModal('none')}
              className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-black/50 hover:bg-black/70 text-white/80 touch-manipulation cursor-pointer"
              aria-label="關閉"
            >
              <X size={18} />
            </button>
            <TacticalLeftWing
              gameState={gameState}
              freeCellSlots={freeCellSlots}
              theme={theme}
              onSafeAutoMove={() => {
                onSafeAutoMove();
                setActiveModal('none');
              }}
              disabled={disabled}
            />
          </div>
        </div>
      )}

      {/* Drawer / Modal for Right Wing on Small Screens */}
      {activeModal === 'right' && (
        <div
          className="xl:hidden fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setActiveModal('none')}
              className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-black/50 hover:bg-black/70 text-white/80 touch-manipulation cursor-pointer"
              aria-label="關閉"
            >
              <X size={18} />
            </button>
            <TacticalRightWing
              currentSeed={currentSeed}
              theme={theme}
              onSelectDeal={(seed) => {
                onSelectDeal(seed);
                setActiveModal('none');
              }}
              disabled={disabled}
            />
          </div>
        </div>
      )}
    </>
  );
};
