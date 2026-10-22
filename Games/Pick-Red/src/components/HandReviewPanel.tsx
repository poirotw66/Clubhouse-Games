import React from 'react';
import { DAILY_HANDS } from '../game/daily';
import { computeMatchMvp, isSeriesMode } from '../game/match';
import type { HandReview } from '../game/review';
import type { MatchMvp, MatchState } from '../game/types';
import { HUMAN } from '../game/types';

const SEAT_NAMES = ['你', '對家甲', '對家乙', '對家丙'];

interface Props {
  review: HandReview;
  match: MatchState;
  matchOver: boolean;
  onContinue: () => void;
  onSetup: () => void;
  shareLabel?: string | null;
  onShare?: (() => void) | null;
  seatNames?: string[];
}

export function HandReviewPanel({
  review,
  match,
  matchOver,
  onContinue,
  onSetup,
  shareLabel,
  onShare,
  seatNames = SEAT_NAMES,
}: Props): React.ReactElement {
  const series = isSeriesMode(match.config.mode);
  const daily = match.config.mode === 'daily';
  const wonHand = review.winners.length === 1 && review.winners[0] === HUMAN;
  const drewHand = review.winners.includes(HUMAN) && review.winners.length > 1;
  const wonMatch = matchOver && match.winner === HUMAN;
  const mvp = matchOver && series ? computeMatchMvp(match) : null;

  const title = !series
    ? '單局結束'
    : daily && matchOver
      ? '每日牌桌結束'
      : matchOver
        ? '系列賽結束'
        : '本局複盤';

  const headline = !series
    ? wonHand
      ? '你贏了'
      : drewHand
        ? '平手'
        : `${seatNames[review.winners[0] ?? 0]}贏了`
    : matchOver
      ? wonMatch
        ? daily
          ? '今日牌桌獲勝'
          : '系列賽獲勝'
        : `${seatNames[match.winner ?? 0]}拿下${daily ? '今日牌桌' : '系列賽'}`
      : wonHand
        ? '你贏了這一局'
        : drewHand
          ? '本局平手'
          : `${seatNames[review.winners[0] ?? 0]}贏了這一局`;

  const continueLabel = !series
    ? '再打一局'
    : matchOver
      ? daily
        ? '再挑戰今日'
        : match.config.ladderOpponentId
          ? '再挑戰'
          : '再打一場系列賽'
      : '下一圈';

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="pr-review-panel w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/95 p-5 shadow-2xl sm:p-6 max-h-[90vh] overflow-y-auto">
        <p className="text-center text-xs font-bold tracking-[0.25em] text-emerald-300">
          {title}
        </p>
        <h2
          className={`mt-1 text-center text-2xl font-black ${
            matchOver && series
              ? wonMatch
                ? 'text-emerald-300'
                : 'text-rose-300'
              : wonHand
                ? 'text-emerald-300'
                : drewHand
                  ? 'text-amber-300'
                  : 'text-rose-300'
          }`}
        >
          {headline}
        </h2>
        <p className="mt-1 text-center font-mono text-3xl font-black text-amber-300">
          {review.highlight}
        </p>
        <p className="mt-1 text-center text-xs text-slate-400">
          {series ? (
            <>
              累計籌碼 {match.balances[HUMAN] >= 0 ? '+' : ''}
              {match.balances[HUMAN]}
              {match.config.mode === 'hands'
                ? ` · 已打 ${match.history.length}/${match.config.hands} 圈`
                : match.config.mode === 'daily'
                  ? ` · 已打 ${match.history.length}/${DAILY_HANDS} 圈`
                  : ` · 目標 ${match.config.target}`}
              {` · 標準分 ${review.par}`}
            </>
          ) : (
            <>本局籌碼 {review.highlight} · 標準分 {review.par}</>
          )}
        </p>

        <dl className="mt-4 grid gap-1.5 text-sm">
          {review.scores.map((points, seat) => (
            <div
              key={seat}
              className="flex justify-between rounded-lg border border-white/5 bg-slate-800/80 px-3 py-2"
            >
              <dt className="text-slate-400">
                {seatNames[seat] ?? SEAT_NAMES[seat]}
                {review.winners.includes(seat) ? ' ★' : ''}
                {points > review.par ? ' 合格' : ''}
              </dt>
              <dd className="font-mono font-semibold tabular-nums text-white">
                {points}
                <span
                  className={`ml-2 text-xs ${
                    review.deltas[seat] > 0
                      ? 'text-emerald-400'
                      : review.deltas[seat] < 0
                        ? 'text-rose-400'
                        : 'text-slate-500'
                  }`}
                >
                  {review.deltas[seat] > 0 ? '+' : ''}
                  {review.deltas[seat]}
                </span>
              </dd>
            </div>
          ))}
        </dl>

        {mvp && <MvpBlock mvp={mvp} seatNames={seatNames} />}

        <ul className="mt-4 space-y-2">
          {review.lessons.map((lesson) => (
            <li
              key={lesson.title}
              className="rounded-xl border border-emerald-400/15 bg-emerald-500/10 px-3 py-2 text-left"
            >
              <p className="text-sm font-bold text-emerald-200">{lesson.title}</p>
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
            {continueLabel}
          </button>
          {onShare && (
            <button
              type="button"
              onClick={onShare}
              className="min-h-[44px] w-full rounded-xl border border-amber-400/40 bg-amber-500/10 px-6 py-3 font-semibold text-amber-100 touch-manipulation hover:bg-amber-500/20"
            >
              {shareLabel ?? '複製分享'}
            </button>
          )}
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

function MvpBlock({
  mvp,
  seatNames = SEAT_NAMES,
}: {
  mvp: MatchMvp;
  seatNames?: string[];
}): React.ReactElement {
  const rows: { label: string; seat: number; value: string }[] = [
    {
      label: '最多紅點',
      seat: mvp.mostPointsSeat,
      value: `${mvp.mostPointsTotal} 分`,
    },
    {
      label: '單局最高',
      seat: mvp.bestHandSeat,
      value: `${mvp.bestHandScore} 分（第 ${mvp.bestHandIndex + 1} 圈）`,
    },
    {
      label: '籌碼王',
      seat: mvp.chipLeaderSeat,
      value: `${mvp.chipLeaderTotal >= 0 ? '+' : ''}${mvp.chipLeaderTotal}`,
    },
  ];

  return (
    <section className="mt-4 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-3" aria-label="MVP 統計">
      <p className="text-center text-[11px] font-bold tracking-[0.2em] text-amber-200/80">
        MVP 統計
      </p>
      <ul className="mt-2 space-y-1.5">
        {rows.map((row) => (
          <li
            key={row.label}
            className="flex items-baseline justify-between gap-2 text-sm"
          >
            <span className="text-amber-100/70">{row.label}</span>
            <span className="text-right font-semibold text-amber-50">
              {seatNames[row.seat] ?? SEAT_NAMES[row.seat]}
              <span className="ml-2 font-mono text-xs font-normal text-amber-200/60">
                {row.value}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
