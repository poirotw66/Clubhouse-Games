import type { ReactElement } from 'react';

const HOWTO_KEY = 'clockwork-keep:howto-seen';

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

/** Soft first-session overlay: enough to place a tower and start a wave. */
export function FirstRunGuide({ onClose }: Props): ReactElement {
  const dismiss = () => {
    markFirstRunGuideSeen();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#120c06]/90 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="clockwork-keep-first-run-title"
      onClick={dismiss}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-amber-900/50 bg-[#1c1409] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-center text-xs font-bold tracking-[0.3em] text-amber-400">首局引導</p>
        <h2 id="clockwork-keep-first-run-title" className="mt-1 text-center text-2xl font-bold text-amber-50">
          三步上手
        </h2>
        <p className="mt-2 text-center text-sm text-amber-200/60">先記住這三件事，細節可開操作說明</p>

        <ul className="mt-5 space-y-2.5 text-sm text-amber-50">
          <li className="rounded-xl border border-amber-900/40 bg-black/30 px-3 py-2.5">
            <p className="font-bold text-amber-300">塔就是牆・選放與升級</p>
            <p className="mt-0.5 text-amber-200/60">
              點底部塔欄（1–6）擺塔改寫最短路，不可完全封死出口；點已放塔可升級或售出，Z 撤銷開波前最後一步。
            </p>
          </li>
          <li className="rounded-xl border border-amber-900/40 bg-black/30 px-3 py-2.5">
            <p className="font-bold text-amber-300">Space 開波與提前召波獎金</p>
            <p className="mt-0.5 text-amber-200/60">
              備戰按 Space 開始下一波；波次出兵完畢後再按 Space 提前召波，依場上餘敵領取額外金幣獎金。
            </p>
          </li>
          <li className="rounded-xl border border-amber-900/40 bg-black/30 px-3 py-2.5">
            <p className="font-bold text-amber-300">W 上發條冷卻・F 蒸汽超載 (Overdrive)</p>
            <p className="mt-0.5 text-amber-200/60">
              戰鬥中按 W 上發條蓄壓 +15%（冷卻 8 秒），擊殺亦會蓄能；蓄滿 100% 按 F 啟動 8 秒超載（攻速 +60%、得分 +50%）。
            </p>
          </li>
        </ul>

        <button
          type="button"
          onClick={dismiss}
          className="mt-6 w-full rounded-xl bg-amber-600 py-3 font-bold text-amber-50 transition hover:bg-amber-500 min-h-[44px] touch-manipulation"
        >
          知道了
        </button>
      </div>
    </div>
  );
}
