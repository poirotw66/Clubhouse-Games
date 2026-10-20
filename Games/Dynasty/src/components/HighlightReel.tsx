import React, { useEffect, useState } from 'react';
import { TouchButton } from '@clubhouse/shared/TouchButton';
import type { GameHighlight } from '../game/types';

const KIND_LABEL: Record<GameHighlight['kind'], string> = {
  playoff: '季後賽',
  rivalry: '對戰',
  milestone: '里程碑',
};

interface Props {
  highlight: GameHighlight;
}

/**
 * Skippable text play-by-play with a simple die / ball pulse. Auto-advances
 * beats; the player can jump straight to the final score at any time.
 */
export function HighlightReel({ highlight }: Props): React.ReactElement {
  const [beatIndex, setBeatIndex] = useState(0);
  const [skipped, setSkipped] = useState(false);
  const [dieKey, setDieKey] = useState(0);

  const done = skipped || beatIndex >= highlight.beats.length;
  const beat = done ? null : highlight.beats[beatIndex];

  useEffect(() => {
    setBeatIndex(0);
    setSkipped(false);
    setDieKey(0);
  }, [highlight.title, highlight.finalScore, highlight.beats.length]);

  useEffect(() => {
    if (done || skipped) return;
    const timer = window.setTimeout(() => {
      setBeatIndex((i) => i + 1);
      setDieKey((k) => k + 1);
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [beatIndex, done, skipped]);

  return (
    <div className="dy-highlight mt-3 overflow-hidden rounded-xl border border-emerald-500/25 bg-slate-950/70">
      <div className="flex items-start justify-between gap-3 border-b border-slate-700/50 px-3 py-2">
        <div>
          <p className="text-[10px] tracking-wider text-emerald-300/80">
            比賽精華・{KIND_LABEL[highlight.kind]}
          </p>
          <h3 className="text-sm font-bold text-slate-100">{highlight.title}</h3>
          <p className="text-[11px] text-slate-500">{highlight.subtitle}</p>
        </div>
        {!done && (
          <TouchButton
            label="跳過"
            ariaLabel="跳過比賽精華"
            onClick={() => setSkipped(true)}
            className="shrink-0 rounded-lg border border-slate-600 bg-slate-800/80 px-3 text-xs font-semibold text-slate-300"
          />
        )}
      </div>

      <div className="relative px-3 py-3">
        <div className="dy-diamond pointer-events-none absolute inset-0 opacity-30" aria-hidden />

        {!done && beat && (
          <div className="relative flex items-start gap-3">
            <div className="dy-die-wrap flex h-11 w-11 shrink-0 items-center justify-center">
              {beat.die !== undefined ? (
                <span key={dieKey} className="dy-die dy-die-face" aria-hidden>
                  {beat.die}
                </span>
              ) : (
                <span key={dieKey} className="dy-ball" aria-hidden />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold tracking-wider text-amber-300/90">
                {beat.moment}
              </p>
              <p
                className={`mt-0.5 text-sm leading-relaxed ${
                  beat.tone === 'great'
                    ? 'text-emerald-200'
                    : beat.tone === 'good'
                      ? 'text-emerald-300/90'
                      : beat.tone === 'bad'
                        ? 'text-rose-200'
                        : 'text-slate-200'
                }`}
              >
                {beat.text}
              </p>
              <p className="mt-1 text-[10px] text-slate-500">
                {beatIndex + 1} / {highlight.beats.length}
              </p>
            </div>
          </div>
        )}

        {done && (
          <div className="relative text-center">
            <p className="text-[11px] text-slate-500">
              {highlight.awayName} ＠ {highlight.homeName}
            </p>
            <p className="mt-1 font-mono text-lg font-black text-emerald-300">
              {highlight.finalScore}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">精華結束</p>
          </div>
        )}
      </div>
    </div>
  );
}
