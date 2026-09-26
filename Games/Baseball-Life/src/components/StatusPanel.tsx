import React from 'react';
import {
  ATTR_LABELS,
  LEAGUES,
  META_LABELS,
  attrsForPosition,
  formatMoney,
  grade,
  gradeColor,
  overall,
} from '../game/config';
import { pitchInfo } from '../game/pitches';
import { traitById } from '../game/traits';
import type { GameState } from '../game/types';

/**
 * Fatigue runs the other way to every other number on this panel: the grade
 * palette treats "hot" as elite, which would paint a well-rested player red.
 */
function fatigueColor(value: number): string {
  if (value >= 65) return '#f87171';
  if (value >= 35) return '#fbbf24';
  return '#4ade80';
}

function Bar({ value }: { value: number }): React.ReactElement {
  return (
    <div className="h-1.5 w-full rounded-full bg-slate-700/70">
      <div
        className="h-full rounded-full transition-[width] duration-300"
        style={{ width: `${Math.max(2, value)}%`, background: gradeColor(value) }}
      />
    </div>
  );
}

export function StatusPanel({ state }: { state: GameState }): React.ReactElement {
  const keys = attrsForPosition(state.position);
  const rating = overall(state.attrs, state.position);
  const league = LEAGUES[state.league];

  return (
    <section className="bl-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold text-slate-200">能力</h2>
        <p className="text-xs text-slate-400">
          綜合{' '}
          <span className="text-base font-black" style={{ color: gradeColor(rating) }}>
            {grade(rating)}
          </span>
          <span className="ml-1 font-mono text-slate-500">{rating.toFixed(0)}</span>
        </p>
      </div>

      <dl className="mt-3 space-y-2">
        {keys.map((key) => (
          <div key={key} className="grid grid-cols-[3.5rem_1fr_2.5rem] items-center gap-2">
            <dt className="text-xs text-slate-400">{ATTR_LABELS[key]}</dt>
            <dd>
              <Bar value={state.attrs[key]} />
            </dd>
            <dd className="text-right">
              <span className="text-sm font-bold" style={{ color: gradeColor(state.attrs[key]) }}>
                {grade(state.attrs[key])}
              </span>
              <span className="ml-1 font-mono text-[10px] text-slate-500">{state.attrs[key]}</span>
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 grid grid-cols-4 gap-2 border-t border-slate-700/60 pt-3 text-center">
        {(['body', 'mind', 'fame', 'fatigue'] as const).map((key) => (
          <div key={key}>
            <p className="text-[10px] text-slate-500">{META_LABELS[key]}</p>
            <p
              className="font-mono text-sm font-bold"
              style={{ color: key === 'fatigue' ? fatigueColor(state.meta[key]) : gradeColor(state.meta[key]) }}
            >
              {state.meta[key]}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
        <span className="text-[11px] font-semibold text-amber-200">{META_LABELS.destiny}</span>
        <div className="h-1.5 flex-1 rounded-full bg-slate-700/70">
          <div
            className="h-full rounded-full bg-amber-400 transition-[width] duration-300"
            style={{ width: `${Math.max(2, state.meta.destiny)}%` }}
          />
        </div>
        <span className="font-mono text-xs font-bold text-amber-300">{state.meta.destiny}</span>
      </div>

      {state.injury && (
        <p className="mt-3 rounded-lg bg-rose-950/60 px-3 py-2 text-xs text-rose-200">
          傷勢：{state.injury.name}
          {state.injury.seasonsLeft > 0 && `（復健中，還需 ${state.injury.seasonsLeft} 季）`}
        </p>
      )}

      {state.traits.length > 0 && (
        <div className="mt-3 border-t border-slate-700/60 pt-3">
          <p className="text-[10px] tracking-wider text-slate-500">已覺醒特質</p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {state.traits.map((id) => {
              const trait = traitById(id);
              if (!trait) return null;
              return (
                <li
                  key={id}
                  title={trait.desc}
                  className="rounded-full border border-amber-500/50 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-200"
                >
                  {trait.label}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {state.arsenal.length > 0 && (
        <div className="mt-3 border-t border-slate-700/60 pt-3">
          <p className="text-[10px] tracking-wider text-slate-500">球種</p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {[...state.arsenal]
              .sort((a, b) => b.level - a.level)
              .map((slot) => (
                <li
                  key={slot.id}
                  title={pitchInfo(slot.id).blurb}
                  className="rounded-md bg-slate-800/80 px-2 py-0.5 text-[11px] text-slate-300"
                >
                  {pitchInfo(slot.id).label}
                  <span className="ml-1 font-bold" style={{ color: gradeColor(slot.level) }}>
                    {grade(slot.level)}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      )}

      {(state.finance.salary > 0 || state.finance.earnings > 0) && (
        <dl className="mt-3 flex items-baseline justify-between border-t border-slate-700/60 pt-3 text-[11px]">
          <div>
            <dt className="inline text-slate-500">年薪 </dt>
            <dd className="inline font-mono text-emerald-300">{formatMoney(state.finance.salary)}</dd>
          </div>
          <div>
            <dt className="inline text-slate-500">生涯收入 </dt>
            <dd className="inline font-mono text-slate-300">{formatMoney(state.finance.earnings)}</dd>
          </div>
        </dl>
      )}

      <p className="mt-3 text-[11px] text-slate-500">
        {league.label}・{state.team}
      </p>
    </section>
  );
}
