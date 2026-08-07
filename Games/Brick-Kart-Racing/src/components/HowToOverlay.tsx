const HOWTO_KEY = 'brick-kart-racing:howto-seen';

export function hasSeenHowTo(): boolean {
  try {
    return localStorage.getItem(HOWTO_KEY) === '1';
  } catch {
    return false;
  }
}

export function markHowToSeen(): void {
  try {
    localStorage.setItem(HOWTO_KEY, '1');
  } catch {
    /* ignore quota / private mode */
  }
}

interface Props {
  itemsEnabled: boolean;
  onClose: () => void;
}

/** First-run / menu How-to: short Traditional Chinese controls. */
export function HowToOverlay({itemsEnabled, onClose}: Props) {
  const dismiss = () => {
    markHowToSeen();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="操作教學"
    >
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
        <p className="text-center text-xs font-bold tracking-[0.3em] text-amber-400">教學</p>
        <h2 className="mt-1 text-center text-2xl font-black text-white">怎麼開？</h2>
        <p className="mt-2 text-center text-sm text-slate-400">轉向、飄移、道具——先記這三件事</p>

        <ul className="mt-5 space-y-3 text-sm text-slate-200">
          <li className="rounded-xl border border-white/5 bg-slate-800/80 px-3 py-2.5">
            <p className="font-bold text-amber-300">轉向</p>
            <p className="mt-0.5 text-slate-400">← → 或觸控左右鍵。放開油門會自然減速。</p>
          </li>
          <li className="rounded-xl border border-white/5 bg-slate-800/80 px-3 py-2.5">
            <p className="font-bold text-amber-300">飄移小噴</p>
            <p className="mt-0.5 text-slate-400">
              加速中按住 Shift／飄移並轉向；蓄力藍→橘→紫後放開，觸發小噴射。
            </p>
          </li>
          <li className="rounded-xl border border-white/5 bg-slate-800/80 px-3 py-2.5">
            <p className="font-bold text-amber-300">道具</p>
            <p className="mt-0.5 text-slate-400">
              {itemsEnabled
                ? '碾過道具磚取得一件；空白鍵或觸控「道具」發射。同時只能持有一件。'
                : '本模式關閉道具，專心練駕駛與單圈。'}
            </p>
          </li>
        </ul>

        <button
          type="button"
          onClick={dismiss}
          className="mt-6 w-full rounded-xl bg-amber-400 py-3 font-black text-slate-950 transition hover:bg-amber-300"
        >
          知道了
        </button>
      </div>
    </div>
  );
}
