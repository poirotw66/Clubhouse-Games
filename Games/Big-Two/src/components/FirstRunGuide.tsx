import type { ReactElement } from 'react';

const HOWTO_KEY = 'clubhouse-big-two-howto-seen';

export function hasSeenFirstRunGuide(): boolean {
  try {
    return localStorage.getItem(HOWTO_KEY) === '1';
  } catch {
    return false;
  }
}

export function markFirstRunGuideSeen(): void {
  try {
    localStorage.setItem(HOWTO_KEY, '1');
  } catch {
    /* ignore quota / private mode */
  }
}

interface Props {
  onClose: () => void;
}

/** Soft first-session overlay: enough to open, not a full rules dump. */
export function FirstRunGuide({ onClose }: Props): ReactElement {
  const dismiss = () => {
    markFirstRunGuideSeen();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="big-two-first-run-title"
      onClick={dismiss}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-indigo-400/25 bg-slate-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-center text-xs font-bold tracking-[0.3em] text-indigo-300">首局引導</p>
        <h2 id="big-two-first-run-title" className="mt-1 text-center text-2xl font-bold text-white">
          三步上手
        </h2>
        <p className="mt-2 text-center text-sm text-slate-400">先記住這三件事，細節在開局畫面</p>

        <ul className="mt-5 space-y-3 text-sm text-slate-200">
          <li className="rounded-xl border border-white/5 bg-slate-800/80 px-3 py-2.5">
            <p className="font-bold text-indigo-300">♣3 開局</p>
            <p className="mt-0.5 text-slate-400">持梅花 3 的人先出，且第一手必須含 ♣3。</p>
          </li>
          <li className="rounded-xl border border-white/5 bg-slate-800/80 px-3 py-2.5">
            <p className="font-bold text-indigo-300">張數要一樣</p>
            <p className="mt-0.5 text-slate-400">只出 1／2／5 張；壓牌時張數必須跟檯面相同。</p>
          </li>
          <li className="rounded-xl border border-white/5 bg-slate-800/80 px-3 py-2.5">
            <p className="font-bold text-indigo-300">提示與復原</p>
            <p className="mt-0.5 text-slate-400">輪到你可用提示；復原回到你出手前（含對手剛回的那手）。</p>
          </li>
        </ul>

        <button
          type="button"
          onClick={dismiss}
          className="mt-6 w-full rounded-xl bg-indigo-500 py-3 font-bold text-white transition hover:bg-indigo-400 min-h-[44px] touch-manipulation"
        >
          開始牌局
        </button>
      </div>
    </div>
  );
}
