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
      className="da-dialog-scrim fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="danmaku-abyss-first-run-title"
      onClick={dismiss}
    >
      <div
        className="da-dialog w-full max-w-sm rounded-[16px] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="danmaku-abyss-first-run-title"
          className="text-center text-2xl font-black text-fuchsia-100"
        >
          三步上手
        </h2>
        <p className="mt-2 text-center text-sm font-bold text-cyan-200">
          先記住這三件事，標題頁還有完整說明
        </p>

        <ul className="mt-5 space-y-3 text-sm text-slate-200">
          <li className="da-tile da-tile--hot !min-h-0 !rounded-[12px]">
            <p className="font-black text-fuchsia-200">站位決定一切</p>
            <p className="mt-0.5 text-slate-400">
              靠得越近傷害越高、擦彈倍率也升得越快——但前面彈幕最密。
            </p>
          </li>
          <li className="da-tile da-tile--ice !min-h-0 !rounded-[12px]">
            <p className="font-black text-cyan-200">移動與集中</p>
            <p className="mt-0.5 text-slate-400">
              方向鍵／WASD 或拖曳移動；Shift／長按進入集中模式，減速並顯示判定點。
            </p>
          </li>
          <li className="da-tile da-tile--amber !min-h-0 !rounded-[12px]">
            <p className="font-black text-amber-200">靈擊與特技</p>
            <p className="mt-0.5 text-slate-400">
              Z／「靈擊」清彈換命（擦彈倍率歸零）；X／「特技」是機體專屬冷卻技，不花靈擊。
            </p>
          </li>
        </ul>

        <button type="button" onClick={dismiss} className="da-cta mt-6 w-full">
          知道了
        </button>
      </div>
    </div>
  );
}
