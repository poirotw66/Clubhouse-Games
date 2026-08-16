import React, { useEffect, useState } from 'react';
import { TouchButton } from '@clubhouse/shared/TouchButton';
import { formatMoney } from '../game/config';
import { humanTeam } from '../game/engine';
import type { GameState, Report } from '../game/types';
import { Dashboard } from './Dashboard';
import { RosterPanel } from './RosterPanel';

const TONE_RING: Record<Report['tone'], string> = {
  normal: 'rgba(148,163,184,0.35)',
  good: 'rgba(74,222,128,0.55)',
  bad: 'rgba(248,113,113,0.55)',
  great: 'rgba(52,211,153,0.85)',
};

function Ledger({ ledger }: { ledger: NonNullable<Report['ledger']> }): React.ReactElement {
  const rows: [string, number][] = [
    ['門票', ledger.tickets],
    ['週邊', ledger.merch],
    ['轉播與分潤', ledger.broadcast],
    ['贊助', ledger.sponsor],
    ['球員薪資', -ledger.salaries],
    ['奢侈稅', -ledger.luxuryTax],
    ['訓練・球探・行銷', -ledger.spending],
    ['球場與農場維護', -ledger.upkeep],
  ];
  return (
    <div className="mt-3 rounded-lg bg-slate-900/70 p-3">
      <p className="text-[11px] text-slate-400">
        季均進場 <span className="font-mono text-slate-200">{ledger.attendance.toLocaleString('en-US')}</span> 人
      </p>
      <dl className="mt-2 space-y-1">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between text-[11px]">
            <dt className="text-slate-500">{label}</dt>
            <dd className={`font-mono ${value >= 0 ? 'text-slate-300' : 'text-rose-300'}`}>
              {formatMoney(value)}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-2 flex justify-between border-t border-slate-700/60 pt-2 text-xs font-bold">
        <span className="text-slate-300">本季損益</span>
        <span className={`font-mono ${ledger.net >= 0 ? 'text-emerald-300' : 'text-rose-400'}`}>
          {formatMoney(ledger.net)}
        </span>
      </div>
    </div>
  );
}

interface Props {
  state: GameState;
  onChoose: (optionId: string) => void;
  onAcknowledge: () => void;
  onQuit: () => void;
}

