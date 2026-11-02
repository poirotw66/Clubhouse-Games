import React from 'react';
import type { TacticalRadar } from '../game/tactics';
import type { MatchState } from '../game/types';

interface Props {
  radar: TacticalRadar;
  match: MatchState | null;
  seatLabel: (seat: number) => string;
  className?: string;
}

export function OpponentDossierPanel({
  radar,
  match,
  seatLabel,
  className = '',
}: Props): React.ReactElement {
  const { opponents, masterTip } = radar;

  return (
    <aside
      aria-label="對手情報與大師錦囊"
      className={`rounded-2xl border border-indigo-500/25 bg-slate-900/80 p-3.5 backdrop-blur-md shadow-xl flex flex-col gap-3 text-xs ${className}`}
    >
      <header className="flex items-center justify-between border-b border-indigo-500/20 pb-2">
        <div className="flex items-center gap-1.5 font-black text-indigo-200">
          <span className="text-sm">🗂️</span>
          <span className="tracking-wide">對手檔案與錦囊</span>
        </div>
        <span className="text-[10px] text-indigo-300/70 font-semibold">
          動態出牌記牌推論
        </span>
      </header>

      {/* Big-Two Master Advisory Wisdom */}
      <section className="rounded-xl border border-sky-400/40 bg-gradient-to-r from-sky-500/15 via-slate-900/40 to-sky-500/5 p-2.5">
        <div className="flex items-center gap-1.5 font-bold text-sky-200">
          <span className="text-sm">💡</span>
          <span>大老二大師錦囊</span>
        </div>
        <p className="mt-1 text-[11px] text-sky-100/90 leading-relaxed font-medium">
          {masterTip}
        </p>
      </section>

      {/* Opponent Dossiers */}
      <section className="flex flex-col gap-2">
        <div className="text-[11px] text-indigo-200/70 font-semibold">
          對手出牌習慣與過牌推論
        </div>
        <div className="flex flex-col gap-2">
          {opponents.map((op) => {
            const isCritical = op.count === 1;
            const isHighThreat = op.count > 1 && op.count <= 3;
            return (
              <div
                key={op.seat}
                className={`rounded-xl border p-2 flex flex-col gap-1.5 transition-colors ${
                  isCritical
                    ? 'border-rose-500/60 bg-rose-500/10'
                    : isHighThreat
                      ? 'border-amber-500/50 bg-amber-500/10'
                      : 'border-slate-800 bg-slate-900/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-indigo-100">
                      {seatLabel(op.seat)}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300">
                      {op.personalityName}
                    </span>
                    {op.isNextSeat && (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-amber-400/20 text-amber-300 font-semibold">
                        下家
                      </span>
                    )}
                  </div>
                  <span
                    className={`tabular-nums font-black px-2 py-0.5 rounded-full border text-[11px] ${
                      isCritical
                        ? 'border-rose-400 bg-rose-500/30 text-rose-200 animate-pulse'
                        : isHighThreat
                          ? 'border-amber-400/50 bg-amber-500/20 text-amber-200'
                          : 'border-slate-700 bg-slate-800 text-slate-300'
                    }`}
                  >
                    剩 {op.count} 張
                  </span>
                </div>

                {/* Pass Inferences */}
                <div className="text-[10px] text-indigo-100/70 flex flex-wrap gap-1 items-center">
                  <span className="text-slate-400">過牌紀錄：</span>
                  {op.passInferences.length === 0 ? (
                    <span className="text-slate-500 italic">無</span>
                  ) : (
                    op.passInferences.map((inf, idx) => (
                      <span
                        key={idx}
                        className="px-1.5 py-0.5 rounded bg-slate-800/80 border border-slate-700 text-indigo-200"
                      >
                        {inf}
                      </span>
                    ))
                  )}
                  {op.deucesPlayed > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/30 text-amber-200">
                      已出 {op.deucesPlayed} 張 2
                    </span>
                  )}
                </div>

                {op.personalityBlurb && (
                  <p className="text-[10px] text-indigo-200/50 leading-tight">
                    {op.personalityBlurb}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Series Momentum */}
      {match && match.history.length > 0 && (
        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-2.5 flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[11px] font-semibold text-indigo-200/80">
            <span>系列賽籌碼動能</span>
            <span className="text-indigo-300">
              第 {match.handIndex + 1} 局進行中
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1 text-center">
            {match.balances.map((balance, seat) => (
              <div
                key={seat}
                className={`rounded p-1 border text-[10px] ${
                  seat === 0
                    ? 'border-indigo-400/50 bg-indigo-500/15 font-bold text-indigo-200'
                    : 'border-slate-800 bg-slate-900/40 text-slate-400'
                }`}
              >
                <div>{seatLabel(seat)}</div>
                <div
                  className={`font-black tabular-nums mt-0.5 ${
                    balance > 0
                      ? 'text-emerald-400'
                      : balance < 0
                        ? 'text-rose-400'
                        : 'text-slate-300'
                  }`}
                >
                  {balance >= 0 ? `+${balance}` : balance}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </aside>
  );
}
