import React from 'react';
import {
  EXPECTATIONS,
  SALARY_CAP,
  TRUST_DANGER,
  formatMoney,
  grade,
  gradeColor,
} from '../game/config';
import { humanTeam } from '../game/engine';
import { lineupStrength, payroll, pitchingStrength, starCount } from '../game/roster';
import { TENURE } from '../game/types';
import type { GameState } from '../game/types';

function Meter({ label, value, danger }: { label: string; value: number; danger?: boolean }): React.ReactElement {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] text-slate-500">{label}</span>
        <span
          className={`font-mono text-sm font-bold ${danger ? 'text-rose-400' : 'text-slate-200'}`}
        >
          {value}
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full rounded-full bg-slate-700/70">
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{
            width: `${Math.max(2, value)}%`,
            background: danger ? '#f87171' : '#34d399',
          }}
        />
      </div>
    </div>
  );
}

export function Dashboard({ state }: { state: GameState }): React.ReactElement {
  const team = humanTeam(state);
  const wages = payroll(team);
  const overCap = wages > SALARY_CAP;
  const lineup = lineupStrength(team);
  const pitching = pitchingStrength(team);

  return (
    <section className="dy-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold text-slate-100">{team.name}</h2>
        <p className="text-[11px] text-slate-400">
          任期 {Math.min(state.seasonIndex + 1, TENURE)}/{TENURE} 年・{state.year}
        </p>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <dt className="text-[10px] text-slate-500">資金</dt>
          <dd
            className={`font-mono text-base font-bold ${state.finance.cash < 0 ? 'text-rose-400' : 'text-emerald-300'}`}
          >
            {formatMoney(state.finance.cash)}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] text-slate-500">薪資總額</dt>
          <dd className={`font-mono text-base font-bold ${overCap ? 'text-amber-300' : 'text-slate-200'}`}>
            {formatMoney(wages)}
            {overCap && <span className="ml-1 text-[10px] font-normal text-amber-400">超過上限</span>}
          </dd>
        </div>
      </dl>

      <div className="mt-3 space-y-2.5">
        <Meter label="董事會信任" value={state.board.trust} danger={state.board.trust < TRUST_DANGER} />
        <Meter label="球迷熱度" value={state.heat} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-700/60 pt-3 text-center">
        <div>
          <p className="text-[10px] text-slate-500">打線</p>
          <p className="text-sm font-bold" style={{ color: gradeColor(lineup) }}>
            {grade(lineup)}
            <span className="ml-1 font-mono text-[10px] text-slate-500">{lineup.toFixed(0)}</span>
          </p>
        </div>
        <div>
          <p className="text-[10px] text-slate-500">投手</p>
          <p className="text-sm font-bold" style={{ color: gradeColor(pitching) }}>
            {grade(pitching)}
            <span className="ml-1 font-mono text-[10px] text-slate-500">{pitching.toFixed(0)}</span>
          </p>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
        <div>
          <dt className="text-slate-500">明星</dt>
          <dd className="font-mono font-bold text-slate-200">{starCount(team)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">農場</dt>
          <dd className="font-mono font-bold text-slate-200">Lv.{state.farmLevel}</dd>
        </div>
        <div>
          <dt className="text-slate-500">票價</dt>
          <dd className="font-mono font-bold text-slate-200">{state.finance.ticketPrice}</dd>
        </div>
      </dl>

      <p className="mt-3 rounded-lg bg-slate-900/60 px-3 py-2 text-[11px] text-slate-400">
        今年董事會的期望：
        <span className="ml-1 font-bold text-emerald-300">
          {EXPECTATIONS[state.board.expectation].label}
        </span>
        <span className="mt-0.5 block text-slate-500">{EXPECTATIONS[state.board.expectation].demand}</span>
      </p>
    </section>
  );
}
