import type { ReactElement } from 'react';

export const HOWTO_KEY = 'clubhouse-toy-baseball-howto-seen';

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

/** Soft first-session overlay: enough to open the plate, not a full manual. */
export function FirstRunGuide({ onClose }: Props): ReactElement {
  const dismiss = () => {
    markFirstRunGuideSeen();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="toy-baseball-first-run-title"
      onClick={dismiss}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-amber-400/25 bg-zinc-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-center text-xs font-bold tracking-[0.3em] text-amber-300">首局引導</p>
        <h2 id="toy-baseball-first-run-title" className="mt-1 text-center text-2xl font-bold text-white">
          三步上手
        </h2>
        <p className="mt-2 text-center text-sm text-zinc-400">先記這三件事，細節在選單下方</p>

        <ul className="mt-5 space-y-3 text-sm text-zinc-200">
          <li className="rounded-xl border border-white/5 bg-zinc-800/80 px-3 py-2.5">
            <p className="font-bold text-amber-300">選局數與難度</p>
            <p className="mt-0.5 text-zinc-400">
              正規賽可選 3／6／9 局；全壘打大賽限次揮擊拚支數。
            </p>
          </li>
          <li className="rounded-xl border border-white/5 bg-zinc-800/80 px-3 py-2.5">
            <p className="font-bold text-amber-300">打擊：讀球 × 打向空檔</p>
            <p className="mt-0.5 text-zinc-400">
              看軌跡判斷球種；← → 選拉打／推打，往九位野手間的空隙打。
            </p>
          </li>
          <li className="rounded-xl border border-white/5 bg-zinc-800/80 px-3 py-2.5">
            <p className="font-bold text-amber-300">投球：六種球路＋出手後控球</p>
            <p className="mt-0.5 text-zinc-400">
              選速／曲／滑／變／伸／叉後進壘；出手瞬間用 ← → 微調拐彎。
            </p>
          </li>
        </ul>

        <button
          type="button"
          onClick={dismiss}
          className="mt-6 w-full rounded-xl bg-amber-500 py-3 font-bold text-zinc-950 transition hover:bg-amber-400 min-h-[44px] touch-manipulation"
        >
          知道了
        </button>
      </div>
    </div>
  );
}
