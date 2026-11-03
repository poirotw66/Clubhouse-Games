import React, { useEffect, useState } from 'react';
import { TouchButton } from '@clubhouse/shared/TouchButton';
import type { CareerChallenge } from '../game/challenges';
import { formatMoney } from '../game/config';
import { humanTeam } from '../game/engine';
import type { GameState, Report } from '../game/types';
import { Dashboard } from './Dashboard';
import { GMDossier } from './GMDossier';
import { HighlightReel } from './HighlightReel';
import { RosterPanel } from './RosterPanel';
import { StrategicWarRoom } from './StrategicWarRoom';
import { TacticalQuickBar } from './TacticalQuickBar';
import { WarRoomModal } from './WarRoomModal';

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
  challenge?: CareerChallenge | null;
  onChoose: (optionId: string) => void;
  onAcknowledge: () => void;
  onUndo: () => void;
  canUndo: boolean;
  onQuit: () => void;
}

function loadViewMode(): 'dual' | 'standard' {
  try {
    const val = localStorage.getItem('clubhouse:dynasty:view-mode');
    return val === 'standard' ? 'standard' : 'dual';
  } catch {
    return 'dual';
  }
}

function saveViewMode(mode: 'dual' | 'standard'): void {
  try {
    localStorage.setItem('clubhouse:dynasty:view-mode', mode);
  } catch {
    // ignore
  }
}

