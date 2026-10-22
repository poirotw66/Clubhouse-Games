import React from 'react';
import { personalityForSeat } from '../game/cpu';
import { isSeriesMode } from '../game/match';
import { opponentById } from '../game/opponents';
import type { MatchState } from '../game/types';
import { HUMAN } from '../game/types';

const SEAT_NAMES = ['你', '對家甲', '對家乙', '對家丙'];

interface Props {
  match: MatchState;
  progress: string;
}

export function MatchScoreboard({ match, progress }: Props): React.ReactElement | null {
  if (!isSeriesMode(match.config.mode)) return null;

  const target = match.config.mode === 'target' ? match.config.target : null;
  const maxAbs = Math.max(1, ...match.balances.map((n) => Math.abs(n)));
  const cols = match.balances.length;
  const ladderOpp = match.config.ladderOpponentId
    ? opponentById(match.config.ladderOpponentId)
    : null;
  const heading =
    match.config.mode === 'daily' ? '每日牌桌' : ladderOpp ? '對手挑戰' : '系列賽';

  return (
    <section
      className="rounded-xl border border-emerald-400/20 bg-slate-900/70 px-3 py-2"
      aria-label="系列賽計分板"
    >
      <div className="mb-2 flex items-center justify-between text-[11px] text-emerald-200/70">
        <span className="font-bold tracking-wide">{heading}</span>
        <span>{progress}</span>
      </div>
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {match.balances.map((chips, seat) => {
          const person = personalityForSeat(seat);
          const name =
            ladderOpp && seat === 1 ? ladderOpp.name : SEAT_NAMES[seat];
          const leading =
            chips === Math.max(...match.balances) &&
            match.balances.some((c) => c !== chips || chips !== 0);
          const pct = Math.min(100, (Math.abs(chips) / maxAbs) * 100);
          const bar = chips >= 0 ? 'bg-emerald-400/80' : 'bg-rose-400/70';
          return (
            <div
              key={seat}
              className={`rounded-lg px-1.5 py-1.5 text-center ${
                seat === HUMAN ? 'bg-emerald-500/15 ring-1 ring-emerald-400/40' : 'bg-slate-800/60'
              }`}
            >
              <div className="truncate text-[10px] font-bold text-emerald-100">
                {name}
                {person && !(ladderOpp && seat === 1) ? (
                  <span className="block truncate font-normal text-emerald-200/45">
                    {person.name}
                  </span>
                ) : ladderOpp && seat === 1 ? (
                  <span className="block truncate font-normal text-emerald-200/45">
                    {ladderOpp.tagline}
                  </span>
                ) : null}
              </div>
              <div
                className={`mt-0.5 font-mono text-sm font-black tabular-nums ${
                  chips > 0
                    ? 'text-emerald-300'
                    : chips < 0
                      ? 'text-rose-300'
                      : 'text-slate-300'
                }`}
              >
                {chips > 0 ? '+' : ''}
                {chips}
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-700/80">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${bar}`}
                  style={{ width: `${leading || chips !== 0 ? pct : 0}%` }}
                />
              </div>
              {target !== null && (
                <div className="mt-0.5 text-[9px] text-slate-500">/{target}</div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
