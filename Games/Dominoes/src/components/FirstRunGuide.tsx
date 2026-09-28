const HOWTO_KEY = 'clubhouse-dominoes-howto-seen';

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

/** Soft first-session overlay for Dominoes — enough to place the first tile. */
export function FirstRunGuide({ onClose }: Props) {
  const dismiss = () => {
    markFirstRunGuideSeen();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dominoes-first-run-title"
      onClick={dismiss}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <p className="text-center text-xs font-bold tracking-[0.3em] text-amber-400">首局引導</p>
        <h2 id="dominoes-first-run-title" className="mt-1 text-center text-2xl font-bold text-white">
          三步上手
        </h2>
        <p className="mt-2 text-center text-sm text-slate-400">先接線、再摸牌；細節可開規則</p>

        <ul className="mt-5 space-y-3 text-sm text-slate-200">
          <li className="rounded-xl border border-white/5 bg-slate-800/80 px-3 py-2.5">
            <p className="font-bold text-amber-300">點數相接</p>
            <p className="mt-0.5 text-slate-400">選手牌，接到出牌線任一端，端點點數必須相同。</p>
          </li>
          <li className="rounded-xl border border-white/5 bg-slate-800/80 px-3 py-2.5">
            <p className="font-bold text-amber-300">摸牌或過牌</p>
            <p className="mt-0.5 text-slate-400">摸牌制可抽到能出；封鎖制則直接跳過。</p>
          </li>
          <li className="rounded-xl border border-white/5 bg-slate-800/80 px-3 py-2.5">
            <p className="font-bold text-amber-300">提示與悔棋</p>
            <p className="mt-0.5 text-slate-400">對電腦時可用提示；悔棋回到你出手前（含對手剛回的那手）。</p>
          </li>
        </ul>

        <button
          type="button"
          onClick={dismiss}
          className="mt-6 w-full rounded-xl bg-amber-400 py-3 font-bold text-slate-950 transition hover:bg-amber-300 min-h-[44px] touch-manipulation"
        >
          知道了
        </button>
      </div>
    </div>
  );
}