export function PlayScreen({ state, onChoose, onAcknowledge, onQuit }: Props): React.ReactElement {
  const [showRoster, setShowRoster] = useState(false);
  const { report, decision } = state;
  const team = humanTeam(state);

  const pickable = report ? [] : (decision?.options ?? []).filter((o) => !o.disabled);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

      if (event.key === 'r' || event.key === 'R') {
        event.preventDefault();
        setShowRoster((v) => !v);
        return;
      }
      if (report) {
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
  }, [report, pickable, onChoose, onAcknowledge]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-14">
      <header className="mt-3 mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <h1 className="text-xl font-black text-slate-100">
            {state.gmName}
            <span className="ml-2 text-xs font-normal text-slate-400">總管</span>
          </h1>
          <p className="text-[11px] text-slate-500">
            種子碼 <span className="font-mono text-emerald-300/80">{state.seedCode}</span>
          </p>
        </div>
        <TouchButton
          label="放棄任期"
          ariaLabel="放棄目前進度並回到標題"
          onClick={onQuit}
          className="rounded-lg border border-slate-700 bg-slate-800/70 px-3 text-xs font-semibold text-slate-400"
        />
      </header>

      <div className="grid gap-4 lg:grid-cols-[20rem_1fr] lg:items-start">
        <Dashboard state={state} />

        <div className="flex flex-col gap-4">
          {report ? (
            <section
              className="dy-card p-4"
              style={{ borderColor: TONE_RING[report.tone] }}
              aria-live="polite"
            >
              <p className="text-[11px] tracking-wider text-slate-500">{report.label}</p>
              <h2 className="mt-1 text-lg font-bold text-slate-100">{report.headline}</h2>

              <div className="mt-3 space-y-2">
                {report.lines.map((line, index) => (
                  <p key={index} className="text-sm leading-relaxed text-slate-300">
                    {line}
                  </p>
                ))}
              </div>

              {report.standings && (
                <ol className="mt-3 space-y-1 rounded-lg bg-slate-900/60 p-3">
                  {report.standings.map((row, index) => (
                    <li
                      key={row.teamId}
                      className={`flex justify-between text-[11px] ${
                        row.teamId === state.teamId ? 'font-bold text-emerald-300' : 'text-slate-400'
                      }`}
                    >
                      <span>
                        {index + 1}. {row.name}
                      </span>
                      <span className="font-mono">
                        {row.wins}勝 {row.losses}敗
                      </span>
                    </li>
                  ))}
                </ol>
              )}

              {report.ledger && <Ledger ledger={report.ledger} />}

              <TouchButton
                label={state.over ? '看任期總結' : '繼續'}
                ariaLabel={state.over ? '看任期總結' : '繼續下一個階段'}
                onClick={onAcknowledge}
                className="mt-4 w-full rounded-xl bg-emerald-500 px-4 text-base font-black text-slate-950"
              />
              <p className="mt-2 hidden text-center text-[10px] text-slate-500 sm:block">
                按 Enter 或空白鍵繼續・按 R 開關名單
              </p>
            </section>
          ) : (
            decision && (
              <section className="dy-card p-4">
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
                        className="dy-choice min-h-16 px-4 py-3 text-left"
                      >
                        <span className="flex items-baseline gap-2">
                          {hotkey >= 0 && (
                            <kbd className="hidden shrink-0 rounded border border-slate-600 bg-slate-900/80 px-1.5 py-0.5 font-mono text-[10px] text-slate-400 sm:inline-block">
                              {hotkey + 1}
                            </kbd>
                          )}
                          <span className="text-base font-bold text-slate-100">{option.label}</span>
                          {option.cost !== undefined && option.cost > 0 && (
                            <span className="ml-auto shrink-0 font-mono text-[11px] text-rose-300">
                              −{formatMoney(option.cost)}
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block text-xs leading-snug text-slate-400">
                          {option.disabled && option.disabledReason
                            ? `${option.hint}（${option.disabledReason}）`
                            : option.hint}
                        </span>
                        {option.detail && option.detail.length > 0 && (
                          <span className="mt-1.5 block space-y-0.5">
                            {option.detail.map((line, index) => (
                              <span key={index} className="block text-[11px] text-slate-500">
                                {line}
                              </span>
                            ))}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            )
          )}

          <section className="dy-card p-4">
            <button
              type="button"
              onClick={() => setShowRoster((v) => !v)}
              aria-expanded={showRoster}
              className="flex min-h-11 w-full items-center justify-between text-left"
            >
              <span className="text-sm font-bold text-slate-200">
                球員名單
                <span className="ml-2 text-xs font-normal text-slate-500">{team.players.length} 人</span>
              </span>
              <span className="text-xs text-slate-400">{showRoster ? '收起 ▲' : '展開 ▼'}</span>
            </button>
            {showRoster && (
              <div className="mt-3">
                <RosterPanel team={team} />
              </div>
            )}
          </section>

          <section className="dy-card p-4">
            <h2 className="text-sm font-bold text-slate-200">日誌</h2>
            <ol className="mt-2 max-h-64 space-y-2 overflow-y-auto pr-1">
              {[...state.log].reverse().map((entry) => (
                <li key={entry.id} className="border-l-2 border-slate-700 pl-3">
                  <p className="text-[10px] tracking-wider text-slate-500">{entry.label}</p>
                  <p
                    className={`text-xs leading-relaxed ${
                      entry.tone === 'great'
                        ? 'text-emerald-200'
                        : entry.tone === 'good'
                          ? 'text-emerald-300/80'
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
