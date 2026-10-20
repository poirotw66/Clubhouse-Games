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
        className="w-full max-w-sm rounded-2xl border border-blue-400/25 bg-neutral-900 p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-center text-xs font-bold tracking-[0.3em] text-blue-300">首局引導</p>
        <h2 id="toy-boxing-first-run-title" className="mt-1 text-center text-2xl font-bold text-white">
          四步上手
        </h2>
        <p className="mt-2 text-center text-sm text-neutral-400">先記心機戰，再進聯賽階梯</p>

        <ul className="mt-5 space-y-3 text-sm text-neutral-200">
          <li className="rounded-xl border border-white/5 bg-neutral-800/80 px-3 py-2.5">
            <p className="font-bold text-blue-300">上段／下段</p>
            <p className="mt-0.5 text-neutral-400">
              鍵盤按住 ↓ 或 Ｃ；手機按住「下段」。出拳與格擋都吃段位。
              <span className="text-orange-300">擋對大幅減傷，擋錯幾乎白擋。</span>
            </p>
          </li>
          <li className="rounded-xl border border-white/5 bg-neutral-800/80 px-3 py-2.5">
            <p className="font-bold text-blue-300">讀預備動作</p>
            <p className="mt-0.5 text-neutral-400">
              拳套後拉＋「上／下」角標就是風向燈。勾拳／招牌拳預備較久；看到紫「閃」只能閃避，格擋無效。
            </p>
          </li>
          <li className="rounded-xl border border-white/5 bg-neutral-800/80 px-3 py-2.5">
            <p className="font-bold text-blue-300">兩條勝利路</p>
            <p className="mt-0.5 text-neutral-400">
              打臉堆暈眩條可頭擊ＫＯ；打腹削對方耐力回復，再磨體力。別只會連刺上段。
            </p>
          </li>
          <li className="rounded-xl border border-white/5 bg-neutral-800/80 px-3 py-2.5">
            <p className="font-bold text-blue-300">聯賽階梯</p>
            <p className="mt-0.5 text-neutral-400">
              六位對手各有風格（愛擋／猛攻／連刺／虛晃／打腹／讀習慣）；打贏解鎖下一位。手機用畫面下方按鈕操作。
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
