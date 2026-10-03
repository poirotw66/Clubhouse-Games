import type { ReactElement } from 'react';
import { HOWTO_STORAGE_KEY } from '../constants';

export const HOWTO_KEY = HOWTO_STORAGE_KEY;

export function hasSeenFirstRunGuide(): boolean {
  try {
    return localStorage.getItem(HOWTO_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markFirstRunGuideSeen(): void {
  try {
    localStorage.setItem(HOWTO_STORAGE_KEY, '1');
  } catch {
    /* ignore quota / private mode */
  }
}

interface Props {
  onClose: () => void;
  /** Optional: jump into the orange mix tutorial stage. */
  onStartMixTutorial?: () => void;
}

/** Soft first-session overlay — select → pour → deliver, plus mix teaser. */
export function FirstRunGuide({ onClose, onStartMixTutorial }: Props): ReactElement {
  const dismiss = () => {
    markFirstRunGuideSeen();
    onClose();
  };

  const startTutorial = () => {
    markFirstRunGuideSeen();
    onClose();
    onStartMixTutorial?.();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mls-first-run-title"
      onClick={dismiss}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#2d2d44] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-center text-xs font-bold tracking-[0.3em] text-cyan-300">首局引導</p>
        <h2 id="mls-first-run-title" className="mt-1 text-center text-2xl font-bold text-white">
          三步上手
        </h2>
        <p className="mt-2 text-center text-sm text-white/50">選瓶傾倒、交訂單；混色是本遊戲賣點</p>

        <ul className="mt-5 space-y-3 text-sm text-white/90">
          <li className="rounded-xl border border-white/5 bg-black/20 px-3 py-2.5">
            <p className="font-bold text-cyan-300">選瓶 → 傾倒</p>
            <p className="mt-0.5 text-white/45">點來源瓶，再點高亮目標；同色可合併。</p>
          </li>
          <li className="rounded-xl border border-white/5 bg-black/20 px-3 py-2.5">
            <p className="font-bold text-cyan-300">滿瓶交單</p>
            <p className="mt-0.5 text-white/45">瓶子裝滿單一顏色會飛向訂單；全數交完即過關。</p>
          </li>
          <li className="rounded-xl border border-white/5 bg-black/20 px-3 py-2.5">
            <p className="font-bold text-amber-300">墨水可混合</p>
            <p className="mt-0.5 text-white/45">
              紅+黃→橙、藍+黃→綠、紅+藍→紫。混色不可逆——先看配方再倒。
            </p>
          </li>
        </ul>

        <div className="mt-6 space-y-2">
          {onStartMixTutorial && (
            <button
              type="button"
              onClick={startTutorial}
              className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-3 font-bold text-white transition active:scale-[0.98] min-h-[44px] touch-manipulation"
            >
              試試混色教學
            </button>
          )}
          <button
            type="button"
            onClick={dismiss}
            className="w-full rounded-xl bg-cyan-500 py-3 font-bold text-[#0f172a] transition hover:bg-cyan-400 min-h-[44px] touch-manipulation"
          >
            知道了
          </button>
        </div>
      </div>
    </div>
  );
}