export function PlayScreen({
  state,
  challenge,
  onChoose,
  onAcknowledge,
  onUndo,
  canUndo,
  onQuit,
}: Props): React.ReactElement {
  const [showRoster, setShowRoster] = useState(false);
  const [showWarRoomModal, setShowWarRoomModal] = useState(false);
  const [viewMode, setViewMode] = useState<'dual' | 'standard'>(loadViewMode);

  const { report, decision } = state;
  const team = humanTeam(state);

  const toggleViewMode = () => {
    setViewMode((prev) => {
      const next = prev === 'dual' ? 'standard' : 'dual';
      saveViewMode(next);
      return next;
    });
  };

  const ended = state.over;
  const pickable = ended ? [] : (decision?.options ?? []).filter((o) => !o.disabled);

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
      if (event.key === 'w' || event.key === 'W') {
        event.preventDefault();
        setShowWarRoomModal((v) => !v);
        return;
      }
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
    <div className={`mx-auto w-full px-3 sm:px-4 pb-16 pt-12 transition-all ${viewMode === 'dual' ? 'max-w-[100rem]' : 'max-w-5xl'}`}>
      {/* Top Tactical Status Bar */}
      <TacticalQuickBar
        state={state}
        onOpenWarRoom={() => setShowWarRoomModal(true)}
        onToggleRoster={() => setShowRoster((v) => !v)}
        isRosterOpen={showRoster}
        viewMode={viewMode}
        onToggleViewMode={toggleViewMode}
      />

      {/* Main Header */}
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 border-b border-slate-800/80 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-100">
              {state.gmName}
              <span className="ml-2 text-xs font-normal text-slate-400">球團總管</span>
            </h1>
            <span className="rounded bg-emerald-950/80 border border-emerald-500/40 px-2 py-0.5 text-xs font-bold text-emerald-300">
              {team.name}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            世界種子碼 <span className="font-mono text-emerald-300/90">{state.seedCode}</span>
          </p>
          {challenge && (
            <p className="mt-1 text-xs font-semibold text-sky-300">
              生涯挑戰・{challenge.name}
              <span className="ml-2 font-normal text-slate-400">目標：{challenge.goalLabel}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <TouchButton
            label="放棄任期"
            ariaLabel="放棄目前進度並回到標題"
            onClick={onQuit}
            className="rounded-lg border border-slate-700 bg-slate-800/70 px-3 text-xs font-semibold text-slate-400 hover:text-rose-300 hover:border-rose-500/50"
          />
        </div>
      </header>

      {/* Operations Center Layout */}
      {viewMode === 'dual' ? (
        /* Dual-Wing 3-Column Layout on XL, 2-Column on LG, 1-Column on Mobile */
        <div className="grid gap-4 xl:grid-cols-[21rem_minmax(0,1fr)_21rem] lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
          {/* Left Wing: Strategic War Room */}
          <div className="hidden lg:block space-y-4">
            <StrategicWarRoom state={state} />
          </div>

          {/* Center Column: Command & Decision Hub */}
          <main className="flex flex-col gap-4 min-w-0" aria-label="球團決策指揮中心">
            {report && (
              <section
                className="dy-card p-4 sm:p-5 shadow-xl"
                style={{ borderColor: TONE_RING[report.tone] }}
                aria-live="polite"
              >
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-mono tracking-wider uppercase text-slate-500">
                    {report.label}
                  </p>
                  <span
                    className={`h-2 w-2 rounded-full ${
                      report.tone === 'great'
                        ? 'bg-emerald-400'
                        : report.tone === 'good'
                        ? 'bg-emerald-500'
                        : report.tone === 'bad'
                        ? 'bg-rose-500'
                        : 'bg-slate-500'
                    }`}
                  />
                </div>
                <h2 className="mt-1 text-lg sm:text-xl font-bold text-slate-100">
                  {report.headline}
                </h2>

                <div className="mt-3 space-y-2">
                  {report.lines.map((line, index) => (
                    <p key={index} className="text-sm leading-relaxed text-slate-300">
                      {line}
                    </p>
                  ))}
                </div>

                {report.highlight && <HighlightReel highlight={report.highlight} />}

                {report.standings && (
                  <ol className="mt-3 space-y-1 rounded-lg bg-slate-900/60 p-3 border border-slate-800">
                    {report.standings.map((row, index) => (
                      <li
                        key={row.teamId}
                        className={`flex justify-between text-xs ${
                          row.teamId === state.teamId
                            ? 'font-bold text-emerald-300'
                            : 'text-slate-400'
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

                {ended && (
                  <TouchButton
                    label="看任期總結"
                    ariaLabel="看任期總結"
                    onClick={onAcknowledge}
                    className="mt-4 w-full rounded-xl bg-emerald-500 px-4 py-3 text-base font-black text-slate-950 hover:bg-emerald-400 transition-colors"
                  />
                )}
              </section>
            )}

            {!ended && decision && (
              <section className="dy-card p-4 sm:p-5 border-emerald-500/30 bg-slate-900/90 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-mono font-bold tracking-wider uppercase text-emerald-400">
                      ◆ 總管審批決策
                    </span>
                    <span className="text-slate-600">/</span>
                    <span className="text-xs text-slate-400">{decision.title}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">
                    可選方案 ({pickable.length})
                  </span>
                </div>

                <h2 className="mt-3 text-base sm:text-lg font-bold leading-relaxed text-slate-100">
                  {decision.prompt}
                </h2>

                <div className="mt-4 flex flex-col gap-2.5">
                  {decision.options.map((option) => {
                    const hotkey = pickable.findIndex((o) => o.id === option.id);
                    return (
                      <button
                        key={option.id}
                        type="button"
                        disabled={option.disabled}
                        onClick={() => onChoose(option.id)}
                        className="dy-choice min-h-16 px-4 py-3 text-left focus:outline-none"
                      >
                        <span className="flex items-baseline gap-2">
                          {hotkey >= 0 && (
                            <kbd className="hidden shrink-0 rounded border border-emerald-500/40 bg-emerald-950/80 px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-300 sm:inline-block">
                              {hotkey + 1}
                            </kbd>
                          )}
                          <span className="text-sm sm:text-base font-bold text-slate-100">
                            {option.label}
                          </span>
                          {option.cost !== undefined && option.cost > 0 && (
                            <span className="ml-auto shrink-0 font-mono text-xs font-bold text-rose-300">
                              −{formatMoney(option.cost)}
                            </span>
                          )}
                        </span>
                        <span className="mt-1 block text-xs leading-snug text-slate-400">
                          {option.disabled && option.disabledReason
                            ? `${option.hint}（${option.disabledReason}）`
                            : option.hint}
                        </span>
                        {option.detail && option.detail.length > 0 && (
                          <span className="mt-1.5 block space-y-0.5 border-t border-slate-800/60 pt-1.5">
                            {option.detail.map((line, index) => (
                              <span key={index} className="block text-[11px] text-slate-400">
                                ▫ {line}
                              </span>
                            ))}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-3">
                  <button
                    type="button"
                    onClick={onUndo}
                    disabled={!canUndo}
                    className="min-h-11 rounded-lg border border-slate-700 bg-slate-800/80 px-3 text-xs font-semibold text-slate-300 hover:bg-slate-700 disabled:opacity-35 transition-colors"
                  >
                    ← 上一步
                  </button>
                  <p className="hidden text-right text-[11px] text-slate-400 font-mono sm:block">
                    按 1–{Math.max(pickable.length, 1)} 審批決策・Backspace 上一步・W 戰略沙盤・R 球員名單
                  </p>
                </div>
              </section>
            )}

            {/* Collapsible Roster Panel */}
            <section className="dy-card p-4">
              <button
                type="button"
                onClick={() => setShowRoster((v) => !v)}
                aria-expanded={showRoster}
                className="flex min-h-11 w-full items-center justify-between text-left"
              >
                <span className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <span>⚾ 一二軍球員名單</span>
                  <span className="rounded bg-slate-800 px-2 py-0.5 text-xs font-normal text-slate-400 font-mono">
                    {team.players.length} 人
                  </span>
                </span>
                <span className="text-xs text-sky-400 font-semibold">
                  {showRoster ? '收起名單 ▲' : '展開名單 ▼'}
                </span>
              </button>
              {showRoster && (
                <div className="mt-3">
                  <RosterPanel team={team} />
                </div>
              )}
            </section>

            {/* Mobile / Medium Fallback: GMDossier if not on XL screen */}
            <div className="xl:hidden">
              <GMDossier state={state} />
            </div>
          </main>

          {/* Right Wing: GM Dossier & Market Intel on XL */}
          <div className="hidden xl:block space-y-4">
            <GMDossier state={state} />
          </div>
        </div>
      ) : (
        /* Standard 2-Column Layout */
        <div className="grid gap-4 lg:grid-cols-[20rem_1fr] lg:items-start">
          <div className="space-y-4">
            <Dashboard state={state} />
            <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-3 text-center">
              <button
                type="button"
                onClick={() => setShowWarRoomModal(true)}
                className="w-full rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 py-2 text-xs font-bold text-emerald-300 transition-colors"
              >
                🧭 開啟完整球團戰略作戰室 (W)
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {report && (
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

                {report.highlight && <HighlightReel highlight={report.highlight} />}

                {report.standings && (
                  <ol className="mt-3 space-y-1 rounded-lg bg-slate-900/60 p-3">
                    {report.standings.map((row, index) => (
                      <li
                        key={row.teamId}
                        className={`flex justify-between text-[11px] ${
                          row.teamId === state.teamId
                            ? 'font-bold text-emerald-300'
                            : 'text-slate-400'
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

                {ended && (
                  <TouchButton
                    label="看任期總結"
                    ariaLabel="看任期總結"
                    onClick={onAcknowledge}
                    className="mt-4 w-full rounded-xl bg-emerald-500 px-4 text-base font-black text-slate-950"
                  />
                )}
              </section>
            )}

            {!ended && decision && (
              <section className="dy-card p-4">
                <p className="text-[11px] tracking-wider text-slate-500">{decision.title}</p>
                <h2 className="mt-1 text-base leading-relaxed text-slate-200">
                  {decision.prompt}
                </h2>
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
                          <span className="text-base font-bold text-slate-100">
                            {option.label}
                          </span>
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
                    按 1–{Math.max(pickable.length, 1)} 選擇・Backspace 上一步・W 戰略沙盤・R 開關名單
                  </p>
                </div>
              </section>
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
                  <span className="ml-2 text-xs font-normal text-slate-500">
                    {team.players.length} 人
                  </span>
                </span>
                <span className="text-xs text-slate-400">
                  {showRoster ? '收起 ▲' : '展開 ▼'}
                </span>
              </button>
              {showRoster && (
                <div className="mt-3">
                  <RosterPanel team={team} />
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {/* War Room Interactive Modal */}
      <WarRoomModal
        state={state}
        isOpen={showWarRoomModal}
        onClose={() => setShowWarRoomModal(false)}
      />
    </div>
  );
}
