import type { ReactElement } from 'react';

const HOWTO_KEY = 'clubhouse:baseball-life:howto-seen';

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

/** Soft first-session overlay: enough to create a player and pick a training. */
export function FirstRunGuide({ onClose }: Props): ReactElement {
  const dismiss = () => {
    markFirstRunGuideSeen();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#070d17]/90 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="baseball-life-first-run-title"
      onClick={dismiss}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-amber-900/40 bg-[#0c1420] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-center text-xs font-bold tracking-[0.3em] text-amber-400">首局引導</p>
        <h2 id="baseball-life-first-run-title" className="mt-1 text-center text-2xl font-bold text-amber-50">
          三步上手
        </h2>
        <p className="mt-2 text-center text-sm text-amber-200/60">先記住這三件事，就能走進棒球部開打</p>

        <ul className="mt-5 space-y-3 text-sm text-amber-50">
          <li className="rounded-xl border border-amber-900/40 bg-black/30 px-3 py-2.5">
            <p className="font-bold text-amber-300">種子決定命運</p>
            <p className="mt-0.5 text-amber-200/60">
              世界種子碼決定天賦與骰運；相同種子＋相同選擇＝相同人生。接著選位置與出身即可開打。
            </p>
          </li>
          <li className="rounded-xl border border-amber-900/40 bg-black/30 px-3 py-2.5">
            <p className="font-bold text-amber-300">訓練與骰子</p>
            <p className="mt-0.5 text-amber-200/60">
              每回合只選一項訓練，骰子決定成效倍率。高中三年成長最快——22 歲前幾乎定型。
            </p>
          </li>
          <li className="rounded-xl border border-amber-900/40 bg-black/30 px-3 py-2.5">
            <p className="font-bold text-amber-300">天命與復原</p>
            <p className="mt-0.5 text-amber-200/60">
              累積天命可強行完美骰一次；點選項或按 1–9。Backspace 復原誤點。
            </p>
          </li>
        </ul>

        <button
          type="button"
          onClick={dismiss}
          className="mt-6 w-full rounded-xl bg-amber-500 py-3 font-bold text-slate-950 transition hover:bg-amber-400 min-h-[44px] touch-manipulation"
        >
          知道了
        </button>
      </div>
    </div>
  );
}
