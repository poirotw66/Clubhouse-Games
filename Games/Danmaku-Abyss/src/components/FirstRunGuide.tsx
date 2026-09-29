import type { ReactElement } from 'react';

const HOWTO_KEY = 'danmaku-abyss:howto-seen';

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

/** Soft first-session overlay: enough to move, focus, and bomb. */
export function FirstRunGuide({ onClose }: Props): ReactElement {
  const dismiss = () => {
    markFirstRunGuideSeen();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#05060f]/90 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="danmaku-abyss-first-run-title"
      onClick={dismiss}
    >
      <div
        className="da-panel w-full max-w-sm rounded-2xl border border-fuchsia-500/25 bg-slate-950/95 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-center text-xs font-bold tracking-[0.3em] text-fuchsia-300">首局引導</p>
        <h2 id="danmaku-abyss-first-run-title" className="mt-1 text-center text-2xl font-bold text-fuchsia-100">
          三步上手
        </h2>
        <p className="mt-2 text-center text-sm text-slate-400">先記住這三件事，標題頁還有完整說明</p>

        <ul className="mt-5 space-y-3 text-sm text-slate-200">
          <li className="rounded-xl border border-white/5 bg-slate-900/80 px-3 py-2.5">
            <p className="font-bold text-fuchsia-300">站位決定一切</p>
            <p className="mt-0.5 text-slate-400">
              靠得越近傷害越高、擦彈倍率也升得越快——但前面彈幕最密。
            </p>
          </li>
          <li className="rounded-xl border border-white/5 bg-slate-900/80 px-3 py-2.5">
            <p className="font-bold text-fuchsia-300">移動與集中</p>
            <p className="mt-0.5 text-slate-400">
              方向鍵／WASD 或拖曳移動；Shift／長按進入集中模式，減速並顯示判定點。
            </p>
          </li>
          <li className="rounded-xl border border-white/5 bg-slate-900/80 px-3 py-2.5">
            <p className="font-bold text-fuchsia-300">靈擊保命</p>
            <p className="mt-0.5 text-slate-400">
              按 Z 或側邊「靈擊」清彈換命，但擦彈倍率會歸零——勿當刷分鍵。
            </p>
          </li>
        </ul>

        <button
          type="button"
          onClick={dismiss}
          className="mt-6 w-full rounded-xl bg-fuchsia-600 py-3 font-bold text-white transition hover:bg-fuchsia-500 min-h-[44px] touch-manipulation"
        >
          知道了
        </button>
      </div>
    </div>
  );
}
