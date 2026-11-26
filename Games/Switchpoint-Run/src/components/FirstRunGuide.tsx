import type { ReactElement } from 'react';

const GUIDE_KEY = 'clubhouse:switchpoint-run:first-run-guide';

export function hasSeenFirstRunGuide(): boolean {
  try {
    return localStorage.getItem(GUIDE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markFirstRunGuideSeen(): void {
  try {
    localStorage.setItem(GUIDE_KEY, '1');
  } catch {
    // Ignore quota or private mode restrictions
  }
}

interface Props {
  onClose: () => void;
}

/**
 * First-run guide explaining switchpoint risk-reward mechanics,
 * pursuit buffer tension, and responsive lane buffering.
 */
export function FirstRunGuide({ onClose }: Props): ReactElement {
  const dismiss = () => {
    markFirstRunGuideSeen();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="switchpoint-guide-title"
      onClick={dismiss}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-cyan-500/40 bg-slate-900/95 p-6 shadow-2xl text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-center text-xs font-mono font-bold tracking-[0.25em] text-cyan-400">
          調度員新手指南・SWITCHPOINT GUIDE
        </p>
        <h2 id="switchpoint-guide-title" className="mt-1 text-center text-2xl font-black text-white">
          道岔抉擇與極限運轉
        </h2>
        <p className="mt-1.5 text-center text-xs text-slate-400">
          掌握速度與風險代價，甩開後方緊咬不放的追擊列車
        </p>

        <ul className="mt-4 space-y-3 text-xs leading-relaxed">
          <li className="rounded-xl border border-cyan-900/50 bg-slate-950/70 p-3">
            <p className="font-bold text-amber-300 flex items-center gap-1.5">
              <span>◆</span> 支線分流與速度取捨
            </p>
            <p className="mt-1 text-slate-300">
              <strong className="text-emerald-400">加速軌（綠燈）</strong>：速度大幅超越追擊列車，但佈滿密集障礙；
              <strong className="text-rose-400"> 減速軌（紅燈）</strong>：障礙稀疏安全，但車速低於列車，緩衝距離會被快速吞噬！
            </p>
          </li>

          <li className="rounded-xl border border-cyan-900/50 bg-slate-950/70 p-3">
            <p className="font-bold text-cyan-300 flex items-center gap-1.5">
              <span>◆</span> 列車追擊與緩衝回充
            </p>
            <p className="mt-1 text-slate-300">
              碰撞障礙會引發強烈<strong className="text-rose-300">撞擊失速</strong>，讓列車瞬間逼近！
              選行<strong className="text-sky-300">補給側線</strong>可大額回充緩衝距離；
              選行<strong className="text-amber-300">計分軌</strong>則能堆疊分數倍率。
            </p>
          </li>

          <li className="rounded-xl border border-cyan-900/50 bg-slate-950/70 p-3">
            <p className="font-bold text-indigo-300 flex items-center gap-1.5">
              <span>◆</span> 極限操作與預先變道
            </p>
            <p className="mt-1 text-slate-300">
              滑動螢幕或按 <kbd className="rounded bg-slate-800 px-1 py-0.5 font-mono text-[10px] text-cyan-200">A / D</kbd> 變換軌道，
              <kbd className="rounded bg-slate-800 px-1 py-0.5 font-mono text-[10px] text-cyan-200">W</kbd> 跳躍、
              <kbd className="rounded bg-slate-800 px-1 py-0.5 font-mono text-[10px] text-cyan-200">S</kbd> 滑行。
              跳躍與滑行落地的最後瞬間（~0.08秒）支援<strong className="text-cyan-300">預先變道取消</strong>，落地瞬間無縫切換軌道！
            </p>
          </li>
        </ul>

        <button
          type="button"
          onClick={dismiss}
          className="mt-5 w-full rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 py-3 font-bold text-slate-950 transition hover:brightness-110 min-h-[44px] touch-manipulation shadow-lg shadow-cyan-950"
        >
          進入調度指揮中心
        </button>
      </div>
    </div>
  );
}
