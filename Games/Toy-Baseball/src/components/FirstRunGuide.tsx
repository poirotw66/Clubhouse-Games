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
            <p className="font-bold text-amber-300">選模式與難度</p>
            <p className="mt-0.5 text-zinc-400">
              「三局賽」投打對戰電腦；「全壘打大賽」限次揮擊拚全壘打數。
            </p>
          </li>
          <li className="rounded-xl border border-white/5 bg-zinc-800/80 px-3 py-2.5">
            <p className="font-bold text-amber-300">打擊：時機 × 方向</p>
            <p className="mt-0.5 text-zinc-400">
              空白鍵／觸控揮棒；← → 選拉打／推打，對準進壘點較易安打。
            </p>
          </li>
          <li className="rounded-xl border border-white/5 bg-zinc-800/80 px-3 py-2.5">
            <p className="font-bold text-amber-300">投球：球速 × 進壘</p>
            <p className="mt-0.5 text-zinc-400">
              下半局選快速／慢速與左中右；迷惑對手再爭取出局。
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
