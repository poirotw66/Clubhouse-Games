import React, { useMemo } from 'react';
import type { YakuId } from '../types';
import {
  ALL_YAKU_IDS,
  YAKU_CATALOG,
  isYakuUnlocked,
  unlockedCount,
  type YakuCodexState,
} from '../utils/yakuCodex';

const YAKU_ACCENT: Record<YakuId, string> = {
  gokou: 'border-gold/50 bg-gold/10',
  shikou: 'border-gold/50 bg-gold/10',
  ame_shikou: 'border-gold/50 bg-gold/10',
  sankou: 'border-gold/50 bg-gold/10',
  ino_shika_cho: 'border-emerald-400/50 bg-emerald-400/10',
  tsukimi_zake: 'border-sky-400/50 bg-sky-400/10',
  hanami_zake: 'border-pink-400/50 bg-pink-400/10',
  tane: 'border-emerald-400/50 bg-emerald-400/10',
  akatan: 'border-vermillion-light/50 bg-vermillion/10',
  aotan: 'border-blue-400/50 bg-blue-400/10',
  tanzaku: 'border-vermillion-light/50 bg-vermillion/10',
  kasu: 'border-cream/30 bg-cream/5',
};

interface YakuCodexModalProps {
  codex: YakuCodexState;
  onClose: () => void;
}

export const YakuCodexModal: React.FC<YakuCodexModalProps> = ({ codex, onClose }) => {
  const unlocked = useMemo(() => unlockedCount(codex), [codex]);

  return (
    <div
      className="fixed inset-0 bg-indigo-deep/90 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="koi-koi-codex-title"
      onClick={onClose}
    >
      <div
        className="wafu-modal rounded-2xl p-5 sm:p-7 max-w-lg w-full max-h-[85vh] overflow-y-auto relative"
        onClick={e => e.stopPropagation()}
      >
        <div className="corner-ornament corner-ornament-tl" />
        <div className="corner-ornament corner-ornament-tr" />
        <div className="corner-ornament corner-ornament-bl" />
        <div className="corner-ornament corner-ornament-br" />

        <div className="flex items-baseline justify-between gap-3 mb-2">
          <h2 id="koi-koi-codex-title" className="font-display text-2xl font-bold text-gold">
            役種圖鑑
          </h2>
          <p className="text-xs text-cream/60 shrink-0">
            已收集 {unlocked}/{ALL_YAKU_IDS.length}
          </p>
        </div>
        <p className="text-sm text-cream/60 mb-5">
          完成過的役會解鎖紀錄；未見過的只顯示剪影與提示。
        </p>

        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-6">
          {ALL_YAKU_IDS.map(id => {
            const meta = YAKU_CATALOG[id];
            const entry = codex.entries[id];
            const unlockedEntry = isYakuUnlocked(codex, id);

            return (
              <li
                key={id}
                className={`rounded-xl border px-3 py-2.5 min-h-[88px] ${
                  unlockedEntry ? YAKU_ACCENT[id] : 'border-cream/15 bg-indigo-mid/40'
                }`}
              >
                {unlockedEntry && entry ? (
                  <>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="font-display text-sm text-cream">{meta.name}</p>
                      <span className="text-[10px] text-gold shrink-0">{meta.pointsBlurb}</span>
                    </div>
                    <p className="text-[11px] text-cream/65 leading-snug mb-1.5">{meta.hint}</p>
                    <p className="text-[10px] text-cream/45 space-x-2">
                      <span>首成 {entry.firstCompletedAt}</span>
                      <span>·</span>
                      <span>×{entry.timesAchieved}</span>
                      <span>·</span>
                      <span>最佳 {entry.bestHandScore} 分</span>
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="font-display text-sm text-cream/35 tracking-widest">？？？</p>
                      <span className="text-[10px] text-cream/30">未解鎖</span>
                    </div>
                    <div
                      className="h-6 w-24 rounded bg-cream/10 mb-2 yaku-silhouette"
                      aria-hidden
                    />
                    <p className="text-[11px] text-cream/40 leading-snug">{meta.hint}</p>
                  </>
                )}
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={onClose}
          className="wafu-btn-gold w-full py-3 min-h-[44px] rounded-xl touch-manipulation"
        >
          關閉
        </button>
      </div>
    </div>
  );
};
