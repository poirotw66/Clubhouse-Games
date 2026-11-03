import React from 'react';
import type { OpponentDef } from '../opponents';
import type { PlayMode } from '../types';
import type { OpponentBest } from '../storage';
import { SCENARIO_LABELS } from '../constants';
import { ShieldAlert, Crosshair, Sparkles } from 'lucide-react';

interface OpponentDossierCardProps {
  opponent: OpponentDef | null;
  playMode: PlayMode;
  stats?: OpponentBest;
  difficultyTier?: number;
  className?: string;
}

export const OpponentDossierCard: React.FC<OpponentDossierCardProps> = ({
  opponent,
  playMode,
  stats,
  difficultyTier = 0,
  className = '',
}) => {
  if (playMode === 'versus') {
    return (
      <div
        className={`rounded-xl border border-amber-500/30 bg-slate-950/80 p-3.5 backdrop-blur-md shadow-lg ${className}`}
      >
        <div className="flex items-center gap-1.5 pb-2 mb-2 border-b border-slate-800 text-amber-400">
          <Crosshair size={15} />
          <span className="font-display text-xs font-bold tracking-widest uppercase">
            雙人拔刀競速
          </span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          同機快拔對決。左側為 P1（<kbd className="px-1 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700 font-mono text-[10px]">A</kbd>），右側為 P2（<kbd className="px-1 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700 font-mono text-[10px]">L</kbd>）。
        </p>
        <div className="mt-2 text-[11px] text-amber-300/80 bg-amber-950/20 p-2 rounded border border-amber-500/20">
          先得 5 分者為勝，搶跑犯規將直接失分！
        </div>
      </div>
    );
  }

  if (!opponent) {
    // Challenge / Practice Mode dossier
    return (
      <div
        className={`rounded-xl border border-slate-700 bg-slate-950/80 p-3.5 backdrop-blur-md shadow-lg ${className}`}
      >
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-cyan-400">
          <div className="flex items-center gap-1.5">
            <Sparkles size={15} />
            <span className="font-display text-xs font-bold tracking-widest uppercase">
              {playMode === 'practice' ? '道場特訓劇本' : '無盡生存試煉'}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-display">
            階梯難度 Lv.{difficultyTier}
          </span>
        </div>

        <div className="text-xs text-slate-300 leading-relaxed mb-2">
          {playMode === 'practice'
            ? '無限生命特訓模式。隨意調整暗器劇本與壓力強度，專注打磨神經反應速度。'
            : '無盡暗器來襲！隨著分數與連段上升，判定時間窗將急遽收斂，暗器速度逐步狂暴。'}
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px] font-display mt-2">
          <div className="bg-slate-900/60 p-2 rounded border border-slate-800">
            <div className="text-slate-400">暗器偏向</div>
            <div className="text-emerald-400 font-bold">全暗器隨機亂舞</div>
          </div>
          <div className="bg-slate-900/60 p-2 rounded border border-slate-800">
            <div className="text-slate-400">拔刀心法</div>
            <div className="text-cyan-300 font-bold">上偏引左，下偏振右</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border bg-slate-950/80 p-3.5 backdrop-blur-md shadow-lg ${className}`}
      style={{ borderColor: `${opponent.accent}44` }}
    >
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
        <div className="flex items-center gap-1.5">
          <ShieldAlert size={15} style={{ color: opponent.accent }} />
          <span
            className="font-display text-xs font-bold tracking-widest uppercase"
            style={{ color: opponent.accent }}
          >
            劍豪交鋒情報
          </span>
        </div>
        {opponent.isBoss && (
          <span className="text-[10px] font-display font-black px-1.5 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-500/50">
            最終頭目
          </span>
        )}
      </div>

      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <div
            className="text-base font-black font-display tracking-wider"
            style={{ color: opponent.accent }}
          >
            {opponent.name}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">{opponent.tagline}</div>
        </div>
        {stats && (
          <div className="text-right text-[10px] font-display">
            <div className="text-slate-400">戰績</div>
            <div className="text-emerald-400 font-bold">
              {stats.wins} 勝 / {stats.losses} 敗
            </div>
          </div>
        )}
      </div>

      <p className="text-[11px] text-slate-300 leading-relaxed mb-2.5">
        {opponent.blurb}
      </p>

      <div className="grid grid-cols-2 gap-2 text-[10px] font-display">
        <div className="bg-slate-900/60 p-2 rounded border border-slate-800">
          <div className="text-slate-400">暗器偏好</div>
          <div className="text-slate-200 font-bold">
            {SCENARIO_LABELS[opponent.scenario]}
          </div>
        </div>
        <div className="bg-slate-900/60 p-2 rounded border border-slate-800">
          <div className="text-slate-400">破綻指引</div>
          <div className="text-amber-300 font-bold">
            {opponent.trait === 'feints'
              ? '靜心莫砍紅光'
              : opponent.trait === 'double'
                ? '速斬雙刀不間斷'
                : opponent.trait === 'delay'
                  ? '沉住氣候其發動'
                  : opponent.trait === 'speedup'
                    ? '瞬息之間提早出刃'
                    : opponent.trait === 'sideswitch'
                      ? '雙眼緊盯左右軌跡'
                      : '均衡守備無懈可擊'}
          </div>
        </div>
      </div>
    </div>
  );
};
