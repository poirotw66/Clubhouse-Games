import type { ReactElement } from 'react';

export const HOWTO_KEY = 'clubhouse-toy-boxing-howto-seen';

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

/** Soft first-session overlay: enough to open the ring, not a full manual. */
export function FirstRunGuide({ onClose }: Props): ReactElement {
  const dismiss = () => {
    markFirstRunGuideSeen();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="toy-boxing-first-run-title"
      onClick={dismiss}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-blue-400/25 bg-neutral-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-center text-xs font-bold tracking-[0.3em] text-blue-300">首局引導</p>
        <h2 id="toy-boxing-first-run-title" className="mt-1 text-center text-2xl font-bold text-white">
          三步上手
        </h2>
        <p className="mt-2 text-center text-sm text-neutral-400">先記這三件事，細節在選單下方</p>

        <ul className="mt-5 space-y-3 text-sm text-neutral-200">
          <li className="rounded-xl border border-white/5 bg-neutral-800/80 px-3 py-2.5">
            <p className="font-bold text-blue-300">靠近再打</p>
            <p className="mt-0.5 text-neutral-400">A／D 或觸控左右移動；進攻擊距離才打得到。</p>
          </li>
          <li className="rounded-xl border border-white/5 bg-neutral-800/80 px-3 py-2.5">
            <p className="font-bold text-blue-300">刺拳・勾拳・格擋</p>
            <p className="mt-0.5 text-neutral-400">J 刺拳、K 勾拳、S 格擋。勾拳較慢但較痛。</p>
          </li>
          <li className="rounded-xl border border-white/5 bg-neutral-800/80 px-3 py-2.5">
            <p className="font-bold text-blue-300">閃避・撥招・必殺</p>
            <p className="mt-0.5 text-neutral-400">
              W 閃避、I 撥招反擊；紫色能量滿了按 L 放必殺。
            </p>
          </li>
        </ul>

        <button
          type="button"
          onClick={dismiss}
          className="mt-6 w-full rounded-xl bg-blue-500 py-3 font-bold text-white transition hover:bg-blue-400 min-h-[44px] touch-manipulation"
        >
          知道了
        </button>
      </div>
    </div>
  );
}
