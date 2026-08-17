import React, { useEffect, useState } from 'react';
import { TouchButton } from '@clubhouse/shared/TouchButton';
import { ATTR_LABELS, LEAGUES, formatMoney } from '../game/config';
import { deltaLabel } from '../game/engine';
import { describeLine } from '../game/season';
import { traitById } from '../game/traits';
import type { AttrKey, GameState, TurnReport } from '../game/types';
import { CareerTable } from './CareerTable';
import { StatusPanel } from './StatusPanel';

const DIE_FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

const TONE_RING: Record<TurnReport['tone'], string> = {
  normal: 'rgba(148,163,184,0.35)',
  good: 'rgba(74,222,128,0.55)',
  bad: 'rgba(248,113,113,0.55)',
  great: 'rgba(251,191,36,0.75)',
};

function DeltaList({ deltas }: { deltas: TurnReport['deltas'] }): React.ReactElement | null {
  const entries = Object.entries(deltas).filter(([, value]) => value !== 0) as [string, number][];
  if (entries.length === 0) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-1.5">
      {entries.map(([key, value]) => (
        <li
          key={key}
          className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
            value > 0 ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'
          }`}
        >
          {deltaLabel(key)} {value > 0 ? '+' : ''}
          {value}
        </li>
      ))}
    </ul>
  );
}

interface Props {
  state: GameState;
  onChoose: (optionId: string) => void;
  onAcknowledge: () => void;
  onUndo: () => void;
  canUndo: boolean;
  onQuit: () => void;
}

export function PlayScreen({
  state,
  onChoose,
  onAcknowledge,
  onUndo,
  canUndo,
  onQuit,
}: Props): React.ReactElement {
  const [showCareer, setShowCareer] = useState(false);
  const { report, decision } = state;

  // The report is the outcome of the last choice and sits *above* the next
  // decision rather than in front of it. It used to be a separate screen with
  // a 繼續 button, which cost one dismissal click per decision — about half of
  // all the clicking across a full career.
  const ended = state.retired;
  const pickable = ended ? [] : (decision?.options ?? []).filter((o) => !o.disabled);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

      if (event.key === 'Backspace' && canUndo) {
        event.preventDefault();
        onUndo();
        return;
      }
      if (ended) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onAcknowledge();
        }
        return;
      }
      const index = Number(event.key) - 1;
      if (Number.isInteger(index) && index >= 0 && index < pickable.length) {
        event.preventDefault();
        onChoose(pickable[index].id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ended, pickable, onChoose, onAcknowledge, onUndo, canUndo]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-14">
      <header className="mt-3 mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <h1 className="text-xl font-black text-slate-100">
            {state.name}
            <span className="ml-2 text-xs font-normal text-slate-400">
              {state.age} 歲・{LEAGUES[state.league].short}
            </span>
          </h1>
          <p className="text-[11px] text-slate-500">
            {state.originLabel}・種子碼 <span className="font-mono text-amber-300/80">{state.seedCode}</span>
          </p>
        </div>
        <TouchButton
          label="放棄這段人生"
          ariaLabel="放棄目前進度並回到標題"
          onClick={onQuit}
          className="rounded-lg border border-slate-700 bg-slate-800/70 px-3 text-xs font-semibold text-slate-400"
        />
      </header>

      <div className="grid gap-4 lg:grid-cols-[20rem_1fr] lg:items-start">
        <StatusPanel state={state} />

        <div className="flex flex-col gap-4">
          {report && (
            <section
              className="bl-card p-4"
              style={{ borderColor: TONE_RING[report.tone] }}
              aria-live="polite"
            >
              <p className="text-[11px] tracking-wider text-slate-500">{report.label}</p>
              <div className="mt-1 flex items-center gap-3">
                {report.dice !== null && (
                  <span
                    key={`${state.turnIndex}-${state.choices.length}`}
                    className="bl-die text-4xl leading-none text-amber-300"
                    aria-label={`骰出 ${report.dice} 點`}
                  >
                    {DIE_FACES[report.dice]}
                  </span>
                )}
                <h2 className="text-lg font-bold text-slate-100">{report.headline}</h2>
              </div>

              <div className="mt-3 space-y-2">
                {report.lines.map((line, index) => (
                  <p key={index} className="text-sm leading-relaxed text-slate-300">
                    {line}
                  </p>
                ))}
              </div>

              {report.season && (
                <p className="mt-3 rounded-lg bg-slate-900/70 px-3 py-2 font-mono text-xs text-amber-200">
                  {describeLine(report.season.line)}
                </p>
              )}

              {report.milestones.length > 0 && (
                <ul className="mt-3 space-y-1 rounded-lg border border-sky-400/40 bg-sky-500/10 p-3">
                  {report.milestones.map((milestone, index) => (
                    <li key={index} className="text-xs font-semibold text-sky-100">
                      🏆 {milestone.text}
                    </li>
                  ))}
                </ul>
              )}

              {report.income !== null && report.income > 0 && (
                <p className="mt-3 text-xs text-emerald-300">
                  本季收入 {formatMoney(report.income)}
                  <span className="ml-2 text-slate-500">
                    生涯累計 {formatMoney(state.finance.earnings)}
                  </span>
                </p>
              )}

              <DeltaList deltas={report.deltas} />

              {report.traitsUnlocked.length > 0 && (
                <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                  {report.traitsUnlocked.map((id) => {
                    const trait = traitById(id);
                    if (!trait) return null;
                    return (
                      <p key={id} className="text-xs text-amber-100">
                        <span className="font-bold">覺醒：{trait.label}</span>
                        <span className="mt-0.5 block text-amber-200/80">{trait.desc}</span>
                      </p>
                    );
                  })}
                </div>
              )}

              {ended && (
                <TouchButton
                  label="看生涯總結"
                  ariaLabel="看生涯總結"
                  onClick={onAcknowledge}
                  className="mt-4 w-full rounded-xl bg-amber-500 px-4 text-base font-black text-slate-950"
                />
              )}
            </section>
          )}

          {!ended &&
            decision && (
              <section className="bl-card p-4">
                <p className="text-[11px] tracking-wider text-slate-500">{decision.title}</p>
                <h2 className="mt-1 text-base leading-relaxed text-slate-200">{decision.prompt}</h2>
                <div className="mt-4 flex flex-col gap-2">
                  {decision.options.map((option) => {
                    const hotkey = pickable.findIndex((o) => o.id === option.id);
                    return (
                    <button
                      key={option.id}
                      type="button"
                      disabled={option.disabled}
                      onClick={() => onChoose(option.id)}
                      className="bl-choice min-h-16 px-4 py-3 text-left"
                    >
                      <span className="flex items-baseline gap-2">
                        {hotkey >= 0 && (
                          <kbd className="hidden shrink-0 rounded border border-slate-600 bg-slate-900/80 px-1.5 py-0.5 font-mono text-[10px] text-slate-400 sm:inline-block">
                            {hotkey + 1}
                          </kbd>
                        )}
                        <span className="text-base font-bold text-slate-100">{option.label}</span>
                      </span>
                      <span className="mt-0.5 block text-xs leading-snug text-slate-400">
                        {option.disabled && option.disabledReason
                          ? `${option.hint}（${option.disabledReason}）`
                          : option.hint}
                      </span>
                      {option.focus && option.focus.length > 0 && (
                        <span className="mt-1.5 flex flex-wrap gap-1">
                          {option.focus.map((key: AttrKey) => (
                            <span
                              key={key}
                              className="rounded bg-slate-700/60 px-1.5 py-0.5 text-[10px] text-slate-300"
                            >
                              {ATTR_LABELS[key]}
                            </span>
                          ))}
                        </span>
                      )}
                    </button>
                    );
                  })}
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={onUndo}
                    disabled={!canUndo}
                    className="min-h-11 rounded-lg border border-slate-700 px-3 text-xs font-semibold text-slate-400 hover:bg-slate-800 disabled:opacity-35"
                  >
                    ← 上一步
                  </button>
                  <p className="hidden text-right text-[10px] text-slate-500 sm:block">
                    按 1–{Math.max(pickable.length, 1)} 選擇・Backspace 上一步
                  </p>
                </div>
              </section>
            )}

          <section className="bl-card p-4">
            <button
              type="button"
              onClick={() => setShowCareer((v) => !v)}
              aria-expanded={showCareer}
              className="flex min-h-11 w-full items-center justify-between text-left"
            >
              <span className="text-sm font-bold text-slate-200">
                生涯成績
                <span className="ml-2 text-xs font-normal text-slate-500">{state.history.length} 季</span>
              </span>
              <span className="text-xs text-slate-400">{showCareer ? '收起 ▲' : '展開 ▼'}</span>
            </button>
            {showCareer && (
              <div className="mt-3">
                <CareerTable history={state.history} />
              </div>
            )}
          </section>

          <section className="bl-card p-4">
            <h2 className="text-sm font-bold text-slate-200">日誌</h2>
            <ol className="mt-2 max-h-64 space-y-2 overflow-y-auto pr-1">
              {[...state.log].reverse().map((entry) => (
                <li key={entry.id} className="border-l-2 border-slate-700 pl-3">
                  <p className="text-[10px] tracking-wider text-slate-500">{entry.label}</p>
                  <p
                    className={`text-xs leading-relaxed ${
                      entry.tone === 'great'
                        ? 'text-amber-200'
                        : entry.tone === 'good'
                          ? 'text-emerald-200'
                          : entry.tone === 'bad'
                            ? 'text-rose-200'
                            : 'text-slate-300'
                    }`}
                  >
                    {entry.text}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
