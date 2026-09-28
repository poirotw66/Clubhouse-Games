const HOWTO_KEY = 'clubhouse-koi-koi-howto-seen';

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

/** Soft first-session overlay: three beats to start playing, not a full rules dump. */
export function FirstRunGuide({ onClose }: Props) {
  const dismiss = () => {
    markFirstRunGuideSeen();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-indigo-deep/90 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="koi-koi-first-run-title"
      onClick={dismiss}
    >
      <div
        className="wafu-modal relative w-full max-w-sm rounded-2xl p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="corner-ornament corner-ornament-tl" />
        <div className="corner-ornament corner-ornament-tr" />
        <div className="corner-ornament corner-ornament-bl" />
        <div className="corner-ornament corner-ornament-br" />

        <p className="text-center text-xs font-bold tracking-[0.3em] text-gold/80">首局引導</p>
        <h2 id="koi-koi-first-run-title" className="mt-1 text-center font-display text-2xl font-bold text-gold">
          三步上手
        </h2>
        <p className="mt-2 text-center text-sm text-cream/60">先記住這三件事，細節可隨時開規則</p>

        <ul className="mt-5 space-y-3 text-sm text-cream/85">
          <li className="rounded-xl border border-gold/15 bg-indigo-deep/40 px-3 py-2.5">
            <p className="font-display font-semibold text-gold">同月配對</p>
            <p className="mt-0.5 text-cream/55">出手牌對場上同月份；再翻山牌，同樣可取。</p>
          </li>
          <li className="rounded-xl border border-gold/15 bg-indigo-deep/40 px-3 py-2.5">
            <p className="font-display font-semibold text-gold">成役抉擇</p>
            <p className="mt-0.5 text-cream/55">組成役後可「勝負」收分，或喊 Koi-Koi 繼續博更高。</p>
          </li>
          <li className="rounded-xl border border-gold/15 bg-indigo-deep/40 px-3 py-2.5">
            <p className="font-display font-semibold text-gold">提示與悔棋</p>
            <p className="mt-0.5 text-cream/55">回合中可用提示；悔棋可回到你出手前（含對手剛回的那手）。</p>
          </li>
        </ul>

        <button
          type="button"
          onClick={dismiss}
          className="wafu-btn-gold mt-6 w-full rounded-xl py-3 min-h-[44px] touch-manipulation"
        >
          開始對局
        </button>
      </div>
    </div>
  );
}
