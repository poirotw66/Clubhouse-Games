import React from 'react';
import { sizeMultiplier } from '../game/engine';
import type { HandReview } from '../game/review';
import type { MatchState } from '../game/types';
import { HUMAN } from '../game/types';

const SEAT_NAMES = ['你', '下家', '對家', '上家'];

interface Props {
  review: HandReview;
  match: MatchState;
  matchOver: boolean;
  onContinue: () => void;
  onSetup: () => void;
}

export function HandReviewPanel({
  review,
  match,
  matchOver,
  onContinue,
  onSetup,
}: Props): React.ReactElement {
  const wonHand = review.winner === HUMAN;
  const wonMatch = matchOver && match.winner === HUMAN;

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={matchOver ? '系列賽結束' : '本局複盤'}
    >
      <div className="bt-review-panel w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/95 p-5 shadow-2xl sm:p-6">
        <p className="text-center text-xs font-bold tracking-[0.25em] text-indigo-300">
          {matchOver ? '系列賽結束' : '本局複盤'}
        </p>
        <h2
          className={`mt-1 text-center text-2xl font-black ${
            matchOver
              ? wonMatch
                ? 'text-emerald-300'
                : 'text-rose-300'
              : wonHand
                ? 'text-emerald-300'
                : 'text-rose-300'
          }`}
        >
          {matchOver
            ? wonMatch
              ? '系列賽獲勝'
              : `${SEAT_NAMES[match.winner ?? 0]}拿下系列賽`
            : wonHand
              ? '你贏了這一局'
              : `${SEAT_NAMES[review.winner]}贏了這一局`}
        </h2>
        <p className="mt-1 text-center font-mono text-3xl font-black text-amber-300">
          {review.highlight}
        </p>
        <p className="mt-1 text-center text-xs text-slate-400">
          累計籌碼 {match.balances[HUMAN] >= 0 ? '+' : ''}
          {match.balances[HUMAN]}
          {match.config.mode === 'hands'
            ? ` · 已打 ${match.history.length}/${match.config.hands} 局`
            : ` · 目標 ${match.config.target}`}
        </p>

        <dl className="mt-4 grid gap-1.5 text-sm">
          {review.scores.map((entry) => (
            <div
              key={entry.seat}
              className="flex justify-between rounded-lg border border-white/5 bg-slate-800/80 px-3 py-2"
            >
              <dt className="text-slate-400">
                {SEAT_NAMES[entry.seat]}
                {entry.seat === review.winner ? ' ★' : ''}
              </dt>
              <dd className="font-mono font-semibold tabular-nums text-white">
                {entry.penalty}（剩 {entry.remaining}×
                {sizeMultiplier(entry.remaining, match.config.rules.sizeLadder)}
                {entry.deuces > 0 && match.config.rules.deuceDouble
                  ? `×${2 ** entry.deuces}`
                  : ''}
                ）
              </dd>
            </div>
          ))}
        </dl>

        <ul className="mt-4 space-y-2">
          {review.lessons.map((lesson) => (
            <li
              key={lesson.title}
              className="rounded-xl border border-indigo-400/15 bg-indigo-500/10 px-3 py-2 text-left"
            >
              <p className="text-sm font-bold text-indigo-200">{lesson.title}</p>
              <p className="text-xs leading-relaxed text-slate-400">{lesson.detail}</p>
            </li>
          ))}
        </ul>

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={onContinue}
            className="min-h-[48px] w-full rounded-xl bg-emerald-600 px-6 py-3 font-semibold touch-manipulation hover:bg-emerald-500"
          >
            {matchOver ? '再打一場系列賽' : '下一局'}
          </button>
          <button
            type="button"
            onClick={onSetup}
            className="min-h-[44px] w-full rounded-xl border border-white/15 bg-white/5 px-6 py-3 font-semibold text-slate-200 touch-manipulation hover:bg-white/10"
          >
            設定
          </button>
        </div>
      </div>
    </div>
  );
}
