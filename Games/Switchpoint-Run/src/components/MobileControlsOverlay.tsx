import React from 'react';
import { haptic } from '@clubhouse/shared/juice';
import { playMove } from '@clubhouse/shared/synthAudio';

interface Props {
  onLaneStep: (step: -1 | 1) => void;
  onJump: () => void;
  onSlide: () => void;
  visible: boolean;
  onToggleVisible: () => void;
}

export const MobileControlsOverlay: React.FC<Props> = ({
  onLaneStep,
  onJump,
  onSlide,
  visible,
  onToggleVisible,
}) => {
  return (
    <>
      {/* Visibility Toggle Button */}
      <button
        type="button"
        onClick={onToggleVisible}
        className="lg:hidden absolute bottom-2 left-1/2 -translate-x-1/2 z-20 px-2 py-0.5 rounded-full text-[10px] font-mono tracking-wider bg-slate-900/70 border border-white/10 text-slate-400 active:text-slate-200"
        aria-label={visible ? '隱藏觸控按鈕' : '顯示觸控按鈕'}
      >
        {visible ? '觸控按鈕：開' : '觸控按鈕：關'}
      </button>

      {visible && (
        <div className="lg:hidden absolute inset-x-0 bottom-6 pointer-events-none z-10 flex justify-between px-3 sm:px-6">
          {/* Steer controls (Left / Right) */}
          <div className="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                haptic('tap', 0.6);
                playMove();
                onLaneStep(-1);
              }}
              className="w-14 h-14 rounded-2xl bg-slate-900/75 border border-emerald-500/40 text-emerald-300 flex flex-col items-center justify-center font-bold shadow-lg shadow-black/40 active:scale-90 active:bg-emerald-600/30 transition-transform select-none touch-manipulation"
              aria-label="左扳道變更股道"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
              </svg>
              <span className="text-[9px] -mt-1 font-sans">左扳道</span>
            </button>

            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                haptic('tap', 0.6);
                playMove();
                onLaneStep(1);
              }}
              className="w-14 h-14 rounded-2xl bg-slate-900/75 border border-emerald-500/40 text-emerald-300 flex flex-col items-center justify-center font-bold shadow-lg shadow-black/40 active:scale-90 active:bg-emerald-600/30 transition-transform select-none touch-manipulation"
              aria-label="右扳道變更股道"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
              </svg>
              <span className="text-[9px] -mt-1 font-sans">右扳道</span>
            </button>
          </div>

          {/* Action controls (Jump / Slide) */}
          <div className="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                haptic('tap', 0.7);
                onJump();
              }}
              className="w-14 h-14 rounded-2xl bg-slate-900/75 border border-sky-500/40 text-sky-300 flex flex-col items-center justify-center font-bold shadow-lg shadow-black/40 active:scale-90 active:bg-sky-600/30 transition-transform select-none touch-manipulation"
              aria-label="跳躍避開低欄障礙"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" />
              </svg>
              <span className="text-[9px] -mt-1 font-sans">跳躍</span>
            </button>

            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                haptic('tap', 0.7);
                onSlide();
              }}
              className="w-14 h-14 rounded-2xl bg-slate-900/75 border border-indigo-500/40 text-indigo-300 flex flex-col items-center justify-center font-bold shadow-lg shadow-black/40 active:scale-90 active:bg-indigo-600/30 transition-transform select-none touch-manipulation"
              aria-label="鏟滑通過高架鋼樑"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
              </svg>
              <span className="text-[9px] -mt-1 font-sans">鏟滑</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};
