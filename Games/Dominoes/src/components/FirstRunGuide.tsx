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
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-center text-xs font-bold tracking-[0.3em] text-amber-400">首局引導</p>
        <h2 id="dominoes-first-run-title" className="mt-1 text-center text-2xl font-bold text-white">
          三步上手
        </h2>
        <p className="mt-2 text-center text-sm text-slate-400">
          預設五倍數：端點算分，打到目標分
        </p>

        <ul className="mt-5 space-y-3 text-sm text-slate-200">
          <li className="rounded-xl border border-white/5 bg-slate-800/80 px-3 py-2.5">
            <p className="font-bold text-amber-300">點數相接</p>
            <p className="mt-0.5 text-slate-400">
              選手牌，接到開放端點；五倍數時第一張雙張是轉軸，四邊可接。
            </p>
          </li>
          <li className="rounded-xl border border-white/5 bg-slate-800/80 px-3 py-2.5">
            <p className="font-bold text-amber-300">端點得分</p>
            <p className="mt-0.5 text-slate-400">
              出牌後開放端點和為 5 的倍數就得分；也可改玩摸牌制／封鎖制。
            </p>
          </li>
          <li className="rounded-xl border border-white/5 bg-slate-800/80 px-3 py-2.5">
            <p className="font-bold text-amber-300">整場比賽</p>
            <p className="mt-0.5 text-slate-400">
              多局累積分數，先達 61／100／150 者勝；提示與悔棋隨時可用。
            </p>
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
