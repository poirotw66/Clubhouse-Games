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
          戰術上手
        </h2>
        <p className="mt-2 text-center text-sm text-zinc-400">掌握打擊、投球與跑打戰術指令</p>

        <ul className="mt-5 space-y-3 text-sm text-zinc-200">
          <li className="rounded-xl border border-white/5 bg-zinc-800/80 px-3 py-2.5">
            <p className="font-bold text-amber-300">打擊與戰術指令（短打 Ｂ · 盜壘 Ｓ）</p>
            <p className="mt-0.5 text-zinc-400">
              按 Space 揮棒；按 <kbd className="rounded bg-zinc-700 px-1 py-0.5 font-mono text-xs text-amber-200">B</kbd> 切換短打（突襲安打或犧牲推進），壘上有人時按 <kbd className="rounded bg-zinc-700 px-1 py-0.5 font-mono text-xs text-amber-200">S</kbd> 啟動盜壘或發動打跑戰術。
            </p>
          </li>
          <li className="rounded-xl border border-white/5 bg-zinc-800/80 px-3 py-2.5">
            <p className="font-bold text-amber-300">防守佈陣與推拉方向</p>
            <p className="mt-0.5 text-zinc-400">
              留意對手防守佈陣（雙殺佈陣、外野趨前或拉打防守），擊球時用 ← → 方向鍵推打穿越防守空檔。
            </p>
          </li>
          <li className="rounded-xl border border-white/5 bg-zinc-800/80 px-3 py-2.5">
            <p className="font-bold text-amber-300">投球：六種球路＋出手後控球</p>
            <p className="mt-0.5 text-zinc-400">
              選速／曲／滑／變／伸／叉後進壘；出手瞬間用 ← → 控球微調邊角，誘使打者出棒。
            </p>
          </li>
          <li className="rounded-xl border border-white/5 bg-zinc-800/80 px-3 py-2.5">
            <p className="font-bold text-amber-300">選局數與季賽挑戰</p>
            <p className="mt-0.5 text-zinc-400">
              正規賽可選 3／6／9 局；另有季賽模式與全壘打大賽限次拚支數。
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
