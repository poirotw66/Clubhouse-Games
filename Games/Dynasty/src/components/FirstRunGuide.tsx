import type { ReactElement } from 'react';

const HOWTO_KEY = 'clubhouse:dynasty:howto-seen';

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

/** Soft first-session overlay: enough to take the GM chair and make a call. */
export function FirstRunGuide({ onClose }: Props): ReactElement {
  const dismiss = () => {
    markFirstRunGuideSeen();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#06120e]/90 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dynasty-first-run-title"
      onClick={dismiss}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-emerald-900/50 bg-[#0a1a14] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-center text-xs font-bold tracking-[0.3em] text-emerald-400">首局引導</p>
        <h2 id="dynasty-first-run-title" className="mt-1 text-center text-2xl font-bold text-emerald-50">
          三步上手
        </h2>
        <p className="mt-2 text-center text-sm text-emerald-200/60">先記住這三件事，就能接下職務開打</p>

        <ul className="mt-5 space-y-3 text-sm text-emerald-50">
          <li className="rounded-xl border border-emerald-900/40 bg-black/30 px-3 py-2.5">
            <p className="font-bold text-emerald-300">期望決定評分</p>
            <p className="mt-0.5 text-emerald-200/60">
              每年季前與董事會協商期望（重建／站穩／進季後賽／拚冠）；年底照那個期望評分，不是單純看勝場。
            </p>
          </li>
          <li className="rounded-xl border border-emerald-900/40 bg-black/30 px-3 py-2.5">
            <p className="font-bold text-emerald-300">選項都有代價</p>
            <p className="mt-0.5 text-emerald-200/60">
              情境、交易、續約都沒有免費午餐——不花錢就得付士氣、熱度或信任。信任連兩年低於 20 會被解僱。
            </p>
          </li>
          <li className="rounded-xl border border-emerald-900/40 bg-black/30 px-3 py-2.5">
            <p className="font-bold text-emerald-300">點選與復原</p>
            <p className="mt-0.5 text-emerald-200/60">
              點選項或按 1–9；報告顯示在下一個決策上方。Backspace 可復原誤點；R 開關名單。
            </p>
          </li>
        </ul>

        <button
          type="button"
          onClick={dismiss}
          className="mt-6 w-full rounded-xl bg-emerald-500 py-3 font-bold text-slate-950 transition hover:bg-emerald-400 min-h-[44px] touch-manipulation"
        >
          知道了
        </button>
      </div>
    </div>
  );
}
