import React, { useState } from 'react';
import {
  Compass,
  Keyboard,
  Layers,
  X,
  Zap,
} from 'lucide-react';
import type { GameState } from '../types.ts';
import type { FreeCellSlots } from '../utils/storage.ts';
import {
  evaluateTactics,
  getSupermoveCapacity,
} from '../utils/tactics.ts';
import { TacticalLeftWing } from './TacticalLeftWing.tsx';
import { TacticalRightWing } from './TacticalRightWing.tsx';

interface TacticalMobileBarProps {
  gameState: GameState;
  freeCellSlots: FreeCellSlots;
  currentSeed: number;
  onSelectDeal: (seed: number) => void;
  onSafeAutoMove: () => void;
  onOpenKeyboardGuide: () => void;
  disabled?: boolean;
}

export const TacticalMobileBar: React.FC<TacticalMobileBarProps> = ({
  gameState,
  freeCellSlots,
  currentSeed,
  onSelectDeal,
  onSafeAutoMove,
  onOpenKeyboardGuide,
  disabled = false,
}) => {
  const [activeModal, setActiveModal] = useState<'none' | 'left' | 'right'>('none');

  const isSlotLocked = (idx: number) => freeCellSlots === 2 && idx >= 2;
  const emptyFreeCells = gameState.freeCells.filter(
    (c, idx) => c === null && !isSlotLocked(idx),
  ).length;
  const emptyTableaus = gameState.tableaus.filter((col) => col.length === 0).length;

  const supermove = getSupermoveCapacity(emptyFreeCells, emptyTableaus);
  const tactics = evaluateTactics(gameState, freeCellSlots);

  const totalReclaimed =
    gameState.foundations.spades +
    gameState.foundations.hearts +
    gameState.foundations.diamonds +
    gameState.foundations.clubs;

  return (
    <>
      {/* Compact Briefing Bar on Small Screens */}
      <div className="xl:hidden w-full mb-3 rounded-2xl bg-white/95 backdrop-blur-md border border-stone-200/90 shadow-sm p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* Left indicators */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 font-semibold text-stone-800 bg-stone-100/80 px-2 py-1 rounded-lg border border-stone-200/70">
            <Zap size={14} className="text-amber-500" />
            <span>連鎖上限:</span>
            <span className="font-bold tabular-nums text-stone-900">{supermove.capacityToTableau}</span>
            <span className="text-[10px] text-stone-500">張</span>
          </div>

          <div className="flex items-center gap-1 text-stone-600 bg-stone-100/80 px-2 py-1 rounded-lg border border-stone-200/70">
            <span className="font-serif">♠♥♦♣</span>
            <span className="font-bold tabular-nums text-stone-900">{totalReclaimed}</span>
            <span className="text-[10px] text-stone-400">/52</span>
          </div>

          {tactics.hasSafeFoundationMove && (
            <button
              type="button"
              onClick={onSafeAutoMove}
              disabled={disabled}
              className="flex items-center gap-1 font-semibold px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-sm animate-pulse touch-manipulation cursor-pointer"
              title="自動送入回收區（快捷鍵 A）"
            >
              <Layers size={13} />
              <span>可安全收牌</span>
            </button>
          )}
        </div>

        {/* Right drawer buttons */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveModal('left')}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 transition-colors border border-stone-200/80 touch-manipulation"
          >
            <Zap size={13} className="text-amber-600" />
            <span>戰術儀表</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveModal('right')}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 transition-colors border border-stone-200/80 touch-manipulation"
          >
            <Compass size={13} className="text-sky-600" />
            <span>盤號工坊</span>
          </button>

          <button
            type="button"
            onClick={onOpenKeyboardGuide}
            className="p-1 rounded-lg text-stone-600 hover:bg-stone-100 transition-colors border border-stone-200/80 touch-manipulation"
            aria-label="快捷鍵指南"
            title="快捷鍵指南"
          >
            <Keyboard size={15} />
          </button>
        </div>
      </div>

      {/* Drawer / Modal for Left Wing on Small Screens */}
      {activeModal === 'left' && (
        <div
          className="xl:hidden fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setActiveModal('none')}
              className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 touch-manipulation"
              aria-label="關閉"
            >
              <X size={18} />
            </button>
            <TacticalLeftWing
              gameState={gameState}
              freeCellSlots={freeCellSlots}
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
          className="xl:hidden fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setActiveModal('none')}
              className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 touch-manipulation"
              aria-label="關閉"
            >
              <X size={18} />
            </button>
            <TacticalRightWing
              currentSeed={currentSeed}
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
