import type { ReactElement } from 'react';
import { BookOpen, Layers, Maximize2, ShieldAlert, Sparkles, X } from 'lucide-react';

export const FIRST_RUN_GUIDE_KEY = 'clubhouse:freecell:first-run-guide';

export function hasSeenFirstRunGuide(): boolean {
  try {
    return localStorage.getItem(FIRST_RUN_GUIDE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markFirstRunGuideSeen(): void {
  try {
    localStorage.setItem(FIRST_RUN_GUIDE_KEY, '1');
  } catch {
    /* ignore private mode */
  }
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

/** Concise Traditional Chinese onboarding guide covering Supermove and empty cell/column tactics. */
export function FirstRunGuide({ isOpen, onClose }: Props): ReactElement | null {
  if (!isOpen) return null;

  const dismiss = () => {
    markFirstRunGuideSeen();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="freecell-guide-title"
      onClick={dismiss}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-amber-400/30 bg-stone-900 p-6 shadow-2xl text-stone-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-stone-800">
          <div className="flex items-center gap-2 text-amber-400">
            <BookOpen size={20} />
            <h2 id="freecell-guide-title" className="text-xl font-bold tracking-tight">
              新接龍 · 大師戰術指南
            </h2>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition"
            aria-label="關閉指南"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 space-y-3.5 text-xs sm:text-sm">
          {/* Card 1: Core Goal */}
          <div className="rounded-xl border border-white/10 bg-stone-800/60 p-3 flex gap-3 items-start">
            <Sparkles size={20} className="text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-300">通關目標與回收區</p>
              <p className="mt-0.5 text-stone-300 leading-relaxed">
                將 52 張牌按四種花色（黑桃、紅心、方塊、梅花）依序由 Ａ 疊到 Ｋ 移入右上角回收區。桌面牌列需「紅黑交錯、由大到小」接龍。
              </p>
            </div>
          </div>

          {/* Card 2: Supermove Formula */}
          <div className="rounded-xl border border-white/10 bg-stone-800/60 p-3 flex gap-3 items-start">
            <Maximize2 size={20} className="text-sky-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sky-300">連鎖轉移（Supermove）公式</p>
              <p className="mt-0.5 text-stone-300 leading-relaxed">
                一次可搬移的連續牌串上限取決於可用空間：
                <span className="block mt-1 font-mono font-bold text-amber-200 bg-black/40 px-2 py-1 rounded">
                  可移張數 = (1 + 空暫存格) × 2^(空列數)
                </span>
                若目標為空列，則該空列作為終點，公式為 <span className="font-mono text-amber-200">(1 + 空暫存格) × 2^(空列數 - 1)</span>。
              </p>
            </div>
          </div>

          {/* Card 3: Empty Column Strategy */}
          <div className="rounded-xl border border-white/10 bg-stone-800/60 p-3 flex gap-3 items-start">
            <Layers size={20} className="text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-emerald-300">保留空列 · 乘法放大器</p>
              <p className="mt-0.5 text-stone-300 leading-relaxed">
                空列是連鎖動能的「乘法加成（×2）」，空暫存格僅是「線性加法（+1）」。非萬不得已切勿以單張雜牌填死空列；騰出空列能瞬間盤活整盤死局。
              </p>
            </div>
          </div>

          {/* Card 4: Freecell Rotation Strategy */}
          <div className="rounded-xl border border-white/10 bg-stone-800/60 p-3 flex gap-3 items-start">
            <ShieldAlert size={20} className="text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-rose-300">暫存格是旋轉門而非倉庫</p>
              <p className="mt-0.5 text-stone-300 leading-relaxed">
                左上暫存格進牌前務必預先算好出路。若 4 格塞滿且無空列，單次只能移動 1 張牌，極易陷入無子可動。雙格模式下動能更嚴苛，更須惜格如金！
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={dismiss}
          className="mt-5 w-full rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold py-2.5 transition touch-manipulation text-sm"
        >
          掌握戰術 · 開始挑戰
        </button>
      </div>
    </div>
  );
}
